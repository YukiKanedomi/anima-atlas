import type { ComponentType } from "react";
import Predict from "./Predict";
import RunupHero from "./RunupHero";
import FunctionPlot from "./FunctionPlot";
import WhirlOrbit from "./WhirlOrbit";
import Orbit from "./Orbit";
import Waveform from "./Waveform";
import AlfordForce from "./AlfordForce";
import Aliasing from "./Aliasing";
import AnisoOrbit from "./AnisoOrbit";
import Campbell from "./Campbell";
import DftProbe from "./DftProbe";
import FourierSynth from "./FourierSynth";
import Leakage from "./Leakage";
import Resolution from "./Resolution";
import SyncAverage from "./SyncAverage";
import Spectrum from "./Spectrum";
import StabilityChart from "./StabilityChart";
import Torsional from "./Torsional";
import Transmissibility from "./Transmissibility";
import TwoPlaneBalancing from "./TwoPlaneBalancing";
import Waterfall from "./Waterfall";
import PolarPlot from "./PolarPlot";
import Bode from "./Bode";
import ModeShape from "./ModeShape";
import RigidRotor2DOF from "./RigidRotor2DOF";
import RunupTransient from "./RunupTransient";
import Balancing from "./Balancing";
import BalanceGrade from "./BalanceGrade";
import StandardsMap from "./StandardsMap";
import VibrationGauge from "./VibrationGauge";
import WhirlInstability from "./WhirlInstability";
import Nomenclature from "./Nomenclature";
import BladeModes from "./BladeModes";
import BladeCampbell from "./BladeCampbell";
import ExcitationHarmonics from "./ExcitationHarmonics";
import NodalDiameter from "./NodalDiameter";
import TravelingWave from "./TravelingWave";
import FamilyCurves from "./FamilyCurves";
import EoFolding from "./EoFolding";
import Zzenf from "./Zzenf";
import Mistuning from "./Mistuning";
import FrictionDamper from "./FrictionDamper";
import HaighDiagram from "./HaighDiagram";
import Flutter from "./Flutter";
import TipTiming from "./TipTiming";

// ブロック部品の「型契約」とレジストリ。
// ・本文（Markdown）は :::ブロック名 でここに登録された部品を呼ぶ。
// ・status: "stable"=本採用 / "experimental"=試作中（ギャラリで見比べ、勝てば stable に昇格）。
// ・未登録/改名のブロックはクラッシュさせず代替表示（蓄積が壊れない）。

export type BlockDef = {
  name: string; // ディレクティブ名（例 "function-plot"）
  title: string; // ギャラリ表示用の名前
  status: "stable" | "experimental";
  summary: string; // どんな部品か一言
  component: ComponentType<{ config: any }>;
  sample: unknown; // ギャラリで見せる試運転用の設定
};

