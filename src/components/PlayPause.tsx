import clsx from "clsx";

// 再生/停止ボタン（絵文字なし・SVGアイコン）。紺アクセントの上品なピル。
export function PlayPause({
  running,
  onToggle,
  className,
}: {
  running: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={running ? "一時停止" : "再生"}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-mut transition-colors hover:border-accent hover:text-accent",
        className
      )}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        {running ? (
          <>
            <rect x="2.5" y="1.5" width="2.6" height="9" rx="1" />
            <rect x="6.9" y="1.5" width="2.6" height="9" rx="1" />
          </>
        ) : (
          <path d="M3 1.7 L10 6 L3 10.3 Z" />
        )}
      </svg>
      <span>{running ? "停止" : "再生"}</span>
    </button>
  );
}
