import { useState } from "react";

// ドメイン部品：規格マップ（ロータの一生×ものさし）。
// 「作る前にどれだけ釣り合わせる？」「動かしてからこの揺れは大丈夫？」「機種ごとの約束は？」
// という局面ごとに、効いてくる規格（ISO 21940 / ISO 20816 / API 等）を地図的に示す。
// データ駆動：規格の番号・名称・用途は config から流し込む（本文と同じ正典）。
// ※ 概観のための模式。実際の適用は各規格の最新版・該当パート・該当機種を参照。

export type StdItem = { code: string; name: string; use: string };
export type StdStage = { label: string; question: string; lead: string; standards: StdItem[] };
export type StandardsMapConfig = {
  title?: string;
  caption?: string;
  stages: StdStage[];
};

export default function StandardsMap({ config }: { config: StandardsMapConfig }) {
  const stages = config.stages ?? [];
  const [sel, setSel] = useState(0);
  const s = stages[sel];

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-3 font-serif text-base text-ink">{config.title}</figcaption> : null}

      {/* ロータの一生：局面を選ぶ */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {stages.map((st, i) => (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={
                "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                (i === sel
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-soft text-mut hover:border-accent/50 hover:text-ink")
              }
            >
              <span className="mr-1 tabular-nums opacity-70">{i + 1}</span>
              {st.label}
            </button>
            {i < stages.length - 1 ? (
              <span className="px-1 text-mut/40" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* 選んだ局面の詳細 */}
      {s ? (
        <div className="mt-4 rounded-lg border-l-4 border-accent bg-soft px-4 py-3">
          <p className="font-serif text-[15px] text-ink">{s.question}</p>
          <p className="mt-1 text-sm leading-relaxed text-mut">{s.lead}</p>
          <ul className="mt-3 space-y-2.5">
            {s.standards.map((st, k) => (
              <li key={k} className="text-sm">
                <span className="rounded bg-accent/10 px-1.5 py-0.5 font-ui text-[12px] font-semibold text-accent">{st.code}</span>
                <span className="ml-2 text-ink">{st.name}</span>
                <span className="mt-0.5 block leading-relaxed text-mut">{st.use}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
