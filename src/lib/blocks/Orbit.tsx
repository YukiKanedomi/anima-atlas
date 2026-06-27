import { useEffect, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// 汎用ドメイン部品：振れ回り軌道（一般版）。
// 平面の振れ回りを「前向き成分 F・後ろ向き成分 B」の和で表す標準分解：
//   x(t) = (F+B)·cosθ,  y(t) = (F−B)·sinθ    （θ = ωw·t）
//   B=0 → 円（前向き）／F=0 → 円（後ろ向き）／F,B>0 → 楕円／F=B → 直線
//   F>B なら前向き（回転と同じ向き）、F<B なら後ろ向き。
// 不安定（オイルホワール等）用に、振幅が時間で成長する growth>0 も任意で。
// ※ 形・向きは式どおり。寸法は見やすさのためのスケール（模式）。

export type OrbitConfig = {
  title?: string;
  caption?: string;
  link?: string;
  forwardDefault?: number; // F の初期値（0..1）
  backwardDefault?: number; // B の初期値（0..1）
  showGrowth?: boolean; // 不安定（成長率）スライダーを出すか
  growthDefault?: number;
};

const SIZE = 360;
const C = SIZE / 2;
const HOUSING = 150;
const SCALE = 64; // 振幅1あたりの表示px
const TRAIL = 90; // 軌跡として残す点数
const ACCENT = "var(--accent)";
const ACCENTD = "var(--accent-d)";

export default function Orbit({ config }: { config: OrbitConfig }) {
  const instId = useInstanceId("orbit");
  const showGrowth = !!config.showGrowth;
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    F: config.forwardDefault ?? 0.9,
    B: config.backwardDefault ?? 0.2,
    growth: config.growthDefault ?? 0,
  });
  const F = vals.F;
  const B = vals.B;
  const growth = showGrowth ? vals.growth : 0;

  const [running, setRunning] = useState(true);
  const [, force] = useState(0);
  const theta = useRef(0);
  const tau = useRef(0); // 成長用の経過時間（発散したらリセット）
  const trail = useRef<Array<[number, number]>>([]);
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = Math.min((t - last.current) / 1000, 0.05);
        theta.current = (theta.current + 1.4 * dt) % (Math.PI * 2);
        tau.current += dt;
        const g = growth > 0 ? Math.exp(growth * tau.current) : 1;
        const x = C + (F + B) * SCALE * g * Math.cos(theta.current);
        const y = C + (F - B) * SCALE * g * Math.sin(theta.current);
        const tr = trail.current;
        tr.push([x, y]);
        if (tr.length > TRAIL) tr.shift();
        // 発散しすぎたらリセットして繰り返し見せる
        if (growth > 0 && (F + B) * SCALE * g > HOUSING * 1.1) {
          tau.current = 0;
          trail.current = [];
        }
        force((n) => (n + 1) % 1000);
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, F, B, growth]);

  // 現在位置と速度（向きの矢印用）
  const g = growth > 0 ? Math.exp(growth * tau.current) : 1;
  const ax = (F + B) * SCALE * g;
  const ay = (F - B) * SCALE * g;
  const th = theta.current;
  const px = C + ax * Math.cos(th);
  const py = C + ay * Math.sin(th);
  const vx = -ax * Math.sin(th);
  const vy = ay * Math.cos(th);
  const vlen = Math.hypot(vx, vy) || 1;
  const arrow = 11;
  const adx = (vx / vlen) * arrow;
  const ady = (vy / vlen) * arrow;

  // 形と向きの説明
  const shape =
    Math.abs(F - B) < 0.03
      ? "ほぼ直線"
      : B < 0.03 || F < 0.03
      ? "円"
      : "楕円";
  const dir =
    Math.abs(F - B) < 0.03 ? "—" : F > B ? "前向き（回転と同じ向き）" : "後ろ向き（回転と逆）";

  const trailPath = trail.current
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label="振れ回り軌道（一般）">
          <circle cx={C} cy={C} r={HOUSING} fill="var(--soft)" opacity={0.4} stroke="var(--line)" />
          {/* 軸 */}
          <line x1={C - HOUSING} y1={C} x2={C + HOUSING} y2={C} stroke="var(--line)" />
          <line x1={C} y1={C - HOUSING} x2={C} y2={C + HOUSING} stroke="var(--line)" />

          {/* 静的な軌道（成長なしのとき）*/}
          {growth === 0 ? (
            <ellipse
              cx={C}
              cy={C}
              rx={Math.max(Math.abs(ax), 0.5)}
              ry={Math.max(Math.abs(ay), 0.5)}
              fill="none"
              stroke={ACCENT}
              strokeDasharray="3 4"
              opacity={0.4}
            />
          ) : null}

          {/* 軌跡（向き・成長が見える）*/}
          <path d={trailPath} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0.55} />

          {/* 回転中心 */}
          <circle cx={C} cy={C} r={2.5} fill="var(--mut)" />

          {/* 現在位置と向き矢印 */}
          <line x1={px} y1={py} x2={px + adx} y2={py + ady} stroke={ACCENTD} strokeWidth={2} />
          <circle cx={px} cy={py} r={5.5} fill={ACCENTD} />
        </svg>

        <div>
          <div className="text-sm text-mut">
            形：<b className="text-ink">{shape}</b> ／ 向き：<b className="text-ink">{dir}</b>
          </div>

          <div className="mt-3 space-y-3">
            <Slider label="前向き成分 F" value={F} min={0} max={1} step={0.01} onChange={(v) => setParam("F", v)} />
            <Slider label="後ろ向き成分 B" value={B} min={0} max={1} step={0.01} onChange={(v) => setParam("B", v)} />
            {showGrowth ? (
              <Slider
                label="不安定の成長率（0=安定）"
                value={growth}
                min={0}
                max={1.2}
                step={0.01}
                onChange={(v) => {
                  tau.current = 0;
                  trail.current = [];
                  setParam("growth", v);
                }}
              />
            ) : null}
          </div>

          <button
            onClick={() => setRunning((v) => !v)}
            className="mt-3 rounded border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-accent"
          >
            {running ? "⏸ 一時停止" : "▶ 再生"}
          </button>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
