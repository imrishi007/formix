/**
 * lib/api.ts
 *
 * Typed fetch wrappers for the Formix FastAPI backend.
 * Single source of truth for the backend URL — set NEXT_PUBLIC_API_URL
 * in .env.local to override for production; defaults to localhost:8000.
 *
<<<<<<< HEAD
 * Both the editor publish flow (demo-ide-shell.tsx) and the public
 * respondent page (app/f/[formId]/form-renderer.tsx) import from here.
 * No component should ever hardcode the backend host directly.
=======
 * Both the workspace (components/workspace/*) and the public respondent
 * page (app/f/[formId]/form-renderer.tsx) import from here. No component
 * should ever hardcode the backend host directly.
>>>>>>> f6620dd (Complete Formix updates)
 */

export const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

<<<<<<< HEAD
// ── Types ─────────────────────────────────────────────────────────────────────

=======
// ── Auth token storage ───────────────────────────────────────────────────────
// A plain localStorage key, not React state — lib/auth-context.tsx wraps this
// in a context/hook for components, but request() below needs to read it
// synchronously on every call without importing React context machinery.

const TOKEN_STORAGE_KEY = "formix_auth_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_STORAGE_KEY);
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

export interface FormSummary {
  id: string;
  title: string;
  is_published: boolean;
  next_form_id?: string | null;
  created_at: string;
}

export interface ProjectDetail extends ProjectResponse {
  forms: FormSummary[];
}

// Forms
>>>>>>> f6620dd (Complete Formix updates)
export interface FormCreate {
  title: string;
  forml_source: string;
  compiled_schema?: unknown;
}

export interface FormUpdate {
  forml_source: string;
  compiled_schema?: unknown;
<<<<<<< HEAD
=======
  /** Only sent when the author explicitly accepts a rename suggestion. */
  title?: string;
>>>>>>> f6620dd (Complete Formix updates)
}

export interface FormCreateResponse {
  id: string;
  title: string;
  is_published: boolean;
  created_at: string;
}

<<<<<<< HEAD
=======
export interface FormDetail {
  id: string;
  project_id: string;
  title: string;
  forml_source: string;
  compiled_schema: Record<string, unknown> | null;
  is_published: boolean;
  next_form_id?: string | null;
  created_at: string;
  updated_at: string;
}

>>>>>>> f6620dd (Complete Formix updates)
export interface PublishResponse {
  form_id: string;
  public_url: string;
  embed_snippet: string;
}

export interface PublicFormResponse {
  id: string;
  title: string;
  compiled_schema: Record<string, unknown>;
<<<<<<< HEAD
=======
  session_id: string;
>>>>>>> f6620dd (Complete Formix updates)
}

export interface SubmitResponse {
  success: boolean;
  submission_id: string;
<<<<<<< HEAD
=======
  next_form_id?: string | null;
  session_id?: string | null;
>>>>>>> f6620dd (Complete Formix updates)
}

export interface SubmissionRecord {
  id: string;
  form_id: string;
<<<<<<< HEAD
=======
  respondent_session_id?: string | null;
>>>>>>> f6620dd (Complete Formix updates)
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

<<<<<<< HEAD
=======
/** Dispatched on `window` whenever a request that carried a Bearer token
 *  comes back 401 — i.e. the stored session is expired/invalid, as opposed
 *  to a bad-credentials 401 from /auth/login. lib/auth-context.tsx listens
 *  for this to clear its state and bounce to sign-in instead of leaving the
 *  app silently broken (every subsequent request would otherwise also fail
 *  with the same stale token). */
export const AUTH_EXPIRED_EVENT = "formix:auth-expired";

>>>>>>> f6620dd (Complete Formix updates)
async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
<<<<<<< HEAD
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
=======
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch {
    throw new ApiError(0, `Could not reach the Formix server at ${API_BASE} — is the backend running?`);
  }

>>>>>>> f6620dd (Complete Formix updates)
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? message;
    } catch { /* non-JSON error body */ }
<<<<<<< HEAD
=======

    if (res.status === 401 && token) {
      clearStoredToken();
      if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

>>>>>>> f6620dd (Complete Formix updates)
    throw new ApiError(res.status, message);
  }
  // 204 No Content has no body
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

<<<<<<< HEAD
// ── API functions ─────────────────────────────────────────────────────────────

/** Create a new form record (not yet published). Returns the new form ID. */
export function createForm(payload: FormCreate): Promise<FormCreateResponse> {
  return request<FormCreateResponse>("/forms", {
=======
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
>>>>>>> f6620dd (Complete Formix updates)
    method: "POST",
    body: JSON.stringify(payload),
  });
}

<<<<<<< HEAD
=======
/** Fetch the full author view of a form, including forml_source. */
export function getFormDetail(projectId: string, formId: string): Promise<FormDetail> {
  return request<FormDetail>(`/projects/${projectId}/forms/${formId}`);
}

export function deleteForm(projectId: string, formId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/forms/${formId}`, { method: "DELETE" });
}

/** Set or clear a form's sequential link (next_form_id). */
export function linkForm(formId: string, nextFormId: string | null): Promise<{ ok: boolean; next_form_id: string | null }> {
  return request(`/forms/${formId}/link`, {
    method: "PATCH",
    body: JSON.stringify({ next_form_id: nextFormId }),
  });
}

>>>>>>> f6620dd (Complete Formix updates)
/** Update an existing form's source and compiled schema. */
export function updateForm(id: string, payload: FormUpdate): Promise<void> {
  return request<void>(`/forms/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
<<<<<<< HEAD
 * Publish a form.  Sends the final compiled schema and the author's browser
=======
 * Publish a form. Sends the final compiled schema and the author's browser
>>>>>>> f6620dd (Complete Formix updates)
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

<<<<<<< HEAD
/**
 * Fetch a published form's compiled schema.
 * Throws ApiError(404) if the form doesn't exist or isn't published.
 */
export function getForm(id: string): Promise<PublicFormResponse> {
  return request<PublicFormResponse>(`/forms/${id}`);
=======
/** List all submissions for a form (author view). */
export function getResponses(id: string): Promise<SubmissionRecord[]> {
  return request<SubmissionRecord[]>(`/forms/${id}/responses`);
}

/** Fetch a single submission (author view) — used by the full-page "Open Submission" view. */
export function getResponse(formId: string, submissionId: string): Promise<SubmissionRecord> {
  return request<SubmissionRecord>(`/forms/${formId}/responses/${submissionId}`);
}

/** Bulk-delete every submission for a form (author view). Used by the "Rename & Delete" flow. */
export function deleteAllResponses(formId: string): Promise<{ ok: boolean; deleted: number }> {
  return request(`/forms/${formId}/responses`, { method: "DELETE" });
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
>>>>>>> f6620dd (Complete Formix updates)
}

/**
 * Submit a respondent's answers for a published form.
 * `data` is the {fieldName: value} map collected from the form fields.
<<<<<<< HEAD
=======
 * `sessionId` correlates this submission with others in the same chained flow.
>>>>>>> f6620dd (Complete Formix updates)
 */
export function submitForm(
  id: string,
  data: Record<string, string>,
<<<<<<< HEAD
): Promise<SubmitResponse> {
  return request<SubmitResponse>(`/forms/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

/** List all submissions for a form (author view). */
export function getResponses(id: string): Promise<SubmissionRecord[]> {
  return request<SubmissionRecord[]>(`/forms/${id}/responses`);
=======
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
>>>>>>> f6620dd (Complete Formix updates)
}
