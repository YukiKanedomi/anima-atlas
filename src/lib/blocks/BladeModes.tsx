// 翼振動章：翼の固有モード（片持ちの 1F/2F/1T）（雛形。実装で置き換える）
export type BladeModesConfig = {
  title?: string;
  caption?: string;
};

export default function BladeModes({ config }: { config: BladeModesConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "翼の固有モード（片持ちの 1F/2F/1T）"}</figcaption>
      <p className="mt-2">この部品（blade-modes）は準備中です。</p>
    </figure>
  );
}
