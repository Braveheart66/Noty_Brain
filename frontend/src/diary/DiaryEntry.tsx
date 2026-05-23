import { useState, useRef } from "react";
import { motion } from "framer-motion";
import type { DiaryDay, DiaryMoment, Mood } from "./types";
import { useDiary } from "./DiaryProvider";
import { AttachmentManager } from "./AttachmentManager";
import { useSoundEffects } from "./hooks/useSoundEffects";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";

const moodMeta: Record<Mood, { emoji: string; label: string; color: string; rgb: string }> = {
  happy: { emoji: "😊", label: "HAPPY", color: "#f59e0b", rgb: "245,158,11" },
  neutral: { emoji: "😌", label: "MEH", color: "#6b7280", rgb: "107,114,128" },
  sad: { emoji: "😔", label: "SAD", color: "#3b82f6", rgb: "59,130,246" },
  excited: { emoji: "🤩", label: "EXCITED", color: "#ec4899", rgb: "236,72,153" },
  anxious: { emoji: "😬", label: "ANXIOUS", color: "#8b5cf6", rgb: "139,92,246" },
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
  const { playPenScratch } = useSoundEffects();

  // Auto-save indicator states
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<Record<string, number>>({});

  const handleAddEntry = () => {
    addEntry(day.date);
  };

  const handleUpdate = (entryId: string, patch: Partial<DiaryMoment>) => {
    updateEntry(day.date, entryId, patch);
  };

  const triggerSaveIndicator = (entryId: string) => {
    setSavingId(entryId);
    setSavedId(null);

    if (saveTimeoutRef.current[entryId]) {
      window.clearTimeout(saveTimeoutRef.current[entryId]);
    }

    saveTimeoutRef.current[entryId] = window.setTimeout(() => {
      setSavingId(null);
      setSavedId(entryId);
      
      saveTimeoutRef.current[entryId] = window.setTimeout(() => {
        setSavedId(null);
      }, 1500);
    }, 1500);
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

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Scratch sound on keys, skip modifier and functional keys
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      playPenScratch();
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2
            className="diary-title-glitch text-2xl font-bold"
            style={{ fontFamily: "var(--theme-font-heading)", color: "var(--theme-ink)" }}
            data-text={formatDayHeading(day.date)}
          >
            {formatDayHeading(day.date)}
          </h2>
          <p className="text-[10px] uppercase tracking-[0.3em] opacity-50">Daily Entry</p>
        </div>
        <button
          type="button"
          onClick={handleAddEntry}
          className="rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition hover:bg-black/5 active:scale-95"
          style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--theme-ink)" }}
        >
          Add Entry
        </button>
      </header>

      <div className="flex flex-col gap-6">
        {day.entries.map((entry) => {
          const locked = entry.locked;
          const isActive = activeEntryId === entry.id;
          const isSaving = savingId === entry.id;
          const isSaved = savedId === entry.id;

          return (
            <motion.section
              key={entry.id}
              className={`diary-entry-card p-5 ${isActive ? "active border-black/30" : "opacity-90"}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              onClick={() => setActiveEntryId(entry.id)}
            >
              {/* Title & Save indicator */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    className="w-full max-w-xs border-b border-black/10 bg-transparent text-xl font-semibold outline-none focus:border-black/30"
                    placeholder="Untitled"
                    value={entry.title}
                    onChange={(event) => {
                      handleUpdate(entry.id, { title: event.target.value });
                      triggerSaveIndicator(entry.id);
                    }}
                    style={{ fontFamily: "var(--theme-font-heading)", color: "var(--theme-ink)" }}
                    disabled={locked}
                  />
                  {isSaving && (
                    <span className="text-[9px] text-yellow-600 font-bold uppercase tracking-widest animate-pulse">
                      Saving...
                    </span>
                  )}
                  {isSaved && (
                    <span className="text-[9px] text-green-600 font-bold uppercase tracking-widest animate-pulse">
                      Saved ✓
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end text-[10px] opacity-60">
                  <span>Created {formatTimestamp(entry.createdAt)}</span>
                  <span>Edited {formatTimestamp(entry.updatedAt)}</span>
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  className={`min-h-[160px] w-full resize-none rounded-xl border border-black/10 p-4 text-sm leading-6 outline-none transition ${
                    locked ? "blur-sm" : ""
                  }`}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.25)",
                    fontFamily: "var(--theme-font-body)",
                    color: "var(--theme-ink)"
                  }}
                  placeholder="Write your thoughts..."
                  value={entry.body}
                  onChange={(event) => {
                    handleUpdate(entry.id, { body: event.target.value });
                    triggerSaveIndicator(entry.id);
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  data-entry-id={entry.id}
                  disabled={locked}
                />
                {locked && (
                  <div className="absolute inset-0 grid place-items-center text-sm font-semibold opacity-60 select-none">
                    Locked · Tap unlock to read
                  </div>
                )}
              </div>

              {/* Mood Strip Selection component */}
              <div className="mt-4 flex flex-col items-center gap-3 py-2 border-y border-black/5">
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] opacity-60">
                  HOW ARE YOU FEELING?
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {moodPalette.map((mood) => {
                    const selected = entry.mood === mood;
                    const meta = moodMeta[mood];
                    return (
                      <motion.button
                        key={mood}
                        type="button"
                        onClick={() => handleUpdate(entry.id, { mood })}
                        className="flex flex-col items-center justify-center w-[76px] py-2 rounded-lg border transition-all duration-250 select-none"
                        style={{
                          borderColor: selected ? meta.color : "rgba(0, 0, 0, 0.08)",
                          backgroundColor: selected ? `rgba(${meta.rgb}, 0.1)` : "transparent",
                          boxShadow: selected ? `0 0 10px rgba(${meta.rgb}, 0.2)` : "none",
                          opacity: selected ? 1 : 0.5,
                          color: "var(--theme-ink)"
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: selected ? 1.15 : 0.95 }}
                        animate={{
                          scale: selected ? 1.05 : 1,
                        }}
                        transition={{ type: "spring", stiffness: 350, damping: 16 }}
                        disabled={locked}
                      >
                        <motion.span
                          className="text-xl mb-0.5 block"
                          animate={{ scale: selected ? 1.2 : 1 }}
                          style={{ filter: selected ? "none" : "grayscale(75%)" }}
                        >
                          {meta.emoji}
                        </motion.span>
                        <span className="text-[8px] font-bold tracking-widest">{meta.label}</span>
                        {selected && (
                          <span className="h-1.5 w-1.5 rounded-full mt-1" style={{ backgroundColor: meta.color }} />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Attachment manager */}
              <AttachmentManager day={day} entry={entry} disabled={locked} />

              {/* Bottom Toolbar row */}
              <div className="diary-toolbar mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/90 px-4 py-2">
                {/* Format buttons with actual Lucide icons */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-black/60">
                  <span className="font-semibold">Format</span>
                  <FormatButton icon={Bold} format="**" targetId={entry.id} disabled={locked} />
                  <FormatButton icon={Italic} format="*" targetId={entry.id} disabled={locked} />
                  <FormatButton icon={Underline} format="_" targetId={entry.id} disabled={locked} />
                  <FormatButton icon={Strikethrough} format="~~" targetId={entry.id} disabled={locked} />
                </div>
                
                {/* Locking / Erasing */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLockToggle(entry)}
                    className="rounded-full border border-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:bg-black/5 active:scale-95 transition"
                  >
                    {entry.locked ? "Unlock" : "Lock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-full border border-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:bg-red-500/10 active:scale-95 transition"
                  >
                    Erase
                  </button>
                </div>
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
};

type FormatButtonProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  format?: string;
  targetId: string;
  disabled?: boolean;
};

const FormatButton = ({ icon: Icon, format = "**", targetId, disabled }: FormatButtonProps) => {
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
    
    // Toggle/apply format
    const next = `${before}${format}${selected || ""}${format}${after}`;
    
    // Simulate content change event to trigger saving
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeTextareaSetter) {
      nativeTextareaSetter.call(textarea, next);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    textarea.focus();
    const cursor = start + format.length + (selected || "").length;
    textarea.setSelectionRange(cursor, cursor);
  };

  return (
    <button
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/20 bg-white/70 hover:bg-white text-black/70 hover:text-black transition shadow-sm neon-glow-icon active:scale-90"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Format text"
    >
      <Icon size={16} />
    </button>
  );
};
