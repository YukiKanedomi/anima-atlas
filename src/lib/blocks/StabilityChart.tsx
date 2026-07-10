import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：q–c 平面の安定性チャート（安定の地図）。
// whirl-instability が「1点の運転状態の軌道」を見せたのに対し、こちらは平面全体を俯瞰する。
//   m z̈ + c ż + (k − i q) z = 0（m=k=1）の前向き固有値 λ=σ+iω、
//   σ = (−c + Re√(c²−4+4qi)) / 2。安定限界は q = c（下三角が安定域）。
//   等値線は解析式 q(c,σ) = (c+2σ)·√(1+σc+σ²) で描く（σ=0 で q=c に一致、Node検証済み）。
// 対策は地図上の移動：減衰を増やす＝右へ／クロスカップリングを減らす＝下へ。
// link のキーは whirl-instability と同じ "q","c" なので、同じ link 名で運転点を共有できる。

export type StabilityChartConfig = {
  title?: string;
  caption?: string;
  link?: string;
  qDefault?: number;
  cDefault?: number;
};

const PMAX = 0.6; // 両軸の上限（whirl-instability のスライダー範囲と揃える）
const W = 340;
const H = 320;
const ML = 40, MR = 14, MT = 14, MB = 36; // 軸ラベルの余白
const PW = W - ML - MR;
const PH = H - MT - MB;

const HEAVY = "#9b2d3a"; // 臙脂＝不安定・警告
const GOOD = "#1f7a4f"; // 緑＝良好・現在地
const GOLD = "#c08a2e"; // 金＝注目点（対策の矢印）

// 前向き固有値の実部（成長率）と虚部（振れ回り振動数）。whirl-instability と同じ計算。
function eigen(c: number, q: number) {
  const Dre = c * c - 4, Dim = 4 * q;
  const sq = Math.sqrt(Math.hypot(Dre, Dim));
  const half = Math.atan2(Dim, Dre) / 2;
  let sre = sq * Math.cos(half), sim = sq * Math.sin(half);
  if (sim < 0) { sre = -sre; sim = -sim; } // 前向き(ω>0)の根を取る
  return { sigma: (-c + sre) / 2, omega: sim / 2 };
}

