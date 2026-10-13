import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["shared/**/*.test.ts", "server/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "client",
          environment: "happy-dom",
          include: ["client/**/*.test.tsx"],
          setupFiles: ["client/src/test-setup.ts"],
        },
      },
    ],
  },
});
