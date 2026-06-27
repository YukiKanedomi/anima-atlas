import katex from "katex";

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
  return (
    <div
      className="my-4 overflow-x-auto text-center"
      dangerouslySetInnerHTML={{ __html: render(tex, true) }}
    />
  );
}
