"use client";

import { useState } from "react";
<<<<<<< HEAD
import Link from "next/link";
import { Github, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

=======
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Check, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useAuth, ApiError } from "@/lib/auth-context";
>>>>>>> f6620dd (Complete Formix updates)

export default function SignUpPage() {
  return (
    <AuthLayout mode="signup">
      <SignUpForm />
    </AuthLayout>
  );
}

function SignUpForm() {
<<<<<<< HEAD
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    setLoading(false);
  };

  const handleGithub = async () => {
    setGithubLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setGithubLoading(false);
  };

  const inputStyle = {
    border: "1px solid rgba(11,11,11,0.12)",
    borderRadius: "10px",
    padding: "13px 16px",
    color: "#0B0B0B",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = "1px solid rgba(11,11,11,0.5)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,11,11,0.06)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = "1px solid rgba(11,11,11,0.12)";
    e.currentTarget.style.boxShadow = "none";
=======
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
>>>>>>> f6620dd (Complete Formix updates)
  };

  return (
    <div className="py-1">
<<<<<<< HEAD
      {/* ── Header ── */}
      <div className="mb-12">
        <p
          className="font-mono text-[10px] uppercase tracking-widest mb-4"
          style={{ color: "rgba(11,11,11,0.35)" }}
        >
          Get started
        </p>
        <h1
          className="font-display text-[3.0rem] leading-[1.02] tracking-tight"
          style={{ color: "#0B0B0B" }}
        >
=======
      <div className="mb-10">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Get started
        </p>
        <h1 className="font-display text-[2.75rem] leading-[1.02] tracking-tight text-foreground">
>>>>>>> f6620dd (Complete Formix updates)
          Write once.
          <br />
          Compile instantly.
        </h1>
<<<<<<< HEAD
        <p className="mt-4 text-sm font-sans" style={{ color: "rgba(11,11,11,0.5)" }}>
=======
        <p className="mt-4 text-sm text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
          Create your Formix account to start building.
        </p>
      </div>

<<<<<<< HEAD
      {/* ── GitHub — Primary CTA ── */}
      <button
        id="signup-github-btn"
        type="button"
        onClick={handleGithub}
        disabled={githubLoading}
        className="w-full flex items-center justify-center gap-3 font-sans text-sm font-medium transition-all duration-150 mb-7 disabled:opacity-60"
        style={{
          background: "#0B0B0B",
          color: "#F8F6F2",
          borderRadius: "100px",
          padding: "15px 28px",
          border: "none",
          cursor: githubLoading ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!githubLoading) e.currentTarget.style.background = "rgba(11,11,11,0.85)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#0B0B0B";
        }}
      >
        {githubLoading ? (
          <span
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: "rgba(248,246,242,0.25)", borderTopColor: "#F8F6F2" }}
          />
        ) : (
          <Github className="w-4.5 h-4.5" />
        )}
        {githubLoading ? "Redirecting…" : "Continue with GitHub"}
      </button>

      {/* ── Divider ── */}
      <div className="flex items-center gap-4 mb-7">
        <div className="flex-1 h-px" style={{ background: "rgba(11,11,11,0.08)" }} />
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "rgba(11,11,11,0.25)" }}>
          or
        </span>
        <div className="flex-1 h-px" style={{ background: "rgba(11,11,11,0.08)" }} />
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Full Name */}
        <div className="space-y-2">
          <label
            htmlFor="signup-name"
            className="block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "rgba(11,11,11,0.4)" }}
          >
=======
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="signup-name" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
<<<<<<< HEAD
            placeholder="Jane Doe"
            required
            className="w-full bg-transparent font-sans text-sm outline-none transition-all duration-150 placeholder:opacity-30"
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label
            htmlFor="signup-email"
            className="block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "rgba(11,11,11,0.4)" }}
          >
=======
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-email" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
<<<<<<< HEAD
            placeholder="you@company.com"
            required
            className="w-full bg-transparent font-sans text-sm outline-none transition-all duration-150 placeholder:opacity-30"
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label
            htmlFor="signup-password"
            className="block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "rgba(11,11,11,0.4)" }}
          >
