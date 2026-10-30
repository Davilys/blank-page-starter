import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  build: {
    target: ["chrome87", "edge88", "es2020", "firefox78", "safari15"],
    reportCompressedSize: false,
    chunkSizeWarningLimit: 100000,
  },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
