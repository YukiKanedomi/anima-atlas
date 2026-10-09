// 翼振動章：フラッタ（空力減衰と翼間位相角）（雛形。実装で置き換える）
export type FlutterConfig = {
  title?: string;
  caption?: string;
};

export default function Flutter({ config }: { config: FlutterConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "フラッタ（空力減衰と翼間位相角）"}</figcaption>
      <p className="mt-2">この部品（flutter）は準備中です。</p>
    </figure>
  );
}
