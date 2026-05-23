import { useState } from "react";
import { motion } from "framer-motion";
import type { DiaryDay, DiaryMoment, Mood } from "./types";
import { useDiary } from "./DiaryProvider";
import { AttachmentManager } from "./AttachmentManager";

const moodIcons: Record<Mood, string> = {
  happy: "😊",
  neutral: "😌",
  sad: "😔",
  excited: "🤩",
  anxious: "😬",
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${datePart} · ${timePart}`;
};

const formatDayHeading = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
};

export const DiaryEntry = ({ day }: { day: DiaryDay }) => {
  const { addEntry, updateEntry, deleteEntry, setPin, verifyPin, moodPalette } = useDiary();
  const [activeEntryId, setActiveEntryId] = useState<string | null>(day.entries[0]?.id ?? null);

  const handleAddEntry = () => {
    addEntry(day.date);
  };

  const handleUpdate = (entryId: string, patch: Partial<DiaryMoment>) => {
    updateEntry(day.date, entryId, patch);
  };

  const handleDelete = (entryId: string) => {
    if (day.entries.length === 1) {
      return;
    }
    deleteEntry(day.date, entryId);
  };

  const handleLockToggle = async (entry: DiaryMoment) => {
    if (!entry.locked) {
      const pin = window.prompt("Set a 4-digit PIN to lock this entry");
      if (!pin) {
        return;
      }
      await setPin(pin);
      handleUpdate(entry.id, { locked: true });
      return;
    }

    const unlock = window.prompt("Enter PIN to unlock");
    if (!unlock) {
      return;
    }
    const verified = await verifyPin(unlock);
    if (verified) {
      handleUpdate(entry.id, { locked: false });
    } else {
      window.alert("Incorrect PIN.");
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2
            className="diary-title-glitch text-2xl"
            style={{ fontFamily: "var(--diary-font-heading)" }}
            data-text={formatDayHeading(day.date)}
          >
            {formatDayHeading(day.date)}
          </h2>
          <p className="text-xs uppercase tracking-[0.3em] text-black/50">Daily Entry</p>
        </div>
        <button
          type="button"
          onClick={handleAddEntry}
          className="rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/70 transition hover:border-black/40"
        >
          Add Entry
        </button>
      </header>

      <div className="flex flex-col gap-6">
        {day.entries.map((entry) => {
          const locked = entry.locked;
          return (
            <motion.section
              key={entry.id}
              className={`rounded-2xl border p-5 shadow-paper-lift ${
                activeEntryId === entry.id ? "border-black/40 bg-white" : "border-black/10 bg-white/70"
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              onClick={() => setActiveEntryId(entry.id)}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <input
                  className="w-full max-w-xs border-b border-black/20 bg-transparent text-xl font-semibold outline-none"
                  placeholder="Untitled"
                  value={entry.title}
                  onChange={(event) => handleUpdate(entry.id, { title: event.target.value })}
                  style={{ fontFamily: "var(--diary-font-heading)" }}
                  disabled={locked}
                />
                <div className="flex items-center gap-2 text-xs text-black/60">
                  <span>{formatTimestamp(entry.createdAt)}</span>
                  <span>·</span>
                  <span>Edited {formatTimestamp(entry.updatedAt)}</span>
                </div>
              </div>

              <div className="relative">
                <textarea
                  className={`min-h-[160px] w-full resize-none rounded-xl border border-black/10 bg-white/80 p-4 text-sm leading-6 outline-none transition ${
                    locked ? "blur-sm" : ""
                  }`}
                  placeholder="Write your thoughts..."
                  value={entry.body}
                  onChange={(event) => handleUpdate(entry.id, { body: event.target.value })}
                  data-entry-id={entry.id}
                  disabled={locked}
                  style={{ fontFamily: "var(--diary-font-body)" }}
                />
                {locked && (
                  <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-black/60">
                    Locked · Tap unlock to read
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-black/50">Mood</span>
                {moodPalette.map((mood) => (
                  <motion.button
                    key={mood}
                    type="button"
                    onClick={() => handleUpdate(entry.id, { mood })}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      entry.mood === mood
                        ? "border-black/60 bg-black/10"
                        : "border-black/20 hover:border-black/40"
                    }`}
                    disabled={locked}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="text-lg">{moodIcons[mood]}</span>
                  </motion.button>
                ))}
              </div>

              <AttachmentManager day={day} entry={entry} disabled={locked} />

              <div className="diary-toolbar mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/90 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-black/50">
                  <span>Formatting</span>
                  <FormatButton label="B" onApply={(value) => handleUpdate(entry.id, { body: value })} targetId={entry.id} disabled={locked} />
                  <FormatButton label="I" format="*" onApply={(value) => handleUpdate(entry.id, { body: value })} targetId={entry.id} disabled={locked} />
                  <FormatButton label="U" format="_" onApply={(value) => handleUpdate(entry.id, { body: value })} targetId={entry.id} disabled={locked} />
                  <FormatButton label="S" format="~~" onApply={(value) => handleUpdate(entry.id, { body: value })} targetId={entry.id} disabled={locked} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.querySelector(
                        `input[type='file'][data-entry-id='${entry.id}']`,
                      ) as HTMLInputElement | null;
                      input?.click();
                    }}
                    className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em]"
                    disabled={locked}
                  >
                    Attach
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLockToggle(entry)}
                    className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em]"
                  >
                    {entry.locked ? "Unlock" : "Lock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em]"
                  >
                    Erase
                  </button>
                </div>
              </div>
            </motion.section>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between text-xs uppercase tracking-[0.3em] text-black/50">
        <span>Diary Entry</span>
        <span>{day.entries.length} notes</span>
      </div>
    </div>
  );
};

type FormatButtonProps = {
  label: string;
  format?: string;
  targetId: string;
  onApply: (value: string) => void;
  disabled?: boolean;
};

const FormatButton = ({ label, format = "**", targetId, onApply, disabled }: FormatButtonProps) => {
  const handleClick = () => {
    const textarea = document.querySelector(`textarea[data-entry-id='${targetId}']`) as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const next = `${before}${format}${selected || label}${format}${after}`;
    onApply(next);
    textarea.focus();
    const cursor = start + format.length + (selected || label).length + format.length;
    textarea.setSelectionRange(cursor, cursor);
  };

  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-black/20 bg-white/70 font-semibold"
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Format ${label}`}
    >
      {label}
    </button>
  );
};
