# AGENT.md — Formix (Forms-as-Code Framework)
> Single source of truth for every AI agent, coding assistant, or LLM working
> on this codebase. Read this ENTIRE file before writing, editing, or suggesting
> any code. Do not skip sections. Governs all four components: compiler, WASM
> bridge, frontend renderer, and AI orchestrator.

---

## 0. Project Identity

Name:      Formix
Tagline:   Forms as Code.
File ext:  .forml
DSL name:  Forml
Grammar:   v1.1 (locked)
Timeline:  6 weeks, June 16 to July 31 2026. Solo developer.
Context:   IIT Ropar research internship project.

What it is: A developer tool that lets you define forms and surveys as plain
text in a custom DSL, version-control them in Git, and render them as live
interactive web UIs in the browser with an AI layer that generates valid DSL
from natural language.

Core idea: Form configuration should live in code, not in a database or a
drag-and-drop GUI. One .forml file = one form = one Git commit.

Target user: Developers and technical teams who want forms that are
version-controlled, diff-able, reviewable in PRs, and generatable by AI.

---

## 1. What This Project Is NOT

Hard constraints. Do not suggest alternatives or workarounds that violate these.

- NOT using ANTLR, Bison, Tree-sitter, or any parser generator. The lexer
  and parser are hand-written in C++ from scratch. Educational requirement.
- NOT parsing DSL in Python or TypeScript. All parsing in C++, compiled to
  WebAssembly. Zero exceptions.
- NOT a JSON/YAML config file. The DSL is a custom language with its own grammar.
- NOT a drag-and-drop form builder. No GUI for form creation.
- NOT using server-side rendering for form output. WASM binary runs client-side.
- NOT using Geist or any font except Instrument Sans, Instrument Serif, JetBrains Mono.
- NOT introducing blue, purple, neon, or gradient brand accents anywhere in UI.
- NOT using shadcn rounded card patterns for landing page sections.
- NOT suggesting nested repeat groups (one level deep only, by design).

---

## 2. Full System Architecture

Four strictly decoupled components. Each has one job and one interface contract.

```
User types natural language
          |
          v
+-------------------------------------+
|   AI ORCHESTRATOR (Python/FastAPI)  |
|   /ai-orchestrator                  |
|   Wraps NL in prompt + grammar      |
|   Calls LLM, gets raw DSL           |
|   Self-correction loop (max 3x)     |
|   Returns valid DSL or error        |
+------------------+------------------+
                   | raw DSL string
                   v
+-------------------------------------+
|   COMPILER ENGINE (C++)             |
|   /compiler                         |
|   Hand-written Lexer                |
|   Hand-written Recursive Descent    |
|   Parser (RDP)                      |
|   Syntactic pass: grammar check     |
|   Semantic pass: type/ref check     |
|   Emits JSON AST string             |
|   On error: explicit line+col msg   |
+------------------+------------------+
                   | JSON AST string
                   v
+-------------------------------------+
|   WASM BRIDGE (Emscripten)          |
|   /wasm-bridge                      |
|   Compiles C++ to .wasm binary      |
|   Exposes: parse(dsl) -> json_ast   |
|   Runs 100% client-side             |
|   Zero network latency              |
+------------------+------------------+
                   | JSON AST in browser
                   v
+-------------------------------------+
|   FRONTEND RENDERER (Next.js/React) |
|   /renderer                         |
|   Landing page (public)             |
|   Auth (login/signup)               |
|   Dashboard (logged-in home)        |
|   Editor (3-panel VSCode-like)      |
|   Chat interface (AI form gen)      |
|   Recursive AST tree-walk           |
|   Monaco editor for DSL editing     |
|   Live form preview                 |
+-------------------------------------+
```

Self-Correction Loop (critical AI workflow):

```
User: "Make me a customer feedback form"
  |
  v
Python backend builds prompt:
  [EBNF grammar] + [few-shot examples] + [user request]
  |
  v
LLM generates DSL text
  |
  v
C++ parser receives DSL
  |
  +-- PASS --> JSON AST --> React renderer --> live form
  |
  +-- FAIL --> "[ParseError] Line 4, Col 12: Expected ':'"
                |
                v
            Python re-prompts LLM with error context
                |
                v
            Retry (max 3 attempts)
                |
                +-- PASS --> live form
                +-- FAIL (3x) --> return error to user
```

---

