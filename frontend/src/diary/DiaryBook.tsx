import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import type { DiaryDay } from "./types";
import { usePageFlip } from "./hooks/usePageFlip";
import { DiaryPage } from "./DiaryPage";
import { CalendarIndex } from "./CalendarIndex";
import { useDiary } from "./DiaryProvider";

export type DiaryPageDescriptor =
  | { type: "index" }
  | { type: "day"; date: string; day: DiaryDay };

type DiaryBookProps = {
  pages: DiaryPageDescriptor[];
  calendarOpen: boolean;
  onToggleCalendar: () => void;
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

export const DiaryBook = ({ pages, calendarOpen, onToggleCalendar }: DiaryBookProps) => {
  const { forceSave } = useDiary();
  const pageCount = pages.length;
  const { pageIndex, isFlipping, direction, flipTo } = usePageFlip(pageCount);
  const isTwoPage = useMediaQuery("(min-width: 900px)");
  const step = isTwoPage ? 2 : 1;
  const startIndex = isTwoPage ? pageIndex - (pageIndex % 2) : pageIndex;
  const leftPage = pages[startIndex];
  const rightPage = pages[startIndex + 1];
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!flipAudioRef.current) {
      flipAudioRef.current = new Audio("/sounds/page-flip.mp3");
      flipAudioRef.current.volume = 0.3;
    }
  }, []);

  const playRustle = useCallback(() => {
    const context = new AudioContext();
    const duration = 0.2;
    const bufferSize = context.sampleRate * duration;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = 0.15;
    source.connect(gain).connect(context.destination);
    source.start();
    source.stop(context.currentTime + duration);
    source.onended = () => context.close();
  }, []);

  const playFlipSound = useCallback(() => {
    const audio = flipAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        playRustle();
      });
      return;
    }
    playRustle();
  }, [playRustle]);

  const handleFlip = useCallback(
    (nextIndex: number, dir: "next" | "prev") => {
      if (isFlipping) {
        return;
      }
      playFlipSound();
      flipTo(nextIndex, dir);
    },
    [flipTo, isFlipping, playFlipSound],
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
  }, [handleNext, handlePrev]);

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
      const index = pages.findIndex((page) => page.type === "day" && page.date === date);
      if (index >= 0) {
        const target = isTwoPage ? index - (index % 2) : index;
        const dir = target > startIndex ? "next" : "prev";
        handleFlip(target, dir);
      }
    },
    [handleFlip, isTwoPage, pages, startIndex],
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
    return pages.filter((page): page is { type: "day"; date: string; day: DiaryDay } => page.type === "day");
  }, [pages]);

  return (
    <div className="relative">
      <div
        className="mb-4 flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-sm"
        style={{ color: "var(--diary-ink)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleCalendar}
            className="rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-black/70 transition hover:border-black/40"
          >
            Calendar
          </button>
          <span>{pageTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="diary-ribbon text-xs uppercase tracking-[0.2em] text-black/70 transition hover:text-black"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="diary-ribbon text-xs uppercase tracking-[0.2em] text-black/70 transition hover:text-black"
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
        <DiaryPage page={leftPage} position="left" />
        {isTwoPage ? <DiaryPage page={rightPage} position="right" /> : null}

        {isFlipping && direction === "next" && rightPage && (
          <motion.div
            className="absolute right-0 top-0 h-full w-1/2"
            initial={{ rotateY: 0 }}
            animate={{ rotateY: -180 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d", transformOrigin: "left center" }}
          >
            <div className="diary-flip-shadow" />
            <div className="h-full w-full" style={{ backfaceVisibility: "hidden" }}>
              <DiaryPage page={rightPage} position="right" variant="flip-front" />
            </div>
            <div
              className="absolute inset-0 h-full w-full"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <DiaryPage page={pages[startIndex + step] ?? rightPage} position="right" variant="flip-back" />
            </div>
          </motion.div>
        )}

        {isFlipping && direction === "prev" && leftPage && (
          <motion.div
            className="absolute left-0 top-0 h-full w-1/2"
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 180 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d", transformOrigin: "right center" }}
          >
            <div className="diary-flip-shadow" />
            <div className="h-full w-full" style={{ backfaceVisibility: "hidden" }}>
              <DiaryPage page={leftPage} position="left" variant="flip-front" />
            </div>
            <div
              className="absolute inset-0 h-full w-full"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <DiaryPage page={pages[Math.max(0, startIndex - step)] ?? leftPage} position="left" variant="flip-back" />
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
