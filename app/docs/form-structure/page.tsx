import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { EbnfRule } from "@/components/docs/ebnf-rule";
import { Callout } from "@/components/docs/callout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Form Structure — Formix Docs",
  description: "The anatomy of a Forml file: form, page, section, and statement blocks.",
};

const SINGLE_PAGE = `form "User Registration" {
  section "Account Details" {
    field username : text
      ui { label: "Username"  placeholder: "Choose a username" }
      validate { required  minLength: 3  maxLength: 20 }

    field email : email
      ui { label: "Email Address" }
      validate { required }

    field password : text
      ui { label: "Password" }
      validate { required  minLength: 8 }
  }

  section "Profile" {
    field displayName : text
      ui { label: "Display Name" }

    field bio : text
      ui { label: "Short Bio"  helpText: "Max 160 characters" }
      validate { maxLength: 160 }
  }

  action submit {
    endpoint: "https://api.example.com/register"
    method: POST
  }
}`;

const MULTI_PAGE = `form "Job Application" {
  page "Personal Info" {
    field fullName : text
      ui { label: "Full Name" }
      validate { required }

    field email : email
      ui { label: "Email Address" }
      validate { required }

    field phone : text
      ui { label: "Phone Number" }
      validate { required }

    on submit {
      navigate("Experience")
    }
  }

  page "Experience" {
    field company : text
      ui { label: "Current / Most Recent Company" }

    field role : text
      ui { label: "Job Title" }

    field yearsExp : integer
      ui { label: "Years of Experience" }
      validate { min: 0  max: 50 }

    on submit {
      navigate("Documents")
    }
  }

  page "Documents" {
    field resumeUrl : url
      ui { label: "Resume URL"  helpText: "Link to Google Drive, Dropbox, etc." }
      validate { required }

    field coverLetter : text
      ui { label: "Cover Letter" }
      validate { required  minLength: 100 }
  }

  action submit {
    endpoint: "https://api.example.com/jobs/apply"
    method: POST
  }
}`;

const WITH_GROUP = `form "Shipping Order" {
  // Define a reusable address block once
  group AddressBlock {
    field street : text
      ui { label: "Street Address" }
      validate { required }

    field city : text
      ui { label: "City" }
      validate { required }

    field postcode : text
      ui { label: "Postcode" }
      validate { required }

    field country : select {
      option "United Kingdom"
      option "United States"
      option "India"
      option "Other"
    }
    ui { label: "Country" }
  }

  section "Billing Address" {
    use AddressBlock
  }

  section "Shipping Address" {
    field sameAsBilling : boolean
      ui { label: "Same as billing address" }

    if sameAsBilling == false {
      use AddressBlock
    }
  }

  action submit {
    endpoint: "https://api.example.com/orders"
    method: POST
  }
}`;

export default function FormStructurePage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Language Reference" }, { label: "Form Structure" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">Language Reference</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-4 leading-[1.05]">Form Structure</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          A Forml file always has one root <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">form</code> block.
          Inside it you can nest <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">page</code>,{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">section</code>,{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">group</code> definitions, variable declarations,
          fields, and one action block.
        </p>

        {/* Grammar */}
        <h2 className="text-2xl font-display tracking-tight mb-4">Grammar</h2>

        <EbnfRule
          name="form"
          definition={`form = "form" STRING "{"
       { group_definition | var_declaration | page | statement }
       [ action_block ]
     "}" ;`}
          description="The root of every .forml file"
        />
        <EbnfRule
          name="page"
          definition={`page = "page" STRING "{"
      { statement }
      [ trigger_block ]
    "}" ;`}
          description="A step in a multi-page wizard"
        />
        <EbnfRule
          name="statement"
          definition={`statement = field | section | repeat_group | conditional
          | group_use | layout_block ;`}
          description="Building block of form and page bodies"
        />
        <EbnfRule
          name="section"
          definition={`section = "section" STRING "{" { statement } "}" ;`}
          description="Visual grouping with a heading — same page, separate UI card"
        />

        {/* Single page */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Single-page form with sections</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Use <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">section</code> to visually group related fields
          within a single page. Sections have a heading but do not create separate steps — everything submits at once.
        </p>
        <CodeBlock code={SINGLE_PAGE} language="forml" filename="user-registration.forml" />

        {/* Multi page */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Multi-page wizard with pages</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Use <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">page</code> to create a step-by-step wizard.
          Each page validates its own fields before allowing the user to advance. Navigation is controlled by{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">navigate()</code> actions inside{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">on submit {"{ }"}</code> blocks.
        </p>
        <CodeBlock code={MULTI_PAGE} language="forml" filename="job-application.forml" />

        <Callout type="note">
          When using <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">page</code>, the root-level <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">action submit</code> block
          handles the final submission after all pages are completed. Each intermediate page&apos;s <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">on submit</code> trigger
          calls <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">navigate()</code> instead.
        </Callout>

        {/* Group + use */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Reusable groups with <code className="font-mono">group</code> and <code className="font-mono">use</code></h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Define a named block of fields once and inject it anywhere with{" "}
          <code className="font-mono text-sm bg-foreground/[0.06] px-1.5 py-0.5 rounded-sm">use GroupName</code>.
          Great for address blocks, contact details, or any repeated structure.
        </p>
        <CodeBlock code={WITH_GROUP} language="forml" filename="shipping-order.forml" />

        {/* Nesting rules */}
        <h2 className="text-2xl font-display tracking-tight mt-14 mb-4">Nesting rules</h2>
        <div className="border border-foreground/10 divide-y divide-foreground/8">
          {[
            { parent: "form", allowed: "group, var, page, section, field, if, repeat, row, column, action" },
            { parent: "page", allowed: "section, field, if, repeat, row, column, on submit" },
            { parent: "section", allowed: "field, if, repeat, row, column, use" },
            { parent: "group", allowed: "field only" },
            { parent: "row / column", allowed: "field, section, if" },
          ].map(({ parent, allowed }) => (
            <div key={parent} className="flex gap-6 px-5 py-3.5">
              <code className="font-mono text-sm text-foreground w-28 shrink-0">{parent}</code>
              <p className="text-sm text-muted-foreground">{allowed}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-foreground/10 flex justify-between">
          <Link href="/docs/syntax" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Primitives & Literals</Link>
          <Link href="/docs/fields" className="text-sm text-foreground hover:underline underline-offset-4">Fields & Types →</Link>
        </div>
      </article>
    </div>
  );
}
