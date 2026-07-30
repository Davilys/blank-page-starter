import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SearchKnowledgeOutput } from "../../application/use-cases/searchKnowledge";

interface Props {
  resultado: SearchKnowledgeOutput | null;
}

/**
 * Renders the "no canonical answer" state honestly (FASE 04 rule: never
 * fabricate). This is the correct behaviour while the corpus is empty.
 */
const SearchResults = ({ resultado }: Props) => {
  if (!resultado) return null;

  return (
    <section className="border-b border-border bg-muted/30 py-10">
      <div className="container mx-auto max-w-3xl px-4">
        {resultado.lacuna ? (
          <Card className="flex items-start gap-4 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h2 className="font-semibold text-foreground">
                Ainda não temos uma resposta canônica para esta pergunta
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A base de conhecimento está em construção. Registramos sua pergunta como
                lacuna para revisão de um especialista — preferimos não responder a
                responder sem fonte verificada.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {resultado.resultados.items.map((objeto) => (
              <Card key={objeto.id} className="p-5">
                <h3 className="font-semibold text-foreground">{objeto.titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{objeto.categoria}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SearchResults;