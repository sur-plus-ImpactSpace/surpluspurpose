import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "05_Landingpage/**",
      "tools/**",
      "**/.next/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/* [0-9].ts",
      "**/* [0-9].tsx",
      "**/* [0-9].js",
      "**/* [0-9].mjs",
      "**/* 2.*",
      "**/* 3.*",
      "**/* 4.*",
      "**/* 5.*",
      "**/* 6.*",
      "**/* 7.*",
      "**/* 8.*",
      "**/* 9.*"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
);
