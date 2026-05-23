import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DiaryTheme } from "./types";

const themes: Array<{ id: DiaryTheme; label: string; swatch: string; mockupClass: string }> = [
  { id: "vintage", label: "Vintage Leather", swatch: "#8b6914", mockupClass: "theme-mockup-vintage" },
  { id: "neon", label: "Neon Nights", swatch: "#ff2d78", mockupClass: "theme-mockup-neon" },
  { id: "cottage", label: "Cottagecore Bloom", swatch: "#7d9e6b", mockupClass: "theme-mockup-cottage" },
  { id: "studio", label: "Studio Minimal", swatch: "#c0392b", mockupClass: "theme-mockup-studio" },
];

export const ThemeSwitcher = ({
  currentTheme,
  onSelectTheme,
  open: controlledOpen,
  onToggle,
}: {
  currentTheme: DiaryTheme;
  onSelectTheme: (theme: DiaryTheme) => void;
  open?: boolean;
  onToggle?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const visible = isControlled ? controlledOpen : open;

  const toggle = () => {
    if (isControlled) {
      onToggle?.();
      return;
    }
    setOpen((value) => !value);
  };

  const close = () => {
    if (isControlled) {
      if (visible) {
        onToggle?.();
      }
      return;
    }
    setOpen(false);
  };

  return (
    <>
      {/* Palette Trigger Button */}
      <div className="diary-theme-switcher fixed bottom-6 right-6 z-30">
        <button
          type="button"
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/80 hover:bg-black text-white text-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
          aria-label="Toggle Theme Drawer"
        >
          🎨
        </button>
      </div>

      <AnimatePresence>
        {visible && (
          <>
            {/* Backdrop Blur Overlay */}
            <motion.div
              className="theme-switcher-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            {/* Slide-Up Drawer */}
            <motion.div
              className="theme-switcher-drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
            >
              <div className="mx-auto max-w-4xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white">Choose Theme Skin</h3>
                    <p className="text-[10px] text-white/50 tracking-wider">Skins control cover art, page layout, ink, fonts, and attachments layout</p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white text-lg font-semibold transition"
                  >
                    ×
                  </button>
                </div>

                {/* 4 Theme Preview Cards */}
                <div className="grid grid-cols-4 gap-4">
                  {themes.map((theme) => {
                    const isActive = currentTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          onSelectTheme(theme.id);
                          close();
                        }}
                        className={`group flex flex-col rounded-xl border p-3 text-left transition duration-200 ${
                          isActive
                            ? "border-white bg-white/10"
                            : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/8"
                        }`}
                      >
                        {/* Mockup CSS Page Preview Thumbnail */}
                        <div className={`theme-mockup ${theme.mockupClass}`} />

                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[11px] uppercase tracking-[0.15em] ${isActive ? "font-bold text-white" : "text-white/70"}`}>
                            {theme.label}
                          </span>
                          {isActive && <span className="text-xs text-white">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
