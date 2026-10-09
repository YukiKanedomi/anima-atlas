import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// 翼振動章：励起の次数分解（ノズル後流と部分噴射）。
// 動翼から見た「1 周ぶんの力」F(θ) を作って、直接 DFT で次数成分 |F_k| を出す。
//   ・全周にノズルを並べたときの枚数を Ns（ピッチ 2π/Ns）。噴射弧は [0, ε·2π)。
//     実装ノズル数 = floor(ε·Ns)。弧の外では流れが無い（F = 0）。
//   ・弧の中では平均荷重 1 に、各ノズルの後流（幅 w×ピッチ、深さ a の釣鐘形）の落ち込みが乗る：
//       F(θ) = 1 − a·Σ_j exp(−((θ−θ_j)/(w·ピッチ))²/2)      （θ が弧内のとき）
//   ・|F_k| = |(1/M) Σ_m F(θ_m) e^{−ikθ_m}|、M = 720 点。
//   全周噴射（ε=1）では k = 0 と Ns の倍数だけが立つ。部分噴射（ε<1）では弧の切れ目が
//   「幅 ε の窓」として働き、すべての k に sinc 状の包絡で成分が立つ（＝FFT 章のリーケージと同じ構造）。

export type ExcitationHarmonicsConfig = {
  title?: string;
  caption?: string;
  link?: string;
  nsDefault?: number;
  epsDefault?: number;
  widthDefault?: number; // 後流の幅（ピッチ比）
  depth?: number; // 後流の深さ a（既定 0.6）
  kmax?: number; // 棒グラフの次数上限
};

const W = 660;
const H = 420;
const HEAVY = "#9b2d3a";
const TOPP = { x0: 160, x1: 640, y0: 30, y1: 160 }; // 展開図（力 vs θ）
const CIRC = { cx: 78, cy: 95, r: 48 }; // 円形の模式図
const BOTP = { x0: 56, x1: 640, y0: 220, y1: 380 }; // 次数スペクトル
const M = 720;

