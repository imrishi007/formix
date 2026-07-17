import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/docs/docs-nav";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout } from "@/components/docs/callout";

export const metadata: Metadata = {
  title: "Examples — Formix Docs",
  description: "Worked Forml DSL examples: customer feedback form, employee survey, multi-step wizard.",
};

const FEEDBACK_FORM = `form "Customer Feedback" {
  field name : text
    ui { label: "Your Name"  placeholder: "Jane Doe" }
    validate { required  minLength: 2 }

  field email : email
    ui { label: "Email Address"  placeholder: "you@company.com" }
    validate { required }

  field rating : select {
    option "Excellent"
    option "Good"
    option "Needs Work"
    option "Poor"
  }
  ui { label: "Overall Rating" }

  field comments : text
    ui {
      label: "Additional Comments"
      helpText: "Tell us more about your experience."
      placeholder: "Your feedback here..."
    }

  action submit {
    endpoint: "https://api.formix.dev/feedback"
    method: POST
  }
}`;

const SURVEY_FORM = `form "Employee Satisfaction Survey" {
  var scale = 5 ;

  field department : select {
    option "Engineering"
    option "Product"
    option "Design"
    option "Marketing"
    option "Operations"
  }
  ui { label: "Department" }
  validate { required }

  field satisfaction : integer
    ui {
      label: "Overall Satisfaction (1–5)"
      helpText: "1 = Very Dissatisfied, 5 = Very Satisfied"
    }
    validate { required  min: 1  max: 5 }

  if satisfaction < 3 {
    field improvementAreas : checkbox {
      option "Work-life balance"
      option "Compensation"
      option "Career growth"
      option "Management"
      option "Team culture"
    }
    ui { label: "What could we improve?" }
  }

  field wouldRecommend : boolean
    ui { label: "I would recommend this company to a friend" }

  field openFeedback : text
    ui {
      label: "Open Feedback"
      helpText: "Anything else you'd like to share?"
      placeholder: "Your thoughts..."
    }

  action submit {
    endpoint: "https://api.example.com/survey"
    method: POST
  }
}`;

const WIZARD_FORM = `form "Hotel Booking" {
  page "Guest Details" {
    field firstName : text
      ui { label: "First Name" }
      validate { required }

    field lastName : text
      ui { label: "Last Name" }
      validate { required }

    field email : email
      ui { label: "Email Address" }
      validate { required }

    field phone : text
      ui { label: "Phone Number" }
      validate { required  pattern: "^\\+?[\\d\\s\\-]{8,15}$" }

    on submit {
      navigate("Room Selection")
    }
  }

  page "Room Selection" {
    field checkIn : date
      ui { label: "Check-In Date" }
      validate { required }

    field checkOut : date
      ui { label: "Check-Out Date" }
      validate { required }

    field roomType : radio {
      option "Standard"
      option "Deluxe"
      option "Suite"
    }
    ui { label: "Room Type" }
    validate { required }

    field nights : integer
      compute = checkOut - checkIn
      ui { label: "Number of Nights" }

    on submit {
      navigate("Payment")
    }
  }

  page "Payment" {
    field cardNumber : text
      ui { label: "Card Number"  placeholder: "**** **** **** ****" }
      validate { required  pattern: "^\\d{16}$" }

    row {
      field expiry : text
        ui { label: "Expiry (MM/YY)" }
        validate { required  pattern: "^(0[1-9]|1[0-2])\\/\\d{2}$" }

      field cvv : text
        ui { label: "CVV" }
        validate { required  pattern: "^\\d{3,4}$" }
    }
  }

  action submit {
    endpoint: "https://api.hotel.example.com/bookings"
    method: POST
  }
}`;

export default function ExamplesPage() {
  return (
    <div>
      <DocsNav breadcrumbs={[{ label: "Examples" }]} />

      <article className="max-w-3xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px bg-foreground/30" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Examples
          </span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-display tracking-tight mb-6 leading-[1.05]">
          Worked Examples
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed mb-12">
          Complete, real-world Forml files you can paste directly into the editor. Each demonstrates
          a different set of language features.
        </p>

        {/* Example 1 */}
        <div id="feedback" className="scroll-mt-20 mb-16">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono text-xs text-foreground/30 border border-foreground/15 px-2 py-0.5">01</span>
            <h2 className="text-2xl font-display tracking-tight">Customer Feedback Form</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-2 ml-10">
            A simple form collecting a name, email, rating, and comments. Good starting point.
          </p>
          <p className="text-xs font-mono text-muted-foreground mb-4 ml-10">
            Features: text, email, select fields · validation · action block
          </p>
          <CodeBlock code={FEEDBACK_FORM} language="forml" filename="customer-feedback.forml" />
          <div className="mt-4 ml-10">
            <Link
              href="/editor/demo"
              className="inline-flex items-center gap-2 text-sm text-foreground border border-foreground/20 hover:border-foreground/50 px-4 py-2 rounded-full transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Open in Editor
            </Link>
          </div>
        </div>

        {/* Example 2 */}
        <div id="survey" className="scroll-mt-20 mb-16">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono text-xs text-foreground/30 border border-foreground/15 px-2 py-0.5">02</span>
            <h2 className="text-2xl font-display tracking-tight">Employee Satisfaction Survey</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-2 ml-10">
            A conditional form that shows extra questions only when the satisfaction score is low.
          </p>
          <p className="text-xs font-mono text-muted-foreground mb-4 ml-10">
            Features: var declaration · conditional (if) · checkbox · boolean fields
          </p>
          <CodeBlock code={SURVEY_FORM} language="forml" filename="employee-survey.forml" />
          <div className="mt-4 ml-10">
            <Link
              href="/editor/demo"
              className="inline-flex items-center gap-2 text-sm text-foreground border border-foreground/20 hover:border-foreground/50 px-4 py-2 rounded-full transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Open in Editor
            </Link>
          </div>
        </div>

        {/* Example 3 */}
        <div id="wizard" className="scroll-mt-20 mb-16">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono text-xs text-foreground/30 border border-foreground/15 px-2 py-0.5">03</span>
            <h2 className="text-2xl font-display tracking-tight">Multi-Step Hotel Booking</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-2 ml-10">
            A three-page wizard: Guest Details → Room Selection → Payment.
          </p>
          <p className="text-xs font-mono text-muted-foreground mb-4 ml-10">
            Features: multi-page (page) · compute expression · row layout · triggers · pattern validation
          </p>
          <CodeBlock code={WIZARD_FORM} language="forml" filename="hotel-booking.forml" />
          <Callout type="note">
            The <code className="font-mono text-xs bg-foreground/[0.06] px-1 py-0.5">navigate()</code> action at the end of each page trigger
            advances the wizard. The renderer tracks the active page and only validates the current step.
          </Callout>
          <div className="mt-4">
            <Link
              href="/editor/demo"
              className="inline-flex items-center gap-2 text-sm text-foreground border border-foreground/20 hover:border-foreground/50 px-4 py-2 rounded-full transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Open in Editor
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-foreground/10 flex items-center justify-between">
          <Link href="/docs/actions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Actions &amp; Triggers
          </Link>
          <Link href="/docs/grammar" className="text-sm text-foreground hover:underline underline-offset-4">
            Full EBNF Grammar →
          </Link>
        </div>
      </article>
    </div>
  );
}
