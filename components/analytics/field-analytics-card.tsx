"use client";

import { Badge } from "@/components/ui/badge";
import type { FieldAnalytics, FieldValueCount } from "@/lib/api";

const FIELD_TYPE_LABELS: Record<string, string> = {
  select: "Select",
  radio: "Radio",
  checkbox: "Checkbox",
  integer: "Number",
  float: "Number",
  text: "Text",
  email: "Email",
  url: "URL",
  date: "Date",
  boolean: "Yes / No",
  upload: "File upload",
};

function OptionBars({ counts, denominator }: { counts: FieldValueCount[]; denominator: number }) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <div className="space-y-2">
      {counts.map((c) => {
        const pct = denominator > 0 ? Math.round((c.count / denominator) * 100) : 0;
        const barPct = Math.round((c.count / max) * 100);
        return (
          <div key={c.value} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-(--ink-primary)">{c.value}</span>
              <span className="flex-none text-(--ink-tertiary)">{c.count} · {pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--bg-subtle)">
              <div className="h-full rounded-full bg-(--accent-primary)" style={{ width: `${barPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyFieldState() {
  return <p className="py-3 text-sm text-(--ink-secondary)">No responses yet for this field.</p>;
}

export function FieldAnalyticsCard({ field }: { field: FieldAnalytics }) {
  const total = field.answered_count + field.skipped_count;
  const typeLabel = FIELD_TYPE_LABELS[field.field_type] ?? field.field_type;

  return (
    <div className="card-base p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-(--ink-primary)">{field.label}</span>
        <div className="flex flex-none items-center gap-2">
          <Badge variant="secondary">{typeLabel}</Badge>
          <span className="text-xs text-(--ink-tertiary)">{field.answered_count}/{total} answered</span>
        </div>
      </div>
      <div>
        {field.answered_count === 0 ? (
          <EmptyFieldState />
        ) : field.option_counts && field.option_counts.length > 0 ? (
          <OptionBars counts={field.option_counts} denominator={field.answered_count} />
        ) : field.numeric_avg !== null && field.numeric_avg !== undefined ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-(--radius-md) bg-(--bg-subtle) px-2.5 py-2">
                <p className="text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">Avg</p>
                <p className="text-sm font-semibold text-(--ink-primary)">{field.numeric_avg.toFixed(field.numeric_avg % 1 === 0 ? 0 : 1)}</p>
              </div>
              <div className="rounded-(--radius-md) bg-(--bg-subtle) px-2.5 py-2">
                <p className="text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">Min</p>
                <p className="text-sm font-semibold text-(--ink-primary)">{field.numeric_min}</p>
              </div>
              <div className="rounded-(--radius-md) bg-(--bg-subtle) px-2.5 py-2">
                <p className="text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">Max</p>
                <p className="text-sm font-semibold text-(--ink-primary)">{field.numeric_max}</p>
              </div>
            </div>
            {field.numeric_distribution && field.numeric_distribution.length > 0 && (
              <OptionBars counts={field.numeric_distribution} denominator={field.answered_count} />
            )}
          </div>
        ) : field.date_min ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-(--radius-md) bg-(--bg-subtle) px-2.5 py-2">
              <p className="text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">Earliest</p>
              <p className="text-sm font-semibold text-(--ink-primary)">{field.date_min}</p>
            </div>
            <div className="rounded-(--radius-md) bg-(--bg-subtle) px-2.5 py-2">
              <p className="text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">Latest</p>
              <p className="text-sm font-semibold text-(--ink-primary)">{field.date_max}</p>
            </div>
          </div>
        ) : field.text_samples && field.text_samples.length > 0 ? (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {field.text_samples.map((s, i) => (
              <li key={i} className="truncate rounded-(--radius-md) bg-(--bg-subtle) px-2.5 py-1.5 text-xs text-(--ink-primary)" title={s}>
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyFieldState />
        )}
      </div>
    </div>
  );
}
