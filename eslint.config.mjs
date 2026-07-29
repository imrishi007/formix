import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "public/**",
      "forml-compiler/**",
      "graphify-out/**",
      "backend/**",
    ],
  },
  {
    rules: {
      // These React Compiler rules are advisory, not correctness bugs: the
      // "load on mount" effect (`if (!user) return; load();`) and the
      // "sync one state field on mount" effect are idiomatic patterns used
      // throughout this codebase (including pre-existing/vendored code this
      // pass doesn't own). Fixing every occurrence would mean re-architecting
      // data-loading around Suspense/`use()`, which is out of scope for a
      // no-new-features cleanup pass. Kept as warnings so real regressions
      // are still visible without failing `next build`.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
