import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// 翼振動章：摩擦ダンパ（押し付け力と等価減衰）。
// Griffin 型（翼を地面につなぐ摩擦ダンパ）の最小モデル。無次元：翼 m = 1、k = 1（ω0 = 1）。
//   翼：ẍ + 2ζẋ + x + f_d(x) = F cos ωt
//   ダンパ：ばね kd と直列のクーロン滑り要素（滑り出す力 μN）。
//     x の振幅 X が d = μN/kd 以下 → 滑らない（固着）。ダンパはただのばね kd、散逸 0。
//     X > d → 平行四辺形のヒステリシス。1サイクルの散逸 E = 4μN(X − d)。
//   調和バランス（1次近似）：
//     等価粘性減衰 c_eq·ω = E/(πX²) = 4μN(X − d)/(πX²)
//     等価剛性     k_eq = (kd/π)(θ − sinθ cosθ)、cosθ = 1 − 2d/X（X ≤ d では kd）
//   共振振幅はエネルギー収支で解く（共振では力と速度が同位相）：
//     入力  πF·X  =  粘性散逸 2πζ·ω_r·X²  +  ダンパ散逸 4μN(X − d)
//     → 2ζω_r·X² + (4μN/π − F)·X − 4μN·d/π = 0 の正の根。ω_r = √(1 + k_eq(X)) を数回反復。
//     固着なら X = F/(2ζω_r)（ダンパはばねとしてだけ効く）。
//   押し付け力 N を掃引すると共振振幅に最小（最適押し付け力）があり、それ以上は固着して効かなくなる。
// ※ 1自由度・1次調和バランスの「模式」。実機の翼・ダンパ形状の差は caption と本文で補う。

export type FrictionDamperConfig = {
  title?: string;
  caption?: string;
  link?: string;
  normalDefault?: number; // 押し付け力 N（F と同じ単位系）
  muDefault?: number; // 摩擦係数
  kdDefault?: number; // ダンパ剛性（翼剛性との比）
  forceDefault?: number; // 励振力 F
  zeta?: number; // 翼そのものの減衰比（既定 2%：谷と固着が1枚に収まるよう大きめ）
};

const HEAVY = "#9b2d3a";
const W = 320;
const H = 260;
const PAD = { l: 48, r: 14, t: 16, b: 36 };
const NMAX = 1.2; // 押し付け力の掃引上限

function equiv(X: number, muN: number, kd: number) {
  const d = kd > 0 ? muN / kd : Infinity;
  if (X <= d) return { keq: kd, ceqw: 0, slip: false };
  const cth = Math.max(-1, Math.min(1, 1 - (2 * d) / X));
  const th = Math.acos(cth);
  const keq = (kd / Math.PI) * (th - Math.sin(th) * Math.cos(th));
  const ceqw = (4 * muN * (X - d)) / (Math.PI * X * X);
  return { keq, ceqw, slip: true };
}

function resonantAmplitude(F: number, zeta: number, muN: number, kd: number) {
  const d = kd > 0 ? muN / kd : Infinity;
  let X = F / (2 * zeta); // 初期値：ダンパなしの共振振幅
  for (let it = 0; it < 12; it++) {
    const { keq } = equiv(X, muN, kd);
    const wr = Math.sqrt(1 + keq);
    const stuck = F / (2 * zeta * Math.sqrt(1 + kd));
    let Xn: number;
    if (stuck <= d) {
      Xn = stuck; // 滑らない：粘性減衰だけで釣り合う
    } else {
      const a = 2 * zeta * wr;
      const b = (4 * muN) / Math.PI - F;
      const c = -(4 * muN * d) / Math.PI;
      Xn = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    }
    if (Math.abs(Xn - X) < 1e-9) {
      X = Xn;
      break;
    }
    X = Xn;
  }
  return X;
}

