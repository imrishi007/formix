import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";

export const metadata: Metadata = {
  title: "Validation Rules — Formix Docs",
  description: "Complete reference for Forml validation: required, min, max, minLength, maxLength, pattern.",
};

export default function ValidationPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Language Reference" }, { label: "Validation Rules" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Language Reference
          </span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-6 leading-[1.05]">
          Validation Rules
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          Validation rules live inside a{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1 py-0.5">validate {"{ }"}</code> block
          attached to a field. All rules are evaluated before the form can be submitted.
        </p>

        <EbnfRule
          name="validation_block"
          definition={`validation_block = "validate" "{" { validation_rule } "}" ;
validation_rule  = "required"
                 | "min"       ":" NUMBER
                 | "max"       ":" NUMBER
                 | "minLength" ":" NUMBER
                 | "maxLength" ":" NUMBER
                 | "pattern"   ":" STRING ;`}
        />

        <h2 className="text-2xl font-display tracking-tight mt-12 mb-6">Rules Reference</h2>

        <div className="border border-foreground/10 divide-y divide-foreground/8">
          {[
            {
              rule: "required",
              applies: "all types",
              description: "The field must have a non-empty value before submission.",
              example: `validate { required }`,
            },
            {
              rule: "min: NUMBER",
              applies: "integer, float",
              description: "The numeric value must be greater than or equal to NUMBER.",
              example: `validate { min: 0 }`,
            },
            {
              rule: "max: NUMBER",
              applies: "integer, float",
              description: "The numeric value must be less than or equal to NUMBER.",
              example: `validate { max: 100 }`,
            },
            {
              rule: "minLength: NUMBER",
              applies: "text, email, url",
              description: "The string value must have at least NUMBER characters.",
              example: `validate { minLength: 8 }`,
            },
            {
              rule: "maxLength: NUMBER",
              applies: "text, email, url",
              description: "The string value must have at most NUMBER characters.",
              example: `validate { maxLength: 255 }`,
            },
            {
              rule: "pattern: STRING",
              applies: "text, email, url",
              description: "The string value must match the given ECMAScript regular expression.",
              example: `validate { pattern: "^[A-Z]{2}\\d{6}$" }`,
            },
          ].map(({ rule, applies, description, example }) => (
            <div key={rule} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <code className="font-mono text-sm font-medium text-foreground">{rule}</code>
                <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/30 border border-foreground/10 px-2 py-0.5 shrink-0">
                  {applies}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{description}</p>
              <div className="[&>div]:my-0">
                <CodeBlock code={example} language="forml" showLineNumbers={false} />
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Combining Rules</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Multiple validation rules can appear inside a single <code className="font-mono text-sm bg-foreground/[0.06] px-1 py-0.5">validate {"{ }"}</code> block,
          separated by whitespace:
        </p>

        <CodeBlock
          code={`field password : text
  ui {
    label: "Password"
    placeholder: "At least 8 characters"
  }
  validate {
    required
    minLength: 8
    maxLength: 64
    pattern: "^(?=.*[A-Z])(?=.*\\d).+$"
  }`}
          language="forml"
          filename="password-field.forml"
        />

        <Callout type="warning">
          <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">min</code> / <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">max</code> apply to numeric values only.
          Applying them to a <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">text</code> field is a semantic error and will be flagged by the analyzer.
          Use <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">minLength</code> / <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">maxLength</code> for strings.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex items-center justify-between">
          <Link href="/docs/fields" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Fields &amp; Types
          </Link>
          <Link href="/docs/actions" className="text-sm text-foreground hover:underline underline-offset-4">
            Actions &amp; Triggers →
          </Link>
        </div>
      </article>
    </div>
  );
}
