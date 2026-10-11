import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：同じ振動を「変位・速度・加速度」の三つのものさしで見ると、周波数ごとに見え方が入れ替わる。
// 正弦振動 x = X sin(2π f t) について、速度振幅 V = 2π f X、加速度振幅 A = (2π f)² X。
// 「何を一定にするか」（変位／速度／加速度）を選ぶと、残り二つは周波数の 1 乗・2 乗で傾く。
// 縦軸は各量を「基準周波数 F_REF（100 Hz）での自分の値」で割った比（対数）。単位の違う三量を
// 同じ目盛で比べることはできないので、線どうしの上下や交点ではなく「傾き」を見る図にしてある。
// 周波数カーソルの位置では、単位付きの実振幅（μm・mm/s・m/s²）を下に表示する。
// 10〜1,000 Hz の帯は、速度の実効値で機械の状態を評価する規格（ISO 20816 系）が典型的に扱う帯域の目安。
// ※ 値は式どおり。帯域はあくまで目安で、規格の版と機械の種類で変わる。

export type SensorBandsConfig = {
  title?: string;
  caption?: string;
  link?: string;
  modeDefault?: "disp" | "vel" | "acc"; // 一定に保つ量
  fDefault?: number; // 周波数 Hz（1〜10,000）
  ampDefault?: number; // 一定に保つ量の振幅（disp: μm, vel: mm/s, acc: m/s²）
};

const W = 640;
const H = 400;
const XL = 58;
const XR = W - 18;
const YT = 26;
const YB = H - 56;
const FMIN = 1;
const FMAX = 10000;
const F_REF = 100; // 比の基準周波数
// 比の表示範囲：1〜10,000 Hz を 100 Hz 基準で見ると、傾き ±2 の線がちょうど 1e-4〜1e4 に収まる
const RMIN = 1e-4;
const RMAX = 1e4;
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";

type Mode = "disp" | "vel" | "acc";

const MODES: { key: Mode; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "disp", label: "変位を一定", unit: "μm", min: 1, max: 200, step: 1 },
  { key: "vel", label: "速度を一定", unit: "mm/s", min: 0.5, max: 30, step: 0.1 },
  { key: "acc", label: "加速度を一定", unit: "m/s²", min: 0.5, max: 100, step: 0.5 },
];

// 一定に保つ量とその振幅から、周波数 f での三つの振幅（μm, mm/s, m/s²）を返す
function triple(mode: Mode, amp: number, f: number): { d: number; v: number; a: number } {
  const w = 2 * Math.PI * f;
  if (mode === "disp") {
    const X = amp * 1e-6; // m
    return { d: amp, v: w * X * 1e3, a: w * w * X };
  }
  if (mode === "vel") {
    const V = amp * 1e-3; // m/s
    return { d: (V / w) * 1e6, v: amp, a: w * V };
  }
  const A = amp; // m/s²
  return { d: (A / (w * w)) * 1e6, v: (A / w) * 1e3, a: A };
}

function fmt(x: number): string {
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  if (x >= 1) return x.toFixed(2);
  if (x >= 0.01) return x.toFixed(3);
  return x.toExponential(1);
}

function fmtRatio(r: number): string {
  if (r >= 1000) return r.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (r >= 1) return String(Math.round(r));
  return `1/${Math.round(1 / r).toLocaleString()}`;
}

