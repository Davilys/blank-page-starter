/** Preview exato do que será servido — mesmo código usado na publicação. */
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye } from "lucide-react";
import type { KnowledgeDraft } from "../../../domain/factory/KnowledgeDraft";
import {
  PREVIEW_SURFACES,
  PREVIEW_SURFACE_LABEL,
  previewSurface,
  type PublicationPreview,
} from "../../../domain/publishing/preview";

export const PublicationPreviewPanel = ({
  draft,
  preview,
}: {
  draft: KnowledgeDraft;
  preview: PublicationPreview;
}) => (
  <Card className="p-5">
    <div className="flex items-center gap-2">
      <Eye className="h-4 w-4 text-primary" />
      <h3 className="font-semibold text-foreground">Preview de publicação</h3>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">
      Canonical: <code className="text-foreground">{preview.canonical}</code> · hash{" "}
      <code className="text-foreground">{preview.hash}</code>
    </p>
    <p className="mt-1 text-xs text-muted-foreground">
      Breadcrumb: {preview.breadcrumb.map((b) => b.nome).join(" › ")}
    </p>

    <Tabs defaultValue={PREVIEW_SURFACES[0]} className="mt-4">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/60">
        {PREVIEW_SURFACES.map((s) => (
          <TabsTrigger key={s} value={s} className="text-xs">
            {PREVIEW_SURFACE_LABEL[s]}
          </TabsTrigger>
        ))}
      </TabsList>

      {PREVIEW_SURFACES.map((s) => (
        <TabsContent key={s} value={s}>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-xs leading-relaxed text-foreground">
            {previewSurface(draft, preview, s)}
          </pre>
        </TabsContent>
      ))}
    </Tabs>

    {preview.problemasSchema.length > 0 && (
      <p className="mt-3 text-xs text-destructive">
        Schema inválido: {preview.problemasSchema.join(" ")}
      </p>
    )}
  </Card>
);