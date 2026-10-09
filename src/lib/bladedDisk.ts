// 翼振動章の共有物理モデル（複数ブロックで同じ式を使うための正典）。
// すべて無次元：翼単体の静止固有振動数 f_b = 1 で規格化する。
//
// 1) 遠心剛性化（ストレス・スティフニング）
//    f(Ω)² = f0² + κ·Ω²   （Southwell の近似。κ は 1F で ≈1〜1.7 程度）
//
// 2) 励起次数(EO) → 節直径(ND) の折り返し（N 枚の翼による空間サンプリング）
//    ND = min(k mod N, N − k mod N)   … 0 ≤ ND ≤ N/2
//    （ZZENF 線図のジグザグ線そのもの。FFT 章のエイリアシングと同じ構造）
//
// 3) 翼付き円盤の最小モデル：1セクタ＝「円盤片（md, 地盤ばね kd, 隣接結合 kc）」＋「翼（mb, ばね kb）」。
//    周期対称性から節直径 n の成分ごとに 2×2 の固有値問題に分かれる。
//      円盤片の実効剛性  kd_n = kd + 2·kc·(1 − cos(2πn/N))
//      K = [[kb + kd_n, −kb], [−kb, kb]],  M = diag(md, mb)
//      det(K − λM) = 0 → md·mb·λ² − [(kb+kd_n)·mb + kb·md]·λ + kd_n·kb = 0
//    低い根＝円盤支配の族（n とともに上がる）、高い根＝翼支配の族（翼単体の値に漸近）。
//    2本は交差せず避け合う（veering）。形は式どおりの「模式」。

export type SectorParams = {
  N: number; // 翼の枚数
  mb?: number; // 翼の質量（既定 1）
  kb?: number; // 翼のばね（既定 (2π)²·mb → f_b = 1）
  md?: number; // 円盤片の質量（既定 3）
  kd?: number; // 円盤片の地盤ばね（既定 0.15·kb：n=0 のアンブレラが低い）
  kc?: number; // 隣接セクタ結合（既定 2.5·kb：n で急に硬くなる）
};

export const TWO_PI = Math.PI * 2;

export function foldND(k: number, N: number): number {
  const m = ((k % N) + N) % N;
  return Math.min(m, N - m);
}

export function stiffenedFreq(f0: number, kappa: number, omega: number): number {
  return Math.sqrt(f0 * f0 + kappa * omega * omega);
}

/** 節直径 n の2つの固有振動数（f_b=1 規格化、昇順）。 */
export function sectorFamilies(n: number, p: SectorParams): [number, number] {
  const mb = p.mb ?? 1;
  const kb = p.kb ?? TWO_PI * TWO_PI * mb;
  const md = p.md ?? 3;
  const kd = p.kd ?? 0.15 * kb;
  const kc = p.kc ?? 2.5 * kb;
  const kdn = kd + 2 * kc * (1 - Math.cos((TWO_PI * n) / p.N));
  const a = md * mb;
  const b = -((kb + kdn) * mb + kb * md);
  const c = kdn * kb;
  const disc = Math.max(0, b * b - 4 * a * c);
  const s = Math.sqrt(disc);
  const l1 = (-b - s) / (2 * a);
  const l2 = (-b + s) / (2 * a);
  return [Math.sqrt(Math.max(0, l1)) / TWO_PI, Math.sqrt(Math.max(0, l2)) / TWO_PI];
}

/** 0..floor(N/2) の全節直径について族の曲線を返す。 */
export function familyCurves(p: SectorParams): { n: number; low: number; high: number }[] {
  const out: { n: number; low: number; high: number }[] = [];
  const half = Math.floor(p.N / 2);
  for (let n = 0; n <= half; n++) {
    const [low, high] = sectorFamilies(n, p);
    out.push({ n, low, high });
  }
  return out;
}
