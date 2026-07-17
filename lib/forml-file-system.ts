// lib/forml-file-system.ts
// Virtual file system for the Formix IDE demo.
//
// Contains 10 sample .forml files that together showcase every construct
// in the EBNF grammar, plus a README.md.
//
// Also exports `createFileSystemStore` — a plain-JS factory (no hooks) that
// manages the mutable file map so that the IDE shell can call create/delete/
// update without coupling to any specific state library.

// ── 10 Sample .forml files ───────────────────────────────────────────────────

export const SAMPLE_FILES: Record<string, string> = {

  // 1. Basic fields: text, email, select + submit action
  "customer-feedback.forml": `form "Customer Feedback" {

  field name : text
    ui {
      label: "Your Name"
      placeholder: "Jane Doe"
    }
    validate {
      required
      minLength: 2
      maxLength: 80
    }

  field email : email
    ui {
      label: "Email Address"
      placeholder: "you@company.com"
    }
    validate {
      required
    }

  field rating : select {
    option "Excellent"
    option "Good"
    option "Needs Work"
    option "Poor"
  }
  ui {
    label: "Overall Rating"
  }

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
}`,

  // 2. var declarations + numeric validation (min/max/minLength)
  "user-registration.forml": `form "User Registration" {

  var min_age = 18 ;
  var max_age = 120 ;
  var base_url = "https://api.formix.dev" ;

  field username : text
    ui {
      label: "Username"
      placeholder: "cooluser42"
      helpText: "3–20 characters, letters and numbers only."
    }
    validate {
      required
      minLength: 3
      maxLength: 20
      pattern: "^[a-zA-Z0-9_]+$"
    }

  field password : text
    ui {
      label: "Password"
      placeholder: "••••••••"
    }
    validate {
      required
      minLength: 8
    }

  field age : integer
    ui {
      label: "Age"
      placeholder: "25"
    }
    validate {
      required
      min: 18
      max: 120
    }

  field birthdate : date
    ui {
      label: "Date of Birth"
    }
    validate {
      required
    }

  field agreed : boolean
    ui {
      label: "I agree to the Terms of Service"
      default: false
    }
    validate {
      required
    }

  action submit {
    endpoint: "https://api.formix.dev/register"
    method: POST
  }
}`,

  // 3. Multi-step pages + sections + layout (row/column)
  "job-application.forml": `form "Job Application" {

  page "Personal Details" {
    section "Name" {
      row {
        field firstName : text
          ui {
            label: "First Name"
            placeholder: "Alice"
          }
          validate { required  minLength: 2 }

        field lastName : text
          ui {
            label: "Last Name"
            placeholder: "Smith"
          }
          validate { required  minLength: 2 }
      }
    }

    field email : email
      ui {
        label: "Contact Email"
        placeholder: "alice@example.com"
      }
      validate { required }

    field phone : text
      ui {
        label: "Phone Number"
        placeholder: "+1 555 000 0000"
      }
      validate {
        pattern: "^\\+?[0-9 \\-]{7,15}$"
      }
  }

  page "Experience" {
    field jobTitle : text
      ui {
        label: "Current Job Title"
        placeholder: "Software Engineer"
      }

    field yearsExp : integer
      ui {
        label: "Years of Experience"
        placeholder: "5"
      }
      validate {
        min: 0
        max: 60
      }

    field coverLetter : text
      ui {
        label: "Cover Letter"
        helpText: "Briefly describe why you are a good fit."
        placeholder: "I am excited to apply..."
      }
      validate {
        required
        minLength: 100
        maxLength: 2000
      }
  }

  action submit {
    endpoint: "https://api.formix.dev/jobs/apply"
    method: POST
  }
}`,

  // 4. Group definitions + group use + repeat group
  "product-order.forml": `form "Product Order" {

  group AddressBlock {
    field street : text
      ui { label: "Street Address"  placeholder: "123 Main St" }
      validate { required }

    field city : text
      ui { label: "City"  placeholder: "Springfield" }
      validate { required }

    field postcode : text
      ui { label: "Postcode"  placeholder: "SW1A 1AA" }
      validate { required  pattern: "^[A-Z0-9 ]{3,10}$" }

    field country : select {
      option "United Kingdom"
      option "United States"
      option "Canada"
      option "Australia"
    }
    ui { label: "Country" }
  }

  field orderName : text
    ui {
      label: "Order Reference"
      placeholder: "ORD-2026-001"
    }
    validate { required }

  section "Billing Address" {
    use AddressBlock
  }

  section "Shipping Address" {
    use AddressBlock
  }

  field numItems : integer
    ui {
      label: "Number of line items"
      placeholder: "3"
    }
    validate { min: 1  max: 20 }

  repeat count = numItems {
    field sku : text
      ui { label: "SKU"  placeholder: "WIDGET-001" }
      validate { required }

    field quantity : integer
      ui { label: "Quantity" }
      validate { min: 1 }

    field unitPrice : float
      ui { label: "Unit Price (£)" }
      validate { min: 0 }
  }

  action submit {
    endpoint: "https://api.formix.dev/orders"
    method: POST
  }
}`,

  // 5. radio, checkbox, boolean, date, url field types
  "employee-survey.forml": `form "Employee Satisfaction Survey" {

  field department : radio {
    option "Engineering"
    option "Marketing"
    option "Sales"
    option "Operations"
    option "HR"
  }
  ui { label: "Your Department" }
  validate { required }

  field tenure : select {
    option "Less than 1 year"
    option "1–3 years"
    option "3–5 years"
    option "5–10 years"
    option "10+ years"
  }
  ui { label: "How long have you worked here?" }

  field benefits : checkbox {
    option "Health insurance"
    option "Remote work"
    option "Pension plan"
    option "Learning budget"
    option "Flexible hours"
  }
  ui {
    label: "Which benefits do you value most?"
    helpText: "Select all that apply."
  }

  field satisfaction : integer
    ui {
      label: "Overall Satisfaction (1–10)"
      placeholder: "7"
    }
    validate {
      required
      min: 1
      max: 10
    }

  field surveyDate : date
    ui { label: "Survey Date" }

  field wantsFollowUp : boolean
    ui {
      label: "I would like a follow-up call"
      default: false
    }

  field profileUrl : url
    ui {
      label: "LinkedIn Profile (optional)"
      placeholder: "https://linkedin.com/in/yourname"
    }

  action submit {
    endpoint: "https://api.formix.dev/survey"
    method: POST
  }
}`,

  // 6. Conditional (if/else) + field-level triggers (on change → hide/show)
  "contact-form.forml": `form "Contact Us" {

  field contactType : radio {
    option "General Enquiry"
    option "Support"
    option "Sales"
    option "Press"
  }
  ui { label: "What can we help with?" }
  validate { required }
  on change {
    hide(pressEmail)
    hide(ticketId)
    show(message)
  }

  if contactType == "Press" {
    field pressEmail : email
      ui {
        label: "Press Contact Email"
        placeholder: "press@publication.com"
      }
      validate { required }
  } else {
    field fullName : text
      ui {
        label: "Your Name"
        placeholder: "Alice Smith"
      }
      validate { required  minLength: 2 }

    field email : email
      ui {
        label: "Your Email"
        placeholder: "alice@example.com"
      }
      validate { required }
  }

  if contactType == "Support" {
    field ticketId : text
      ui {
        label: "Existing Ticket ID (if any)"
        placeholder: "TKT-0042"
      }
  }

  field message : text
    ui {
      label: "Message"
      placeholder: "Describe your enquiry..."
      helpText: "We aim to reply within one business day."
    }
    validate {
      required
      minLength: 20
      maxLength: 1000
    }

  action submit {
    endpoint: "https://api.formix.dev/contact"
    method: POST
  }
}`,

  // 7. Dynamic options via source_block (from url + map)
  "event-registration.forml": `form "Event Registration" {

  var events_api = "https://api.formix.dev/events" ;

  field selectedEvent : select
    from url "https://api.formix.dev/events/list"
    map { label: name , value: id }
  ui {
    label: "Choose an Event"
    helpText: "Events are loaded dynamically from the API."
  }
  validate { required }

  field ticketType : radio {
    option "General Admission"
    option "VIP"
    option "Student"
    option "Speaker"
  }
  ui { label: "Ticket Type" }
  validate { required }

  field attendeeName : text
    ui {
      label: "Full Name"
      placeholder: "Alice Smith"
    }
    validate { required  minLength: 2 }

  field attendeeEmail : email
    ui {
      label: "Email Address"
      placeholder: "alice@example.com"
    }
    validate { required }

  field dietaryNeeds : checkbox {
    option "Vegetarian"
    option "Vegan"
    option "Gluten-free"
    option "Nut-free"
    option "None"
  }
  ui { label: "Dietary Requirements" }

  field specialRequests : text
    ui {
      label: "Special Requests"
      placeholder: "Wheelchair access, nursing room, etc."
    }

  action submit {
    endpoint: "https://api.formix.dev/events/register"
    method: POST
  }
}`,

  // 8. Compute blocks (arithmetic expressions)
  "insurance-quote.forml": `form "Insurance Quote" {

  var base_rate = 0.05 ;
  var young_surcharge = 1.25 ;
  var no_claims_discount = 0.15 ;

  field vehicleValue : float
    ui {
      label: "Vehicle Value (£)"
      placeholder: "12500.00"
    }
    validate {
      required
      min: 500
    }

  field driverAge : integer
    ui {
      label: "Driver Age"
      placeholder: "28"
    }
    validate {
      required
      min: 17
      max: 99
    }

  field noClaimsYears : integer
    ui {
      label: "No-Claims Years"
      placeholder: "3"
    }
    validate {
      min: 0
      max: 30
    }

  field basePremium : float
    ui {
      label: "Base Annual Premium (£)"
      helpText: "Calculated automatically from vehicle value × base rate."
    }
    compute = vehicleValue * base_rate

  field ageSurcharge : float
    ui {
      label: "Age Surcharge (£)"
      helpText: "Applied when driver is under 25."
    }
    compute = basePremium * young_surcharge

  field discount : float
    ui {
      label: "No-Claims Discount (£)"
    }
    compute = basePremium * no_claims_discount

  field finalPremium : float
    ui {
      label: "Final Annual Premium (£)"
      helpText: "basePremium + ageSurcharge − discount"
    }
    compute = basePremium + ageSurcharge - discount

  action submit {
    endpoint: "https://api.formix.dev/insurance/quote"
    method: POST
  }
}`,

  // 9. pattern validation + bind + default values + helpText
  "newsletter-signup.forml": `form "Newsletter Signup" {

  var default_country = "United Kingdom" ;

  field fullName : text
    ui {
      label: "Full Name"
      placeholder: "Jane Doe"
      default: "Anonymous Reader"
    }
    validate {
      required
      minLength: 2
      maxLength: 100
    }

  field email : email
    ui {
      label: "Email Address"
      placeholder: "jane@example.com"
      bind: "user.email"
    }
    validate {
      required
      pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"
    }

  field country : select {
    option "United Kingdom"
    option "United States"
    option "Germany"
    option "France"
    option "Japan"
    option "Australia"
  }
  ui {
    label: "Country"
    default: "United Kingdom"
    helpText: "Used to send you localised content."
  }

  field interests : checkbox {
    option "Product Updates"
    option "Industry News"
    option "Tutorials"
    option "Case Studies"
    option "Events"
  }
  ui {
    label: "Topics you care about"
    helpText: "We send at most one email per week."
  }

  field frequency : radio {
    option "Weekly digest"
    option "Bi-weekly"
    option "Monthly"
  }
  ui {
    label: "Email Frequency"
    default: "Weekly digest"
  }

  field marketingConsent : boolean
    ui {
      label: "I agree to receive marketing communications"
      default: false
      helpText: "You can unsubscribe at any time via the link in our emails."
    }
    validate { required }

  action submit {
    endpoint: "https://api.formix.dev/newsletter/subscribe"
    method: POST
  }
}`,

  // 10. on load/change/blur triggers + navigate action
  "data-collection.forml": `form "Data Collection Wizard" {

  var api_base = "https://api.formix.dev" ;

  field dataCategory : select {
    option "Personal"
    option "Business"
    option "Medical"
    option "Financial"
  }
  ui {
    label: "Data Category"
    helpText: "Select the category that best fits your data."
  }
  validate { required }
  on change {
    hide(businessReg)
    hide(medicalId)
    hide(accountNumber)
    show(dataCategory)
  }
  on load {
    show(dataCategory)
  }

  if dataCategory == "Business" {
    field businessReg : text
      ui {
        label: "Business Registration Number"
        placeholder: "GB123456789"
      }
      validate { required  pattern: "^[A-Z]{2}[0-9]{9}$" }
  }

  if dataCategory == "Medical" {
    field medicalId : text
      ui {
        label: "NHS / Medical ID"
        placeholder: "123 456 7890"
      }
      validate { required }
  }

  if dataCategory == "Financial" {
    field accountNumber : text
      ui {
        label: "Account Number"
        placeholder: "12345678"
      }
      validate {
        required
        pattern: "^[0-9]{8}$"
      }
  }

  field dataOwner : text
    ui {
      label: "Data Owner / Controller"
      placeholder: "Jane Doe or Acme Ltd"
    }
    validate { required  minLength: 2 }
    on blur {
      set(dataOwner, "Verified")
    }

  field retentionPeriod : integer
    ui {
      label: "Retention Period (months)"
      placeholder: "24"
    }
    validate {
      required
      min: 1
      max: 120
    }

  field gdprConsent : boolean
    ui {
      label: "I confirm this data is collected under a lawful basis (GDPR Art. 6)"
      default: false
    }
    validate { required }

  on submit {
    navigate("https://formix.dev/data-collection/confirmation")
  }

  action submit {
    endpoint: "https://api.formix.dev/data"
    method: POST
  }
}`,

  // README
  "README.md": `# Formix — Forms as Code

Write forms once as \`.forml\` DSL files, compile them to structured JSON,
and render them anywhere.

## Quick start

\`\`\`
form "My Form" {
  field name : text
    ui { label: "Name"  placeholder: "Alice" }
    validate { required }

  action submit {
    endpoint: "https://api.example.com/submit"
    method: POST
  }
}
\`\`\`

## Grammar constructs

| Construct       | Keyword(s)                      |
|-----------------|---------------------------------|
| Basic fields    | \`text\` \`email\` \`integer\` \`float\` \`date\` \`boolean\` \`url\` |
| Choice fields   | \`select\` \`radio\` \`checkbox\`   |
| UI rules        | \`label\` \`placeholder\` \`helpText\` \`default\` \`bind\` |
| Validation      | \`required\` \`min\` \`max\` \`minLength\` \`maxLength\` \`pattern\` |
| Computed fields | \`compute = <expr>\`              |
| Constants       | \`var name = value\`              |
| Reuse           | \`group\` / \`use\`                 |
| Multi-step      | \`page\`                          |
| Layout          | \`section\` \`row\` \`column\`      |
| Dynamic fields  | \`if / else\`                    |
| Repeat          | \`repeat count = <ident>\`       |
| Lifecycle       | \`on load/change/blur/submit\`   |
| Dynamic options | \`from url/var … map { … }\`    |
| Submit          | \`action submit { endpoint method }\` |

## Compiler

The compiler runs entirely in the browser as a WASM binary compiled from C++.
It performs lexing, parsing (recursive-descent), and semantic analysis, then
emits a typed JSON AST and a diagnostics array.
`,

  // 11. DYNAMIC: repeat count driven by integer field (library book checkout)
  "library-checkout.forml": `form "Library Book Checkout" {

  field borrowerName : text
    ui {
      label: "Borrower Name"
      placeholder: "Jane Doe"
    }
    validate {
      required
      minLength: 2
    }

  field borrowerId : text
    ui {
      label: "Library Card Number"
      placeholder: "LIB-000123"
    }
    validate {
      required
      pattern: "^LIB-[0-9]{6}$"
    }

  field numBooks : integer
    ui {
      label: "How many books are you checking out?"
      helpText: "Enter a number between 1 and 10. That many book sections will appear below."
      placeholder: "3"
    }
    validate {
      required
      min: 1
      max: 10
    }

  repeat count = numBooks {
    field bookTitle : text
      ui {
        label: "Book Title"
        placeholder: "The Great Gatsby"
      }
      validate { required }

    field isbn : text
      ui {
        label: "ISBN"
        placeholder: "978-3-16-148410-0"
      }

    field author : text
      ui {
        label: "Author"
        placeholder: "F. Scott Fitzgerald"
      }

    field dueDate : date
      ui {
        label: "Due Date"
        helpText: "Standard loan period is 3 weeks."
      }
      validate { required }
  }

  field notes : text
    ui {
      label: "Additional Notes"
      placeholder: "Any special requests or comments..."
    }

  action submit {
    endpoint: "https://api.formix.dev/library/checkout"
    method: POST
  }
}`,

  // 12. DYNAMIC: hotel booking — room count drives guest sections, conditionals
  "hotel-booking.forml": `form "Hotel Room Booking" {

  var max_guests_per_room = 4 ;

  section "Stay Details" {
    row {
      field checkIn : date
        ui {
          label: "Check-In Date"
        }
        validate { required }

      field checkOut : date
        ui {
          label: "Check-Out Date"
        }
        validate { required }
    }

    field roomType : select {
      option "Standard"
      option "Deluxe"
      option "Suite"
      option "Penthouse"
    }
    ui {
      label: "Room Type"
      helpText: "Suite and Penthouse include complimentary breakfast."
    }
    validate { required }

    if roomType == "Suite" {
      field breakfastPref : radio {
        option "Continental"
        option "Full English"
        option "Vegan"
      }
      ui {
        label: "Breakfast Preference"
        helpText: "Included with your Suite."
      }
    }

    if roomType == "Penthouse" {
      field butlerService : boolean
        ui {
          label: "Request dedicated butler service"
          default: false
        }

      field breakfastPref : radio {
        option "Continental"
        option "Full English"
        option "Vegan"
        option "Chef's Table"
      }
      ui {
        label: "Breakfast Preference"
        helpText: "Chef's Table is exclusive to Penthouse guests."
      }
    }
  }

  section "Guest Information" {
    field numRooms : integer
      ui {
        label: "Number of Rooms"
        helpText: "Each room will have its own guest details section below."
        placeholder: "2"
      }
      validate {
        required
        min: 1
        max: 5
      }

    repeat count = numRooms {
      field guestName : text
        ui {
          label: "Primary Guest Name"
          placeholder: "Alice Smith"
        }
        validate { required  minLength: 2 }

      field guestEmail : email
        ui {
          label: "Guest Email"
          placeholder: "alice@example.com"
        }
        validate { required }

      field guestCount : integer
        ui {
          label: "Guests in this room"
          placeholder: "2"
        }
        validate {
          required
          min: 1
          max: 4
        }

      field specialRequests : text
        ui {
          label: "Special Requests for this room"
          placeholder: "High floor, twin beds, etc."
        }
    }
  }

  section "Add-ons" {
    field parking : boolean
      ui {
        label: "Add parking space (£15/night)"
        default: false
      }

    field earlyCheckIn : boolean
      ui {
        label: "Early check-in (12:00 pm, £20)"
        default: false
      }

    field lateCheckOut : boolean
      ui {
        label: "Late check-out (2:00 pm, £20)"
        default: false
      }
  }

  action submit {
    endpoint: "https://api.formix.dev/hotel/book"
    method: POST
  }
}`,
};

