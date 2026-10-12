import { useEffect, useState, type ReactNode } from "react";

// 動く部品の共通の足元：「初期値に戻す」（部品を作り直して既定値へ）と「大きく見る」（画面いっぱいに同じ部品を開く）。
// 部品側に手を入れずに済むよう、戻すは key の付け替え、大きく見るは別インスタンスの描画で実現する。
// 読み物寄りの部品（予想クイズ・記号表・規格の地図）には足元を付けない
const NO_TOOLS = new Set(["predict", "nomenclature", "standards-map"]);

export function BlockFrame({
  name,
  render,
}: {
  name: string;
  render: () => ReactNode;
}) {
  const [gen, setGen] = useState(0);
  const [big, setBig] = useState(false);
  const tools = !NO_TOOLS.has(name);

  useEffect(() => {
    if (!big) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBig(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [big]);

  return (
    <div className="clear-both">
      <div key={gen}>{render()}</div>
      {tools ? (
        <div className="-mt-4 mb-6 flex justify-end gap-3 pr-1 text-xs text-mut">
          <button
            onClick={() => setGen((g) => g + 1)}
            className="transition-colors hover:text-accent"
            title={`${name} を初期値に戻す`}
          >
            ↺ 初期値に戻す
          </button>
          <button
            onClick={() => setBig(true)}
            className="hidden transition-colors hover:text-accent sm:inline"
          >
            ⤢ 大きく見る
          </button>
        </div>
      ) : null}
      {big ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-paper"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} を大きく表示`}
        >
          <div className="mx-auto max-w-5xl px-4 pb-10 pt-3">
            <div className="flex justify-end">
              <button
                onClick={() => setBig(false)}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-full text-mut hover:bg-soft hover:text-ink"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3l10 10M13 3L3 13"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {render()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
