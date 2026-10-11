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
- **数値表示は常に固定桁**：format 未指定なら step の小数桁へ toFixed（Slider 内蔵）。アニメが setParam で書く生の浮動小数（0.2149946…）を垂れ流すと、桁数の変化で行折り返しが暴れ**スマホで画面ががくがくする**。対数スライダー等は `format` で表示を整形（例 3.48→「3,000 rpm」）。
- **動的に長さが変わるテキスト**（状態表示など）は、スマホでは `w-full sm:w-auto` で行を固定し、折り返しの出入り自体をなくす（RunupHero の作法）。

### 再生／停止（`components/PlayPause.tsx`）
- **絵文字は使わない**。インラインSVG（再生＝三角／停止＝二本バー、`fill="currentColor"`）。
- 形は `rounded-full` のピル、`border-line` ＋ hover で `border-accent text-accent`。ラベル「再生」「停止」。

### 深掘り折りたたみ（`:::deep` ／ `.aa-deep`）
- ネイティブ `<details>`。既定は**閉**。サマリ行＝自前の三角（開くと90°回転）＋「深掘り」チップ（`bg-accent/10 text-accent`）＋手書きタイトル。
- 開くと中身の左に `border-l-2 border-accent/40`（発展部分を視覚的に括る）。地は `bg-soft/60`。
- **常に開いた囲み**：`:::analogy タイトル`（チップ「たとえ話」）。`<details>` ではなく `<aside>` で描画し、左に太い紺の罫（`border-l-4 border-l-accent/50`）＋`bg-soft/40`。難所の直前に置く「手すり」で、例えの限界を 1 文添える作法（2026-10-10）。
- **たとえ話のアイコン**：`:::analogy @swing タイトル` のように見出しの先頭に `@名前` を付けると、`public/data/icons/<名前>.png`（192px 透過 PNG）を囲みの左に 48〜56px で置く（2026-10-10）。アイコンは紺の線画＋臙脂のアクセント 1 点の統一様式で、imagegen の 4×3 グリッド発注→PIL で切り出し・パレット整列（切り出しスクリプトは `scratchpad/icons3/slice.py`。2026-10-11 時点で 72 種）。同じ比喩には同じアイコンを使い回す（トランポリン・鍵・時計など）。
- 同じ容器の色違い：`:::history タイトル`（チップ「歴史」＝人物・事故・系譜の余談）／`:::field タイトル`（チップ「実務」＝現場の勘所）。`markdown.tsx` の `CONTAINERS` に名前を足すだけで増やせる（2026-10-09、翼振動章で導入）。

### 数式をたたむ（`MathFoldContext` ／ `.aa-mathfold`）
- 本文上部の右寄せピル「数式をたたむ」で、表示数式（`$$`）を `<details>`（破線枠・`bg-soft/40`・サマリ「数式を見る」）に畳む。インライン数式はそのまま。設定は `localStorage` の `aa-foldmath`、URL の `?fold=1` でも入る（2026-10-10、「数式が並ぶと難しい」への手すり）。
- 前提の作法：**表示数式の直後には必ず「言葉にすると、〜」の段落を置く**。畳んだときに言葉だけで一周できるのはこの約束があるから。

### 画像（`![alt](path "caption")`）
- 1行の画像記法。パスは `data/books/…` 起点（`asset()` で BASE_URL を付ける）。描画は figure（`rounded-lg border border-line bg-white shadow-card`）＋下に `text-sm text-mut` のキャプション。`loading="lazy"`。
- **小図**（2026-10-10）：末尾に `{right}` を付けると PC（md 以上）で本文の右に回り込む幅 270px の小図、スマホでは中央寄せ（最大 340px）。`{small}` は常に中央寄せ（最大 360px）。キャプションは `text-xs`。見出し・ブロック・囲み（aside/details）には `clear-both` が入っているので、回り込みはそこで必ず切れる。**{right} は直後に通常段落が 2〜3 つ続く場所にだけ置く**（直後が見出しや囲みだと右に空白が残る）。小図は幅 800px・JPEG q80（50〜120KB）。「大きい図を少なく」ではなく「小さい図を頻繁に」が翼振動章の方針。
- 生成画像（imagegen）は**「イメージ図（生成画像・模式）」とキャプションに明記**し、事実を担う図には使わない。保存は `public/data/books/<book>/images/`、幅 1400px・JPEG q82（250KB 前後）に落としてから置く。様式＝中世紀 NASA 技術マニュアル調の線画、紺×生成り×臙脂の二色刷り（翼振動章の `turbopump-hero.jpg` / `nozzle-wakes.jpg`）。

