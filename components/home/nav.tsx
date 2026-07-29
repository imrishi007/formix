"use client";

/**
 * components/home/nav.tsx
 * Homepage navigation — brand-new component (replaces the deleted
 * components/landing/navigation.tsx). Same destinations as before: section
 * anchors on this page, /docs, GitHub, /auth/signin, /editor/demo.
 *
 * The bar's size (height, max-width, padding) is constant at every scroll
 * position — only the background/border fade in on scroll. An earlier
 * version shrank the container to a narrow pill once scrolled, which wasn't
 * wide enough to fit all five links plus the CTA and caused them to
 * overlap/wrap; a size-changing nav is also just the wrong feel for a bar
 * that should read as fixed chrome, not something animating on every frame.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { label: "Why Formix", href: "#features" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "Live Demo", href: "#demo" },
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: "https://github.com" },
];

export function HomeNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-20">
      <div
        className={`mx-auto flex h-20 max-w-6xl items-center justify-between px-6 transition-colors duration-300 lg:px-10 ${
          scrolled || open ? "border-b border-white/10 bg-[#0b1220]/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
        }`}
      >
        <Link href="/" className="group flex flex-none items-center gap-2.5">
          <span className="gradient-accent flex h-7 w-7 flex-none items-center justify-center rounded-lg font-mono text-[11px] font-black tracking-tighter text-white shadow-elevated">
            FX
          </span>
          <span className="font-display text-lg tracking-tight text-foreground">Formix</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex lg:gap-10">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="group relative whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="hidden flex-none items-center gap-4 md:flex">
          {user ? (
            <>
              <Link href="/editor/demo" className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
                Editor
              </Link>
              <Button asChild size="sm" className="rounded-full px-5">
                <Link href="/dashboard"><LayoutDashboard className="h-3.5 w-3.5" /> Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
                Sign in
              </Link>
              <Button asChild size="sm" className="rounded-full px-5">
                <Link href="/editor/demo">Open Editor</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-foreground md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-[#0b1220] transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-full flex-col justify-center gap-8 px-10">
          {LINKS.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`font-display text-4xl text-foreground transition-all duration-500 ${
                open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: open ? `${i * 60}ms` : "0ms" }}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-8">
            {user ? (
              <>
                <Link href="/editor/demo" onClick={() => setOpen(false)} className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                  Editor
                </Link>
                <Button asChild size="lg" className="rounded-full" onClick={() => setOpen(false)}>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" onClick={() => setOpen(false)} className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                  Sign in
                </Link>
                <Button asChild size="lg" className="rounded-full" onClick={() => setOpen(false)}>
                  <Link href="/editor/demo">Open Editor</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
