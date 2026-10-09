// 翼振動章：ブレードチップタイミング（1回転1点のサンプリング）（雛形。実装で置き換える）
export type TipTimingConfig = {
  title?: string;
  caption?: string;
};

export default function TipTiming({ config }: { config: TipTimingConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "ブレードチップタイミング（1回転1点のサンプリング）"}</figcaption>
      <p className="mt-2">この部品（tip-timing）は準備中です。</p>
    </figure>
  );
}
