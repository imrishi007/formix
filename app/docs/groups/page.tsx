import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Group Definitions — Formix Docs",
  description: "Define reusable field groups in Forml to build DRY (Don't Repeat Yourself) schemas.",
};

const GROUP_EXAMPLE = `// 1. Define the reusable group
group UserContactInfo {
  field email : email
    ui { label: "Contact Email" }
    validate { required }

  field phone : text
    ui { label: "Phone Number"  placeholder: "+1 (555) 000-0000" }
}

form "DRY Registration" {
  // 2. Reuse it inside sections or containers
  section "Primary Contact" {
    use UserContactInfo
  }

  section "Secondary / Emergency Contact" {
    field hasEmergency : boolean
      ui { label: "Add secondary contact details"  default: false }

    if hasEmergency == true {
      use UserContactInfo
    }
  }

  action submit {
    endpoint: "https://api.example.com/dry"
    method: POST
  }
}`;

export default function GroupsPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Reusability" }, { label: "Group Definitions" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Reusability</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Group Definitions</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Group definitions let you declare a reusable collection of fields once, and inject them multiple times inside sections or pages using the <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">use</code> keyword.
          This enforces schema consistency across different parts of your form.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="group_definition"
          definition={`group_definition = "group" IDENTIFIER "{" { field } "}" ;`}
          description="Declares a named reusable fields list"
        />
        <EbnfRule
          name="group_use"
          definition={`group_use        = "use" IDENTIFIER ;`}
          description="Injects a previously defined group's fields at the current position"
        />

        {/* Reusability Example */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Dry Forms Example</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Below, we define a <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">UserContactInfo</code> group containing two fields, and instantiate it twice under different conditions:
        </p>
        <CodeBlock code={GROUP_EXAMPLE} language="forml" filename="dry-registration.forml" />

        <Callout type="note">
          Groups do not create a nested JSON object namespace in the final submission.
          Instead, the compiler flattens the group fields at compile time.
          To keep identifiers unique, the parser automatically prefix-scopes repeated fields if nested in different sections, or delegates path mapping to the layout block bindings.
        </Callout>

        <Callout type="tip">
          Always define groups at the top level of the <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">.forml</code> file, prior to the main <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">form</code> definition.
          This keeps the compiler parser context neat and easy to follow.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/actions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Actions & Triggers</Link>
          <Link href="/docs/variables" className="text-sm text-foreground hover:underline underline-offset-4">Variables (var) →</Link>
        </div>
      </article>
    </div>
  );
}
