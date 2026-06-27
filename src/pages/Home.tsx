import { Link } from "react-router-dom";
import { Wordmark } from "../components/Wordmark";

export default function Home() {
  return (
    <div className="mx-auto max-w-content">
      <p className="font-ui text-sm tracking-widest text-accent">
        AN INTERACTIVE TEXTBOOK
      </p>
      <h1 className="mt-2 text-4xl leading-tight text-ink">
        <Wordmark className="text-4xl" />
      </h1>
      <p className="mt-3 text-lg text-mut">生きている知識の地図帳。</p>

      <p className="mt-6 leading-8 text-ink/90">
        読むだけの教科書ではありません。短い解説に、<strong className="font-semibold">触って動かせる図</strong>
        を組み合わせて、「なぜそうなるか」を手で確かめながら理解していく——
        紙にはできない学び方を目指した、育てていくデジタル教科書です。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/read"
          className="rounded-lg border border-line bg-white p-5 shadow-card transition-colors hover:border-accent"
        >
          <div className="font-serif text-lg text-ink">ロータダイナミクス</div>
          <div className="mt-1 text-sm text-mut">
            回転機械の振動を、触って理解する。まずは1節から。
          </div>
          <div className="mt-3 text-sm text-accent">読む →</div>
        </Link>

        <Link
          to="/gallery"
          className="rounded-lg border border-line bg-white p-5 shadow-card transition-colors hover:border-accent"
        >
          <div className="font-serif text-lg text-ink">お試し場（部品ギャラリ）</div>
          <div className="mt-1 text-sm text-mut">
            動く図の「部品」を並べて見比べる、実験の場。
          </div>
          <div className="mt-3 text-sm text-accent">のぞく →</div>
        </Link>
      </div>

      <p className="mt-10 text-sm leading-7 text-mut">
        嘘をつかないことを大切にしています。図・式・内容は正確に。概念図には「模式」と明記し、出典をつけ、捏造はしません。
      </p>
    </div>
  );
}
