import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compute Expressions — Formix Docs",
  description: "Calculate values dynamically in Forml using arithmetic expressions and operator precedence.",
};

const BASIC_COMPUTE = `form "Simple Calculator" {
  field quantity : integer
    ui { label: "Quantity"  default: 1 }
    validate { required  min: 1 }

  field unitPrice : float
    ui { label: "Unit Price ($)"  default: 10.0 }
    validate { required  min: 0 }

  field total : float
    compute = quantity * unitPrice
    ui { label: "Total Price ($)" }
}`;

const COMPLEX_COMPUTE = `form "Order Checkout" {
  field quantity : integer
    ui { label: "Quantity"  default: 2 }

  field unitPrice : float
    ui { label: "Unit Price ($)"  default: 49.99 }

  field discountPercentage : float
    ui { label: "Discount (%)"  default: 10 }
    validate { min: 0  max: 100 }

  field taxRate : float
    ui { label: "Tax Rate (%)"  default: 8 }

  // Nested math expressions
  field subtotal : float
    compute = quantity * unitPrice * (1 - discountPercentage / 100)
    ui { label: "Subtotal" }

  field taxAmount : float
    compute = subtotal * taxRate / 100
    ui { label: "Tax Amount" }

  field total : float
    compute = subtotal + taxAmount
    ui { label: "Grand Total" }
}`;

export default function ComputePage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Dynamic Behavior" }, { label: "Compute Expressions" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Dynamic Behavior</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Compute Expressions</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Forml enables you to calculate values dynamically using arithmetic expressions.
          Computed fields automatically re-evaluate when any of their source dependencies change.
          This is useful for shopping carts, pricing calculators, financial forms, and scorecards.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="compute_block"
          definition={`compute_block = "compute" "=" expression ;`}
        />
        <EbnfRule
          name="expression"
          definition={`expression    = math_term { ( "+" | "-" ) math_term } ;
math_term     = math_factor { ( "*" | "/" ) math_factor } ;
math_factor   = IDENTIFIER | NUMBER | "(" expression ")" ;`}
          description="Arithmetic rules supporting standard operator precedence (PEMDAS/BODMAS)"
        />

        {/* Basic Compute */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Basic Computation</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          A field with a <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">compute</code> directive will make itself read-only in the UI
          and derive its value from the specified expression.
        </p>
        <CodeBlock code={BASIC_COMPUTE} language="forml" filename="simple-calculator.forml" />

        {/* Complex Expressions */}
        <h2 className="text-2xl font-display tracking-tight mt-12 mb-4">Operator Precedence & Parentheses</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Forml supports addition (<code className="font-mono text-sm">+</code>), subtraction (<code className="font-mono text-sm">-</code>),
          multiplication (<code className="font-mono text-sm">*</code>), and division (<code className="font-mono text-sm">/</code>).
          Parentheses can be used to override default operator precedence:
        </p>
        <CodeBlock code={COMPLEX_COMPUTE} language="forml" filename="checkout.forml" />

        <Callout type="important">
          All identifiers in a compute expression must reference existing fields of numeric types (<code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">integer</code> or <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">float</code>), or global numeric variables.
          Referencing a string, boolean, or select field will raise a validation error in the compiler.
        </Callout>

        <Callout type="note">
          Computed fields are automatically locked to read-only in the generated form.
          The calculated value is serialized into the final JSON submit payload exactly like normal user inputs.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/conditionals" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Conditionals</Link>
          <Link href="/docs/repeat" className="text-sm text-foreground hover:underline underline-offset-4">Repeat Groups →</Link>
        </div>
      </article>
    </div>
  );
}
