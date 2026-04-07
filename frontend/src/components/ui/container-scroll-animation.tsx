import { useRef, type ReactNode } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { cn } from "../../lib/utils";

export const ContainerScroll = ({
  titleComponent,
  children,
  className,
}: {
  titleComponent?: ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-10% 0px -10% 0px" });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 90%", "end 25%"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const translateY = useTransform(scrollYProgress, [0, 1], [54, 0]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [10, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.35], [0, 1]);

  return (
    <section ref={containerRef} className={cn("container-scroll-root", className)}>
      <div className="container-scroll-inner">
        {titleComponent ? (
          <motion.div
            className="container-scroll-title"
            initial={{ opacity: 0, y: 18 }}
            animate={isInView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            {titleComponent}
          </motion.div>
        ) : null}

        <motion.div className="container-scroll-card-wrap" style={{ opacity, y: translateY }}>
          <motion.div className="container-scroll-card" style={{ rotateX, scale }}>
            <div className="container-scroll-card-content">{children}</div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
