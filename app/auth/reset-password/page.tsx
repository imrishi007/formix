"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { resetPassword, ApiError } from "@/lib/api";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

function ResetPasswordForm() {
  const router = useRouter();
  const [token] = useState<string | null>(() => readToken());
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-2">
      <div className="mb-10">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Password reset
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-foreground">
          {done ? "All set." : "Choose a new password"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {done
            ? "Your password has been updated."
            : "Pick a strong password you haven't used on other sites."}
        </p>
      </div>

      {done ? (
        <Link
          href="/auth/signin"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3D5AFE] to-[#7A5CFF] px-7 py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_-6px_rgba(61,90,254,0.55)] transition-all hover:brightness-110"
        >
          <CheckCircle2 className="h-4 w-4" />
          Go to sign in
        </Link>
      ) : !token ? (
        <div className="space-y-5">
          <p role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            This reset link is missing its token. It may be truncated — check the full URL, or request a new one.
          </p>
          <Link href="/auth/forgot-password" className="inline-flex items-center gap-2 text-sm text-foreground underline underline-offset-4 hover:opacity-75">
            Request a new reset link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="reset-password" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
            />
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="gradient-accent group mt-3 flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-6px_rgba(61,90,254,0.55)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Resetting…
              </>
            ) : (
              <>
                Set new password
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          <p className="pt-2 text-center text-sm text-muted-foreground">
            <button type="button" onClick={() => router.push("/auth/signin")} className="underline underline-offset-4 hover:opacity-75">
              Back to sign in
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout mode="signin">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
