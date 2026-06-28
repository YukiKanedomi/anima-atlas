import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";

// ドメイン部品：両端軟支持の剛体ロータ（2自由度）。
// 曲がらない剛体が、両端の柔らかいバネ（軸受）の上で「並進」と「傾き」の
// 2モード＝2つの危険速度を持つ。支持が非対称だと2モードが連成する。
// 連続体の曲げモード(mode-shape)の"手前"にある剛体モード。
//
// 無次元：m=1, 半長 c=1, 左バネ k1=1, 右バネ k2=asym, 慣性 I=ρ。
//   並進 y と 傾き θ（CGまわり）。支持の上下変位 = y ± c·θ。
//   M=diag(m,I)、K=[[k1+k2, c(k2−k1)],[c(k2−k1), c²(k1+k2)]]。
//   固有値問題 M⁻¹K v=ω²v → 2つの ω と モード形（y,θ）。
//   対称(k1=k2)なら結合項=0 → 並進モードと傾きモードが純粋に分離。
// ※ 非回転の支持モード（ジャイロ連成は Campbell の話）。値・形は式どおりの模式。

export type RigidRotor2DOFConfig = {
  title?: string;
  caption?: string;
  asymDefault?: number;
  rhoDefault?: number;
};

const W = 660;
const H = 320;
const CX = 330;
const CY = 146;
const CPX = 210;
const GROUND = 274;
const AMP = 66;

function solve(asym: number, rho: number) {
  const k1 = 1, k2 = asym, c = 1, m = 1, Id = rho;
  const K11 = k1 + k2;
  const Kc = c * (k2 - k1);
  const K22 = c * c * (k1 + k2);
  const a00 = K11 / m, a01 = Kc / m, a10 = Kc / Id, a11 = K22 / Id;
  const tr = a00 + a11;
  const det = a00 * a11 - a01 * a10;
  const disc = Math.sqrt(Math.max(0, tr * tr - 4 * det));
  const lams = [(tr - disc) / 2, (tr + disc) / 2];
  const vecs = lams.map((lam, idx) => {
    let v0: number, v1: number;
    if (Math.abs(a01) > 1e-9) {
      v0 = a01;
      v1 = lam - a00;
    } else if (Math.abs(a00 - a11) < 1e-9) {
      // 対称かつ縮退：規約で ①並進 ②傾き に割り当て
      v0 = idx === 0 ? 1 : 0;
      v1 = idx === 0 ? 0 : 1;
    } else {
      // 対称：純粋モード（並進 or 傾き）
      const trans = Math.abs(lam - a00) < Math.abs(lam - a11);
      v0 = trans ? 1 : 0;
      v1 = trans ? 0 : 1;
    }
    // y成分を正に正規化（符号の見やすさ）
    if (v0 < 0 || (v0 === 0 && v1 < 0)) {
      v0 = -v0;
      v1 = -v1;
    }
    return { vy: v0, vth: v1 };
  });
  return { omega: lams.map((l) => Math.sqrt(Math.max(0, l))), vecs, c };
}

