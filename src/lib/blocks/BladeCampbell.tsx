import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";
import { stiffenedFreq } from "../bladedDisk";

// 翼振動章：翼の Campbell 線図（遠心剛性化した固有振動数 × 励起次数の扇）。
//   固有振動数：f(n)² = f0² + κ·n²   （Southwell の関係。n は回転数 [rev/s]、κ は Southwell 係数）
//   励起次数 k の線：f = k·n            （回転 1 周に k 回叩かれる）
//   交点：f0² + κn² = k²n²  →  n_cr = f0 / √(k² − κ)   （k² > κ のときだけ存在）
//   全周噴射：強い励起は静翼枚数 Ns の整数倍の次数だけ。部分噴射：すべての次数が立つ（第 3 節）。
// ※ 既定の f0・κ は模式値（短く硬いターボポンプ翼ほど f0 は高く、κ の効きは相対的に小さい）。

export type BladeCampbellConfig = {
  title?: string;
  caption?: string;
  link?: string;
  modes?: { name: string; f0: number; kappa: number }[]; // f0 [Hz], κ [-]
  maxRpm?: number; // 横軸の上限
  ns?: number; // 静翼（ノズル）枚数
  kmax?: number; // 描く励起次数の上限
  loDefault?: number; // 運転範囲の下限 [rpm]
  hiDefault?: number; // 運転範囲の上限 [rpm]
  marginPct?: number; // 注意帯（±%）
  partialDefault?: boolean; // 初期状態が部分噴射か
};

const W = 660;
const H = 400;
const PAD = { l: 58, r: 56, t: 16, b: 42 };
const HEAVY = "#9b2d3a";

const DEFAULT_MODES = [
  { name: "1F", f0: 500, kappa: 2.5 },
  { name: "1T", f0: 1250, kappa: 0.6 },
  { name: "2F", f0: 2200, kappa: 12 },
];

