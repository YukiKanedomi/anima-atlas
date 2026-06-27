// データ取得ヘルパー。GitHub Pages のサブパスでも壊れないよう
// すべて import.meta.env.BASE_URL を起点にする。

export function asset(p: string): string {
  return import.meta.env.BASE_URL + p.replace(/^\//, "");
}

export async function fetchText(p: string): Promise<string> {
  const res = await fetch(asset(p));
  if (!res.ok) throw new Error(`取得に失敗：${p} (${res.status})`);
  return res.text();
}

export async function fetchJson<T>(p: string): Promise<T> {
  const res = await fetch(asset(p));
  if (!res.ok) throw new Error(`取得に失敗：${p} (${res.status})`);
  return res.json() as Promise<T>;
}

export type SectionRef = {
  id: string;
  title: string;
  file: string;
  status?: string;
  level?: "basic" | "advanced"; // 省略時 basic。advanced は目次に「発展」バッジ。
};

export type Outline = {
  book: { id: string; title: string; subtitle?: string; accent?: string };
  chapters: { id: string; title: string; sections: SectionRef[] }[];
};
