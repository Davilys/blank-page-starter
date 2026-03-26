import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ATTORNEY_NAME = "Davilys Danques Oliveira Cunha";
const ATTORNEY_SEARCH_TERMS = ["davilys", "danques"];

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

function containsAttorney(text: string): boolean {
  const normalized = normalizeText(text);
  return ATTORNEY_SEARCH_TERMS.some(term => normalized.includes(term));
}

function guessExtFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const last = pathname.split("/").pop() || "";
    const ext = last.includes(".") ? last.split(".").pop() : null;
    return ext?.toLowerCase() || null;
  } catch {
    return null;
  }
}

async function downloadBytes(fileUrl: string): Promise<Uint8Array> {
  const fileResp = await fetch(fileUrl);
  if (!fileResp.ok) throw new Error("Falha ao baixar o arquivo do storage");
  return new Uint8Array(await fileResp.arrayBuffer());
}

async function extractTextFromXml(bytes: Uint8Array): Promise<string> {
  return new TextDecoder().decode(bytes);
}

async function extractTextFromExcel(bytes: Uint8Array): Promise<string> {
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws);
    parts.push(`\n\n--- PLANILHA: ${sheetName} ---\n${csv}`);
  }

  return parts.join("\n");
}

async function extractTextFromPdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs";

  const loadingTask = (pdfjsLib as any).getDocument({ data: bytes, disableWorker: true } as any);
  const pdf = await loadingTask.promise;

  let out = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = (content.items || [])
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .filter(Boolean);
    out += `\n\n--- PÁGINA ${pageNum} ---\n` + strings.join(" ");
  }

  return { text: out, pages: pdf.numPages };
}

function extractAttorneyBlocks(text: string): string[] {
  const blocks: { start: number; end: number; text: string }[] = [];
  const lower = text.toLowerCase();

  for (const term of ATTORNEY_SEARCH_TERMS) {
    let idx = 0;
    while ((idx = lower.indexOf(term, idx)) !== -1) {
      const start = Math.max(0, idx - 8000);
      const end = Math.min(text.length, idx + term.length + 8000);

      // Verificar sobreposição com blocos existentes
      const overlapping = blocks.find(b =>
        (start <= b.end && end >= b.start)
      );

      if (!overlapping) {
        blocks.push({ start, end, text: text.slice(start, end) });
      } else {
        // Expandir bloco existente para cobrir ambos
        overlapping.start = Math.min(overlapping.start, start);
        overlapping.end = Math.max(overlapping.end, end);
        overlapping.text = text.slice(overlapping.start, overlapping.end);
      }
      idx += term.length;
    }
  }

  return blocks.map(b => b.text);
}

type AttorneyProcess = {
  process_number: string;
  brand_name?: string;
  ncl_classes?: string[];
  dispatch_code?: string;
  dispatch_type?: string;
  dispatch_text?: string;
  holder_name?: string;
  publication_date?: string;
};

