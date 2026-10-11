import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：不釣り合い磁気吸引力（UMP）。回転子がエアギャップの中心から e だけ偏ると、
// 狭くなった側の磁束密度が増え、磁気の圧力 B²/(2μ₀) の偏りが「偏った向きへ引く力」になる。
// 模式（2 次元・一様磁化・飽和なし・並列回路やダンパ巻線による打ち消しなし）：
//   ギャップ長 g(θ) = g₀(1 − ε cosθ)、ε = e/g₀、θ は偏心の向きから測る
//   磁束密度   B(θ) = B₀ / (1 − ε cosθ)   （起磁力一定で B ∝ 1/g）
//   磁気圧力   p(θ) = B(θ)² / (2μ₀)
//   合力      F ∝ ∫ p cosθ dθ ∝ ε / (1 − ε²)^{3/2}   （小さい ε では F ∝ ε ＝ 負の剛性 k_s）
// 右下は「有効剛性 k_eff = k − k_s」と危険速度の低下率 √(k_eff/k)。k_s ≥ k なら静的に吸い付く。
// ※ すきまは見やすく誇張した模式。実機のエアギャップは半径の百分の一以下。

export type UmpAirgapConfig = {
  title?: string;
  caption?: string;
  link?: string;
  epsDefault?: number; // 偏心率 e/g（0..0.8）
  ksDefault?: number; // k_s/k（0..1.2）
};

const SIZE = 360;
const CC = SIZE / 2;
const RS = 118; // 固定子内径（半径）
const RR = 84; // 回転子半径 → ギャップ g₀ = 34px（誇張）
const G0 = RS - RR;
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";

