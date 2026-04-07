import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "../../lib/utils";
import { TiltCard } from "./tilt-card";

type NavProps = {
  onNavigate?: (path: string) => void;
  currentPage?: string;
};

export const AnimatedNavFramer = ({ onNavigate, currentPage = "home" }: NavProps) => {
  const { scrollY } = useScroll();
  const isHome = currentPage === "home";

  const bgOpacity = useTransform(scrollY, [0, 180], [0, 1]);
  const borderColor = useTransform(
    scrollY,
    [0, 180],
    ["rgba(18, 34, 29, 0.04)", "rgba(18, 34, 29, 0.16)"]
  );

  const tabs = [
    { label: "Capture", path: "/capture" },
    { label: "Explore", path: "/explore" },
    { label: "Graph Lab", path: "/graph" },
  ];

  const handleTabClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const isActive = (tab: { label: string; path: string }) => {
    if (tab.label === "Capture") return currentPage === "capture";
    if (tab.label === "Explore") return currentPage === "explore";
    if (tab.label === "Graph Lab") return currentPage === "graph";
    return false;
  };

  return (
    <motion.nav
      className={cn("nav-framer-root", isHome ? "nav-framer-home" : "nav-framer-solid")}
      style={{ zIndex: 100 }}
    >
      <motion.div
        className="nav-framer-bg"
        style={{
          opacity: isHome ? bgOpacity : 1,
          borderBottomColor: isHome ? borderColor : "rgba(18, 34, 29, 0.14)",
        }}
      />
      <div className="nav-framer-shell">
        <button type="button" className="nav-framer-brand" onClick={() => handleTabClick("/")}>Noty Brain</button>

        <ul className="nav-framer-list">
          {tabs.map((tab) => (
            <li key={tab.label} className="nav-framer-item">
              <TiltCard className="nav-tab-card">
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
              </TiltCard>
            </li>
          ))}
        </ul>
      </div>
    </motion.nav>
  );
};
