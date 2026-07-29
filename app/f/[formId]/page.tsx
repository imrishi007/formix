import type { Metadata } from "next";
import { Suspense } from "react";
import { FormRenderer } from "./form-renderer";

type Props = {
  params: Promise<{ formId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Form | Formix",
    description: "Fill out this form, powered by Formix.",
    openGraph: {
      title: "Formix Form",
      description: "Fill out this form, powered by Formix.",
    },
  };
}

export default async function PublicFormPage({ params }: Props) {
  const { formId } = await params;
  return (
    <Suspense fallback={null}>
      <FormRenderer formId={formId} />
    </Suspense>
  );
}
