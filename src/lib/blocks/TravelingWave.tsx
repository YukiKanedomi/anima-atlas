// 翼振動章：進行波（静止系の固定パターンが回転系で走る）（雛形。実装で置き換える）
export type TravelingWaveConfig = {
  title?: string;
  caption?: string;
};

export default function TravelingWave({ config }: { config: TravelingWaveConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "進行波（静止系の固定パターンが回転系で走る）"}</figcaption>
      <p className="mt-2">この部品（traveling-wave）は準備中です。</p>
    </figure>
  );
}
