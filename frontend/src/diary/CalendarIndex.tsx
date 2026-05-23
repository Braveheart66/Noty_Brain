import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DiaryDay } from "./types";

const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

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
          className="diary-calendar-panel fixed left-0 top-0 z-40 h-full w-80 border-r border-black/20 bg-black/70 p-6 text-white"
          initial={{ x: -320 }}
          animate={{ x: 0 }}
          exit={{ x: -320 }}
          transition={{ type: "spring", stiffness: 180, damping: 20 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-[0.3em]">Calendar</h3>
            <button type="button" onClick={onClose} className="text-white/70">Close</button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={() => goMonth(-1)} className="text-white/70">◀</button>
            <span className="text-sm uppercase tracking-[0.2em]">{formatMonthLabel(monthCursor)}</span>
            <button type="button" onClick={() => goMonth(1)} className="text-white/70">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs text-white/70">
            {weekdayLabels.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {cells.map((cell, index) => {
              if (!cell.date) {
                return <div key={`empty-${index}`} />;
              }
              const day = dayMap.get(cell.date);
              const hasAttachments = day?.entries.some((entry) => entry.attachments.length > 0);

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onSelectDate?.(cell.date!)}
                  className="flex h-9 flex-col items-center justify-center rounded-lg border border-white/10 text-xs text-white/90 hover:border-white/40"
                >
                  <span>{cell.label}</span>
                  <div className="mt-1 flex items-center gap-1">
                    {day && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    {hasAttachments && <span>📷</span>}
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
