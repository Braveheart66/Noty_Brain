import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDiary } from "./DiaryProvider";

type DiaryCoverProps = {
  isOpen: boolean;
  title: string;
  year: number;
  onTitleChange: (title: string) => void;
  onOpen: () => void;
};

export const DiaryCover = ({ isOpen, title, year, onTitleChange, onOpen }: DiaryCoverProps) => {
  const { state } = useDiary();
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setOpening(false);
    }
  }, [isOpen]);

  if (isOpen) {
    return null;
  }

  // Find the date of the most recent entry
  const lastWrittenDate = () => {
    if (!state.days || state.days.length === 0) return "Never";
    // Sort and find last day with entries
    const writtenDays = [...state.days].filter(d => d.entries && d.entries.length > 0);
    if (writtenDays.length === 0) return "Never";
    const lastDay = writtenDays[writtenDays.length - 1];
    
    try {
      const date = new Date(`${lastDay.date}T00:00:00`);
      return new Intl.DateTimeFormat(undefined, { 
        weekday: "short", 
        month: "short", 
        day: "numeric", 
        year: "numeric" 
      }).format(date);
    } catch {
      return lastDay.date;
    }
  };

  const getCoverStyles = () => {
    switch (state.theme) {
      case "vintage":
        return {
          container: "bg-[#1A0F08] border-2 border-[#2C1810] shadow-[0_30px_70px_rgba(0,0,0,0.7)] text-[#F5ECD7]",
          titleInput: "text-[#8B6914] bg-transparent text-center font-bold font-serif border-b border-[#8B6914]/20 hover:border-[#8B6914]/40 focus:border-[#8B6914] focus:outline-none placeholder-[#8B6914]/30",
          inner: "relative border border-[#8B6914]/30 p-8 m-2 h-full flex flex-col justify-between items-center rounded-sm",
          button: "bg-[#8B6914] hover:bg-[#a27e1f] text-[#F5ECD7] border border-[#a27e1f]/30",
        };
      case "neon":
        return {
          container: "bg-[#060810] border border-[#FF2D78]/50 shadow-[0_0_35px_rgba(255,45,120,0.35)] text-[#D0D8FF]",
          titleInput: "text-[#00F5D4] bg-transparent text-center font-mono focus:outline-none border-b border-[#00F5D4]/20 focus:border-[#00F5D4] placeholder-[#00F5D4]/30",
          inner: "relative p-8 h-full flex flex-col justify-between items-center",
          button: "bg-transparent hover:bg-[#FF2D78]/10 text-[#FF2D78] border border-[#FF2D78] shadow-[0_0_15px_rgba(255,45,120,0.3)]",
        };
      case "cottage":
        return {
          container: "bg-[#7D9E6B] border border-[#6B8B5B] shadow-[0_20px_50px_rgba(125,158,107,0.4)] text-[#FEFCF7]",
          titleInput: "text-[#FEFCF7] bg-transparent text-center font-cursive focus:outline-none border-b border-[#FEFCF7]/20 focus:border-[#FEFCF7] placeholder-[#FEFCF7]/30",
          inner: "relative p-8 h-full flex flex-col justify-between items-center rounded-xl border border-[#FEFCF7]/15 m-2",
          button: "bg-[#C17E74] hover:bg-[#b07066] text-[#FEFCF7] rounded-full",
        };
      case "studio":
      default:
        return {
          container: "bg-[#FAFAF8] border border-[#1C1C1C]/15 shadow-[0_25px_60px_rgba(0,0,0,0.12)] text-[#1C1C1C]",
          titleInput: "text-[#1C1C1C] bg-transparent text-center font-serif focus:outline-none border-b border-[#1C1C1C]/15 focus:border-[#1C1C1C] placeholder-[#1C1C1C]/30",
          inner: "relative p-8 h-full flex flex-col justify-between items-center border-l-4 border-l-[#C0392B] ml-2",
          button: "bg-[#1C1C1C] hover:bg-[#333] text-[#FAFAF8] rounded-none",
        };
    }
  };

  const styles = getCoverStyles();

  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center p-4" style={{ perspective: "1200px" }}>
      <motion.div
        className={`relative w-full max-w-[480px] h-[640px] rounded-[16px] overflow-hidden select-none transition-shadow duration-300`}
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "left center",
        }}
        initial={{
          rotateX: 0,
          rotateY: 0,
          z: 0
        }}
        animate={{
          rotateX: opening ? 0 : 8,
          rotateY: opening ? -180 : -5,
          z: opening ? 50 : 0
        }}
        transition={{
          duration: opening ? 0.9 : 0.8,
          ease: "easeInOut"
        }}
      >
        {/* Cover Outer Face */}
        <div className={`absolute inset-0 w-full h-full p-2 flex flex-col rounded-[16px] ${styles.container}`} style={{ backfaceVisibility: "hidden" }}>
          
          {/* Theme Specific Visual Overlays */}
          {state.theme === "vintage" && (
            <>
              {/* Noise texture overlay */}
              <div 
                className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none rounded-[16px]"
                style={{
                  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100' height='100' filter='url(%23n)'/></svg>\")"
                }}
              />
              {/* Leather texture linear gradient */}
              <div 
                className="absolute inset-0 opacity-[0.15] pointer-events-none rounded-[16px]"
                style={{
                  backgroundImage: "repeating-linear-gradient(45deg, #000, #000 2px, transparent 2px, transparent 6px)"
                }}
              />
              {/* Ribbon hanger */}
              <div className="absolute top-0 right-10 w-4 h-24 bg-[#8B3A3A] shadow-md z-10 rounded-b-sm border-r border-[#8B3A3A]/20" />
            </>
          )}

          {state.theme === "neon" && (
            <>
              {/* Scanline grid */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none rounded-[16px]"
                style={{
                  backgroundImage: "repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 3px)"
                }}
              />
              {/* Neon pulsing animation keyframe styles */}
              <style>{`
                @keyframes neonPulseCover {
                  0%, 100% { box-shadow: 0 0 25px rgba(255,45,120,0.35); border-color: rgba(255,45,120,0.5); }
                  50% { box-shadow: 0 0 35px rgba(0,245,212,0.45); border-color: rgba(0,245,212,0.6); }
                }
              `}</style>
            </>
          )}

          {state.theme === "cottage" && (
            <>
              {/* Linen filter */}
              <div 
                className="absolute inset-0 opacity-[0.05] pointer-events-none rounded-[16px]"
                style={{
                  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='linen'><feTurbulence type='fractalNoise' baseFrequency='0.08' numOctaves='2' stitchTiles='stitch'/></filter><rect width='80' height='80' filter='url(%23linen)'/></svg>\")"
                }}
              />
              {/* Rose ribbon */}
              <div className="absolute top-0 right-12 w-3 h-28 bg-[#C17E74] shadow-sm z-10 opacity-80" />
            </>
          )}

          <div className={styles.inner}>
            
            {/* Top Section: Header & Monogram */}
            <div className="flex flex-col items-center gap-1 mt-4">
              <span className="text-[10px] uppercase tracking-[0.4em] opacity-60">Personal Journal</span>
              {state.theme === "vintage" && <div className="text-2xl font-serif text-[#8B6914] font-semibold mt-1">⚜</div>}
              {state.theme === "cottage" && (
                <div className="text-xl mt-1 text-[#FEFCF7]/80">✿</div>
              )}
            </div>

            {/* Middle Section: Year & Editable Title */}
            <div className="flex flex-col items-center gap-4 w-full px-4">
              
              {/* Year */}
              <span 
                className="text-7xl font-bold tracking-widest opacity-85 select-none"
                style={{ 
                  fontFamily: "var(--theme-font-heading)",
                  textShadow: state.theme === "vintage" ? "1px 1px 0px #000, 2px 2px 0px #8b6914" : undefined
                }}
              >
                {year}
              </span>

              {/* Inline Title input */}
              <div className="w-full flex justify-center mt-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  className={`w-full max-w-[320px] py-1 text-center text-xl tracking-wide transition-all duration-200 ${styles.titleInput}`}
                  placeholder="Renamed Diary"
                />
              </div>
            </div>

            {/* Bottom Section: Last Written & Button */}
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="text-[10px] uppercase tracking-[0.25em] opacity-60">
                Last written: <span className="font-semibold">{lastWrittenDate()}</span>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setOpening(true);
                  setTimeout(() => {
                    onOpen();
                  }, 900);
                }}
                className={`px-8 py-3.5 text-xs font-bold uppercase tracking-[0.25em] shadow-md transition-all duration-300 hover:scale-[1.04] active:scale-[0.98] ${styles.button}`}
              >
                Open Diary →
              </button>
            </div>

          </div>

          {/* Cottagecore flower corners decoration inside cover */}
          {state.theme === "cottage" && (
            <div className="absolute inset-4 border border-[#FEFCF7]/20 pointer-events-none rounded-lg">
              <div className="absolute top-1 left-1 opacity-40">✿</div>
              <div className="absolute top-1 right-1 opacity-40">✿</div>
              <div className="absolute bottom-1 left-1 opacity-40">✿</div>
              <div className="absolute bottom-1 right-1 opacity-40">✿</div>
            </div>
          )}

          {/* Vintage embossed leather look corners */}
          {state.theme === "vintage" && (
            <div className="absolute inset-4 border border-[#8B6914]/15 pointer-events-none rounded-sm" />
          )}

        </div>

        {/* Back Page Face (Inside left cover shown during flip) */}
        <div 
          className="absolute inset-0 w-full h-full bg-[#EFE3C4] border-r-2 border-black/10 rounded-[16px] shadow-2xl"
          style={{ 
            transform: "rotateY(180deg)", 
            backfaceVisibility: "hidden",
            backgroundColor: "var(--theme-page-alt)",
            color: "var(--theme-ink)"
          }}
        >
          {/* Simulated spine strip on inside back cover */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-black/10 border-l border-black/5" />
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <span className="text-4xl font-serif">📖</span>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
