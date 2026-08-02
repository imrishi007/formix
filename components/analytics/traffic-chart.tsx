"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { AnalyticsDayCount } from "@/lib/api";

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; count: number } }> }) {
  if (!active || !payload?.length) return null;
  const { date, count } = payload[0].payload;
  return (
    <div className="rounded-(--radius-md) border border-(--border-hairline) bg-(--bg-surface) px-3 py-2 shadow-lg">
      <p className="text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">
        {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-(--ink-primary)">
        {count} response{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function TrafficChart({ data }: { data: AnalyticsDayCount[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-(--radius-md) border border-dashed border-(--border-hairline) text-(--ink-tertiary)">
        <BarChart3 className="h-6 w-6" />
        <p className="text-sm">No responses yet</p>
        <p className="text-xs text-(--ink-tertiary)/70">Daily response volume will appear here once submissions start coming in.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: formatDayLabel(d.date) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border-hairline)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-tertiary)", fontSize: 11, fontFamily: "var(--font-jetbrains)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
            tick={{ fill: "var(--ink-tertiary)", fontSize: 11, fontFamily: "var(--font-jetbrains)" }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--ink-subtle)", opacity: 0.5 }} />
          <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
