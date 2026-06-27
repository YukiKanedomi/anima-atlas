import { useState } from "react";
import { useSymbols } from "../lib/symbols";

// 用語ポップ（details-on-demand）。本文中の記号/用語に点線下線を付け、
// ホバー（PC）またはタップ（スマホ）で小さな定義カードを開く。
// 本文を短く保ったまま、知りたい人だけ深掘りできる。
export function TermPop({ tokenKey, label }: { tokenKey: string; label?: string }) {
  const syms = useSymbols();
  const s = syms[tokenKey];
  const [open, setOpen] = useState(false);

  const display = label ?? s?.glyph ?? tokenKey;
  if (!s) return <>{display}</>; // 未登録なら素のテキスト（壊さない）

  return (
    <span className="relative inline-block">
      <span
        tabIndex={0}
        role="button"
        aria-label={`${s.name}の定義`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="cursor-help underline decoration-dotted decoration-accent/70 underline-offset-4"
      >
        {display}
      </span>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 block w-56 -translate-x-1/2 rounded-lg border border-line bg-white p-3 text-left shadow-pop"
        >
          <span className="block font-serif text-lg leading-none text-ink">
            {s.glyph}
            {s.read ? <span className="ml-1.5 text-xs text-mut">（{s.read}）</span> : null}
          </span>
          <span className="mt-1.5 block text-sm text-ink">{s.name}</span>
          {s.unit ? (
            <span className="mt-0.5 block text-xs text-mut">単位：{s.unit}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
