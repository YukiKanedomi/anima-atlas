import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getBlock, UnknownBlock } from "./blocks/registry";
import { BlockMath, InlineMath } from "./Math";
import { BlockBoundary } from "../components/BlockBoundary";
import { BlockFrame } from "../components/BlockFrame";
import { TermPop } from "../components/TermPop";
import { useLightbox } from "../components/Lightbox";
import { asset } from "./data";

// ごく小さな Markdown＋ディレクティブ描画。
// 対応：# / ## / ###、段落、**強調**、箇条書き(-)、
// そして本文中にブロックを埋め込むフェンス記法：
//
//   :::function-plot
//   { ...JSON設定... }
//   :::
//
// ※「短い解説＋濃いブロック」前提なので、まずはこれで十分。
// 数式(KaTeX)や表などは、必要になったら次のブロック/拡張として足す。

type Node =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "block"; name: string; config: unknown }
  | { kind: "block-error"; name: string; raw: string }
  | { kind: "disclosure"; variant: string; label: string; icon?: string; children: Node[] }
  | { kind: "image"; src: string; alt: string; caption: string; size?: "right" | "small" }
  | { kind: "math"; tex: string };

// 「容れ物」ディレクティブ＝中身をMarkdownとして畳む折りたたみ。
// JSON設定ブロック（registry）とは別系統。深掘り(深さ on demand)の土台。
// ここに名前を足すだけで色違いの折りたたみが増やせる（新構文は不要）。
const CONTAINERS: Record<string, { chip: string; open?: boolean }> = {
  deep: { chip: "深掘り" },
  history: { chip: "歴史" }, // 人物・事故・系譜の余談
  field: { chip: "実務" }, // 現場の落とし穴・設計の勘所
  analogy: { chip: "たとえ話", open: true }, // 難所の手すり。畳まず常に見える囲み
};

function parse(src: string): Node[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const nodes: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 容れ物ディレクティブ（:::deep タイトル … :::）。中身は再帰parse。
    // 入れ子の :::block も持てるよう、開き :::名前 で深さ++・閉じ ::: で深さ-- して対応をとる。
    const cm = line.match(/^:::\s*([a-z0-9-]+)\s+(.*)$/i);
    if (cm && CONTAINERS[cm[1].toLowerCase()]) {
      const variant = cm[1].toLowerCase();
      let label = cm[2].trim();
      // 先頭の @名前 は小さな挿絵アイコン（public/data/icons/<名前>.png）。たとえ話の見出しに添える。
      let icon: string | undefined;
      const ic = label.match(/^@([a-z0-9-]+)\s+(.*)$/);
      if (ic) {
        icon = ic[1];
        label = ic[2].trim();
      }
      const buf: string[] = [];
      let depth = 1;
      i++;
      while (i < lines.length && depth > 0) {
        const l = lines[i];
        if (/^:::\s*[a-z0-9-]+/i.test(l)) {
          depth++;
        } else if (/^:::\s*$/.test(l)) {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        buf.push(l);
        i++;
      }
      nodes.push({ kind: "disclosure", variant, label, icon, children: parse(buf.join("\n")) });
      continue;
    }

    // ブロック・ディレクティブ（JSON設定）
    const m = line.match(/^:::\s*([a-z0-9-]+)\s*$/i);
    if (m) {
      const name = m[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 閉じ ::: を消費
      const raw = buf.join("\n").trim();
      try {
        const config = raw ? JSON.parse(raw) : {};
        nodes.push({ kind: "block", name, config });
      } catch {
        nodes.push({ kind: "block-error", name, raw });
      }
      continue;
    }

    // 包括分岐：未知の容器（:::foo タイトル）や対応のない閉じ ::: は、必ず 1 行消費してエラー表示に落とす。
    // （段落ループは ::: 行を消費しないため、ここで拾わないと i が進まず描画が固まる）
    if (/^:::/.test(line)) {
      const nm = line.replace(/^:::\s*/, "").trim();
      nodes.push({ kind: "block-error", name: nm || "（閉じ記号 ::: の対応なし）", raw: line });
      i++;
      continue;
    }

    // ブロック数式 $$ ... $$
    const tl = line.trim();
    if (tl.startsWith("$$")) {
      if (tl.length > 4 && tl.endsWith("$$")) {
        // 単一行：$$ ... $$
        nodes.push({ kind: "math", tex: tl.slice(2, -2).trim() });
        i++;
        continue;
      }
      // 複数行：$$ で始まり $$ で閉じる
      const buf: string[] = [];
      const firstRest = tl.slice(2).trim();
      if (firstRest) buf.push(firstRest);
      i++;
      while (i < lines.length && !lines[i].trim().endsWith("$$")) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        const last = lines[i].trim();
        const lastContent = last.slice(0, last.length - 2).trim();
        if (lastContent) buf.push(lastContent);
        i++;
      }
      nodes.push({ kind: "math", tex: buf.join("\n").trim() });
      continue;
    }

    // 画像：![代替テキスト](パス "キャプション"){right|small}。パスは book フォルダ相対（data/books/… 起点）。
    // 末尾の {right} は PC で右に回り込む小図、{small} は中央寄せの小図。無印は全幅の図。
    const im = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(?:\{(right|small)\})?\s*$/);
    if (im) {
      nodes.push({ kind: "image", src: im[2], alt: im[1], caption: im[3] ?? "", size: im[4] as "right" | "small" | undefined });
      i++;
      continue;
    }

    // 見出し
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      nodes.push({ kind: "h", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }

    // 箇条書き
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, "").trim());
        i++;
      }
      nodes.push({ kind: "ul", items });
      continue;
    }

    // 空行
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 段落（次の空行 or 特殊行まで）
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^:::/.test(lines[i]) &&
      !/^\$\$/.test(lines[i].trim()) &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^!\[/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    nodes.push({ kind: "p", text: buf.join(" ") });
  }

  return nodes;
}

