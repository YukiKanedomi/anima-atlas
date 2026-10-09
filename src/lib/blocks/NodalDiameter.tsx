import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：節直径（翼付き円盤のモード形）。
// N 枚の翼が周期対称に並ぶとき、モード形は周方向に cos(nθ) の形を取る（n＝節直径数、0 ≤ n ≤ N/2）。
//   翼 j の位置 θ_j = 2πj/N、先端の変位（接線方向に誇張して描く）
//     定在波        a_j(t) = cos(nθ_j)·cos(ωt)
//     前向き進行波   a_j(t) = cos(nθ_j − ωt)   （回転と同じ向きにパターンが走る）
//     後ろ向き進行波 a_j(t) = cos(nθ_j + ωt)
//   節直径＝変位がゼロのまま動かない直径。定在波では cos(nθ)=0 の n 本（固定）、進行波では ω/n の角速度で回る。
//   n = N/2 のとき隣同士が逆相（交互）。n = 0 は全翼同相（アンブレラ）。
// ※ 翼の形は模式。変位は見やすいよう接線方向の振れ角に換算して誇張している。

export type NodalDiameterConfig = {
  title?: string;
  caption?: string;
  link?: string;
  nDefault?: number;
  bladesDefault?: number;
};

const W = 680;
const H = 360;
const CX = 185;
const CY = 180;
const R_IN = 62;
const R_OUT = 132;
const SWING = 0.17; // 先端の最大振れ角 [rad]（誇張）
const HEAVY = "#9b2d3a";
const BAR_X0 = 380;
const BAR_X1 = 660;
const BAR_Y = 180;
const BAR_H = 100;

type Mode = "standing" | "forward" | "backward";

