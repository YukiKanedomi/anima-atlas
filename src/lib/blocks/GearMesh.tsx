import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { ampSpectrum } from "../fft";

// ドメイン部品：歯車のかみ合い。
// 上段＝二つの平歯車が回る（模式。歯数 Z₁・Z₂ はスライダー）。
// 中段＝かみ合い剛性 k(θ)：同時にかみ合う歯が 1 組か 2 組かで剛性が矩形的に変わる（かみ合い率 ε の端数が 2 組の時間の割合）。
//       一定のトルクで押すと、たわみ＝伝達誤差（TE）は 1/k(θ) で脈動する（静的伝達誤差の模式）。
// 下段＝その TE 波形（ピニオン 32 回転・256 点/回転）を Hann 窓＋本物の FFT にかけた振幅スペクトル。横軸はピニオンの次数。
//       縦軸は条件によらず共通の尺度（振幅 SPEC_SCALE で正規化）。矩形モデルでは 1/k の基本波は ε−1 の正弦に比例し、ε=1,2 でゼロ、1.5 付近で最大（単調ではない）。
//       かみ合い周波数 f_mesh = Z₁ × f_rot1 とその高調波が立ち、ピニオンの偏心を入れると ±1× の側帯波、
//       歯車側の偏心を入れると ±(Z₁/Z₂)× の側帯波が付く。偏心は「1 回転 1 回の成分」と「かみ合い振幅の変調」の両方として入れる。
// ※ 剛性の矩形変動と変調の大きさは教科書的な模式。実機の TE 波形は歯形修整・荷重・誤差で変わる。

export type GearMeshConfig = {
  title?: string;
  caption?: string;
  link?: string;
  z1Default?: number; // ピニオン歯数 12..40
  z2Default?: number; // 歯車歯数 Z1..80
  epsDefault?: number; // かみ合い率 1.0..2.0
  eccPinionDefault?: number; // ピニオン偏心 0..1
  eccGearDefault?: number; // 歯車偏心 0..1
};

const W = 640;
const GEAR_H = 230;
const K_H = 130;
const SPEC_H = 170;
const H = GEAR_H + K_H + SPEC_H + 30;
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";
const REVS = 32; // 解析に使うピニオン回転数
const SPEC_SCALE = 0.4; // スペクトルの共通尺度（振幅）。最大の成分（偏心 1 のときの 1× ≈ 0.35）が収まる値
const SPR = 256; // 1 回転あたりの標本数 → N = 8192、分解能 1/32 次、Nyquist 128 次

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// 歯車の輪郭（台形歯の模式）。中心原点、角度 0 の歯が +x を向く。
function gearPath(z: number, rp: number, mod: number): string {
  const ra = rp + mod; // 歯先
  const rf = rp - 1.25 * mod; // 歯元
  const p = (2 * Math.PI) / z;
  const pts: string[] = [];
  for (let i = 0; i < z; i++) {
    const c = i * p;
    const a0 = c - 0.5 * p; // 歯元の谷
    const a1 = c - 0.3 * p; // 歯元の立ち上がり
    const a2 = c - 0.17 * p; // 歯先の角
    const a3 = c + 0.17 * p;
    const a4 = c + 0.3 * p;
    pts.push(`${(rf * Math.cos(a0)).toFixed(1)},${(rf * Math.sin(a0)).toFixed(1)}`);
    pts.push(`${(rf * Math.cos(a1)).toFixed(1)},${(rf * Math.sin(a1)).toFixed(1)}`);
    pts.push(`${(ra * Math.cos(a2)).toFixed(1)},${(ra * Math.sin(a2)).toFixed(1)}`);
    pts.push(`${(ra * Math.cos(a3)).toFixed(1)},${(ra * Math.sin(a3)).toFixed(1)}`);
    pts.push(`${(rf * Math.cos(a4)).toFixed(1)},${(rf * Math.sin(a4)).toFixed(1)}`);
  }
  return "M" + pts.join(" L") + " Z";
}

// かみ合い剛性（相対値）。u は かみ合い周期内の位相 0..1。eps の端数の区間だけ 2 組接触。
function meshStiffness(u: number, eps: number): number {
  const two = clamp(eps - 1, 0, 1);
  const frac = u - Math.floor(u);
  return frac < two ? 1.8 : 1.0; // 2 組のときは荷重が分担されて硬い（完全な 2 倍にはならない）
}

