import { useEffect, useMemo, useRef, useState } from "react";
import { PlayPause } from "../../components/PlayPause";
import { Slider } from "../../components/Slider";

// 翼振動章：翼の固有モード（片持ちはりとしての翼）。
// 一様な片持ちはり（clamped-free）の曲げモード：
//   ψ_n(ξ) = cosh(β_nξ) − cos(β_nξ) − σ_n (sinh(β_nξ) − sin(β_nξ))
//   σ_n = (cosh β_n + cos β_n)/(sinh β_n + sin β_n)、 β_n L = 1.8751, 4.6941, 7.8548
//   固有振動数 f_n = (β_nL)²/(2πL²)·√(EI/ρA) → 振動数比 1 : 6.27 : 17.5
//   一様な矩形断面なら f_1 ∝ h/L²（厚さに比例・長さの2乗に反比例）
// ねじり 1T：一様な棒の clamped-free ねじり 1次 φ(ξ)=sin(πξ/2)（翼の形で変わるため「模式」）。
// 「叩く」：ping test の見立て。減衰正弦波 e^{−ζωt}·sin(ωt)（ζ=0.02）をそのモードの振動数比で描く。

export type BladeModesConfig = {
  title?: string;
  caption?: string;
  modeDefault?: "1F" | "2F" | "3F" | "1T";
};

type Mode = "1F" | "2F" | "3F" | "1T";
const MODES: Mode[] = ["1F", "2F", "3F", "1T"];
const BL = [1.87510407, 4.69409113, 7.85475744];
const RATIO = BL.map((b) => (b / BL[0]) ** 2); // 1, 6.27, 17.5

function bendShape(n: number, xi: number): number {
  const b = BL[n - 1];
  const s = (Math.cosh(b) + Math.cos(b)) / (Math.sinh(b) + Math.sin(b));
  return Math.cosh(b * xi) - Math.cos(b * xi) - s * (Math.sinh(b * xi) - Math.sin(b * xi));
}

const W = 660;
const H = 330;
// 上段：側面図（曲げ）／平面図（ねじり）。下段：叩いた波形。
const TOP = { x0: 70, x1: 560, cy: 110, amp: 46 };
const BOT = { x0: 70, x1: 640, y0: 220, y1: 320 };
const HEAVY = "#9b2d3a";

