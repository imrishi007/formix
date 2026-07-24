/**
 * lib/api.ts
 *
 * Typed fetch wrappers for the Formix FastAPI backend.
 * Single source of truth for the backend URL — set NEXT_PUBLIC_API_URL
 * in .env.local to override for production; defaults to localhost:8000.
 *
 * Both the editor publish flow (demo-ide-shell.tsx) and the public
 * respondent page (app/f/[formId]/form-renderer.tsx) import from here.
 * No component should ever hardcode the backend host directly.
 */

export const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FormCreate {
  title: string;
  forml_source: string;
  compiled_schema?: unknown;
}

export interface FormUpdate {
  forml_source: string;
  compiled_schema?: unknown;
}

export interface FormCreateResponse {
  id: string;
  title: string;
  is_published: boolean;
  created_at: string;
}

export interface PublishResponse {
  form_id: string;
  public_url: string;
  embed_snippet: string;
}

export interface PublicFormResponse {
  id: string;
  title: string;
  compiled_schema: Record<string, unknown>;
}

export interface SubmitResponse {
  success: boolean;
  submission_id: string;
}

export interface SubmissionRecord {
  id: string;
  form_id: string;
  data: Record<string, unknown>;
  submitted_at: string;
}

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? message;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, message);
  }
  // 204 No Content has no body
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── API functions ─────────────────────────────────────────────────────────────

/** Create a new form record (not yet published). Returns the new form ID. */
export function createForm(payload: FormCreate): Promise<FormCreateResponse> {
  return request<FormCreateResponse>("/forms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update an existing form's source and compiled schema. */
export function updateForm(id: string, payload: FormUpdate): Promise<void> {
  return request<void>(`/forms/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Publish a form.  Sends the final compiled schema and the author's browser
 * origin so the backend can construct an absolute public URL.
 */
export function publishForm(
  id: string,
  compiledSchema: unknown,
  baseUrl: string,
): Promise<PublishResponse> {
  return request<PublishResponse>(`/forms/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({ compiled_schema: compiledSchema, base_url: baseUrl }),
  });
}

/**
 * Fetch a published form's compiled schema.
 * Throws ApiError(404) if the form doesn't exist or isn't published.
 */
export function getForm(id: string): Promise<PublicFormResponse> {
  return request<PublicFormResponse>(`/forms/${id}`);
}

/**
 * Submit a respondent's answers for a published form.
 * `data` is the {fieldName: value} map collected from the form fields.
 */
export function submitForm(
  id: string,
  data: Record<string, string>,
): Promise<SubmitResponse> {
  return request<SubmitResponse>(`/forms/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

/** List all submissions for a form (author view). */
export function getResponses(id: string): Promise<SubmissionRecord[]> {
  return request<SubmissionRecord[]>(`/forms/${id}/responses`);
}

// ── AI Generator Types & Function ──────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateFormlResponse {
  reply: string;
  extracted_code?: string;
}

/**
 * Generate or edit FormL code using the Groq AI service on the backend.
 */
export function generateFormlCode(
  messages: ChatMessage[],
  currentCode?: string,
): Promise<GenerateFormlResponse> {
  return request<GenerateFormlResponse>("/generators/generate", {
    method: "POST",
    body: JSON.stringify({ messages, current_code: currentCode }),
  });
}

