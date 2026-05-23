import { createContext, useContext, useMemo } from "react";
import type { DiaryTheme } from "./types";
import { useDiaryStore } from "./hooks/useDiaryStore";

const DiaryContext = createContext<ReturnType<typeof useDiaryStore> | null>(null);

export const DiaryProvider = ({ children }: { children: React.ReactNode }) => {
  const store = useDiaryStore();
  const value = useMemo(() => store, [store]);

  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
};

export const useDiary = () => {
  const ctx = useContext(DiaryContext);
  if (!ctx) {
    throw new Error("useDiary must be used within DiaryProvider");
  }
  return ctx;
};

export const useDiaryTheme = (): DiaryTheme => {
  const { state } = useDiary();
  return state.theme;
};
