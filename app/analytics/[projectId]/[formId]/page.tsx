import type { Metadata } from "next";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";

export const metadata: Metadata = {
  title: "Formix | Analytics",
  description: "Response statistics and per-field breakdowns for a form.",
};

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string; formId: string }>;
}) {
  const { projectId, formId } = await params;
  return <AnalyticsShell projectId={projectId} formId={formId} />;
}
