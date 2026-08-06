// lib/ai-engine.ts
//
// Formix AI — the assistant behind the workspace's AI panel.
//
// There is no AI backend yet, so everything below is a deterministic,
// rule-based engine: template matching + keyword heuristics for
// generation, and pattern matching over the real Forml grammar for
// explain/fix/improve. It produces genuinely valid Forml (verified against
// the same grammar as lib/forml-file-system.ts's sample files) rather than
// placeholder text, so "Insert into Editor" always compiles.
//
// The seam for a real backend is `runAssistant()` at the bottom of this
// file — components/workspace/ai-panel.tsx and hooks/use-ai-chat.ts only
// ever call `runAssistant` and `streamReply`. Swapping this file's
// internals for a real HTTP/SSE call to an LLM backend later requires no
// change anywhere else.

import { SAMPLE_FILES } from "@/lib/forml-file-system";
import type { FormlDiagnostic } from "@/lib/use-forml-compiler";

// ── Public types ──────────────────────────────────────────────────────────────

export type AiIntent = "generate" | "explain" | "fix" | "improve" | "chat";

export interface AiContext {
  source: string;
  diagnostics: FormlDiagnostic[];
  selection?: string;
}

export interface AiResult {
  reply: string;
  formlCode?: string;
  applyLabel?: string;
}

// ── Intent detection ──────────────────────────────────────────────────────────
// Quick actions in the panel pass their own intent explicitly; this is only
// used to route free-typed messages from the "Describe your form..." composer.

export function detectIntent(raw: string): AiIntent {
  const t = raw.toLowerCase().trim();
  if (/\bfix\b|\berror/.test(t)) return "fix";
  if (/\bexplain\b|what does|what is\b/.test(t)) return "explain";
  if (/\bimprove\b|\bbetter\b|\benhance\b|\boptimi[sz]e\b|\bsuggest/.test(t)) return "improve";
  if (t.length < 4) return "chat";
  return "generate";
}

// ── Template library ──────────────────────────────────────────────────────────
// Reuses the app's own verified sample forms (lib/forml-file-system.ts) as
// "generated" output whenever a prompt clearly matches one of them — this
// guarantees the AI panel's most common outputs are syntactically perfect
// and demonstrate the full grammar, not a thin placeholder.

interface TemplateMatcher {
  test: RegExp;
  file: keyof typeof SAMPLE_FILES;
  label: string;
  blurb: string;
  /** Applied unconditionally when this template matches (subject to the
   *  same allowUploads gate and existing-name dedup as prompt-detected
   *  requirements) — e.g. a job application implies a resume upload even
   *  when the prompt itself never says "resume". */
  impliedRequirementKey?: string;
}

const TEMPLATE_MATCHERS: TemplateMatcher[] = [
  { test: /\bkyc\b|\baadhaar\b|\bpan card\b|\bidentity verification\b/i, file: "kyc-verification.forml", label: "KYC Verification Form", blurb: "a KYC identity verification form" },
  { test: /\bmedical\b|\bhealth record\b|\bpatient\b/i, file: "medical-report.forml", label: "Medical Report Submission", blurb: "a medical report submission form" },
  { test: /\bproject submission\b|\bsubmission portal\b|\bassignment submission\b/i, file: "project-submission.forml", label: "Project Submission Portal", blurb: "a project submission portal" },
  { test: /\blibrary\b|\bborrow/i, file: "library-checkout.forml", label: "Library Checkout Form", blurb: "a library book checkout form" },
  { test: /\bhotel\b|\broom booking\b/i, file: "hotel-booking.forml", label: "Hotel Booking Form", blurb: "a hotel room booking form" },
  { test: /\binsurance\b|\bpremium\b|\bquote\b/i, file: "insurance-quote.forml", label: "Insurance Quote Form", blurb: "an insurance quote calculator" },
  { test: /\bnewsletter\b|\bmailing list\b/i, file: "newsletter-signup.forml", label: "Newsletter Signup Form", blurb: "a newsletter signup form" },
  { test: /\bdata collection\b|\bgdpr\b/i, file: "data-collection.forml", label: "Data Collection Wizard", blurb: "a GDPR-aware data collection wizard" },
  { test: /\bevent\b|\bconference\b|\brsvp\b/i, file: "event-registration.forml", label: "Event Registration Form", blurb: "an event registration form" },
  { test: /\bjob\b|\bapplication\b|\bcareer\b|\bhiring\b|\brecruit/i, file: "job-application.forml", label: "Job Application Form", blurb: "a job application form", impliedRequirementKey: "resume" },
  { test: /\bemployee\b|\bstaff\b|\bworkplace\b/i, file: "employee-survey.forml", label: "Employee Satisfaction Survey", blurb: "an employee satisfaction survey" },
  { test: /\border\b|\bproduct\b|\bpurchase\b/i, file: "product-order.forml", label: "Product Order Form", blurb: "a product order form" },
  { test: /\bregist(er|ration)\b|\bsign ?up\b|\bnew account\b/i, file: "user-registration.forml", label: "User Registration Form", blurb: "a user registration form" },
  { test: /\bcontact\b/i, file: "contact-form.forml", label: "Contact Form", blurb: "a contact form" },
  { test: /\bfeedback\b|\bcustomer\b.*\bsurvey\b|\brating\b/i, file: "customer-feedback.forml", label: "Customer Feedback Form", blurb: "a customer feedback form" },
];

