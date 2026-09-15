import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import {
  ProcessBlockScanner,
  parseProcessBlock,
  sha256Hex,
  type ParsedProcess,
} from '../_shared/rpiXml.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ATTORNEY_NAME = 'DAVILYS DANQUES DE OLIVEIRA CUNHA';
const ATTORNEY_SEARCH_TERM = 'davilys';
const ATTORNEY_SEARCH_TERMS = ['davilys', 'danques'];

const INPI_BASE_URL = 'https://revistas.inpi.gov.br';

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function convertBrazilianDateToISO(dateStr: string | null): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const altMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (altMatch) return `${altMatch[3]}-${altMatch[2]}-${altMatch[1]}`;
  return null;
}

function containsAttorney(text: string): boolean {
  return normalizeText(text).includes(ATTORNEY_SEARCH_TERM);
}

function calculateExpectedRpiNumber(): number {
  // Referência verificada: RPI 2890 publicada em 26/05/2026 (revistas.inpi.gov.br/rpi/)
  const referenceDate = new Date('2026-05-26');
  const referenceRpi = 2890;
  const today = new Date();
  const diffWeeks = Math.floor((today.getTime() - referenceDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return referenceRpi + Math.max(0, diffWeeks);
}

// ========== INPI SESSION MANAGEMENT ==========

// Extract Set-Cookie headers from response (Deno compatible)
function extractCookies(response: Response): string[] {
  const cookies: string[] = [];
  // Try getSetCookie first (Deno 1.37+)
  try {
    const sc = (response.headers as any).getSetCookie?.();
    if (sc && sc.length > 0) return sc;
  } catch (_) { /* fallback */ }
  
  // Fallback: iterate headers
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') {
      cookies.push(value);
    }
  }
  
  // Also try raw header access
  const raw = response.headers.get('set-cookie');
  if (raw && cookies.length === 0) {
    // Multiple cookies might be comma-separated (though not standard for Set-Cookie)
    cookies.push(raw);
  }
  
  return cookies;
}