=======
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-password" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
<<<<<<< HEAD
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="w-full bg-transparent font-sans text-sm outline-none transition-all duration-150 placeholder:opacity-30 pr-11"
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
=======
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="w-full rounded-lg border border-border bg-transparent px-4 py-3 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
>>>>>>> f6620dd (Complete Formix updates)
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
<<<<<<< HEAD
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-150 hover:opacity-75"
              style={{ color: "rgba(11,11,11,0.35)" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
=======
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
>>>>>>> f6620dd (Complete Formix updates)
            </button>
          </div>
        </div>

<<<<<<< HEAD

        {/* Terms */}
=======
>>>>>>> f6620dd (Complete Formix updates)
        <div className="flex items-start gap-3.5 pt-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            id="signup-terms-checkbox"
            onClick={() => setAgreed(!agreed)}
<<<<<<< HEAD
            className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center transition-all duration-150"
            style={{
              border: agreed ? "none" : "1px solid rgba(11,11,11,0.25)",
              borderRadius: "4px",
              background: agreed ? "#0B0B0B" : "transparent",
            }}
          >
            {agreed && <Check className="w-2.5 h-2.5" style={{ color: "#F8F6F2" }} strokeWidth={3} />}
          </button>
          <label
            htmlFor="signup-terms-checkbox"
            className="text-xs leading-relaxed cursor-pointer select-none"
            style={{ color: "rgba(11,11,11,0.45)" }}
            onClick={() => setAgreed(!agreed)}
          >
            I agree to the{" "}
            <Link
              href="#"
              className="transition-opacity duration-150 hover:opacity-70"
              style={{ color: "#0B0B0B", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="transition-opacity duration-150 hover:opacity-70"
              style={{ color: "#0B0B0B", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              Privacy Policy
            </Link>
          </label>
        </div>

        {/* Submit */}
=======
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

>>>>>>> f6620dd (Complete Formix updates)
        <button
          id="signup-submit-btn"
          type="submit"
          disabled={loading || !agreed}
<<<<<<< HEAD
          className="w-full flex items-center justify-center gap-2.5 font-sans text-sm font-medium transition-all duration-150 mt-3 group disabled:opacity-50"
          style={{
            background: "#0B0B0B",
            color: "#F8F6F2",
            borderRadius: "100px",
            padding: "15px 28px",
            border: "none",
            cursor: loading || !agreed ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading && agreed) e.currentTarget.style.background = "rgba(11,11,11,0.85)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#0B0B0B";
          }}
        >
          {loading ? (
            <>
              <span
                className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(248,246,242,0.25)", borderTopColor: "#F8F6F2" }}
              />
=======
          className="gradient-accent group mt-3 flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-6px_rgba(124,58,237,0.55)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
>>>>>>> f6620dd (Complete Formix updates)
              Creating account…
            </>
          ) : (
            <>
              Create account
<<<<<<< HEAD
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
=======
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
>>>>>>> f6620dd (Complete Formix updates)
            </>
          )}
        </button>
      </form>

<<<<<<< HEAD
      {/* ── Footer link ── */}
      <p className="text-center text-sm mt-9" style={{ color: "rgba(11,11,11,0.45)" }}>
        Already have an account?{" "}
        <Link
          href="/auth/signin"
          className="font-medium transition-opacity duration-150 hover:opacity-75"
          style={{ color: "#0B0B0B", textDecoration: "underline", textUnderlineOffset: "3px" }}
        >
=======
      <p className="mt-9 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/signin" className="font-medium text-foreground underline underline-offset-4 hover:opacity-75">
>>>>>>> f6620dd (Complete Formix updates)
          Sign in
        </Link>
      </p>

<<<<<<< HEAD
      {/* ── Compiler chain caption ── */}
      <div
        className="mt-10 pt-6 space-y-1.5"
        style={{ borderTop: "1px solid rgba(11,11,11,0.06)" }}
      >
        {[
          "Hand-written C++ compiler",
          "Compiled to WebAssembly",
          "Runs entirely in your browser",
        ].map((item, i) => (
          <p
            key={item}
            className="font-mono text-[9px] flex items-center gap-2"
            style={{ color: "rgba(11,11,11,0.25)" }}
          >
            {i > 0 && <span style={{ color: "rgba(11,11,11,0.15)" }}>↓</span>}
=======
      <div className="mt-10 space-y-1.5 border-t border-border pt-6">
        {["Hand-written C++ compiler", "Compiled to WebAssembly", "Runs entirely in your browser"].map((item, i) => (
          <p key={item} className="flex items-center gap-2 font-mono text-xs text-muted-foreground/70">
            {i > 0 && <span>↓</span>}
>>>>>>> f6620dd (Complete Formix updates)
            {i === 0 && <span className="w-[9px]" />}
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
