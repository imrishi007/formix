import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export const metadata: Metadata = {
  title: "Formix | Workspace",
  description: "Formix authoring workspace — project explorer, editor, live preview, diagnostics.",
};

export default function WorkspacePage() {
  return (
    <div style={{ height: "100dvh", overflow: "hidden" }}>
      <WorkspaceShell />
    </div>
  );
}
