import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：DFTの心臓＝「探り正弦波を掛けて平均する」。
// 信号に sin(ft) を掛けると、同じ速さの成分だけ積がずっと正（山×山・谷×谷）で平均が生き残り、
// 違う速さは正負が打ち消してゼロ（直交性）。平均×2 ＝ その周波数の振幅。
// 探り f を掃引すると平均の曲線がスペクトルそのものになる——分解の種明かし。
//   検証済み: f=1→0.800 / f=3→0.500 / f=2→0（直交）/ cos成分はsin探りで0（複素DFTの動機）
// ※ 有限窓（8周期）による小さな裾はリーケージの伏線としてそのまま見せる。

export type DftProbeConfig = {
  title?: string;
  caption?: string;
  link?: string;
  k1?: number;
  a1?: number;
  k2?: number;
  a2?: number;
  fDefault?: number;
};

const W = 640;
const H = 560;
const PL = 34;
const PR = 16;
// パネル領域
const P1T = 26, P1B = 148; // 信号＋探り
const P2T = 192, P2B = 330; // 積（正負の面積）
const P3T = 384, P3B = 500; // 平均の曲線（＝スペクトル）
const TSPAN = 8 * Math.PI; // 表示は4周期ぶん
const TINT = 16 * Math.PI; // 平均をとる窓（8周期）
const FMAX = 5;
const GOLD = "#c08a2e";
const GREEN = "#1f7a4f";
const HEAVY = "#9b2d3a";

