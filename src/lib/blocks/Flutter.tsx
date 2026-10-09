import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：フラッタ（空力減衰 vs 翼間位相角）。【模式】
// 翼列の振動は、隣の翼との位相差 σ（翼間位相角 IBPA）ごとに1つの「進行波モード」になる。
// 周期対称（翼 N 枚）では許される σ は離散値 σ_n = 2πn/N（n = −N/2 … N/2、|n| が節直径、符号が向き）。
// 空力減衰は σ によって変わり、どこかの σ で負になれば、その進行波モードが自励で育つ＝フラッタ。
//   ξ_aero(σ) = ξ0(k*) − A(k*)·cos(σ − σ_min)        （Carta 流の「σ に対して正弦状」の模式）
//   ξ0 = 0.003 + 0.004·k*,  A = 0.010 / (0.5 + k*)     （k* 小＝長く柔らかい翼・速い流れ ほど危険、の単調関係）
//   進行波の乱れ μ：A → A·(1 − 0.6μ)                    （ミスチューニングで進行波が崩れ最悪値が緩和される効果を、
//                                                         振幅の単調な縮小に置き換えた模式。実際は構造の連成固有値問題で決まる）
//   総減衰 ξ = ξ_aero + ξs（構造減衰）。ξ < 0 の σ があればフラッタ。
// 右の小図：最も危ない進行波モードの時間波形 e^{−ξωt}cos(ωt)、30 サイクル（ξ<0 なら発散）。
// ※ 係数はすべて模式。実機では非定常空力（線形化CFD等）で σ ごとの仕事を計算して求める。

export type FlutterConfig = {
  title?: string;
  caption?: string;
  link?: string;
  N?: number; // 翼の枚数（既定 24）
  sigmaMinDeg?: number; // 空力減衰が最小になる位相角（既定 +60°。本書の規約では σ>0 が後ろ向き進行波＝小さな節直径の後ろ向き波）
  kDefault?: number; // 無次元振動数の既定
  zsDefault?: number; // 構造減衰の既定
  muDefault?: number; // 進行波の乱れ（ミスチューニングの模式）の既定
};

const W = 680;
const H = 360;
const L = { l: 56, r: 300, t: 22, b: 44 }; // 左パネル（σ 曲線）
const R = { l: 400, r: 16 }; // 右パネル（時間波形）
const HEAVY = "#9b2d3a";
const YMAX = 0.02;
const YMIN = -0.012;

