// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { files: ["tests/e2e/**/*.cjs"], languageOptions: { globals: { __dirname: "readonly" } } },
  {
    files: ["tests/ui/**/*.js"],
    languageOptions: { globals: Object.fromEntries(["jest", "test", "expect", "beforeEach", "afterEach"].map(name => [name, "readonly"])) },
  },
  {
    ignores: ["dist/**", "coverage/**"],
  }
]);
