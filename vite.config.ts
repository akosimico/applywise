import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "client",

  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    allowedHosts: ["discount-alienate-try.ngrok-free.dev"],
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
  },

});
