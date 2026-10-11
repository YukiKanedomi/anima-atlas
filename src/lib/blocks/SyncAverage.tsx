import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：回転同期平均。FFT章⑥（回転機械ならではの読み方）。
// キーフェイザ（1回転1パルスの基準）に合わせて1回転ぶんの波形をM回重ねて平均すると、
// 回転に同期した成分（1×・2×）は残り、同期しない成分（0.43×のホワール等）は
// 位相がばらけて消えていく——回転成分だけを取り出す時間領域のフィルタ。
//   減り方：ランダムなノイズは 1/√M、決定論的な非同期トーン（0.43×）は |sin(πMq)/(M sin πq)|（おおむね 1/M 包絡）
//   検証済み: 残留RMS 0.485(M=1)→0.102(M=4)→0.027(M=16)→0.014(M=64)、1×振幅は1.0を保持
// 乱数（測定ノイズ）は seed 固定＝再現可能。

export type SyncAverageConfig = {
  title?: string;
  caption?: string;
  link?: string;
  mDefault?: number;
};

const NP = 128; // 1回転の点数
const W = 640;
const H = 292;
const PL = 30, PR = 16;
const PT = 30, PB = 250;
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// m回転目の生波形：同期成分(1×,2×) + 非同期のホワール(0.43×・回転ごとに位相ずれ) + ノイズ
function rawRotation(m: number): number[] {
  const r = mulberry32(m * 104729 + 7);
  const phi = 2 * Math.PI * 0.43 * m;
  return Array.from({ length: NP }, (_, i) => {
    const th = (2 * Math.PI * i) / NP;
    return Math.sin(th) + 0.3 * Math.sin(2 * th) + 0.6 * Math.sin(0.43 * th + phi) + 0.18 * (r() * 2 - 1);
  });
}

export default function SyncAverage({ config }: { config: SyncAverageConfig }) {
  const instId = useInstanceId("sync");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    m: config.mDefault ?? 1,
  });
  const M = Math.round(vals.m);

  const { avgD, ghostDs, syncD, residual } = useMemo(() => {
    const mid = (PT + PB) / 2;
    const A = (PB - PT) / 2 / 2.1;
    const sx = (i: number) => PL + (i / (NP - 1)) * (W - PL - PR);
    const sy = (v: number) => mid - v * A;
    const toPath = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join("");

    // 平均
    const acc = new Float64Array(NP);
    for (let m = 0; m < M; m++) {
      const w = rawRotation(m);
      for (let i = 0; i < NP; i++) acc[i] += w[i] / M;
    }
    // 生波形の残像（最新4回転ぶん）
    const ghostDs: string[] = [];
    for (let g = 0; g < Math.min(M, 4); g++) ghostDs.push(toPath(rawRotation(M - 1 - g)));
    // 目標＝真の同期成分
    const sync = Array.from({ length: NP }, (_, i) => {
      const th = (2 * Math.PI * i) / NP;
      return Math.sin(th) + 0.3 * Math.sin(2 * th);
    });
    // 残留（平均と同期成分の差のRMS）
    let res = 0;
    for (let i = 0; i < NP; i++) res += (acc[i] - sync[i]) ** 2;
    return { avgD: toPath([...acc]), ghostDs, syncD: toPath(sync), residual: Math.sqrt(res / NP) };
  }, [M]);

  const clean = residual < 0.1;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="回転同期平均">
        <rect x={PL} y={PT} width={W - PL - PR} height={PB - PT} fill="var(--soft)" opacity={0.35} />
        <line x1={PL} y1={(PT + PB) / 2} x2={W - PR} y2={(PT + PB) / 2} stroke="var(--line)" />
        {/* キーフェイザ基準（回転の頭） */}
        <line x1={PL} y1={PT - 6} x2={PL} y2={PB} stroke={GOLD} strokeWidth={2} />
        <text x={PL + 4} y={PT - 10} fontSize="11" fill={GOLD}>
          キーフェイザ（1回転の頭）
        </text>
        {/* 生波形の残像 */}
        {ghostDs.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--mut)" strokeWidth={1} opacity={0.22 - i * 0.04} />
        ))}
        {/* 真の同期成分（目標・破線） */}
        <path d={syncD} fill="none" stroke={GOLD} strokeWidth={1.4} strokeDasharray="5 4" opacity={0.9} />
        {/* 平均結果 */}
        <path d={avgD} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
        <text x={(PL + W - PR) / 2} y={PB + 18} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          軸の回転角（1回転ぶん）——灰=生の各回転、紺=平均、金破線=真の同期成分
        </text>
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
        <span
          className="rounded-full px-2.5 py-0.5 font-semibold text-white"
          style={{ background: clean ? "#1f7a4f" : HEAVY }}
        >
          {clean ? "回転成分だけが残った" : "まだホワールとノイズが混ざっている"}
        </span>
        <span className="w-full text-mut sm:w-auto">
          平均 <b className="tabular-nums text-ink">{M}</b> 回転 ／ 非同期の残り（RMS）=
          <b className="tabular-nums text-ink"> {residual.toFixed(3)}</b>（ノイズは 1/√M、非同期の正弦波はおおむね 1/M で減る）
        </span>
      </div>

      <div className="mt-3">
        <Slider label="平均する回転数 M" value={M} min={1} max={64} step={1} onChange={(v) => setParam("m", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
