// 翼振動章：Haigh（Goodman）線図（雛形。実装で置き換える）
export type HaighDiagramConfig = {
  title?: string;
  caption?: string;
};

export default function HaighDiagram({ config }: { config: HaighDiagramConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "Haigh（Goodman）線図"}</figcaption>
      <p className="mt-2">この部品（haigh-diagram）は準備中です。</p>
    </figure>
  );
}
