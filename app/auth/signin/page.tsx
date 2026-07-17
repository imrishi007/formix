"use client";

import { useState } from "react";
import Link from "next/link";
import { Github, Eye, EyeOff, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function SignInPage() {
  return (
    <AuthLayout mode="signin">
      <SignInForm />
    </AuthLayout>
  );
}

function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
  };

  const handleGithub = async () => {
    setGithubLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setGithubLoading(false);
  };

  return (
    <div className="py-2">
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
          Continue
          <br />
          building.
        </h1>
        <p
          className="mt-4 text-sm font-sans leading-relaxed"
          style={{ color: "rgba(11,11,11,0.5)" }}
        >
          Sign in to your Formix workspace.
        </p>
      </div>

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
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-150 hover:opacity-75"
              style={{ color: "rgba(11,11,11,0.35)" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          id="signin-submit-btn"
          type="submit"
          disabled={loading}
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
              Signing in…
            </>
          ) : (
            <>
              Sign in with email
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

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
          Create an account
        </Link>
      </p>

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
            {i === 0 && <span className="w-[9px]" />}
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
