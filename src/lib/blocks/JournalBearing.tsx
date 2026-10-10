import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：すべり軸受の中で軸はどこに浮くか（偏心率 ε と姿勢角 φ）。第4章の入口。
// 短軸受（Ocvirk）理論の閉形式を使う：
//   修正ゾンマーフェルト数 S' = S·(L/D)^2 = (1−ε²)² / ( π ε √( π²(1−ε²) + 16 ε² ) )
//   姿勢角 tan φ = (π/4)·√(1−ε²) / ε
//   油膜圧力（半ゾンマーフェルト条件、軸方向中央）p(θ) ∝ ε sinθ / (1+ε cosθ)³ （0<θ<π、θ は最大すきまから回転方向に測る）
// 回転数 n と荷重 W は相対値のスライダーで、S' = S0·n/W として ε を二分法で逆算する。
// ※ すきまは見やすく誇張した模式（実機のすきまは半径の千分の一程度）。ε・φ・圧力分布の形は式どおり。

export type JournalBearingConfig = {
  title?: string;
  caption?: string;
  link?: string;
  nDefault?: number; // 回転数（相対）0.2..3
  wDefault?: number; // 荷重（相対）0.2..3
  s0?: number; // n/W=1 のときの修正ゾンマーフェルト数
};

const SIZE = 360;
const CC = SIZE / 2;
const RB = 122; // 軸受内径（半径）
const RJ = 86; // 軸（ジャーナル）半径 → 半径すきま c_r = 36px（誇張）
const CLR = RB - RJ;
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";