function mergeCookies(existing: string, newCookies: string[]): string {
  const cookieMap = new Map<string, string>();
  
  // Parse existing
  if (existing) {
    for (const part of existing.split(';')) {
      const trimmed = part.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        cookieMap.set(trimmed.substring(0, eqIdx).trim(), trimmed.substring(eqIdx + 1).trim());
      }
    }
  }
  
  // Parse new cookies (only the name=value part, before first ;)
  for (const cookie of newCookies) {
    const nameValue = cookie.split(';')[0].trim();
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx > 0) {
      cookieMap.set(nameValue.substring(0, eqIdx).trim(), nameValue.substring(eqIdx + 1).trim());
    }
  }
  
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// Login to INPI portal and return session cookies
async function loginToInpi(): Promise<string | null> {
  const username = Deno.env.get('INPI_USERNAME');
  const password = Deno.env.get('INPI_PASSWORD');

  if (!username || !password) {
    console.log('INPI credentials not configured');
    return null;
  }

  console.log(`Attempting INPI login with user: ${username}`);

  try {
    // Step 1: GET login page for CSRF token and initial cookies
    const loginPageRes = await fetch(`${INPI_BASE_URL}/login/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
    });

    const initialCookies = extractCookies(loginPageRes);
    let cookies = mergeCookies('', initialCookies);
    console.log(`Initial cookies: ${cookies ? cookies.substring(0, 100) : 'none'}`);

    const loginHtml = await loginPageRes.text();
    
    // Extract CSRF token
    const csrfMatch = loginHtml.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i);
    let csrfToken = csrfMatch ? csrfMatch[1] : '';
    
    // Also check cookie for csrftoken
    const csrfCookieMatch = cookies.match(/csrftoken=([^;]+)/);
    if (!csrfToken && csrfCookieMatch) {
      csrfToken = csrfCookieMatch[1];
    }
    
    console.log(`CSRF token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'not found'}`);

    // Step 2: POST login
    const formBody = new URLSearchParams();
    formBody.append('username', username);
    formBody.append('password', password);
    if (csrfToken) {
      formBody.append('csrfmiddlewaretoken', csrfToken);
    }

    // Extract form action URL (may include ?next=/)
    const actionMatch = loginHtml.match(/action=["']([^"']+)["']/i);
    const loginAction = actionMatch ? actionMatch[1] : `${INPI_BASE_URL}/login/`;
    const loginUrl = loginAction.startsWith('http') ? loginAction : `${INPI_BASE_URL}${loginAction}`;
    console.log(`Login action URL: ${loginUrl}`);

    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${INPI_BASE_URL}/login/`,
        'Origin': INPI_BASE_URL,
        ...(cookies ? { 'Cookie': cookies } : {}),
      },
      body: formBody.toString(),
      redirect: 'manual',
    });

    console.log(`Login POST status: ${loginRes.status}`);
    const loginResponseCookies = extractCookies(loginRes);
    cookies = mergeCookies(cookies, loginResponseCookies);
    console.log(`Post-login cookies: ${cookies ? cookies.substring(0, 150) : 'none'}`);
    
    const location = loginRes.headers.get('location') || '';
    console.log(`Login redirect location: ${location}`);
    
    // Consume body
    await loginRes.text();

    // Step 3: If redirected, follow the redirect with cookies
    if (location && (loginRes.status === 302 || loginRes.status === 301)) {
      const redirectUrl = location.startsWith('http') ? location : `${INPI_BASE_URL}${location}`;
      console.log(`Following redirect to: ${redirectUrl}`);
      
      const redirectRes = await fetch(redirectUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookies,
        },
        redirect: 'manual',
      });
      
      const redirectCookies = extractCookies(redirectRes);
      cookies = mergeCookies(cookies, redirectCookies);
      
      const redirectBody = await redirectRes.text();
      const isLoggedIn = !redirectBody.includes('id="login_form"') && !redirectBody.includes('id_username');
      console.log(`After redirect - status: ${redirectRes.status}, logged in: ${isLoggedIn}, page length: ${redirectBody.length}`);
      
      if (isLoggedIn) {
        console.log('INPI login confirmed! Session cookies obtained.');
        // Log a snippet of the authenticated page
        console.log(`Authenticated page snippet: ${redirectBody.substring(0, 500)}`);
        return cookies;
      }
    }

    // Check if we're actually logged in
    if (loginRes.status === 200) {
      // Might be re-showing login form with error
      console.log('Got 200 on login POST - might have failed');
    }

    console.log('Login may have failed, returning available cookies');
    return cookies || null;

  } catch (error) {
    console.error('INPI login error:', error);
    return null;
  }
}