// ── Ambiguity detection ──────────────────────────────────────────────────────
// A handful of well-known phrasings map to more than one plausible template.
// Rather than silently guessing, we ask the questions a human form-builder
// would ask — only generating once the follow-up reply disambiguates.

interface AmbiguousCase {
  test: RegExp;
  /** If the prompt ALSO matches this, it's not actually ambiguous anymore. */
  resolvedBy: RegExp;
  questions: string[];
}

const AMBIGUOUS_CASES: AmbiguousCase[] = [
  {
    test: /\bemployee\b/i,
    resolvedBy: /\bsurvey\b|\bsatisfaction\b|\bfeedback\b|\bonboarding\b|\bapplication\b|\bhiring\b|\bapply\b|\bjob\b|\brecruit/i,
    questions: [
      "Is this a job application form, or an employee onboarding form?",
      "Do you need a resume/CV upload field?",
      "Should it include an approval workflow (e.g. manager sign-off)?",
    ],
  },
  {
    test: /\bapplication\s+form\b/i,
    resolvedBy: /\bjob\b|\bcareer\b|\bhiring\b|\brecruit|\bposition\b|\bloan\b|\bvisa\b|\bgrant\b|\bscholarship\b|\bmembership\b/i,
    questions: [
      "What is this application for — a job, a loan, membership, or something else?",
      "Who fills it out, and what happens after they submit it?",
    ],
  },
];

/** Returns clarifying questions if the prompt is genuinely ambiguous, or null
 *  if it's specific enough to generate from directly. */
function detectAmbiguity(prompt: string): string[] | null {
  for (const c of AMBIGUOUS_CASES) {
    if (c.test.test(prompt) && !c.resolvedBy.test(prompt)) return c.questions;
  }
  return null;
}

// ── Extra-requirement detection ─────────────────────────────────────────────
// Independent of which template matches — scans for asks that layer on top
// of the primary form type ("...that also accepts images") and merges the
// corresponding field into whichever base the primary-type step lands on.

interface RequirementRule {
  key: string;
  test: RegExp;
  label: string;
  spec: FieldSpec;
  /** Skip this rule if any of these other rule keys already matched — avoids
   *  e.g. adding both a generic "attachment" field and a more specific "resume". */
  conflictsWith?: string[];
}

