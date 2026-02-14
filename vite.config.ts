import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

import emailServerPlugin from "./plugins/vite-email-server";
import rcmProxyPlugin from "./plugins/vite-rcm-proxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    emailServerPlugin(),
    rcmProxyPlugin(),
    react(),

  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
