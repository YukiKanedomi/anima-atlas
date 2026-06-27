import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：FFTスペクトル（振動診断の核）。
// 成分（1×不釣り合い・2×ミスアライメント・0.43×オイルホワール 等）を足し合わせて
// 時間信号を作り、本物のFFTで周波数スペクトルに分解して表示する。
// 上＝ごちゃっとした時間波形、下＝きれいなピーク。スライダーで各成分を増減。
// ※ 実際に Cooley–Tukey FFT を計算（Hann窓）。ピーク位置・相対高さは本物。

export type SpectrumComponent = {
  key: string; // 振幅のパラメータ名
  freq: number; // 次数（×：基本回転数の何倍か）
  label: string;
  color?: "accent" | "heavy" | "mut";
  default?: number;
};

export type SpectrumConfig = {
  title?: string;
  caption?: string;
  link?: string;
  components: SpectrumComponent[];
};

const W = 640;
const H = 430;
const NF = 512; // FFT点数（2のべき）
const TPER = 32; // 窓に入れる基本周期の数 → 分解能 1/32 次
const FMAX = 4.5; // 表示する最大次数
const COLORS: Record<string, string> = {
  accent: "var(--accent)",
  heavy: "#9b2d3a",
  mut: "var(--mut)",
};

// 反復 Cooley–Tukey FFT（in-place、N=2のべき）
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const c = Math.cos(ang * k);
        const s = Math.sin(ang * k);
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + half] * c - im[i + k + half] * s;
        const bi = re[i + k + half] * s + im[i + k + half] * c;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + half] = ar - br;
        im[i + k + half] = ai - bi;
      }
    }
  }
}

export default function Spectrum({ config }: { config: SpectrumConfig }) {
  const comps = config.components ?? [];
  const instId = useInstanceId("spec");
  const [vals, setParam] = useSharedParams(
    config.link ?? instId,
    Object.fromEntries(comps.map((c) => [c.key, c.default ?? 0.3]))
  );

  // 周波数スペクトル（本物のFFT）
  const { mag, specYMax, peaks } = useMemo(() => {
    const re = new Float64Array(NF);
    const im = new Float64Array(NF);
    for (let i = 0; i < NF; i++) {
      const t = (TPER * i) / NF; // 単位：基本周期（1×の周期=1）
      let s = 0;
      for (const c of comps) s += (vals[c.key] ?? 0) * Math.sin(2 * Math.PI * c.freq * t);
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (NF - 1))); // Hann窓
      re[i] = s * w;
    }
    fft(re, im);
    const kMax = Math.floor(FMAX * TPER);
    const mag: number[] = [];
    let mmax = 0.001;
    for (let k = 0; k <= kMax; k++) {
      const m = (2 * Math.hypot(re[k], im[k])) / (NF * 0.5); // Hann利得補正
      mag.push(m);
      if (m > mmax) mmax = m;
    }
    const yMax = mmax * 1.15;
    const peaks = comps.map((c) => ({ ...c, amp: vals[c.key] ?? 0 }));
    return { mag, specYMax: yMax, peaks };
  }, [vals, comps]);

  // 描画領域
  const timeTop = 18;
  const timeH = 96;
  const timeMid = timeTop + timeH / 2;
  const specTop = 160;
  const specBot = H - 34;
  const padL = 20;
  const padR = 16;

  const sxFreq = (f: number) => padL + (f / FMAX) * (W - padL - padR);
  const syMag = (m: number) => specBot - (Math.min(m, specYMax) / specYMax) * (specBot - specTop);

  // ラベルが重ならないよう、周波数順に段を割り当てる（隣同士は別の段）
  const labelRow = useMemo(() => {
    const map: Record<string, number> = {};
    [...peaks].sort((a, b) => a.freq - b.freq).forEach((p, i) => (map[p.key] = i % 3));
    return map;
  }, [peaks]);

  const specD = (() => {
    let d = `M${sxFreq(0).toFixed(1)},${syMag(0).toFixed(1)}`;
    for (let k = 0; k < mag.length; k++) {
      const f = k / TPER;
      d += ` L${sxFreq(f).toFixed(1)},${syMag(mag[k]).toFixed(1)}`;
    }
    d += ` L${sxFreq(FMAX).toFixed(1)},${syMag(0).toFixed(1)} Z`;
    return d;
  })();

  // 時間波形（生信号、3周期）
  const timeD = (() => {
    const maxAmp = Math.max(0.001, comps.reduce((a, c) => a + Math.abs(vals[c.key] ?? 0), 0));
    const sxT = (u: number) => padL + (u / 3) * (W - padL - padR);
    const syT = (v: number) => timeMid - (v / maxAmp) * (timeH / 2);
    let d = "";
    const M = 360;
    for (let i = 0; i <= M; i++) {
      const t = (3 * i) / M;
      let s = 0;
      for (const c of comps) s += (vals[c.key] ?? 0) * Math.sin(2 * Math.PI * c.freq * t);
      d += `${i === 0 ? "M" : "L"}${sxT(t).toFixed(1)},${syT(s).toFixed(1)}`;
    }
    return d;
  })();

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="FFTスペクトル">
        {/* 時間波形 */}
        <text x={padL} y={timeTop - 4} fontSize="12" fill="var(--mut)">
          時間波形（足し合わせ）
        </text>
        <rect x={padL} y={timeTop} width={W - padL - padR} height={timeH} fill="var(--soft)" opacity={0.35} />
        <line x1={padL} y1={timeMid} x2={W - padR} y2={timeMid} stroke="var(--line)" />
        <path d={timeD} fill="none" stroke="var(--accent)" strokeWidth={1.8} />

        {/* スペクトル */}
        <text x={padL} y={specTop - 8} fontSize="12" fill="var(--mut)">
          スペクトル（周波数に分解）
        </text>
        <line x1={padL} y1={specBot} x2={W - padR} y2={specBot} stroke="var(--line)" />
        {/* 次数の目盛 */}
        {[1, 2, 3, 4].map((o) => (
          <g key={o}>
            <line x1={sxFreq(o)} y1={specTop} x2={sxFreq(o)} y2={specBot} stroke="var(--line)" opacity={0.6} />
            <text x={sxFreq(o)} y={specBot + 16} fontSize="11" fill="var(--mut)" textAnchor="middle">
              {o}×
            </text>
          </g>
        ))}
        {/* スペクトル本体 */}
        <path d={specD} fill="var(--accent)" opacity={0.16} stroke="var(--accent)" strokeWidth={1.6} />
        {/* 成分ラベル */}
        {peaks.map((p) =>
          p.amp > 0.02 ? (
            <text
              key={p.key}
              x={sxFreq(p.freq)}
              y={specTop + 4 + (labelRow[p.key] ?? 0) * 14}
              fontSize="11"
              fill={COLORS[p.color ?? "accent"]}
              textAnchor="middle"
            >
              {p.label}
            </text>
          ) : null
        )}
      </svg>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {comps.map((c) => (
          <Slider
            key={c.key}
            label={c.label}
            value={vals[c.key] ?? 0}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setParam(c.key, v)}
          />
        ))}
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