export default function DftProbe({ config }: { config: DftProbeConfig }) {
  const k1 = config.k1 ?? 1;
  const a1 = config.a1 ?? 0.8;
  const k2 = config.k2 ?? 3;
  const a2 = config.a2 ?? 0.5;
  const instId = useInstanceId("dft");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    f: config.fDefault ?? 2,
  });
  const f = vals.f;

  const sig = (t: number) => a1 * Math.sin(k1 * t) + a2 * Math.sin(k2 * t);
  const sx = (t: number) => PL + (t / TSPAN) * (W - PL - PR);

  // 平均×2 の曲線（探り周波数を横軸に）＝手で描くスペクトル。信号が固定なので一度だけ計算。
  const { curve, curveMax } = useMemo(() => {
    const NF = 300, NT = 1200;
    const pts: [number, number][] = [];
    let mx = 0.001;
    for (let i = 0; i <= NF; i++) {
      const ff = 0.2 + ((FMAX - 0.2) * i) / NF;
      let s = 0;
      for (let j = 0; j < NT; j++) {
        const t = (TINT * j) / NT;
        s += sig(t) * Math.sin(ff * t);
      }
      const v = (2 * s) / NT;
      pts.push([ff, v]);
      if (Math.abs(v) > mx) mx = Math.abs(v);
    }
    return { curve: pts, curveMax: mx };
  }, [k1, a1, k2, a2]);

  // 現在の探りでの平均×2（メーター値）
  const avg2 = useMemo(() => {
    const NT = 2400;
    let s = 0;
    for (let j = 0; j < NT; j++) {
      const t = (TINT * j) / NT;
      s += sig(t) * Math.sin(f * t);
    }
    return (2 * s) / NT;
  }, [f, k1, a1, k2, a2]);

  // 波形パス（信号・探り・積の正負塗り）
  const { sigD, probeD, posD, negD } = useMemo(() => {
    const M = 480;
    const ampS = a1 + a2;
    const mid1 = (P1T + P1B) / 2;
    const sy1 = (v: number) => mid1 - (v / (ampS * 1.1)) * ((P1B - P1T) / 2);
    const mid2 = (P2T + P2B) / 2;
    const sy2 = (v: number) => mid2 - (v / (ampS * 1.1)) * ((P2B - P2T) / 2);
    let sigD = "", probeD = "";
    let posD = `M${sx(0).toFixed(1)},${sy2(0).toFixed(1)}`;
    let negD = `M${sx(0).toFixed(1)},${sy2(0).toFixed(1)}`;
    for (let s = 0; s <= M; s++) {
      const t = (TSPAN * s) / M;
      const sv = sig(t);
      const pv = Math.sin(f * t);
      const prod = sv * pv;
      const cmd = s === 0 ? "M" : "L";
      sigD += `${cmd}${sx(t).toFixed(1)},${sy1(sv).toFixed(1)}`;
      probeD += `${cmd}${sx(t).toFixed(1)},${sy1(pv * ampS * 0.5).toFixed(1)}`;
      posD += ` L${sx(t).toFixed(1)},${sy2(Math.max(prod, 0)).toFixed(1)}`;
      negD += ` L${sx(t).toFixed(1)},${sy2(Math.min(prod, 0)).toFixed(1)}`;
    }
    const close = ` L${sx(TSPAN).toFixed(1)},${sy2(0).toFixed(1)} Z`;
    return { sigD, probeD, posD: posD + close, negD: negD + close };
  }, [f, k1, a1, k2, a2]);

  const sxF = (ff: number) => PL + ((ff - 0.2) / (FMAX - 0.2)) * (W - PL - PR);
  const syC = (v: number) => {
    const mid = (P3T + P3B) / 2 + 18; // 正側を広く
    return mid - (v / (curveMax * 1.15)) * ((P3B - P3T) / 2 + 18);
  };
  const curveD = curve.map(([ff, v], i) => `${i === 0 ? "M" : "L"}${sxF(ff).toFixed(1)},${syC(v).toFixed(1)}`).join("");

  const near1 = Math.abs(f - k1) < 0.06;
  const near2 = Math.abs(f - k2) < 0.06;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="探り正弦波を掛けて平均する（DFTの心臓）">
        {/* 1) 信号と探り */}
        <text x={PL} y={P1T - 8} fontSize="12" fill="var(--mut)">
          測った信号（紺・中身は {k1}次:{a1} ＋ {k2}次:{a2}）と 探りの正弦波（金）
        </text>
        <rect x={PL} y={P1T} width={W - PL - PR} height={P1B - P1T} fill="var(--soft)" opacity={0.35} />
        <line x1={PL} y1={(P1T + P1B) / 2} x2={W - PR} y2={(P1T + P1B) / 2} stroke="var(--line)" />
        <path d={sigD} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
        <path d={probeD} fill="none" stroke={GOLD} strokeWidth={1.6} />

        {/* 2) 積 */}
        <text x={PL} y={P2T - 8} fontSize="12" fill="var(--mut)">
          掛け算した結果：緑の面積（正）と 赤の面積（負）の勝負
        </text>
        <rect x={PL} y={P2T} width={W - PL - PR} height={P2B - P2T} fill="var(--soft)" opacity={0.35} />
        <line x1={PL} y1={(P2T + P2B) / 2} x2={W - PR} y2={(P2T + P2B) / 2} stroke="var(--line)" />
        <path d={posD} fill={GREEN} opacity={0.4} stroke="none" />
        <path d={negD} fill={HEAVY} opacity={0.4} stroke="none" />

        {/* 3) 平均の曲線＝スペクトル */}
        <text x={PL} y={P3T - 8} fontSize="12" fill="var(--mut)">
          平均×2 を探りの周波数ごとに並べたもの——これがスペクトル
        </text>
        <line x1={PL} y1={syC(0)} x2={W - PR} y2={syC(0)} stroke="var(--line)" />
        {[1, 2, 3, 4, 5].map((o) => (
          <g key={o}>
            <line x1={sxF(o)} y1={P3T} x2={sxF(o)} y2={P3B} stroke="var(--line)" opacity={0.5} />
            <text x={sxF(o)} y={P3B + 15} fontSize="10.5" fill="var(--mut)" textAnchor="middle" className="tabular-nums">
              {o}
            </text>
          </g>
        ))}
        <path d={curveD} fill="none" stroke="var(--accent)" strokeWidth={1.8} opacity={0.85} />
        {/* 現在の探り位置 */}
        <line x1={sxF(f)} y1={P3T} x2={sxF(f)} y2={P3B} stroke={GOLD} strokeWidth={1.4} strokeDasharray="4 3" />
        <circle cx={sxF(f)} cy={syC(avg2)} r={5.5} fill={GOLD} />
        <text x={(PL + W - PR) / 2} y={P3B + 31} fontSize="11.5" fill="var(--mut)" textAnchor="middle">
          探りの周波数（次数）
        </text>
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm">
        <span className="text-mut">
          平均×2 = <b className="tabular-nums text-ink">{avg2.toFixed(2)}</b>
        </span>
        <span className={"w-full font-semibold sm:w-auto " + (near1 || near2 ? "text-[#1f7a4f]" : "text-mut")}>
          {near1
            ? `${k1}次の成分がつかまった（振幅 ${a1}）`
            : near2
            ? `${k2}次の成分がつかまった（振幅 ${a2}）`
            : "返事なし——この速さの成分は入っていない"}
        </span>
      </div>

      <div className="mt-3">
        <Slider
          label="探りの周波数（ゆっくり掃引してみてください）"
          value={f}
          min={0.2}
          max={FMAX}
          step={0.02}
          onChange={(v) => setParam("f", v)}
        />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