export default function SensorBands({ config }: { config: SensorBandsConfig }) {
  const instId = useInstanceId("sensorbands");
  const [mode, setMode] = useState<Mode>(config.modeDefault ?? "vel");
  const meta = MODES.find((m) => m.key === mode)!;
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    logf: Math.log10(config.fDefault ?? 50),
    amp_disp: config.modeDefault === "disp" && config.ampDefault ? config.ampDefault : 20,
    amp_vel: (config.modeDefault ?? "vel") === "vel" && config.ampDefault ? config.ampDefault : 2.8,
    amp_acc: config.modeDefault === "acc" && config.ampDefault ? config.ampDefault : 10,
  });
  const f = Math.pow(10, vals.logf);
  const amp = vals[`amp_${mode}`];

  const sx = (ff: number) => XL + ((Math.log10(ff) - Math.log10(FMIN)) / (Math.log10(FMAX) - Math.log10(FMIN))) * (XR - XL);
  // 比の縦座標。表示範囲外はクランプせず、clipPath で切る（傾きを曲げない）
  const sy = (r: number) => YB - ((Math.log10(r) - Math.log10(RMIN)) / (Math.log10(RMAX) - Math.log10(RMIN))) * (YB - YT);

  // 基準周波数での値（比の分母）。モードと振幅によらず比は同じだが、読みやすさのため毎回計算する
  const ref = useMemo(() => triple(mode, amp, F_REF), [mode, amp]);

  const { dD, dV, dA } = useMemo(() => {
    const N = 120;
    let dD = "";
    let dV = "";
    let dA = "";
    for (let i = 0; i <= N; i++) {
      const ff = Math.pow(10, Math.log10(FMIN) + ((Math.log10(FMAX) - Math.log10(FMIN)) * i) / N);
      const t = triple(mode, amp, ff);
      const op = i === 0 ? "M" : "L";
      dD += `${op}${sx(ff).toFixed(1)},${sy(t.d / ref.d).toFixed(1)}`;
      dV += `${op}${sx(ff).toFixed(1)},${sy(t.v / ref.v).toFixed(1)}`;
      dA += `${op}${sx(ff).toFixed(1)},${sy(t.a / ref.a).toFixed(1)}`;
    }
    return { dD, dV, dA };
  }, [mode, amp, ref]);

  const cur = triple(mode, amp, f);
  const ticksF = [1, 10, 100, 1000, 10000];
  const ticksR = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10, 100, 1e3, 1e4];
  const clipId = `${instId}-clip`;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-1 text-mut">一定に保つ量：</span>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
            className={
              "rounded border px-2 py-0.5 transition-colors " +
              (mode === m.key ? "border-accent bg-accent/10 text-accent" : "border-line bg-white text-mut hover:border-accent hover:text-accent")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="変位・速度・加速度の周波数依存">
        <defs>
          <clipPath id={clipId}>
            <rect x={XL} y={YT} width={XR - XL} height={YB - YT} />
          </clipPath>
        </defs>
        {/* 速度評価の帯域（目安） */}
        <rect x={sx(10)} y={YT} width={sx(1000) - sx(10)} height={YB - YT} fill="var(--soft)" opacity={0.5} />
        <text x={(sx(10) + sx(1000)) / 2} y={YT + 12} fontSize="10" fill="var(--mut)" textAnchor="middle">
          速度の実効値で評価する帯域の目安（10〜1,000 Hz）
        </text>

        {/* 格子 */}
        {ticksR.map((r) => (
          <g key={r}>
            <line x1={XL} y1={sy(r)} x2={XR} y2={sy(r)} stroke="var(--line)" opacity={r === 1 ? 1 : 0.6} strokeWidth={r === 1 ? 1.4 : 1} />
            <text x={XL - 6} y={sy(r) + 3.5} fontSize="9.5" fill="var(--mut)" textAnchor="end">
              {fmtRatio(r)}
            </text>
          </g>
        ))}
        {ticksF.map((ff) => (
          <g key={ff}>
            <line x1={sx(ff)} y1={YT} x2={sx(ff)} y2={YB} stroke="var(--line)" opacity={0.6} />
            <text x={sx(ff)} y={YB + 14} fontSize="10" fill="var(--mut)" textAnchor="middle">
              {ff.toLocaleString()}
            </text>
          </g>
        ))}
        {/* 基準周波数の印 */}
        <line x1={sx(F_REF)} y1={YT} x2={sx(F_REF)} y2={YB} stroke="var(--mut)" strokeDasharray="2 3" />
        <text x={sx(F_REF) + 4} y={YB - 6} fontSize="9.5" fill="var(--mut)">
          基準 100 Hz（比 = 1）
        </text>
        <line x1={XL} y1={YB} x2={XR} y2={YB} stroke="var(--line)" />
        <line x1={XL} y1={YT} x2={XL} y2={YB} stroke="var(--line)" />
        <text x={(XL + XR) / 2} y={H - 30} fontSize="11" fill="var(--mut)" textAnchor="middle">
          周波数 f（Hz、対数）→
        </text>
        <text x={12} y={YT - 8} fontSize="10" fill="var(--mut)">
          各量の、100 Hz での自分の値に対する比（対数）。線どうしの上下は比べず、傾きを見る
        </text>

        {/* 三本の線（表示域で切る） */}
        <g clipPath={`url(#${clipId})`}>
          <path d={dD} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
          <path d={dV} fill="none" stroke={GOLD} strokeWidth={2.2} />
          <path d={dA} fill="none" stroke={HEAVY} strokeWidth={2.2} />
        </g>

        {/* 周波数カーソルと三つの点 */}
        <line x1={sx(f)} y1={YT} x2={sx(f)} y2={YB} stroke="var(--accent-d)" strokeWidth={1.4} strokeDasharray="4 3" />
        <g clipPath={`url(#${clipId})`}>
          <circle cx={sx(f)} cy={sy(cur.d / ref.d)} r={5} fill="var(--accent)" />
          <circle cx={sx(f)} cy={sy(cur.v / ref.v)} r={5} fill={GOLD} />
          <circle cx={sx(f)} cy={sy(cur.a / ref.a)} r={5} fill={HEAVY} />
        </g>

        {/* 凡例 */}
        <g fontSize="11">
          <line x1={XL + 8} y1={H - 10} x2={XL + 28} y2={H - 10} stroke="var(--accent)" strokeWidth={2.2} />
          <text x={XL + 32} y={H - 6} fill="var(--mut)">変位 X</text>
          <line x1={XL + 98} y1={H - 10} x2={XL + 118} y2={H - 10} stroke={GOLD} strokeWidth={2.2} />
          <text x={XL + 122} y={H - 6} fill="var(--mut)">速度 V = 2πf X</text>
          <line x1={XL + 238} y1={H - 10} x2={XL + 258} y2={H - 10} stroke={HEAVY} strokeWidth={2.2} />
          <text x={XL + 262} y={H - 6} fill="var(--mut)">加速度 A = (2πf)² X</text>
          <text x={XR} y={H - 6} fill="var(--mut)" textAnchor="end">傾き：0／±1／±2</text>
        </g>
      </svg>

      <div className="mt-1 grid gap-x-4 gap-y-0.5 tabular-nums text-sm text-mut sm:grid-cols-3">
        <div>変位 <b className="text-ink">{fmt(cur.d)}</b> μm</div>
        <div>速度 <b className="text-ink">{fmt(cur.v)}</b> mm/s</div>
        <div>
          加速度 <b className="text-ink">{fmt(cur.a)}</b> m/s²（{fmt(cur.a / 9.80665)} g）
        </div>
      </div>
      <p className="mt-0.5 text-xs text-mut">
        上の三つは {Math.round(f).toLocaleString()} Hz での実際の振幅（単位付き）。グラフの縦軸はこれを 100 Hz での値で割った比です。
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider
          label="周波数 f"
          value={vals.logf}
          min={0}
          max={4}
          step={0.01}
          format={(v) => `${Math.round(Math.pow(10, v)).toLocaleString()} Hz`}
          onChange={(v) => setParam("logf", v)}
        />
        <Slider
          label={`${meta.label.replace("を一定", "")}の振幅`}
          value={amp}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          unit={meta.unit}
          onChange={(v) => setParam(`amp_${mode}`, v)}
        />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
