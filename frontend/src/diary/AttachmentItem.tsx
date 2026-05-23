import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DiaryAttachment } from "./types";
import { getDB } from "./hooks/useAttachmentStore";

const formatAttachmentTime = (isoString: string) => {
  try {
    const date = new Date(isoString);
    const dayName = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
    const dateStr = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
    const timeStr = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
    return `Added ${dayName}, ${dateStr} · ${timeStr}`;
  } catch {
    return "";
  }
};

// Sub-component to capture a frame from the video using a canvas
const VideoThumbnail = ({ src }: { src: string }) => {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 0.5;

    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumb(canvas.toDataURL("image/jpeg"));
        }
      } catch (e) {
        console.error("Failed to capture video thumbnail:", e);
      }
    };

    video.addEventListener("seeked", onSeeked);
    video.load();

    return () => {
      video.removeEventListener("seeked", onSeeked);
    };
  }, [src]);

  if (thumb) {
    return <img src={thumb} className="h-44 w-full rounded-lg object-cover" alt="Video thumbnail" />;
  }

  return (
    <div className="h-44 w-full rounded-lg bg-black/70 flex flex-col items-center justify-center text-xs text-white/50 select-none">
      <span className="animate-spin mb-1">⏳</span>
      <span>Generating Frame...</span>
    </div>
  );
};

