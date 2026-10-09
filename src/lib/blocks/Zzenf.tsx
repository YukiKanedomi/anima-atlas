import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";
import { familyCurves, foldND, TWO_PI } from "../bladedDisk";

// 翼振動章：ZZENF（SAFE）線図。
// 横軸 節直径 n（0..N/2）、縦軸 周波数（翼単体 f_b = 1 で規格化。config.fb [Hz] で換算表示）。
// ・族の曲線：bladedDisk.ts の 2×2 セクタモデル familyCurves（円盤支配族 low / 翼支配族 high）。
// ・励起：回転数 Ω̃ = Ω/f_b（回転の周波数を f_b で割った無次元）で、励起次数 k の点は
//       (n, f) = (fold(k, N), k·Ω̃)。k=1,2,… を結ぶとジグザグ励起線。
// ・共振の二重条件：同じ n の族の点と励起点の周波数が許容差内（tol）、または
//       運転範囲 Ω̃(1±p) の中で f_fam/k が通るとき。
// ・比較：Campbell 線図は n を見ないので、周波数だけ一致する (k, n, 族) の組を全部数える。
//       ZZENF はそのうち n = fold(k,N) のものだけ残す。両者の数を並べる。
// ※ 族の曲線はモデルの式どおりだが、実機の値ではない「模式」。

export type ZzenfConfig = {
  title?: string;
  caption?: string;
  link?: string;
  fb?: number; // 翼単体の固有振動数 [Hz]（表示換算用。既定 3000）
  nDefault?: number; // 翼の枚数（既定 36）
  nsDefault?: number; // ノズル（静翼）枚数（既定 23）
  rpmDefault?: number; // 運転回転数 [rpm]（既定 15000）
  rpmMax?: number; // スライダー上限（既定 40000）
  kMaxDefault?: number; // 描く励起次数の上限（既定 72）
  kcDefault?: number; // 隣接結合の倍率（kb に対する倍率、既定 2.5）
  partialDefault?: boolean; // 部分噴射（全 k を立てる）か（既定 true）
  rangeDefault?: number; // 運転範囲 ±%（既定 0）
  tol?: number; // 周波数一致の許容差（比、既定 0.03）
  showCampbell?: boolean; // 下にミニ Campbell を添える（既定 true）
};

const HEAVY = "#9b2d3a";
const W = 680;
const H = 400;
const PAD = { l: 58, r: 54, t: 26, b: 44 };
const YMAX_MIN = 2.2;
const HC = 250;
const PADC = { l: 58, r: 18, t: 20, b: 40 };

