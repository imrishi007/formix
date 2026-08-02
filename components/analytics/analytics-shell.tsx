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
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  getFormDetail,
  getFormAnalytics,
  publishForm,
  unpublishForm,
  downloadExport,
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
import { ProfileMenu } from "@/components/brand/profile-menu";

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
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

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

  const handleExport = useCallback(async (format: "csv" | "xlsx") => {
    if (!form || exporting) return;
    setExporting(format);
    try {
      await downloadExport(form.id, format, `${form.title}-responses`);
      toast.success(`Responses exported as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(`Couldn't export responses — ${describeError(err)}`);
    } finally {
      setExporting(null);
    }
  }, [form, exporting]);

  if (authLoading || !user) {
    return <FullPageLoader label="Loading analytics…" />;
  }

  return (
    <div className="min-h-screen bg-(--bg-base) text-(--ink-primary)">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center gap-3">
          <ProfileMenu />
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs tracking-[0.08em] text-(--ink-tertiary) uppercase transition-colors hover:text-(--ink-primary)">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-(--radius-md) border border-(--accent-danger)/30 bg-(--accent-danger)/5 px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-(--accent-danger)" />
            <p className="text-sm text-(--accent-danger)">{error}</p>
          </div>
        )}

        {!form || !analytics ? (
          !error && (
            <div className="flex items-center justify-center gap-2 py-24 text-(--ink-secondary)">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )
        ) : (
          <>
            <div className="card-base mb-6 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-semibold text-(--ink-primary)">{form.title}</h1>
                    {form.is_published ? (
                      <Badge variant="success">Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </div>
                  {form.is_published ? (
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3.5 w-3.5 flex-none text-(--ink-tertiary)" />
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-(--accent-primary) underline-offset-2 hover:underline">
                        {publicUrl}
                      </a>
                      <button
                        type="button"
                        onClick={copyUrl}
                        aria-label="Copy public link"
                        className="flex flex-none items-center gap-1 rounded border border-(--border-hairline) bg-(--bg-surface) px-1.5 py-0.5 text-xs text-(--ink-tertiary) transition-colors hover:border-(--accent-primary)/50 hover:text-(--accent-primary)"
                      >
                        {copied ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-(--ink-tertiary)">Not published</p>
                  )}
                </div>

                <div className="flex flex-none flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={analytics.total_submissions === 0 || exporting !== null} onClick={() => handleExport("csv")}>
                    {exporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" disabled={analytics.total_submissions === 0 || exporting !== null} onClick={() => handleExport("xlsx")}>
                    {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                    Excel
                  </Button>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.is_published}
                      disabled={togglingPublish}
                      onCheckedChange={handleTogglePublish}
                      aria-label={form.is_published ? "Unpublish form" : "Publish form"}
                    />
                    <span className="text-xs text-(--ink-secondary)">
                      {form.is_published ? "Live" : "Offline"}
                    </span>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/editor/demo?project=${projectId}&form=${formId}`}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Total Responses", value: analytics.total_submissions, icon: <Inbox className="h-4 w-4" /> },
                { label: "Today", value: analytics.today_responses, icon: <CalendarClock className="h-4 w-4" /> },
                { label: "This Week", value: analytics.responses_last_7_days, icon: <CalendarRange className="h-4 w-4" /> },
                { label: "This Month", value: analytics.responses_last_30_days, icon: <CalendarDays className="h-4 w-4" /> },
              ].map((s) => (
                <Card key={s.label} className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs tracking-[0.08em] text-(--ink-tertiary) uppercase">{s.label}</span>
                    <span className="flex h-7 w-7 flex-none items-center justify-center text-(--ink-tertiary)">{s.icon}</span>
                  </div>
                  <div className="mt-2">
                    <p className="text-[32px] font-semibold leading-none text-(--ink-primary)">{s.value.toLocaleString()}</p>
                  </div>
                </Card>
              ))}
              <Card className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs tracking-[0.08em] text-(--ink-tertiary) uppercase">Avg. Completion</span>
                  <span className="flex h-7 w-7 flex-none items-center justify-center text-(--ink-tertiary)"><Timer className="h-4 w-4" /></span>
                </div>
                <div className="mt-2">
                  <p className="text-[32px] font-semibold leading-none text-(--ink-primary)">{formatDuration(analytics.avg_completion_seconds)}</p>
                  <p className="mt-1 text-xs text-(--ink-tertiary)">
                    {analytics.completion_sample_size > 0
                      ? `based on ${analytics.completion_sample_size} timed response${analytics.completion_sample_size === 1 ? "" : "s"}`
                      : "no timed responses yet"}
                  </p>
                </div>
              </Card>
            </div>

            <div className="card-base mb-6 p-6">
              <div className="mb-4">
                <span className="text-base font-semibold">Daily Responses</span>
              </div>
              <TrafficChart data={analytics.submissions_by_day} />
            </div>

            <div>
              <h2 className="mb-4 text-base font-semibold text-(--ink-primary)">Field Responses</h2>
              {analytics.fields.length === 0 ? (
                <div className="card-base py-12 text-center">
                  <p className="text-sm text-(--ink-secondary)">
                    {form.compiled_schema
                      ? "This form has no fields yet."
                      : "This form hasn't been compiled yet — field analytics will appear once it's published."}
                  </p>
                </div>
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
