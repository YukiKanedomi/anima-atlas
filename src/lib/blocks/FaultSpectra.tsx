import { useMemo, useState } from "react";
import { ampSpectrum } from "../fft";

// ドメイン部品：故障の「指紋」。故障の種類を選ぶと、その典型的な合成信号を作り、
// 本物の FFT（Hann 窓、Spectrum.tsx と同じ）でスペクトルと時間波形を描く。
// 横軸は次数（回転数の何倍か）。縦軸は見やすさのため正規化。
// ※ 各故障の成分表は診断の教科書的な経験則を「典型例」として数値化した模式であり、
//    実機の振幅比・位相・側帯波の数は機械ごとに異なる。

export type FaultSpectraConfig = {
  title?: string;
  caption?: string;
  link?: string;
  faultDefault?: string; // 最初に選ぶ故障の key
};

type Fault = {
  key: string;
  label: string;
  comps: { f: number; a: number; ph?: number }[]; // 次数・振幅・位相
  fmax: number; // 表示する最大次数
  revs: number; // 時間波形に見せる回転数
  clip?: "top" | "bottom"; // 波形の頭打ち（非線形の模式）
  clipAt?: number; // 頭打ちの高さ（ピークに対する比）
  marks: { f: number; text: string }[]; // スペクトル上のラベル
  reading: string; // 読み方 1 行
};

const FAULTS: Fault[] = [
  {
    key: "unbalance",
    label: "不釣り合い",
    comps: [{ f: 1, a: 1.0 }, { f: 2, a: 0.06 }, { f: 3, a: 0.03 }],
    fmax: 8,
    revs: 4,
    marks: [{ f: 1, text: "1× が独り勝ち" }],
    reading: "きれいな正弦波と、1× だけが高い山。危険速度より十分低い範囲では、回転数を上げると 1× の高さが回転数の 2 乗に近い勢いで増えます。",
  },
  {
    key: "misalignment",
    label: "ミスアライメント",
    comps: [{ f: 1, a: 0.6 }, { f: 2, a: 0.85, ph: 0.9 }, { f: 3, a: 0.25, ph: 0.3 }],
    fmax: 8,
    revs: 4,
    marks: [{ f: 2, text: "2× が 1× と並ぶか追い越す" }, { f: 3, text: "3×" }],
    reading: "1 回転に 2 つの山がある波形。2× が目立ち、軸方向の振動も大きく、典型例では継手をはさんだ両側（同じ方向で測定）の位相が約 180° 違います。",
  },
  {
    key: "looseness",
    label: "機械的な緩み",
    comps: [
      { f: 0.5, a: 0.22 },
      { f: 1, a: 0.9 },
      { f: 1.5, a: 0.18 },
      { f: 2, a: 0.55 },
      { f: 2.5, a: 0.14 },
      { f: 3, a: 0.45 },
      { f: 4, a: 0.35 },
      { f: 5, a: 0.3 },
      { f: 6, a: 0.25 },
      { f: 7, a: 0.2 },
      { f: 8, a: 0.17 },
    ],
    fmax: 10,
    revs: 4,
    clip: "bottom",
    clipAt: 0.55,
    marks: [{ f: 1, text: "1×" }, { f: 0.5, text: "½×" }, { f: 4, text: "高調波が長く並ぶ" }],
    reading: "高調波がずらりと並び、½× などの分数調波も混じります。波形は片側だけ頭打ちになることがあり、ボルトや台座のがたつきが疑われます。",
  },
  {
    key: "rub",
    label: "ラビング（接触）",
    comps: [{ f: 0.5, a: 0.4 }, { f: 1, a: 0.85 }, { f: 1.5, a: 0.15 }, { f: 2, a: 0.3 }, { f: 3, a: 0.2 }],
    fmax: 8,
    revs: 4,
    clip: "top",
    clipAt: 0.7,
    marks: [{ f: 0.5, text: "½× が立つ" }, { f: 1, text: "1×" }],
    reading: "波形の山が平らに削られ（接触して押し返されている）、½× などの分数調波が立ちます。軌道と昇速時の挙動を合わせて見ます。",
  },
  {
    key: "oilwhirl",
    label: "オイルホワール",
    comps: [{ f: 0.45, a: 0.9 }, { f: 1, a: 0.5 }],
    fmax: 6,
    revs: 6,
    marks: [{ f: 0.45, text: "0.42〜0.48× に 1× より高い山" }, { f: 1, text: "1×" }],
    reading: "回転より遅い、1× の少し左の山。1× の半分弱の位置に立ち、回転数を変えてもその比を保って動きます。",
  },
  {
    key: "bearing",
    label: "転がり軸受（外輪の傷）",
    comps: [{ f: 1, a: 0.3 }, { f: 3.58, a: 0.7 }, { f: 7.16, a: 0.55 }, { f: 10.74, a: 0.4 }, { f: 14.32, a: 0.3 }],
    fmax: 16,
    revs: 4,
    marks: [{ f: 3.58, text: "BPFO（整数倍でない）" }, { f: 7.16, text: "2×BPFO" }, { f: 10.74, text: "3×BPFO" }],
    reading: "回転数の整数倍ではない位置（この例では 3.58×）に、等間隔の列が並びます。間隔が軸受の幾何で決まる周波数と合えば、傷の場所まで推定できます。",
  },
  {
    key: "gear",
    label: "歯車のかみ合い",
    comps: [
      { f: 1, a: 0.35 },
      { f: 20, a: 1.0 },
      { f: 19, a: 0.3 },
      { f: 21, a: 0.3 },
      { f: 18, a: 0.1 },
      { f: 22, a: 0.1 },
    ],
    fmax: 26,
    revs: 2,
    marks: [{ f: 20, text: "かみ合い周波数（歯数 × 回転数）" }, { f: 1, text: "1×" }],
    reading: "歯数 × 回転数の高い山（ここでは 20 枚で 20×）と、その両脇に回転数間隔で並ぶ側帯波。側帯波が増えると、歯の傷や偏心が疑われます。",
  },
];

