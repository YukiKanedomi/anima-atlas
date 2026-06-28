import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：ウォーターフォール（カスケード）線図。
// 昇速しながら各回転数のスペクトルを積み重ねた俯瞰図。診断の花形。
//   ・斜めの尾根 ＝ 回転数に比例する次数成分（1×不釣り合い・2×ミスアライメント）
//   ・立った壁   ＝ 固有振動数に固定された成分（オイルホイップ＝自励）
// この「斜め／縦」を一目で見分けるのがウォーターフォールの真骨頂。
// ※ 各回転数のスペクトルは成分のローレンツ・ピークを解析合成した模式。
//   ピーク中心（f=Ω・2Ω・ωn）と 1× の共振（Ω=1）は式どおり。

export type WaterfallConfig = {
  title?: string;
  caption?: string;
  link?: string;
  unbDefault?: number;
  misDefault?: number;
  whipDefault?: number;
  opDefault?: number;
};

const W = 560;
const H = 352;
const NR = 26; // 回転数の段数
const NF = 150; // 周波数サンプル
const FMAX = 3.6; // 表示周波数 f/ωn
const OMIN = 0.2;
const OMAX = 3.2; // 回転数スイープ（ωn単位）
const ZETA = 0.06; // 共振の鋭さ
const GAMMA = 0.055; // ピーク幅
const WHIP_TH = 2.0; // ホイップ立ち上がり（危険速度の2倍）
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";
const GREEN = "#1f7a4f"; // 運転点（現在地）

// 描画の骨組み（アイソメ風カスケード）
const ORIGIN_X = 70;
const TOP_Y = 72; // 最奥（低回転）のベースライン
const ROW_DY = 7.6; // 1段ごとに下へ
const ROW_DX = 4.2; // 1段ごとに右へ
const PLOT_W = 366;
const AMP = 4.5; // 振幅→px

const R1 = (o: number) => (o * o) / Math.hypot(1 - o * o, 2 * ZETA * o);
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lor = (f: number, f0: number, h: number) => (h * GAMMA * GAMMA) / ((f - f0) * (f - f0) + GAMMA * GAMMA);

function amps(o: number, unb: number, mis: number, whip: number) {
  return {
    a1: unb * R1(o), // 1×不釣り合い（Ω=1で共振）
    a2: mis * (0.4 + 0.6 * R1(2 * o)), // 2×：基底＋2Ωが固有を叩くと共振
    aw: whip * 3.5 * smooth((o - WHIP_TH) / 0.5), // ホイップ：しきい値超で固有に固定して急成長
  };
}

