import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：2面バランシング（影響係数の行列）。
// 長いロータの不釣り合いは「同相成分（並進的）」と「逆相成分（偶不釣り合い＝モーメント）」を持ち、
// 1面のおもりでは消しきれない。2測定面×2修正面の影響係数行列 A（2×2複素）で V = A·W。
// 手順：V0 → 面1に試し T1 → V1 → A列1=(V1−V0)/T1 → 面2に T2 → V2 → A列2=(V2−V0)/T2
// → 補正 W = −A⁻¹·V0（2×2複素逆行列を手書きで解く）。
// モデル：同相モード αs・逆相モード αa の2モードで A = ½[[αs+αa, αs−αa],[αs−αa, αs+αa]]。
// 非対角＝クロストーク（面1のおもりが面2にも効く）。ψ で両モードの位相が回る。
// ※ 値・幾何は式どおりの模式（線形・1×・剛体2モードを仮定）。

export type TwoPlaneBalancingConfig = {
  title?: string;
  caption?: string;
  link?: string;
  psiDefault?: number; // 応答の位相（遅れ）deg
  mixDefault?: number; // 不釣り合いの混合比 0=純同相 .. 1=純逆相
};

// 内部の真値（学習者には未知の設定）
const U_MAG = 8;    // 不釣り合い相当（g）
const U_ANG = 40;   // 重い点の角度（deg）
const AS_MAG = 0.5; // 同相（並進的）モードの影響の大きさ
const AA_MAG = 0.32; // 逆相（傾き的）モードの影響の大きさ
const AA_OFF = 35;  // 逆相モードの位相オフセット（deg）
const T_TRIAL = 5;  // 試しおもり（g・0°、手順の再現用）

const GREEN = "#1f7a4f";
const HEAVY = "#9b2d3a";
const BLUE = "var(--accent)";

type C = { re: number; im: number };
const pol = (m: number, deg: number): C => ({ re: m * Math.cos((deg * Math.PI) / 180), im: m * Math.sin((deg * Math.PI) / 180) });
const add = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const div = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im || 1e-12;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const neg = (a: C): C => ({ re: -a.re, im: -a.im });
const mag = (a: C) => Math.hypot(a.re, a.im);
const ang = (a: C) => ((Math.atan2(a.im, a.re) * 180) / Math.PI + 360) % 360;

type M2 = [[C, C], [C, C]];
type V2 = [C, C];
const mv = (A: M2, x: V2): V2 => [
  add(mul(A[0][0], x[0]), mul(A[0][1], x[1])),
  add(mul(A[1][0], x[0]), mul(A[1][1], x[1])),
];
// 2×2複素逆行列（手書き）：A⁻¹ = 1/det [[a22, −a12], [−a21, a11]]
const inv2 = (A: M2): M2 => {
  const det = sub(mul(A[0][0], A[1][1]), mul(A[0][1], A[1][0]));
  return [
    [div(A[1][1], det), div(neg(A[0][1]), det)],
    [div(neg(A[1][0]), det), div(A[0][0], det)],
  ];
};

