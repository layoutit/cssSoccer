import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "CSSOCCER_");
  const exactCapture = process.env.CSSOCCER_EXACT_CAPTURE === "1";
  return {
    publicDir: env.CSSOCCER_VITE_PUBLIC_DIR || "build/generated/public",
    server: {
      host: "127.0.0.1",
      hmr: exactCapture ? false : undefined,
      // Exact captures stream ignored evidence beneath .local while Vite is
      // serving the browser candidate. Those writes are not application
      // inputs and must never reload the page mid-capture.
      watch: {
        ignored: ["**/.local/**"],
      },
    },
    preview: {
      host: "127.0.0.1",
    },
  };
});
