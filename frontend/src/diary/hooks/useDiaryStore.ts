import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiaryAttachment, DiaryDay, DiaryMoment, DiaryState, DiaryTheme, Mood } from "../types";

const STORAGE_KEY = "noty-diary";

const DEFAULT_STATE: DiaryState = {
  title: "My Personal Diary",
  year: new Date().getFullYear(),
  theme: "vintage",
  days: [],
  pinHash: null,
};

const moodOptions: Mood[] = ["happy", "neutral", "sad", "excited", "anxious"];

const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const byDateAsc = (left: DiaryDay, right: DiaryDay) => left.date.localeCompare(right.date);

const createMoment = (): DiaryMoment => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    body: "",
    createdAt: now,
    updatedAt: now,
    mood: "neutral",
    attachments: [],
    locked: false,
  };
};

const normalizeState = (raw: DiaryState): DiaryState => {
  const days = Array.isArray(raw.days) ? raw.days : [];
  return {
    ...DEFAULT_STATE,
    ...raw,
    days: days
      .map((day) => ({
        date: day.date,
        entries: Array.isArray(day.entries) && day.entries.length > 0 ? day.entries : [createMoment()],
      }))
      .sort(byDateAsc),
  };
};

export const useDiaryStore = () => {
  const [state, setState] = useState<DiaryState>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_STATE;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_STATE;
    }
    try {
      const parsed = JSON.parse(stored) as DiaryState;
      return normalizeState(parsed);
    } catch {
      return DEFAULT_STATE;
    }
  });

  const saveTimeout = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const scheduleSave = useCallback(() => {
    if (saveTimeout.current) {
      window.clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveTimeout.current = null;
    }, 1500);
  }, [state]);

  const setTheme = useCallback((theme: DiaryTheme) => {
    setState((current) => ({ ...current, theme }));
  }, []);

  const setTitle = useCallback((title: string) => {
    setState((current) => ({ ...current, title }));
  }, []);

  const ensureDay = useCallback((date: string) => {
    setState((current) => {
      const existing = current.days.find((day) => day.date === date);
      if (existing) {
        return current;
      }
      return {
        ...current,
        days: [...current.days, { date, entries: [createMoment()] }].sort(byDateAsc),
      };
    });
  }, []);

  const addEntry = useCallback((date: string) => {
    setState((current) => {
      const days = current.days.map((day) => {
        if (day.date !== date) {
          return day;
        }
        return { ...day, entries: [...day.entries, createMoment()] };
      });
      return { ...current, days };
    });
  }, []);

  const updateEntry = useCallback((date: string, entryId: string, patch: Partial<DiaryMoment>) => {
    setState((current) => {
      const days = current.days.map((day) => {
        if (day.date !== date) {
          return day;
        }
        return {
          ...day,
          entries: day.entries.map((entry) =>
            entry.id === entryId ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry,
          ),
        };
      });
      return { ...current, days };
    });
    scheduleSave();
  }, [scheduleSave]);

  const deleteEntry = useCallback((date: string, entryId: string) => {
    setState((current) => {
      const days = current.days.map((day) => {
        if (day.date !== date) {
          return day;
        }
        const remaining = day.entries.filter((entry) => entry.id !== entryId);
        return { ...day, entries: remaining.length > 0 ? remaining : [createMoment()] };
      });
      return { ...current, days };
    });
  }, []);

  const addAttachment = useCallback((date: string, entryId: string, attachment: DiaryAttachment) => {
    setState((current) => {
      const days = current.days.map((day) => {
        if (day.date !== date) {
          return day;
        }
        return {
          ...day,
          entries: day.entries.map((entry) =>
            entry.id === entryId
              ? { ...entry, attachments: [...entry.attachments, attachment], updatedAt: new Date().toISOString() }
              : entry,
          ),
        };
      });
      return { ...current, days };
    });
  }, []);

  const removeAttachment = useCallback((date: string, entryId: string, attachmentId: string) => {
    setState((current) => {
      const days = current.days.map((day) => {
        if (day.date !== date) {
          return day;
        }
        return {
          ...day,
          entries: day.entries.map((entry) =>
            entry.id === entryId
              ? { ...entry, attachments: entry.attachments.filter((item) => item.id !== attachmentId) }
              : entry,
          ),
        };
      });
      return { ...current, days };
    });
  }, []);

  const updateAttachment = useCallback(
    (date: string, entryId: string, attachmentId: string, patch: Partial<DiaryAttachment>) => {
      setState((current) => {
        const days = current.days.map((day) => {
          if (day.date !== date) {
            return day;
          }
          return {
            ...day,
            entries: day.entries.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    attachments: entry.attachments.map((item) =>
                      item.id === attachmentId ? { ...item, ...patch } : item,
                    ),
                  }
                : entry,
            ),
          };
        });
        return { ...current, days };
      });
    },
    [],
  );

  const setPin = useCallback(async (pin: string) => {
    const hashed = await hashPin(pin);
    setState((current) => ({ ...current, pinHash: hashed }));
  }, []);

  const verifyPin = useCallback(async (pin: string) => {
    if (!state.pinHash) {
      return false;
    }
    const hashed = await hashPin(pin);
    return hashed === state.pinHash;
  }, [state.pinHash]);

  const moodPalette = useMemo(() => moodOptions, []);

  const forceSave = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return {
    state,
    setTheme,
    setTitle,
    ensureDay,
    addEntry,
    updateEntry,
    deleteEntry,
    addAttachment,
    removeAttachment,
    updateAttachment,
    setPin,
    verifyPin,
    moodPalette,
    forceSave,
  };
};
