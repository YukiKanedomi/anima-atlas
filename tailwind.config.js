/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // 配色トークンは index.css の CSS変数を参照（テーマ差し替えしやすく）
      colors: {
        paper: "var(--bg)",
        ink: "var(--ink)",
        mut: "var(--mut)",
        accent: "var(--accent)",
        "accent-d": "var(--accent-d)",
        line: "var(--line)",
        soft: "var(--soft)",
        soft2: "var(--soft2)",
      },
      fontFamily: {
        // 見出し＝セリフ（A案）、UI/ラベル＝サンセリフ
        serif: ['"Hiragino Mincho ProN"', '"Yu Mincho"', "Georgia", "serif"],
        ui: ['"Yu Gothic UI"', "system-ui", "sans-serif"],
      },
      maxWidth: { content: "760px" },
      boxShadow: {
        card: "0 3px 10px rgba(20,30,50,.05)",
        pop: "0 12px 32px rgba(0,0,0,.18)",
      },
    },
  },
  plugins: [],
};
