import { Fragment, type ReactNode } from "react";
import { getBlock, UnknownBlock } from "./blocks/registry";
import { BlockMath, InlineMath } from "./Math";
import { BlockBoundary } from "../components/BlockBoundary";

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
  | { kind: "math"; tex: string };

function parse(src: string): Node[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const nodes: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ブロック・ディレクティブ
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
      !/^\s*-\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    nodes.push({ kind: "p", text: buf.join(" ") });
  }

  return nodes;
}

// インライン処理：**強調** と $数式$。
function inline(text: string): ReactNode {
  const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*)/g);
  return parts.map((p, idx) => {
    if (/^\$[^$]+\$$/.test(p)) return <InlineMath key={idx} tex={p.slice(1, -1)} />;
    const b = p.match(/^\*\*([^*]+)\*\*$/);
    if (b) return <strong key={idx} className="font-semibold text-ink">{b[1]}</strong>;
    return <Fragment key={idx}>{p}</Fragment>;
  });
}

export function Markdown({ src }: { src: string }) {
  const nodes = parse(src);
  return (
    <>
      {nodes.map((n, idx) => {
        switch (n.kind) {
          case "h": {
            const cls =
              n.level === 1
                ? "mt-2 mb-3 text-3xl text-ink"
                : n.level === 2
                ? "mt-8 mb-2 text-2xl text-ink"
                : "mt-6 mb-2 text-xl text-ink";
            if (n.level === 1) return <h1 key={idx} className={cls}>{inline(n.text)}</h1>;
            if (n.level === 2) return <h2 key={idx} className={cls}>{inline(n.text)}</h2>;
            return <h3 key={idx} className={cls}>{inline(n.text)}</h3>;
          }
          case "p":
            return (
              <p key={idx} className="my-3 leading-8 text-ink/90">
                {inline(n.text)}
              </p>
            );
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
          case "block": {
            const def = getBlock(n.name);
            if (!def) return <UnknownBlock key={idx} name={n.name} />;
            const C = def.component;
            return (
              <BlockBoundary key={idx} name={n.name}>
                <C config={n.config} />
              </BlockBoundary>
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
        }
      })}
    </>
  );
}