function sommerfeldShort(eps: number): number {
  const a = 1 - eps * eps;
  return (a * a) / (Math.PI * eps * Math.sqrt(Math.PI * Math.PI * a + 16 * eps * eps));
}
// S' は ε の単調減少関数なので二分法で逆算
function epsFromS(S: number): number {
  let lo = 0.001;
  let hi = 0.999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sommerfeldShort(mid) > S) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export default function JournalBearing({ config }: { config: JournalBearingConfig }) {
  const instId = useInstanceId("journal");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    n: config.nDefault ?? 1,
    w: config.wDefault ?? 1,
  });
  const { n, w } = vals;
  const S0 = config.s0 ?? 0.12;
  const S = (S0 * n) / w;

  const { eps, phi, lobe, jx, jy, ex, ey } = useMemo(() => {
    const eps = epsFromS(S);
    const phi = Math.atan2((Math.PI / 4) * Math.sqrt(1 - eps * eps), eps); // 荷重線からの姿勢角
    // 荷重は画面下向き。回転は画面で反時計回り → 軸中心は荷重線から回転方向へ φ だけ進んだ向き（右下）へ逃げる
    const e = eps * CLR;
    const ex = Math.sin(phi);
    const ey = Math.cos(phi);
    const jx = CC + e * ex;
    const jy = CC + e * ey;
    // 油膜圧力の分布（軸受内周の外側に放射状のローブとして描く）
    const psiE = Math.atan2(ey, ex); // 画面角（y 下向きなので時計回りに増える）
    const psiMax = psiE + Math.PI; // 最大すきまの向き
    const pts: { x: number; y: number }[] = [];
    let pmax = 0;
    const samples: { psi: number; p: number }[] = [];
    for (let i = 0; i <= 90; i++) {
      const th = (Math.PI * i) / 90; // 0..π：最大すきまから回転方向（画面角が減る向き）へ
      const psi = psiMax - th;
      const p = (eps * Math.sin(th)) / Math.pow(1 + eps * Math.cos(th), 3);
      samples.push({ psi, p });
      if (p > pmax) pmax = p;
    }
    const scale = 54 / (pmax || 1);
    for (const s of samples) {
      const r = RB + 4 + s.p * scale;
      pts.push({ x: CC + r * Math.cos(s.psi), y: CC + r * Math.sin(s.psi) });
    }
    const base = samples.map((s) => ({ x: CC + (RB + 4) * Math.cos(s.psi), y: CC + (RB + 4) * Math.sin(s.psi) })).reverse();
    const lobe = [...pts, ...base].map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
    return { eps, phi, lobe, jx, jy, ex, ey };
  }, [S]);

  const phiDeg = (phi * 180) / Math.PI;
  const hmin = 1 - eps;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[330px]" role="img" aria-label="すべり軸受の中の軸の位置と油膜圧力の模式">
          <defs>
            <marker id="jb-arrow-heavy" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={HEAVY} />
            </marker>
            <marker id="jb-arrow-gold" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={GOLD} />
            </marker>
            <marker id="jb-arrow-mut" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--mut)" />
            </marker>
          </defs>
          {/* 油膜圧力のローブ（臙脂） */}
          <path d={lobe} fill={HEAVY} opacity={0.18} stroke={HEAVY} strokeWidth={1.4} />
          {/* 軸受（内周）と油膜 */}
          <circle cx={CC} cy={CC} r={RB + 14} fill="var(--soft)" opacity={0.5} />
          <circle cx={CC} cy={CC} r={RB} fill="#fbf5e6" stroke="var(--ink)" strokeWidth={2.5} />
          {/* 軸（ジャーナル） */}
          <circle cx={jx} cy={jy} r={RJ} fill="var(--soft2)" stroke="var(--accent)" strokeWidth={2} />
          {/* 回転方向（反時計回り） */}
          <path
            d={`M ${jx + 34} ${jy - 30} A 46 46 0 0 0 ${jx - 34} ${jy - 30}`}
            fill="none"
            stroke="var(--mut)"
            strokeWidth={1.6}
            markerEnd="url(#jb-arrow-mut)"
          />
          <text x={jx} y={jy - 44} fontSize="10.5" fill="var(--mut)" textAnchor="middle">
            回転
          </text>
          {/* 軸受中心・軸中心 */}
          <line x1={CC - 8} y1={CC} x2={CC + 8} y2={CC} stroke="var(--mut)" strokeWidth={1} />
          <line x1={CC} y1={CC - 8} x2={CC} y2={CC + 8} stroke="var(--mut)" strokeWidth={1} />
          <circle cx={jx} cy={jy} r={3} fill="var(--accent)" />
          {/* 荷重 W（下向き、軸中心に作用） */}
          <line x1={jx} y1={jy - 2} x2={jx} y2={jy + 46} stroke={HEAVY} strokeWidth={3} markerEnd="url(#jb-arrow-heavy)" />
          <text x={jx + 8} y={jy + 40} fontSize="11.5" fill={HEAVY} fontWeight={700}>
            荷重 W
          </text>
          {/* 偏心ベクトル e（金）と姿勢角 */}
          <line x1={CC} y1={CC} x2={CC + (jx - CC) * 1.0} y2={CC + (jy - CC) * 1.0} stroke={GOLD} strokeWidth={2.4} markerEnd="url(#jb-arrow-gold)" />
          <path
            d={`M ${CC} ${CC + 22} A 22 22 0 0 0 ${CC + 22 * ex} ${CC + 22 * ey}`}
            fill="none"
            stroke={GOLD}
            strokeWidth={1.2}
          />
          <text x={CC + 30 * Math.sin(phi / 2)} y={CC + 30 * Math.cos(phi / 2) + 4} fontSize="11" fill={GOLD} textAnchor="middle">
            φ
          </text>
          {/* 最小すきまの注記 */}
          <text x={CC + (RB + 2) * ex + 10 * ex} y={CC + (RB + 2) * ey + 10 * ey + 4} fontSize="10" fill="var(--accent)" textAnchor={ex > 0 ? "start" : "end"}>
            最小すきま
          </text>
          <text x={CC - (RB + 6)} y={CC - (RB + 6)} fontSize="10" fill={HEAVY}>
            油膜の圧力
          </text>
        </svg>

        <div className="min-w-0">
          <div className="text-sm leading-relaxed text-mut">
            軸は荷重の<b className="text-ink">真下ではなく、回転方向へ φ だけ斜め</b>に逃げて浮きます。
            油が回転に引きずられて狭まる側（臙脂の圧力）が軸を押し上げるからです。
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded border border-line bg-soft/40 px-2 py-1.5">
              <div className="text-[11px] text-mut">偏心率 ε</div>
              <div className="font-ui tabular-nums text-ink">{eps.toFixed(2)}</div>
            </div>
            <div className="rounded border border-line bg-soft/40 px-2 py-1.5">
              <div className="text-[11px] text-mut">姿勢角 φ</div>
              <div className="font-ui tabular-nums text-ink">{phiDeg.toFixed(0)}°</div>
            </div>
            <div className="rounded border border-line bg-soft/40 px-2 py-1.5">
              <div className="text-[11px] text-mut">最小すきま / c_r</div>
              <div className="font-ui tabular-nums text-ink">{hmin.toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <Slider label="回転数（相対）" value={n} min={0.2} max={3} step={0.05} onChange={(v) => setParam("n", v)} />
            <Slider label="荷重 W（相対）" value={w} min={0.2} max={3} step={0.05} onChange={(v) => setParam("w", v)} />
          </div>
          <div className="mt-2 text-xs text-mut">
            修正ゾンマーフェルト数 S′ = {S.toFixed(3)}（回転数 ÷ 荷重 に比例）。S′ が大きいほど軽く・速く＝よく浮いて、軸は中心近くの「真横」へ寄る。
          </div>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
