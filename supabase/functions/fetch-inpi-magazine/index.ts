import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ATTORNEY_NAME = 'Davilys Danques Oliveira Cunha';
const ATTORNEY_SEARCH_TERM = 'davilys';

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
  const referenceDate = new Date('2024-12-10');
  const referenceRpi = 2870;
  const today = new Date();
  const diffWeeks = Math.floor((today.getTime() - referenceDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return referenceRpi + diffWeeks;
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

  try {
    const response = await fetchWithSession(`${INPI_BASE_URL}/rpi/`, sessionCookies);

    if (!response.ok) {
      // If we get a redirect to login, session might have failed
      const text = await response.text();
      if (text.includes('login') || response.status === 302) {
        console.log('Session expired or not authenticated, using fallback');
        throw new Error('Not authenticated');
      }
      throw new Error(`Failed to fetch INPI page: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Fetched INPI page, length: ${html.length}`);

    // Check if we got the actual RPI page or the login page
    if (html.includes('id="login_form"') || html.includes('id_username')) {
      console.log('Got login page instead of RPI page - authentication failed');
      const fallbackNumbers = Array.from({ length: 20 }, (_, i) => expectedRpi - i);
      return { latest: expectedRpi, available: fallbackNumbers, withXml: [] };
    }

    // Find all RPI numbers from the page
    const rpiNumbers: number[] = [];
    const rpiRegex = /(\d{4})/g;
    let match;
    
    // Try to find RPI numbers in table cells or links
    const tdRegex = /<td[^>]*>\s*(\d{4})\s*<\/td>/gi;
    while ((match = tdRegex.exec(html)) !== null) {
      const num = parseInt(match[1]);
      if (num >= 2800 && num <= 3100) rpiNumbers.push(num);
    }

    // Also try links that mention RPI numbers
    const linkRegex = /rpi[\/\-_]?(\d{4})/gi;
    while ((match = linkRegex.exec(html)) !== null) {
      const num = parseInt(match[1]);
      if (num >= 2800 && num <= 3100 && !rpiNumbers.includes(num)) rpiNumbers.push(num);
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
        if (num >= 2800 && num <= 3100 && !rpWithXml.includes(num)) rpWithXml.push(num);
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

    const fallbackNumbers = Array.from({ length: 20 }, (_, i) => expectedRpi - i);
    return { latest: expectedRpi, available: fallbackNumbers, withXml: [] };

  } catch (error) {
    console.error('Error fetching available RPIs:', error);
    const fallbackNumbers = Array.from({ length: 20 }, (_, i) => expectedRpi - i);
    return { latest: expectedRpi, available: fallbackNumbers, withXml: [] };
  }
}

interface ExtractedProcess {
  processNumber: string;
  brandName: string | null;
  holderName: string | null;
  attorneyName: string | null;
  nclClasses: string[];
  dispatchCode: string | null;
  dispatchText: string | null;
  dispatchType: string | null;
  publicationDate: string | null;
}

// Parse INPI XML - memory-efficient
function parseRpiXml(xmlContent: string, rpiNumber: number): ExtractedProcess[] {
  const processes: ExtractedProcess[] = [];
  const MAX_PROCESSES = 300;
  const BATCH_SIZE = 500;

  console.log(`Parsing XML content, size: ${xmlContent.length} bytes`);

  const searchTerm = ATTORNEY_SEARCH_TERM.toLowerCase();
  const searchRegex = new RegExp(searchTerm, 'i');

  if (!searchRegex.test(xmlContent)) {
    console.log('Attorney name not found in XML content');
    return [];
  }

  console.log('Attorney name found! Extracting processes...');

  const extractTagContent = (xml: string, tagName: string): string | null => {
    const startTag = `<${tagName}`;
    const endTag = `</${tagName}>`;
    const startIdx = xml.indexOf(startTag);
    if (startIdx === -1) return null;
    const endIdx = xml.indexOf(endTag, startIdx);
    if (endIdx === -1) return null;
    const tagEndIdx = xml.indexOf('>', startIdx);
    if (tagEndIdx === -1 || tagEndIdx > endIdx) return null;
    let content = xml.substring(tagEndIdx + 1, endIdx).trim();
    content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return content || null;
  };

  const extractAttribute = (xml: string, tagName: string, attrName: string): string | null => {
    const tagStart = xml.indexOf(`<${tagName}`);
    if (tagStart === -1) return null;
    const tagEnd = xml.indexOf('>', tagStart);
    if (tagEnd === -1) return null;
    const tagContent = xml.substring(tagStart, tagEnd);
    const attrMatch = tagContent.match(new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i'));
    return attrMatch ? attrMatch[1].trim() : null;
  };

  const headerSection = xmlContent.slice(0, 2000);
  const revistaMatch = headerSection.match(/<revista[^>]*data[^>]*=["']([^"']+)["']/i);
  const publicationDate = revistaMatch ? revistaMatch[1] : null;

  const processoEndTag = '</processo>';
  const chunks = xmlContent.split(processoEndTag);
  const totalChunks = chunks.length;

  console.log(`Split into ${totalChunks} chunks`);
  xmlContent = '';

  for (let batchStart = 0; batchStart < totalChunks && processes.length < MAX_PROCESSES; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks - 1);
    for (let i = batchStart; i < batchEnd && processes.length < MAX_PROCESSES; i++) {
      const chunk = chunks[i];
      if (!chunk || chunk.length < 50) continue;
      if (!searchRegex.test(chunk)) continue;

      const processoStart = chunk.lastIndexOf('<processo');
      if (processoStart === -1) continue;
      const block = chunk.substring(processoStart) + processoEndTag;

      let processNumber: string | null = null;
      const numAttrMatch = block.match(/numero\s*=\s*["'](\d+)["']/i);
      if (numAttrMatch) {
        processNumber = numAttrMatch[1];
      } else {
        const numMatch = block.match(/(\d{9,12})/);
        if (numMatch) processNumber = numMatch[1];
      }
      if (!processNumber) continue;

      const cleanNumber = processNumber.replace(/\D/g, '');

      let isDuplicate = false;
      for (const p of processes) {
        if (p.processNumber === cleanNumber) { isDuplicate = true; break; }
      }
      if (isDuplicate) continue;

      let brandName = extractTagContent(block, 'marca') || extractTagContent(block, 'nome') || extractTagContent(block, 'denominacao') || extractAttribute(block, 'marca', 'nome') || extractAttribute(block, 'marca', 'apresentacao');
      if (brandName) brandName = brandName.replace(/<[^>]+>/g, '').trim();

      const holderName = extractAttribute(block, 'titular', 'nome-razao-social') || extractTagContent(block, 'titular') || extractTagContent(block, 'requerente') || extractTagContent(block, 'depositante');
      const dispatchCode = extractAttribute(block, 'despacho', 'codigo') || extractTagContent(block, 'codigo') || extractTagContent(block, 'cod-despacho');
      const dispatchText = extractTagContent(block, 'texto-complementar') || extractTagContent(block, 'descricao') || extractTagContent(block, 'texto');

      const nclClasses: string[] = [];
      const nclRegex = /classe-nice[^>]*codigo[^>]*=["'](\d+)["']/gi;
      let nclMatch;
      while ((nclMatch = nclRegex.exec(block)) !== null) nclClasses.push(nclMatch[1]);
      if (nclClasses.length === 0) {
        const classMatch = block.match(/classe[s]?\s*:?\s*([\d,\s]+)/i);
        if (classMatch) {
          const nums = classMatch[1].match(/\d+/g);
          if (nums) nclClasses.push(...nums);
        }
      }

      const dispatchType = determineDispatchType(dispatchCode, dispatchText);

      processes.push({
        processNumber: cleanNumber,
        brandName,
        holderName,
        attorneyName: ATTORNEY_NAME,
        nclClasses,
        dispatchCode,
        dispatchText,
        dispatchType,
        publicationDate,
      });
    }
    console.log(`Batch ${batchStart}-${batchEnd}: ${processes.length} processes`);
  }

  console.log(`Extraction complete: ${processes.length} processes`);
  return processes;
}

function determineDispatchType(code: string | null, text: string | null): string {
  const combined = normalizeText(`${code || ''} ${text || ''}`);
  if (combined.includes('deferimento') || combined.includes('deferido')) return 'Deferimento';
  if (combined.includes('indeferimento') || combined.includes('indeferido')) return 'Indeferimento';
  if (combined.includes('exigencia') || combined.includes('exigência')) return 'Exigência';
  if (combined.includes('oposicao') || combined.includes('oposição')) return 'Oposição';
  if (combined.includes('certificado') || combined.includes('concessao')) return 'Certificado';
  if (combined.includes('recurso')) return 'Recurso';
  if (combined.includes('arquivamento') || combined.includes('arquivado')) return 'Arquivamento';
  if (combined.includes('publicacao') || combined.includes('publicação')) return 'Publicação';
  if (combined.includes('sobrestamento') || combined.includes('sobrestado')) return 'Sobrestamento';
  if (combined.includes('anulacao') || combined.includes('anulação')) return 'Anulação';
  return 'Outro';
}

// Try multiple URLs to download the RPI XML, with session
async function tryDownloadRpiXml(rpiNumber: number, sessionCookies: string | null): Promise<string | null> {
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
    try {
      const response = await fetchWithSession(url, sessionCookies);

      if (!response.ok) {
        console.log(`URL ${url} returned status ${response.status}`);
        // Check if redirected to login
        const redirectUrl = response.headers.get('location') || '';
        if (redirectUrl.includes('login')) {
          console.log('Redirected to login - session may have expired');
        }
        await response.text(); // consume body
        continue;
      }

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
          const xmlContent = await zip.files[xmlFiles[0]].async('string');
          console.log(`Extracted XML from ${xmlFiles[0]}, size: ${xmlContent.length} bytes`);
          return xmlContent;
        }
        console.log('No XML files in ZIP');
      } else if (bytes[0] === 0x3C) {
        const text = new TextDecoder().decode(bytes);
        if (text.includes('<?xml') || text.includes('<revista') || text.includes('<processo')) {
          console.log('Got XML directly');
          return text;
        }
        if (text.includes('login') || text.includes('id_username')) {
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

  return null;
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rpiNumber, mode } = await req.json();

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

    console.log(`Fetching RPI ${targetRpi}...`);

    // Try to download with session
    const xmlContent = await tryDownloadRpiXml(targetRpi, sessionCookies);

    if (!xmlContent) {
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

    // Parse and process
    const extractedProcesses = parseRpiXml(xmlContent, targetRpi);
    console.log(`Found ${extractedProcesses.length} processes`);

    if (extractedProcesses.length === 0) {
      const { data: rpiUpload } = await supabase
        .from('rpi_uploads')
        .insert({
          file_name: `RPI_${targetRpi}_auto.xml`,
          file_path: `remote/RPI_${targetRpi}.xml`,
          rpi_number: targetRpi.toString(),
          rpi_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          total_processes_found: 0,
          total_clients_matched: 0,
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
        rpi_number: targetRpi.toString(),
        rpi_date: new Date().toISOString().split('T')[0],
        status: 'processing',
      })
      .select()
      .single();

    if (uploadError) throw uploadError;

    const { data: existingProcesses } = await supabase
      .from('brand_processes')
      .select('id, process_number, user_id, brand_name');

    const processMap = new Map(
      (existingProcesses || []).map(p => [p.process_number?.replace(/\D/g, ''), p])
    );

    let matchedClients = 0;
    const entries = extractedProcesses.map(proc => {
      const cleanNumber = proc.processNumber.replace(/\D/g, '');
      const existingProcess = processMap.get(cleanNumber);
      if (existingProcess?.user_id) matchedClients++;

      return {
        rpi_upload_id: rpiUpload.id,
        process_number: cleanNumber,
        brand_name: proc.brandName,
        holder_name: proc.holderName,
        attorney_name: proc.attorneyName || ATTORNEY_NAME,
        ncl_classes: proc.nclClasses.length > 0 ? proc.nclClasses : null,
        dispatch_code: proc.dispatchCode,
        dispatch_text: proc.dispatchText,
        dispatch_type: proc.dispatchType,
        publication_date: convertBrazilianDateToISO(proc.publicationDate),
        matched_client_id: existingProcess?.user_id || null,
        matched_process_id: existingProcess?.id || null,
        update_status: 'pending',
      };
    });

    const { error: entriesError } = await supabase.from('rpi_entries').insert(entries);
    if (entriesError) throw entriesError;

    const summary = `RPI ${targetRpi} processada. ${extractedProcesses.length} publicações do procurador encontradas, ${matchedClients} correspondem a clientes WebMarcas.`;

    await supabase
      .from('rpi_uploads')
      .update({
        status: 'completed',
        total_processes_found: extractedProcesses.length,
        total_clients_matched: matchedClients,
        summary,
        processed_at: new Date().toISOString(),
      })
      .eq('id', rpiUpload.id);

    return new Response(
      JSON.stringify({
        success: true,
        rpiNumber: targetRpi,
        totalProcesses: extractedProcesses.length,
        matchedClients,
        uploadId: rpiUpload.id,
        message: summary,
        processes: extractedProcesses.map(p => ({
          processNumber: p.processNumber,
          brandName: p.brandName,
          dispatchType: p.dispatchType,
          holderName: p.holderName,
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
