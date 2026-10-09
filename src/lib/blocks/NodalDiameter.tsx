// 翼振動章：節直径（翼付き円盤のモード形）（雛形。実装で置き換える）
export type NodalDiameterConfig = {
  title?: string;
  caption?: string;
};

export default function NodalDiameter({ config }: { config: NodalDiameterConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "節直径（翼付き円盤のモード形）"}</figcaption>
      <p className="mt-2">この部品（nodal-diameter）は準備中です。</p>
    </figure>
  );
}
