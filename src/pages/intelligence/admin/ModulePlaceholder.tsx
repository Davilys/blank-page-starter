/**
 * Generic placeholder for every admin module.
 *
 * Deliberately logic-free: FASE 05 delivers infrastructure, not features.
 * Each engine replaces this component in its own phase.
 */
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  readonly titulo: string;
  readonly descricao: string;
  readonly fase: string;
}

const ModulePlaceholder = ({ titulo, descricao, fase }: Props) => (
  <div className="mx-auto max-w-3xl">
    <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
    <p className="mt-2 text-muted-foreground">{descricao}</p>

    <Card className="mt-6 flex items-start gap-4 p-6">
      <Construction className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div>
        <p className="font-medium text-foreground">Estrutura preparada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A rota, o layout e as portas de aplicação já existem. A lógica deste módulo
          será implementada na {fase}, sem alterar nada fora de <code>/intelligence</code>.
        </p>
      </div>
    </Card>
  </div>
);

export default ModulePlaceholder;
