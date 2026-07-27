import { Mail, Phone, MapPin, Instagram, Linkedin, Facebook, Youtube, MapPinned } from "lucide-react";
import webmarcasLogoMark from "@/assets/webmarcas-logo-mark.webp";
import reclameAquiBadge from "@/assets/reclame-aqui-badge.webp";
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
    <footer className="footer-branded border-t border-white/10">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <a href="#home" className="flex items-center gap-2 mb-4">
              <img
                src={webmarcasLogoMark}
                alt="WebMarcas"
                className="h-10 w-auto brightness-0 invert"
              />
              <span className="font-display text-xl font-bold text-white">
                WebMarcas <span className="text-white/70">Intelligence PI</span>
              </span>
            </a>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              {t("footer.description")}
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://api.whatsapp.com/send/?phone=5511911120225&text=Ol%C3%A1%21+Estava+no+site+da+WebMarcas+e+quero+registrar+minha+marca.&type=phone_number&app_absent=0"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp WebMarcas"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[hsl(var(--brand-orange))] transition-all"
              >
                <Phone className="w-5 h-5" />
              </a>
              <a
                href="mailto:ola@webmarcas.net"
                aria-label="E-mail WebMarcas"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[hsl(var(--brand-orange))] transition-all"
              >
                <Mail className="w-5 h-5" />
              </a>
              <a
                href="https://www.instagram.com/webpatentes"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram WebMarcas"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[hsl(var(--brand-orange))] transition-all"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.linkedin.com/in/web-marcas-5248a819b"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn WebMarcas"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[hsl(var(--brand-orange))] transition-all"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/share/1HXVYGsfQc/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook WebMarcas"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[hsl(var(--brand-orange))] transition-all"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://youtube.com/@webmarcas1282"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube WebMarcas"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[hsl(var(--brand-orange))] transition-all"
              >
                <Youtube className="w-5 h-5" />
              </a>
              <a
                href="https://share.google/zkMBxa8NWw67Vobty"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Google Meu Negócio WebMarcas"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[hsl(var(--brand-orange))] transition-all"
              >
                <MapPinned className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-semibold mb-4 text-white">{t("footer.quickLinks")}</h4>
            <ul className="space-y-3">
              {quickLinks.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-white/70 hover:text-[hsl(var(--brand-orange))] transition-colors text-sm"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-semibold mb-4 text-white">{t("footer.services")}</h4>
            <ul className="space-y-3">
              {services.map((item) => (
                <li key={item.label}>
                  {item.href.startsWith("/") ? (
                    <Link
                      to={item.href}
                      className="text-white/70 hover:text-[hsl(var(--brand-orange))] transition-colors text-sm"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      href={item.href}
                      className="text-white/70 hover:text-[hsl(var(--brand-orange))] transition-colors text-sm"
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
            <h4 className="font-display font-semibold mb-4 text-white">{t("footer.contact")}</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-white/70">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Av. Brigadeiro Luís Antônio, 2696<br />Jardim Paulista — São Paulo/SP<br />CEP 01402-000</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-white/70">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>(11) 91112-0225</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-white/70">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>ola@webmarcas.net</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/60 text-center md:text-left">
              © {new Date().getFullYear()} WebMarcas Intelligence PI · CNPJ 39.528.012/0001-29. {t("footer.rights")}
            </p>
            <div className="flex items-center gap-6">
              <Link to="/privacidade" className="text-sm text-white/60 hover:text-white transition-colors">
                {t("footer.privacy")}
              </Link>
              <Link to="/termos-de-uso" className="text-sm text-white/60 hover:text-white transition-colors">
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
