// ESLint flat config (ESLint 9). Replaces the removed `next lint` command.
// Rules: Next.js core-web-vitals + TypeScript, React hooks, and jsx-a11y
// accessibility checks (Design.md ADR-044) so unlabelled controls and
// dialogs without roles are caught before review.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
      ".kilo/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "plugin:jsx-a11y/recommended"),
  {
    rules: {
      // Icon-only controls must have an accessible name (BUG-032).
      "jsx-a11y/control-has-associated-label": [
        "warn",
        { ignoreElements: ["input", "textarea", "select", "td", "th", "tr"], depth: 3 },
      ],
      // <label> wrapping our own controls counts as associated.
      "jsx-a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["CustomSelect", "CustomDatePicker"], depth: 3 },
      ],
      // Focus is moved deliberately into dialogs and inline editors the user just
      // opened (WAI-ARIA dialog pattern), never on page load.
      "jsx-a11y/no-autofocus": "off",
      // Avatars come from private authenticated routes and blob: URLs, which
      // next/image cannot optimise.
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
];

export default eslintConfig;
