"use client";

/**
 * components/analytics/analytics-shell.tsx
 * The per-form analytics page: header (name/status/publish toggle/public
 * URL/edit), overall stats, a daily traffic chart, and dynamic per-field
 * breakdowns. All data is real — GET /projects/{id}/forms/{id} for the
 * header, GET /forms/{id}/analytics for everything else.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Pencil,
  Link as LinkIcon,
  Copy,
  Inbox,
  CalendarClock,
  CalendarRange,
  CalendarDays,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  getFormDetail,
  getFormAnalytics,
  publishForm,
  unpublishForm,
  ApiError,
  type FormDetail,
  type FormAnalytics,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrafficChart } from "@/components/analytics/traffic-chart";
import { FieldAnalyticsCard } from "@/components/analytics/field-analytics-card";
import { FullPageLoader } from "@/components/ui/full-page-loader";

function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export function AnalyticsShell({ projectId, formId }: { projectId: string; formId: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [analytics, setAnalytics] = useState<FormAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/signin");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [formData, analyticsData] = await Promise.all([
        getFormDetail(projectId, formId),
        getFormAnalytics(formId),
      ]);
      setForm(formData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(describeError(err));
    }
  }, [projectId, formId]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const handleTogglePublish = useCallback(async (checked: boolean) => {
    if (!form) return;
    if (checked && !form.compiled_schema) {
      toast.error("This form hasn't been compiled yet — open it in the editor and publish from there first.");
      return;
    }
    setTogglingPublish(true);
    try {
      if (checked) {
        await publishForm(form.id, form.compiled_schema, window.location.origin);
        toast.success("Form published");
      } else {
        await unpublishForm(form.id);
        toast.success("Form unpublished");
      }
      setForm((prev) => (prev ? { ...prev, is_published: checked } : prev));
    } catch (err) {
      toast.error(`Couldn't update publish status — ${describeError(err)}`);
    } finally {
      setTogglingPublish(false);
    }
  }, [form]);

  const publicUrl = form ? `${origin}/f/${form.id}` : "";

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(publicUrl).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => toast.error("Couldn't copy to clipboard."),
    );
  }, [publicUrl]);

  if (authLoading || !user) {
    return <FullPageLoader label="Loading analytics…" />;
  }

  return (
    <div className="min-h-screen bg-background font-inter text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!form || !analytics ? (
          !error && (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )
        ) : (
          <>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <Card className="mb-6 py-5">
              <CardContent className="flex flex-col gap-4 px-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate font-inter text-xl font-semibold text-foreground">{form.title}</h1>
                    {form.is_published ? (
                      <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">Published</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Draft</Badge>
                    )}
                  </div>
                  {form.is_published ? (
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-xs text-accent underline-offset-2 hover:underline">
                        {publicUrl}
                      </a>
                      <button
                        type="button"
                        onClick={copyUrl}
                        aria-label="Copy public link"
                        className="flex flex-none items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-inter text-[11px] text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
                      >
                        {copied ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
                      </button>
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-muted-foreground">Not published</p>
                  )}
                </div>

                <div className="flex flex-none items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.is_published}
                      disabled={togglingPublish}
                      onCheckedChange={handleTogglePublish}
                      aria-label={form.is_published ? "Unpublish form" : "Publish form"}
                    />
                    <span className="font-inter text-xs text-muted-foreground">
                      {form.is_published ? "Live" : "Offline"}
                    </span>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/editor/demo?project=${projectId}&form=${formId}`}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Stats ───────────────────────────────────────────────────── */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Total Responses", value: analytics.total_submissions, icon: <Inbox className="h-4 w-4" /> },
                { label: "Today", value: analytics.today_responses, icon: <CalendarClock className="h-4 w-4" /> },
                { label: "This Week", value: analytics.responses_last_7_days, icon: <CalendarRange className="h-4 w-4" /> },
                { label: "This Month", value: analytics.responses_last_30_days, icon: <CalendarDays className="h-4 w-4" /> },
              ].map((s) => (
                <Card key={s.label} className="py-4">
                  <CardHeader className="flex-row items-center justify-between gap-2 px-4">
                    <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-accent/10 text-accent">{s.icon}</span>
                  </CardHeader>
                  <CardContent className="px-4">
                    <p className="font-inter text-2xl font-semibold text-foreground">{s.value.toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
              <Card className="py-4">
                <CardHeader className="flex-row items-center justify-between gap-2 px-4">
                  <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Avg. Completion</CardTitle>
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-accent/10 text-accent"><Timer className="h-4 w-4" /></span>
                </CardHeader>
                <CardContent className="px-4">
                  <p className="font-inter text-2xl font-semibold text-foreground">{formatDuration(analytics.avg_completion_seconds)}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {analytics.completion_sample_size > 0
                      ? `based on ${analytics.completion_sample_size} timed response${analytics.completion_sample_size === 1 ? "" : "s"}`
                      : "no timed responses yet"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── Traffic chart ───────────────────────────────────────────── */}
            <Card className="mb-6 py-5">
              <CardHeader className="px-5">
                <CardTitle className="font-inter text-base font-semibold">Daily Responses</CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                <TrafficChart data={analytics.submissions_by_day} />
              </CardContent>
            </Card>

            {/* ── Per-field analytics ─────────────────────────────────────── */}
            <div>
              <h2 className="mb-3 font-inter text-base font-semibold text-foreground">Field Responses</h2>
              {analytics.fields.length === 0 ? (
                <Card className="py-8">
                  <CardContent className="px-5 text-center text-sm text-muted-foreground">
                    {form.compiled_schema
                      ? "This form has no fields yet."
                      : "This form hasn't been compiled yet — field analytics will appear once it's published."}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {analytics.fields.map((field) => (
                    <FieldAnalyticsCard key={field.name} field={field} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
