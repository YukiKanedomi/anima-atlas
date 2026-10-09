// 翼振動章：励起の次数分解（ノズル後流・部分噴射）（雛形。実装で置き換える）
export type ExcitationHarmonicsConfig = {
  title?: string;
  caption?: string;
};

export default function ExcitationHarmonics({ config }: { config: ExcitationHarmonicsConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "励起の次数分解（ノズル後流・部分噴射）"}</figcaption>
      <p className="mt-2">この部品（excitation-harmonics）は準備中です。</p>
    </figure>
  );
}
