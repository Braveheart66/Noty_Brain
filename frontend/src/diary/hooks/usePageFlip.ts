import { useCallback, useState } from "react";

export type FlipDirection = "next" | "prev" | null;

export const usePageFlip = (pageCount: number) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [direction, setDirection] = useState<FlipDirection>(null);

  const clampIndex = (index: number) => Math.max(0, Math.min(pageCount - 1, index));

  const flipTo = useCallback(
    (nextIndex: number, nextDirection: FlipDirection) => {
      const target = clampIndex(nextIndex);
      if (target === pageIndex || isFlipping) {
        return;
      }
      setIsFlipping(true);
      setDirection(nextDirection);
      window.setTimeout(() => {
        setPageIndex(target);
        setIsFlipping(false);
        setDirection(null);
      }, 600);
    },
    [isFlipping, pageIndex],
  );

  const flipNext = useCallback(() => {
    flipTo(pageIndex + 1, "next");
  }, [flipTo, pageIndex]);

  const flipPrev = useCallback(() => {
    flipTo(pageIndex - 1, "prev");
  }, [flipTo, pageIndex]);

  const jumpTo = useCallback(
    (nextIndex: number) => {
      setPageIndex(clampIndex(nextIndex));
    },
    [pageCount],
  );

  return {
    pageIndex,
    isFlipping,
    direction,
    flipNext,
    flipPrev,
    flipTo,
    jumpTo,
  };
};
