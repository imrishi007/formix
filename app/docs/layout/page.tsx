import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Layout Blocks — Formix Docs",
  description: "Use row and column layout blocks to create multi-column form layouts without CSS.",
};

const ROW_EXAMPLE = `form "Personal Details" {
  // Two fields side by side
  row {
    field firstName : text
      ui { label: "First Name" }
      validate { required }

    field lastName : text
      ui { label: "Last Name" }
      validate { required }
  }

  // Three fields in a row
  row {
    field city : text
      ui { label: "City" }

    field state : text
      ui { label: "State" }

    field zip : text
      ui { label: "ZIP Code" }
      validate { pattern: "^\\d{5}(-\\d{4})?$" }
  }

  field email : email
    ui { label: "Email Address" }
    validate { required }

  action submit {
    endpoint: "https://api.example.com/profile"
    method: POST
  }
}`;

const COLUMN_EXAMPLE = `form "Settings" {
  section "Appearance" {
    column {
      field theme : radio {
        option "Light"
        option "Dark"
        option "System"
      }
      ui { label: "Theme" }

      field language : select {
        option "English"
        option "French"
        option "Spanish"
        option "German"
      }
      ui { label: "Language" }
    }
  }
}`;

const NESTED_EXAMPLE = `form "Invoice" {
  section "Line Items" {
    row {
      field itemName : text
        ui { label: "Item" }
        validate { required }

      field quantity : integer
        ui { label: "Qty" }
        validate { required  min: 1 }

      field unitPrice : float
        ui { label: "Unit Price ($)" }
        validate { required  min: 0 }

      field total : float
        compute = quantity * unitPrice
        ui { label: "Total" }
    }
  }

  row {
    field discount : float
      ui { label: "Discount (%)" }
      validate { min: 0  max: 100 }

    field taxRate : float
      ui { label: "Tax Rate (%)"  default: 20 }
  }
}`;

export default function LayoutPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Language Reference" }, { label: "Layout Blocks" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Language Reference</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Layout Blocks</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Forml has built-in layout primitives — <code className="font-mono text-base bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">row</code> and{" "}
          <code className="font-mono text-base bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">column</code> — that arrange fields in a grid without
          writing any CSS. The renderer translates them to the appropriate flexbox or grid layout automatically.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>
        <EbnfRule
          name="layout_block"
          definition={`layout_block = ( "row" | "column" ) "{" { statement } "}" ;`}
          description="Wraps any statements in a horizontal (row) or vertical (column) container"
        />

        <div className="border border-foreground/10 divide-y divide-foreground/8 mt-6 mb-10">
          {[
            { keyword: "row", desc: "Places child fields side-by-side horizontally. The renderer distributes space equally by default." },
            { keyword: "column", desc: "Places child fields vertically, stacked top-to-bottom. Useful for grouping within a section." },
          ].map(({ keyword, desc }) => (
            <div key={keyword} className="flex gap-6 px-5 py-3.5">
              <code className="font-mono text-sm text-foreground w-20 shrink-0">{keyword}</code>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Row */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Horizontal layout with <code className="font-mono">row</code></h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Use <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">row {"{ }"}</code> to place fields side-by-side.
          Particularly useful for name/surname, city/state/zip, or any logically paired inputs:
        </p>
        <CodeBlock code={ROW_EXAMPLE} language="forml" filename="personal-details.forml" />

        {/* Column */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Vertical layout with <code className="font-mono">column</code></h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Use <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">column {"{ }"}</code> to stack items explicitly
          within a horizontal parent, or to create a visually separated sub-group:
        </p>
        <CodeBlock code={COLUMN_EXAMPLE} language="forml" filename="settings.forml" />

        {/* Nesting */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Nesting layouts</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Layout blocks can be nested. The most common pattern is a <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">row</code> inside
          a <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">section</code>, combined with computed fields:
        </p>
        <CodeBlock code={NESTED_EXAMPLE} language="forml" filename="invoice.forml" />

        <Callout type="note">
          Layout blocks do not affect the JSON payload structure — field names remain flat regardless of nesting depth. Only the visual presentation changes.
        </Callout>

        {/* Responsive */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Responsive behaviour</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          By default, the Formix renderer collapses <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">row</code> blocks
          to a single column on narrow viewports (below 640px). The breakpoint threshold and column distribution can be configured by the renderer
          host — not in the Forml DSL itself.
        </p>

        <Callout type="tip">
          For complex grid requirements (e.g. a 3-column layout that collapses to 2 then 1), compose multiple <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">row</code> blocks
          — one per logical breakpoint — and conditionally show them using the renderer&apos;s responsive utilities.
        </Callout>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/validation" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Validation Rules</Link>
          <Link href="/docs/conditionals" className="text-sm text-foreground hover:underline underline-offset-4">Conditionals →</Link>
        </div>
      </article>
    </div>
  );
}
