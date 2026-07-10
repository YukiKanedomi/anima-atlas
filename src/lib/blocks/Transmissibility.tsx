import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：伝達率曲線（外部加振と防振）。
//   T(r) = √(1+(2ζr)²) / √((1−r²)²+(2ζr)²)
// 力伝達率（機械→基礎へ伝わる力の比）＝基礎加振の変位伝達率（床→機械へ伝わる揺れの比）。同形。
// 見せ場は「√2 の魔法」：r=√2 で ζ によらず T=1（分子・分母がともに 1+8ζ² になる）。
//   ・r < √2 …… 増幅域（T>1 になり得る）＝淡い臙脂
//   ・r > √2 …… 防振域（T<1）＝淡い緑。ただしここでは ζ を増やすと T が上がる（減衰のパラドックス）
// 物理検証済み：T(√2,任意ζ)=1 ／ T(1,0.1)=5.10 ／ T(3,0.05)=0.13 ／ r>√2 で ∂T/∂ζ>0。

export type TransmissibilityConfig = {
  title?: string;
  caption?: string;
  link?: string; // 連動グループ名（zeta と r を共有）
  zetaDefault?: number;
  rDefault?: number;
  rMax?: number; // 既定 3
};

const W = 640;
const H = 360;
const PAD = { l: 50, r: 18, t: 22, b: 38 };

// 副アクセント（DESIGN.md）：臙脂=警告、緑=良好、金=注目
const HEAVY = "#9b2d3a";
const GOOD = "#1f7a4f";
const GOLD = "#c08a2e";

const Y_MAX = 3; // 表示上限（山は上で切れてよい。防振域の 0〜1 を読みやすく）
const SQRT2 = Math.SQRT2;

// 伝達率（形・値は式どおり）
function transOf(r: number, z: number) {
  const num = 1 + (2 * z * r) ** 2;
  const den = (1 - r * r) ** 2 + (2 * z * r) ** 2 || 1e-9;
  return Math.sqrt(num / den);
}