### スマホの横はみ出しと拡大（2026-10-11、ユーザー要望「拡大縮小は不要」）
- **拡大は使わない前提**：`index.html` の viewport に `maximum-scale=1, user-scalable=no, viewport-fit=cover`（iOS Safari は無視するが PWA と Android には効く）、`html { touch-action: pan-x pan-y }`（二本指とダブルタップの拡大を抑止）、`main.tsx` で `gesturestart`/`gesturechange` と二本指 `touchmove`（`scale !== 1`）を `preventDefault`（iOS Safari 実機向け）。
- **横はみ出しの根絶**：`html, body { overflow-x: clip }`（`hidden` と違い sticky を壊さない）。根本原因側＝`.katex-display` は横スクロール、`article p/li/figcaption` は `overflow-wrap: anywhere`（長い URL）、Reader ヘッダーの節名は flex＋`min-w-0 truncate`。閉じたドロワーは描画しない（transform で画面外に置くと scrollWidth に乗る）。
- **測り方**：headless Edge＋CDP で `Emulation.setDeviceMetricsOverride({width:390, mobile:true})` し、`getBoundingClientRect().right > clientWidth` の要素と `documentElement.scrollWidth` を見る（`scratchpad/overflow_check.mjs`）。幅 520px を要する部品（`min-w-[520px]`）は親の `overflow-x-auto` の中で横スクロールする設計で、ページ幅には乗らない。

### ホーム地図のラベル配置（2026-10-11 更新）
- 章が 12 を超えたら文字を 18.5px→16px。候補位置は 上→下→右→左→右上→左上→右下→左下 の順で、置いたラベル・ピン・START・旗と重ならない最初の位置を採る（`Home.tsx`）。16 章で重なりなしを確認。

### オフライン対応（PWA、2026-10-11）
- `vite-plugin-pwa`（Workbox、`registerType: "autoUpdate"`、manifest は `public/manifest.webmanifest` をそのまま使用）。**precache**＝アプリ本体・KaTeX の woff2・節の本文 md・outline/symbols・たとえ話アイコン（約 4MB）。**写真と小図（`data/books/**/images/`、約 15MB）は precache しない**で、見た節のぶんだけ runtime cache `aa-images`（CacheFirst、600 件・180 日）に残す。フォントは `aa-fonts`。
- 「図もオフラインに保存」ピル（`components/OfflineButton.tsx`、`lib/offline.ts`）：Reader の道具行の右端、「数式をたたむ」の隣。全節の md から画像パスを集めて 4 並列で fetch し runtime cache を温める。進捗は「図を保存中 n/N」、完了は localStorage `aa-offline-images`=1 で「保存済み（再保存）」。service worker が無い環境では描画しない。
- 更新：新しいビルドを配信すると次回の読み込みで自動更新（通知は出さない）。

### 節内ナビと部の進行バー（`Reader.tsx`、2026-10-10）
- **節内ナビ**：本文の最上位 `## ` 見出しを `extractHeadings()`（`markdown.tsx`）で拾い、PC は左目次の「いま読んでいる節」の下に `text-xs text-mut` の小見出し列（左罫 `border-l border-line`）、スマホは本文冒頭の `<details>`「この節の流れ（n 見出し）」。見出しは `id="h2-n"`＋`scroll-mt-20`、クリックは `scrollIntoView`（HashRouter なので `href="#…"` は使わない）。囲みの中の見出しは対象外。
- **部の進行バー**：章に `part` があるとき、本文上部に部のチップ列（現在の部＝`border-accent bg-accent/10 text-accent`、他＝白地）と「n/N 節」。チップで部の先頭節へ。「数式をたたむ」ピルと同じ行の左右配置。