export default function Flutter({ config }: { config: FlutterConfig }) {
  const instId = useInstanceId("flutter");
  const N = Math.max(6, Math.min(80, Math.round(config.N ?? 24)));
  const sigMin = ((config.sigmaMinDeg ?? 60) * Math.PI) / 180;
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    k: config.kDefault ?? 0.4,
    zs: config.zsDefault ?? 0.002,
    mu: config.muDefault ?? 0,
  });
  const k = vals.k;
  const zs = vals.zs;
  const mu = vals.mu;

  const xi0 = 0.003 + 0.004 * k;
  const A = (0.01 / (0.5 + k)) * (1 - 0.6 * mu);
  const aero = (s: number) => xi0 - A * Math.cos(s - sigMin);

  const sx = (sDeg: number) => L.l + ((sDeg + 180) / 360) * (W - L.l - L.r);
  const sy = (v: number) => H - L.b - ((Math.max(YMIN, Math.min(YMAX, v)) - YMIN) / (YMAX - YMIN)) * (H - L.t - L.b);

  const { curve, negPoly, modes, worst } = useMemo(() => {
    const M = 144;
    const c: string[] = [];
    const neg: string[] = [];
    for (let i = 0; i <= M; i++) {
      const d = -180 + (360 * i) / M;
      const v = aero((d * Math.PI) / 180) + zs;
      c.push(`${i === 0 ? "M" : "L"}${sx(d).toFixed(1)},${sy(v).toFixed(1)}`);
      neg.push(`${i === 0 ? "M" : "L"}${sx(d).toFixed(1)},${sy(Math.min(0, v)).toFixed(1)}`);
    }
    // 負の領域：曲線（0 でクリップ）と 0 線で囲む
    const negPoly = `${neg.join(" ")} L${sx(180).toFixed(1)},${sy(0).toFixed(1)} L${sx(-180).toFixed(1)},${sy(0).toFixed(1)} Z`;
    // 許される離散モード σ_n = 2πn/N
    const half = Math.floor(N / 2);
    const modes: { n: number; deg: number; xi: number }[] = [];
    // 半開区間：偶数 N では −N/2 と +N/2（σ = ∓π）は同じモードなので片方だけ数える
    for (let n = -half + (N % 2 === 0 ? 1 : 0); n <= half; n++) {
      const s = (2 * Math.PI * n) / N;
      const deg = (s * 180) / Math.PI;
      if (deg < -180 || deg > 180) continue;
      modes.push({ n, deg, xi: aero(s) + zs });
    }
    let worst = modes[0];
    for (const m of modes) if (m.xi < worst.xi) worst = m;
    return { curve: c.join(" "), negPoly, modes, worst };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, zs, mu, N, sigMin]);

  const unstable = worst.xi < 0;
  // 本書の規約（第II部）：σ = 2πq/N で q>0 は後ろ向き進行波、q<0 は前向き進行波
  const dir = worst.n > 0 ? "後ろ向き" : worst.n < 0 ? "前向き" : "節直径 0";

  // 右：時間波形 x(t)=e^{−ξωt}cos(ωt)、12 サイクル。振幅は図内に収まるよう上限クリップ。
  const wave = useMemo(() => {
    const cycles = 30;
    const M = 240;
    const cx0 = R.l;
    const cw = W - R.l - R.r;
    const cy = (L.t + H - L.b) / 2;
    const amp = (H - L.t - L.b) / 2 - 8;
    const pts: string[] = [];
    for (let i = 0; i <= M; i++) {
      const tau = (cycles * i) / M; // サイクル数
      let env = Math.exp(-worst.xi * 2 * Math.PI * tau);
      env = Math.min(env, 6);
      const x = env * Math.cos(2 * Math.PI * tau);
      const yy = Math.max(-1, Math.min(1, x / 3)); // 初期振幅 1/3 で描き、3 倍まで見せる
      pts.push(`${i === 0 ? "M" : "L"}${(cx0 + (cw * i) / M).toFixed(1)},${(cy - yy * amp).toFixed(1)}`);
    }
    return pts.join(" ");
  }, [worst.xi]);

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="翼間位相角ごとの総減衰と、最も危ないモードの時間波形">
        {/* 左：σ 曲線 */}
        <rect x={L.l} y={L.t} width={W - L.l - L.r} height={H - L.t - L.b} fill="var(--soft)" opacity={0.35} />
        <path d={negPoly} fill={HEAVY} opacity={0.14} />
        <line x1={L.l} y1={sy(0)} x2={W - L.r} y2={sy(0)} stroke="var(--mut)" strokeDasharray="3 3" />
        <line x1={L.l} y1={H - L.b} x2={W - L.r} y2={H - L.b} stroke="var(--line)" />
        <line x1={L.l} y1={L.t} x2={L.l} y2={H - L.b} stroke="var(--line)" />
        {[-180, -90, 0, 90, 180].map((d) => (
          <g key={d}>
            <line x1={sx(d)} y1={H - L.b} x2={sx(d)} y2={H - L.b + 4} stroke="var(--mut)" />
            <text x={sx(d)} y={H - L.b + 16} fontSize="10" fill="var(--mut)" textAnchor="middle">
              {d}°
            </text>
          </g>
        ))}
        {[-0.01, 0, 0.01, 0.02].map((v) => (
          <text key={v} x={L.l - 6} y={sy(v) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
            {(v * 100).toFixed(0)}%
          </text>
        ))}
        <text x={sx(-178)} y={sy(0) - 6} fontSize="10" fill="var(--mut)">
          ξ = 0
        </text>
        <text x={sx(-100)} y={H - L.b + 32} fontSize="11" fill="var(--mut)" textAnchor="middle">
          ← 前向き進行波（σ が負）
        </text>
        <text x={sx(100)} y={H - L.b + 32} fontSize="11" fill="var(--mut)" textAnchor="middle">
          後ろ向き進行波（σ が正） →
        </text>
        <text
          x={14}
          y={(L.t + H - L.b) / 2}
          fontSize="12"
          fill="var(--mut)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(L.t + H - L.b) / 2})`}
        >
          総減衰 ξ（空力＋構造）
        </text>

        <path d={curve} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
        {modes.map((m) => (
          <circle
            key={m.n}
            cx={sx(m.deg)}
            cy={sy(m.xi)}
            r={m.n === worst.n ? 5 : 2.6}
            fill={m.xi < 0 ? HEAVY : "var(--accent-d)"}
            opacity={m.n === worst.n ? 1 : 0.8}
          />
        ))}
        <text x={sx(worst.deg)} y={sy(worst.xi) + (worst.xi < 0.004 ? -10 : 16)} fontSize="11" fill={unstable ? HEAVY : "var(--accent-d)"} textAnchor="middle">
          n={Math.abs(worst.n)}
        </text>

        {/* 右：時間波形 */}
        <rect x={R.l} y={L.t} width={W - R.l - R.r} height={H - L.t - L.b} fill="var(--soft)" opacity={0.35} />
        <line x1={R.l} y1={(L.t + H - L.b) / 2} x2={W - R.r} y2={(L.t + H - L.b) / 2} stroke="var(--line)" />
        <path d={wave} fill="none" stroke={unstable ? HEAVY : "var(--accent)"} strokeWidth={1.8} />
        <text x={R.l + 6} y={L.t + 14} fontSize="11" fill="var(--mut)">
          最も危ないモードの時間波形
        </text>
        <text x={(R.l + W - R.r) / 2} y={H - L.b + 16} fontSize="10" fill="var(--mut)" textAnchor="middle">
          時間（30 サイクル）
        </text>
      </svg>

      <div className="mt-2 min-h-[2.5rem] text-sm text-mut">
        最小の総減衰 <b className="tabular-nums text-ink">{pct(worst.xi)}</b>（節直径 {Math.abs(worst.n)}・{dir}）：{" "}
        <b style={{ color: unstable ? HEAVY : "var(--accent-d)" }}>{unstable ? "フラッタ（振幅が育つ）" : "安定（振幅は減る）"}</b>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Slider label="無次元振動数 k*" value={k} min={0.1} max={2} step={0.01} onChange={(v) => setParam("k", v)} />
        <Slider label="構造減衰 ξs" value={zs} min={0} max={0.02} step={0.0005} format={(v) => pct(v)} onChange={(v) => setParam("zs", v)} />
        <Slider label="進行波の乱れ μ（模式）" value={mu} min={0} max={1} step={0.01} onChange={(v) => setParam("mu", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
