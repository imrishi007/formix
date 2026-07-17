import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UI Blocks — Formix Docs",
  description: "Reference for the ui { } block: label, placeholder, helpText, default, bind.",
};

const UI_FULL = `form "Product Review" {
  field rating : select {
    option "5 — Excellent"
    option "4 — Good"
    option "3 — Average"
    option "2 — Poor"
    option "1 — Terrible"
  }
  ui {
    label: "Overall Rating"
    helpText: "How would you rate this product overall?"
    default: "5 — Excellent"
  }

  field title : text
    ui {
      label: "Review Title"
      placeholder: "Summarise your experience in a sentence"
      helpText: "Max 100 characters"
    }
    validate { required  maxLength: 100 }

  field body : text
    ui {
      label: "Full Review"
      placeholder: "Tell others what you liked or disliked..."
      helpText: "Min 50 characters for a helpful review"
    }
    validate { required  minLength: 50 }

  field recommend : boolean
    ui {
      label: "I would recommend this product"
      default: true
    }

  action submit {
    endpoint: "https://api.example.com/reviews"
    method: POST
  }
}`;

const BIND_EXAMPLE = `form "Live Preview" {
  var previewTarget = "outputDisplay" ;

  field firstName : text
    ui {
      label: "First Name"
      bind: "user.firstName"
    }

  field lastName : text
    ui {
      label: "Last Name"
      bind: "user.lastName"
    }
}`;

export default function UIBlocksPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Language Reference" }, { label: "UI Blocks" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Language Reference</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">UI Blocks</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          The <code className="font-mono text-base bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">ui {"{ }"}</code> block is the presentation layer of a field.
          It controls what the user sees: labels, placeholder text, helper copy, default values, and data binding.
          Every rule inside it is optional.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>

        <EbnfRule
          name="ui_block"
          definition={`ui_block = "ui" "{" { ui_rule } "}" ;

ui_rule  = "label"       ":" STRING
         | "placeholder" ":" STRING
         | "helpText"    ":" STRING
         | "default"     ":" value
         | "bind"        ":" STRING ;`}
        />

        {/* Rules table */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Rules Reference</h2>
        <div className="border border-foreground/10 divide-y divide-foreground/8">
          {[
            {
              rule: "label",
              type: "STRING",
              desc: "The visible label above or beside the input. If omitted, the renderer may fall back to the field identifier.",
              example: `label: "Email Address"`,
            },
            {
              rule: "placeholder",
              type: "STRING",
              desc: "Ghost text shown inside the input when empty. Only applies to text-based field types.",
              example: `placeholder: "you@company.com"`,
            },
            {
              rule: "helpText",
              type: "STRING",
              desc: "Small helper copy displayed below the input. Use for format hints, constraints, or context.",
              example: `helpText: "We'll never share your email."`,
            },
            {
              rule: "default",
              type: "value",
              desc: "Pre-fills the field with an initial value. Accepts STRING, NUMBER, true, false, or an IDENTIFIER referencing a var.",
              example: `default: true\ndefault: "United Kingdom"\ndefault: 0`,
            },
            {
              rule: "bind",
              type: "STRING",
              desc: "Dot-notation path for two-way data binding to external application state (e.g. a React context or Zustand store).",
              example: `bind: "user.profile.email"`,
            },
          ].map(({ rule, type, desc, example }) => (
            <div key={rule} className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <code className="font-mono text-sm font-medium text-foreground">{rule}</code>
                <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/30 border border-foreground/10 px-2 py-0.5">{type}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{desc}</p>
              <CodeBlock code={example} language="forml" showLineNumbers={false} />
            </div>
          ))}
        </div>

        {/* Full example */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Full example</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          A product review form using all UI rules:
        </p>
        <CodeBlock code={UI_FULL} language="forml" filename="product-review.forml" />

        {/* Bind */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Data binding with <code className="font-mono">bind</code></h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">bind</code> property enables two-way synchronization between a
          Forml field and an external JavaScript object using dot-notation paths. When the field value changes, the bound path is
          updated, and vice-versa.
        </p>
        <CodeBlock code={BIND_EXAMPLE} language="forml" filename="live-preview.forml" />

        <Callout type="note">
          <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">bind</code> is a renderer hint — its exact behavior depends on the
          JavaScript runtime embedding Formix. The WASM compiler includes the bind path in the AST node so the renderer can wire it up.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/fields" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Fields & Types</Link>
          <Link href="/docs/validation" className="text-sm text-foreground hover:underline underline-offset-4">Validation Rules →</Link>
        </div>
      </article>
    </div>
  );
}
