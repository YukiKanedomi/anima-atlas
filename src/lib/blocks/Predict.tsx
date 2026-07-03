import { useState } from "react";

// 横断部品：予測プロンプト。ブロックを触る前に「どうなると思う？」と一呼吸置く。
// explorable の学習効果を底上げする定番の仕掛け（受け身の閲覧→能動的な予測に変える）。
// ・選ぶまで答えは出ない。選んだら、正解/おしい の別なくやさしく開示して本編（ブロック）へ促す。
// ・間違いを責めない色使い（正解=緑、おしい=金。赤=危険の意味を使わない）。

export type PredictConfig = {
  question: string;
  options: string[];
  answer: number; // 正解の添字
  reveal: string; // 開示文（なぜそうなるか＋「確かめてみて」の促し）
  chip?: string; // 既定「予想してみよう」
};

const GREEN = "#1f7a4f";
const GOLD = "#c08a2e";

export default function Predict({ config }: { config: PredictConfig }) {
  const [picked, setPicked] = useState<number | null>(null);
  const opts = config.options ?? [];
  const done = picked !== null;
  const correct = done && picked === config.answer;

  return (
    <aside className="my-6 rounded-lg border border-line bg-soft/60 p-4">
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="text-accent">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="7" cy="7" r="1.8" fill="currentColor" />
        </svg>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">
          {config.chip ?? "予想してみよう"}
        </span>
      </div>

      <p className="mt-2 font-serif text-[15px] leading-7 text-ink">{config.question}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {opts.map((op, i) => {
          const isPick = picked === i;
          const isAns = done && i === config.answer;
          // 開示後：正解=緑枠、選んだ不正解=金枠、他=淡色
          const cls = !done
            ? "border-line bg-white text-ink hover:border-accent hover:text-accent"
            : isAns
            ? "border-[#1f7a4f] bg-[#1f7a4f]/10 text-[#1f7a4f] font-semibold"
            : isPick
            ? "border-[#c08a2e] bg-[#c08a2e]/10 text-[#c08a2e]"
            : "border-line bg-white text-mut opacity-60";
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              onClick={() => setPicked(i)}
              className={"rounded-full border px-3.5 py-1.5 text-sm transition-colors " + cls}
            >
              {op}
            </button>
          );
        })}
      </div>

      {done ? (
        <div
          className="mt-3 rounded-md border-l-4 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink/90"
          style={{ borderLeftColor: correct ? GREEN : GOLD }}
        >
          <span className="font-semibold" style={{ color: correct ? GREEN : GOLD }}>
            {correct ? "そのとおり。" : `おしい——答えは「${opts[config.answer]}」。`}
          </span>{" "}
          {config.reveal}
        </div>
      ) : null}
    </aside>
  );
}
