// 配色テーマ（昼／夜）。既定は端末の設定（prefers-color-scheme）に従い、手で切り替えたら端末に記憶する。
// 実体は <html data-theme="dark"> の有無。色の値は index.css の CSS 変数側で切り替わる。

export type Theme = "light" | "dark";
const KEY = "aa-theme";

function systemTheme(): Theme {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function currentTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // 読めなければ端末設定
  }
  return systemTheme();
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t === "dark" ? "dark" : "";
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = t === "dark" ? "#121722" : "#1f3a5f";
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // 記憶できなくても今の画面には効く
  }
  applyTheme(t);
}

// 起動時：記憶か端末設定を反映し、端末設定の変化にも（手で選んでいない間は）追従する
export function setupTheme() {
  applyTheme(currentTheme());
  if (typeof matchMedia === "undefined") return;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    try {
      if (!localStorage.getItem(KEY)) applyTheme(systemTheme());
    } catch {
      applyTheme(systemTheme());
    }
  });
}
