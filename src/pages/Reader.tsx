import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJson, fetchText, type Outline, type SectionRef } from "../lib/data";
import { Markdown } from "../lib/markdown";
import { SymbolsContext, type Sym } from "../lib/symbols";

const BOOK_DIR = "data/books/rotordynamics";

export default function Reader() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [outline, setOutline] = useState<Outline | null>(null);
  const [body, setBody] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [symbols, setSymbols] = useState<Record<string, Sym>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 目次（背骨）と記号正典を読む
  useEffect(() => {
    fetchJson<Outline>(`${BOOK_DIR}/outline.json`)
      .then(setOutline)
      .catch((e) => setError(String(e)));
    fetchJson<{ symbols: Sym[] }>(`${BOOK_DIR}/symbols.json`)
      .then((d) => setSymbols(Object.fromEntries(d.symbols.map((s) => [s.key, s]))))
      .catch(() => {}); // 記号が無くても本文は出す
  }, []);

  const allSections = useMemo<SectionRef[]>(
    () => outline?.chapters.flatMap((c) => c.sections) ?? [],
    [outline]
  );
  // URL の節IDを正とし、無ければ先頭の節。
  const currentId = sectionId ?? allSections[0]?.id ?? null;
  const current = allSections.find((s) => s.id === currentId) ?? null;

  // 現在地（章・通し番号・前後の節）
  const idx = allSections.findIndex((s) => s.id === currentId);
  const prev = idx > 0 ? allSections[idx - 1] : null;
  const next = idx >= 0 && idx < allSections.length - 1 ? allSections[idx + 1] : null;
  const currentChapter = outline?.chapters.find((c) =>
    c.sections.some((s) => s.id === currentId)
  );

  // 選ばれた節の本文を読む（読むたび先頭へ戻す）
  useEffect(() => {
    if (!current) return;
    setBody("");
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
    fetchText(`${BOOK_DIR}/${current.file}`)
      .then(setBody)
      .catch((e) => setError(String(e)));
  }, [current]);

  // ドロワーを開いている間は背面スクロールを止める
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (error) {
    return <p className="text-mut">読み込みに失敗しました：{error}</p>;
  }
  if (!outline) {
    return <p className="text-mut">読み込み中…</p>;
  }

  const go = (id: string) => navigate(`/read/${id}`);

  // 目次本体（PCサイドバー・スマホドロワーで共用）
  const toc = (
    <nav className="space-y-4">
      {outline.chapters.map((ch) => (
        <div key={ch.id}>
          <div className="text-xs font-semibold tracking-wide text-mut">{ch.title}</div>
          <ul className="mt-1 space-y-1">
            {ch.sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => go(s.id)}
                  className={
                    "text-left text-sm leading-6 transition-colors " +
                    (s.id === currentId ? "text-accent" : "text-ink/80 hover:text-accent")
                  }
                >
                  {s.title}
                  {s.status === "draft" ? (
                    <span className="ml-1 text-xs text-mut">（下書き）</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
      {/* PCサイドバー（スマホでは隠す） */}
      <aside className="hidden md:sticky md:top-6 md:block md:self-start">
        <div className="font-serif text-lg text-ink">{outline.book.title}</div>
        {outline.book.subtitle ? (
          <div className="mt-1 text-sm text-mut">{outline.book.subtitle}</div>
        ) : null}
        <div className="mt-4">{toc}</div>
      </aside>

      {/* 本文側 */}
      <div className="min-w-0">
        {/* スマホ用：細い現在地バー＋目次ボタン（本文の上に積もらない） */}
        <div className="-mt-2 mb-5 flex items-center gap-2 border-b border-line pb-3 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="目次を開く"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-ink active:bg-soft"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0 text-sm">
            {currentChapter ? (
              <span className="text-mut">{currentChapter.title}</span>
            ) : null}
            {current ? (
              <>
                <span className="mx-1 text-mut">▸</span>
                <span className="truncate text-ink">{current.title}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* 本文（記号正典を配って [[key]] のポップ定義を有効化） */}
        <article className="max-w-content">
          <SymbolsContext.Provider value={symbols}>
            {body ? <Markdown src={body} /> : <p className="text-mut">読み込み中…</p>}
          </SymbolsContext.Provider>
        </article>

        {/* 節末ナビ：前の節 / 次の節 */}
        <nav className="mt-12 flex items-stretch gap-3 border-t border-line pt-5">
          {prev ? (
            <button
              onClick={() => go(prev.id)}
              className="group flex-1 rounded-lg border border-line bg-white p-3 text-left transition-colors hover:border-accent"
            >
              <div className="text-xs text-mut">← 前の節</div>
              <div className="mt-0.5 text-sm text-ink group-hover:text-accent">{prev.title}</div>
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {next ? (
            <button
              onClick={() => go(next.id)}
              className="group flex-1 rounded-lg border border-line bg-white p-3 text-right transition-colors hover:border-accent"
            >
              <div className="text-xs text-mut">次の節 →</div>
              <div className="mt-0.5 text-sm text-ink group-hover:text-accent">{next.title}</div>
            </button>
          ) : (
            <div className="flex-1" />
          )}
        </nav>
      </div>

      {/* スマホ用：目次ドロワー（横からスライド） */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[82%] max-w-xs overflow-y-auto border-r border-line bg-paper p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-serif text-base text-ink">{outline.book.title}</div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="目次を閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-md text-mut active:bg-soft"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {toc}
          </div>
        </div>
      ) : null}
    </div>
  );
}
