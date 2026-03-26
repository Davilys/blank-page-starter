import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CheckCircle, TrendingUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

// Lista de clientes reais que já registraram marcas (dados públicos, sem duplicações)
const realClientBrands = [
  { name: "Elias Antonio", brand: "BLUE FITNESS MANUTENÇÃO" },
  { name: "Jonatan Santana Costa", brand: "ACQUA LIFE NATAÇÃO" },
  { name: "Isaque Lopes de Oliveira", brand: "Altilar Encartelados" },
  { name: "Leosmar Martins da Fonseca", brand: "Amada Pizza Artesanal" },
  { name: "Luciane Barbosa Becker", brand: "Angelo Alves" },
  { name: "Angelo Alves", brand: "Apito Lito" },
  { name: "Bruno Miranda Alcântara", brand: "Barbearia Charlotte" },
  { name: "Johny do Carmo Ferreira", brand: "BH Polimento" },
  { name: "Julio Duamel Omar Fuertes", brand: "Bomba Atômica H2" },
  { name: "Raimundo Borges Campos", brand: "Borges Ind. Embalagens" },
  { name: "Fabiana Julio Pereira", brand: "Boutique do Luxo" },
  { name: "Alexsandra Pereira da Silva", brand: "Brinquedos Carijó" },
  { name: "Edivaldo Maués Carvalho Filho", brand: "Canapura da Amazônia" },
  { name: "Eduardo Albuquerque dos Santos", brand: "Carioca's King" },
  { name: "Cássio Marques Marchesini", brand: "Carro de Playboy" },
  { name: "Renan Racanicchi Tura", brand: "Casa Touro" },
  { name: "Cláudio Henrique Pinto Gonçalves", brand: "Cláudio Henrique Advogados" },
  { name: "Cleberson Cardoso", brand: "Col-6" },
  { name: "João Paulo Gomes Bastos", brand: "Crepes Macaquito" },
  { name: "Cristian Omar Yahari Franco", brand: "Yahari Consultoria" },
  { name: "Daniella Santos", brand: "Daniella Santos Estética" },
  { name: "Diogo Luiz Zago", brand: "Zago Engenharia" },
  { name: "Danilo Queiroz Fernandes", brand: "Drogaria Dr. Farma" },
  { name: "Isamara Corrêa Lemos", brand: "E'Leve Saúde Integrada" },
  { name: "Ediana Andrade da Paixão", brand: "Ediana Moda" },
  { name: "Ederson Pivetta", brand: "Edinho Som" },
  { name: "Maria de Fátima dos Santos", brand: "Empório da Limpeza QTudo" },
  { name: "Francisco Eugênio Lourenço", brand: "Espaia Forró" },
  { name: "Felipe Melo Nascimento", brand: "Felipe Melo Advocacia" },
  { name: "Dieny Bárbara Sales Batista Souza", brand: "Fênix Suplementos" },
  { name: "Moises Rocha Guedes", brand: "Fio Bronzeado" },
  { name: "Luciano Grilo Almendro", brand: "Galera da Pizza" },
  { name: "Gilson Pereira da Silva", brand: "Guerreiros Rota 070" },
  { name: "Ivanildo Gomes Peixoto", brand: "Help Info e Segurança" },
  { name: "Albanir Antônio", brand: "Holos Cristais" },
  { name: "Jean Lima dos Santos", brand: "Igreja Plenitude" },
  { name: "Mariana Valiongo da Silva", brand: "Império Pizzaria" },
  { name: "Tiago Silva Dias", brand: "Infinity Plastic" },
  { name: "Juracy Sousa Vieira", brand: "JS Glasses" },
  { name: "Karine de Campos Monteiro", brand: "Karine Estética" },
  { name: "Wiliam José Macharutto", brand: "Koraly Imobiliária" },
  { name: "Sérgio Paulo Silvestre", brand: "LabRetail" },
  { name: "Elessandro da Silva Canedo", brand: "Le Modas" },
  { name: "Elton Vieira da Silva", brand: "LIVETEC Telecom" },
  { name: "Luan Lucas Cuochinski Daniel", brand: "Luan Consultoria" },
  { name: "Maiara Rodrigues Manso Cardoso", brand: "Maiara Moda Feminina" },
  { name: "Manoel Luiz Alves da Silva", brand: "Manoel Luiz Advocacia" },
  { name: "Newton Xisto de Oliveira", brand: "Newton Xisto e Gxe" },
  { name: "Marcelo José Dietrich", brand: "Dietrich Arquitetura" },
  { name: "Maria das Graças Bernardino", brand: "Graças Artesanato" },
  { name: "Mariany Gabrielle Araújo", brand: "Mariany Design" },
  { name: "Gilson Ribeiro", brand: "Menino Bao" },
  { name: "Osvaldo Welhington Nogueira", brand: "Meta Gestão Empresarial" },
  { name: "Michel Luiz de Freitas Proença", brand: "Michel Proença Coaching" },
  { name: "William Mourabito Pereira", brand: "MW Elétrica e Manutenção" },
  { name: "Marcos Henrique dos Santos", brand: "My Heels" },
  { name: "José Jacinto de Souza", brand: "Playce FM" },
  { name: "Adriana Glória Soares", brand: "Pousada Odoyá Beach" },
  { name: "Rodrigo Xavier de Paula", brand: "Projeção Legado" },
  { name: "Hourivaldo Andrade Alves", brand: "Projeto Gospel" },
  { name: "Leandro Farias Ferreira", brand: "Prospere Farma" },
  { name: "Rafael Bettini", brand: "Rafael Bettini Fitness" },
  { name: "Jorge Luis Dantas", brand: "Restaurante Mineiro Lenhador" },
  { name: "Airton Pagnussat", brand: "Ritual Ink" },
  { name: "Marileide Martins de Brito", brand: "SilkSync Profissional" },
  { name: "Sayoneri Lucena de Sena", brand: "Sirius Solar" },
  { name: "Renato Araujo Leite", brand: "SK8 Only" },
  { name: "Wanderlei Antônio de Oliveira", brand: "Sorvete Encantado" },
  { name: "Lais Emanuele Zaboenco Coimbra", brand: "Sr. Batata" },
  { name: "Susana Almeida Coelho do Carmo", brand: "Susana Almeida Moda" },
  { name: "Graziela Vitor de Souza", brand: "TL Tok Limp" },
  { name: "Lucas Silvestre da Rosa", brand: "Veross" },
  { name: "Wagner Lopes da Costa", brand: "Wagner Lopes Advocacia" },
  { name: "Felipe Smith", brand: "YHWH" },
];

