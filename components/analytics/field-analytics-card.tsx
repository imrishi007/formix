"use client";

/**
 * components/analytics/field-analytics-card.tsx
 * Renders one field's response breakdown, dynamically shaped by field_type:
 *
 *   - select / radio / checkbox  → option distribution bars (also covers the
 *     requested "Dropdown" — FormL's <select> IS a dropdown, same fieldType)
 *   - integer / float            → avg/min/max + a per-value distribution
 *     when there are few distinct values, which doubles as a "Rating" bar
 *     breakdown (FormL has no separate rating type — a small-range integer
 *     field like `min:1 max:5` naturally renders as one)
 *   - date                       → earliest / latest answered
 *   - anything else (text, email, url, boolean, upload, ...) → answered
 *     count + recent sample responses (covers both "Text" and "Textarea" —
 *     FormL only has one free-text field type; the sample list works for
 *     either short or long answers without needing to guess which)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <div className="flex items-center justify-between gap-2 font-inter text-xs">
              <span className="min-w-0 truncate text-foreground">{c.value}</span>
              <span className="flex-none font-mono text-muted-foreground">{c.count} · {pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${barPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyFieldState() {
  return <p className="py-3 text-sm text-muted-foreground">No responses yet for this field.</p>;
}

export function FieldAnalyticsCard({ field }: { field: FieldAnalytics }) {
  const total = field.answered_count + field.skipped_count;
  const typeLabel = FIELD_TYPE_LABELS[field.field_type] ?? field.field_type;

  return (
    <Card className="py-4">
      <CardHeader className="flex-row items-center justify-between gap-2 px-4">
        <CardTitle className="min-w-0 truncate font-inter text-sm font-semibold">{field.label}</CardTitle>
        <div className="flex flex-none items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground">{typeLabel}</Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{field.answered_count}/{total} answered</span>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {field.answered_count === 0 ? (
          <EmptyFieldState />
        ) : field.option_counts && field.option_counts.length > 0 ? (
          <OptionBars counts={field.option_counts} denominator={field.answered_count} />
        ) : field.numeric_avg !== null && field.numeric_avg !== undefined ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-muted px-2.5 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Avg</p>
                <p className="font-inter text-sm font-semibold text-foreground">{field.numeric_avg.toFixed(field.numeric_avg % 1 === 0 ? 0 : 1)}</p>
              </div>
              <div className="rounded-md bg-muted px-2.5 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Min</p>
                <p className="font-inter text-sm font-semibold text-foreground">{field.numeric_min}</p>
              </div>
              <div className="rounded-md bg-muted px-2.5 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Max</p>
                <p className="font-inter text-sm font-semibold text-foreground">{field.numeric_max}</p>
              </div>
            </div>
            {field.numeric_distribution && field.numeric_distribution.length > 0 && (
              <OptionBars counts={field.numeric_distribution} denominator={field.answered_count} />
            )}
          </div>
        ) : field.date_min ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted px-2.5 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Earliest</p>
              <p className="font-inter text-sm font-semibold text-foreground">{field.date_min}</p>
            </div>
            <div className="rounded-md bg-muted px-2.5 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Latest</p>
              <p className="font-inter text-sm font-semibold text-foreground">{field.date_max}</p>
            </div>
          </div>
        ) : field.text_samples && field.text_samples.length > 0 ? (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {field.text_samples.map((s, i) => (
              <li key={i} className="truncate rounded-md bg-muted px-2.5 py-1.5 font-inter text-xs text-foreground" title={s}>
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyFieldState />
        )}
      </CardContent>
    </Card>
  );
}
