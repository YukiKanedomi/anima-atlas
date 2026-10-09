import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：進行波（静止系の固定パターンが、回転系では走る波に見える）。
//   静止系：ノズル後流の強弱を周方向のパターン p(ψ) = cos(kψ) で表す（k 個の山＝励起次数）。
//   翼 j は θ_j = 2πj/N にあり、角速度 Ω で回る。翼 j が受ける力
//     F_j(t) = cos(k(θ_j + Ωt)) = cos(kΩt + 2πkj/N)
//   → 振動数は kΩ、隣の翼との位相差は 2πk/N（翼間位相角）。
//   回転系（翼に乗った視点）では同じパターンが −Ω で回る＝後ろ向き進行波。
// ※ パターンの形は cos 1 項の模式（実際の後流は高調波を含む。励起の次数分解は別節）。

export type TravelingWaveConfig = {
  title?: string;
  caption?: string;
  link?: string;
  kDefault?: number;
  bladesDefault?: number;
};

const W = 680;
const H = 470;
const LCX = 170;
const RCX = 510;
const CY = 150;
const R_B0 = 40;
const R_B1 = 76;
const R_P0 = 84;
const R_P1 = 120;
const WEDGES = 72;
const HEAVY = "#9b2d3a";
const WX0 = 56;
const WX1 = 650;
const WY = 385;
const WA = 44;

function wedgePath(cx: number, cy: number, a0: number, a1: number, r0: number, r1: number) {
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
}

