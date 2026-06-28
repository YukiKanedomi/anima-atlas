import { useEffect, useMemo, useRef, useState } from "react";
import { PlayPause } from "../../components/PlayPause";

// ドメイン部品：曲げモード形状（連続体の軸）。
// 軸（はり）は離散的な複数の曲げモードを持ち、各モードに固有の危険速度がある。
//   単純支持(pinned-pinned)：ψ_n(ξ)=sin(nπξ)、βL=nπ、振動数比 = n²（1:4:9）。
//   自由-自由(free-free)   ：cosh βL·cos βL=1 → βL≈4.730,7.853,10.996。
//     ψ_n(ξ)=cosh(βLξ)+cos(βLξ) − σ(sinh(βLξ)+sin(βLξ))、σ=(coshβL−cosβL)/(sinhβL−sinβL)。
//     振動数比 ≈ 1:2.76:5.40。
//   n次モードは内部に (n−1) 個の節（動かない点）を持つ。
// ※ 形・節・振動数比は式どおりの「模式」。自由端付近は丸めた βL による微小誤差あり。

export type ModeShapeConfig = {
  title?: string;
  caption?: string;
  maxMode?: number; // 1..3
  boundaryDefault?: "pinned" | "free";
};

const W = 660;
const H = 300;
const PADX = 56;
const CY = 150;
const AMP = 78;
const FREE_BL = [4.73004074, 7.85320462, 10.9956078];

function betaL(boundary: "pinned" | "free", n: number) {
  return boundary === "free" ? FREE_BL[n - 1] : n * Math.PI;
}

function rawShape(boundary: "pinned" | "free", n: number, xi: number) {
  if (boundary === "pinned") return Math.sin(n * Math.PI * xi);
  const bL = FREE_BL[n - 1];
  const sigma = (Math.cosh(bL) - Math.cos(bL)) / (Math.sinh(bL) - Math.sin(bL));
  return Math.cosh(bL * xi) + Math.cos(bL * xi) - sigma * (Math.sinh(bL * xi) + Math.sin(bL * xi));
}

export default function ModeShape({ config }: { config: ModeShapeConfig }) {
  const maxMode = Math.min(3, Math.max(1, config.maxMode ?? 3));
  const [mode, setMode] = useState(1);
  const [boundary, setBoundary] = useState<"pinned" | "free">(config.boundaryDefault ?? "pinned");
  const [running, setRunning] = useState(true);
  const [theta, setTheta] = useState(Math.PI / 2);
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
        setTheta((th) => (th + 2.4 * dt) % (Math.PI * 2));
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  // 形状サンプル・節・振動数比（モード/支持が変わったとき計算）
  const { samples, nodes, ratio } = useMemo(() => {
    const N = 160;
    const raw: number[] = [];
    let maxAbs = 1e-9;
    for (let i = 0; i <= N; i++) {
      const v = rawShape(boundary, mode, i / N);
      raw.push(v);
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
    const samples = raw.map((v, i) => ({ xi: i / N, psi: v / maxAbs }));
    // 内部の節（符号反転点）
    const nodes: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      if (samples[i - 1].psi * samples[i].psi < 0) {
        const t = samples[i - 1].psi / (samples[i - 1].psi - samples[i].psi);
        nodes.push(samples[i - 1].xi + t * (1 / N));
      }
    }
    const ratio = (betaL(boundary, mode) / betaL(boundary, 1)) ** 2;
    return { samples, nodes, ratio };
  }, [mode, boundary]);

  const sx = (xi: number) => PADX + xi * (W - 2 * PADX);
  const sy = (psi: number, phase: number) => CY - AMP * psi * Math.sin(phase);

  const beamD = samples.map((s, i) => `${i === 0 ? "M" : "L"}${sx(s.xi).toFixed(1)},${sy(s.psi, theta).toFixed(1)}`).join(" ");
  const envUp = samples.map((s, i) => `${i === 0 ? "M" : "L"}${sx(s.xi).toFixed(1)},${(CY - AMP * s.psi).toFixed(1)}`).join(" ");
  const envDn = samples.map((s, i) => `${i === 0 ? "M" : "L"}${sx(s.xi).toFixed(1)},${(CY + AMP * s.psi).toFixed(1)}`).join(" ");

  const Support = ({ xi }: { xi: number }) => (
    <g>
      <path d={`M${sx(xi) - 9},${CY + 13} L${sx(xi) + 9},${CY + 13} L${sx(xi)},${CY + 1} Z`} fill="none" stroke="var(--mut)" strokeWidth={1.4} />
      <line x1={sx(xi) - 12} y1={CY + 16} x2={sx(xi) + 12} y2={CY + 16} stroke="var(--mut)" strokeWidth={1.4} />
    </g>
  );

  const PillBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-sm transition-colors " +
        (active ? "border-accent bg-accent text-white" : "border-line text-mut hover:border-accent hover:text-accent")
      }
    >
      {children}
    </button>
  );

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="曲げモード形状">
        {/* 軸の静止位置 */}
        <line x1={sx(0)} y1={CY} x2={sx(1)} y2={CY} stroke="var(--line)" strokeDasharray="4 5" />

        {/* 振動の包絡線（±ψ） */}
        <path d={envUp} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.3} />
        <path d={envDn} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.3} />

        {/* 節（動かない点） */}
        {nodes.map((xi, i) => (
          <g key={i}>
            <line x1={sx(xi)} y1={CY - AMP - 6} x2={sx(xi)} y2={CY + AMP + 6} stroke="var(--mut)" strokeDasharray="2 4" opacity={0.5} />
            <circle cx={sx(xi)} cy={CY} r={4.5} fill="#fff" stroke="#9b2d3a" strokeWidth={1.8} />
          </g>
        ))}

        {/* しなる軸 */}
        <path d={beamD} fill="none" stroke="var(--accent)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />

        {/* 支持（単純支持のみ図示） */}
        {boundary === "pinned" ? (
          <>
            <Support xi={0} />
            <Support xi={1} />
          </>
        ) : (
          <>
            <text x={sx(0)} y={CY + 22} fontSize="11" fill="var(--mut)" textAnchor="middle">自由端</text>
            <text x={sx(1)} y={CY + 22} fontSize="11" fill="var(--mut)" textAnchor="middle">自由端</text>
          </>
        )}

        {/* 端の点 */}
        <circle cx={sx(0)} cy={sy(samples[0].psi, theta)} r={3.5} fill="var(--accent-d)" />
        <circle cx={sx(1)} cy={sy(samples[samples.length - 1].psi, theta)} r={3.5} fill="var(--accent-d)" />

        <text x={sx(0)} y={26} fontSize="12" fill="var(--mut)">軸（はり）</text>
        <text x={sx(1)} y={26} fontSize="12" fill="var(--mut)" textAnchor="end">{mode}次モード</text>
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-mut">モード</span>
          {Array.from({ length: maxMode }, (_, i) => i + 1).map((n) => (
            <PillBtn key={n} active={mode === n} onClick={() => setMode(n)}>{n}次</PillBtn>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-mut">支持</span>
          <PillBtn active={boundary === "pinned"} onClick={() => setBoundary("pinned")}>単純支持</PillBtn>
          <PillBtn active={boundary === "free"} onClick={() => setBoundary("free")}>自由-自由</PillBtn>
        </div>
        <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
      </div>

      <div className="mt-3 tabular-nums text-sm text-mut">
        節（動かない点）<b className="text-ink">{nodes.length}</b> 個 ／ この形の危険速度 ≈ 1次の <b className="text-ink">{ratio.toFixed(ratio < 10 ? 2 : 1)}</b> 倍
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
