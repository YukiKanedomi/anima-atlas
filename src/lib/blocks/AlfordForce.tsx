import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：アルフォード力（トーマス力）の模式。第4章の「犯人の顔」。
// ロータが偏心すると翼先すきまが周方向に不均一になり、すきまの狭い側の翼が
// よく働いて接線力が大きくなる。接線力の合計は打ち消しきれず、
// **変位と直角な正味の力**（＝クロスカップリング q）が残って前向き振れ回りを育てる。
//   検証済み: F(θ)=F0(1+κcosθ) の接線合成 → Fx=0, Fy=N·F0·κ/2（変位+xに対し+y）
//   q = βT/(D·H)（Alford の式：段トルク T に比例＝高出力ほど危ない）
// ※ 幾何（偏心・すきま）は見やすく誇張した模式。力の合成は式どおり。

export type AlfordForceConfig = {
  title?: string;
  caption?: string;
  link?: string;
  eDefault?: number;
  tDefault?: number;
};

const SIZE = 360;
const CC = SIZE / 2;
const RCASE = 158; // ケーシング内周
const RROT = 118; // ロータ翼先の基準半径
const NB = 16; // 翼の本数
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";

export default function AlfordForce({ config }: { config: AlfordForceConfig }) {
  const instId = useInstanceId("alford");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    e: config.eDefault ?? 0.6, // 偏心（誇張スケール 0..1）
    t: config.tDefault ?? 0.7, // 段の負荷（トルク）0.2..1
  });
  const { e, t } = vals;

  // 偏心は +x（右）方向に誇張表示。すきま＝ケーシング半径 − (ロータ中心+x方向オフセット)
  const off = e * 24; // 表示オフセット px
  const kappa = 0.55 * e; // 接線力の不均一率（模式）

  const blades = useMemo(() => {
    return Array.from({ length: NB }, (_, i) => {
      const th = (2 * Math.PI * i) / NB;
      const bx = CC + off + RROT * Math.cos(th);
      const by = CC - RROT * Math.sin(th);
      const F = t * (1 + kappa * Math.cos(th)); // 右（すきま小）で大
      // 反時計回りの接線方向（画面では y 反転）
      const tx = -Math.sin(th);
      const ty = -Math.cos(th);
      const L = 14 + F * 26;
      return { th, bx, by, tx, ty, L, F };
    });
  }, [off, kappa, t]);

  // 正味の力（検証済み：+y、大きさ ∝ e×t）
  const netMag = (NB * t * kappa) / 2;
  const netLen = 30 + netMag * 22;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[330px]" role="img" aria-label="アルフォード力の模式（段の断面）">
          {/* ケーシング */}
          <circle cx={CC} cy={CC} r={RCASE + 10} fill="var(--soft)" opacity={0.4} />
          <circle cx={CC} cy={CC} r={RCASE} fill="#fff" stroke="var(--ink)" strokeWidth={2.5} />
          {/* ロータ（右へ偏心・誇張） */}
          <circle cx={CC + off} cy={CC} r={RROT - 26} fill="var(--soft2)" stroke="var(--accent)" strokeWidth={2} />
          {/* 回転方向（正味の力の矢印と重ならないよう左下に退避） */}
          <path
            d={`M ${CC + off - 40} ${CC + 58} A 30 30 0 0 1 ${CC + off - 62} ${CC + 22}`}
            fill="none"
            stroke="var(--mut)"
            strokeWidth={1.6}
            markerEnd="url(#alford-arrow-mut)"
          />
          <text x={CC + off - 58} y={CC + 74} fontSize="11" fill="var(--mut)" textAnchor="middle">
            回転
          </text>
          <defs>
            <marker id="alford-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
            </marker>
            <marker id="alford-arrow-heavy" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={HEAVY} />
            </marker>
            <marker id="alford-arrow-gold" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={GOLD} />
            </marker>
            <marker id="alford-arrow-mut" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--mut)" />
            </marker>
          </defs>
          {/* 翼と接線力の矢印 */}
          {blades.map((b, i) => (
            <g key={i}>
              <line x1={CC + off + (RROT - 26) * Math.cos(b.th)} y1={CC - (RROT - 26) * Math.sin(b.th)} x2={b.bx} y2={b.by} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
              <line
                x1={b.bx}
                y1={b.by}
                x2={b.bx + b.tx * b.L}
                y2={b.by + b.ty * b.L}
                stroke="var(--accent)"
                strokeWidth={1.6}
                opacity={0.65}
                markerEnd="url(#alford-arrow)"
              />
            </g>
          ))}
          {/* すきまの注記 */}
          <text x={CC + RCASE - 4} y={CC + 4} fontSize="10.5" fill={GOLD} textAnchor="end">
            すきま小
          </text>
          <text x={CC - RCASE + 4} y={CC + 4} fontSize="10.5" fill="var(--mut)">
            すきま大
          </text>
          {/* 変位（金）と正味の力（臙脂・直角） */}
          <line x1={CC} y1={CC} x2={CC + off + 26} y2={CC} stroke={GOLD} strokeWidth={2.4} markerEnd="url(#alford-arrow-gold)" />
          <text x={CC + off / 2 + 6} y={CC + 16} fontSize="11" fill={GOLD} textAnchor="middle">
            変位 e
          </text>
          <line x1={CC + off} y1={CC} x2={CC + off} y2={CC - netLen} stroke={HEAVY} strokeWidth={3.4} markerEnd="url(#alford-arrow-heavy)" />
          <text x={CC + off + 8} y={CC - netLen - 6} fontSize="11.5" fill={HEAVY} fontWeight={700}>
            正味の横押し力
          </text>
        </svg>

        <div className="min-w-0">
          <div className="text-sm leading-relaxed text-mut">
            すきまが狭い側（右）の翼ほど<b className="text-ink">よく働き、接線の矢印が長く</b>なります。
            全周の矢印を足し合わせると打ち消しきれず、
            <b className="text-[#9b2d3a]">変位と直角の力</b>だけが残る——これがクロスカップリング q の正体のひとつです。
          </div>
          <div className="mt-2 text-sm text-mut">
            横押し力の目安 ∝ <b className="tabular-nums text-ink">偏心 × トルク = {(e * t).toFixed(2)}</b>
            <span className="ml-1">（回転と同じ向き＝前向き振れ回りを育てる）</span>
          </div>
          <div className="mt-3 space-y-3">
            <Slider label="偏心 e（見やすく誇張した模式）" value={e} min={0} max={1} step={0.01} onChange={(v) => setParam("e", v)} />
            <Slider label="段の負荷（トルク）" value={t} min={0.2} max={1} step={0.01} onChange={(v) => setParam("t", v)} />
          </div>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
