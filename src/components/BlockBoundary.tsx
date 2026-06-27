import { Component, type ReactNode } from "react";

// ブロック単位のエラー境界。
// 1つのブロックが描画中に例外を投げても、ページ全体を巻き込まず
// そのブロックだけ仮表示にする（試作中の部品で本編が落ちないための保険）。
export class BlockBoundary extends Component<
  { name: string; children: ReactNode },
  { message?: string }
> {
  state: { message?: string } = {};

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="my-6 rounded-lg border border-dashed border-line bg-soft p-4 text-sm text-mut">
          <span className="font-ui">ブロックの描画でエラー：</span>
          <code className="font-ui text-ink">{this.props.name}</code>
          <span className="ml-1">（このブロックだけ仮表示にしています）</span>
          <div className="mt-1 text-xs text-mut/80">{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
