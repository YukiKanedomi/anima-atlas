import { createContext, useContext } from "react";

// 記号の正典（symbols.json）を本文へ配るためのコンテキスト。
// 本文では [[key]] / [[key|表示テキスト]] で参照し、ホバー/タップで定義をポップ表示する。
// 「ものによって記号が違う」問題を、正典＋キー参照で吸収する裏方。

export type Sym = {
  key: string;
  glyph: string;
  read?: string;
  name: string;
  unit?: string;
};

export const SymbolsContext = createContext<Record<string, Sym>>({});

export function useSymbols(): Record<string, Sym> {
  return useContext(SymbolsContext);
}
