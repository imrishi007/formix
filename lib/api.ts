/**
 * lib/api.ts
 *
 * Typed fetch wrappers for the Formix FastAPI backend.
 * Single source of truth for the backend URL — set NEXT_PUBLIC_API_URL
 * in .env.local to override for production; defaults to localhost:8000.
 *
 * Both the workspace (components/workspace/*) and the public respondent
 * page (app/f/[formId]/form-renderer.tsx) import from here. No component
 * should ever hardcode the backend host directly.
 */

export const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// ── Auth token storage ───────────────────────────────────────────────────────
// A plain localStorage key, not React state — lib/auth-context.tsx wraps this
// in a context/hook for components, but request() below needs to read it
// synchronously on every call without importing React context machinery.
//
// Alongside the token we store a client-side expiry timestamp (30 days) so
// the app can pre-validate the session on mount without a server round-trip.
// This prevents the user from being silently logged out whenever they reopen
// the browser within the 30-day window.

const TOKEN_STORAGE_KEY = "formix_auth_token";
const TOKEN_EXPIRY_KEY = "formix_auth_token_expiry";

/** Session lifetime on the client — must match FORMIX_JWT_EXPIRE_MINUTES (43200 = 30 days). */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  // If the client-side expiry timestamp says the token is stale, clear it now
  // so we never send a known-expired token to the server.
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (expiry && Date.now() > parseInt(expiry, 10)) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  // Record a hard expiry 30 days from now. Even if the JWT's own exp claim
  // is longer/shorter, this ensures the client never holds a stale token.
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/** Returns true if a stored token exists and has not yet passed its client-side expiry. */
export function isSessionValid(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return false;
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  // Tokens stored before the expiry key was introduced have no expiry record;
  // treat them as valid so existing users are not silently logged out on upgrade.
  if (!expiry) return true;
  return Date.now() < parseInt(expiry, 10);
}

// ── Types ─────────────────────────────────────────────────────────────────────

// Auth
export interface UserResponse {
  id: string;
  email: string;
  name?: string | null;
  created_at: string;
}

export interface AuthResult {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

// Projects
export interface ProjectResponse {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export type DuplicateMode = "multiple" | "single_per_session" | "single_per_email";

export interface FormSummary {
  id: string;
  title: string;
  is_published: boolean;
  next_form_id?: string | null;
  duplicate_mode: DuplicateMode;
  created_at: string;
}

export interface ProjectDetail extends ProjectResponse {
  forms: FormSummary[];
}

// Forms
export interface FormCreate {
  title: string;
  forml_source: string;
  compiled_schema?: unknown;
  duplicate_mode?: DuplicateMode;
}

export interface FormUpdate {
  forml_source: string;
  compiled_schema?: unknown;
  /** Only sent when the author explicitly accepts a rename suggestion. */
  title?: string;
  duplicate_mode?: DuplicateMode;
}

export interface FormCreateResponse {
  id: string;
  title: string;
  is_published: boolean;
  duplicate_mode: DuplicateMode;
  created_at: string;
}

export interface FormDetail {
  id: string;
  project_id: string;
  title: string;
  forml_source: string;
  compiled_schema: Record<string, unknown> | null;
  is_published: boolean;
  next_form_id?: string | null;
  duplicate_mode: DuplicateMode;
  created_at: string;
  updated_at: string;
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
  session_id: string;
}

export interface SubmitResponse {
  success: boolean;
  submission_id: string;
  next_form_id?: string | null;
  session_id?: string | null;
}

export interface SubmissionRecord {
  id: string;
  form_id: string;
  respondent_session_id?: string | null;
  data: Record<string, unknown>;
  browser?: string | null;
  device?: string | null;
  started_at?: string | null;
  submitted_at: string;
}

export interface PaginatedSubmissions {
  items: SubmissionRecord[];
  total: number;
  limit: number;
  offset: number;
}

// Dashboard
export interface DashboardFormRow {
  id: string;
  title: string;
  project_id: string;
  project_title: string;
  is_published: boolean;
  duplicate_mode: DuplicateMode;
  created_at: string;
  updated_at: string;
  submission_count: number;
  last_response_at?: string | null;
}

export interface DashboardSummary {
  total_projects: number;
  total_forms: number;
  published_forms: number;
  total_submissions: number;
  today_responses: number;
  submissions_last_7_days: number;
}

// Analytics
export interface AnalyticsDayCount {
  date: string;
  count: number;
}

export interface FieldValueCount {
  value: string;
  count: number;
}

export interface FieldAnalytics {
  name: string;
  label: string;
  field_type: string;
  answered_count: number;
  skipped_count: number;
  option_counts?: FieldValueCount[] | null;
  numeric_min?: number | null;
  numeric_max?: number | null;
  numeric_avg?: number | null;
  numeric_distribution?: FieldValueCount[] | null;
  date_min?: string | null;
  date_max?: string | null;
  text_samples?: string[] | null;
}

export interface FormAnalytics {
  form_id: string;
  total_submissions: number;
  today_responses: number;
  responses_last_7_days: number;
  responses_last_30_days: number;
  submissions_by_day: AnalyticsDayCount[];
  device_breakdown: Record<string, number>;
  browser_breakdown: Record<string, number>;
  avg_completion_seconds?: number | null;
  completion_sample_size: number;
  fields: FieldAnalytics[];
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

/** Dispatched on `window` whenever a request that carried a Bearer token
 *  comes back 401 AND the client-side expiry confirms the token has expired.
 *  lib/auth-context.tsx listens for this to clear its state and bounce to
 *  sign-in. We intentionally do NOT fire this on every 401 — a 401 while
 *  the token is still within its 30-day window is most likely a transient
 *  backend error, not an expired session. */
export const AUTH_EXPIRED_EVENT = "formix:auth-expired";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s — handles Render cold-start
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    throw new ApiError(0, `Could not reach the Formix server at ${API_BASE} — is the backend running?`);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? message;
    } catch { /* non-JSON error body */ }

