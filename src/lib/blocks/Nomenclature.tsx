import { useSymbols } from "../symbols";

// 記号一覧（nomenclature）。symbols.json から自動生成する。
// 本文の [[key]] ポップと同じ正典を使うので、二重管理にならない。
export type NomenclatureConfig = { title?: string };

export default function Nomenclature({ config }: { config: NomenclatureConfig }) {
  const syms = Object.values(useSymbols());

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      <figcaption className="mb-2 font-serif text-base text-ink">
        {config.title ?? "記号一覧"}
      </figcaption>
      {syms.length === 0 ? (
        <p className="text-sm text-mut">（記号データがありません）</p>
      ) : (
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {syms.map((s) => (
            <div key={s.key} className="flex items-baseline gap-2">
              <dt className="min-w-[2.2em] font-serif text-ink">{s.glyph}</dt>
              <dd className="text-sm text-mut">
                <span className="text-ink">{s.name}</span>
                {s.unit && s.unit !== "-" ? <span>（{s.unit}）</span> : null}
                {s.read ? <span className="ml-1 text-xs">／{s.read}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </figure>
  );
}
