import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Multi-Page Forms — Formix Docs",
  description: "Learn how to build multi-page wizards in Forml using the page block and navigation triggers.",
};

const PAGES_WIZARD = `form "Multi-Step Survey" {
  page "Welcome" {
    field participantName : text
      ui { label: "Please enter your name" }
      validate { required }

    on submit {
      navigate("Step 2")
    }
  }

  page "Step 2" {
    field feedback : text
      ui { label: "What is your main feedback?" }
      validate { required  minLength: 10 }

    on submit {
      navigate("Step 3")
    }
  }

  page "Step 3" {
    field newsletterOptIn : boolean
      ui { label: "Sign up for our newsletter"  default: false }
  }

  action submit {
    endpoint: "https://api.example.com/survey"
    method: POST
  }
}`;

export default function PagesDoc() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Reusability" }, { label: "Multi-Page Forms" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Reusability</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Multi-Page Forms</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Forml natively supports step-by-step layout flow structures.
          By splitting forms into multiple <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">page</code> blocks,
          you can design lightweight visual step-wizards that simplify long forms and boost user completion.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="page"
          definition={`page = "page" STRING "{"
       { statement }
       [ trigger_block ]
     "}" ;`}
          description="Renders as an isolated sub-view in the multi-step layout"
        />

        {/* Wizard Example */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Multi-Step Form Wizard</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          In this multi-step example, we build a 3-step feedback flow, routing progress using the <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">navigate()</code> action statement:
        </p>
        <CodeBlock code={PAGES_WIZARD} language="forml" filename="multi-step-survey.forml" />

        <Callout type="note">
          Page transitions are validated client-side. The renderer automatically runs field verification rules for the active page before executing page-transition triggers.
          This prevents users from advancing with invalid or incomplete data.
        </Callout>

        <Callout type="tip">
          The string title argument in the <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">page</code> block defines the step indicator label in the wizard header.
          Use short, action-oriented titles (e.g. &quot;Contact&quot;, &quot;Payment&quot;) to keep step navigation clear.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/variables" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Variables (var)</Link>
          <Link href="/docs/sources" className="text-sm text-foreground hover:underline underline-offset-4">Data Sources →</Link>
        </div>
      </article>
    </div>
  );
}
