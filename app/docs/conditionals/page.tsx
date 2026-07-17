import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditionals — Formix Docs",
  description: "Conditionally show and hide fields in Forml using if/else blocks with comparison and boolean operators.",
};

const BASIC_IF = `form "Support Ticket" {
  field category : select {
    option "Bug Report"
    option "Feature Request"
    option "Billing"
    option "Other"
  }
  ui { label: "Category" }

  // Only show bug details when Bug Report is selected
  if category == "Bug Report" {
    field severity : radio {
      option "Critical"
      option "High"
      option "Medium"
      option "Low"
    }
    ui { label: "Severity" }

    field stepsToReproduce : text
      ui {
        label: "Steps to Reproduce"
        placeholder: "1. Open the app\n2. Click..."
      }
      validate { required  minLength: 20 }
  }

  field description : text
    ui { label: "Description" }
    validate { required }
}`;

const IF_ELSE = `form "Job Application" {
  field hasExperience : boolean
    ui { label: "Do you have relevant work experience?" }

  if hasExperience == true {
    field company : text
      ui { label: "Most Recent Company" }
      validate { required }

    field yearsExp : integer
      ui { label: "Years of Experience" }
      validate { required  min: 1 }
  } else {
    field motivation : text
      ui {
        label: "Why do you want this role?"
        helpText: "Tell us about your interest and transferable skills."
      }
      validate { required  minLength: 50 }
  }
}`;

const COMPOUND = `form "Travel Insurance" {
  field age : integer
    ui { label: "Your Age" }
    validate { required  min: 18  max: 99 }

  field destination : select {
    option "Europe"
    option "North America"
    option "Asia"
    option "Rest of World"
  }
  ui { label: "Destination" }

  // Compound condition: seniors travelling outside Europe
  if age >= 65 && destination != "Europe" {
    field medicalDeclaration : boolean
      ui { label: "I declare I have no pre-existing medical conditions" }
      validate { required }

    field emergencyContact : text
      ui { label: "Emergency Contact Number" }
      validate { required }
  }

  // OR condition: high-risk destinations regardless of age
  if destination == "Asia" || destination == "Rest of World" {
    field vaccinationProof : url
      ui {
        label: "Vaccination Certificate URL"
        helpText: "Link to your WHO vaccination card"
      }
  }
}`;

export default function ConditionalsPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Dynamic Behavior" }, { label: "Conditionals" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Dynamic Behavior</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Conditionals</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Forml&apos;s <code className="font-mono text-base bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">if</code> block dynamically shows or hides
          entire groups of fields based on other field values — without any JavaScript. The WASM compiler builds a dependency graph
          at parse time so the renderer knows exactly which fields to re-evaluate on change.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="conditional"
          definition={`conditional  = "if" condition "{" { statement } "}"
               [ "else" "{" { statement } "}" ] ;`}
        />
        <EbnfRule
          name="condition"
          definition={`condition    = logic_term { "||" logic_term } ;
logic_term   = logic_factor { "&&" logic_factor } ;
logic_factor = simple_condition | "(" condition ")" ;`}
          description="Boolean precedence: || < && < parentheses"
        />
        <EbnfRule
          name="simple_condition"
          definition={`simple_condition = IDENTIFIER comparator value ;
comparator       = "==" | "!=" | "<" | ">" | "<=" | ">=" ;`}
          description="Left-hand side must be an existing field identifier"
        />

        {/* Operators */}
        <div className="border border-foreground/10 divide-y divide-foreground/8 mt-6 mb-10">
          {[
            { op: "==", meaning: "Equal to — works with strings, numbers, booleans" },
            { op: "!=", meaning: "Not equal to" },
            { op: "<  >", meaning: "Less than / greater than — numeric fields only" },
            { op: "<= >=", meaning: "Less/greater than or equal — numeric fields only" },
            { op: "&&", meaning: "Logical AND — both conditions must be true" },
            { op: "||", meaning: "Logical OR — at least one condition must be true" },
          ].map(({ op, meaning }) => (
            <div key={op} className="flex gap-6 px-5 py-3">
              <code className="font-mono text-sm text-foreground w-16 shrink-0">{op}</code>
              <p className="text-sm text-muted-foreground">{meaning}</p>
            </div>
          ))}
        </div>

        {/* Basic if */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Basic conditional</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Show additional fields only when a specific option is selected:
        </p>
        <CodeBlock code={BASIC_IF} language="forml" filename="support-ticket.forml" />

        {/* if/else */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">if / else branches</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Use <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">else {"{ }"}</code> to show different fields
          depending on which branch is active:
        </p>
        <CodeBlock code={IF_ELSE} language="forml" filename="job-application.forml" />

        {/* Compound */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Compound conditions</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Combine conditions with <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">&&</code> and{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">||</code>. Operator precedence:
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm mx-1">&&</code> binds tighter than
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm mx-1">||</code>:
        </p>
        <CodeBlock code={COMPOUND} language="forml" filename="travel-insurance.forml" />

        <Callout type="important">
          The left-hand side of every <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">simple_condition</code> must be a declared field IDENTIFIER.
          You cannot reference an undeclared identifier — doing so produces a parse error.
        </Callout>

        <Callout type="note">
          Conditionals only affect <strong>visibility</strong> — hidden fields are excluded from the submitted JSON payload automatically.
          You do not need to write any cleanup logic.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/layout" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Layout Blocks</Link>
          <Link href="/docs/compute" className="text-sm text-foreground hover:underline underline-offset-4">Compute Expressions →</Link>
        </div>
      </article>
    </div>
  );
}
