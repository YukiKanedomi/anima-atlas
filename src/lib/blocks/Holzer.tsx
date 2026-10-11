import { useEffect, useMemo, useState } from "react";
import { Slider } from "../../components/Slider";

// ドメイン部品：多慣性ねじり系の Holzer 法。
// 慣性 I₁…Iₙ を軸（ねじり剛性 k₁…kₙ₋₁）でつないだ直列系で、
//   試しの角振動数 ω を仮定し、左端を θ₁=1 として、
//   慣性トルク T += Iᵢ ω² θᵢ を足しながら軸を渡り（θᵢ₊₁ = θᵢ − T/kᵢ）、
//   右端で残った「残留トルク」T_res(ω) を描く。T_res = 0 になる ω が固有角振動数、
//   そのときの θ の列がモード形。ω = 0 の根は全体が一緒に回る剛体回転。
// 無次元：I と k は相対値（基準 I₀, k₀）、ω は √(k₀/I₀) 単位。
// ※ 値・形は式どおり。円板の大きさとねじれ角の棒は見やすさのための模式。

export type HolzerConfig = {
  title?: string;
  caption?: string;
  link?: string;
  nDefault?: number; // 慣性の数 3..5
  inertias?: number[]; // 既定の相対慣性（長さ n 以上）
  stiffnesses?: number[]; // 既定の相対剛性（長さ n−1 以上）
  labels?: string[]; // 慣性のラベル
};

const W = 660;
const HT = 230; // 上段（残留トルク曲線）
const HB = 250; // 下段（軸系とモード形）
const H = HT + HB;
const PAD_L = 52;
const PAD_R = 18;
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";
const DEF_I = [1, 0.5, 2, 1.2, 0.8];
const DEF_K = [1, 1, 1.5, 0.8];
const DEF_LABELS = ["電動機", "減速機", "圧縮機", "圧縮機（2段目）", "はずみ車"];
const NPTS = 700;

// Holzer の一回の掃引：θ の列と残留トルクを返す
function holzerPass(I: number[], k: number[], w2: number): { theta: number[]; torque: number[]; res: number } {
  const n = I.length;
  const theta: number[] = [1];
  const torque: number[] = [];
  let T = 0;
  for (let i = 0; i < n; i++) {
    T += I[i] * w2 * theta[i];
    torque.push(T);
    if (i < n - 1) theta.push(theta[i] - T / k[i]);
  }
  return { theta, torque, res: T };
}

// 残留トルクのゼロ交差（ω>0）を二分法で詰める
function naturalFrequencies(I: number[], k: number[], wMax: number): number[] {
  const roots: number[] = [];
  let prev = holzerPass(I, k, 0).res;
  let wPrev = 0;
  const N = 2000;
  for (let i = 1; i <= N; i++) {
    const w = (wMax * i) / N;
    const r = holzerPass(I, k, w * w).res;
    if (i > 2 && prev !== 0 && Math.sign(r) !== Math.sign(prev)) {
      let a = wPrev;
      let b = w;
      let fa = prev;
      for (let it = 0; it < 50; it++) {
        const m = (a + b) / 2;
        const fm = holzerPass(I, k, m * m).res;
        if (Math.sign(fm) === Math.sign(fa)) {
          a = m;
          fa = fm;
        } else b = m;
      }
      roots.push((a + b) / 2);
    }
    prev = r;
    wPrev = w;
  }
  return roots;
}

