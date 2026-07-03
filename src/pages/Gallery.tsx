import { useEffect, useRef, useState, type ReactNode } from "react";
import { blocks } from "../lib/blocks/registry";

// お試し場：登録ブロックを試運転設定で並べて見比べる場所。
// 「自由に試作 → ここで見比べ → 勝者を stable に昇格」の見比べ画面。
//
// パフォーマンス：全ブロックを一斉マウントすると requestAnimationFrame が
// 同時稼働してスマホで重くなるため、画面に近づいた部品だけ実マウントする。

// 画面外のブロックを実マウントしない遅延ラッパ。
// ・rootMargin を広めに取り、スクロールで近づいた時点で本体を生成する。
// ・一度マウントしたら維持（アンマウントするとスライダー等の操作状態が飛ぶため）。
function LazyBlock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // すでにマウント済みなら監視は不要（維持方針）。
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    // IntersectionObserver 非対応環境（古いブラウザ）では素直に即マウント。
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      // 600px 手前で先読みマウント＝スクロール到達時にはもう動いている。
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  return (
    <div ref={ref}>
      {mounted ? (
        children
      ) : (
        // 実ブロックと同程度の高さのプレースホルダ（レイアウトのガタつき防止）。
        <div className="my-6 flex min-h-[360px] items-center justify-center rounded-lg border border-line bg-soft">
          <span className="text-sm text-mut">スクロールで読み込み</span>
        </div>
      )}
    </div>
  );
}

export default function Gallery() {
  // ジャンプナビ：チップを押すと該当カードへスムーズスクロール。
  // カードの id は "block-<name>"（ディレクティブ名なので一意）。
  const jumpTo = (name: string) => {
    document
      .getElementById(`block-${name}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="max-w-content">
      <h1 className="text-3xl text-ink">お試し場（部品ギャラリ）</h1>
      <p className="mt-3 leading-7 text-mut">
        動く図の「部品」を、試運転の設定で並べています。新しい部品はここで見比べて、
        良かったものを本編で使う部品（<span className="text-ink">stable</span>）に昇格させていきます。
      </p>

      {/* ジャンプナビ：部品名のピルを折り返しで並べる（長いページの目次代わり） */}
      <nav aria-label="部品へジャンプ" className="mt-6 flex flex-wrap gap-2">
        {blocks.map((b) => (
          <button
            key={b.name}
            type="button"
            onClick={() => jumpTo(b.name)}
            className="rounded-full border border-line bg-white px-3 py-1 text-xs text-mut transition-colors hover:border-accent hover:text-accent"
          >
            {b.title}
          </button>
        ))}
      </nav>

      <div className="mt-8 space-y-10">
        {blocks.map((b) => {
          const C = b.component;
          return (
            // scroll-mt でジャンプ着地時に見出しが上端に張り付きすぎないようにする。
            <section key={b.name} id={`block-${b.name}`} className="scroll-mt-6">
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl text-ink">{b.title}</h2>
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-xs " +
                    (b.status === "stable"
                      ? "bg-accent/10 text-accent"
                      : "bg-soft2 text-mut")
                  }
                >
                  {b.status === "stable" ? "本採用" : "試作中"}
                </span>
                <code className="ml-auto text-xs text-mut">:::{b.name}</code>
              </div>
              <p className="mt-1 text-sm text-mut">{b.summary}</p>
              <LazyBlock>
                <C config={b.sample} />
              </LazyBlock>
            </section>
          );
        })}
      </div>
    </div>
  );
}
