import { useEffect, useRef, useState } from "react";
import { Slider } from "../../components/Slider";

// ドメイン部品：振れ回り軌道アニメ（模式）。
// 上から見たロータ。回転中心 O のまわりを、軸の中心 C が半径 R で振れ回る。
// 重い点 G は C から偏心 e だけずれて一緒に回る。
// 回転数比 r を上げて危険速度を超えると、位相 φ が 180° に近づき、
// G が O に近づく（自動調心）のが目で見える。
// ※ e は見やすく誇張したスケール。物理関係（M, φ）は式どおり。

export type WhirlOrbitConfig = {
  title?: string;
  caption?: string;
  zeta?: number;
  rDefault?: number;
  rMin?: number;
  rMax?: number;
};

const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const E_DISP = 26; // 偏心 e の表示上の大きさ(px)
const R_MAX = 120; // 振れ回り半径の表示上限(px)
const HOUSING = 150;
const HEAVY = "#9b2d3a"; // 臙脂（重い点）

export default function WhirlOrbit({ config }: { config: WhirlOrbitConfig }) {
  const zeta = config.zeta ?? 0.1;
  const [r, setR] = useState(config.rDefault ?? 0.6);
  const [running, setRunning] = useState(true);
  const [theta, setTheta] = useState(0);
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
        setTheta((th) => (th + 1.5 * dt) % (Math.PI * 2));
      }
      last.current = t;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  // 物理関係（式どおり）
  const denom = Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2);
  const M = (r * r) / denom; // 振れ回り倍率 R/e
  const phi = Math.atan2(2 * zeta * r, 1 - r * r); // 位相(rad)
  const phiDeg = Math.round((phi * 180) / Math.PI);

  const R = Math.min(E_DISP * M, R_MAX);
  const cAng = theta - phi; // 応答は力より φ 遅れる
  const cx = CX + R * Math.cos(cAng);
  const cy = CY + R * Math.sin(cAng);
  const gx = cx + E_DISP * Math.cos(theta);
  const gy = cy + E_DISP * Math.sin(theta);

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label="振れ回り軌道（模式）">
          {/* ハウジング */}
          <circle cx={CX} cy={CY} r={HOUSING} fill="var(--soft)" opacity={0.4} stroke="var(--line)" />
          {/* 振れ回り軌道 */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--accent)" strokeDasharray="3 4" opacity={0.45} />
          {/* 偏心の円（G が描く軌道） */}
          <circle cx={cx} cy={cy} r={E_DISP} fill="none" stroke={HEAVY} strokeDasharray="2 3" opacity={0.35} />
          {/* 円板 */}
          <circle cx={cx} cy={cy} r={30} fill="var(--accent)" opacity={0.1} />
          {/* O→C 変位 */}
          <line x1={CX} y1={CY} x2={cx} y2={cy} stroke="var(--accent)" strokeWidth={1.6} opacity={0.7} />
          {/* C→G 偏心 */}
          <line x1={cx} y1={cy} x2={gx} y2={gy} stroke={HEAVY} strokeWidth={1.4} opacity={0.7} />
          {/* 回転中心 O */}
          <line x1={CX - 6} y1={CY} x2={CX + 6} y2={CY} stroke="var(--mut)" strokeWidth={1.2} />
          <line x1={CX} y1={CY - 6} x2={CX} y2={CY + 6} stroke="var(--mut)" strokeWidth={1.2} />
          {/* 軸の中心 C */}
          <circle cx={cx} cy={cy} r={4.5} fill="var(--accent-d)" />
          {/* 重い点 G */}
          <circle cx={gx} cy={gy} r={5.5} fill={HEAVY} />
        </svg>

        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mut">
            <span>回転中心 <b className="text-mut">O</b></span>
            <span>軸の中心 <b style={{ color: "var(--accent-d)" }}>C</b></span>
            <span>重い点 <b style={{ color: HEAVY }}>G</b></span>
          </div>

          <div className="mt-3">
            <Slider
              label="回転数の比 r = Ω / ωn"
              value={r}
              min={config.rMin ?? 0.2}
              max={config.rMax ?? 3}
              step={0.01}
              onChange={setR}
            />
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm">
            <button
              onClick={() => setRunning((v) => !v)}
              className="rounded border border-line px-3 py-1 text-ink transition-colors hover:border-accent"
            >
              {running ? "⏸ 一時停止" : "▶ 再生"}
            </button>
            <span className="tabular-nums text-mut">
              位相 φ = <b className="text-ink">{phiDeg}°</b> ／ 倍率 R/e = <b className="text-ink">{M.toFixed(1)}</b>
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-mut">
            r を 1 より大きくすると φ が 180° に近づき、重い点 G が回転中心 O の側へ。これが自動調心です。
          </p>
        </div>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
