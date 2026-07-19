import { motion } from "framer-motion";

interface ScribbleUnderlineProps {
  className?: string;
  color?: string;
  strokeWidth?: number;
}

/**
 * Decorative hand-drawn scribble SVG used to underline hero keywords.
 * Absolute positioned — parent must be relative.
 */
const ScribbleUnderline = ({
  className = "",
  color = "hsl(var(--brand-orange))",
  strokeWidth = 6,
}: ScribbleUnderlineProps) => {
  return (
    <svg
      viewBox="0 0 300 30"
      fill="none"
      preserveAspectRatio="none"
      className={`absolute left-0 right-0 -bottom-2 w-full h-[0.35em] pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <motion.path
        d="M4 18 C 40 6, 80 26, 120 14 S 200 24, 240 12 S 292 20, 296 14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, delay: 0.4, ease: "easeInOut" }}
      />
    </svg>
  );
};

export default ScribbleUnderline;