export default function GearMesh({ config }: { config: GearMeshConfig }) {
  const [z1, setZ1] = useState(clamp(Math.round(config.z1Default ?? 20), 12, 40));
  const [z2, setZ2] = useState(clamp(Math.round(config.z2Default ?? 37), 12, 80));
  const [eps, setEps] = useState(clamp(config.epsDefault ?? 1.5, 1, 2));
  const [ep, setEp] = useState(clamp(config.eccPinionDefault ?? 0, 0, 1));
  const [eg, setEg] = useState(clamp(config.eccGearDefault ?? 0, 0, 1));
  const [running, setRunning] = useState(true);
  const [theta, setTheta] = useState(0); // ピニオンの回転角 [rad]
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!running) return;
    const step = (t: number) => {
      if (last.current) {
        const dt = Math.min(0.05, (t - last.current) / 1000);
        setTheta((th) => th + dt * 0.9); // 約 0.14 回転/秒
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, [running]);

  // 歯車の寸法（画面に収まるようモジュールを決める）
  const geo = useMemo(() => {
    const mod = Math.min(9, 560 / (z1 + z2));
    const r1 = (mod * z1) / 2;
    const r2 = (mod * z2) / 2;
    const a = r1 + r2;
    const cy = GEAR_H / 2 + 6;
    const cx1 = W / 2 - a / 2;
    const cx2 = cx1 + a;
    return { mod, r1, r2, a, cx1, cx2, cy, p1: gearPath(z1, r1, mod), p2: gearPath(z2, r2, mod) };
  }, [z1, z2]);

  // 中段：k(θ) と TE（3 かみ合い周期）
  const kCurve = useMemo(() => {
    const pts: { u: number; k: number; te: number }[] = [];
    for (let i = 0; i <= 300; i++) {
      const u = (i / 300) * 3;
      const k = meshStiffness(u, eps);
      pts.push({ u, k, te: 1 / k });
    }
    return pts;
  }, [eps]);

  // 下段：TE 波形の本物の FFT
  const spec = useMemo(() => {
    const N = REVS * SPR;
    const sig = new Float64Array(N);
    const ratio = z1 / z2; // 歯車の回転周波数（ピニオン次数）
    for (let n = 0; n < N; n++) {
      const th = (2 * Math.PI * n) / SPR; // ピニオン角
      const u = (n / SPR) * z1; // かみ合い周期の位相（1 回転に Z₁ 回）
      const base = 1 / meshStiffness(u, eps) - 0.75; // 平均をおおむね除く
      const modu = 1 + 0.6 * ep * Math.sin(th) + 0.6 * eg * Math.sin(th * ratio);
      sig[n] = base * modu + 0.35 * ep * Math.sin(th) + 0.35 * eg * Math.sin(th * ratio);
    }
    const amp = ampSpectrum(sig, true);
    const xmax = Math.min(128, 2.5 * z1 + 4);
    const kmax = Math.floor(xmax * REVS);
    const bins: number[] = [];
    for (let k = 0; k <= kmax; k++) bins.push(Math.min(1, amp[k] / SPEC_SCALE));
    return { bins, xmax, ratio };
  }, [z1, z2, eps, ep, eg]);

  // 描画用の座標変換
  const kTop = GEAR_H + 10;
  const kBottom = kTop + K_H - 28;
  const kX = (u: number) => 56 + (u / 3) * (W - 76);
  const kY = (v: number) => kBottom - (v / 2.0) * (kBottom - kTop - 10);
  const sTop = GEAR_H + K_H + 22;
  const sBottom = sTop + SPEC_H - 36;
  const sX = (ord: number) => 56 + (ord / spec.xmax) * (W - 76);
  const sY = (v: number) => sBottom - v * (sBottom - sTop - 16);
  const specPath = useMemo(() => {
    let d = "";
    for (let k = 1; k < spec.bins.length; k++) {
      const x = sX(k / REVS);
      d += `${k === 1 ? "M" : "L"}${x.toFixed(1)},${sY(spec.bins[k]).toFixed(1)} `;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const deg1 = (theta * 180) / Math.PI;
  const deg2 = 180 - 180 / z2 - (deg1 * z1) / z2;
  const ticks: number[] = [];
  const tickStep = spec.xmax > 60 ? 20 : spec.xmax > 30 ? 10 : 5;
  for (let o = 0; o <= spec.xmax; o += tickStep) ticks.push(o);

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {config.title ? <figcaption className="border-b border-line px-4 py-2.5 font-serif text-base text-ink">{config.title}</figcaption> : null}
      <div className="px-3 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="歯車のかみ合いと、かみ合い剛性、伝達誤差のスペクトル">
          {/* 上段：歯車 */}
          <text x={10} y={16} fontSize="11" fill="var(--mut)">
            ピニオン Z₁ = {z1}、歯車 Z₂ = {z2}、歯数比 {(z2 / z1).toFixed(2)}（模式）
          </text>
          <g transform={`translate(${geo.cx1},${geo.cy}) rotate(${deg1})`}>
            <path d={geo.p1} fill="var(--accent)" fillOpacity={0.14} stroke="var(--accent)" strokeWidth={1.4} strokeLinejoin="round" />
            <circle r={Math.max(4, geo.r1 * 0.18)} fill="#fff" stroke="var(--accent)" />
            <line x1={0} y1={0} x2={geo.r1 - 1.25 * geo.mod} y2={0} stroke={HEAVY} strokeWidth={2} />
          </g>
          <g transform={`translate(${geo.cx2},${geo.cy}) rotate(${deg2})`}>
            <path d={geo.p2} fill="var(--accent)" fillOpacity={0.1} stroke="var(--accent)" strokeWidth={1.4} strokeLinejoin="round" />
            <circle r={Math.max(4, geo.r2 * 0.14)} fill="#fff" stroke="var(--accent)" />
            <line x1={0} y1={0} x2={geo.r2 - 1.25 * geo.mod} y2={0} stroke={GOLD} strokeWidth={2} />
          </g>
          {/* ピッチ円 */}
          <circle cx={geo.cx1} cy={geo.cy} r={geo.r1} fill="none" stroke="var(--mut)" strokeDasharray="3 3" opacity={0.5} />
          <circle cx={geo.cx2} cy={geo.cy} r={geo.r2} fill="none" stroke="var(--mut)" strokeDasharray="3 3" opacity={0.5} />
          {/* かみ合い点 */}
          <circle cx={geo.cx1 + geo.r1} cy={geo.cy} r={4} fill={HEAVY} />
          <text x={geo.cx1 + geo.r1} y={geo.cy + geo.r1 + geo.mod + 16} fontSize="11" fill={HEAVY} textAnchor="middle">
            かみ合い点（1 回転に Z₁ 回、歯が入れ替わる）
          </text>

          {/* 中段：かみ合い剛性と伝達誤差 */}
          <text x={10} y={kTop + 4} fontSize="11" fill="var(--mut)">
            かみ合い剛性 k（紺）と、一定トルクで押したときのたわみ＝伝達誤差 TE ∝ 1/k（臙脂、見やすさのため縦に拡大）。横軸は歯 1 枚ぶん × 3
          </text>
          <line x1={kX(0)} y1={kBottom} x2={kX(3)} y2={kBottom} stroke="var(--line)" />
          {[0, 1, 2, 3].map((u) => (
            <g key={u}>
              <line x1={kX(u)} y1={kBottom} x2={kX(u)} y2={kBottom + 4} stroke="var(--mut)" />
              <text x={kX(u)} y={kBottom + 15} fontSize="10" fill="var(--mut)" textAnchor="middle">
                {u}
              </text>
            </g>
          ))}
          <path
            d={kCurve.map((p, i) => `${i === 0 ? "M" : "L"}${kX(p.u).toFixed(1)},${kY(p.k).toFixed(1)}`).join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
          <path
            d={kCurve.map((p, i) => `${i === 0 ? "M" : "L"}${kX(p.u).toFixed(1)},${kY(p.te * 1.6).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={HEAVY}
            strokeWidth={1.6}
            strokeDasharray="5 3"
          />
          <text x={kX(0) - 4} y={kY(1.8) + 4} fontSize="10" fill="var(--accent)" textAnchor="end">
            2 組
          </text>
          <text x={kX(0) - 4} y={kY(1.0) + 4} fontSize="10" fill="var(--accent)" textAnchor="end">
            1 組
          </text>
          <text x={kX(3)} y={kTop + 18} fontSize="10" fill="var(--mut)" textAnchor="end">
            2 組で接触する割合 = ε − 1 = {(eps - 1).toFixed(2)}
          </text>

          {/* 下段：スペクトル */}
          <text x={10} y={sTop - 6} fontSize="11" fill="var(--mut)">
            伝達誤差のスペクトル（ピニオン 32 回転ぶんを Hann 窓＋FFT、縦軸は条件によらず共通の尺度）。横軸＝ピニオンの次数
          </text>
          <line x1={sX(0)} y1={sBottom} x2={sX(spec.xmax)} y2={sBottom} stroke="var(--line)" />
          {ticks.map((o) => (
            <g key={o}>
              <line x1={sX(o)} y1={sBottom} x2={sX(o)} y2={sBottom + 4} stroke="var(--mut)" />
              <text x={sX(o)} y={sBottom + 15} fontSize="10" fill="var(--mut)" textAnchor="middle">
                {o}×
              </text>
            </g>
          ))}
          <path d={specPath} fill="none" stroke="var(--accent)" strokeWidth={1.2} />
          {/* 目印 */}
          <line x1={sX(z1)} y1={sTop + 2} x2={sX(z1)} y2={sBottom} stroke={GOLD} strokeDasharray="4 3" />
          <text x={sX(z1) + 4} y={sTop + 12} fontSize="10" fill={GOLD}>
            f_mesh = Z₁× = {z1}×
          </text>
          {2 * z1 <= spec.xmax ? (
            <>
              <line x1={sX(2 * z1)} y1={sTop + 2} x2={sX(2 * z1)} y2={sBottom} stroke={GOLD} strokeDasharray="4 3" opacity={0.7} />
              <text x={sX(2 * z1) + 4} y={sTop + 12} fontSize="10" fill={GOLD}>
                2 f_mesh
              </text>
            </>
          ) : null}
          {ep > 0.05 ? (
            <text x={sX(z1)} y={sBottom - 4} fontSize="10" fill={HEAVY} textAnchor="middle">
              ← ±1×（ピニオン 1 回転ごと）→
            </text>
          ) : null}
          {eg > 0.05 ? (
            <text x={sX(z1)} y={sTop + 26} fontSize="10" fill={HEAVY} textAnchor="middle">
              ±{spec.ratio.toFixed(2)}×（歯車 1 回転ごと）の側帯波
            </text>
          ) : null}
        </svg>
      </div>

      <div className="px-4 pb-3 pt-1 text-xs text-mut">
        かみ合い周波数 f_mesh = Z₁ × f_rot1 = Z₂ × f_rot2。歯車の回転はピニオンの {spec.ratio.toFixed(3)} 倍（{(z2 / z1).toFixed(2)} 分の 1）。
      </div>
      <div className="grid gap-x-6 gap-y-1 px-4 pb-2 sm:grid-cols-2">
        <Slider label="ピニオンの歯数 Z₁" value={z1} min={12} max={40} step={1} onChange={(v) => setZ1(Math.round(v))} />
        <Slider label="歯車の歯数 Z₂" value={z2} min={12} max={80} step={1} onChange={(v) => setZ2(Math.round(v))} />
        <Slider label="かみ合い率 ε（同時にかみ合う歯の平均組数）" value={eps} min={1} max={2} step={0.05} onChange={setEps} />
        <Slider label="ピニオンの偏心（相対）" value={ep} min={0} max={1} step={0.05} onChange={setEp} />
        <Slider label="歯車の偏心（相対）" value={eg} min={0} max={1} step={0.05} onChange={setEg} />
        <div className="flex items-center">
          <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        </div>
      </div>
      {config.caption ? <figcaption className="border-t border-line px-4 py-2.5 text-sm leading-relaxed text-mut">{config.caption}</figcaption> : null}
    </figure>
  );
}
