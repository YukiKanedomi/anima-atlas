import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：フーリエ合成（倍音の足し算シンセ）。FFT章の顔。
// 「ギザギザの波も、丸い正弦波の足し算だけで作れる」を体感する古典デモ。
// 上＝時間波形（部分和・目標・いま足した1本）、下＝レシピ（倍音の振幅棒）。
// 下の棒グラフが「スペクトル」の正体——波形とレシピは同じものの二つの顔。
//   矩形波: (4/π)Σ sin((2i−1)t)/(2i−1)
//   のこぎり: (2/π)Σ (−1)^(k+1) sin(kt)/k
//   三角波: (8/π²)Σ (−1)^((i−1)) sin((2i−1)t)/(2i−1)²  ※iは項番号
// 部分和・収束・ギブスの飛び越し(ピーク≈1.179)は Node で検証済み＝式どおり。

export type FourierSynthConfig = {
  title?: string;
  caption?: string;
  link?: string;
  waveDefault?: "square" | "saw" | "triangle";
  nDefault?: number;
  nMax?: number;
};

const W = 640;
const H = 442;
const PL = 30;
const PR = 18;
// 時間波形パネル
const TT = 26;
const TB = 250;
const TSPAN = 4 * Math.PI;
// レシピ（スペクトル棒）パネル
const ST = 306;
const SB = 408;
const GOLD = "#c08a2e";

type WaveKey = "square" | "saw" | "triangle";
const WAVES: { key: WaveKey; label: string }[] = [
  { key: "square", label: "矩形波" },
  { key: "saw", label: "のこぎり波" },
  { key: "triangle", label: "三角波" },
];

// i番目（1始まり）の項：{k: 次数, a: 振幅（符号込み）}
function term(wave: WaveKey, i: number): { k: number; a: number } {
  if (wave === "square") {
    const k = 2 * i - 1;
    return { k, a: 4 / (Math.PI * k) };
  }
  if (wave === "saw") {
    return { k: i, a: ((2 / (Math.PI * i)) * (i % 2 === 1 ? 1 : -1)) };
  }
  const k = 2 * i - 1;
  return { k, a: (8 / (Math.PI * Math.PI * k * k)) * (i % 2 === 1 ? 1 : -1) };
}

