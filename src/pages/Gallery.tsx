import { blocks } from "../lib/blocks/registry";

// お試し場：登録ブロックを試運転設定で並べて見比べる場所。
// 「自由に試作 → ここで見比べ → 勝者を stable に昇格」の見比べ画面。
export default function Gallery() {
  return (
    <div className="max-w-content">
      <h1 className="text-3xl text-ink">お試し場（部品ギャラリ）</h1>
      <p className="mt-3 leading-7 text-mut">
        動く図の「部品」を、試運転の設定で並べています。新しい部品はここで見比べて、
        良かったものを本編で使う部品（<span className="text-ink">stable</span>）に昇格させていきます。
      </p>

      <div className="mt-8 space-y-10">
        {blocks.map((b) => {
          const C = b.component;
          return (
            <section key={b.name}>
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
              <C config={b.sample} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
