import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";

// ドメイン部品：同期電動機の起動とねじり共振。
// 突極形の同期電動機を誘導機として始動すると、脈動トルクの周波数は「すべり周波数の 2 倍」
//   f_e(t) = 2 s f_line,  s = 1 − n/n_s
// で、静止（s=1）の 2 f_line から同期（s=0）の 0 まで下がる。ねじり固有振動数 f_n が 2 f_line より
// 低ければ、起動のたびに必ず一度は f_e = f_n を横切る（上段の交点）。
// 下段は 1 自由度ねじり系 θ̈ + 2ζω_n θ̇ + ω_n² θ = ω_n² sin φ(t)（静的ねじれ角で正規化）を
// RK4 で数値積分した応答の包絡線。掃引が速い（起動が短い）ほど山は低く、遅いほど定常の 1/(2ζ) に近づく。
// ※ 脈動トルクの大きさは実機では速度とともに変わるが、ここでは一定にした模式。加速は一様（すべりが時間に比例して減る）。

export type MotorStartTorsionConfig = {
  title?: string;
  caption?: string;
  link?: string;
  tStartDefault?: number; // 起動時間 s（静止→同期）
  fnDefault?: number; // ねじり固有振動数 Hz
  zetaDefault?: number; // 減衰比
  fLineDefault?: 50 | 60; // 電源周波数 Hz
};

const W = 640;
const H = 440;
const PL = 56;
const PR = 20;
const TOP = { y0: 28, y1: 186 };
const BOT = { y0: 236, y1: 404 };
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";
const NB = 420; // 包絡線のビン数

type Sim = { env: number[]; peak: number; tPeak: number; tCross: number | null };

function simulate(ts: number, fn: number, zeta: number, fLine: number): Sim {
  const wn = 2 * Math.PI * fn;
  const fmax = Math.max(2 * fLine, fn);
  const dt = 1 / (fmax * 48);
  const sweep = (2 * Math.PI * 2 * fLine) / ts; // dφ/dt の減り方（rad/s²）
  // 位相 φ(t) = 2π·2f_line·(t − t²/(2ts))
  const phase = (t: number) => 2 * Math.PI * 2 * fLine * (t - (t * t) / (2 * ts));
  const acc = (t: number, x: number, v: number) => wn * wn * Math.sin(phase(t)) - 2 * zeta * wn * v - wn * wn * x;
  let x = 0;
  let v = 0;
  const env = new Array(NB).fill(0);
  let peak = 0;
  let tPeak = 0;
  // 最後の刻みは ts で止め、更新後の状態は更新後の時刻 t+h に記録する
  for (let t = 0; t < ts; ) {
    const h = Math.min(dt, ts - t);
    const k1v = acc(t, x, v);
    const k1x = v;
    const k2v = acc(t + h / 2, x + (h / 2) * k1x, v + (h / 2) * k1v);
    const k2x = v + (h / 2) * k1v;
    const k3v = acc(t + h / 2, x + (h / 2) * k2x, v + (h / 2) * k2v);
    const k3x = v + (h / 2) * k2v;
    const k4v = acc(t + h, x + h * k3x, v + h * k3v);
    const k4x = v + h * k3v;
    x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    t += h;
    const a = Math.abs(x);
    const b = Math.min(NB - 1, Math.floor((t / ts) * NB));
    if (a > env[b]) env[b] = a;
    if (a > peak) {
      peak = a;
      tPeak = t;
    }
  }
  void sweep;
  const tCross = fn < 2 * fLine ? ts * (1 - fn / (2 * fLine)) : null;
  return { env, peak, tPeak, tCross };
}

