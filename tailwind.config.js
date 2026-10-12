/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // 配色トークンは index.css の CSS変数を参照（テーマ差し替えしやすく）
      // <alpha-value> を通すため RGB 三つ組の変数を使う（bg-accent/10 のような透明度修飾が効く）
      colors: {
        paper: "rgb(var(--bg-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        mut: "rgb(var(--mut-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        "accent-d": "rgb(var(--accent-d-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        soft: "rgb(var(--soft-rgb) / <alpha-value>)",
        soft2: "rgb(var(--soft2-rgb) / <alpha-value>)",
      },
      fontFamily: {
        // 見出し＝セリフ（A案）、UI/ラベル＝サンセリフ
        serif: ['"Shippori Mincho"', '"Hiragino Mincho ProN"', '"Yu Mincho"', "Georgia", "serif"],
        ui: ['"BIZ UDPGothic"', '"Hiragino Sans"', '"Yu Gothic UI"', "system-ui", "sans-serif"],
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
