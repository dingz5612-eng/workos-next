import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "src/generated/**",
        "src/__tests__/**"
      ],
      reporter: ["text", "html", "json-summary"]
    }
  }
});
