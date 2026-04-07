import { useState } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { cn } from "../../lib/utils";

type NavProps = {
  onNavigate?: (path: string) => void;
  currentPage?: string;
};

export const AnimatedNavFramer = ({ onNavigate, currentPage = "home" }: NavProps) => {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  // Background opacity: transparent at top, solid after scroll
  const bgOpacity = useTransform(scrollY, [0, 200], [0, 1]);

  useMotionValueEvent(scrollY, "change", (latest: number) => {
    const previous = scrollY.getPrevious() ?? 0;
    if (latest > previous && latest > 150) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  });

  const tabs = [
    { label: "Home", path: "/home" },
    { label: "Capture", path: "/capture" },
    { label: "Explore", path: "/explore" },
    { label: "Graph Lab", path: "/graph" },
    { label: "Browse Notes", path: "/explore" },
  ];

  const handleTabClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const isActive = (tab: { label: string; path: string }) => {
    if (tab.label === "Home") return currentPage === "home";
    if (tab.label === "Capture") return currentPage === "capture";
    if (tab.label === "Explore") return currentPage === "explore";
    if (tab.label === "Graph Lab") return currentPage === "graph";
    return false;
  };

  return (
    <motion.nav
      variants={{
        visible: { y: 0 },
        hidden: { y: "-100%" },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="nav-framer-root"
      style={{ zIndex: 100 }}
    >
      <motion.div
        className="nav-framer-bg"
        style={{ opacity: bgOpacity }}
      />
      <ul className="nav-framer-list">
        {tabs.map((tab) => (
          <li key={tab.label}>
            <button
              onClick={() => handleTabClick(tab.path)}
              className={cn(
                "nav-framer-btn",
                isActive(tab) && "nav-framer-btn-active"
              )}
            >
              {isActive(tab) && (
                <motion.div
                  layoutId="active-nav-tab"
                  className="nav-framer-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </motion.nav>
  );
};
