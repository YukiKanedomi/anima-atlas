import { useEffect, useMemo, useRef, useState } from "react";
import { PlayPause } from "../../components/PlayPause";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：ブレードチップタイミング（BTT）＝1回転1点のサンプリング。
// 追跡する翼（金色）が振動 x(t) = A·sin(2π f t) している。ケーシングのプローブ p（角度 θ_p）は
// 翼が通過する瞬間 t_{r,p} = (r + θ_p/2π)/Ω（r 回転目、Ω は rev/s）に x を1点だけ拾う。
//   ・同期振動（f/Ω = 整数 = EO）：毎回同じ位相で通過するので、各プローブの標本は一定値（DC のずれ）になり、
//     振動していることが1本のプローブでは見えない。回転数を掃引する（位相が回る）か、複数プローブが要る。
//   ・非同期（f/Ω が非整数）：1本のプローブの標本は f − round(f/Ω)·Ω の「見かけの周波数」で揺れる
//     ＝ FFT 章のエイリアシング（fs = Ω）。
// 表示：左＝ロータ（N 翼）とプローブ、右上＝真の波形と標本点、右下＝回転ごとの標本（プローブ別）。
// ※ 翼の変位は見やすさのため誇張。周波数・回転数の数値関係は式どおり。

export type TipTimingConfig = {
  title?: string;
  caption?: string;
  link?: string;
  N?: number; // 翼の枚数（既定 12）
  revs?: number; // 表示する回転数（既定 12）
  omegaDefault?: number; // 回転速度 rev/s
  fDefault?: number; // 振動周波数 Hz
  probesDefault?: number; // プローブ本数 1..4
};

const W = 680;
const H = 380;
const ROT = { cx: 150, cy: 180, r: 110 };
const TOP = { l: 320, r: 16, t: 20, h: 150 };
const BOT = { l: 320, r: 16, t: 200, h: 150 };
const HEAVY = "#9b2d3a";
const GOLD = "#c08a2e";
const PROBE_COLORS = ["var(--accent)", HEAVY, "#1f7a4f", GOLD];