async function aiExtractFromBlocks(args: {
  apiKey: string;
  blocks: string[];
}): Promise<AttorneyProcess[]> {
  const { apiKey, blocks } = args;
  if (blocks.length === 0) return [];

  const combinedText = blocks.join("\n\n---BLOCO---\n\n");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é especialista em RPI (Revista da Propriedade Industrial do INPI). Extraia APENAS processos de MARCAS cujo procurador seja "${ATTORNEY_NAME}" (ou variações como "Davilys", "Danques", "DAVILYS DANQUES OLIVEIRA CUNHA").

Regras OBRIGATÓRIAS:
1. NUNCA retorne process_number vazio - busque o número do processo (ex: 123456789) no contexto próximo ao nome do procurador
2. NUNCA retorne brand_name vazio se houver qualquer indicação de marca no bloco
3. ncl_classes deve conter as classes NCL mencionadas (ex: ["25","35"])
4. holder_name é o titular/requerente da marca, NÃO o procurador
5. Não retorne patentes/desenhos/IG. Retorne apenas JSON válido.
6. Se um campo não for encontrado, use "NI" (não identificado) em vez de string vazia

IMPORTANTE para XML da RPI:
- Em XML, os dados aparecem em tags como <processo>, <numero>, <marca>, <nome>, <titular>, <procurador>, <classe-nice>, <despacho>, <codigo>
- O número do processo geralmente tem 9 dígitos e aparece em tags como <numero> ou <processo>
- Procure também por "Classe de Nice" ou "NCL" seguido de números
- O titular pode aparecer como "Titular:", "Requerente:", ou dentro de tags XML como <titular> ou <nome>
- O código do despacho aparece em tags como <codigo> ou "IPAS XXX"
- Se houver múltiplos processos num bloco, extraia TODOS eles`,
        },
        {
          role: "user",
          content: `A seguir há blocos de texto da RPI onde o nome do procurador aparece.

Para cada processo de MARCA identificado, extraia TODOS os campos abaixo com máximo esforço:
- process_number (OBRIGATÓRIO - apenas dígitos, geralmente 9 dígitos)
- brand_name (OBRIGATÓRIO - nome da marca registrada)
- ncl_classes (lista de classes NCL, ex: ["25"])
- dispatch_code (código do despacho, ex: "IPAS 159")
- dispatch_type (tipo: deferimento, indeferimento, exigência, etc.)
- dispatch_text (texto resumido do despacho)
- holder_name (OBRIGATÓRIO - titular/requerente, NÃO o procurador)
- publication_date (YYYY-MM-DD, se disponível)

IMPORTANTE: Analise cuidadosamente cada bloco. O número do processo geralmente aparece antes ou logo após a marca. O titular aparece como "Titular:" ou "Requerente:". As classes NCL aparecem como "NCL(X)" ou "Classe X".

Formato obrigatório (somente JSON):
{"attorney_processes":[{"process_number":"...","brand_name":"...","ncl_classes":["35"],"dispatch_code":"...","dispatch_type":"...","dispatch_text":"...","holder_name":"...","publication_date":"YYYY-MM-DD"}]}

Se não houver processos de marca, retorne: {"attorney_processes":[]}

BLOCOS:
${combinedText}`,
        },
      ],
      max_tokens: 16000,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI blocks error:", resp.status, t);
    const err = new Error(`AI error ${resp.status}`);
    // @ts-ignore
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const arr = parsed.attorney_processes;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let rpiUploadId: string | undefined;

  try {
    const body = await req.json();
    rpiUploadId = body?.rpiUploadId;
    const fileUrl = body?.fileUrl;

    if (!rpiUploadId || !fileUrl) {
      return new Response(JSON.stringify({ error: "rpiUploadId e fileUrl são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Reprocessamento: limpar entradas antigas deste upload para não duplicar.
    await supabase.from("rpi_entries").delete().eq("rpi_upload_id", rpiUploadId);

    await supabase.from("rpi_uploads").update({ status: "processing" }).eq("id", rpiUploadId);

    const ext = guessExtFromUrl(fileUrl);
    const processingDetails: any = {
      format: ext || "unknown",
      extracted_text_chars: 0,
      extracted_pages: null,
      blocksFound: 0,
      note: null,
    };

    let fullText = "";

    if (ext === "pdf") {
      console.log("Downloading PDF...");
      const bytes = await downloadBytes(fileUrl);
      console.log("Extracting text from PDF...");
      const pdf = await extractTextFromPdf(bytes);
      fullText = pdf.text;
      processingDetails.extracted_pages = pdf.pages;
      processingDetails.extracted_text_chars = fullText.length;
    } else if (ext === "xml") {
      const bytes = await downloadBytes(fileUrl);
      fullText = await extractTextFromXml(bytes);
      processingDetails.extracted_text_chars = fullText.length;
    } else if (ext === "xlsx" || ext === "xls") {
      const bytes = await downloadBytes(fileUrl);
      fullText = await extractTextFromExcel(bytes);
      processingDetails.extracted_text_chars = fullText.length;
    } else {
      await supabase
        .from("rpi_uploads")
        .update({
          status: "error",
          summary: `Formato não suportado (${ext || "desconhecido"}). Envie PDF, XML, XLSX ou XLS.`,
        })
        .eq("id", rpiUploadId);

      return new Response(JSON.stringify({ error: "Unsupported file format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!fullText || fullText.trim().length < 100) {
      processingDetails.note = "texto_extraido_vazio";
      await supabase
        .from("rpi_uploads")
        .update({
          status: "completed",
          total_processes_found: 0,
          total_clients_matched: 0,
          summary:
            `Arquivo lido, porém não foi possível extrair texto suficiente para identificar processos. ` +
            `Se este PDF for digitalizado (imagem), envie o XML da edição ou uma planilha (Excel) para leitura estruturada.`,
          processed_at: new Date().toISOString(),
        })
        .eq("id", rpiUploadId);

      return new Response(
        JSON.stringify({
          success: true,
          total_processes: 0,
          matched_clients: 0,
          processing_details: processingDetails,
          summary:
            `Arquivo lido, porém não foi possível extrair texto suficiente para identificar processos. ` +
            `Se este PDF for digitalizado (imagem), envie o XML da edição ou uma planilha (Excel) para leitura estruturada.`,
          entries: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!containsAttorney(fullText)) {
      await supabase
        .from("rpi_uploads")
        .update({
          status: "completed",
          total_processes_found: 0,
          total_clients_matched: 0,
          summary:
            `Nenhum processo do procurador ${ATTORNEY_NAME} foi localizado nesta edição da Revista do INPI. ` +
            `O arquivo foi lido com sucesso (${processingDetails.format.toUpperCase()}, ${processingDetails.extracted_text_chars.toLocaleString()} caracteres).`,
          processed_at: new Date().toISOString(),
        })
        .eq("id", rpiUploadId);

      return new Response(
        JSON.stringify({
          success: true,
          total_processes: 0,
          matched_clients: 0,
          processing_details: processingDetails,
          summary: `Nenhum processo do procurador ${ATTORNEY_NAME} foi localizado nesta edição da Revista do INPI.`,
          entries: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blocks = extractAttorneyBlocks(fullText);
    processingDetails.blocksFound = blocks.length;
    console.log(`Found ${blocks.length} blocks for attorney terms: ${ATTORNEY_SEARCH_TERMS.join(", ")}`);

    // Processar em lotes para não estourar contexto
    const batchSize = 5;
    const collected: AttorneyProcess[] = [];

    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);
      console.log(`AI batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(blocks.length / batchSize)}`);
      try {
        const found = await aiExtractFromBlocks({ apiKey: OPENAI_API_KEY, blocks: batch });
        collected.push(...found);
      } catch (e) {
        const status = (e as any)?.status;
        if (status === 429) {
          await supabase
            .from("rpi_uploads")
            .update({ status: "error", summary: "Limite de requisições excedido. Tente novamente em alguns minutos." })
            .eq("id", rpiUploadId);
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          await supabase
            .from("rpi_uploads")
            .update({ status: "error", summary: "Créditos de IA esgotados. Adicione créditos para continuar." })
            .eq("id", rpiUploadId);
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI batch error:", e);
      }
    }

    // Deduplicar por número do processo, mantendo processos sem número
    const byProcess = new Map<string, AttorneyProcess>();
    let unknownCounter = 0;
    for (const p of collected) {
      const clean = (p.process_number || "").toString().replace(/\D/g, "");
      const key = clean || `unknown_${unknownCounter++}`;
      // Dedup apenas se tem número real
      if (clean && byProcess.has(clean)) continue;
      byProcess.set(key, { ...p, process_number: clean || p.process_number || "NI" });
    }

    const attorneyProcesses = Array.from(byProcess.values());

    // Match com processos existentes
    const { data: existingProcesses } = await supabase
      .from("brand_processes")
      .select("id, process_number, brand_name, user_id");

    const matchedEntries = attorneyProcesses.map((entry) => {
      let matchedClientId: string | null = null;
      let matchedProcessId: string | null = null;

      const cleanProcessNumber = entry.process_number?.toString().replace(/\D/g, "");

      if (cleanProcessNumber && existingProcesses) {
        const processMatch = existingProcesses.find((p) => p.process_number === cleanProcessNumber);
        if (processMatch) {
          matchedProcessId = processMatch.id;
          matchedClientId = processMatch.user_id;
        }
      }

      if (!matchedClientId && entry.brand_name && entry.brand_name !== "NI" && existingProcesses) {
        const brandMatch = existingProcesses.find(
          (p) => normalizeText(p.brand_name) === normalizeText(entry.brand_name || "")
        );
        if (brandMatch) {
          matchedProcessId = brandMatch.id;
          matchedClientId = brandMatch.user_id;
        }
      }

      return {
        rpi_upload_id: rpiUploadId,
        process_number: cleanProcessNumber || entry.process_number || "",
        brand_name: entry.brand_name || "",
        ncl_classes: entry.ncl_classes || [],
        dispatch_type: entry.dispatch_type || "",
        dispatch_code: entry.dispatch_code || "",
        dispatch_text: entry.dispatch_text || "",
        publication_date: entry.publication_date || null,
        holder_name: entry.holder_name || "",
        attorney_name: ATTORNEY_NAME,
        matched_client_id: matchedClientId,
        matched_process_id: matchedProcessId,
        update_status: "pending",
      };
    });

    if (matchedEntries.length > 0) {
      const { error: insertError } = await supabase.from("rpi_entries").insert(matchedEntries);
      if (insertError) console.error("Insert error:", insertError);
    }

    const matchedCount = matchedEntries.filter((e: any) => e.matched_client_id).length;

    const summary =
      matchedEntries.length === 0
        ? `Nenhum processo do procurador ${ATTORNEY_NAME} foi localizado nesta edição da Revista do INPI.`
        : `Encontrados ${matchedEntries.length} processo(s) do procurador ${ATTORNEY_NAME}, ${matchedCount} correspondem a clientes.`;

    await supabase
      .from("rpi_uploads")
      .update({
        status: "completed",
        total_processes_found: matchedEntries.length,
        total_clients_matched: matchedCount,
        summary,
        processed_at: new Date().toISOString(),
      })
      .eq("id", rpiUploadId);

    return new Response(
      JSON.stringify({
        success: true,
        total_processes: matchedEntries.length,
        matched_clients: matchedCount,
        processing_details: processingDetails,
        summary,
        entries: matchedEntries,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process RPI error:", error);

    if (rpiUploadId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from("rpi_uploads")
          .update({
            status: "error",
            summary: `Erro durante o processamento: ${error instanceof Error ? error.message : "Erro desconhecido"}.`,
          })
          .eq("id", rpiUploadId);
      } catch {
        // ignore
      }
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: "O arquivo foi recebido, mas não foi possível processá-lo. Verifique se o formato está correto (PDF, XML, XLSX ou XLS).",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