export default function BladeModes({ config }: { config: BladeModesConfig }) {
  const [mode, setMode] = useState<Mode>(config.modeDefault ?? "1F");
  const [running, setRunning] = useState(true);
  const [theta, setTheta] = useState(Math.PI / 2);
  const [len, setLen] = useState(1.0); // 翼の長さ（基準比）
  const [thick, setThick] = useState(1.0); // 翼の厚さ（基準比）
  const [pingAt, setPingAt] = useState<number | null>(null); // 叩いた瞬間（rAF時刻）
  const [pingT, setPingT] = useState(0); // 叩いてからの経過（秒）
  const raf = useRef<number>();
  const last = useRef<number>();

  // 振動数比（1F=1）。曲げは f ∝ h/L²。ねじりは一様棒の見立てで 1F の 2.6 倍に置く（模式）。
  const geom = thick / (len * len);
  const fRel = mode === "1T" ? 2.6 * geom : RATIO[Number(mode[0]) - 1] * geom;

  useEffect(() => {
    if (!running) {
      last.current = undefined;
      return;
    }
    const step = (t: number) => {
      if (last.current !== undefined) {
        const dt = (t - last.current) / 1000;
        // 見た目の回転速さはモードの振動数比に緩く比例（高いモードほど速く）
        setTheta((th) => (th + (1.6 + 0.6 * Math.log1p(fRel)) * dt * 2) % (Math.PI * 2));
        if (pingAt !== null) setPingT((t - pingAt) / 1000);
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, fRel, pingAt]);

  // 形状サンプル（正規化）と節
  const { pts, nodes } = useMemo(() => {
    const N = 120;
    if (mode === "1T") return { pts: [] as number[], nodes: [] as number[] };
    const n = Number(mode[0]);
    const raw: number[] = [];
    let mx = 1e-9;
    for (let i = 0; i <= N; i++) {
      const v = bendShape(n, i / N);
      raw.push(v);
      if (Math.abs(v) > mx) mx = Math.abs(v);
    }
    const pts = raw.map((v) => v / mx);
    const nodes: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i - 1] * pts[i] < 0) nodes.push((i - 0.5) / N);
    }
    return { pts, nodes };
  }, [mode]);

  const sx = (xi: number) => TOP.x0 + xi * (TOP.x1 - TOP.x0);
  const amp = Math.sin(theta);

  // 曲げ：側面図のパス（たわみ曲線を帯で描く）
  const bendPath = useMemo(() => {
    if (pts.length === 0) return "";
    const up: string[] = [];
    const dn: string[] = [];
    const thickPx = 7 * thick;
    pts.forEach((v, i) => {
      const xi = i / (pts.length - 1);
      const y = TOP.cy - v * amp * TOP.amp;
      up.push(`${i === 0 ? "M" : "L"}${sx(xi).toFixed(1)},${(y - thickPx / 2).toFixed(1)}`);
      dn.push(`L${sx(xi).toFixed(1)},${(y + thickPx / 2).toFixed(1)}`);
    });
    return up.join(" ") + " " + dn.reverse().join(" ") + " Z";
  }, [pts, amp, thick]);

  // ねじり：平面図。翼の根元〜先端に並べた弦（chord）が、先端ほど大きく回る。
  const twistLines = useMemo(() => {
    if (mode !== "1T") return [] as { x: number; y1: number; y2: number; xi: number }[];
    const out: { x: number; y1: number; y2: number; xi: number }[] = [];
    const M = 16;
    for (let i = 0; i <= M; i++) {
      const xi = i / M;
      const half = 34; // 弦の半分（px）
      const ang = Math.sin((Math.PI * xi) / 2) * amp * 0.9; // 一様棒の1次ねじり（模式）
      const dy = half * Math.cos(ang);
      out.push({ x: sx(xi), y1: TOP.cy - dy, y2: TOP.cy + dy, xi });
    }
    return out;
  }, [mode, amp]);

  // 叩いた波形：e^{−ζωt} sin(ωt)。横軸は共通の時間窓（1F が 6 周期見える長さ）。
  const pingPath = useMemo(() => {
    if (pingAt === null) return "";
    const zeta = 0.02;
    const omega = Math.PI * 2 * 1.0 * fRel; // 1F（基準）= 1 Hz 相当
    const Tw = 6; // 秒（表示窓）
    const n = 480;
    const p: string[] = [];
    const tmax = Math.min(pingT, Tw);
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Tw;
      if (t > tmax) break;
      const y = Math.exp(-zeta * omega * t) * Math.sin(omega * t);
      const X = BOT.x0 + (t / Tw) * (BOT.x1 - BOT.x0);
      const Y = (BOT.y0 + BOT.y1) / 2 - y * ((BOT.y1 - BOT.y0) / 2 - 6);
      p.push(`${i === 0 ? "M" : "L"}${X.toFixed(1)},${Y.toFixed(1)}`);
    }
    return p.join(" ");
  }, [pingAt, pingT, fRel]);

  const ping = () => {
    setPingAt(performance.now());
    setPingT(0);
    setRunning(true);
  };

  const modeLabel =
    mode === "1T" ? "1T：ねじり1次（翼が根元を軸にねじれる）" : `${mode}：曲げ${mode[0]}次（節 ${nodes.length} 個）`;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="翼の固有モードと叩いた波形">
        {/* 上段パネル */}
        <rect x={10} y={14} width={W - 20} height={190} fill="var(--soft)" opacity={0.35} />
        <text x={16} y={30} fontSize="11" fill="var(--mut)">
          {mode === "1T" ? "上から見た翼（平面図・模式）" : "横から見た翼（側面図）"}
        </text>

        {/* 根元の固定ブロック（円盤側） */}
        <rect x={TOP.x0 - 34} y={TOP.cy - 50} width={34} height={100} fill="var(--soft2)" stroke="var(--line)" />
        <text x={TOP.x0 - 17} y={TOP.cy + 66} fontSize="10" fill="var(--mut)" textAnchor="middle">
          根元
        </text>
        <text x={TOP.x1} y={TOP.cy + 66} fontSize="10" fill="var(--mut)" textAnchor="middle">
          先端
        </text>

        {/* 静止位置（薄い基準線） */}
        <line x1={TOP.x0} y1={TOP.cy} x2={TOP.x1} y2={TOP.cy} stroke="var(--line)" strokeDasharray="3 3" />

        {mode !== "1T" ? (
          <>
            <path d={bendPath} fill="var(--accent)" opacity={0.85} />
            {nodes.map((xi, i) => (
              <g key={i}>
                <circle cx={sx(xi)} cy={TOP.cy} r={4.5} fill="#fff" stroke={HEAVY} strokeWidth={2} />
                <text x={sx(xi)} y={TOP.cy - 54} fontSize="10" fill={HEAVY} textAnchor="middle">
                  節
                </text>
              </g>
            ))}
          </>
        ) : (
          <>
            {/* 翼の外形（平面図・薄い台形）と、ねじれる弦 */}
            <path
              d={`M${sx(0)},${TOP.cy - 36} L${sx(1)},${TOP.cy - 28} L${sx(1)},${TOP.cy + 28} L${sx(0)},${TOP.cy + 36} Z`}
              fill="var(--accent)"
              opacity={0.12}
            />
            {twistLines.map((l, i) => (
              <line
                key={i}
                x1={l.x}
                y1={l.y1}
                x2={l.x}
                y2={l.y2}
                stroke="var(--accent)"
                strokeWidth={i === twistLines.length - 1 ? 3 : 1.6}
                opacity={0.35 + 0.65 * l.xi}
              />
            ))}
            <line x1={sx(0)} y1={TOP.cy} x2={sx(1)} y2={TOP.cy} stroke={HEAVY} strokeDasharray="4 3" />
            <text x={sx(0.5)} y={TOP.cy - 44} fontSize="10" fill={HEAVY} textAnchor="middle">
              ねじりの軸（節線）
            </text>
          </>
        )}

        {/* 下段：叩いた波形 */}
        <rect x={10} y={BOT.y0 - 10} width={W - 20} height={BOT.y1 - BOT.y0 + 16} fill="var(--soft)" opacity={0.35} />
        <line x1={BOT.x0} y1={(BOT.y0 + BOT.y1) / 2} x2={BOT.x1} y2={(BOT.y0 + BOT.y1) / 2} stroke="var(--line)" />
        <line x1={BOT.x0} y1={BOT.y0} x2={BOT.x0} y2={BOT.y1} stroke="var(--line)" />
        <text x={16} y={BOT.y0 + 4} fontSize="11" fill="var(--mut)">
          叩いたあとの揺れ（ping test の見立て）
        </text>
        <text x={BOT.x1} y={BOT.y1 + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
          時間 →
        </text>
        {pingPath ? <path d={pingPath} fill="none" stroke={HEAVY} strokeWidth={1.8} /> : (
          <text x={(BOT.x0 + BOT.x1) / 2} y={(BOT.y0 + BOT.y1) / 2 - 8} fontSize="11" fill="var(--mut)" textAnchor="middle">
            「叩く」を押すと、そのモードの振動数で減衰していく波形が出ます
          </text>
        )}
      </svg>

      {/* モード切替＋状態 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (m === mode ? "border-accent bg-accent/10 text-accent" : "border-line text-mut hover:border-accent hover:text-accent")
            }
          >
            {m}
          </button>
        ))}
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <button
          type="button"
          onClick={ping}
          className="rounded-full border border-line px-3 py-1 text-sm text-mut transition-colors hover:border-accent hover:text-accent"
        >
          叩く
        </button>
      </div>
      <div className="mt-2 min-h-[1.5rem] text-sm text-mut">
        <span className="text-ink">{modeLabel}</span>
        <span className="ml-2">
          振動数（1F・基準形状 = 1 として）：<b className="tabular-nums text-ink">{fRel.toFixed(2)}</b>
          {mode === "1T" ? "（ねじりは模式値）" : ""}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="翼の長さ L（基準比）" value={len} min={0.6} max={1.6} step={0.01} onChange={setLen} />
        <Slider label="翼の厚さ h（基準比）" value={thick} min={0.5} max={1.6} step={0.01} onChange={setThick} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
