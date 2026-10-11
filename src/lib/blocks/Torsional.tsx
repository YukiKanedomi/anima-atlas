import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";

// ドメイン部品：2慣性ねじり振動系（モータ I₁ — ねじり剛性 kt の軸 — 負荷 I₂）。
// 曲げの振れ回り（横の揺れ）と違い、回転方向の「速度むら」＝ねじり振動を見せる。
// 軸は回さず（静止基準）、ねじれ角の振動だけをアニメ表示する。
//
// 無次元：I₁=1、I₂=ratio、軸のねじり剛性 kt。
//   自由振動の固有角振動数 ωn = √(kt·(1/I₁+1/I₂)) = √(kt(I₁+I₂)/(I₁I₂))。
//   モード形 θ₁/θ₂ = −I₂/I₁（互いに逆向きにねじれる）。
//   節（ねじれない断面）はモータ端から x/L = I₂/(I₁+I₂) ＝ 慣性の大きい側に寄る。
// ※ 値・形は式どおり。ねじれ角は見やすさのため誇張表示（模式）。

export type TorsionalConfig = {
  title?: string;
  caption?: string;
  ratioDefault?: number; // I₂/I₁
  ktDefault?: number;
};

const W = 660;
const H = 300;
const CY = 158; // 軸の中心線
const X1 = 150; // モータ円板の中心
const X2 = 512; // 負荷円板の中心
const R_SHAFT = 11;
const R_BASE = 46; // 慣性1のときの円板半径
const TH_MAX = 0.9; // ねじれ角の表示上限（rad・誇張）
const STRIPE_GAIN = 1.5; // 軸の基準線のねじれ誇張
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";

function diskRadius(inertia: number) {
  return R_BASE * Math.cbrt(inertia);
}

