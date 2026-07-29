"""
seed_data.py
Generates realistic demo data — forms, and 0-200 responses each with random
timestamps, browsers, and devices — directly in the database.

Why direct DB writes instead of the HTTP API: the public submit endpoint
deliberately does NOT accept a client-supplied submitted_at, browser, or
device (those are stamped server-side, from "now" and the real request's
User-Agent) — there's no way to backdate realistic-looking demo data through
the API by design. This script uses the same ORM models and the same
User-Agent parser the live API uses (`backend.routers.forms._parse_client_info`,
imported — not re-implemented) so seeded rows look exactly like what the
real submit flow would have produced, just spread across the last 90 days.

Everything created here belongs to ONE clearly-tagged demo account, so it can
be removed cleanly with remove_seed_data.py (see that file — it just deletes
this one user; cascades handle the rest).

Run from the repo root:
    python seed_data.py
"""

import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from backend.auth import hash_password  # noqa: E402
from backend.database import SessionLocal  # noqa: E402
from backend.models import Form, Project, Submission, User  # noqa: E402
from backend.routers.forms import _parse_client_info  # noqa: E402 -- reuse, don't re-implement

SEED_EMAIL = "seed-data@formix.local"
SEED_NAME = "Seed Data"
SEED_PASSWORD = "SeedData!2026"
SEED_PROJECT_TITLE = "[SEED] Demo Forms"

# ── Realistic pools for generated field values ─────────────────────────────

FIRST_NAMES = [
    "Ada", "Grace", "Alan", "Linus", "Margaret", "Katherine", "Tim", "Barbara",
    "Dennis", "Radia", "Edsger", "Frances", "Guido", "Hedy", "Ivan", "Judea",
    "Karen", "Leslie", "Marvin", "Noam", "Olga", "Peter", "Rasmus", "Sophie",
    "Tariq", "Uma", "Victor", "Wendy", "Xavier", "Yara", "Zane",
]
LAST_NAMES = [
    "Lovelace", "Hopper", "Turing", "Torvalds", "Hamilton", "Johnson", "Berners-Lee",
    "Liskov", "Ritchie", "Perlman", "Dijkstra", "Allen", "van Rossum", "Lamarr",
    "Sutherland", "Pearl", "Spärck Jones", "Lamport", "Minsky", "Chomsky",
    "Kernighan", "Torres", "Novak", "Zhang", "Patel", "Kim", "Rossi", "Nilsson",
]
EMAIL_DOMAINS = ["example.com", "mail.com", "test.org", "demo.io", "sample.net"]

SHORT_TEXT_SAMPLES = [
    "Great experience overall.", "Could be faster.", "Really happy with this.",
    "Not bad, some rough edges.", "Exceeded expectations.", "Needs improvement.",
    "Works as advertised.", "Pretty good so far.", "A bit confusing at first.",
    "Solid, would recommend.",
]
LONG_TEXT_SAMPLES = [
    "I've been using this for a few months now and overall the experience has been positive. "
    "The onboarding was smooth, though I did run into a couple of rough edges around the "
    "notification settings. Support was responsive when I reached out.",
    "The main thing I'd love to see improved is the mobile experience — a few buttons are hard "
    "to tap on smaller screens. Everything else has worked reliably for our team.",
    "Honestly this solved a real problem for us. We used to track everything in spreadsheets and "
    "this cut our weekly admin time down significantly. Looking forward to future updates.",
    "A few bugs here and there but nothing blocking. The core workflow is intuitive and the team "
    "picked it up quickly without much training.",
    "Would like more customization options, but the defaults are sensible enough that we haven't "
    "needed to change much. Performance has been consistently good.",
    "We evaluated three alternatives before choosing this one — the deciding factor was how "
    "straightforward the setup was compared to the others.",
]

# A representative spread of real User-Agent strings across browsers/devices —
# parsed via the actual backend parser below, not hand-labeled.
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
]


def field(name, field_type, label, options=None, min_=None, max_=None, required=False, long_text=False):
    """Builds one compiled-schema Field node (matches forml-compiler/JSON_SCHEMA.md)."""
    validation = {}
    if required:
        validation["required"] = True
    if min_ is not None:
        validation["min"] = min_
    if max_ is not None:
        validation["max"] = max_
    node = {
        "type": "Field", "name": name, "fieldType": field_type,
        "ui": {"label": label}, "validation": validation,
    }
    if options:
        node["options"] = options
    node["_long"] = long_text  # seed-script-only hint; not part of the real schema shape
    return node


