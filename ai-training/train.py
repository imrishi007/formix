#!/usr/bin/env python3
"""QLoRA fine-tuning for request-to-Forml generation and repair."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from torch.utils.data import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    Trainer,
    TrainingArguments,
)


SYSTEM_PROMPT = (
    "You write Forml, the Formix form DSL. Return only complete Forml source code. "
    "Follow the request and compiler diagnostics. Use only syntax in the Forml grammar."
)
BASE_MODEL = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
MAX_LENGTH = 2048


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


class FormlDataset(Dataset):
    def __init__(self, rows: list[dict], tokenizer):
        self.rows = rows
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, list[int]]:
        row = self.rows[index]
        prompt_ids = self.tokenizer.apply_chat_template(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": row["prompt"]},
            ],
            tokenize=True,
            add_generation_prompt=True,
        )
        full_ids = self.tokenizer.apply_chat_template(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": row["prompt"]},
                {"role": "assistant", "content": row["completion"]},
            ],
            tokenize=True,
            add_generation_prompt=False,
        )
        # Mask the prompt so the loss teaches the model to produce Forml, not
        # to copy the system/request text back to the user.
        prefix_length = min(len(prompt_ids), len(full_ids))
        labels = [-100] * prefix_length + full_ids[prefix_length:]
        input_ids = full_ids[:MAX_LENGTH]
        labels = labels[:MAX_LENGTH]
        return {"input_ids": input_ids, "attention_mask": [1] * len(input_ids), "labels": labels}


class CausalPadding:
    def __init__(self, tokenizer):
        self.tokenizer = tokenizer

    def __call__(self, features: list[dict[str, list[int]]]) -> dict[str, torch.Tensor]:
        max_len = max(len(item["input_ids"]) for item in features)
        pad_id = self.tokenizer.pad_token_id
        input_ids, attention_mask, labels = [], [], []
        for item in features:
            padding = max_len - len(item["input_ids"])
            input_ids.append(item["input_ids"] + [pad_id] * padding)
            attention_mask.append(item["attention_mask"] + [0] * padding)
            labels.append(item["labels"] + [-100] * padding)
        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("ai-training/data"))
    parser.add_argument("--output", type=Path, default=Path("ai-training/output"))
    parser.add_argument("--model", default=BASE_MODEL)
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--grad-accum", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    args = parser.parse_args()
    if not torch.cuda.is_available():
        raise SystemExit("A CUDA GPU is required. In Kaggle, enable a GPU accelerator and restart the session.")
    args.output.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        quantization_config=quantization,
        device_map="auto",
        torch_dtype=torch.float16,
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    model = get_peft_model(
        model,
        LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        ),
    )
    model.print_trainable_parameters()

    train_dataset = FormlDataset(read_jsonl(args.data / "train.jsonl"), tokenizer)
    validation_dataset = FormlDataset(read_jsonl(args.data / "validation.jsonl"), tokenizer)
    training_args = TrainingArguments(
        output_dir=str(args.output / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.learning_rate,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        fp16=True,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        report_to="none",
        remove_unused_columns=False,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        seed=42,
        data_seed=42,
    )
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
        data_collator=CausalPadding(tokenizer),
    )
    result = trainer.train()
    trainer.save_model(str(args.output / "adapter"))
    tokenizer.save_pretrained(str(args.output / "adapter"))
    metadata = {
        "base_model": args.model,
        "training_examples": len(train_dataset),
        "validation_examples": len(validation_dataset),
        "epochs": args.epochs,
        "learning_rate": args.learning_rate,
        "gpu": torch.cuda.get_device_name(0),
        "train_metrics": result.metrics,
    }
    (args.output / "training_metadata.json").write_text(json.dumps(metadata, indent=2, default=str), encoding="utf-8")
    print(json.dumps(metadata, indent=2, default=str))


if __name__ == "__main__":
    main()
