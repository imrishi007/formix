"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck, AlertCircle, ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { forgotPassword, ApiError } from "@/lib/api";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; reset_link?: string | null } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await forgotPassword(email));
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
          Forgot your
          <br />
          password?
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Enter the email you signed up with and we&apos;ll send you a reset link.
        </p>
      </div>

      {result ? (
        <div className="space-y-5">
          <p className="flex items-start gap-2.5 rounded-lg border border-border bg-accent/40 px-3 py-2.5 text-sm text-foreground">
            <MailCheck className="mt-0.5 h-4 w-4 flex-none" />
            {result.message}
          </p>

          {/* Dev-mode hint: the backend returns the link when no SMTP is set up. */}
          {result.reset_link && (
            <div className="rounded-lg border border-dashed border-border p-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Dev mode — no email service configured, here&apos;s your link
              </p>
              <Link
                href={result.reset_link}
                className="mt-2 block break-all font-mono text-xs text-foreground underline underline-offset-4 hover:opacity-75"
              >
                {result.reset_link}
              </Link>
            </div>
          )}

          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="reset-email" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
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
                Sending…
              </>
            ) : (
              <>
                Send reset link
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthLayout mode="signin">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
