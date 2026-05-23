import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import type { DiaryDay } from "./types";
import { usePageFlip } from "./hooks/usePageFlip";
import { DiaryPage } from "./DiaryPage";
import { CalendarIndex } from "./CalendarIndex";
import { useDiary } from "./DiaryProvider";
import { useSoundEffects } from "./hooks/useSoundEffects";

export type DiaryPageDescriptor =
  | { type: "index" }
  | { type: "day"; date: string; day: DiaryDay };

type DiaryBookProps = {
  pages: DiaryPageDescriptor[];
  calendarOpen: boolean;
  onToggleCalendar: () => void;
  onBackToCover?: () => void;
};

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = () => setMatches(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [query]);

  return matches;
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
};

export const DiaryBook = ({ pages, calendarOpen, onToggleCalendar, onBackToCover }: DiaryBookProps) => {
  const { forceSave, state } = useDiary();
  const { playPageFlip } = useSoundEffects();
  const isTwoPage = useMediaQuery("(min-width: 768px)"); // Collapse to single page below 768px

  // Filter out the Table of Contents on mobile
  const bookPages = useMemo(() => {
    if (!isTwoPage) {
      return pages.filter((p) => p.type !== "index");
    }
    return pages;
  }, [pages, isTwoPage]);

  const pageCount = bookPages.length;
  const { pageIndex, isFlipping, direction, flipTo } = usePageFlip(pageCount);
  const step = isTwoPage ? 2 : 1;
  const startIndex = isTwoPage ? pageIndex - (pageIndex % 2) : pageIndex;
  const leftPage = bookPages[startIndex];
  const rightPage = bookPages[startIndex + 1];
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const handleFlip = useCallback(
    (nextIndex: number, dir: "next" | "prev") => {
      if (isFlipping) {
        return;
      }
      playPageFlip(); // Trigger Web Audio programmatically at the START of flip
      flipTo(nextIndex, dir);
    },
    [flipTo, isFlipping, playPageFlip],
  );

  const handleNext = () => {
    if (startIndex + step < pageCount) {
      handleFlip(startIndex + step, "next");
    }
  };

  const handlePrev = () => {
    if (startIndex - step >= 0) {
      handleFlip(startIndex - step, "prev");
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "s") {
        event.preventDefault();
        forceSave();
      }
      if ((event.metaKey || event.ctrlKey) && key === "]") {
        event.preventDefault();
        handleNext();
      }
      if ((event.metaKey || event.ctrlKey) && key === "[") {
        event.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handlePrev, forceSave]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    swipeStart.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  const handleJumpToDate = useCallback(
    (date: string) => {
      const index = bookPages.findIndex((page) => page.type === "day" && page.date === date);
      if (index >= 0) {
        const target = isTwoPage ? index - (index % 2) : index;
        const dir = target > startIndex ? "next" : "prev";
        handleFlip(target, dir);
      }
    },
    [handleFlip, isTwoPage, bookPages, startIndex],
  );

  const pageTitle = useMemo(() => {
    if (leftPage?.type === "day") {
      return formatDate(leftPage.date);
    }
    if (rightPage?.type === "day") {
      return formatDate(rightPage.date);
    }
    return "Diary Index";
  }, [leftPage, rightPage]);

  const dayPages = useMemo(() => {
    return bookPages.filter((page): page is { type: "day"; date: string; day: DiaryDay } => page.type === "day");
  }, [bookPages]);

  const totalEntries = useMemo(() => {
    return state.days.flatMap((day) => day.entries).length;
  }, [state.days]);

  return (
    <div className="relative">
      {/* Header controls styled to match the active theme */}
      <div
        className="mb-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition-all"
        style={{
          backgroundColor: "var(--theme-entry-bg)",
          border: "var(--theme-entry-border)",
          boxShadow: "var(--theme-entry-shadow)",
          color: "var(--theme-ink)"
        }}
      >
        <div className="flex items-center gap-3">
          {onBackToCover && (
            <button
              type="button"
              onClick={onBackToCover}
              className="rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] opacity-80 hover:opacity-100 transition"
              style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--theme-ink)" }}
            >
              ← Back to Cover
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCalendar}
            className="rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] opacity-80 hover:opacity-100 transition"
            style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--theme-ink)" }}
          >
            Calendar
          </button>
          <span className="hidden md:inline font-semibold">{pageTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={startIndex - step < 0}
            className="rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] opacity-85 hover:opacity-100 transition disabled:opacity-30"
            style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--theme-ink)" }}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={startIndex + step >= pageCount}
            className="rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] opacity-85 hover:opacity-100 transition disabled:opacity-30"
            style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--theme-ink)" }}
          >
            Next
          </button>
        </div>
      </div>

      <div
        className="diary-book-spread relative grid grid-cols-1 gap-4 md:grid-cols-2"
        style={{ perspective: "1600px" }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Pass down footer related props */}
        <DiaryPage
          page={leftPage}
          position="left"
          pageNumber={startIndex + 1}
          totalPages={pageCount}
          totalEntries={totalEntries}
          isTwoPage={isTwoPage}
          onJumpToDate={handleJumpToDate}
        />
        {isTwoPage ? (
          <DiaryPage
            page={rightPage}
            position="right"
            pageNumber={startIndex + 2}
            totalPages={pageCount}
            totalEntries={totalEntries}
            isTwoPage={isTwoPage}
            onJumpToDate={handleJumpToDate}
          />
        ) : null}

        {isFlipping && direction === "next" && rightPage && (
          <motion.div
            className="absolute right-0 top-0 h-full w-1/2 hidden md:block"
            initial={{ rotateY: 0 }}
            animate={{ rotateY: -180 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d", transformOrigin: "left center", zIndex: 50 }}
          >
            <div className="diary-flip-shadow" />
            <div className="h-full w-full" style={{ backfaceVisibility: "hidden" }}>
              <DiaryPage
                page={rightPage}
                position="right"
                variant="flip-front"
                pageNumber={startIndex + 2}
                totalPages={pageCount}
                totalEntries={totalEntries}
                isTwoPage={isTwoPage}
              />
            </div>
            <div
              className="absolute inset-0 h-full w-full"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <DiaryPage
                page={bookPages[startIndex + step] ?? rightPage}
                position="right"
                variant="flip-back"
                pageNumber={startIndex + step + 2}
                totalPages={pageCount}
                totalEntries={totalEntries}
                isTwoPage={isTwoPage}
              />
            </div>
          </motion.div>
        )}

        {isFlipping && direction === "prev" && leftPage && (
          <motion.div
            className="absolute left-0 top-0 h-full w-1/2 hidden md:block"
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 180 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d", transformOrigin: "right center", zIndex: 50 }}
          >
            <div className="diary-flip-shadow" />
            <div className="h-full w-full" style={{ backfaceVisibility: "hidden" }}>
              <DiaryPage
                page={leftPage}
                position="left"
                variant="flip-front"
                pageNumber={startIndex + 1}
                totalPages={pageCount}
                totalEntries={totalEntries}
                isTwoPage={isTwoPage}
              />
            </div>
            <div
              className="absolute inset-0 h-full w-full"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <DiaryPage
                page={bookPages[Math.max(0, startIndex - step)] ?? leftPage}
                position="left"
                variant="flip-back"
                pageNumber={Math.max(0, startIndex - step) + 1}
                totalPages={pageCount}
                totalEntries={totalEntries}
                isTwoPage={isTwoPage}
              />
            </div>
          </motion.div>
        )}
      </div>

      <CalendarIndex
        open={calendarOpen}
        days={dayPages.map((page) => page.day)}
        onClose={onToggleCalendar}
        onSelectDate={handleJumpToDate}
      />
    </div>
  );
};

