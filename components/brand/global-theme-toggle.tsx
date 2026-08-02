"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/brand/theme-toggle";

/**
 * Supplies the theme control to pages that do not have a shared navigation
 * bar. Pages with a dedicated top bar render the same control inside that bar
 * so it does not obscure page actions.
 */
export function GlobalThemeToggle() {
  const pathname = usePathname();
  const hasOwnTopBar = pathname === "/" || pathname.startsWith("/docs") || pathname.startsWith("/editor") || pathname.startsWith("/dashboard") || pathname === "/compiler";

  if (hasOwnTopBar) return null;

  return (
    <div className="fixed right-4 top-4 z-[100]">
      <ThemeToggle />
    </div>
  );
}
