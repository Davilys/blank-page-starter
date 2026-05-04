import { ArrowDown } from "lucide-react";

interface Props {
  targetId?: string;
  label?: string;
}

const StickyMobileCta = ({ targetId = "wm-viability-form", label = "Verificar minha marca grátis" }: Props) => {
  const scroll = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-background/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <button
        onClick={scroll}
        className="wm-cta w-full flex items-center justify-center gap-2 px-5 py-3 text-base"
      >
        {label} <ArrowDown className="w-4 h-4" />
      </button>
    </div>
  );
};

export default StickyMobileCta;