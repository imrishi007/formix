import { AlertTriangle, Info, Lightbulb, Zap } from "lucide-react";
import React from "react";

type CalloutType = "note" | "tip" | "warning" | "important";

const calloutConfig: Record<
  CalloutType,
  { icon: React.ReactNode; label: string; classes: string }
> = {
  note: {
    icon: <Info className="w-4 h-4 shrink-0 mt-0.5" />,
    label: "Note",
    classes: "border-foreground/20 bg-foreground/[0.03] text-foreground/80",
  },
  tip: {
    icon: <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />,
    label: "Tip",
    classes: "border-emerald-500/30 bg-emerald-500/[0.04] text-foreground/80",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />,
    label: "Warning",
    classes: "border-amber-500/40 bg-amber-500/[0.05] text-foreground/80",
  },
  important: {
    icon: <Zap className="w-4 h-4 shrink-0 mt-0.5" />,
    label: "Important",
    classes: "border-blue-500/30 bg-blue-500/[0.04] text-foreground/80",
  },
};

interface CalloutProps {
  type?: CalloutType;
  children: React.ReactNode;
}

export function Callout({ type = "note", children }: CalloutProps) {
  const config = calloutConfig[type];
  return (
    <div className={`my-5 flex gap-3 border-l-2 px-4 py-3.5 rounded-sm ${config.classes}`}>
      <span className="opacity-70">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono uppercase tracking-widest opacity-60 block mb-1">
          {config.label}
        </span>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
