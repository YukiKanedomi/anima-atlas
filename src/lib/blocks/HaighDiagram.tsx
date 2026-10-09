import { useMemo, useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：Haigh（Goodman）線図。
// 横軸 平均応力 σm（遠心力の一定引張）、縦軸 応力振幅 σa（振動の片振幅）。
//   Goodman 直線   σa/σe + σm/σu = 1
//   Gerber 放物線  σa/σe + (σm/σu)² = 1
//   Soderberg 直線 σa/σe + σm/σy = 1
//   降伏線         σm + σa = σy
// 運転点 (σm, σa) を原点から伸ばした「荷重線」（比例負荷）が Goodman 線に当たるまでの倍率が安全率：
//   n_G = 1 / (σa/σe + σm/σu)
// 降伏に対する倍率 n_y = σy / (σm + σa) も併記。表示は min(n_G, n_y)。
// ※ 材料プリセットは出典つきの代表値。設計には規格・材料データシートの保証値を使うこと（caption に明記）。

export type HaighDiagramConfig = {
  title?: string;
  caption?: string;
  link?: string;
  presetDefault?: "model" | "ti64" | "in718";
  mDefault?: number; // σm/σu の既定（0..1）
  aDefault?: number; // σa/σe の既定（0..1.5）
};

type Preset = {
  key: "model" | "ti64" | "in718";
  label: string;
  su: number;
  sy: number;
  se: number;
  unit: string;
  note: string;
};

const PRESETS: Preset[] = [
  {
    key: "model",
    label: "模式材料",
    su: 1,
    sy: 0.8,
    se: 0.35,
    unit: "",
    note: "σu=1 で規格化した仮想材料（σy=0.8, σe=0.35）",
  },
  {
    key: "ti64",
    label: "Ti-6Al-4V（焼鈍）",
    su: 950,
    sy: 880,
    se: 510,
    unit: "MPa",
    note: "代表値：AMS4928 の仕様範囲（引張 900–1000・耐力 862–910 MPa）と疲労限の報告範囲 450–590 MPa の中央付近",
  },
  {
    key: "in718",
    label: "Inconel 718（時効）",
    su: 1319,
    sy: 1169,
    se: 490,
    unit: "MPa",
    note: "代表値：Special Metals 技術資料の焼鈍＋時効の鍛造材（引張 191.25 ksi・耐力 169.5 ksi、回転曲げ 10⁷ 回 71.0 ksi）を MPa 換算",
  },
];

const W = 640;
const H = 400;
const PAD = { l: 60, r: 20, t: 22, b: 46 };
const HEAVY = "#9b2d3a";
const GREEN = "#1f7a4f";

export default function HaighDiagram({ config }: { config: HaighDiagramConfig }) {
  const instId = useInstanceId("haigh");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    m: config.mDefault ?? 0.35,
    a: config.aDefault ?? 0.5,
  });
  const [presetKey, setPresetKey] = useState<Preset["key"]>(config.presetDefault ?? "model");
  const P = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];

  const sm = vals.m * P.su; // 平均応力
  const sa = vals.a * P.se; // 応力振幅

  // 軸：x は 0..σu、y は 0..YMAX（降伏線の一部が見える高さ）
  const XMAX = P.su;
  const YMAX = Math.max(1.6 * P.se, P.sy * 0.7);
  const sx = (v: number) => PAD.l + (v / XMAX) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - (Math.min(v, YMAX) / YMAX) * (H - PAD.t - PAD.b);

  const curves = useMemo(() => {
    const N = 80;
    const goodman: string[] = [];
    const gerber: string[] = [];
    const soder: string[] = [];
    for (let i = 0; i <= N; i++) {
      const x = (P.su * i) / N;
      const r = x / P.su;
      const g = P.se * (1 - r);
      const ge = P.se * (1 - r * r);
      const so = P.se * (1 - x / P.sy);
      goodman.push(`${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(Math.max(0, g)).toFixed(1)}`);
      gerber.push(`${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(Math.max(0, ge)).toFixed(1)}`);
      if (so >= 0) soder.push(`${soder.length === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(so).toFixed(1)}`);
    }
    // 安全領域（Goodman かつ 降伏線の下）
    const poly: string[] = [`M${sx(0).toFixed(1)},${sy(0).toFixed(1)}`];
    for (let i = 0; i <= N; i++) {
      const x = (P.su * i) / N;
      const g = P.se * (1 - x / P.su);
      const y = Math.max(0, Math.min(g, P.sy - x));
      poly.push(`L${sx(x).toFixed(1)},${sy(y).toFixed(1)}`);
    }
    poly.push("Z");
    return { goodman: goodman.join(" "), gerber: gerber.join(" "), soder: soder.join(" "), safe: poly.join(" ") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey]);

  // 安全率（比例負荷）
  // 原点（σm = σa = 0）では安全率が無限大。0×∞ の NaN を SVG に流さないよう特別扱いする
  const atOrigin = sm <= 0 && sa <= 0;
  const nG = atOrigin ? Infinity : 1 / (sa / P.se + sm / P.su);
  const nY = atOrigin ? Infinity : P.sy / (sm + sa);
  const n = Math.min(nG, nY);
  const safe = n >= 1;
  // 荷重線が Goodman 線に当たる点（原点では荷重線を描かない）
  const hitM = atOrigin ? 0 : sm * nG;
  const hitA = atOrigin ? 0 : sa * nG;
  const fmtN = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "∞");

  const fmt = (v: number) => (P.unit ? `${Math.round(v)} ${P.unit}` : v.toFixed(2));
  const col = safe ? "var(--accent-d)" : HEAVY;

  // 降伏線の描画端点（軸の範囲でクリップ）
  const yl = {
    x1: Math.max(0, P.sy - YMAX),
    y1: Math.min(YMAX, P.sy),
    x2: Math.min(P.sy, XMAX),
    y2: Math.max(0, P.sy - XMAX),
  };

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPresetKey(p.key)}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (p.key === presetKey
                ? "border-accent bg-accent/10 text-accent"
                : "border-line bg-white text-mut hover:border-accent hover:text-accent")
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Haigh線図：平均応力と応力振幅の安全領域">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
        <path d={curves.safe} fill={GREEN} opacity={0.1} />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />

        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <g key={r}>
            <line x1={sx(r * XMAX)} y1={H - PAD.b} x2={sx(r * XMAX)} y2={H - PAD.b + 4} stroke="var(--mut)" />
            <text x={sx(r * XMAX)} y={H - PAD.b + 16} fontSize="10" fill="var(--mut)" textAnchor="middle">
              {P.unit ? Math.round(r * XMAX) : r.toFixed(2)}
            </text>
          </g>
        ))}
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <g key={r}>
            <line x1={PAD.l - 4} y1={sy(r * YMAX)} x2={PAD.l} y2={sy(r * YMAX)} stroke="var(--mut)" />
            <text x={PAD.l - 7} y={sy(r * YMAX) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              {P.unit ? Math.round(r * YMAX) : (r * YMAX).toFixed(2)}
            </text>
          </g>
        ))}

        {/* 降伏線 σm+σa=σy */}
        <line x1={sx(yl.x1)} y1={sy(yl.y1)} x2={sx(yl.x2)} y2={sy(yl.y2)} stroke="var(--mut)" strokeDasharray="3 3" />
        {/* Gerber / Soderberg（薄く） */}
        <path d={curves.gerber} fill="none" stroke="var(--accent)" strokeWidth={1.2} opacity={0.45} strokeDasharray="6 4" />
        <path d={curves.soder} fill="none" stroke="var(--accent)" strokeWidth={1.2} opacity={0.45} strokeDasharray="2 3" />
        {/* Goodman（主役） */}
        <path d={curves.goodman} fill="none" stroke="var(--accent)" strokeWidth={2.4} />

        {/* 凡例（図内右上・短いラベル） */}
        <g fontSize="10" fill="var(--mut)">
          <line x1={W - PAD.r - 250} y1={PAD.t + 12} x2={W - PAD.r - 228} y2={PAD.t + 12} stroke="var(--accent)" strokeWidth={2.4} />
          <text x={W - PAD.r - 224} y={PAD.t + 15}>Goodman</text>
          <line x1={W - PAD.r - 170} y1={PAD.t + 12} x2={W - PAD.r - 148} y2={PAD.t + 12} stroke="var(--accent)" strokeWidth={1.2} opacity={0.6} strokeDasharray="6 4" />
          <text x={W - PAD.r - 144} y={PAD.t + 15}>Gerber</text>
          <line x1={W - PAD.r - 100} y1={PAD.t + 12} x2={W - PAD.r - 78} y2={PAD.t + 12} stroke="var(--accent)" strokeWidth={1.2} opacity={0.6} strokeDasharray="2 3" />
          <text x={W - PAD.r - 74} y={PAD.t + 15}>Soderberg</text>
          <line x1={W - PAD.r - 250} y1={PAD.t + 28} x2={W - PAD.r - 228} y2={PAD.t + 28} stroke="var(--mut)" strokeDasharray="3 3" />
          <text x={W - PAD.r - 224} y={PAD.t + 31}>降伏 σm+σa=σy</text>
          <rect x={W - PAD.r - 170} y={PAD.t + 23} width={22} height={9} fill={GREEN} opacity={0.18} />
          <text x={W - PAD.r - 144} y={PAD.t + 31}>安全領域</text>
        </g>

        {/* 荷重線（原点→Goodman 線上の到達点） */}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(Math.min(hitM, XMAX))}
          y2={sy(Math.min(hitA, YMAX))}
          stroke={col}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          opacity={0.8}
        />
        {!atOrigin && hitM <= XMAX && hitA <= YMAX ? <circle cx={sx(hitM)} cy={sy(hitA)} r={4} fill="none" stroke={col} strokeWidth={1.5} /> : null}
        {/* 運転点 */}
        <circle cx={sx(Math.min(sm, XMAX))} cy={sy(Math.min(sa, YMAX))} r={6} fill={col} />
        <text x={sx(Math.min(sm, XMAX)) + 10} y={sy(Math.min(sa, YMAX)) - 8} fontSize="11" fill={col}>
          運転点
        </text>

        <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} fontSize="12" fill="var(--mut)" textAnchor="middle">
          平均応力 σm（遠心力など）{P.unit ? ` [${P.unit}]` : "（÷ σu）"}
        </text>
        <text
          x={16}
          y={(PAD.t + H - PAD.b) / 2}
          fontSize="12"
          fill="var(--mut)"
          textAnchor="middle"
          transform={`rotate(-90 16 ${(PAD.t + H - PAD.b) / 2})`}
        >
          応力振幅 σa（振動）{P.unit ? ` [${P.unit}]` : ""}
        </text>
      </svg>

      <div className="mt-2 grid min-h-[3.25rem] gap-x-4 text-sm text-mut sm:grid-cols-2">
        <div>
          Goodman 安全率 <b className="tabular-nums text-ink">{fmtN(nG)}</b>／ 降伏に対して{" "}
          <b className="tabular-nums text-ink">{fmtN(nY)}</b>
        </div>
        <div className="font-semibold" style={{ color: col }}>
          {safe ? `安全側（余裕 ${fmtN(n)} 倍）` : `危険側（${fmtN(n)} 倍：線の外）`}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider
          label="平均応力 σm（遠心）"
          value={vals.m}
          min={0}
          max={1}
          step={0.01}
          format={() => fmt(sm)}
          onChange={(v) => setParam("m", v)}
        />
        <Slider
          label="応力振幅 σa（振動）"
          value={vals.a}
          min={0}
          max={1.5}
          step={0.01}
          format={() => fmt(sa)}
          onChange={(v) => setParam("a", v)}
        />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-mut">
        {P.label}：σu={fmt(P.su)}、σy={fmt(P.sy)}、σe={fmt(P.se)}。{P.note}。
      </p>
      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
