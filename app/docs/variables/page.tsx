import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Variables — Formix Docs",
  description: "Define global constants in Forml to store config values, endpoint URLs, and calculation coefficients.",
};

const VAR_EXAMPLE = `form "Calculation Variables" {
  // Global constant definitions
  var vatCoefficient = 1.20 ;
  var apiHost = "https://api.formix.dev/v1" ;

  field basePrice : float
    ui { label: "Net Price ($)"  default: 100.0 }

  field grossPrice : float
    compute = basePrice * vatCoefficient
    ui { label: "Price with VAT ($)" }

  action submit {
    endpoint: apiHost
    method: POST
  }
}`;

export default function VariablesPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Reusability" }, { label: "Variables (var)" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Reusability</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Variables (var)</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Variables in Forml declare compile-time constants.
          They are ideal for holding magic numbers, mathematical factors, API domain paths, or default options lists to keep configurations clean and easily modifiable.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="var_declaration"
          definition={`var_declaration = "var" IDENTIFIER "=" value ";" ;`}
          description="Declares a variable key bound to a literal value, terminated by a semicolon"
        />

        {/* Example */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Constant Variable Example</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          In this example, we declare a VAT tax factor and an API endpoint path at the top of the form scope, referencing them inside field math calculations and action submit blocks:
        </p>
        <CodeBlock code={VAR_EXAMPLE} language="forml" filename="calc-vars.forml" />

        <Callout type="important">
          Forml variables are **constants** — they cannot be reassigned dynamically during runtime.
          Their values are read-only and static once evaluated by the compiler parse phase.
        </Callout>

        <Callout type="note">
          Variables can hold strings, integers, floats, or booleans.
          They are resolved inline by the WASM compiler wherever referenced, meaning they do not clutter the final JSON AST structure.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/groups" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Group Definitions</Link>
          <Link href="/docs/pages" className="text-sm text-foreground hover:underline underline-offset-4">Multi-Page Forms →</Link>
        </div>
      </article>
    </div>
  );
}
