// 翼振動章：ZZENF（SAFE）線図（雛形。実装で置き換える）
export type ZzenfConfig = {
  title?: string;
  caption?: string;
};

export default function Zzenf({ config }: { config: ZzenfConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "ZZENF（SAFE）線図"}</figcaption>
      <p className="mt-2">この部品（zzenf）は準備中です。</p>
    </figure>
  );
}
