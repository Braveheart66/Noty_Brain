import { useMemo } from "react";
import { useDiary } from "./DiaryProvider";
import type { Mood } from "./types";

const moodColors: Record<Mood, string> = {
  happy: "bg-emerald-400",
  neutral: "bg-slate-400",
  sad: "bg-blue-400",
  excited: "bg-pink-400",
  anxious: "bg-amber-400",
};

const formatDateShort = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));

export const EntryIndex = () => {
  const { state } = useDiary();

  const rows = useMemo(() => {
    return state.days.flatMap((day) =>
      day.entries.map((entry) => ({
        id: entry.id,
        date: day.date,
        title: entry.title || "Untitled",
        mood: entry.mood,
        attachments: entry.attachments.length,
      })),
    );
  }, [state.days]);

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6">
        <h2 className="text-3xl" style={{ fontFamily: "var(--diary-font-heading)" }}>
          Index
        </h2>
        <p className="text-xs uppercase tracking-[0.3em] text-black/50">Table of contents</p>
      </header>

      <div className="flex-1 overflow-auto" style={{ fontFamily: "var(--diary-font-body)" }}>
        <div className="grid grid-cols-[110px_1fr_120px] gap-3 text-xs uppercase tracking-[0.25em] text-black/50">
          <span>Date</span>
          <span>Title</span>
          <span>Notes</span>
        </div>
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[110px_1fr_120px] gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2">
              <span className="text-sm">{formatDateShort(row.date)}</span>
              <span className="text-sm italic">{row.title}</span>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${moodColors[row.mood]}`} />
                <span className="text-xs text-black/60">{row.attachments} attachments</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em]"
        >
          Export as PDF
        </button>
        <span className="text-xs uppercase tracking-[0.3em] text-black/50">{rows.length} entries</span>
      </div>
    </div>
  );
};
