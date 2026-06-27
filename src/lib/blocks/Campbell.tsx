import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：Campbell線図（危険速度マップ）。
// 単一円板ロータのジャイロ効果の標準モデル（無次元、静止固有振動数 ω0=1 で規格化）。
//   前向き枝 ω_f(u) = (γ/2)u + √((γu/2)² + 1)   … 回転で上がる（ジャイロ剛性化）
//   後ろ向き枝 ω_b(u) = −(γ/2)u + √((γu/2)² + 1) … 回転で下がる（ジャイロ軟化）
//   u = Ω/ω0、γ = Ip/Id（ジャイロの強さ）。
//   1×励起線 ω=Ω（不釣り合いは回転数と同じ振動数で揺らす）。
//   前向き危険速度 u_cr = 1/√(1−γ)（γ<1）。γ≥1 で前向き危険速度は消える。
// ※ 形・交点は式どおり。軸は静止固有振動数で規格化した無次元。

export type CampbellConfig = {
  title?: string;
  caption?: string;
  link?: string;
  gammaDefault?: number;
  opDefault?: number;
};

const W = 640;
const H = 380;
const PAD = { l: 52, r: 18, t: 18, b: 40 };
const UMAX = 3;
const YMAX = 3;
const N = 140;

export default function Campbell({ config }: { config: CampbellConfig }) {
  const instId = useInstanceId("campbell");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    gamma: config.gammaDefault ?? 0.6,
    uop: config.opDefault ?? 1.5,
  });
  const gamma = vals.gamma;
  const uop = vals.uop;

  const sx = (u: number) => PAD.l + (u / UMAX) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - (Math.min(y, YMAX) / YMAX) * (H - PAD.t - PAD.b);

  const { fwd, bwd } = useMemo(() => {
    const f: string[] = [];
    const b: string[] = [];
    for (let i = 0; i <= N; i++) {
      const u = (UMAX * i) / N;
      const root = Math.sqrt((gamma * u / 2) ** 2 + 1);
      const yf = (gamma / 2) * u + root;
      const yb = -(gamma / 2) * u + root;
      f.push(`${i === 0 ? "M" : "L"}${sx(u).toFixed(1)},${sy(yf).toFixed(1)}`);
      b.push(`${i === 0 ? "M" : "L"}${sx(u).toFixed(1)},${sy(yb).toFixed(1)}`);
    }
    return { fwd: f.join(" "), bwd: b.join(" ") };
  }, [gamma]);

  // 前向き危険速度（1×線と前向き枝の交点）
  const uCr = gamma < 1 ? 1 / Math.sqrt(1 - gamma) : Infinity;
  const hasCr = Number.isFinite(uCr) && uCr <= UMAX;

  const margin =
    !Number.isFinite(uCr)
      ? "前向き危険速度なし（γ≥1：高速ロータの性質）"
      : uop < uCr - 0.04
      ? "危険速度の手前（亜臨界）"
      : uop > uCr + 0.04
      ? "危険速度を超えて運転（超臨界）"
      : "危険速度の近く（要注意）";

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Campbell線図">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />

        {/* 1×励起線 ω=Ω */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(UMAX)} y2={sy(UMAX)} stroke="var(--mut)" strokeDasharray="5 4" />
        <text x={sx(UMAX) - 6} y={sy(UMAX) + 16} fontSize="12" fill="var(--mut)" textAnchor="end">
          1×（不釣り合い）
        </text>

        {/* 運転回転数の縦線 */}
        <line x1={sx(uop)} y1={PAD.t} x2={sx(uop)} y2={H - PAD.b} stroke="var(--accent-d)" strokeWidth={1.4} opacity={0.5} />
        <text x={sx(uop) + 5} y={PAD.t + 13} fontSize="12" fill="var(--accent-d)">
          運転 {uop.toFixed(2)}
        </text>

        {/* 固有振動数の枝 */}
        <path d={fwd} fill="none" stroke="var(--accent)" strokeWidth={2.4} />
        <path d={bwd} fill="none" stroke="#9b2d3a" strokeWidth={2.4} />
        <text x={sx(UMAX) - 6} y={sy((gamma / 2) * UMAX + Math.sqrt((gamma * UMAX / 2) ** 2 + 1)) - 6} fontSize="12" fill="var(--accent)" textAnchor="end">
          前向き
        </text>
        <text x={sx(UMAX) - 6} y={sy(-(gamma / 2) * UMAX + Math.sqrt((gamma * UMAX / 2) ** 2 + 1)) - 6} fontSize="12" fill="#9b2d3a" textAnchor="end">
          後ろ向き
        </text>

        {/* 前向き危険速度の交点 */}
        {hasCr ? (
          <>
            <circle cx={sx(uCr)} cy={sy(uCr)} r={6} fill="none" stroke="var(--accent-d)" strokeWidth={2} />
            <text x={sx(uCr) + 9} y={sy(uCr) - 8} fontSize="12" fill="var(--accent-d)">
              危険速度 {uCr.toFixed(2)}
            </text>
          </>
        ) : null}

        {/* 軸ラベル */}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} fontSize="12" fill="var(--mut)" textAnchor="middle">
          回転の速さ Ω（÷ 静止固有振動数）
        </text>
        <text x={14} y={(PAD.t + H - PAD.b) / 2} fontSize="12" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}>
          固有振動数 ω（÷ ω₀）
        </text>
      </svg>

      <div className="mt-2 text-sm text-mut">
        いまの運転点：<b className="text-ink">{margin}</b>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="ジャイロの強さ γ（円板の扁平さ）" value={gamma} min={0} max={1.5} step={0.01} onChange={(v) => setParam("gamma", v)} />
        <Slider label="運転回転数 Ω" value={uop} min={0} max={UMAX} step={0.01} onChange={(v) => setParam("uop", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
