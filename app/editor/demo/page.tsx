import type { Metadata } from "next";
<<<<<<< HEAD
import { DemoIdeShell } from "@/components/editor/demo-ide-shell";

export const metadata: Metadata = {
  title: "Formix | Editor Demo",
  description: "Formix three-panel editor demo workspace.",
};

export default function DemoEditorPage() {
  return (
    <div style={{ height: "100dvh", overflow: "hidden" }}>
      <DemoIdeShell />
=======
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export const metadata: Metadata = {
  title: "Formix | Workspace",
  description: "Formix authoring workspace — project explorer, editor, live preview, diagnostics.",
};

export default function WorkspacePage() {
  return (
    <div style={{ height: "100dvh", overflow: "hidden" }}>
      <WorkspaceShell />
>>>>>>> f6620dd (Complete Formix updates)
    </div>
  );
}
