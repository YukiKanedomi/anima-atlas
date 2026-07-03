import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// GitHub Pages のプロジェクトページ配信（サブパス）対策。
// base を '/anima-atlas/' に固定。データ取得は import.meta.env.BASE_URL 起点にする。
export default defineConfig({
  base: "/anima-atlas/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    rollupOptions: {
      output: {
        // 巨大な依存を別チャンクに分離（初回ロードの体感改善）。
        // ・katex は数式のためだけに大きいので単独チャンクへ。
        // ・react/react-dom も分けると、本体側の更新でキャッシュが無駄にならない。
        manualChunks: {
          katex: ["katex"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
