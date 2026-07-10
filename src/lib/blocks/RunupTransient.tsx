import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：危険速度の通過（昇速の過渡応答）。
// 無次元 Jeffcott の過渡：z̈ + 2ζ ż + z = r(t)² e^{iθ(t)}、θ̇ = r(t)、r(t) = α t（線形昇速）。
// RK4 で積分し、振れ回り半径 |z(t)| を「その瞬間の回転数 r(t)」を横軸に描く。
// 定常応答曲線（ゆっくり回した理想）をゴースト（破線）で重ねる。
//   ・α→小：ピーク→定常共振値 1/(2ζ) に接近し、位置→r=1（定常曲線をなぞる）
//   ・α大：ピークが低くなり、r=1 より後ろへずれる（共振が育つには時間がいる）
//   ・通過後：残留自由振動（ω≈ωn）と 1× の干渉でうなり（リンギング）、間隔 ≈ 2π/(r−1)
// ※ 検証値（ζ=0.05）：α=0.001 → 定常の 98.6% @ r=1.04 ／ α=0.02 → 67.3% @ r=1.26

export type RunupTransientConfig = {
  title?: string;
  caption?: string;
  link?: string;
  alphaDefault?: number;
  zetaDefault?: number;
};

const W = 560;
const H = 300;
const PL = 46; // 描画領域
const PR = 546;
const PT = 28;
const PB = 250;
const R_END = 2.5; // 横軸の右端（回転数比）
const RED = "#9b2d3a"; // 臙脂：危険速度マーカー
const GOLD = "#c08a2e"; // 金：ピーク点
// バッジの緑 #1f7a4f は Tailwind の任意値クラスで直書き（他ブロックの GREEN と同じ値）

// 定常応答（ゆっくり回した理想）：A(r) = r² / √((1−r²)² + (2ζr)²)
const steadyOf = (r: number, z: number) => (r * r) / Math.hypot(1 - r * r, 2 * z * r);

// 昇速過渡を RK4 で積分。状態 s = [x, vx, y, vy]、強制は r(t)² e^{iθ}、θ = α t²/2。
function integrate(alpha: number, zeta: number) {
  const tEnd = R_END / alpha;
  const N = 8000; // 固定ステップ数（α=0.001 でもピーク誤差 0.1% 未満を確認済み）
  const dt = tEnd / N;
  const deriv = (s: number[], t: number) => {
    const r = alpha * t;
    const th = 0.5 * alpha * t * t;
    const f = r * r;
    const [x, vx, y, vy] = s;
    return [vx, -2 * zeta * vx - x + f * Math.cos(th), vy, -2 * zeta * vy - y + f * Math.sin(th)];
  };
  let s = [0, 0, 0, 0];
  const pts: { r: number; a: number }[] = [{ r: 0, a: 0 }];
  const keep = 5; // 5ステップごとに記録（1600点）——うなりの波打ちも十分追える
  let peakA = 0;
  let peakR = 0;
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    const k1 = deriv(s, t);
    const k2 = deriv(s.map((v, j) => v + (dt / 2) * k1[j]), t + dt / 2);
    const k3 = deriv(s.map((v, j) => v + (dt / 2) * k2[j]), t + dt / 2);
    const k4 = deriv(s.map((v, j) => v + dt * k3[j]), t + dt);
    s = s.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    const a = Math.hypot(s[0], s[2]);
    if (a > peakA) {
      peakA = a;
      peakR = alpha * (t + dt);
    }
    if ((i + 1) % keep === 0) pts.push({ r: alpha * (t + dt), a });
  }
  return { pts, peakA, peakR };
}

