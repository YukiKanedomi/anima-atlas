import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：回るものの軸端を押すと、押した向きと直角に逃げる（ジャイロ効果・歳差）。
// 状態 (x, y) は「軸の先端の位置」（小傾きの軸方向ベクトルの x, y 成分）。回転は上から見て反時計回り（+z）。
// 軸端を +x 向きに一定の力 F で押すと、モーメント M = r × F は +y 向き（大きさ M = rF）になる。
// 小傾き・対称コマの線形化を軸端座標で書くと（微小回転角 (θx, θy) との関係は (x, y) = (θy, −θx)）
//   Id·ẍ + Ip·Ω·ẏ = M,   Id·ÿ − Ip·Ω·ẋ = 0     （Id = 1 で無次元化、γ = Ip/Id、M は +y 向きモーメントの大きさ）
//   Ω = 0 ：ẍ = M → 押した向き（+x）へ加速しながら倒れる。
//   Ω 大 ：定常では Ip·Ω·ẏ ≈ M → ẏ ≈ M/(Ip·Ω)。軸端はモーメントのベクトルの向き（+y）＝押した向きと直角へ
//           一定速度で進む＝歳差（dH/dt = M、H ≈ IpΩ·n そのもの）。その上に角振動数 γΩ の小さな輪（章動）が乗る。
// ※ 模式：傾きが 1（破線の円）に達したら「倒れた」として止める。重力コマの非線形項・摩擦は含まない。

export type GyroTopConfig = {
  title?: string;
  caption?: string;
  link?: string;
  omegaDefault?: number;
  momentDefault?: number;
  gammaDefault?: number;
};

const W = 640;
const H = 420;
const CX = 250;
const CY = 215;
const SCALE = 150; // 傾き 1 = 150px
const HEAVY = "#9b2d3a";
const LIMIT = 1.0; // 描画する「倒れる限界」の破線円と同じ半径
const TRAIL_S = 10; // 軌跡を残す秒数

type Pt = { x: number; y: number; t: number };

