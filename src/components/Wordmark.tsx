import clsx from "clsx";

// ワードマーク（A案＝格調セリフ）。語の間の小さな点は「軌道の点＝動き」のニュアンス。
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-serif tracking-wide text-ink", className)}>
      Anima
      <span className="mx-[0.15em] align-middle text-accent">·</span>
      Atlas
    </span>
  );
}