// All upload requirements generate the canonical `field x : upload { accept:
// ... }` syntax (forml-compiler's native upload field type) — never the
// deprecated file/image/pdf/document keywords.
const REQUIREMENT_LIBRARY: RequirementRule[] = [
  {
    key: "resume", test: /\bresume\b|\bcv\b|\bcurriculum vitae\b/i, label: "Resume Upload",
    spec: { name: "resume", type: "upload", label: "Resume / CV", helpText: "PDF, up to 10MB.", upload: { accept: ["pdf"], maxSize: "10MB" } },
  },
  {
    key: "image", test: /\bimages?\b|\bphotos?\b|\bpictures?\b|\bscreenshots?\b/i, label: "Image Upload",
    spec: { name: "photo", type: "upload", label: "Upload a Photo", helpText: "PNG or JPG, up to 5MB.", upload: { accept: ["image"], maxSize: "5MB" } },
  },
  {
    key: "attachment", test: /\bfiles?\b|\battachments?\b|\bdocuments?\b/i, label: "File Attachment",
    spec: { name: "attachment", type: "upload", label: "Attachment", helpText: "Attach any supporting file.", upload: { accept: ["any"] } },
    conflictsWith: ["resume"],
  },
  {
    key: "signature", test: /\bsignature\b/i, label: "Signature",
    spec: { name: "signature", type: "text", label: "Signature (type your full name)" },
  },
  {
    key: "phone", test: /\bphone\b|\bcontact number\b|\bmobile\b/i, label: "Phone Number",
    spec: { name: "phone", type: "text", label: "Phone Number", placeholder: "+1 555 000 0000" },
  },
  {
    key: "terms", test: /\bterms\b|\bconsent\b|\bagree\b/i, label: "Terms Agreement",
    spec: { name: "agreeToTerms", type: "boolean", label: "I agree to the Terms and Privacy Policy", required: true },
  },
  {
    key: "rating", test: /\brating\b|\bstars?\b|\bscore\b/i, label: "Rating",
    spec: { name: "rating", type: "select", label: "Rating", options: ["Excellent", "Good", "Average", "Poor"] },
  },
];

function findRequirement(key: string): RequirementRule {
  const rule = REQUIREMENT_LIBRARY.find((r) => r.key === key);
  if (!rule) throw new Error(`No requirement rule registered for key "${key}"`);
  return rule;
}

/** Field names already present in a FormL source (root-level or nested —
 *  a simple text scan is enough to avoid adding a duplicate field). */
function fieldNamesIn(source: string): Set<string> {
  return new Set([...source.matchAll(/field\s+(\w+)\s*:/g)].map((m) => m[1]));
}

/**
 * @param allowUploads  `upload` fields are real DSL syntax (forml-compiler
 *   supports them), but the currently-deployed forml.wasm binary predates
 *   that grammar addition and won't parse them until it's rebuilt. The
 *   homepage's Live Demo widget calls generateForm() with no context and
 *   runs entirely on that (not-yet-rebuilt) binary, so upload requirements
 *   are suppressed there to avoid handing it unparseable DSL; the
 *   workspace's AI panel always passes a real AiContext and keeps them.
 */
function detectRequirements(prompt: string, existingNames: Set<string>, allowUploads: boolean): RequirementRule[] {
  const matched: RequirementRule[] = [];
  const matchedKeys = new Set<string>();
  for (const rule of REQUIREMENT_LIBRARY) {
    if (!allowUploads && rule.spec.type === "upload") continue;
    if (!rule.test.test(prompt)) continue;
    if (rule.conflictsWith?.some((k) => matchedKeys.has(k))) continue;
    if (existingNames.has(rule.spec.name)) continue;
    matched.push(rule);
    matchedKeys.add(rule.key);
  }
  return matched;
}

/** Adds a template's implied requirement (e.g. job application → resume
 *  upload) even when the prompt itself never named it — subject to the same
 *  upload gate and dedup as prompt-detected requirements. */
function withImpliedRequirement(
  reqs: RequirementRule[],
  matcher: TemplateMatcher,
  existingNames: Set<string>,
  allowUploads: boolean,
): RequirementRule[] {
  if (!matcher.impliedRequirementKey) return reqs;
  if (!allowUploads) return reqs;
  if (reqs.some((r) => r.key === matcher.impliedRequirementKey)) return reqs;
  const implied = findRequirement(matcher.impliedRequirementKey);
  if (existingNames.has(implied.spec.name)) return reqs;
  return [...reqs, implied];
}

/** Splices one or more rendered `field` blocks into an existing FormL source,
 *  right before the `action submit` block (or the form's closing brace if
 *  there isn't one) — so merged requirements land in a syntactically valid
 *  spot regardless of whether the base template uses pages/sections. */
