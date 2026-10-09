import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";
import { foldND } from "../bladedDisk";

// 翼振動章：励起次数の折り返し（空間エイリアシング）。
// 円周上に cos(kθ) の圧力パターン（励起次数 k）があっても、N 枚の翼は θ_j = 2πj/N の
// N 点でしかそれを「標本化」できない。k = mN ± n と書けるとき
//   cos(kθ_j) = cos(2πmj ± nθ_j) = cos(nθ_j)
// なので、翼の列には節直径 n = fold(k, N) = min(k mod N, N − k mod N) のパターンに見える。
// FFT 章のエイリアシング（標本化周波数 fs=N で f'=|k − mN|）とまったく同じ構造。
// k を増やすと n は 0→N/2→0→… とジグザグ ＝ ZZENF 線図のジグザグ励起線の正体。
// ※ 幾何は式どおり。翼の振幅表示（リング）は 1 + 0.45·cos(kθ_j) の模式。

export type EoFoldingConfig = {
  title?: string;
  caption?: string;
  link?: string;
  nDefault?: number; // 翼の枚数 N
  kDefault?: number; // 励起次数 k
  kMaxMul?: number; // k の上限 = kMaxMul × N（既定 2）
};

const HEAVY = "#9b2d3a";
const W = 680;
const H1 = 236; // 上段：リング＋展開図
const H2 = 236; // 下段：k vs n

