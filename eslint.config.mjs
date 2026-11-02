import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const coreWithAdvisoryReactRules = nextCoreWebVitals.map((config) =>
  config.plugins?.["react-hooks"]
    ? {
        ...config,
        rules: {
          ...config.rules,
          // These React Compiler rules are advisory for the existing
          // load-on-mount patterns. Keep them visible without blocking CI.
          "react-hooks/set-state-in-effect": "warn",
          "react-hooks/preserve-manual-memoization": "warn",
        },
      }
    : config,
);

const eslintConfig = [
  ...coreWithAdvisoryReactRules,
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
      "tests/.build/**",
    ],
  },
];

export default eslintConfig;