def make_schema(title, fields):
    # Strip the seed-script-only "_long" hint — it's not part of the real
    # compiler's JSON_SCHEMA.md shape, only used internally by this script's
    # generator functions (which receive the original, un-stripped fields).
    clean_fields = [{k: v for k, v in f.items() if k != "_long"} for f in fields]
    return {"type": "Form", "name": title, "statements": clean_fields, "pages": []}


def forml_source_for(title, fields):
    """A plausible-looking .forml source string for display in the editor —
    not run through the compiler, just kept consistent with the schema."""
    lines = [f'form "{title}" {{', ""]
    for f in fields:
        if f.get("options"):
            lines.append(f"  field {f['name']} : {f['fieldType']} {{")
            for o in f["options"]:
                lines.append(f'    option "{o}"')
            lines.append("  }")
        else:
            lines.append(f"  field {f['name']} : {f['fieldType']}")
        lines.append(f"    ui {{ label: \"{f['ui']['label']}\" }}")
        if f["validation"]:
            parts = []
            if f["validation"].get("required"):
                parts.append("required")
            if "min" in f["validation"]:
                parts.append(f"min: {f['validation']['min']}")
            if "max" in f["validation"]:
                parts.append(f"max: {f['validation']['max']}")
            if parts:
                lines.append(f"    validate {{ {'  '.join(parts)} }}")
        lines.append("")
    lines.append("  action submit {")
    lines.append('    endpoint: "https://api.formix.dev/submit"')
    lines.append("    method: POST")
    lines.append("  }")
    lines.append("}")
    return "\n".join(lines)


# ── 7 realistic forms, covering every field type the analytics/response
#    views know how to render dynamically ─────────────────────────────────

FORM_DEFS = [
    {
        "title": "Customer Feedback Survey",
        "duplicate_mode": "multiple",
        "published": True,
        "fields": [
            field("name", "text", "Your Name", required=True),
            field("email", "email", "Email Address", required=True),
            field("rating", "integer", "Overall Rating", min_=1, max_=5, required=True),
            field("recommend", "radio", "Would you recommend us?", options=["Yes", "No", "Maybe"]),
            field("comments", "text", "Additional Comments", long_text=True),
        ],
    },
    {
        "title": "Event Registration — Tech Summit 2026",
        "duplicate_mode": "single_per_email",
        "published": True,
        "fields": [
            field("fullName", "text", "Full Name", required=True),
            field("email", "email", "Email Address", required=True),
            field("ticketType", "select", "Ticket Type", options=["General", "VIP", "Student", "Speaker"]),
            field("dietary", "checkbox", "Dietary Requirements", options=["Vegetarian", "Vegan", "Gluten-Free", "None"]),
            field("attendDate", "date", "Which day are you attending?"),
        ],
    },
    {
        "title": "Job Application — Software Engineer",
        "duplicate_mode": "single_per_email",
        "published": True,
        "fields": [
            field("applicantName", "text", "Full Name", required=True),
            field("email", "email", "Email Address", required=True),
            field("position", "select", "Position", options=["Frontend", "Backend", "Full-stack", "DevOps"]),
            field("yearsExperience", "integer", "Years of Experience", min_=0, max_=20),
            field("coverLetter", "text", "Cover Letter", long_text=True),
        ],
    },
    {
        "title": "Product Order Form",
        "duplicate_mode": "multiple",
        "published": False,  # draft — demonstrates the zero-response / unpublished state
        "fields": [
            field("customerName", "text", "Customer Name", required=True),
            field("email", "email", "Email Address", required=True),
            field("product", "select", "Product", options=["Widget A", "Widget B", "Widget C", "Bundle"]),
            field("quantity", "integer", "Quantity", min_=1, max_=10),
            field("deliveryDate", "date", "Preferred Delivery Date"),
            field("notes", "text", "Order Notes", long_text=True),
        ],
    },
    {
        "title": "Newsletter Signup",
        "duplicate_mode": "single_per_email",
        "published": True,
        "fields": [
            field("email", "email", "Email Address", required=True),
            field("topics", "checkbox", "Topics you care about", options=["Product Updates", "Industry News", "Tutorials", "Events"]),
            field("frequency", "radio", "Email Frequency", options=["Weekly", "Bi-weekly", "Monthly"]),
        ],
    },
    {
        "title": "Support Ticket",
        "duplicate_mode": "multiple",
        "published": True,
        "fields": [
            field("email", "email", "Email Address", required=True),
            field("priority", "select", "Priority", options=["Low", "Medium", "High", "Urgent"]),
            field("category", "radio", "Category", options=["Bug", "Feature Request", "Question"]),
            field("description", "text", "Describe the issue", long_text=True, required=True),
        ],
    },
    {
        "title": "Employee Satisfaction Survey",
        "duplicate_mode": "multiple",
        "published": True,
        "fields": [
            field("department", "select", "Department", options=["Engineering", "Design", "Sales", "Support", "HR"]),
            field("tenure", "radio", "Tenure", options=["<1 year", "1-3 years", "3-5 years", "5+ years"]),
            field("satisfaction", "integer", "Satisfaction (1-10)", min_=1, max_=10, required=True),
            field("email", "email", "Email (optional, for follow-up)"),
            field("feedback", "text", "What could we improve?", long_text=True),
        ],
    },
]


