import { useState, type FormEvent } from "react";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  onSearch: (termo: string) => void;
  buscando: boolean;
}

const IntelligenceHero = ({ onSearch, buscando }: Props) => {
  const [valor, setValor] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(valor);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary to-[hsl(217_100%_36%)] py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="hero-pill-badge inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            WebMarcas Intelligence
          </span>

          <h1 className="mt-6 font-display text-3xl leading-tight text-primary-foreground md:text-5xl">
            A base de conhecimento sobre marcas, INPI e Propriedade Intelectual
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-primary-foreground/85 md:text-lg">
            Conhecimento estruturado, com fonte, autor e data de revisão. Cada resposta
            nasce de um objeto verificado — nunca de texto genérico.
          </p>

          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Pergunte sobre registro de marca, prazos, classes..."
                aria-label="Pesquisar na base de conhecimento"
                className="h-14 rounded-xl border-0 bg-background pl-12 text-base shadow-lg"
              />
            </div>
            <Button
              type="submit"
              disabled={buscando}
              className="btn-solid-orange h-14 rounded-xl bg-accent px-8 text-base font-bold text-accent-foreground hover:bg-accent/90"
            >
              {buscando ? "Buscando..." : "Pesquisar"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default IntelligenceHero;
