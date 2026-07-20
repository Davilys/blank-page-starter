import { cn } from "@/lib/utils";

interface Seal48hProps {
  className?: string;
  size?: number;
}

/**
 * Selo circular animado "48h · WEBMARCAS · INPI · REGISTRO".
 * SVG puro, fundo transparente, texto circular girando lentamente.
 */
const Seal48h = ({ className, size = 160 }: Seal48hProps) => {
  return (
    <div
      className={cn("relative pointer-events-none select-none", className)}
      style={{ width: size, height: size }}
      aria-label="Registro no INPI em 48 horas"
    >
      {/* Anel externo com texto circular girando */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full animate-[spin_22s_linear_infinite]"
      >
        <defs>
          <path
            id="seal-circle"
            d="M 100,100 m -78,0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0"
          />
        </defs>
        <text
          fill="#ffffff"
          style={{
            fontFamily: "'Public Sans', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: "15px",
            letterSpacing: "3.4px",
          }}
        >
          <textPath href="#seal-circle" startOffset="0">
            WEBMARCAS · INPI · REGISTRO ·  WEBMARCAS · INPI · REGISTRO ·
          </textPath>
        </text>
      </svg>

      {/* Disco central laranja com check e 48h */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <radialGradient id="seal-orange" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#ff9a4d" />
            <stop offset="60%" stopColor="#ed8534" />
            <stop offset="100%" stopColor="#d96a1c" />
          </radialGradient>
          <filter id="seal-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0b163c" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* corpo do selo */}
        <circle
          cx="100"
          cy="100"
          r="62"
          fill="url(#seal-orange)"
          filter="url(#seal-shadow)"
        />

        {/* borda pontilhada interna */}
        <circle
          cx="100"
          cy="100"
          r="55"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeDasharray="1.5 4"
        />

        {/* check */}
        <path
          d="M 78 88 L 94 104 L 122 74"
          fill="none"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />

        {/* 48h */}
        <text
          x="100"
          y="132"
          textAnchor="middle"
          fill="#ffffff"
          style={{
            fontFamily: "'Public Sans', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: "26px",
            letterSpacing: "-0.5px",
          }}
        >
          48h
        </text>
      </svg>
    </div>
  );
};

export default Seal48h;