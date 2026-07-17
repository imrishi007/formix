import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quick Start — Formix Docs",
  description: "Build and render your first Forml form in under 5 minutes.",
};

const STEP1 = `form "Hello World" {
  field name : text
    ui { label: "Your Name"  placeholder: "Jane Doe" }
    validate { required }

  field message : text
    ui {
      label: "Message"
      placeholder: "Say something..."
      helpText: "Keep it under 200 characters."
    }
    validate { required  maxLength: 200 }

  action submit {
    endpoint: "https://httpbin.org/post"
    method: POST
  }
}`;

const STEP2 = `form "Contact Form" {
  field firstName : text
    ui { label: "First Name" }
    validate { required  minLength: 2 }

  field lastName : text
    ui { label: "Last Name" }
    validate { required  minLength: 2 }

  field email : email
    ui { label: "Work Email" }
    validate { required }

  field phone : text
    ui { label: "Phone"  placeholder: "+1 (555) 000-0000" }

  field reason : select {
    option "Sales inquiry"
    option "Technical support"
    option "Partnership"
    option "Other"
  }
  ui { label: "Reason for contact" }

  field message : text
    ui {
      label: "Message"
      helpText: "Tell us how we can help."
    }
    validate { required  minLength: 20  maxLength: 1000 }

  field subscribe : boolean
    ui { label: "Subscribe to product updates" }
    ui { default: false }

  action submit {
    endpoint: "https://api.example.com/contact"
    method: POST
  }
}`;

export default function QuickStartPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Getting Started" }, { label: "Quick Start" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Getting Started</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Quick Start</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-12">
          Build and render your first form in under 5 minutes. No installation, no dependencies — just open the editor and write Forml.
        </p>

        {/* Step 1 */}
        <div className="mb-14">
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-mono font-medium shrink-0">1</span>
            <h2 className="text-xl font-display tracking-tight">Open the editor</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-4 ml-11">
            Navigate to the{" "}
            <Link href="/editor/demo" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
              Formix Editor
            </Link>
            . You&apos;ll see a Monaco-based IDE on the left, a real-time form preview on the right, and a JSON AST panel below. The editor pre-loads a sample form — clear it and write your own.
          </p>
          <Callout type="tip">
            The compiler runs entirely in your browser via WebAssembly. Parse results appear within ~4ms of each keystroke — no server round-trips.
          </Callout>
        </div>

        {/* Step 2 */}
        <div className="mb-14">
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-mono font-medium shrink-0">2</span>
            <h2 className="text-xl font-display tracking-tight">Write your first form</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-4 ml-11">
            Every Forml file starts with a <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">form</code> block. Paste this into the editor:
          </p>
          <CodeBlock code={STEP1} language="forml" filename="hello-world.forml" />
          <p className="text-sm text-muted-foreground mt-4">
            The right panel immediately renders a live form with a text input, a message area, and a submit button. The AST panel shows the parsed JSON tree.
          </p>
        </div>

        {/* Step 3 */}
        <div className="mb-14">
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-mono font-medium shrink-0">3</span>
            <h2 className="text-xl font-display tracking-tight">Understand the structure</h2>
          </div>
          <div className="ml-11">
            <p className="text-muted-foreground leading-relaxed mb-6">
              Every field follows this pattern:
            </p>
            <CodeBlock
              code={`field <identifier> : <type>
  ui { <presentation rules> }
  validate { <constraints> }`}
              language="ebnf"
              showLineNumbers={false}
            />
            <div className="border border-foreground/10 divide-y divide-foreground/8 mt-4">
              {[
                { part: "identifier", desc: "A camelCase or snake_case name with no spaces. Used as the JSON key in the submitted payload." },
                { part: "type", desc: "One of: text, integer, float, email, date, boolean, url, select, radio, checkbox." },
                { part: "ui { }", desc: "Optional. Controls how the field looks: label, placeholder, helpText, default." },
                { part: "validate { }", desc: "Optional. Constraints: required, min, max, minLength, maxLength, pattern." },
              ].map(({ part, desc }) => (
                <div key={part} className="flex gap-4 px-4 py-3">
                  <code className="font-mono text-sm text-foreground shrink-0 w-28">{part}</code>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="mb-14">
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-mono font-medium shrink-0">4</span>
            <h2 className="text-xl font-display tracking-tight">Build a real contact form</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-4 ml-11">
            Now try something more complete. This contact form demonstrates dropdowns, boolean toggles, and an action block:
          </p>
          <CodeBlock code={STEP2} language="forml" filename="contact.forml" />
        </div>

        {/* Step 5 */}
        <div className="mb-14">
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-mono font-medium shrink-0">5</span>
            <h2 className="text-xl font-display tracking-tight">Submit and inspect</h2>
          </div>
          <div className="ml-11">
            <p className="text-muted-foreground leading-relaxed mb-4">
              Click <strong className="text-foreground font-medium">Submit</strong> in the form preview. Formix serialises the field values into a JSON payload matching the AST structure and sends a POST request to the endpoint you declared:
            </p>
            <CodeBlock
              code={`{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+1 555 000 0000",
  "reason": "Technical support",
  "message": "I need help with...",
  "subscribe": false
}`}
              language="json"
              filename="payload.json"
            />
            <Callout type="note">
              The JSON keys are exactly the field identifiers you declared in the <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">form</code> block. Rename a field name and the key changes automatically — no manual schema maintenance.
            </Callout>
          </div>
        </div>

        {/* Next steps */}
        <div className="mt-16 pt-8 border-t border-foreground/10">
          <h2 className="text-xl font-display tracking-tight mb-6">Next steps</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { href: "/docs/fields", title: "Fields & Types", desc: "All 10 field types in detail" },
              { href: "/docs/validation", title: "Validation", desc: "Constraints and error messages" },
              { href: "/docs/conditionals", title: "Conditionals", desc: "Show/hide fields based on values" },
              { href: "/docs/examples", title: "Examples", desc: "Complete real-world forms" },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="group flex flex-col gap-1 p-4 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all rounded-sm">
                <span className="font-medium text-sm text-foreground">{c.title} →</span>
                <span className="text-xs text-muted-foreground">{c.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
