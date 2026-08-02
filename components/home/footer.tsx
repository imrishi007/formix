import { ArrowUpRight } from "lucide-react";
import { FormixLogo } from "@/components/brand/formix-logo";

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
    <footer className="relative border-t border-(--border-hairline) bg-(--bg-subtle) px-8 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              {/* Shared brand mark — single component, accent color,
                  same mark as nav/editor/docs (design.md §Logo) */}
              <FormixLogo size={28} variant="color" aria-hidden="true" />
              <span className="text-xl tracking-tight text-(--ink-primary) font-semibold">Formix</span>
            </div>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-(--ink-secondary)">
              Forms as code. Describe them in plain language, compile them with a real language toolchain, ship them
              anywhere.
            </p>
            <div className="mt-8 flex gap-8">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1.5 text-base text-(--ink-secondary) transition-colors hover:text-(--ink-primary)"
                >
                  {s.name}
                  <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-6 text-xs tracking-[0.03em] text-(--ink-primary) uppercase font-semibold">Product</h3>
            <ul className="space-y-4">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.name}>
                  <a href={l.href} className="text-base text-(--ink-secondary) transition-colors hover:text-(--ink-primary)">
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-6 text-xs tracking-[0.03em] text-(--ink-primary) uppercase font-semibold">Developers</h3>
            <ul className="space-y-4">
              {DEVELOPER_LINKS.map((l) => (
                <li key={l.name}>
                  <a href={l.href} className="text-base text-(--ink-secondary) transition-colors hover:text-(--ink-primary)">
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-(--border-hairline) pt-10 sm:flex-row">
          <p className="text-base text-(--ink-secondary)">© 2026 Formix. All rights reserved.</p>
          <span className="flex items-center gap-2 text-sm text-(--ink-tertiary) font-medium">
            <span className="h-2 w-2 rounded-full bg-(--accent-success)" />
            Compiler: Ready
          </span>
        </div>
      </div>
    </footer>
  );
}
