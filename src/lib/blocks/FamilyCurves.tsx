import { useEffect, useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";
import { familyCurves, TWO_PI } from "../bladedDisk";

// ドメイン部品：モード族の曲線（固有振動数 vs 節直径）。
// 物理は src/lib/bladedDisk.ts の 2×2 セクタモデル（円盤片 md・地盤ばね kd・隣接結合 kc ＋ 翼 mb・ばね kb）。
//   節直径 n ごとに  kd_n = kd + 2kc(1 − cos(2πn/N))、det(K − λM) = 0 の2根 → 低い族・高い族。
//   固有ベクトル：2行目から  x_d / x_b = 1 − λ·mb/kb。
//   翼のエネルギー割合  e_b = mb·x_b² / (mb·x_b² + md·x_d²)  → 1 に近いほど翼支配、0 に近いほど円盤支配。
//   2本の族は交差せず避け合う（veering）。もっとも近づく n を帯で示す。
// ※ 形は式どおりの模式。実機の周期対称 FE では族が何本も現れる。縦軸は翼単体の固有振動数 f_b = 1 で規格化。

export type FamilyCurvesConfig = {
  title?: string;
  caption?: string;
  link?: string;
  bladesDefault?: number;
  kcDefault?: number; // kc / kb
  mdDefault?: number;
  nDefault?: number;
};

const W = 640;
const H = 400;
const PAD = { l: 54, r: 14, t: 24, b: 44 };
const CHART_R = 440;
const ICON_CX = 548;
const ICON_CY = 120;
const ICON_R = 46;
const HEAVY = "#9b2d3a";
const ACCENT_RGB = [31, 58, 95];
const HEAVY_RGB = [155, 45, 58];

function mix(eb: number) {
  const t = Math.max(0, Math.min(1, eb));
  const c = ACCENT_RGB.map((a, i) => Math.round(HEAVY_RGB[i] + (a - HEAVY_RGB[i]) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function FamilyCurves({ config }: { config: FamilyCurvesConfig }) {
  const instId = useInstanceId("family-curves");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    N: config.bladesDefault ?? 24,
    kc: config.kcDefault ?? 2.5,
    md: config.mdDefault ?? 3,
    nsel: config.nDefault ?? 4,
  });
  const N = Math.round(vals.N);
  const half = Math.floor(N / 2);
  const kcRatio = vals.kc;
  const md = vals.md;
  const nsel = Math.min(Math.round(vals.nsel), half);
  // N が（link 経由も含め）下がったら、共有状態の nsel も範囲内に正規化する
  useEffect(() => {
    if (Math.round(vals.nsel) > half) setParam("nsel", half);
  }, [vals.nsel, half, setParam]);

  const mb = 1;
  const kb = TWO_PI * TWO_PI * mb;

  const rows = useMemo(() => {
    const curves = familyCurves({ N, mb, kb, md, kd: 0.15 * kb, kc: kcRatio * kb });
    return curves.map(({ n, low, high }) => {
      const eb = (f: number) => {
        const lam = (TWO_PI * f) ** 2;
        const xd = 1 - (lam * mb) / kb; // x_b = 1
        return (mb * 1) / (mb * 1 + md * xd * xd);
      };
      return { n, low, high, ebLow: eb(low), ebHigh: eb(high) };
    });
  }, [N, kcRatio, md, kb]);

  const yMax = useMemo(() => {
    const m = Math.max(...rows.map((r) => r.high));
    return Math.max(1.5, Math.ceil((m * 1.08) / 0.5) * 0.5);
  }, [rows]);

  const sx = (n: number) => PAD.l + (n / half) * (CHART_R - PAD.l);
  const sy = (f: number) => H - PAD.b - (f / yMax) * (H - PAD.t - PAD.b);

  const pathOf = (key: "low" | "high") =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${sx(r.n).toFixed(1)},${sy(r[key]).toFixed(1)}`).join(" ");

  // veering：族の間隔が最小の n
  const veerN = useMemo(() => {
    let best = 0;
    let gap = Infinity;
    for (const r of rows) {
      const g = r.high - r.low;
      if (g < gap) {
        gap = g;
        best = r.n;
      }
    }
    return best;
  }, [rows]);

  const sel = rows[nsel] ?? rows[0];
  const ticks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += 0.5) ticks.push(v);

  // 右上：選んだ n の節直径アイコン（cos(nθ) の符号で塗り分け）
  const WEDGES = Math.max(96, 8 * nsel); // 空間波長あたり 4 サンプル以上（N/2 で交互に見えるように）
  const icon = Array.from({ length: WEDGES }, (_, i) => {
    const a0 = (TWO_PI * i) / WEDGES;
    const a1 = (TWO_PI * (i + 1)) / WEDGES;
    const am = (a0 + a1) / 2;
    const v = Math.cos(nsel * am);
    const p = (r: number, a: number) => `${(ICON_CX + r * Math.cos(a)).toFixed(1)},${(ICON_CY + r * Math.sin(a)).toFixed(1)}`;
    const d = `M${p(ICON_R * 0.55, a0)} L${p(ICON_R, a0)} A${ICON_R},${ICON_R} 0 0 1 ${p(ICON_R, a1)} L${p(ICON_R * 0.55, a1)} A${ICON_R * 0.55},${ICON_R * 0.55} 0 0 0 ${p(ICON_R * 0.55, a0)} Z`;
    return { d, v };
  });

  const label = (eb: number) => (eb >= 0.66 ? "翼支配" : eb <= 0.34 ? "円盤支配" : "連成（中間）");

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="固有振動数 対 節直径のモード族曲線">
        <rect x={PAD.l} y={PAD.t} width={CHART_R - PAD.l} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
        {/* veering 帯 */}
        <rect
          x={sx(Math.max(0, veerN - 0.5))}
          y={PAD.t}
          width={Math.max(2, sx(Math.min(half, veerN + 0.5)) - sx(Math.max(0, veerN - 0.5)))}
          height={H - PAD.t - PAD.b}
          fill="#c08a2e"
          opacity={0.12}
        />
        <text x={sx(veerN)} y={PAD.t - 8} fontSize="11" fill="#9a6d1f" textAnchor="middle">
          veering（族が最も近づく）
        </text>

        {/* 軸 */}
        <line x1={PAD.l} y1={H - PAD.b} x2={CHART_R} y2={H - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l - 4} y1={sy(v)} x2={CHART_R} y2={sy(v)} stroke="var(--line)" opacity={v === 1 ? 0.9 : 0.5} strokeDasharray={v === 1 ? "4 3" : undefined} />
            <text x={PAD.l - 8} y={sy(v) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {rows.map((r) =>
          half <= 12 || r.n % 2 === 0 ? (
            <text key={r.n} x={sx(r.n)} y={H - PAD.b + 16} fontSize="10" fill="var(--mut)" textAnchor="middle">
              {r.n}
            </text>
          ) : null
        )}
        <text x={(PAD.l + CHART_R) / 2} y={H - 8} fontSize="12" fill="var(--mut)" textAnchor="middle">
          節直径 n（0 〜 N/2）
        </text>
        <text
          x={14}
          y={(PAD.t + H - PAD.b) / 2}
          fontSize="12"
          fill="var(--mut)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}
        >
          固有振動数 f（÷ 翼単体 f_b）
        </text>
        <text x={PAD.l + 6} y={sy(1) + 13} fontSize="10" fill="var(--mut)">
          翼単体 f_b = 1
        </text>

        {/* 選択 n の縦線 */}
        <line x1={sx(nsel)} y1={PAD.t} x2={sx(nsel)} y2={H - PAD.b} stroke="var(--accent-d)" strokeWidth={1.2} opacity={0.5} />

        {/* 族の折れ線＋点（色＝翼支配の度合い） */}
        <path d={pathOf("low")} fill="none" stroke="var(--mut)" strokeWidth={1.4} opacity={0.6} />
        <path d={pathOf("high")} fill="none" stroke="var(--mut)" strokeWidth={1.4} opacity={0.6} />
        {rows.map((r) => (
          <g key={r.n}>
            <circle cx={sx(r.n)} cy={sy(r.low)} r={r.n === nsel ? 6 : 4} fill={mix(r.ebLow)} stroke={r.n === nsel ? "var(--accent-d)" : "none"} strokeWidth={2} />
            <circle cx={sx(r.n)} cy={sy(r.high)} r={r.n === nsel ? 6 : 4} fill={mix(r.ebHigh)} stroke={r.n === nsel ? "var(--accent-d)" : "none"} strokeWidth={2} />
          </g>
        ))}

        {/* 右パネル：節直径アイコンと読み出し */}
        {icon.map((w, i) => (
          <path key={i} d={w.d} fill={w.v >= 0 ? "var(--accent)" : HEAVY} opacity={0.25 + 0.6 * Math.abs(w.v)} />
        ))}
        <circle cx={ICON_CX} cy={ICON_CY} r={ICON_R * 0.55} fill="#fff" stroke="var(--line)" />
        <text x={ICON_CX} y={ICON_CY + 4} fontSize="12" fill="var(--ink)" textAnchor="middle">
          n = {nsel}
        </text>
        <text x={ICON_CX} y={ICON_CY + ICON_R + 18} fontSize="10" fill="var(--mut)" textAnchor="middle">
          cos(nθ) の符号
        </text>

        <text x={470} y={222} fontSize="11" fill="var(--mut)">
          低い族
        </text>
        <text x={470} y={238} fontSize="12" fill={mix(sel.ebLow)}>
          f = {sel.low.toFixed(2)} f_b
        </text>
        <text x={470} y={254} fontSize="11" fill="var(--mut)">
          {label(sel.ebLow)}（翼 {Math.round(sel.ebLow * 100)}%）
        </text>
        <text x={470} y={286} fontSize="11" fill="var(--mut)">
          高い族
        </text>
        <text x={470} y={302} fontSize="12" fill={mix(sel.ebHigh)}>
          f = {sel.high.toFixed(2)} f_b
        </text>
        <text x={470} y={318} fontSize="11" fill="var(--mut)">
          {label(sel.ebHigh)}（翼 {Math.round(sel.ebHigh * 100)}%）
        </text>
        {/* 色の凡例 */}
        <rect x={470} y={340} width={14} height={10} fill={HEAVY} />
        <text x={488} y={349} fontSize="10" fill="var(--mut)">
          円盤支配
        </text>
        <rect x={470} y={356} width={14} height={10} fill="var(--accent)" />
        <text x={488} y={365} fontSize="10" fill="var(--mut)">
          翼支配
        </text>
      </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="見る節直径 n" value={nsel} min={0} max={half} step={1} onChange={(v) => setParam("nsel", v)} />
        <Slider label="翼の枚数 N" value={N} min={12} max={48} step={1} onChange={(v) => setParam("N", v)} />
        <Slider label="円盤の硬さ（隣接結合 kc ÷ kb）" value={kcRatio} min={0.2} max={6} step={0.1} onChange={(v) => setParam("kc", v)} />
        <Slider label="円盤片の重さ md（÷ 翼 mb）" value={md} min={1} max={8} step={0.1} onChange={(v) => setParam("md", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
