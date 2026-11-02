import { Suspense } from "react";
import { PreviewForm } from "./preview-form";


export default async function PreviewFormPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return <Suspense fallback={null}><PreviewForm formId={formId} /></Suspense>;
}
