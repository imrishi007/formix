import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Introduction — Formix Docs",
  description: "Get started with Formix and the Forml DSL — Forms as Code.",
};

const HELLO_FORML = `form "Customer Feedback" {
  field name : text
    ui { label: "Your Name"  placeholder: "Jane Doe" }
    validate { required  minLength: 2 }

  field email : email
    ui { label: "Email Address" }
    validate { required }

  field rating : select {
    option "Excellent"
    option "Good"
    option "Needs Work"
  }
  ui { label: "Overall Rating" }

  action submit {
    endpoint: "https://api.formix.dev/feedback"
    method: POST
  }
}`;

export default function IntroductionPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Introduction" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Getting Started
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-6 leading-[1.05]">
          What is Formix?
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          Formix is a{" "}
          <strong className="text-foreground font-medium">Forms as Code</strong>{" "}
          platform. Instead of building forms in a drag-and-drop GUI or manually
          writing hundreds of lines of React, you define your entire form in a
          clean, human-readable DSL called{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">
            Forml
          </code>
          .
        </p>

        <p className="text-muted-foreground leading-relaxed mb-12">
          Forml files are plain text. They live in your Git repository alongside
          your source code. They&apos;re diffable, reviewable, and CI-testable.
          The Formix compiler — a hand-written C++ recursive-descent parser
          compiled to WebAssembly — turns your{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">
            .forml
          </code>{" "}
          file into a JSON AST entirely in the browser with zero network
          latency, then React walks that AST and renders a live interactive
          form.
        </p>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 gap-px bg-foreground/10 border border-foreground/10 mb-12">
          {[
            {
              title: "Forml DSL",
              body: "A purpose-built language with fields, types, validation, conditionals, repeat groups, and actions.",
            },
            {
              title: "WASM Compiler",
              body: "Hand-written C++ parser compiled to WebAssembly runs entirely client-side with 4ms average parse time.",
            },
            {
              title: "JSON AST",
              body: "A clean, typed abstract syntax tree you can inspect, store, or pipe into any renderer or backend.",
            },
            {
              title: "Git-Native",
              body: "One .forml file = one form = one commit. Diff your forms, branch them, and PR them like any code.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-background p-6">
              <h3 className="font-medium mb-2 text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* Hello World */}
        <h2 className="text-2xl font-display tracking-tight mb-4">
          Your first Forml form
        </h2>

        <p className="text-muted-foreground leading-relaxed mb-4">
          Here&apos;s a complete customer feedback form. Save it as{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">
            feedback.forml
          </code>
          , open the editor, and see it render instantly:
        </p>

        <CodeBlock
          code={HELLO_FORML}
          language="forml"
          filename="feedback.forml"
        />

        <Callout type="tip">
          Open the{" "}
          <Link href="/editor/demo" className="underline underline-offset-2">
            live editor
          </Link>{" "}
          and paste this code to see the form rendered in real-time alongside
          the JSON AST output.
        </Callout>

        {/* Core concepts */}
        <h2 className="text-2xl font-display tracking-tight mb-6 mt-12">
          Core concepts
        </h2>

        <div className="space-y-4">
          {[
            {
              term: "form",
              def: "The root of every Forml file. Contains fields, sections, pages, group definitions, variable declarations, and an action block.",
            },
            {
              term: "field",
              def: 'A data-capture element with a name, type, optional UI configuration, validation rules, and triggers. e.g. field email : email',
            },
            {
              term: "ui { }",
              def: "The presentation layer of a field. Set the label, placeholder, help text, default value, or two-way data binding.",
            },
            {
              term: "validate { }",
              def: "Constraints enforced before submission: required, min, max, minLength, maxLength, pattern.",
            },
            {
              term: "if / else",
              def: "Conditionally include or exclude fields based on other field values. Supports ==, !=, <, >, <=, >= and boolean operators && / ||.",
            },
            {
              term: "action submit { }",
              def: "Declares the endpoint and HTTP method for form submission. Formix serialises the form data and POSTs the JSON payload.",
            },
          ].map(({ term, def }) => (
            <div key={term} className="flex gap-4 py-4 border-b border-foreground/8">
              <code className="font-mono text-sm text-foreground shrink-0 w-28 pt-0.5">
                {term}
              </code>
              <p className="text-sm text-muted-foreground leading-relaxed">{def}</p>
            </div>
          ))}
        </div>

        {/* Next steps */}
        <div className="mt-16 pt-8 border-t border-foreground/10">
          <h2 className="text-xl font-display tracking-tight mb-6">
            Next steps
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                href: "/docs/grammar",
                title: "EBNF Grammar",
                desc: "The full formal grammar for Forml v1.1",
              },
              {
                href: "/docs/fields",
                title: "Fields & Types",
                desc: "All supported field types and their options",
              },
              {
                href: "/docs/validation",
                title: "Validation Rules",
                desc: "required, min, max, pattern and more",
              },
              {
                href: "/docs/actions",
                title: "Actions & Triggers",
                desc: "Submit, hide, show, navigate and lifecycle events",
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col gap-1 p-4 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all rounded-sm"
              >
                <span className="flex items-center gap-2 font-medium text-sm text-foreground">
                  {card.title}
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
                <span className="text-xs text-muted-foreground">{card.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
