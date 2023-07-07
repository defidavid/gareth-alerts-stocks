// eslint-disable-next-line no-undef
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json", "./tsconfig.dev.json"],
    sourceType: "module",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "./eslintrc.js",
    "scripts/triggerFunctionTopic.js",
    "jest.config.ts",
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    "quotes": ["error", "double"],
    "indent": ["error", 2, { SwitchCase: 1 }],
    "no-tabs": 0,
    "max-len": ["error", { code: 120 }],
    "arrow-parens": "off",
    "object-curly-spacing": ["error", "always"],
    "no-var-requires": "off",
    "no-unused-vars": "off",
    "new-cap": "off",
    "no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "operator-linebreak": "off",
    "guard-for-in": "off",
  },
};
