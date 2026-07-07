import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "../../components/Slider";
import { PlayPause } from "../../components/PlayPause";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：エイリアシング（サンプリングの罠）。FFT章③。
// 速い波を粗い間隔で測ると、点列は「別の遅い波」と完全に一致してしまう。
//   見かけの周波数 f' = f − round(f/fs)·fs（符号が負なら逆向き）
//   エイリアス波はサンプル点を厳密に通る（誤差~1e-13、Node検証済み）
// 左＝ストロボで見た回転円板（点滅ごとのマーカー残像→止まる/逆回り）、
// 右＝波形とサンプル点＋点列に合う見かけの波。境界は fs = 2f（標本化定理）。

export type AliasingConfig = {
  title?: string;
  caption?: string;
  link?: string;
  fDefault?: number;
  fsDefault?: number;
};

const DISK = 216; // ストロボ円板パネル
const DC = DISK / 2;
const DR = 78;
const WW = 400; // 波形パネル
const WH = 216;
const WPL = 8, WPR = 8;
const TSPAN = 2; // 秒
const GOLD = "#c08a2e";
const HEAVY = "#9b2d3a";
const GREEN = "#1f7a4f";
const GHOSTS = 7;

export default function Aliasing({ config }: { config: AliasingConfig }) {
  const instId = useInstanceId("alias");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    f: config.fDefault ?? 4,
    fs: config.fsDefault ?? 10,
  });
  const { f, fs } = vals;
  const [running, setRunning] = useState(true);
  const [n, setN] = useState(0); // ストロボの閃光回数
  const raf = useRef<number>();
  const last = useRef<number>();
  const acc = useRef(0);

  // ストロボ再生：実時間0.55秒ごとに1閃光
  useEffect(() => {
    if (!running) { last.current = undefined; return; }
    const step = (t: number) => {
      if (last.current !== undefined) {
        acc.current += (t - last.current) / 1000;
        if (acc.current >= 0.55) {
          acc.current = 0;
          setN((x) => x + 1);
        }
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running]);

  const k = Math.round(f / fs);
  const fApp = f - k * fs; // 見かけの周波数（符号つき）
  const aliased = Math.abs(Math.abs(fApp) - f) > 0.01 || fApp < 0;
  const stopped = Math.abs(fApp) < 0.02;

  // ストロボ円板：現在と残像のマーカー角
  const angles = Array.from({ length: GHOSTS + 1 }, (_, i) => {
    const ni = n - i;
    return (2 * Math.PI * f * ni) / fs;
  });
  const mx = (th: number) => DC + DR * Math.cos(th);
  const my = (th: number) => DC - DR * Math.sin(th);

  // 波形：真の波・サンプル点・見かけの波
  const { trueD, aliasD, dots } = useMemo(() => {
    const mid = WH / 2;
    const A = WH * 0.36;
    const sx = (t: number) => WPL + (t / TSPAN) * (WW - WPL - WPR);
    const sy = (v: number) => mid - v * A;
    const M = 700;
    let trueD = "", aliasD = "";
    for (let s = 0; s <= M; s++) {
      const t = (TSPAN * s) / M;
      const cmd = s === 0 ? "M" : "L";
      trueD += `${cmd}${sx(t).toFixed(1)},${sy(Math.sin(2 * Math.PI * f * t)).toFixed(1)}`;
      aliasD += `${cmd}${sx(t).toFixed(1)},${sy(Math.sin(2 * Math.PI * fApp * t)).toFixed(1)}`;
    }
    const dots: { x: number; y: number }[] = [];
    for (let i = 0; i * (1 / fs) <= TSPAN; i++) {
      const t = i / fs;
      dots.push({ x: sx(t), y: sy(Math.sin(2 * Math.PI * f * t)) });
    }
    return { trueD, aliasD, dots };
  }, [f, fs, fApp]);

  const ok = fs > 2 * f;

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption> : null}

      <div className="grid items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        {/* ストロボで見た回転円板 */}
        <div className="mx-auto">
          <svg viewBox={`0 0 ${DISK} ${DISK}`} width={DISK} height={DISK} role="img" aria-label="ストロボで見た回転円板">
            <circle cx={DC} cy={DC} r={DR + 14} fill="var(--soft)" opacity={0.5} stroke="var(--line)" />
            <circle cx={DC} cy={DC} r={DR} fill="#fff" stroke="var(--accent)" strokeWidth={2} />
            <circle cx={DC} cy={DC} r={4} fill="var(--accent)" />
            {/* 残像（古いほど薄い） */}
            {angles.slice(1).map((th, i) => (
              <circle key={i} cx={mx(th)} cy={my(th)} r={7} fill={GOLD} opacity={0.32 * (1 - i / GHOSTS)} />
            ))}
            {/* 現在のマーカー */}
            <circle cx={mx(angles[0])} cy={my(angles[0])} r={9} fill={GOLD} stroke="#fff" strokeWidth={1.5} />
            <text x={DC} y={DISK - 4} fontSize="11" fill="var(--mut)" textAnchor="middle">
              ストロボで見た回転（点滅 {fs.toFixed(1)} 回/秒）
            </text>
          </svg>
        </div>

        {/* 波形とサンプル点 */}
        <div className="min-w-0">
          <svg viewBox={`0 0 ${WW} ${WH}`} className="w-full" role="img" aria-label="波形とサンプル点">
            <rect x={WPL} y={0} width={WW - WPL - WPR} height={WH - 18} fill="var(--soft)" opacity={0.35} />
            <line x1={WPL} y1={(WH - 18) / 2 + 0} x2={WW - WPR} y2={(WH - 18) / 2} stroke="var(--line)" />
            {/* 真の波 */}
            <path d={trueD} fill="none" stroke="var(--accent)" strokeWidth={1.6} opacity={0.85} />
            {/* 見かけの波（エイリアス時のみ強調） */}
            {aliased ? <path d={aliasD} fill="none" stroke={HEAVY} strokeWidth={2.2} strokeDasharray="6 4" /> : null}
            {/* サンプル点 */}
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={4} fill={GOLD} stroke="#fff" strokeWidth={1} />
            ))}
            <text x={WPL + 2} y={WH - 4} fontSize="11" fill="var(--mut)">
              真の波（紺 {f.toFixed(1)} Hz）とサンプル点（金）{aliased ? "／点に合う見かけの波（赤破線）" : ""}
            </text>
          </svg>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
            <span
              className={"rounded-full px-2.5 py-0.5 font-semibold text-white"}
              style={{ background: ok ? GREEN : HEAVY }}
            >
              {ok ? "正しく捕まえた" : stopped ? "止まって見える！" : fApp < 0 ? "エイリアス：逆回りに見える" : "エイリアス：遅い波に化けた"}
            </span>
            <span className="w-full text-mut sm:w-auto">
              見かけ <b className="tabular-nums text-ink">{Math.abs(fApp).toFixed(2)}</b> Hz
              {aliased && !stopped ? (fApp < 0 ? "（向きも反転）" : "") : ""}
              ／ 境界 fs = 2f = <b className="tabular-nums text-ink">{(2 * f).toFixed(1)}</b>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="真の回転数・周波数 f（Hz）" value={f} min={0.5} max={6} step={0.1} onChange={(v) => setParam("f", v)} />
        <Slider label="サンプリング（点滅）の速さ fs（回/秒）" value={fs} min={1} max={12} step={0.1} onChange={(v) => setParam("fs", v)} />
      </div>

      <div className="mt-3">
        <PlayPause running={running} onToggle={() => setRunning((v) => !v)} />
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
