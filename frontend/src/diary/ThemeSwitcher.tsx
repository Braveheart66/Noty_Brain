import { useState } from "react";
import type { DiaryTheme } from "./types";

const themes: Array<{ id: DiaryTheme; label: string; swatch: string }> = [
  { id: "vintage", label: "Vintage Leather", swatch: "#8b6914" },
  { id: "neon", label: "Neon Nights", swatch: "#ff2d78" },
  { id: "cottage", label: "Cottagecore Bloom", swatch: "#7d9e6b" },
  { id: "studio", label: "Studio Minimal", swatch: "#c0392b" },
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

  return (
    <div className="diary-theme-switcher fixed bottom-6 right-6 z-30">
      <button
        type="button"
        onClick={toggle}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white"
      >
        🎨
      </button>

      {visible && (
        <div className="mt-3 w-52 rounded-2xl border border-white/20 bg-black/70 p-4 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Themes</p>
          <div className="mt-3 space-y-2">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => onSelectTheme(theme.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs uppercase tracking-[0.2em] transition ${
                  currentTheme === theme.id ? "border-white/70" : "border-white/20"
                }`}
              >
                <span>{theme.label}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: theme.swatch }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
