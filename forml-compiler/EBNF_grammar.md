# Forml — EBNF Grammar Specification (v1.1)

This is the canonical, finalized grammar for **Forml**, the DSL at the core of the
Formix (Forms-as-Code) project. This file is the single source of truth for the lexer,
parser, and AST design. Do not invent grammar constructs not present here — if something
is ambiguous or missing, flag it rather than guessing.

## Notation

| Symbol | Meaning |
|--------|---------|
| `=`    | defines a production rule |
| `\|`    | alternation (A \| B means A or B) |
| `[ ... ]` | optional (0 or 1 occurrence) |
| `{ ... }` | repetition (0 or more occurrences) |
| `"..."`   | literal terminal string |
| `;`       | terminates a rule definition |
| `/* ... */` | comment |

Terminals are literal characters/strings that appear in actual `.forml` source
(e.g. `"form"`, `"{"`, `":"`). Non-terminals are abstract symbols built from other
rules (e.g. `field`, `statement`, `expression`).

---

## 1. Primitives and Literals

```ebnf
value      = STRING | NUMBER | "true" | "false" | IDENTIFIER ;
IDENTIFIER = letter { letter | digit | "_" } ;
STRING     = '"' { any_character_except_quote } '"' ;
NUMBER     = digit { digit } [ "." { digit } ] ;
letter     = "a" | ... | "z" | "A" | ... | "Z" ;
digit      = "0" | ... | "9" ;
```

- `IDENTIFIER` — variable/field names (e.g. `firstName`, `user_age`). Must start with a
  letter, to avoid ambiguity with `NUMBER` during tokenization.
- `NUMBER` — supports integers and floats implicitly (optional fractional part).
- `value` — catch-all type used in assignments, defaults, and conditions.

## 2. Form and Page Structure (The Skeleton)

```ebnf
form      = "form" STRING "{"
              { group_definition | var_declaration | page | statement }
              [ action_block ]
            "}" ;

page      = "page" STRING "{"
              { statement }
              [ trigger_block ]
            "}" ;

statement = field | section | repeat_group | conditional
          | group_use | layout_block ;
```

- `form` is the AST root — the entire application payload.
- `page` supports multi-step wizards natively.
- `statement` is the general unit that both `form` and `page` bodies are built from:
  individual fields, UI groupings (`section`), or logic blocks.

## 3. Reusability and DRY Constructs

```ebnf
group_definition = "group" IDENTIFIER "{" { field } "}" ;
group_use        = "use" IDENTIFIER ;
var_declaration  = "var" IDENTIFIER "=" value ";" ;
```

- `group_definition` — define a reusable field structure once (e.g. `AddressBlock`).
- `group_use` — inject a previously defined group by name (e.g. `use AddressBlock`).
- `var_declaration` — global constants (tax rates, base URLs, etc.) referenceable
  elsewhere in the form (data sources, computed expressions).

## 4. Fields and Data Sourcing

```ebnf
field        = "field" IDENTIFIER ":" type
               [ ui_block ]
               [ validation_block ]
               [ compute_block ]
               [ trigger_block ] ;

type         = "text" | "integer" | "float" | "email"
             | "date" | "boolean" | "url" | select_type ;

select_type  = ( "select" | "radio" | "checkbox" )
               ( "{" option { option } "}" | source_block ) ;

option       = "option" STRING ;

source_block = "from" ( "url" STRING | "var" IDENTIFIER )
               [ "map" "{" "label" ":" IDENTIFIER ","
               "value" ":" IDENTIFIER "}" ] ;
```

- `field` decouples data schema (`type`) from presentation (`ui_block`) and behavior
  (`validation_block`, `compute_block`, `trigger_block`).
- `select_type` covers dropdown/radio/checkbox fields, populated either with hardcoded
  `option`s or dynamically via `source_block`.
- `source_block` fetches options from a REST endpoint (`url`) or a pre-defined array
  (`var`), with an optional `map` to translate arbitrary JSON keys into `label`/`value`.

