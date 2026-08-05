"use client";

/**
 * components/auth/oauth-buttons.tsx
 * "Continue with Google / GitHub" buttons. Clicking navigates to
 * <API_BASE>/auth/oauth/{provider}, which redirects out to the provider and
 * (after consent) bounces back to /auth/oauth/callback with a token — the
 * backend does all the OAuth work, the frontend just starts and finishes it.
 */

import { useRouter } from "next/navigation";
import { oauthLoginUrl } from "@/lib/api";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 2.87-.39c.97 0 1.95.13 2.87.39 2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.24 2.76.12 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function OAuthButtons() {
  const router = useRouter();

  // Google sign-in is re-enabled — the OAuth credentials in backend/.env were
  // refreshed (see backend/routers/oauth.py, which logs any callback failure to
  // the Render logs). GitHub stays disabled until its credentials are sorted.
  const googleDisabled = false;
  const githubDisabled = true;

  const start = (provider: "google" | "github") => {
    if (provider === "google" && googleDisabled) return;
    if (provider === "github" && githubDisabled) return;
    // Full-page redirect: we leave the app, come back with ?token=... on the
    // /auth/oauth/callback route, which finishes the sign-in.
    router.push(oauthLoginUrl(provider));
  };

  return (
    <div className="space-y-2.5">
      <div className="relative py-3">
        <div className="absolute inset-x-0 top-1/2 border-t border-border" aria-hidden="true" />
        <p className="relative mx-auto w-fit bg-background px-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
          or continue with
        </p>
      </div>

      <button
        type="button"
        onClick={() => start("google")}
        disabled={googleDisabled}
        title={googleDisabled ? "Temporarily unavailable" : undefined}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-transparent px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 disabled:opacity-60 disabled:hover:bg-transparent"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => start("github")}
        disabled={githubDisabled}
        title={githubDisabled ? "Temporarily unavailable" : undefined}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-transparent px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 disabled:opacity-60 disabled:hover:bg-transparent"
      >
        <GitHubIcon />
        Continue with GitHub
      </button>

      {githubDisabled && (
        <p className="text-center font-mono text-[11px] text-muted-foreground/60">
          GitHub sign-in is temporarily unavailable — sign in with your email instead.
        </p>
      )}
    </div>
  );
}
