// 翼振動章：励起次数の折り返し（空間エイリアシング）（雛形。実装で置き換える）
export type EoFoldingConfig = {
  title?: string;
  caption?: string;
};

export default function EoFolding({ config }: { config: EoFoldingConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "励起次数の折り返し（空間エイリアシング）"}</figcaption>
      <p className="mt-2">この部品（eo-folding）は準備中です。</p>
    </figure>
  );
}
