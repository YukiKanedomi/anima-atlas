// 反復 Cooley–Tukey FFT（in-place、N=2のべき）。
// Spectrum で使っていた実装を、FFT章のブロック群（leakage/resolution）と共有するため切り出し。
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const c = Math.cos(ang * k);
        const s = Math.sin(ang * k);
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + half] * c - im[i + k + half] * s;
        const bi = re[i + k + half] * s + im[i + k + half] * c;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + half] = ar - br;
        im[i + k + half] = ai - bi;
      }
    }
  }
}

// 実信号→片側振幅スペクトル。hann=true で Hann 窓（利得0.5を補正）。
export function ampSpectrum(sig: ArrayLike<number>, hann: boolean): number[] {
  const N = sig.length;
  const re = Float64Array.from(sig as number[]);
  const im = new Float64Array(N);
  let gain = 1;
  if (hann) {
    gain = 0.5;
    for (let i = 0; i < N; i++) re[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  fft(re, im);
  const out: number[] = [];
  for (let k = 0; k <= N / 2; k++) out.push((2 * Math.hypot(re[k], im[k])) / (N * gain));
  return out;
}
