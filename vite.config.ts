import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    // vite 6 + esbuild 0.28: destructuring em chunk dinâmico não baixa para safari14.
    // Mantidos os demais pisos do default antigo; apenas Safari 14 -> 15.
    target: ["chrome87", "edge88", "es2020", "firefox78", "safari15"],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
