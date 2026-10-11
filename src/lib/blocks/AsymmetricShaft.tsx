import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";

// ドメイン部品：剛性が非対称な軸（2 極発電機の回転子のように、曲げの硬さが向きで違う軸）。
// 回転座標では硬さは一定（k₁ と k₂ の楕円）だが、静止座標から見ると硬さが 1 回転に 2 回、縦と横を通る。
// 静止座標の Jeffcott＋周期係数：
//   m ẍ + c ẋ + k_m x + Δk ( x cos2Ωt + y sin2Ωt ) = 0
//   m ÿ + c ẏ + k_m y + Δk ( x sin2Ωt − y cos2Ωt ) = −m g
//   k_m = (k₁+k₂)/2, Δk = (k₁−k₂)/2
// 無次元：m = 1、k_m = 1（ω_n = 1）、静的たわみ g/k_m = 1。
// 計算は回転座標（ξ, η）で行う。そこでは剛性が一定（k₁, k₂）で、代わりに Coriolis・遠心・回転する減衰項と、
// −Ω で回る自重 (f_ξ, f_η) = (−g sinΩt, −g cosΩt) が入る：
//   ξ'' + c ξ' − cΩ η − 2Ω η' + (k₁ − Ω²) ξ = f_ξ
//   η'' + c η' + cΩ ξ + 2Ω ξ' + (k₂ − Ω²) η = f_η
// 下段：Ω を掃引し、(a) 自重に対する定常応答（複素 2×2 を解く）を静止座標に戻した 2Ω 成分の振幅と、
// (b) 不安定帯（4×4 の状態行列の固有値の実部が正になる範囲）。どちらも解析的なので掃引は一瞬で済む。
// 無減衰の不安定帯は解析解 √(k₂/m) < Ω < √(k₁/m)（k₁ > k₂）。減衰があると帯は内側に狭まる。
// ※ 模式。ジャイロ・多モード・軸受の異方性は含まない。

export type AsymmetricShaftConfig = {
  title?: string;
  caption?: string;
  link?: string;
  asymDefault?: number; // Δk/k_m（0〜0.4）
  zetaDefault?: number; // 減衰比（k_m 基準）
  omegaDefault?: number; // Ω/ω_n
};

const W = 640;
const H = 470;
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";
const TOP = { cx: 150, cy: 115, r: 78 }; // 回転座標の硬さの楕円
const TRACE = { x0: 300, x1: 620, y0: 36, y1: 196 }; // 静止座標で見た硬さ k_y(t) の時間波形
const BOT = { x0: 56, x1: 620, y0: 262, y1: 432 };
const NW = 110; // 掃引点数

type Sweep = { om: number[]; amp2: number[]; unstable: boolean[]; peakOm: number };

type C = { re: number; im: number };
const cadd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cabs = (a: C) => Math.hypot(a.re, a.im);

// (a) 自重に対する定常応答：回転座標で e^{iΩt} の強制 (i g, −g) に対する複素振幅 Z₁, Z₂ を求め、
// 静止座標に戻したときの y の 2Ω 成分の振幅 |−i Z₁ + Z₂| / 2 を返す（Δk = 0 なら厳密に 0）。
function amp2Analytic(asym: number, zeta: number, om: number, g: number): number {
  const c = 2 * zeta;
  const k1 = 1 + asym;
  const k2 = 1 - asym;
  const a11: C = { re: k1 - 2 * om * om, im: om * c };
  const a12: C = { re: -c * om, im: -2 * om * om };
  const a21: C = { re: c * om, im: 2 * om * om };
  const a22: C = { re: k2 - 2 * om * om, im: om * c };
  const f1: C = { re: 0, im: g };
  const f2: C = { re: -g, im: 0 };
  const det = csub(cmul(a11, a22), cmul(a12, a21));
  const z1 = cdiv(csub(cmul(f1, a22), cmul(a12, f2)), det);
  const z2 = cdiv(csub(cmul(a11, f2), cmul(a21, f1)), det);
  // −i Z₁ + Z₂
  const w: C = { re: z1.im + z2.re, im: -z1.re + z2.im };
  return cabs(w) / 2;
}

