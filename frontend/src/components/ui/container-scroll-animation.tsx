import { useRef, useState, useEffect, type ReactNode } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";
import { cn } from "../../lib/utils";

export const ContainerScroll = ({
  titleComponent,
  children,
  className,
}: {
  titleComponent: string | ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  const containerRef = useRef<any>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    // Start tracking when the top of the container crosses the bottom of the viewport
    // End when the bottom of the container crosses the top of the viewport
    offset: ["start end", "end start"],
  });

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1];
  };

  const scale = useTransform(scrollYProgress, [0, 0.5], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 0.5], [0, -100]);
  const rotateX = useTransform(scrollYProgress, [0.1, 0.5], [20, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <div
      className={cn(
        "container-scroll-element",
        "relative flex h-[120vh] w-full items-center justify-center -mb-32",
        className
      )}
      ref={containerRef}
    >
      <div
        className="w-full relative flex flex-col items-center p-4 max-w-7xl mx-auto"
        style={{ perspective: "1000px" }}
      >
        <Header translateY={translate} opacity={opacity}>
          {titleComponent}
        </Header>
        <Card rotate={rotateX} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({ translateY, opacity, children }: any) => {
  return (
    <motion.div
      style={{
        translateY,
        opacity,
      }}
      className="max-w-5xl mx-auto text-center z-10"
    >
      {children}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="max-w-6xl -mt-12 mx-auto h-[32rem] md:h-[48rem] w-full border-4 border-[#135b4a] bg-[#222222] rounded-[30px] p-2 overflow-hidden relative z-20"
    >
      <div className="h-full w-full bg-white relative rounded-2xl overflow-hidden text-black flex items-center justify-center z-10">
        {children}
      </div>
    </motion.div>
  );
};
