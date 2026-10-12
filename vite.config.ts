import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// GitHub Pages のプロジェクトページ配信（サブパス）対策。
// base を '/anima-atlas/' に固定。データ取得は import.meta.env.BASE_URL 起点にする。
export default defineConfig({
  base: "/anima-atlas/",
  plugins: [
    react(),
    // オフライン対応（Workbox）。manifest は public/manifest.webmanifest をそのまま使う。
    // precache：アプリ本体・KaTeX の woff2・節の本文 md・outline/symbols・たとえ話アイコン（合計 5MB 前後）。
    // 和文 Web フォント（BIZ UDPGothic・Shippori Mincho）は 120 分割×ウェイトで数百ファイルあるため precache せず、使った分だけ runtime cache に残す。
    // 写真と小図（images/、約 15MB）は precache せず、見た節のぶんだけ runtime cache（CacheFirst）に残す。
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,json,md,webmanifest}", "data/icons/*.png"],
        globIgnores: ["**/data/books/**/images/**", "**/assets/biz-udpgothic-*", "**/assets/shippori-mincho-*"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/data/books/") && url.pathname.includes("/images/"),
            handler: "CacheFirst",
            options: {
              cacheName: "aa-images",
              expiration: { maxEntries: 600, maxAgeSeconds: 180 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "font",
            handler: "CacheFirst",
            options: { cacheName: "aa-fonts", expiration: { maxEntries: 400, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
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