export default function GyroTop({ config }: { config: GyroTopConfig }) {
  const instId = useInstanceId("gyro-top");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    omega: config.omegaDefault ?? 4,
    moment: config.momentDefault ?? 0.6,
    gamma: config.gammaDefault ?? 1,
  });
  const omega = vals.omega;
  const moment = vals.moment;
  const gamma = vals.gamma;

  const [running, setRunning] = useState(true);
  const [gen, setGen] = useState(0); // やり直しの世代
  const [fallen, setFallen] = useState(false);
  const [trail, setTrail] = useState<Pt[]>([]);
  const state = useRef({ x: 0, y: 0, vx: 0, vy: 0, t: 0 });
  const raf = useRef<number>();
  const last = useRef<number>();
  const pRef = useRef({ omega, moment, gamma });
  pRef.current = { omega, moment, gamma };

  // パラメータを変えたら最初から（軌跡の意味が変わるため）
  useEffect(() => {
    state.current = { x: 0, y: 0, vx: 0, vy: 0, t: 0 };
    setTrail([]);
    setFallen(false);
  }, [omega, moment, gamma, gen]);

  useEffect(() => {
    if (!running || fallen) {
      last.current = undefined;
      return;
    }
    const step = (now: number) => {
      if (last.current !== undefined) {
        const dt = Math.min(0.05, (now - last.current) / 1000);
        const { omega: om, moment: M, gamma: g } = pRef.current;
        // 速度は RK4、位置は台形則（Id=1）：ẍ = M − g·Ω·ẏ,  ÿ = g·Ω·ẋ
        const s = state.current;
        const f = (vx: number, vy: number) => ({ ax: M - g * om * vy, ay: g * om * vx });
        const sub = 4;
        const h = dt / sub;
        for (let i = 0; i < sub; i++) {
          const k1 = f(s.vx, s.vy);
          const k2 = f(s.vx + (h / 2) * k1.ax, s.vy + (h / 2) * k1.ay);
          const k3 = f(s.vx + (h / 2) * k2.ax, s.vy + (h / 2) * k2.ay);
          const k4 = f(s.vx + h * k3.ax, s.vy + h * k3.ay);
          const vx0 = s.vx;
          const vy0 = s.vy;
          s.vx += (h / 6) * (k1.ax + 2 * k2.ax + 2 * k3.ax + k4.ax);
          s.vy += (h / 6) * (k1.ay + 2 * k2.ay + 2 * k3.ay + k4.ay);
          s.x += (h / 2) * (vx0 + s.vx);
          s.y += (h / 2) * (vy0 + s.vy);
          s.t += h;
        }
        const t = s.t;
        setTrail((tr) => {
          const next = tr.length > 0 && t - tr[tr.length - 1].t < 1 / 60 ? tr : [...tr, { x: s.x, y: s.y, t }];
          const cut = next.findIndex((p) => t - p.t <= TRAIL_S);
          return cut > 0 ? next.slice(cut) : next;
        });
        if (Math.hypot(s.x, s.y) > LIMIT) setFallen(true);
      }
      last.current = now;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, fallen]);

  const sx = (x: number) => CX + x * SCALE;
  const sy = (y: number) => CY - y * SCALE;
  const tip = trail.length ? trail[trail.length - 1] : { x: 0, y: 0, t: 0 };
  const path = useMemo(
    () => trail.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" "),
    [trail]
  );
  // 先端の進む向き（直近の 2 点から）
  const n = trail.length;
  const vdir =
    n >= 2 ? Math.atan2(trail[n - 1].y - trail[n - 2].y, trail[n - 1].x - trail[n - 2].x) : null;
  const vdeg = vdir === null ? null : Math.round((vdir * 180) / Math.PI);
  // 定常歳差の速さ（Ω>0 のとき）と章動の周期
  const prec = omega > 0 ? moment / (gamma * omega) : Infinity;
  const nut = omega > 0 ? (2 * Math.PI) / (gamma * omega) : Infinity;

  const verdict = fallen
    ? "倒れました（傾きが限界に達しました）。回転を上げて「やり直す」を押してみてください。"
    : omega === 0
    ? "回っていないので、押した向きにそのまま倒れていきます。"
    : omega < 1.5
    ? "少し回っていると、倒れかけては起き上がる大きな輪（章動）を描きながら横へ流れます。"
    : "速く回っていると、押した向きではなく直角の向きへ、ほぼ一定の速さで進みます（歳差）。";

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="回る円板を押したときの軸の先端の動き">
          {/* 軸の先端の地図 */}
          <rect x={CX - 180} y={CY - 180} width={360} height={360} fill="var(--soft)" opacity={0.35} />
          <circle cx={CX} cy={CY} r={SCALE * 1.0} fill="none" stroke="var(--line)" strokeDasharray="4 4" />
          <circle cx={CX} cy={CY} r={SCALE * 0.5} fill="none" stroke="var(--line)" strokeDasharray="2 5" opacity={0.7} />
          <line x1={CX - 180} y1={CY} x2={CX + 180} y2={CY} stroke="var(--line)" />
          <line x1={CX} y1={CY - 180} x2={CX} y2={CY + 180} stroke="var(--line)" />
          <text x={CX + 150} y={CY - 6} fontSize="11" fill="var(--mut)" textAnchor="middle">倒れる限界</text>
          <text x={CX - 178} y={CY + 176} fontSize="11" fill="var(--mut)">軸の先端を真上から見た地図</text>

          {/* 軸端を押す力の向き（+x、臙脂の矢印）。生じるモーメントのベクトルは +y */}
          <defs>
            <marker id="gt-arr-heavy" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill={HEAVY} />
            </marker>
            <marker id="gt-arr-navy" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
            </marker>
          </defs>
          <line x1={CX + 8} y1={CY} x2={CX + 8 + 44 * Math.min(1, moment)} y2={CY} stroke={HEAVY} strokeWidth={2.4} markerEnd="url(#gt-arr-heavy)" />
          <text x={CX + 14} y={CY + 16} fontSize="11" fill={HEAVY}>軸端を押す力の向き</text>

          {/* 軌跡と先端 */}
          {path ? <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.75} /> : null}
          {vdir !== null && !fallen ? (
            <line
              x1={sx(tip.x)}
              y1={sy(tip.y)}
              x2={sx(tip.x) + 30 * Math.cos(vdir)}
              y2={sy(tip.y) - 30 * Math.sin(vdir)}
              stroke="var(--accent)"
              strokeWidth={2}
              markerEnd="url(#gt-arr-navy)"
            />
          ) : null}
          <circle cx={sx(tip.x)} cy={sy(tip.y)} r={6} fill={fallen ? HEAVY : "var(--accent)"} />

          {/* 右：側面の模式（傾きの大きさだけを見せる） */}
          <g transform={`translate(${CX + 230}, ${CY + 40})`}>
            <text x={0} y={-150} fontSize="11" fill="var(--mut)" textAnchor="middle">横から見た傾き（模式）</text>
            {(() => {
              const tilt = Math.min(LIMIT, Math.hypot(tip.x, tip.y)) * 0.9; // rad 相当（誇張）
              const a = tilt; // 傾け角
              const L = 120;
              const ex = Math.sin(a) * L;
              const ey = -Math.cos(a) * L;
              return (
                <>
                  <line x1={-60} y1={0} x2={60} y2={0} stroke="var(--line)" />
                  <line x1={0} y1={0} x2={ex} y2={ey} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
                  <ellipse
                    cx={ex * 0.78}
                    cy={ey * 0.78}
                    rx={46}
                    ry={10}
                    transform={`rotate(${(a * 180) / Math.PI} ${ex * 0.78} ${ey * 0.78})`}
                    fill="var(--soft2)"
                    stroke="var(--accent)"
                    strokeWidth={1.6}
                  />
                  {omega > 0 ? (
                    <path
                      d={`M${ex * 0.78 - 30},${ey * 0.78 + 18} a 30 10 0 1 0 60 0`}
                      fill="none"
                      stroke={HEAVY}
                      strokeWidth={1.6}
                      markerEnd="url(#gt-arr-heavy)"
                      opacity={0.6 + 0.4 * Math.min(1, omega / 6)}
                    />
                  ) : null}
                </>
              );
            })()}
          </g>
        </svg>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-3">
          <Slider label="回転の速さ Ω（無次元）" value={omega} min={0} max={8} step={0.1} onChange={(v) => setParam("omega", v)} />
          <Slider label="押す強さ（軸端の力が作るモーメント M、無次元）" value={moment} min={0.1} max={1.5} step={0.05} onChange={(v) => setParam("moment", v)} />
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex gap-2">
            <PlayPause running={running && !fallen} onToggle={() => setRunning((r) => !r)} />
            <button
              type="button"
              onClick={() => {
                setGen((g) => g + 1);
                setRunning(true);
              }}
              className="inline-flex items-center rounded-full border border-line px-3 py-1 text-sm text-mut transition-colors hover:border-accent hover:text-accent"
            >
              やり直す
            </button>
          </div>
          <div className="text-xs leading-5 text-mut">
            進む向き：
            <span className="font-ui tabular-nums text-ink">{vdeg === null ? "—" : `${vdeg}°`}</span>
            （押す力の向きが 0°、モーメントのベクトルは 90°）
            <br />
            歳差の速さ M/(γΩ)：
            <span className="font-ui tabular-nums text-ink">{Number.isFinite(prec) ? prec.toFixed(2) : "—"}</span>
            <br />
            章動の周期 2π/(γΩ)：
            <span className="font-ui tabular-nums text-ink">{Number.isFinite(nut) ? nut.toFixed(2) : "—"}</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">{verdict}</p>
      {config.caption ? <p className="mt-2 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
