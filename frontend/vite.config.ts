import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: [new URL(".", import.meta.url).pathname, new URL("../shared", import.meta.url).pathname],
    },
    watch: { usePolling: true }, // nécessaire pour le rechargement à chaud dans Docker
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
