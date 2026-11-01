"use client";

/**
 * components/dashboard/dashboard-shell.tsx
 * The Formix dashboard: cross-project overview stats + a flat table of every
 * form the signed-in author owns, with per-form actions. All data comes from
 * GET /dashboard/summary and GET /dashboard/forms — nothing here is mocked.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  FileText,
  Inbox,
  Zap,
  CalendarClock,
  CalendarRange,
  MoreHorizontal,
  BarChart3,
  Pencil,
  Copy,
  Trash2,
  Share2,
  LayoutDashboard,
  Link as LinkIcon,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  getDashboardSummary,
  getDashboardForms,
  getDashboardActivity,
  deleteForm,
  duplicateForm,
  downloadExport,
  ApiError,
  type DashboardSummary,
  type DashboardFormRow,
  type DashboardActivity,
} from "@/lib/api";

import { FormixLogo } from "@/components/brand/formix-logo";
import { ProfileMenu } from "@/components/brand/profile-menu";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PublishDialog } from "@/components/workspace/publish-dialog";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { ActivityCharts } from "@/components/dashboard/activity-charts";

function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface StatDef {
  label: string;
  value: number;
  icon: React.ReactNode;
}

type FormStatus = "all" | "published" | "draft";
type FormSort = "updated" | "responses" | "title";

export function DashboardShell() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/signin");
  }, [authLoading, user, router]);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [forms, setForms] = useState<DashboardFormRow[] | null>(null);
  const [activity, setActivity] = useState<DashboardActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const [shareFor, setShareFor] = useState<DashboardFormRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardFormRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ formId: string; format: "csv" | "xlsx" } | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FormStatus>("all");
  const [sort, setSort] = useState<FormSort>("updated");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryData, formsData, activityData] = await Promise.all([
        getDashboardSummary(),
        getDashboardForms(),
        getDashboardActivity(),
      ]);
      setSummary(summaryData);
      setForms(formsData);
      setActivity(activityData);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const handleDuplicate = useCallback(async (row: DashboardFormRow) => {
    setDuplicatingId(row.id);
    try {
      const created = await duplicateForm(row.id);
      toast.success(`Duplicated as "${created.title}"`);
      await load();
    } catch (err) {
      toast.error(`Couldn't duplicate — ${describeError(err)}`);
    } finally {
      setDuplicatingId(null);
    }
  }, [load]);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteForm(deleteTarget.project_id, deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(`Couldn't delete — ${describeError(err)}`);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, load]);

  const handleExport = useCallback(async (form: DashboardFormRow, format: "csv" | "xlsx") => {
    setExporting({ formId: form.id, format });
    try {
      await downloadExport(form.id, format, `${form.title}-responses`);
      toast.success(`${form.title} exported as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(`Couldn't export responses — ${describeError(err)}`);
    } finally {
      setExporting(null);
    }
  }, []);

  if (authLoading || !user) {
    return <FullPageLoader label="Loading dashboard…" />;
  }

  const stats: StatDef[] = [
    { label: "Total Forms", value: summary?.total_forms ?? 0, icon: <FileText className="h-4 w-4" /> },
    { label: "Total Responses", value: summary?.total_submissions ?? 0, icon: <Inbox className="h-4 w-4" /> },
    { label: "Active Forms", value: summary?.published_forms ?? 0, icon: <Zap className="h-4 w-4" /> },
    { label: "Today's Responses", value: summary?.today_responses ?? 0, icon: <CalendarClock className="h-4 w-4" /> },
    { label: "Weekly Responses", value: summary?.submissions_last_7_days ?? 0, icon: <CalendarRange className="h-4 w-4" /> },
  ];

  const visibleForms = useMemo(() => {
    const normalized_query = query.trim().toLocaleLowerCase();
    return [...(forms ?? [])]
      .filter((form) => {
        const matches_status = status === "all" || (status === "published" ? form.is_published : !form.is_published);
        const matches_query = !normalized_query || `${form.title} ${form.project_title}`.toLocaleLowerCase().includes(normalized_query);
        return matches_status && matches_query;
      })
      .sort((a, b) => {
        if (sort === "responses") return b.submission_count - a.submission_count;
        if (sort === "title") return a.title.localeCompare(b.title);
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [forms, query, sort, status]);

  const firstName = user.name?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-(--bg-base) text-(--ink-primary)">
      <header className="glass-panel sticky top-0 z-40 flex h-16 flex-none items-center justify-between rounded-none border-x-0 border-t-0 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex flex-none items-center gap-2 rounded-md px-1 py-1 transition-opacity hover:opacity-80">
            {/* Shared brand mark — single component, replaces the old FX box */}
            <FormixLogo size={20} variant="color" aria-hidden="true" />
            <span className="hidden text-sm font-semibold tracking-tight text-(--ink-primary) sm:inline">Formix</span>
          </Link>
          <ProfileMenu />
          <span className="h-4 w-px flex-none bg-(--border-hairline)" />
          <div className="flex items-center gap-1.5 rounded-md bg-(--accent-primary-tint) px-2 py-1.5 text-sm text-(--accent-primary)">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm" className="sm:hidden">
            <Link href="/editor/demo"><Plus className="h-4 w-4" /> New form</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">Overview</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-(--ink-primary) sm:text-4xl">
              {firstName ? `Good to see you, ${firstName}.` : "Your workspace"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-(--ink-secondary) sm:text-base">
              Track responses, find a form, or jump back into the editor.
            </p>
          </div>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/editor/demo"><Plus className="h-4 w-4" /> Create form</Link>
          </Button>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-(--radius-md) border border-(--accent-danger)/30 bg-(--accent-danger)/5 px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-(--accent-danger)" />
            <p className="text-sm text-(--accent-danger)">{error}</p>
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="gap-0 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium tracking-[0.06em] text-(--ink-tertiary) uppercase sm:text-xs">{s.label}</span>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-(--radius-sm) bg-(--accent-primary-tint) text-(--accent-primary)">{s.icon}</span>
              </div>
              <div className="mt-2">
                {summary ? (
                  <p className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-(--ink-primary) sm:text-[32px]">{s.value.toLocaleString()}</p>
                ) : (
                  <div className="h-8 w-16 animate-pulse rounded bg-(--bg-subtle)" />
                )}
              </div>
            </Card>
          ))}
        </div>

        <div className="mb-8">
          {activity ? (
            <ActivityCharts activity={activity} />
          ) : (
            <div className="flex h-40 items-center justify-center gap-2 rounded-(--radius-lg) border border-dashed border-(--border-hairline) text-(--ink-tertiary)">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading activity…</span>
            </div>
          )}
        </div>

        <div className="card-base overflow-hidden">
          <div className="border-b border-(--border-hairline) p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.015em]">Your forms</h2>
                <p className="mt-1 text-sm text-(--ink-tertiary)">
                  {forms ? `${visibleForms.length} of ${forms.length} forms` : "Loading your forms…"}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--ink-tertiary)" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search forms or projects"
                    aria-label="Search forms or projects"
                    className="h-10 bg-(--bg-subtle) pl-9 pr-9"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-(--radius-sm) text-(--ink-tertiary) transition-colors hover:bg-(--bg-surface) hover:text-(--ink-primary) active:scale-95"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 rounded-(--radius-md) bg-(--bg-subtle) p-1" aria-label="Filter forms by status">
                  {(["all", "published", "draft"] as FormStatus[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      aria-pressed={status === value}
                      className={`rounded-[10px] px-3 py-1.5 text-xs font-medium capitalize transition-all active:scale-[0.97] ${
                        status === value
                          ? "bg-(--bg-surface) text-(--ink-primary) shadow-(--shadow-sm)"
                          : "text-(--ink-tertiary) hover:text-(--ink-primary)"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as FormSort)}
                  aria-label="Sort forms"
                  className="h-10 rounded-(--radius-md) border border-(--border-hairline) bg-(--bg-surface) px-3 text-xs font-medium text-(--ink-secondary) outline-none transition-shadow focus:ring-2 focus:ring-(--accent-primary)/30"
                >
                  <option value="updated">Recently edited</option>
                  <option value="responses">Most responses</option>
                  <option value="title">Name A–Z</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-0">
            {forms === null && !error && (
              <div className="flex items-center justify-center gap-2 py-16 text-(--ink-secondary)">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading forms…</span>
              </div>
            )}

            {forms?.length === 0 && (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FileText /></EmptyMedia>
                  <EmptyTitle className="text-sm">No forms yet</EmptyTitle>
                  <EmptyDescription>Create your first form in the editor to see it here.</EmptyDescription>
                </EmptyHeader>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/editor/demo">Open Editor</Link>
                </Button>
              </Empty>
            )}

            {forms && forms.length > 0 && visibleForms.length === 0 && (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Search /></EmptyMedia>
                  <EmptyTitle className="text-sm">No matching forms</EmptyTitle>
                  <EmptyDescription>Try another name or clear the active filters.</EmptyDescription>
                </EmptyHeader>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => { setQuery(""); setStatus("all"); }}
                >
                  Clear filters
                </Button>
              </Empty>
            )}

            {visibleForms.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden xl:table-cell">URL</TableHead>
                    <TableHead className="hidden 2xl:table-cell">Created</TableHead>
                    <TableHead>Last Edited</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Response</TableHead>
                    <TableHead className="text-right">Responses</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleForms.map((row) => {
                    const publicUrl = `${origin}/f/${row.id}`;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-56">
                          <div className="truncate font-medium text-(--ink-primary)">{row.title}</div>
                          <div className="truncate text-xs text-(--ink-tertiary)">{row.project_title}</div>
                        </TableCell>
                        <TableCell>
                          {row.is_published ? (
                            <Badge variant="success">Published</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden max-w-40 xl:table-cell">
                          {row.is_published ? (
                            <a
                              href={publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 truncate text-xs text-(--accent-primary) underline-offset-2 hover:underline"
                            >
                              <LinkIcon className="h-3 w-3 flex-none" />
                              <span className="truncate">{`/f/${row.id}`}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-(--ink-tertiary)">Not published</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-(--ink-tertiary) 2xl:table-cell">{formatDate(row.created_at)}</TableCell>
                        <TableCell className="text-(--ink-tertiary)">{formatDate(row.updated_at)}</TableCell>
                        <TableCell className="hidden text-(--ink-tertiary) lg:table-cell">{row.last_response_at ? formatDateTime(row.last_response_at) : "No responses yet"}</TableCell>
                        <TableCell className="text-right font-medium text-(--ink-primary)">{row.submission_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/editor/demo?project=${row.project_id}&form=${row.id}`}
                              className="flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--ink-tertiary) transition-colors hover:bg-(--bg-subtle) hover:text-(--accent-primary)"
                              aria-label={`Edit ${row.title}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <Link
                              href={`/analytics/${row.project_id}/${row.id}`}
                              className="flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--ink-tertiary) transition-colors hover:bg-(--bg-subtle) hover:text-(--accent-primary)"
                              aria-label={`View analytics for ${row.title}`}
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={row.submission_count === 0 || exporting !== null}
                              onClick={() => handleExport(row, "csv")}
                              title="Export responses as CSV"
                              aria-label={`Export ${row.title} responses as CSV`}
                            >
                              {exporting?.formId === row.id && exporting.format === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={row.submission_count === 0 || exporting !== null}
                              onClick={() => handleExport(row, "xlsx")}
                              title="Export responses as Excel"
                              aria-label={`Export ${row.title} responses as Excel`}
                            >
                              {exporting?.formId === row.id && exporting.format === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${row.title}`}>
                                  <MoreHorizontal className="h-4 w-4 text-(--ink-tertiary)" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-44">
                                <DropdownMenuItem
                                  disabled={duplicatingId === row.id}
                                  onClick={() => handleDuplicate(row)}
                                >
                                  <Copy className="h-3.5 w-3.5" /> {duplicatingId === row.id ? "Duplicating…" : "Duplicate"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!row.is_published}
                                  onClick={() => row.is_published && setShareFor(row)}
                                >
                                  <Share2 className="h-3.5 w-3.5" /> Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}>
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>

      {shareFor && (
        <PublishDialog
          url={`${origin}/f/${shareFor.id}`}
          embed={`<iframe src="${origin}/f/${shareFor.id}" width="100%" height="600" frameborder="0" style="border:none;"></iframe>`}
          onClose={() => setShareFor(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this form?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  This permanently deletes &ldquo;{deleteTarget.title}&rdquo;
                  {deleteTarget.submission_count > 0
                    ? ` and its ${deleteTarget.submission_count} submission${deleteTarget.submission_count === 1 ? "" : "s"}`
                    : ""}. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteConfirmed(); }}
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