export default function RigidRotor2DOF({ config }: { config: RigidRotor2DOFConfig }) {
  const [mode, setMode] = useState(1);
  const [asym, setAsym] = useState(config.asymDefault ?? 1);
  const [rho, setRho] = useState(config.rhoDefault ?? 0.4);
  const [running, setRunning] = useState(true);
  const [phase, setPhase] = useState(Math.PI / 2);
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
        setPhase((p) => (p + 2.2 * dt) % (Math.PI * 2));
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  const { omega, vecs, c } = useMemo(() => solve(asym, rho), [asym, rho]);
  const { vy, vth } = vecs[mode - 1];

  // 表示スケール（両端とCGの最大変位を AMP に合わせる）
  const dL = vy - c * vth, dR = vy + c * vth;
  const maxd = Math.max(Math.abs(vy), Math.abs(dL), Math.abs(dR), 1e-9);
  const scale = AMP / maxd;
  const disp = (x: number) => scale * (vy + x * vth) * Math.sin(phase); // px（上が正）

  const xOf = (x: number) => CX + x * CPX;
  const yOf = (x: number) => CY - disp(x);

  // 節（変位ゼロの点）：x_node = −vy/vth
  const xNode = Math.abs(vth) > 1e-6 ? -vy / vth : null;
  const showNode = xNode !== null && Math.abs(xNode) <= 1.25;

  // モードの性格
  const tiltShare = Math.abs(c * vth) / (Math.abs(vy) + Math.abs(c * vth) + 1e-9);
  const character = tiltShare < 0.22 ? "並進（円筒）モード" : tiltShare > 0.78 ? "傾き（円錐）モード" : "連成モード";

  // 縦ばねのジグザグ
  const coil = (xc: number, yTop: number) => {
    const coils = 5;
    const wdt = 7;
    const span = GROUND - yTop;
    let d = `M${xc},${GROUND}`;
    const seg = span / (coils * 2);
    for (let i = 1; i <= coils * 2; i++) {
      const yy = GROUND - i * seg;
      const xx = xc + (i % 2 === 1 ? wdt : -wdt);
      d += ` L${i === coils * 2 ? xc : xx},${yy.toFixed(1)}`;
    }
    return d;
  };

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

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="剛体ロータの2自由度モード">
        {/* 地面 */}
        <line x1={40} y1={GROUND} x2={W - 40} y2={GROUND} stroke="var(--line)" />
        {Array.from({ length: 14 }, (_, i) => 50 + i * 42).map((x) => (
          <line key={x} x1={x} y1={GROUND} x2={x - 8} y2={GROUND + 8} stroke="var(--line)" />
        ))}

        {/* 静止位置の目安 */}
        <line x1={xOf(-1)} y1={CY} x2={xOf(1)} y2={CY} stroke="var(--line)" strokeDasharray="4 5" />

        {/* バネ（左右の軸受） */}
        <path d={coil(xOf(-1), yOf(-1))} fill="none" stroke="var(--mut)" strokeWidth={1.6} />
        <path d={coil(xOf(1), yOf(1))} fill="none" stroke="var(--mut)" strokeWidth={1.6} />

        {/* 節（動かない点） */}
        {showNode ? (
          <g>
            <line x1={xOf(xNode!)} y1={CY - AMP - 8} x2={xOf(xNode!)} y2={GROUND} stroke="var(--mut)" strokeDasharray="2 4" opacity={0.5} />
            <circle cx={xOf(xNode!)} cy={CY - disp(xNode!)} r={4.5} fill="#fff" stroke="#9b2d3a" strokeWidth={1.8} />
            <text x={xOf(xNode!)} y={CY - AMP - 12} fontSize="10" fill="#9b2d3a" textAnchor="middle">節</text>
          </g>
        ) : null}

        {/* 剛体ロータ（太いバー＋中央の円板） */}
        <line x1={xOf(-1)} y1={yOf(-1)} x2={xOf(1)} y2={yOf(1)} stroke="var(--accent)" strokeWidth={7} strokeLinecap="round" />
        <circle cx={xOf(0)} cy={yOf(0)} r={15} fill="var(--accent)" opacity={0.18} stroke="var(--accent)" strokeWidth={1.5} />
        {/* 支持点 */}
        <circle cx={xOf(-1)} cy={yOf(-1)} r={4} fill="var(--accent-d)" />
        <circle cx={xOf(1)} cy={yOf(1)} r={4} fill="var(--accent-d)" />

        <text x={xOf(-1)} y={28} fontSize="12" fill="var(--mut)">軸受 k₁</text>
        <text x={xOf(1)} y={28} fontSize="12" fill="var(--mut)" textAnchor="end">軸受 k₂</text>
        <text x={CX} y={28} fontSize="12" fill="var(--mut)" textAnchor="middle">剛体ロータ</text>
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-mut">モード</span>
          <PillBtn active={mode === 1} onClick={() => setMode(1)}>1次</PillBtn>
          <PillBtn active={mode === 2} onClick={() => setMode(2)}>2次</PillBtn>
        </div>
        <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="支持の非対称 k₂ / k₁" value={asym} min={0.3} max={3} step={0.01} onChange={setAsym} />
        <Slider label="ロータの慣性 I /(m c²)" value={rho} min={0.1} max={1.5} step={0.01} onChange={setRho} />
      </div>

      <div className="mt-3 tabular-nums text-sm text-mut">
        危険速度 ①<b className="text-ink">{omega[0].toFixed(2)}</b> ／ ②<b className="text-ink">{omega[1].toFixed(2)}</b>
        <span className="text-mut">（×√(k₁/m)）</span> ／ いまの{mode}次は <b className="text-ink">{character}</b>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
