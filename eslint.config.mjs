import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated and tooling output:
    "coverage/**",
    ".superpowers/**",
    // Figma console tooling, kept for the design handoffs.
    "docs/handoffs/figma-scripts/**",
  ]),
]);

export default eslintConfig;
