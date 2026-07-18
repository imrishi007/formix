import sqlite3, json, os

db_path = os.path.join(os.path.dirname(__file__), "formix.db")
if not os.path.exists(db_path):
    print("formix.db not found at", db_path)
    exit(1)

con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row

print("=== FORMS ===")
forms = con.execute("SELECT id, title, is_published, created_at FROM forms").fetchall()
if not forms:
    print("  (no forms yet)")
for f in forms:
    pub = bool(f["is_published"])
    print(f"  id       : {f['id']}")
    print(f"  title    : {f['title']}")
    print(f"  published: {pub}")
    print(f"  created  : {f['created_at']}")
    print()

print("=== SUBMISSIONS ===")
subs = con.execute(
    "SELECT id, form_id, data, submitted_at FROM submissions ORDER BY submitted_at DESC"
).fetchall()
if not subs:
    print("  (no submissions yet)")
for s in subs:
    data = json.loads(s["data"]) if isinstance(s["data"], str) else s["data"]
    print(f"  submission_id : {s['id']}")
    print(f"  form_id       : {s['form_id']}")
    print(f"  submitted_at  : {s['submitted_at']}")
    print(f"  data          : {json.dumps(data, indent=4)}")
    print()

con.close()
