import { useState, useEffect } from "react";
import webmarcasLogoMark from "@/assets/webmarcas-logo-mark.png";
import { Menu, X, Moon, Sun, Globe } from "lucide-react";
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
          ? "md:bg-background/80 md:backdrop-blur-xl md:border-b md:border-border bg-transparent"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between h-14 md:h-16 lg:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-1.5 md:gap-2">
            <img
              src={webmarcasLogoMark}
              alt="WebMarcas"
              className="h-9 md:h-11 w-auto shrink-0"
            />
            <span className="font-display text-lg md:text-xl font-bold">
              WebMarcas <span className="gradient-text">Intelligence PI</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              item.isRoute ? (
                <Link
                  key={item.label}
                  to={item.href}
                  className="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors rounded-lg hover:bg-primary/10"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={isHomePage ? item.href : `/${item.href}`}
                  onClick={(e) => handleAnchorClick(e, item.href)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
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

            <Button variant="ghost" size="sm" asChild>
              <Link to="/cliente/login">{t("nav.clientArea")}</Link>
            </Button>
            <Button variant="primary" size="sm" className="btn-glow" asChild>
              <a href={isHomePage ? "#consultar" : "/#consultar"} onClick={(e) => handleAnchorClick(e, "#consultar")}>{t("nav.checkBrand")}</a>
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
              className="w-9 h-9"
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
              className="p-2 text-foreground"
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
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border animate-fade-in">
          <nav className="container mx-auto px-3 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              item.isRoute ? (
                <Link
                  key={item.label}
                  to={item.href}
                  className="px-4 py-3 font-medium text-primary hover:text-primary/80 transition-colors rounded-xl hover:bg-primary/10 touch-target"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={isHomePage ? item.href : `/${item.href}`}
                  onClick={(e) => { handleAnchorClick(e, item.href); setIsMobileMenuOpen(false); }}
                  className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary touch-target"
                >
                  {item.label}
                </a>
              )
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
              <Button variant="ghost" className="justify-start touch-target" asChild>
                <Link to="/cliente/login">{t("nav.clientArea")}</Link>
              </Button>
              <Button variant="primary" className="btn-glow touch-target" asChild>
                <a href={isHomePage ? "#consultar" : "/#consultar"} onClick={(e) => { handleAnchorClick(e, "#consultar"); setIsMobileMenuOpen(false); }}>{t("nav.checkBrand")}</a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
