"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs/introduction" },
      { title: "Quick Start", href: "/docs/quickstart" },
    ],
  },
  {
    title: "Language Reference",
    items: [
      { title: "EBNF Grammar", href: "/docs/grammar", badge: "v1.1" },
      { title: "Primitives & Literals", href: "/docs/syntax" },
      { title: "Form Structure", href: "/docs/form-structure" },
      { title: "Fields & Types", href: "/docs/fields" },
      { title: "UI Blocks", href: "/docs/ui-blocks" },
      { title: "Validation Rules", href: "/docs/validation" },
      { title: "Layout Blocks", href: "/docs/layout" },
    ],
  },
  {
    title: "Dynamic Behavior",
    items: [
      { title: "Conditionals", href: "/docs/conditionals" },
      { title: "Compute Expressions", href: "/docs/compute" },
      { title: "Repeat Groups", href: "/docs/repeat" },
      { title: "Actions & Triggers", href: "/docs/actions" },
    ],
  },
  {
    title: "Reusability",
    items: [
      { title: "Group Definitions", href: "/docs/groups" },
      { title: "Variables (var)", href: "/docs/variables" },
      { title: "Multi-Page Forms", href: "/docs/pages" },
      { title: "Data Sources", href: "/docs/sources" },
    ],
  },
  {
    title: "Examples",
    items: [
      { title: "Customer Feedback", href: "/docs/examples" },
      { title: "Employee Survey", href: "/docs/examples#survey" },
      { title: "Multi-Step Wizard", href: "/docs/examples#wizard" },
    ],
  },
];

function NavGroupItem({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const isAnyActive = group.items.some((item) => pathname === item.href);
  const [open, setOpen] = useState(isAnyActive || group.title === "Getting Started" || group.title === "Language Reference");

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono uppercase tracking-[0.12em] text-foreground/40 hover:text-foreground/70 transition-colors"
      >
        <span>{group.title}</span>
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>

      {open && (
        <div className="ml-3 border-l border-foreground/10 pl-3 space-y-0.5">
          {group.items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between py-1.5 px-2 text-sm rounded-sm transition-all duration-200 ${
                  isActive
                    ? "text-foreground bg-foreground/[0.06] font-medium"
                    : "text-foreground/55 hover:text-foreground hover:bg-foreground/[0.03]"
                }`}
              >
                <span>{item.title}</span>
                {item.badge && (
                  <span className="text-[9px] font-mono uppercase tracking-wider text-foreground/30 border border-foreground/15 px-1.5 py-0.5 rounded-sm">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DocsSidebar() {
  return (
    <aside className="w-[260px] shrink-0 border-r border-foreground/10 flex flex-col h-full overflow-y-auto">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-foreground/10">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-lg tracking-tight">Formix</span>
          <span className="text-muted-foreground font-mono text-[10px] mt-0.5">.forml</span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/30 border border-foreground/15 px-1.5 py-0.5">
            Docs
          </span>
          <span className="text-[10px] font-mono text-foreground/25">v1.1</span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-4 px-2">
        {navGroups.map((group) => (
          <NavGroupItem key={group.title} group={group} />
        ))}
      </nav>

      {/* Footer links */}
      <div className="px-4 py-4 border-t border-foreground/10 space-y-2">
        <Link
          href="/editor/demo"
          className="flex items-center gap-2 text-xs text-foreground/40 hover:text-foreground transition-colors font-mono"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Open Editor
        </Link>
        <Link
          href="https://github.com"
          target="_blank"
          className="text-xs text-foreground/40 hover:text-foreground transition-colors font-mono"
        >
          GitHub ↗
        </Link>
      </div>
    </aside>
  );
}
