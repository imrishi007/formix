import random
import re
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_dataset import split_validation_by_completion  # noqa: E402


def test_validation_split_keeps_identical_targets_together():
    rows = [
        {"id": "a1", "completion": 'form "A" { field x: text }'},
        {"id": "a2", "completion": 'form "A" {\n field x: text\n}'},
        {"id": "b", "completion": 'form "B" { field y: email }'},
        {"id": "c", "completion": 'form "C" { field z: date }'},
    ]

    train, validation = split_validation_by_completion(rows, 1, random.Random(42))
    normalize = lambda item: re.sub(r"\s+", "", item["completion"])
    assert {normalize(item) for item in train}.isdisjoint(
        {normalize(item) for item in validation}
    )
    train_ids = {item["id"] for item in train}
    validation_ids = {item["id"] for item in validation}
    assert {"a1", "a2"} <= train_ids or {"a1", "a2"} <= validation_ids
