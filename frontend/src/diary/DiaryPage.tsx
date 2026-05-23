import type { DiaryPageDescriptor } from "./DiaryBook";
import { DiaryEntry } from "./DiaryEntry";
import { EntryIndex } from "./EntryIndex";

type DiaryPageProps = {
  page?: DiaryPageDescriptor;
  position: "left" | "right";
  variant?: "flip-front" | "flip-back";
  pageNumber?: number;
  totalPages?: number;
  totalEntries?: number;
  isTwoPage?: boolean;
  onJumpToDate?: (date: string) => void;
};

export const DiaryPage = ({
  page,
  position,
  variant,
  pageNumber = 0,
  totalPages = 0,
  totalEntries = 0,
  isTwoPage = true,
  onJumpToDate,
}: DiaryPageProps) => {
  if (!page) {
    return (
      <div className="relative h-full min-h-[520px] rounded-[26px] border border-black/10 bg-white/10" />
    );
  }

  return (
    <article
      className="diary-page-surface relative h-full min-h-[520px] rounded-[26px] border border-black/10 p-6 pb-12 shadow-page-edge flex flex-col"
      data-position={position}
      data-variant={variant}
      style={{ fontFamily: "var(--theme-font-body)" }}
    >
      <div className="diary-neon-overlay" aria-hidden="true" />
      <div className="diary-page-vignette" />
      
      <div className="flex-1">
        {page.type === "index" ? <EntryIndex onSelectDate={onJumpToDate} /> : <DiaryEntry day={page.day} />}
      </div>

      {isTwoPage ? (
        position === "left" ? (
          <footer className="absolute bottom-3 left-6 text-[10px] uppercase tracking-[0.25em] opacity-40 select-none">
            Total Entries: {totalEntries}
          </footer>
        ) : (
          <footer className="absolute bottom-3 right-6 text-[10px] uppercase tracking-[0.25em] opacity-40 select-none">
            Page {pageNumber} / {totalPages}
          </footer>
        )
      ) : (
        <footer className="absolute bottom-3 left-6 right-6 flex justify-between text-[10px] uppercase tracking-[0.25em] opacity-40 select-none">
          <span>Entries: {totalEntries}</span>
          <span>Page {pageNumber} / {totalPages}</span>
        </footer>
      )}
    </article>
  );
};
