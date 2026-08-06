"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useAuth, ApiError } from "@/lib/auth-context";

export default function SignInPage() {
  return (
    <AuthLayout mode="signin">
      <SignInForm />
    </AuthLayout>
  );
}

function SignInForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/editor/demo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-2">
      <div className="mb-10">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Welcome back
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-foreground">
          Continue
          <br />
          building.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Sign in to your Formix workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="signin-email" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="signin-password" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="signin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <button
          id="signin-submit-btn"
          type="submit"
          disabled={loading}
          className="gradient-accent group mt-3 flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-6px_rgba(61,90,254,0.55)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        New to Formix?{" "}
        <Link href="/auth/signup" className="font-medium text-foreground underline underline-offset-4 hover:opacity-75">
          Create an account
        </Link>
      </p>

      <div className="mt-12 space-y-1.5 border-t border-border pt-7">
        {["Hand-written C++ compiler", "Compiled to WebAssembly", "Runs entirely in your browser"].map((item, i) => (
          <p key={item} className="flex items-center gap-2 font-mono text-xs text-muted-foreground/70">
            {i > 0 && <span>↓</span>}
            {i === 0 && <span className="w-[9px]" />}
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
