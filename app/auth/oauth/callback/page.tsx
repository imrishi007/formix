"use client";

/**
 * app/auth/oauth/callback/page.tsx
 * Landing spot after the backend finishes a Google/GitHub OAuth round-trip.
 * The backend redirects here with ?token=... on success or ?error=... on
 * failure. We stash the token, pull the user via /auth/me, and continue to
 * the editor — mirroring what the sign-in form does on success.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useAuth, ApiError } from "@/lib/auth-context";

function readQuery(): { token: string | null; error: string | null } {
  if (typeof window === "undefined") return { token: null, error: null };
  const params = new URLSearchParams(window.location.search);
  return { token: params.get("token"), error: params.get("error") };
}

function OAuthCallback() {
  const router = useRouter();
  const { completeOAuth } = useAuth();
  const [failed, setFailed] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const { token, error } = readQuery();
    if (error || !token) {
      setFailed(error ?? "Sign-in did not complete — no token was returned.");
      return;
    }

    (async () => {
      try {
        await completeOAuth(token);
        // Replace (not push) so the token stays out of the back button's path.
        router.replace("/editor/demo");
      } catch (err) {
        setFailed(err instanceof ApiError ? err.message : "Sign-in failed — please try again.");
      }
    })();
  }, [router, completeOAuth]);

  return (
    <div className="py-2">
      <div className="mb-8">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          OAuth sign-in
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-foreground">
          {failed ? "Sign-in failed" : "Wrapping up…"}
        </h1>
      </div>

      {failed ? (
        <div className="space-y-5">
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            {failed}
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Finishing sign-in…</span>
        </div>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <AuthLayout mode="signin">
      <OAuthCallback />
    </AuthLayout>
  );
}
