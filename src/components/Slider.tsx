// ラベル付きスライダー。値はその場で数値表示。
// format を渡すと表示だけ差し替えられる（例：対数スライダーで 3.48 → "3,000 rpm"）。
type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
};

// step の小数桁数（0.01 → 2桁）。アニメが setParam で書く生の浮動小数
// （0.21499460000000005 等）をそのまま出すと桁数が暴れて行折り返しが変わり、
// スマホで画面ががくがくする。表示は常に step の桁へ丸めて幅を一定に保つ。
function stepDecimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot >= 0 ? s.length - dot - 1 : 0;
}

export function Slider({ label, value, min, max, step, unit, format, onChange }: Props) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const shown = format ? format(value) : value.toFixed(stepDecimals(step));
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-mut">{label}</span>
        <span className="font-ui tabular-nums text-ink">
          {shown}
          {unit ? <span className="text-mut">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="aa-range mt-2"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, var(--soft2) ${pct}%)`,
        }}
      />
    </label>
  );
}
