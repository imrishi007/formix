import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";

export const metadata: Metadata = {
  title: "Actions & Triggers — Formix Docs",
  description: "Reference for Forml action_block, trigger_block, event types, and action statements.",
};

export default function ActionsPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Dynamic Behavior" }, { label: "Actions & Triggers" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Dynamic Behavior
          </span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-6 leading-[1.05]">
          Actions &amp; Triggers
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          Forml has a built-in event model. Fields and pages can emit side effects —
          <em> hide, show, clear, set, navigate, submit</em> — on lifecycle events without any custom
          JavaScript.
        </p>

        {/* action_block */}
        <h2 className="text-2xl font-display tracking-tight mt-8 mb-4">Submit Action</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The <code className="font-mono text-sm bg-foreground/[0.06] px-1 py-0.5">action submit {"{ }"}</code> block at the end of a{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1 py-0.5">form</code> routes the final JSON payload to a backend endpoint.
        </p>

        <EbnfRule
          name="action_block"
          definition={`action_block = "action" "submit" "{"
               "endpoint" ":" STRING
               "method"   ":" ( "POST" | "PUT" | "PATCH" )
             "}" ;`}
        />

        <CodeBlock
          code={`action submit {
  endpoint: "https://api.formix.dev/feedback"
  method: POST
}`}
          language="forml"
        />

        {/* trigger_block */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Trigger Blocks</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          A trigger block attaches one or more action statements to a lifecycle event on a field or page.
        </p>

        <EbnfRule
          name="trigger_block"
          definition={`trigger_block    = "on" event_type "{" { action_statement } "}" ;
event_type       = "load" | "change" | "blur" | "submit" ;`}
        />

        {/* Events */}
        <div className="border border-foreground/10 divide-y divide-foreground/8 my-6">
          {[
            { event: "load", when: "When the field or page first mounts in the DOM" },
            { event: "change", when: "Whenever the field value changes (debounced)" },
            { event: "blur", when: "When the field loses focus" },
            { event: "submit", when: "Immediately before the form is submitted" },
          ].map(({ event, when }) => (
            <div key={event} className="flex items-start gap-6 px-5 py-3">
              <code className="font-mono text-sm text-foreground w-20 shrink-0">{event}</code>
              <span className="text-sm text-muted-foreground">{when}</span>
            </div>
          ))}
        </div>

        {/* action_statement */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Action Statements</h2>

        <EbnfRule
          name="action_statement"
          definition={`action_statement = "hide"     "(" IDENTIFIER ")"
               | "show"     "(" IDENTIFIER ")"
               | "clear"    "(" IDENTIFIER ")"
               | "set"      "(" IDENTIFIER "," value ")"
               | "navigate" "(" STRING ")"
               | "submit"   "(" ")" ;`}
        />

        <div className="border border-foreground/10 divide-y divide-foreground/8 my-6">
          {[
            { stmt: "hide(field)", desc: "Hides the named field from the form." },
            { stmt: "show(field)", desc: "Shows a previously hidden field." },
            { stmt: "clear(field)", desc: "Resets the field value to its default / empty." },
            { stmt: "set(field, value)", desc: "Programmatically sets a field to a specific value." },
            { stmt: "navigate(page)", desc: "Navigates to the named page in a multi-page form." },
            { stmt: "submit()", desc: "Programmatically submits the form." },
          ].map(({ stmt, desc }) => (
            <div key={stmt} className="flex items-start gap-6 px-5 py-3.5">
              <code className="font-mono text-sm text-foreground w-40 shrink-0">{stmt}</code>
              <span className="text-sm text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>

        {/* Example */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Full Example</h2>

        <CodeBlock
          code={`form "Job Application" {
  field country : select {
    option "United States"
    option "Canada"
    option "Other"
  }
  ui { label: "Country" }
  on change {
    // Auto-hide the state field if country is not US/Canada
    hide(state)
  }

  field state : text
    ui { label: "State / Province" }

  field resume : url
    ui { label: "Resume URL" }
    on blur {
      // Clear the field if it's not a valid Google Drive link
      // (handle further with pattern validation)
      set(status, "checking")
    }

  action submit {
    endpoint: "https://api.example.com/applications"
    method: POST
  }
}`}
          language="forml"
          filename="job-application.forml"
        />

        <Callout type="tip">
          Triggers replace custom JS event listeners. Because they are declared in the DSL, the
          Formix renderer can statically analyze them, batch DOM updates, and generate accurate
          dependency graphs for re-rendering.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex items-center justify-between">
          <Link href="/docs/validation" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Validation Rules
          </Link>
          <Link href="/docs/examples" className="text-sm text-foreground hover:underline underline-offset-4">
            Examples →
          </Link>
        </div>
      </article>
    </div>
  );
}