## 5. Presentation, Layout, and Validation

```ebnf
ui_block         = "ui" "{" { ui_rule } "}" ;
ui_rule          = "label"       ":" STRING
                 | "placeholder" ":" STRING
                 | "helpText"    ":" STRING
                 | "default"     ":" value
                 | "bind"        ":" STRING ;

validation_block = "validate" "{" { validation_rule } "}" ;
validation_rule  = "required" | "min" ":" NUMBER | "max" ":" NUMBER
                 | "minLength" ":" NUMBER | "maxLength" ":" NUMBER
                 | "pattern" ":" STRING ;

section          = "section" STRING "{" { statement } "}" ;
layout_block     = ( "row" | "column" ) "{" { statement } "}" ;
```

- `ui_block` controls rendering; `bind` enables two-way data binding to external state.
- `layout_block` provides native grid support (`row`/`column`) without raw CSS.
- `validation_block` enforces constraints prior to submission.

## 6. Logic, Math, and Dynamics

```ebnf
conditional      = "if" condition "{" { statement } "}"
                   [ "else" "{" { statement } "}" ] ;
condition        = logic_term { "||" logic_term } ;
logic_term       = logic_factor { "&&" logic_factor } ;
logic_factor     = simple_condition | "(" condition ")" ;
simple_condition = IDENTIFIER comparator value ;
comparator       = "==" | "!=" | "<" | ">" | "<=" | ">=" ;

compute_block    = "compute" "=" expression ;
expression       = math_term { ( "+" | "-" ) math_term } ;
math_term        = math_factor { ( "*" | "/" ) math_factor } ;
math_factor      = IDENTIFIER | NUMBER | "(" expression ")" ;

repeat_group     = "repeat" "count" "=" IDENTIFIER "{" { field } "}" ;
```

- `condition` (boolean logic) and `expression` (arithmetic) are deliberately separate
  grammars, each with their own precedence chain — this is what lets the parser (and
  later semantic analyzer) enforce strict typing between logic and math contexts.
- `conditional` dynamically injects/removes fields based on user input.
- `repeat_group` unrolls dynamic lists (e.g. repeating a field block per `numberOfDependents`).
- Precedence, low → high: `condition` (`||`) → `logic_term` (`&&`) → `logic_factor`.
  `expression` (`+`/`-`) → `math_term` (`*`/`/`) → `math_factor`. This directly maps to
  precedence-climbing structure in the recursive-descent parser.

## 7. Actions and Lifecycle Triggers

```ebnf
action_block     = "action" "submit" "{"
                     "endpoint" ":" STRING
                     "method"   ":" ( "POST" | "PUT" | "PATCH" )
                   "}" ;

trigger_block    = "on" event_type "{" { action_statement } "}" ;
event_type       = "load" | "change" | "blur" | "submit" ;
action_statement = "hide"     "(" IDENTIFIER ")"
                 | "show"     "(" IDENTIFIER ")"
                 | "clear"    "(" IDENTIFIER ")"
                 | "set"      "(" IDENTIFIER "," value ")"
                 | "navigate" "(" STRING ")"
                 | "submit"   "(" ")" ;
```

- `action_block` routes the final JSON payload to a backend endpoint.
- `trigger_block` is the built-in state-machine primitive: fields/pages can emit side
  effects (`hide`, `show`, `clear`, `set`, `navigate`, `submit`) on lifecycle events
  (`load`, `change`, `blur`, `submit`) without custom JS event listeners.

---

## Root Production

For reference, the full derivation from the top:

```ebnf
form = "form" STRING "{"
         { group_definition | var_declaration | page | statement }
         [ action_block ]
       "}" ;
```

Everything else in this document is a derivation reachable from `form`, either directly
or via `page` → `statement` → ... down to `value`, `IDENTIFIER`, `STRING`, `NUMBER`.