export default function TravelingWave({ config }: { config: TravelingWaveConfig }) {
  const instId = useInstanceId("traveling-wave");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    k: config.kDefault ?? 4,
    N: config.bladesDefault ?? 12,
    speed: 0.5,
  });
  const k = Math.round(vals.k);
  const N = Math.round(vals.N);
  const speed = vals.speed;
  const [running, setRunning] = useState(true);
  const [phi, setPhi] = useState(0.3); // 回転角 Ωt
  const raf = useRef<number>();
  const last = useRef<number>();
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (now: number) => {
      if (last.current !== undefined) {
        const dt = (now - last.current) / 1000;
        setPhi((v) => (v + 2 * Math.PI * speedRef.current * dt) % (Math.PI * 2));
      }
      last.current = now;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  // パターンのくさび（静止系：固定 / 回転系：−φ だけ回す）
  const wedges = useMemo(() => {
    const out: { d: string; v: number }[] = [];
    for (let i = 0; i < WEDGES; i++) {
      const a0 = (2 * Math.PI * i) / WEDGES;
      const a1 = (2 * Math.PI * (i + 1)) / WEDGES;
      const am = (a0 + a1) / 2;
      out.push({ d: wedgePath(LCX, CY, a0, a1, R_P0, R_P1), v: (1 + Math.cos(k * am)) / 2 });
    }
    return out;
  }, [k]);
  const wedgesRot = useMemo(() => {
    const out: { d: string; v: number }[] = [];
    for (let i = 0; i < WEDGES; i++) {
      const a0 = (2 * Math.PI * i) / WEDGES;
      const a1 = (2 * Math.PI * (i + 1)) / WEDGES;
      const am = (a0 + a1) / 2;
      // 回転系の角 ψ' は静止系の ψ = ψ' + φ に対応
      out.push({ d: wedgePath(RCX, CY, a0, a1, R_P0, R_P1), v: (1 + Math.cos(k * (am + phi))) / 2 });
    }
    return out;
  }, [k, phi]);

  // 波形（1回転ぶん）
  const sx = (u: number) => WX0 + u * (WX1 - WX0);
  const sy = (v: number) => WY - v * WA;
  const curve = (j: number) =>
    Array.from({ length: 241 }, (_, i) => {
      const u = i / 240;
      const v = Math.cos(k * 2 * Math.PI * u + (2 * Math.PI * k * j) / N);
      return `${i === 0 ? "M" : "L"}${sx(u).toFixed(1)},${sy(v).toFixed(1)}`;
    }).join(" ");
  const curve0 = useMemo(() => curve(0), [k, N]);
  const curve1 = useMemo(() => curve(1), [k, N]);
  const u = phi / (2 * Math.PI);
  const f0 = Math.cos(k * phi);
  const f1 = Math.cos(k * phi + (2 * Math.PI * k) / N);
  const ibpaDeg = (360 * k) / N;

  const blade = (cx: number, th: number, j: number) => {
    const col = j === 0 ? "var(--accent)" : j === 1 ? HEAVY : "var(--mut)";
    const sw = j <= 1 ? 3.2 : 1.6;
    return (
      <line
        key={j}
        x1={cx + R_B0 * Math.cos(th)}
        y1={CY + R_B0 * Math.sin(th)}
        x2={cx + R_B1 * Math.cos(th)}
        y2={CY + R_B1 * Math.sin(th)}
        stroke={col}
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={j <= 1 ? 1 : 0.6}
      />
    );
  };

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="静止系と回転系で見た励起パターン">
        {/* 左：静止系 */}
        <text x={LCX} y={16} fontSize="12" fill="var(--ink)" textAnchor="middle">
          静止系（ノズルの側から見る）
        </text>
        {wedges.map((w, i) => (
          <path key={i} d={w.d} fill="var(--accent)" opacity={0.08 + 0.72 * w.v} stroke="none" />
        ))}
        <circle cx={LCX} cy={CY} r={R_B0 - 6} fill="var(--soft)" stroke="var(--line)" />
        {Array.from({ length: N }, (_, j) => blade(LCX, (2 * Math.PI * j) / N + phi, j))}
        <text x={LCX} y={CY + R_P1 + 22} fontSize="11" fill="var(--mut)" textAnchor="middle">
          パターンは止まり、翼が Ω で回る
        </text>

        {/* 右：回転系 */}
        <text x={RCX} y={16} fontSize="12" fill="var(--ink)" textAnchor="middle">
          回転系（翼に乗って見る）
        </text>
        {wedgesRot.map((w, i) => (
          <path key={i} d={w.d} fill="var(--accent)" opacity={0.08 + 0.72 * w.v} stroke="none" />
        ))}
        <circle cx={RCX} cy={CY} r={R_B0 - 6} fill="var(--soft)" stroke="var(--line)" />
        {Array.from({ length: N }, (_, j) => blade(RCX, (2 * Math.PI * j) / N, j))}
        <text x={RCX} y={CY + R_P1 + 22} fontSize="11" fill="var(--mut)" textAnchor="middle">
          翼は止まり、パターンが −Ω で回る＝後ろ向き進行波
        </text>

        {/* 凡例 */}
        <text x={W / 2} y={CY + R_P1 + 44} fontSize="11" fill="var(--mut)" textAnchor="middle">
          濃い所＝後流で力が強い（k 個の山）　紺＝翼0　臙脂＝翼1
        </text>

        {/* 下：翼0・翼1が受ける力の波形（1回転ぶん） */}
        <rect x={WX0} y={WY - WA - 10} width={WX1 - WX0} height={2 * WA + 20} fill="var(--soft)" opacity={0.35} />
        <line x1={WX0} y1={WY} x2={WX1} y2={WY} stroke="var(--line)" />
        <path d={curve0} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
        <path d={curve1} fill="none" stroke={HEAVY} strokeWidth={2.2} opacity={0.9} />
        <line x1={sx(u)} y1={WY - WA - 10} x2={sx(u)} y2={WY + WA + 10} stroke="var(--accent-d)" strokeWidth={1.2} opacity={0.6} />
        <circle cx={sx(u)} cy={sy(f0)} r={5} fill="var(--accent-d)" />
        <circle cx={sx(u)} cy={sy(f1)} r={5} fill={HEAVY} />
        <text x={WX0} y={WY - WA - 16} fontSize="11" fill="var(--mut)">
          翼が受ける力（横軸＝1回転）
        </text>
        <text x={WX1} y={WY - WA - 16} fontSize="11" fill="var(--mut)" textAnchor="end">
          山の数 = k = {k}
        </text>
        <text x={WX0} y={WY + WA + 24} fontSize="10" fill="var(--mut)">
          0
        </text>
        <text x={WX1} y={WY + WA + 24} fontSize="10" fill="var(--mut)" textAnchor="end">
          1回転
        </text>
      </svg>

      <div className="mt-2 min-h-[3rem] text-sm leading-6 text-mut">
        1回転で <b className="text-ink">{k}</b> 回叩かれる → 励起振動数は <b className="text-ink">k × 回転数</b>。翼1は翼0より位相
        <b className="text-ink"> 2π·{k}/{N} = {ibpaDeg.toFixed(1)}°</b> 先に叩かれます（翼間位相角）。
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Slider label="励起次数 k（山の数）" value={k} min={1} max={12} step={1} onChange={(v) => setParam("k", v)} />
        <Slider label="翼の枚数 N" value={N} min={6} max={36} step={1} onChange={(v) => setParam("N", v)} />
        <Slider
          label="回転の速さ（アニメ）"
          value={speed}
          min={0.1}
          max={1.5}
          step={0.05}
          format={(v) => `${v.toFixed(2)} 回転/秒`}
          onChange={(v) => setParam("speed", v)}
        />
      </div>
      <div className="mt-3">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