### 目次の「部」見出し（`outline.json` の `part`）
- 大きな章では節に `part:"I 翼はなぜ揺れるか"` のような文字列を付けると、目次（サイドバー・ドロワー）で部が変わる位置に `font-serif text-[11px] text-accent/80` の小見出し＋上罫線が入る（`Reader.tsx`）。部の文字列は節に繰り返し持たせる（グループ化はしない）。

### バッジ
| 種類 | スタイル | 例 |
|---|---|---|
| 選択中・本採用・チップ | `bg-accent/10 text-accent` | 目次「発展」、ギャラリ「本採用」、深掘りチップ |
| 試作中・無効 | `bg-soft2 text-mut` | ギャラリ「試作中」 |

### 用語ポップ（`[[記号]]` ／ `components/TermPop.tsx`）
- 本文に点線下線の語を置き、タップ/ホバーで定義を出す（details-on-demand）。定義の正典は `symbols.json`。

### トップの探検地図（`pages/Home.tsx`）
- `outline.json` 駆動。章ピンを蛇行する経路上に等間隔（弧長）で配置＝**章が増えると自動で増える**。ピン→その章の先頭節へ。
- **ラベルは自動配置**（2026-10-09、章が12になりピンとラベルが重なったため）：各ピンの章名を「頭の上→足元の下→右→左」の順に試し、他のピン本体・置き済みラベル・START バッジ・頂上の旗と重ならない最初の位置に置く（文字幅は全角18.5px/半角10pxで見積もり）。上下は中央揃え、左右は `textAnchor` start/end。経路の制御点 `NODES` を変えるときも手作業の位置調整は不要。
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

### アプリアイコン（favicon／PWA）＝「マッチラベル」意匠（2026-07-04 刷新）

- **紋章のコンセプト**：昭和のマッチ箱ラベルの系譜（レトロ印刷／ヴァナキュラー）。生成り紙 `#efe5cd` に**朱 `#b5493a` ＋紺 `#22456e` の2色刷り**。朱の外枠＋紺の内枠、上下に `ANIMA / ATLAS` の題字（Georgia系セリフ・letter-spacing広め）、四隅に朱の菱飾り。紋章＝紺の円板ロータを朱の軌道環が周回し、**朱版をわざと3pxずらした「版ズレ」がシグネチャー**。
- **三段構え**：
  - `favicon.svg`（フル版＝ラベル全部入り。192px以上のPNGの元）
  - `favicon-small.svg`（16–32px向け。題字・内枠・菱を落とし、外枠と紋章だけを太く＝「小さな切手」として読める）
  - `icon-maskable.png`（Android円形マスク用。**矩形の枠は円マスクで角が切られる**ため、枠なし・紋章＋題字を中央80%セーフゾーンに収めた別版。manifest の `purpose:"maskable"` はこれを指す）
- **生成**：グローバルの **app-icon スキル**（512pxで描いて高品質縮小）。`manifest.webmanifest` は `theme_color #1f3a5f`（サイトのUI色）／`background_color #efe5cd`（紙色＝スプラッシュがラベルと同化）。
- **配信**：`index.html` のリンクは**相対パス**（サブパス `/anima-atlas/` で `/favicon.svg` は404になるため）。
- **注意**：SVG favicon の題字はローカルフォント描画（Georgia→無ければserif代替）。PNG群は生成時に焼き込むので安定。アイコンの旧デザイン（紺地・コンパス環×軌道）は 2026-07-04 まで。

---

_最終更新の責任：見た目を変えたら、この表も同時に直すこと。_