export default function Torsional({ config }: { config: TorsionalConfig }) {
  const [ratio, setRatio] = useState(config.ratioDefault ?? 1);
  const [kt, setKt] = useState(config.ktDefault ?? 1);
  const [running, setRunning] = useState(true);
  const [phase, setPhase] = useState(0);
  const raf = useRef<number>();
  const last = useRef<number>();

  // 固有角振動数（無次元・I₁=1）と節の位置（モータ端からの割合）
  const { wn, nodeFrac } = useMemo(() => {
    const I1 = 1;
    const I2 = ratio;
    return {
      wn: Math.sqrt(kt * (1 / I1 + 1 / I2)),
      nodeFrac: I2 / (I1 + I2),
    };
  }, [ratio, kt]);

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = (t - last.current) / 1000;
        // kt を上げる・負荷を軽くすると実際に速く震える（ωn 連動）
        setPhase((p) => (p + wn * 1.6 * dt) % (Math.PI * 2));
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, wn]);

  // モード形 θ₁/θ₂ = −I₂/I₁。大きい方の振幅が TH_MAX になるよう表示スケール
  const a1 = 1; // θ₁ の相対振幅
  const a2 = 1 / ratio; // θ₂ の相対振幅（逆向き）
  const scale = TH_MAX / Math.max(a1, a2);
  const th1 = scale * a1 * Math.cos(phase);
  const th2 = -scale * a2 * Math.cos(phase);

  const r1 = diskRadius(1);
  const r2 = diskRadius(ratio);
  const rx1 = r1 * 0.26; // 円板の見込み（軽い遠近）
  const rx2 = r2 * 0.26;

  // 軸のねじれ分布：θ(x) は θ₁→θ₂ の線形（一様軸）
  const thetaAt = (x: number) => th1 + (th2 - th1) * ((x - X1) / (X2 - X1));

  // 軸に沿った基準線（まっすぐな線が、ねじれで波打つ）
  const stripes = useMemo(() => [0.55, 1.35, Math.PI - 0.55, Math.PI + 0.9], []);
  const stripePath = (phi0: number) => {
    const N = 56;
    let d = "";
    for (let i = 0; i <= N; i++) {
      const x = X1 + ((X2 - X1) * i) / N;
      const y = CY - R_SHAFT * Math.cos(phi0 + STRIPE_GAIN * thetaAt(x));
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  };

  // 節（ねじれない断面）の位置
  const xNode = X1 + nodeFrac * (X2 - X1);

  // 円板の外周マーカー（基準線）：中心→外周。角度 θ で首を振る
  const DiskMarker = ({ cx, ry, rx, theta, color }: { cx: number; ry: number; rx: number; theta: number; color: string }) => {
    // 外周上の点（ねじれ角 θ だけ回った基準マーカー）。楕円の縁から離れない
    const mx = cx + rx * Math.sin(theta);
    const my = CY - ry * Math.cos(theta);
    return (
      <g>
        {/* 静止時の基準（真上・破線） */}
        <line x1={cx} y1={CY} x2={cx} y2={CY - ry} stroke="var(--line)" strokeDasharray="3 4" />
        <line x1={cx} y1={CY} x2={mx} y2={my} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <circle cx={mx} cy={my} r={4.5} fill={color} />
      </g>
    );
  };

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="2慣性ねじり振動：モータと負荷が軸をねじり合う">
        {/* 軸の中心線（静止基準） */}
        <line x1={70} y1={CY} x2={W - 70} y2={CY} stroke="var(--line)" strokeDasharray="4 5" />

        {/* 軸の外形（回っていない・ねじれだけ） */}
        <line x1={X1} y1={CY - R_SHAFT} x2={X2} y2={CY - R_SHAFT} stroke="var(--mut)" strokeWidth={1.2} opacity={0.55} />
        <line x1={X1} y1={CY + R_SHAFT} x2={X2} y2={CY + R_SHAFT} stroke="var(--mut)" strokeWidth={1.2} opacity={0.55} />

        {/* ねじれの分布：軸表面の基準線が波打つ（節では波打たない） */}
        {stripes.map((phi0, i) => (
          <path key={i} d={stripePath(phi0)} fill="none" stroke="var(--accent)" strokeWidth={1.3} opacity={0.5} />
        ))}

        {/* 節（ねじれない断面）＝金のマーカー */}
        <g>
          <line x1={xNode} y1={CY - R_SHAFT - 34} x2={xNode} y2={CY + R_SHAFT + 26} stroke={GOLD} strokeDasharray="2 4" opacity={0.7} />
          <circle cx={xNode} cy={CY} r={6} fill="#fff" stroke={GOLD} strokeWidth={2} />
          <text x={xNode} y={CY - R_SHAFT - 40} fontSize="11" fill={GOLD} textAnchor="middle">節（ここはねじれない）</text>
        </g>

        {/* モータ円板（左・紺） */}
        <ellipse cx={X1} cy={CY} rx={rx1} ry={r1} fill="var(--accent)" opacity={0.14} />
        <ellipse cx={X1} cy={CY} rx={rx1} ry={r1} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <DiskMarker cx={X1} ry={r1} rx={rx1} theta={th1} color="var(--accent-d)" />

        {/* 負荷円板（右・臙脂）：慣性スライダーで大きさが変わる */}
        <ellipse cx={X2} cy={CY} rx={rx2} ry={r2} fill={HEAVY} opacity={0.12} />
        <ellipse cx={X2} cy={CY} rx={rx2} ry={r2} fill="none" stroke={HEAVY} strokeWidth={2} />
        <DiskMarker cx={X2} ry={r2} rx={rx2} theta={th2} color={HEAVY} />

        {/* ラベル */}
        <text x={X1} y={26} fontSize="12" fill="var(--accent)" textAnchor="middle">モータ I₁</text>
        <text x={X2} y={26} fontSize="12" fill={HEAVY} textAnchor="middle">負荷 I₂</text>
        <text x={(X1 + X2) / 2} y={26} fontSize="11" fill="var(--mut)" textAnchor="middle">軸（ねじり剛性 kt）</text>
        <text x={(X1 + X2) / 2} y={H - 12} fontSize="11" fill="var(--mut)" textAnchor="middle">
          回転は止めて見ています——動くのは「ねじれ角」だけ（誇張表示）
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
        <span className="text-sm text-mut">2つの円板は、いつも互いに逆向きにねじれます</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="慣性比 I₂ / I₁" value={ratio} min={0.1} max={3} step={0.01} onChange={setRatio} />
        <Slider label="ねじり剛性 kt" value={kt} min={0.5} max={2} step={0.01} onChange={setKt} />
      </div>

      <div className="mt-3 tabular-nums text-sm text-mut">
        ねじり固有振動数 ωn = <b className="text-ink">{wn.toFixed(2)}</b>
        <span className="text-mut">（×√(kt₀/I₁)・無次元）</span> ／ 節の位置：モータ端から{" "}
        <b className="text-ink">{(nodeFrac * 100).toFixed(0)}%</b>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
