"use client";

/**
 * components/dashboard/dashboard-shell.tsx
 * The Formix dashboard: cross-project overview stats + a flat table of every
 * form the signed-in author owns, with per-form actions. All data comes from
 * GET /dashboard/summary and GET /dashboard/forms — nothing here is mocked.
 */

import { useCallback, useEffect, useState } from "react";
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
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  getDashboardSummary,
  getDashboardForms,
  deleteForm,
  duplicateForm,
  ApiError,
  type DashboardSummary,
  type DashboardFormRow,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function DashboardShell() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/signin");
  }, [authLoading, user, router]);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [forms, setForms] = useState<DashboardFormRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const [shareFor, setShareFor] = useState<DashboardFormRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardFormRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryData, formsData] = await Promise.all([getDashboardSummary(), getDashboardForms()]);
      setSummary(summaryData);
      setForms(formsData);
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

  return (
    <div className="min-h-screen bg-background font-inter text-foreground">
      <header className="flex h-14 flex-none items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex flex-none items-center gap-2 rounded-md px-1 py-1 transition-opacity hover:opacity-80">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/25">
              <span className="font-inter text-[10px] font-black tracking-tighter text-accent">FX</span>
            </div>
            <span className="hidden font-inter text-sm font-semibold tracking-tight text-foreground sm:inline">Formix</span>
          </Link>
          <span className="h-4 w-px flex-none bg-border" />
          <div className="flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1.5 font-inter text-sm text-accent">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/editor/demo">Open Editor</Link>
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Account menu — signed in as ${user.email}`}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent/15 text-accent transition-colors hover:bg-accent/25"
              >
                <UserIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/editor/demo">
                  <Pencil className="h-3.5 w-3.5" /> Editor
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>
                <LogOut className="h-3.5 w-3.5" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <Card key={s.label} className="py-4">
              <CardHeader className="flex-row items-center justify-between gap-2 px-4">
                <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </CardTitle>
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-accent/10 text-accent">{s.icon}</span>
              </CardHeader>
              <CardContent className="px-4">
                {summary ? (
                  <p className="font-inter text-2xl font-semibold text-foreground">{s.value.toLocaleString()}</p>
                ) : (
                  <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="py-0">
          <CardHeader className="border-b border-border px-5 py-4">
            <CardTitle className="font-inter text-base font-semibold">Your Forms</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {forms === null && !error && (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
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

            {forms && forms.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Edited</TableHead>
                    <TableHead>Last Response</TableHead>
                    <TableHead className="text-right">Responses</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((row) => {
                    const publicUrl = `${origin}/f/${row.id}`;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-56">
                          <div className="truncate font-medium text-foreground">{row.title}</div>
                          <div className="truncate font-mono text-[11px] text-muted-foreground">{row.project_title}</div>
                        </TableCell>
                        <TableCell>
                          {row.is_published ? (
                            <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">Published</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-40">
                          {row.is_published ? (
                            <a
                              href={publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 truncate font-mono text-xs text-accent underline-offset-2 hover:underline"
                            >
                              <LinkIcon className="h-3 w-3 flex-none" />
                              <span className="truncate">{`/f/${row.id}`}</span>
                            </a>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">Not published</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(row.updated_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{row.last_response_at ? formatDateTime(row.last_response_at) : "No responses yet"}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">{row.submission_count}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.title}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              <DropdownMenuItem asChild>
                                <Link href={`/analytics/${row.project_id}/${row.id}`}>
                                  <BarChart3 className="h-3.5 w-3.5" /> Analytics
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/responses/${row.project_id}/${row.id}`}>
                                  <Inbox className="h-3.5 w-3.5" /> Responses
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/editor/demo?project=${row.project_id}&form=${row.id}`}>
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Link>
                              </DropdownMenuItem>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
