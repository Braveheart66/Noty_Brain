import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DiaryAttachment } from "./types";
import { useAudioVisualizer } from "./hooks/useAudioVisualizer";

export const AttachmentItem = ({
  attachment,
  onRemove,
  onCaptionChange,
  disabled,
}: {
  attachment: DiaryAttachment;
  onRemove: () => void;
  onCaptionChange?: (caption: string) => void;
  disabled?: boolean;
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useAudioVisualizer(audioRef, canvasRef);

  return (
    <motion.div
      className="relative rounded-2xl border border-black/10 bg-white/80 p-4 shadow-paper-lift"
      style={{ transform: `rotate(${attachment.rotation}deg)` }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
    >
      <span className="diary-attachment-tape" />
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-black/50">
        <span>{attachment.type}</span>
        <button type="button" onClick={onRemove} className="text-black/60" disabled={disabled}>
          Remove
        </button>
      </div>

      {attachment.type === "image" && (
        <figure className="mt-3 rounded-xl bg-white p-3 shadow-md">
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            className="h-44 w-full rounded-lg object-cover"
          />
          <input
            className="mt-2 w-full border-b border-black/20 bg-transparent text-sm outline-none"
            placeholder="Caption"
            value={attachment.caption}
            onChange={(event) => onCaptionChange?.(event.target.value)}
            disabled={disabled}
            style={{ fontFamily: "var(--diary-font-heading)" }}
          />
        </figure>
      )}

      {attachment.type === "video" && (
        <div className="mt-3">
          <button
            type="button"
            className="group relative block h-44 w-full overflow-hidden rounded-xl border border-black/10 bg-black/60"
            onClick={() => setLightboxOpen(true)}
          >
            <video src={attachment.dataUrl} className="h-full w-full object-cover opacity-80" muted />
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
                ▶
              </div>
            </div>
          </button>
        </div>
      )}

      {attachment.type === "audio" && (
        <div className="mt-3">
          <audio ref={audioRef} src={attachment.dataUrl} controls className="w-full" />
          <canvas ref={canvasRef} width={240} height={48} className="mt-2 w-full rounded-lg bg-black/70" />
        </div>
      )}

      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
          >
            <motion.video
              src={attachment.dataUrl}
              controls
              autoPlay
              className="max-h-[80vh] w-full max-w-3xl rounded-2xl bg-black"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(event) => event.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
