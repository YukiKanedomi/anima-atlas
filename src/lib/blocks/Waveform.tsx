import { useEffect, useMemo, useRef, useState } from "react";
import { compileExpr } from "../expr";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// 汎用ブロック：振動の時間波形（オシロスコープ風）。
// 時間 t の関数を1本以上、0線を中心に描き、走査線（プレイヘッド）が左→右に流れる。
// 「変位センサが測る振動波形」「軌道は2つの波からできている」等に使う。
// 数式は compileExpr 共有（sin/cos/exp などが使える）。link で他ブロックと params 共有。

type Trace = { label: string; expr: string; color?: "accent" | "accentd" | "heavy" | "mut" };

export type WaveformConfig = {
  title?: string;
  caption?: string;
  link?: string;
  tKey?: string; // 既定 "t"
  tSpan?: number; // 表示する時間幅（既定 6π）
  yMax?: number; // 縦振幅の上限（既定 1.2）
  samples?: number;
  traces: Trace[];
  sliders?: Array<{ key: string; label: string; min: number; max: number; step: number; default: number; unit?: string }>;
  playhead?: boolean; // 走査線アニメ（既定 true）
};

const W = 640;
const H = 300;
const PAD = { l: 16, r: 16, t: 16, b: 36 };
const COLORS: Record<string, string> = {
  accent: "var(--accent)",
  accentd: "var(--accent-d)",
  heavy: "#9b2d3a",
  mut: "var(--mut)",
};

export default function Waveform({ config }: { config: WaveformConfig }) {
  const tKey = config.tKey ?? "t";
  const tSpan = config.tSpan ?? Math.PI * 6;
  const yMax = config.yMax ?? 1.2;
  const samples = config.samples ?? 260;
  const sliders = config.sliders ?? [];
  const traces = config.traces ?? [];
  const playhead = config.playhead !== false;

  const instId = useInstanceId("wave");
  const [vals, setParam] = useSharedParams(
    config.link ?? instId,
    Object.fromEntries(sliders.map((s) => [s.key, s.default]))
  );

  const compiled = useMemo(
    () =>
      traces.map((tr) =>
        compileExpr(tr.expr, [tKey, ...sliders.map((s) => s.key).filter((k) => k !== tKey)])
      ),
    [traces, tKey, sliders]
  );

  const [head, setHead] = useState(0);
  const raf = useRef<number>();
  const last = useRef<number>();
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || !playhead) return;
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = Math.min((t - last.current) / 1000, 0.05);
        setHead((h) => (h + dt * (tSpan / 5)) % tSpan); // 約5秒で1周
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = undefined;
    };
  }, [running, playhead, tSpan]);

  const sx = (t: number) => PAD.l + (t / tSpan) * (W - PAD.l - PAD.r);
  const midY = (PAD.t + (H - PAD.b)) / 2;
  const halfH = (H - PAD.t - PAD.b) / 2;
  const sy = (v: number) => midY - (Math.max(Math.min(v, yMax), -yMax) / yMax) * halfH;

  const paths = compiled.map((fn) => {
    let d = "";
    for (let i = 0; i <= samples; i++) {
      const t = (tSpan * i) / samples;
      const v = fn({ [tKey]: t, ...vals });
      if (Number.isFinite(v)) d += `${d ? "L" : "M"}${sx(t).toFixed(1)},${sy(v).toFixed(1)} `;
    }
    return d.trim();
  });

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={config.title ?? "波形"}>
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
        {/* 0 線 */}
        <line x1={PAD.l} y1={midY} x2={W - PAD.r} y2={midY} stroke="var(--line)" />

        {/* 波形 */}
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={COLORS[traces[i].color ?? "accent"]} strokeWidth={2.2} />
        ))}

        {/* 走査線と各トレースの現在点 */}
        {playhead ? (
          <>
            <line x1={sx(head)} y1={PAD.t} x2={sx(head)} y2={H - PAD.b} stroke="var(--accent-d)" strokeWidth={1} opacity={0.3} />
            {compiled.map((fn, i) => {
              const v = fn({ [tKey]: head, ...vals });
              if (!Number.isFinite(v)) return null;
              return <circle key={i} cx={sx(head)} cy={sy(v)} r={4.5} fill={COLORS[traces[i].color ?? "accent"]} />;
            })}
          </>
        ) : null}

        {/* 時間軸ラベル */}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} fontSize="12" fill="var(--mut)" textAnchor="middle">
          時間 →
        </text>
      </svg>

      {/* 凡例 */}
      {traces.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {traces.map((tr, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded" style={{ background: COLORS[tr.color ?? "accent"] }} />
              <span className="text-mut">{tr.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {sliders.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sliders.map((s) => (
            <Slider
              key={s.key}
              label={s.label}
              value={vals[s.key]}
              min={s.min}
              max={s.max}
              step={s.step}
              unit={s.unit}
              onChange={(v) => setParam(s.key, v)}
            />
          ))}
        </div>
      ) : null}

      {playhead ? (
        <button
          onClick={() => setRunning((v) => !v)}
          className="mt-3 rounded border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-accent"
        >
          {running ? "⏸ 一時停止" : "▶ 再生"}
        </button>
      ) : null}

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