// (b) 安定判定：回転座標の状態行列（4×4）の固有値の最大実部。特性多項式を Faddeev–LeVerrier で作り、Durand–Kerner で根を求める。
function maxRealEig(asym: number, zeta: number, om: number): number {
  const c = 2 * zeta;
  const k1 = 1 + asym;
  const k2 = 1 - asym;
  const A = [
    [0, 0, 1, 0],
    [0, 0, 0, 1],
    [-(k1 - om * om), c * om, -c, 2 * om],
    [-c * om, -(k2 - om * om), -2 * om, -c],
  ];
  const n = 4;
  const I = (v: number) => A.map((_, i) => A.map((__, j) => (i === j ? v : 0)));
  const mul = (X: number[][], Y: number[][]) => X.map((r) => Y[0].map((_, j) => r.reduce((s, x, k) => s + x * Y[k][j], 0)));
  const tr = (X: number[][]) => X.reduce((s, r, i) => s + r[i], 0);
  // λ⁴ + c3 λ³ + c2 λ² + c1 λ + c0
  const coef = [1, 0, 0, 0, 0]; // coef[k] は λ^{n−k} の係数
  let M = I(0);
  for (let k = 1; k <= n; k++) {
    M = mul(A, M).map((r, i) => r.map((x, j) => x + (i === j ? coef[k - 1] : 0)));
    coef[k] = -tr(mul(A, M)) / k;
  }
  const poly = (z: C): C => {
    let r: C = { re: 1, im: 0 };
    for (let k = 1; k <= n; k++) r = cadd(cmul(r, z), { re: coef[k], im: 0 });
    return r;
  };
  let roots: C[] = [0, 1, 2, 3].map((k) => ({ re: 0.4 * Math.cos(0.9 + 2.1 * k), im: 0.9 * Math.sin(0.9 + 2.1 * k) }));
  for (let it = 0; it < 80; it++) {
    roots = roots.map((z, i) => {
      let den: C = { re: 1, im: 0 };
      roots.forEach((w, j) => {
        if (j !== i) den = cmul(den, csub(z, w));
      });
      return csub(z, cdiv(poly(z), den));
    });
  }
  return Math.max(...roots.map((r) => r.re));
}

function sweep(asym: number, zeta: number): Sweep {
  const om: number[] = [];
  const amp2: number[] = [];
  const unstable: boolean[] = [];
  let peakOm = 0;
  let peakA = 0;
  for (let i = 0; i < NW; i++) {
    const w = 0.08 + (1.5 * i) / (NW - 1);
    om.push(w);
    const a = Math.min(amp2Analytic(asym, zeta, w, 1), 50);
    amp2.push(a);
    unstable.push(maxRealEig(asym, zeta, w) > 1e-6);
    if (a > peakA && !unstable[i]) {
      peakA = a;
      peakOm = w;
    }
  }
  return { om, amp2, unstable, peakOm };
}

