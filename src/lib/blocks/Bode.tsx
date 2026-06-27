import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：ボード線図（振幅・位相を回転数の関数で上下2段に）。
// ジェフコット不釣り合い応答：
//   振幅 M(r) = r²/√D,  位相 φ(r) = atan2(2ζr, 1−r²)  （D=(1−r²)²+(2ζr)²）
//   r=1 で位相 90°（共振）。r→∞ で位相 180°。
// link で zeta と「掃引する回転数比 r」を共有 → ポーラ線図と同じ点が光る。
// ※ 形・値は式どおり。

export type BodeConfig = {
  title?: string;
  caption?: string;
  link?: string;
  zetaDefault?: number;
  rMax?: number;
};

const W = 560;
const H = 430;
const XL = 48;
const XR = W - 16;
const AMP_T = 26;
const AMP_H = 150;
const AMP_B = AMP_T + AMP_H;
const PH_T = 222;
const PH_H = 122;
const PH_B = PH_T + PH_H;

function ampOf(r: number, z: number) {
  const D = (1 - r * r) ** 2 + (2 * z * r) ** 2 || 1e-9;
  return (r * r) / Math.sqrt(D);
}
function phaseOf(r: number, z: number) {
  return (Math.atan2(2 * z * r, 1 - r * r) * 180) / Math.PI;
}

export default function Bode({ config }: { config: BodeConfig }) {
  const instId = useInstanceId("bode");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    zeta: config.zetaDefault ?? 0.1,
    r: 0.6,
  });
  const zeta = vals.zeta;
  const r = vals.r;
  const rMax = config.rMax ?? 2.5;

  const sx = (rr: number) => XL + (rr / rMax) * (XR - XL);

  const { ampD, phD, ampMax } = useMemo(() => {
    const N = 240;
    let peak = 0;
    const amps: { x: number; m: number }[] = [];
    const phs: string[] = [];
    for (let i = 0; i <= N; i++) {
      const rr = (rMax * i) / N;
      const m = ampOf(rr, zeta);
      if (m > peak) peak = m;
      amps.push({ x: rr, m });
    }
    const aMax = Math.max(2, peak * 1.12);
    const ampY = (m: number) => AMP_B - (Math.min(m, aMax) / aMax) * AMP_H;
    const ampD = amps.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${ampY(p.m).toFixed(1)}`).join(" ");
    for (let i = 0; i <= N; i++) {
      const rr = (rMax * i) / N;
      const p = phaseOf(rr, zeta);
      const y = PH_B - (p / 180) * PH_H;
      phs.push(`${i === 0 ? "M" : "L"}${sx(rr).toFixed(1)},${y.toFixed(1)}`);
    }
    return { ampD, phD: phs.join(" "), ampMax: aMax };
  }, [zeta, rMax]);

  const ampY = (m: number) => AMP_B - (Math.min(m, ampMax) / ampMax) * AMP_H;
  const phaseY = (p: number) => PH_B - (p / 180) * PH_H;
  const curM = ampOf(r, zeta);
  const curP = phaseOf(r, zeta);

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ボード線図">
        {/* 振幅パネル */}
        <text x={XL} y={AMP_T - 8} fontSize="12" fill="var(--mut)">
          振幅 |Z| ＝ R / e
        </text>
        <rect x={XL} y={AMP_T} width={XR - XL} height={AMP_H} fill="var(--soft)" opacity={0.35} />
        <line x1={XL} y1={AMP_B} x2={XR} y2={AMP_B} stroke="var(--line)" />
        <path d={ampD} fill="none" stroke="var(--accent)" strokeWidth={2.2} />

        {/* 位相パネル */}
        <text x={XL} y={PH_T - 8} fontSize="12" fill="var(--mut)">
          位相 φ（度）
        </text>
        <rect x={XL} y={PH_T} width={XR - XL} height={PH_H} fill="var(--soft)" opacity={0.35} />
        {[0, 90, 180].map((p) => (
          <g key={p}>
            <line x1={XL} y1={phaseY(p)} x2={XR} y2={phaseY(p)} stroke="var(--line)" opacity={0.7} />
            <text x={XL - 6} y={phaseY(p) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              {p}
            </text>
          </g>
        ))}
        <path d={phD} fill="none" stroke="#9b2d3a" strokeWidth={2.2} />

        {/* 危険速度 r=1 の縦線（両パネル） */}
        <line x1={sx(1)} y1={AMP_T} x2={sx(1)} y2={PH_B} stroke="var(--mut)" strokeDasharray="4 4" opacity={0.6} />
        <text x={sx(1) + 4} y={AMP_T + 12} fontSize="11" fill="var(--mut)">
          r=1（位相90°）
        </text>

        {/* 掃引カーソル（共有 r、ポーラと同期して光る） */}
        <line x1={sx(r)} y1={AMP_T} x2={sx(r)} y2={PH_B} stroke="var(--accent-d)" strokeWidth={1.5} />
        <circle cx={sx(r)} cy={ampY(curM)} r={5} fill="var(--accent-d)" />
        <circle cx={sx(r)} cy={phaseY(curP)} r={5} fill="var(--accent-d)" />

        {/* x軸ラベル・目盛り */}
        {[0, 1, 2].filter((t) => t <= rMax).map((t) => (
          <text key={t} x={sx(t)} y={H - 6} fontSize="11" fill="var(--mut)" textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={(XL + XR) / 2} y={H - 6} fontSize="11" fill="var(--mut)" textAnchor="middle">
          回転数比 r = Ω / ωn →
        </text>
      </svg>

      <div className="mt-1 tabular-nums text-sm text-mut">
        r = <b className="text-ink">{r.toFixed(2)}</b> ／ 振幅 = <b className="text-ink">{curM.toFixed(2)}</b> ／ 位相 = <b className="text-ink">{Math.round(curP)}°</b>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="回転数比 r（掃引）" value={r} min={0} max={rMax} step={0.01} onChange={(v) => setParam("r", v)} />
        <Slider label="減衰比 ζ" value={zeta} min={0.03} max={0.6} step={0.01} onChange={(v) => setParam("zeta", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
