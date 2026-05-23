import { useMemo } from "react";
import { useDiary } from "./DiaryProvider";
import type { Mood } from "./types";

const moodColors: Record<Mood, string> = {
  happy: "bg-[#f59e0b]",    // amber
  neutral: "bg-[#6b7280]",  // gray
  sad: "bg-[#3b82f6]",      // blue
  excited: "bg-[#ec4899]",  // pink
  anxious: "bg-[#8b5cf6]",  // purple
};

const formatDateShort = (value: string) => {
  try {
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  } catch {
    return value;
  }
};

export const EntryIndex = ({ onSelectDate }: { onSelectDate?: (date: string) => void }) => {
  const { state } = useDiary();

  const rows = useMemo(() => {
    return state.days.flatMap((day) =>
      day.entries.map((entry) => ({
        id: entry.id,
        date: day.date,
        title: entry.title || "Untitled",
        mood: entry.mood,
        attachments: entry.attachments ? entry.attachments.length : 0,
      })),
    );
  }, [state.days]);

  // Sparkline of the last 7 entries
  const last7Moods = useMemo(() => {
    return rows.slice(-7).map(r => r.mood);
  }, [rows]);

  return (
    <div className="flex h-full flex-col" style={{ color: "var(--theme-ink)" }}>
      {/* Header */}
      <header className="mb-4">
        <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--theme-font-heading)" }}>
          Index
        </h2>
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-60">
          TABLE OF CONTENTS
        </p>
      </header>

      {/* Mood History Sparkline */}
      <div 
        className="flex items-center gap-3 mb-4 p-2.5 rounded-xl border"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderColor: "rgba(0, 0, 0, 0.08)"
        }}
      >
        <span className="text-[9px] uppercase tracking-[0.2em] font-semibold opacity-70">7-Day Mood Trend:</span>
        <div className="flex gap-1.5">
          {last7Moods.map((mood, idx) => (
            <span 
              key={`${mood}-${idx}`} 
              className={`h-2.5 w-2.5 rounded-full ${moodColors[mood]} shadow-[0_1px_3px_rgba(0,0,0,0.15)]`} 
              title={`Mood: ${mood}`} 
            />
          ))}
          {last7Moods.length === 0 && <span className="text-[9px] italic opacity-50">No entries yet</span>}
        </div>
      </div>

      {/* Table grid */}
      <div className="flex-1 overflow-auto pr-1" style={{ fontFamily: "var(--theme-font-body)" }}>
        {/* Column Headers */}
        <div 
          className="grid grid-cols-[80px_1fr_60px_60px] gap-2 pb-2 mb-2 border-b text-[10px] uppercase tracking-[0.2em] font-bold opacity-60"
          style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}
        >
          <span>Date</span>
          <span>Title</span>
          <span className="text-center">Mood</span>
          <span className="text-right">Notes</span>
        </div>

        {/* Content Rows */}
        <div className="space-y-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectDate?.(row.date)}
              className="w-full text-left grid grid-cols-[80px_1fr_60px_60px] gap-2 items-center rounded-lg border px-3 py-2 hover:bg-black/5 active:scale-[0.99] transition duration-150 select-none"
              style={{
                borderColor: "rgba(0, 0, 0, 0.06)",
                background: "rgba(255, 255, 255, 0.15)"
              }}
            >
              <span className="text-xs font-semibold">{formatDateShort(row.date)}</span>
              <span className="text-xs italic truncate pr-2">{row.title}</span>
              <div className="flex justify-center">
                <span className={`h-2.5 w-2.5 rounded-full ${moodColors[row.mood]} shadow-sm`} title={row.mood} />
              </div>
              <span className="text-[10px] text-right opacity-70">
                {row.attachments} 📎
              </span>
            </button>
          ))}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
              <span className="text-3xl mb-2">✍️</span>
              <p className="text-xs uppercase tracking-wider font-semibold">No entries yet — start writing!</p>
            </div>
          )}
        </div>
      </div>

      {/* Export / Footer */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.2em] hover:bg-black/5 active:scale-95 transition"
          style={{ borderColor: "rgba(0, 0, 0, 0.15)" }}
        >
          Export as PDF
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-semibold">{rows.length} entries</span>
      </div>
    </div>
  );
};
