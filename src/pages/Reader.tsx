import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJson, fetchText, type Outline, type SectionRef } from "../lib/data";
import { Markdown, extractHeadings } from "../lib/markdown";
import { OfflineButton } from "../components/OfflineButton";
import { getVisited, markVisited } from "../lib/progress";
import { SymbolsContext, type Sym } from "../lib/symbols";
import { MathFoldContext } from "../lib/Math";

const BOOK_DIR = "data/books/rotordynamics";

export default function Reader() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [outline, setOutline] = useState<Outline | null>(null);
  const [body, setBody] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [symbols, setSymbols] = useState<Record<string, Sym>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // 目次で手で開いた章（いま読んでいる章は常に開く）
  const [openChapters, setOpenChapters] = useState<Set<string>>(() => new Set());
  const [visited, setVisited] = useState<Set<string>>(() => getVisited());
  // 読み位置（0〜1）。スマホの帯の下に細い線で出す
  const [progress, setProgress] = useState(0);
  const asideRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // 数式をたたむ設定（端末ごとに記憶）
  const [foldMath, setFoldMath] = useState<boolean>(() => {
    try {
      // URL の ?fold=1 でも入れる（共有用）。それ以外は端末の記憶に従う。
      if (new URLSearchParams(window.location.search).get("fold") === "1") return true;
      return localStorage.getItem("aa-foldmath") === "1";
    } catch {
      return false;
    }
  });
  const toggleFold = () => {
    const v = !foldMath;
    setFoldMath(v);
    try {
      localStorage.setItem("aa-foldmath", v ? "1" : "0");
    } catch {
      // 書けなくても表示は妨げない
    }
  };

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
  // 節内ナビ：本文の見出し一覧（最上位の ## のみ）
  const headings = useMemo(() => (body ? extractHeadings(body) : []), [body]);
  const jumpTo = (id: string) => {
    setDrawerOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // 部の進行バー：章に part がある場合だけ。部ごとの先頭節と現在の部。
  const parts = useMemo(() => {
    if (!currentChapter) return [] as { label: string; firstId: string }[];
    const out: { label: string; firstId: string }[] = [];
    for (const s of currentChapter.sections) {
      if (s.part && !out.some((p) => p.label === s.part)) out.push({ label: s.part, firstId: s.id });
    }
    return out;
  }, [currentChapter]);
  const chapterIdx = currentChapter ? currentChapter.sections.findIndex((s) => s.id === currentId) : -1;

  // 選ばれた節の本文を読む（読むたび先頭へ戻し、足あとを残す）
  useEffect(() => {
    if (!current) return;
    setBody("");
    setDrawerOpen(false);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
    markVisited(current.id);
    setVisited(getVisited());
    fetchText(`${BOOK_DIR}/${current.file}`)
      .then(setBody)
      .catch((e) => setError(String(e)));
  }, [current]);

  // 節が変わったら、目次の手開きは畳み直す（いま読んでいる章だけ開いた状態に戻る）
  useEffect(() => {
    setOpenChapters(new Set());
  }, [currentId]);

  // PC の左目次：節が変わったら、目次の中で現在地が見える位置へ（ページはスクロールさせない）
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const el = aside.querySelector<HTMLElement>('[data-current="1"]');
    if (!el) return;
    aside.scrollTop = Math.max(0, el.offsetTop - aside.clientHeight / 2);
  }, [currentId, body]);

  // 読み位置：ページ全体に対するスクロール割合（rAF で間引き）
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [body]);

  // ドロワーを開いている間は背面スクロールを止める
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // 「…」メニュー：外側のタップで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  if (error) {
    return <p className="text-mut">読み込みに失敗しました：{error}</p>;
  }
  if (!outline) {
    return <p className="text-mut">読み込み中…</p>;
  }

  const go = (id: string) => navigate(`/read/${id}`);
  const toggleChapter = (id: string) =>
    setOpenChapters((prevSet) => {
      const s = new Set(prevSet);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  // 目次本体（PCサイドバー・スマホドロワーで共用）。章ごとに畳み、いま読んでいる章だけ開く。
  const toc = (
    <nav className="space-y-1">
      {outline.chapters.map((ch, ci) => {
        const isCurrent = ch.id === currentChapter?.id;
        const open = isCurrent || openChapters.has(ch.id);
        const done = ch.sections.filter((s) => visited.has(s.id)).length;
        const complete = done === ch.sections.length && done > 0;
        return (
          <div key={ch.id} className={open ? "pb-2" : ""}>
            <button
              onClick={() => (isCurrent ? undefined : toggleChapter(ch.id))}
              aria-expanded={open}
              className={
                "flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs font-semibold tracking-wide transition-colors " +
                (isCurrent ? "text-accent" : "text-mut hover:text-ink")
              }
            >
              <span className="w-5 shrink-0 text-right tabular-nums text-[11px] opacity-70">{ci + 1}</span>
              <span className="min-w-0 flex-1 truncate">{ch.title}</span>
              {complete ? (
                <svg width="11" height="11" viewBox="0 0 12 12" aria-label="読了" className="shrink-0 text-accent">
                  <path d="M2 6.5l2.5 2.8L10 3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="shrink-0 text-[10px] font-normal tabular-nums opacity-70">
                  {done > 0 ? `${done}/${ch.sections.length}` : ch.sections.length}
                </span>
              )}
              {!isCurrent ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                  className={"shrink-0 opacity-60 transition-transform " + (open ? "rotate-90" : "")}
                >
                  <path d="M3 1.5l4 3.5-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="w-2.5 shrink-0" />
              )}
            </button>
            {open ? (
              <ul className="ml-[22px] mt-0.5 space-y-0.5 border-l border-line pl-2.5">
                {ch.sections.map((s, si) => {
                  const seen = visited.has(s.id);
                  const cur = s.id === currentId;
                  return (
                    <li key={s.id}>
                      {s.part && s.part !== ch.sections[si - 1]?.part ? (
                        <div className="mb-1 mt-2 font-serif text-[11px] tracking-wide text-accent/80">{s.part}</div>
                      ) : null}
                      <button
                        onClick={() => go(s.id)}
                        data-current={cur ? "1" : undefined}
                        aria-current={cur ? "page" : undefined}
                        className={
                          "flex w-full items-start gap-1.5 text-left text-sm leading-6 transition-colors " +
                          (cur ? "text-accent" : seen ? "text-ink/80 hover:text-accent" : "text-ink/60 hover:text-accent")
                        }
                      >
                        {/* 読了の印：読んだ節は塗り、未読は輪、いまの節は紺 */}
                        <span
                          aria-hidden="true"
                          className={
                            "mt-[9px] h-[7px] w-[7px] shrink-0 rounded-full " +
                            (cur ? "bg-accent" : seen ? "bg-accent/45" : "border border-line bg-white")
                          }
                        />
                        <span className="min-w-0">
                          {s.title}
                          {s.level === "advanced" ? (
                            <span className="ml-1 rounded bg-accent/10 px-1 py-0.5 align-middle text-[10px] font-semibold text-accent">
                              発展
                            </span>
                          ) : null}
                          {s.status === "draft" ? <span className="ml-1 text-xs text-mut">（下書き）</span> : null}
                        </span>
                      </button>
                      {/* いま読んでいる節だけ、本文の見出しを畳まずに並べる（節内ナビ） */}
                      {cur && headings.length >= 2 ? (
                        <ul className="mb-1 ml-[3px] mt-1 space-y-0.5 border-l border-line pl-3">
                          {headings.map((h) => (
                            <li key={h.id}>
                              <button
                                onClick={() => jumpTo(h.id)}
                                className="text-left text-xs leading-5 text-mut transition-colors hover:text-accent"
                              >
                                {h.text}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );

  const foldLabel = foldMath ? "数式をたたんでいます（開く）" : "数式をたたむ";

  return (
    <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
      {/* PCサイドバー（スマホでは隠す） */}
      <aside
        ref={asideRef}
        className="hidden md:sticky md:top-6 md:block md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto md:pr-2"
      >
        <div className="font-serif text-lg text-ink">{outline.book.title}</div>
        {outline.book.subtitle ? (
          <div className="mt-1 text-sm text-mut">{outline.book.subtitle}</div>
        ) : null}
        <div className="mt-4">{toc}</div>
      </aside>

      {/* 本文側 */}
      <div className="min-w-0">
        {/* スマホ用：細い現在地の帯（画面上部に留まる）＝目次ボタン・章▸節・「…」メニュー、下端に読み位置の線 */}
        <div className="sticky top-0 z-30 -mx-4 -mt-8 mb-5 border-b border-line bg-paper/90 backdrop-blur md:hidden">
          <div className="flex h-11 items-center gap-2 px-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="目次を開く"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink active:bg-soft"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex min-w-0 flex-1 items-center text-left text-sm"
              aria-label="目次を開く"
            >
              {currentChapter ? <span className="shrink-0 text-mut">{currentChapter.title}</span> : null}
              {current ? (
                <>
                  <span className="mx-1 shrink-0 text-mut">▸</span>
                  <span className="min-w-0 truncate text-ink">{current.title}</span>
                </>
              ) : null}
            </button>
            <div ref={menuRef} className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="読み方のメニュー"
                aria-expanded={menuOpen}
                className={
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors active:bg-soft " +
                  (foldMath ? "text-accent" : "text-ink")
                }
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <circle cx="4" cy="9" r="1.6" fill="currentColor" />
                  <circle cx="9" cy="9" r="1.6" fill="currentColor" />
                  <circle cx="14" cy="9" r="1.6" fill="currentColor" />
                </svg>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-40 mt-1 flex w-64 flex-col items-stretch gap-2 rounded-lg border border-line bg-white p-3 shadow-pop">
                  <button
                    onClick={toggleFold}
                    aria-pressed={foldMath}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                      (foldMath ? "border-accent bg-accent/10 text-accent" : "border-line bg-white text-mut")
                    }
                  >
                    {foldLabel}
                  </button>
                  <OfflineButton bookDir={BOOK_DIR} />
                </div>
              ) : null}
            </div>
          </div>
          <div
            className="h-[2px] origin-left bg-accent/70"
            style={{ transform: `scaleX(${progress})` }}
            aria-hidden="true"
          />
        </div>

        {/* 部の進行バー（章に部があるとき）＋ 読み方の切替：数式をたたむ（PC。スマホは帯の「…」） */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {parts.length > 0 && current?.part ? (
            <nav aria-label="部の進行" className="flex flex-wrap items-center gap-1">
              {parts.map((p) => {
                const active = p.label === current.part;
                return (
                  <button
                    key={p.label}
                    onClick={() => go(p.firstId)}
                    aria-current={active ? "step" : undefined}
                    className={
                      "rounded border px-2 py-0.5 font-serif text-[11px] tracking-wide transition-colors " +
                      (active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line bg-white text-mut hover:border-accent hover:text-accent")
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
              {currentChapter ? (
                <span className="ml-1 text-[11px] text-mut">
                  {chapterIdx + 1}/{currentChapter.sections.length} 節
                </span>
              ) : null}
            </nav>
          ) : (
            <span />
          )}
          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={toggleFold}
              aria-pressed={foldMath}
              className={
                "rounded-full border px-3 py-1 text-xs transition-colors " +
                (foldMath
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line bg-white text-mut hover:border-accent hover:text-accent")
              }
            >
              {foldLabel}
            </button>
            <OfflineButton bookDir={BOOK_DIR} />
          </div>
        </div>

        {/* スマホ用：この節の流れ（見出しへ飛ぶ。PC は左目次に出る） */}
        {headings.length >= 3 ? (
          <details className="mb-4 rounded-lg border border-line bg-soft/40 px-3 py-2 text-sm md:hidden">
            <summary className="cursor-pointer select-none text-xs text-mut">
              この節の流れ（{headings.length} 見出し）
            </summary>
            <ol className="mt-2 space-y-1 pl-5 text-ink/80" style={{ listStyle: "decimal" }}>
              {headings.map((h) => (
                <li key={h.id}>
                  <button onClick={() => jumpTo(h.id)} className="text-left leading-6 hover:text-accent">
                    {h.text}
                  </button>
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {/* 本文（記号正典を配って [[key]] のポップ定義を有効化） */}
        <article className="max-w-content">
          <SymbolsContext.Provider value={symbols}>
            <MathFoldContext.Provider value={foldMath}>
              {body ? <Markdown src={body} /> : <p className="text-mut">読み込み中…</p>}
            </MathFoldContext.Provider>
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
