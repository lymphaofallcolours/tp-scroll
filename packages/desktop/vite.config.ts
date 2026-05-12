import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
    target: "chrome120",
    rollupOptions: {
      input: "src/index.html",
    },
  },
  test: {
    environment: "jsdom",
    include: ["../tests/**/*.test.ts", "../tests/**/*.test.tsx"],
  },
});
