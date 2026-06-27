import { NavLink, Route, Routes } from "react-router-dom";
import clsx from "clsx";
import { Wordmark } from "./components/Wordmark";
import Home from "./pages/Home";
import Reader from "./pages/Reader";
import Gallery from "./pages/Gallery";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx(
          "px-2 py-1.5 text-sm transition-colors sm:px-3",
          isActive ? "text-accent" : "text-mut hover:text-ink"
        )
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
          <NavLink to="/" className="text-lg sm:text-xl">
            <Wordmark />
          </NavLink>
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <NavItem to="/">ホーム</NavItem>
            <NavItem to="/read">読む</NavItem>
            <NavItem to="/gallery">お試し場</NavItem>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/read" element={<Reader />} />
          <Route path="/read/:sectionId" element={<Reader />} />
          <Route path="/gallery" element={<Gallery />} />
        </Routes>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-5 text-sm text-mut">
          <Wordmark className="text-base" /> — 生きている知識の地図帳 / An Interactive Textbook
        </div>
      </footer>
    </div>
  );
}
