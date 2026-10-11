import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";

// ドメイン部品：能動磁気軸受（AMB）の 1 自由度模型。
// 対向する 2 個の電磁石のあいだに回転子（質量 m）。各電磁石の吸引力は F = k_m · i² / g²（k_m = μ₀N²A/4）。
// バイアス電流 i_b を両側に流し、制御電流 i_c を片側に足し・片側から引く（差動駆動）と、中心付近で
//   F ≈ k_i · i_c + k_s · x,   k_i = 4 k_m i_b / g₀²（電流剛性, N/A）,   k_s = +4 k_m i_b² / g₀³（変位剛性, N/m。本文では負の剛性と呼ぶ）
// となり、x が増えるとさらに x の向きへ引かれる（不安定）。PD 制御 i_c = −(k_p x + k_d ẋ) を入れると
//   m ẍ + (k_i k_d) ẋ + (k_i k_p − k_s) x = 0
// で、k_i k_p > k_s かつ k_d > 0 なら安定。制御電流は |i_c| ≤ i_b で飽和（積分と表示で同じ）。数値積分は RK4、表示は 20 ms を 4 秒に伸ばしたスローモーション。
// ※ 1 自由度・線形化した模式。実機は 2 軸 × 2 軸受＋スラスト、増幅器やセンサの遅れもあるが、ここでは省く。

export type AmbLevitateConfig = {
  title?: string;
  caption?: string;
  link?: string;
  ibDefault?: number; // バイアス電流 A
  g0Default?: number; // 公称ギャップ mm
  kpDefault?: number; // 比例ゲイン A/m
  kdDefault?: number; // 微分ゲイン A·s/m
};

const W = 640;
const H = 470;
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";
const MU0 = 4e-7 * Math.PI;
const NTURN = 300;
const AREA = 1e-3; // m²（磁極の面積）
const KM = (MU0 * NTURN * NTURN * AREA) / 4; // N·m²/A²
const MASS = 2; // kg（この軸受が受け持つ分）
const T_SIM = 0.02; // s
const PLAY_SEC = 4; // 表示にかける実時間 s
const DT = 1e-5;
const NPT = 400;

type Sim = { x: number[]; v: number[]; hit: number | null; tHit: number | null };

// 制御電流の飽和：|i_c| ≤ i_b（片側のコイル電流が 0 を割らない範囲。電圧飽和・スルーレートは含まない）
function clampIc(ic: number, ib: number) {
  return Math.max(-ib, Math.min(ib, ic));
}