export default function BladeCampbell({ config }: { config: BladeCampbellConfig }) {
  const instId = useInstanceId("blade-campbell");
  const modes = config.modes ?? DEFAULT_MODES;
  const maxRpm = config.maxRpm ?? 18000;
  const ns = config.ns ?? 12;
  const kmax = config.kmax ?? 36;
  const marginPct = config.marginPct ?? 10;
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    lo: config.loDefault ?? 9000,
    hi: config.hiDefault ?? 12000,
  });
  const [partial, setPartial] = useState(config.partialDefault ?? true);
  const lo = Math.min(vals.lo, vals.hi);
  const hi = Math.max(vals.lo, vals.hi);
  const showExc = kmax > 0; // kmax=0 なら「遠心剛性化だけ」の図（励起線・運転範囲・交点を出さない）

  const nMax = maxRpm / 60; // rev/s
  const fMax = useMemo(() => {
    const top = Math.max(...modes.map((m) => stiffenedFreq(m.f0, m.kappa, nMax)));
    return top * 1.12;
  }, [modes, nMax]);

  const sx = (rpm: number) => PAD.l + (rpm / maxRpm) * (W - PAD.l - PAD.r);
  const sy = (f: number) => H - PAD.b - (Math.min(f, fMax) / fMax) * (H - PAD.t - PAD.b);

  // 固有振動数の曲線
  const curves = useMemo(
    () =>
      modes.map((m) => {
        const p: string[] = [];
        const N = 120;
        for (let i = 0; i <= N; i++) {
          const rpm = (maxRpm * i) / N;
          const f = stiffenedFreq(m.f0, m.kappa, rpm / 60);
          p.push(`${i === 0 ? "M" : "L"}${sx(rpm).toFixed(1)},${sy(f).toFixed(1)}`);
        }
        return { ...m, d: p.join(" "), fEnd: stiffenedFreq(m.f0, m.kappa, nMax) };
      }),
    [modes, maxRpm, nMax, fMax]
  );

  // 描く励起次数（部分噴射：1..kmax 全部／全周噴射：Ns の倍数だけ）
  const orders = useMemo(() => {
    const out: number[] = [];
    for (let k = 1; k <= kmax; k++) if (partial || k % ns === 0) out.push(k);
    return out;
  }, [partial, kmax, ns]);

  // 交点 n_cr = f0/√(k²−κ)
  const crossings = useMemo(() => {
    const out: { k: number; mode: string; rpm: number; f: number; inRange: boolean; near: boolean }[] = [];
    for (const m of modes) {
      for (const k of orders) {
        if (k * k <= m.kappa) continue;
        const n = m.f0 / Math.sqrt(k * k - m.kappa);
        const rpm = n * 60;
        if (rpm > maxRpm) continue;
        const f = k * n;
        if (f > fMax) continue;
        const inRange = rpm >= lo && rpm <= hi;
        const near = !inRange && rpm >= lo * (1 - marginPct / 100) && rpm <= hi * (1 + marginPct / 100);
        out.push({ k, mode: m.name, rpm, f, inRange, near });
      }
    }
    return out;
  }, [modes, orders, lo, hi, maxRpm, fMax, marginPct]);

  const nIn = crossings.filter((c) => c.inRange).length;
  const nNear = crossings.filter((c) => c.near).length;
  const fmtRpm = (v: number) => `${Math.round(v).toLocaleString()} rpm`;

  // 横軸の目盛り（きりのよい rpm）
  const ticks = useMemo(() => {
    const step = maxRpm <= 12000 ? 2000 : maxRpm <= 30000 ? 5000 : 10000;
    const t: number[] = [];
    for (let v = 0; v <= maxRpm; v += step) t.push(v);
    return t;
  }, [maxRpm]);
  const fTicks = useMemo(() => {
    const step = fMax <= 1500 ? 250 : fMax <= 4000 ? 500 : fMax <= 12000 ? 2000 : 5000;
    const t: number[] = [];
    for (let v = 0; v <= fMax; v += step) t.push(v);
    return t;
  }, [fMax]);

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="翼のCampbell線図">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />

        {/* 運転範囲の帯と注意帯 */}
        {showExc ? (
        <>
        <rect
          x={sx(lo * (1 - marginPct / 100))}
          y={PAD.t}
          width={Math.max(0, sx(hi * (1 + marginPct / 100)) - sx(lo * (1 - marginPct / 100)))}
          height={H - PAD.t - PAD.b}
          fill="#c08a2e"
          opacity={0.08}
        />
        <rect x={sx(lo)} y={PAD.t} width={Math.max(0, sx(hi) - sx(lo))} height={H - PAD.t - PAD.b} fill="var(--accent)" opacity={0.1} />
        <text x={sx((lo + hi) / 2)} y={PAD.t + 12} fontSize="10" fill="var(--accent-d)" textAnchor="middle">
          運転範囲
        </text>
        </>
        ) : null}

        {/* 目盛り */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={sx(v)} y1={H - PAD.b} x2={sx(v)} y2={H - PAD.b + 4} stroke="var(--line)" />
            <text x={sx(v)} y={H - PAD.b + 15} fontSize="10" fill="var(--mut)" textAnchor="middle">
              {v / 1000}k
            </text>
          </g>
        ))}
        {fTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={sy(v)} x2={W - PAD.r} y2={sy(v)} stroke="var(--line)" opacity={0.6} />
            <text x={PAD.l - 5} y={sy(v) + 3.5} fontSize="10" fill="var(--mut)" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />

        {/* 励起次数の扇 */}
        {orders.map((k) => {
          const fTop = (k * maxRpm) / 60;
          const rpmEnd = fTop > fMax ? (fMax * 60) / k : maxRpm;
          const fEnd = (k * rpmEnd) / 60;
          const strong = k % ns === 0;
          return (
            <g key={k}>
              <line
                x1={sx(0)}
                y1={sy(0)}
                x2={sx(rpmEnd)}
                y2={sy(fEnd)}
                stroke={strong ? "var(--accent-d)" : "var(--mut)"}
                strokeWidth={strong ? 1.6 : 0.8}
                opacity={strong ? 0.8 : 0.45}
              />
              {strong || (rpmEnd >= maxRpm && k <= 6) ? (
                <text
                  x={rpmEnd >= maxRpm ? sx(rpmEnd) - 4 : sx(rpmEnd)}
                  y={rpmEnd >= maxRpm ? sy(fEnd) - 4 : sy(fEnd) - 3}
                  fontSize="9"
                  fill={strong ? "var(--accent-d)" : "var(--mut)"}
                  textAnchor={rpmEnd >= maxRpm ? "end" : "middle"}
                >
                  {k}E
                </text>
              ) : null}
            </g>
          );
        })}

        {/* 固有振動数の曲線 */}
        {curves.map((c) => (
          <g key={c.name}>
            <path d={c.d} fill="none" stroke="var(--accent)" strokeWidth={2.4} />
            <text x={W - PAD.r - 3} y={sy(c.fEnd) - 5} fontSize="11" fill="var(--accent)" textAnchor="end">
              {c.name}
            </text>
          </g>
        ))}

        {/* 交点 */}
        {crossings.map((c, i) => (
          <circle
            key={i}
            cx={sx(c.rpm)}
            cy={sy(c.f)}
            r={c.inRange ? 5.5 : 3.2}
            fill={c.inRange ? HEAVY : c.near ? "#c08a2e" : "#fff"}
            stroke={c.inRange ? HEAVY : c.near ? "#c08a2e" : "var(--mut)"}
            strokeWidth={1.5}
          />
        ))}

        {/* 軸ラベル */}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} fontSize="11" fill="var(--mut)" textAnchor="middle">
          回転数（rpm）
        </text>
        <text
          x={14}
          y={(PAD.t + H - PAD.b) / 2}
          fontSize="11"
          fill="var(--mut)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}
        >
          振動数（Hz）
        </text>
      </svg>

      {showExc ? (
      <>
      <div className="mt-2 flex min-h-[1.5rem] flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mut">
        <span>
          運転範囲内の交点：<b className="tabular-nums text-ink">{nIn}</b> 個
        </span>
        <span>
          ±{marginPct}% の注意帯：<b className="tabular-nums text-ink">{nNear}</b> 個
        </span>
        <span>
          励起線：<b className="tabular-nums text-ink">{orders.length}</b> 本
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[
          { v: true, label: "部分噴射（全次数が立つ）" },
          { v: false, label: `全周噴射（${ns}E の倍数だけ）` },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => setPartial(o.v)}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (partial === o.v ? "border-accent bg-accent/10 text-accent" : "border-line text-mut hover:border-accent hover:text-accent")
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="運転範囲の下限" value={vals.lo} min={0} max={maxRpm} step={100} format={fmtRpm} onChange={(v) => setParam("lo", v)} />
        <Slider label="運転範囲の上限" value={vals.hi} min={0} max={maxRpm} step={100} format={fmtRpm} onChange={(v) => setParam("hi", v)} />
      </div>
      </>
      ) : null}

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
