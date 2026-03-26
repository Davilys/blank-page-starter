import { Mail, Phone, MapPin } from "lucide-react";
import webmarcasLogoMark from "@/assets/webmarcas-logo-mark.png";
import { Link } from "react-router-dom";

import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  const quickLinks = [
    { label: t("nav.home"), href: "#home" },
    { label: t("nav.benefits"), href: "#beneficios" },
    { label: t("nav.howItWorks"), href: "#como-funciona" },
    { label: t("nav.pricing"), href: "#precos" },
    { label: t("nav.faq"), href: "#faq" },
  ];

  const services = [
    { label: t("footer.service1"), href: "#" },
    { label: t("footer.service2"), href: "#" },
    { label: t("footer.service3"), href: "#" },
    { label: t("footer.service4"), href: "#" },
    { label: t("footer.service5"), href: "#" },
    { label: "Registro em Blockchain", href: "/registro-blockchain" },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <a href="#home" className="flex items-center gap-2 mb-4">
              <img
                src={webmarcasLogoMark}
                alt="WebMarcas"
                className="h-10 w-auto mix-blend-multiply dark:mix-blend-screen dark:invert"
              />
              <span className="font-display text-xl font-bold">
                WebMarcas <span className="gradient-text">Intelligence PI</span>
              </span>
            </a>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {t("footer.description")}
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://api.whatsapp.com/send/?phone=5511911120225&text=Ol%C3%A1%21+Estava+no+site+da+WebMarcas+e+quero+registrar+minha+marca.&type=phone_number&app_absent=0"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              >
                <Phone className="w-5 h-5" />
              </a>
              <a
                href="mailto:ola@webmarcas.net"
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t("footer.quickLinks")}</h4>
            <ul className="space-y-3">
              {quickLinks.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t("footer.services")}</h4>
            <ul className="space-y-3">
              {services.map((item) => (
                <li key={item.label}>
                  {item.href.startsWith("/") ? (
                    <Link
                      to={item.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t("footer.contact")}</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>São Paulo - SP, Brasil</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>(11) 91112-0225</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>ola@webmarcas.net</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © {new Date().getFullYear()} WebMarcas Intelligence PI. {t("footer.rights")}
            </p>
            <div className="flex items-center gap-6">
              <Link to="/politica-de-privacidade" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.privacy")}
              </Link>
              <Link to="/termos-de-uso" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.terms")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
