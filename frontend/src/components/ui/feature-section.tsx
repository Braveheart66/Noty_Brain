import type { ReactNode } from "react";
import { motion } from "framer-motion";

type FeatureSectionProps = {
  label: string;
  heading: string;
  body: string;
  cta: string;
  ctaHref: string;
  reverse?: boolean;
  children: ReactNode;
  onNavigate: (path: string) => void;
};

const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 },
};

const slideInRight = {
  hidden: { opacity: 0, x: 80 },
  visible: { opacity: 1, x: 0 },
};

export function FeatureSection({
  label,
  heading,
  body,
  cta,
  ctaHref,
  reverse = false,
  children,
  onNavigate,
}: FeatureSectionProps) {
  const textVariant = reverse ? slideInRight : fadeUp;

  return (
    <section className="feature-section-wrapper">
      <div
        className="feature-section-inner"
        style={{ flexDirection: reverse ? "row-reverse" : "row" }}
      >
        {/* Text side */}
        <motion.div
          className="feature-section-text"
          variants={textVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <span className="feature-label">{label}</span>
          <h2 className="feature-heading">{heading}</h2>
          <p className="feature-body">{body}</p>
          <button
            type="button"
            className="feature-cta"
            onClick={() => onNavigate(ctaHref)}
          >
            {cta}
          </button>
        </motion.div>

        {/* Visual side */}
        <motion.div
          className="feature-section-visual"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}