export default function TipTiming({ config }: { config: TipTimingConfig }) {
  const instId = useInstanceId("btt");
  const N = Math.max(6, Math.min(36, Math.round(config.N ?? 12)));
  const REVS = Math.max(6, Math.min(24, Math.round(config.revs ?? 12)));
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    omega: config.omegaDefault ?? 20,
    f: config.fDefault ?? 85,
  });
  const omega = vals.omega; // rev/s
  const f = vals.f; // Hz
  const [probes, setProbes] = useState(Math.max(1, Math.min(4, config.probesDefault ?? 1)));
  const [running, setRunning] = useState(true);
  const [tRev, setTRev] = useState(0); // 経過回転数（アニメ時間）
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = (t - last.current) / 1000;
        setTRev((v) => (v + dt * 1.2) % REVS); // 1 回転 ≈ 0.83 秒のスローモーション
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, REVS]);

  // プローブ角度（ケーシング上、上方向を 0 とし時計回り）。等間隔ではなく少しずらす（実機でも不等間隔が常道）。
  const probeAngles = useMemo(() => {
    const base = [0, 0.37, 0.61, 0.82]; // 回転の割合
    return base.slice(0, probes).map((b) => b * 2 * Math.PI);
  }, [probes]);

  const EO = f / omega;
  const nearest = Math.round(EO);
  const fAlias = Math.abs(f - nearest * omega);
  // 「同期」は数値的に整数のときだけ。近いだけなら遅いうなり（エイリアス）が残るので「同期近傍」と言う
  const isSync = Math.abs(EO - nearest) < 1e-9;
  const nearSync = !isSync && Math.abs(EO - nearest) < 0.05;

  // 真の波形 x(t) と標本点。上段は最初の ZOOM 回転ぶんだけ拡大表示（波が潰れないように）。
  const ZOOM = 4;
  const T = ZOOM / omega; // 上段に表示する時間 [s]
  const amp = 1;
  const x = (t: number) => amp * Math.sin(2 * Math.PI * f * t);

  const sxT = (t: number) => TOP.l + (t / T) * (W - TOP.l - TOP.r);
  const syT = (v: number) => TOP.t + TOP.h / 2 - v * (TOP.h / 2 - 10);
  const sxB = (r: number) => BOT.l + ((r + 0.5) / REVS) * (W - BOT.l - BOT.r);
  const syB = (v: number) => BOT.t + BOT.h / 2 - v * (BOT.h / 2 - 10);

  const wavePath = useMemo(() => {
    const M = 600;
    const pts: string[] = [];
    for (let i = 0; i <= M; i++) {
      const t = (T * i) / M;
      pts.push(`${i === 0 ? "M" : "L"}${sxT(t).toFixed(1)},${syT(x(t)).toFixed(1)}`);
    }
    return pts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, omega, REVS]);

  // 標本（回転 r、プローブ p）：t = (r + θ_p/2π)/Ω。現在時刻までのものだけ表示。
  const samples = useMemo(() => {
    const out: { r: number; p: number; t: number; v: number }[] = [];
    for (let r = 0; r < REVS; r++) {
      probeAngles.forEach((th, p) => {
        const t = (r + th / (2 * Math.PI)) / omega;
        out.push({ r, p, t, v: x(t) });
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeAngles, omega, f, REVS]);

  const tNow = tRev / omega;
  const shown = samples.filter((s) => s.t <= tNow);

  // ロータの描画：翼 j の角度 = 2π(tRev) + 2πj/N（時計回り）。追跡翼 j=0 は接線方向に x(t) だけずらす（誇張）。
  const rotAngle = 2 * Math.PI * tRev;
  const blades = Array.from({ length: N }, (_, j) => {
    const a = rotAngle + (2 * Math.PI * j) / N;
    const tracked = j === 0;
    const disp = tracked ? x(tNow) * 0.09 : 0; // 誇張した接線方向のずれ（角度）
    const a2 = a + disp;
    const x0 = ROT.cx + Math.sin(a) * ROT.r * 0.62;
    const y0 = ROT.cy - Math.cos(a) * ROT.r * 0.62;
    const x1 = ROT.cx + Math.sin(a2) * ROT.r;
    const y1 = ROT.cy - Math.cos(a2) * ROT.r;
    return { x0, y0, x1, y1, tracked };
  });

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="ブレードチップタイミング：回る翼をケーシングのプローブが1回転1点で標本化する">
        {/* 左：ロータとプローブ */}
        <circle cx={ROT.cx} cy={ROT.cy} r={ROT.r + 14} fill="none" stroke="var(--line)" strokeWidth={6} />
        <circle cx={ROT.cx} cy={ROT.cy} r={ROT.r * 0.62} fill="var(--soft)" stroke="var(--line)" />
        {blades.map((b, j) => (
          <line
            key={j}
            x1={b.x0}
            y1={b.y0}
            x2={b.x1}
            y2={b.y1}
            stroke={b.tracked ? GOLD : "var(--accent)"}
            strokeWidth={b.tracked ? 5 : 3}
            strokeLinecap="round"
            opacity={b.tracked ? 1 : 0.7}
          />
        ))}
        {probeAngles.map((th, p) => {
          const px = ROT.cx + Math.sin(th) * (ROT.r + 14);
          const py = ROT.cy - Math.cos(th) * (ROT.r + 14);
          return (
            <g key={p}>
              <circle cx={px} cy={py} r={7} fill={PROBE_COLORS[p]} />
              <text x={px + Math.sin(th) * 16} y={py - Math.cos(th) * 16 + 4} fontSize="10" fill={PROBE_COLORS[p]} textAnchor="middle">
                P{p + 1}
              </text>
            </g>
          );
        })}
        <text x={ROT.cx} y={ROT.cy + ROT.r + 40} fontSize="11" fill="var(--mut)" textAnchor="middle">
          {`${Math.round(omega * 60)} rpm・追跡翼（金）が ${f.toFixed(0)} Hz で振動`}
        </text>
        <text x={ROT.cx} y={ROT.cy + 4} fontSize="11" fill="var(--mut)" textAnchor="middle">
          {`${tRev.toFixed(1)} 回転目`}
        </text>

        {/* 右上：真の波形と標本点 */}
        <rect x={TOP.l} y={TOP.t} width={W - TOP.l - TOP.r} height={TOP.h} fill="var(--soft)" opacity={0.35} />
        <line x1={TOP.l} y1={syT(0)} x2={W - TOP.r} y2={syT(0)} stroke="var(--line)" />
        <path d={wavePath} fill="none" stroke="var(--accent)" strokeWidth={1.2} opacity={0.55} />
        {shown
          .filter((s) => s.t <= T)
          .map((s, i) => (
            <circle key={i} cx={sxT(s.t)} cy={syT(s.v)} r={3.2} fill={PROBE_COLORS[s.p]} />
          ))}
        {tNow <= T ? (
          <line x1={sxT(tNow)} y1={TOP.t} x2={sxT(tNow)} y2={TOP.t + TOP.h} stroke="var(--accent-d)" strokeWidth={1} opacity={0.5} />
        ) : null}
        <text x={TOP.l + 6} y={TOP.t + 13} fontSize="11" fill="var(--mut)">
          {`真の振動 x(t) と、プローブが拾う点（最初の ${ZOOM} 回転）`}
        </text>

        {/* 右下：回転ごとの標本（プローブ別） */}
        <rect x={BOT.l} y={BOT.t} width={W - BOT.l - BOT.r} height={BOT.h} fill="var(--soft)" opacity={0.35} />
        <line x1={BOT.l} y1={syB(0)} x2={W - BOT.r} y2={syB(0)} stroke="var(--line)" />
        {probeAngles.map((_, p) => {
          const pts = shown.filter((s) => s.p === p).map((s) => `${sxB(s.r).toFixed(1)},${syB(s.v).toFixed(1)}`);
          return pts.length > 1 ? (
            <polyline key={p} points={pts.join(" ")} fill="none" stroke={PROBE_COLORS[p]} strokeWidth={1.4} opacity={0.7} />
          ) : null;
        })}
        {shown.map((s, i) => (
          <circle key={i} cx={sxB(s.r)} cy={syB(s.v)} r={3.2} fill={PROBE_COLORS[s.p]} />
        ))}
        <text x={BOT.l + 6} y={BOT.t + 13} fontSize="11" fill="var(--mut)">
          BTT が見る波形（横軸＝回転の番号）
        </text>
        <text x={(BOT.l + W - BOT.r) / 2} y={H - 8} fontSize="10" fill="var(--mut)" textAnchor="middle">
          1 回転 1 点（プローブごと）
        </text>
      </svg>
      </div>

      <div className="mt-2 grid min-h-[3.25rem] gap-x-4 text-sm text-mut sm:grid-cols-2">
        <div>
          励起次数 f/Ω = <b className="tabular-nums text-ink">{EO.toFixed(2)}</b>
          {isSync ? "（整数＝同期）" : nearSync ? "（同期近傍）" : "（非整数＝非同期）"}
        </div>
        <div>
          1本のプローブに見える周波数 <b className="tabular-nums text-ink">{fAlias.toFixed(1)} Hz</b>
          {isSync ? "：ずれが一定で振動が見えない" : nearSync ? "：ゆっくりしたうなりだけが見える" : ""}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <span className="text-xs text-mut">プローブ本数</span>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setProbes(n)}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (n === probes ? "border-accent bg-accent/10 text-accent" : "border-line bg-white text-mut hover:border-accent hover:text-accent")
            }
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider
          label="回転速度 Ω"
          value={omega}
          min={10}
          max={50}
          step={0.5}
          format={(v) => `${Math.round(v * 60)} rpm`}
          onChange={(v) => setParam("omega", v)}
        />
        <Slider label="翼の振動周波数 f" value={f} min={10} max={300} step={1} unit=" Hz" onChange={(v) => setParam("f", v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