export default function TwoPlaneBalancing({ config }: { config: TwoPlaneBalancingConfig }) {
  const instId = useInstanceId("tpb");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    mix: config.mixDefault ?? 1,          // 0=純同相 .. 1=純逆相
    psi: config.psiDefault ?? 60,         // 応答の位相
    twoPlane: 0,                          // 0=1面補正のみ / 1=2面補正
  });
  const { mix, psi, twoPlane } = vals;

  const m = useMemo(() => {
    // 真の影響係数行列（同相モード＋逆相モードの合成）
    const as = pol(AS_MAG, psi);
    const aa = pol(AA_MAG, psi + AA_OFF);
    const h: C = { re: 0.5, im: 0 };
    const s = mul(h, add(as, aa));
    const d = mul(h, sub(as, aa));
    const A: M2 = [[s, d], [d, s]];

    // 内部の不釣り合い：U = u·[1, 1−2·mix]（0=同相、0.5=面1のみ、1=逆相）
    const u = pol(U_MAG, U_ANG);
    const U: V2 = [u, mul(u, { re: 1 - 2 * mix, im: 0 })];
    const V0 = mv(A, U);

    // 手順の再現：試しおもりを面1・面2に1本ずつ → A の列が埋まる
    const T = pol(T_TRIAL, 0);
    const V1 = mv(A, [add(U[0], T), U[1]]);
    const V2t = mv(A, [U[0], add(U[1], T)]);
    const Arec: M2 = [
      [div(sub(V1[0], V0[0]), T), div(sub(V2t[0], V0[0]), T)],
      [div(sub(V1[1], V0[1]), T), div(sub(V2t[1], V0[1]), T)],
    ];

    // 補正：2面 = −A⁻¹·V0 ／ 1面 = 前節と同じ −V0₁/a₁₁（センサ1だけ合わせる）
    const Wtwo = mv(inv2(Arec), V0).map(neg) as V2;
    const Wone: V2 = [neg(div(V0[0], Arec[0][0])), { re: 0, im: 0 }];
    const W = twoPlane >= 0.5 ? Wtwo : Wone;
    const residual = mv(A, W).map((v, i) => add(V0[i], v)) as V2;
    return { A, U, V0, W, residual };
  }, [mix, psi, twoPlane]);

  const isTwo = twoPlane >= 0.5;
  const res1 = mag(m.residual[0]);
  const res2 = mag(m.residual[1]);
  const v01 = mag(m.V0[0]);
  const v02 = mag(m.V0[1]);

  // バッジ：両面ゼロ（緑系＝採用トーン）／面2に残留／面2は悪化
  const badge =
    res1 < 0.05 && res2 < 0.05
      ? { text: isTwo ? "両面ほぼゼロ" : "この混合比なら1面で足りる", cls: "bg-accent/10 text-accent" }
      : res2 > v02 * 1.02
        ? { text: "面2は悪化", cls: "bg-[#9b2d3a]/10 text-[#9b2d3a]" }
        : { text: "面2に残留", cls: "bg-soft2 text-mut" };

  // ---- 上段：ロータ側面図（軸＋2修正面＋2センサ） ----
  const SW = 640, SH = 224, SY = 112; // 軸の高さ
  const P1X = 200, P2X = 440, DR = 58; // 修正面（円板を正面向きに描く模式）
  const planeFx = (cx: number, deg: number, rr: number) => cx + rr * Math.cos((deg * Math.PI) / 180);
  const planeFy = (deg: number, rr: number) => SY - rr * Math.sin((deg * Math.PI) / 180);

  // 面ごとの「重い点」と補正おもりの角度・大きさ
  const heavyOf = (i: 0 | 1) => ({ a: ang(m.U[i]), r: (mag(m.U[i]) / U_MAG) * DR * 0.78 });
  const weightOf = (i: 0 | 1) => ({ a: ang(m.W[i]), r: Math.min(mag(m.W[i]) / U_MAG, 1.15) * DR * 0.78, on: mag(m.W[i]) > 0.05 });

  const Bearing = ({ x }: { x: number }) => (
    <g>
      <path d={`M${x - 11},${SY + 26} L${x + 11},${SY + 26} L${x},${SY + 7} Z`} fill="none" stroke="var(--mut)" strokeWidth={1.4} />
      <line x1={x - 15} y1={SY + 29} x2={x + 15} y2={SY + 29} stroke="var(--mut)" strokeWidth={1.4} />
    </g>
  );
  const Sensor = ({ x, label }: { x: number; label: string }) => (
    <g>
      <rect x={x - 5} y={SY - 52} width={10} height={13} rx={2} fill="none" stroke={BLUE} strokeWidth={1.4} />
      <line x1={x} y1={SY - 39} x2={x} y2={SY - 6} stroke={BLUE} strokeWidth={1.4} />
      <text x={x} y={SY - 58} fontSize="12" fill={BLUE} textAnchor="middle">{label}</text>
    </g>
  );
  const WeightArrow = ({ cx, i }: { cx: number; i: 0 | 1 }) => {
    const w = weightOf(i);
    if (!w.on) return null;
    const x2 = planeFx(cx, w.a, w.r), y2 = planeFy(w.a, w.r);
    return (
      <g>
        <line x1={cx} y1={SY} x2={x2} y2={y2} stroke={GREEN} strokeWidth={2} />
        <circle cx={x2} cy={y2} r={5} fill={GREEN} />
        <text x={planeFx(cx, w.a, w.r + 15)} y={planeFy(w.a, w.r + 15) + 4} fontSize="11" fill={GREEN} textAnchor="middle">
          {mag(m.W[i]).toFixed(1)}g∠{w.a.toFixed(0)}°
        </text>
      </g>
    );
  };
  const Plane = ({ cx, i, label }: { cx: number; i: 0 | 1; label: string }) => {
    const hv = heavyOf(i);
    return (
      <g>
        <circle cx={cx} cy={SY} r={DR} fill="var(--soft)" opacity={0.4} stroke="var(--line)" />
        {/* 重い点（内部の真値・模式） */}
        {hv.r > 2 ? <circle cx={planeFx(cx, hv.a, hv.r)} cy={planeFy(hv.a, hv.r)} r={5} fill={HEAVY} /> : null}
        <WeightArrow cx={cx} i={i} />
        <text x={cx} y={SY + DR + 16} fontSize="12" fill="var(--mut)" textAnchor="middle">{label}</text>
      </g>
    );
  };

  // ---- 下段：測定面1・2の複素平面（共通スケールで比較できるように） ----
  const PW = 300, PH = 260, PCX = 150, PCY = 134;
  const vmax = Math.max(v01, v02, res1, res2, 1e-6) * 1.3;
  const vsc = 104 / vmax;
  const px = (c: C) => PCX + c.re * vsc;
  const py = (c: C) => PCY - c.im * vsc;

  const Phasor = ({ v0, res, title }: { v0: C; res: C; title: string }) => (
    <svg viewBox={`0 0 ${PW} ${PH}`} className="w-full" role="img" aria-label={title}>
      <text x={PCX} y={14} fontSize="12" fill="var(--mut)" textAnchor="middle">{title}</text>
      <line x1={20} y1={PCY} x2={PW - 20} y2={PCY} stroke="var(--line)" />
      <line x1={PCX} y1={26} x2={PCX} y2={PH - 12} stroke="var(--line)" />
      {/* 元の振動 V0 */}
      <line x1={PCX} y1={PCY} x2={px(v0)} y2={py(v0)} stroke={BLUE} strokeWidth={2} />
      <circle cx={px(v0)} cy={py(v0)} r={4} fill={BLUE} />
      <text x={px(v0) + 6} y={py(v0) - 4} fontSize="11" fill={BLUE}>V₀</text>
      {/* 補正後の残留 */}
      {mag(res) * vsc > 6 ? (
        <g>
          <line x1={PCX} y1={PCY} x2={px(res)} y2={py(res)} stroke={HEAVY} strokeWidth={2} strokeDasharray="5 3" />
          <circle cx={px(res)} cy={py(res)} r={4} fill={HEAVY} />
          <text x={px(res) + 6} y={py(res) + 12} fontSize="11" fill={HEAVY}>残留</text>
        </g>
      ) : (
        <g>
          <circle cx={px(res)} cy={py(res)} r={6} fill="none" stroke={GREEN} strokeWidth={2} />
          <text x={PCX + 8} y={PCY + 16} fontSize="10" fill={GREEN}>補正後≈0</text>
        </g>
      )}
    </svg>
  );

  const ModeBtn = ({ on, label, val }: { on: boolean; label: string; val: number }) => (
    <button
      type="button"
      onClick={() => setParam("twoPlane", val)}
      className={
        "rounded-full border px-3 py-1 text-sm transition-colors " +
        (on ? "border-accent bg-accent text-white" : "border-line text-mut hover:border-accent hover:text-accent")
      }
    >
      {label}
    </button>
  );

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      {/* ロータ側面図 */}
      <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full" role="img" aria-label="ロータ側面図（2つの修正面と2つのセンサ）">
        <line x1={40} y1={SY} x2={SW - 40} y2={SY} stroke="var(--mut)" strokeWidth={3} strokeLinecap="round" />
        <Bearing x={60} />
        <Bearing x={SW - 60} />
        <Sensor x={P1X - DR - 26} label="センサ1" />
        <Sensor x={P2X + DR + 26} label="センサ2" />
        <Plane cx={P1X} i={0} label="修正面1" />
        <Plane cx={P2X} i={1} label="修正面2" />
        {/* 凡例（最下段） */}
        <circle cx={140} cy={SH - 11} r={4.5} fill={HEAVY} />
        <text x={149} y={SH - 7} fontSize="11" fill="var(--mut)">重い点（内部・未知）</text>
        <circle cx={340} cy={SH - 11} r={4.5} fill={GREEN} />
        <text x={349} y={SH - 7} fontSize="11" fill="var(--mut)">補正おもり（計算結果）</text>
      </svg>

      {/* 測定面のフェーザ */}
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Phasor v0={m.V0[0]} res={m.residual[0]} title="測定面1のフェーザ" />
        <Phasor v0={m.V0[1]} res={m.residual[1]} title="測定面2のフェーザ" />
      </div>

      {/* 操作 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ModeBtn on={!isTwo} label="1面補正のみ" val={0} />
        <ModeBtn on={isTwo} label="2面補正（行列で解く）" val={1} />
        <span className={`rounded px-2 py-0.5 text-xs ${badge.cls}`}>{badge.text}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Slider label="不釣り合いの混合比（0=同相 … 1=逆相）" value={mix} min={0} max={1} step={0.01} onChange={(v) => setParam("mix", v)} />
        <Slider label="応答の位相 ψ（遅れ°）" value={psi} min={0} max={180} step={1} onChange={(v) => setParam("psi", v)} />
      </div>

      {/* 読み出し */}
      <div className="mt-3 w-full tabular-nums text-sm text-mut">
        残留振動 面1 <b className="text-ink">{res1.toFixed(2)}</b>（元 {v01.toFixed(2)}）
        ／ 面2 <b className="text-ink">{res2.toFixed(2)}</b>（元 {v02.toFixed(2)}）
        <br />
        補正おもり 面1 <b className="text-ink">{mag(m.W[0]).toFixed(1)} g∠{ang(m.W[0]).toFixed(0)}°</b>
        ／ 面2 <b className="text-ink">{isTwo ? `${mag(m.W[1]).toFixed(1)} g∠${ang(m.W[1]).toFixed(0)}°` : "なし"}</b>
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
