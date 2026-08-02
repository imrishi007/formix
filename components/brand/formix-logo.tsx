import React from "react";

/*
 * components/brand/formix-logo.tsx
 * THE single source of truth for the Formix brand mark (design.md §Logo).
 *
 * One SVG, referenced everywhere: landing nav, docs, editor top-bar,
 * dashboard nav, loading screens, auth, footer. No per-page variants, no
 * redrawn shapes.
 *
 * Mark: an abstracted bracket/pipe pair (`< | >`) — the compiler/DSL
 * identity for Formix: angle brackets for code, the center pipe as the
 * "field" the code renders. It is drawn ONCE below; only the stroke color
 * changes between themes/contexts, never the geometry.
 *
 * Color: the shape uses `currentColor` by default, so a parent can recolor
 * it with any text-color utility (`text-(--ink-primary)`, etc.). For
 * explicit control the `variant` prop maps to the design.md tokens:
 *   - "auto"  (default) → inherits color from the parent (currentColor)
 *   - "mono"            → --ink-primary
 *   - "color"           → --accent-primary
 *
 * Proportions: 28×28 viewBox, designed to read flat at 24px (favicon) and
 * full hero scale without redrawing.
 */

type FormixLogoProps = {
  size?: number;
  className?: string;
  variant?: "auto" | "mono" | "color";
  "aria-label"?: string;
};

const VARIANTS: Record<string, string> = {
  auto: "currentColor",
  mono: "var(--ink-primary)",
  color: "var(--accent-primary)",
};

export function FormixLogo({
  size = 28,
  className,
  variant = "auto",
  ...rest
}: FormixLogoProps) {
  const stroke = VARIANTS[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      {/* Left bracket arm — `<` shape */}
      <path
        d="M11 6 L4 14 L11 22"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right bracket arm — `>` shape */}
      <path
        d="M17 6 L24 14 L17 22"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center pipe — the rendered field */}
      <line
        x1="14"
        y1="9.5"
        x2="14"
        y2="18.5"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/*
 * FormixLogoLockup — mark + "Formix" wordmark (+ optional ".forml" mono
 * hint). The standard lockup for headers/navs. Text uses --ink-primary so
 * it stays legible in both themes without redrawing anything.
 */
type FormixLogoLockupProps = {
  size?: number;
  className?: string;
  showExtension?: boolean;
  markVariant?: "auto" | "mono" | "color";
  "aria-label"?: string;
};

export function FormixLogoLockup({
  size = 28,
  className,
  showExtension = true,
  markVariant = "color",
  ...rest
}: FormixLogoLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`} {...rest}>
      <FormixLogo size={size} variant={markVariant} aria-hidden="true" />
      <span className="text-[19px] font-semibold tracking-tight text-(--ink-primary)">
        Formix
      </span>
      {showExtension && (
        <span
          className="hidden font-mono text-[11px] text-(--ink-tertiary) sm:inline"
          style={{ marginTop: 1 }}
        >
          .forml
        </span>
      )}
    </span>
  );
}
