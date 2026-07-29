import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "Formix | Dashboard",
  description: "Overview of your forms, responses, and activity.",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
