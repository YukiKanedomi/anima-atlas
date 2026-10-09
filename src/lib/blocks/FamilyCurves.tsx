// 翼振動章：モード族の曲線（周波数 vs 節直径）（雛形。実装で置き換える）
export type FamilyCurvesConfig = {
  title?: string;
  caption?: string;
};

export default function FamilyCurves({ config }: { config: FamilyCurvesConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "モード族の曲線（周波数 vs 節直径）"}</figcaption>
      <p className="mt-2">この部品（family-curves）は準備中です。</p>
    </figure>
  );
}
