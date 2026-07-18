"""
Part 5 â€” Formix backend end-to-end test script.
Run from the project root:
    python backend/test_part5.py

Requires: httpx (already in requirements.txt), server running on :8000
"""

import sys
import httpx

BASE = "http://127.0.0.1:8000"
client = httpx.Client(base_url=BASE, timeout=10.0)

PASS = "\033[92mâœ“\033[0m"
FAIL = "\033[91mâœ—\033[0m"

failures = []


def check(label, condition, actual, expected_desc=""):
    mark = PASS if condition else FAIL
    print(f"  {mark} {label}")
    if not condition:
        print(f"      Expected: {expected_desc}")
        print(f"      Got:      {actual}")
        failures.append(label)


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 1 â€” Register User A and User B
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 1: Register User A and User B")

r = client.post("/auth/register", json={"email": "usera@test.com", "name": "User A", "password": "passwordA"})
print(f"  POST /auth/register (User A) â†’ {r.status_code}")
check("User A register returns 201", r.status_code == 201, r.status_code, "201")
token_a = r.json().get("access_token", "")
check("User A receives a JWT", bool(token_a), token_a, "non-empty string")
print(f"  User A token (first 20 chars): {token_a[:20]}...")

r = client.post("/auth/register", json={"email": "userb@test.com", "name": "User B", "password": "passwordB"})
print(f"  POST /auth/register (User B) â†’ {r.status_code}")
check("User B register returns 201", r.status_code == 201, r.status_code, "201")
token_b = r.json().get("access_token", "")
check("User B receives a JWT", bool(token_b), token_b, "non-empty string")
print(f"  User B token (first 20 chars): {token_b[:20]}...")

headers_a = {"Authorization": f"Bearer {token_a}"}
headers_b = {"Authorization": f"Bearer {token_b}"}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 2 â€” Login as User A
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 2: Login as User A")

r = client.post("/auth/login", json={"email": "usera@test.com", "password": "passwordA"})
print(f"  POST /auth/login (User A) â†’ {r.status_code}")
check("Login returns 200", r.status_code == 200, r.status_code, "200")
login_token_a = r.json().get("access_token", "")
check("Login returns a JWT", bool(login_token_a), login_token_a, "non-empty string")
print(f"  Login token (first 20 chars): {login_token_a[:20]}...")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 3 â€” Create project as User A; User B should NOT see it
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 3: Create project as User A; verify User B cannot see it")

r = client.post("/projects", json={"title": "User A's Project"}, headers=headers_a)
print(f"  POST /projects (User A) â†’ {r.status_code}  {r.json()}")
check("Create project returns 201", r.status_code == 201, r.status_code, "201")
project_a_id = r.json().get("id", "")
check("Project has an ID", bool(project_a_id), project_a_id, "uuid string")

r = client.get("/projects", headers=headers_a)
print(f"  GET /projects (User A) â†’ {r.status_code}  {r.json()}")
check("User A sees their project", any(p["id"] == project_a_id for p in r.json()), r.json(), "project in list")

r = client.get("/projects", headers=headers_b)
print(f"  GET /projects (User B) â†’ {r.status_code}  {r.json()}")
check("User B sees NO projects", r.json() == [], r.json(), "[]")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 4 â€” Create Form A and Form B inside User A's project
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 4: Create Form A and Form B inside User A's project")

r = client.post(
    f"/projects/{project_a_id}/forms",
    json={"title": "Contact Info", "forml_source": "form ContactInfo {}"},
    headers=headers_a,
)
print(f"  POST /projects/{project_a_id}/forms (Form A) â†’ {r.status_code}  {r.json()}")
check("Create Form A returns 201", r.status_code == 201, r.status_code, "201")
form_a_id = r.json().get("id", "")
check("Form A has an ID", bool(form_a_id), form_a_id, "uuid string")

r = client.post(
    f"/projects/{project_a_id}/forms",
    json={"title": "Feedback", "forml_source": "form Feedback {}"},
    headers=headers_a,
)
print(f"  POST /projects/{project_a_id}/forms (Form B) â†’ {r.status_code}  {r.json()}")
check("Create Form B returns 201", r.status_code == 201, r.status_code, "201")
form_b_id = r.json().get("id", "")
check("Form B has an ID", bool(form_b_id), form_b_id, "uuid string")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 5 â€” Link Form A â†’ Form B
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 5: Link Form A â†’ Form B")