// ── Virtual file system factory ──────────────────────────────────────────────

export type FileType = "forml" | "md" | "generic";

export interface VirtualFile {
  name: string;
  content: string;
  fileType: FileType;
}

function inferFileType(name: string): FileType {
  if (name.endsWith(".forml")) return "forml";
  if (name.endsWith(".md")) return "md";
  return "generic";
}

export type FileSystemListener = (files: Map<string, VirtualFile>) => void;

export interface FileSystemStore {
  /** Current snapshot of all files. */
  files: Map<string, VirtualFile>;
  /** Return a file by name, or undefined. */
  get: (name: string) => VirtualFile | undefined;
  /** Create a new file. Throws if name already exists. */
  create: (name: string, content?: string) => VirtualFile;
  /** Update the content of an existing file. */
  update: (name: string, content: string) => void;
  /** Delete a file. Returns false if it didn't exist. */
  delete: (name: string) => boolean;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe: (listener: FileSystemListener) => () => void;
}

export function createFileSystemStore(
  initial: Record<string, string> = SAMPLE_FILES,
): FileSystemStore {
  const files = new Map<string, VirtualFile>();
  const listeners = new Set<FileSystemListener>();

  // Populate from initial map
  for (const [name, content] of Object.entries(initial)) {
    files.set(name, { name, content, fileType: inferFileType(name) });
  }

  function notify() {
    const snapshot = new Map(files);
    for (const l of listeners) l(snapshot);
  }

  return {
    get files() {
      return new Map(files);
    },
    get(name) {
      return files.get(name);
    },
    create(name, content = "") {
      if (files.has(name)) throw new Error(`File "${name}" already exists.`);
      const file: VirtualFile = { name, content, fileType: inferFileType(name) };
      files.set(name, file);
      notify();
      return file;
    },
    update(name, content) {
      const existing = files.get(name);
      if (!existing) return;
      existing.content = content;
      notify();
    },
    delete(name) {
      const had = files.delete(name);
      if (had) notify();
      return had;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Singleton store — shared across all editor instances in the same page. */
let _store: FileSystemStore | null = null;
export function getFileSystemStore(): FileSystemStore {
  if (!_store) _store = createFileSystemStore();
  return _store;
}

/** New-file template for `.forml` files */
export function newFormlTemplate(title: string): string {
  return `form "${title}" {

  field name : text
    ui {
      label: "Name"
      placeholder: "Enter your name"
    }
    validate {
      required
    }

  action submit {
    endpoint: "https://api.formix.dev/submit"
    method: POST
  }
}`;
}
