import katex from "katex";
import { createContext, useContext } from "react";

// 「数式をたたむ」モード。Reader が localStorage の設定を流し、BlockMath が折りたたみで描く。
// 式につまずく読者が、まず言葉だけで一周できるようにするための手すり。
export const MathFoldContext = createContext(false);

// KaTeX で数式を描画する小さなラッパー。
// 本文では $...$（インライン）/ $$...$$（ブロック）で書ける。
// 数式は「嘘をつかない」の核なので、壊れた式は赤字で可視化（黙って消さない）。

function render(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<span style="color:#b00">⚠ 数式エラー: ${tex}</span>`;
  }
}

export function InlineMath({ tex }: { tex: string }) {
  return <span dangerouslySetInnerHTML={{ __html: render(tex, false) }} />;
}

export function BlockMath({ tex }: { tex: string }) {
  const folded = useContext(MathFoldContext);
  const body = (
    <div
      className="my-4 overflow-x-auto text-center"
      dangerouslySetInnerHTML={{ __html: render(tex, true) }}
    />
  );
  if (!folded) return body;
  // たたみモード：式は折りたたみの中。直後の「言葉にすると」だけで読み進められる。
  return (
    <details className="aa-mathfold my-3 rounded-md border border-dashed border-line bg-soft/40 px-3 py-1">
      <summary className="cursor-pointer select-none py-1 text-xs text-mut">数式を見る</summary>
      {body}
    </details>
  );
}
