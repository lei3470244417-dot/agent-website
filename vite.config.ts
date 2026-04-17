import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_AGENT_PROXY_TARGET || "http://127.0.0.1:8000";
  const pathRewrite =
    env.VITE_AGENT_PROXY_PATH || "/chat";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api/agent": {
          target,
          changeOrigin: true,
          rewrite: (p) => {
            const next = p.replace(/^\/api\/agent/, pathRewrite);
            return next === "" ? "/" : next;
          },
        },
      },
    },
  };
});
