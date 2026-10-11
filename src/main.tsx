import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "katex/dist/katex.min.css";
import "./index.css";
import { setupOffline } from "./lib/offline";

// オフライン対応：service worker を登録（本文と部品は一度開けば圏外でも読める）
setupOffline();

// iOS Safari は viewport の user-scalable=no を無視するので、ピンチ操作そのものを止める（拡大しない前提の本）。
// gesturestart/gesturechange は Safari 独自、touchmove の scale は二本指のときだけ 1 以外になる。
const stopPinch = (e: Event) => e.preventDefault();
document.addEventListener("gesturestart", stopPinch, { passive: false });
document.addEventListener("gesturechange", stopPinch, { passive: false });
document.addEventListener(
  "touchmove",
  (e) => {
    const s = (e as TouchEvent & { scale?: number }).scale;
    if (s !== undefined && s !== 1) e.preventDefault();
  },
  { passive: false }
);

// GitHub Pages のサブパス配信でも壊れないよう HashRouter を採用（404.html 不要）。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