export const blocks: BlockDef[] = [
  {
    name: "predict",
    title: "予測プロンプト（触る前に一呼吸）",
    status: "stable",
    summary:
      "ブロックを触る前に「どうなると思う？」と予想を選ばせる横断部品。受け身の閲覧を能動的な確認に変える。正解=緑・おしい=金でやさしく開示。",
    component: Predict,
    sample: {
      question: "回転数を上げて危険速度を超えると、揺れの大きさはどうなる？",
      options: ["どこまでも大きくなる", "だんだん小さくなり一定に落ち着く", "変わらない"],
      answer: 1,
      reveal: "危険速度の先では位相が反転して自動調心が働き、揺れはむしろ収まっていきます。下のブロックで r を上げて確かめてみてください。",
    },
  },
  {
    name: "runup-hero",
    title: "昇速デモ（序章の顔）",
    status: "stable",
    summary:
      "回転数を上げ下げすると、振れ回りが危険速度で膨らみ通過するとしぼむ。Jeffcottの不釣り合い応答 A=r²/√((1−r²)²+(2ζr)²) を自動再生。本書の主題を一発体感。",
    component: RunupHero,
    sample: {
      title: "ためし：回せば揺れる、ある速度でいちばん暴れる",
      zeta: 0.08,
      rMax: 2.6,
      caption: "自動で昇速・降速をくり返します。危険速度（回転数=1）で軌道がいちばん大きくなり、通過するとまた収まります。",
    },
  },
  {
    name: "function-plot",
    title: "スライダー連動グラフ（y = f(x)）",
    status: "stable",
    summary:
      "数式とスライダーを宣言するだけで、本物の曲線がリアルタイムに動く汎用ブロック。",
    component: FunctionPlot,
    sample: {
      title: "ためし：減衰のある共振の山",
      xKey: "r",
      xLabel: "回転数の比 r = Ω / ωn",
      yLabel: "揺れの大きさ R / e",
      xMin: 0,
      xMax: 3,
      yMin: 0,
      yMax: 6,
      expr: "(r*r) / sqrt((1 - r*r)^2 + (2*zeta*r)^2)",
      markerX: 1,
      markerLabel: "危険速度",
      sliders: [
        { key: "zeta", label: "減衰比 ζ", min: 0.05, max: 1, step: 0.01, default: 0.2 },
      ],
      caption: "ζ を小さくすると山が高く鋭くなる。",
    },
  },
  {
    name: "whirl-orbit",
    title: "振れ回り軌道アニメ",
    status: "stable",
    summary:
      "上から見たロータの振れ回りを再生。r を上げると位相が反転し、重い点が中心へ寄る（自動調心）。",
    component: WhirlOrbit,
    sample: {
      title: "ためし：振れ回りと自動調心",
      zeta: 0.1,
      rDefault: 0.6,
      caption: "再生しながら r を 1 より上へ動かしてみてください。",
    },
  },
  {
    name: "orbit",
    title: "振れ回り軌道（一般版）",
    status: "stable",
    summary:
      "前向き成分Fと後ろ向き成分Bの和で軌道を表す汎用版。円・楕円・直線・前後の向き、不安定の発散も。",
    component: Orbit,
    sample: {
      title: "ためし：F と B で軌道の形と向きが決まる",
      forwardDefault: 0.9,
      backwardDefault: 0.3,
      showGrowth: true,
      caption: "F>B で前向き楕円、F<B で後ろ向き、F=B で直線。成長率を上げると発散（不安定）。",
    },
  },
  {
    name: "waveform",
    title: "振動の時間波形（オシロ風）",
    status: "stable",
    summary: "時間 t の関数を走査線つきで描く汎用波形ブロック。減衰振動・センサ波形・複数トレースに。",
    component: Waveform,
    sample: {
      title: "ためし：減衰する自由振動（リングダウン）",
      tSpan: 9,
      yMax: 1.1,
      traces: [{ label: "変位", expr: "exp(-zeta*t) * cos(6*t)", color: "accent" }],
      sliders: [{ key: "zeta", label: "減衰の強さ", min: 0, max: 1.2, step: 0.01, default: 0.35 }],
      caption: "減衰が強いほど早く収まる。ζ=0 で永遠に続く正弦波。",
    },
  },
  {
    name: "campbell",
    title: "Campbell線図（危険速度マップ）",
    status: "stable",
    summary: "回転数で固有振動数が前向き/後ろ向きに分離。1×励起線との交点＝危険速度。γと運転点を操作。",
    component: Campbell,
    sample: {
      title: "ためし：γ を上げると枝が開き、危険速度が動く",
      gammaDefault: 0.6,
      opDefault: 1.5,
      caption: "γ（円板の扁平さ）を 1 に近づけると前向き危険速度が右へ逃げ、1 を超えると消える。",
    },
  },
  {
    name: "fourier-synth",
    title: "フーリエ合成（倍音の足し算シンセ）",
    status: "stable",
    summary:
      "正弦波を1本ずつ足して矩形波・のこぎり波・三角波を組み上げる古典デモ。上＝時間波形（部分和・目標・いま足した1本）、下＝レシピ棒（＝スペクトルの正体）。ギブス現象も見える。",
    component: FourierSynth,
    sample: {
      title: "ためし：丸い波だけでギザギザの波を作る",
      waveDefault: "square",
      nDefault: 1,
      caption: "スライダーで正弦波の本数を増やしてみてください。破線の目標にどんどん近づきます。下の棒グラフが「レシピ」——これがスペクトルの正体です。",
    },
  },
  {
    name: "dft-probe",
    title: "探り正弦波と平均（DFTの心臓）",
    status: "stable",
    summary:
      "信号に探りの正弦波を掛けて平均すると、同じ速さの成分だけが生き残る（直交性）。探りを掃引すると平均の曲線がスペクトルになる——「分解」の種明かし。",
    component: DftProbe,
    sample: {
      title: "ためし：探りを掃引して、隠れた成分を見つける",
      k1: 1,
      a1: 0.8,
      k2: 3,
      a2: 0.5,
      fDefault: 2,
      caption: "探りが成分と同じ速さになると、掛け算の緑（正）が勝って平均が立ち上がります。違う速さでは緑と赤が打ち消してゼロ。",
    },
  },
  {
    name: "aliasing",
    title: "エイリアシング（サンプリングの罠）",
    status: "stable",
    summary:
      "速い波を粗く測ると点列が「別の遅い波」に完全一致してしまう。左＝ストロボで見た回転円板（止まる・逆回り）、右＝波形とサンプル点＋見かけの波。境界 fs=2f。",
    component: Aliasing,
    sample: {
      title: "ためし：点滅を遅くすると、回転が止まって見える",
      fDefault: 4,
      fsDefault: 10,
      caption: "fs を下げていくと、赤破線の「見かけの波」が現れます。fs=4 でロータは静止して見え、fs=5 では逆回りに。サンプル点（金）はどちらの波にも完全に乗っています。",
    },
  },
  {
    name: "leakage",
    title: "窓とリーケージ（切り取り方の作法）",
    status: "stable",
    summary:
      "DFTは窓の中身が繰り返すとみなす。整数個ぴったり入らないと、つなぎ目の段差が偽の広がり（リーケージ）に化ける。Hann窓で端を絞ると裾が激減（山は少し太る）。本物のFFT。",
    component: Leakage,
    sample: {
      title: "ためし：つなぎ目の段差が、にじみに化ける",
      fDefault: 8.5,
      caption: "スライダーを整数（8や9）に合わせると1本にすっと立ち、半端（8.5）にするとにじみます。Hann窓に切り替えると、段差が消えて裾が沈みます。",
    },
  },
  {
    name: "resolution",
    title: "分解能と平均化（時間との取引）",
    status: "stable",
    summary:
      "近い2成分（8Hzと8.75Hz）を見分けられるかは記録の長さで決まる（Δf=1/T）。ノイズの荒れは平均回数で1/√Mに沈む。どちらも「時間で買う」。乱数はseed固定で再現可能。",
    component: Resolution,
    sample: {
      title: "ためし：記録を長くすると、2つの山が割れる",
      caption: "0.5秒では1山に融けています。4秒で2山に。平均回数を上げるとノイズの荒れがならされて、山がくっきり浮かびます。",
    },
  },
  {
    name: "sync-average",
    title: "回転同期平均（キーフェイザ基準の平均）",
    status: "stable",
    summary:
      "1回転1パルスの基準（キーフェイザ）に合わせて波形をM回転ぶん平均。同期成分（1×・2×）は残り、非同期（0.43×ホワール・ノイズ）は1/√Mで消える。回転成分の抽出フィルタ。",
    component: SyncAverage,
    sample: {
      title: "ためし：平均するほど、回転の声だけが残る",
      mDefault: 1,
      caption: "M=1では生の波形そのまま（灰の残像とほぼ同じ）。Mを増やすと、紺の平均が金破線（真の同期成分）へ吸い付いていきます。",
    },
  },
  {
    name: "spectrum",
    title: "FFTスペクトル（振動診断）",
    status: "stable",
    summary: "成分を足して本物のFFTで分解。時間波形↔スペクトルのピーク（1×不釣り合い・2×ミスアライメント・0.43×オイルホワール）。",
    component: Spectrum,
    sample: {
      title: "ためし：成分を足すとピークが立つ",
      components: [
        { key: "a1", freq: 1, label: "1× 不釣り合い", color: "accent", default: 0.8 },
        { key: "a2", freq: 2, label: "2× ミスアライメント", color: "heavy", default: 0.25 },
        { key: "a3", freq: 0.43, label: "0.43× オイルホワール", color: "mut", default: 0.1 }
      ],
      caption: "各スライダーを動かすと、時間波形が変わり、対応する周波数にピークが立ちます。",
    },
  },
  {
    name: "waterfall",
    title: "ウォーターフォール（カスケード線図）",
    status: "stable",
    summary:
      "昇速しながら各回転数のスペクトルを積み重ねた俯瞰図。斜めの尾根＝次数成分（1×・2×）、立った壁＝固有振動数に固定された自励（オイルホイップ）。診断の花形。",
    component: Waterfall,
    sample: {
      title: "ためし：斜めの尾根（次数）と縦の壁（自励）を見分ける",
      unbDefault: 0.8,
      misDefault: 0.25,
      whipDefault: 0.5,
      opDefault: 2.5,
      caption: "1×は回転数に比例して右へ動く斜めの尾根。Ω=1で危険速度を叩いて大きくなる。ホイップを上げると、固有振動数に立つ縦の壁が現れます。",
    },
  },
  {
    name: "polar",
    title: "ポーラ線図（振幅＋位相の極座標）",
    status: "stable",
    summary:
      "不釣り合い応答の複素ベクトルを回転数で掃引。原点→危険速度（位相−90°）で下に大ループ。振幅と位相を1枚に束ねる計測の花形。",
    component: PolarPlot,
    sample: {
      title: "ためし：回転数を上げると応答ベクトルがループを描く",
      zetaDefault: 0.1,
      rMax: 2.5,
      caption: "底（真下）が危険速度。ζ を小さくするとループが大きく深くなります。",
    },
  },
  {
    name: "bode",
    title: "ボード線図（振幅・位相 vs 回転数）",
    status: "stable",
    summary:
      "振幅と位相を回転数の関数で上下2段に。r=1 で位相90°（共振）。link でポーラ線図と掃引点・ζを共有でき、同じ点が両図で光る。",
    component: Bode,
    sample: {
      title: "ためし：振幅は山、位相は 0→180° の S字",
      zetaDefault: 0.1,
      rMax: 2.5,
      caption: "r スライダーを動かすとカーソルが両パネルを走査。位相が 90° を切るところが危険速度。",
    },
  },
  {
    name: "rigid-rotor-2dof",
    title: "剛体ロータの2自由度（並進＋傾き）",
    status: "stable",
    summary:
      "両端軟支持の剛体ロータ。並進(円筒)と傾き(円錐)の2モード・2危険速度。支持の非対称 k₂/k₁ を上げると2モードが連成し、節が動く。曲げモードの手前の剛体モード。",
    component: RigidRotor2DOF,
    sample: {
      title: "ためし：剛体でも2つのモードを持つ",
      asymDefault: 1,
      rhoDefault: 0.4,
      caption: "対称(k₂/k₁=1)なら 1次=並進・2次=傾きに分離。非対称にすると両者が混ざり（連成）、節の位置が動きます。",
    },
  },
  {
    name: "mode-shape",
    title: "曲げモード形状（連続体の軸）",
    status: "stable",
    summary:
      "軸の複数の曲げモードをアニメ表示。モード1/2/3と支持（単純支持/自由）を切替。n次は (n−1) 個の節を持ち、危険速度は単純支持で 1:4:9。",
    component: ModeShape,
    sample: {
      title: "ためし：モードと支持を切り替える",
      maxMode: 3,
      boundaryDefault: "pinned",
      caption: "モードを上げると節（動かない点）が増える。支持を自由-自由にすると形が変わり、危険速度の比も変わります。",
    },
  },
  {
    name: "runup-transient",
    title: "危険速度の通過（昇速の過渡応答）",
    status: "stable",
    summary:
      "無次元Jeffcottの過渡 z̈+2ζż+z=r(t)²e^{iθ}（r=αt）をRK4積分し、包絡線|z|を横軸r(t)で描く。定常曲線をゴースト破線で重ね、急いで通ると山が低く・r=1より遅れ、通過後にうなりが残ることを体感。",
    component: RunupTransient,
    sample: {
      title: "ためし：急いで通ると、山は低く・遅れて現れる",
      alphaDefault: 0.01,
      zetaDefault: 0.05,
      caption: "破線＝定常応答（ゆっくり回した理想）。αを上げるとピークが下がって右へずれ、通過後にうなりが現れます。",
    },
  },
  {
    name: "aniso-orbit",
    title: "異方支持と楕円軌道（後ろ向き帯）",
    status: "stable",
    summary:
      "支持の硬さが縦横で違う（kx≠ky）Jeffcottの不釣り合い応答。危険速度が2つに割れ、その間で|B|>|F|となり振れ回りが後ろ向きに反転。左=軌道アニメ（前向き=紺/後ろ向き=臙脂）、右=Ax・Ayの2山と後ろ向き帯。",
    component: AnisoOrbit,
    sample: {
      title: "ためし：2つの山のあいだで軌道が逆回りする",
      zeta: 0.08,
      kDefault: 1.5,
      omegaDefault: 0.7,
      caption: "Ω を 1 と 1.22 のあいだ（淡い臙脂の帯）に入れると、軌道の色が臙脂に変わり後ろ向きに回ります。ky/kx=1 に戻すと真円。",
    },
  },
  {
    name: "torsional",
    title: "ねじり振動（2慣性系）",
    status: "stable",
    summary:
      "モータI₁—軸kt—負荷I₂の2慣性ねじり系。互いに逆向きにねじれるモードをアニメし、節（ねじれない断面・金マーカー）が慣性の大きい側に寄るのを見せる。ωn=√(kt(1/I₁+1/I₂))、節=I₂/(I₁+I₂)。",
    component: Torsional,
    sample: {
      title: "ためし：モータと負荷が軸をねじり合う",
      ratioDefault: 1,
      ktDefault: 1,
      caption: "慣性比 I₂/I₁ を動かすと節が重い側へ寄り、kt を上げると震えが速くなります。",
    },
  },
  {
    name: "alford-force",
    title: "アルフォード力の模式（翼先すきま）",
    status: "stable",
    summary:
      "偏心→翼先すきまが不均一→狭い側の翼だけよく働き接線力に差→合計が変位と直角の力（=クロスカップリングq）に。q=βT/(DH)でトルク比例=高出力ほど危ない。幾何は誇張模式・力の合成は計算どおり。",
    component: AlfordForce,
    sample: {
      title: "ためし：偏心させると、直角の横押し力が現れる",
      eDefault: 0.6,
      tDefault: 0.7,
      caption: "偏心 e とトルクを動かすと、臙脂の「横押し力」が比例して育ちます。向きはいつも変位の90°先——前向き振れ回りを育てる向きです。",
    },
  },
  {
    name: "stability-chart",
    title: "安定性チャート（q–c 平面の安定マップ）",
    status: "stable",
    summary:
      "横軸c・縦軸qの平面を安定域(緑)/不安定域(臙脂)に塗り分け、境界 q=c と成長率σの等値線の上で運転点を動かす俯瞰図。対策（cを増やす/qを減らす）が地図上の移動として見える。whirl-instability と link で運転点を共有可。",
    component: StabilityChart,
    sample: {
      title: "ためし：境界 q = c をまたぐと判定が変わる",
      qDefault: 0.35,
      cDefault: 0.2,
      caption: "運転点を動かして境界をまたいでみてください。不安定側では、安定域へ戻る2つの道（右=減衰を増やす、下=qを減らす）が金の矢印で出ます。",
    },
  },
  {
    name: "transmissibility",
    title: "伝達率曲線（外部加振と防振）",
    status: "stable",
    summary:
      "外から来る揺れ／外へ伝える力が何倍になるかの伝達率 T=√(1+(2ζr)²)/√((1−r²)²+(2ζr)²)。r=√2 で全ての ζ が T=1 を通る金の交点、r>√2 の防振域では減衰を増やすとかえって悪化するパラドックスも見える。",
    component: Transmissibility,
    sample: {
      title: "ためし：√2 を境に、増幅と防振が入れ替わる",
      zetaDefault: 0.1,
      rDefault: 0.6,
      caption: "運転点 r を √2 の右へ動かすと「防振できている」に変わります。そこで ζ を上げると曲線が持ち上がる——防振域では減衰が邪魔をします。",
    },
  },
  {
    name: "whirl-instability",
    title: "自励振れ回りの不安定（クロスカップリング）",
    status: "stable",
    summary:
      "運動方程式を RK4 積分。変位に直角な力（クロスカップリング q）が減衰 c を超えると前向き振れ回りが発散。しきい値 q=c·ωn。オイルホワール/シール/アルフォードの共通機構。",
    component: WhirlInstability,
    sample: {
      title: "ためし：q が c を超えると渦巻きが発散する",
      qDefault: 0.15,
      cDefault: 0.25,
      caption: "q を上げて c を超えると、収束する渦巻き（安定）が発散する渦巻き（自励不安定）に変わります。色も赤に。",
    },
  },
  {
    name: "balancing",
    title: "1面バランシング（影響係数法）",
    status: "stable",
    summary:
      "振動フェーザとロータ正面の2画面で field balancing を体験。試しおもり1回で影響係数α=(V1−V0)/Tを求め、補正C=−V0/αで残留ゼロ。補正は『振動の真逆』ではなく位相ψぶんずれる。",
    component: Balancing,
    sample: {
      title: "ためし：試しおもり1回で補正を計算する",
      psiDefault: 60,
      caption: "試しおもりの大きさ・角度をどう選んでも、補正は同じ正解（重い点の真逆）に決まります。ψを動かすと振動の向きは回りますが補正の向きは不変。",
    },
  },
  {
    name: "vibration-gauge",
    title: "振動評価ゲージ（ISO 20816 流・ゾーンA〜D）",
    status: "stable",
    summary:
      "振動速度の実効値（mm/s RMS）をゾーンA〜Dで判定するものさし。機械の区分（大きさ・支持の硬さ）で境界が動くことも体感できる。境界値は代表例（模式）。",
    component: VibrationGauge,
    sample: {
      title: "ためし：針を動かすとゾーンの判定が変わる",
      vDefault: 3.2,
      caption: "スライダーで測定値を動かしてみてください。同じ振動でも、機械の区分を切り替えると判定が変わります——境界は「機械ごとのものさし」です。",
    },
  },
  {
    name: "balance-grade",
    title: "釣り合い品質等級 G（ISO 21940 流セレクタ）",
    status: "stable",
    summary:
      "等級Gと回転数から許容残留偏心 e=G×1000/Ω [μm] を読む。名物の log-log 線図（傾き−1の等級線の束）に運転点を打つ。高速機ほど許される偏心が小さい。",
    component: BalanceGrade,
    sample: {
      title: "ためし：同じ等級でも、速い機械ほど許容が小さい",
      gDefault: 2.5,
      rpmDefault: 3000,
      caption: "G2.5 の 3,000 rpm で約 8 μm。回転数を10倍にすると、許される偏心は 1/10 になります（対数図で傾き−1の直線）。",
    },
  },
  {
    name: "standards-map",
    title: "規格マップ（ロータの一生×ものさし）",
    status: "stable",
    summary:
      "「作る前にどれだけ釣り合わせる？」「動かして大丈夫？」「機種ごとの約束は？」の局面ごとに、効く規格（ISO 21940 / ISO 20816 / API）を地図的に示す。データ駆動・出典明記。",
    component: StandardsMap,
    sample: {
      title: "ためし：局面を選ぶと、効く規格が切り替わる",
      stages: [
        {
          label: "作る（釣り合わせ）",
          question: "作る前に——どれだけ釣り合わせれば十分？",
          lead: "完璧なゼロにはできないので、許してよい残留不釣り合いを「品質等級 G」で線引きする。回転数が高いほど厳しくなる。",
          standards: [
            {
              code: "ISO 21940-11",
              name: "回転体の機械的釣り合い／剛性ロータの釣り合い品質等級 G",
              use: "許容残留偏心 e_per ≈ G×1000 / Ω（Ωは角速度 rad/s）。G2.5 など等級で線引き（旧 ISO 1940-1）。",
            },
          ],
        },
        {
          label: "動かす（測って評価）",
          question: "動かしてから——この揺れは大丈夫？",
          lead: "振動速度などの実効値（RMS）を測り、新品域から損傷リスク域まで4つのゾーンで評価する。",
          standards: [
            {
              code: "ISO 20816",
              name: "機械振動の測定と評価",
              use: "実効値をゾーン A（新品）〜 D（損傷リスク）で評価。回転軸の振動と非回転部（軸受台）の両方。2016年に ISO 7919＋ISO 10816 を統合。",
            },
            {
              code: "API 670",
              name: "機械保護システム",
              use: "振動・軸位置などを常時監視し、しきい値で警報・停止する保護系の標準。",
            },
          ],
        },
        {
          label: "機種の約束",
          question: "この機械では——調達の基準は何？",
          lead: "発注者とメーカーの間で、許容振動値や試験方法を機種ごとに取り決める仕様書。",
          standards: [
            {
              code: "API 610 / 617 / 612",
              name: "遠心ポンプ／圧縮機／蒸気タービンの仕様",
              use: "機種別に許容振動・釣り合い・試験を規定。ISO を土台に、より厳しい契約値を置くことが多い。",
            },
          ],
        },
      ],
      caption: "番号と用途は概観のための模式です。実際の適用は各規格の最新版・該当パート・該当機種を確認してください。",
    },
  },
  {
    name: "two-plane-balancing",
    title: "2面バランシング（影響係数の行列）",
    status: "stable",
    summary:
      "2測定面×2修正面の影響係数行列 A（2×2複素）で V=A·W を連立で解く。試し2回でAの列が埋まり、W=−A⁻¹V0 で両面同時にゼロ。1面補正のみだと偶不釣り合い（逆相）で面2が悪化する対比が一目で分かる。",
    component: TwoPlaneBalancing,
    sample: {
      title: "ためし：1面では消えない不釣り合いが、2面なら両方ゼロに",
      psiDefault: 60,
      mixDefault: 1,
      caption: "「1面補正のみ」だと面1はゼロでも面2に残留（悪化することも）。「2面補正」に切り替えると両面ほぼゼロ。混合比0.5なら不釣り合いが面1に集中していて1面で足ります。",
    },
  },
  {
    name: "nomenclature",
    title: "記号一覧（nomenclature）",
    status: "stable",
    summary: "symbols.json から記号一覧を自動生成。本文の [[key]] ポップと同じ正典を使う。",
    component: Nomenclature,
    sample: { title: "記号一覧（※本編の節で記号データとともに表示）" },
  },
  {
    name: "blade-modes",
    title: "翼の固有モード（片持ちの 1F/2F/1T）",
    status: "experimental",
    summary: "片持ち翼のモード形と振動数比。叩いて測る→1F/2F/1T。",
    component: BladeModes,
    sample: { title: "ためし：翼の固有モード（片持ちの 1F/2F/1T）" },
  },
  {
    name: "blade-campbell",
    title: "翼のCampbell線図（遠心剛性化＋励起次数の扇）",
    status: "experimental",
    summary: "f²=f0²+κΩ² の固有振動数と EO 線の扇。運転範囲と余裕。",
    component: BladeCampbell,
    sample: { title: "ためし：翼のCampbell線図（遠心剛性化＋励起次数の扇）" },
  },
  {
    name: "excitation-harmonics",
    title: "励起の次数分解（ノズル後流・部分噴射）",
    status: "experimental",
    summary: "ノズル数と噴射弧からパルス列を作りフーリエ分解。どの次数が強いか。",
    component: ExcitationHarmonics,
    sample: { title: "ためし：励起の次数分解（ノズル後流・部分噴射）" },
  },
  {
    name: "nodal-diameter",
    title: "節直径（翼付き円盤のモード形）",
    status: "experimental",
    summary: "N 枚の翼に cos(nθ) のパターン。立つ波/走る波の再生。",
    component: NodalDiameter,
    sample: { title: "ためし：節直径（翼付き円盤のモード形）" },
  },
  {
    name: "traveling-wave",
    title: "進行波（静止系の固定パターンが回転系で走る）",
    status: "experimental",
    summary: "静止ノズル列のパターンを回転座標から見ると kΩ の進行波。",
    component: TravelingWave,
    sample: { title: "ためし：進行波（静止系の固定パターンが回転系で走る）" },
  },
  {
    name: "family-curves",
    title: "モード族の曲線（周波数 vs 節直径）",
    status: "experimental",
    summary: "円盤支配族と翼支配族、veering。bladedDisk.ts の 2×2 モデル。",
    component: FamilyCurves,
    sample: { title: "ためし：モード族の曲線（周波数 vs 節直径）" },
  },
  {
    name: "eo-folding",
    title: "励起次数の折り返し（空間エイリアシング）",
    status: "experimental",
    summary: "N 枚の翼が cos(kθ) をサンプリング。ND=fold(k,N) でジグザグが生まれる。",
    component: EoFolding,
    sample: { title: "ためし：励起次数の折り返し（空間エイリアシング）" },
  },
  {
    name: "zzenf",
    title: "ZZENF（SAFE）線図",
    status: "experimental",
    summary: "周波数 vs 節直径に族曲線とジグザグ励起線。共振の二重条件を判定。",
    component: Zzenf,
    sample: { title: "ためし：ZZENF（SAFE）線図" },
  },
  {
    name: "mistuning",
    title: "ミスチューニング（翼ごとのばらつきと応答の増幅）",
    status: "experimental",
    summary: "N 翼の周期鎖に乱数ばらつき。局在化と増幅率、Whitehead 限界。",
    component: Mistuning,
    sample: { title: "ためし：ミスチューニング（翼ごとのばらつきと応答の増幅）" },
  },
  {
    name: "friction-damper",
    title: "摩擦ダンパ（押し付け力と等価減衰）",
    status: "experimental",
    summary: "クーロン摩擦のヒステリシスと最適押し付け力。",
    component: FrictionDamper,
    sample: { title: "ためし：摩擦ダンパ（押し付け力と等価減衰）" },
  },
  {
    name: "haigh-diagram",
    title: "Haigh（Goodman）線図",
    status: "experimental",
    summary: "平均応力（遠心）と振動応力の組合せで疲労余裕を判定。",
    component: HaighDiagram,
    sample: { title: "ためし：Haigh（Goodman）線図" },
  },
  {
    name: "flutter",
    title: "フラッタ（空力減衰と翼間位相角）",
    status: "experimental",
    summary: "翼間位相角ごとの空力減衰。負になればフラッタ。",
    component: Flutter,
    sample: { title: "ためし：フラッタ（空力減衰と翼間位相角）" },
  },
  {
    name: "tip-timing",
    title: "ブレードチップタイミング（1回転1点のサンプリング）",
    status: "experimental",
    summary: "翼の通過時刻から振動を推定。エイリアシングと複数プローブ。",
    component: TipTiming,
    sample: { title: "ためし：ブレードチップタイミング（1回転1点のサンプリング）" },
  },
];

export function getBlock(name: string): BlockDef | undefined {
  return blocks.find((b) => b.name === name);
}

// 未登録ブロックの代替表示（壊さないための保険）。
export function UnknownBlock({ name }: { name: string }) {
  return (
    <div className="my-6 rounded-lg border border-dashed border-line bg-soft p-4 text-sm text-mut">
      <span className="font-ui">未登録のブロック：</span>
      <code className="font-ui text-ink">{name}</code>
      <span className="ml-1">（部品が見つからないため、ここは仮表示です）</span>
    </div>
  );
}
