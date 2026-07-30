import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Clock, HelpCircle, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HomeOverview } from "../../application/use-cases/getHomeOverview";

/* ── Apresentação do projeto ──────────────────────────────────────────────── */
export const AboutSection = () => (
  <section className="py-14 md:py-20">
    <div className="container mx-auto px-4">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-2xl text-foreground md:text-3xl">
          Não é um blog. É uma base de conhecimento verificada.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Cada informação nasce como um objeto de conhecimento com fonte primária, autor
          identificado, jurisdição declarada e data de revisão. Se algo vence, é retirado —
          não servimos informação desatualizada.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, titulo: "Com fonte", texto: "Toda afirmação aponta para fonte oficial verificável." },
          { icon: BookOpen, titulo: "Revisado", texto: "Publicação exige revisão de especialista em PI." },
          { icon: Clock, titulo: "Atualizado", texto: "Conteúdo com prazo de validade e revisão contínua." },
        ].map(({ icon: Icon, titulo, texto }) => (
          <Card key={titulo} className="p-6 text-center">
            <Icon className="mx-auto h-7 w-7 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">{titulo}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{texto}</p>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ── Cards dos principais temas ───────────────────────────────────────────── */
export const ThemesSection = ({ temas }: { temas: HomeOverview["temas"] }) => (
  <section className="bg-muted/30 py-14 md:py-20">
    <div className="container mx-auto px-4">
      <div className="mb-8 flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl text-foreground md:text-3xl">Principais temas</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {temas.map((tema) => (
          <Card key={tema.slug} className="flex flex-col p-5 transition-shadow hover:shadow-md">
            <h3 className="font-semibold text-foreground">{tema.titulo}</h3>
            <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{tema.descricao}</p>
            <span className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tema.objetos > 0 ? `${tema.objetos} objetos` : "Em construção"}
            </span>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ── Perguntas em destaque ────────────────────────────────────────────────── */
export const FeaturedQuestionsSection = ({
  perguntas,
}: {
  perguntas: HomeOverview["perguntasDestaque"];
}) => (
  <section className="py-14 md:py-20">
    <div className="container mx-auto px-4">
      <div className="mb-8 flex items-center gap-3">
        <HelpCircle className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl text-foreground md:text-3xl">Perguntas em destaque</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {perguntas.map((pergunta) => (
          <Card key={pergunta} className="flex items-center justify-between gap-4 p-5">
            <span className="text-sm font-medium text-foreground">{pergunta}</span>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              Em revisão
            </span>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ── Atualizações recentes ────────────────────────────────────────────────── */
export const RecentUpdatesSection = ({
  atualizacoes,
}: {
  atualizacoes: HomeOverview["atualizacoesRecentes"];
}) => (
  <section className="bg-muted/30 py-14 md:py-20">
    <div className="container mx-auto px-4">
      <div className="mb-8 flex items-center gap-3">
        <Clock className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl text-foreground md:text-3xl">Atualizações recentes</h2>
      </div>

      {atualizacoes.total === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma atualização publicada ainda. O histórico de versões aparecerá aqui,
            com motivo da mudança e objetos afetados.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {atualizacoes.items.map((versao) => (
            <Card key={versao.id} className="p-5">
              <p className="font-medium text-foreground">{versao.resumoMudanca}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                v{versao.versao} · {versao.motivo}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  </section>
);

/* ── Explorar conhecimento ────────────────────────────────────────────────── */
export const ExploreSection = () => (
  <section className="py-14 md:py-20">
    <div className="container mx-auto px-4">
      <div className="mb-8 flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl text-foreground md:text-3xl">Explorar conhecimento</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { titulo: "Por entidade", texto: "Conceitos, normas, classes e instituições do ecossistema de PI." },
          { titulo: "Por procedimento", texto: "Passo a passo de cada fase do processo no INPI." },
          { titulo: "Por fonte", texto: "Navegue a partir da legislação e das publicações oficiais." },
        ].map((item) => (
          <Card key={item.titulo} className="p-6">
            <h3 className="font-semibold text-foreground">{item.titulo}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{item.texto}</p>
            <span className="mt-4 inline-block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Em breve
            </span>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ── CTA para Registro de Marca ───────────────────────────────────────────── */
export const IntelligenceCTA = () => (
  <section className="bg-gradient-to-br from-primary to-[hsl(217_100%_36%)] py-14 md:py-20">
    <div className="container mx-auto px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl text-primary-foreground md:text-3xl">
          Pronto para registrar sua marca?
        </h2>
        <p className="mt-3 text-primary-foreground/85">
          Conhecimento é o primeiro passo. A WebMarcas cuida de todo o processo no INPI,
          com protocolo em 48h.
        </p>
        <Button
          asChild
          className="btn-solid-orange mt-7 h-13 rounded-xl bg-accent px-8 py-6 text-base font-bold text-accent-foreground hover:bg-accent/90"
        >
          <Link to="/registrar">
            Registrar minha marca
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  </section>
);
