// 読了の足あと。読んだ節IDを localStorage に記録し、探検地図（Home）のピンに反映する。
// 「旅の地図」の世界観：歩いた場所が塗られていく。サーバ不要・端末ごと。

const KEY = "aa-visited:rotordynamics";

export function getVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markVisited(sectionId: string) {
  try {
    const s = getVisited();
    if (s.has(sectionId)) return;
    s.add(sectionId);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    // プライベートモード等で書けなくても本文表示は妨げない
  }
}
