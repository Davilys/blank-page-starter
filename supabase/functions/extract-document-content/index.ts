import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Disable worker in edge runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadingTask = (pdfjsLib as any).getDocument({ data, disableWorker: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf: any = await loadingTask.promise;

  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages ?? 0, 50);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = (content.items || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .filter(Boolean);

    const pageText = strings.join(" ").replace(/\s+/g, " ").trim();
    if (pageText) pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}

async function extractExcelText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const out: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as Array<Array<unknown>>;

    out.push(`### ${sheetName}`);
    for (const row of rows) {
      const line = row
        .map((c) => (c == null ? "" : String(c)))
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" | ");
      if (line) out.push(line);
    }
    out.push("");
  }

  return out.join("\n").trim();
}

async function extractDocxText(file: File): Promise<string> {
  // Minimal fallback: attempt to find text fragments in XML.
  // (DOCX is a zip; a robust unzip in edge adds complexity. We'll rely on AI vision for images,
  // and PDF/XLSX for now; still keep a conservative fallback.)
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoder = new TextDecoder("utf-8");
  const content = decoder.decode(bytes);
  const matches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  return matches.map((m) => m.replace(/<[^>]+>/g, "").trim()).filter(Boolean).join(" ").trim();
}

function normalizeLikelyPdfGarbage(text: string): string {
  // If we detect PDF header/operator noise, strip it aggressively.
  // This prevents the textarea from being filled with PDF syntax.
  const looksLikePdf = /%PDF-\d\.\d|\/Type\s*\/Page|endstream|xref|trailer|obj\s*<</i.test(text);
  if (!looksLikePdf) return text;

  return text
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (l.startsWith("%PDF-")) return false;
      if (/^\d+\s+\d+\s+obj\b/i.test(l)) return false;
      if (/^(xref|trailer|startxref|endobj|endstream)\b/i.test(l)) return false;
      if (l.includes("/Type") || l.includes("/Parent") || l.includes("/Resources")) return false;
      return true;
    })
    .join("\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function improveWithAI({
  extractedText,
  fileName,
  imageDataUrl,
}: {
  extractedText: string;
  fileName: string;
  imageDataUrl?: string;
}): Promise<{ content: string; variables: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const systemPrompt = `Você é um assistente especializado em transformar documentos em MODELOS de contrato.

Regras obrigatórias:
- Preserve o máximo possível a estrutura original (títulos, itens, numeração, quebras de linha).
- NÃO invente cláusulas novas; se algo estiver ausente, mantenha como "[TEXTO INCOMPLETO]".
- Substitua dados específicos por variáveis:
  {{nome_cliente}}, {{cpf_cnpj}}, {{endereco}}, {{cidade}}, {{estado}}, {{cep}}, {{email}}, {{telefone}},
  {{marca}}, {{valor}}, {{data}}, {{data_inicio}}, {{data_fim}}, {{numero_contrato}}
- Retorne APENAS o conteúdo do contrato, em texto com quebras de linha (sem markdown, sem explicações).
`;

  // Build user message - use vision for images, text for documents
  const userContent = imageDataUrl
    ? [
        { type: "text", text: `Arquivo: ${fileName}\n\nExtraia o contrato da imagem e gere um modelo fiel ao original.` },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ]
    : `Arquivo: ${fileName}\n\nConteúdo extraído:\n${extractedText.substring(0, 18000)}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    // Surface common errors cleanly
    if (resp.status === 429) throw new Error("RATE_LIMITED");
    if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI_GATEWAY_ERROR_${resp.status}: ${t}`);
  }

  const data = await resp.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "").trim();

  const variablePatterns = [
    "{{nome_cliente}}",
    "{{cpf_cnpj}}",
    "{{endereco}}",
    "{{cidade}}",
    "{{estado}}",
    "{{cep}}",
    "{{email}}",
    "{{telefone}}",
    "{{marca}}",
    "{{valor}}",
    "{{data}}",
    "{{data_inicio}}",
    "{{data_fim}}",
    "{{numero_contrato}}",
  ];

  const variables = variablePatterns.filter((v) => content.includes(v));
  return { content, variables };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = file.name;
    const lower = fileName.toLowerCase();
    const fileType = file.type;

    console.log(`Processing file: ${fileName}, type: ${fileType}`);

    let extracted = "";
    let imageDataUrl: string | undefined;

    if (fileType.startsWith("image/")) {
      const arrayBuffer = await file.arrayBuffer();
      imageDataUrl = `data:${fileType};base64,${encodeBase64(arrayBuffer)}`;
      extracted = "[IMAGE_INPUT]";
    } else if (fileType === "application/pdf" || lower.endsWith(".pdf")) {
      extracted = await extractPdfText(file);
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      fileType === "application/vnd.ms-excel" ||
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls")
    ) {
      extracted = await extractExcelText(file);
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileType === "application/msword" ||
      lower.endsWith(".docx") ||
      lower.endsWith(".doc")
    ) {
      extracted = await extractDocxText(file);
    } else {
      return new Response(JSON.stringify({ error: "Formato não suportado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!imageDataUrl) {
      extracted = normalizeLikelyPdfGarbage(extracted);

      if (!extracted || extracted.length < 60) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Não consegui extrair texto suficiente do arquivo. Se for PDF escaneado, envie uma versão pesquisável (texto) ou envie uma imagem/scan em JPG/PNG.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    }

    // AI refine
    try {
      const ai = await improveWithAI({ extractedText: extracted, fileName, imageDataUrl });
      return new Response(
        JSON.stringify({
          success: true,
          content: ai.content || extracted,
          variables: ai.variables,
          fileName,
          fileType,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";

      if (msg === "RATE_LIMITED") {
        return new Response(
          JSON.stringify({ success: false, error: "Muitas solicitações. Tente novamente em alguns instantes." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (msg === "PAYMENT_REQUIRED") {
        return new Response(JSON.stringify({ success: false, error: "Créditos de IA esgotados. Adicione créditos para continuar." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("AI processing error:", e);
      // Fallback to extracted text (or error for images)
      if (imageDataUrl) {
        return new Response(
          JSON.stringify({ success: false, error: "IA indisponível para imagem. Tente novamente." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          content: extracted,
          variables: [],
          fileName,
          fileType,
          warning: "IA indisponível; retornando texto extraído.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    console.error("Error processing document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Erro ao processar documento", details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