function injectFields(source: string, fieldsSrc: string): string {
  if (!fieldsSrc.trim()) return source;
  const actionIdx = source.search(/\n[ \t]*action\s+submit\s*\{/);
  if (actionIdx !== -1) {
    return `${source.slice(0, actionIdx)}\n\n${fieldsSrc}${source.slice(actionIdx)}`;
  }
  const lastBrace = source.lastIndexOf("}");
  if (lastBrace === -1) return `${source}\n\n${fieldsSrc}`;
  return `${source.slice(0, lastBrace)}\n${fieldsSrc}\n${source.slice(lastBrace)}`;
}

/** True once a source has at least one real field — distinguishes "there's
 *  actually a form to refine" from an empty/never-touched editor. */
function hasExistingForm(source: string | undefined): boolean {
  return !!source && /\bfield\s+\w+\s*:/.test(source);
}

/** Loose heuristic for "add this to what I already have" phrasing, used only
 *  when nothing in the prompt matches a known form-type template — so "a
 *  feedback form that also accepts images" (which DOES name a form type)
 *  is never mistaken for an incremental edit of unrelated existing content. */
function looksIncremental(prompt: string): boolean {
  return /\balso\b|\badd(?:ing)?\b|\binclude\b|\bnow\b|\bas well\b|\bplus\b/i.test(prompt);
}

function describeRequirements(reqs: RequirementRule[]): string {
  return reqs.map((r) => r.label).join(", ");
}

// ── Fallback field library (used when no template matches) ───────────────────

interface FieldSpec {
  name: string;
  type: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
  /** Only meaningful when type === "upload" — rendered as the field's own
   *  `upload { accept: ... }` config block (see renderField). */
  upload?: { accept: string[]; maxSize?: string; multiple?: boolean };
}

const FIELD_LIBRARY: Record<string, FieldSpec> = {
  name: { name: "name", type: "text", label: "Full Name", placeholder: "Jane Doe", required: true },
  email: { name: "email", type: "email", label: "Email", placeholder: "you@example.com", required: true },
  phone: { name: "phone", type: "text", label: "Phone Number", placeholder: "+1 555 000 0000" },
  company: { name: "company", type: "text", label: "Company" },
  subject: { name: "subject", type: "text", label: "Subject" },
  message: { name: "message", type: "text", label: "Message", placeholder: "Tell us more...", helpText: "Share as much detail as you can.", required: true },
  date: { name: "date", type: "date", label: "Date", required: true },
  age: { name: "age", type: "integer", label: "Age" },
  rating: { name: "rating", type: "select", label: "Rating", options: ["Excellent", "Good", "Average", "Poor"] },
  terms: { name: "agreeToTerms", type: "boolean", label: "I agree to the Terms and Privacy Policy", required: true },
  address: { name: "address", type: "text", label: "Address" },
  city: { name: "city", type: "text", label: "City" },
  country: { name: "country", type: "text", label: "Country" },
  website: { name: "website", type: "url", label: "Website", placeholder: "https://" },
  jobTitle: { name: "jobTitle", type: "text", label: "Job Title" },
  department: { name: "department", type: "select", label: "Department", options: ["Engineering", "Design", "Sales", "Support", "Other"] },
  attendees: { name: "attendees", type: "integer", label: "Number of Attendees" },
  dietary: { name: "dietary", type: "checkbox", label: "Dietary Preferences", options: ["Vegetarian", "Vegan", "Gluten-Free", "No Restrictions"] },
};

const FIELD_KEYWORD_MAP: Record<string, keyof typeof FIELD_LIBRARY> = {
  "full name": "name", name: "name",
  email: "email",
  phone: "phone", telephone: "phone", mobile: "phone",
  company: "company", organi: "company",
  subject: "subject",
  message: "message", comment: "message", description: "message",
  date: "date",
  age: "age",
  rating: "rating", score: "rating",
  terms: "terms", agree: "terms", consent: "terms",
  address: "address",
  city: "city",
  country: "country",
  website: "website", url: "website",
  "job title": "jobTitle", position: "jobTitle",
  department: "department",
  attendee: "attendees", guest: "attendees",
  dietary: "dietary", allerg: "dietary",
};

function detectFieldKeys(prompt: string): string[] {
  const t = prompt.toLowerCase();
  const found: string[] = [];
  for (const [kw, key] of Object.entries(FIELD_KEYWORD_MAP)) {
    if (t.includes(kw) && !found.includes(key)) found.push(key);
  }
  return found.slice(0, 7);
}

function inferTitle(prompt: string): string {
  let s = prompt.trim();
  s = s.replace(/^(please\s+)?(can you\s+)?(generate|create|build|make|design|write|i need|i want)\s+(me\s+)?(a|an|the)?\s*/i, "");
  s = s.replace(/\bforms?\b/gi, "").trim().replace(/\s+/g, " ");
  if (!s) return "Untitled Form";
  const words = s.split(" ").slice(0, 5);
  const titled = words.map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
  return `${titled} Form`.replace(/\s+/g, " ").trim();
}

function renderField(spec: FieldSpec): string {
  const uiParts = [`label: "${spec.label}"`];
  if (spec.placeholder) uiParts.push(`placeholder: "${spec.placeholder}"`);
  if (spec.helpText) uiParts.push(`helpText: "${spec.helpText}"`);
  const validateParts: string[] = [];
  if (spec.required) validateParts.push("required");

  if (spec.type === "select" || spec.type === "radio" || spec.type === "checkbox") {
    const opts = (spec.options ?? []).map((o) => `    option "${o}"`).join("\n");
    let block = `  field ${spec.name} : ${spec.type} {\n${opts}\n  }\n  ui { ${uiParts.join("  ")} }`;
    if (validateParts.length) block += `\n  validate { ${validateParts.join("  ")} }`;
    return block;
  }

  if (spec.type === "upload") {
    const u = spec.upload ?? { accept: ["any"] };
    const uploadLines = [`    accept: ${u.accept.join(",")}`];
    if (u.multiple) uploadLines.push("    multiple: true");
    if (u.maxSize) uploadLines.push(`    maxSize: "${u.maxSize}"`);
    if (spec.required) uploadLines.push("    required");
    return `  field ${spec.name} : upload {\n${uploadLines.join("\n")}\n  }\n  ui { ${uiParts.join("  ")} }`;
  }

  let block = `  field ${spec.name} : ${spec.type}\n    ui {\n      ${uiParts.join("\n      ")}\n    }`;
  if (validateParts.length) block += `\n    validate { ${validateParts.join("  ")} }`;
  return block;
}

// ── Generate ───────────────────────────────────────────────────────────────────
// Pipeline: detect the primary form type (or recognise genuine ambiguity and
// ask first) → extract any extra requirements layered on top of it → start
// from the closest template → merge the requirements in → hand back the
// final DSL. When the prompt doesn't name a form type at all but there's
// already a real form open, an incremental ask ("also add...") refines that
// existing source instead of generating a new one from scratch.

export function generateForm(prompt: string, context?: AiContext): AiResult {
  const trimmed = prompt.trim();
  // See detectRequirements' doc comment — only the workspace AI panel (which
  // always passes a real context) gets upload-type requirement fields.
  const allowUploads = context !== undefined;

  // ── 1. Ambiguous? Ask before generating anything. ─────────────────────────
  const questions = detectAmbiguity(trimmed);
  if (questions) {
    const list = questions.map((q) => `- ${q}`).join("\n");
    return {
      reply: `"${trimmed}" could mean a few different things — before I generate anything, help me narrow it down:\n\n${list}\n\nTell me more and I'll build the exact form you need.`,
    };
  }

  const matched = TEMPLATE_MATCHERS.find((m) => m.test.test(trimmed));

  // ── 2. Template matched → fresh generate, merging any extra requirements. ─
  if (matched) {
    const base = SAMPLE_FILES[matched.file];
    const baseNames = fieldNamesIn(base);
    const detectedReqs = detectRequirements(trimmed, baseNames, allowUploads);
    const reqs = withImpliedRequirement(detectedReqs, matched, baseNames, allowUploads);
    const merged = reqs.length ? injectFields(base, reqs.map((r) => renderField(r.spec)).join("\n\n")) : base;

    const detected = `**Detected form type:** ${matched.label}` +
      (reqs.length ? `\n**Additional requirements:** ${describeRequirements(reqs)}` : "");

    const reqClause = reqs.length ? `, plus ${describeRequirements(reqs).toLowerCase()}` : "";
    return {
      reply: `${detected}\n\nHere's ${matched.blurb}${reqClause}, built with Forml's full field set — labels, validation, and a submit action all included. Review it below, then insert it into the editor whenever you're ready.`,
      formlCode: merged,
      applyLabel: "Insert into Editor",
    };
  }

  // ── 3. No template matched, but there's a real form to refine, and the ───
  //      prompt reads like an incremental ask rather than a new form type.
  const existingSource = context?.source ?? "";
  if (hasExistingForm(existingSource) && looksIncremental(trimmed)) {
    const reqs = detectRequirements(trimmed, fieldNamesIn(existingSource), allowUploads);
    if (reqs.length > 0) {
      const merged = injectFields(existingSource, reqs.map((r) => renderField(r.spec)).join("\n\n"));
      return {
        reply: `**Detected form type:** Refining your current form\n**Additional requirements:** ${describeRequirements(reqs)}\n\nI've added ${describeRequirements(reqs).toLowerCase()} to the form you already have open — everything else is untouched. Review the update below, then apply it whenever you're ready.`,
        formlCode: merged,
        applyLabel: "Apply Update",
      };
    }
  }

  // ── 4. Fallback: no template, no refinement — build from scratch using ────
  //      whatever fields + requirements the description names.
  const title = inferTitle(trimmed);
  const keys = detectFieldKeys(trimmed);
  const specs: FieldSpec[] = keys.map((k) => FIELD_LIBRARY[k]).filter(Boolean);
  if (specs.length === 0) specs.push(FIELD_LIBRARY.name, FIELD_LIBRARY.email, FIELD_LIBRARY.message);

  const existingNames = new Set(specs.map((s) => s.name));
  const reqs = detectRequirements(trimmed, existingNames, allowUploads);
  specs.push(...reqs.map((r) => r.spec));

  const fieldsSrc = specs.map(renderField).join("\n\n");
  const formlCode = `form "${title}" {\n\n${fieldsSrc}\n\n  action submit {\n    endpoint: "https://api.formix.dev/submit"\n    method: POST\n  }\n}`;

  const detected = `**Detected form type:** Custom form (no close template match — built from your description)` +
    (reqs.length ? `\n**Additional requirements:** ${describeRequirements(reqs)}` : "");

  return {
    reply: `${detected}\n\nHere's a draft for **${title}** with ${specs.length} field${specs.length === 1 ? "" : "s"} based on your description. Insert it into the editor, then keep chatting with me to refine it further.`,
    formlCode,
    applyLabel: "Insert into Editor",
  };
}

// ── Explain ────────────────────────────────────────────────────────────────────

const FIELD_TYPE_EXPLANATIONS: Record<string, string> = {
  text: "single-line free text — names, descriptions, short answers.",
  email: "an email address input, validated for email format automatically.",
  integer: "whole numbers only, checked against any min/max constraints.",
  float: "decimal numbers — monetary values, measurements.",
  boolean: "a single checkbox; the value is true or false.",
  date: "a date picker; the value is an ISO 8601 date string.",
  url: "a URL input, validated as a well-formed URL.",
  select: "a dropdown of options — one choice.",
  radio: "a radio-button group — all options visible, one choice.",
  checkbox: "a checkbox group — multiple choices allowed.",
};

const KEYWORD_EXPLANATIONS: Record<string, string> = {
  form: "Declares a new form and its title — everything inside the braces belongs to it.",
  ui: "Controls how the field is presented: its label, placeholder, help text, or default value.",
  validate: "Declares constraints — required, min/max, minLength/maxLength, or a pattern — enforced before submit.",
  action: "Declares what happens on submit — where the data is sent, and with which HTTP method.",
  option: "Adds one selectable choice to a select, radio, or checkbox field.",
  page: "Splits the form into a named step of a multi-page wizard.",
  section: "Groups related fields under a heading, purely for layout.",
  row: "Lays out its fields side-by-side instead of stacked.",
  group: "Defines a reusable block of fields that can be dropped in elsewhere with `use`.",
  use: "Inserts a previously-declared `group`'s fields at this point.",
  repeat: "Repeats its block of fields N times, where N comes from another integer field via `count`.",
  if: "Shows its block of fields only when the condition is true — hidden fields are excluded from submission too.",
  else: "The alternate block shown when the `if` condition is false.",
  compute: "Derives this field's value automatically from an expression instead of user input.",
  on: "Declares a lifecycle trigger — load, change, blur, or submit — that runs an action.",
  var: "Declares a named constant reusable elsewhere in the form.",
  from: "Loads a field's options dynamically from a URL or `var` instead of hardcoding them.",
  map: "Tells a dynamic `from` source which JSON keys to use as the option label and value.",
};

export function explainForml(selection: string, fullSource: string): AiResult {
  const hasSelection = selection.trim().length > 0;
  const snippet = hasSelection ? selection.trim() : fullSource.trim();
  const scope = hasSelection ? "the selected code" : "your whole form (nothing was selected, so here's the full picture)";

  if (!snippet) {
    return { reply: "There's nothing to explain yet — write or generate some Forml first." };
  }

  const lines: string[] = [];
  const titleMatch = snippet.match(/form\s+"([^"]+)"/);
  if (titleMatch) lines.push(`**form** — a form titled "${titleMatch[1]}".`);

  const fieldMatches = [...snippet.matchAll(/field\s+(\w+)\s*:\s*(\w+)/g)];
  for (const m of fieldMatches) {
    const [, name, type] = m;
    lines.push(`**${name}** (\`${type}\`) — ${FIELD_TYPE_EXPLANATIONS[type] ?? "a custom field type."}`);
  }

  for (const [kw, desc] of Object.entries(KEYWORD_EXPLANATIONS)) {
    if (new RegExp(`\\b${kw}\\b`).test(snippet)) lines.push(`**${kw}** — ${desc}`);
  }

  if (lines.length === 0) {
    return { reply: `I couldn't recognise any Forml syntax in ${scope} — try selecting a \`field\`, \`ui\`, \`validate\`, or \`action\` block.` };
  }

  return { reply: `Here's what ${scope} does:\n\n${lines.map((l) => `- ${l}`).join("\n")}` };
}

