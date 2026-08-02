import { Loader2 } from "lucide-react";
import { FormixLogo } from "@/components/brand/formix-logo";

/** Full-viewport "FX" splash shown while an authenticated shell is waiting
 *  on the auth check and/or its first data load (dashboard, analytics,
 *  responses, workspace). */
export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
      {/* Shared brand mark — single component, replaces the old FX box */}
      <FormixLogo size={32} variant="color" aria-hidden="true" />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">{label}</span>
      </div>
    </div>
  );
}