// インライン処理：**強調**、$数式$、[[記号キー]] / [[記号キー|表示]]、[[link:節ID|表示]]。
function inline(text: string): ReactNode {
  const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return parts.map((p, idx) => {
    if (/^\$[^$]+\$$/.test(p)) return <InlineMath key={idx} tex={p.slice(1, -1)} />;
    const term = p.match(/^\[\[([^\]]+)\]\]$/);
    if (term) {
      // 節間クロスリンク：[[link:節ID|表示名]]。本文の「第◯章で見た…」を実際に飛べる参照にする。
      const ln = term[1].match(/^link:\s*([a-z0-9-]+)\s*\|\s*(.+)$/i);
      if (ln) {
        return (
          <Link
            key={idx}
            to={`/read/${ln[1]}`}
            className="text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
          >
            {ln[2].trim()}
          </Link>
        );
      }
      const [k, label] = term[1].split("|");
      return <TermPop key={idx} tokenKey={k.trim()} label={label?.trim()} />;
    }
    const b = p.match(/^\*\*([^*]+)\*\*$/);
    // 太字の中の $数式$ や [[記号]] も活かすため再帰的に処理。
    if (b) return <strong key={idx} className="font-semibold text-ink">{inline(b[1])}</strong>;
    return <Fragment key={idx}>{p}</Fragment>;
  });
}

