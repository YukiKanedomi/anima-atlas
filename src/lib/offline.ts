// オフライン対応（PWA）。
// ・service worker（vite-plugin-pwa / Workbox）が、アプリ本体・節の本文（md）・outline / symbols・
//   たとえ話アイコン・KaTeX フォントを precache する → 一度開けば本文は圏外でも読める。
// ・写真や小図（data/books/**/images/）は大きいので precache せず、見た節のぶんだけ
//   runtime cache（CacheFirst）に溜める。全部まとめて落としたい人のために saveAllForOffline() を用意。
import { registerSW } from "virtual:pwa-register";
import { asset } from "./data";

export function setupOffline() {
  if (!("serviceWorker" in navigator)) return;
  registerSW({ immediate: true });
}

export type SaveProgress = { done: number; total: number; failed: number };

// 全節の本文を読み、そこに出てくる画像をすべて取りに行く（SW の runtime cache に入る）。
// 戻り値は最終的な進捗。onProgress は 1 枚ごとに呼ぶ。
export async function saveAllForOffline(
  bookDir: string,
  onProgress: (p: SaveProgress) => void,
  signal?: AbortSignal
): Promise<SaveProgress> {
  const outline = (await (await fetch(asset(`${bookDir}/outline.json`))).json()) as {
    chapters: { sections: { file: string }[] }[];
  };
  const files = outline.chapters.flatMap((c) => c.sections.map((s) => s.file));
  const images = new Set<string>();
  for (const f of files) {
    if (signal?.aborted) break;
    const md = await (await fetch(asset(`${bookDir}/${f}`))).text();
    for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) images.add(m[1]);
  }
  const list = [...images];
  const prog: SaveProgress = { done: 0, total: list.length, failed: 0 };
  onProgress({ ...prog });
  // 4 本ずつ並列で取りに行く（回線を占有しすぎない）
  let i = 0;
  const worker = async () => {
    while (i < list.length && !signal?.aborted) {
      const p = list[i++];
      try {
        const r = await fetch(asset(p), { cache: "force-cache" });
        if (!r.ok) prog.failed++;
      } catch {
        prog.failed++;
      }
      prog.done++;
      onProgress({ ...prog });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return prog;
}