export default function Transmissibility({ config }: { config: TransmissibilityConfig }) {
  const instId = useInstanceId("trans");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    zeta: config.zetaDefault ?? 0.1,
    r: config.rDefault ?? 0.6,
  });
  const zeta = vals.zeta;
  const r = vals.r;
  const rMax = config.rMax ?? 3;

  const sx = (rr: number) => PAD.l + (rr / rMax) * (W - PAD.l - PAD.r);
  const sy = (t: number) =>
    H - PAD.b - (Math.min(t, Y_MAX) / Y_MAX) * (H - PAD.t - PAD.b);

  // 曲線パス（ζ を指定して1本描く）。ゴースト曲線にも使う。
  const pathOf = (z: number) => {
    const N = 300;
    let d = "";
    for (let i = 0; i <= N; i++) {
      const rr = (rMax * i) / N;
      d += `${i === 0 ? "M" : "L"}${sx(rr).toFixed(1)},${sy(transOf(rr, z)).toFixed(1)} `;
    }
    return d.trim();
  };

  const mainPath = useMemo(() => pathOf(zeta), [zeta, rMax]); // eslint-disable-line react-hooks/exhaustive-deps
  // 参考の薄い曲線：どの ζ でも r=√2 で T=1 を通ることが一目でわかる
  const ghostPaths = useMemo(
    () => [0.1, 0.3, 0.7].map((z) => pathOf(z)),
    [rMax] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const curT = transOf(r, zeta);

  // バッジ判定：等倍の帯は ±2% とする（表示のための丸めであり、境界は正確に r=√2）
  const badge =
    curT > 1.02
      ? { label: "増幅中", color: HEAVY }
      : curT < 0.98
        ? { label: "防振できている", color: GOOD }
        : { label: "ほぼ等倍", color: GOLD };

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="伝達率曲線">
        {/* パネルの地 */}
        <rect
          x={PAD.l}
          y={PAD.t}
          width={W - PAD.l - PAD.r}
          height={H - PAD.t - PAD.b}
          fill="var(--soft)"
          opacity={0.35}
        />

        {/* 増幅域（r<√2）＝淡い臙脂、防振域（r>√2）＝淡い緑 */}
        <rect
          x={PAD.l}
          y={PAD.t}
          width={sx(SQRT2) - PAD.l}
          height={H - PAD.t - PAD.b}
          fill={HEAVY}
          opacity={0.05}
        />
        <rect
          x={sx(SQRT2)}
          y={PAD.t}
          width={W - PAD.r - sx(SQRT2)}
          height={H - PAD.t - PAD.b}
          fill={GOOD}
          opacity={0.07}
        />
        <text x={sx(SQRT2 / 2)} y={PAD.t + 16} fontSize="12" fill={HEAVY} textAnchor="middle" opacity={0.85}>
          増幅域（T が 1 を超え得る）
        </text>
        <text x={sx((SQRT2 + rMax) / 2)} y={PAD.t + 16} fontSize="12" fill={GOOD} textAnchor="middle" opacity={0.9}>
          防振域（T &lt; 1）
        </text>

        {/* 軸 */}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />

        {/* T=1 の水平線と √2 の縦線 */}
        <line
          x1={PAD.l}
          y1={sy(1)}
          x2={W - PAD.r}
          y2={sy(1)}
          stroke="var(--mut)"
          strokeDasharray="4 4"
          opacity={0.55}
        />
        <text x={PAD.l - 6} y={sy(1) + 4} fontSize="11" fill="var(--mut)" textAnchor="end">
          1
        </text>
        <line
          x1={sx(SQRT2)}
          y1={PAD.t}
          x2={sx(SQRT2)}
          y2={H - PAD.b}
          stroke={GOLD}
          strokeDasharray="4 4"
          opacity={0.7}
        />
        <text x={sx(SQRT2)} y={H - PAD.b + 16} fontSize="11" fill={GOLD} textAnchor="middle">
          r = √2
        </text>

        {/* 参考の薄い曲線（ζ=0.1 / 0.3 / 0.7）：全員が √2 の一点を通る */}
        {ghostPaths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--mut)" strokeWidth={1} opacity={0.3} />
        ))}

        {/* いまの ζ の曲線（主役） */}
        <path d={mainPath} fill="none" stroke="var(--accent)" strokeWidth={2.4} />

        {/* √2 の魔法の交点（金の点）：どの ζ でもここで T=1 */}
        <circle cx={sx(SQRT2)} cy={sy(1)} r={6} fill="#fff" stroke={GOLD} strokeWidth={2.5} />
        <circle cx={sx(SQRT2)} cy={sy(1)} r={2.4} fill={GOLD} />

        {/* 運転点カーソル */}
        <line
          x1={sx(r)}
          y1={PAD.t}
          x2={sx(r)}
          y2={H - PAD.b}
          stroke="var(--accent-d)"
          strokeWidth={1}
          opacity={0.35}
        />
        <circle cx={sx(r)} cy={sy(curT)} r={5.5} fill="var(--accent-d)" />

        {/* x軸の目盛りとラベル */}
        {[0, 1, 2, 3]
          .filter((t) => t <= rMax)
          .map((t) => (
            <text key={t} x={sx(t)} y={H - PAD.b + 16} fontSize="11" fill="var(--mut)" textAnchor="middle">
              {t}
            </text>
          ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} fontSize="12" fill="var(--mut)" textAnchor="middle">
          振動数の比 r = Ω / ωn →
        </text>
        <text
          x={14}
          y={(PAD.t + H - PAD.b) / 2}
          fontSize="12"
          fill="var(--mut)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}
        >
          伝達率 T（伝わる揺れの倍率）
        </text>
        <text x={PAD.l - 6} y={PAD.t + 10} fontSize="11" fill="var(--mut)" textAnchor="end">
          {Y_MAX}
        </text>
        <text x={PAD.l - 6} y={H - PAD.b} fontSize="11" fill="var(--mut)" textAnchor="end">
          0
        </text>
      </svg>

      {/* 読み出し：値は固定桁、状態バッジは行末（スマホでは行を分けて折り返しの暴れを防ぐ） */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mut">
        <span className="tabular-nums">
          r = <b className="text-ink">{r.toFixed(2)}</b> ／ 伝達率 T ={" "}
          <b className="text-ink">{curT.toFixed(2)}</b>
        </span>
        <span
          className="w-full rounded-full px-2.5 py-0.5 text-xs sm:w-auto"
          style={{ backgroundColor: `${badge.color}1a`, color: badge.color }}
        >
          {badge.label}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider
          label="運転点 r（加振の速さ / 固有振動数）"
          value={r}
          min={0}
          max={rMax}
          step={0.01}
          onChange={(v) => setParam("r", v)}
        />
        <Slider
          label="減衰比 ζ"
          value={zeta}
          min={0.05}
          max={1}
          step={0.01}
          onChange={(v) => setParam("zeta", v)}
        />
      </div>

      {config.caption ? (
        <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p>
      ) : null}
    </figure>
  );
}
