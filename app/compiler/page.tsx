import type { Metadata } from "next";
import { CompilerPlayground } from "@/components/editor/compiler-playground";

export const metadata: Metadata = {
  title: "Formix | Compiler Playground",
  description: "Live FORML compiler playground — lexer, parser, semantic analysis, AST, and form preview powered by WebAssembly.",
};

export default function CompilerPage() {
  return <CompilerPlayground />;
}
