import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Sources — Formix Docs",
  description: "Load options dynamically from external APIs and variables in Forml select, radio, and checkbox fields.",
};

const DYNAMIC_LOAD_EXAMPLE = `form "Dynamic Form" {
  var staticList = "https://api.formix.dev/v1/countries" ;

  // 1. Loading options from an API url
  field countryCode : select
    from url "https://restcountries.com/v3.1/all"
    map { label: name, value: cca2 }
    ui { label: "Country"  placeholder: "Select country" }

  // 2. Loading options from a pre-declared var source
  field regionCode : select
    from var staticList
    map { label: regionName, value: id }
    ui { label: "Region" }

  action submit {
    endpoint: "https://api.example.com/save"
    method: POST
  }
}`;

export default function SourcesPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Reusability" }, { label: "Data Sources" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Reusability</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Data Sources</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Forml enables fields containing option lists (<code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">select</code>,
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">radio</code>, or <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">checkbox</code>)
          to load choices dynamically from REST APIs or variable arrays instead of hardcoding option statements.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="select_type"
          definition={`select_type  = ( "select" | "radio" | "checkbox" )
               ( "{" option { option } "}" | source_block ) ;`}
          description="A selection field can have a block of static options or a dynamic source block"
        />
        <EbnfRule
          name="source_block"
          definition={`source_block = "from" ( "url" STRING | "var" IDENTIFIER )
               [ "map" "{" "label" ":" IDENTIFIER ","
               "value" ":" IDENTIFIER "}" ] ;`}
          description="Points to an external URL or internal variable list, with optional key mappings"
        />

        {/* Example */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Dynamic Option Loading</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          In this example, option lists are populated dynamically at runtime using URL fetch endpoints and variables:
        </p>
        <CodeBlock code={DYNAMIC_LOAD_EXAMPLE} language="forml" filename="dynamic-sources.forml" />

        <Callout type="note">
          The <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">map</code> construct acts as a translator.
          If your API returns a list of objects like <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">{"{ \"cca2\": \"IN\", \"name\": \"India\" }"}</code>,
          specifying <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">map {"{ label: name, value: cca2 }"}</code> instructs the renderer how to bind the values.
        </Callout>

        <Callout type="important">
          If dynamic API fetches fail, the fields will render as disabled or show empty loading indicators, depending on the frontend renderer&apos;s fallback strategy.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/pages" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Multi-Page Forms</Link>
          <Link href="/docs/examples" className="text-sm text-foreground hover:underline underline-offset-4">Examples →</Link>
        </div>
      </article>
    </div>
  );
}