export default function StabilityChart({ config }: { config: StabilityChartConfig }) {
  const instId = useInstanceId("sc");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    q: config.qDefault ?? 0.35,
    c: config.cDefault ?? 0.2,
  });
  const { q, c } = vals;

  const { sigma } = eigen(c, q);
  const unstable = sigma > 1e-4;

  const sx = (cv: number) => ML + (cv / PMAX) * PW;
  const sy = (qv: number) => MT + (1 - qv / PMAX) * PH;

  // 等値線 σ=const：q(c,σ) = (c+2σ)√(1+σc+σ²)（σ=0 が境界 q=c）。
  const contours = useMemo(() => {
    const levels = [-0.1, -0.05, 0.05, 0.1];
    return levels.map((s) => {
      const pts: string[] = [];
      let label: { x: number; y: number } | null = null;
      // c+2σ<0 だと q<0（描画域の外）なので、その手前から始める
      const c0 = Math.max(0, -2 * s);
      for (let i = 0; i <= 120; i++) {
        const cv = c0 + ((PMAX - c0) * i) / 120;
        const qv = (cv + 2 * s) * Math.sqrt(1 + s * cv + s * s);
        if (qv < 0) continue;
        if (qv > PMAX) break; // 上限を超えたら打ち切り（σ>0 の線は上に抜ける）
        pts.push(`${pts.length === 0 ? "M" : "L"}${sx(cv).toFixed(1)},${sy(qv).toFixed(1)}`);
        label = { x: sx(cv), y: sy(qv) };
      }
      return { s, d: pts.join(" "), label };
    });
  }, []);

  const ticks = [0, 0.2, 0.4, 0.6];
  const px = sx(c), py = sy(q);
  const col = unstable ? HEAVY : GOOD;

  // 対策の矢印（不安定なときだけ）：右＝c を q より大きく／下＝q を c より小さく
  const margin = 0.08;
  const arrowRight = unstable && q + margin <= PMAX ? { x2: sx(q + margin), y2: py } : null;
  // 先端が軸の下へはみ出さないようクランプ（c がごく小さいときの保険）
  const arrowDown = unstable ? { x2: px, y2: Math.min(sy(Math.max(c - margin, 0)), MT + PH - 8) } : null;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label="q–c 平面の安定性チャート">
          <defs>
            {/* 矢印の鏃。id はインスタンスごとに変えて同一ページ内の衝突を避ける */}
            <marker id={`${instId}-ah`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0.5 L8,4 L0,7.5 Z" fill={GOLD} />
            </marker>
          </defs>

          {/* 安定域（下三角）＝淡い緑／不安定域（上三角）＝淡い臙脂 */}
          <polygon points={`${sx(0)},${sy(0)} ${sx(PMAX)},${sy(PMAX)} ${sx(PMAX)},${sy(0)}`} fill={GOOD} opacity={0.09} />
          <polygon points={`${sx(0)},${sy(0)} ${sx(PMAX)},${sy(PMAX)} ${sx(0)},${sy(PMAX)}`} fill={HEAVY} opacity={0.07} />

          {/* 軸・目盛り */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="var(--line)" />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="var(--line)" />
          {ticks.map((t) => (
            <g key={`t${t}`}>
              <line x1={sx(t)} y1={MT + PH} x2={sx(t)} y2={MT + PH + 4} stroke="var(--line)" />
              <text x={sx(t)} y={MT + PH + 15} textAnchor="middle" fontSize={10} fill="var(--mut)">{t.toFixed(1)}</text>
              <line x1={ML - 4} y1={sy(t)} x2={ML} y2={sy(t)} stroke="var(--line)" />
              <text x={ML - 7} y={sy(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--mut)">{t.toFixed(1)}</text>
            </g>
          ))}
          <text x={ML + PW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--mut)">減衰 c →</text>
          <text x={12} y={MT + PH / 2} textAnchor="middle" fontSize={11} fill="var(--mut)" transform={`rotate(-90 12 ${MT + PH / 2})`}>クロスカップリング q →</text>

          {/* 成長率の等値線（σ=±0.05, ±0.1）と境界 σ=0（q=c） */}
          {contours.map(({ s, d, label }) => (
            <g key={`c${s}`}>
              <path d={d} fill="none" stroke="var(--mut)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
              {label ? (
                <text x={Math.min(label.x, ML + PW - 4)} y={Math.max(label.y - 4, MT + 9)} textAnchor="end" fontSize={9} fill="var(--mut)" opacity={0.8}>
                  σ={s > 0 ? "+" : ""}{s.toFixed(2)}
                </text>
              ) : null}
            </g>
          ))}
          <line x1={sx(0)} y1={sy(0)} x2={sx(PMAX)} y2={sy(PMAX)} stroke="var(--accent)" strokeWidth={2} />
          <text x={sx(0.44)} y={sy(0.44) - 6} textAnchor="middle" fontSize={10} fill="var(--accent)" transform={`rotate(-43.3 ${sx(0.44)} ${sy(0.44) - 6})`}>安定限界 q = c（σ = 0）</text>

          {/* 領域ラベル */}
          <text x={sx(0.13)} y={sy(0.52)} textAnchor="middle" fontSize={11} fill={HEAVY} opacity={0.85}>不安定（発散）</text>
          <text x={sx(0.46)} y={sy(0.09)} textAnchor="middle" fontSize={11} fill={GOOD} opacity={0.9}>安定（収束）</text>

          {/* 運転点への読み取り線 */}
          <line x1={px} y1={MT + PH} x2={px} y2={py} stroke="var(--line)" strokeDasharray="3 3" />
          <line x1={ML} y1={py} x2={px} y2={py} stroke="var(--line)" strokeDasharray="3 3" />

          {/* 対策の矢印：右＝減衰を増やす／下＝q を減らす（不安定のときだけ表示） */}
          {arrowRight ? (
            <g>
              <line x1={px + 8} y1={arrowRight.y2} x2={arrowRight.x2 + 8} y2={arrowRight.y2} stroke={GOLD} strokeWidth={1.8} markerEnd={`url(#${instId}-ah)`} />
              <text x={px + 12} y={arrowRight.y2 - 6} fontSize={9.5} fill={GOLD}>c を増やす</text>
            </g>
          ) : null}
          {arrowDown ? (
            <g>
              <line x1={arrowDown.x2} y1={py + 8} x2={arrowDown.x2} y2={arrowDown.y2 + 8} stroke={GOLD} strokeWidth={1.8} markerEnd={`url(#${instId}-ah)`} />
              <text x={arrowDown.x2 + 5} y={py + 20} fontSize={9.5} fill={GOLD}>q を減らす</text>
            </g>
          ) : null}

          {/* 運転点（安定=緑／不安定=臙脂） */}
          <circle cx={px} cy={py} r={6} fill={col} stroke="#fff" strokeWidth={2} />
        </svg>

        <div>
          <div className={"inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold " + (unstable ? "bg-[#9b2d3a]/10 text-[#9b2d3a]" : "bg-[#1f7a4f]/10 text-[#1f7a4f]")}>
            {unstable ? "不安定：発散（自励振れ回り）" : "安定：収束"}
          </div>
          <div className="mt-2 tabular-nums text-sm text-mut">
            成長率 σ = <b className="text-ink">{sigma.toFixed(3)}</b>（{sigma > 0 ? "＞0 発散" : "＜0 減衰"}）
            <br />
            境界までの余裕 c − q = <b className="text-ink">{(c - q).toFixed(2)}</b>
          </div>

          <div className="mt-3 space-y-3">
            <Slider label="減衰 c（右へ動く）" value={c} min={0} max={PMAX} step={0.01} onChange={(v) => setParam("c", v)} />
            <Slider label="クロスカップリング q（上下に動く）" value={q} min={0} max={PMAX} step={0.01} onChange={(v) => setParam("q", v)} />
          </div>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