export default function FrictionDamper({ config }: { config: FrictionDamperConfig }) {
  const instId = useInstanceId("friction-damper");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    Nf: config.normalDefault ?? 0.3,
    mu: config.muDefault ?? 0.3,
    kd: config.kdDefault ?? 0.5,
    F: config.forceDefault ?? 0.02,
  });
  const zeta = config.zeta ?? 0.02;
  const Nf = vals.Nf;
  const mu = vals.mu;
  const kd = vals.kd;
  const F = vals.F;
  const muN = mu * Nf;

  // 右図：共振振幅 vs 押し付け力
  const curve = useMemo(() => {
    const pts: { N: number; X: number }[] = [];
    const M = 60;
    for (let i = 0; i <= M; i++) {
      const Nn = (NMAX * i) / M;
      pts.push({ N: Nn, X: resonantAmplitude(F, zeta, mu * Nn, kd) });
    }
    let opt = pts[0];
    for (const p of pts) if (p.X < opt.X) opt = p;
    return { pts, opt, X0: pts[0].X };
  }, [F, zeta, mu, kd]);

  const Xres = useMemo(() => resonantAmplitude(F, zeta, muN, kd), [F, zeta, muN, kd]);
  const d = kd > 0 ? muN / kd : Infinity;
  const slipping = Xres > d;

  // 左図：ヒステリシス・ループ（現在の共振振幅 Xres で）
  const loop = useMemo(() => {
    const X = Xres;
    const fMax = Math.max(muN, kd * X) * 1.25 || 1;
    const lx = (x: number) => (W + PAD.l - PAD.r) / 2 + (x / (X * 1.25 || 1)) * ((W - PAD.l - PAD.r) / 2);
    const ly = (f: number) => (H + PAD.t - PAD.b) / 2 - (f / fMax) * ((H - PAD.t - PAD.b) / 2);
    let path: string;
    if (!slipping) {
      path = `M${lx(-X).toFixed(1)},${ly(-kd * X).toFixed(1)} L${lx(X).toFixed(1)},${ly(kd * X).toFixed(1)}`;
    } else {
      const p = [
        [-X, -muN],
        [-X + 2 * d, muN],
        [X, muN],
        [X - 2 * d, -muN],
      ];
      path = p.map(([x, f], i) => `${i === 0 ? "M" : "L"}${lx(x).toFixed(1)},${ly(f).toFixed(1)}`).join(" ") + " Z";
    }
    return { path, lx, ly, fMax };
  }, [Xres, muN, kd, slipping]);

  // 右図スケール
  const rx = (Nn: number) => PAD.l + (Nn / NMAX) * (W - PAD.l - PAD.r);
  const yTop = curve.X0 * 1.08;
  const ry = (X: number) => H - PAD.b - (Math.min(X, yTop) / yTop) * (H - PAD.t - PAD.b);
  const curvePath = curve.pts.map((p, i) => `${i === 0 ? "M" : "L"}${rx(p.N).toFixed(1)},${ry(p.X).toFixed(1)}`).join(" ");

  const reduction = curve.X0 > 0 ? Xres / curve.X0 : 1;
  const status = !slipping
    ? "固着：ダンパは滑らず、ただのばねになっています"
    : Nf < curve.opt.N * 0.85
    ? "滑りすぎ：摩擦力が小さく、吸える仕事が少ない"
    : Nf > curve.opt.N * 1.15
    ? "押し付けすぎ：滑る量が減り、効き目が落ちています"
    : "最適付近：1サイクルに吸う仕事が最大に近い";

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="摩擦力と変位のヒステリシス・ループ">
          <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
          <line x1={PAD.l} y1={(H + PAD.t - PAD.b) / 2} x2={W - PAD.r} y2={(H + PAD.t - PAD.b) / 2} stroke="var(--line)" />
          <line x1={(W + PAD.l - PAD.r) / 2} y1={PAD.t} x2={(W + PAD.l - PAD.r) / 2} y2={H - PAD.b} stroke="var(--line)" />
          {/* 滑り出す力 ±μN */}
          <line x1={PAD.l} y1={loop.ly(muN)} x2={W - PAD.r} y2={loop.ly(muN)} stroke={HEAVY} strokeDasharray="3 3" opacity={0.6} />
          <line x1={PAD.l} y1={loop.ly(-muN)} x2={W - PAD.r} y2={loop.ly(-muN)} stroke={HEAVY} strokeDasharray="3 3" opacity={0.6} />
          <text x={W - PAD.r - 3} y={loop.ly(muN) - 4} fontSize="10" fill={HEAVY} textAnchor="end">μN</text>
          <path d={loop.path} fill={slipping ? "var(--accent)" : "none"} fillOpacity={0.12} stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" />
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} fontSize="11" fill="var(--mut)" textAnchor="middle">翼の変位 x</text>
          <text x={12} y={(PAD.t + H - PAD.b) / 2} fontSize="11" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}>ダンパの力</text>
          <text x={PAD.l + 6} y={PAD.t + 13} fontSize="11" fill="var(--mut)">囲む面積＝1往復で吸う仕事</text>
        </svg>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="共振振幅と押し付け力の関係">
          <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
          <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" />
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />
          <path d={curvePath} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
          {/* 最適点 */}
          <circle cx={rx(curve.opt.N)} cy={ry(curve.opt.X)} r={5} fill="none" stroke={HEAVY} strokeWidth={2} />
          <text x={rx(curve.opt.N)} y={ry(curve.opt.X) + 18} fontSize="10" fill={HEAVY} textAnchor="middle">最適</text>
          {/* 現在点 */}
          <line x1={rx(Nf)} y1={PAD.t} x2={rx(Nf)} y2={H - PAD.b} stroke="var(--accent-d)" strokeDasharray="3 3" opacity={0.5} />
          <circle cx={rx(Nf)} cy={ry(Xres)} r={5} fill="var(--accent-d)" />
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} fontSize="11" fill="var(--mut)" textAnchor="middle">押し付け力 N</text>
          <text x={12} y={(PAD.t + H - PAD.b) / 2} fontSize="11" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}>共振振幅</text>
          <text x={PAD.l + 4} y={H - PAD.b + 13} fontSize="10" fill="var(--mut)">0</text>
          <text x={W - PAD.r} y={H - PAD.b + 13} fontSize="10" fill="var(--mut)" textAnchor="end">{NMAX.toFixed(1)}</text>
        </svg>
      </div>

      <div className="mt-2 min-h-12 text-sm text-mut">
        共振振幅：ダンパなしの <b className="font-ui tabular-nums text-ink">{(reduction * 100).toFixed(0)}</b> %
        <span className="ml-2">
          状態：<b className="text-ink">{status}</b>
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="押し付け力 N" value={Nf} min={0} max={NMAX} step={0.01} onChange={(v) => setParam("Nf", v)} />
        <Slider label="摩擦係数 μ" value={mu} min={0.1} max={0.6} step={0.01} onChange={(v) => setParam("mu", v)} />
        <Slider label="ダンパの硬さ kd（翼の硬さ比）" value={kd} min={0.1} max={2} step={0.05} onChange={(v) => setParam("kd", v)} />
        <Slider label="励振力 F" value={F} min={0.005} max={0.05} step={0.001} onChange={(v) => setParam("F", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
