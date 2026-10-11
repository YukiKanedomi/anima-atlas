import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";
import { ampSpectrum } from "../fft";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：窓とリーケージ。FFT章④。
// DFTは「窓の中身が無限に繰り返す」とみなす。窓に波が整数個ぴったり入らないと、
// つなぎ目に不連続（値の段差、または 8.5 のように値は合うが傾きが反転する「折れ」）ができて、
// それが偽の広がり（リーケージ）としてスペクトルに漏れる。
// 上＝窓2枚ぶんを並べて「つなぎ目」を見せる（不連続＝赤マーク）。下＝本物のFFT。
// つなぎ目の不連続は周期延長の端で測る：値の飛び |x(T)−x(0)| = |sin 2πf|、傾きの折れ (1−cos 2πf)/2。
// Hann窓＝端をそっと0に絞る→段差が消えて裾が激減（山は少し太る＝代償）。
//   検証済み: f=8.5 矩形 bin20=0.017 → Hann 0.0002（80倍改善）／整数なら1本
export type LeakageConfig = {
  title?: string;
  caption?: string;
  link?: string;
  fDefault?: number;
};

const N = 256; // 窓内サンプル数（周波数の単位＝窓に入る波の数）
const W = 640;
const H = 470;
const PL = 30, PR = 16;
const TT = 26, TB = 190; // つなぎ目パネル
const ST = 250, SB = 420; // スペクトルパネル
const FSHOW = 20; // 表示ビン
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";
const GREEN = "#1f7a4f";

