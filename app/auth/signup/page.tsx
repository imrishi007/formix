"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Check, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { useAuth, ApiError } from "@/lib/auth-context";

export default function SignUpPage() {
  return (
    <AuthLayout mode="signup">
      <SignUpForm />
    </AuthLayout>
  );
}

function SignUpForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError(null);
    try {
      await register(email, password, name || undefined);
      router.push("/editor/demo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign up failed — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-1">
      <div className="mb-10">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Get started
        </p>
        <h1 className="font-display text-[2.75rem] leading-[1.02] tracking-tight text-foreground">
          Write once.
          <br />
          Compile instantly.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Create your Formix account to start building.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="signup-name" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-email" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Email
          </label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
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

        <div className="flex items-start gap-3.5 pt-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            id="signup-terms-checkbox"
            onClick={() => setAgreed(!agreed)}
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
              agreed ? "border-accent bg-accent" : "border-border"
            }`}
          >
            {agreed && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
          </button>
          <label
            htmlFor="signup-terms-checkbox"
            className="cursor-pointer select-none text-xs leading-relaxed text-muted-foreground"
            onClick={() => setAgreed(!agreed)}
          >
            I agree to the Terms and Privacy Policy
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <button
          id="signup-submit-btn"
          type="submit"
          disabled={loading || !agreed}
          className="gradient-accent group mt-3 flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-6px_rgba(61,90,254,0.55)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <OAuthButtons />

      <p className="mt-9 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/signin" className="font-medium text-foreground underline underline-offset-4 hover:opacity-75">
          Sign in
        </Link>
      </p>

      <div className="mt-10 space-y-1.5 border-t border-border pt-6">
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
