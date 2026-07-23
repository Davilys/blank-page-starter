import { useState, useEffect } from "react";
import webmarcasLogoMark from "@/assets/webmarcas-logo-mark.webp";
import { Menu, X, Phone, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation, useNavigate } from "react-router-dom";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const isHomePage = location.pathname === '/' || location.pathname === '/registrar';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, anchor: string) => {
    // Route links (start with "/") should navigate normally, not scroll.
    if (anchor.startsWith('/')) {
      e.preventDefault();
      navigate(anchor);
      return;
    }
    e.preventDefault();
    if (isHomePage) {
      const el = document.querySelector(anchor);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/' + anchor);
    }
  };

  const navItems = [
    { label: "Início", href: "#home", isRoute: false },
    { label: "Como funciona", href: "#como-funciona", isRoute: false },
    { label: "Diferenciais", href: "#beneficios", isRoute: false },
    { label: "Registrar", href: "/registrar", isRoute: true },
    { label: "FAQ", href: "#faq", isRoute: false },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 safe-area-top ${
        isScrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent header-on-blue"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-20 lg:h-24 gap-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src={webmarcasLogoMark}
              alt="WebMarcas"
              width={48}
              height={48}
              fetchPriority="high"
              decoding="async"
              className={`h-10 md:h-12 w-auto shrink-0 ${!isScrolled && isHomePage ? "brightness-0 invert" : ""}`}
            />
            <div className="leading-tight">
              <div className={`font-display text-xl md:text-2xl font-black tracking-tight ${!isScrolled && isHomePage ? "text-white" : "text-foreground"}`}>
                Web<span className={!isScrolled && isHomePage ? "text-white" : "text-primary"}>Marcas</span>
              </div>
              <div className={`text-[9px] md:text-[10px] font-bold tracking-[0.18em] ${!isScrolled && isHomePage ? "text-white/70" : "text-muted-foreground"}`}>
                INTELLIGENCE PI · INPI
              </div>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.isRoute ? item.href : (isHomePage ? item.href : `/${item.href}`)}
                  onClick={(e) => handleAnchorClick(e, item.href)}
                  className={`px-3 py-2 text-sm font-semibold transition-colors rounded-lg whitespace-nowrap ${
                    !isScrolled && isHomePage
                      ? "text-white/90 hover:text-white hover:bg-white/10"
                      : "text-foreground/80 hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  {item.label}
                </a>
            ))}
          </nav>

          {/* Desktop CTA + Controls */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            {/* Phone contact block — only on blue hero */}
            <a href="tel:+551191112025" className="hidden 2xl:flex items-center gap-2.5 pr-2">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center ${!isScrolled && isHomePage ? "bg-white/15" : "bg-primary/10"}`}>
                <Phone className={`w-4 h-4 ${!isScrolled && isHomePage ? "text-white" : "text-primary"}`} strokeWidth={2.4} />
              </span>
              <div className={`leading-tight ${!isScrolled && isHomePage ? "text-white" : "text-foreground"}`}>
                <div className="text-[9px] font-bold tracking-[0.18em] opacity-70">FALE CONOSCO</div>
                <div className="text-sm font-extrabold">(11) 91112-0225</div>
              </div>
            </a>

            <Button
              size="sm"
              className="rounded-full px-5 h-11 text-[11px] font-extrabold tracking-widest uppercase text-white shadow-[0_10px_20px_-6px_hsla(20,100%,50%,0.55)] hover:brightness-105"
              style={{ background: "linear-gradient(180deg, hsl(20 100% 55%), hsl(14 100% 50%))" }}
              asChild
            >
              <a href={isHomePage ? "#consultar" : "/#consultar"} onClick={(e) => handleAnchorClick(e, "#consultar")}>
                Consultar minha marca <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className={`rounded-full px-5 h-11 text-[11px] font-extrabold tracking-widest uppercase gap-1.5 border-2 ${
                !isScrolled && isHomePage
                  ? "border-white text-white bg-transparent hover:bg-white/10 hover:text-white"
                  : "border-primary text-primary hover:bg-primary/5"
              }`}
              asChild
            >
              <Link to="/cliente/login">
                <User className="w-3.5 h-3.5" /> Área do cliente
              </Link>
            </Button>
          </div>

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Menu Button */}
            <button
              className={`p-2 rounded-full transition-colors ${
                !isScrolled && isHomePage
                  ? "text-white bg-white/10 hover:bg-white/20"
                  : "text-foreground hover:bg-secondary"
              }`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white/98 backdrop-blur-xl border-b border-border animate-fade-in shadow-xl">
          <nav className="container mx-auto px-3 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.isRoute ? item.href : (isHomePage ? item.href : `/${item.href}`)}
                  onClick={(e) => { handleAnchorClick(e, item.href); setIsMobileMenuOpen(false); }}
                  className="px-4 py-3 text-[hsl(222_40%_25%)] hover:text-[hsl(222_92%_54%)] transition-colors rounded-xl hover:bg-[hsl(220_33%_96%)] touch-target font-medium"
                >
                  {item.label}
                </a>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
              <a
                href={isHomePage ? "#consultar" : "/#consultar"}
                onClick={(e) => { handleAnchorClick(e, "#consultar"); setIsMobileMenuOpen(false); }}
                className="btn-solid-orange touch-target"
              >
                Consultar minha marca <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to="/cliente/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="btn-outline-blue touch-target"
              >
                <User className="w-4 h-4" /> Área do cliente
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
