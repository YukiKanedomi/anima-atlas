import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// 翼振動章：ミスチューニング（翼ごとのばらつきと応答の増幅）。
// N 翼の周期鎖モデル（無次元、翼単体の静止固有振動数 ω0 = 1、質量 m = 1）。
//   翼 j の運動方程式（調和応答・複素振幅 x_j）：
//     [ (1 + δ_j) + 2κc − ω² + i·2ζω ] x_j − κc (x_{j−1} + x_{j+1}) = e^{ i·2πkj/N }
//   δ_j：翼 j の剛性ばらつき（正規乱数、標準偏差 σ）。κc = kc/k：隣接翼との結合（シュラウド・円盤）。
//   右辺：励起次数 k の進行波パターン（隣の翼と 2πk/N だけ位相がずれた力）。
//   tuned（δ_j = 0）の解は閉形式 x_j = X e^{iφj}、X = 1/(1 + 2κc(1−cos φ) − ω² + i2ζω)、φ = 2πk/N。
//   mistuned は各 ω で N×N の複素線形系をガウス消去で解く（N ≤ 36 なので軽い）。
//   増幅率 = max_j |x_j| の掃引最大（mistuned）÷ 同（tuned）。
//   Whitehead の上限 (1 + √N)/2（Whitehead 1966, 1998）を参考線として併記。
// ※ 1翼1自由度・結合は隣接のみの最小モデル。形・傾向は式どおりの「模式」。

export type MistuningConfig = {
  title?: string;
  caption?: string;
  link?: string;
  nDefault?: number; // 翼の枚数 12..36
  sigmaDefault?: number; // ばらつきの標準偏差 [%]
  couplingDefault?: number; // κc
  zetaDefault?: number; // 減衰比 [%]
  eoDefault?: number; // 励起次数 k
  seedDefault?: number;
};

const HEAVY = "#9b2d3a";
const W = 640;
const H1 = 300;
const H2 = 200;
const PAD = { l: 52, r: 18, t: 18, b: 38 };
const NW = 240; // 周波数掃引点数

// 乱数（seed 固定で再現可能）
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussians(n: number, seed: number): number[] {
  const r = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(1e-12, r());
    const u2 = r();
    out.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  }
  return out;
}

// 複素 N×N 線形系 A x = b（A は巡回三重対角だが密で解く）。部分ピボットつきガウス消去。
function solveComplex(Ar: Float64Array, Ai: Float64Array, br: Float64Array, bi: Float64Array, n: number) {
  const ar = Float64Array.from(Ar);
  const ai = Float64Array.from(Ai);
  const xr = Float64Array.from(br);
  const xi = Float64Array.from(bi);
  for (let c = 0; c < n; c++) {
    // ピボット
    let p = c;
    let best = ar[c * n + c] ** 2 + ai[c * n + c] ** 2;
    for (let r = c + 1; r < n; r++) {
      const v = ar[r * n + c] ** 2 + ai[r * n + c] ** 2;
      if (v > best) {
        best = v;
        p = r;
      }
    }
    if (p !== c) {
      for (let k = 0; k < n; k++) {
        let t = ar[c * n + k]; ar[c * n + k] = ar[p * n + k]; ar[p * n + k] = t;
        t = ai[c * n + k]; ai[c * n + k] = ai[p * n + k]; ai[p * n + k] = t;
      }
      let t = xr[c]; xr[c] = xr[p]; xr[p] = t;
      t = xi[c]; xi[c] = xi[p]; xi[p] = t;
    }
    const pr = ar[c * n + c];
    const pi = ai[c * n + c];
    const pd = pr * pr + pi * pi || 1e-300;
    for (let r = c + 1; r < n; r++) {
      const vr = ar[r * n + c];
      const vi = ai[r * n + c];
      if (vr === 0 && vi === 0) continue;
      // f = v / p
      const fr = (vr * pr + vi * pi) / pd;
      const fi = (vi * pr - vr * pi) / pd;
      for (let k = c; k < n; k++) {
        const tr = ar[c * n + k];
        const ti = ai[c * n + k];
        ar[r * n + k] -= fr * tr - fi * ti;
        ai[r * n + k] -= fr * ti + fi * tr;
      }
      xr[r] -= fr * xr[c] - fi * xi[c];
      xi[r] -= fr * xi[c] + fi * xr[c];
    }
  }
  // 後退代入
  for (let r = n - 1; r >= 0; r--) {
    let sr = xr[r];
    let si = xi[r];
    for (let k = r + 1; k < n; k++) {
      const tr = ar[r * n + k];
      const ti = ai[r * n + k];
      sr -= tr * xr[k] - ti * xi[k];
      si -= tr * xi[k] + ti * xr[k];
    }
    const pr = ar[r * n + r];
    const pi = ai[r * n + r];
    const pd = pr * pr + pi * pi || 1e-300;
    xr[r] = (sr * pr + si * pi) / pd;
    xi[r] = (si * pr - sr * pi) / pd;
  }
  const amp: number[] = [];
  for (let j = 0; j < n; j++) amp.push(Math.hypot(xr[j], xi[j]));
  return amp;
}

