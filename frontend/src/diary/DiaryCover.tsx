import { useState } from "react";
import { motion } from "framer-motion";

type DiaryCoverProps = {
  isOpen: boolean;
  title: string;
  year: number;
  onTitleChange: (title: string) => void;
  onOpen: () => void;
};

export const DiaryCover = ({ isOpen, title, year, onTitleChange, onOpen }: DiaryCoverProps) => {
  const [opening, setOpening] = useState(false);

  if (isOpen) {
    return null;
  }

  return (
    <motion.div
      className="diary-cover relative mx-auto mt-12 flex w-full max-w-3xl flex-col items-center gap-6 rounded-[28px] border border-black/20 bg-black/30 p-10 text-center text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
      initial={{ rotateY: 0 }}
      animate={{ rotateY: opening ? -110 : 0 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      style={{ transformStyle: "preserve-3d" }}
    >
      <span className="text-sm uppercase tracking-[0.35em] text-white/70">Personal Diary</span>
      <input
        className="w-full max-w-lg rounded-full border border-white/40 bg-white/10 px-6 py-3 text-center text-3xl font-semibold text-white outline-none transition focus:border-white/80"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <div className="text-lg tracking-[0.3em] text-white/80">{year}</div>
      <div className="h-16 w-16 rounded-full border border-white/40 bg-white/10" />
      <button
        type="button"
        onClick={() => {
          setOpening(true);
          window.setTimeout(() => {
            onOpen();
          }, 1200);
        }}
        className="rounded-full bg-white/90 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#2c1a0e] transition hover:bg-white"
      >
        Open Diary
      </button>
    </motion.div>
  );
};
