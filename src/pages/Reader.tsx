import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJson, fetchText, type Outline, type SectionRef } from "../lib/data";
import { Markdown } from "../lib/markdown";

const BOOK_DIR = "data/books/rotordynamics";

export default function Reader() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [outline, setOutline] = useState<Outline | null>(null);
  const [body, setBody] = useState<string>("");
  const [error, setError] = useState<string>("");

  // 目次（背骨）を読む
  useEffect(() => {
    fetchJson<Outline>(`${BOOK_DIR}/outline.json`)
      .then(setOutline)
      .catch((e) => setError(String(e)));
  }, []);

  const allSections = useMemo<SectionRef[]>(
    () => outline?.chapters.flatMap((c) => c.sections) ?? [],
    [outline]
  );
  // URL の節IDを正とし、無ければ先頭の節。
  const currentId = sectionId ?? allSections[0]?.id ?? null;
  const current = allSections.find((s) => s.id === currentId) ?? null;

  // 選ばれた節の本文を読む
  useEffect(() => {
    if (!current) return;
    setBody("");
    fetchText(`${BOOK_DIR}/${current.file}`)
      .then(setBody)
      .catch((e) => setError(String(e)));
  }, [current]);

  if (error) {
    return <p className="text-mut">読み込みに失敗しました：{error}</p>;
  }
  if (!outline) {
    return <p className="text-mut">読み込み中…</p>;
  }

  return (
    <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
      {/* 目次（背骨） */}
      <aside className="md:sticky md:top-6 md:self-start">
        <div className="font-serif text-lg text-ink">{outline.book.title}</div>
        {outline.book.subtitle ? (
          <div className="mt-1 text-sm text-mut">{outline.book.subtitle}</div>
        ) : null}
        <nav className="mt-4 space-y-4">
          {outline.chapters.map((ch) => (
            <div key={ch.id}>
              <div className="text-xs font-semibold tracking-wide text-mut">
                {ch.title}
              </div>
              <ul className="mt-1 space-y-1">
                {ch.sections.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/read/${s.id}`)}
                      className={
                        "text-left text-sm leading-6 transition-colors " +
                        (s.id === currentId
                          ? "text-accent"
                          : "text-ink/80 hover:text-accent")
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
      </aside>

      {/* 本文 */}
      <article className="min-w-0 max-w-content">
        {body ? <Markdown src={body} /> : <p className="text-mut">読み込み中…</p>}
      </article>
    </div>
  );
}