export default function Zzenf({ config }: { config: ZzenfConfig }) {
  const instId = useInstanceId("zzenf");
  const fb = config.fb ?? 3000;
  const rpmMax = config.rpmMax ?? 40000;
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    N: config.nDefault ?? 36,
    Ns: config.nsDefault ?? 23,
    rpm: config.rpmDefault ?? 15000,
    kMax: config.kMaxDefault ?? 72,
    kc: config.kcDefault ?? 2.5,
    partial: config.partialDefault === false ? 0 : 1,
    range: config.rangeDefault ?? 0,
  });
  const N = Math.round(vals.N);
  const Ns = Math.round(vals.Ns);
  const rpm = vals.rpm;
  const kMax = Math.round(vals.kMax);
  const kcMul = vals.kc;
  const partial = vals.partial >= 0.5;
  const p = vals.range / 100;
  const tol = config.tol ?? 0.03;
  const half = Math.floor(N / 2);
  const om = rpm / 60 / fb; // Ω̃ = 回転の周波数 ÷ f_b
  const showCampbell = config.showCampbell !== false;

  const kb = TWO_PI * TWO_PI;
  const fam = useMemo(() => familyCurves({ N, kc: kcMul * kb }), [N, kcMul, kb]);

  // 励起点と共振の判定
  const { exc, hits, campbellCount, zzenfCount } = useMemo(() => {
    const admitted = (k: number) => (partial ? true : k % Ns === 0);
    const lo = om * (1 - p);
    const hi = om * (1 + p);
    const match = (f: number, k: number) => {
      // 周波数 f の族が、次数 k の励起と運転範囲内で出会うか
      const fe = k * om;
      if (p > 0) return f / k >= lo * (1 - tol) && f / k <= hi * (1 + tol);
      return Math.abs(fe - f) <= tol * f;
    };
    const exc: { k: number; n: number; f: number; adm: boolean }[] = [];
    const hits: { k: number; n: number; f: number; family: "low" | "high" }[] = [];
    let cc = 0;
    let zc = 0;
    for (let k = 1; k <= kMax; k++) {
      const n = foldND(k, N);
      const f = k * om;
      const adm = admitted(k);
      exc.push({ k, n, f, adm });
      if (!adm) continue;
      for (const c of fam) {
        for (const family of ["low", "high"] as const) {
          const ff = c[family];
          if (match(ff, k)) {
            cc++;
            if (c.n === n) {
              zc++;
              hits.push({ k, n, f: ff, family });
            }
          }
        }
      }
    }
    return { exc, hits, campbellCount: cc, zzenfCount: zc };
  }, [N, Ns, om, kMax, partial, p, tol, fam]);

  // 座標
  const sx = (n: number) => PAD.l + (n / Math.max(1, half)) * (W - PAD.l - PAD.r);
  // 縦軸の上限：族の最大値（kc を上げると翼支配の族が 2.2 を超える）に追従させ、黙ってクランプしない
  const YMAX = Math.max(YMAX_MIN, 1.12 * Math.max(...fam.map((c) => c.high)));
  const sy = (f: number) => H - PAD.b - (Math.min(f, YMAX) / YMAX) * (H - PAD.t - PAD.b);
  const lowD = fam.map((c, i) => `${i === 0 ? "M" : "L"}${sx(c.n).toFixed(1)},${sy(c.low).toFixed(1)}`).join(" ");
  const highD = fam.map((c, i) => `${i === 0 ? "M" : "L"}${sx(c.n).toFixed(1)},${sy(c.high).toFixed(1)}`).join(" ");
  // ジグザグ（YMAX を超えたら打ち切り）
  const zig = useMemo(() => {
    const pts: string[] = [];
    let first = true;
    for (const e of exc) {
      if (e.f > YMAX) break;
      pts.push(`${first ? "M" : "L"}${sx(e.n).toFixed(1)},${sy(e.f).toFixed(1)}`);
      first = false;
    }
    return pts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exc, half, YMAX]);

  const yTicks = Array.from({ length: Math.floor(YMAX / 0.5) + 1 }, (_, i) => i * 0.5);
  const xEvery = half <= 12 ? 1 : half <= 24 ? 2 : half <= 36 ? 4 : 6;
  const hzLabel = (f: number) => `${Math.round(f * fb).toLocaleString()}`;

  // ミニ Campbell
  const OMAX = rpmMax / 60 / fb;
  const cx = (o: number) => PADC.l + (o / OMAX) * (W - PADC.l - PADC.r);
  const cy = (f: number) => HC - PADC.b - (Math.min(f, YMAX) / YMAX) * (HC - PADC.t - PADC.b);
  const lowMin = Math.min(...fam.map((c) => c.low));
  const lowMax = Math.max(...fam.map((c) => c.low));
  const highMin = Math.min(...fam.map((c) => c.high));
  const highMax = Math.max(...fam.map((c) => c.high));

  const admittedKs = exc.filter((e) => e.adm).map((e) => e.k);
  const hitList = hits.slice(0, 6);

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-sm transition-colors " +
        (active ? "border-accent bg-accent text-white" : "border-line text-mut hover:border-accent hover:text-accent")
      }
    >
      {children}
    </button>
  );

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="ZZENF線図：節直径 vs 周波数">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="var(--soft)" opacity={0.35} />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--line)" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--line)" />
        {/* 目盛り */}
        {yTicks.map((f) => (
          <g key={f}>
            <line x1={PAD.l} y1={sy(f)} x2={W - PAD.r} y2={sy(f)} stroke="var(--line)" opacity={0.7} />
            <text x={PAD.l - 6} y={sy(f) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
              {f.toFixed(1)}
            </text>
            <text x={W - PAD.r + 6} y={sy(f) + 4} fontSize="10" fill="var(--mut)" textAnchor="start">
              {hzLabel(f)}
            </text>
          </g>
        ))}
        {fam
          .filter((c) => c.n % xEvery === 0 || c.n === half)
          .map((c) => (
            <text key={c.n} x={sx(c.n)} y={H - PAD.b + 14} fontSize="10" fill="var(--mut)" textAnchor="middle">
              {c.n}
            </text>
          ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 10} fontSize="12" fill="var(--mut)" textAnchor="middle">
          節直径 n（0 … N/2）
        </text>
        <text x={14} y={(PAD.t + H - PAD.b) / 2} fontSize="12" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 14 ${(PAD.t + H - PAD.b) / 2})`}>
          周波数（÷ f_b）
        </text>
        <text x={W - 8} y={(PAD.t + H - PAD.b) / 2} fontSize="10" fill="var(--mut)" textAnchor="middle" transform={`rotate(90 ${W - 8} ${(PAD.t + H - PAD.b) / 2})`}>
          Hz（f_b = {fb.toLocaleString()} Hz のとき）
        </text>

        {/* 運転範囲の励起（縦線分） */}
        {p > 0
          ? exc
              .filter((e) => e.f * (1 - p) <= YMAX)
              .map((e) => (
                <line
                  key={`r${e.k}`}
                  x1={sx(e.n)}
                  y1={sy(Math.min(YMAX, e.f * (1 + p)))}
                  x2={sx(e.n)}
                  y2={sy(e.f * (1 - p))}
                  stroke={HEAVY}
                  strokeWidth={e.adm ? 3 : 1}
                  opacity={e.adm ? 0.28 : 0.1}
                  strokeLinecap="round"
                />
              ))
          : null}

        {/* ジグザグ励起線 */}
        <path d={zig} fill="none" stroke={HEAVY} strokeWidth={1.2} opacity={0.55} strokeLinejoin="round" />
        {exc
          .filter((e) => e.f <= YMAX)
          .map((e) => (
            <g key={e.k}>
              <circle cx={sx(e.n)} cy={sy(e.f)} r={e.adm ? 3.2 : 1.8} fill={HEAVY} opacity={e.adm ? 0.9 : 0.3} />
              {e.adm && (!partial || e.k % Ns === 0) && e.k <= 3 * Ns ? (
                <text x={sx(e.n) + 5} y={sy(e.f) - 4} fontSize="9" fill={HEAVY} textAnchor="start">
                  {e.k}×
                </text>
              ) : null}
            </g>
          ))}

        {/* 族の曲線 */}
        <path d={lowD} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
        <path d={highD} fill="none" stroke="var(--accent-d)" strokeWidth={2.2} strokeDasharray="6 4" />
        {fam.map((c) => (
          <g key={c.n}>
            <circle cx={sx(c.n)} cy={sy(c.low)} r={3} fill="var(--accent)" />
            <circle cx={sx(c.n)} cy={sy(c.high)} r={3} fill="#fff" stroke="var(--accent-d)" strokeWidth={1.6} />
          </g>
        ))}
        <text x={sx(half) - 4} y={sy(fam[fam.length - 1]?.low ?? 1) + 16} fontSize="11" fill="var(--accent)" textAnchor="end">
          円盤→翼の族
        </text>
        <text x={sx(half) - 4} y={sy(fam[fam.length - 1]?.high ?? 1.8) - 8} fontSize="11" fill="var(--accent-d)" textAnchor="end">
          翼→円盤の族
        </text>

        {/* 本物の共振 */}
        {hits.map((h, i) => (
          <circle key={i} cx={sx(h.n)} cy={sy(h.f)} r={8} fill="none" stroke={HEAVY} strokeWidth={2.4} />
        ))}
        <text x={PAD.l + 8} y={PAD.t + 14} fontSize="11" fill={HEAVY} textAnchor="start">
          ジグザグ＝励起 {Math.round(rpm).toLocaleString()} rpm{p > 0 ? ` ±${Math.round(p * 100)}%` : ""}
        </text>
      </svg>
      </div>

      {/* 数で見る二重条件 */}
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded border border-line bg-soft/60 px-3 py-2">
          <div className="text-xs text-mut">周波数だけで数えた交点（Campbell の読み方）</div>
          <div className="font-ui text-xl tabular-nums text-ink">{campbellCount}</div>
        </div>
        <div className="rounded border px-3 py-2" style={{ borderColor: HEAVY, background: "rgba(155,45,58,.06)" }}>
          <div className="text-xs text-mut">節直径も一致する本物の共振（ZZENF）</div>
          <div className="font-ui text-xl tabular-nums" style={{ color: HEAVY }}>
            {zzenfCount}
          </div>
        </div>
      </div>
      <div className="mt-2 min-h-[4.5rem] text-sm text-mut">
        {hitList.length === 0 ? (
          <span>いまの回転数{p > 0 ? "範囲" : ""}では、節直径まで一致する励起はありません。</span>
        ) : (
          <ul className="space-y-0.5">
            {hitList.map((h, i) => (
              <li key={i} className="font-ui tabular-nums">
                <span className="text-ink">{h.k}×</span>（{h.k} 次）→ 節直径 <span className="text-ink">{h.n}</span>、
                {h.family === "low" ? "円盤→翼の族" : "翼→円盤の族"} {h.f.toFixed(2)} f_b ≈ {hzLabel(h.f)} Hz
              </li>
            ))}
            {hits.length > hitList.length ? <li>…ほか {hits.length - hitList.length} 件</li> : null}
          </ul>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider
          label="運転回転数 Ω"
          value={rpm}
          min={0}
          max={rpmMax}
          step={50}
          format={(v) => `${Math.round(v).toLocaleString()} rpm`}
          onChange={(v) => setParam("rpm", v)}
        />
        <Slider label="運転範囲 ±%（0 で一点）" value={vals.range} min={0} max={20} step={1} onChange={(v) => setParam("range", v)} />
        <Slider label="翼の枚数 N" value={N} min={12} max={72} step={1} onChange={(v) => setParam("N", v)} />
        <Slider label="ノズル（静翼）枚数 Ns" value={Ns} min={5} max={60} step={1} onChange={(v) => setParam("Ns", v)} />
        <Slider label="描く励起次数の上限 kmax" value={kMax} min={10} max={150} step={1} onChange={(v) => setParam("kMax", v)} />
        <Slider label="円盤の硬さ（隣接結合 kc ÷ kb）" value={kcMul} min={0.3} max={6} step={0.1} onChange={(v) => setParam("kc", v)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-mut">噴射：</span>
        <Pill active={partial} onClick={() => setParam("partial", 1)}>
          部分噴射（すべての次数が立つ）
        </Pill>
        <Pill active={!partial} onClick={() => setParam("partial", 0)}>
          全周噴射（Ns の倍数だけ）
        </Pill>
        <span className="min-w-[8rem] text-xs text-mut">
          有効な次数：{partial ? `1〜${kMax}` : admittedKs.length ? admittedKs.slice(0, 4).join(", ") + (admittedKs.length > 4 ? ", …" : "") : "なし"}
        </span>
      </div>

      {showCampbell ? (
        <>
          <svg viewBox={`0 0 ${W} ${HC}`} className="mt-4 w-full" role="img" aria-label="同じ条件のCampbell線図">
            <rect x={PADC.l} y={PADC.t} width={W - PADC.l - PADC.r} height={HC - PADC.t - PADC.b} fill="var(--soft)" opacity={0.35} />
            <line x1={PADC.l} y1={HC - PADC.b} x2={W - PADC.r} y2={HC - PADC.b} stroke="var(--line)" />
            <line x1={PADC.l} y1={PADC.t} x2={PADC.l} y2={HC - PADC.b} stroke="var(--line)" />
            {/* 族の帯 */}
            <rect x={PADC.l} y={cy(lowMax)} width={W - PADC.l - PADC.r} height={Math.max(2, cy(lowMin) - cy(lowMax))} fill="var(--accent)" opacity={0.16} />
            <rect x={PADC.l} y={cy(highMax)} width={W - PADC.l - PADC.r} height={Math.max(2, cy(highMin) - cy(highMax))} fill="var(--accent-d)" opacity={0.14} />
            {/* 励起次数線の扇 */}
            {exc.map((e) => {
              const oEnd = Math.min(OMAX, YMAX / e.k);
              return (
                <line
                  key={e.k}
                  x1={cx(0)}
                  y1={cy(0)}
                  x2={cx(oEnd)}
                  y2={cy(e.k * oEnd)}
                  stroke={HEAVY}
                  strokeWidth={e.adm ? 1 : 0.6}
                  opacity={e.adm ? 0.45 : 0.12}
                />
              );
            })}
            {/* 運転点・範囲 */}
            {p > 0 ? <rect x={cx(om * (1 - p))} y={PADC.t} width={Math.max(1, cx(om * (1 + p)) - cx(om * (1 - p)))} height={HC - PADC.t - PADC.b} fill="var(--accent)" opacity={0.1} /> : null}
            <line x1={cx(om)} y1={PADC.t} x2={cx(om)} y2={HC - PADC.b} stroke="var(--accent-d)" strokeWidth={1.4} opacity={0.6} />
            {yTicks.map((f) => (
              <text key={f} x={PADC.l - 6} y={cy(f) + 4} fontSize="10" fill="var(--mut)" textAnchor="end">
                {f.toFixed(1)}
              </text>
            ))}
            {[0.25, 0.5, 0.75, 1].map((q) => (
              <text key={q} x={cx(q * OMAX)} y={HC - PADC.b + 14} fontSize="10" fill="var(--mut)" textAnchor="middle">
                {Math.round((q * rpmMax) / 1000)}k
              </text>
            ))}
            <text x={(PADC.l + W - PADC.r) / 2} y={HC - 8} fontSize="12" fill="var(--mut)" textAnchor="middle">
              回転数 [rpm]（同じ条件の Campbell 線図：帯＝族の周波数の範囲、扇＝励起次数線）
            </text>
            <text x={14} y={(PADC.t + HC - PADC.b) / 2} fontSize="12" fill="var(--mut)" textAnchor="middle" transform={`rotate(-90 14 ${(PADC.t + HC - PADC.b) / 2})`}>
              周波数（÷ f_b）
            </text>
          </svg>
          <p className="mt-1 text-xs text-mut">
            Campbell 線図では、帯を横切る扇の線すべてが「交点」に見えます。ZZENF 線図はそのうち節直径が合うものだけを残します。
          </p>
        </>
      ) : null}

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