## 3. Directory Structure

```
/
+-- AGENT.md                       YOU ARE HERE. Read before everything.
+-- SKILLS.md                      Frontend design system. Read for any UI work.
+-- grammar/
|   +-- forml.ebnf                 Canonical EBNF grammar v1.1. Source of truth.
|
+-- compiler/
|   +-- src/
|   |   +-- lexer.cpp              Hand-written lexer
|   |   +-- lexer.h                Token type enum + Lexer class declaration
|   |   +-- parser.cpp             Hand-written recursive descent parser
|   |   +-- parser.h               Parser class declaration
|   |   +-- ast.h                  All AST node struct definitions
|   |   +-- ast_emitter.cpp        AST to JSON string serializer
|   |   +-- main.cpp               CLI entry point for testing
|   +-- CMakeLists.txt
|
+-- wasm-bridge/
|   +-- bindings.cpp               JS binding: parse(string) -> string
|   +-- build.sh                   Emscripten build script
|
+-- renderer/
|   +-- app/
|   |   +-- globals.css            Design tokens. Source of truth for colors.
|   |   +-- page.tsx               Landing page (public)
|   |   +-- layout.tsx             Root layout with font loading
|   |   +-- (auth)/
|   |   |   +-- login/page.tsx
|   |   |   +-- signup/page.tsx
|   |   +-- dashboard/
|   |   |   +-- page.tsx           Logged-in home: project grid
|   |   +-- editor/
|   |       +-- [projectId]/
|   |           +-- page.tsx       3-panel editor view
|   +-- components/
|   |   +-- landing/               Landing page sections
|   |   |   +-- Navigation.tsx
|   |   |   +-- HeroSection.tsx
|   |   |   +-- FeaturesSection.tsx
|   |   |   +-- HowItWorksSection.tsx
|   |   |   +-- DemoSection.tsx
|   |   |   +-- MetricsSection.tsx
|   |   |   +-- CtaSection.tsx
|   |   |   +-- FooterSection.tsx
|   |   +-- editor/               3-panel editor components
|   |   |   +-- EditorPanel.tsx   Left: Monaco DSL editor
|   |   |   +-- PreviewPanel.tsx  Center: live form preview
|   |   |   +-- ChatPanel.tsx     Right: AI chat interface
|   |   |   +-- EditorLayout.tsx  3-panel CSS grid wrapper
|   |   +-- renderer/             AST to React form components
|   |   |   +-- ASTRenderer.tsx   Recursive tree-walk entry point
|   |   |   +-- FormField.tsx
|   |   |   +-- RepeatGroup.tsx
|   |   |   +-- Conditional.tsx
|   |   |   +-- Section.tsx
|   |   |   +-- LayoutBlock.tsx
|   |   +-- dashboard/
|   |   |   +-- ProjectCard.tsx
|   |   |   +-- ProjectGrid.tsx
|   |   +-- canvas/               Animated visual elements
|   |   |   +-- AnimatedSphere.tsx
|   |   |   +-- AnimatedWave.tsx
|   |   +-- ui/                   shadcn/ui primitives (do not modify)
|   +-- wasm/
|   |   +-- parser-bridge.ts      WASM module loader + JS glue
|   +-- package.json
|
+-- ai-orchestrator/
|   +-- main.py                   FastAPI app entry point
|   +-- prompt_builder.py         LLM prompt construction
|   +-- correction_loop.py        Self-correction retry logic
|   +-- requirements.txt
|
+-- tests/
    +-- dsl/                      Sample .forml files (valid + invalid)
    +-- ast/                      Expected JSON AST outputs
```

---

## 4. Frontend Stack

Framework:    Next.js 14 (App Router)
Language:     TypeScript
Styling:      Tailwind CSS
Components:   shadcn/ui (primitives only, not for landing page design)
Code Editor:  Monaco Editor (same engine as VSCode)
Icons:        lucide-react
Fonts:        Instrument Sans, Instrument Serif, JetBrains Mono
Animation:    CSS + requestAnimationFrame (no Framer Motion)
WASM:         Custom loader in /wasm/parser-bridge.ts

---

## 5. Frontend Design System Summary

The full design system lives in SKILLS.md. Read SKILLS.md before touching any
frontend file. This section is a summary only. SKILLS.md is authoritative.

