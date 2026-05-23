import { createContext, useContext, useEffect, useMemo } from "react";
import type { DiaryTheme } from "./types";
import { useDiaryStore } from "./hooks/useDiaryStore";

const DiaryContext = createContext<ReturnType<typeof useDiaryStore> | null>(null);

export const DiaryProvider = ({ children }: { children: React.ReactNode }) => {
  const store = useDiaryStore();
  const value = useMemo(() => store, [store]);

  useEffect(() => {
    const unlock = () => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        ctx.resume().then(() => ctx.close());
      }
      window.removeEventListener("click", unlock);
    };
    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
  }, []);

  useEffect(() => {
    const theme = store.state.theme;
    document.documentElement.setAttribute("data-theme", theme);
    const themeFonts = {
      vintage: {
        heading: "'Playfair Display', Georgia, serif",
        body: "'IM Fell English', serif",
        ui: "'Playfair Display SC', serif"
      },
      neon: {
        heading: "'Orbitron', monospace",
        body: "'Share Tech Mono', monospace",
        ui: "'JetBrains Mono', monospace"
      },
      cottage: {
        heading: "'Caveat', cursive",
        body: "'Lora', serif",
        ui: "'Caveat', cursive"
      },
      studio: {
        heading: "'Cormorant Garamond', serif",
        body: "'DM Sans', sans-serif",
        ui: "'DM Sans', sans-serif"
      }
    };
    const fonts = themeFonts[theme as keyof typeof themeFonts];
    if (fonts) {
      document.documentElement.style.setProperty("--theme-font-heading", fonts.heading);
      document.documentElement.style.setProperty("--theme-font-body", fonts.body);
      document.documentElement.style.setProperty("--theme-font-ui", fonts.ui);
      document.documentElement.style.fontFamily = fonts.ui;
    }
  }, [store.state.theme]);

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
