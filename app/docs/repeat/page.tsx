import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Repeat Groups — Formix Docs",
  description: "Dynamically duplicate field sections in Forml using repeat blocks.",
};

const REPEAT_EXAMPLE = `form "Family Registration" {
  field numChildren : integer
    ui {
      label: "Number of Children"
      placeholder: "0"
      default: 0
    }
    validate { min: 0  max: 10 }

  // Unrolls fields dynamically based on the field above
  repeat count = numChildren {
    field childName : text
      ui { label: "Child's Full Name" }
      validate { required }

    field childAge : integer
      ui { label: "Age" }
      validate { required  min: 0  max: 18 }
  }

  action submit {
    endpoint: "https://api.example.com/family"
    method: POST
  }
}`;

export default function RepeatPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Dynamic Behavior" }, { label: "Repeat Groups" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Dynamic Behavior</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Repeat Groups</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Repeat groups allow sections of fields to be dynamically duplicated in the UI.
          The quantity of sections generated is determined by a separate control field.
          This is ideal for listing dependents, listing experience line items, or adding dynamic line items.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="repeat_group"
          definition={`repeat_group = "repeat" "count" "=" IDENTIFIER "{" { field } "}" ;`}
          description="Renders the enclosed fields multiple times based on the value of the count identifier"
        />

        {/* Example */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Example usage</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          In this example, specifying <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">numChildren</code> will duplicate the
          children blocks on the page automatically:
        </p>
        <CodeBlock code={REPEAT_EXAMPLE} language="forml" filename="family.forml" />

        <Callout type="important">
          The <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">count</code> attribute must target a declared field of type <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">integer</code>.
          If the value of the count field is modified by the user, the layout list dynamically expands or contracts in real time.
        </Callout>

        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Payload Structure</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          When the form is submitted, the repeated fields are serialized as an array of objects inside the JSON payload, grouped under the repeat block:
        </p>
        <CodeBlock
          code={`{
  "numChildren": 2,
  "childName": ["Alice", "Bob"],
  "childAge": [6, 10]
}`}
          language="json"
          filename="submitted-data.json"
        />

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/compute" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Compute Expressions</Link>
          <Link href="/docs/actions" className="text-sm text-foreground hover:underline underline-offset-4">Actions & Triggers →</Link>
        </div>
      </article>
    </div>
  );
}
