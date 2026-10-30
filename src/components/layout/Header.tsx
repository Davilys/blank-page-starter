import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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

  const isHomePage = location.pathname === '/' || location.pathname === '/consultar';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobileMenuOpen]);

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
    { label: "Consultar", href: "/consultar", isRoute: true },
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
                Web<span className={!isScrolled && isHomePage ? "text-white" : "text-primary"}>Marcas</span><span className="text-primary">.</span>
              </div>
              <div className={`hidden md:block text-[9px] md:text-[10px] font-bold tracking-[0.18em] ${!isScrolled && isHomePage ? "text-white/70" : "text-muted-foreground"}`}>
                INTELLIGENCE PI · INPI
              </div>
            </div>
          </a>

          <a
            href="https://api.whatsapp.com/send/?phone=5511911120225&text=Ol%C3%A1%21+Estava+no+site+da+WebMarcas+e+quero+registrar+minha+marca.&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex md:hidden items-center gap-1.5 rounded-full bg-[#20ce60] text-[#102c1a] text-[10px] font-medium px-2.5 py-2 min-h-[32px] whitespace-nowrap shrink-0"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.91 11.91 0 0012.04 0C5.46 0 .1 5.35.1 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.24-1.64a11.9 11.9 0 005.8 1.48h.01C18.63 23.84 24 18.49 24 11.9c0-3.19-1.24-6.18-3.48-8.42zM12.05 21.83h-.01a9.9 9.9 0 01-5.05-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.88 9.88 0 01-1.52-5.29C2.16 6.47 6.59 2.04 12.05 2.04a9.83 9.83 0 017 2.9 9.83 9.83 0 012.89 7c0 5.45-4.44 9.89-9.89 9.89zm5.42-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.08 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.69.25-1.29.18-1.41-.08-.12-.28-.2-.57-.35z" /></svg>
            Falar no WhatsApp
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

      {/* Mobile Menu — padrao full-screen (pedido 02:42) */}
      {isMobileMenuOpen && createPortal(
        <div className="wm-mobile-menu md:hidden" role="dialog" aria-label="Menu">
          <div className="wmm-top">
            <a href="/" className="wmm-brand" onClick={() => setIsMobileMenuOpen(false)}>
              <img src={webmarcasLogoMark} alt="WebMarcas" className="wmm-logo" width={40} height={40} />
              <span className="wmm-word">WebMarcas.</span>
            </a>
            <button className="wmm-close" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fechar menu">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="wmm-nav">
            {[
              { label: "Início", href: "#home", isRoute: false },
              { label: "Como funciona", href: "#como-funciona", isRoute: false },
              { label: "Diferenciais", href: "#beneficios", isRoute: false },
              { label: "Consultar marca", href: "/consultar", isRoute: true },
              { label: "FAQ", href: "#faq", isRoute: false },
              { label: "Blog", href: "/blog", isRoute: true },
              { label: "Área do Cliente", href: "/cliente/login", isRoute: true },
            ].map((item) => (
              <a
                key={item.label}
                href={item.isRoute ? item.href : (isHomePage ? item.href : `/${item.href}`)}
                onClick={(e) => { handleAnchorClick(e, item.href); setIsMobileMenuOpen(false); }}
                className="wmm-item"
              >
                <span>{item.label}</span>
                <ArrowRight className="wmm-arrow" />
              </a>
            ))}
          </nav>
          <div className="wmm-foot">
            <img src={webmarcasLogoMark} alt="" className="wmm-logo-w" width={30} height={30} />
            <span>WebMarcas</span>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default Header;
