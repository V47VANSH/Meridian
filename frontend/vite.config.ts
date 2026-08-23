import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The dev server proxies /api to the FastAPI app so the browser only ever talks
// to one origin. That keeps development free of CORS preflights and makes the
// API base path identical in dev and production (`/api`), so no build-time
// switch is needed. Override VITE_API_PROXY_TARGET if the backend runs
// elsewhere.
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the `@/*` path mapping in tsconfig.json. Without this, tsc would
    // accept `@/api/client` and the Vite build would fail to resolve it.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
