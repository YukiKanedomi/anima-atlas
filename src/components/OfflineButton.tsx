import { useEffect, useRef, useState } from "react";
import { saveAllForOffline, type SaveProgress } from "../lib/offline";

// 「図もオフラインに保存」ボタン。本文は service worker が自動で持つので、ここで落とすのは写真・小図だけ。
// 一度終えたら localStorage に印を付け、以後は「保存済み」と出す（取り直しはもう一度押す）。
const KEY = "aa-offline-images";

export function OfflineButton({ bookDir }: { bookDir: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(() => {
    try {
      return localStorage.getItem(KEY) === "1" ? "done" : "idle";
    } catch {
      return "idle";
    }
  });
  const [prog, setProg] = useState<SaveProgress | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  const run = async () => {
    abort.current = new AbortController();
    setState("running");
    try {
      const p = await saveAllForOffline(bookDir, setProg, abort.current.signal);
      if (p.failed > 0 && p.done === p.failed) {
        setState("error");
      } else {
        setState("done");
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          // 記憶できなくても動作は妨げない
        }
      }
    } catch {
      setState("error");
    }
  };

  const label =
    state === "running"
      ? prog
        ? `図を保存中 ${prog.done}/${prog.total}`
        : "図を保存中…"
      : state === "done"
      ? "図もオフライン保存済み（再保存）"
      : state === "error"
      ? "保存に失敗（再試行）"
      : "図もオフラインに保存";

  return (
    <button
      onClick={state === "running" ? undefined : run}
      disabled={state === "running"}
      title="本文は開いた時点で自動的に端末に残ります。写真と小図（約 15MB）もまとめて残すときに押してください。"
      className={
        "rounded-full border px-3 py-1 text-xs transition-colors " +
        (state === "done"
          ? "border-accent bg-accent/10 text-accent"
          : "border-line bg-white text-mut hover:border-accent hover:text-accent disabled:opacity-60")
      }
    >
      {label}
    </button>
  );
}