function target(wave: WaveKey, t: number): number {
  if (wave === "square") return Math.sign(Math.sin(t)) || 1;
  if (wave === "saw") return ((((t + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / Math.PI - 1;
  return (2 / Math.PI) * Math.asin(Math.sin(t));
}

export default function FourierSynth({ config }: { config: FourierSynthConfig }) {
  const nMax = config.nMax ?? 12;
  const instId = useInstanceId("fs");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    n: config.nDefault ?? 1,
  });
  const n = Math.round(vals.n);
  const [wave, setWave] = useState<WaveKey>(config.waveDefault ?? "square");

  const sx = (t: number) => PL + (t / TSPAN) * (W - PL - PR);
  const syT = (v: number) => {
    const mid = (TT + TB) / 2;
    return mid - v * ((TB - TT) / 2 / 1.35); // ±1.35 を枠いっぱいに（ギブスの飛び越しも入る）
  };

  const { sumD, lastD, targetD, terms } = useMemo(() => {
    const terms = Array.from({ length: nMax }, (_, j) => term(wave, j + 1));
    const M = 480;
    let sumD = "";
    let lastD = "";
    let targetD = "";
    for (let s = 0; s <= M; s++) {
      const t = (TSPAN * s) / M;
      let acc = 0;
      for (let j = 0; j < n; j++) acc += terms[j].a * Math.sin(terms[j].k * t);
      const last = terms[n - 1];
      const lv = last.a * Math.sin(last.k * t);
      const cmd = s === 0 ? "M" : "L";
      sumD += `${cmd}${sx(t).toFixed(1)},${syT(acc).toFixed(1)}`;
      lastD += `${cmd}${sx(t).toFixed(1)},${syT(lv).toFixed(1)}`;
      // 目標波形は不連続点で線が飛ばないよう、矩形波・のこぎり波は区分ごとに M で切る
      const tv = target(wave, t);
      const prev = s > 0 ? target(wave, (TSPAN * (s - 1)) / M) : tv;
      targetD += `${s === 0 || Math.abs(tv - prev) > 1 ? "M" : "L"}${sx(t).toFixed(1)},${syT(tv).toFixed(1)}`;
    }
    return { sumD, lastD, targetD, terms };
  }, [wave, n, nMax]);

  // レシピ棒：次数 k の位置に |a| の棒
  const kMax = term(wave, nMax).k;
  const sxK = (k: number) => PL + 18 + ((k - 1) / (kMax - 1 || 1)) * (W - PL - PR - 36);
  const aMax = Math.abs(term(wave, 1).a);
  const syS = (a: number) => SB - (Math.abs(a) / aMax) * (SB - ST);

  const highestK = term(wave, n).k;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      {/* 目標波形の切替 */}
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-mut">作りたい波：</span>
        {WAVES.map((wv) => (
          <button
            key={wv.key}
            type="button"
            onClick={() => setWave(wv.key)}
            aria-pressed={wv.key === wave}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (wv.key === wave
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-mut hover:border-accent/50 hover:text-ink")
            }
          >
            {wv.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="フーリエ合成：正弦波の足し算">
        {/* 時間波形 */}
        <text x={PL} y={TT - 8} fontSize="12" fill="var(--mut)">
          時間波形：正弦波を {n} 本足したもの
        </text>
        <rect x={PL} y={TT} width={W - PL - PR} height={TB - TT} fill="var(--soft)" opacity={0.35} />
        <line x1={PL} y1={syT(0)} x2={W - PR} y2={syT(0)} stroke="var(--line)" />
        {/* 目標（破線） */}
        <path d={targetD} fill="none" stroke="var(--mut)" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.75} />
        {/* いま足した1本（金） */}
        <path d={lastD} fill="none" stroke={GOLD} strokeWidth={1.4} opacity={0.85} />
        {/* 部分和（主役） */}
        <path d={sumD} fill="none" stroke="var(--accent)" strokeWidth={2.2} />

        {/* レシピ（スペクトル棒） */}
        <text x={PL} y={ST - 10} fontSize="12" fill="var(--mut)">
          レシピ：何次の正弦波を、どれだけ入れるか（＝スペクトル）
        </text>
        <line x1={PL} y1={SB} x2={W - PR} y2={SB} stroke="var(--line)" />
        {terms.map(({ k, a }, j) => {
          const used = j < n;
          const newest = j === n - 1;
          return (
            <g key={k}>
              <line
                x1={sxK(k)}
                y1={SB}
                x2={sxK(k)}
                y2={syS(a)}
                stroke={newest ? GOLD : used ? "var(--accent)" : "var(--line)"}
                strokeWidth={newest ? 5 : 4}
                opacity={used ? 1 : 0.55}
              />
              <circle cx={sxK(k)} cy={syS(a)} r={newest ? 4.5 : 3.5} fill={newest ? GOLD : used ? "var(--accent)" : "var(--soft2)"} />
              <text x={sxK(k)} y={SB + 15} fontSize="10.5" fill={used ? "var(--ink)" : "var(--mut)"} textAnchor="middle" className="tabular-nums">
                {k}
              </text>
            </g>
          );
        })}
        <text x={(PL + W - PR) / 2} y={SB + 31} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          次数（基本波の何倍の速さで揺れるか）
        </text>
      </svg>

      <div className="mt-1 text-sm text-mut">
        いま <b className="tabular-nums text-ink">{n}</b> 本（最高 <b className="tabular-nums text-ink">{highestK}</b> 次まで）
        {wave === "square" && n >= 6 ? (
          <span className="ml-2">——角の近くの小さな飛び越しは消えません（ギブス現象）。</span>
        ) : null}
      </div>

      <div className="mt-3">
        <Slider
          label="足す正弦波の本数"
          value={n}
          min={1}
          max={nMax}
          step={1}
          onChange={(v) => setParam("n", v)}
        />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
