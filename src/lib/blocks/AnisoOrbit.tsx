import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：支持異方性（kx≠ky）を持つ Jeffcott ロータの不釣り合い応答。
// 無次元化：ωx = 1（x方向の危険速度）、ωy = √(ky/kx)。各方向は独立の1自由度で
//   x(t) = Ax cos(Ωt−φx),  y(t) = Ay sin(Ωt−φy)
//   A(ω,Ω) = Ω² / √((ω²−Ω²)² + (2ζωΩ)²),  φ = atan2(2ζωΩ, ω²−Ω²)
// F/B分解（z = x+iy = F e^{iθ} + B e^{−iθ}, θ=Ωt）：
//   F = (Ax e^{−iφx} + Ay e^{−iφy})/2,  B = (Ax e^{+iφx} − Ay e^{+iφy})/2
// 等方（ky/kx=1）では B=0 の真円。異方では楕円になり、2つの危険速度の間に
// |B|>|F| の帯ができて振れ回りが後ろ向きに反転する（検証済み：ζ=0.08,
// ky/kx=1.5 で帯は Ω=1.040〜1.178、面積法の回転向きと一致）。
// ※ 形・向き・曲線は式どおり。寸法は見やすさのためのスケール（模式）。

export type AnisoOrbitConfig = {
  title?: string;
  caption?: string;
  zeta?: number; // 減衰比（既定 0.08）
  kDefault?: number; // 異方性 ky/kx の初期値
  omegaDefault?: number; // 回転数 Ω の初期値
  link?: string; // 連動グループ名（k・Om を他ブロックと共有）
};

const HEAVY = "#9b2d3a"; // 臙脂（後ろ向き・第2曲線）

// --- 左：軌道パネル ---
const OSIZE = 340;
const OC = OSIZE / 2;
const HOUSING = 140;
const R_CAP = 110; // 表示半径の上限(px)
const R_FLOOR = 36; // 表示半径の下限(px)（形が読める最小サイズ）

// --- 右：振幅曲線パネル ---
const CW = 360;
const CH = 230;
const ML = 34;
const MR = 10;
const MT = 14;
const MB = 26;
const OM_MIN = 0.3;
const OM_MAX = 2;

// 1自由度の不釣り合い応答（振幅と位相遅れ）
function resp(om: number, Om: number, zeta: number) {
  const A = (Om * Om) / Math.hypot(om * om - Om * Om, 2 * zeta * om * Om);
  const phi = Math.atan2(2 * zeta * om * Om, om * om - Om * Om);
  return { A, phi };
}

// F/B分解の大きさ（|F|, |B|）
function fbMag(k: number, Om: number, zeta: number) {
  const rx = resp(1, Om, zeta);
  const ry = resp(Math.sqrt(k), Om, zeta);
  const Fre = (rx.A * Math.cos(rx.phi) + ry.A * Math.cos(ry.phi)) / 2;
  const Fim = (-rx.A * Math.sin(rx.phi) - ry.A * Math.sin(ry.phi)) / 2;
  const Bre = (rx.A * Math.cos(rx.phi) - ry.A * Math.cos(ry.phi)) / 2;
  const Bim = (rx.A * Math.sin(rx.phi) - ry.A * Math.sin(ry.phi)) / 2;
  return { F: Math.hypot(Fre, Fim), B: Math.hypot(Bre, Bim), Ax: rx.A, Ay: ry.A, phix: rx.phi, phiy: ry.phi };
}

