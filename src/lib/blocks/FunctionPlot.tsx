import { useMemo } from "react";
import { compileExpr } from "../expr";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// 汎用ブロック：スライダー連動グラフ（y = f(x)）。
// 数式とスライダーを JSON で宣言するだけで、本物の曲線がリアルタイムに動く。
// これが「例題の数字をいじる→図が変わる」の最小単位。

export type SliderDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
};

export type FunctionPlotConfig = {
  title?: string;
  caption?: string;
  xKey?: string; // 既定 "x"
  xLabel: string;
  yLabel: string;
  xMin: number;
  xMax: number;
  yMin?: number;
  yMax?: number;
  samples?: number;
  expr: string;
  sliders?: SliderDef[];
  markerX?: number; // 縦の目印線（例：危険速度 x=1）
  markerLabel?: string;
  link?: string; // 連動グループ名（同名の他ブロックとスライダー値を共有）
  cursor?: { param: string; yUnit?: string }; // 共有パラメータ上を動く点（連動の可視化）
};

const W = 640;
const H = 360;
const PAD = { l: 50, r: 18, t: 18, b: 38 };

export default function FunctionPlot({ config }: { config: FunctionPlotConfig }) {
  const xKey = config.xKey ?? "x";
  const sliders = config.sliders ?? [];
  const samples = config.samples ?? 240;

  const instId = useInstanceId("fp");
  const [vals, setParam] = useSharedParams(
    config.link ?? instId,
    Object.fromEntries(sliders.map((s) => [s.key, s.default]))
  );

  // xKey と同名のスライダー（連動カーソル用の r など）は変数名を重複させないよう除外。
  const compiled = useMemo(
    () =>
      compileExpr(config.expr, [
        xKey,
        ...sliders.map((s) => s.key).filter((k) => k !== xKey),
      ]),
    [config.expr, xKey, sliders]
  );

  const { path, yLo, yHi } = useMemo(() => {
    const pts: Array<[number, number]> = [];
    let dataMax = -Infinity;
    for (let i = 0; i <= samples; i++) {
      const x = config.xMin + ((config.xMax - config.xMin) * i) / samples;
      // xKey は最後に上書き（xKey と同名の共有パラメータがあっても曲線は x で走査）。
      const y = compiled({ ...vals, [xKey]: x });
      if (Number.isFinite(y)) {
        pts.push([x, y]);
        if (y > dataMax) dataMax = y;
      }
    }
    const yLo = config.yMin ?? 0;
    const yHi =
      config.yMax ?? (Number.isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 1);

    const sx = (x: number) =>
      PAD.l + ((x - config.xMin) / (config.xMax - config.xMin)) * (W - PAD.l - PAD.r);
    const sy = (y: number) => {
      const c = Math.min(Math.max(y, yLo), yHi);
      return H - PAD.b - ((c - yLo) / (yHi - yLo)) * (H - PAD.t - PAD.b);
    };

    let d = "";
    pts.forEach(([x, y], i) => {
      d += `${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(y).toFixed(1)} `;
    });
    return { path: d.trim(), yLo, yHi };
  }, [compiled, vals, config, xKey, samples]);

  // 目印線・カーソルの座標変換（yLo/yHi は描画メモから取得済み）。
  const sx = (x: number) =>
    PAD.l + ((x - config.xMin) / (config.xMax - config.xMin)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => {
    const c = Math.min(Math.max(y, yLo), yHi);
    return H - PAD.b - ((c - yLo) / (yHi - yLo)) * (H - PAD.t - PAD.b);
  };

  // 連動カーソル：共有パラメータ cursor.param の現在値の位置に点を打つ。
  const cur = config.cursor;
  const cursorX = cur ? vals[cur.param] : undefined;
  const cursorY =
    cur && cursorX !== undefined
      ? compiled({ ...vals, [xKey]: cursorX })
      : undefined;
  const showCursor =
    cursorX !== undefined && cursorY !== undefined && Number.isFinite(cursorY);

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">
          {config.title}
        </figcaption>
      ) : null}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={config.title ?? "グラフ"}
      >
        {/* 枠と軸 */}
        <rect
          x={PAD.l}
          y={PAD.t}
          width={W - PAD.l - PAD.r}
          height={H - PAD.t - PAD.b}
          fill="var(--soft)"
          opacity={0.35}
        />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />

        {/* 危険速度などの目印線 */}
        {config.markerX !== undefined ? (
          <>
            <line
              x1={sx(config.markerX)}
              y1={PAD.t}
              x2={sx(config.markerX)}
              y2={H - PAD.b}
              stroke="var(--accent)"
              strokeDasharray="4 4"
              opacity={0.5}
            />
            {config.markerLabel ? (
              <text
                x={sx(config.markerX) + 6}
                y={PAD.t + 14}
                fontSize="12"
                fill="var(--accent-d)"
              >
                {config.markerLabel}
              </text>
            ) : null}
          </>
        ) : null}

        {/* 曲線 */}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.4} />

        {/* 連動カーソル（共有パラメータの現在地） */}
        {showCursor ? (
          <>
            <line
              x1={sx(cursorX!)}
              y1={PAD.t}
              x2={sx(cursorX!)}
              y2={H - PAD.b}
              stroke="var(--accent-d)"
              strokeWidth={1}
              opacity={0.35}
            />
            <circle cx={sx(cursorX!)} cy={sy(cursorY!)} r={5.5} fill="var(--accent-d)" />
            <text
              x={sx(cursorX!) + 8}
              y={sy(cursorY!) - 8}
              fontSize="12"
              fill="var(--accent-d)"
            >
              {Math.round(cursorY!)}
              {cur?.yUnit ?? ""}
            </text>
          </>
        ) : null}

        {/* 軸ラベル */}
        <text
          x={(PAD.l + W - PAD.r) / 2}
          y={H - 6}
          fontSize="12"
          fill="var(--mut)"
          textAnchor="middle"
        >
          {config.xLabel}
        </text>
        <text
          x={14}
          y={(PAD.t + H - PAD.b) / 2}
          fontSize="12"
          fill="var(--mut)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}
        >
          {config.yLabel}
        </text>

        {/* y軸の上端値 */}
        <text x={PAD.l - 6} y={PAD.t + 10} fontSize="11" fill="var(--mut)" textAnchor="end">
          {yHi}
        </text>
        <text x={PAD.l - 6} y={H - PAD.b} fontSize="11" fill="var(--mut)" textAnchor="end">
          {yLo}
        </text>
      </svg>

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

      {config.caption ? (
        <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p>
      ) : null}
    </figure>
  );
}
