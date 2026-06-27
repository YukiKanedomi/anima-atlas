import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：ポーラ線図（極座標プロット／ナイキスト図）。
// ジェフコット不釣り合い応答の複素ベクトル Z(r) を、回転数比 r を 0→大 と
// 掃引しながら複素平面に描く。振幅と位相を1枚に束ねた、計測診断の花形。
//   Z(r) = r² / ((1−r²) + i·2ζr) = M·e^(−iφ)
//   Re = r²(1−r²)/D,  Im = −2ζr³/D,  D=(1−r²)²+(2ζr)²
//   r→0：原点。 r=1：Re=0, Im=−1/(2ζ) ＝真下＝危険速度（位相−90°）。
//   r→∞：(−1, 0) に近づく（位相−180°）。
// ※ 位相遅れを「下向き」に取る計測の慣例。形・位置は式どおり。
// ζ を小さくするとループが大きく深くなる（共振が鋭い）。

export type PolarConfig = {
  title?: string;
  caption?: string;
  link?: string; // 連動グループ名（zeta を他ブロックと共有）
  zetaDefault?: number;
  rMax?: number;
};

const W = 560;
const H = 440;
const PAD = { l: 40, r: 20, t: 20, b: 40 };
const HEAVY = "#9b2d3a";

// 同期応答の複素ベクトル
function resp(r: number, zeta: number) {
  const D = (1 - r * r) ** 2 + (2 * zeta * r) ** 2 || 1e-9;
  return { re: (r * r * (1 - r * r)) / D, im: (-2 * zeta * r ** 3) / D };
}

export default function PolarPlot({ config }: { config: PolarConfig }) {
  const instId = useInstanceId("polar");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    zeta: config.zetaDefault ?? 0.1,
  });
  const zeta = vals.zeta;
  const rMax = config.rMax ?? 2.5;

  const [running, setRunning] = useState(true);
  const [rHead, setRHead] = useState(0.6);
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
        setRHead((r) => {
          const nr = r + 0.45 * dt; // 回転数を上げていく掃引
          return nr > rMax ? 0.02 : nr;
        });
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, rMax]);

  // 曲線サンプルと、等比でフィットさせるスケール
  const { d, sx, sy, ticks } = useMemo(() => {
    const N = 260;
    const pts: { r: number; re: number; im: number }[] = [];
    let minX = 0,
      maxX = 0,
      minY = 0,
      maxY = 0;
    for (let i = 0; i <= N; i++) {
      const r = 0.02 + ((rMax - 0.02) * i) / N;
      const { re, im } = resp(r, zeta);
      pts.push({ r, re, im });
      if (re < minX) minX = re;
      if (re > maxX) maxX = re;
      if (im < minY) minY = im;
      if (im > maxY) maxY = im;
    }
    const spanX = Math.max(0.2, maxX - minX);
    const spanY = Math.max(0.2, maxY - minY);
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const scale = Math.min(innerW / spanX, innerH / spanY);
    // 中央寄せのオフセット
    const offX = PAD.l + (innerW - spanX * scale) / 2;
    const offY = PAD.t + (innerH - spanY * scale) / 2;
    const sx = (x: number) => offX + (x - minX) * scale;
    const sy = (y: number) => offY + (maxY - y) * scale; // 負のImを下へ
    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.re).toFixed(1)},${sy(p.im).toFixed(1)}`)
      .join(" ");
    const tickRs = [0.5, 1, 1.5, 2].filter((tr) => tr <= rMax);
    const ticks = tickRs.map((tr) => ({ r: tr, ...resp(tr, zeta) }));
    return { d, sx, sy, ticks };
  }, [zeta, rMax]);

  const head = resp(rHead, zeta);
  const mag = Math.hypot(head.re, head.im);
  const phaseDeg = Math.round((Math.atan2(head.im, head.re) * 180) / Math.PI);
  const ox = sx(0);
  const oy = sy(0);
  const res = resp(1, zeta); // 危険速度 r=1

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ポーラ線図">
          {/* 複素平面の軸（実=横・虚=縦、原点で交差） */}
          <line x1={PAD.l} y1={oy} x2={W - PAD.r} y2={oy} stroke="var(--line)" />
          <line x1={ox} y1={PAD.t} x2={ox} y2={H - PAD.b} stroke="var(--line)" />
          <text x={W - PAD.r} y={oy - 6} fontSize="11" fill="var(--mut)" textAnchor="end">
            実部（同相）
          </text>
          <text x={ox + 6} y={H - PAD.b} fontSize="11" fill="var(--mut)">
            位相遅れ ↓
          </text>

          {/* 応答曲線（回転数を上げたときの軌跡） */}
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2.2} />

          {/* 速度の目盛り点 */}
          {ticks.map((t) => (
            <g key={t.r}>
              <circle cx={sx(t.re)} cy={sy(t.im)} r={3} fill="var(--mut)" />
              <text x={sx(t.re) + 6} y={sy(t.im) + 4} fontSize="10" fill="var(--mut)">
                r={t.r}
              </text>
            </g>
          ))}

          {/* 危険速度 r=1（位相 −90°、ループの底） */}
          <circle cx={sx(res.re)} cy={sy(res.im)} r={6} fill="none" stroke={HEAVY} strokeWidth={2} />
          <text x={sx(res.re) + 9} y={sy(res.im) + 4} fontSize="11" fill={HEAVY}>
            危険速度 r=1（位相 −90°）
          </text>

          {/* 原点 */}
          <circle cx={ox} cy={oy} r={2.5} fill="var(--ink)" />

          {/* 掃引ベクトル（原点→現在の応答） */}
          <line x1={ox} y1={oy} x2={sx(head.re)} y2={sy(head.im)} stroke="var(--accent-d)" strokeWidth={1.6} />
          <circle cx={sx(head.re)} cy={sy(head.im)} r={5} fill="var(--accent-d)" />
        </svg>

        <div className="min-w-[180px]">
          <div className="tabular-nums text-sm text-mut">
            回転数比 r = <b className="text-ink">{rHead.toFixed(2)}</b>
            <br />
            振幅 |Z| = <b className="text-ink">{mag.toFixed(2)}</b>
            <br />
            位相 = <b className="text-ink">{phaseDeg}°</b>
          </div>

          <div className="mt-3">
            <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
          </div>

          <div className="mt-4">
            <Slider
              label="減衰比 ζ"
              value={zeta}
              min={0.03}
              max={0.6}
              step={0.01}
              onChange={(v) => setParam("zeta", v)}
            />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-mut">
            ζ を小さくするとループが大きく深くなります。底（位相 −90°）が危険速度です。
          </p>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
