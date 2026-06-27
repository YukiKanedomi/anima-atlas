import { useCallback, useRef, useSyncExternalStore } from "react";

// 連動ビューの土台：名前付きグループでスカラーのパラメータを共有する。
// ブロックが config.link に同じグループ名を持てば、片方を動かすと両方が更新される。
// link を持たないブロックは「自分専用の使い捨てグループ」になり、従来どおり独立して動く。

type Group = {
  vals: Record<string, number>;
  version: number;
  listeners: Set<() => void>;
};

const groups = new Map<string, Group>();

function getGroup(id: string): Group {
  let g = groups.get(id);
  if (!g) {
    g = { vals: {}, version: 0, listeners: new Set() };
    groups.set(id, g);
  }
  return g;
}

let _uid = 0;
// インスタンスごとに安定した一意ID（link 未指定時の自分専用グループ用）。
export function useInstanceId(prefix: string): string {
  const ref = useRef<string>();
  if (!ref.current) ref.current = `${prefix}-${_uid++}`;
  return ref.current;
}

export function useSharedParams(
  groupId: string,
  defaults: Record<string, number>
): [Record<string, number>, (key: string, v: number) => void] {
  const g = getGroup(groupId);

  // 既定値の種まき（未設定キーのみ・冪等）。最初に描画したブロックが種をまく。
  for (const k in defaults) {
    if (!(k in g.vals)) g.vals[k] = defaults[k];
  }

  const subscribe = useCallback(
    (l: () => void) => {
      g.listeners.add(l);
      return () => g.listeners.delete(l);
    },
    [g]
  );
  const getVersion = useCallback(() => g.version, [g]);
  useSyncExternalStore(subscribe, getVersion, getVersion);

  const set = useCallback(
    (key: string, v: number) => {
      g.vals = { ...g.vals, [key]: v };
      g.version++;
      g.listeners.forEach((l) => l());
    },
    [g]
  );

  return [g.vals, set];
}