export default function ExcitationHarmonics({ config }: { config: ExcitationHarmonicsConfig }) {
  const instId = useInstanceId("excitation-harmonics");
  const kmax = config.kmax ?? 48;
  const depth = config.depth ?? 0.6;
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    ns: config.nsDefault ?? 12,
    eps: config.epsDefault ?? 1.0,
    width: config.widthDefault ?? 0.18,
  });
  const ns = Math.round(vals.ns);
  const eps = vals.eps;
  const width = vals.width;
  const installed = Math.max(1, Math.floor(eps * ns + 1e-9));
  const pitch = (Math.PI * 2) / ns;

  // 力の波形と DFT
  const { force, spec, specMax } = useMemo(() => {
    const force = new Array<number>(M);
    const arc = eps * Math.PI * 2;
    const sig = width * pitch;
    for (let m = 0; m < M; m++) {
      const th = (m / M) * Math.PI * 2;
      if (th >= arc - 1e-9) {
        force[m] = 0;
        continue;
      }
      let dip = 0;
      for (let j = 0; j < installed; j++) {
        const thj = (j + 0.5) * pitch;
        const d = th - thj;
        dip += Math.exp(-(d * d) / (2 * sig * sig));
      }
      force[m] = 1 - depth * Math.min(1, dip);
    }
    const spec: number[] = [];
    let specMax = 1e-9;
    for (let k = 0; k <= kmax; k++) {
      let re = 0;
      let im = 0;
      for (let m = 0; m < M; m++) {
        const ph = (k * m * Math.PI * 2) / M;
        re += force[m] * Math.cos(ph);
        im -= force[m] * Math.sin(ph);
      }
      const mag = Math.hypot(re, im) / M;
      spec.push(mag);
      if (k > 0 && mag > specMax) specMax = mag;
    }
    return { force, spec, specMax };
  }, [ns, eps, width, installed, pitch, depth, kmax]);

  const sx = (m: number) => TOPP.x0 + (m / M) * (TOPP.x1 - TOPP.x0);
  const sy = (f: number) => TOPP.y1 - f * (TOPP.y1 - TOPP.y0 - 14);
  const forcePath = useMemo(() => {
    const p: string[] = [];
    for (let m = 0; m < M; m += 2) p.push(`${m === 0 ? "M" : "L"}${sx(m).toFixed(1)},${sy(force[m]).toFixed(1)}`);
    p.push(`L${sx(M).toFixed(1)},${sy(force[M - 1]).toFixed(1)}`);
    return p.join(" ");
  }, [force]);

  // 次数スペクトル（k=0 の平均成分は別扱いで表示）
  const bx = (k: number) => BOTP.x0 + ((k + 0.5) / (kmax + 1)) * (BOTP.x1 - BOTP.x0);
  const bw = Math.max(2, ((BOTP.x1 - BOTP.x0) / (kmax + 1)) * 0.62);
  const by = (v: number) => BOTP.y1 - (Math.min(v, specMax) / specMax) * (BOTP.y1 - BOTP.y0 - 10);

  // 立っている次数の数（最大の 5% 以上）
  const nAlive = spec.filter((v, k) => k > 0 && v > 0.05 * specMax).length;
  const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ノズル後流の力の波形と次数スペクトル">
        {/* 円形の模式図：噴射弧とノズル */}
        <circle cx={CIRC.cx} cy={CIRC.cy} r={CIRC.r} fill="var(--soft)" stroke="var(--line)" />
        <circle cx={CIRC.cx} cy={CIRC.cy} r={CIRC.r * 0.55} fill="#fff" stroke="var(--line)" />
        {eps < 0.999 ? (
          <path
            d={`M${CIRC.cx + CIRC.r * Math.cos(-Math.PI / 2)},${CIRC.cy + CIRC.r * Math.sin(-Math.PI / 2)} A${CIRC.r},${CIRC.r} 0 ${eps > 0.5 ? 1 : 0} 1 ${
              CIRC.cx + CIRC.r * Math.cos(-Math.PI / 2 + eps * Math.PI * 2)
            },${CIRC.cy + CIRC.r * Math.sin(-Math.PI / 2 + eps * Math.PI * 2)} L${CIRC.cx},${CIRC.cy} Z`}
            fill="var(--accent)"
            opacity={0.18}
          />
        ) : (
          <circle cx={CIRC.cx} cy={CIRC.cy} r={CIRC.r} fill="var(--accent)" opacity={0.18} />
        )}
        {Array.from({ length: installed }, (_, j) => {
          const a = -Math.PI / 2 + (j + 0.5) * pitch;
          return (
            <line
              key={j}
              x1={CIRC.cx + CIRC.r * 0.72 * Math.cos(a)}
              y1={CIRC.cy + CIRC.r * 0.72 * Math.sin(a)}
              x2={CIRC.cx + CIRC.r * 0.98 * Math.cos(a)}
              y2={CIRC.cy + CIRC.r * 0.98 * Math.sin(a)}
              stroke="var(--accent-d)"
              strokeWidth={1.6}
            />
          );
        })}
        <text x={CIRC.cx} y={CIRC.cy + CIRC.r + 16} fontSize="10" fill="var(--mut)" textAnchor="middle">
          ノズル {installed} 個／全周 {ns}
        </text>
        <text x={CIRC.cx} y={CIRC.cy + CIRC.r + 28} fontSize="10" fill="var(--mut)" textAnchor="middle">
          噴射弧 {fmtPct(eps)}
        </text>

        {/* 展開図：動翼が 1 周で受ける力 */}
        <rect x={TOPP.x0} y={TOPP.y0} width={TOPP.x1 - TOPP.x0} height={TOPP.y1 - TOPP.y0} fill="var(--soft)" opacity={0.35} />
        <line x1={TOPP.x0} y1={TOPP.y1} x2={TOPP.x1} y2={TOPP.y1} stroke="var(--line)" />
        <line x1={TOPP.x0} y1={TOPP.y0} x2={TOPP.x0} y2={TOPP.y1} stroke="var(--line)" />
        <text x={TOPP.x0 + 4} y={TOPP.y0 + 12} fontSize="11" fill="var(--mut)">
          動翼が 1 周で受ける力 F(θ)
        </text>
        <text x={TOPP.x0} y={TOPP.y1 + 13} fontSize="10" fill="var(--mut)" textAnchor="start">
          0°
        </text>
        <text x={TOPP.x1} y={TOPP.y1 + 13} fontSize="10" fill="var(--mut)" textAnchor="end">
          360°
        </text>
        {eps < 0.999 ? (
          <line x1={sx(eps * M)} y1={TOPP.y0} x2={sx(eps * M)} y2={TOPP.y1} stroke={HEAVY} strokeDasharray="4 3" />
        ) : null}
        <path d={forcePath} fill="none" stroke="var(--accent)" strokeWidth={1.8} />

        {/* 次数スペクトル */}
        <rect x={BOTP.x0} y={BOTP.y0} width={BOTP.x1 - BOTP.x0} height={BOTP.y1 - BOTP.y0} fill="var(--soft)" opacity={0.35} />
        <line x1={BOTP.x0} y1={BOTP.y1} x2={BOTP.x1} y2={BOTP.y1} stroke="var(--line)" />
        <line x1={BOTP.x0} y1={BOTP.y0} x2={BOTP.x0} y2={BOTP.y1} stroke="var(--line)" />
        <text x={BOTP.x0 + 4} y={BOTP.y0 + 12} fontSize="11" fill="var(--mut)">
          次数成分 |F_k|（k=0 の平均は除く・最大値で規格化）
        </text>
        {spec.map((v, k) => {
          if (k === 0) return null;
          const strong = k % ns === 0;
          return (
            <rect
              key={k}
              x={bx(k) - bw / 2}
              y={by(v)}
              width={bw}
              height={Math.max(0, BOTP.y1 - by(v))}
              fill={strong ? "var(--accent-d)" : "var(--accent)"}
              opacity={strong ? 1 : 0.55}
            />
          );
        })}
        {Array.from({ length: Math.floor(kmax / ns) }, (_, i) => (i + 1) * ns).map((k) => (
          <text key={k} x={bx(k)} y={BOTP.y1 + 13} fontSize="10" fill="var(--accent-d)" textAnchor="middle">
            {k}E
          </text>
        ))}
        {[1, 2, 4, 8].filter((k) => k < ns && k <= kmax).map((k) => (
          <text key={k} x={bx(k)} y={BOTP.y1 + 13} fontSize="9" fill="var(--mut)" textAnchor="middle">
            {k}
          </text>
        ))}
        <text x={(BOTP.x0 + BOTP.x1) / 2} y={BOTP.y1 + 30} fontSize="11" fill="var(--mut)" textAnchor="middle">
          励起次数 k（回転 1 周あたりの回数）
        </text>
      </svg>

      <div className="mt-2 min-h-[1.5rem] text-sm text-mut">
        立っている次数（最大の 5% 以上）：<b className="tabular-nums text-ink">{nAlive}</b> 本／{kmax}
        <span className="ml-3">
          {eps >= 0.999 ? `全周噴射：${ns}E とその倍数だけ` : `部分噴射：弧の切れ目が全次数を立てる`}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Slider label="全周ノズル枚数 Ns" value={vals.ns} min={4} max={48} step={1} onChange={(v) => setParam("ns", v)} />
        <Slider label="噴射弧 ε（部分噴射率）" value={eps} min={0.1} max={1} step={0.01} format={fmtPct} onChange={(v) => setParam("eps", v)} />
        <Slider label="後流の幅（ピッチ比）" value={width} min={0.06} max={0.4} step={0.01} onChange={(v) => setParam("width", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
