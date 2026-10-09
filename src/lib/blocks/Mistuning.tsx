// 翼振動章：ミスチューニング（翼ごとのばらつきと応答の増幅）（雛形。実装で置き換える）
export type MistuningConfig = {
  title?: string;
  caption?: string;
};

export default function Mistuning({ config }: { config: MistuningConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "ミスチューニング（翼ごとのばらつきと応答の増幅）"}</figcaption>
      <p className="mt-2">この部品（mistuning）は準備中です。</p>
    </figure>
  );
}