r = client.patch(f"/forms/{form_a_id}/link", json={"next_form_id": form_b_id}, headers=headers_a)
print(f"  PATCH /forms/{form_a_id}/link â†’ {r.status_code}  {r.json()}")
check("Link returns 200", r.status_code == 200, r.status_code, "200")
check("Response next_form_id == form_b_id", r.json().get("next_form_id") == form_b_id,
      r.json().get("next_form_id"), form_b_id)

# Verify via GET /projects/{id} that the form record reflects it
r = client.get(f"/projects/{project_a_id}", headers=headers_a)
print(f"  GET /projects/{project_a_id} â†’ {r.status_code}")
forms_in_project = r.json().get("forms", [])
form_a_summary = next((f for f in forms_in_project if f["id"] == form_a_id), None)
check("Form A in project has next_form_id set",
      form_a_summary is not None and form_a_summary.get("next_form_id") == form_b_id,
      form_a_summary, f"next_form_id={form_b_id}")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 6 â€” Cross-user boundary checks
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 6: Cross-user boundary (User B â†’ User A's resources)")

r = client.get(f"/projects/{project_a_id}", headers=headers_b)
print(f"  GET /projects/{project_a_id} as User B â†’ {r.status_code}  {r.json()}")
check("User B GET project â†’ 403", r.status_code == 403, r.status_code, "403")

r = client.patch(f"/forms/{form_a_id}/link", json={"next_form_id": form_b_id}, headers=headers_b)
print(f"  PATCH /forms/{form_a_id}/link as User B â†’ {r.status_code}  {r.json()}")
check("User B PATCH form link â†’ 403", r.status_code == 403, r.status_code, "403")

r = client.post(
    f"/projects/{project_a_id}/forms",
    json={"title": "Intruder Form", "forml_source": "form X {}"},
    headers=headers_b,
)
print(f"  POST /projects/{project_a_id}/forms as User B â†’ {r.status_code}  {r.json()}")
check("User B POST form in User A's project â†’ 403", r.status_code == 403, r.status_code, "403")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 7 â€” No-auth check
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 7: No-auth check (POST /projects with no token)")

r = client.post("/projects", json={"title": "Unauthorized Project"})
print(f"  POST /projects (no auth) â†’ {r.status_code}  {r.json()}")
check("No-auth POST /projects â†’ 403 or 401", r.status_code in (401, 403), r.status_code, "401 or 403")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 8 â€” Publish both forms
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 8: Publish Form A and Form B")

compiled_schema_a = {
    "title": "Contact Info",
    "statements": [
        {"type": "Field", "name": "name", "label": "Your name", "field_type": "text",
         "validate": {"required": False}}
    ],
}
compiled_schema_b = {
    "title": "Feedback",
    "statements": [
        {"type": "Field", "name": "feedback", "label": "Your feedback", "field_type": "text",
         "validate": {"required": False}}
    ],
}

r = client.post(f"/forms/{form_a_id}/publish",
                json={"compiled_schema": compiled_schema_a, "base_url": "http://localhost:3000"})
print(f"  POST /forms/{form_a_id}/publish â†’ {r.status_code}  {r.json()}")
check("Publish Form A returns 200", r.status_code == 200, r.status_code, "200")

r = client.post(f"/forms/{form_b_id}/publish",
                json={"compiled_schema": compiled_schema_b, "base_url": "http://localhost:3000"})
print(f"  POST /forms/{form_b_id}/publish â†’ {r.status_code}  {r.json()}")
check("Publish Form B returns 200", r.status_code == 200, r.status_code, "200")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 9 â€” Respondent flow (no auth)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 9: Respondent flow (no auth)")

# 9a: GET Form A â€” should mint a session_id
r = client.get(f"/forms/{form_a_id}")
print(f"  GET /forms/{form_a_id} â†’ {r.status_code}  keys={list(r.json().keys())}")
check("GET Form A returns 200", r.status_code == 200, r.status_code, "200")
session_id = r.json().get("session_id", "")
check("GET Form A returns a session_id", bool(session_id), session_id, "non-empty UUID")
print(f"  session_id = {session_id}")

# 9b: POST Form A submit â€” should return next_form_id and same session_id
r = client.post(f"/forms/{form_a_id}/submit",
                json={"data": {"name": "Alice"}, "session_id": session_id})
print(f"  POST /forms/{form_a_id}/submit â†’ {r.status_code}  {r.json()}")
check("Submit Form A returns 200", r.status_code == 200, r.status_code, "200")
check("Submit Form A response has next_form_id == form_b_id",
      r.json().get("next_form_id") == form_b_id, r.json().get("next_form_id"), form_b_id)
check("Submit Form A echoes same session_id",
      r.json().get("session_id") == session_id, r.json().get("session_id"), session_id)
sub_a_id = r.json().get("submission_id", "")

# 9c: GET Form B with ?session= â€” should echo the SAME session_id back
r = client.get(f"/forms/{form_b_id}", params={"session": session_id})
print(f"  GET /forms/{form_b_id}?session={session_id[:8]}... â†’ {r.status_code}  {r.json()}")
check("GET Form B returns 200", r.status_code == 200, r.status_code, "200")
check("GET Form B echoes same session_id (not a new one)",
      r.json().get("session_id") == session_id, r.json().get("session_id"), session_id)

# 9d: POST Form B submit â€” no next_form_id since Form B has none
r = client.post(f"/forms/{form_b_id}/submit",
                json={"data": {"feedback": "Great form!"}, "session_id": session_id})
print(f"  POST /forms/{form_b_id}/submit â†’ {r.status_code}  {r.json()}")
check("Submit Form B returns 200", r.status_code == 200, r.status_code, "200")
check("Submit Form B has no next_form_id key (or None)",
      r.json().get("next_form_id") is None, r.json().get("next_form_id"), "None/absent")
sub_b_id = r.json().get("submission_id", "")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 10 â€” Session correlation
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 10: Session correlation â€” GET /submissions/by-session/{session_id}")

r = client.get(f"/submissions/by-session/{session_id}")
print(f"  GET /submissions/by-session/{session_id[:8]}... â†’ {r.status_code}")
print(f"  Response: {r.json()}")
check("by-session returns 200", r.status_code == 200, r.status_code, "200")
subs = r.json()
check("by-session returns 2 submissions", len(subs) == 2, len(subs), "2")
sub_form_ids = [s["form_id"] for s in subs]
check("First submission is for Form A", sub_form_ids[0] == form_a_id, sub_form_ids[0], form_a_id)
check("Second submission is for Form B", sub_form_ids[1] == form_b_id, sub_form_ids[1], form_b_id)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Step 11 â€” Regression: single-form flow on an unlinked form
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("Step 11: Regression â€” single unlinked form publish/submit")

# Create a fresh project + form for regression test
r = client.post("/projects", json={"title": "Regression Project"}, headers=headers_a)
reg_proj_id = r.json().get("id", "")

r = client.post(
    f"/projects/{reg_proj_id}/forms",
    json={"title": "Standalone Form", "forml_source": "form Standalone {}"},
    headers=headers_a,
)
reg_form_id = r.json().get("id", "")
print(f"  Created regression form: {reg_form_id}")

schema_reg = {"title": "Standalone", "statements": []}
r = client.post(f"/forms/{reg_form_id}/publish",
                json={"compiled_schema": schema_reg, "base_url": "http://localhost:3000"})
print(f"  Publish regression form â†’ {r.status_code}")
check("Regression form publish returns 200", r.status_code == 200, r.status_code, "200")

r = client.get(f"/forms/{reg_form_id}")
print(f"  GET regression form â†’ {r.status_code}  keys={list(r.json().keys())}")
reg_session = r.json().get("session_id", "")

r = client.post(f"/forms/{reg_form_id}/submit",
                json={"data": {"x": "y"}, "session_id": reg_session})
print(f"  Submit regression form â†’ {r.status_code}  {r.json()}")
check("Regression form submit returns 200", r.status_code == 200, r.status_code, "200")
check("Regression submit has no next_form_id",
      r.json().get("next_form_id") is None, r.json().get("next_form_id"), "None/absent")
check("Regression submit returns success=True",
      r.json().get("success") is True, r.json().get("success"), "True")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Summary
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
section("SUMMARY")

total_checks = sum(1 for line in open(__file__, encoding="utf-8") if "check(" in line)
if failures:
    print(f"\n  \033[91m{len(failures)} check(s) FAILED:\033[0m")
    for f in failures:
        print(f"    - {f}")
    sys.exit(1)
else:
    print(f"\n  \033[92mAll checks passed!\033[0m")
