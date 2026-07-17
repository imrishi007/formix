"use client";

import { useState } from "react";
import Link from "next/link";
import { Github, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";


export default function SignUpPage() {
  return (
    <AuthLayout mode="signup">
      <SignUpForm />
    </AuthLayout>
  );
}

function SignUpForm() {
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
  };

  return (
    <div className="py-1">
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
          Write once.
          <br />
          Compile instantly.
        </h1>
        <p className="mt-4 text-sm font-sans" style={{ color: "rgba(11,11,11,0.5)" }}>
          Create your Formix account to start building.
        </p>
      </div>

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
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
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
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
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
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="w-full bg-transparent font-sans text-sm outline-none transition-all duration-150 placeholder:opacity-30 pr-11"
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
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


        {/* Terms */}
        <div className="flex items-start gap-3.5 pt-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            id="signup-terms-checkbox"
            onClick={() => setAgreed(!agreed)}
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
        <button
          id="signup-submit-btn"
          type="submit"
          disabled={loading || !agreed}
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
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      {/* ── Footer link ── */}
      <p className="text-center text-sm mt-9" style={{ color: "rgba(11,11,11,0.45)" }}>
        Already have an account?{" "}
        <Link
          href="/auth/signin"
          className="font-medium transition-opacity duration-150 hover:opacity-75"
          style={{ color: "#0B0B0B", textDecoration: "underline", textUnderlineOffset: "3px" }}
        >
          Sign in
        </Link>
      </p>

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
            {i === 0 && <span className="w-[9px]" />}
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