// Fetch with INPI session cookies
async function fetchWithSession(url: string, sessionCookies: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/zip,*/*;q=0.8',
    'Referer': `${INPI_BASE_URL}/rpi/`,
  };
  if (sessionCookies) {
    headers['Cookie'] = sessionCookies;
  }
  return fetch(url, { headers, redirect: 'follow' });
}

// ========== RPI FETCHING ==========

async function fetchAvailableRpis(sessionCookies: string | null): Promise<{ latest: number; available: number[]; withXml: number[] }> {
  const expectedRpi = calculateExpectedRpiNumber();
  console.log(`Expected RPI based on date: ${expectedRpi}`);
  const MAX_ALLOWED = expectedRpi + 2; // nunca devolver RPIs muito acima do esperado

  // A tabela em https://revistas.inpi.gov.br/rpi/ é PÚBLICA — tenta primeiro sem sessão.
  // Só usa cookies de sessão se o acesso público falhar.
  const tryFetch = async (cookies: string | null) => {
    try {
      return await fetchWithSession(`${INPI_BASE_URL}/rpi/`, cookies);
    } catch (e) {
      console.error('Fetch /rpi/ failed:', e);
      return null;
    }
  };

  try {
    let response = await tryFetch(null);
    let html = response && response.ok ? await response.text() : '';

    const looksLikeLogin = (h: string) => h.includes('id="login_form"') || h.includes('id_username');

    if (!html || looksLikeLogin(html)) {
      console.log('Public /rpi/ falhou ou retornou login — tentando com sessão autenticada');
      response = await tryFetch(sessionCookies);
      html = response && response.ok ? await response.text() : '';
    }

    if (!html || looksLikeLogin(html)) {
      console.log('Nenhuma resposta válida do portal — usando fallback descendente');
      const fallbackNumbers = Array.from({ length: 20 }, (_, i) => expectedRpi - i).filter(n => n >= 2800);
      return { latest: expectedRpi, available: fallbackNumbers, withXml: [] };
    }

    console.log(`Fetched INPI page, length: ${html.length}`);

    // Find all RPI numbers from the page
    const rpiNumbers: number[] = [];
    let match;

    // Try to find RPI numbers in table cells or links
    const tdRegex = /<td[^>]*>\s*(\d{4})\s*<\/td>/gi;
    while ((match = tdRegex.exec(html)) !== null) {
      const num = parseInt(match[1]);
      if (num >= 2800 && num <= MAX_ALLOWED) rpiNumbers.push(num);
    }

    // Also try links that mention RPI numbers
    const linkRegex = /rpi[\/\-_]?(\d{4})/gi;
    while ((match = linkRegex.exec(html)) !== null) {
      const num = parseInt(match[1]);
      if (num >= 2800 && num <= MAX_ALLOWED && !rpiNumbers.includes(num)) rpiNumbers.push(num);
    }

    // Find which RPIs have XML files for Marcas
    const rpWithXml: number[] = [];
    const xmlPatterns = [
      /href=["'][^"']*RM(\d{4})\.zip["']/gi,
      /href=["'][^"']*\/txt\/RM(\d{4})\.zip["']/gi,
      /\/txt\/RM(\d{4})\.zip/gi,
      /RM(\d{4})\.zip/gi,
      /href=["'][^"']*marcas[^"']*(\d{4})[^"']*\.zip["']/gi,
    ];

    for (const pattern of xmlPatterns) {
      while ((match = pattern.exec(html)) !== null) {
        const num = parseInt(match[1]);
        if (num >= 2800 && num <= MAX_ALLOWED && !rpWithXml.includes(num)) rpWithXml.push(num);
      }
    }

    // Debug: look for download links
    const downloadLinks: string[] = [];
    const hrefRegex = /href=["']([^"']*\.(zip|xml)[^"']*)["']/gi;
    while ((match = hrefRegex.exec(html)) !== null) {
      downloadLinks.push(match[1]);
    }
    if (downloadLinks.length > 0) {
      console.log(`Found download links: ${downloadLinks.slice(0, 10).join(', ')}`);
    }

    // Debug: log sections of interest
    const marcasIdx = html.toLowerCase().indexOf('marcas');
    if (marcasIdx > -1) {
      console.log(`Found 'marcas' at position ${marcasIdx}`);
      console.log(`Context: ...${html.substring(Math.max(0, marcasIdx - 50), marcasIdx + 200)}...`);
    }

    const uniqueNumbers = [...new Set(rpiNumbers)].sort((a, b) => b - a);
    const sortedWithXml = rpWithXml.sort((a, b) => b - a);

    console.log(`Found RPI numbers: ${uniqueNumbers.slice(0, 10).join(', ')}`);
    console.log(`RPIs with XML: ${sortedWithXml.slice(0, 10).join(', ')}`);

    if (uniqueNumbers.length > 0) {
      return { latest: uniqueNumbers[0], available: uniqueNumbers.slice(0, 20), withXml: sortedWithXml };
    }

    const fallbackNumbers = Array.from({ length: 20 }, (_, i) => expectedRpi - i).filter(n => n >= 2800);
    return { latest: expectedRpi, available: fallbackNumbers, withXml: [] };

  } catch (error) {
    console.error('Error fetching available RPIs:', error);
    const fallbackNumbers = Array.from({ length: 20 }, (_, i) => expectedRpi - i).filter(n => n >= 2800);
    return { latest: expectedRpi, available: fallbackNumbers, withXml: [] };
  }
}

// ========== LEITURA ESTRUTURAL E INCREMENTAL DO XML ==========

interface ScanResult {
  processes: ParsedProcess[];
  totalBlocks: number;
  totalMentions: number;
  bytesRead: number;
}

function createScanner(): { scanner: ProcessBlockScanner; result: ScanResult; feed: (chunk: string) => void; finish: () => ScanResult } {
  const scanner = new ProcessBlockScanner();
  const result: ScanResult = { processes: [], totalBlocks: 0, totalMentions: 0, bytesRead: 0 };
  const byNumber = new Map<string, ParsedProcess>();

  const handleBlocks = (blocks: string[]) => {
    for (const block of blocks) {
      result.totalBlocks++;
      const parsed = parseProcessBlock(block, ATTORNEY_SEARCH_TERMS, ATTORNEY_NAME);
      if (!parsed) continue;
      result.totalMentions += parsed.occurrences.length;
      const existing = byNumber.get(parsed.processNumber);
      if (existing) {
        // Mesmo processo em outro bloco da mesma revista: uma única linha,
        // mas todas as ocorrências são preservadas para auditoria.
        existing.occurrences.push(
          ...parsed.occurrences.map((o, i) => ({ ...o, order: existing.occurrences.length + i + 1 })),
        );
        existing.relationTypes = Array.from(new Set([...existing.relationTypes, ...parsed.relationTypes]));
        existing.isDestituicao = existing.isDestituicao || parsed.isDestituicao;
        existing.isNomeacao = existing.isNomeacao || parsed.isNomeacao;
        existing.isSubstituicao = existing.isSubstituicao || parsed.isSubstituicao;
        existing.dispatches.push(...parsed.dispatches);
        continue;
      }
      byNumber.set(parsed.processNumber, parsed);
      result.processes.push(parsed);
    }
  };

  return {
    scanner,
    result,
    feed: (chunk: string) => {
      result.bytesRead += chunk.length;
      handleBlocks(scanner.push(chunk));
    },
    finish: () => {
      handleBlocks(scanner.flush());
      return result;
    },
  };
}


// Baixa o XML da RPI e entrega o conteúdo em pedaços para o scanner
async function downloadAndScanRpiXml(
  rpiNumber: number,
  sessionCookies: string | null,
  feed: (chunk: string) => void,
): Promise<{ ok: boolean; sourceUrl: string | null }> {
  const urls = [
    `${INPI_BASE_URL}/txt/RM${rpiNumber}.zip`,
    `${INPI_BASE_URL}/xml/RM${rpiNumber}.zip`,
    `${INPI_BASE_URL}/rpi/RM${rpiNumber}.zip`,
    `${INPI_BASE_URL}/txt/M${rpiNumber}.zip`,
    `${INPI_BASE_URL}/rpi/${rpiNumber}/RM${rpiNumber}.zip`,
    // New potential URL patterns after portal update
    `${INPI_BASE_URL}/rpi/download/RM${rpiNumber}.zip`,
    `${INPI_BASE_URL}/rpi/download/${rpiNumber}/marcas`,
    `${INPI_BASE_URL}/download/txt/RM${rpiNumber}.zip`,
  ];

  for (const url of urls) {
    console.log(`Trying URL: ${url}`);
    // Retry on transient failures (503/504/429) — INPI portal is flaky.
    let response: Response | null = null;
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await fetchWithSession(url, sessionCookies);
      } catch (err) {
        console.log(`Fetch error on ${url} attempt ${attempt}: ${err}`);
        response = null;
      }
      if (response && response.ok) break;
      const status = response?.status ?? 0;
      if (![0, 429, 502, 503, 504].includes(status)) break;
      const delay = 800 * attempt;
      console.log(`Transient ${status} on ${url}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      if (response) await response.text().catch(() => {});
      await new Promise((r) => setTimeout(r, delay));
      response = null;
    }
    if (!response) continue;
    if (!response.ok) {
      console.log(`URL ${url} returned status ${response.status}`);
      const redirectUrl = response.headers.get('location') || '';
      if (redirectUrl.includes('login')) {
        console.log('Redirected to login - session may have expired');
      }
      await response.text();
      continue;
    }
    try {

      const contentType = response.headers.get('content-type') || '';
      console.log(`Content-Type: ${contentType}`);

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // ZIP magic bytes (PK)
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        console.log(`Valid ZIP from ${url}, size: ${bytes.length} bytes`);
        const zip = await JSZip.loadAsync(arrayBuffer);
        const xmlFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.xml'));
        if (xmlFiles.length > 0) {
          // Leitura incremental: o XML nunca existe inteiro em memória.
          await new Promise<void>((resolve, reject) => {
            (zip.files[xmlFiles[0]] as any)
              .internalStream('string')
              .on('data', (chunk: string) => feed(chunk))
              .on('error', (err: unknown) => reject(err))
              .on('end', () => resolve())
              .resume();
          });
          console.log(`Streamed XML from ${xmlFiles[0]}`);
          return { ok: true, sourceUrl: url };
        }
        console.log('No XML files in ZIP');
      } else if (bytes[0] === 0x3C) {
        const decoder = new TextDecoder();
        const head = decoder.decode(bytes.slice(0, 2000));
        if (head.includes('<?xml') || head.includes('<revista') || head.includes('<processo')) {
          console.log('Got XML directly');
          const CHUNK = 1 << 20;
          const streamDecoder = new TextDecoder();
          for (let off = 0; off < bytes.length; off += CHUNK) {
            feed(streamDecoder.decode(bytes.subarray(off, Math.min(off + CHUNK, bytes.length)), { stream: true }));
          }
          feed(streamDecoder.decode());
          return { ok: true, sourceUrl: url };
        }
        if (head.includes('login') || head.includes('id_username')) {
          console.log('Got login page - not authenticated');
        }
      } else {
        const text = new TextDecoder().decode(bytes.slice(0, 500));
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          console.log('Got HTML page instead of ZIP');
        } else {
          console.log(`Unknown format, first bytes: ${bytes.slice(0, 10).join(',')}`);
        }
      }
    } catch (error) {
      console.log(`Error fetching ${url}: ${error}`);
    }
  }

  return { ok: false, sourceUrl: null };
}


// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rpiNumber, mode, force } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Login to INPI portal
    console.log('Authenticating with INPI portal...');
    const sessionCookies = await loginToInpi();
    console.log(`INPI session: ${sessionCookies ? 'authenticated' : 'unauthenticated (will try without)'}`);

    // Fetch available RPIs
    const { latest, available, withXml } = await fetchAvailableRpis(sessionCookies);

    console.log(`Latest RPI: ${latest}, requested: ${rpiNumber || 'latest'}`);
    console.log(`RPIs with XML: ${withXml.slice(0, 5).join(', ') || 'none detected'}`);

    if (mode === 'list') {
      return new Response(
        JSON.stringify({
          success: true,
          latestRpi: latest,
          recentRpis: available,
          rpWithXml: withXml,
          authenticated: !!sessionCookies,
          message: `Última RPI disponível: ${latest}. RPIs com XML de Marcas: ${withXml.slice(0, 5).join(', ') || 'nenhuma detectada'}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetRpi = rpiNumber || latest;

    // If requesting latest but it doesn't have XML, use latest with XML
    if (!rpiNumber && withXml.length > 0 && !withXml.includes(targetRpi)) {
      console.log(`RPI ${targetRpi} no XML, falling back to ${withXml[0]}`);
      targetRpi = withXml[0];
    }

    // Guard against duplicate downloads
    const { data: existing } = await supabase
      .from('rpi_uploads')
      .select('id, created_at, status, total_processes_found')
      .eq('rpi_number', targetRpi.toString())
      .order('created_at', { ascending: false });

    const completedExisting = (existing || []).find((u: any) => u.status === 'completed');
    if (completedExisting && !force) {
      const dt = new Date(completedExisting.created_at).toLocaleString('pt-BR');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ALREADY_DOWNLOADED',
          message: `RPI ${targetRpi} já foi baixada em ${dt} (${completedExisting.total_processes_found || 0} processos). Use "Reprocessar mesmo assim" para baixar novamente.`,
          rpiNumber: targetRpi,
          existingUploadId: completedExisting.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // Force mode: clear existing rows for this RPI to avoid accumulating duplicates
    if (force && existing && existing.length > 0) {
      const ids = existing.map((u: any) => u.id);
      console.log(`Force mode: removing ${ids.length} existing upload(s) for RPI ${targetRpi}`);
      await supabase.from('rpi_entries').delete().in('rpi_upload_id', ids);
      await supabase.from('rpi_uploads').delete().in('id', ids);
    }

    console.log(`Fetching RPI ${targetRpi}...`);

    const t0 = Date.now();
    const { feed, finish } = createScanner();
    const download = await downloadAndScanRpiXml(targetRpi, sessionCookies, feed);

    if (!download.ok) {
      const latestWithXml = withXml.length > 0 ? withXml[0] : null;
      return new Response(
        JSON.stringify({
          success: false,
          error: 'XML_NOT_AVAILABLE',
          message: `Não foi possível baixar o XML da RPI ${targetRpi} automaticamente.${latestWithXml ? ` Última RPI com XML: ${latestWithXml}.` : ''} Por favor, acesse revistas.inpi.gov.br e faça upload manual do arquivo.`,
          rpiNumber: targetRpi,
          latestAvailable: latest,
          latestWithXml,
          authenticated: !!sessionCookies,
          suggestedUrl: `${INPI_BASE_URL}/rpi/`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const scan = finish();
    const elapsedMs = Date.now() - t0;
    console.log(
      `Scan: ${scan.totalBlocks} blocos, ${scan.processes.length} processos únicos, ${scan.totalMentions} menções, ${scan.bytesRead} caracteres em ${elapsedMs}ms`,
    );

    if (scan.processes.length === 0) {
      const { data: rpiUpload } = await supabase
        .from('rpi_uploads')
        .insert({
          file_name: `RPI_${targetRpi}_auto.xml`,
          file_path: `remote/RPI_${targetRpi}.xml`,
          source_file_url: download.sourceUrl,
          rpi_number: targetRpi.toString(),
          rpi_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          is_preview: isPreview,
          total_processes_found: 0,
          total_clients_matched: 0,
          total_mentions: 0,
          parse_stats: { blocks: scan.totalBlocks, chars: scan.bytesRead, elapsed_ms: elapsedMs },
          summary: `RPI ${targetRpi} analisada. Nenhum processo do procurador ${ATTORNEY_NAME} foi publicado nesta edição.`,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          rpiNumber: targetRpi,
          totalProcesses: 0,
          totalMentions: 0,
          matchedClients: 0,
          uploadId: rpiUpload?.id,
          message: `RPI ${targetRpi} processada. Nenhum processo do procurador encontrado.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: rpiUpload, error: uploadError } = await supabase
      .from('rpi_uploads')
      .insert({
        file_name: `RPI_${targetRpi}_auto.xml`,
        file_path: `remote/RPI_${targetRpi}.xml`,
        source_file_url: download.sourceUrl,
        rpi_number: targetRpi.toString(),
        rpi_date: new Date().toISOString().split('T')[0],
        status: 'processing',
        is_preview: isPreview,
      })
      .select()
      .single();

    if (uploadError) throw uploadError;

    // ── vinculação segura ao cliente ───────────────────────────
    const { data: existingProcesses } = await supabase
      .from('brand_processes')
      .select('id, process_number, user_id, brand_name');

    const processMap = new Map(
      (existingProcesses || []).map((p: any) => [String(p.process_number || '').replace(/\D/g, ''), p]),
    );

    let matchedClients = 0;
    let ambiguous = 0;
    const entries: any[] = [];

    for (const proc of scan.processes) {
      const cleanNumber = proc.processNumber;
      const existingProcess = processMap.get(cleanNumber);

      let matchedClientId: string | null = existingProcess?.user_id ?? null;
      let matchedProcessId: string | null = existingProcess?.id ?? null;
      const candidates: any[] = [];

      // Sem processo no CRM: tenta CPF/CNPJ exato do titular
      if (!matchedClientId) {
        const docs = proc.holders
          .map((h) => (h.name.match(/\d{11,14}/) || [])[0])
          .filter(Boolean) as string[];
        for (const doc of docs) {
          const { data: found } = await supabase.rpc('profiles_by_doc_digits', { p_doc: doc });
          if (found && found.length === 1) {
            matchedClientId = found[0].id;
            candidates.push({ tipo: 'cpf_cnpj_exato', doc, profile_id: found[0].id });
            break;
          }
          if (found && found.length > 1) {
            ambiguous++;
            candidates.push({ tipo: 'cpf_cnpj_ambiguo', doc, quantidade: found.length });
          }
        }
      }

      // Marca nunca vincula sozinha: entra apenas como candidato auxiliar
      if (!matchedClientId && proc.brandName) {
        const alvo = proc.brandName.toLowerCase();
        const porMarca = (existingProcesses || []).filter(
          (p: any) => (p.brand_name || '').toLowerCase().trim() === alvo,
        );
        if (porMarca.length > 0) {
          ambiguous++;
          for (const p of porMarca.slice(0, 5)) {
            candidates.push({ tipo: 'marca_semelhante', process_id: p.id, user_id: p.user_id, brand_name: p.brand_name });
          }
        }
      }

      if (matchedClientId) matchedClients++;

      const needsReview =
        proc.isDestituicao || proc.isNomeacao || proc.isSubstituicao || (!matchedClientId && candidates.length > 0);

      const holderName = proc.holders[0]?.name ?? proc.requerentes[0]?.name ?? null;

      const fieldSources: Record<string, string> = {};
      const mark = (field: string, value: unknown) => {
        if (value !== null && value !== undefined && value !== '') fieldSources[field] = 'rpi_xml';
      };
      mark('brand_name', proc.brandName);
      mark('holder_name', holderName);
      mark('dispatch_code', proc.primaryDispatchCode);
      mark('deposit_date', proc.depositDate);
      mark('ncl_classes', proc.nclClasses.length ? proc.nclClasses : null);

      entries.push({
        rpi_upload_id: rpiUpload.id,
        process_number: cleanNumber,
        brand_name: proc.brandName,
        holder_name: holderName,
        attorney_name: ATTORNEY_NAME,
        ncl_classes: proc.nclClasses.length > 0 ? proc.nclClasses : null,
        dispatch_code: proc.primaryDispatchCode,
        dispatch_text: proc.primaryDispatchText,
        dispatch_type: proc.primaryDispatchName || determineDispatchType(proc.primaryDispatchCode, proc.primaryDispatchText),
        publication_date: null,
        matched_client_id: matchedClientId,
        matched_process_id: matchedProcessId,
        update_status: 'pending',
        occurrences_count: proc.occurrences.length,
        occurrences: proc.occurrences,
        relation_types: proc.occurrences.length > 1
          ? Array.from(new Set([...proc.relationTypes, 'multiplas_ocorrencias']))
          : proc.relationTypes,
        relation_primary: proc.relationPrimary,
        relation_confidence: proc.relationConfidence,
        is_destituicao: proc.isDestituicao,
        is_nomeacao: proc.isNomeacao,
        is_substituicao: proc.isSubstituicao,
        procurador_anterior: proc.procuradorAnterior,
        procurador_novo: proc.procuradorNovo,
        needs_human_review: needsReview,
        review_reason: proc.isDestituicao
          ? 'Procurador destituído nesta publicação'
          : (!matchedClientId && candidates.length > 0 ? 'Vínculo ambíguo — confirmar cliente' : null),
        deposit_date: proc.depositDate,
        concession_date: proc.concessionDate,
        validity_date: proc.validityDate,
        natureza: proc.natureza,
        apresentacao: proc.apresentacao,
        apostila: proc.apostila,
        titulares: proc.holders,
        requerentes: proc.requerentes,
        procuradores: proc.procuradores,
        dispatches: proc.dispatches,
        protocols: proc.protocols,
        ncl_specifications: proc.nclSpecifications,
        vienna_classes: proc.viennaClasses,
        field_sources: fieldSources,
        match_candidates: candidates,
        process_block_hash: await sha256Hex(`${targetRpi}:${cleanNumber}:${proc.occurrences.length}`),
        source_file_ref: download.sourceUrl,
        enrichment_status: proc.brandName && holderName ? 'completo' : 'pendente',
      });
    }

    const { data: insertedEntries, error: entriesError } = await supabase
      .from('rpi_entries')
      .upsert(entries, { onConflict: 'rpi_upload_id,process_number' })
      .select('id, process_number, enrichment_status');
    if (entriesError) throw entriesError;

    // Fila de complementação: só o que ficou incompleto
    const pendentes = (insertedEntries || []).filter((e: any) => e.enrichment_status === 'pendente');
    if (pendentes.length > 0) {
      await supabase.from('rpi_enrichment_queue').upsert(
        pendentes.map((e: any) => ({
          rpi_entry_id: e.id,
          process_number: e.process_number,
          status: 'pendente',
          next_attempt_at: new Date().toISOString(),
        })),
        { onConflict: 'rpi_entry_id' },
      );
    }

    const stats = {
      blocks: scan.totalBlocks,
      chars: scan.bytesRead,
      elapsed_ms: elapsedMs,
      mentions: scan.totalMentions,
      unique_processes: scan.processes.length,
      with_brand_xml: scan.processes.filter((p) => !!p.brandName).length,
      with_holder_xml: scan.processes.filter((p) => p.holders.length > 0).length,
      with_dispatch_code: scan.processes.filter((p) => !!p.primaryDispatchCode).length,
      destituicoes: scan.processes.filter((p) => p.isDestituicao).length,
      nomeacoes: scan.processes.filter((p) => p.isNomeacao).length,
      substituicoes: scan.processes.filter((p) => p.isSubstituicao).length,
      peticoes: scan.processes.filter((p) => p.relationTypes.includes('procurador_protocolo')).length,
      ambiguos: ambiguous,
      pendentes_enriquecimento: pendentes.length,
    };

    const summary = isPreview
      ? `Prévia da RPI ${targetRpi}: ${scan.totalMentions} menções, ${scan.processes.length} processos únicos, ${matchedClients} vinculados a clientes. Nenhuma automação disparada.`
      : `RPI ${targetRpi} processada. ${scan.processes.length} publicações do procurador encontradas, ${matchedClients} correspondem a clientes WebMarcas.`;

    await supabase
      .from('rpi_uploads')
      .update({
        status: 'completed',
        total_processes_found: scan.processes.length,
        total_clients_matched: matchedClients,
        total_mentions: scan.totalMentions,
        parse_stats: stats,
        summary,
        processed_at: new Date().toISOString(),
      })
      .eq('id', rpiUpload.id);

    return new Response(
      JSON.stringify({
        success: true,
        rpiNumber: targetRpi,
        preview: isPreview,
        totalProcesses: scan.processes.length,
        totalMentions: scan.totalMentions,
        matchedClients,
        uploadId: rpiUpload.id,
        message: summary,
        stats,
        processes: scan.processes.map((p) => ({
          processNumber: p.processNumber,
          brandName: p.brandName,
          holderName: p.holders[0]?.name ?? null,
          dispatchCode: p.primaryDispatchCode,
          dispatchName: p.primaryDispatchName,
          relationPrimary: p.relationPrimary,
          occurrences: p.occurrences.length,
          isDestituicao: p.isDestituicao,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );


  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Erro ao processar RPI remota.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