export default function EoFolding({ config }: { config: EoFoldingConfig }) {
  const instId = useInstanceId("eo-folding");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    N: config.nDefault ?? 24,
    k: config.kDefault ?? 5,
  });
  const N = Math.round(vals.N);
  const kMax = (config.kMaxMul ?? 2) * N;
  const k = Math.min(Math.round(vals.k), kMax);
  const n = foldND(k, N);
  const half = Math.floor(N / 2);
  // N が link 経由で変わったときも k を上限内に正規化する
  useEffect(() => {
    if (Math.round(vals.k) > kMax) setParam("k", kMax);
  }, [vals.k, kMax, setParam]);

  // 再生：k を一定間隔で進める
  const [running, setRunning] = useState(false);
  const raf = useRef<number>();
  const last = useRef<number>();
  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current === undefined) last.current = t;
      if (t - last.current > 420) {
        last.current = t;
        setParam("k", k >= kMax ? 0 : k + 1);
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, k, kMax, setParam]);

  // ---- 上段：リング（左）と展開図（右） ----
  const RING = { cx: 112, cy: 122, r: 72 };
  const PLOT = { l: 236, r: 664, t: 30, b: 206 };
  const px = (th: number) => PLOT.l + (th / (2 * Math.PI)) * (PLOT.r - PLOT.l);
  const pyMid = (PLOT.t + PLOT.b) / 2;
  const pAmp = (PLOT.b - PLOT.t) / 2 - 8;
  const py = (v: number) => pyMid - v * pAmp;

  const { contD, foldD, samples } = useMemo(() => {
    const M = 480;
    const c: string[] = [];
    const f: string[] = [];
    for (let i = 0; i <= M; i++) {
      const th = (2 * Math.PI * i) / M;
      c.push(`${i === 0 ? "M" : "L"}${px(th).toFixed(1)},${py(Math.cos(k * th)).toFixed(1)}`);
      f.push(`${i === 0 ? "M" : "L"}${px(th).toFixed(1)},${py(Math.cos(n * th)).toFixed(1)}`);
    }
    const s: { th: number; v: number }[] = [];
    for (let j = 0; j < N; j++) {
      const th = (2 * Math.PI * j) / N;
      s.push({ th, v: Math.cos(k * th) });
    }
    return { contD: c.join(" "), foldD: f.join(" "), samples: s };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, n, N]);

  // ---- 下段：k vs n の散布 ----
  const AX = { l: 56, r: 664, t: 22, b: 196 };
  const kx = (kk: number) => AX.l + (kk / kMax) * (AX.r - AX.l);
  const ny = (nn: number) => AX.b - (nn / Math.max(1, half)) * (AX.b - AX.t);
  const zig = useMemo(() => {
    const pts: string[] = [];
    for (let kk = 0; kk <= k; kk++) {
      pts.push(`${kk === 0 ? "M" : "L"}${kx(kk).toFixed(1)},${ny(foldND(kk, N)).toFixed(1)}`);
    }
    return pts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, N, kMax]);

  const m = Math.round((k - (k % N)) / N);
  const rem = k % N;
  const how =
    k === n
      ? `k = n（折り返しなし）`
      : rem === n
      ? `k = ${m}N + ${n}`
      : `k = ${m + 1}N − ${n}`;
  const special =
    k % N === 0 && k > 0
      ? "全翼が同じ向き（節直径 0・アンブレラ）"
      : N % 2 === 0 && k % N === N / 2
      ? "隣同士が逆向き（節直径 N/2）"
      : "";

  const yLabelEvery = half <= 12 ? 2 : half <= 24 ? 4 : 6;
  const kMarks = [0.5, 1, 1.5, 2].map((f) => f * N).filter((v) => v <= kMax);

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      {/* 上段：連続パターンと翼の標本点 */}
      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H1}`} className="w-full min-w-[520px]" role="img" aria-label="励起次数のパターンを翼が標本化する図">
        {/* リング：翼の列 */}
        <circle cx={RING.cx} cy={RING.cy} r={RING.r * 0.62} fill="var(--soft)" stroke="var(--line)" />
        {samples.map((s, j) => {
          const len = RING.r * (0.62 + 0.38 * (0.5 + 0.5 * s.v));
          const x1 = RING.cx + Math.cos(s.th) * RING.r * 0.62;
          const y1 = RING.cy - Math.sin(s.th) * RING.r * 0.62;
          const x2 = RING.cx + Math.cos(s.th) * len;
          const y2 = RING.cy - Math.sin(s.th) * len;
          const col = s.v >= 0 ? "var(--accent)" : HEAVY;
          return <line key={j} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={N > 36 ? 2 : 3} strokeLinecap="round" opacity={0.35 + 0.65 * Math.abs(s.v)} />;
        })}
        <text x={RING.cx} y={RING.cy + 4} fontSize="11" fill="var(--mut)" textAnchor="middle">
          N = {N}
        </text>
        <text x={RING.cx} y={H1 - 10} fontSize="11" fill="var(--mut)" textAnchor="middle">
          翼が感じる押し引き
        </text>

        {/* 展開図 */}
        <rect x={PLOT.l} y={PLOT.t} width={PLOT.r - PLOT.l} height={PLOT.b - PLOT.t} fill="var(--soft)" opacity={0.35} />
        <line x1={PLOT.l} y1={pyMid} x2={PLOT.r} y2={pyMid} stroke="var(--line)" />
        <path d={contD} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.45} />
        {k !== n ? <path d={foldD} fill="none" stroke={HEAVY} strokeWidth={2.4} /> : <path d={foldD} fill="none" stroke="var(--accent)" strokeWidth={2.4} />}
        {samples.map((s, j) => (
          <circle key={j} cx={px(s.th)} cy={py(s.v)} r={N > 36 ? 2.6 : 3.4} fill="var(--accent-d)" />
        ))}
        <text x={PLOT.l} y={PLOT.t - 10} fontSize="11" fill="var(--accent)" textAnchor="start">
          細線：k = {k} の圧力パターン
        </text>
        <text x={PLOT.r} y={PLOT.t - 10} fontSize="11" fill={k !== n ? HEAVY : "var(--accent)"} textAnchor="end">
          太線：翼に見える n = {n}
        </text>
        <text x={PLOT.l} y={H1 - 10} fontSize="11" fill="var(--mut)" textAnchor="start">0°</text>
        <text x={(PLOT.l + PLOT.r) / 2} y={H1 - 10} fontSize="11" fill="var(--mut)" textAnchor="middle">円周の角度 θ</text>
        <text x={PLOT.r} y={H1 - 10} fontSize="11" fill="var(--mut)" textAnchor="end">360°</text>
      </svg>
      </div>

      <div className="mt-1 min-h-[2.5rem] text-sm text-mut">
        <span className="font-ui tabular-nums text-ink">k = {k}</span> → 翼に見える節直径{" "}
        <span className="font-ui tabular-nums text-ink">n = {n}</span>
        <span className="ml-2 text-mut">（{how}）</span>
        {special ? <span className="ml-2 text-ink">{special}</span> : null}
      </div>

      {/* 下段：k vs n のジグザグ */}
      <svg viewBox={`0 0 ${W} ${H2}`} className="mt-2 w-full" role="img" aria-label="励起次数と節直径のジグザグ">
        <rect x={AX.l} y={AX.t} width={AX.r - AX.l} height={AX.b - AX.t} fill="var(--soft)" opacity={0.35} />
        <line x1={AX.l} y1={AX.b} x2={AX.r} y2={AX.b} stroke="var(--line)" />
        <line x1={AX.l} y1={AX.t} x2={AX.l} y2={AX.b} stroke="var(--line)" />
        {/* N の節目 */}
        {kMarks.map((v) => (
          <g key={v}>
            <line x1={kx(v)} y1={AX.t} x2={kx(v)} y2={AX.b} stroke="var(--mut)" strokeDasharray="2 4" opacity={0.5} />
            <text x={kx(v)} y={AX.b + 14} fontSize="11" fill="var(--mut)" textAnchor="middle">
              {v === N ? "N" : v === N / 2 ? "N/2" : v === 1.5 * N ? "3N/2" : "2N"}
            </text>
          </g>
        ))}
        {/* y 目盛り */}
        {Array.from({ length: half + 1 }, (_, i) => i)
          .filter((i) => i % yLabelEvery === 0 || i === half)
          .map((i) => (
            <text key={i} x={AX.l - 6} y={ny(i) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              {i}
            </text>
          ))}
        {/* まだ来ていない点（薄く） */}
        {Array.from({ length: kMax + 1 }, (_, kk) => kk)
          .filter((kk) => kk > k)
          .map((kk) => (
            <circle key={kk} cx={kx(kk)} cy={ny(foldND(kk, N))} r={2} fill="var(--mut)" opacity={0.25} />
          ))}
        {/* ジグザグ（ここまで） */}
        <path d={zig} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        {Array.from({ length: k + 1 }, (_, kk) => kk).map((kk) => (
          <circle key={kk} cx={kx(kk)} cy={ny(foldND(kk, N))} r={2.4} fill="var(--accent)" />
        ))}
        <circle cx={kx(k)} cy={ny(n)} r={6} fill="none" stroke={HEAVY} strokeWidth={2} />
        <text x={AX.l - 6} y={AX.t - 8} fontSize="11" fill="var(--mut)" textAnchor="start">
          節直径 n
        </text>
        <text x={AX.r} y={AX.b + 28} fontSize="11" fill="var(--mut)" textAnchor="end">
          励起次数 k（回転1周あたりの叩かれる回数）
        </text>
      </svg>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Slider label="励起次数 k" value={k} min={0} max={kMax} step={1} onChange={(v) => setParam("k", v)} />
        <Slider label="翼の枚数 N" value={N} min={12} max={48} step={1} onChange={(v) => { setParam("N", v); setParam("k", Math.min(k, (config.kMaxMul ?? 2) * v)); }} />
        <div className="flex items-end">
          <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
