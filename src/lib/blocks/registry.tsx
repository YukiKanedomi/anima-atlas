import type { ComponentType } from "react";
import FunctionPlot from "./FunctionPlot";
import WhirlOrbit from "./WhirlOrbit";
import Orbit from "./Orbit";
import Waveform from "./Waveform";
import Campbell from "./Campbell";
import Spectrum from "./Spectrum";
import PolarPlot from "./PolarPlot";
import Bode from "./Bode";
import ModeShape from "./ModeShape";
import Nomenclature from "./Nomenclature";

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
  {
    name: "whirl-orbit",
    title: "振れ回り軌道アニメ",
    status: "stable",
    summary:
      "上から見たロータの振れ回りを再生。r を上げると位相が反転し、重い点が中心へ寄る（自動調心）。",
    component: WhirlOrbit,
    sample: {
      title: "ためし：振れ回りと自動調心",
      zeta: 0.1,
      rDefault: 0.6,
      caption: "再生しながら r を 1 より上へ動かしてみてください。",
    },
  },
  {
    name: "orbit",
    title: "振れ回り軌道（一般版）",
    status: "stable",
    summary:
      "前向き成分Fと後ろ向き成分Bの和で軌道を表す汎用版。円・楕円・直線・前後の向き、不安定の発散も。",
    component: Orbit,
    sample: {
      title: "ためし：F と B で軌道の形と向きが決まる",
      forwardDefault: 0.9,
      backwardDefault: 0.3,
      showGrowth: true,
      caption: "F>B で前向き楕円、F<B で後ろ向き、F=B で直線。成長率を上げると発散（不安定）。",
    },
  },
  {
    name: "waveform",
    title: "振動の時間波形（オシロ風）",
    status: "stable",
    summary: "時間 t の関数を走査線つきで描く汎用波形ブロック。減衰振動・センサ波形・複数トレースに。",
    component: Waveform,
    sample: {
      title: "ためし：減衰する自由振動（リングダウン）",
      tSpan: 9,
      yMax: 1.1,
      traces: [{ label: "変位", expr: "exp(-zeta*t) * cos(6*t)", color: "accent" }],
      sliders: [{ key: "zeta", label: "減衰の強さ", min: 0, max: 1.2, step: 0.01, default: 0.35 }],
      caption: "減衰が強いほど早く収まる。ζ=0 で永遠に続く正弦波。",
    },
  },
  {
    name: "campbell",
    title: "Campbell線図（危険速度マップ）",
    status: "stable",
    summary: "回転数で固有振動数が前向き/後ろ向きに分離。1×励起線との交点＝危険速度。γと運転点を操作。",
    component: Campbell,
    sample: {
      title: "ためし：γ を上げると枝が開き、危険速度が動く",
      gammaDefault: 0.6,
      opDefault: 1.5,
      caption: "γ（円板の扁平さ）を 1 に近づけると前向き危険速度が右へ逃げ、1 を超えると消える。",
    },
  },
  {
    name: "spectrum",
    title: "FFTスペクトル（振動診断）",
    status: "stable",
    summary: "成分を足して本物のFFTで分解。時間波形↔スペクトルのピーク（1×不釣り合い・2×ミスアライメント・0.43×オイルホワール）。",
    component: Spectrum,
    sample: {
      title: "ためし：成分を足すとピークが立つ",
      components: [
        { key: "a1", freq: 1, label: "1× 不釣り合い", color: "accent", default: 0.8 },
        { key: "a2", freq: 2, label: "2× ミスアライメント", color: "heavy", default: 0.25 },
        { key: "a3", freq: 0.43, label: "0.43× オイルホワール", color: "mut", default: 0.1 }
      ],
      caption: "各スライダーを動かすと、時間波形が変わり、対応する周波数にピークが立ちます。",
    },
  },
  {
    name: "polar",
    title: "ポーラ線図（振幅＋位相の極座標）",
    status: "stable",
    summary:
      "不釣り合い応答の複素ベクトルを回転数で掃引。原点→危険速度（位相−90°）で下に大ループ。振幅と位相を1枚に束ねる計測の花形。",
    component: PolarPlot,
    sample: {
      title: "ためし：回転数を上げると応答ベクトルがループを描く",
      zetaDefault: 0.1,
      rMax: 2.5,
      caption: "底（真下）が危険速度。ζ を小さくするとループが大きく深くなります。",
    },
  },
  {
    name: "bode",
    title: "ボード線図（振幅・位相 vs 回転数）",
    status: "stable",
    summary:
      "振幅と位相を回転数の関数で上下2段に。r=1 で位相90°（共振）。link でポーラ線図と掃引点・ζを共有でき、同じ点が両図で光る。",
    component: Bode,
    sample: {
      title: "ためし：振幅は山、位相は 0→180° の S字",
      zetaDefault: 0.1,
      rMax: 2.5,
      caption: "r スライダーを動かすとカーソルが両パネルを走査。位相が 90° を切るところが危険速度。",
    },
  },
  {
    name: "mode-shape",
    title: "曲げモード形状（連続体の軸）",
    status: "stable",
    summary:
      "軸の複数の曲げモードをアニメ表示。モード1/2/3と支持（単純支持/自由）を切替。n次は (n−1) 個の節を持ち、危険速度は単純支持で 1:4:9。",
    component: ModeShape,
    sample: {
      title: "ためし：モードと支持を切り替える",
      maxMode: 3,
      boundaryDefault: "pinned",
      caption: "モードを上げると節（動かない点）が増える。支持を自由-自由にすると形が変わり、危険速度の比も変わります。",
    },
  },
  {
    name: "nomenclature",
    title: "記号一覧（nomenclature）",
    status: "stable",
    summary: "symbols.json から記号一覧を自動生成。本文の [[key]] ポップと同じ正典を使う。",
    component: Nomenclature,
    sample: { title: "記号一覧（※本編の節で記号データとともに表示）" },
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
