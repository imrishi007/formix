"use client";

import { useSearchParams } from "next/navigation";
import { FormRenderer } from "../../../f/[formId]/form-renderer";


export function PreviewForm({ formId }: { formId: string }) {
  const token = useSearchParams().get("token");
  if (!token) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Preview token is missing.</main>;
  }
  return <FormRenderer formId={formId} previewToken={token} />;
}
