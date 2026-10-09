import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchJson, type Outline } from "../lib/data";
import { getVisited } from "../lib/progress";
import { Wordmark } from "../components/Wordmark";

const BOOK_DIR = "data/books/rotordynamics";
const W = 800;
const H = 620;
const PADX = 70;
const PADY = 56;

// 経路の制御点（正規化：x右・y下）。基礎の浜（左下）→ 実機の頂（右上）への蛇行。
const NODES = [
  { x: 0.08, y: 0.92 },
  { x: 0.30, y: 0.90 },
  { x: 0.56, y: 0.86 },
  { x: 0.77, y: 0.73 },
  { x: 0.54, y: 0.63 },
  { x: 0.30, y: 0.59 },
  { x: 0.13, y: 0.50 },
  { x: 0.24, y: 0.39 },
  { x: 0.48, y: 0.36 },
  { x: 0.70, y: 0.31 },
  { x: 0.62, y: 0.21 },
  { x: 0.70, y: 0.13 },
  { x: 0.86, y: 0.10 },
];

type Pt = { x: number; y: number };
const mapX = (nx: number) => PADX + nx * (W - 2 * PADX);
const mapY = (ny: number) => PADY + ny * (H - 2 * PADY);

// Catmull–Rom で制御点を滑らかな密点列に
function sampleRoute(per = 26): Pt[] {
  const pts = NODES.map((n) => ({ x: mapX(n.x), y: mapY(n.y) }));
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const out: Pt[] = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export default function Home() {
  const navigate = useNavigate();
  const [outline, setOutline] = useState<Outline | null>(null);
  // 読了の足あと（localStorage）。歩いた章のピンが塗られる。
  const [visited] = useState<Set<string>>(() => getVisited());

  useEffect(() => {
    fetchJson<Outline>(`${BOOK_DIR}/outline.json`).then(setOutline).catch(() => {});
  }, []);

  const { routeD, pins } = useMemo(() => {
    const dense = sampleRoute();
    // 弧長
    const cum = [0];
    for (let i = 1; i < dense.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
    }
    const total = cum[cum.length - 1] || 1;
    const at = (f: number): Pt => {
      const target = f * total;
      let i = 1;
      while (i < cum.length && cum[i] < target) i++;
      return dense[Math.min(i, dense.length - 1)];
    };
    const routeD = "M" + dense.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");

    const chapters = outline?.chapters ?? [];
    const n = chapters.length;
    const base = chapters.map((ch, i) => {
      const f = n > 1 ? i / (n - 1) : 0.5;
      const p = at(f);
      const done = ch.sections.filter((s) => visited.has(s.id)).length;
      return { ch, x: p.x, y: p.y, index: i, last: i === n - 1, done, total: ch.sections.length };
    });

    // ラベルの自動配置：上→下→右→左の順に試し、置いたラベルやピン本体と重ならない最初の位置を採る。
    // 章が増えて経路上でピンが詰まっても、手で座標を調整せずに済む。
    type Box = { x: number; y: number; w: number; h: number };
    const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const textW = (t: string) => [...t].reduce((w, c) => w + (c.charCodeAt(0) < 0x2e80 ? 10 : 18.5), 0);
    const obstacles: Box[] = base.map((p) => ({ x: p.x - 16, y: p.y - 46, w: 32, h: 52 }));
    // 先頭ピンの足元には START バッジがある
    if (base[0]) obstacles.push({ x: base[0].x - 36, y: base[0].y + 4, w: 72, h: 34 });
    // 最後のピンの頭の右上には頂上の旗がある
    const top = base[base.length - 1];
    if (top) obstacles.push({ x: top.x + 4, y: top.y - 80, w: 40, h: 40 });
    const placed: Box[] = [];
    const pins = base.map((p, pi) => {
      const w = Math.max(textW(p.ch.title), 60);
      const h = 40;
      const headY = p.y - 30;
      const cands: { pos: "above" | "below" | "right" | "left"; box: Box }[] = [
        { pos: "above", box: { x: p.x - w / 2, y: headY - 52, w, h } },
        { pos: "below", box: { x: p.x - w / 2, y: p.y + 8, w, h } },
        { pos: "right", box: { x: p.x + 20, y: headY - 22, w, h } },
        { pos: "left", box: { x: p.x - 20 - w, y: headY - 22, w, h } },
      ];
      const ok = cands.find(
        (c) =>
          c.box.x >= 4 &&
          c.box.x + c.box.w <= W - 4 &&
          !obstacles.some((o, oi) => oi !== pi && hit(o, c.box)) &&
          !placed.some((o) => hit(o, c.box))
      );
      const pick = ok ?? cands[0];
      placed.push(pick.box);
      return { ...p, label: pick.pos, labelBox: pick.box };
    });
    return { routeD, pins };
  }, [outline, visited]);

  // 全体の歩数（読了カウンタ）
  const walked = useMemo(() => {
    const all = outline?.chapters.flatMap((c) => c.sections) ?? [];
    return { done: all.filter((s) => visited.has(s.id)).length, total: all.length };
  }, [outline, visited]);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="font-ui text-sm tracking-widest text-accent">AN INTERACTIVE TEXTBOOK</p>
      <h1 className="mt-2 text-4xl leading-tight text-ink">
        <Wordmark className="text-4xl" />
      </h1>
      <p className="mt-2 text-lg text-mut">生きている知識の地図帳。基礎の浜から実機の頂へ、ピンを辿って旅をする。</p>

      {/* 探検の地図 */}
      <figure className="mt-6 overflow-hidden rounded-xl border border-line shadow-card">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          style={{ background: "linear-gradient(160deg, var(--soft) 0%, #fff 60%)" }}
          role="img"
          aria-label="ロータダイナミクスの章を辿る探検地図"
        >
          <defs>
            <radialGradient id="aa-summit" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--soft2)" />
              <stop offset="100%" stopColor="var(--soft)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 等高線（うっすら地形） */}
          <g stroke="var(--line)" fill="none" opacity={0.7}>
            <ellipse cx={mapX(0.78)} cy={mapY(0.16)} rx={120} ry={78} />
            <ellipse cx={mapX(0.78)} cy={mapY(0.16)} rx={78} ry={50} />
            <ellipse cx={mapX(0.78)} cy={mapY(0.16)} rx={40} ry={26} />
            <ellipse cx={mapX(0.2)} cy={mapY(0.86)} rx={110} ry={52} opacity={0.6} />
            <ellipse cx={mapX(0.2)} cy={mapY(0.86)} rx={66} ry={30} opacity={0.6} />
          </g>
          <circle cx={mapX(0.78)} cy={mapY(0.16)} r={90} fill="url(#aa-summit)" />

          {/* 方位磁針 */}
          <g transform={`translate(${mapX(0.06)}, ${mapY(0.12)})`} opacity={0.85}>
            <circle r={22} fill="#fff" stroke="var(--line)" />
            <path d="M0,-17 L5,0 L0,17 L-5,0 Z" fill="var(--accent)" opacity={0.85} />
            <path d="M0,17 L5,0 L0,-17 L-5,0 Z" fill="var(--accent)" opacity={0.25} />
            <text y="-26" fontSize="11" fill="var(--mut)" textAnchor="middle" className="font-ui">N</text>
          </g>

          {/* 経路：太い道＋細い破線の中心線（道が描かれていく） */}
          <path d={routeD} fill="none" stroke="var(--soft2)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          <path
            className="aa-route"
            pathLength={1}
            d={routeD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="1"
            strokeLinecap="round"
            opacity={0.55}
          />

          {/* 章ピン */}
          {pins.map((pin) => {
            const headY = pin.y - 30;
            // ラベルはピンの真上/真下に中央揃え。章が増えて同じ区間に並ぶ隣同士が
            // 重ならないよう、偶数は頭の上・奇数は足元の下と帯を分ける。
            const L = pin.label;
            const labelX = L === "right" ? pin.x + 20 : L === "left" ? pin.x - 20 : pin.x;
            const anchor = L === "right" ? "start" : L === "left" ? "end" : "middle";
            const titleY = L === "above" ? headY - 36 : L === "below" ? pin.y + 24 : headY - 4;
            const subY = titleY + 18;
            return (
              <g
                key={pin.ch.id}
                className="aa-pin-wrap"
                style={{ animationDelay: `${0.5 + pin.index * 0.12}s` }}
                role="button"
                tabIndex={0}
                aria-label={`${pin.ch.title}（${pin.ch.sections.length}節）へ`}
                onClick={() => pin.ch.sections[0] && navigate(`/read/${pin.ch.sections[0].id}`)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && pin.ch.sections[0]) {
                    e.preventDefault();
                    navigate(`/read/${pin.ch.sections[0].id}`);
                  }
                }}
              >
                {/* 当たり判定：ピン本体と、実際に置いたラベル箱だけ（大きな矩形は隣のピンのクリックを奪う） */}
                <rect x={pin.x - 16} y={headY - 16} width={32} height={pin.y - headY + 22} fill="transparent" />
                <rect className="aa-pin-text" x={pin.labelBox.x} y={pin.labelBox.y} width={pin.labelBox.w} height={pin.labelBox.h} fill="transparent" />

                {/* ラベル（スマホでは非表示→地図下のチップ一覧が代役） */}
                <text className="aa-pin-text aa-pin-label font-serif" x={labelX} y={titleY} fontSize="18.5" fill="var(--ink)" textAnchor={anchor}>
                  {pin.ch.title}
                </text>
                <text x={labelX} y={subY} fontSize="13" fill="var(--mut)" textAnchor={anchor} className="aa-pin-text font-ui">
                  {pin.last ? "実機の頂・" : ""}
                  {pin.done > 0 ? `${pin.done}/${pin.total}節` : `${pin.total}節`}
                </text>

                {/* ピン本体（歩いた足あと：踏破＝塗りつぶし、途中＝白のまま進捗表示） */}
                <g className="aa-pin">
                  <ellipse cx={pin.x} cy={pin.y + 2} rx={7} ry={2.5} fill="rgba(20,30,50,.18)" />
                  <path d={`M${pin.x},${pin.y} L${pin.x - 7},${headY + 6} A14,14 0 1 1 ${pin.x + 7},${headY + 6} Z`} fill="var(--accent)" />
                  <circle cx={pin.x} cy={headY} r={9} fill={pin.done === pin.total && pin.total > 0 ? "var(--accent-d)" : "#fff"} />
                  {pin.done === pin.total && pin.total > 0 ? (
                    <path
                      d={`M${pin.x - 4},${headY} l3,3.4 l5.5,-6.4`}
                      fill="none"
                      stroke="#fff"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <text x={pin.x} y={headY + 4} fontSize="12" fill="var(--accent-d)" textAnchor="middle" className="font-ui font-semibold">
                      {pin.index + 1}
                    </text>
                  )}
                </g>
              </g>
            );
          })}

          {/* スタートの目印 */}
          {pins[0] ? (
            <g transform={`translate(${pins[0].x}, ${pins[0].y + 26})`}>
              <rect x={-26} y={-11} width={52} height={20} rx={10} fill="var(--accent)" />
              <text y={3} fontSize="11" fill="#fff" textAnchor="middle" className="font-ui tracking-wider">START</text>
            </g>
          ) : null}

          {/* 旗（頂上） */}
          {pins.length ? (
            <g transform={`translate(${pins[pins.length - 1].x + 12}, ${pins[pins.length - 1].y - 64})`} opacity={0.9}>
              <line x1={0} y1={0} x2={0} y2={34} stroke="var(--accent-d)" strokeWidth={2} />
              <path d="M0,0 L20,5 L0,11 Z" fill="#9b2d3a" />
            </g>
          ) : null}

          {!outline ? (
            <text x={W / 2} y={H / 2} fontSize="14" fill="var(--mut)" textAnchor="middle">地図を読み込み中…</text>
          ) : null}
        </svg>
      </figure>

      {/* スマホ専用：章チップ一覧（地図のラベルの代役。番号＝ピンと対応） */}
      <nav className="mt-4 flex flex-wrap gap-2 sm:hidden" aria-label="章の一覧">
        {pins.map((pin) => (
          <button
            key={pin.ch.id}
            onClick={() => pin.ch.sections[0] && navigate(`/read/${pin.ch.sections[0].id}`)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink shadow-card active:bg-soft"
          >
            <span
              className={
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold " +
                (pin.done === pin.total && pin.total > 0 ? "bg-accent-d text-white" : "bg-accent/10 text-accent")
              }
            >
              {pin.done === pin.total && pin.total > 0 ? "✓" : pin.index + 1}
            </span>
            {pin.ch.title}
            {pin.done > 0 && pin.done < pin.total ? (
              <span className="tabular-nums text-xs text-mut">{pin.done}/{pin.total}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* 地図の下：歩数・お試し場・但し書き */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {walked.done > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-mut shadow-card">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-accent">
                <path d="M2 6.5l2.5 2.8L10 3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              歩いた節 <b className="tabular-nums text-ink">{walked.done}</b> / {walked.total}
            </span>
          ) : null}
          <Link to="/gallery" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm shadow-card transition-colors hover:border-accent">
            <span className="font-serif text-ink">お試し場（部品ギャラリ）</span>
            <span className="text-accent">のぞく →</span>
          </Link>
        </div>
        <p className="max-w-md text-sm leading-7 text-mut">
          嘘をつかないことを大切に。図・式は正確に、概念図には「模式」と明記し、出典をつけ、捏造はしません。
        </p>
      </div>
    </div>
  );
}