// 深掘り（折りたたみ）。既定は閉。やさしい本文を濁さず、専門は要るとき開く。
// ネイティブ <details> なので状態管理なし・キーボード操作可。中に :::block も置ける。
function Disclosure({
  variant,
  label,
  icon,
  children,
}: {
  variant: string;
  label: string;
  icon?: string;
  children: ReactNode;
}) {
  const meta = CONTAINERS[variant] ?? CONTAINERS.deep;
  // 常に開いた囲み（たとえ話）：読み飛ばしやすいよう左に太い罫、チップは同じ作法。
  // @アイコン付きなら、左に小さな挿絵（紺の線画・透過PNG）を置いて「何の話か」を一目で示す。
  if (meta.open) {
    const head = (
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">{meta.chip}</span>
        <span className="font-serif text-ink/90">{label}</span>
      </div>
    );
    return (
      <aside className="aa-analogy my-5 clear-both rounded-lg border border-line border-l-4 border-l-accent/50 bg-soft/40 px-4 pb-1 pt-3">
        {icon ? (
          <img
            src={asset(`data/icons/${icon}.png`)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="float-left mb-1 mr-3 mt-0.5 h-16 w-16 select-none sm:h-20 sm:w-20"
          />
        ) : null}
        {head}
        {children}
        <div className="clear-both" />
      </aside>
    );
  }
  return (
    <details className="aa-deep my-5 clear-both overflow-hidden rounded-lg border border-line bg-soft/60">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm hover:bg-soft">
        <svg className="aa-deep-tri shrink-0 text-accent" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path d="M3 1.5l5 4-5 4z" fill="currentColor" />
        </svg>
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">{meta.chip}</span>
        <span className="text-ink/90">{label}</span>
      </summary>
      <div className="border-l-2 border-accent/40 px-4 pb-1 pt-1">{children}</div>
    </details>
  );
}

// 見出しの表示文字から記法を落とす（目次・節内ナビ用）。[[key|語]]→語、[[link:id|語]]→語、**強調**→素の文字。
function plainText(s: string): string {
  return s
    .replace(/\[\[(?:link:)?[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]|]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

// 節内ナビ用：本文の最上位 `## ` 見出しの一覧。id は描画側（renderNodes の top=true）と同じ付番。
export function extractHeadings(src: string): { id: string; text: string }[] {
  return parse(src)
    .filter((n): n is Extract<Node, { kind: "h" }> => n.kind === "h" && n.level === 2)
    .map((n, i) => ({ id: `h2-${i + 1}`, text: plainText(n.text) }));
}

function renderNodes(nodes: Node[], top = false): ReactNode {
  let h2 = 0;
  return (
    <>
      {nodes.map((n, idx) => {
        switch (n.kind) {
          case "h": {
            const cls =
              n.level === 1
                ? "aa-h1 mt-2 mb-4 text-[26px] leading-snug text-ink sm:text-3xl"
                : n.level === 2
                ? "aa-h2 mt-12 mb-3 clear-both scroll-mt-20 text-[22px] leading-snug text-ink sm:text-2xl"
                : "mt-7 mb-2 clear-both text-lg leading-snug text-ink sm:text-xl";
            if (n.level === 1) return <h1 key={idx} className={cls}>{inline(n.text)}</h1>;
            if (n.level === 2) {
              // 最上位の h2 だけ id を振る（囲みの中の見出しは節内ナビに出さない）
              const id = top ? `h2-${++h2}` : undefined;
              return <h2 key={idx} id={id} className={cls}>{inline(n.text)}</h2>;
            }
            return <h3 key={idx} className={cls}>{inline(n.text)}</h3>;
          }
          case "p": {
            // 節の冒頭（h1 直後）の段落はリード：少し大きく、やや薄い墨で導入らしく
            const lead = top && idx > 0 && nodes[idx - 1].kind === "h" && (nodes[idx - 1] as { level: number }).level === 1;
            return (
              <p key={idx} className={lead ? "aa-lead my-4 text-[17px] leading-8 text-ink/85 sm:text-lg sm:leading-9" : "my-3 leading-8 text-ink/90"}>
                {inline(n.text)}
              </p>
            );
          }
          case "ul":
            return (
              <ul key={idx} className="my-3 list-disc space-y-1 pl-6 text-ink/90">
                {n.items.map((it, j) => (
                  <li key={j} className="leading-7">{inline(it)}</li>
                ))}
              </ul>
            );
          case "math":
            return <BlockMath key={idx} tex={n.tex} />;
          case "image":
            return <Figure key={idx} n={n} />;
          case "block": {
            const def = getBlock(n.name);
            if (!def) return <UnknownBlock key={idx} name={n.name} />;
            const C = def.component;
            return (
              <BlockFrame
                key={idx}
                name={n.name}
                render={() => (
                  <BlockBoundary name={n.name}>
                    <C config={n.config} />
                  </BlockBoundary>
                )}
              />
            );
          }
          case "block-error":
            return (
              <div
                key={idx}
                className="my-6 rounded-lg border border-dashed border-line bg-soft p-4 text-sm text-mut"
              >
                ブロック <code className="text-ink">{n.name}</code> の設定(JSON)が読めませんでした。
              </div>
            );
          case "disclosure":
            return (
              <Disclosure key={idx} variant={n.variant} label={n.label} icon={n.icon}>
                {renderNodes(n.children)}
              </Disclosure>
            );
        }
      })}
    </>
  );
}

// 小図：{right} は PC で本文の右に回り込み（幅 270px）、スマホでは中央寄せの小図。{small} は常に中央寄せ。
// タップ／クリックでライトボックスに拡大（本はピンチ拡大を止めているため、細部はここで見る）。
function Figure({ n }: { n: Extract<Node, { kind: "image" }> }) {
  const openLightbox = useLightbox();
  const figCls =
    n.size === "right"
      ? "my-4 mx-auto w-full max-w-[340px] md:float-right md:clear-right md:ml-6 md:mb-2 md:mr-0 md:w-[270px] overflow-hidden rounded-lg border border-line bg-white shadow-card"
      : n.size === "small"
      ? "my-5 mx-auto w-full max-w-[360px] overflow-hidden rounded-lg border border-line bg-white shadow-card"
      : "my-6 clear-both overflow-hidden rounded-lg border border-line bg-white shadow-card";
  const capCls = n.size ? "px-3 py-2 text-xs leading-relaxed text-mut" : "px-4 py-2.5 text-sm leading-relaxed text-mut";
  const src = asset(n.src);
  return (
    <figure className={figCls}>
      <button
        type="button"
        onClick={() => openLightbox({ src, alt: n.alt, caption: n.caption ? inline(n.caption) : undefined })}
        aria-label={`${n.alt || "図"}を拡大`}
        className="block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <img src={src} alt={n.alt} loading="lazy" className="block w-full" />
      </button>
      {n.caption ? <figcaption className={capCls}>{inline(n.caption)}</figcaption> : null}
    </figure>
  );
}

export function Markdown({ src }: { src: string }) {
  return renderNodes(parse(src), true);
}
