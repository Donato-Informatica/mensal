// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Single flat config for every workspace.
export default defineConfig(
  globalIgnores([".agents/", ".agent/", ".claude/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["*.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
  prettier
);
