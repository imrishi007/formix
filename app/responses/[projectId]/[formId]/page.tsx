import type { Metadata } from "next";
import { ResponsesShell } from "@/components/responses/responses-shell";

export const metadata: Metadata = {
  title: "Formix | Responses",
  description: "Search, sort, filter, and manage a form's responses.",
};

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ projectId: string; formId: string }>;
}) {
  const { projectId, formId } = await params;
  return <ResponsesShell projectId={projectId} formId={formId} />;
}
