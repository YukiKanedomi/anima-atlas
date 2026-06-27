// ごく小さな数式コンパイラ。
// 「数式を文字列で宣言 → スライダーの値を入れて計算」を成り立たせるための土台。
// 汎用ブロック（y=f(x)）が、外部ライブラリなしで本物の式を描けるようにする。
//
// 使える書き方：四則演算、() 、^（べき乗→** に変換）、変数名、
// および sqrt/sin/cos/tan/abs/exp/log/pow/min/max と定数 PI/E。
// ※ コンテンツは自分で書く前提（信頼できる入力）。外部ユーザー入力は想定しない。

const MATH_KEYS = [
  "sqrt",
  "sin",
  "cos",
  "tan",
  "abs",
  "exp",
  "log",
  "pow",
  "min",
  "max",
  "PI",
  "E",
] as const;

const MATH_VALUES = [
  Math.sqrt,
  Math.sin,
  Math.cos,
  Math.tan,
  Math.abs,
  Math.exp,
  Math.log,
  Math.pow,
  Math.min,
  Math.max,
  Math.PI,
  Math.E,
];

export type CompiledExpr = (scope: Record<string, number>) => number;

/**
 * 式文字列を、変数スコープを受け取って数値を返す関数にコンパイルする。
 * @param expr 例: "(r*r) / sqrt((1 - r*r)^2 + (2*zeta*r)^2)"
 * @param varNames 式に出てくる変数名（x軸の変数 + スライダーのキー）
 */
export function compileExpr(expr: string, varNames: string[]): CompiledExpr {
  const js = expr.replace(/\^/g, "**");
  // new Function は eval 系だが、入力は信頼できるコンテンツのみ。Math は引数で限定注入。
  // eslint-disable-next-line no-new-function
  const fn = new Function(
    ...varNames,
    ...MATH_KEYS,
    `"use strict"; return (${js});`
  ) as (...args: number[]) => number;

  return (scope) => {
    const args = varNames.map((v) => scope[v]);
    return fn(...args, ...(MATH_VALUES as unknown as number[]));
  };
}
