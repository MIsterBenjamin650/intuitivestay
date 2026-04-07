import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    port: 5173,
  },
  ssr: {
    // These workspace packages use subpath imports that Vite's SSR bundler
    // cannot resolve at build time — load them as native Node.js modules instead.
    external: ["@intuitive-stay/auth", "@intuitive-stay/api", "@intuitive-stay/db"],
  },
});
