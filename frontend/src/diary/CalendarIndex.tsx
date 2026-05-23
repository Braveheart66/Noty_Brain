import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DiaryDay } from "./types";

const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

const moodColors: Record<string, string> = {
  happy: "#f59e0b",    // amber
  neutral: "#6b7280",  // gray
  sad: "#3b82f6",      // blue
  excited: "#ec4899",  // pink
  anxious: "#8b5cf6",  // purple
};

const formatMonthLabel = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);

const getMonthDays = (cursor: Date) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { startDay, daysInMonth };
};

export const CalendarIndex = ({
  open,
  days,
  onClose,
  onSelectDate,
}: {
  open: boolean;
  days: DiaryDay[];
  onClose: () => void;
  onSelectDate?: (date: string) => void;
}) => {
  const [monthCursor, setMonthCursor] = useState(new Date());

  const dayMap = useMemo(() => {
    const map = new Map<string, DiaryDay>();
    days.forEach((day) => map.set(day.date, day));
    return map;
  }, [days]);

  const { startDay, daysInMonth } = useMemo(() => getMonthDays(monthCursor), [monthCursor]);

  const cells = [] as Array<{ label: string; date?: string }>;
  for (let i = 0; i < startDay; i += 1) {
    cells.push({ label: "" });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day).toISOString().slice(0, 10);
    cells.push({ label: `${day}`, date });
  }

  const goMonth = (direction: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="diary-calendar-panel fixed left-0 top-0 z-40 h-full w-[280px] border-r shadow-2xl p-6 flex flex-col"
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          exit={{ x: -280 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          style={{
            background: "var(--theme-sidebar-bg)",
            borderColor: "rgba(0, 0, 0, 0.1)",
            color: "var(--theme-ink)",
            fontFamily: "var(--theme-font-ui)"
          }}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b pb-3" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
            <h3 className="text-sm font-bold uppercase tracking-[0.25em]">Calendar</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-2xl font-bold hover:opacity-70 transition flex items-center justify-center h-8 w-8 rounded-full hover:bg-black/5"
              aria-label="Close Calendar"
            >
              ×
            </button>
          </div>

          {/* Month Navigator */}
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="h-8 w-8 rounded-full hover:bg-black/5 flex items-center justify-center font-bold"
            >
              ◀
            </button>
            <span className="text-xs font-bold uppercase tracking-[0.15em]">{formatMonthLabel(monthCursor)}</span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="h-8 w-8 rounded-full hover:bg-black/5 flex items-center justify-center font-bold"
            >
              ▶
            </button>
          </div>

          {/* Weekdays Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold opacity-60">
            {weekdayLabels.map((label, idx) => (
              <div key={`${label}-${idx}`}>{label}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="mt-2 grid grid-cols-7 gap-1 overflow-y-auto pr-1">
            {cells.map((cell, index) => {
              if (!cell.date) {
                return <div key={`empty-${index}`} className="h-9" />;
              }
              const day = dayMap.get(cell.date);
              const mood = day?.entries[0]?.mood || "neutral";
              const hasAttachments = day?.entries.some((entry) => entry.attachments.length > 0);

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => {
                    onSelectDate?.(cell.date!);
                    onClose(); // Automatically close calendar on selection
                  }}
                  className="flex h-10 flex-col items-center justify-center rounded-lg border transition text-xs font-semibold relative"
                  style={{
                    borderColor: "rgba(0, 0, 0, 0.05)",
                    background: "rgba(255, 255, 255, 0.15)",
                  }}
                >
                  <span className="opacity-90">{cell.label}</span>
                  <div className="mt-0.5 flex items-center gap-0.5">
                    {day && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: moodColors[mood] }}
                        title={`Mood: ${mood}`}
                      />
                    )}
                    {hasAttachments && <span className="text-[8px]" title="Contains media">📎</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
