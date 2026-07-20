import { cn } from "@/lib/utils";

interface Seal48hProps {
  className?: string;
  size?: number;
  mainText?: string;
  subText?: string;
}

/**
 * Selo circular animado "48h · WEBMARCAS · INPI · REGISTRO".
 * SVG puro, fundo transparente, texto circular girando lentamente.
 */
const Seal48h = ({ className, size = 160, mainText = "48h", subText = "NO INPI" }: Seal48hProps) => {
  return (
    <div
      className={cn("relative pointer-events-none select-none", className)}
      style={{ width: size, height: size, contain: "layout paint style", willChange: "transform" }}
      aria-label="Registro no INPI em 48 horas"
    >
      {/* Base: disco branco + borda azul-claro + sombra suave */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="seal-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0b163c" floodOpacity="0.22" />
          </filter>
        </defs>
        <circle cx="100" cy="100" r="94" fill="#ffffff" filter="url(#seal-shadow)" />
        <circle cx="100" cy="100" r="94" fill="none" stroke="#005fe6" strokeOpacity="0.18" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="72" fill="none" stroke="#005fe6" strokeOpacity="0.12" strokeWidth="1" />
      </svg>

      {/* Anel externo APENAS com texto circular girando */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full animate-[spin_22s_linear_infinite]"
        style={{ transformOrigin: "50% 50%" }}
      >
        <defs>
          <path
            id="seal-ring-path"
            d="M 100,100 m -82,0 a 82,82 0 1,1 164,0 a 82,82 0 1,1 -164,0"
          />
        </defs>
        <text
          fill="#005fe6"
          style={{
            fontFamily: "'Public Sans', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: "12.5px",
            letterSpacing: "3.2px",
            textTransform: "uppercase",
          }}
        >
          <textPath href="#seal-ring-path" startOffset="0">
            PROTOCOLO EM 48H • REGISTRO NO INPI • PROTOCOLO EM 48H • REGISTRO NO INPI •
          </textPath>
        </text>
      </svg>

      {/* Centro ESTÁTICO: ícone laranja + 48h + NO INPI */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        {/* raio laranja (check) no topo */}
        <g transform="translate(100 62)">
          <circle r="14" fill="#ed8534" />
          <path
            d="M -6 0 L -1 6 L 7 -5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* 48h em azul */}
        <text
          x="100"
          y="120"
          textAnchor="middle"
          fill="#005fe6"
          style={{
            fontFamily: "'Public Sans', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: "38px",
            letterSpacing: "-1px",
          }}
        >
          {mainText}
        </text>

        {/* NO INPI */}
        <text
          x="100"
          y="140"
          textAnchor="middle"
          fill="#005fe6"
          style={{
            fontFamily: "'Public Sans', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: "11px",
            letterSpacing: "3px",
          }}
        >
          {subText}
        </text>
      </svg>
    </div>
  );
};

export default Seal48h;