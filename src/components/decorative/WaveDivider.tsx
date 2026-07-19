interface WaveDividerProps {
  className?: string;
  fill?: string;
  flip?: boolean;
}

/**
 * Decorative SVG wave used between colored sections.
 */
const WaveDivider = ({
  className = "",
  fill = "hsl(var(--background))",
  flip = false,
}: WaveDividerProps) => {
  return (
    <div
      className={`w-full leading-[0] ${className}`}
      style={{ transform: flip ? "rotate(180deg)" : undefined }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className="w-full h-[60px] md:h-[90px] block"
      >
        <path
          fill={fill}
          d="M0,64 C240,96 480,32 720,48 C960,64 1200,96 1440,48 L1440,90 L0,90 Z"
        />
      </svg>
    </div>
  );
};

export default WaveDivider;