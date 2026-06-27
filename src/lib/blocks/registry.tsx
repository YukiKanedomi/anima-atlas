import type { ComponentType } from "react";
import FunctionPlot from "./FunctionPlot";

// ブロック部品の「型契約」とレジストリ。
// ・本文（Markdown）は :::ブロック名 でここに登録された部品を呼ぶ。
// ・status: "stable"=本採用 / "experimental"=試作中（ギャラリで見比べ、勝てば stable に昇格）。
// ・未登録/改名のブロックはクラッシュさせず代替表示（蓄積が壊れない）。

export type BlockDef = {
  name: string; // ディレクティブ名（例 "function-plot"）
  title: string; // ギャラリ表示用の名前
  status: "stable" | "experimental";
  summary: string; // どんな部品か一言
  component: ComponentType<{ config: any }>;
  sample: unknown; // ギャラリで見せる試運転用の設定
};

export const blocks: BlockDef[] = [
  {
    name: "function-plot",
    title: "スライダー連動グラフ（y = f(x)）",
    status: "stable",
    summary:
      "数式とスライダーを宣言するだけで、本物の曲線がリアルタイムに動く汎用ブロック。",
    component: FunctionPlot,
    sample: {
      title: "ためし：減衰のある共振の山",
      xKey: "r",
      xLabel: "回転数の比 r = Ω / ωn",
      yLabel: "揺れの大きさ R / e",
      xMin: 0,
      xMax: 3,
      yMin: 0,
      yMax: 6,
      expr: "(r*r) / sqrt((1 - r*r)^2 + (2*zeta*r)^2)",
      markerX: 1,
      markerLabel: "危険速度",
      sliders: [
        { key: "zeta", label: "減衰比 ζ", min: 0.05, max: 1, step: 0.01, default: 0.2 },
      ],
      caption: "ζ を小さくすると山が高く鋭くなる。",
    },
  },
];

export function getBlock(name: string): BlockDef | undefined {
  return blocks.find((b) => b.name === name);
}

// 未登録ブロックの代替表示（壊さないための保険）。
export function UnknownBlock({ name }: { name: string }) {
  return (
    <div className="my-6 rounded-lg border border-dashed border-line bg-soft p-4 text-sm text-mut">
      <span className="font-ui">未登録のブロック：</span>
      <code className="font-ui text-ink">{name}</code>
      <span className="ml-1">（部品が見つからないため、ここは仮表示です）</span>
    </div>
  );
}