export default function Waterfall({ config }: { config: WaterfallConfig }) {
  const instId = useInstanceId("wf");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    unb: config.unbDefault ?? 0.8,
    mis: config.misDefault ?? 0.25,
    whip: config.whipDefault ?? 0.5,
    op: config.opDefault ?? 2.5,
  });
  const { unb, mis, whip, op } = vals;

  const oOf = (i: number) => OMIN + (OMAX - OMIN) * (i / (NR - 1));
  const baseY = (i: number) => TOP_Y + i * ROW_DY;
  const xAt = (f: number, i: number) => ORIGIN_X + i * ROW_DX + (f / FMAX) * PLOT_W;
  const yAt = (i: number, A: number) => baseY(i) - A * AMP;

  // ハイライトする段（運転点 op に最も近い）
  const opRow = Math.round(((op - OMIN) / (OMAX - OMIN)) * (NR - 1));

  const { rows, ridge1, ridge2, wall } = useMemo(() => {
    const rows: { d: string; i: number }[] = [];
    const ridge1: [number, number][] = [];
    const ridge2: [number, number][] = [];
    const wall: [number, number][] = [];
    for (let i = 0; i < NR; i++) {
      const o = oOf(i);
      const { a1, a2, aw } = amps(o, unb, mis, whip);
      // 合成スペクトル曲線（その段）
      let d = `M${xAt(0, i).toFixed(1)},${baseY(i).toFixed(1)}`;
      for (let j = 0; j <= NF; j++) {
        const f = (FMAX * j) / NF;
        const A = lor(f, o, a1) + lor(f, 2 * o, a2) + lor(f, 1, aw);
        d += ` L${xAt(f, i).toFixed(1)},${yAt(i, A).toFixed(1)}`;
      }
      d += ` L${xAt(FMAX, i).toFixed(1)},${baseY(i).toFixed(1)} Z`;
      rows.push({ d, i });
      // 稜線の頂点
      if (o <= FMAX) ridge1.push([xAt(o, i), yAt(i, a1)]);
      if (2 * o <= FMAX) ridge2.push([xAt(2 * o, i), yAt(i, a2)]);
      if (o > WHIP_TH) wall.push([xAt(1, i), yAt(i, aw)]);
    }
    return { rows, ridge1, ridge2, wall };
  }, [unb, mis, whip]);

  const poly = (pts: [number, number][]) => pts.map((p, k) => `${k === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  // 運転点の合成（読み上げ用）
  const oa = amps(op, unb, mis, whip);
  const whipOn = op > WHIP_TH && whip > 0.02;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ウォーターフォール線図">
        {/* 固有振動数 ωn の基準（f=1 を最奥→最前で結ぶ＝ホイップ壁の位置） */}
        <line
          x1={xAt(1, 0)}
          y1={baseY(0)}
          x2={xAt(1, NR - 1)}
          y2={baseY(NR - 1)}
          stroke="var(--line)"
          strokeDasharray="3 4"
        />
        <text x={xAt(1, 0)} y={baseY(0) - 5} fontSize="10.5" fill="var(--mut)" textAnchor="middle">
          ωₙ
        </text>

        {/* カスケード本体：奥（低回転）→手前（高回転）の順で、不透明塗りで隠線消去 */}
        {rows.map(({ d, i }) => {
          const hot = i === opRow;
          return (
            <path
              key={i}
              d={d}
              fill="#ffffff"
              stroke={hot ? GREEN : "var(--accent)"}
              strokeWidth={hot ? 2 : 1}
              strokeOpacity={hot ? 1 : 0.2 + 0.5 * (i / (NR - 1))}
            />
          );
        })}

        {/* 稜線ガイド（次数＝斜め） */}
        <path d={poly(ridge2)} fill="none" stroke={GOLD} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.85} />
        <path d={poly(ridge1)} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.9} />
        {/* ホイップ壁（固有に固定＝縦） */}
        {wall.length > 1 ? <path d={poly(wall)} fill="none" stroke={HEAVY} strokeWidth={2.4} opacity={0.92} /> : null}

        {/* 運転点マーカー（現在地＝緑） */}
        {ridge1[opRow] ? <circle cx={ridge1[opRow][0]} cy={ridge1[opRow][1]} r={3.8} fill={GREEN} /> : null}

        {/* 周波数軸（手前のベースライン） */}
        <line x1={xAt(0, NR - 1)} y1={baseY(NR - 1)} x2={xAt(FMAX, NR - 1)} y2={baseY(NR - 1)} stroke="var(--ink)" strokeWidth={1} />
        {[1, 2, 3].map((f) => (
          <g key={f}>
            <line x1={xAt(f, NR - 1)} y1={baseY(NR - 1)} x2={xAt(f, NR - 1)} y2={baseY(NR - 1) + 5} stroke="var(--ink)" />
            <text x={xAt(f, NR - 1)} y={baseY(NR - 1) + 18} fontSize="11" fill="var(--mut)" textAnchor="middle">
              {f}
            </text>
          </g>
        ))}
        <text x={xAt(FMAX / 2, NR - 1)} y={baseY(NR - 1) + 34} fontSize="12" fill="var(--mut)" textAnchor="middle">
          周波数 f / ωₙ
        </text>

        {/* 回転数軸（左の傾いた縁） */}
        <line x1={xAt(0, 0)} y1={baseY(0)} x2={xAt(0, NR - 1)} y2={baseY(NR - 1)} stroke="var(--ink)" strokeWidth={1} />
        <text x={28} y={baseY(NR - 1) - 6} fontSize="12" fill="var(--mut)" transform={`rotate(-90 28 ${baseY(NR - 1) - 6})`}>
          回転数 Ω（昇速）→
        </text>
        {/* 危険速度 Ω=1 の段 */}
        {(() => {
          const ic = Math.round(((1 - OMIN) / (OMAX - OMIN)) * (NR - 1));
          return (
            <text x={xAt(0, ic) - 6} y={baseY(ic) + 4} fontSize="10.5" fill={GOLD} textAnchor="end">
              危険速度
            </text>
          );
        })()}

        {/* 成分ラベル */}
        {ridge1.length ? (
          <text x={Math.min(ridge1[ridge1.length - 1][0] + 6, W - 4)} y={ridge1[ridge1.length - 1][1] - 6} fontSize="11.5" fill="var(--accent)" fontWeight={600} textAnchor="end">
            1×（不釣り合い）
          </text>
        ) : null}
        {ridge2.length ? (
          <text x={Math.min(ridge2[ridge2.length - 1][0] + 4, W - 4)} y={ridge2[ridge2.length - 1][1] - 5} fontSize="11" fill={GOLD} textAnchor="end">
            2×（ミスアライメント）
          </text>
        ) : null}
        {wall.length > 1 ? (
          <text x={wall[wall.length - 1][0] - 4} y={wall[wall.length - 1][1] - 7} fontSize="11.5" fill={HEAVY} fontWeight={600} textAnchor="middle">
            オイルホイップ（ωₙに固定）
          </text>
        ) : null}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mut">
        <span>
          運転点 <b className="tabular-nums text-[#1f7a4f]">Ω = {op.toFixed(2)} ωₙ</b>
        </span>
        <span>
          1×{oa.a1 > 0.05 ? "あり" : "なし"} ／ 2×{oa.a2 > 0.05 ? "あり" : "なし"} ／ ホイップ
          <b className={whipOn ? "text-[#9b2d3a]" : "text-ink"}>{whipOn ? "発生中" : "なし"}</b>
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="不釣り合い（1×）" value={unb} min={0} max={1} step={0.01} onChange={(v) => setParam("unb", v)} />
        <Slider label="ミスアライメント（2×）" value={mis} min={0} max={1} step={0.01} onChange={(v) => setParam("mis", v)} />
        <Slider label="オイルホイップの強さ" value={whip} min={0} max={1} step={0.01} onChange={(v) => setParam("whip", v)} />
        <Slider label="運転回転数 Ω（段の強調）" value={op} min={OMIN} max={OMAX} step={0.05} onChange={(v) => setParam("op", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
