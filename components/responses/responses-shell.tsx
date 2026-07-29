"use client";

/**
 * components/responses/responses-shell.tsx
 * Response management: a dynamic table (fixed metadata columns + one column
 * per form field, discovered from the actual submitted data) with search,
 * sort, filters, and pagination — all client-side over a single fetch via
 * the existing paginated responses endpoint (reused, not duplicated: up to
 * its 500-row page-size ceiling). Export buttons call the existing backend
 * export endpoint directly — no CSV/XLSX generation logic lives here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  Trash2,
  Eye,
  Download,
  FileSpreadsheet,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  getFormDetail,
  getResponsesPage,
  deleteResponse,
  downloadExport,
  ApiError,
  API_BASE,
  type FormDetail,
  type SubmissionRecord,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ResponseDetailDialog } from "@/components/responses/response-detail-dialog";
import { FullPageLoader } from "@/components/ui/full-page-loader";

const FETCH_LIMIT = 500; // the backend endpoint's own page-size ceiling
const PAGE_SIZES = [10, 25, 50, 100];
const ALL = "__all__";

function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function timeTakenSeconds(s: SubmissionRecord): number | null {
  if (!s.started_at) return null;
  const delta = (new Date(s.submitted_at).getTime() - new Date(s.started_at).getTime()) / 1000;
  return delta >= 0 ? delta : null;
}

interface UploadedFileMeta { name: string; size: number; mimeType: string | null; url: string; }
function isUploadedFileList(value: unknown): value is UploadedFileMeta[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((v) => v && typeof v === "object" && typeof (v as UploadedFileMeta).url === "string");
}

function FieldCell({ value }: { value: unknown }) {
  if (isUploadedFileList(value)) {
    return (
      <div className="flex flex-col gap-0.5">
        {value.map((f, i) => (
          <a key={`${f.url}-${i}`} href={`${API_BASE}${f.url}`} target="_blank" rel="noopener noreferrer" className="truncate text-accent underline-offset-2 hover:underline">
            {f.name}
          </a>
        ))}
      </div>
    );
  }
  return <>{String(value ?? "")}</>;
}

type SortKey = "submitted_at" | "device" | "browser" | "time_taken" | { field: string };
type SortDir = "asc" | "desc";

function sortKeyId(key: SortKey): string {
  return typeof key === "string" ? key : `field:${key.field}`;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3 text-accent" /> : <ArrowDown className="h-3 w-3 text-accent" />;
}

function sortValue(s: SubmissionRecord, key: SortKey): { num?: number; str?: string } {
  if (key === "submitted_at") return { num: new Date(s.submitted_at).getTime() };
  if (key === "device") return { str: (s.device ?? "").toLowerCase() };
  if (key === "browser") return { str: (s.browser ?? "").toLowerCase() };
  if (key === "time_taken") { const t = timeTakenSeconds(s); return t === null ? {} : { num: t }; }
  const raw = s.data[key.field];
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw === "number") return { num: raw };
  const asNum = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isNaN(asNum) && typeof raw !== "object") return { num: asNum };
  return { str: String(raw).toLowerCase() };
}

export function ResponsesShell({ projectId, formId }: { projectId: string; formId: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [items, setItems] = useState<SubmissionRecord[] | null>(null);
  const [totalOnServer, setTotalOnServer] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState(ALL);
  const [browserFilter, setBrowserFilter] = useState(ALL);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submitted_at", dir: "desc" });
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [viewing, setViewing] = useState<SubmissionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubmissionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/signin");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [formData, page1] = await Promise.all([
        getFormDetail(projectId, formId),
        getResponsesPage(formId, { limit: FETCH_LIMIT, sort: "desc" }),
      ]);
      setForm(formData);
      setItems(page1.items);
      setTotalOnServer(page1.total);
    } catch (err) {
      setError(describeError(err));
    }
  }, [projectId, formId]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const fieldColumns = useMemo(() => {
    if (!items) return [];
    const cols: string[] = [];
    const seen = new Set<string>();
    for (const s of items) {
      for (const key of Object.keys(s.data)) {
        if (!seen.has(key)) { seen.add(key); cols.push(key); }
      }
    }
    return cols;
  }, [items]);

  const deviceOptions = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.map((s) => s.device).filter((d): d is string => !!d))).sort();
  }, [items]);

  const browserOptions = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.map((s) => s.browser).filter((b): b is string => !!b))).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (deviceFilter !== ALL && s.device !== deviceFilter) return false;
      if (browserFilter !== ALL && s.browser !== browserFilter) return false;
      if (!q) return true;
      if (s.device?.toLowerCase().includes(q)) return true;
      if (s.browser?.toLowerCase().includes(q)) return true;
      if (s.id.toLowerCase().includes(q)) return true;
      return Object.values(s.data).some((v) => {
        if (isUploadedFileList(v)) return v.some((f) => f.name.toLowerCase().includes(q));
        return String(v ?? "").toLowerCase().includes(q);
      });
    });
  }, [items, search, deviceFilter, browserFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      const aMissing = va.num === undefined && va.str === undefined;
      const bMissing = vb.num === undefined && vb.str === undefined;
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;   // missing values always sort last
      if (bMissing) return -1;
      if (va.num !== undefined && vb.num !== undefined) return (va.num - vb.num) * mul;
      return String(va.str ?? va.num).localeCompare(String(vb.str ?? vb.num)) * mul;
    });
    return arr;
  }, [filtered, sort]);

  useEffect(() => { setPage(1); }, [search, deviceFilter, browserFilter, sort, pageSize]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (sortKeyId(prev.key) === sortKeyId(key)) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteResponse(formId, deleteTarget.id);
      setItems((prev) => prev?.filter((s) => s.id !== deleteTarget.id) ?? prev);
      setTotalOnServer((t) => Math.max(0, t - 1));
      toast.success("Response deleted");
      setDeleteTarget(null);
      setViewing(null);
    } catch (err) {
      toast.error(`Couldn't delete — ${describeError(err)}`);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, formId]);

  const handleExport = useCallback(async (format: "csv" | "xlsx") => {
    setExporting(format);
    try {
      const hint = (form?.title ?? "responses").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "responses";
      await downloadExport(formId, format, hint);
    } catch (err) {
      toast.error(`Export failed — ${describeError(err)}`);
    } finally {
      setExporting(null);
    }
  }, [formId, form?.title]);

  if (authLoading || !user) {
    return <FullPageLoader label="Loading responses…" />;
  }

  return (
    <div className="min-h-screen bg-background font-inter text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!form || !items ? (
          !error && (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-inter text-xl font-semibold text-foreground">Responses</h1>
                <p className="font-mono text-xs text-muted-foreground">
                  {form.title}
                  {totalOnServer > FETCH_LIMIT ? ` — showing the most recent ${FETCH_LIMIT} of ${totalOnServer}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={items.length === 0 || exporting !== null} onClick={() => handleExport("csv")}>
                  {exporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export CSV
                </Button>
                <Button variant="outline" size="sm" disabled={items.length === 0 || exporting !== null} onClick={() => handleExport("xlsx")}>
                  {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Export XLSX
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <Card className="py-10">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                    <EmptyTitle className="text-sm">No responses yet</EmptyTitle>
                    <EmptyDescription>Responses will appear here as soon as someone fills out the published form.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </Card>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-48">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search responses…"
                      className="pl-8"
                    />
                  </div>
                  <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                    <SelectTrigger size="sm" className="w-36"><SelectValue placeholder="Device" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All devices</SelectItem>
                      {deviceOptions.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={browserFilter} onValueChange={setBrowserFilter}>
                    <SelectTrigger size="sm" className="w-40"><SelectValue placeholder="Browser" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All browsers</SelectItem>
                      {browserOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Card className="py-0">
                  <CardContent className="px-0 py-0">
                    {totalFiltered === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">No responses match your search/filters.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("submitted_at")}>
                                Submission Time <SortIcon active={sortKeyId(sort.key) === "submitted_at"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("device")}>
                                Device <SortIcon active={sortKeyId(sort.key) === "device"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("browser")}>
                                Browser <SortIcon active={sortKeyId(sort.key) === "browser"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("time_taken")}>
                                Time Taken <SortIcon active={sortKeyId(sort.key) === "time_taken"} dir={sort.dir} />
                              </button>
                            </TableHead>
                            {fieldColumns.map((col) => (
                              <TableHead key={col}>
                                <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort({ field: col })}>
                                  {col} <SortIcon active={sortKeyId(sort.key) === `field:${col}`} dir={sort.dir} />
                                </button>
                              </TableHead>
                            ))}
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageItems.map((s) => {
                            const taken = timeTakenSeconds(s);
                            return (
                              <TableRow key={s.id} className="cursor-pointer" onClick={() => setViewing(s)}>
                                <TableCell className="text-muted-foreground">{new Date(s.submitted_at).toLocaleString()}</TableCell>
                                <TableCell className="text-muted-foreground">{s.device ?? "—"}</TableCell>
                                <TableCell className="max-w-32 truncate text-muted-foreground" title={s.browser ?? undefined}>{s.browser ?? "—"}</TableCell>
                                <TableCell className="text-muted-foreground">{taken !== null ? formatDuration(taken) : "—"}</TableCell>
                                {fieldColumns.map((col) => (
                                  <TableCell key={col} className="max-w-40 truncate"><FieldCell value={s.data[col]} /></TableCell>
                                ))}
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="icon-sm" aria-label="View response" onClick={(e) => { e.stopPropagation(); setViewing(s); }}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" aria-label="Delete response" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>
                      {totalFiltered === 0 ? "0" : `${(clampedPage - 1) * pageSize + 1}–${Math.min(clampedPage * pageSize, totalFiltered)}`} of {totalFiltered}
                    </span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger size="sm" className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={clampedPage <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <span className="font-mono text-xs text-muted-foreground">Page {clampedPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {viewing && (
        <ResponseDetailDialog
          submission={viewing}
          onClose={() => setViewing(null)}
          onDelete={() => setDeleteTarget(viewing)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the submission. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