// ばね（ジグザグ）のパス
function springPath(x1: number, y1: number, x2: number, y2: number, coils = 5, amp = 8) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const n = coils * 2;
  let d = `M${x1.toFixed(1)},${y1.toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const s = i % 2 === 1 ? 1 : -1;
    d += ` L${(x1 + dx * t + px * amp * s).toFixed(1)},${(y1 + dy * t + py * amp * s).toFixed(1)}`;
  }
  d += ` L${x2.toFixed(1)},${y2.toFixed(1)}`;
  return d;
}

export default function AnisoOrbit({ config }: { config: AnisoOrbitConfig }) {
  const instId = useInstanceId("aniso");
  const zeta = config.zeta ?? 0.08;
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    k: config.kDefault ?? 1.5,
    Om: config.omegaDefault ?? 0.7,
  });
  const k = vals.k;
  const Om = vals.Om;

  const [running, setRunning] = useState(true);
  const [, force] = useState(0);
  const theta = useRef(0);
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = Math.min((t - last.current) / 1000, 0.05);
        theta.current = (theta.current + (0.7 + 0.8 * Om) * dt) % (Math.PI * 2);
        force((n) => (n + 1) % 1000);
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, Om]);

  // 現在の応答と向き（式どおり）
  const cur = fbMag(k, Om, zeta);
  const isLine = Math.abs(cur.F - cur.B) < 0.03 * (cur.F + cur.B + 1e-9);
  const backward = !isLine && cur.B > cur.F;
  const dirLabel = isLine ? "ほぼ直線" : backward ? "後ろ向き" : "前向き";
  const orbitColor = backward ? HEAVY : "var(--accent)";

  // 軌道の閉曲線（形は式どおり・大きさは表示スケール）
  const orbit = useMemo(() => {
    const { Ax, Ay, phix, phiy } = fbMag(k, Om, zeta);
    const m = Math.max(Ax, Ay, 1e-6);
    const s = Math.min(R_CAP, Math.max(R_FLOOR, m * 24)) / m; // 形を保ったまま拡縮
    const pts: string[] = [];
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const x = OC + s * Ax * Math.cos(th - phix);
      const y = OC + s * Ay * Math.sin(th - phiy);
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return { d: pts.join(" ") + " Z", s, Ax, Ay, phix, phiy };
  }, [k, Om, zeta]);

  // 現在点と進行方向の矢印
  const th = theta.current;
  const px = OC + orbit.s * orbit.Ax * Math.cos(th - orbit.phix);
  const py = OC + orbit.s * orbit.Ay * Math.sin(th - orbit.phiy);
  const vx = -orbit.s * orbit.Ax * Math.sin(th - orbit.phix);
  const vy = orbit.s * orbit.Ay * Math.cos(th - orbit.phiy);
  const vlen = Math.hypot(vx, vy) || 1;
  const adx = (vx / vlen) * 12;
  const ady = (vy / vlen) * 12;

  // 振幅曲線（Ax・Ay vs Ω）と後ろ向き帯（|B|>|F| の範囲を数値走査）
  const chart = useMemo(() => {
    const yMax = Math.min((1 / (2 * zeta * Math.sqrt(Math.max(1 - zeta * zeta, 1e-6)))) * 1.15, 12);
    const X = (om: number) => ML + ((om - OM_MIN) / (OM_MAX - OM_MIN)) * (CW - ML - MR);
    const Y = (a: number) => CH - MB - (Math.min(a, yMax) / yMax) * (CH - MT - MB);
    const ax: string[] = [];
    const ay: string[] = [];
    let bandLo: number | null = null;
    let bandHi: number | null = null;
    let prevBack = false;
    const N = 340;
    for (let i = 0; i <= N; i++) {
      const om = OM_MIN + ((OM_MAX - OM_MIN) * i) / N;
      const r = fbMag(k, om, zeta);
      ax.push(`${i === 0 ? "M" : "L"}${X(om).toFixed(1)},${Y(r.Ax).toFixed(1)}`);
      ay.push(`${i === 0 ? "M" : "L"}${X(om).toFixed(1)},${Y(r.Ay).toFixed(1)}`);
      const back = r.B > r.F && (r.F + r.B) > 1e-6 && Math.abs(r.F - r.B) > 0.001 * (r.F + r.B);
      if (back && !prevBack) bandLo = om;
      if (!back && prevBack) bandHi = om;
      prevBack = back;
    }
    if (bandLo !== null && bandHi === null) bandHi = OM_MAX;
    return { yMax, X, Y, axPath: ax.join(" "), ayPath: ay.join(" "), bandLo, bandHi };
  }, [k, zeta]);

  const omy = Math.sqrt(k);
  const kySpringW = 1.6 + (k - 1) * 2.2; // 硬い方向のばねを太く描く

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid items-center gap-4 sm:grid-cols-2">
        {/* 左：軌道アニメ＋支持ばねの絵 */}
        <svg viewBox={`0 0 ${OSIZE} ${OSIZE}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="異方支持ロータの振れ回り軌道（模式）">
          <circle cx={OC} cy={OC} r={HOUSING} fill="var(--soft)" opacity={0.35} stroke="var(--line)" />
          {/* 支持ばね：横（kx）はそのまま、縦（ky）は太く＝硬く */}
          <path d={springPath(OC - HOUSING + 2, OC, OC - 26, OC, 5, 8)} fill="none" stroke="var(--mut)" strokeWidth={1.6} opacity={0.55} />
          <path d={springPath(OC, OC + HOUSING - 2, OC, OC + 26, 5, 8)} fill="none" stroke="var(--mut)" strokeWidth={kySpringW} opacity={0.55} />
          <text x={OC - HOUSING + 12} y={OC - 14} fontSize={11} fill="var(--mut)">横 kx</text>
          <text x={OC + 14} y={OC + HOUSING - 12} fontSize={11} fill="var(--mut)">縦 ky</text>
          {/* 軸 */}
          <line x1={OC - HOUSING} y1={OC} x2={OC + HOUSING} y2={OC} stroke="var(--line)" />
          <line x1={OC} y1={OC - HOUSING} x2={OC} y2={OC + HOUSING} stroke="var(--line)" />
          {/* 軌道（前向き=紺／後ろ向き=臙脂） */}
          <path d={orbit.d} fill="none" stroke={orbitColor} strokeWidth={2.2} opacity={0.6} />
          {/* 回転中心 */}
          <circle cx={OC} cy={OC} r={2.5} fill="var(--mut)" />
          {/* 現在点と進行方向 */}
          <line x1={px} y1={py} x2={px + adx} y2={py + ady} stroke={backward ? HEAVY : "var(--accent-d)"} strokeWidth={2} />
          <circle cx={px} cy={py} r={5.5} fill={backward ? HEAVY : "var(--accent-d)"} />
        </svg>

        {/* 右：振幅 vs Ω（山が2つ）＋後ろ向き帯＋現在カーソル */}
        <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label="横・縦それぞれの振幅と回転数の関係">
          <rect x={ML} y={MT} width={CW - ML - MR} height={CH - MT - MB} fill="var(--soft)" opacity={0.35} />
          {/* 後ろ向きになる帯（2山の間） */}
          {chart.bandLo !== null && chart.bandHi !== null ? (
            <>
              <rect
                x={chart.X(chart.bandLo)}
                y={MT}
                width={Math.max(chart.X(chart.bandHi) - chart.X(chart.bandLo), 0)}
                height={CH - MT - MB}
                fill={HEAVY}
                opacity={0.1}
              />
              {chart.X(chart.bandHi) - chart.X(chart.bandLo) > 26 ? (
                <text
                  x={(chart.X(chart.bandLo) + chart.X(chart.bandHi)) / 2}
                  y={MT + 12}
                  fontSize={10}
                  fill={HEAVY}
                  textAnchor="middle"
                  opacity={0.85}
                >
                  後ろ向き
                </text>
              ) : null}
            </>
          ) : null}
          {/* 危険速度の目印 */}
          <line x1={chart.X(1)} y1={MT} x2={chart.X(1)} y2={CH - MB} stroke="var(--mut)" strokeDasharray="2 3" opacity={0.5} />
          <line x1={chart.X(omy)} y1={MT} x2={chart.X(omy)} y2={CH - MB} stroke="var(--mut)" strokeDasharray="2 3" opacity={0.5} />
          <text x={chart.X(1) - 3} y={CH - MB + 12} fontSize={10} fill="var(--mut)" textAnchor="end">ωx</text>
          <text x={chart.X(omy) + 3} y={CH - MB + 12} fontSize={10} fill="var(--mut)">ωy</text>
          {/* 軸 */}
          <line x1={ML} y1={CH - MB} x2={CW - MR} y2={CH - MB} stroke="var(--line)" />
          <line x1={ML} y1={MT} x2={ML} y2={CH - MB} stroke="var(--line)" />
          {[0.5, 1, 1.5, 2].map((om) => (
            <text key={om} x={chart.X(om)} y={CH - 6} fontSize={10} fill="var(--mut)" textAnchor="middle">
              {om}
            </text>
          ))}
          <text x={ML - 6} y={chart.Y(0) + 3} fontSize={10} fill="var(--mut)" textAnchor="end">0</text>
          <text x={CW - MR} y={CH - 6} fontSize={10} fill="var(--mut)" textAnchor="end">Ω</text>
          {/* 振幅曲線 */}
          <path d={chart.axPath} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
          <path d={chart.ayPath} fill="none" stroke={HEAVY} strokeWidth={2.2} />
          <text x={ML + 8} y={MT + 12} fontSize={11} fill="var(--accent)">横の振幅 Ax</text>
          <text x={ML + 8} y={MT + 26} fontSize={11} fill={HEAVY}>縦の振幅 Ay</text>
          {/* 現在の Ω カーソル */}
          <line x1={chart.X(Om)} y1={MT} x2={chart.X(Om)} y2={CH - MB} stroke="var(--accent-d)" strokeWidth={1.4} />
          <circle cx={chart.X(Om)} cy={chart.Y(cur.Ax)} r={4} fill="var(--accent)" />
          <circle cx={chart.X(Om)} cy={chart.Y(cur.Ay)} r={4} fill={HEAVY} />
        </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider
          label="支持のかたより ky / kx"
          value={k}
          min={1}
          max={2}
          step={0.01}
          onChange={(v) => setParam("k", v)}
        />
        <Slider
          label="回転数 Ω（ωx = 1 基準）"
          value={Om}
          min={0.3}
          max={2}
          step={0.01}
          onChange={(v) => setParam("Om", v)}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
        <span
          className="inline-block min-w-[7em] rounded px-2 py-0.5 text-center"
          style={
            backward
              ? { background: "rgba(155,45,58,.1)", color: HEAVY }
              : isLine
              ? { background: "var(--soft2)", color: "var(--mut)" }
              : { background: "rgba(31,58,95,.1)", color: "var(--accent)" }
          }
        >
          向き：{dirLabel}
        </span>
        <span className="tabular-nums text-mut">
          危険速度 <b className="text-ink">Ω = 1.00</b> と <b className="text-ink">{omy.toFixed(2)}</b>
        </span>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