// ── Fix compiler errors ─────────────────────────────────────────────────────────
// Deterministic repairs for the two most common hand-written-DSL slip-ups:
// unbalanced braces and a missing `:` before the field type. Anything else is
// described honestly rather than silently guessed at.

function balanceBraces(source: string): { fixed: string; delta: number } {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' && source[i - 1] !== "\\") inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  if (depth === 0) return { fixed: source, delta: 0 };
  if (depth > 0) return { fixed: source.replace(/\s*$/, "") + "\n" + "}\n".repeat(depth).trim(), delta: depth };

  let toRemove = -depth;
  let out = source;
  let idx = out.length;
  while (toRemove > 0 && idx > 0) {
    idx--;
    if (out[idx] === "}") {
      out = out.slice(0, idx) + out.slice(idx + 1);
      toRemove--;
    }
  }
  return { fixed: out, delta: depth };
}

const FIELD_TYPE_ALTERNATION = "(text|email|integer|float|boolean|date|url|select|radio|checkbox)";

function fixMissingColon(source: string): { fixed: string; count: number } {
  const re = new RegExp(`(field\\s+\\w+)\\s+${FIELD_TYPE_ALTERNATION}\\b`, "g");
  let count = 0;
  const fixed = source.replace(re, (_whole, pre: string, type: string) => {
    count++;
    return `${pre} : ${type}`;
  });
  return { fixed, count };
}

