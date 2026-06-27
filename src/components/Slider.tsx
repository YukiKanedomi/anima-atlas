// ラベル付きスライダー。値はその場で数値表示。
type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
};

export function Slider({ label, value, min, max, step, unit, onChange }: Props) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-mut">{label}</span>
        <span className="font-ui tabular-nums text-ink">
          {value}
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
        className="mt-1 w-full"
      />
    </label>
  );
}
