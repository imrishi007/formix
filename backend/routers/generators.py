"""
backend/routers/generators.py

AI generation router utilizing Groq API to generate, edit, and correct
FormL code based on user prompt and EBNF grammar specification.
"""

import os
import re
from pathlib import Path
from typing import List, Optional
import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/generators", tags=["generators"])

# Path to the canonical EBNF grammar file
EBNF_GRAMMAR_PATH = Path(__file__).parent.parent.parent / "forml-compiler" / "EBNF_grammar.md"

def load_ebnf_grammar() -> str:
    """Load the EBNF grammar file content if available."""
    if EBNF_GRAMMAR_PATH.exists():
        try:
            return EBNF_GRAMMAR_PATH.read_text(encoding="utf-8")
        except Exception:
            pass
    return "EBNF Grammar file not found."

class ChatMessage(BaseModel):
    role: str  # "user", "assistant", "system"
    content: str

class GenerateRequest(BaseModel):
    messages: List[ChatMessage]
    current_code: Optional[str] = None

class GenerateResponse(BaseModel):
    reply: str
    extracted_code: Optional[str] = None

def build_system_prompt() -> str:
    grammar_text = load_ebnf_grammar()
    
    return f"""You are Formix AI, an expert code generator and compiler assistant specialized in writing, editing, and fixing FormL code.
FormL is a declarative domain-specific language (DSL) for defining interactive dynamic forms.

Here is the CANONICAL EBNF GRAMMAR SPECIFICATION for FormL (v1.1):

{grammar_text}

---

### IMPORTANT FORML SYNTAX & RULES SPECIFICATION:

1. Root Element:
Every FormL program MUST begin with `form "Form Title" {{ ... }}`.
Inside the form body, you can include pages, sections, fields, var declarations, group definitions, conditionals, repeat groups, and an optional action submit block.

2. Basic Field Structure:
`field fieldName : fieldType`
Supported field types: `text`, `integer`, `float`, `email`, `date`, `boolean`, `url`, `select`, `radio`, `checkbox`.

For `select`, `radio`, or `checkbox`, options can be defined directly:
```forml
field role : select {{
  option "Engineer"
  option "Designer"
  option "Product Manager"
}}
ui {{ label: "Select Role" }}
```

3. Field Blocks (UI, Validate, Compute, Trigger):
- UI block:
`ui {{ label: "Label Text" placeholder: "Placeholder..." helpText: "Help text" default: "default value" bind: "external_key" }}`

- Validation block:
`validate {{ required min: 18 max: 100 minLength: 2 maxLength: 50 pattern: "^[A-Z]" }}`

- Compute block:
`field total : float compute = price * quantity + tax`

4. Layout & Groupings:
- Section: `section "Section Title" {{ ... }}`
- Row / Column grid: `row {{ statement1 statement2 }}` or `column {{ ... }}`

5. Dynamic Logic & Conditionals:
```forml
if age >= 18 {{
  field drivingLicense : text ui {{ label: "License Number" }}
}} else {{
  field parentName : text ui {{ label: "Parent/Guardian Name" }}
}}
```
Supported comparators in simple conditions: `==`, `!=`, `<`, `>`, `<=`, `>=`.

6. Dynamic Repeat Groups:
```forml
repeat count = numJobs {{
  field company : text ui {{ label: "Company Name" }}
  field years   : integer validate {{ min: 0 max: 50 }}
}}
field numJobs : integer ui {{ label: "Number of past jobs" }}
```

7. Action Submit Block:
```forml
action submit {{
  endpoint: "https://api.example.com/submit"
  method: POST
}}
```

8. Multi-page Wizards:
```forml
form "Multi-Step Form" {{
  page "Personal Info" {{
    field fullName : text ui {{ label: "Full Name" }}
  }}
  page "Contact Details" {{
    field email : email ui {{ label: "Email Address" }}
  }}
}}
```

---

### YOUR INSTRUCTIONS:
1. Always generate syntactically VALID FormL code adhering strictly to the EBNF grammar above.
2. When giving or updating code, ALWAYS wrap the complete updated FormL code inside a ```forml ... ``` markdown code block.
3. Keep explanation text concise, helpful, and polite.
4. If given compiler diagnostics or error messages, analyze the syntax error in relation to the EBNF grammar and output the corrected FormL code in ```forml ... ```.
"""

def extract_forml_code(text: str) -> Optional[str]:
    """Extract code inside ```forml ... ``` or ``` ... ``` code blocks."""
    # Match ```forml ... ``` block
    match = re.search(r"```forml\s*\n(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    
    # Fallback: match any ``` ... ``` block containing 'form '
    match_any = re.search(r"```(?:\w+)?\s*\n(form\s+.*?```)", text, re.DOTALL | re.IGNORECASE)
    if match_any:
        raw = match_any.group(1)
        # strip trailing backticks
        return re.sub(r"```$", "", raw).strip()
    
    # Fallback: match ``` ... ``` if it looks like FormL
    match_generic = re.search(r"```(?:\w+)?\s*\n(.*?)```", text, re.DOTALL)
    if match_generic:
        content = match_generic.group(1).strip()
        if "form " in content or "field " in content:
            return content

    return None

@router.post("/generate", response_model=GenerateResponse)
async def generate_forml(payload: GenerateRequest):
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    # Also check backend/.env explicitly if not in env
    if not groq_api_key:
        env_file = Path(__file__).parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("GROQ_API_KEY="):
                    groq_api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    if not groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_API_KEY is not configured in backend/.env or environment variables."
        )

    system_prompt = build_system_prompt()
    
    # Build conversation messages for Groq OpenAI API compatibility
    api_messages = [{"role": "system", "content": system_prompt}]

    # If current code in editor is provided and not empty, inject context
    if payload.current_code and payload.current_code.strip():
        api_messages.append({
            "role": "system",
            "content": f"The current FormL code in the Monaco editor is:\n```forml\n{payload.current_code}\n```"
        })

    for msg in payload.messages:
        if msg.role in ("user", "assistant", "system"):
            api_messages.append({"role": msg.role, "content": msg.content})

    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }

    # Primary model is llama-3.3-70b-versatile; fallbacks if needed
    models_to_try = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768"
    ]

    last_exception = None
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in models_to_try:
            try:
                request_body = {
                    "model": model,
                    "messages": api_messages,
                    "temperature": 0.2,
                    "max_tokens": 2048,
                }
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=request_body
                )
                if res.status_code == 200:
                    data = res.json()
                    assistant_reply = data["choices"][0]["message"]["content"]
                    extracted_code = extract_forml_code(assistant_reply)
                    return GenerateResponse(
                        reply=assistant_reply,
                        extracted_code=extracted_code
                    )
                else:
                    error_detail = res.text
                    try:
                        error_json = res.json()
                        error_detail = error_json.get("error", {}).get("message", error_detail)
                    except Exception:
                        pass
                    last_exception = HTTPException(
                        status_code=res.status_code,
                        detail=f"Groq API Error ({model}): {error_detail}"
                    )
            except httpx.RequestError as exc:
                last_exception = HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Network error connecting to Groq API ({model}): {str(exc)}"
                )

    if last_exception:
        raise last_exception
    
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate response from Groq API."
    )