export function fixErrors(context: AiContext): AiResult {
  const { source, diagnostics } = context;
  const errors = diagnostics.filter((d) => d.severity === "error");

  if (errors.length === 0) {
    return { reply: "Your form compiles cleanly — there's nothing to fix. ✨" };
  }

  const errorList = errors.map((d) => `- Line ${d.line}, Col ${d.col}: ${d.message}`).join("\n");

  let working = source;
  const notes: string[] = [];

  const { fixed: colonFixed, count: colonCount } = fixMissingColon(working);
  if (colonCount > 0) {
    working = colonFixed;
    notes.push(`added the missing \`:\` before the type on ${colonCount} field${colonCount === 1 ? "" : "s"}`);
  }

  const { fixed: braceFixed, delta } = balanceBraces(working);
  if (delta > 0) {
    working = braceFixed;
    notes.push(`added ${delta} missing closing brace${delta === 1 ? "" : "s"} (\`}\`)`);
  } else if (delta < 0) {
    working = braceFixed;
    notes.push(`removed ${-delta} extra closing brace${-delta === 1 ? "" : "s"} (\`}\`)`);
  }

  if (notes.length === 0) {
    return {
      reply: `I found ${errors.length} error${errors.length === 1 ? "" : "s"} I can point out but can't safely auto-fix yet:\n\n${errorList}\n\nThe diagnostics panel points at the exact line and column — try adjusting those.`,
    };
  }

  return {
    reply: `I found these compiler errors:\n\n${errorList}\n\nI ${notes.join(" and ")}. Review the corrected version below, then apply it if it looks right.`,
    formlCode: working,
    applyLabel: "Apply Fix",
  };
}

