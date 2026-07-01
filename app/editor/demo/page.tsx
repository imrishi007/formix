import type { Metadata } from "next";
import { DemoIdeShell } from "@/components/editor/demo-ide-shell";

export const metadata: Metadata = {
  title: "Formix | Editor Demo",
  description: "Formix three-panel editor demo workspace.",
};

export default function DemoEditorPage() {
  return <DemoIdeShell />;
}
