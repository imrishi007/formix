/**
 * components/home/footer.tsx
 * Brand-new footer — same link set as the deleted footer-section.tsx
 * (product anchors, docs routes, socials), no decorative canvas animation
 * this time, just the same dark canvas as the rest of the page.
 */

import { ArrowUpRight } from "lucide-react";

const PRODUCT_LINKS = [
  { name: "Why Formix", href: "#features" },
  { name: "Pipeline", href: "#pipeline" },
  { name: "Live Demo", href: "#demo" },
];

const DEVELOPER_LINKS = [
  { name: "Forml Grammar", href: "/docs/grammar" },
  { name: "DSL Reference", href: "/docs/syntax" },
  { name: "Fields & Types", href: "/docs/fields" },
  { name: "Examples", href: "/docs/examples" },
];

const SOCIAL_LINKS = [
  { name: "GitHub", href: "https://github.com" },
  { name: "LinkedIn", href: "https://linkedin.com" },
];

export function HomeFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="gradient-accent flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-black text-white">FX</span>
              <span className="font-display text-xl text-foreground">Formix</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Forms as code. Describe them in plain language, compile them with a real language toolchain, ship them
              anywhere.
            </p>
            <div className="mt-6 flex gap-6">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {s.name}
                  <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-foreground">Product</h3>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.name}>
                  <a href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-foreground">Developers</h3>
            <ul className="space-y-3">
              {DEVELOPER_LINKS.map((l) => (
                <li key={l.name}>
                  <a href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">© 2026 Formix. All rights reserved.</p>
          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Compiler: Ready
          </span>
        </div>
      </div>
    </footer>
  );
}