const W = 640;
const H = 440;
const NF = 2048; // FFT 点数
const TPER = 32; // 窓に入れる回転数 → 分解能 1/32 次
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";

// 決定的な擬似乱数（表示が毎回変わらないように）
function noise(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function synth(fault: Fault, t: number, i: number): number {
  let s = 0;
  for (const c of fault.comps) s += c.a * Math.sin(2 * Math.PI * c.f * t + (c.ph ?? 0));
  s += 0.035 * noise(i);
  return s;
}

function shape(fault: Fault, s: number, peak: number): number {
  if (fault.clip === "top") return Math.min(s, (fault.clipAt ?? 0.7) * peak);
  if (fault.clip === "bottom") return Math.max(s, -(fault.clipAt ?? 0.7) * peak);
  return s;
}

export default function FaultSpectra({ config }: { config: FaultSpectraConfig }) {
  const [key, setKey] = useState<string>(
    FAULTS.some((f) => f.key === config.faultDefault) ? (config.faultDefault as string) : FAULTS[0].key
  );
  const fault = FAULTS.find((f) => f.key === key) ?? FAULTS[0];

  const { mag, wave } = useMemo(() => {
    const peak = fault.comps.reduce((a, c) => a + c.a, 0);
    const sig = new Float64Array(NF);
    for (let i = 0; i < NF; i++) {
      const t = (TPER * i) / NF;
      sig[i] = shape(fault, synth(fault, t, i), peak);
    }
    // 直流分を除く（実機の振動計測は交流結合。頭打ちの模式で生じる平均値のずれを 0× の山として出さない）
    let mean = 0;
    for (let i = 0; i < NF; i++) mean += sig[i];
    mean /= NF;
    for (let i = 0; i < NF; i++) sig[i] -= mean;
    const mag = ampSpectrum(sig, true);
    const M = 480;
    const wave: number[] = [];
    for (let i = 0; i <= M; i++) {
      const t = (fault.revs * i) / M;
      wave.push(shape(fault, synth(fault, t, i * 7), peak));
    }
    return { mag, wave };
  }, [fault]);

  // 描画領域
  const padL = 20;
  const padR = 16;
  const timeTop = 18;
  const timeH = 100;
  const timeMid = timeTop + timeH / 2;
  const specTop = 170;
  const specBot = H - 36;

  const kMax = Math.min(mag.length - 1, Math.floor(fault.fmax * TPER));
  let mmax = 0.001;
  for (let k = 1; k <= kMax; k++) if (mag[k] > mmax) mmax = mag[k];
  const yMax = mmax * 1.15;
  const sx = (f: number) => padL + (f / fault.fmax) * (W - padL - padR);
  const sy = (m: number) => specBot - (Math.min(m, yMax) / yMax) * (specBot - specTop);

  const specD = (() => {
    let d = `M${sx(0).toFixed(1)},${sy(0).toFixed(1)}`;
    for (let k = 0; k <= kMax; k++) d += ` L${sx(k / TPER).toFixed(1)},${sy(mag[k]).toFixed(1)}`;
    d += ` L${sx(fault.fmax).toFixed(1)},${sy(0).toFixed(1)} Z`;
    return d;
  })();

  const wmax = Math.max(0.001, ...wave.map((v) => Math.abs(v)));
  const sxT = (i: number) => padL + (i / (wave.length - 1)) * (W - padL - padR);
  const syT = (v: number) => timeMid - (v / wmax) * (timeH / 2) * 0.92;
  const timeD = wave.map((v, i) => `${i === 0 ? "M" : "L"}${sxT(i).toFixed(1)},${syT(v).toFixed(1)}`).join("");

  // 次数の目盛：fmax が大きいときは間引く
  const tickStep = fault.fmax > 12 ? 5 : 1;
  const ticks: number[] = [];
  for (let o = tickStep; o <= fault.fmax; o += tickStep) ticks.push(o);

  // ラベルの段（近いものは別の段へ）
  const marks = [...fault.marks].sort((a, b) => a.f - b.f);

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FAULTS.map((f) => {
          const on = f.key === fault.key;
          return (
            <button
              key={f.key}
              onClick={() => setKey(f.key)}
              aria-pressed={on}
              className={
                "rounded border px-2 py-1 text-xs transition-colors " +
                (on
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line bg-white text-mut hover:border-accent hover:text-accent")
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${fault.label}の時間波形とスペクトル`}>
        {/* 時間波形 */}
        <text x={padL} y={timeTop - 4} fontSize="12" fill="var(--mut)">
          時間波形（{fault.revs} 回転分）
        </text>
        <rect x={padL} y={timeTop} width={W - padL - padR} height={timeH} fill="var(--soft)" opacity={0.35} />
        {Array.from({ length: fault.revs + 1 }, (_, r) => (
          <line
            key={r}
            x1={padL + (r / fault.revs) * (W - padL - padR)}
            y1={timeTop}
            x2={padL + (r / fault.revs) * (W - padL - padR)}
            y2={timeTop + timeH}
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
        ))}
        <line x1={padL} y1={timeMid} x2={W - padR} y2={timeMid} stroke="var(--line)" />
        {fault.clip ? (
          <line
            x1={padL}
            y1={syT((fault.clip === "top" ? 1 : -1) * (fault.clipAt ?? 0.7) * fault.comps.reduce((a, c) => a + c.a, 0))}
            x2={W - padR}
            y2={syT((fault.clip === "top" ? 1 : -1) * (fault.clipAt ?? 0.7) * fault.comps.reduce((a, c) => a + c.a, 0))}
            stroke={HEAVY}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        ) : null}
        <path d={timeD} fill="none" stroke="var(--accent)" strokeWidth={1.6} />

        {/* スペクトル */}
        <text x={padL} y={specTop - 8} fontSize="12" fill="var(--mut)">
          スペクトル（横軸は次数＝回転数の何倍か。縦軸は正規化）
        </text>
        <line x1={padL} y1={specBot} x2={W - padR} y2={specBot} stroke="var(--line)" />
        {ticks.map((o) => (
          <g key={o}>
            <line x1={sx(o)} y1={specTop} x2={sx(o)} y2={specBot} stroke="var(--line)" opacity={0.6} />
            <text x={sx(o)} y={specBot + 16} fontSize="11" fill="var(--mut)" textAnchor="middle">
              {o}×
            </text>
          </g>
        ))}
        {/* 1× の位置は常に目立たせる */}
        <line x1={sx(1)} y1={specTop} x2={sx(1)} y2={specBot} stroke={GOLD} opacity={0.5} strokeDasharray="2 3" />
        <path d={specD} fill="var(--accent)" opacity={0.16} stroke="var(--accent)" strokeWidth={1.5} />
        {marks.map((m, i) => {
          // 点は実際の FFT のビン（k/TPER）に置く。3.58× のように 1/32 次の目盛に乗らない周波数でも、曲線の標本点とずれない
          const k = Math.round(m.f * TPER);
          const fk = k / TPER;
          const y = sy(mag[k] ?? 0) - 8 - (i % 2) * 14;
          const anchor = m.f > fault.fmax * 0.7 ? "end" : m.f < fault.fmax * 0.12 ? "start" : "middle";
          return (
            <g key={m.f}>
              <circle cx={sx(fk)} cy={sy(mag[k] ?? 0)} r={3} fill={HEAVY} />
              <text x={sx(fk)} y={y} fontSize="11" fill={HEAVY} textAnchor={anchor}>
                {m.text}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-2 rounded bg-soft/50 px-3 py-2 text-sm leading-relaxed text-ink/90">
        <span className="mr-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">読み方</span>
        {fault.reading}
      </p>
      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
