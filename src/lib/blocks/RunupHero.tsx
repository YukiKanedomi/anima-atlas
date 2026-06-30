import { useEffect, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";

// ドメイン部品：序章の「顔」。回転数を上げ下げすると、ロータの振れ回りが
// 危険速度（固有振動数との共振）で大きく膨らみ、通過するとしぼむ——本書の主題を一発体感。
//   振幅 A(r) = r² / √((1−r²)² + (2ζr)²)、r = Ω/ωn。r=1（危険速度）で最大 1/(2ζ)。
//   位相 φ = atan2(2ζr, 1−r²)：r>1 で重い点が内側へ回り込む（自動調心）。
// ※ Jeffcott の不釣り合い応答そのもの。式どおりに描画。

export type RunupHeroConfig = {
  title?: string;
  caption?: string;
  zeta?: number;
  rMax?: number;
};

const W = 560;
const H = 264;
const OX = 132; // 軌道パネルの中心
const OY = 132;
const RH = 96; // 軸受ハウジング半径
const CL = 308; // 共振曲線パネル左
const CR = 540; // 右
const CT = 40; // 上
const CB = 212; // 下
const HEAVY = "#c08a2e";
const RED = "#9b2d3a";

const respOf = (r: number, z: number) => (r * r) / Math.hypot(1 - r * r, 2 * z * r);

export default function RunupHero({ config }: { config: RunupHeroConfig }) {
  const zeta = config.zeta ?? 0.08;
  const rMax = config.rMax ?? 2.6;
  const peak = 1 / (2 * zeta); // 危険速度での振幅
  const cap = peak * 1.05;

  const [running, setRunning] = useState(true);
  const rRef = useRef(0.2);
  const dirRef = useRef(1);
  const thetaRef = useRef(0);
  const raf = useRef<number>();
  const last = useRef<number>();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = Math.min(0.05, (t - last.current) / 1000);
        let nr = rRef.current + dirRef.current * dt * 0.3; // 昇速・降速をゆっくり往復
        if (nr >= rMax) {
          nr = rMax;
          dirRef.current = -1;
        }
        if (nr <= 0.15) {
          nr = 0.15;
          dirRef.current = 1;
        }
        rRef.current = nr;
        thetaRef.current += dt * (1.6 + nr * 5); // 高回転ほど速く回る
        setTick((x) => (x + 1) % 1000000);
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, rMax]);

  const r = rRef.current;
  const A = respOf(r, zeta);
  const theta = thetaRef.current;
  const phi = Math.atan2(2 * zeta * r, 1 - r * r);
  const scale = (RH - 16) / peak;
  const dispR = Math.min(A * scale, RH - 14);
  const crit = Math.abs(r - 1) < 0.1;
  const col = crit ? RED : "var(--accent)";

  // 軸中心（振れ回り）と重い点（自動調心で内へ回り込む）
  const cx = OX + dispR * Math.cos(theta);
  const cy = OY + dispR * Math.sin(theta);
  const rd = 17; // 円板半径
  const E = rd * 0.78;
  const hx = cx + E * Math.cos(theta - phi);
  const hy = cy + E * Math.sin(theta - phi);

  // 共振曲線
  const sxR = (rr: number) => CL + (rr / rMax) * (CR - CL);
  const syA = (a: number) => CB - (Math.min(a, cap) / cap) * (CB - CT);
  const curve = (() => {
    let d = "";
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const rr = (rMax * i) / N;
      d += `${i === 0 ? "M" : "L"}${sxR(rr).toFixed(1)},${syA(respOf(rr, zeta)).toFixed(1)}`;
    }
    return d;
  })();

  const status = crit ? "危険速度を通過！" : r < 0.9 ? "昇速中——まだ静か" : dirRef.current < 0 && r < 1 ? "降りてきた" : "通過——揺れが収まる";

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="昇速で危険速度を通過する振れ回り">
        {/* 左：上から見たロータ */}
        <circle cx={OX} cy={OY} r={RH} fill="var(--soft)" opacity={0.5} stroke="var(--line)" />
        <circle cx={OX} cy={OY} r={dispR} fill="none" stroke={col} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.5} />
        <line x1={OX} y1={OY} x2={cx} y2={cy} stroke={col} strokeWidth={1} opacity={0.4} />
        <circle cx={OX} cy={OY} r={2.5} fill="var(--mut)" />
        {/* 円板＋重い点 */}
        <circle cx={cx} cy={cy} r={rd} fill="#fff" stroke={col} strokeWidth={2} />
        <circle cx={hx} cy={hy} r={5} fill={HEAVY} stroke="#fff" strokeWidth={1} />
        <text x={OX} y={OY + RH + 18} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          上から見たロータ（金の点＝重い箇所）
        </text>

        {/* 右：共振の山 */}
        <line x1={CL} y1={CB} x2={CR} y2={CB} stroke="var(--line)" />
        <line x1={sxR(1)} y1={CT - 4} x2={sxR(1)} y2={CB} stroke={RED} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        <text x={sxR(1)} y={CT - 8} fontSize="11" fill={RED} textAnchor="middle">
          危険速度
        </text>
        <path d={curve} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.85} />
        {/* 現在位置 */}
        <circle cx={sxR(r)} cy={syA(A)} r={5} fill={col} />
        <line x1={sxR(r)} y1={CB} x2={sxR(r)} y2={CB + 5} stroke="var(--ink)" />
        <text x={CL} y={CB + 18} fontSize="11" fill="var(--mut)">
          ← おそい
        </text>
        <text x={CR} y={CB + 18} fontSize="11" fill="var(--mut)" textAnchor="end">
          速い →
        </text>
        <text x={(CL + CR) / 2} y={CB + 18} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          回転数 →
        </text>
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-mut">
          回転数 <b className="tabular-nums text-ink">{r.toFixed(2)}</b>（危険速度＝1.00）
        </span>
        <span className={"font-semibold " + (crit ? "text-[#9b2d3a]" : "text-accent")}>{status}</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
        <div className="flex-1">
          <Slider
            label="回転数（再生を止めると手で動かせます）"
            value={r}
            min={0.15}
            max={rMax}
            step={0.01}
            onChange={(v) => {
              rRef.current = v;
              setTick((x) => (x + 1) % 1000000);
            }}
          />
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
