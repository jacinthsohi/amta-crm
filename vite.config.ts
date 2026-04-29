import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Lets you write `import { foo } from "@/lib/foo"` instead of long
      // relative paths like `../../lib/foo`. Standard convention.
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    open: true, // Auto-open browser when dev server starts
  },
});
