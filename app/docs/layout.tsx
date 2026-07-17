import type { Metadata } from "next";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const metadata: Metadata = {
  title: "Formix Documentation",
  description: "Complete reference for the Forml DSL — EBNF grammar, field types, validation, actions, and examples.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <DocsSidebar />
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
