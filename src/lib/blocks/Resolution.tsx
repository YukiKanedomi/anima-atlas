import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";
import { ampSpectrum } from "../fft";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：分解能と平均化。FFT章⑤。
// 近い2成分（8Hz と 8.75Hz）を見分けられるかは記録の長さで決まる：Δf = 1/T。
// ノイズの荒れは平均回数 M で 1/√M に沈む。どちらも「時間で買う」。
//   検証済み: T=0.5〜2sで1山に融合、T=4sで2山に分解／ノイズ床σ: M=1:0.030→M=16:0.008
// 乱数は seed 固定（mulberry32）＝表示が毎回同じで再現可能。

export type ResolutionConfig = {
  title?: string;
  caption?: string;
  link?: string;
  f1?: number;
  a1?: number;
  f2?: number;
  a2?: number;
};

const FS = 64; // サンプリング周波数
const TCHOICES = [0.5, 1, 2, 4, 8]; // 記録長（N=32..512、全部2のべき）
const FSHOW = 16; // 表示上限 Hz
const W = 640;
const H = 300;
const PL = 34, PR = 16;
const PT = 30, PB = 258;
const GOLD = "#c08a2e";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Resolution({ config }: { config: ResolutionConfig }) {
  const f1 = config.f1 ?? 8;
  const a1 = config.a1 ?? 1;
  const f2 = config.f2 ?? 8.75;
  const a2 = config.a2 ?? 0.7;
  const instId = useInstanceId("res");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    avg: 1,
  });
  const avg = Math.round(vals.avg);
  const [T, setT] = useState(1);

  const { curveD, df, twoPeaks } = useMemo(() => {
    const n = FS * T;
    const acc = new Float64Array(Math.floor(n / 2) + 1);
    for (let m = 0; m < avg; m++) {
      const r = mulberry32(m * 7919 + 1);
      const sig = Array.from({ length: n }, (_, i) => {
        const t = i / FS;
        return a1 * Math.sin(2 * Math.PI * f1 * t) + a2 * Math.sin(2 * Math.PI * f2 * t) + 0.8 * (r() * 2 - 1);
      });
      const mm = ampSpectrum(sig, true);
      for (let k = 0; k < acc.length; k++) acc[k] += mm[k] / avg;
    }
    const df = 1 / T;
    // 6..11Hz の局所ピーク数（2山に割れているか）
    let twoPeaks = 0;
    for (let k = 1; k < acc.length - 1; k++) {
      const fk = k * df;
      if (fk > 6 && fk < 11 && acc[k] > acc[k - 1] && acc[k] > acc[k + 1] && acc[k] > 0.15) twoPeaks++;
    }
    // 描画パス（0..FSHOW Hz）
    const sx = (fq: number) => PL + (fq / FSHOW) * (W - PL - PR);
    const sy = (v: number) => PB - Math.min(v, 1.25) * ((PB - PT) / 1.25);
    let d = `M${sx(0).toFixed(1)},${sy(acc[0]).toFixed(1)}`;
    for (let k = 1; k < acc.length; k++) {
      const fk = k * df;
      if (fk > FSHOW) break;
      d += ` L${sx(fk).toFixed(1)},${sy(acc[k]).toFixed(1)}`;
    }
    return { curveD: d, df, twoPeaks };
  }, [T, avg, f1, a1, f2, a2]);

  const sx = (fq: number) => PL + (fq / FSHOW) * (W - PL - PR);

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      {/* 記録長の切替 */}
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-mut">記録の長さ：</span>
        {TCHOICES.map((tc) => (
          <button
            key={tc}
            type="button"
            onClick={() => setT(tc)}
            aria-pressed={tc === T}
            className={
              "rounded-full border px-3 py-1 text-sm tabular-nums transition-colors " +
              (tc === T
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-mut hover:border-accent/50 hover:text-ink")
            }
          >
            {tc}秒
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="分解能と平均化のスペクトル">
        <line x1={PL} y1={PB} x2={W - PR} y2={PB} stroke="var(--line)" />
        {[0, 4, 8, 12, 16].map((fq) => (
          <g key={fq}>
            <line x1={sx(fq)} y1={PT} x2={sx(fq)} y2={PB} stroke="var(--line)" opacity={0.5} />
            <text x={sx(fq)} y={PB + 15} fontSize="10.5" fill="var(--mut)" textAnchor="middle" className="tabular-nums">
              {fq}
            </text>
          </g>
        ))}
        {/* 真の2成分マーカー */}
        {[
          { f: f1, a: a1 },
          { f: f2, a: a2 },
        ].map((c, i) => (
          <g key={i}>
            <line x1={sx(c.f)} y1={PT - 4} x2={sx(c.f)} y2={PB} stroke={GOLD} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.8} />
            <text x={sx(c.f) + (i === 0 ? -4 : 4)} y={PT - 8} fontSize="10.5" fill={GOLD} textAnchor={i === 0 ? "end" : "start"} className="tabular-nums">
              {c.f}Hz
            </text>
          </g>
        ))}
        <path d={curveD} fill="none" stroke="var(--accent)" strokeWidth={1.9} />
        <text x={(PL + W - PR) / 2} y={PB + 31} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          周波数（Hz）
        </text>
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
        <span className="text-mut">
          目盛りの細かさ Δf = 1/T = <b className="tabular-nums text-ink">{df.toFixed(2)} Hz</b>
        </span>
        <span className={"w-full font-semibold sm:w-auto " + (twoPeaks >= 2 ? "text-[#1f7a4f]" : "text-[#9b2d3a]")}>
          {twoPeaks >= 2 ? "2つの山に分解できた" : "1つの山に融けている（記録が短い）"}
        </span>
      </div>

      <div className="mt-3">
        <Slider label="スペクトルの平均回数（ノイズの荒れが 1/√M で沈む）" value={avg} min={1} max={32} step={1} onChange={(v) => setParam("avg", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
