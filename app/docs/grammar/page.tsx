import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";

export const metadata: Metadata = {
  title: "EBNF Grammar — Formix Docs",
  description: "The complete canonical EBNF grammar specification for the Forml DSL v1.1.",
};

const toc = [
  { id: "notation", label: "Notation" },
  { id: "primitives", label: "1. Primitives & Literals" },
  { id: "structure", label: "2. Form & Page Structure" },
  { id: "reusability", label: "3. Reusability & DRY" },
  { id: "fields", label: "4. Fields & Data Sourcing" },
  { id: "presentation", label: "5. Presentation & Validation" },
  { id: "logic", label: "6. Logic, Math & Dynamics" },
  { id: "actions", label: "7. Actions & Triggers" },
  { id: "root", label: "Root Production" },
];

export default function GrammarPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Language Reference" }, { label: "EBNF Grammar" }]} />

      <div className="flex">
        {/* Main content */}
        <article className="flex-1 max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16 min-w-0">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-6">
            <span className="w-6 h-px bg-foreground/30" />
            <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
              Language Reference
            </span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-4xl lg:text-5xl font-display tracking-tight leading-[1.05]">
              EBNF Grammar
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/40 border border-foreground/20 px-2 py-1">
              v1.1
            </span>
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            This is the canonical, finalized grammar for <strong className="text-foreground font-medium">Forml</strong>,
            the DSL at the core of the Formix platform. This is the single source of truth for the
            lexer, parser, and AST design.
          </p>

          <Callout type="important">
            Do not invent grammar constructs not present here. If something is ambiguous or missing,
            open an issue on GitHub rather than guessing — the compiler&apos;s behavior is defined
            exclusively by this grammar.
          </Callout>

          {/* ── Notation ─────────────────────────────────────── */}
          <h2 id="notation" className="text-2xl font-display tracking-tight mt-14 mb-6 scroll-mt-20">
            Notation
          </h2>

          <div className="border border-foreground/10 divide-y divide-foreground/8 mb-8">
            {[
              { sym: "=", meaning: "Defines a production rule" },
              { sym: "|", meaning: "Alternation — A | B means A or B" },
              { sym: "[ ... ]", meaning: "Optional — 0 or 1 occurrence" },
              { sym: "{ ... }", meaning: "Repetition — 0 or more occurrences" },
              { sym: '"..."', meaning: "Literal terminal string" },
              { sym: ";", meaning: "Terminates a rule definition" },
              { sym: "/* ... */", meaning: "Comment" },
            ].map(({ sym, meaning }) => (
              <div key={sym} className="flex items-start gap-6 px-5 py-3">
                <code className="font-mono text-sm text-foreground w-24 shrink-0">{sym}</code>
                <span className="text-sm text-muted-foreground">{meaning}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-12">
            <strong className="text-foreground">Terminals</strong> are literal characters/strings
            that appear in actual <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">.forml</code> source
            (e.g. <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">"form"</code>,{" "}
            <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">{'"{"'}</code>).{" "}
            <strong className="text-foreground">Non-terminals</strong> are abstract symbols built
            from other rules (e.g. <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">field</code>,{" "}
            <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">statement</code>,{" "}
            <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">expression</code>).
          </p>

          {/* ── 1. Primitives ─────────────────────────────────── */}
          <h2 id="primitives" className="text-2xl font-display tracking-tight mt-12 mb-4 scroll-mt-20">
            1. Primitives &amp; Literals
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            The fundamental tokens recognised by the lexer. Everything in Forml is composed of these atoms.
          </p>

          <EbnfRule
            name="value"
            definition={`value      = STRING | NUMBER | "true" | "false" | IDENTIFIER ;`}
            description="Catch-all used in assignments, defaults, and conditions"
          />
          <EbnfRule
            name="IDENTIFIER"
            definition={`IDENTIFIER = letter { letter | digit | "_" } ;`}
            description="Field/variable names — must start with a letter"
          />
          <EbnfRule
            name="STRING"
            definition={`STRING     = '"' { any_character_except_quote } '"' ;`}
            description="Double-quoted string literal"
          />
          <EbnfRule
            name="NUMBER"
            definition={`NUMBER     = digit { digit } [ "." { digit } ] ;`}
            description="Integer or float (optional fractional part)"
          />
          <EbnfRule
            name="letter / digit"
            definition={`letter     = "a" | ... | "z" | "A" | ... | "Z" ;
digit      = "0" | ... | "9" ;`}
          />

          <div className="mt-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">IDENTIFIER</code> — 
              variable/field names (e.g. <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">firstName</code>,{" "}
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">user_age</code>). Must start with a letter to avoid ambiguity with{" "}
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">NUMBER</code> during tokenization.
            </p>
            <p>
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">NUMBER</code> — 
              supports integers and floats implicitly (optional fractional part).
            </p>
            <p>
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">value</code> — 
              catch-all type used in assignments, defaults, and conditions.
            </p>
          </div>

          {/* ── 2. Form & Page Structure ──────────────────────── */}
          <h2 id="structure" className="text-2xl font-display tracking-tight mt-14 mb-4 scroll-mt-20">
            2. Form &amp; Page Structure
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            The top-level skeleton of every Forml document. <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">form</code> is always the AST root.
          </p>

          <EbnfRule
            name="form"
            definition={`form      = "form" STRING "{"
              { group_definition | var_declaration | page | statement }
              [ action_block ]
            "}" ;`}
            description="Root production — the entire form payload"
          />
          <EbnfRule
            name="page"
            definition={`page      = "page" STRING "{"
              { statement }
              [ trigger_block ]
            "}" ;`}
            description="A step in a multi-page wizard"
          />
          <EbnfRule
            name="statement"
            definition={`statement = field | section | repeat_group | conditional
          | group_use | layout_block ;`}
            description="The building block of form and page bodies"
          />

          <div className="mt-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">form</code> is the AST root — the entire application payload.
            </p>
            <p>
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">page</code> supports multi-step wizards natively.
            </p>
            <p>
              <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">statement</code> is the general unit that both <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">form</code> and <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">page</code> bodies are built from.
            </p>
          </div>

          {/* ── 3. Reusability ───────────────────────────────── */}
          <h2 id="reusability" className="text-2xl font-display tracking-tight mt-14 mb-4 scroll-mt-20">
            3. Reusability &amp; DRY Constructs
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Forml lets you define reusable field groups and declare constants to keep forms DRY.
          </p>

          <EbnfRule
            name="group_definition"
            definition={`group_definition = "group" IDENTIFIER "{" { field } "}" ;`}
            description="Define a reusable field structure once"
          />
          <EbnfRule
            name="group_use"
            definition={`group_use        = "use" IDENTIFIER ;`}
            description="Inject a previously defined group by name"
          />
          <EbnfRule
            name="var_declaration"
            definition={`var_declaration  = "var" IDENTIFIER "=" value ";" ;`}
            description="Global constant referenceable in data sources and expressions"
          />

          <CodeBlock
            code={`// Define once
group AddressBlock {
  field street : text
    ui { label: "Street Address" }
    validate { required }

  field city : text
    ui { label: "City" }

  field postcode : text
    ui { label: "Postcode" }
    validate { pattern: "^[A-Z]{1,2}\\d[\\dA-Z]? \\d[A-Z]{2}$" }
}

// Use anywhere
form "Order" {
  use AddressBlock    // inject all 3 fields here
}`}
            language="forml"
            filename="order.forml"
          />

          {/* ── 4. Fields ─────────────────────────────────────── */}
          <h2 id="fields" className="text-2xl font-display tracking-tight mt-14 mb-4 scroll-mt-20">
            4. Fields &amp; Data Sourcing
          </h2>

          <EbnfRule
            name="field"
            definition={`field        = "field" IDENTIFIER ":" type
               [ ui_block ]
               [ validation_block ]
               [ compute_block ]
               [ trigger_block ] ;`}
            description="The core data-capture element"
          />
          <EbnfRule
            name="type"
            definition={`type         = "text" | "integer" | "float" | "email"
             | "date" | "boolean" | "url" | select_type ;`}
            description="All supported data types"
          />
          <EbnfRule
            name="select_type"
            definition={`select_type  = ( "select" | "radio" | "checkbox" )
               ( "{" option { option } "}" | source_block ) ;

option       = "option" STRING ;`}
            description="Dropdown / radio / checkbox with static or dynamic options"
          />
          <EbnfRule
            name="source_block"
            definition={`source_block = "from" ( "url" STRING | "var" IDENTIFIER )
               [ "map" "{" "label" ":" IDENTIFIER ","
               "value" ":" IDENTIFIER "}" ] ;`}
            description="Dynamic option loading from REST or variable"
          />

          <Callout type="note">
            <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">source_block</code> fetches options from a REST endpoint (<code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">url</code>) or a
            pre-defined array (<code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">var</code>), with an optional <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">map</code> to translate
            arbitrary JSON keys into <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">label</code>/<code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">value</code>.
          </Callout>

          {/* ── 5. Presentation ──────────────────────────────── */}
          <h2 id="presentation" className="text-2xl font-display tracking-tight mt-14 mb-4 scroll-mt-20">
            5. Presentation, Layout &amp; Validation
          </h2>

          <EbnfRule
            name="ui_block"
            definition={`ui_block         = "ui" "{" { ui_rule } "}" ;
ui_rule          = "label"       ":" STRING
                 | "placeholder" ":" STRING
                 | "helpText"    ":" STRING
                 | "default"     ":" value
                 | "bind"        ":" STRING ;`}
            description="Rendering and data binding configuration"
          />
          <EbnfRule
            name="validation_block"
            definition={`validation_block = "validate" "{" { validation_rule } "}" ;
validation_rule  = "required" | "min" ":" NUMBER | "max" ":" NUMBER
                 | "minLength" ":" NUMBER | "maxLength" ":" NUMBER
                 | "pattern" ":" STRING ;`}
            description="Constraints enforced before submission"
          />
          <EbnfRule
            name="section / layout_block"
            definition={`section          = "section" STRING "{" { statement } "}" ;
layout_block     = ( "row" | "column" ) "{" { statement } "}" ;`}
            description="Visual grouping and grid layout"
          />

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p><code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">ui_block</code> controls rendering; <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">bind</code> enables two-way data binding to external state.</p>
            <p><code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">layout_block</code> provides native grid support (<code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">row</code>/<code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">column</code>) without raw CSS.</p>
          </div>

          {/* ── 6. Logic ─────────────────────────────────────── */}
          <h2 id="logic" className="text-2xl font-display tracking-tight mt-14 mb-4 scroll-mt-20">
            6. Logic, Math &amp; Dynamics
          </h2>

          <EbnfRule
            name="conditional"
            definition={`conditional      = "if" condition "{" { statement } "}"
                   [ "else" "{" { statement } "}" ] ;`}
            description="Conditionally include or exclude fields"
          />
          <EbnfRule
            name="condition"
            definition={`condition        = logic_term { "||" logic_term } ;
logic_term       = logic_factor { "&&" logic_factor } ;
logic_factor     = simple_condition | "(" condition ")" ;
simple_condition = IDENTIFIER comparator value ;
comparator       = "==" | "!=" | "<" | ">" | "<=" | ">=" ;`}
            description="Boolean logic with operator precedence"
          />
          <EbnfRule
            name="compute_block"
            definition={`compute_block    = "compute" "=" expression ;
expression       = math_term { ( "+" | "-" ) math_term } ;
math_term        = math_factor { ( "*" | "/" ) math_factor } ;
math_factor      = IDENTIFIER | NUMBER | "(" expression ")" ;`}
            description="Arithmetic expressions with precedence climbing"
          />
          <EbnfRule
            name="repeat_group"
            definition={`repeat_group     = "repeat" "count" "=" IDENTIFIER "{" { field } "}" ;`}
            description="Dynamic list unrolling based on a field value"
          />

          <Callout type="note">
            <strong>Precedence (low → high):</strong>
            {" "}Condition (<code className="font-mono text-xs">||</code>) → logic_term (<code className="font-mono text-xs">&&</code>) → logic_factor.
            Expression (<code className="font-mono text-xs">+/-</code>) → math_term (<code className="font-mono text-xs">*//</code>) → math_factor.
            This directly maps to precedence-climbing in the recursive-descent parser.
          </Callout>

          <CodeBlock
            code={`form "Tax Return" {
  var taxRate = 0.2;

  field income : float
    ui { label: "Annual Income" }

  field tax : float
    compute = income * taxRate
    ui { label: "Tax Due" }

  if income > 100000 {
    field surcharge : float
      compute = (income - 100000) * 0.05
  }

  repeat count = numberOfDependents {
    field dependentName : text
      ui { label: "Dependent Name" }
  }
}`}
            language="forml"
            filename="tax-return.forml"
          />

          {/* ── 7. Actions ───────────────────────────────────── */}
          <h2 id="actions" className="text-2xl font-display tracking-tight mt-14 mb-4 scroll-mt-20">
            7. Actions &amp; Lifecycle Triggers
          </h2>

          <EbnfRule
            name="action_block"
            definition={`action_block     = "action" "submit" "{"
                     "endpoint" ":" STRING
                     "method"   ":" ( "POST" | "PUT" | "PATCH" )
                   "}" ;`}
            description="Routes the final JSON payload to a backend endpoint"
          />
          <EbnfRule
            name="trigger_block"
            definition={`trigger_block    = "on" event_type "{" { action_statement } "}" ;
event_type       = "load" | "change" | "blur" | "submit" ;`}
            description="Side-effect hooks on field/page lifecycle events"
          />
          <EbnfRule
            name="action_statement"
            definition={`action_statement = "hide"     "(" IDENTIFIER ")"
                 | "show"     "(" IDENTIFIER ")"
                 | "clear"    "(" IDENTIFIER ")"
                 | "set"      "(" IDENTIFIER "," value ")"
                 | "navigate" "(" STRING ")"
                 | "submit"   "(" ")" ;`}
            description="Side-effect actions available inside trigger blocks"
          />

          {/* ── Root Production ──────────────────────────────── */}
          <h2 id="root" className="text-2xl font-display tracking-tight mt-14 mb-4 scroll-mt-20">
            Root Production
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            For reference, the full derivation from the top. Everything else in this document is a
            derivation reachable from <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">form</code>, either
            directly or via <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">page → statement → ...</code> down to
            <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs"> value</code>,{" "}
            <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">IDENTIFIER</code>,{" "}
            <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">STRING</code>,{" "}
            <code className="font-mono bg-foreground/[0.06] px-1 py-0.5 text-xs">NUMBER</code>.
          </p>

          <CodeBlock
            code={`form = "form" STRING "{"
         { group_definition | var_declaration | page | statement }
         [ action_block ]
       "}" ;`}
            language="ebnf"
          />

          {/* Next page navigation */}
          <div className="mt-16 pt-8 border-t border-foreground/10 flex items-center justify-between">
            <Link
              href="/docs/introduction"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Introduction
            </Link>
            <Link
              href="/docs/syntax"
              className="text-sm text-foreground hover:underline underline-offset-4 transition-colors"
            >
              Primitives &amp; Literals →
            </Link>
          </div>
        </article>

        {/* Table of contents — right column */}
        <aside className="hidden xl:block w-56 shrink-0 py-16 pr-6">
          <div className="sticky top-20">
            <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/30 mb-4">
              On this page
            </p>
            <nav className="space-y-1">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-1 leading-snug"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
