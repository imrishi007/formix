import { Loader2 } from "lucide-react";

/** Full-viewport "FX" splash shown while an authenticated shell is waiting
 *  on the auth check and/or its first data load (dashboard, analytics,
 *  responses, workspace). */
export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/25">
        <span className="font-inter text-xs font-black tracking-tighter text-accent">FX</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">{label}</span>
      </div>
    </div>
  );
}
