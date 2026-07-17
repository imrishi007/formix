import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";

export const metadata: Metadata = {
  title: "Primitives & Literals — Formix Docs",
  description: "Reference for Forml primitives: IDENTIFIER, STRING, NUMBER, and the value production.",
};

export default function SyntaxPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Language Reference" }, { label: "Primitives & Literals" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Language Reference</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-6 leading-[1.05]">
          Primitives &amp; Literals
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          The fundamental tokens that the Forml lexer recognises. Every higher-level construct —
          fields, forms, conditions, expressions — is ultimately composed of these atoms.
        </p>

        <h2 className="text-2xl font-display tracking-tight mt-8 mb-6">Token Summary</h2>
        <div className="border border-foreground/10 divide-y divide-foreground/8 mb-10">
          {[
            { token: "IDENTIFIER", regex: `/[a-zA-Z][a-zA-Z0-9_]*/`, example: "firstName, user_age, taxRate2" },
            { token: "STRING", regex: `/"[^"]*"/`, example: '"Your Name", "Excellent", "/api/submit"' },
            { token: "NUMBER", regex: `/\\d+(\\.\\d+)?/`, example: "0, 42, 3.14, 100000" },
            { token: "true / false", regex: "keywords", example: "field active : boolean — default: true" },
            { token: "Keywords", regex: "reserved", example: "form, field, page, if, else, validate, ui…" },
          ].map(({ token, regex, example }) => (
            <div key={token} className="px-5 py-3.5 grid grid-cols-3 gap-4 items-start">
              <code className="font-mono text-sm text-foreground">{token}</code>
              <code className="font-mono text-xs text-muted-foreground">{regex}</code>
              <span className="text-xs text-muted-foreground">{example}</span>
            </div>
          ))}
        </div>

        <EbnfRule
          name="value"
          definition={`value      = STRING | NUMBER | "true" | "false" | IDENTIFIER ;`}
          description="Used in assignments, defaults, and conditions"
        />
        <EbnfRule
          name="IDENTIFIER"
          definition={`IDENTIFIER = letter { letter | digit | "_" } ;`}
          description="Must start with a letter — no leading digits"
        />
        <EbnfRule
          name="STRING"
          definition={`STRING = '"' { any_character_except_quote } '"' ;`}
          description="Double-quoted string literal"
        />
        <EbnfRule
          name="NUMBER"
          definition={`NUMBER = digit { digit } [ "." { digit } ] ;`}
          description="Integer or float — no leading zeros for floats"
        />

        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Reserved Keywords</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          These identifiers are reserved by the grammar and cannot be used as field or variable names:
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {[
            "form", "field", "page", "section", "group", "use", "var",
            "if", "else", "repeat", "count", "on", "action", "submit",
            "validate", "compute", "ui", "from", "map", "load", "change",
            "blur", "hide", "show", "clear", "set", "navigate",
            "required", "min", "max", "minLength", "maxLength", "pattern",
            "label", "placeholder", "helpText", "default", "bind",
            "endpoint", "method", "option", "POST", "PUT", "PATCH",
            "true", "false",
            "text", "integer", "float", "email", "date", "boolean", "url",
            "select", "radio", "checkbox", "row", "column",
          ].map((kw) => (
            <code
              key={kw}
              className="font-mono text-xs bg-foreground/[0.05] border border-foreground/10 px-2 py-1 rounded-sm text-foreground/70"
            >
              {kw}
            </code>
          ))}
        </div>

        <Callout type="warning">
          Using a reserved keyword as an IDENTIFIER is a lexer error. Prefix the name with an
          underscore or choose a different word: <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">_form</code>, <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">formName</code>.
        </Callout>

        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Whitespace &amp; Comments</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Forml is whitespace-insensitive — indentation is for readability only. Comments are
          not yet part of v1.1 but are reserved as <code className="font-mono text-sm bg-foreground/[0.06] px-1 py-0.5">// line comments</code>.
        </p>

        <CodeBlock
          code={`// This is a comment (reserved — not yet parsed in v1.1)

form "Demo" {
  // Fields can be indented any number of spaces
  field name:text ui{label:"Name"}   // compact style also valid
}`}
          language="forml"
        />

        <div className="mt-16 pt-8 border-t border-foreground/10 flex items-center justify-between">
          <Link href="/docs/grammar" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← EBNF Grammar
          </Link>
          <Link href="/docs/fields" className="text-sm text-foreground hover:underline underline-offset-4">
            Fields &amp; Types →
          </Link>
        </div>
      </article>
    </div>
  );
}
