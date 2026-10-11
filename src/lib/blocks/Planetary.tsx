import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { ampSpectrum } from "../fft";

// ドメイン部品：遊星歯車の運動学と、ケーシングのセンサが見る「遊星通過の変調」。
//   速度関係（Willis の式）：(ω_s − ω_c)/(ω_r − ω_c) = −Z_r/Z_s
//   固定する部材で速度比が変わる：リング固定 ω_s/ω_c = 1 + Z_r/Z_s、キャリア固定 ω_s/ω_r = −Z_r/Z_s、太陽固定 ω_r/ω_c = 1 + Z_s/Z_r
//   遊星の自転（絶対）：ω_p = ω_c − (Z_s/Z_p)(ω_s − ω_c)、Z_p = (Z_r − Z_s)/2
//   かみ合い周波数：f_mesh = Z_r·|f_r − f_c| = Z_s·|f_s − f_c|
//   組立条件（等間隔配置）：(Z_s + Z_r)/N_p が整数
// 下段は「リングのケーシングに固定したセンサ」が見る信号の模式：
//   各遊星のかみ合い振動（位相 φ_p = Z_r·2πp/N_p）に、遊星がセンサの前を通るときだけ強く届く窓（コサイン窓）をかけて足す。
//   → Hann 窓＋本物の FFT。生き残る線は f_mesh + m·f_c のうち (m + Z_r) ≡ 0 (mod N_p) のものだけ（隣の線の間隔は N_p·f_c）。
//     Z_r/N_p が整数（同位相型）なら m = 0, ±N_p, … で f_mesh を中心に対称、そうでなければ（順次位相型）m = 0 が落ちて
//     f_mesh が消え、列全体がずれて左右非対称になる（McFadden & Smith 1985 の機構）。ガイド線もこの合同条件で引く。
// ※ 図は模式。歯は目盛りで示し、かみ合いの力の波形は正弦波で代用。

export type PlanetaryConfig = {
  title?: string;
  caption?: string;
  link?: string;
  zsDefault?: number; // 太陽の歯数
  zrDefault?: number; // リングの歯数（Z_r − Z_s は偶数）
  npDefault?: number; // 遊星の数 3〜6
  fixedDefault?: "ring" | "carrier" | "sun";
};

type Fixed = "ring" | "carrier" | "sun";
const FIXED: { key: Fixed; label: string; io: string }[] = [
  { key: "ring", label: "リング固定", io: "太陽 → キャリア（減速）" },
  { key: "carrier", label: "キャリア固定", io: "太陽 → リング（逆転）" },
  { key: "sun", label: "太陽固定", io: "キャリア → リング（増速）" },
];

const W = 640;
const HG = 330; // 上段（歯車の絵＋読み値）
const HS = 250; // 下段（波形＋スペクトル）
const NF = 4096; // FFT 点数
const TWIN = 8; // 窓に入れる「相対回転」の数 → 分解能 1/8
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";

type Kin = { ws: number; wc: number; wr: number; wp: number; zp: number; ratio: number; ratioText: string; fmesh: number; ppf: number; unit: string };

// 入力回転数を 1 として各部材の角速度を求める
function kinematics(zs: number, zr: number, fixed: Fixed): Kin {
  const zp = (zr - zs) / 2;
  let ws = 0, wc = 0, wr = 0;
  let ratioText = "";
  let ratio = 1;
  if (fixed === "ring") {
    ws = 1; wr = 0; wc = zs / (zs + zr);
    ratio = 1 + zr / zs; ratioText = "ω_s/ω_c = 1 + Z_r/Z_s";
  } else if (fixed === "carrier") {
    ws = 1; wc = 0; wr = -zs / zr;
    ratio = -zr / zs; ratioText = "ω_s/ω_r = −Z_r/Z_s";
  } else {
    ws = 0; wc = 1; wr = 1 + zs / zr;
    ratio = 1 / (1 + zs / zr); ratioText = "ω_r/ω_c = 1 + Z_s/Z_r";
  }
  const wp = wc - (zs / zp) * (ws - wc);
  const rel = Math.abs(wc - wr); // キャリアとリングの相対回転
  const fmesh = zr * rel; // 入力回転数単位
  const ppf = Math.abs(wc) * 1; // 静止したセンサの前を遊星 1 個が通る回数（入力回転数単位、N_p 倍は後で）
  return { ws, wc, wr, wp, zp, ratio, ratioText, fmesh, ppf, unit: fixed === "sun" ? "キャリア回転" : "太陽回転" };
}