export default function UmpAirgap({ config }: { config: UmpAirgapConfig }) {
  const instId = useInstanceId("ump");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    eps: config.epsDefault ?? 0.3,
    ks: config.ksDefault ?? 0.3,
  });
  const { eps, ks } = vals;

  const { lobe, bmax, bmin, fRatio, nonlin, rx, ry } = useMemo(() => {
    // 偏心の向きは画面右（θ=0 が右）。回転子中心は右へ e = ε·g₀ ずれる
    const rx = CC + eps * G0;
    const ry = CC;
    const N = 120;
    const samples: { th: number; p: number }[] = [];
    let pmax = 0;
    for (let i = 0; i <= N; i++) {
      const th = (2 * Math.PI * i) / N;
      const b = 1 / (1 - eps * Math.cos(th));
      const p = b * b;
      samples.push({ th, p });
      if (p > pmax) pmax = p;
    }
    // 圧力のローブ：固定子の外側に、p に比例した厚みで描く（ε=0 なら一様な輪）
    const scale = 40 / Math.max(pmax, 1.0);
    const outer = samples.map((s) => {
      const r = RS + 6 + s.p * scale;
      return { x: CC + r * Math.cos(s.th), y: CC + r * Math.sin(s.th) };
    });
    const inner = samples.map((s) => ({ x: CC + (RS + 6) * Math.cos(s.th), y: CC + (RS + 6) * Math.sin(s.th) })).reverse();
    const lobe =
      [...outer, ...inner].map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
    const bmax = 1 / (1 - eps);
    const bmin = 1 / (1 + eps);
    // 合力（ε=0.1 を 1 とした相対値）と、線形近似に対する割り増し
    const f = (e: number) => e / Math.pow(1 - e * e, 1.5);
    const fRatio = f(eps) / f(0.1);
    const nonlin = Math.pow(1 - eps * eps, -1.5);
    return { lobe, bmax, bmin, fRatio, nonlin, rx, ry };
  }, [eps]);

  const keff = 1 - ks;
  const pulled = keff <= 0;
  const wRatio = pulled ? 0 : Math.sqrt(keff);
  const arrowLen = Math.min(70, 8 + 60 * Math.min(fRatio / 8, 1));

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[330px]" role="img" aria-label="偏心した回転子とエアギャップの磁気圧力の分布（模式）">
          <defs>
            <marker id="ump-arrow-heavy" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={HEAVY} />
            </marker>
            <marker id="ump-arrow-gold" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={GOLD} />
            </marker>
          </defs>
          {/* 磁気圧力のローブ（臙脂）。偏った側ほど厚い */}
          <path d={lobe} fill={HEAVY} opacity={0.18} stroke={HEAVY} strokeWidth={1.4} />
          {/* 固定子（内周）とギャップ */}
          <circle cx={CC} cy={CC} r={RS + 6} fill="var(--soft)" opacity={0.5} />
          <circle cx={CC} cy={CC} r={RS} fill="#fbf5e6" stroke="var(--ink)" strokeWidth={2.5} />
          {/* 磁束線の雰囲気：ギャップを渡る短い線（狭い側ほど密） */}
          {Array.from({ length: 36 }).map((_, i) => {
            const th = (2 * Math.PI * i) / 36;
            const b = 1 / (1 - eps * Math.cos(th));
            const x1 = CC + RS * Math.cos(th);
            const y1 = CC + RS * Math.sin(th);
            const x2 = rx + RR * Math.cos(th);
            const y2 = ry + RR * Math.sin(th);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth={Math.min(3, 0.6 * b)} opacity={0.55} />;
          })}
          {/* 回転子 */}
          <circle cx={rx} cy={ry} r={RR} fill="var(--soft2)" stroke="var(--accent)" strokeWidth={2} />
          {/* 中心と偏心ベクトル e（金） */}
          <line x1={CC - 8} y1={CC} x2={CC + 8} y2={CC} stroke="var(--mut)" strokeWidth={1} />
          <line x1={CC} y1={CC - 8} x2={CC} y2={CC + 8} stroke="var(--mut)" strokeWidth={1} />
          {eps > 0.02 ? (
            <line x1={CC} y1={CC} x2={rx} y2={ry} stroke={GOLD} strokeWidth={2.4} markerEnd="url(#ump-arrow-gold)" />
          ) : null}
          <circle cx={rx} cy={ry} r={3} fill="var(--accent)" />
          <text x={CC + 4} y={CC - 10} fontSize="11" fill={GOLD}>
            偏心 e
          </text>
          {/* 合力 F（臙脂）：偏った向き＝狭いギャップの向きへ */}
          {eps > 0.02 ? (
            <>
              <line x1={rx} y1={ry + 18} x2={rx + arrowLen} y2={ry + 18} stroke={HEAVY} strokeWidth={3} markerEnd="url(#ump-arrow-heavy)" />
              <text x={rx + 4} y={ry + 34} fontSize="11.5" fill={HEAVY} fontWeight={700}>
                吸引力 F
              </text>
            </>
          ) : null}
          <text x={CC + RS + 2} y={CC - RS + 6} fontSize="10" fill={HEAVY} textAnchor="end">
            磁気の圧力 B²
          </text>
          <text x={CC - RS - 2} y={CC + RS + 18} fontSize="10" fill="var(--mut)">
            固定子
          </text>
          <text x={rx} y={ry - RR + 16} fontSize="10" fill="var(--accent)" textAnchor="middle">
            回転子
          </text>
          <text x={CC + RS + 2} y={CC + 4} fontSize="10" fill="var(--accent)" textAnchor="start">
            狭い
          </text>
          <text x={CC - RS - 2} y={CC + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
            広い
          </text>
        </svg>

        <div className="min-w-0">
          <div className="text-sm leading-relaxed text-mut">
            回転子が右へ偏ると右のギャップが狭くなり、そこの磁束密度と磁気の圧力が増えて、
            <b className="text-ink">偏った向きへさらに引く力</b>が生まれます。ばねと逆向きに働くので「負の剛性」です。
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded border border-line bg-soft/40 px-2 py-1.5">
              <div className="text-[11px] text-mut">B 最大 / B₀</div>
              <div className="font-ui tabular-nums text-ink">{bmax.toFixed(2)}</div>
            </div>
            <div className="rounded border border-line bg-soft/40 px-2 py-1.5">
              <div className="text-[11px] text-mut">B 最小 / B₀</div>
              <div className="font-ui tabular-nums text-ink">{bmin.toFixed(2)}</div>
            </div>
            <div className="rounded border border-line bg-soft/40 px-2 py-1.5">
              <div className="text-[11px] text-mut">線形近似との比</div>
              <div className="font-ui tabular-nums text-ink">×{nonlin.toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <Slider label="偏心率 e / g" value={eps} min={0} max={0.8} step={0.01} onChange={(v) => setParam("eps", v)} />
            <Slider label="負の剛性の大きさ k_s / k" value={ks} min={0} max={1.2} step={0.01} onChange={(v) => setParam("ks", v)} />
          </div>
          <div className="mt-3 rounded border border-line bg-soft/40 px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-mut">有効剛性 k_eff / k = 1 − k_s / k</span>
              <span className="font-ui tabular-nums text-ink">{pulled ? "≤ 0" : keff.toFixed(2)}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded bg-white">
              <div className="h-2 rounded" style={{ width: `${Math.max(0, keff) * 100}%`, background: pulled ? HEAVY : "var(--accent)" }} />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-[11px] text-mut">危険速度の比 ωₙ′ / ωₙ = √(k_eff / k)</span>
              <span className={"font-ui tabular-nums " + (pulled ? "font-semibold text-[#9b2d3a]" : "text-ink")}>
                {pulled ? "吸い付く（静的に不安定）" : wRatio.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-mut">
            吸引力は小さな偏心では偏心に比例し（傾きが負の剛性 k_s）、偏心が大きいと線形より速く増えます（比 (1 − ε²)^(−3/2)）。
          </div>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
