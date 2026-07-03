import { useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：ISO 20816 流の振動評価ゲージ。
// 測った振動速度の実効値（mm/s RMS）が、ゾーン A〜D のどこに入るかを読む「ものさし」。
//   A=新品同等 / B=長期運転可 / C=長期は不適（短期可・要対策） / D=損傷リスク
// 境界値は機械の区分（大きさ・支持の硬さ）で変わる——それ自体を体感できるよう区分ピルで切替。
// ※ 境界値は各所で広く引用される代表例（模式）。実際の判定は規格の最新版・該当パートで。

export type GaugeClass = {
  key: string;
  label: string;
  bounds: [number, number, number]; // A/B, B/C, C/D 境界（mm/s RMS）
};

export type VibrationGaugeConfig = {
  title?: string;
  caption?: string;
  link?: string;
  vDefault?: number;
  classes?: GaugeClass[];
};

const DEFAULT_CLASSES: GaugeClass[] = [
  { key: "l-rigid", label: "大型・剛な支持", bounds: [2.3, 4.5, 7.1] },
  { key: "l-flex", label: "大型・柔らかい支持", bounds: [3.5, 7.1, 11.0] },
  { key: "m-rigid", label: "中型・剛な支持", bounds: [1.4, 2.8, 4.5] },
  { key: "m-flex", label: "中型・柔らかい支持", bounds: [2.3, 4.5, 7.1] },
];

const W = 560;
const H = 148;
const GL = 24; // ゲージ左端
const GR = W - 24;
const GT = 58;
const GB = 96;
const VMAX = 13; // 表示レンジ（mm/s）

const ZONES = [
  { key: "A", label: "新品同等", color: "#1f7a4f" },
  { key: "B", label: "長期運転可", color: "#1f3a5f" },
  { key: "C", label: "長期は不適", color: "#c08a2e" },
  { key: "D", label: "損傷リスク", color: "#9b2d3a" },
];

export default function VibrationGauge({ config }: { config: VibrationGaugeConfig }) {
  const classes = config.classes ?? DEFAULT_CLASSES;
  const instId = useInstanceId("gauge");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    v: config.vDefault ?? 3.2,
  });
  const v = vals.v;
  const [clsKey, setClsKey] = useState(classes[0]?.key ?? "");
  const cls = classes.find((c) => c.key === clsKey) ?? classes[0];
  const b = cls.bounds;

  const zi = v < b[0] ? 0 : v < b[1] ? 1 : v < b[2] ? 2 : 3;
  const zone = ZONES[zi];
  const sx = (val: number) => GL + (Math.min(val, VMAX) / VMAX) * (GR - GL);

  // ゾーン帯（A: 0→b0, B: b0→b1, C: b1→b2, D: b2→VMAX）
  const edges = [0, b[0], b[1], b[2], VMAX];

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      {/* 機械区分の切替 */}
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-mut">機械の区分：</span>
        {classes.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setClsKey(c.key)}
            aria-pressed={c.key === cls.key}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (c.key === cls.key
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-mut hover:border-accent/50 hover:text-ink")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="振動評価ゲージ（ゾーンA〜D）">
        {/* ゾーン帯 */}
        {ZONES.map((z, i) => (
          <g key={z.key}>
            <rect
              x={sx(edges[i])}
              y={GT}
              width={Math.max(0, sx(edges[i + 1]) - sx(edges[i]))}
              height={GB - GT}
              fill={z.color}
              opacity={zi === i ? 0.85 : 0.22}
            />
            <text
              x={(sx(edges[i]) + sx(edges[i + 1])) / 2}
              y={(GT + GB) / 2 + 5}
              fontSize="15"
              fontWeight={zi === i ? 700 : 500}
              fill={zi === i ? "#fff" : z.color}
              textAnchor="middle"
              className="font-ui"
            >
              {z.key}
            </text>
          </g>
        ))}
        {/* 境界の目盛と数値 */}
        {b.map((bv, i) => (
          <g key={i}>
            <line x1={sx(bv)} y1={GT - 6} x2={sx(bv)} y2={GB + 6} stroke="var(--ink)" strokeWidth={1} opacity={0.5} />
            <text x={sx(bv)} y={GB + 20} fontSize="11" fill="var(--mut)" textAnchor="middle" className="tabular-nums">
              {bv}
            </text>
          </g>
        ))}
        <text x={GR} y={GB + 20} fontSize="11" fill="var(--mut)" textAnchor="end">
          mm/s（実効値）
        </text>

        {/* 針（現在値） */}
        <g>
          <line x1={sx(v)} y1={GT - 16} x2={sx(v)} y2={GB} stroke="var(--ink)" strokeWidth={2} />
          <path d={`M${sx(v) - 6},${GT - 22} L${sx(v) + 6},${GT - 22} L${sx(v)},${GT - 11} Z`} fill="var(--ink)" />
          <text
            x={sx(v)}
            y={GT - 28}
            fontSize="13"
            fontWeight={600}
            fill="var(--ink)"
            textAnchor="middle"
            className="tabular-nums"
          >
            {v.toFixed(1)}
          </text>
        </g>
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span
          className="rounded-full px-2.5 py-0.5 font-semibold text-white"
          style={{ background: zone.color }}
        >
          ゾーン {zone.key}：{zone.label}
        </span>
        <span className="text-mut">
          {zi === 0 && "出荷・受け入れ時に期待される水準です。"}
          {zi === 1 && "このまま長期の連続運転ができます。"}
          {zi === 2 && "短期はしのげますが、原因を調べて早めの対策を。"}
          {zi === 3 && "損傷を起こしうる水準。運転継続は危険です。"}
        </span>
      </div>

      <div className="mt-3">
        <Slider
          label="測った振動の大きさ（速度実効値 mm/s RMS）"
          value={v}
          min={0.2}
          max={12}
          step={0.05}
          onChange={(x) => setParam("v", x)}
        />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