export default function Planetary({ config }: { config: PlanetaryConfig }) {
  const [zs, setZs] = useState(config.zsDefault ?? 24);
  const [zr, setZr] = useState(config.zrDefault ?? 72);
  const [np, setNp] = useState(config.npDefault ?? 3);
  const [fixed, setFixed] = useState<Fixed>(config.fixedDefault ?? "ring");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0); // 入力軸の回転角 [rad]
  const raf = useRef(0);
  const last = useRef(0);

  // Z_r − Z_s を偶数に保つ（遊星の歯数が整数になるように）。補正後に範囲へ戻す
  const ZR_MIN = 48, ZR_MAX = 120;
  const evenZr = (candidate: number, s: number) => {
    const v = (candidate - s) % 2 === 0 ? candidate : candidate + 1;
    return v > ZR_MAX ? v - 2 : v < ZR_MIN ? v + 2 : v;
  };
  const setZsSafe = (v: number) => { setZs(v); if ((zr - v) % 2 !== 0) setZr(evenZr(zr + 1, v)); };
  const setZrSafe = (v: number) => { setZr(evenZr(v, zs)); };
  // 遊星の数を変えたら、偶数差を保ったまま最も近い組立可能な Z_r に寄せる
  const setNpSafe = (n: number) => {
    setNp(n);
    if ((zs + zr) % n === 0) return;
    for (let d = 2; d <= 2 * n; d += 2) {
      if (zr + d <= ZR_MAX && (zs + zr + d) % n === 0) { setZr(zr + d); return; }
      if (zr - d >= ZR_MIN && (zs + zr - d) % n === 0) { setZr(zr - d); return; }
    }
  };

  useEffect(() => {
    if (!running) return;
    last.current = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - last.current) / 1000);
      last.current = t;
      setPhase((p) => p + dt * 0.9); // 入力 0.9 rad/s（ゆっくり）
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  const kin = useMemo(() => kinematics(zs, zr, fixed), [zs, zr, fixed]);
  const assemblable = (zs + zr) % np === 0;
  const inPhase = zr % np === 0;

  // ---- 下段：センサ信号（時間単位＝キャリアとリングの相対回転 1 回）
  const { wave, mag, fm, ppfRel, span } = useMemo(() => {
    const rel = Math.abs(kin.wc - kin.wr) || 1e-9;
    const fm = zr; // 相対回転 1 回あたりのかみ合い回数
    const ppfRel = Math.abs(kin.wc) / rel; // 相対回転 1 回あたりに遊星 1 個がセンサの前を通る回数
    const sig = new Float64Array(NF);
    for (let i = 0; i < NF; i++) {
      const t = (TWIN * i) / NF;
      let s = 0;
      for (let p = 0; p < np; p++) {
        const th = 2 * Math.PI * ppfRel * t + (2 * Math.PI * p) / np; // センサから見た遊星 p の角度
        const win = Math.pow(0.5 * (1 + Math.cos(th)), 3); // センサの前で強く届く窓
        const phi = (2 * Math.PI * zr * p) / np; // 遊星 p のかみ合い位相
        s += win * Math.cos(2 * Math.PI * fm * t + phi);
      }
      sig[i] = s;
    }
    let mean = 0;
    for (let i = 0; i < NF; i++) mean += sig[i];
    mean /= NF;
    for (let i = 0; i < NF; i++) sig[i] -= mean;
    const mag = ampSpectrum(sig, true);
    const M = 560;
    const wave: number[] = [];
    for (let i = 0; i <= M; i++) {
      const t = (2 * i) / M; // 相対回転 2 回ぶん
      let s = 0;
      for (let p = 0; p < np; p++) {
        const th = 2 * Math.PI * ppfRel * t + (2 * Math.PI * p) / np;
        const win = Math.pow(0.5 * (1 + Math.cos(th)), 3);
        const phi = (2 * Math.PI * zr * p) / np;
        s += win * Math.cos(2 * Math.PI * fm * t + phi);
      }
      wave.push(s);
    }
    const spacing = np * ppfRel;
    const span = Math.max(10, Math.ceil(3.2 * spacing));
    return { wave, mag, fm, ppfRel, span };
  }, [zs, zr, np, kin]);

  // ---- 上段の描画（ピッチ円）
  const cx = 170, cy = HG / 2 + 6;
  const Rr = 140;
  const Rs = (Rr * zs) / zr;
  const Rp = (Rr * kin.zp) / zr;
  const Rc = Rs + Rp;
  const thS = phase * kin.ws, thC = phase * kin.wc, thR = phase * kin.wr, thP = phase * kin.wp;
  const teeth = (R: number, Z: number, th: number, inward: boolean, x0: number, y0: number) => {
    const out: string[] = [];
    const len = Math.max(3, Math.min(7, (2 * Math.PI * R) / Z * 0.45));
    for (let i = 0; i < Z; i++) {
      const a = th + (2 * Math.PI * i) / Z;
      const r1 = inward ? R : R - len * 0.4;
      const r2 = inward ? R - len : R + len * 0.6;
      out.push(`M${(x0 + r1 * Math.cos(a)).toFixed(1)},${(y0 + r1 * Math.sin(a)).toFixed(1)}L${(x0 + r2 * Math.cos(a)).toFixed(1)},${(y0 + r2 * Math.sin(a)).toFixed(1)}`);
    }
    return out.join("");
  };
  const planets = Array.from({ length: np }, (_, p) => {
    const a = thC + (2 * Math.PI * p) / np;
    return { x: cx + Rc * Math.cos(a), y: cy + Rc * Math.sin(a), a };
  });
  const dot = (x0: number, y0: number, R: number, th: number, color: string) => (
    <circle cx={x0 + R * 0.75 * Math.cos(th)} cy={y0 + R * 0.75 * Math.sin(th)} r={3.2} fill={color} />
  );
  const fmt = (v: number) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(3));

  // ---- 下段の描画
  const padL = 20, padR = 16;
  const timeTop = 16, timeH = 70, timeMid = timeTop + timeH / 2;
  const specTop = 118, specBot = HS - 30;
  const x0 = Math.max(0, fm - span), x1 = fm + span;
  const k0 = Math.max(1, Math.floor(x0 * TWIN)), k1 = Math.min(mag.length - 1, Math.ceil(x1 * TWIN));
  let mmax = 1e-6;
  for (let k = k0; k <= k1; k++) if (mag[k] > mmax) mmax = mag[k];
  const yMax = mmax * 1.15;
  const sx = (f: number) => padL + ((f - x0) / (x1 - x0)) * (W - padL - padR);
  const sy = (m: number) => specBot - (Math.min(m, yMax) / yMax) * (specBot - specTop);
  let specD = `M${sx(k0 / TWIN).toFixed(1)},${sy(0).toFixed(1)}`;
  for (let k = k0; k <= k1; k++) specD += ` L${sx(k / TWIN).toFixed(1)},${sy(mag[k]).toFixed(1)}`;
  specD += ` L${sx(k1 / TWIN).toFixed(1)},${sy(0).toFixed(1)} Z`;
  const wmax = Math.max(1e-6, ...wave.map((v) => Math.abs(v)));
  const sxT = (i: number) => padL + (i / (wave.length - 1)) * (W - padL - padR);
  const syT = (v: number) => timeMid - (v / wmax) * (timeH / 2) * 0.92;
  const timeD = wave.map((v, i) => `${i === 0 ? "M" : "L"}${sxT(i).toFixed(1)},${syT(v).toFixed(1)}`).join("");
  const spacing = np * ppfRel;
  // 生き残る線：f_mesh + m·f_c で (m + Z_r) ≡ 0 (mod N_p)
  const sbTicks: number[] = [];
  const mOffset = ((-zr % np) + np) % np; // m ≡ −Z_r (mod N_p) の最小非負代表
  if (ppfRel > 1e-6) for (let k = -8; k <= 8; k++) { const m = mOffset + k * np; const f = fm + m * ppfRel; if (f > x0 && f < x1) sbTicks.push(f); }
  const mExample = inPhase ? "0, ±N_p, ±2N_p, …" : `${mOffset}, ${mOffset - np}, ${mOffset + np}, ${mOffset - 2 * np}, …`;
  const kfm = Math.round(fm * TWIN);
  const fmMag = mag[kfm] ?? 0;

  const btn = (on: boolean) =>
    "rounded border px-2 py-1 text-xs transition-colors " +
    (on ? "border-accent bg-accent/10 text-accent" : "border-line bg-white text-mut hover:border-accent hover:text-accent");

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {FIXED.map((f) => (
          <button key={f.key} onClick={() => setFixed(f.key)} aria-pressed={fixed === f.key} className={btn(fixed === f.key)} title={f.io}>
            {f.label}
          </button>
        ))}
        <span className="mx-1 text-xs text-mut">遊星の数</span>
        {[3, 4, 5, 6].map((n) => (
          <button key={n} onClick={() => setNpSafe(n)} aria-pressed={np === n} className={btn(np === n)}>
            {n}
          </button>
        ))}
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} className="ml-auto" />
      </div>

      <svg viewBox={`0 0 ${W} ${HG}`} className="w-full" role="img" aria-label="遊星歯車のピッチ円と各部材の回転">
        {/* リング */}
        <circle cx={cx} cy={cy} r={Rr} fill="none" stroke={fixed === "ring" ? "var(--mut)" : "var(--accent)"} strokeWidth={2.2} />
        <path d={teeth(Rr, zr, thR, true, cx, cy)} stroke={fixed === "ring" ? "var(--mut)" : "var(--accent)"} strokeWidth={1} fill="none" />
        {dot(cx, cy, Rr * 1.22, thR, fixed === "ring" ? "var(--mut)" : "var(--accent)")}
        {/* キャリア */}
        {planets.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={fixed === "carrier" ? "var(--mut)" : GOLD} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={6} fill={fixed === "carrier" ? "var(--mut)" : GOLD} />
        {/* 太陽 */}
        <circle cx={cx} cy={cy} r={Rs} fill="#fff" stroke={fixed === "sun" ? "var(--mut)" : "var(--accent)"} strokeWidth={2} />
        <path d={teeth(Rs, zs, thS, false, cx, cy)} stroke={fixed === "sun" ? "var(--mut)" : "var(--accent)"} strokeWidth={1} fill="none" />
        {dot(cx, cy, Rs, thS, fixed === "sun" ? "var(--mut)" : "var(--accent)")}
        {/* 遊星 */}
        {planets.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={Rp} fill="#fff" stroke={HEAVY} strokeWidth={1.8} />
            <path d={teeth(Rp, Math.max(4, Math.round(kin.zp)), thP, false, p.x, p.y)} stroke={HEAVY} strokeWidth={0.9} fill="none" />
            {dot(p.x, p.y, Rp, thP, HEAVY)}
          </g>
        ))}
        {/* センサ（リングのケーシング、真上） */}
        <path d={`M${cx - 7},${cy - Rr - 22} L${cx + 7},${cy - Rr - 22} L${cx},${cy - Rr - 10} Z`} fill="var(--accent)" />
        <text x={cx} y={cy - Rr - 27} fontSize="11" fill="var(--mut)" textAnchor="middle">
          センサ（ケーシング）
        </text>

        {/* 読み値 */}
        <g fontSize="12" fill="var(--ink)">
          <text x={340} y={40} fontSize="12" fill="var(--mut)">
            歯数：太陽 Z_s = {zs}、遊星 Z_p = {kin.zp}、リング Z_r = {zr}、遊星 N_p = {np}
          </text>
          <text x={340} y={64}>
            速度比（{kin.ratioText}）：
          </text>
          <text x={340} y={84} fontSize="15" fontWeight={600}>
            {kin.ratio > 0 ? "" : "逆転（符号 −）"}
            {Math.abs(kin.ratio) >= 1 ? `${Math.abs(kin.ratio).toFixed(2)} 分の 1 に減速` : `${(1 / Math.abs(kin.ratio)).toFixed(2)} 倍に増速`}
          </text>
          <text x={340} y={112} fill="var(--mut)">
            角速度（入力＝1）：太陽 {fmt(kin.ws)}、キャリア {fmt(kin.wc)}、リング {fmt(kin.wr)}、遊星の自転 {fmt(kin.wp)}
          </text>
          <text x={340} y={140}>
            かみ合い周波数 f_mesh = Z_r·|f_r − f_c| = {kin.fmesh.toFixed(1)} × {kin.unit}数
          </text>
          <text x={340} y={160}>
            遊星通過周波数（センサ基準）= N_p·|f_c| = {(np * kin.ppf).toFixed(2)} × {kin.unit}数
          </text>
          <text x={340} y={190} fill={assemblable ? "var(--accent)" : HEAVY}>
            組立条件 (Z_s + Z_r)/N_p = {((zs + zr) / np).toFixed(2)} → {assemblable ? "等間隔に組める" : "等間隔には組めない（模式として表示）"}
          </text>
          <text x={340} y={212} fill={inPhase ? "var(--accent)" : HEAVY}>
            遊星の位相 Z_r/N_p = {(zr / np).toFixed(2)} → {inPhase ? "そろう（f_mesh が立つ）" : "ずれる（f_mesh が打ち消される）"}
          </text>
        </g>
      </svg>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Slider label="太陽の歯数 Z_s" value={zs} min={12} max={40} step={1} onChange={setZsSafe} />
        <Slider label="リングの歯数 Z_r" value={zr} min={ZR_MIN} max={ZR_MAX} step={1} onChange={setZrSafe} />
      </div>

      <svg viewBox={`0 0 ${W} ${HS}`} className="mt-3 w-full" role="img" aria-label="ケーシングのセンサが見る波形とスペクトル">
        <text x={padL} y={timeTop - 4} fontSize="12" fill="var(--mut)">
          センサの波形（キャリアとリングの相対回転 2 回ぶん。遊星が前を通るたびに大きく届く）
        </text>
        <rect x={padL} y={timeTop} width={W - padL - padR} height={timeH} fill="var(--soft)" opacity={0.35} />
        <line x1={padL} y1={timeMid} x2={W - padR} y2={timeMid} stroke="var(--line)" />
        <path d={timeD} fill="none" stroke="var(--accent)" strokeWidth={1.1} />

        <text x={padL} y={specTop - 8} fontSize="12" fill="var(--mut)">
          スペクトル（f_mesh のまわりを拡大。横軸は相対回転の次数。縦軸は正規化）
        </text>
        <line x1={padL} y1={specBot} x2={W - padR} y2={specBot} stroke="var(--line)" />
        {sbTicks.map((f) => (
          <line key={f} x1={sx(f)} y1={specTop} x2={sx(f)} y2={specBot} stroke="var(--line)" strokeDasharray="2 3" />
        ))}
        <line x1={sx(fm)} y1={specTop} x2={sx(fm)} y2={specBot} stroke={GOLD} strokeDasharray="2 3" />
        <path d={specD} fill="var(--accent)" opacity={0.16} stroke="var(--accent)" strokeWidth={1.4} />
        <text x={sx(fm)} y={specBot + 16} fontSize="11" fill={GOLD} textAnchor="middle">
          f_mesh = {fm}×
        </text>
        {spacing > 1e-6 ? (
          <>
            <text x={sx(fm + spacing)} y={specBot + 16} fontSize="11" fill="var(--mut)" textAnchor="middle">
              +{spacing.toFixed(1)}
            </text>
            <text x={sx(fm - spacing)} y={specBot + 16} fontSize="11" fill="var(--mut)" textAnchor="middle">
              −{spacing.toFixed(1)}
            </text>
            <text x={W - padR} y={specTop + 4} fontSize="11" fill={HEAVY} textAnchor="end">
              側帯波列の線間隔 = 遊星通過周波数 = N_p|f_c| = {spacing.toFixed(2)}（線は m = {mExample} の位置）
            </text>
          </>
        ) : (
          <text x={W - padR} y={specTop + 4} fontSize="11" fill={HEAVY} textAnchor="end">
            キャリアが止まっているので遊星は通過せず、変調は出ない
          </text>
        )}
        <circle cx={sx(fm)} cy={sy(fmMag)} r={3} fill={HEAVY} />
      </svg>

      <p className="mt-2 rounded bg-soft/50 px-3 py-2 text-sm leading-relaxed text-ink/90">
        <span className="mr-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">読み方</span>
        {spacing <= 1e-6
          ? "キャリアを固定すると遊星の位置が動かないので、センサには一定の強さでかみ合いが届き、側帯波は出ません。"
          : inPhase
          ? `Z_r が N_p で割り切れるので（同位相型）、${np} 個の遊星のかみ合いは同じ位相で届き、f_mesh に高い山が立ちます。その両側に、遊星通過周波数の間隔（${spacing.toFixed(2)}）で対称に側帯波が並びます。`
          : `Z_r が N_p で割り切れないので（順次位相型）、${np} 個の遊星のかみ合いは位相がずれて打ち消し合い、f_mesh の山が消えます。線は f_mesh + m·f_c のうち m + Z_r が N_p の倍数になる m（${mExample}）だけに立つので、列全体が f_mesh からずれて左右非対称になります。隣の線の間隔は遊星通過周波数（${spacing.toFixed(2)}）のままです。`}
      </p>
      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
