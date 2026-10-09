// 翼振動章：翼のCampbell線図（遠心剛性化＋励起次数の扇）（雛形。実装で置き換える）
export type BladeCampbellConfig = {
  title?: string;
  caption?: string;
};

export default function BladeCampbell({ config }: { config: BladeCampbellConfig }) {
  return (
    <figure className="my-6 rounded-lg border border-dashed border-line bg-soft/60 p-4 text-sm text-mut">
      <figcaption className="font-serif text-base text-ink">{config.title ?? "翼のCampbell線図（遠心剛性化＋励起次数の扇）"}</figcaption>
      <p className="mt-2">この部品（blade-campbell）は準備中です。</p>
    </figure>
  );
}
