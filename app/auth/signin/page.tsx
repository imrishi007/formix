"use client";

import { useState } from "react";
<<<<<<< HEAD
import Link from "next/link";
import { Github, Eye, EyeOff, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
=======
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useAuth, ApiError } from "@/lib/auth-context";
>>>>>>> f6620dd (Complete Formix updates)

export default function SignInPage() {
  return (
    <AuthLayout mode="signin">
      <SignInForm />
    </AuthLayout>
  );
}

function SignInForm() {
<<<<<<< HEAD
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
=======
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
>>>>>>> f6620dd (Complete Formix updates)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
<<<<<<< HEAD
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
  };

  const handleGithub = async () => {
    setGithubLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setGithubLoading(false);
=======
    setError(null);
    try {
      await login(email, password);
      router.push("/editor/demo");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed — please try again.");
    } finally {
      setLoading(false);
    }
>>>>>>> f6620dd (Complete Formix updates)
  };

  return (
    <div className="py-2">
<<<<<<< HEAD
      {/* ── Header ── */}
      <div className="mb-12">
        <p
          className="font-mono text-[10px] uppercase tracking-widest mb-4"
          style={{ color: "rgba(11,11,11,0.35)" }}
        >
          Welcome back
        </p>
        <h1
          className="font-display text-[3.2rem] leading-[1.02] tracking-tight"
          style={{ color: "#0B0B0B" }}
        >
=======
      <div className="mb-10">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Welcome back
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-foreground">
>>>>>>> f6620dd (Complete Formix updates)
          Continue
          <br />
          building.
        </h1>
<<<<<<< HEAD
        <p
          className="mt-4 text-sm font-sans leading-relaxed"
          style={{ color: "rgba(11,11,11,0.5)" }}
        >
=======
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
          Sign in to your Formix workspace.
        </p>
      </div>

<<<<<<< HEAD
      {/* ── GitHub — Primary CTA ── */}
      <button
        id="signin-github-btn"
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

      {/* ── Email + Password form ── */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Email */}
        <div className="space-y-2">
          <label
            htmlFor="signin-email"
            className="block font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "rgba(11,11,11,0.4)" }}
          >
=======
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="signin-email" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
>>>>>>> f6620dd (Complete Formix updates)
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
<<<<<<< HEAD
            className="w-full bg-transparent font-sans text-sm outline-none transition-all duration-150 placeholder:opacity-30"
            style={{
              border: "1px solid rgba(11,11,11,0.12)",
              borderRadius: "10px",
              padding: "13px 16px",
              color: "#0B0B0B",
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid rgba(11,11,11,0.5)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,11,11,0.06)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid rgba(11,11,11,0.12)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="signin-password"
              className="block font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "rgba(11,11,11,0.4)" }}
            >
              Password
            </label>
            <Link
              href="#"
              className="font-mono text-[10px] transition-opacity duration-150 hover:opacity-100"
              style={{ color: "rgba(11,11,11,0.4)" }}
            >
              Forgot?
            </Link>
=======
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="signin-password" className="block font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Password
            </label>
>>>>>>> f6620dd (Complete Formix updates)
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
<<<<<<< HEAD
              className="w-full bg-transparent font-sans text-sm outline-none transition-all duration-150 placeholder:opacity-30 pr-11"
              style={{
                border: "1px solid rgba(11,11,11,0.12)",
                borderRadius: "10px",
                padding: "13px 16px",
                color: "#0B0B0B",
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid rgba(11,11,11,0.5)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,11,11,0.06)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid rgba(11,11,11,0.12)";
                e.currentTarget.style.boxShadow = "none";
              }}
=======
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
        {/* Submit */}
=======
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

>>>>>>> f6620dd (Complete Formix updates)
        <button
          id="signin-submit-btn"
          type="submit"
          disabled={loading}
<<<<<<< HEAD
          className="w-full flex items-center justify-center gap-2.5 font-sans text-sm font-medium transition-all duration-150 mt-3 group disabled:opacity-60"
          style={{
            background: "transparent",
            color: "#0B0B0B",
            borderRadius: "100px",
            padding: "15px 28px",
            border: "1px solid rgba(11,11,11,0.16)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "rgba(11,11,11,0.04)";
              e.currentTarget.style.borderColor = "rgba(11,11,11,0.35)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(11,11,11,0.16)";
          }}
        >
          {loading ? (
            <>
              <span
                className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(11,11,11,0.2)", borderTopColor: "#0B0B0B" }}
              />
=======
          className="gradient-accent group mt-3 flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-6px_rgba(124,58,237,0.55)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
>>>>>>> f6620dd (Complete Formix updates)
              Signing in…
            </>
          ) : (
            <>
<<<<<<< HEAD
              Sign in with email
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
=======
              Sign in
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
>>>>>>> f6620dd (Complete Formix updates)
            </>
          )}
        </button>
      </form>

<<<<<<< HEAD
      {/* ── Footer link ── */}
      <p
        className="text-center text-sm mt-10"
        style={{ color: "rgba(11,11,11,0.45)" }}
      >
        New to Formix?{" "}
        <Link
          href="/auth/signup"
          className="font-medium transition-opacity duration-150 hover:opacity-75"
          style={{ color: "#0B0B0B", textDecoration: "underline", textUnderlineOffset: "3px" }}
        >
=======
      <p className="mt-10 text-center text-sm text-muted-foreground">
        New to Formix?{" "}
        <Link href="/auth/signup" className="font-medium text-foreground underline underline-offset-4 hover:opacity-75">
>>>>>>> f6620dd (Complete Formix updates)
          Create an account
        </Link>
      </p>

<<<<<<< HEAD
      {/* ── Compiler chain caption ── */}
      <div
        className="mt-12 pt-7 space-y-1.5"
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
      <div className="mt-12 space-y-1.5 border-t border-border pt-7">
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
