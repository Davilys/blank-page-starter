/** Upload area (FASE 07 §1/§2). Accepts only the seven supported formats. */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_FORMATS } from "../../../domain/ingestion/SourceDocument";

const ACCEPT = ".txt,.md,.markdown,.html,.htm,.pdf,.docx,.json,.csv";

interface Props {
  readonly onImport: (files: File[], importadoPor: string, origem: string) => Promise<void>;
  readonly busy?: boolean;
}

export const FileImporter = ({ onImport, busy }: Props) => {
  const [importadoPor, setImportadoPor] = useState("");
  const [origem, setOrigem] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    await onImport(Array.from(list), importadoPor, origem);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground">Importar documentos</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada arquivo gera apenas um <strong>candidato</strong>. Nada é publicado e nenhum
        Knowledge Object é criado automaticamente.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ing-usuario">Importado por</Label>
          <Input
            id="ing-usuario"
            className="mt-1"
            placeholder="seu.nome"
            value={importadoPor}
            onChange={(e) => setImportadoPor(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ing-origem">Origem</Label>
          <Input
            id="ing-origem"
            className="mt-1"
            placeholder="Ex.: acervo jurídico 2023, blog antigo"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
          />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn(
          "mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-foreground">
          Arraste arquivos aqui ou selecione no seu computador
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Formatos aceitos: {SOURCE_FORMATS.join(", ")} · até 15 MB por arquivo
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void handle(e.target.files)}
        />
        <Button
          type="button"
          className="mt-4"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Processando…" : "Selecionar arquivos"}
        </Button>
      </div>
    </Card>
  );
};