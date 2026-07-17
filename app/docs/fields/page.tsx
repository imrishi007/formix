import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";

export const metadata: Metadata = {
  title: "Fields & Types — Formix Docs",
  description: "All supported field types in Forml: text, email, integer, float, boolean, date, url, select, radio, checkbox.",
};

const fieldTypes = [
  {
    type: "text",
    description: "Single-line free text. Use for names, descriptions, short answers.",
    example: `field username : text
  ui { label: "Username"  placeholder: "e.g. j_doe" }
  validate { required  minLength: 3  maxLength: 20 }`,
  },
  {
    type: "email",
    description: "Email address input. The renderer validates email format automatically.",
    example: `field contactEmail : email
  ui { label: "Work Email" }
  validate { required }`,
  },
  {
    type: "integer",
    description: "Whole numbers only. Validated against min/max constraints.",
    example: `field age : integer
  ui { label: "Age" }
  validate { min: 18  max: 120 }`,
  },
  {
    type: "float",
    description: "Decimal numbers. Common for monetary values, measurements.",
    example: `field price : float
  ui { label: "Unit Price ($)" }
  validate { min: 0 }`,
  },
  {
    type: "boolean",
    description: "Renders as a checkbox. Value is true or false.",
    example: `field agree : boolean
  ui { label: "I agree to the Terms of Service" }
  validate { required }`,
  },
  {
    type: "date",
    description: "Date picker. Value is an ISO 8601 date string (YYYY-MM-DD).",
    example: `field dob : date
  ui { label: "Date of Birth" }
  validate { required }`,
  },
  {
    type: "url",
    description: "URL input. The renderer validates that the value is a well-formed URL.",
    example: `field website : url
  ui { label: "Website"  placeholder: "https://" }`,
  },
  {
    type: "select",
    description: "Dropdown list. Options are either hardcoded or loaded dynamically via source_block.",
    example: `field country : select {
  option "United States"
  option "United Kingdom"
  option "India"
}
ui { label: "Country" }`,
  },
  {
    type: "radio",
    description: "Radio button group. Like select, but renders all options visibly.",
    example: `field plan : radio {
  option "Free"
  option "Pro"
  option "Team"
}
ui { label: "Plan" }`,
  },
  {
    type: "checkbox",
    description: "Checkbox group allowing multiple selections.",
    example: `field interests : checkbox {
  option "Frontend"
  option "Backend"
  option "DevOps"
  option "AI/ML"
}
ui { label: "Areas of Interest" }`,
  },
];

export default function FieldsPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Language Reference" }, { label: "Fields & Types" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Language Reference
          </span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-6 leading-[1.05]">
          Fields &amp; Types
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          Every field in Forml has a <strong className="text-foreground font-medium">name</strong> and a <strong className="text-foreground font-medium">type</strong>.
          The type determines what data is captured, how it is validated, and how it is rendered.
        </p>

        <CodeBlock
          code={`field <name> : <type>
  [ ui { ... } ]
  [ validate { ... } ]
  [ compute = <expression> ]
  [ on <event> { ... } ]`}
          language="ebnf"
        />

        <Callout type="note">
          The <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">ui</code>, <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">validate</code>,{" "}
          <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">compute</code>, and <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">on</code> blocks are all optional. The minimal valid field
          is <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">field myField : text</code>.
        </Callout>

        <h2 className="text-2xl font-display tracking-tight mt-14 mb-8">
          All Field Types
        </h2>

        <div className="space-y-10">
          {fieldTypes.map((ft) => (
            <div key={ft.type} id={ft.type} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-3">
                <code className="font-mono text-base font-medium text-foreground bg-foreground/[0.06] border border-foreground/10 px-3 py-1.5 rounded-sm">
                  {ft.type}
                </code>
                <span className="text-sm text-muted-foreground">{ft.description}</span>
              </div>
              <CodeBlock code={ft.example} language="forml" />
            </div>
          ))}
        </div>

        {/* Dynamic options */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">
          Dynamic Options (source_block)
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Instead of hardcoding options, you can load them from a REST endpoint or a{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1 py-0.5">var</code> declaration:
        </p>

        <CodeBlock
          code={`var countries = "https://api.example.com/countries" ;

field country : select
  from url "https://api.example.com/countries"
  map { label: name, value: code }
  ui { label: "Country" }

// Or from a var
field country2 : select
  from var countries
  map { label: name, value: code }`}
          language="forml"
          filename="dynamic-options.forml"
        />

        <div className="mt-16 pt-8 border-t border-foreground/10 flex items-center justify-between">
          <Link href="/docs/grammar" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← EBNF Grammar
          </Link>
          <Link href="/docs/validation" className="text-sm text-foreground hover:underline underline-offset-4">
            Validation Rules →
          </Link>
        </div>
      </article>
    </div>
  );
}
