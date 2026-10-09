// 翼振動章：摩擦ダンパ（押し付け力と等価減衰）（雛形。実装で置き換える）
export type FrictionDamperConfig = {
  title?: string;
  caption?: string;
};

export default function FrictionDamper({ config }: { config: FrictionDamperConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "摩擦ダンパ（押し付け力と等価減衰）"}</figcaption>
      <p className="mt-2">この部品（friction-damper）は準備中です。</p>
    </figure>
  );
}