export default function Mistuning({ config }: { config: MistuningConfig }) {
  const instId = useInstanceId("mistuning");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    N: config.nDefault ?? 24,
    sigma: config.sigmaDefault ?? 2,
    kc: config.couplingDefault ?? 0.1,
    zeta: config.zetaDefault ?? 0.5,
    eo: config.eoDefault ?? 3,
  });
  const N = Math.round(vals.N);
  const sigma = vals.sigma / 100;
  const kc = vals.kc;
  const zeta = vals.zeta / 100;
  const eo = Math.min(Math.round(vals.eo), Math.floor(N / 2));
  const [seed, setSeed] = useState(config.seedDefault ?? 7);

  const delta = useMemo(() => gaussians(N, seed).map((g) => g * sigma), [N, seed, sigma]);

  const res = useMemo(() => {
    const phi = (2 * Math.PI * eo) / N;
    const wTop = Math.sqrt(1 + 4 * kc) + 0.12 + 2.5 * sigma;
    const wBot = Math.max(0.5, 0.88 - 2.5 * sigma);
    const ws: number[] = [];
    const tuned: number[] = [];
    const mist: number[] = [];
    let worstW = wBot;
    let worstAmp = -1;
    let worstBlades: number[] = [];
    let tunedMax = 0;
    const Ar = new Float64Array(N * N);
    const Ai = new Float64Array(N * N);
    const br = new Float64Array(N);
    const bi = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      br[j] = Math.cos(phi * j);
      bi[j] = Math.sin(phi * j);
    }
    for (let i = 0; i < NW; i++) {
      const w = wBot + ((wTop - wBot) * i) / (NW - 1);
      ws.push(w);
      // tuned（閉形式）
      const dr = 1 + 2 * kc * (1 - Math.cos(phi)) - w * w;
      const di = 2 * zeta * w;
      const Xt = 1 / Math.hypot(dr, di);
      tuned.push(Xt);
      if (Xt > tunedMax) tunedMax = Xt;
      // mistuned（線形系）
      Ar.fill(0);
      Ai.fill(0);
      for (let j = 0; j < N; j++) {
        Ar[j * N + j] = 1 + delta[j] + 2 * kc - w * w;
        Ai[j * N + j] = 2 * zeta * w;
        const jm = (j - 1 + N) % N;
        const jp = (j + 1) % N;
        Ar[j * N + jm] -= kc;
        Ar[j * N + jp] -= kc;
      }
      const amp = solveComplex(Ar, Ai, br, bi, N);
      let mx = 0;
      for (const a of amp) if (a > mx) mx = a;
      mist.push(mx);
      if (mx > worstAmp) {
        worstAmp = mx;
        worstW = w;
        worstBlades = amp;
      }
    }
    return { ws, tuned, mist, worstW, worstAmp, worstBlades, tunedMax, wBot, wTop };
  }, [N, kc, zeta, eo, delta, sigma]);

  const amplification = res.tunedMax > 0 ? res.worstAmp / res.tunedMax : 1;
  const whitehead = (1 + Math.sqrt(N)) / 2;

  // 上段：周波数応答
  const yMax = Math.max(res.worstAmp, res.tunedMax) * 1.12;
  const sx = (w: number) => PAD.l + ((w - res.wBot) / (res.wTop - res.wBot)) * (W - PAD.l - PAD.r);
  const sy = (a: number) => H1 - PAD.b - (Math.min(a, yMax) / yMax) * (H1 - PAD.t - PAD.b);
  const pathOf = (arr: number[]) =>
    arr.map((a, i) => `${i === 0 ? "M" : "L"}${sx(res.ws[i]).toFixed(1)},${sy(a).toFixed(1)}`).join(" ");

  // 下段：最悪周波数での翼ごとの振幅
  const bMax = res.worstAmp * 1.15;
  const bx = (j: number) => PAD.l + ((j + 0.5) / N) * (W - PAD.l - PAD.r);
  const bw = ((W - PAD.l - PAD.r) / N) * 0.62;
  const by = (a: number) => H2 - PAD.b + 8 - (Math.min(a, bMax) / bMax) * (H2 - PAD.t - PAD.b + 8);
  const tunedAtWorst = (() => {
    const i = res.ws.findIndex((w) => w >= res.worstW);
    return res.tuned[Math.max(0, i)];
  })();
  const worstIdx = res.worstBlades.indexOf(Math.max(...res.worstBlades));

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H1}`} className="w-full" role="img" aria-label="周波数応答：同じ翼とばらついた翼">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H1 - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
        <line x1={PAD.l} y1={H1 - PAD.b} x2={W - PAD.r} y2={H1 - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H1 - PAD.b} stroke="var(--line)" />
        {/* 翼単体の固有振動数 ω0=1 */}
        <line x1={sx(1)} y1={PAD.t} x2={sx(1)} y2={H1 - PAD.b} stroke="var(--line)" strokeDasharray="3 3" />
        <text x={sx(1)} y={H1 - PAD.b + 14} fontSize="10" fill="var(--mut)" textAnchor="middle">1.0</text>
        <text x={sx(res.wTop) - 2} y={H1 - PAD.b + 14} fontSize="10" fill="var(--mut)" textAnchor="end">{res.wTop.toFixed(2)}</text>
        <text x={sx(res.wBot) + 2} y={H1 - PAD.b + 14} fontSize="10" fill="var(--mut)" textAnchor="start">{res.wBot.toFixed(2)}</text>

        <path d={pathOf(res.tuned)} fill="none" stroke="var(--accent)" strokeWidth={2.2} opacity={0.9} />
        <path d={pathOf(res.mist)} fill="none" stroke={HEAVY} strokeWidth={2.2} />

        {/* 最悪点 */}
        <circle cx={sx(res.worstW)} cy={sy(res.worstAmp)} r={5} fill="none" stroke="var(--accent-d)" strokeWidth={2} />
        <line x1={sx(res.worstW)} y1={sy(res.worstAmp)} x2={sx(res.worstW)} y2={H1 - PAD.b} stroke="var(--accent-d)" strokeDasharray="3 3" opacity={0.5} />

        <text x={PAD.l + 8} y={PAD.t + 14} fontSize="12" fill="var(--accent)">同じ翼（tuned）</text>
        <text x={PAD.l + 8} y={PAD.t + 30} fontSize="12" fill={HEAVY}>ばらつきあり（最も揺れる翼）</text>

        <text x={(PAD.l + W - PAD.r) / 2} y={H1 - 6} fontSize="12" fill="var(--mut)" textAnchor="middle">
          励起振動数 ω（÷ 翼単体の固有振動数）
        </text>
        <text x={14} y={(PAD.t + H1 - PAD.b) / 2} fontSize="12" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 14 ${(PAD.t + H1 - PAD.b) / 2})`}>
          振幅（最大の翼）
        </text>
      </svg>

      <svg viewBox={`0 0 ${W} ${H2}`} className="mt-1 w-full" role="img" aria-label="最も揺れる周波数での翼ごとの振幅">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H2 - PAD.t - PAD.b + 8} fill="var(--soft)" opacity={0.35} />
        <line x1={PAD.l} y1={H2 - PAD.b + 8} x2={W - PAD.r} y2={H2 - PAD.b + 8} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H2 - PAD.b + 8} stroke="var(--line)" />
        {res.worstBlades.map((a, j) => (
          <rect
            key={j}
            x={bx(j) - bw / 2}
            y={by(a)}
            width={bw}
            height={H2 - PAD.b + 8 - by(a)}
            fill={j === worstIdx ? HEAVY : "var(--accent)"}
            opacity={j === worstIdx ? 1 : 0.55}
          />
        ))}
        {/* tuned の振幅（同じ周波数） */}
        <line x1={PAD.l} y1={by(tunedAtWorst)} x2={W - PAD.r} y2={by(tunedAtWorst)} stroke="var(--accent-d)" strokeDasharray="5 4" />
        <text x={W - PAD.r - 4} y={by(tunedAtWorst) - 4} fontSize="11" fill="var(--accent-d)" textAnchor="end">
          同じ翼ならこの高さ
        </text>
        <text x={(PAD.l + W - PAD.r) / 2} y={H2 - 6} fontSize="12" fill="var(--mut)" textAnchor="middle">
          翼の番号（1〜{N}）　ω = {res.worstW.toFixed(3)} のとき
        </text>
        <text x={14} y={(PAD.t + H2 - PAD.b) / 2 + 4} fontSize="12" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 14 ${(PAD.t + H2 - PAD.b) / 2 + 4})`}>
          翼ごとの振幅
        </text>
      </svg>

      <div className="mt-2 grid gap-1 text-sm text-mut sm:grid-cols-2">
        <div className="min-h-6">
          増幅率：<b className="font-ui tabular-nums text-ink">{amplification.toFixed(2)}</b> 倍
          <span className="ml-1">（最も揺れる翼 ÷ 同じ翼のとき）</span>
        </div>
        <div className="min-h-6">
          Whitehead の上限 (1+√N)/2：<b className="font-ui tabular-nums text-ink">{whitehead.toFixed(2)}</b> 倍
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="ばらつき σ（固有振動数の標準偏差）" value={vals.sigma} min={0} max={5} step={0.1} unit=" %" onChange={(v) => setParam("sigma", v)} />
        <Slider label="隣との結合 κc（シュラウド・円盤）" value={kc} min={0.02} max={0.5} step={0.01} onChange={(v) => setParam("kc", v)} />
        <Slider label="減衰比 ζ" value={vals.zeta} min={0.1} max={2} step={0.1} unit=" %" onChange={(v) => setParam("zeta", v)} />
        <Slider label="励起次数 k" value={eo} min={1} max={Math.floor(N / 2)} step={1} onChange={(v) => setParam("eo", v)} />
        <Slider label="翼の枚数 N" value={N} min={12} max={36} step={1} onChange={(v) => setParam("N", v)} />
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="rounded-full border border-line px-3 py-1 text-sm text-mut transition-colors hover:border-accent hover:text-accent"
          >
            ばらつきを振り直す
          </button>
          <span className="ml-2 pb-1 font-ui text-xs tabular-nums text-mut">#{seed}</span>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