// Extract names and brands for fallback simulated notifications
const simulatedNames = realClientBrands.map(c => c.name.split(' ')[0]);
const simulatedBrands = realClientBrands.map(c => c.brand);

// Generic names to use with real brand data (privacy)
const genericNames = [
  "Um cliente", "Alguém", "Uma empresa", "Um empreendedor", "Um usuário"
];

interface Notification {
  id: number;
  message: string;
  icon: "check" | "shield" | "trending";
}

interface RealSearch {
  brand_name: string;
  business_area: string;
}

type NotificationKey = string;

const SocialProofNotification = () => {
  const { t } = useLanguage();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [lastNameIndex, setLastNameIndex] = useState(-1);
  const [notificationCount, setNotificationCount] = useState(0);
  const [realSearches, setRealSearches] = useState<RealSearch[]>([]);

  // Prevent repetitive notifications (especially when there are few items)
  const recentlyShownRef = useRef<Map<NotificationKey, number>>(new Map());
  const RECENT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  const RECENT_MAX = 12;

  const makeKey = useCallback((brand: string, area: string) => {
    return `${brand.trim().toLowerCase()}|${area.trim().toLowerCase()}`;
  }, []);

  const recordShown = useCallback((key: NotificationKey) => {
    const now = Date.now();
    const map = recentlyShownRef.current;

    // purge expired
    for (const [k, ts] of map.entries()) {
      if (now - ts > RECENT_COOLDOWN_MS) map.delete(k);
    }

    map.set(key, now);

    // cap size
    if (map.size > RECENT_MAX) {
      const oldest = [...map.entries()].sort((a, b) => a[1] - b[1])[0];
      if (oldest) map.delete(oldest[0]);
    }
  }, []);

  const isRecentlyShown = useCallback((key: NotificationKey) => {
    const ts = recentlyShownRef.current.get(key);
    if (!ts) return false;
    return Date.now() - ts <= RECENT_COOLDOWN_MS;
  }, []);

  const uniqueRealSearches = useMemo(() => {
    // Deduplicate by brand+area to reduce repeats coming from multiple equal searches
    const seen = new Set<string>();
    const out: RealSearch[] = [];
    for (const s of realSearches) {
      if (!s?.brand_name || !s?.business_area) continue;
      const key = makeKey(s.brand_name, s.business_area);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [realSearches, makeKey]);

  // Fetch real searches from database
  useEffect(() => {
    const fetchRecentSearches = async () => {
      try {
        const { data, error } = await supabase
          .from('viability_searches')
          .select('brand_name, business_area')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (!error && data && data.length > 0) {
          setRealSearches(data);
        }
      } catch (error) {
        console.error('Error fetching recent searches:', error);
      }
    };
    
    fetchRecentSearches();
    
    // Subscribe to realtime updates - trigger immediate notification on new search
    const channel = supabase
      .channel('viability_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'viability_searches'
      }, (payload) => {
        const newSearch = payload.new as RealSearch;
        if (newSearch.brand_name && newSearch.business_area) {
          // Add to list and trigger immediate notification
          setRealSearches(prev => [newSearch, ...prev].slice(0, 50));
          
          // Force show new notification immediately
          setIsVisible(false);
          setTimeout(() => {
            const genericName = genericNames[Math.floor(Math.random() * genericNames.length)];
            const message = `${genericName} consultou "${newSearch.brand_name}" no ramo ${newSearch.business_area}`;
            setNotification({
              id: Date.now(),
              message,
              icon: "check",
            });
            setIsVisible(true);
            setNotificationCount(prev => prev + 1);
          }, 300);
        }
      })
      .subscribe();
    
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, []);

  const getRandomIndex = useCallback((array: any[], excludeIndex: number) => {
    let index;
    do {
      index = Math.floor(Math.random() * array.length);
    } while (index === excludeIndex && array.length > 1);
    return index;
  }, []);

  const generateNotification = useCallback((): Notification => {
    const statsNotifications = [
      { message: t("social.stat1"), icon: "trending" as const },
      { message: t("social.stat2"), icon: "check" as const },
      { message: t("social.stat3"), icon: "trending" as const },
    ];

    // Every 5th notification, show a stats notification
    if (notificationCount > 0 && notificationCount % 5 === 0) {
      const stat = statsNotifications[Math.floor(Math.random() * statsNotifications.length)];
      return {
        id: Date.now(),
        message: stat.message,
        icon: stat.icon,
      };
    }

    // If we have real searches, use them (priority)
    if (uniqueRealSearches.length > 0) {
      // Prefer items that were not shown recently
      const eligible = uniqueRealSearches.filter(
        (s) => !isRecentlyShown(makeKey(s.brand_name, s.business_area))
      );
      const pool = eligible.length > 0 ? eligible : uniqueRealSearches;
      const search = pool[Math.floor(Math.random() * pool.length)];
      const genericName = genericNames[Math.floor(Math.random() * genericNames.length)];
      
      const actionTemplates = [
        { template: `${genericName} consultou "${search.brand_name}" no ramo ${search.business_area}`, icon: "check" as const },
        { template: `"${search.brand_name}" foi pesquisada para ${search.business_area}`, icon: "check" as const },
        { template: `Nova consulta: "${search.brand_name}" - ${search.business_area}`, icon: "trending" as const },
        { template: `${genericName} verificou a marca "${search.brand_name}"`, icon: "shield" as const },
      ];
      
      const action = actionTemplates[Math.floor(Math.random() * actionTemplates.length)];

      // Record the chosen brand+area to avoid immediate repetition
      recordShown(makeKey(search.brand_name, search.business_area));
      
      return {
        id: Date.now(),
        message: action.template,
        icon: action.icon,
      };
    }

    // Fallback to simulated data if no real data available
    const actionTemplates = [
      { template: `{name} ${t("social.registered")} {brand}`, icon: "check" as const },
      { template: `{name} ${t("social.consulted")} {brand}`, icon: "check" as const },
      { template: `{name} ${t("social.secured")} {brand}`, icon: "shield" as const },
      { template: `{name} ${t("social.started")} {brand}`, icon: "trending" as const },
      { template: `{name} ${t("social.protected")}`, icon: "shield" as const },
    ];

    const nameIndex = getRandomIndex(simulatedNames, lastNameIndex);
    setLastNameIndex(nameIndex);
    
    const name = simulatedNames[nameIndex];
    const brand = simulatedBrands[Math.floor(Math.random() * simulatedBrands.length)];
    const action = actionTemplates[Math.floor(Math.random() * actionTemplates.length)];

    // Avoid repeating the same simulated brand back-to-back (best effort)
    recordShown(makeKey(brand, "simulado"));
    
    const message = action.template
      .replace("{name}", name)
      .replace("{brand}", brand);

    return {
      id: Date.now(),
      message,
      icon: action.icon,
    };
  }, [getRandomIndex, isRecentlyShown, lastNameIndex, makeKey, notificationCount, recordShown, t, uniqueRealSearches]);

  useEffect(() => {
    // Initial delay of 1 second before first notification
    const initialTimeout = setTimeout(() => {
      showNotification();
    }, 1000);

    return () => clearTimeout(initialTimeout);
  }, []);

  const showNotification = useCallback(() => {
    const newNotification = generateNotification();
    setNotification(newNotification);
    setIsVisible(true);
    setNotificationCount(prev => prev + 1);

    // Hide after 3 seconds
    setTimeout(() => {
      setIsVisible(false);
      
      // Show next notification after 2 seconds gap
      setTimeout(() => {
        showNotification();
      }, 2000);
    }, 3000);
  }, [generateNotification]);

  const IconComponent = notification?.icon === "shield" 
    ? Shield 
    : notification?.icon === "trending" 
      ? TrendingUp 
      : CheckCircle;

  if (!notification) return null;

  return (
    <div
      className={cn(
        "fixed z-40 transition-all duration-500 ease-out",
        "top-20 md:top-24 left-4 md:left-6",
        "max-w-[calc(100vw-2rem)] md:max-w-sm",
        isVisible 
          ? "opacity-100 translate-x-0 translate-y-0" 
          : "opacity-0 -translate-x-4 -translate-y-2 pointer-events-none"
      )}
    >
      <div className="p-3 md:p-4 flex items-start gap-3 border-l-4 border-l-primary shadow-lg rounded-2xl border border-border bg-background/95 dark:bg-card/95" style={{ WebkitBackdropFilter: 'none', backdropFilter: 'none' }}>
        <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <IconComponent className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium text-foreground leading-snug">
            {notification.message}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
            {t("social.now")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SocialProofNotification;
