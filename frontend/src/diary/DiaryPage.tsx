import type { DiaryPageDescriptor } from "./DiaryBook";
import { DiaryEntry } from "./DiaryEntry";
import { EntryIndex } from "./EntryIndex";

type DiaryPageProps = {
  page?: DiaryPageDescriptor;
  position: "left" | "right";
  variant?: "flip-front" | "flip-back";
};

export const DiaryPage = ({ page, position, variant }: DiaryPageProps) => {
  if (!page) {
    return (
      <div className="relative h-full min-h-[520px] rounded-[26px] border border-black/10 bg-white/10" />
    );
  }

  return (
    <article
      className="diary-page-surface relative h-full min-h-[520px] rounded-[26px] border border-black/10 p-6 shadow-page-edge"
      data-position={position}
      data-variant={variant}
      style={{ fontFamily: "var(--diary-font-body)" }}
    >
      <div className="diary-neon-overlay" aria-hidden="true" />
      <div className="diary-page-vignette" />
      {page.type === "index" ? <EntryIndex /> : <DiaryEntry day={page.day} />}
    </article>
  );
};
