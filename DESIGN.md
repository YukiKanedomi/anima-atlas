# Anima Atlas — ビジュアル・デザイン規約

このプロジェクトの**見た目の正典**。配色・タイポ・間隔・UI部品の作法をここに集約する。
新しい画面や部品を作るときは、まずここを見て揃える。コードと値がズレたら**このファイルを直す**（DESIGN.md が正、コメントは補助）。

> 原則：**洗練＝わかりやすい**。絵文字は使わない。アクセントは単色（紺）。図は「嘘をつかない」（模式は明記・出典つき・捏造なし）。紙にできない"動き"を上品に。

---

## 1. 配色トークン

配色は **`src/index.css` の CSS変数に集約**し、Tailwind からは変数を参照する名前で使う（`tailwind.config.js`）。テーマ（紺→臙脂など）を差し替えても、変数を書き換えるだけで全体が追従する。**生のカラーコードを各所に直書きしない**。

| CSS変数 | 値 | Tailwind名 | 用途 |
|---|---|---|---|
| `--bg` | `#f6f7f9` | `bg-paper` | 紙の地（ページ背景） |
| `--ink` | `#1b2433` | `text-ink` | 本文の墨（やや紺寄り） |
| `--mut` | `#5c6678` | `text-mut` | 補助テキスト・ラベル・目盛り |
| `--accent` | `#1f3a5f` | `accent` | 紺アクセント（主役・曲線・リンク・選択中） |
| `--accent-d` | `#15294a` | `accent-d` | 濃紺（カーソル・強い強調） |
| `--line` | `#e1e5ec` | `line` | 罫線・枠・区切り |
| `--soft` | `#eef1f6` | `soft` | うすい面（パネル背景） |
| `--soft2` | `#e7ebf2` | `soft2` | やや濃いうすい面（スライダー溝など） |

- カードや図の地は**白 `#fff`**（`bg-white`）。地の `--bg` とわずかに差をつけて浮かせる。
- 透明度つきは Tailwind の `/` 記法で：選択バッジ＝`bg-accent/10 text-accent`、フォーカスリング＝`rgba(31,58,95,.18)`。

### 副アクセント：臙脂 `#9b2d3a`
図中で「もう一方／後ろ向き／注意」を表す**第2の色**として臙脂を使う（前向き=紺 / 後ろ向き=臙脂、振幅=紺 / 位相=臙脂 など）。
- ⚠ **未トークン化**：現状は各ブロックに `#9b2d3a` を直書き（`HEAVY` 定数）。テーマ差し替えに備え、いずれ `--heavy` 変数化したい。新規ブロックでもこの値で揃える。

---

## 2. タイポグラフィ

| 役割 | フォント | Tailwind |
|---|---|---|
| 見出し `h1〜h3`・ワードマーク・図タイトル | 明朝（セリフ） | `font-serif` |
| UI・ラベル・本文 | ゴシック（サンセリフ） | `font-ui`（本文の既定） |

- セリフ＝`"Hiragino Mincho ProN", "Yu Mincho", Georgia, serif`。学術・王道の品を出す。**見出しと図のタイトルはセリフ**で統一。
- サンセリフ＝`"Yu Gothic UI", system-ui, sans-serif`。
- 見出しサイズ：`h1` = `text-3xl`、`h2` = `text-2xl`、`h3` = `text-xl`（`src/lib/markdown.tsx`）。
- 本文：`leading-8 text-ink/90`。数値表示は **`tabular-nums`**（桁が揺れない）。
- 数式は KaTeX（`$…$` インライン / `$$…$$` ブロック）。長い日本語の"標語"は数式にせず**太字の文**にする（ディスプレイ数式は折り返さず溢れるため）。
- **ワードマーク**：`Anima · Atlas`。語間の中黒だけ `text-accent`（軌道の点＝動きのニュアンス）。`components/Wordmark.tsx`。

---

## 3. 余白・形・影

- **本文の最大幅**：`max-w-content` = **760px**（読みやすい行長）。
- **角丸**：カード・図＝`rounded-lg`、ピル/バッジ＝`rounded-full` / `rounded`。
- **影**：`shadow-card`（`0 3px 10px rgba(20,30,50,.05)`＝図の微浮き）／`shadow-pop`（`0 12px 32px rgba(0,0,0,.18)`＝ポップ・ドロワー）。影は**控えめ**に。
- **枠線**：`border border-line`。区切りは `border-t/b border-line`。
- 余白は Tailwind スケールで。図ブロックは外側 `my-6`、内側 `p-4`。

---

## 4. UI部品の作法

### スライダー（`components/Slider.tsx` ＋ `.aa-range`）
- ラベルは左に `text-mut`、現在値は右に `font-ui tabular-nums text-ink`。
- 溝は `--soft2`、**進んだ分を紺で塗る**（`linear-gradient(to right, var(--accent) {pct}%, var(--soft2) {pct}%)` をインライン指定）。
- つまみ＝白丸・紺2px枠・微シャドウ、6pxトラック／16pxつまみ。hoverで1.15倍、フォーカスで紺の淡いリング。

### 再生／停止（`components/PlayPause.tsx`）
- **絵文字は使わない**。インラインSVG（再生＝三角／停止＝二本バー、`fill="currentColor"`）。
- 形は `rounded-full` のピル、`border-line` ＋ hover で `border-accent text-accent`。ラベル「再生」「停止」。

