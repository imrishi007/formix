"use client";

import type { ProfileDayCount } from "@/lib/api";

/**
 * components/profile/contribution-grid.tsx
 * A GitHub-style yearly activity heatmap: 7 rows (Sun→Sat) × ~53 week columns,
 * one cell per day, colored by how many forms were created that day. Pure CSS
 * grid — no chart library — with a native `title` tooltip on each cell.
 */

// Cell fill levels, darkest = most forms created that day. `bg-(--accent-primary)/NN`
// uses the same CSS-variable opacity pattern as the rest of the app (e.g.
// dashboard-shell's border-(--accent-danger)/30).
const LEVELS = [
  "bg-(--bg-subtle)",          // 0
  "bg-(--accent-primary)/25",  // 1
  "bg-(--accent-primary)/50",  // 2–3
  "bg-(--accent-primary)/75",  // 4–6
  "bg-(--accent-primary)",     // 7+
];

function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface WeekCell {
  iso: string;
  count: number;
}

/** Flatten the dense day series into week columns (Sun-first), zero-filling
 *  the pad before the series start so the grid aligns like GitHub's. */
function buildWeeks(data: ProfileDayCount[]): WeekCell[][] {
  const byDay = new Map(data.map((d) => [d.date, d.count]));
  const end = new Date(`${data[data.length - 1]?.date ?? toISO(new Date())}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (data.length - 1 || 364));

  const cursor = new Date(start);
  cursor.setDate(start.getDate() - start.getDay()); // back up to Sunday

  const weeks: WeekCell[][] = [];
  while (cursor <= end) {
    const week: WeekCell[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = toISO(cursor);
      week.push({ iso, count: byDay.get(iso) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Month labels above the columns, taken from each week's first day. */
function monthLabels(weeks: WeekCell[][]): Array<{ index: number; label: string }> {
  const labels: Array<{ index: number; label: string }> = [];
  let last = "";
  weeks.forEach((week, i) => {
    const d = new Date(`${week[0].iso}T00:00:00`);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== last && d.getDate() <= 7) {
      last = key;
      labels.push({ index: i, label: d.toLocaleDateString(undefined, { month: "short" }) });
    }
  });
  return labels;
}

export function ContributionGrid({ data }: { data: ProfileDayCount[] }) {
  if (!data.length) return null;
  const weeks = buildWeeks(data);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const labels = monthLabels(weeks);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-medium text-(--ink-secondary)">{total} form{total === 1 ? "" : "s"} created in the last year</span>
      </div>

      <div className="overflow-x-auto pb-1">
        {/* Month labels — offset so they sit over the top of the columns. */}
        <div className="relative mb-1 h-4">
          {labels.map(({ index, label }) => (
            <span
              key={`${index}-${label}`}
              className="absolute text-[10px] text-(--ink-tertiary)"
              style={{ left: `${index * 13}px` }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex gap-[3px]">
          {/* Weekday gutter (GitHub shows Mon/Wed/Fri) */}
          <div className="mr-1 flex flex-col gap-[3px] pt-0">
            {["Mon", "", "Wed", "", "Fri", "", ""].map((label, i) => (
              <span key={i} className="flex h-[11px] w-7 items-center text-[9px] text-(--ink-tertiary)">
                {label}
              </span>
            ))}
          </div>

          {weeks.map((week, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.iso}
                  title={`${cell.count} form${cell.count === 1 ? "" : "s"} on ${cell.iso}`}
                  className={`h-[11px] w-[11px] rounded-[2px] ${LEVELS[levelFor(cell.count)]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-(--ink-tertiary)">
        Less
        {LEVELS.map((cls, i) => (
          <span key={i} className={`h-[11px] w-[11px] rounded-[2px] ${cls}`} />
        ))}
        More
      </div>
    </div>
  );
}
