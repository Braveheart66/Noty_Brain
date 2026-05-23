import { useRef, useState } from "react";
import type { DiaryDay, DiaryMoment, DiaryAttachment, AttachmentType } from "./types";
import { useDiary } from "./DiaryProvider";
import { AttachmentItem } from "./AttachmentItem";

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

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

export const AttachmentManager = ({ day, entry, disabled }: { day: DiaryDay; entry: DiaryMoment; disabled?: boolean }) => {
  const { addAttachment, removeAttachment, updateAttachment } = useDiary();
  const [isOpen, setIsOpen] = useState(false);
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
      const dataUrl = await fileToDataUrl(file);
      const attachment: DiaryAttachment = {
        id: crypto.randomUUID(),
        type,
        name: file.name,
        dataUrl,
        caption: "",
        createdAt: new Date().toISOString(),
        rotation: Math.random() * 6 - 3,
      };
      addAttachment(day.date, entry.id, attachment);
    }

    event.target.value = "";
  };

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.2em] text-black/50">Attachments</h3>
        <button
          type="button"
          className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em]"
          onClick={handlePick}
        >
          Attach
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          multiple
          onChange={handleFiles}
          data-entry-id={entry.id}
        />
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {entry.attachments.map((attachment) => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            onRemove={() => removeAttachment(day.date, entry.id, attachment.id)}
            onCaptionChange={(caption) => updateAttachment(day.date, entry.id, attachment.id, { caption })}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
};
