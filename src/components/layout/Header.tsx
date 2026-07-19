import { useState, useEffect } from "react";
import webmarcasLogoMark from "@/assets/webmarcas-logo-mark.png";
import { Menu, X, Moon, Sun, Globe, Phone, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, anchor: string) => {
    e.preventDefault();
    if (isHomePage) {
      const el = document.querySelector(anchor);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/' + anchor);
    }
  };

  const navItems = [
    { label: t("nav.home"), href: "#home", external: false, isRoute: false },
    { label: t("nav.benefits"), href: "#beneficios", external: false, isRoute: false },
    { label: t("nav.howItWorks"), href: "#como-funciona", external: false, isRoute: false },
    { label: t("nav.pricing"), href: "#precos", external: false, isRoute: false },
    { label: "Blog", href: "/blog", external: false, isRoute: true },
    { label: t("nav.faq"), href: "#faq", external: false, isRoute: false },
    { label: t("nav.register"), href: "/registrar", external: false, isRoute: true },
  ];

  const currentLang = languages.find((l) => l.code === language);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 safe-area-top ${
        isScrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent header-on-blue"
      }`}
    >
      <div className="container mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between h-14 md:h-16 lg:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-1.5 md:gap-2">
            <img
              src={webmarcasLogoMark}
              alt="WebMarcas"
              className={`h-9 md:h-11 w-auto shrink-0 ${!isScrolled && isHomePage ? "brightness-0 invert" : ""}`}
            />
            <span className={`font-display text-lg md:text-xl font-bold ${!isScrolled && isHomePage ? "text-white" : ""}`}>
              WebMarcas <span className={!isScrolled && isHomePage ? "text-white/80" : "gradient-text"}>Intelligence PI</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              item.isRoute ? (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                    !isScrolled && isHomePage
                      ? "text-white hover:text-white/80 hover:bg-white/10"
                      : "text-primary hover:text-primary/80 hover:bg-primary/10"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={isHomePage ? item.href : `/${item.href}`}
                  onClick={(e) => handleAnchorClick(e, item.href)}
                  className={`px-4 py-2 text-sm transition-colors rounded-lg ${
                    !isScrolled && isHomePage
                      ? "text-white/85 hover:text-white hover:bg-white/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {item.label}
                </a>
              )
            ))}
          </nav>

          {/* Desktop CTA + Controls */}
          <div className="hidden md:flex items-center gap-2">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9">
                  <span className="text-lg">{currentLang?.flag}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={language === lang.code ? "bg-secondary" : ""}
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="w-9 h-9"
              aria-label="Alternar tema"
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </Button>

            {/* Phone contact block — only on blue hero */}
            {!isScrolled && isHomePage && (
              <div className="hidden lg:flex items-center gap-2 pl-2 pr-3 mr-1 border-l border-white/20">
                <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" strokeWidth={2.4} />
                </span>
                <div className="leading-tight text-white">
                  <div className="text-[10px] font-bold tracking-widest opacity-80">FALE CONOSCO</div>
                  <div className="text-sm font-bold">(11) 91112-0225</div>
                </div>
              </div>
            )}

            <Button
              size="sm"
              className="rounded-full px-5 h-10 text-[11px] font-extrabold tracking-widest uppercase text-white shadow-[0_10px_20px_-6px_hsla(20,100%,50%,0.55)] hover:brightness-105"
              style={{ background: "linear-gradient(180deg, hsl(20 100% 55%), hsl(14 100% 50%))" }}
              asChild
            >
              <a href={isHomePage ? "#consultar" : "/#consultar"} onClick={(e) => handleAnchorClick(e, "#consultar")}>
                {t("nav.checkBrand")} <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className={`rounded-full px-5 h-10 text-[11px] font-extrabold tracking-widest uppercase gap-1 ${
                !isScrolled && isHomePage
                  ? "border-white/70 text-white bg-transparent hover:bg-white/10 hover:text-white"
                  : "border-primary/40 text-primary hover:bg-primary/5"
              }`}
              asChild
            >
              <Link to="/cliente/login">
                <User className="w-3.5 h-3.5" /> {t("nav.clientArea")}
              </Link>
            </Button>
          </div>

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center gap-2">
            {/* Language Selector Mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9">
                  <span className="text-lg">{currentLang?.flag}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={language === lang.code ? "bg-secondary" : ""}
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle Mobile */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={`w-9 h-9 ${!isScrolled && isHomePage ? "text-white hover:bg-white/10 hover:text-white" : ""}`}
              aria-label="Alternar tema"
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </Button>

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
              item.isRoute ? (
                <Link
                  key={item.label}
                  to={item.href}
                  className="px-4 py-3 font-semibold text-[hsl(222_92%_54%)] hover:text-[hsl(226_95%_42%)] transition-colors rounded-xl hover:bg-[hsl(222_92%_54%)]/10 touch-target"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={isHomePage ? item.href : `/${item.href}`}
                  onClick={(e) => { handleAnchorClick(e, item.href); setIsMobileMenuOpen(false); }}
                  className="px-4 py-3 text-[hsl(222_40%_25%)] hover:text-[hsl(222_92%_54%)] transition-colors rounded-xl hover:bg-[hsl(220_33%_96%)] touch-target font-medium"
                >
                  {item.label}
                </a>
              )
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
              <a
                href={isHomePage ? "#consultar" : "/#consultar"}
                onClick={(e) => { handleAnchorClick(e, "#consultar"); setIsMobileMenuOpen(false); }}
                className="btn-solid-orange touch-target"
              >
                {t("nav.checkBrand")} <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to="/cliente/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="btn-outline-blue touch-target"
              >
                <User className="w-4 h-4" /> {t("nav.clientArea")}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
