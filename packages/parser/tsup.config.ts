import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  target: "es2022",
  clean: true,
  splitting: false,
  external: [
    "@focus-reader/shared",
    "postal-mime",
    "dompurify",
    "linkedom",
    "turndown",
    "@mozilla/readability",
  ],
});
