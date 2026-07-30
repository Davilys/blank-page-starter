/** Cadeia imutável de versões: o que afirmávamos, e desde quando. */
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import type { Fact } from "../../../domain/facts/Fact";
import { FactStatusBadge } from "./FactBadges";

export const FactChain = ({ cadeia, atualId }: { cadeia: readonly Fact[]; atualId: string }) => (
  <Card className="p-5">
    <h2 className="font-semibold text-foreground">Cadeia de versões</h2>
    <p className="mt-1 text-xs text-muted-foreground">
      Nada é sobrescrito. Cada mudança de sentido cria uma versão e congela a anterior.
    </p>

    <ol className="mt-4 space-y-3">
      {cadeia.map((v) => (
        <li
          key={v.id}
          className={
            v.id === atualId
              ? "rounded-lg border border-primary/40 bg-primary/5 p-3"
              : "rounded-lg border border-border p-3"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">v{v.versao}</span>
            <FactStatusBadge status={v.status} />
            {v.id !== atualId && (
              <Link
                to={`/intelligence/admin/fatos/${v.id}`}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                abrir
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground">{v.enunciado}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vigência: {v.vigenciaInicio || "—"}
            {v.vigenciaFim ? ` até ${v.vigenciaFim}` : ""} · {v.fonte.titulo}
            {v.fonte.dispositivo ? `, ${v.fonte.dispositivo}` : ""} · autor {v.autorId}
          </p>
        </li>
      ))}
    </ol>
  </Card>
);