    // Only treat a 401 as an expired/invalid session when the client-side
    // expiry confirms the token is no longer valid. A 401 while the token is
    // still within its 30-day window is most likely a transient server error;
    // clearing the session in that case would log the user out unnecessarily.
    if (res.status === 401 && token && !isSessionValid()) {
      clearStoredToken();
      if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    throw new ApiError(res.status, message);
  }
  // 204 No Content has no body
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Like `request`, but for multipart/form-data bodies (file uploads) — never
 *  sets a Content-Type header, so the browser fills in the multipart boundary. */
async function requestMultipart<T>(path: string, body: FormData): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body });
  } catch {
    throw new ApiError(0, `Could not reach the Formix server at ${API_BASE} — is the backend running?`);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const responseBody = await res.json();
      message = responseBody?.detail ?? message;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function register(email: string, password: string, name?: string): Promise<AuthResult> {
  return request<AuthResult>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return request<AuthResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function getProjects(): Promise<ProjectResponse[]> {
  return request<ProjectResponse[]>("/projects");
}

export function createProject(title: string): Promise<ProjectResponse> {
  return request<ProjectResponse>("/projects", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function getProject(id: string): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/${id}`);
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

// ── Forms (author-facing, project-scoped) ─────────────────────────────────────

/** Create a new form record inside a project (not yet published). */
export function createFormInProject(
  projectId: string,
  payload: FormCreate,
): Promise<FormCreateResponse> {
  return request<FormCreateResponse>(`/projects/${projectId}/forms`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Fetch the full author view of a form, including forml_source. */
export function getFormDetail(projectId: string, formId: string): Promise<FormDetail> {
  return request<FormDetail>(`/projects/${projectId}/forms/${formId}`);
}

export function deleteForm(projectId: string, formId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/forms/${formId}`, { method: "DELETE" });
}

/** Create a copy of a form (unpublished) within the same project. */
export function duplicateForm(formId: string): Promise<FormCreateResponse> {
  return request<FormCreateResponse>(`/forms/${formId}/duplicate`, { method: "POST" });
}

/** Set or clear a form's sequential link (next_form_id). */
export function linkForm(formId: string, nextFormId: string | null): Promise<{ ok: boolean; next_form_id: string | null }> {
  return request(`/forms/${formId}/link`, {
    method: "PATCH",
    body: JSON.stringify({ next_form_id: nextFormId }),
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
 * Publish a form. Sends the final compiled schema and the author's browser
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

/** Take a form offline. Existing submissions and compiled_schema are kept —
 *  re-publishing just flips is_published back on. */
export function unpublishForm(id: string): Promise<{ ok: boolean; is_published: boolean }> {
  return request(`/forms/${id}/unpublish`, { method: "POST" });
}

/** List submissions for a form (author view), paginated envelope. */
export function getResponsesPage(
  id: string,
  opts?: { limit?: number; offset?: number; sort?: "asc" | "desc" },
): Promise<PaginatedSubmissions> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  if (opts?.sort) params.set("sort", opts.sort);
  const qs = params.toString();
  return request<PaginatedSubmissions>(`/forms/${id}/responses${qs ? `?${qs}` : ""}`);
}

/** All submissions for a form as a plain array (capped at 500 — the backend's
 *  page-size ceiling). Used by callers that want the old "just give me
 *  everything" shape (the workspace's Submissions panel and rename-detection
 *  check); anything that needs real pagination should call getResponsesPage. */
export function getResponses(id: string): Promise<SubmissionRecord[]> {
  return getResponsesPage(id, { limit: 500 }).then((page) => page.items);
}

/** Fetch a single submission (author view) — used by the full-page "Open Submission" view. */
export function getResponse(formId: string, submissionId: string): Promise<SubmissionRecord> {
  return request<SubmissionRecord>(`/forms/${formId}/responses/${submissionId}`);
}

/** Bulk-delete every submission for a form (author view). Used by the "Rename & Delete" flow. */
export function deleteAllResponses(formId: string): Promise<{ ok: boolean; deleted: number }> {
  return request(`/forms/${formId}/responses`, { method: "DELETE" });
}

/** Delete a single submission (author view) — the response-management table's per-row delete. */
export function deleteResponse(formId: string, submissionId: string): Promise<{ ok: boolean }> {
  return request(`/forms/${formId}/responses/${submissionId}`, { method: "DELETE" });
}

/** Aggregate analytics for a form (author view): volume by day, device/browser
 *  breakdowns, average completion time. Raw numbers only — no charting here. */
export function getFormAnalytics(formId: string): Promise<FormAnalytics> {
  return request<FormAnalytics>(`/forms/${formId}/analytics`);
}

/** Absolute URL to download this form's responses as CSV or XLSX. Not fetched
 *  via `request()` — callers navigate the browser to this URL directly (or
 *  open it in a new tab) so the browser's native download handling applies,
 *  since the endpoint requires the Bearer token as a query-string workaround
 *  is undesirable; instead this is used with an authenticated fetch + blob
 *  download in the UI layer. */
export function getExportUrl(formId: string, format: "csv" | "xlsx"): string {
  return `${API_BASE}/forms/${formId}/responses/export?format=${format}`;
}

/** Download a form's responses as CSV/XLSX and trigger a browser save,
 *  carrying the auth token as a header (the export endpoint is author-only). */
export async function downloadExport(formId: string, format: "csv" | "xlsx", filenameHint: string): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(getExportUrl(formId, format), { headers });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? message;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameHint}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary");
}

export function getDashboardForms(): Promise<DashboardFormRow[]> {
  return request<DashboardFormRow[]>("/dashboard/forms");
}

// ── Public respondent routes (no auth) ─────────────────────────────────────────

/**
 * Fetch a published form's compiled schema.
 * Throws ApiError(404) if the form doesn't exist or isn't published.
 * Pass an existing `session` id to keep a respondent's session stable across
 * a chained multi-form flow; omit it to mint a new one.
 */
export function getForm(id: string, session?: string): Promise<PublicFormResponse> {
  const query = session ? `?session=${encodeURIComponent(session)}` : "";
  return request<PublicFormResponse>(`/forms/${id}${query}`);
}

/**
 * Submit a respondent's answers for a published form.
 * `data` is the {fieldName: value} map collected from the form fields.
 * `sessionId` correlates this submission with others in the same chained flow.
 */
export function submitForm(
  id: string,
  data: Record<string, string>,
  sessionId?: string,
): Promise<SubmitResponse> {
  return request<SubmitResponse>(`/forms/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ data, session_id: sessionId }),
  });
}

/**
 * Submit a respondent's answers for a form that includes one or more file
 * uploads (fields of type `file`/`image`/`pdf`/`document`).
 * `files` is keyed the same way as `data` — each entry may hold multiple
 * File objects when the field allows `multiple`.
 */
export function submitFormWithFiles(
  id: string,
  data: Record<string, string>,
  files: Record<string, File[]>,
  sessionId?: string,
): Promise<SubmitResponse> {
  const formData = new FormData();
  formData.append("data", JSON.stringify(data));
  if (sessionId) formData.append("session_id", sessionId);
  for (const [fieldName, selected] of Object.entries(files)) {
    for (const file of selected) {
      formData.append(`file__${fieldName}`, file, file.name);
    }
  }
  return requestMultipart<SubmitResponse>(`/forms/${id}/submit-multipart`, formData);
}