export default function RunupTransient({ config }: { config: RunupTransientConfig }) {
  const instId = useInstanceId("rt");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    alpha: config.alphaDefault ?? 0.01,
    zeta: config.zetaDefault ?? 0.05,
  });
  const { alpha, zeta } = vals;

  // α・ζ が変わったときだけ再積分
  const { pts, peakA, peakR, steadyPeak, cap } = useMemo(() => {
    const { pts, peakA, peakR } = integrate(alpha, zeta);
    // 定常曲線の山の高さ（厳密値）：1/(2ζ√(1−ζ²))、位置 r = 1/√(1−2ζ²)
    const steadyPeak = 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta));
    const cap = Math.max(steadyPeak, peakA) * 1.08;
    return { pts, peakA, peakR, steadyPeak, cap };
  }, [alpha, zeta]);

  const sx = (r: number) => PL + (r / R_END) * (PR - PL);
  const sy = (a: number) => PB - (Math.min(a, cap) / cap) * (PB - PT);

  // 定常応答曲線（ゴースト・破線）
  const ghost = useMemo(() => {
    let d = "";
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const r = (R_END * i) / N;
      d += `${i === 0 ? "M" : "L"}${sx(r).toFixed(1)},${sy(steadyOf(r, zeta)).toFixed(1)}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeta, cap]);

  // 過渡の包絡線（実線）
  const path = useMemo(
    () => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.r).toFixed(1)},${sy(p.a).toFixed(1)}`).join(""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pts, cap]
  );

  const pct = (100 * peakA) / steadyPeak;
  const slow = pct >= 90;
  const speedWord = (v: number) => (v < 0.005 ? "ゆっくり" : v < 0.015 ? "中くらい" : "急いで");

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="昇速で危険速度を通過するときの振幅の履歴">
        {/* パネル地と軸 */}
        <rect x={PL} y={PT} width={PR - PL} height={PB - PT} fill="var(--soft)" opacity={0.35} />
        <line x1={PL} y1={PB} x2={PR} y2={PB} stroke="var(--line)" />
        <line x1={PL} y1={PT} x2={PL} y2={PB} stroke="var(--line)" />
        {[0.5, 1.5, 2, 2.5].map((r) => (
          <g key={r}>
            <line x1={sx(r)} y1={PB} x2={sx(r)} y2={PB + 4} stroke="var(--mut)" />
            <text x={sx(r)} y={PB + 16} fontSize="10.5" fill="var(--mut)" textAnchor="middle">
              {r.toFixed(1)}
            </text>
          </g>
        ))}
        {/* 危険速度 r=1（臙脂の破線） */}
        <line x1={sx(1)} y1={PT - 2} x2={sx(1)} y2={PB} stroke={RED} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        <text x={sx(1)} y={PT - 8} fontSize="11" fill={RED} textAnchor="middle">
          危険速度 r = 1
        </text>
        <text x={sx(1)} y={PB + 16} fontSize="10.5" fill={RED} textAnchor="middle">
          1.0
        </text>

        {/* 定常応答（ゴースト・破線） */}
        <path d={ghost} fill="none" stroke="var(--mut)" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.75} />
        {/* 昇速の過渡（紺の実線） */}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
        {/* ピーク点（金） */}
        <line x1={sx(peakR)} y1={sy(peakA)} x2={sx(peakR)} y2={PB} stroke={GOLD} strokeWidth={1} strokeDasharray="2 3" opacity={0.8} />
        <circle cx={sx(peakR)} cy={sy(peakA)} r={5} fill={GOLD} stroke="#fff" strokeWidth={1.5} />

        {/* 凡例 */}
        <g fontSize="11">
          <line x1={PL + 14} y1={PT + 14} x2={PL + 42} y2={PT + 14} stroke="var(--mut)" strokeWidth={1.6} strokeDasharray="5 4" />
          <text x={PL + 48} y={PT + 18} fill="var(--mut)">
            定常（ゆっくり回した理想）
          </text>
          <line x1={PL + 14} y1={PT + 32} x2={PL + 42} y2={PT + 32} stroke="var(--accent)" strokeWidth={2.2} />
          <text x={PL + 48} y={PT + 36} fill="var(--ink)">
            昇速の過渡（RK4）
          </text>
        </g>

        {/* 軸ラベル */}
        <text x={(PL + PR) / 2} y={H - 4} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          その瞬間の回転数 r(t) →
        </text>
        <text x={PL - 32} y={(PT + PB) / 2} fontSize="11.5" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 ${PL - 32} ${(PT + PB) / 2})`}>
          振れ回りの振幅
        </text>
      </svg>

      {/* 読み出し：バッジは長さが変わるので、スマホでは行を固定（折り返しの出入りを防ぐ） */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="tabular-nums text-mut">
          ピーク振幅 <b className="text-ink">{peakA.toFixed(2)}</b>（定常の <b className="text-ink">{pct.toFixed(0)}%</b>）／ 位置 r = <b className="text-ink">{peakR.toFixed(2)}</b>（+{(peakR - 1).toFixed(2)} 遅れ）
        </span>
        <span
          className={
            "w-full rounded-full px-2.5 py-0.5 font-semibold sm:w-auto " +
            (slow ? "bg-accent/10 text-accent" : "bg-[#1f7a4f]/10 text-[#1f7a4f]")
          }
        >
          {slow ? "ゆっくり＝定常の山をなぞる" : "駆け抜けた＝山が低く、遅れて現れる"}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <Slider
          label="昇速の速さ α（ゆっくり ↔ 急いで）"
          value={alpha}
          min={0.001}
          max={0.03}
          step={0.001}
          format={(v) => `${v.toFixed(3)}（${speedWord(v)}）`}
          onChange={(v) => setParam("alpha", v)}
        />
        <Slider
          label="減衰比 ζ"
          value={zeta}
          min={0.02}
          max={0.3}
          step={0.01}
          onChange={(v) => setParam("zeta", v)}
        />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
