"use client";

/**
 * components/dashboard/activity-charts.tsx
 * The dashboard's activity row: three compact charts between the stat cards
 * and the form table — forms created/day, responses/day (30-day recharts bar
 * charts), and the top forms by response count (pure-CSS horizontal bars).
 */

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FilePlus2, Inbox, Trophy } from "lucide-react";
import type { DashboardActivity } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; count: number } }> }) {
  if (!active || !payload?.length) return null;
  const { date, count } = payload[0].payload;
  return (
    <div className="rounded-(--radius-md) border border-(--border-hairline) bg-(--bg-surface) px-3 py-2 shadow-lg">
      <p className="text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">
        {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-(--ink-primary)">
        {count} form{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function DayChart({ data, color, emptyLabel }: { data: Array<{ date: string; count: number }>; color: string; emptyLabel: string }) {
  const chartData = data.map((d) => ({ ...d, label: formatDayLabel(d.date) }));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <p className="text-xl font-semibold leading-none text-(--ink-primary)">{total.toLocaleString()}</p>
      <div className="mt-3 h-28 w-full">
        {total === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-(--ink-tertiary)">{emptyLabel}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--ink-tertiary)", fontSize: 10, fontFamily: "var(--font-jetbrains)" }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<DayTooltip />} cursor={{ fill: "var(--ink-subtle)", opacity: 0.5 }} />
              <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function ActivityCharts({ activity }: { activity: DashboardActivity }) {
  const maxResponses = Math.max(1, ...activity.top_forms.map((f) => f.submission_count));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FilePlus2 className="h-4 w-4 text-(--ink-tertiary)" />
            Forms Created (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DayChart data={activity.forms_by_day} color="var(--accent-primary)" emptyLabel="No forms created yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Inbox className="h-4 w-4 text-(--ink-tertiary)" />
            Responses (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DayChart data={activity.submissions_by_day} color="var(--accent-secondary)" emptyLabel="No responses yet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4 text-(--ink-tertiary)" />
            Top Forms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {activity.top_forms.length === 0 ? (
            <p className="flex h-28 items-center justify-center text-xs text-(--ink-tertiary)">
              Publish a form to start collecting responses
            </p>
          ) : (
            activity.top_forms.map((form) => (
              <div key={form.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-(--ink-primary)">{form.title}</span>
                  <span className="flex-none text-xs text-(--ink-tertiary)">{form.submission_count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--bg-subtle)">
                  <div
                    className="h-full rounded-full bg-(--accent-secondary)"
                    style={{ width: `${(form.submission_count / maxResponses) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