function simulate(ib: number, g0m: number, kp: number, kd: number, control: boolean, x0: number): Sim {
  const ki = (4 * KM * ib) / (g0m * g0m);
  const ks = (4 * KM * ib * ib) / (g0m * g0m * g0m);
  const lim = g0m / 2; // バックアップ軸受のすきま（磁気ギャップの半分、模式）
  const acc = (x: number, v: number) => {
    const ic = control ? clampIc(-(kp * x + kd * v), ib) : 0;
    return (ks * x + ki * ic) / MASS;
  };
  let x = x0;
  let v = 0;
  const out: number[] = [];
  const outV: number[] = [];
  let hit: number | null = null;
  let tHit: number | null = null;
  const stride = Math.max(1, Math.round(T_SIM / DT / NPT));
  let k = 0;
  for (let t = 0; t <= T_SIM + 1e-12; t += DT, k++) {
    if (k % stride === 0) {
      out.push(x);
      outV.push(v);
    }
    if (hit !== null) continue;
    const k1v = acc(x, v), k1x = v;
    const k2v = acc(x + (DT / 2) * k1x, v + (DT / 2) * k1v), k2x = v + (DT / 2) * k1v;
    const k3v = acc(x + (DT / 2) * k2x, v + (DT / 2) * k2v), k3x = v + (DT / 2) * k2v;
    const k4v = acc(x + DT * k3x, v + DT * k3v), k4x = v + DT * k3v;
    x += (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (DT / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    if (Math.abs(x) >= lim) {
      hit = Math.sign(x) * lim;
      tHit = t;
      x = hit;
      v = 0;
    }
  }
  return { x: out, v: outV, hit, tHit };
}

function fmt(v: number, d = 0) {
  return v.toLocaleString("ja-JP", { maximumFractionDigits: d, minimumFractionDigits: d });
}

export default function AmbLevitate({ config }: { config: AmbLevitateConfig }) {
  const [ib, setIb] = useState(config.ibDefault ?? 1.5);
  const [g0, setG0] = useState(config.g0Default ?? 0.5);
  const [kp, setKp] = useState(config.kpDefault ?? 8000);
  const [kd, setKd] = useState(config.kdDefault ?? 3);
  const [control, setControl] = useState(true);
  const [run, setRun] = useState(0); // 外乱を入れ直すたびに増やす
  const [frac, setFrac] = useState(1); // 再生位置 0..1
  const raf = useRef<number | null>(null);

  const g0m = g0 * 1e-3;
  const ki = (4 * KM * ib) / (g0m * g0m);
  const ks = (4 * KM * ib * ib) / (g0m * g0m * g0m);
  const kEff = ki * kp - ks; // 閉ループ剛性
  const cEff = ki * kd; // 閉ループ減衰
  const stable = control && kEff > 0 && kd > 0;
  const marginal = control && kEff > 0 && kd <= 0; // 減衰ゼロ：持続振動
  const wn = control && kEff > 0 ? Math.sqrt(kEff / MASS) : 0;
  const zeta = stable ? cEff / (2 * Math.sqrt(kEff * MASS)) : 0;

  const sim = useMemo(() => simulate(ib, g0m, kp, kd, control, 50e-6), [ib, g0m, kp, kd, control, run]);

  // 外乱（初期ずれ 50 μm）からの応答をスローモーションで再生
  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const tick = () => {
      const f = Math.min(1, (performance.now() - t0) / (PLAY_SEC * 1000));
      setFrac(f);
      if (f < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [sim]);

  // ---- 上段：電磁石と回転子
  const SC = { y0: 26, y1: 200 };
  const cx = W / 2;
  const cy = (SC.y0 + SC.y1) / 2;
  const lim = g0m / 2;
  const idx = Math.min(sim.x.length - 1, Math.floor(frac * (sim.x.length - 1)));
  const xNow = sim.x[idx];
  const scale = 120 / lim; // バックアップ軸受のすきま = 120px（誇張）
  const rotorX = cx + xNow * scale;
  const poleGap = 150; // 中心から磁極面まで（px）
  const rotorR = 40;
  const vNow = sim.v[idx] ?? 0;
  const icNow = control ? clampIc(-(kp * xNow + kd * vNow), ib) : 0; // 表示用の制御電流（計算と同じ式・同じ飽和）
  const iL = ib - icNow; // 左の電磁石（x が負に寄ると強く）。飽和により 0 以上
  const iR = ib + icNow;
  const saturated = control && Math.abs(kp * xNow + kd * vNow) > ib;

  // ---- 下段：x(t)
  const PL = { x0: 56, x1: W - 16, y0: 250, y1: 420 };
  const px = (i: number) => PL.x0 + ((PL.x1 - PL.x0) * i) / (sim.x.length - 1);
  const py = (x: number) => (PL.y0 + PL.y1) / 2 - (x / lim) * ((PL.y1 - PL.y0) / 2);
  const path = sim.x.slice(0, idx + 1).map((x, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(x).toFixed(1)}`).join(" ");

  const mag = (x: number, mirror: boolean, cur: number) => {
    const s = mirror ? -1 : 1;
    const glow = Math.min(1, cur / (2 * ib));
    return (
      <g transform={`translate(${x},${cy}) scale(${s},1)`}>
        <path d="M0,-70 L-70,-70 L-70,70 L0,70 L0,46 L-44,46 L-44,-46 L0,-46 Z" fill="var(--accent)" opacity={0.85} />
        <rect x={-66} y={-40} width={18} height={80} fill={HEAVY} opacity={0.15 + 0.6 * glow} />
        <text x={-58} y={92} fontSize="11" fill="var(--mut)" textAnchor="middle" transform={mirror ? "scale(-1,1)" : undefined}>
          {fmt(cur, 2)} A
        </text>
      </g>
    );
  };

  return (
    <div className="aa-block my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <div className="mb-2 font-serif text-base text-ink">{config.title}</div> : null}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => setControl(false)}
          className={"rounded-full border px-3 py-1 transition-colors " + (!control ? "border-accent bg-accent/10 text-accent" : "border-line text-mut hover:border-accent hover:text-accent")}
        >
          制御なし
        </button>
        <button
          onClick={() => setControl(true)}
          className={"rounded-full border px-3 py-1 transition-colors " + (control ? "border-accent bg-accent/10 text-accent" : "border-line text-mut hover:border-accent hover:text-accent")}
        >
          PD 制御
        </button>
        <button onClick={() => setRun((r) => r + 1)} className="rounded-full border border-line px-3 py-1 text-mut transition-colors hover:border-accent hover:text-accent">
          もう一度（初期変位 50 μm から）
        </button>
        <span className="ml-auto text-mut">
          {stable
            ? `安定：fₙ ≈ ${fmt(wn / (2 * Math.PI))} Hz、ζ ≈ ${zeta.toFixed(2)}`
            : marginal
              ? `減衰ゼロ：fₙ ≈ ${fmt(wn / (2 * Math.PI))} Hz で揺れ続ける`
              : control
                ? "不安定：kᵢ·k_p が負の剛性 k_s を割っている（剛性不足）"
                : "不安定：負の剛性だけ"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="磁気軸受の 1 自由度模型と変位の時間波形">
        {/* 上段 */}
        {mag(cx - poleGap, false, iL)}
        {mag(cx + poleGap, true, iR)}
        {/* バックアップ軸受のすきま（破線） */}
        <line x1={cx - 120} y1={cy - 60} x2={cx - 120} y2={cy + 60} stroke="var(--mut)" strokeDasharray="3 3" />
        <line x1={cx + 120} y1={cy - 60} x2={cx + 120} y2={cy + 60} stroke="var(--mut)" strokeDasharray="3 3" />
        <text x={cx} y={SC.y1 + 12} fontSize="11" fill="var(--mut)" textAnchor="middle">
          破線＝バックアップ軸受のすきま（±{fmt(lim * 1e6)} μm、ギャップの半分。すきまは誇張）
        </text>
        {/* 回転子 */}
        <circle cx={rotorX} cy={cy} r={rotorR} fill="#e9eef5" stroke="var(--accent)" strokeWidth={2.5} />
        <circle cx={rotorX} cy={cy} r={5} fill={sim.hit !== null && frac >= (sim.tHit ?? 1) / T_SIM ? HEAVY : "var(--accent)"} />
        <text x={rotorX} y={cy - rotorR - 8} fontSize="12" fill="var(--ink)" textAnchor="middle" className="font-ui">
          x = {fmt(xNow * 1e6)} μm
        </text>
        {/* 下段 */}
        <line x1={PL.x0} y1={PL.y0} x2={PL.x0} y2={PL.y1} stroke="var(--line)" />
        <line x1={PL.x0} y1={(PL.y0 + PL.y1) / 2} x2={PL.x1} y2={(PL.y0 + PL.y1) / 2} stroke="var(--line)" />
        <line x1={PL.x0} y1={PL.y0} x2={PL.x1} y2={PL.y0} stroke={HEAVY} strokeDasharray="4 3" opacity={0.6} />
        <line x1={PL.x0} y1={PL.y1} x2={PL.x1} y2={PL.y1} stroke={HEAVY} strokeDasharray="4 3" opacity={0.6} />
        <text x={PL.x0 - 6} y={PL.y0 + 4} fontSize="10" fill={HEAVY} textAnchor="end">+{fmt(lim * 1e6)}</text>
        <text x={PL.x0 - 6} y={PL.y1 + 4} fontSize="10" fill={HEAVY} textAnchor="end">−{fmt(lim * 1e6)}</text>
        <text x={PL.x0 - 6} y={(PL.y0 + PL.y1) / 2 + 4} fontSize="10" fill="var(--mut)" textAnchor="end">0</text>
        <text x={PL.x1} y={PL.y1 + 16} fontSize="11" fill="var(--mut)" textAnchor="end">時間 →（0〜{fmt(T_SIM * 1e3)} ms、再生は {PLAY_SEC} 秒に引き伸ばし）</text>
        <text x={PL.x0} y={PL.y0 - 8} fontSize="11" fill="var(--mut)">回転子の変位 x（μm）</text>
        <path d={path} fill="none" stroke={control ? "var(--accent)" : HEAVY} strokeWidth={2} />
        {sim.hit !== null && sim.tHit !== null && frac >= sim.tHit / T_SIM ? (
          <text x={px(Math.round((sim.tHit / T_SIM) * (sim.x.length - 1)))} y={py(sim.hit) + (sim.hit > 0 ? 14 : -6)} fontSize="11" fill={HEAVY}>
            {fmt(sim.tHit * 1e3, 1)} ms でバックアップ軸受に当たる
          </text>
        ) : null}
        <circle cx={px(idx)} cy={py(xNow)} r={4} fill={GOLD} />
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-mut sm:grid-cols-4">
        <span>負の剛性 k_s = {fmt(ks / 1e6, 2)} MN/m（偏った向きへ引く）</span>
        <span>電流剛性 k_i = {fmt(ki)} N/A</span>
        <span>閉ループ剛性 k_i·k_p − k_s = {control ? fmt(kEff / 1e6, 2) : "—"} MN/m</span>
        <span>閉ループ減衰 k_i·k_d = {control ? fmt(cEff) : "—"} N·s/m</span>
      </div>
      <div className="mt-1 text-xs text-mut">
        線形化の有効範囲：|x| ≪ g₀ = {fmt(g0 * 1e3)} μm、|i_c| ≪ i_b = {fmt(ib, 1)} A（制御電流は |i_c| ≤ i_b で打ち切り）
        {saturated ? <span className="ml-2" style={{ color: HEAVY }}>いま電流が飽和しています</span> : null}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Slider label="バイアス電流 i_b" value={ib} min={0.5} max={3} step={0.1} unit="A" onChange={setIb} />
        <Slider label="公称ギャップ g₀" value={g0} min={0.3} max={1} step={0.05} unit="mm" onChange={setG0} />
        <Slider label="比例ゲイン k_p（位置を見て押し返す）" value={kp} min={0} max={20000} step={100} unit="A/m" onChange={setKp} />
        <Slider label="微分ゲイン k_d（速さを見て踏ん張る）" value={kd} min={0} max={15} step={0.1} unit="A·s/m" onChange={setKd} />
      </div>
      {config.caption ? <p className="mt-2 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
      <p className="mt-1 text-xs text-mut">
        模式：1 自由度・線形化（F ≈ k_i·i_c + k_s·x）、質量 {MASS} kg、磁極面積 {fmt(AREA * 1e4)} cm²・巻数 {NTURN}。制御電流は |i_c| ≤ i_b で飽和させるが、電圧の飽和・電流の変化率の限界・増幅器・センサ・渦電流の遅れは含まない。「もう一度」は初期変位 50 μm・初速 0 からの自由応答の再生で、力の入力ではない。
      </p>
    </div>
  );
}