### 深掘り折りたたみ（`:::deep` ／ `.aa-deep`）
- ネイティブ `<details>`。既定は**閉**。サマリ行＝自前の三角（開くと90°回転）＋「深掘り」チップ（`bg-accent/10 text-accent`）＋手書きタイトル。
- 開くと中身の左に `border-l-2 border-accent/40`（発展部分を視覚的に括る）。地は `bg-soft/60`。

### バッジ
| 種類 | スタイル | 例 |
|---|---|---|
| 選択中・本採用・チップ | `bg-accent/10 text-accent` | 目次「発展」、ギャラリ「本採用」、深掘りチップ |
| 試作中・無効 | `bg-soft2 text-mut` | ギャラリ「試作中」 |

### 用語ポップ（`[[記号]]` ／ `components/TermPop.tsx`）
- 本文に点線下線の語を置き、タップ/ホバーで定義を出す（details-on-demand）。定義の正典は `symbols.json`。

### トップの探検地図（`pages/Home.tsx`）
- `outline.json` 駆動。章ピンを蛇行する経路上に等間隔（弧長）で配置＝**章が増えると自動で増える**。ピン→その章の先頭節へ。
- アニメ用クラス（`index.css`）：`.aa-route`（経路が描かれる・`pathLength=1`で正規化）、`.aa-pin-wrap`（順に立ち上がる・`animation-delay`でstagger）、`.aa-pin`（ホバーで浮く・`transform-box:fill-box`）。
- 配色は紺トークン＋頂上の旗だけ臙脂。等高線＝`--line`、道＝`--soft2`の太線＋`--accent`の細い描画線。**新規の装飾アニメもこの3クラスの作法に倣う**。

---

## 5. ブロック図（figure）の共通レイアウト

動く図の部品は、外見を必ず揃える：

```
<figure class="my-6 rounded-lg border border-line bg-white p-4 shadow-card">
  <figcaption class="mb-2 font-serif text-base text-ink"> タイトル </figcaption>
  <svg viewBox="0 0 W H" class="w-full" role="img" aria-label="…"> … </svg>
  … スライダー等のコントロール …
  <p class="mt-3 text-sm leading-relaxed text-mut"> caption </p>
</figure>
```

- タイトル＝**セリフ**、caption＝`text-sm text-mut`。
- 横並びにコントロールを置くときは**列を固定幅に**（例 `grid-cols-[minmax(0,1fr)_200px]`）。side列に長文を入れると**SVGが圧迫される**ので注意（実際に起きた）。

### SVG描画の色・線の規約
図の中の色も配色トークンで統一する：

| 要素 | 色 | 目安 |
|---|---|---|
| 主曲線・主役 | `var(--accent)` | strokeWidth ≈ 2.2 |
| 第2曲線・後ろ向き・注意 | `#9b2d3a`（臙脂） | strokeWidth ≈ 2.2 |
| 軸・罫線 | `var(--line)` | 1 |
| パネルの地 | `var(--soft)` opacity `0.35` | — |
| 目盛り・補助ラベル | `var(--mut)` | fontSize 10〜12 |
| カーソル・現在点・ベクトル | `var(--accent-d)` | dot r≈5 |
| 危険速度など重要マーカー | 臙脂の輪 or `accent-d` | r≈6, 枠2 |

---

## 6. アイコン方針

- **絵文字禁止**。アイコンは**インラインSVG**で、`fill`/`stroke="currentColor"` にして色は文字色から継承。
- 線アイコンは `strokeWidth 1.6` 前後・`strokeLinecap="round"`（ハンバーガー、閉じる×、三角など）。

### アプリアイコン（favicon／PWA）

- **紋章のコンセプト**：「古地図のコンパス環 × 振れ回り軌道」。紺地（`#274a76→#13274a` 縦グラデ）に、古地図ゴールド（軌道 `#f1e6c6`／掃引アーク・質点 `#e8ad4e`）。外周＝グラティキュール（目盛環の破線）、中央＝-24°傾けた楕円軌道を回る質点＋シャフト中心。アトラス（地図帳）と回転体力学の主役を一つに束ねる。
- **二段構え**：`public/favicon.svg`（精緻版・目盛環や掃引アークあり、192px以上向け）と `public/favicon-small.svg`（16–32px向け。目盛環を省き線を太く `strokeWidth 22`・質点を大きく＝小サイズで潰れない簡略版）。
- **生成物**：`icon-512/192.png`・`apple-touch-icon.png`(180)は精緻版から、`favicon-16/32.png`は簡略版から書き出し。`favicon.ico`は32px PNGを内包。`manifest.webmanifest` に `theme_color #1f3a5f`／`background_color #13274a`／maskable は512を流用。
- **配信**：`index.html` のリンクは**相対パス**（先頭スラッシュなし）。サブパス `/anima-atlas/` で `/favicon.svg` は404になるため。
- **作り直し方**：SVGを直したら、ヘッドレスChromeで各サイズに `--screenshot`（`--window-size=N,N`・`--default-background-color=00000000`）して `public/` に上書き → ICOは32px PNGをICONDIRで包む。

---

_最終更新の責任：見た目を変えたら、この表も同時に直すこと。_
