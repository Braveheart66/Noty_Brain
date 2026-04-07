import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export const ScrollExpandMedia = ({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle?: string;
  title?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"]
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1.05]);
  const y = useTransform(scrollYProgress, [0, 1], [150, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.3, 1]);

  return (
    <div 
      ref={containerRef} 
      className="relative min-h-screen py-24 px-4 flex flex-col items-center justify-center overflow-hidden"
    >
      {(title || subtitle) && (
        <div className="text-center mb-16 z-10 max-w-2xl mx-auto">
          {title && (
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xl text-[var(--ink-soft)] font-medium">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      <motion.div
        style={{ scale, y, opacity }}
        className="w-full max-w-7xl mx-auto rounded-3xl overflow-hidden border border-[#bed5c8] shadow-[0_20px_50px_rgba(15,34,24,0.12)] bg-gradient-to-br from-[rgba(255,255,255,0.95)] to-[rgba(235,245,238,0.85)] backdrop-blur-md"
      >
        <div className="aspect-video w-full relative">
          {children}
        </div>
      </motion.div>
    </div>
  );
};
