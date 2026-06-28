import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：自励振れ回りの不安定（クロスカップリング）。
// 軸受/シール/空力の「変位に直角な力」＝クロスカップリング剛性 q が、
// 減衰 c に打ち勝つと前向き振れ回りが発散する（自励不安定）。
//   m z̈ + c ż + (k − i q) z = 0    （z=x+iy）
//   ⇔ ẍ = −(k x + q y + c ẋ)/m,  ÿ = (q x − k y − c ẏ)/m
//   安定限界 q = c·ωn（k=m=1で q=c）。q<c 収束渦巻き／q>c 発散渦巻き。
//   不安定の振れ回りは「前向き・振動数≈ωn」。オイルホワール/シール/アルフォードの共通機構。
// ※ 運動方程式を実際に RK4 積分。形・しきい値は式どおりの模式。

export type WhirlInstabilityConfig = {
  title?: string;
  caption?: string;
  link?: string;
  qDefault?: number;
  cDefault?: number;
};

const SIZE = 320;
const CC = SIZE / 2;
const RDISP = 130;
const HEAVY = "#9b2d3a";

function deriv(s: number[], c: number, q: number) {
  const [x, vx, y, vy] = s;
  return [vx, -(x + q * y + c * vx), vy, q * x - y - c * vy]; // m=k=1
}
function rk4(s: number[], dt: number, c: number, q: number) {
  const k1 = deriv(s, c, q);
  const k2 = deriv(s.map((v, i) => v + (dt / 2) * k1[i]), c, q);
  const k3 = deriv(s.map((v, i) => v + (dt / 2) * k2[i]), c, q);
  const k4 = deriv(s.map((v, i) => v + dt * k3[i]), c, q);
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

export default function WhirlInstability({ config }: { config: WhirlInstabilityConfig }) {
  const instId = useInstanceId("wi");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    q: config.qDefault ?? 0.15,
    c: config.cDefault ?? 0.25,
  });
  const { q, c } = vals;
  const [running, setRunning] = useState(true);
  const [k, setK] = useState(0);
  const raf = useRef<number>();
  const last = useRef<number>();

  // 軌道を積分（q,c が変わったら作り直す）
  const { pts, scale, sigma, omega, unstable } = useMemo(() => {
    let s = [0.55, 0, 0, 0];
    const dt = 0.04;
    const r0 = 0.55;
    const pts: { x: number; y: number }[] = [{ x: s[0], y: s[2] }];
    let rmax = r0;
    for (let i = 0; i < 1600; i++) {
      s = rk4(s, dt, c, q);
      const r = Math.hypot(s[0], s[2]);
      pts.push({ x: s[0], y: s[2] });
      if (r > rmax) rmax = r;
      if (r > 6 * r0 || r < 0.01) break; // 発散しきった/収束しきったら止める
    }
    const scale = RDISP / rmax;
    // 線形固有値 λ=σ+iω：mλ²+cλ+(k−iq)=0、D=c²−4k+4qi の複素sqrt
    const Dre = c * c - 4, Dim = 4 * q;
    const Dmag = Math.hypot(Dre, Dim);
    const sq = Math.sqrt(Dmag);
    const half = Math.atan2(Dim, Dre) / 2;
    let sre = sq * Math.cos(half), sim = sq * Math.sin(half);
    if (sim < 0) { sre = -sre; sim = -sim; } // 前向き(ω>0)の根
    const sigma = (-c + sre) / 2;
    const omega = sim / 2;
    return { pts, scale, sigma, omega, unstable: sigma > 1e-4 };
  }, [q, c]);

  useEffect(() => {
    if (!running) { last.current = undefined; return; }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = (t - last.current) / 1000;
        setK((kk) => (kk + dt * 220) % pts.length); // 軌道上を走る点
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running, pts.length]);

  const col = unstable ? HEAVY : "var(--accent)";
  const sx = (x: number) => CC + x * scale;
  const sy = (y: number) => CC - y * scale;
  const head = pts[Math.min(Math.floor(k), pts.length - 1)] ?? pts[0];
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="自励振れ回りの軌道">
          <circle cx={CC} cy={CC} r={RDISP + 6} fill="var(--soft)" opacity={0.35} stroke="var(--line)" />
          <line x1={CC - RDISP - 6} y1={CC} x2={CC + RDISP + 6} y2={CC} stroke="var(--line)" />
          <line x1={CC} y1={CC - RDISP - 6} x2={CC} y2={CC + RDISP + 6} stroke="var(--line)" />
          <path d={path} fill="none" stroke={col} strokeWidth={1.6} opacity={0.7} />
          <line x1={CC} y1={CC} x2={sx(head.x)} y2={sy(head.y)} stroke={col} strokeWidth={1.2} opacity={0.5} />
          <circle cx={sx(head.x)} cy={sy(head.y)} r={5.5} fill={col} />
        </svg>

        <div>
          <div className={"inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold " + (unstable ? "bg-[#9b2d3a]/10 text-[#9b2d3a]" : "bg-accent/10 text-accent")}>
            {unstable ? "不安定：発散（自励振れ回り）" : "安定：収束"}
          </div>
          <div className="mt-2 tabular-nums text-sm text-mut">
            しきい値 <b className="text-ink">q = c</b>（×ωₙ）／ いま q={q.toFixed(2)}, c={c.toFixed(2)}
            <br />
            成長率 σ = <b className="text-ink">{sigma.toFixed(3)}</b>（{sigma > 0 ? "＞0 発散" : "＜0 減衰"}）／ 振れ回り <b className="text-ink">前向き</b>・振動数 ≈ <b className="text-ink">{omega.toFixed(2)}</b> ωₙ
          </div>

          <div className="mt-3 space-y-3">
            <Slider label="クロスカップリング q（変位に直角な力）" value={q} min={0} max={0.6} step={0.01} onChange={(v) => setParam("q", v)} />
            <Slider label="減衰 c" value={c} min={0} max={0.6} step={0.01} onChange={(v) => setParam("c", v)} />
          </div>

          <div className="mt-3">
            <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
          </div>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
