import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// 図のタップ拡大（ライトボックス）。本はピンチ拡大を止めているので、細部を見る手段をここで用意する。
// 黒地に図を一枚。指二本で拡大、ドラッグで移動、ダブルタップ／ダブルクリックで 2.5 倍と等倍を切替、
// PC はホイールで拡大。Esc・×・（等倍のとき）地の部分のタップで閉じる。

export type LightboxItem = { src: string; alt: string; caption?: ReactNode };

const LightboxContext = createContext<(item: LightboxItem) => void>(() => {});
export const useLightbox = () => useContext(LightboxContext);

const MAX = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function LightboxHost({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<LightboxItem | null>(null);
  const open = useCallback((it: LightboxItem) => setItem(it), []);
  return (
    <LightboxContext.Provider value={open}>
      {children}
      {item ? <LightboxView item={item} onClose={() => setItem(null)} /> : null}
    </LightboxContext.Provider>
  );
}

type View = { s: number; x: number; y: number };

function LightboxView({ item, onClose }: { item: LightboxItem; onClose: () => void }) {
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: View; d0: number; cx: number; cy: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const closeBtn = useRef<HTMLButtonElement | null>(null);

  // 背面スクロールを止め、Esc で閉じる
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // 拡大の中心を保ったまま倍率を変える（画面中央基準の座標系）
  const zoomAt = (v: View, factor: number, px: number, py: number): View => {
    const s = clamp(v.s * factor, 1, MAX);
    const k = s / v.s;
    const x = px - (px - v.x) * k;
    const y = py - (py - v.y) * k;
    return s === 1 ? { s: 1, x: 0, y: 0 } : { s, x, y };
  };

  const center = (e: { clientX: number; clientY: number }) => ({
    px: e.clientX - window.innerWidth / 2,
    py: e.clientY - window.innerHeight / 2,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const v = viewRef.current;
    if (pts.length === 1) {
      gesture.current = { start: v, d0: 0, cx: pts[0].x, cy: pts[0].y, moved: false };
    } else if (pts.length === 2) {
      gesture.current = {
        start: v,
        d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        moved: true,
      };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId) || !gesture.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const g = gesture.current;
    if (pts.length === 1) {
      const dx = pts[0].x - g.cx, dy = pts[0].y - g.cy;
      if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true;
      if (g.start.s > 1) setView({ s: g.start.s, x: g.start.x + dx, y: g.start.y + dy });
    } else if (pts.length >= 2 && g.d0 > 0) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
      const px = g.cx - window.innerWidth / 2, py = g.cy - window.innerHeight / 2;
      const z = zoomAt(g.start, d / g.d0, px, py);
      setView(z.s === 1 ? z : { ...z, x: z.x + (mx - g.cx), y: z.y + (my - g.cy) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size > 0) {
      // 二本→一本に戻ったら、残った指からドラッグをやり直す
      const p = [...ptrs.current.values()][0];
      gesture.current = { start: viewRef.current, d0: 0, cx: p.x, cy: p.y, moved: true };
      return;
    }
    gesture.current = null;
    if (!g || g.moved) return;
    // タップ：ダブルタップで拡大／等倍、等倍の単タップで閉じる（画像の外側）
    const now = Date.now();
    const { px, py } = center(e);
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setView((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : zoomAt(v, 2.5, px, py)));
      return;
    }
    lastTap.current = now;
    const onImage = (e.target as HTMLElement).tagName === "IMG";
    if (!onImage && viewRef.current.s === 1) {
      // 単タップで閉じる。ただしダブルタップ判定の猶予のあいだは待つ
      window.setTimeout(() => {
        if (lastTap.current === now) onClose();
      }, 330);
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    const { px, py } = center(e);
    setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), px, py));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0f1420]/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={item.alt || "図の拡大表示"}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <span className="text-xs text-white/60 tabular-nums">{view.s > 1 ? `×${view.s.toFixed(1)}` : "二本指かダブルタップで拡大"}</span>
        <button
          ref={closeBtn}
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          aria-label="閉じる"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <img
          src={item.src}
          alt={item.alt}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-full max-w-full select-none"
          style={{
            transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.s})`,
            transformOrigin: "center",
            transition: gesture.current ? "none" : "transform 0.15s ease",
            cursor: view.s > 1 ? "grab" : "zoom-in",
          }}
        />
      </div>
      {item.caption ? (
        <div className="shrink-0 px-4 pb-4 pt-2 text-xs leading-relaxed text-white/70 [&_a]:underline">{item.caption}</div>
      ) : null}
    </div>
  );
}