def random_person():
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    email = f"{first.lower()}.{last.lower()}{random.randint(1, 999)}@{random.choice(EMAIL_DOMAINS)}"
    return {"first": first, "last": last, "email": email}


NAME_FIELD_NAMES = {"name", "fullname", "applicantname", "customername"}


def gen_field_value(f, person):
    ftype = f["fieldType"]
    if ftype == "email":
        return person["email"]
    if ftype == "text":
        if f["name"].lower() in NAME_FIELD_NAMES:
            return f"{person['first']} {person['last']}"
        return random.choice(LONG_TEXT_SAMPLES if f.get("_long") else SHORT_TEXT_SAMPLES)
    if ftype == "integer":
        lo = f["validation"].get("min", 0)
        hi = f["validation"].get("max", 100)
        return str(random.randint(lo, hi))
    if ftype in ("select", "radio"):
        return random.choice(f["options"])
    if ftype == "date":
        offset_days = random.randint(-120, 120)
        return (datetime.now(timezone.utc) + timedelta(days=offset_days)).date().isoformat()
    return ""


def build_submission_data(fields, person):
    data = {}
    for f in fields:
        # Skip ~10% of optional fields to simulate partial completion.
        if not f["validation"].get("required") and random.random() < 0.10:
            continue
        if f["fieldType"] == "checkbox":
            chosen = [o for o in f["options"] if random.random() < 0.4]
            if not chosen and random.random() < 0.85:
                chosen = [random.choice(f["options"])]
            for opt in f["options"]:
                data[f"{f['name']}__{opt}"] = "true" if opt in chosen else "false"
        else:
            data[f["name"]] = gen_field_value(f, person)
    return data


def random_submitted_at():
    days_ago = random.uniform(0, 90)
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def random_started_at(submitted_at):
    if random.random() < 0.85:
        return submitted_at - timedelta(seconds=random.uniform(5, 300))
    return None


def main():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == SEED_EMAIL).first()
        if existing:
            print(f"Seed user {SEED_EMAIL} already exists (id={existing.id}).")
            print("Run remove_seed_data.py first if you want a clean re-seed.")
            return

        user = User(email=SEED_EMAIL, name=SEED_NAME, hashed_password=hash_password(SEED_PASSWORD))
        db.add(user)
        db.flush()

        project = Project(owner_id=user.id, title=SEED_PROJECT_TITLE)
        db.add(project)
        db.flush()

        print(f"Seed user: {SEED_EMAIL} / {SEED_PASSWORD}")
        print(f"Seed project: {SEED_PROJECT_TITLE} ({project.id})\n")

        total_submissions = 0
        for form_def in FORM_DEFS:
            schema = make_schema(form_def["title"], form_def["fields"])
            source = forml_source_for(form_def["title"], form_def["fields"])
            created_at = datetime.now(timezone.utc) - timedelta(days=random.randint(30, 150))

            form = Form(
                project_id=project.id,
                title=form_def["title"],
                forml_source=source,
                compiled_schema=schema,
                is_published=form_def["published"],
                duplicate_mode=form_def["duplicate_mode"],
                created_at=created_at,
                updated_at=created_at,
            )
            db.add(form)
            db.flush()

            response_count = random.randint(0, 200) if form_def["published"] else 0
            for _ in range(response_count):
                person = random_person()
                data = build_submission_data(form_def["fields"], person)
                submitted_at = random_submitted_at()
                started_at = random_started_at(submitted_at)
                ua = random.choice(UA_POOL)
                browser, device = _parse_client_info(ua)

                db.add(Submission(
                    form_id=form.id,
                    respondent_session_id=str(uuid.uuid4()),
                    data=data,
                    user_agent=ua,
                    browser=browser,
                    device=device,
                    started_at=started_at,
                    submitted_at=submitted_at,
                ))
            total_submissions += response_count
            status = "published" if form_def["published"] else "draft"
            print(f"  {form_def['title']!r} — {status}, duplicate_mode={form_def['duplicate_mode']}, {response_count} responses")

        db.commit()
        print(f"\nDone: {len(FORM_DEFS)} forms, {total_submissions} total responses.")
        print("Run remove_seed_data.py to clean this up later.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
