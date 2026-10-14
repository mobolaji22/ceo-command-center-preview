import next from "eslint-config-next";

// The React Compiler rules are errors and lint allows no warnings (package.json), so a new problem fails the check
// instead of joining a pile. Lint was brought to zero in P6.10; keep it there.
const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react/jsx-no-comment-textnodes": "off",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/use-memo": "error",
      "react-hooks/purity": "error",
      "react-hooks/refs": "error",
      "react-hooks/immutability": "error",
      "react-hooks/static-components": "error",
      "react-hooks/preserve-manual-memoization": "error",
      // AGENTS.md and ADR-0011: no database client or vendor SDK in this repo; data goes through the DataSource.
      "no-restricted-imports": ["error", { patterns: [{ group: ["@supabase/*", "**/integrations/supabase/**"], message: "No Supabase in the Command Center (AGENTS.md, ADR-0011): data goes through the DataSource to the v4 API." }] }],
    },
  },
];

export default config;