DESIGN IDENTITY:
Warm, editorial, developer-facing. Off-white paper background. Near-black ink
text. Generous whitespace. Thin hairline borders. No gradients, no shadows on
landing sections, no rounded cards. Swiss editorial grid crossed with terminal
aesthetics. Calm, confident, precise.

COLOR TOKENS (from globals.css, authoritative):
  Background primary:  #FAFAF9   (warm off-white, the paper)
  Text primary:        #080503   (near-black, the ink)
  Surface/card:        #FFFFFF   (pure white, cards/popovers only)
  Text muted:          #5E534A
  Background muted:    #ECEBE7
  Background accent:   #E7E4DD
  Border primary:      #DAD7D0
  Danger:              #E7000B
  Status green:        #05DF72 / #00C950

Opacity variants of ink (#080503): ink/90, ink/70, ink/40, ink/30, ink/20, ink/10

TYPOGRAPHY:
  Display (hero/sections):  Instrument Serif, font-display class
  Sans (UI/body):           Instrument Sans, font-sans class
  Mono (code/labels):       JetBrains Mono, font-mono class

Type scale:
  Hero:     text-6xl md:text-8xl lg:text-[10rem], leading-[0.85], tracking-tight
  Section:  text-4xl lg:text-6xl, tracking-tight
  Feature:  text-3xl lg:text-4xl, font-display
  Body lg:  text-xl, text-muted-foreground, leading-relaxed
  Eyebrow:  font-mono text-xs tracking-widest uppercase text-muted-foreground
  Code:     font-mono text-sm leading-loose

LAYOUT:
  Primary container:  max-w-[1400px] mx-auto px-6 lg:px-12
  Narrow container:   max-w-7xl mx-auto px-6 lg:px-12
  Section padding:    py-24 lg:py-32 (standard), py-32 lg:py-40 (large)
  Card padding:       p-8 lg:p-12

COMPONENT RULES:
  Buttons:       black pill (primary) or outline pill (secondary). rounded-full only.
  Panels/cards:  square bordered panels, border border-foreground/10, no radius.
  Metric grids:  gap-px bg-foreground/10 parent, bg-background children.
  Code windows:  black inverse (bg-foreground text-background), traffic-light dots.
  Nav:           floating pill when scrolled, full-width transparent at top.
  Eyebrows:      line + mono text pattern: -- Label

DO NOT RULES (enforced for all agents):
  1.  Never use #FFFFFF as page background. Use #FAFAF9.
  2.  Never introduce color accents (blue, purple, neon, gradients).
  3.  Never round landing panels. rounded-full for CTAs only.
  4.  Never add drop shadows to landing sections.
  5.  Never use Geist font. Use Instrument Sans/Serif + JetBrains Mono.
  6.  Never set headlines in sans-serif. Use font-display (Instrument Serif).
  7.  Never use font-bold or font-extrabold for display type.
  8.  Never use tracking-widest uppercase on large headings. Only tiny mono labels.
  9.  Never add colored syntax highlighting to code windows. Monochrome only.
  10. Never use stock photos or glossy illustrations. Monochrome SVG/canvas/ASCII only.
  11. Never center every section. Mix left-aligned and centered as existing sections do.
  12. Never use thick borders except featured pricing card (border-2 border-foreground).
  13. Never add gradient blobs, orbs, or glass cards as decoration.
  14. Never remove noise-overlay from page shell without intentional replacement.
  15. Never use nested card-in-card layouts on landing page.

---

## 6. Pages and Routes

### 6.1 Landing Page (/)

Public-facing marketing page. Sections in order:

  Navigation
  HeroSection
  FeaturesSection
  HowItWorksSection
  DemoSection          <- live .forml snippet that renders a real form preview
  MetricsSection
  CtaSection
  FooterSection

NAVIGATION:
  Fixed header, transitions on scroll.
  Top state: transparent, full-width, height h-20.
  Scrolled: floating pill, bg-background/80 backdrop-blur-xl, rounded-2xl,
    border border-foreground/10, max-w-[1200px], height h-14.
  Links: Features, How it Works, Developers, Pricing.
  CTAs: "Sign in" (ghost) + "Start creating" (black pill).
  Mobile: full-screen overlay menu with text-5xl font-display links.

HERO SECTION:
  Full viewport height.
  Left: huge Instrument Serif headline. Stroked text accent on one word.
  Subheadline: muted body explaining Forms as Code.
  Two CTAs: "Talk to AI" (black pill + arrow) and "Open Editor" (outline pill).
  Right: monochrome animated canvas (ASCII character sphere or wave).
  Scrolling stats ticker at bottom (marquee).
  Background: #FAFAF9 with noise-overlay.

FEATURES SECTION:
  Eyebrow: -- Features
  Headline: large serif, two lines, second line muted.
  Layout: stacked horizontal rows with bottom borders. NOT a card grid.
  Each row: mono number, serif title, muted body, right-side monochrome SVG.
  Hover: title shifts right translate-x-2.
  Features:
    Forms as Code     - define forms in .forml DSL
    Git-native        - version control, diffs, PRs for forms
    AI Generation     - natural language to valid DSL
    Live Preview      - real-time rendering as you type
    Dynamic Forms     - repeat groups, conditionals, computed fields
    Validation        - type-safe, pattern-matched, required rules

HOW IT WORKS SECTION:
  Dark inverse section (bg-foreground text-background).
  Eyebrow: -- Process
  Three steps left, code window right (sticky).
  Steps: Write DSL -> Parse to AST -> Render Live.
  Code window: black panel, traffic-light dots, .forml syntax example.

DEMO SECTION (Signature Feature):
  Live interactive demo on landing page.
  Left: Monaco editor with sample .forml snippet pre-loaded.
  Right: live rendered form that updates as user types.
  Parser runs via WASM client-side. No server call needed for demo.
  This is the single interaction that communicates the entire product.

METRICS SECTION:
  -- By the numbers eyebrow.
  2x2 grid divided by hairline borders.
  Large serif numbers, muted mono labels.

CTA SECTION:
  Large bordered panel, no radius, border border-foreground.
  Left: headline + body + two CTAs.
  Right: animated tetrahedron/ASCII visual.
  Mouse spotlight: radial-gradient follows cursor.
  Decorative corner border fragments (absolute positioned).

FOOTER:
  border-t border-foreground/10.
  Animated wave background (absolute, opacity 20%).
  6-column link grid: Product, Developers, Company, Legal.
  Brand: text-2xl font-display + tiny mono TM.
  Bottom bar: operational status dot + copyright.

---

### 6.2 Auth Pages (/login, /signup)

  Minimal, centered card layout.
  Background: #FAFAF9.
  Single card: border border-foreground/10, no shadow, no radius.
  Instrument Serif heading, sans body.
  Standard shadcn/ui input fields.
  "Sign in with GitHub" as primary OAuth option.
  Link between login/signup at bottom.

---

### 6.3 Dashboard (/dashboard)

Logged-in home. Shows all projects (forms) the user has created.

LAYOUT:
  Full page with sidebar navigation.
  Sidebar: bg-sidebar (#FAFAFA), border-r border-sidebar-border.
  Top bar: user avatar, project search, "New Form" CTA (black pill).

PROJECT GRID:
  Uniform grid of project cards.
  Each card: border border-foreground/10, no shadow, no radius.
  Card contents:
    Form name (serif, medium)
    Last modified (mono, muted, relative time)
    Line count of DSL
    Status indicator (draft / published)
  Hover: subtle bg-foreground/[0.02] fill, border darkens.
  Clicking a card navigates to /editor/[projectId].

EMPTY STATE:
  Centered, no card wrapper.
  Serif headline: "No forms yet."
  Muted body: "Create your first form with AI or write DSL directly."
  Two CTAs: "Talk to AI" + "Open Editor".

NEW FORM FLOW:
  Modal (shadcn Dialog) on "New Form" click.
  Input: form name.
  Radio: "Start with AI" or "Start with blank DSL".
  Creates project, redirects to editor.

---

### 6.4 Editor (/editor/[projectId])

Core product interface. Three-panel VSCode-like layout.

```
+------------------------------------------------------------------+
|  TOOLBAR: [<- Dashboard] [project name] [Save] [Publish]         |
|           [Editor] [Preview] [Chat] (panel toggles, top center)  |
+-------------------+-------------------+--------------------------+
|                   |                   |                          |
|   LEFT PANEL      |   CENTER PANEL    |   RIGHT PANEL            |
|   DSL Editor      |   Form Preview    |   AI Chat                |
|   Monaco          |   Live render     |   Message thread         |
|                   |                   |                          |
|   .forml file     |   Actual form     |   User types NL          |
|   Syntax          |   rendered from   |   AI responds with       |
|   highlighting    |   AST in real     |   DSL or edits           |
|   Line numbers    |   time            |                          |
|                   |                   |                          |
+-------------------+-------------------+--------------------------+
|  STATUS BAR: parse status | line:col | error message if any      |
+------------------------------------------------------------------+
```

EDITOR PANEL (Left):
  Monaco Editor instance.
  Language: custom "forml" registered with Monaco.
  Theme: matches site palette (warm paper or dark inverse).
  On every keystroke: DSL passed to WASM parse() function.
  Parse success: AST passed to preview panel.
  Parse failure: error shown in status bar.
  Status bar: parse status, line/col, error message.

PREVIEW PANEL (Center):
  Receives JSON AST from editor panel.
  ASTRenderer.tsx walks AST recursively.
  Renders actual interactive form components.
  Repeat groups: reads field value, renders N copies dynamically.
  Conditionals: evaluated at render time, mount/unmount live.
  Form is actually fillable (user can test it).
  Top bar: "Preview" label + device size toggles.

CHAT PANEL (Right):
  Message thread: user messages + AI responses.
  Input: multiline textarea at bottom, send button.
  AI responses can contain:
    Plain text explanation
    DSL code blocks with "Apply to editor" button
    Error explanations if parser fails
  "Apply to editor" replaces editor content with generated DSL.
  Chat context includes: current DSL, last parse error if any.
  Top bar: "AI Assistant" label + "Clear chat" button.
  Panel can be collapsed to icon on right edge.

TOOLBAR:
  Left: <- Dashboard link, project name (editable inline).
  Center: panel toggle buttons (Editor / Preview / Chat).
  Right: "Save" (saves DSL to backend), "Publish" (shareable URL).
  Background: bg-background, border-b border-foreground/10.

PANEL LAYOUT:
  CSS Grid: grid-cols-[1fr_1fr_380px].
  Panel borders: border-r border-foreground/10 between panels.
  All panels: bg-background, full height minus toolbar.
  Panels resizable (drag handle on border).
  Mobile: single panel with tab switcher at top.

---

## 7. DSL Grammar v1.1 (Locked)

Canonical grammar. Every component derives from it.
Do not modify without updating all four components simultaneously.

```ebnf
/* TOP LEVEL */
form             = "form" STRING "{"
                     { group_definition | var_declaration | page | statement }
                     [ action_block ]
                   "}" ;

page             = "page" STRING "{"
                     { statement }
                     [ trigger_block ]
                   "}" ;

statement        = field
                 | section
                 | repeat_group
                 | conditional
                 | group_use
                 | layout_block ;

/* REUSABLE GROUPS */
group_definition = "group" IDENTIFIER "{" { field } "}" ;
group_use        = "use" IDENTIFIER ;

/* VARIABLES */
/* value must be compile-time literal, no IDENTIFIER refs allowed */
var_declaration  = "var" IDENTIFIER "=" literal ";" ;

/* FIELD AND DATA STRUCTURES */
field            = "field" IDENTIFIER ":" type
                   [ ui_block ]
                   [ validation_block ]
                   [ compute_block ]
                   [ trigger_block ] ;

type             = "text"    | "integer" | "float"
                 | "email"   | "date"    | "boolean"
                 | "url"     | select_type ;

select_type      = ( "select" | "radio" | "checkbox" )
                   ( "{" option { option } "}" | source_block ) ;

option           = "option" STRING ;

source_block     = "from" "url" STRING
                   [ "map" "{"
                       "label" ":" IDENTIFIER ","
                       "value" ":" IDENTIFIER
                     "}"
                   ] ;

/* PRESENTATION */
/* No trailing commas. Newlines are implicit separators. */
ui_block         = "ui" "{" { ui_rule } "}" ;

ui_rule          = "label"       ":" STRING
                 | "placeholder" ":" STRING
                 | "helpText"    ":" STRING
                 | "default"     ":" value
                 | "bind"        ":" STRING ;

/* VALIDATION */
validation_block = "validate" "{" { validation_rule } "}" ;

validation_rule  = "required"
                 | "min"       ":" NUMBER
                 | "max"       ":" NUMBER
                 | "minLength" ":" NUMBER
                 | "maxLength" ":" NUMBER
                 | "pattern"   ":" STRING ;

/* LAYOUT AND GROUPING */
section          = "section" STRING "{" { statement } "}" ;
layout_block     = ( "row" | "column" ) "{" { statement } "}" ;

/* count must reference an integer-typed field, enforced in semantic pass */
repeat_group     = "repeat" "count" "=" IDENTIFIER "{" { field } "}" ;

/* LOGIC AND COMPUTATION */
conditional      = "if" condition "{" { statement } "}"
                   [ "else" "{" { statement } "}" ] ;

/* Precedence: || lowest, && tighter, parens override */
condition        = logic_term { "||" logic_term } ;
logic_term       = logic_factor { "&&" logic_factor } ;
logic_factor     = simple_condition | "(" condition ")" ;
simple_condition = IDENTIFIER comparator value ;
comparator       = "==" | "!=" | "<" | ">" | "<=" | ">=" ;

/* Type safety is semantic, enforce in parser second pass */
compute_block    = "compute" "=" expression ;

/* Precedence: + - lowest, * / tighter, parens override */
expression       = math_term { ( "+" | "-" ) math_term } ;
math_term        = math_factor { ( "*" | "/" ) math_factor } ;
math_factor      = IDENTIFIER | NUMBER | "(" expression ")" ;

/* ACTIONS AND LIFECYCLE */
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

/* PRIMITIVES */
/* literal = compile-time constants only, no field references */
/* value   = runtime, can reference a field via IDENTIFIER    */
literal          = STRING | NUMBER | "true" | "false" ;
value            = STRING | NUMBER | "true" | "false" | IDENTIFIER ;

IDENTIFIER       = letter { letter | digit | "_" } ;
STRING           = '"' { any_character_except_quote } '"' ;
NUMBER           = digit { digit } [ "." { digit } ] ;
letter           = "a" | ... | "z" | "A" | ... | "Z" ;
digit            = "0" | ... | "9" ;
```

---

## 8. Token Types (Lexer Contract)

The C++ lexer must produce exactly these token types. No others.

```
KEYWORD     -> form, field, section, group, use, var, page,
               repeat, count, if, else, on, compute, validate,
               action, submit, from, url, map, row, column,
               true, false, POST, PUT, PATCH,
               load, change, blur,
               hide, show, clear, set, navigate,
               text, integer, float, email, date, boolean,
               select, radio, checkbox,
               required, min, max, minLength, maxLength, pattern,
               label, placeholder, helpText, default, bind,
               endpoint, method, option

IDENTIFIER  -> user-defined names
STRING      -> "..." quoted string literals
NUMBER      -> integer or float numeric literals
LEFT_BRACE  -> {
RIGHT_BRACE -> }
LEFT_PAREN  -> (
RIGHT_PAREN -> )
COLON       -> :
EQUALS      -> =
SEMICOLON   -> ;
COMMA       -> ,
PLUS        -> +
MINUS       -> -
STAR        -> *
SLASH       -> /
EQ          -> ==
NEQ         -> !=
LT          -> <
GT          -> >
LTE         -> <=
GTE         -> >=
AND         -> &&
OR          -> ||
EOF         -> end of input
```

---

## 9. AST JSON Schema (Interface Contract)

Contract between compiler and frontend renderer.
Do not change node shapes without updating both C++ emitter and React renderer.

Form (root):
```json
{
  "type": "Form",
  "name": "string",
  "variables": [{ "type": "VarDeclaration", "name": "string", "value": "literal" }],
  "groups": [{ "type": "GroupDefinition", "name": "string", "fields": [] }],
  "pages": [],
  "body": [],
  "action": { "type": "ActionBlock", "endpoint": "string", "method": "POST|PUT|PATCH" }
}
```

Page:
```json
{ "type": "Page", "name": "string", "body": [], "trigger": null }
```

Field:
```json
{
  "type": "Field",
  "name": "string",
  "dataType": "text|integer|float|email|date|boolean|url|select|radio|checkbox",
  "options": ["string"],
  "source": { "url": "string", "label": "string", "value": "string" },
  "ui": { "label": "string", "placeholder": "string", "helpText": "string", "default": null, "bind": "string" },
  "validation": { "required": false, "min": null, "max": null, "minLength": null, "maxLength": null, "pattern": null },
  "compute": null,
  "trigger": null
}
```

RepeatGroup:
```json
{ "type": "RepeatGroup", "count_ref": "string", "fields": [] }
```

Conditional:
```json
{ "type": "Conditional", "condition": {}, "consequent": [], "alternate": [] }
```

Condition:
```json
{ "type": "Condition", "op": "|| | &&", "left": {}, "right": {} }
```

SimpleCondition:
```json
{ "type": "SimpleCondition", "field": "string", "comparator": "== | != | < | > | <= | >=", "value": "any" }
```

TriggerBlock:
```json
{
  "type": "TriggerBlock",
  "event": "load|change|blur|submit",
  "actions": [{ "type": "hide|show|clear|set|navigate|submit", "target": "string", "value": null }]
}
```

---

## 10. Compiler Hard Rules

- Every parse error must include line number and column number.
  Format: [ParseError] Line 4, Col 12: Expected ':' after field name.
- No raw pointers without RAII wrappers. Use std::unique_ptr and std::shared_ptr.
- Every recursive parser function maps 1-to-1 to one grammar rule.
  Function name must match rule name: parseRepeatGroup(), parseConditional(), etc.
- Parser has two passes: syntactic (grammar check) and semantic (type/ref check).
  Keep them strictly separate.
- Semantic pass must verify:
    repeat count=X: X must reference a declared integer-typed field
    compute = expr: computed type must match declared field type
    use GroupName: GroupName must be defined in the same form
    var X = val: val must be a literal, not an IDENTIFIER
- AST emitter outputs minified JSON (no pretty-print in production).
- CLI test: ./formix-cli parse input.forml prints AST or error.

---

## 11. WASM Bridge Rules

- Emscripten build outputs formix-parser.js + formix-parser.wasm
- Exported function: parse(dsl_string) -> json_ast_string
- Called from: renderer/wasm/parser-bridge.ts
- Bridge handles WASM loading async. Show "loading" until WASM ready.
- On parse error, returns: { "error": true, "message": "[ParseError] Line N, Col M: ..." }
- On parse success, returns: full AST JSON string.
- Zero network calls. Runs entirely in browser.

---

## 12. AI Orchestrator Rules

- LLM prompt must always include the full EBNF grammar from Section 7.
- Prompt must include at least 2 few-shot examples of valid .forml DSL.
- Self-correction loop: maximum 3 retries. After 3 failures, return last
  parser error to user with human-readable explanation.
- Never pass raw user input directly to LLM without structured prompt template.

Prompt template structure:
  [SYSTEM]: You are a Forml DSL generator. Generate only valid Forml DSL.
            Grammar: [EBNF grammar]
            Examples: [few-shot examples]
  [USER]:   Generate a form that: [user request]
  [RULES]:  Output only the DSL. No explanation. No markdown fences.

On retry, append:
  [ERROR]: Your previous output failed to parse with this error:
           [parser error message]
           Fix the DSL and output only the corrected version.

FastAPI endpoints:
  POST /generate  body: { "prompt": string }
  POST /parse     body: { "dsl": string }  proxies to C++ parser
  GET  /health    returns: { "status": "ok" }

---

## 13. Renderer Rules

- ASTRenderer.tsx has one switch/case per AST node type. No special-case
  logic outside the switch.
- Repeat groups resolve count by reading current runtime value of referenced
  field. Never hardcode a count in the renderer.
- Conditional logic evaluated at render time. Components mount/unmount live.
- Renderer never calls parser directly. It only receives AST JSON.

Field type to React component mapping:
  text      -> <input type="text">
  integer   -> <input type="number" step="1">
  float     -> <input type="number" step="any">
  email     -> <input type="email">
  date      -> <input type="date">
  boolean   -> <input type="checkbox">
  url       -> <input type="url">
  select    -> <select> with <option> children
  radio     -> <fieldset> with radio <input> group
  checkbox  -> <fieldset> with checkbox <input> group

Validation: run on blur for each field. Show error below field in
  text-sm style using --color-danger (#E7000B).

---

## 14. Deliberate Decisions (Do Not Reverse)

Decision                          Reason
-----------                       -------
Repeat groups one level deep      Nested repeats disproportionate to 6-week scope
No parser generators              Educational requirement, hand-written only
Parsing in C++ only               WASM requirement, all parsing runs client-side
var values must be literals       Prevents circular references at compile time
No trailing commas in DSL         Newlines are implicit separators
repeat count IDENTIFIER only      Literal count repeats are degenerate
Max 3 LLM retries                 Prevents infinite loops on broken prompts
Instrument Serif for display      Editorial-technical aesthetic, not generic SaaS
No color accents in UI            Warm monochrome identity is the design signature
Square panels no radius           Architectural precision over friendly rounding
Monaco for DSL editor             VSCode engine, best-in-class for custom languages
Next.js App Router                Server components for landing, client for editor

---

## 15. Current Implementation Status

Update this at the start of every week.

Week:     1-2 (June 16 to June 27, 2026)
Status:   Grammar and frontend design phase
Done:     EBNF grammar v1.1 finalized
          AGENT.md written
          SKILLS.md generated from v0 template codebase
          UI template (Optimus/v0) imported and reviewed
Active:   Adapting v0 template to Formix branding
          Reading Crafting Interpreters Ch 1-4
Next:     Token enum -> C++ Lexer -> RDP -> AST emitter -> CLI test
          Frontend: rename Optimus to Formix, update copy, hero section
Blocked:  Nothing

---

## 16. Hero Section Copy (Formix-Specific)

Use this exact copy when building the landing page. Do not use generic
placeholder text or Optimus/template copy.

Eyebrow:         -- Forms as Code

Hero headline (two lines, second line or accent word uses .text-stroke):
  Define forms.
  Ship them.

Subheadline:
  Write forms in a DSL. Version-control them in Git.
  Let AI generate them from natural language.
  No drag-and-drop. No database. Just code.

Primary CTA:     Talk to AI ->
Secondary CTA:   Open Editor

Features eyebrow:   -- What you get
Features headline:
  Everything a form needs.
  Nothing it doesn't.

How it works eyebrow:   -- Process
How it works headline:
  Three steps.
  One file.

Steps:
  1. Write   - Define your form in .forml DSL
  2. Parse   - C++ compiler validates and builds AST
  3. Render  - React renders a live interactive form

CTA headline:
  Ready to build
  forms differently?

Footer brand:     Formix TM (tiny mono TM)
Footer tagline:   Forms as Code. Version-controlled. AI-generated.

---

## 17. Reference: Valid .forml File

Canonical test case. Parser must accept this exactly.
Expected AST output: /tests/ast/fleet_registration.json

```
form "Fleet Registration" {

  var max_year = 2025 ;

  group vehicle_address {
    field street: text ui { label: "Street Address" }
    field city: text ui { label: "City" }
    field pincode: integer validate { pattern: "[0-9]{6}" }
  }

  page "Owner Info" {
    field owner_name: text ui {
      label: "Full Name"
      placeholder: "John Doe"
    } validate {
      required
      minLength: 2
    }

    field fleet_size: integer ui {
      label: "Number of Vehicles"
    } validate {
      required
      min: 1
      max: 50
    }
  }

  page "Vehicle Details" {
    repeat count=fleet_size {
      field make: text
      field model: text
      field year: integer validate {
        min: 1900
        max: max_year
      }
      field fuel_type: radio {
        option "Petrol"
        option "Diesel"
        option "Electric"
      }
    }
  }

  page "Additional Info" {
    if fleet_size > 5 && owner_type == "corporate" {
      field company_name: text validate { required }
      use vehicle_address
    }
  }

  action submit {
    endpoint: "https://api.formix.dev/submit"
    method: POST
  }

}
```

---

## 18. Agent Workflow Instructions

When you receive any task in this codebase, follow this sequence:

1.  Read AGENT.md (this file) fully before writing any code.
2.  If task involves frontend UI, also read SKILLS.md fully.
3.  Identify which component the task belongs to:
    compiler / wasm-bridge / renderer / ai-orchestrator.
4.  Check Section 14 (Deliberate Decisions). Do not reverse any.
5.  Check Section 1 (What This Is NOT). Do not violate any constraint.
6.  If modifying grammar, update ALL four components in same changeset.
7.  If modifying AST schema, update C++ emitter AND React renderer simultaneously.
8.  If adding frontend component, follow SKILLS.md exactly.
9.  Write TypeScript with strict types. No any except where unavoidable.
10. Write C++ with RAII. No raw pointers.
11. Every new DSL feature needs a test in /tests/dsl/ and /tests/ast/.
12. Every parse error must include line number and column number.
13. Do not refactor working code while implementing a new feature.
14. Do not introduce new dependencies without a clear documented reason.
