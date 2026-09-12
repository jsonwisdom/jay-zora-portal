import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/jay-zora-portal/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/search": {
        target: "http://search-api:8000",
        changeOrigin: true
      },
      "/health": {
        target: "http://search-api:8000",
        changeOrigin: true
      }
    }
  }
});
