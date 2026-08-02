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
  avatar_url?: string | null;
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

/** Chart data for the dashboard's activity row (one call, three charts). */
export interface DashboardActivity {
  forms_by_day: AnalyticsDayCount[];
  submissions_by_day: AnalyticsDayCount[];
  top_forms: DashboardFormRow[];
}

// Profile
export interface ProfileUpdate {
  name?: string;
  avatar_url?: string;
}

export interface ProfileDayCount {
  date: string;
  count: number;
}

export interface ProfileResponse {
  user: UserResponse;
  member_since: string;
  total_forms: number;
  published_forms: number;
  total_submissions: number;
  /** Forms created per day over the last year — backs the profile heatmap. */
  forms_by_day: ProfileDayCount[];
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
    // 120s — Render free tier cold-starts can take ~50s, plus first-request
    // latency; 65s was too tight and occasionally killed the very request that
    // was doing the cold start (the reset-password "could not reach the server"
    // reports). A scheduled keep-alive ping keeps it warm in practice; this is
    // the safety net for when that misses.
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (fetchErr) {
    const isTimeout = fetchErr instanceof DOMException && fetchErr.name === "AbortError";
    throw new ApiError(
      0,
      isTimeout
        ? `The server is taking a while to wake up (Render cold start) — please try again in a moment.`
        : `Could not reach the Formix server at ${API_BASE} — is the backend running?`,
    );
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? message;
    } catch { /* non-JSON error body */ }

    // Only treat a 401 as an expired/invalid session when either (a) the
    // client-side expiry timestamp confirms the token is past its 30-day
    // window, or (b) the backend says the token itself is unverifiable
    // ("Could not validate credentials" / "User not found" — the exact
    // messages emitted by backend/auth.py's decode_access_token / user lookup
    // when the signature, exp claim, or user record fails). Case (b) matters:
    // if the backend's FORMIX_JWT_SECRET was rotated, the token sits happily
    // inside its client-side window yet 401s on every call, leaving the user
    // stranded on "Failed to load workspace". Any OTHER 401 body is treated as
    // a transient server error and left alone, so we never log someone out on
    // an unrelated backend hiccup.
    if (res.status === 401 && token) {
      const authFailDetails = ["could not validate credentials", "user not found", "not authenticated"];
      const detailSaysAuthFailed = authFailDetails.some((d) => message.toLowerCase().includes(d));
      if (!isSessionValid() || detailSaysAuthFailed) {
        clearStoredToken();
        if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
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

/** Current user for a stored session — used by the OAuth callback page after
 *  the backend redirects back with a fresh token. */
export function getMe(): Promise<UserResponse> {
  return request<UserResponse>("/auth/me");
}

export interface ForgotPasswordResult {
  message: string;
  /** Dev-mode only — a reset link the backend returned instead of emailing it
   *  (only populated when no SMTP is configured). */
  reset_link?: string | null;
}

/** Kick off a password reset. In dev mode the backend returns reset_link so
 *  the flow works without email infrastructure. */
export function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  return request<ForgotPasswordResult>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

/** Entry point that starts the "Continue with Google / GitHub" redirect flow.
 *  The backend does the whole dance and bounces back to
 *  /auth/oauth/callback?token=... when done. */
export function oauthLoginUrl(provider: "google" | "github"): string {
  return `${API_BASE}/auth/oauth/${provider}`;
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

// ── Formix AI (LLM-backed chat, backend/routers/ai.py) ───────────────────────

// These mirror backend/schemas.py + lib/use-forml-compiler.ts exactly — the
// backend threads the WASM compiler's own FormlDiagnostic shape straight
// through to the model, so the client sends what it already has.

export interface AiDiagnosticInput {
  line: number;
  col: number;
  severity: "error" | "warning" | "info";
  message: string;
}

/** One conversation turn threaded into a chat request. `forml_code` is only
 *  meaningful for assistant turns — the full revised .forml source that turn
 *  produced (see backend/schemas.py AiHistoryMessage). */
export interface AiHistoryMessageInput {
  role: "user" | "assistant";
  content: string;
  forml_code?: string | null;
}

/** Body for POST /ai/forms/{id}/chat — the full contract the client sends on
 *  every request (source, diagnostics, selection, recent messages verbatim,
 *  one-line summary of older history, and the repair loop's context when this
 *  call is a compile-and-repair follow-up). */
export interface AiChatRequestPayload {
  form_id: string;
  user_message: string;
  source: string;
  diagnostics: AiDiagnosticInput[];
  selection: string;
  recent_messages: AiHistoryMessageInput[];
  history_summary: string;
  repair_context?: { attempt: number; errors: AiDiagnosticInput[] } | null;
}

/** SSE events streamed by the chat endpoint. `revised_source` is null on a
 *  conversational turn (no form edit); a string on an edit turn. */
export type AiChatEvent =
  | { type: "delta"; text: string }
  | { type: "result"; explanation: string; revised_source: string | null }
  | { type: "error"; message: string };

export interface AiHistoryRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  revised_source?: string | null;
  created_at: string;
}

export interface AiHistoryResponse {
  messages: AiHistoryRecord[];
}

export function getAiHistory(formId: string): Promise<AiHistoryRecord[]> {
  return request<AiHistoryResponse>(`/ai/forms/${formId}/history`).then((r) => r.messages);
}

/** Persist one completed turn (user message + assistant reply) after the
 *  client's compile-and-repair loop resolves — server-side history survives
 *  reloads (the localStorage history this replaces). */
export function appendAiMessage(
  formId: string,
  payload: { user_message: string; assistant_message: string; revised_source?: string | null },
): Promise<{ ok: boolean; count: number }> {
  return request(`/ai/forms/${formId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function clearAiHistory(formId: string): Promise<{ ok: boolean; count: number }> {
  return request(`/ai/forms/${formId}/messages`, { method: "DELETE" });
}

/**
 * Run one AI chat turn, consuming the SSE stream as it arrives.
 *
 * Calls `onEvent` for each parsed SSE event (delta / result / error) in real
 * time, so the panel can render the explanation while the model is still
 * producing it. Throws ApiError on a non-OK HTTP response.
 */
export async function chatAiStream(
  formId: string,
  payload: AiChatRequestPayload,
  onEvent: (evt: AiChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ai/forms/${formId}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (fetchErr) {
    const isAbort = fetchErr instanceof DOMException && fetchErr.name === "AbortError";
    throw new ApiError(0, isAbort ? "Cancelled" : `Could not reach the Formix server at ${API_BASE} — is the backend running?`);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? message;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, message);
  }

  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE events are separated by a blank line; extract as many complete
    // events as have arrived so far and keep the partial tail in the buffer.
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const dataText = line.slice(5).trim();
        if (!dataText) continue;
        try {
          onEvent(JSON.parse(dataText) as AiChatEvent);
        } catch { /* ignore a malformed event rather than killing the stream */ }
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary");
}

export function getDashboardForms(): Promise<DashboardFormRow[]> {
  return request<DashboardFormRow[]>("/dashboard/forms");
}

/** Chart data for the dashboard's activity row (forms/responses per day + top forms). */
export function getDashboardActivity(): Promise<DashboardActivity> {
  return request<DashboardActivity>("/dashboard/activity");
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function getProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>("/profile");
}

/** Update editable profile fields (name, avatar). Only fields sent are changed. */
export function updateProfile(payload: ProfileUpdate): Promise<UserResponse> {
  return request<UserResponse>("/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
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