export default function NodalDiameter({ config }: { config: NodalDiameterConfig }) {
  const instId = useInstanceId("nodal-diameter");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    N: config.bladesDefault ?? 24,
    nd: config.nDefault ?? 2,
  });
  const N = Math.round(vals.N);
  const nd = Math.min(Math.round(vals.nd), Math.floor(N / 2));
  // N が（link 経由も含め）下がったら、共有状態の nd も範囲内に正規化する
  useEffect(() => {
    if (Math.round(vals.nd) > Math.floor(N / 2)) setParam("nd", Math.floor(N / 2));
  }, [vals.nd, N, setParam]);
  const [mode, setMode] = useState<Mode>("standing");
  const [running, setRunning] = useState(true);
  const [t, setT] = useState(0.4);
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (now: number) => {
      if (last.current !== undefined) {
        const dt = (now - last.current) / 1000;
        setT((v) => (v + 1.6 * dt) % (Math.PI * 2));
      }
      last.current = now;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  // 各翼の変位
  const amps = useMemo(() => {
    const out: number[] = [];
    for (let j = 0; j < N; j++) {
      const th = (2 * Math.PI * j) / N;
      const a =
        mode === "standing"
          ? Math.cos(nd * th) * Math.cos(t)
          : mode === "forward"
          ? Math.cos(nd * th - t)
          : Math.cos(nd * th + t);
      out.push(a);
    }
    return out;
  }, [N, nd, mode, t]);

  // 節直径の角度（cos(nθ ∓ ωt)=0 の θ。n 本の直径）
  const nodeAngles = useMemo(() => {
    if (nd === 0) return [] as number[];
    const shift = mode === "standing" ? 0 : mode === "forward" ? t : -t;
    const out: number[] = [];
    for (let m = 0; m < nd; m++) out.push((Math.PI / 2 + m * Math.PI + shift) / nd);
    return out;
  }, [nd, mode, t]);

  const phaseDeg = N > 0 ? (360 * nd) / N : 0;
  const barStep = (BAR_X1 - BAR_X0) / N;
  const barW = Math.max(2, Math.min(9, barStep * 0.7));

  const pill = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={
        "rounded-full border px-3 py-1 text-sm transition-colors " +
        (mode === m
          ? "border-accent bg-accent/10 text-accent"
          : "border-line bg-white text-mut hover:border-accent hover:text-accent")
      }
    >
      {label}
    </button>
  );

  const summary =
    nd === 0
      ? "n = 0：全部の翼が同じ向きに動く「アンブレラ」。動かない直径はありません。"
      : nd * 2 === N
      ? `n = ${nd} = N/2：隣同士が逆向き（交互）。これが取りうる最大の節直径です。`
      : `n = ${nd}：動かない直径が ${nd} 本。隣の翼との位相差は 2π·${nd}/${N} = ${phaseDeg.toFixed(1)}°。`;

  const envelope = Array.from({ length: 121 }, (_, i) => {
    const u = i / 120;
    const x = BAR_X0 + u * (BAR_X1 - BAR_X0);
    const y = BAR_Y - Math.cos(nd * 2 * Math.PI * u) * BAR_H;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="翼付き円盤の節直径モード">
        {/* 円盤 */}
        <circle cx={CX} cy={CY} r={R_IN} fill="var(--soft)" stroke="var(--line)" />
        <circle cx={CX} cy={CY} r={R_OUT + 12} fill="none" stroke="var(--line)" strokeDasharray="2 4" />
        <circle cx={CX} cy={CY} r={5} fill="var(--mut)" />

        {/* 節直径（点線） */}
        {nodeAngles.map((a, i) => (
          <line
            key={i}
            x1={CX + (R_OUT + 12) * Math.cos(a)}
            y1={CY + (R_OUT + 12) * Math.sin(a)}
            x2={CX - (R_OUT + 12) * Math.cos(a)}
            y2={CY - (R_OUT + 12) * Math.sin(a)}
            stroke="var(--mut)"
            strokeDasharray="4 4"
            strokeWidth={1.2}
            opacity={0.8}
          />
        ))}

        {/* 翼：根元は円盤上、先端は接線方向に a_j·SWING だけ振れる */}
        {amps.map((a, j) => {
          const th = (2 * Math.PI * j) / N;
          const x0 = CX + R_IN * Math.cos(th);
          const y0 = CY + R_IN * Math.sin(th);
          const x1 = CX + R_OUT * Math.cos(th + a * SWING);
          const y1 = CY + R_OUT * Math.sin(th + a * SWING);
          const col = a >= 0 ? "var(--accent)" : HEAVY;
          const sw = N > 36 ? 2.2 : N > 24 ? 3 : 4;
          const op = 0.35 + 0.65 * Math.abs(a);
          return (
            <g key={j}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={col} strokeWidth={sw} strokeLinecap="round" opacity={op} />
              <circle cx={x1} cy={y1} r={N > 36 ? 2 : 3} fill={col} opacity={op} />
            </g>
          );
        })}
        <text x={CX} y={H - 14} fontSize="11" fill="var(--mut)" textAnchor="middle">
          紺＝＋側へ振れ　臙脂＝−側へ振れ　点線＝節直径
        </text>

        {/* 右：翼番号 vs 振幅の棒 */}
        <text x={BAR_X0} y={BAR_Y - BAR_H - 22} fontSize="12" fill="var(--mut)">
          翼番号 j と、いまの変位 a_j
        </text>
        <line x1={BAR_X0 - 6} y1={BAR_Y} x2={BAR_X1} y2={BAR_Y} stroke="var(--line)" />
        <line x1={BAR_X0 - 6} y1={BAR_Y - BAR_H} x2={BAR_X0 - 6} y2={BAR_Y + BAR_H} stroke="var(--line)" />
        <text x={BAR_X0 - 10} y={BAR_Y - BAR_H + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
          +1
        </text>
        <text x={BAR_X0 - 10} y={BAR_Y + BAR_H + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
          −1
        </text>
        {amps.map((a, j) => {
          const x = BAR_X0 + j * barStep + (barStep - barW) / 2;
          const h = Math.abs(a) * BAR_H;
          return (
            <rect
              key={j}
              x={x}
              y={a >= 0 ? BAR_Y - h : BAR_Y}
              width={barW}
              height={h}
              fill={a >= 0 ? "var(--accent)" : HEAVY}
              opacity={0.85}
            />
          );
        })}
        {mode === "standing" ? (
          <path d={envelope} fill="none" stroke="var(--mut)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        ) : null}
        <text x={BAR_X0} y={BAR_Y + BAR_H + 22} fontSize="10" fill="var(--mut)">
          j = 0
        </text>
        <text x={BAR_X1} y={BAR_Y + BAR_H + 22} fontSize="10" fill="var(--mut)" textAnchor="end">
          j = {N - 1}
        </text>
        <text x={(BAR_X0 + BAR_X1) / 2} y={BAR_Y + BAR_H + 40} fontSize="11" fill="var(--mut)" textAnchor="middle">
          点線＝cos(nθ) の包絡（定在波のとき）
        </text>
      </svg>
      </div>

      <div className="mt-2 min-h-[3rem] text-sm leading-6 text-mut">
        <b className="text-ink">{summary}</b>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pill("standing", "定在波")}
        {pill("forward", "前向き進行波")}
        {pill("backward", "後ろ向き進行波")}
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} className="ml-auto" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="翼の枚数 N" value={N} min={12} max={48} step={1} onChange={(v) => setParam("N", v)} />
        <Slider label="節直径 n" value={nd} min={0} max={Math.floor(N / 2)} step={1} onChange={(v) => setParam("nd", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
