import { Moon, Sun, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import logo from "@/assets/webmarcas-logo.png";

const MinimalHeader = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <header
      className="fixed left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border"
      style={{ top: "var(--urgency-h, 0px)" }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-[60px]">
          <a href="/" className="flex items-center gap-2 group">
            <img src={logo} alt="WebMarcas" className="h-9 md:h-10 transition-transform group-hover:scale-105" />
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20registrar%20minha%20marca"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border hover:bg-secondary transition"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Falar com especialista
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg"
              aria-label="Alternar tema"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MinimalHeader;