export default function MotorStartTorsion({ config }: { config: MotorStartTorsionConfig }) {
  const [ts, setTs] = useState(config.tStartDefault ?? 8);
  const [fn, setFn] = useState(config.fnDefault ?? 25);
  const [zeta, setZeta] = useState(config.zetaDefault ?? 0.02);
  const [fLine, setFLine] = useState<50 | 60>(config.fLineDefault ?? 50);

  const sim = useMemo(() => simulate(ts, fn, zeta, fLine), [ts, fn, zeta, fLine]);

  const fTop = 2 * fLine * 1.08;
  const xOf = (t: number) => PL + (t / ts) * (W - PL - PR);
  const yTop = (f: number) => TOP.y1 - (f / fTop) * (TOP.y1 - TOP.y0);
  const steady = 1 / (2 * zeta);
  const yMax = Math.max(steady * 1.1, sim.peak * 1.1, 2);
  const yBot = (a: number) => BOT.y1 - (Math.min(a, yMax) / yMax) * (BOT.y1 - BOT.y0);

  const envPath = sim.env
    .map((a, i) => `${i === 0 ? "M" : "L"}${xOf(((i + 0.5) / NB) * ts).toFixed(1)},${yBot(a).toFixed(1)}`)
    .join(" ");
  const envNeg = sim.env
    .map((a, i) => `${i === 0 ? "M" : "L"}${xOf(((i + 0.5) / NB) * ts).toFixed(1)},${(BOT.y1 + (BOT.y1 - yBot(a))).toFixed(1)}`)
    .join(" ");
  void envNeg;

  const sweepRate = (2 * fLine) / ts; // Hz/s
  const ratio = sim.peak / steady;

  return (
    <div className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <h4 className="mb-2 font-serif text-base text-ink">{config.title}</h4> : null}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-mut">
        <span>電源周波数</span>
        {([50, 60] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFLine(f)}
            className={
              "rounded-full border px-2.5 py-0.5 transition-colors " +
              (fLine === f ? "border-accent bg-accent/10 text-accent" : "border-line text-mut hover:border-accent hover:text-accent")
            }
          >
            {f} Hz
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="同期電動機の起動：脈動トルクの周波数の掃引と、ねじり応答の包絡線">
        {/* 上段：周波数 vs 時間 */}
        <text x={PL} y={TOP.y0 - 10} fontSize="11" fill="var(--mut)">
          周波数 [Hz]（起動の進行 →）
        </text>
        <line x1={PL} y1={TOP.y1} x2={W - PR} y2={TOP.y1} stroke="var(--line)" />
        <line x1={PL} y1={TOP.y0} x2={PL} y2={TOP.y1} stroke="var(--line)" />
        {[0, fLine, 2 * fLine].map((f) => (
          <g key={f}>
            <line x1={PL - 4} y1={yTop(f)} x2={PL} y2={yTop(f)} stroke="var(--mut)" />
            <text x={PL - 7} y={yTop(f) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              {f}
            </text>
          </g>
        ))}
        {/* 脈動トルクの周波数 2·s·f_line：2f_line → 0 */}
        <line x1={xOf(0)} y1={yTop(2 * fLine)} x2={xOf(ts)} y2={yTop(0)} stroke="var(--accent)" strokeWidth="2" />
        <text x={xOf(0) + 6} y={yTop(2 * fLine) + 14} fontSize="11" fill="var(--accent)">
          脈動トルクの周波数 2·s·f_line
        </text>
        {/* 固有振動数 */}
        {fn < fTop ? (
          <>
            <line x1={PL} y1={yTop(fn)} x2={W - PR} y2={yTop(fn)} stroke={GOLD} strokeWidth="1.6" strokeDasharray="6 4" />
            <text x={PL + 6} y={yTop(fn) - 5} fontSize="11" fill={GOLD}>
              ねじり固有振動数 f_n = {fn} Hz
            </text>
          </>
        ) : null}
        {/* 交点 */}
        {sim.tCross !== null ? (
          <>
            <circle cx={xOf(sim.tCross)} cy={yTop(fn)} r="5" fill={HEAVY} />
            <line x1={xOf(sim.tCross)} y1={yTop(fn)} x2={xOf(sim.tCross)} y2={BOT.y1} stroke={HEAVY} strokeDasharray="3 4" opacity="0.6" />
            <text x={xOf(sim.tCross) + 7} y={yTop(fn) - 8} fontSize="11" fill={HEAVY}>
              共振を横切る（{sim.tCross.toFixed(1)} s）
            </text>
          </>
        ) : (
          <text x={PL + 8} y={TOP.y0 + 14} fontSize="11" fill={HEAVY}>
            f_n が 2·f_line より高いので横切らない
          </text>
        )}
        {/* 下段：応答の包絡線 */}
        <text x={PL} y={BOT.y0 - 10} fontSize="11" fill="var(--mut)">
          ねじれ角の大きさ（静的ねじれ角 = 1）
        </text>
        <line x1={PL} y1={BOT.y1} x2={W - PR} y2={BOT.y1} stroke="var(--line)" />
        <line x1={PL} y1={BOT.y0} x2={PL} y2={BOT.y1} stroke="var(--line)" />
        {[0, 1].map((a) => (
          <g key={a}>
            <line x1={PL - 4} y1={yBot(a)} x2={PL} y2={yBot(a)} stroke="var(--mut)" />
            <text x={PL - 7} y={yBot(a) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              {a}
            </text>
          </g>
        ))}
        {steady <= yMax ? (
          <>
            <line x1={PL} y1={yBot(steady)} x2={W - PR} y2={yBot(steady)} stroke="var(--mut)" strokeDasharray="2 4" />
            <text x={W - PR - 4} y={yBot(steady) - 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              定常共振なら 1/(2ζ) = {steady.toFixed(0)}
            </text>
          </>
        ) : null}
        <path d={envPath} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <circle cx={xOf(sim.tPeak)} cy={yBot(sim.peak)} r="4" fill={HEAVY} />
        <text x={Math.min(xOf(sim.tPeak) + 8, W - PR - 150)} y={Math.max(yBot(sim.peak) - 8, BOT.y0 + 12)} fontSize="11" fill={HEAVY}>
          最大 {sim.peak.toFixed(1)} 倍（定常の {Math.round(ratio * 100)}%）
        </text>
        <text x={W - PR} y={BOT.y1 + 16} fontSize="10" fill="var(--mut)" textAnchor="end">
          時間 0 → {ts} s（静止 → 同期）
        </text>
      </svg>
      <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-3">
        <Slider label="起動時間（静止→同期）" value={ts} min={1} max={20} step={0.5} unit="s" onChange={setTs} />
        <Slider label="ねじり固有振動数 f_n" value={fn} min={5} max={130} step={1} unit="Hz" onChange={setFn} />
        <Slider label="減衰比 ζ" value={zeta} min={0.005} max={0.1} step={0.005} onChange={setZeta} />
      </div>
      <div className="mt-2 text-xs text-mut">
        掃引の速さ {sweepRate.toFixed(1)} Hz/s。起動が長いほど共振の近くに長くとどまり、山は定常値 1/(2ζ) に近づきます。脈動トルクの大きさは一定とした模式で、加速は一様（すべりが時間に比例して減る）としています。
      </div>
      {config.caption ? <p className="mt-2 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </div>
  );
}
