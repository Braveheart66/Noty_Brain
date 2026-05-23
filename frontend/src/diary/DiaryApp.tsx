import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DiaryProvider, useDiary } from "./DiaryProvider";
import type { DiaryTheme } from "./types";
import { DiaryCover } from "./DiaryCover";
import { DiaryBook } from "./DiaryBook";
import { ThemeSwitcher } from "./ThemeSwitcher";
import "./diary.css";

const DiaryShell = () => {
  const { state, ensureDay, setTheme, setTitle } = useDiary();
  const [isOpen, setIsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeClosing, setThemeClosing] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<DiaryTheme | null>(null);

  useEffect(() => {
    const today = new Date();
    const date = today.toISOString().slice(0, 10);
    ensureDay(date);
  }, [ensureDay]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setThemeOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pages = useMemo(() => {
    return [
      { type: "index" as const },
      ...state.days.map((day) => ({ type: "day" as const, date: day.date, day })),
    ];
  }, [state.days]);

  const handleThemePick = useCallback(
    (theme: DiaryTheme) => {
      if (theme === state.theme) {
        return;
      }
      setPendingTheme(theme);
      setThemeClosing(true);
      window.setTimeout(() => {
        setTheme(theme);
        window.setTimeout(() => {
          setThemeClosing(false);
          setPendingTheme(null);
        }, 400);
      }, 400);
    },
    [setTheme, state.theme],
  );

  return (
    <div
      className="diary-root min-h-screen w-full px-4 py-6 md:px-10"
      data-theme={state.theme}
      style={{ fontFamily: "var(--diary-font-ui)" }}
    >
      <DiaryCover
        isOpen={isOpen}
        title={state.title}
        year={state.year}
        onTitleChange={(title) => setTitle(title)}
        onOpen={() => setIsOpen(true)}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="relative mx-auto mt-4 max-w-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <DiaryBook
              pages={pages}
              calendarOpen={calendarOpen}
              onToggleCalendar={() => setCalendarOpen((current) => !current)}
              onBackToCover={() => setIsOpen(false)}
            />
            <ThemeSwitcher
              currentTheme={state.theme}
              onSelectTheme={handleThemePick}
              open={themeOpen}
              onToggle={() => setThemeOpen((value) => !value)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {themeClosing && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 h-[70vh] w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-[32px]"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 90 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "left center",
                background: "var(--diary-bg)",
              }}
            />
            {pendingTheme && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/80">
                Switching to {pendingTheme} theme...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DiaryApp = () => (
  <DiaryProvider>
    <DiaryShell />
  </DiaryProvider>
);

export default DiaryApp;
