import { useMemo } from "react";
import { Slider } from "../../components/Slider";
import { useInstanceId, useSharedParams } from "../linkStore";

// ドメイン部品：1面バランシング（影響係数法）。
// 振動は 1× 同期応答のフェーザ（複素数）。元の振動 V0=α·U（U=不釣り合い、
// α=影響係数＝おもり1gあたりの振動応答）。試しおもり T を付けて V1=V0+αT を測れば
// α=(V1−V0)/T が分かり、補正おもり C=−V0/α=−U で残留振動はゼロになる。
// 肝：補正は「振動の高い向き」の真逆ではない。影響係数の位相 ψ ぶん回る。
// ※ 値・幾何は式どおりの模式（線形・1面・1×を仮定）。

export type BalancingConfig = {
  title?: string;
  caption?: string;
  link?: string;
  psiDefault?: number; // 影響係数の位相（応答の遅れ）deg
};

// 内部の真値（学習者には未知の設定）
const U_MAG = 8;   // 不釣り合い相当（g）
const U_ANG = 40;  // 重い点の角度（deg）
const A_MAG = 0.5; // 影響係数の大きさ（振動/g）

const W = 300, H = 300, CX = 150, CY = 150;
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
const mag = (a: C) => Math.hypot(a.re, a.im);
const ang = (a: C) => ((Math.atan2(a.im, a.re) * 180) / Math.PI + 360) % 360;

