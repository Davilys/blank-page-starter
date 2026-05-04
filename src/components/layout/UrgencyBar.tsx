import { useEffect, useState } from "react";
import { X } from "lucide-react";

const UrgencyBar = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("wm_urgency_dismissed");
    if (dismissed !== "1") {
      setVisible(true);
      document.documentElement.style.setProperty("--urgency-h", "40px");
    }
    return () => {
      document.documentElement.style.setProperty("--urgency-h", "0px");
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem("wm_urgency_dismissed", "1");
    document.documentElement.style.setProperty("--urgency-h", "0px");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center text-white text-[13px] sm:text-sm wm-font-body px-10"
      style={{ background: "var(--wm-accent)", height: 40 }}
      role="status"
    >
      <span className="hidden sm:inline">
        ⚡ Protocolo em até 48h · Processo 100% online · Mais de 5.000 marcas registradas
      </span>
      <span className="sm:hidden text-center">
        ⚡ Registro 100% online — Protocolo em 48h
      </span>
      <button
        aria-label="Fechar"
        onClick={dismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/15 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UrgencyBar;