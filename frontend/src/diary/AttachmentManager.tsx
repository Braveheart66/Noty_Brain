import { useRef } from "react";
import type { DiaryDay, DiaryMoment, DiaryAttachment, AttachmentType } from "./types";
import { useDiary } from "./DiaryProvider";
import { AttachmentItem } from "./AttachmentItem";
import { saveAttachment, deleteAttachment } from "./hooks/useAttachmentStore";

const resolveType = (file: File): AttachmentType | null => {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  return null;
};

export const AttachmentManager = ({
  day,
  entry,
  disabled,
}: {
  day: DiaryDay;
  entry: DiaryMoment;
  disabled?: boolean;
}) => {
  const { addAttachment, removeAttachment, updateAttachment } = useDiary();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = () => {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    for (const file of Array.from(files)) {
      const type = resolveType(file);
      if (!type) {
        continue;
      }
      
      const id = crypto.randomUUID();
      const rotation = Math.floor(Math.random() * 7) - 3;
      
      try {
        // Save the raw Blob in IndexedDB
        await saveAttachment(id, entry.id, file, file.name, file.type, "", rotation);

        // Save only metadata in localStorage (dataUrl is empty)
        const attachment: DiaryAttachment = {
          id,
          type,
          name: file.name,
          dataUrl: "", // Keep empty to avoid quota limit
          caption: "",
          createdAt: new Date().toISOString(),
          rotation,
        };
        addAttachment(day.date, entry.id, attachment);
      } catch (error) {
        console.error("Failed to save attachment:", error);
      }
    }

    event.target.value = "";
  };

  const handleRemove = async (attachmentId: string) => {
    try {
      // Remove from IndexedDB
      await deleteAttachment(attachmentId);
      // Remove metadata from state
      removeAttachment(day.date, entry.id, attachmentId);
    } catch (error) {
      console.error("Failed to delete attachment:", error);
    }
  };

  const handleCaptionChange = async (attachmentId: string, caption: string) => {
    try {
      // Update state metadata
      updateAttachment(day.date, entry.id, attachmentId, { caption });
    } catch (error) {
      console.error("Failed to update attachment caption:", error);
    }
  };

  return (
    <section className="mt-4">
      {/* Attachments Section Header */}
      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <h3 className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: "var(--theme-ink)", opacity: 0.6 }}>
          Attachments ({entry.attachments ? entry.attachments.length : 0})
        </h3>
        <button
          type="button"
          className="rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition hover:bg-black/5 active:scale-95"
          style={{ borderColor: "rgba(0,0,0,0.15)", color: "var(--theme-ink)" }}
          onClick={handlePick}
          disabled={disabled}
        >
          Attach Media
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          multiple
          onChange={handleFiles}
          disabled={disabled}
        />
      </div>

      {/* Decorative Divider */}
      {entry.attachments && entry.attachments.length > 0 && (
        <div className="pinboard-divider" />
      )}

      {/* Masonry-Style Grid for Attachment Cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-start">
        {entry.attachments &&
          entry.attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onRemove={() => handleRemove(attachment.id)}
              onCaptionChange={(caption) => handleCaptionChange(attachment.id, caption)}
              disabled={disabled}
            />
          ))}
      </div>
    </section>
  );
};
