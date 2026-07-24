import type { Metadata } from "next";
<<<<<<< HEAD
=======
import { Suspense } from "react";
>>>>>>> f6620dd (Complete Formix updates)
import { FormRenderer } from "./form-renderer";

type Props = {
  params: Promise<{ formId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { formId } = await params;
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
<<<<<<< HEAD
  return <FormRenderer formId={formId} />;
=======
  return (
    <Suspense fallback={null}>
      <FormRenderer formId={formId} />
    </Suspense>
  );
>>>>>>> f6620dd (Complete Formix updates)
}
