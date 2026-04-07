import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const clampRotation = (value: number, maxRotation: number): number => {
  if (value > maxRotation) {
    return maxRotation;
  }
  if (value < -maxRotation) {
    return -maxRotation;
  }
  return value;
};

export function TiltCard({
  children,
  className,
  maxRotation = 8,
}: {
  children: ReactNode;
  className?: string;
  maxRotation?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(false);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springX = useSpring(rotateX, {
    stiffness: 240,
    damping: 28,
  });

  const springY = useSpring(rotateY, {
    stiffness: 240,
    damping: 28,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    const syncInteractivity = () => {
      setInteractive(mediaQuery.matches);
    };

    syncInteractivity();
    mediaQuery.addEventListener("change", syncInteractivity);

    return () => {
      mediaQuery.removeEventListener("change", syncInteractivity);
    };
  }, []);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;

    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const relativeX = (event.clientX - centerX) / (rect.width / 2 || 1);
    const relativeY = (event.clientY - centerY) / (rect.height / 2 || 1);

    rotateY.set(clampRotation(relativeX * maxRotation, maxRotation));
    rotateX.set(clampRotation(-relativeY * maxRotation, maxRotation));
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={interactive ? { scale: 1.02 } : undefined}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      style={{
        rotateX: interactive ? springX : 0,
        rotateY: interactive ? springY : 0,
        transformStyle: "preserve-3d",
        perspective: 1000,
        willChange: interactive ? "transform" : "auto",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