export default function Holzer({ config }: { config: HolzerConfig }) {
  const nInit = Math.min(5, Math.max(3, config.nDefault ?? 3));
  const [n, setN] = useState(nInit);
  const [I, setI] = useState<number[]>(() => Array.from({ length: 5 }, (_, i) => config.inertias?.[i] ?? DEF_I[i]));
  const [k, setK] = useState<number[]>(() => Array.from({ length: 4 }, (_, i) => config.stiffnesses?.[i] ?? DEF_K[i]));
  const labels = Array.from({ length: 5 }, (_, i) => config.labels?.[i] ?? DEF_LABELS[i]);

  const In = useMemo(() => I.slice(0, n), [I, n]);
  const kn = useMemo(() => k.slice(0, n - 1), [k, n]);

  // 掃引の上限：M⁻¹K の行和の最大（Gershgorin）から
  const wMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i < n; i++) {
      const s = (i > 0 ? kn[i - 1] : 0) + (i < n - 1 ? kn[i] : 0);
      m = Math.max(m, (2 * s) / In[i]);
    }
    return Math.sqrt(m) * 1.04;
  }, [In, kn, n]);

  const roots = useMemo(() => naturalFrequencies(In, kn, wMax), [In, kn, wMax]);

  // 試しの ω（Holzer の「仮定」）。モードのボタンで根へ飛ぶ
  const [wTrial, setWTrial] = useState(0.6);
  const [mode, setMode] = useState(0);
  useEffect(() => {
    if (roots[mode] !== undefined) setWTrial(roots[mode]);
    else if (roots.length) {
      setMode(0);
      setWTrial(roots[0]);
    }
    // 根が動いたら（慣性・剛性を変えたら）選んでいるモードの根へ追従
  }, [roots, mode]);

  const pass = useMemo(() => holzerPass(In, kn, wTrial * wTrial), [In, kn, wTrial]);

  // 残留トルク曲線（圧縮表示：ゼロ交差の位置が主役）
  const curve = useMemo(() => {
    const pts: { w: number; r: number }[] = [];
    let sumAbs = 0;
    for (let i = 0; i <= NPTS; i++) {
      const w = (wMax * i) / NPTS;
      const r = holzerPass(In, kn, w * w).res;
      pts.push({ w, r });
      sumAbs += Math.abs(r);
    }
    const s = (sumAbs / (NPTS + 1)) * 0.6 + 1e-9;
    return { pts, s };
  }, [In, kn, wMax]);
  const squash = (r: number) => r / (Math.abs(r) + curve.s);

  // 上段の座標
  const plotW = W - PAD_L - PAD_R;
  const yMid = 24 + (HT - 60) / 2;
  const yAmp = (HT - 60) / 2;
  const xOf = (w: number) => PAD_L + (w / wMax) * plotW;
  const yOf = (r: number) => yMid - squash(r) * yAmp;
  const path = curve.pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.w).toFixed(1)},${yOf(p.r).toFixed(1)}`).join("");

  // 下段：軸系とモード形
  const yAxis = HT + 150; // 軸の中心線
  const xDisk = (i: number) => PAD_L + 40 + ((plotW - 80) * i) / (n - 1);
  const thMax = Math.max(...pass.theta.map((t) => Math.abs(t)), 1e-9);
  const BAR = 54; // θ=±1 の棒の高さ
  const yBar = (t: number) => HT + 70 - (t / thMax) * BAR;
  const cbrtScale = (v: number) => 20 * Math.cbrt(v);
  // 節：隣り合う θ の符号が変わる区間を線形補間
  const nodes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pass.theta[i];
    const b = pass.theta[i + 1];
    if (a === 0) nodes.push(xDisk(i));
    else if (Math.sign(a) !== Math.sign(b) && b !== 0) nodes.push(xDisk(i) + ((xDisk(i + 1) - xDisk(i)) * a) / (a - b));
  }
  const resNorm = Math.abs(pass.res) / (Math.abs(pass.res) + curve.s);
  // 根の判定は残留トルクの大きさで行う（周波数の近さだけでは残留が残っていても根扱いになる）
  const isRoot = Math.abs(pass.res) <= curve.s * 0.01;

  const setIAt = (i: number, v: number) => setI((arr) => arr.map((x, j) => (j === i ? v : x)));
  const setKAt = (i: number, v: number) => setK((arr) => arr.map((x, j) => (j === i ? v : x)));

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      {/* 慣性の数とモードの選択 */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-mut">慣性の数</span>
        <div className="flex gap-1">
          {[3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setN(v);
                setMode(0);
              }}
              className={
                "rounded border px-2.5 py-0.5 text-sm transition-colors " +
                (v === n ? "border-accent bg-accent/10 text-accent" : "border-line text-mut hover:border-accent hover:text-accent")
              }
            >
              {v}
            </button>
          ))}
        </div>
        <span className="text-mut">モード</span>
        <div className="flex gap-1">
          {roots.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setMode(i);
                setWTrial(r);
              }}
              className={
                "rounded border px-2.5 py-0.5 text-sm tabular-nums transition-colors " +
                (Math.abs(r - wTrial) < wMax * 0.004
                  ? "border-[#9b2d3a] bg-[#9b2d3a]/10 text-[#9b2d3a]"
                  : "border-line text-mut hover:border-accent hover:text-accent")
              }
            >
              {i + 1}次 ω={r.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Holzer 法：残留トルク曲線と、選んだ ω でのねじれ角の列">
        {/* ── 上段：残留トルク vs ω ── */}
        <text x={PAD_L} y={14} fontSize="11" fill="var(--mut)">
          右端の残留トルク（圧縮表示）
        </text>
        <line x1={PAD_L} y1={yMid} x2={W - PAD_R} y2={yMid} stroke="var(--line)" />
        <line x1={PAD_L} y1={yMid - yAmp} x2={PAD_L} y2={yMid + yAmp} stroke="var(--line)" />
        <text x={PAD_L - 6} y={yMid + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
          0
        </text>
        <text x={PAD_L - 6} y={yMid - yAmp + 8} fontSize="10" fill="var(--mut)" textAnchor="end">
          ＋
        </text>
        <text x={PAD_L - 6} y={yMid + yAmp} fontSize="10" fill="var(--mut)" textAnchor="end">
          −
        </text>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
        {/* ゼロ交差＝固有角振動数 */}
        {roots.map((r, i) => (
          <g key={i}>
            <circle cx={xOf(r)} cy={yMid} r={5} fill="#fff" stroke={GOLD} strokeWidth={2} />
            <text x={xOf(r)} y={yMid + yAmp + 16} fontSize="10" fill={GOLD} textAnchor="middle">
              ω{i + 1}
            </text>
          </g>
        ))}
        {/* 試しの ω（臙脂の縦線と点） */}
        <line x1={xOf(wTrial)} y1={yMid - yAmp} x2={xOf(wTrial)} y2={yMid + yAmp} stroke={HEAVY} strokeDasharray="3 3" />
        <circle cx={xOf(wTrial)} cy={yOf(pass.res)} r={5} fill={HEAVY} />
        <text x={W - PAD_R} y={yMid + yAmp + 16} fontSize="10" fill="var(--mut)" textAnchor="end">
          試しの角振動数 ω →
        </text>

        {/* ── 下段：ねじれ角の列（モード形）と軸系 ── */}
        <text x={PAD_L} y={HT + 10} fontSize="11" fill="var(--mut)">
          この ω で左端を θ₁ = 1 として渡ったときの、各慣性のねじれ角（数値は θ₁ = 1 の値、棒の高さは最大値で正規化）
        </text>
        <line x1={PAD_L + 20} y1={HT + 70} x2={W - PAD_R - 10} y2={HT + 70} stroke="var(--line)" />
        {/* モード形の折れ線 */}
        <polyline
          points={pass.theta.map((t, i) => `${xDisk(i).toFixed(1)},${yBar(t).toFixed(1)}`).join(" ")}
          fill="none"
          stroke={isRoot ? HEAVY : "var(--mut)"}
          strokeWidth={1.5}
          strokeDasharray={isRoot ? undefined : "4 3"}
        />
        {pass.theta.map((t, i) => (
          <g key={i}>
            <line x1={xDisk(i)} y1={HT + 70} x2={xDisk(i)} y2={yBar(t)} stroke={isRoot ? HEAVY : "var(--mut)"} strokeWidth={6} opacity={0.75} strokeLinecap="round" />
            <text x={xDisk(i)} y={t >= 0 ? yBar(t) - 8 : yBar(t) + 14} fontSize="10" fill="var(--ink)" textAnchor="middle">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {/* 節（符号が変わる位置） */}
        {nodes.map((x, i) => (
          <g key={i}>
            <line x1={x} y1={HT + 70 - BAR - 6} x2={x} y2={yAxis + 24} stroke={isRoot ? GOLD : "var(--mut)"} strokeDasharray="2 4" opacity={isRoot ? 0.8 : 0.5} />
            <circle cx={x} cy={yAxis} r={6} fill="#fff" stroke={isRoot ? GOLD : "var(--mut)"} strokeWidth={2} />
          </g>
        ))}
        {nodes.length ? (
          <text x={nodes[0]} y={yAxis + 40} fontSize="10" fill={isRoot ? GOLD : "var(--mut)"} textAnchor="middle">
            {isRoot ? "節（ねじれない断面）" : "試行形のゼロ交差（根ではない）"}
          </text>
        ) : null}
        {/* 右端の残留トルク（根でなければ矢印が残る） */}
        {!isRoot ? (
          <g>
            <line x1={xDisk(n - 1) + 16} y1={HT + 70} x2={xDisk(n - 1) + 16} y2={HT + 70 - Math.sign(pass.res) * (10 + 34 * resNorm)} stroke={HEAVY} strokeWidth={2} />
            <text x={xDisk(n - 1) + 22} y={HT + 70 - Math.sign(pass.res) * (12 + 34 * resNorm)} fontSize="10" fill={HEAVY}>
              残留
            </text>
          </g>
        ) : (
          <text x={xDisk(n - 1) + 20} y={HT + 74} fontSize="10" fill={HEAVY}>
            残留 ≈ 0
          </text>
        )}
        {/* 軸系：円板と軸 */}
        <line x1={xDisk(0)} y1={yAxis} x2={xDisk(n - 1)} y2={yAxis} stroke="var(--mut)" strokeWidth={5} opacity={0.6} />
        {kn.map((kv, i) => (
          <text key={i} x={(xDisk(i) + xDisk(i + 1)) / 2} y={yAxis - 12} fontSize="10" fill="var(--mut)" textAnchor="middle">
            k{i + 1}={kv.toFixed(1)}
          </text>
        ))}
        {In.map((Iv, i) => {
          const ry = cbrtScale(Iv) + 8;
          const rx = ry * 0.28;
          return (
            <g key={i}>
              <ellipse cx={xDisk(i)} cy={yAxis} rx={rx} ry={ry} fill="var(--accent)" opacity={0.14} />
              <ellipse cx={xDisk(i)} cy={yAxis} rx={rx} ry={ry} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
              <text x={xDisk(i)} y={yAxis + ry + 14} fontSize="10" fill="var(--accent)" textAnchor="middle">
                {labels[i]}
              </text>
              <text x={xDisk(i)} y={yAxis + ry + 26} fontSize="10" fill="var(--mut)" textAnchor="middle">
                I{i + 1}={Iv.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2">
        <Slider label="試しの角振動数 ω（Holzer の仮定）" value={wTrial} min={0.02} max={wMax} step={0.001} onChange={setWTrial} />
      </div>
      <div className="mt-2 tabular-nums text-sm text-mut">
        右端の残留トルク：<b className={isRoot ? "text-[#9b2d3a]" : "text-ink"}>{isRoot ? "ほぼ 0（固有角振動数）" : pass.res.toExponential(2)}</b>
        ／ 固有角振動数（ω=0 の剛体回転を除く）：
        <b className="text-ink">{roots.map((r) => r.toFixed(2)).join("、")}</b>
        <span className="text-mut">（×√(k₀/I₀)）</span>
      </div>

      <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-3">
        {In.map((Iv, i) => (
          <Slider key={"I" + i} label={`慣性 I${i + 1}（${labels[i]}）`} value={Iv} min={0.2} max={3} step={0.01} onChange={(v) => setIAt(i, v)} />
        ))}
        {kn.map((kv, i) => (
          <Slider key={"k" + i} label={`軸 ${i + 1}–${i + 2} のねじり剛性 k${i + 1}`} value={kv} min={0.3} max={3} step={0.01} onChange={(v) => setKAt(i, v)} />
        ))}
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