// Sub-component to decode audio and draw a real waveform on canvas
const AudioWaveform = ({ src, playing }: { src: string; playing: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);

  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const loadAudio = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        setBuffer(audioBuffer);
      } catch (e) {
        console.warn("AudioContext decode audio failed:", e);
      }
    };
    loadAudio();

    return () => {
      ctx.close();
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const height = canvas.height;
    const width = canvas.width;

    if (!buffer) {
      // Static decorative waveform SVG / Canvas fallback
      ctx.fillStyle = "rgba(235, 219, 178, 0.25)";
      for (let i = 0; i < width; i += 6) {
        const h = 5 + Math.sin(i * 0.15) * 14 + Math.cos(i * 0.05) * 8;
        ctx.fillRect(i, height / 2 - h / 2, 3, h);
      }
      return;
    }

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    for (let i = 0; i < width; i += 4) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const h = Math.max(2, (max - min) * amp * 1.6);
      ctx.fillStyle = playing ? "#ff2d78" : "#ebdbb2";
      ctx.fillRect(i, height / 2 - h / 2, 2, h);
    }
  }, [buffer, playing]);

  return <canvas ref={canvasRef} width={240} height={40} className="w-full h-10 rounded bg-[#151515] border border-[#3c3836] mt-2" />;
};

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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load the Blob URL asynchronously from IndexedDB
  useEffect(() => {
    let url: string | null = null;
    const loadBlob = async () => {
      try {
        const db = await getDB();
        const data = await db.get("attachments", attachment.id);
        if (data && data.blob) {
          url = URL.createObjectURL(data.blob);
          setBlobUrl(url);
        }
      } catch (error) {
        console.error("Failed to load blob from IndexedDB for item:", attachment.id, error);
      }
    };
    loadBlob();

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [attachment.id]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleAudioEnded = () => {
    setPlaying(false);
  };

  if (!blobUrl) {
    return (
      <div className="h-48 border border-black/5 bg-white/40 rounded-xl flex items-center justify-center text-xs opacity-50">
        Loading media...
      </div>
    );
  }

  // Get rotation from metadata, fallback to 0
  const rotation = attachment.rotation ?? 0;

  return (
    <motion.div
      className="relative flex flex-col group"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. IMAGE CARDS: Polaroid-Style */}
      {attachment.type === "image" && (
        <div 
          className="polaroid-card" 
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Top Tape strip */}
          <div className="polaroid-tape" />

          {/* Delete icon top-right on hover */}
          {isHovered && !disabled && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 hover:bg-red-500 text-white text-[10px] z-10 transition shadow-md"
              title="Delete Attachment"
            >
              ×
            </button>
          )}

          {/* Photo */}
          <button 
            type="button"
            className="w-full outline-none"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={blobUrl}
              alt={attachment.name}
              className="h-44 w-full rounded-sm object-cover border border-black/5 select-none"
            />
          </button>

          {/* Handwriting font caption input */}
          <input
            className="mt-3 w-full border-b border-dashed border-black/25 bg-transparent text-center text-lg outline-none focus:border-black/50"
            placeholder="Write a memory..."
            value={attachment.caption}
            onChange={(event) => onCaptionChange?.(event.target.value)}
            disabled={disabled}
            style={{ fontFamily: "'Caveat', cursive", color: "#3D2B1F" }}
          />
        </div>
      )}

      {/* 2. VIDEO CARDS: Film-Strip Style */}
      {attachment.type === "video" && (
        <div className="filmstrip-card">
          {/* Film perforations */}
          <div className="filmstrip-perf-left">
            {[...Array(6)].map((_, i) => <div key={`p-l-${i}`} className="filmstrip-perf-dot" />)}
          </div>
          <div className="filmstrip-perf-right">
            {[...Array(6)].map((_, i) => <div key={`p-r-${i}`} className="filmstrip-perf-dot" />)}
          </div>

          {/* Delete Button */}
          {isHovered && !disabled && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] z-20 shadow-md"
            >
              ×
            </button>
          )}

          {/* Thumbnail */}
          <div className="relative px-6">
            <button
              type="button"
              className="group relative block h-44 w-full overflow-hidden rounded-lg bg-black border border-white/10"
              onClick={() => setLightboxOpen(true)}
            >
              <VideoThumbnail src={blobUrl} />
              <div className="absolute inset-0 grid place-items-center bg-black/15 group-hover:bg-black/30 transition">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-black text-xl shadow-lg group-hover:scale-105 transition">
                  ▶
                </div>
              </div>
            </button>
          </div>

          {/* Video Caption below */}
          <div className="px-6 mt-2">
            <input
              className="w-full border-b border-white/10 bg-transparent text-center text-xs text-white/80 outline-none focus:border-white/30"
              placeholder="Add video caption..."
              value={attachment.caption}
              onChange={(event) => onCaptionChange?.(event.target.value)}
              disabled={disabled}
              style={{ fontFamily: "var(--theme-font-ui)" }}
            />
          </div>
        </div>
      )}

      {/* 3. AUDIO CARDS: Cassette Tape Style */}
      {attachment.type === "audio" && (
        <div className="cassette-card">
          {/* Delete Button */}
          {isHovered && !disabled && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] z-10"
            >
              ×
            </button>
          )}

          {/* Hidden audio element */}
          <audio ref={audioRef} src={blobUrl} onEnded={handleAudioEnded} className="hidden" />

          {/* Cassette layout */}
          <div className="cassette-body">
            <div className="cassette-label truncate px-4">
              {attachment.name}
            </div>
            
            <div className="cassette-reels-row">
              <div className={`cassette-reel ${playing ? "playing" : ""}`}>
                <div className="cassette-reel-center" />
              </div>
              <div className={`cassette-reel ${playing ? "playing" : ""}`}>
                <div className="cassette-reel-center" />
              </div>
            </div>
          </div>

          {/* Waveform Visualization */}
          <AudioWaveform src={blobUrl} playing={playing} />

          {/* Cassette Controller */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-8 px-4 items-center justify-center rounded bg-[#504945] hover:bg-[#665c54] text-[#ebdbb2] text-[10px] uppercase font-bold tracking-wider transition active:scale-95"
            >
              {playing ? "❚❚ Pause" : "▶ Play"}
            </button>
            <span className="text-[9px] opacity-70">TAPE REC</span>
          </div>

          {/* Caption */}
          <input
            className="w-full border-b border-[#504945] bg-transparent text-center text-xs text-[#ebdbb2] outline-none mt-2 focus:border-[#7c6f64]"
            placeholder="Add audio caption..."
            value={attachment.caption}
            onChange={(event) => onCaptionChange?.(event.target.value)}
            disabled={disabled}
          />
        </div>
      )}

      {/* Attachment timestamp below the card */}
      <span className="mt-2 text-[10px] italic opacity-60 text-center block">
        {formatAttachmentTime(attachment.createdAt)}
      </span>

      {/* Lightbox / Video Modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
          >
            {/* Image Lightbox */}
            {attachment.type === "image" && (
              <motion.div 
                className="relative max-h-[85vh] max-w-4xl"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={blobUrl}
                  alt={attachment.name}
                  className="rounded-lg shadow-2xl object-contain max-h-[80vh] w-full"
                />
                {attachment.caption && (
                  <p className="text-white text-center mt-3 text-xl font-serif" style={{ fontFamily: "'Caveat', cursive" }}>
                    {attachment.caption}
                  </p>
                )}
              </motion.div>
            )}

            {/* Video Lightbox Player */}
            {attachment.type === "video" && (
              <motion.video
                src={blobUrl}
                controls
                autoPlay
                className="max-h-[80vh] w-full max-w-3xl rounded-xl bg-black shadow-2xl"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