export default function AsymmetricShaft({ config }: { config: AsymmetricShaftConfig }) {
  const [asym, setAsym] = useState(config.asymDefault ?? 0.2);
  const [zeta, setZeta] = useState(config.zetaDefault ?? 0.02);
  const [om, setOm] = useState(config.omegaDefault ?? 0.45);
  const [running, setRunning] = useState(true);
  const [phase, setPhase] = useState(0);
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = (t - last.current) / 1000;
        setPhase((p) => (p + 1.2 * dt) % (Math.PI * 4)); // 表示用のゆっくりした回転（2 回転ぶんの波形に合わせて 4π で折り返す）
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  const sw = useMemo(() => sweep(asym, zeta), [asym, zeta]);

  const k1 = 1 + asym;
  const k2 = 1 - asym;
  const w1 = Math.sqrt(k1);
  const w2 = Math.sqrt(k2);
  // 無減衰の不安定帯 √k₂ < Ω < √k₁、減衰付きの固有値判定の帯
  const numBand = (() => {
    const idx = sw.unstable.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return null;
    return [sw.om[idx[0]], sw.om[idx[idx.length - 1]]] as const;
  })();
  const isUnstableNow = numBand ? om >= numBand[0] && om <= numBand[1] : false;

  // 上段左：回転座標の硬さ k(φ) = k_m + Δk cos2φ の楕円（回転に合わせて回る）
  const ellipse = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 72; i++) {
      const ph = (i / 72) * Math.PI * 2;
      const k = 1 + asym * Math.cos(2 * (ph - phase));
      const r = TOP.r * k;
      pts.push(`${(TOP.cx + r * Math.cos(ph)).toFixed(1)},${(TOP.cy - r * Math.sin(ph)).toFixed(1)}`);
    }
    return "M" + pts.join(" L") + " Z";
  }, [asym, phase]);
  const kyNow = 1 - asym * Math.cos(2 * phase); // 縦方向（自重の向き）の硬さ
  const kxNow = 1 + asym * Math.cos(2 * phase);

  // 上段右：静止座標で見た縦の硬さの時間波形（2 回/回転）
  const tracePath = useMemo(() => {
    const pts: string[] = [];
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * 4 * Math.PI; // 2 回転ぶん
      const k = 1 - asym * Math.cos(2 * th);
      const x = TRACE.x0 + ((TRACE.x1 - TRACE.x0) * i) / N;
      const y = TRACE.y1 - ((k - 0.5) / 1.0) * (TRACE.y1 - TRACE.y0);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }, [asym]);
  const traceX = TRACE.x0 + ((TRACE.x1 - TRACE.x0) * ((phase % (4 * Math.PI)) / (4 * Math.PI)));
  const traceY = TRACE.y1 - ((kyNow - 0.5) / 1.0) * (TRACE.y1 - TRACE.y0);

  // 下段：2× 振幅 vs Ω
  const amax = Math.max(1.5, ...sw.amp2.filter((a) => a < 50)) * 1.15;
  const xOf = (w: number) => BOT.x0 + ((w - 0.08) / 1.5) * (BOT.x1 - BOT.x0);
  const yOf = (a: number) => BOT.y1 - (Math.min(a, amax) / amax) * (BOT.y1 - BOT.y0);
  const ampPath = sw.om
    .map((w, i) => (sw.unstable[i] ? null : `${xOf(w).toFixed(1)},${yOf(sw.amp2[i]).toFixed(1)}`))
    .reduce<string>((acc, p, i) => {
      if (!p) return acc + "|";
      const prev = i > 0 && !sw.unstable[i - 1] && !acc.endsWith("|") && acc.length > 0;
      return acc + (prev ? " L" : " M") + p;
    }, "")
    .replace(/\|/g, "");
  const iNow = Math.round(((om - 0.08) / 1.5) * (NW - 1));
  const ampNow = sw.amp2[Math.max(0, Math.min(NW - 1, iNow))];

  const fmt = (v: number) => v.toFixed(2);

  return (
    <div className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <h4 className="mb-2 font-serif text-base text-ink">{config.title}</h4> : null}
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="非対称剛性の軸：回転座標の硬さの楕円、静止座標で見た硬さの 2 回/回転の変動、2× 応答と不安定帯">
        {/* 上段左：硬さの楕円（回転座標） */}
        <text x={TOP.cx} y={18} fontSize="11" fill="var(--mut)" textAnchor="middle" className="font-ui">
          軸と一緒に回る硬さ（回転座標では一定）
        </text>
        <circle cx={TOP.cx} cy={TOP.cy} r={TOP.r} fill="none" stroke="var(--line)" strokeDasharray="3 3" />
        <path d={ellipse} fill="rgba(31,58,95,0.08)" stroke="var(--accent)" strokeWidth={2} />
        {/* 硬い向き（k₁）の軸線 */}
        <line
          x1={TOP.cx - TOP.r * k1 * Math.cos(phase)}
          y1={TOP.cy + TOP.r * k1 * Math.sin(phase)}
          x2={TOP.cx + TOP.r * k1 * Math.cos(phase)}
          y2={TOP.cy - TOP.r * k1 * Math.sin(phase)}
          stroke={HEAVY}
          strokeWidth={2}
        />
        {/* 自重の向き（下向き矢印） */}
        <line x1={TOP.cx} y1={TOP.cy + TOP.r + 8} x2={TOP.cx} y2={TOP.cy + TOP.r + 30} stroke="var(--mut)" strokeWidth={1.5} />
        <path d={`M${TOP.cx - 4},${TOP.cy + TOP.r + 24} L${TOP.cx},${TOP.cy + TOP.r + 32} L${TOP.cx + 4},${TOP.cy + TOP.r + 24}`} fill="none" stroke="var(--mut)" strokeWidth={1.5} />
        <text x={TOP.cx + 8} y={TOP.cy + TOP.r + 30} fontSize="10" fill="var(--mut)" className="font-ui">
          自重
        </text>
        <text x={TOP.cx} y={TOP.cy + 4} fontSize="10" fill="var(--ink)" textAnchor="middle" className="font-ui tabular-nums">
          縦の硬さ {fmt(kyNow)} ／ 横 {fmt(kxNow)}
        </text>

        {/* 上段右：静止座標で見た縦の硬さ k_y(t) */}
        <text x={(TRACE.x0 + TRACE.x1) / 2} y={18} fontSize="11" fill="var(--mut)" textAnchor="middle" className="font-ui">
          静止座標で見た縦の硬さ（1 回転に 2 回変わる）
        </text>
        <rect x={TRACE.x0} y={TRACE.y0} width={TRACE.x1 - TRACE.x0} height={TRACE.y1 - TRACE.y0} fill="none" stroke="var(--line)" />
        <line x1={TRACE.x0} y1={TRACE.y1 - 0.5 * (TRACE.y1 - TRACE.y0)} x2={TRACE.x1} y2={TRACE.y1 - 0.5 * (TRACE.y1 - TRACE.y0)} stroke="var(--line)" strokeDasharray="3 3" />
        <path d={tracePath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <circle cx={traceX} cy={traceY} r={4} fill={HEAVY} />
        {[0, 1, 2].map((k) => (
          <text key={k} x={TRACE.x0 + ((TRACE.x1 - TRACE.x0) * k) / 2} y={TRACE.y1 + 13} fontSize="10" fill="var(--mut)" textAnchor="middle" className="font-ui">
            {k} 回転
          </text>
        ))}
        <text x={TRACE.x0 - 4} y={TRACE.y1 - 0.5 * (TRACE.y1 - TRACE.y0) + 3} fontSize="10" fill="var(--mut)" textAnchor="end" className="font-ui">
          k_m
        </text>

        {/* 下段：2× 応答と不安定帯 */}
        <text x={BOT.x0} y={BOT.y0 - 12} fontSize="11" fill="var(--mut)" className="font-ui">
          自重による揺れの振幅（主に 2×、静的たわみ＝1）と、不安定帯
        </text>
        <rect x={BOT.x0} y={BOT.y0} width={BOT.x1 - BOT.x0} height={BOT.y1 - BOT.y0} fill="none" stroke="var(--line)" />
        {/* 無減衰の解析帯（薄い破線枠） */}
        <rect x={xOf(w2)} y={BOT.y0} width={Math.max(1, xOf(w1) - xOf(w2))} height={BOT.y1 - BOT.y0} fill="none" stroke={HEAVY} strokeDasharray="4 3" opacity={0.55} />
        {/* 固有値判定の帯（減衰で狭まる） */}
        {numBand ? (
          <rect x={xOf(numBand[0])} y={BOT.y0} width={Math.max(2, xOf(numBand[1]) - xOf(numBand[0]))} height={BOT.y1 - BOT.y0} fill="rgba(155,45,58,0.16)" />
        ) : null}
        <path d={ampPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {/* 2Ω = ω_n の目印（Ω = 0.5） */}
        <line x1={xOf(0.5)} y1={BOT.y0} x2={xOf(0.5)} y2={BOT.y1} stroke={GOLD} strokeDasharray="3 3" />
        <text x={xOf(0.5)} y={BOT.y0 + 12} fontSize="10" fill={GOLD} textAnchor="middle" className="font-ui">
          Ω = ω_n/2
        </text>
        {/* 現在の Ω */}
        <line x1={xOf(om)} y1={BOT.y0} x2={xOf(om)} y2={BOT.y1} stroke={HEAVY} strokeWidth={1.5} />
        {!isUnstableNow ? <circle cx={xOf(om)} cy={yOf(ampNow)} r={4.5} fill={HEAVY} /> : null}
        {[0.5, 1.0, 1.5].map((w) => (
          <text key={w} x={xOf(w)} y={BOT.y1 + 14} fontSize="10" fill="var(--mut)" textAnchor="middle" className="font-ui">
            {w.toFixed(1)}
          </text>
        ))}
        <text x={BOT.x1} y={BOT.y1 + 28} fontSize="10" fill="var(--mut)" textAnchor="end" className="font-ui">
          回転数 Ω / ω_n
        </text>
        <text x={BOT.x0 - 6} y={BOT.y0 + 4} fontSize="10" fill="var(--mut)" textAnchor="end" className="font-ui tabular-nums">
          {amax.toFixed(1)}
        </text>
        <text x={BOT.x0 - 6} y={BOT.y1 + 4} fontSize="10" fill="var(--mut)" textAnchor="end" className="font-ui">
          0
        </text>
        <text x={xOf(w1) + 4} y={BOT.y1 - 6} fontSize="10" fill={HEAVY} className="font-ui">
          √k₁
        </text>
        <text x={xOf(w2) - 4} y={BOT.y1 - 6} fontSize="10" fill={HEAVY} textAnchor="end" className="font-ui">
          √k₂
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="w-full text-ink sm:w-auto">
          {isUnstableNow ? (
            <span className="text-[#9b2d3a]">この回転数では揺れが育つ（不安定帯の中）</span>
          ) : (
            <span className="tabular-nums">自重による揺れの振幅（主に 2×）≈ {ampNow.toFixed(2)}（静的たわみ比）</span>
          )}
        </span>
        <span className="text-mut tabular-nums">
          無減衰の不安定帯 {fmt(w2)}〜{fmt(w1)} ／ 判定帯 {numBand ? `${fmt(numBand[0])}〜${fmt(numBand[1])}` : "なし"}
        </span>
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Slider label="回転数 Ω / ω_n" value={om} min={0.08} max={1.58} step={0.01} onChange={setOm} />
        <Slider label="非対称率 Δk / k_m" value={asym} min={0} max={0.4} step={0.01} onChange={setAsym} />
        <Slider label="減衰比 ζ" value={zeta} min={0.005} max={0.1} step={0.005} onChange={setZeta} />
      </div>
      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
      <p className="mt-1 text-xs leading-relaxed text-mut">
        模式：m = 1、k_m = 1、静的たわみ = 1 の無次元 Jeffcott。剛性が一定になる回転座標で解き、自重（回転座標では −Ω で回る荷重）に対する定常応答を静止座標に戻した 2Ω 成分を振幅とする。不安定帯は回転座標の運動方程式の固有値の実部の符号で判定（減衰で解析帯より狭まる）。ジャイロ・多モード・軸受の異方性は含まない。
      </p>
    </div>
  );
}
