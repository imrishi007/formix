"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, X } from "lucide-react";
import { useState } from "react";
import { DocsSidebar } from "./docs-sidebar";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface DocsNavProps {
  breadcrumbs?: Breadcrumb[];
}

export function DocsNav({ breadcrumbs = [] }: DocsNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  
  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur-xl">
        <div className="flex items-center gap-4 px-4 lg:px-6 h-14">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-1.5 text-foreground/50 hover:text-foreground transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Back to home */}
          <Link
            href="/"
            className="hidden lg:flex items-center gap-2 text-xs font-mono text-foreground/40 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to site
          </Link>

          {/* Divider */}
          <span className="hidden lg:block text-foreground/20 select-none">|</span>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto">
            <span className="font-display text-foreground/50">Docs</span>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-foreground/20">/</span>
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/editor/demo"
              className="hidden sm:flex items-center gap-2 text-xs font-mono text-foreground/50 hover:text-foreground transition-colors border border-foreground/15 px-3 py-1.5 rounded-full hover:border-foreground/30"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Open Editor
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r border-foreground/10 overflow-y-auto">
            <div className="pt-14">
              <DocsSidebar />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
