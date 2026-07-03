import { useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：釣り合い品質等級 G（ISO 21940-11、旧 ISO 1940-1）のセレクタ。
// 等級 G と運転回転数から、許容できる残留偏心 e_per を読む：
//   e_per [μm] = G × 1000 / Ω,  Ω = 2πN/60 [rad/s]
// 名物の log-log 線図（傾き −1 の等級線の束）を描き、選んだ等級×回転数の点を打つ。
// 「同じ等級でも高速機ほど許される偏心が小さい」が一目でわかる。
// ※ 等級と用途例は規格で広く知られる代表例（模式）。適用は最新版・該当パートで。

export type GradeDef = { g: number; label: string };
export type BalanceGradeConfig = {
  title?: string;
  caption?: string;
  link?: string;
  rpmDefault?: number;
  gDefault?: number;
  grades?: GradeDef[];
};

const DEFAULT_GRADES: GradeDef[] = [
  { g: 40, label: "自動車ホイールなど" },
  { g: 16, label: "農業機械・粉砕機など" },
  { g: 6.3, label: "一般の機械・ファン・ポンプ" },
  { g: 2.5, label: "タービン・圧縮機・工作機械" },
  { g: 1, label: "精密な主軸・小型モータ" },
  { g: 0.4, label: "超精密（ジャイロ・研削主軸）" },
];

const W = 560;
const H = 330;
const PL = 62;
const PR = 20;
const PT = 18;
const PB = 44;
// log-log レンジ
const RPM_MIN = 100, RPM_MAX = 100000;
const E_MIN = 0.1, E_MAX = 10000; // μm

const ePer = (g: number, rpm: number) => (g * 1000) / ((2 * Math.PI * rpm) / 60); // μm

export default function BalanceGrade({ config }: { config: BalanceGradeConfig }) {
  const grades = config.grades ?? DEFAULT_GRADES;
  const instId = useInstanceId("grade");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    logRpm: Math.log10(config.rpmDefault ?? 3000),
  });
  const rpm = Math.pow(10, vals.logRpm);
  const [g, setG] = useState(config.gDefault ?? 2.5);
  const grade = grades.find((x) => x.g === g) ?? grades[0];

  const e = ePer(g, rpm);

  const sx = (r: number) =>
    PL + ((Math.log10(r) - Math.log10(RPM_MIN)) / (Math.log10(RPM_MAX) - Math.log10(RPM_MIN))) * (W - PL - PR);
  const sy = (ee: number) =>
    H - PB - ((Math.log10(ee) - Math.log10(E_MIN)) / (Math.log10(E_MAX) - Math.log10(E_MIN))) * (H - PT - PB);

  // 等級線（log-log 上の直線）。表示レンジ内にクリップして描く。
  const lineOf = (gv: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const r = RPM_MIN * Math.pow(RPM_MAX / RPM_MIN, i / 60);
      const ee = ePer(gv, r);
      if (ee < E_MIN || ee > E_MAX) continue;
      pts.push(`${sx(r).toFixed(1)},${sy(ee).toFixed(1)}`);
    }
    return pts.length > 1 ? "M" + pts.join(" L") : "";
  };

  const decadesX = [100, 1000, 10000, 100000];
  const decadesY = [0.1, 1, 10, 100, 1000, 10000];

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      {/* 等級の切替 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-mut">等級：</span>
        {grades.map((gr) => (
          <button
            key={gr.g}
            type="button"
            onClick={() => setG(gr.g)}
            aria-pressed={gr.g === g}
            className={
              "rounded-full border px-3 py-1 text-sm tabular-nums transition-colors " +
              (gr.g === g
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-mut hover:border-accent/50 hover:text-ink")
            }
          >
            G{gr.g}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="釣り合い品質等級の線図（回転数×許容偏心）">
        {/* 方眼（対数の桁線） */}
        <g stroke="var(--line)" opacity={0.8}>
          {decadesX.map((r) => (
            <line key={r} x1={sx(r)} y1={PT} x2={sx(r)} y2={H - PB} />
          ))}
          {decadesY.map((ee) => (
            <line key={ee} x1={PL} y1={sy(ee)} x2={W - PR} y2={sy(ee)} />
          ))}
        </g>
        {/* 軸ラベル */}
        {decadesX.map((r) => (
          <text key={r} x={sx(r)} y={H - PB + 16} fontSize="10.5" fill="var(--mut)" textAnchor="middle" className="tabular-nums">
            {r >= 1000 ? `${r / 1000}k` : r}
          </text>
        ))}
        {decadesY.map((ee) => (
          <text key={ee} x={PL - 6} y={sy(ee) + 3.5} fontSize="10.5" fill="var(--mut)" textAnchor="end" className="tabular-nums">
            {ee >= 1 ? ee : ee.toFixed(1)}
          </text>
        ))}
        <text x={(PL + W - PR) / 2} y={H - 8} fontSize="12" fill="var(--mut)" textAnchor="middle">
          回転数（rpm・対数）
        </text>
        <text x={14} y={(PT + H - PB) / 2} fontSize="12" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 14 ${(PT + H - PB) / 2})`}>
          許容残留偏心 e（μm・対数）
        </text>

        {/* 等級線の束 */}
        {grades.map((gr) => {
          const sel = gr.g === g;
          const d = lineOf(gr.g);
          if (!d) return null;
          // ラベルは右上側（レンジ内に入る位置）
          const rLab = 300;
          const eLab = ePer(gr.g, rLab);
          return (
            <g key={gr.g}>
              <path d={d} fill="none" stroke={sel ? "var(--accent)" : "var(--line)"} strokeWidth={sel ? 2.4 : 1.4} />
              {eLab < E_MAX && eLab > E_MIN ? (
                <text
                  x={sx(rLab) + 4}
                  y={sy(eLab) - 5}
                  fontSize="10.5"
                  fill={sel ? "var(--accent)" : "var(--mut)"}
                  fontWeight={sel ? 700 : 400}
                  className="tabular-nums"
                >
                  G{gr.g}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* 運転点 */}
        <line x1={sx(rpm)} y1={sy(e)} x2={sx(rpm)} y2={H - PB} stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        <line x1={PL} y1={sy(e)} x2={sx(rpm)} y2={sy(e)} stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        <circle cx={sx(rpm)} cy={sy(e)} r={5.5} fill="#c08a2e" stroke="#fff" strokeWidth={1.5} />
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-mut">
          <b className="text-ink">G{g}</b>（{grade.label}）× <b className="tabular-nums text-ink">{Math.round(rpm).toLocaleString()}</b> rpm
        </span>
        <span className="text-mut">
          → 許容残留偏心 <b className="tabular-nums text-ink">{e >= 100 ? e.toFixed(0) : e >= 10 ? e.toFixed(1) : e.toFixed(2)} μm</b>
          （ロータ1kgあたり {e >= 100 ? e.toFixed(0) : e >= 10 ? e.toFixed(1) : e.toFixed(2)} g·mm）
        </span>
      </div>

      <div className="mt-3">
        <Slider
          label="運転回転数（対数スライダー）"
          value={vals.logRpm}
          min={Math.log10(300)}
          max={Math.log10(60000)}
          step={0.01}
          onChange={(x) => setParam("logRpm", x)}
          format={(x) => `${Math.round(Math.pow(10, x)).toLocaleString()} rpm`}
        />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