export default function Balancing({ config }: { config: BalancingConfig }) {
  const instId = useInstanceId("bal");
  const [vals, setParam] = useSharedParams(config.link ?? instId, {
    wt: 5,    // 試しおもり 大きさ g
    phit: 0,  // 試しおもり 角度 deg
    psi: config.psiDefault ?? 60, // 影響係数の位相
  });
  const { wt, phit, psi } = vals;

  const m = useMemo(() => {
    const U = pol(U_MAG, U_ANG);
    const alpha = pol(A_MAG, psi);
    const V0 = mul(alpha, U);
    const T = pol(wt, phit);
    const V1 = add(V0, mul(alpha, T));
    const enough = wt > 0.2;
    const alphaRec = enough ? div(sub(V1, V0), T) : alpha;
    const C = mul(pol(1, 180), div(V0, alphaRec)); // −V0/α
    const residual = add(V0, mul(alpha, C));
    return { U, alpha, V0, T, V1, C, residual, enough };
  }, [wt, phit, psi]);

  // 振動平面のスケール
  const vmax = Math.max(mag(m.V0), mag(m.V1), 1e-6) * 1.25;
  const vs = 118 / vmax;
  const vx = (c: C) => CX + c.re * vs;
  const vy = (c: C) => CY - c.im * vs;

  // ロータ正面（角度→座標、半径rr）
  const RIM = 112;
  const fx = (deg: number, rr: number) => CX + rr * Math.cos((deg * Math.PI) / 180);
  const fy = (deg: number, rr: number) => CY - rr * Math.sin((deg * Math.PI) / 180);

  const cMag = mag(m.C);
  const cAng = ang(m.C);
  const v0Ang = ang(m.V0);
  const naiveAng = (v0Ang + 180) % 360; // 素朴な「振動の真逆」（誤り）

  const Vec = ({ c, color, dash, label }: { c: C; color: string; dash?: string; label?: string }) => (
    <g>
      <line x1={CX} y1={CY} x2={vx(c)} y2={vy(c)} stroke={color} strokeWidth={2} strokeDasharray={dash} />
      <circle cx={vx(c)} cy={vy(c)} r={4} fill={color} />
      {label ? <text x={vx(c) + 6} y={vy(c) - 4} fontSize="11" fill={color}>{label}</text> : null}
    </g>
  );

  const Weight = ({ deg, rr, color, r, label }: { deg: number; rr: number; color: string; r: number; label: string }) => (
    <g>
      <line x1={CX} y1={CY} x2={fx(deg, rr)} y2={fy(deg, rr)} stroke={color} strokeWidth={1.4} opacity={0.5} />
      <circle cx={fx(deg, rr)} cy={fy(deg, rr)} r={r} fill={color} />
      <text x={fx(deg, rr + 14)} y={fy(deg, rr + 14) + 4} fontSize="10" fill={color} textAnchor="middle">{label}</text>
    </g>
  );

  return (
    <figure className="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
      {config.title ? (
        <figcaption className="mb-2 font-serif text-base text-ink">{config.title}</figcaption>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 振動の複素平面 */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="振動の複素平面">
          <text x={CX} y={14} fontSize="12" fill="var(--mut)" textAnchor="middle">振動フェーザ（測定）</text>
          <line x1={20} y1={CY} x2={W - 20} y2={CY} stroke="var(--line)" />
          <line x1={CX} y1={28} x2={CX} y2={H - 16} stroke="var(--line)" />
          <Vec c={m.V0} color={BLUE} label="V₀ 元" />
          {m.enough ? <Vec c={m.V1} color="var(--mut)" dash="4 4" label="V₁ 試し後" /> : null}
          {/* 残留（補正後）＝ほぼ原点 */}
          <circle cx={vx(m.residual)} cy={vy(m.residual)} r={6} fill="none" stroke={GREEN} strokeWidth={2} />
          <text x={CX + 8} y={CY + 16} fontSize="10" fill={GREEN}>補正後≈0</text>
        </svg>

        {/* ロータ正面 */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ロータ正面（おもりの角度）">
          <text x={CX} y={14} fontSize="12" fill="var(--mut)" textAnchor="middle">ロータ正面（おもりの位置）</text>
          <circle cx={CX} cy={CY} r={RIM} fill="var(--soft)" opacity={0.4} stroke="var(--line)" />
          {[0, 90, 180, 270].map((a) => (
            <text key={a} x={fx(a, RIM + 12)} y={fy(a, RIM + 12) + 4} fontSize="10" fill="var(--mut)" textAnchor="middle">{a}°</text>
          ))}
          {/* 振動の高い向き（誤りやすい目印） */}
          <line x1={CX} y1={CY} x2={fx(v0Ang, RIM)} y2={fy(v0Ang, RIM)} stroke="var(--mut)" strokeDasharray="3 4" opacity={0.6} />
          <text x={fx(v0Ang, RIM * 0.6)} y={fy(v0Ang, RIM * 0.6)} fontSize="9" fill="var(--mut)">振動の向き</text>
          {/* 重い点・試し・補正 */}
          <Weight deg={U_ANG} rr={RIM * 0.82} color={HEAVY} r={6} label="重い点" />
          {m.enough ? <Weight deg={phit} rr={RIM * 0.6} color={BLUE} r={5} label="試し" /> : null}
          <Weight deg={cAng} rr={RIM * 0.82} color={GREEN} r={6} label="補正" />
        </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Slider label="試しおもり 大きさ（g）" value={wt} min={0} max={12} step={0.1} onChange={(v) => setParam("wt", v)} />
        <Slider label="試しおもり 角度（°）" value={phit} min={0} max={360} step={1} onChange={(v) => setParam("phit", v)} />
        <Slider label="影響係数の位相 ψ（応答の遅れ°）" value={psi} min={0} max={180} step={1} onChange={(v) => setParam("psi", v)} />
      </div>

      <div className="mt-3 tabular-nums text-sm text-mut">
        {m.enough ? (
          <>
            補正おもり <b className="text-ink">{cMag.toFixed(1)} g</b> を <b className="text-ink">{cAng.toFixed(0)}°</b> に
            ／ 残留振動 <b className="text-ink">{mag(m.residual).toFixed(2)}</b>（≈0）
            <br />
            <span className="text-mut">
              振動が一番大きい向きは <b className="text-ink">{v0Ang.toFixed(0)}°</b>。素朴な「真逆」({naiveAng.toFixed(0)}°) ではなく、
              補正は重い点の真逆＝<b className="text-ink">{cAng.toFixed(0)}°</b>（位相 ψ ぶんずれる）。
            </span>
          </>
        ) : (
          <span>試しおもりの大きさを上げてください（試し運転がないと影響係数が決められません）。</span>
        )}
      </div>

      {config.caption ? <p className="mt-3 text-sm leading-relaxed text-mut">{config.caption}</p> : null}
    </figure>
  );
}
