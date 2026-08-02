"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { FormixLogoLockup } from "@/components/brand/formix-logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { ProfileMenu } from "@/components/brand/profile-menu";

const LINKS = [
  { label: "Why Formix", href: "#features" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "Live Demo", href: "#demo" },
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: "https://github.com/imrishi007/formix.git" },
];

export function HomeNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // ── Scroll listener: switch nav from transparent to glass pill ────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── IntersectionObserver for active nav link ──────────────────────────────
  useEffect(() => {
    const ids = ["features", "pipeline", "demo"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { threshold: 0.3, rootMargin: "-100px 0px -20% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    // Full-width header gives us the fixed stacking context; inner div is
    // the actual pill. We use `inset-x-0 top-0` so the pill can detach to a
    // centered floating island once scrolled.
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center">
      {/* ── Nav pill: transparent on top, glass floating pill on scroll ── */}
      <nav
        className={`flex items-center justify-between transition-all duration-300 ease-out ${
          scrolled || open
            ? // Floating glass pill — the design.md Glassmorphism spec
              "glass-panel mx-4 mt-4 max-w-[1100px] w-full rounded-(--radius-xl) px-5 py-3"
            : // Transparent full-width strip on hero
              "max-w-6xl w-full px-6 py-6 lg:px-10 bg-transparent"
        }`}
      >
        {/* ── Logo: single shared lockup, one component everywhere ────── */}
        <Link
          href="/"
          className="group flex flex-none items-center"
          aria-label="Formix home"
        >
          <FormixLogoLockup size={28} markVariant="color" />
        </Link>

        {/* ── Desktop nav links ──────────────────────────────────────── */}
        <nav className="hidden flex-1 items-center justify-center gap-10 md:flex lg:gap-12">
          {LINKS.map((link) => {
            const sectionId = link.href.startsWith("#") ? link.href.slice(1) : "";
            const isActive = sectionId && activeSection === sectionId;
            return (
              <a
                key={link.label}
                href={link.href}
                className={`group relative whitespace-nowrap text-sm font-medium tracking-[0.03em] transition-colors duration-150 ${
                  isActive
                    ? "text-(--accent-primary)"
                    : "text-(--ink-secondary) hover:text-(--ink-primary)"
                }`}
              >
                {link.label}
                {/* Underline indicator for active / hover */}
                <span
                  className={`absolute -bottom-0.5 left-0 h-[1.5px] bg-(--accent-primary) transition-all duration-200 ${
                    isActive ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </a>
            );
          })}
        </nav>

        {/* ── Desktop: theme toggle + CTAs ───────────────────────────── */}
        <div className="hidden flex-none items-center gap-4 md:flex">
          <ThemeToggle />
          {user ? (
            <>
              <ProfileMenu />
              <Link
                href="/editor/demo"
                className="whitespace-nowrap text-sm font-medium text-(--ink-secondary) transition-colors duration-150 hover:text-(--ink-primary)"
              >
                Editor
              </Link>
              {/* Dashboard — primary button, radius-md (not pill) */}
              <Link
                href="/dashboard"
                id="nav-cta-dashboard"
                className="inline-flex items-center gap-2 rounded-(--radius-md) bg-(--accent-primary) px-5 py-2.5 text-sm font-semibold text-(--on-accent) shadow-(--shadow-btn-primary) transition-all duration-150 hover:scale-[1.02] hover:bg-(--accent-primary-hover) active:scale-[0.98]"
              >
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="whitespace-nowrap text-sm font-medium text-(--ink-secondary) transition-colors duration-150 hover:text-(--ink-primary)"
              >
                Sign in
              </Link>
              {/* Open Editor — primary button, radius-md */}
              <Link
                href="/editor/demo"
                id="nav-cta-editor"
                className="inline-flex items-center rounded-(--radius-md) bg-(--accent-primary) px-5 py-2.5 text-sm font-semibold text-(--on-accent) shadow-(--shadow-btn-primary) transition-all duration-150 hover:scale-[1.02] hover:bg-(--accent-primary-hover) active:scale-[0.98]"
              >
                Open Editor
              </Link>
            </>
          )}
        </div>

        {/* ── Mobile: theme toggle + hamburger ───────────────────────── */}
        <div className="flex flex-none items-center gap-2 md:hidden">
          {user && <ProfileMenu />}
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-(--radius-sm) text-(--ink-primary)"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile full-screen menu overlay ──────────────────────────── */}
      {/* Note: no scroll-triggered opacity — visibility toggled by `open` state
          which is pointer-driven (tap on hamburger). */}
      <div
        className={`fixed inset-0 z-40 bg-(--bg-base) transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-full flex-col justify-center gap-8 px-10">
          {LINKS.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`text-4xl font-semibold tracking-tight text-(--ink-primary) transition-all duration-200 ${
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
              style={{ transitionDelay: open ? `${i * 55}ms` : "0ms" }}
            >
              {link.label}
            </a>
          ))}

          {/* Mobile CTAs */}
          <div
            className={`mt-6 flex flex-col gap-3 border-t border-(--border-hairline) pt-8 transition-all duration-200 ${
              open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
            style={{ transitionDelay: open ? "280ms" : "0ms" }}
          >
            {user ? (
              <>
                <Link
                  href="/editor/demo"
                  onClick={() => setOpen(false)}
                  className="text-sm tracking-wide text-(--ink-secondary)"
                >
                  Editor
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-(--radius-md) bg-(--accent-primary) py-4 text-base font-semibold text-(--on-accent) shadow-(--shadow-btn-primary)"
                >
                  <LayoutDashboard className="size-5" />
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  onClick={() => setOpen(false)}
                  className="text-sm tracking-wide text-(--ink-secondary)"
                >
                  Sign in
                </Link>
                <Link
                  href="/editor/demo"
                  onClick={() => setOpen(false)}
                  className="inline-flex w-full items-center justify-center rounded-(--radius-md) bg-(--accent-primary) py-4 text-base font-semibold text-(--on-accent) shadow-(--shadow-btn-primary)"
                >
                  Open Editor
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