export default function Leakage({ config }: { config: LeakageConfig }) {
  const instId = useInstanceId("leak");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    f: config.fDefault ?? 8.5,
  });
  const f = vals.f;
  const [hann, setHann] = useState(false);

  const nearInt = Math.abs(f - Math.round(f)) < 0.03;

  const { tileD, envD, seamGap, seamKink, bins } = useMemo(() => {
    const win = (i: number) => (hann ? 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))) : 1);
    const sig = Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * f * i) / N));
    // スペクトル（本物のFFT・窓補正込み）
    const bins = ampSpectrum(sig, hann).slice(0, FSHOW + 1);

    // つなぎ目パネル：窓2枚を連結して描く
    const mid = (TT + TB) / 2;
    const A = (TB - TT) / 2 / 1.15;
    const sx = (u: number) => PL + (u / (2 * N)) * (W - PL - PR);
    const sy = (v: number) => mid - v * A;
    let tileD = "";
    for (let j = 0; j < 2 * N; j++) {
      const i = j % N;
      tileD += `${j === 0 ? "M" : "L"}${sx(j).toFixed(1)},${sy(sig[i] * win(i)).toFixed(1)}`;
    }
    // 窓の包絡（Hann時のみ・2枚ぶん）
    let envD = "";
    if (hann) {
      for (let j = 0; j <= 2 * N; j += 4) {
        const i = j % N;
        envD += `${j === 0 ? "M" : "L"}${sx(j).toFixed(1)},${sy(win(i)).toFixed(1)}`;
      }
    }
    // つなぎ目の不連続：周期延長の端 x(T)=sin(2πf) と x(0)=0 の値の飛び、傾きの折れ（矩形窓のとき）
    const seamGap = hann ? 0 : Math.abs(Math.sin(2 * Math.PI * f));
    const seamKink = hann ? 0 : (1 - Math.cos(2 * Math.PI * f)) / 2;
    return { tileD, envD, seamGap, seamKink, bins };
  }, [f, hann]);

  const mid = (TT + TB) / 2;
  const A = (TB - TT) / 2 / 1.15;
  const seamX = PL + 0.5 * (W - PL - PR);
  const binMax = Math.max(...bins, 0.001);
  const sxB = (k: number) => PL + 20 + (k / FSHOW) * (W - PL - PR - 40);
  const syB = (m: number) => SB - (m / Math.max(binMax, 1.05)) * (SB - ST);
  const discont = !hann && !nearInt && (seamGap > 0.05 || seamKink > 0.05);
  const seamLabel = seamGap > 0.1 ? "：段差！" : "：折れ！";

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      {/* 窓の切替 */}
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-mut">切り取り方：</span>
        {[
          { v: false, label: "そのまま切る（矩形窓）" },
          { v: true, label: "端を絞る（Hann窓）" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => setHann(o.v)}
            aria-pressed={hann === o.v}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (hann === o.v
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-mut hover:border-accent/50 hover:text-ink")
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="窓のつなぎ目とリーケージ">
        {/* つなぎ目パネル */}
        <text x={PL} y={TT - 8} fontSize="12" fill="var(--mut)">
          DFTの思い込み：窓の中身が繰り返す（窓2枚ぶんを連結して表示）
        </text>
        <rect x={PL} y={TT} width={W - PL - PR} height={TB - TT} fill="var(--soft)" opacity={0.35} />
        <line x1={PL} y1={mid} x2={W - PR} y2={mid} stroke="var(--line)" />
        {envD ? <path d={envD} fill="none" stroke={GOLD} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.8} /> : null}
        <path d={tileD} fill="none" stroke="var(--accent)" strokeWidth={1.7} />
        {/* つなぎ目 */}
        <line x1={seamX} y1={TT} x2={seamX} y2={TB} stroke={discont ? HEAVY : "var(--mut)"} strokeWidth={discont ? 2 : 1} strokeDasharray="4 3" opacity={0.8} />
        <text x={seamX} y={TB + 15} fontSize="11" fill={discont ? HEAVY : "var(--mut)"} textAnchor="middle" fontWeight={discont ? 700 : 400}>
          つなぎ目{discont ? seamLabel : ""}
        </text>
        {discont ? (
          <rect x={seamX - 5} y={Math.min(mid - Math.sin(2 * Math.PI * f) * A, mid) - 4} width={10} height={seamGap * A + 8} fill={HEAVY} opacity={0.25} rx={3} />
        ) : null}

        {/* スペクトル */}
        <text x={PL} y={ST - 8} fontSize="12" fill="var(--mut)">
          スペクトル（本物のFFT）
        </text>
        <line x1={PL} y1={SB} x2={W - PR} y2={SB} stroke="var(--line)" />
        {bins.map((m, k) => (
          <g key={k}>
            <line x1={sxB(k)} y1={SB} x2={sxB(k)} y2={syB(m)} stroke={m > 0.02 ? "var(--accent)" : "var(--line)"} strokeWidth={4} opacity={m > 0.02 ? 1 : 0.6} />
            {k % 2 === 0 ? (
              <text x={sxB(k)} y={SB + 15} fontSize="10.5" fill="var(--mut)" textAnchor="middle" className="tabular-nums">
                {k}
              </text>
            ) : null}
          </g>
        ))}
        {/* 真の周波数マーカー */}
        <line x1={sxB(f)} y1={ST} x2={sxB(f)} y2={SB} stroke={GOLD} strokeWidth={1.4} strokeDasharray="4 3" />
        <text x={sxB(f)} y={ST + 12} fontSize="11" fill={GOLD} textAnchor="middle" className="tabular-nums">
          真の周波数 {f.toFixed(2)}
        </text>
        <text x={(PL + W - PR) / 2} y={SB + 31} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          周波数（窓に入る波の数）
        </text>
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
        <span
          className="rounded-full px-2.5 py-0.5 font-semibold text-white"
          style={{ background: nearInt ? GREEN : hann ? "#1f3a5f" : HEAVY }}
        >
          {nearInt ? "ぴったり収まった：1本に立つ" : hann ? "端を絞って、にじみを抑えた" : "つなぎ目の不連続がにじみに化けた（リーケージ）"}
        </span>
        {!nearInt && hann ? <span className="w-full text-mut sm:w-auto">代償：山の幅は少し太ります。</span> : null}
      </div>

      <div className="mt-3">
        <Slider label="窓に入る波の数（整数ちょうど＝ぴったり）" value={f} min={4} max={12} step={0.05} onChange={(v) => setParam("f", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