// ── Improve ────────────────────────────────────────────────────────────────────

export function improveForm(source: string): AiResult {
  if (!source.trim()) {
    return { reply: "There's no form yet to improve — generate or write one first." };
  }

  const suggestions: string[] = [];
  let working = source;
  const hasAction = /action\s+submit\s*\{/.test(source);
  if (!hasAction) {
    working = working.replace(/\}\s*$/, `\n  action submit {\n    endpoint: "https://api.formix.dev/submit"\n    method: POST\n  }\n}`);
    suggestions.push("added a missing `action submit` block — without it, submitted data has nowhere to go");
  }

  const fieldMatches = [...source.matchAll(/field\s+(\w+)\s*:\s*(\w+)/g)];
  const missingValidation: string[] = [];
  const missingLabel: string[] = [];
  for (const m of fieldMatches) {
    const name = m[1];
    const start = m.index ?? 0;
    const nextFieldIdx = source.indexOf("field ", start + 6);
    const nextActionIdx = source.indexOf("action ", start);
    const candidates = [nextFieldIdx, nextActionIdx, source.length].filter((i) => i > start);
    const end = candidates.length ? Math.min(...candidates) : source.length;
    const region = source.slice(start, end);
    if (!/validate\s*\{/.test(region)) missingValidation.push(name);
    if (!/ui\s*\{[\s\S]*?label\s*:/.test(region)) missingLabel.push(name);
  }
  if (missingValidation.length) suggestions.push(`consider adding \`validate { required }\` to: ${missingValidation.join(", ")}`);
  if (missingLabel.length) suggestions.push(`consider adding a \`ui { label: ... }\` to: ${missingLabel.join(", ")} — right now they'll fall back to showing the raw field name`);

  if (suggestions.length === 0) {
    return { reply: "This form already looks solid — every field has a label and validation, and there's a submit action. Nothing obvious to improve!" };
  }

  const reply = `Here's what I'd tighten up:\n\n${suggestions.map((s) => `- ${s}`).join("\n")}`;

  if (!hasAction) {
    return {
      reply: `${reply}\n\nI've added the missing submit action below — apply it whenever you're ready.`,
      formlCode: working,
      applyLabel: "Apply Improvement",
    };
  }
  return { reply };
}

// ── Generic chat ─────────────────────────────────────────────────────────────

export function genericChat(): AiResult {
  return {
    reply: "I'm Formix AI — I can generate a Forml form from a description, explain selected code, fix compiler errors, or suggest improvements to your current form. Try describing a form, or use one of the quick actions above.",
  };
}

// ── Suggested prompts (empty-state chips) ────────────────────────────────────

export const SUGGESTED_PROMPTS: string[] = [
  "A contact form with name, email, and message",
  "Customer feedback survey with a rating field",
  "Job application form with resume details",
  "Event registration with dietary preferences",
  "Newsletter signup with topic preferences",
  "User registration with age and terms checkbox",
];

// ── Entry point — the seam for a real backend later ─────────────────────────
// Everything above this line is a swappable mock implementation. A real
// integration (e.g. POST /ai/chat streamed over SSE) only needs to replace
// this function's body — callers never know the difference.

export function runAssistant(intent: AiIntent, text: string, context: AiContext): AiResult {
  switch (intent) {
    case "generate": return generateForm(text, context);
    case "explain": return explainForml(context.selection ?? "", context.source);
    case "fix": return fixErrors(context);
    case "improve": return improveForm(context.source);
    case "chat":
    default: return genericChat();
  }
}

// ── Streaming simulation ──────────────────────────────────────────────────────
// Reveals `fullText` progressively so the panel can render a real streaming
// UI. Returns a cancel function (stop button / unmount / new message sent).

export function streamReply(fullText: string, onToken: (soFar: string) => void, onDone: () => void): () => void {
  let cancelled = false;
  let i = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const step = () => {
    if (cancelled) return;
    const chunkSize = 2 + Math.floor(Math.random() * 3);
    i = Math.min(fullText.length, i + chunkSize);
    onToken(fullText.slice(0, i));
    if (i >= fullText.length) {
      onDone();
      return;
    }
    timer = setTimeout(step, 12 + Math.random() * 18);
  };

  timer = setTimeout(step, 150 + Math.random() * 150);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
