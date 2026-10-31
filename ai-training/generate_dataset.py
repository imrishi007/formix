#!/usr/bin/env python3
"""Create grammar-grounded Forml generation and compiler-repair examples.

The small recipe library deliberately emits only constructs covered by the
canonical EBNF. The native Forml compiler remains the acceptance test: a
candidate is never written to the dataset unless its target compiles cleanly.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import subprocess
import tempfile
from pathlib import Path


FIELD_LIBRARY = [
    {"name": "full_name", "label": "Full name", "type": "text", "rule": "required"},
    {"name": "email", "label": "Email address", "type": "email", "rule": "required"},
    {"name": "phone", "label": "Phone number", "type": "text", "rule": "optional"},
    {"name": "age", "label": "Age", "type": "integer", "rule": "age"},
    {"name": "start_date", "label": "Preferred date", "type": "date", "rule": "required"},
    {"name": "website", "label": "Website", "type": "url", "rule": "optional"},
    {"name": "consent", "label": "Consent", "type": "boolean", "rule": "required"},
    {"name": "department", "label": "Department", "type": "select", "options": ["Engineering", "Design", "Operations"]},
    {"name": "contact_method", "label": "Preferred contact method", "type": "radio", "options": ["Email", "Phone", "Text message"]},
    {"name": "interests", "label": "Topics of interest", "type": "checkbox", "options": ["Product news", "Events", "Research"]},
    {"name": "dietary_preferences", "label": "Dietary preferences", "type": "checkbox", "options": ["Vegetarian", "Vegan", "Gluten-free", "No restrictions"]},
    {"name": "message", "label": "Message", "type": "text", "rule": "required"},
    {"name": "comments", "label": "Comments", "type": "text", "rule": "optional"},
    {"name": "rating", "label": "Rating", "type": "select", "options": ["1", "2", "3", "4", "5"]},
    {"name": "organization", "label": "Organization", "type": "text", "rule": "optional"},
    {"name": "job_title", "label": "Job title", "type": "text", "rule": "optional"},
    {"name": "attendance_mode", "label": "Attendance mode", "type": "radio", "options": ["In person", "Online"]},
    {"name": "city", "label": "City", "type": "text", "rule": "optional"},
    {"name": "country", "label": "Country", "type": "text", "rule": "optional"},
]

RECIPES = [
    ("event registration", "event", ["full_name", "email", "start_date", "interests", "dietary_preferences", "attendance_mode"]),
    ("job application", "job", ["full_name", "email", "phone", "age", "website"]),
    ("customer feedback", "feedback", ["full_name", "email", "department", "interests"]),
    ("appointment request", "appointment", ["full_name", "email", "phone", "start_date", "contact_method"]),
    ("newsletter signup", "newsletter", ["email", "interests", "consent"]),
    ("course enrollment", "course", ["full_name", "email", "age", "department", "start_date"]),
    ("volunteer application", "volunteer", ["full_name", "email", "phone", "interests", "consent"]),
    ("contact request", "contact", ["full_name", "email", "contact_method"]),
    ("product order", "order", ["full_name", "email", "department", "consent"]),
    ("health intake", "health", ["full_name", "email", "age", "start_date", "consent"]),
    ("support request", "support", ["full_name", "email", "department", "message"]),
    ("product survey", "survey", ["email", "rating", "interests", "comments"]),
    ("speaker proposal", "speaker", ["full_name", "email", "job_title", "organization", "website"]),
    ("travel inquiry", "travel", ["full_name", "email", "city", "country", "start_date"]),
]

PROMPT_FORMS = [
    "Create a {kind} form for {audience}. Include {fields}.",
    "I need a {kind} form that collects {fields} from {audience}.",
    "Build a Forml form for {audience}: {fields}. Make it a {kind} form.",
    "Generate a {kind} form. Ask {audience} for {fields}.",
    "Make a {kind} for {audience} with {fields}.",
    "{kind}: collect {fields}. This is for {audience}.",
    "I want a {kind}. The form needs {fields} for {audience}.",
]

EDIT_PROMPT_FORMS = [
    "Revise the Forml source below by adding {field}. Preserve every existing field and return the complete source.\n\nCurrent Forml source:\n{source}",
    "Add {field} to this existing form. Keep the unrelated fields unchanged and return complete Forml only.\n\nCurrent Forml source:\n{source}",
    "Update this form so it also collects {field}. Return the full revised source, not a patch.\n\nCurrent Forml source:\n{source}",
]

AUDIENCES = ["new participants", "people applying online", "our customers", "event attendees", "students", "prospective volunteers", "visitors"]

# These small, named blueprints add the grammar's structural rules to the
# compositional field examples above. Each source is still run through the
# compiler, which checks both syntax and semantic references before use.
COMPLEX_RECIPES = [
    {
        "scenario": "conditional",
        "prompts": [
            "Create an adult eligibility form. Ask for age, then show an occupation field for adults or a guardian name field for minors.",
            "Build a form that asks someone's age and conditionally requests their occupation if they are an adult, otherwise their guardian's name.",
            "Make an eligibility form with an age question. For ages 18 and above ask for occupation; below 18 ask for a guardian name.",
            "Generate a form with age-based branching: adults provide an occupation and minors provide a guardian name.",
        ],
        "source": '''form "Eligibility Form" {
  field age: integer ui { label: "Age" } validate { min: 0 max: 120 }
  if age >= 18 {
    field occupation: text ui { label: "Occupation" }
  } else {
    field guardian_name: text ui { label: "Guardian name" }
  }
}''',
        "fields": ["age", "occupation", "guardian_name"],
        "features": ["form", "field", "type", "ui_block", "validation_block", "conditional", "condition", "logic_term", "logic_factor", "simple_condition", "comparator"],
    },
    {
        "scenario": "repeat",
        "prompts": [
            "Make a household form that asks how many dependents there are and repeats a name field for each dependent.",
            "Create a form where the respondent enters a dependent count and then provides each dependent's name.",
            "Build a household intake form with a number of dependents and a repeated dependent-name field.",
            "Generate a family form that asks for the count of dependents and collects a name for each one.",
        ],
        "source": '''form "Household Form" {
  field dependent_count: integer ui { label: "Number of dependents" } validate { min: 0 max: 12 }
  repeat count = dependent_count {
    field dependent_name: text ui { label: "Dependent name" }
  }
}''',
        "fields": ["dependent_count", "dependent_name"],
        "features": ["form", "field", "type", "ui_block", "validation_block", "repeat_group", "IDENTIFIER", "NUMBER"],
    },
    {
        "scenario": "book_repeat",
        "prompts": [
            "Create a dynamic book log. Ask how many books were read, then repeat fields for each book's name, release date, and author.",
            "Build a form where the number of books controls repeated questions for title, publication date, and author.",
            "Make a reading form that expands to the entered book count and collects each book's name, release date, and author.",
            "Generate a book tracker with a count field and one repeated set of book name, release date, and author fields per book.",
        ],
        "source": '''form "Book Log" {
  field book_count: integer ui { label: "Number of books read" } validate { required min: 1 max: 20 }
  repeat count = book_count {
    field book_name: text ui { label: "Book name" } validate { required }
    field release_date: date ui { label: "Release date" }
    field author: text ui { label: "Author" } validate { required }
  }
}''',
        "fields": ["book_count", "book_name", "release_date", "author"],
        "features": ["form", "field", "type", "ui_block", "validation_block", "repeat_group", "IDENTIFIER", "NUMBER"],
    },
    {
        "scenario": "pages_layout",
        "prompts": [
            "Create a two-step profile form. Put full name and email together in a contact section on the first page, and ask for a website on the second page.",
            "Build a profile wizard with contact details on step one and a website question on step two.",
            "Make a two-page form: group full name and email in one row on the contact page, then ask for a website.",
            "Generate a profile form with a contact section containing name and email, followed by a second page for online presence.",
        ],
        "source": '''form "Profile Form" {
  page "Contact" {
    section "Your details" {
      row {
        field full_name: text ui { label: "Full name" } validate { required }
        field email: email ui { label: "Email address" } validate { required }
      }
    }
  }
  page "Online presence" {
    column {
      field website: url ui { label: "Website" }
    }
  }
}''',
        "fields": ["full_name", "email", "website"],
        "features": ["form", "page", "section", "layout_block", "field", "type", "ui_block", "validation_block"],
    },
    {
        "scenario": "group_reuse",
        "prompts": [
            "Build a contact form that defines a reusable address group with street and city, then uses that group in the form alongside an email field.",
            "Create a form that declares an address field group for street and city, reuses it, and also asks for email.",
            "Make a contact form with a reusable street-and-city group and a separate email address question.",
            "Generate a form that defines address details once, includes that group, and collects an email address.",
        ],
        "source": '''form "Contact Form" {
  group address {
    field street: text ui { label: "Street" }
    field city: text ui { label: "City" }
  }
  use address
  field email: email ui { label: "Email address" } validate { required }
}''',
        "fields": ["street", "city", "email"],
        "features": ["form", "group_definition", "group_use", "field", "type", "ui_block", "validation_block", "IDENTIFIER"],
    },
    {
        "scenario": "computed",
        "prompts": [
            "Create an estimate form with an age field and a computed estimate equal to a base rate times age plus ten.",
            "Build a calculator form that defines a base rate and computes an estimate from the rate multiplied by age, plus 10.",
            "Make a form asking age and calculating the result as base_rate times age plus ten.",
            "Generate an estimate form with a declared rate variable and a computed total based on age.",
        ],
        "source": '''form "Estimate Form" {
  var base_rate = 0.15 ;
  field age: integer ui { label: "Age" } validate { min: 0 max: 120 }
  field estimate: float compute = base_rate * age + 10
}''',
        "fields": ["age", "estimate"],
        "features": ["form", "var_declaration", "value", "field", "type", "ui_block", "validation_block", "compute_block", "expression", "math_term", "math_factor", "NUMBER", "IDENTIFIER"],
    },
    {
        "scenario": "triggers_action",
        "prompts": [
            "Make an email form with a change trigger that shows the confirmation field and a submit action posting to the example endpoint.",
            "Create an email form that reveals confirmation when the page changes and posts submissions to the example URL.",
            "Build a form with email and confirmation fields, a change event that shows confirmation, and a POST submit endpoint.",
            "Generate an email form whose change trigger shows the confirmation input and whose submit action uses POST.",
        ],
        "source": '''form "Email Form" {
  page "Contact" {
    field email: email ui { label: "Email address" } validate { required }
    field confirmation: text ui { label: "Confirmation" }
    on change {
      show(confirmation)
    }
  }
  action submit {
    endpoint: "https://example.invalid/forms/email"
    method: POST
  }
}''',
        "fields": ["email", "confirmation"],
        "features": ["form", "field", "type", "ui_block", "validation_block", "trigger_block", "event_type", "action_block", "action_statement", "STRING"],
    },
    {
        "scenario": "dynamic_options",
        "prompts": [
            "Create a form with a department dropdown whose options load from the example API, mapping name to label and id to value.",
            "Build a form that fetches department choices from the URL and uses each result's name as the label and id as its value.",
            "Make a dynamic department selector backed by the example departments endpoint with a name/id mapping.",
            "Generate a form with a select field populated from the departments URL and map name and id fields.",
        ],
        "source": '''form "Department Form" {
  field department: select from url "https://example.invalid/departments" map {
    label: name,
    value: id
  }
}''',
        "fields": ["department"],
        "features": ["form", "field", "type", "select_type", "source_block", "STRING", "IDENTIFIER"],
    },
    {
        "scenario": "upload",
        "prompts": [
            "Create a job application form with a required resume upload that accepts PDF or document files up to 10MB.",
            "Build an application form that collects a resume as a required PDF/document upload with a 10MB limit.",
            "Make a form with one mandatory CV attachment field accepting PDF and document files, maximum size 10MB.",
            "Generate a resume submission form with an upload restricted to PDF or document and capped at 10MB.",
        ],
        "source": '''form "Resume Submission" {
  field resume: upload {
    accept: pdf,document
    required
    maxSize: "10MB"
  }
  ui { label: "Resume / CV" }
}''',
        "fields": ["resume"],
        "features": ["form", "field", "type", "upload_type", "upload_rule", "accept_list", "accept_value", "ui_block", "STRING"],
    },
    {
        "scenario": "trigger_actions",
        "prompts": [
            "Create a lifecycle form demonstrating show, hide, clear, set, navigate, and submit actions from a load trigger.",
            "Build a form with name and status fields, then show, hide, clear, set a value, navigate, and submit on load.",
            "Make a Forml example that demonstrates every trigger action using fields named name and status.",
            "Generate a form whose load event demonstrates the six supported actions: show, hide, clear, set, navigate, and submit.",
        ],
        "source": '''form "Lifecycle Form" {
  field name: text ui { label: "Name" }
  field status: text ui { label: "Status" }
  on load {
    show(name)
    hide(status)
    clear(status)
    set(status, "ready")
    navigate("https://example.invalid/next")
    submit()
  }
}''',
        "fields": ["name", "status"],
        "features": ["form", "field", "type", "ui_block", "trigger_block", "event_type", "action_statement", "value", "STRING", "IDENTIFIER"],
    },
]

SYSTEM_PROMPT = (
    "You write Forml, the Formix form DSL. Return only complete Forml source code. "
    "Use the supplied request and, for repair tasks, the compiler diagnostics. "
    "Do not use syntax outside the Forml grammar."
)


def quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def render_field(field: dict) -> str:
    name, label, field_type = field["name"], field["label"], field["type"]
    if "options" in field:
        options = "\n".join(f'    option "{quote(option)}"' for option in field["options"])
        return f'  field {name}: {field_type} {{\n{options}\n  }}\n    ui {{ label: "{quote(label)}" }}'
    lines = [f'  field {name}: {field_type}', f'    ui {{ label: "{quote(label)}" }}']
    rule = field.get("rule")
    if rule == "required":
        lines.append("    validate { required }")
    elif rule == "age":
        lines.append("    validate { min: 18 max: 100 }")
    return "\n".join(lines)


def make_source(kind: str, fields: list[dict]) -> str:
    body = "\n\n".join(render_field(field) for field in fields)
    return f'form "{kind.title()} Form" {{\n\n{body}\n\n}}\n'


def clean_field_phrase(field: dict) -> str:
    labels = {
        "email": "an email address", "age": "their age", "consent": "consent",
        "interests": "their topics of interest", "dietary_preferences": "their dietary preferences",
        "message": "a required message", "comments": "comments", "rating": "a 1-to-5 rating",
        "organization": "their organization", "job_title": "their job title",
        "attendance_mode": "an attendance mode", "city": "a city", "country": "a country",
        "start_date": "a preferred date", "contact_method": "a preferred contact method",
        "full_name": "their full name", "phone": "a phone number", "website": "a website",
        "department": "a department",
    }
    return labels[field["name"]]


def compiler_result(compiler: Path, source: str) -> dict:
    with tempfile.NamedTemporaryFile("w", suffix=".forml", encoding="utf-8", delete=False) as handle:
        handle.write(source)
        source_path = Path(handle.name)
    try:
        run = subprocess.run([str(compiler), str(source_path)], capture_output=True, text=True, timeout=20)
    finally:
        source_path.unlink(missing_ok=True)
    if run.returncode != 0:
        raise RuntimeError(f"Compiler process failed: {run.stderr.strip() or run.stdout.strip()}")
    try:
        return json.loads(run.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Compiler did not return JSON: {run.stdout[:500]}") from error


def request_example(rng: random.Random, index: int, forced_recipe: dict | None = None) -> dict:
    if forced_recipe is not None or rng.random() < 0.30:
        recipe = forced_recipe or rng.choice(COMPLEX_RECIPES)
        return {
            "id": f"gen-{index:05d}", "task": "generate", "prompt": rng.choice(recipe["prompts"]),
            "completion": recipe["source"], "expected_fields": recipe["fields"],
            "scenario": recipe["scenario"], "grammar_features": recipe["features"],
            "required_patterns": recipe.get("required_patterns", []),
        }
    kind, key, required_names = rng.choice(RECIPES)
    field_count = rng.randint(max(2, len(required_names) - 1), min(len(required_names) + 2, 6))
    selected_names = list(required_names)
    extras = [field["name"] for field in FIELD_LIBRARY if field["name"] not in selected_names]
    rng.shuffle(extras)
    selected_names = selected_names[:field_count] if field_count < len(selected_names) else selected_names + extras[:field_count - len(selected_names)]
    rng.shuffle(selected_names)
    fields = [next(field for field in FIELD_LIBRARY if field["name"] == name) for name in selected_names]
    requested = ", ".join(clean_field_phrase(field) for field in fields)
    prompt = rng.choice(PROMPT_FORMS).format(kind=kind, audience=rng.choice(AUDIENCES), fields=requested)
    source = make_source(kind, fields)
    features = ["form", "field", "type", "ui_block", "validation_block", "STRING", "IDENTIFIER"]
    if any(field.get("rule") == "age" for field in fields):
        features.append("NUMBER")
    if any("options" in field for field in fields):
        features.extend(["select_type", "option"])
    return {"id": f"gen-{index:05d}", "task": "generate", "prompt": prompt, "completion": source, "expected_fields": selected_names, "scenario": key, "grammar_features": features}


def edit_example(rng: random.Random, index: int) -> dict:
    """Teach the adapter that an existing valid form is an edit baseline, not the answer."""
    kind, key, required_names = rng.choice(RECIPES)
    # Cycle through the whole field vocabulary so less common edits (such as
    # dietary preferences) cannot disappear because of a lucky random seed.
    target_name = FIELD_LIBRARY[index % len(FIELD_LIBRARY)]["name"]
    remaining = [name for name in required_names if name != target_name]
    # Include at least two existing fields so copying the baseline is an
    # attractive failure mode the training target explicitly corrects.
    existing_names = remaining[:rng.randint(2, len(remaining))]
    existing_fields = [next(field for field in FIELD_LIBRARY if field["name"] == name) for name in existing_names]
    target_field = next(field for field in FIELD_LIBRARY if field["name"] == target_name)
    before = make_source(kind, existing_fields)
    after = make_source(kind, existing_fields + [target_field])
    prompt = rng.choice(EDIT_PROMPT_FORMS).format(field=clean_field_phrase(target_field), source=before)
    features = ["form", "field", "type", "ui_block", "validation_block", "STRING", "IDENTIFIER"]
    if "options" in target_field:
        features.extend(["select_type", "option"])
    return {
        "id": f"edit-{index:05d}", "task": "edit", "prompt": prompt,
        "completion": after, "expected_fields": existing_names + [target_name],
        "scenario": key, "grammar_features": features,
    }


def repair_example(compiler: Path, rng: random.Random, index: int, clean: dict) -> dict | None:
    source = clean["completion"]
    # Rotate through common model failures instead of teaching one memorized
    # missing-colon repair. Every corrupted candidate is still accepted only
    # when the real compiler rejects it and supplies diagnostics.
    corruptions = [
        lambda text: re.sub(r"(field\s+[A-Za-z_]\w*)\s*:", r"\1 ", text, count=1),
        lambda text: re.sub(
            r"(field\s+[A-Za-z_]\w*\s*:\s*)(text|integer|float|email|date|boolean|url|select|radio|checkbox|upload)",
            r"\1string",
            text,
            count=1,
        ),
        lambda text: text.rsplit("}", 1)[0] if "}" in text else text,
    ]
    broken = corruptions[index % len(corruptions)](source)
    result = compiler_result(compiler, broken)
    if result.get("success"):
        return None
    errors = [d for d in result.get("diagnostics", []) if d.get("severity") == "error"]
    if not errors:
        return None
    diagnostic_text = "\n".join(
        f"line {item.get('line', 0)}, column {item.get('column', item.get('col', 0))}: {item.get('message', 'compiler error')}"
        for item in errors
    )
    prompt = (
        "Repair this Forml source so it passes the Formix compiler. Preserve the intended form and fields.\n\n"
        f"Compiler diagnostics:\n{diagnostic_text}\n\nForml source:\n{broken}"
    )
    return {"id": f"repair-{index:05d}", "task": "repair", "prompt": prompt, "completion": source, "expected_fields": clean["expected_fields"], "scenario": clean["scenario"], "grammar_features": clean.get("grammar_features", []), "required_patterns": clean.get("required_patterns", [])}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compiler", required=True, type=Path, help="Path to the native Forml compiler CLI")
    parser.add_argument("--grammar", type=Path, default=Path("forml-compiler/EBNF_grammar.md"), help="Canonical Forml EBNF source")
    parser.add_argument("--output", type=Path, default=Path("ai-training/data"))
    parser.add_argument("--count", type=int, default=1200, help="Number of generation examples; repair examples are added in equal number")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.count < 100:
        parser.error("--count must be at least 100 to leave a useful held-out set")
    compiler = args.compiler.resolve()
    grammar = args.grammar.resolve()
    if not compiler.is_file():
        parser.error(f"compiler executable not found: {compiler}")
    if not grammar.is_file():
        parser.error(f"canonical EBNF file not found: {grammar}")
    grammar_text = grammar.read_text(encoding="utf-8")
    grammar_rules = set(re.findall(r"^\s*([A-Za-z_]\w*)\s*=", grammar_text, flags=re.MULTILINE))
    args.output.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)
    examples: list[dict] = []
    attempts = 0
    # Guarantee at least one example of every hand-authored EBNF construct,
    # even when the requested dataset is small for a quick smoke run.
    for recipe in COMPLEX_RECIPES:
        candidate = request_example(rng, len(examples), forced_recipe=recipe)
        checked = compiler_result(compiler, candidate["completion"])
        if not checked.get("success"):
            raise RuntimeError(f"Canonical recipe {recipe['scenario']} is not accepted by the compiler: {checked.get('diagnostics')}")
        examples.append(candidate)
    while len(examples) < args.count:
        attempts += 1
        candidate = request_example(rng, len(examples))
        if not compiler_result(compiler, candidate["completion"]).get("success"):
            continue
        examples.append(candidate)
        if attempts > args.count * 4:
            raise RuntimeError("Too many compiler-rejected generated targets; inspect the grammar templates.")

    # The exact malformed source and diagnostic come from the real compiler;
    # the repair target is included only if it independently compiles cleanly.
    repairs = []
    for idx, item in enumerate(examples):
        repair = repair_example(compiler, rng, idx, item)
        if repair and compiler_result(compiler, repair["completion"]).get("success"):
            repairs.append(repair)

    edits = []
    for idx in range(args.count):
        edit = edit_example(rng, idx)
        if not compiler_result(compiler, edit["completion"]).get("success"):
            raise RuntimeError(f"Edit target is not accepted by the compiler: {edit['id']}")
        edits.append(edit)

    # Split by scenario family to make the test set include unseen form types.
    scenario_names = sorted({item["scenario"] for item in examples})
    # Hold out whole recipe families, not random near-duplicate examples.
    heldout = {"triggers_action", "group_reuse"} & set(scenario_names)
    heldout.update(scenario_names[-2:])
    train, test = [], []
    for item in examples:
        (test if item["scenario"] in heldout else train).append(item)
    # Repairs stay with their source scenario; no near-identical source leaks
    # from a generation train item into the held-out evaluation split.
    for item in repairs:
        (test if item["scenario"] in heldout else train).append(item)
    for item in edits:
        (test if item["scenario"] in heldout else train).append(item)
    rng.shuffle(train)
    rng.shuffle(test)
    validation_count = max(1, len(train) // 10)
    validation = train[:validation_count]
    train = train[validation_count:]

    for name, rows in (("train.jsonl", train), ("validation.jsonl", validation), ("test.jsonl", test)):
        with (args.output / name).open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    grammar_coverage = sorted({feature for item in examples for feature in item.get("grammar_features", [])})
    undefined_features = sorted(set(grammar_coverage) - grammar_rules)
    if undefined_features:
        raise RuntimeError(f"Dataset features are not productions in the canonical EBNF: {undefined_features}")
    summary = {"grammar_file": str(grammar), "grammar_sha256": hashlib.sha256(grammar_text.encode("utf-8")).hexdigest(), "generation_examples": len(examples), "repair_examples": len(repairs), "edit_examples": len(edits), "train": len(train), "validation": len(validation), "test": len(test), "heldout_scenarios": sorted(heldout), "grammar_features_in_dataset": grammar_coverage, "seed": args.seed}
    (args.output / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
