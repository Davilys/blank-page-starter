import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedClient {
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  cpf_cnpj?: string;
  address?: string;
  neighborhood?: string;
  address_number?: string;
  address_complement?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  origin?: string;
  priority?: string;
  contract_value?: number;
  brand_name?: string;
  // Raw data for mapping
  _raw?: Record<string, unknown>;
  _rowIndex?: number;
}

export interface ParseResult {
  data: ParsedClient[];
  headers: string[];
  errors: string[];
  format: 'csv' | 'xlsx' | 'xls' | 'xml' | 'pdf';
}

export interface FieldMapping {
  [key: string]: string | null; // fileColumn -> systemField
}

// Default field mapping suggestions
export const SYSTEM_FIELDS = [
  { key: 'full_name', label: 'Nome Completo', required: true },
  { key: 'email', label: 'E-mail', required: true },
  { key: 'phone', label: 'Telefone', required: false },
  { key: 'company_name', label: 'Empresa', required: false },
  { key: 'cpf_cnpj', label: 'CPF/CNPJ', required: false },
  { key: 'address', label: 'Endereço', required: false },
  { key: 'neighborhood', label: 'Bairro', required: false },
  { key: 'address_number', label: 'Número', required: false },
  { key: 'address_complement', label: 'Complemento', required: false },
  { key: 'city', label: 'Cidade', required: false },
  { key: 'state', label: 'Estado', required: false },
  { key: 'zip_code', label: 'CEP', required: false },
  { key: 'origin', label: 'Origem', required: false },
  { key: 'priority', label: 'Prioridade', required: false },
  { key: 'contract_value', label: 'Valor do Contrato', required: false },
  { key: 'brand_name', label: 'Marca', required: false },
];

// Common field name variations for auto-mapping
const FIELD_ALIASES: Record<string, string[]> = {
  full_name: ['nome', 'name', 'full_name', 'nome completo', 'cliente', 'razao social', 'razão social', 'contact_name', 'firstname', 'lastname'],
  email: ['email', 'e-mail', 'correio', 'mail', 'email_address'],
  phone: ['telefone', 'phone', 'tel', 'celular', 'mobile', 'whatsapp', 'fone', 'phone_number'],
  company_name: ['empresa', 'company', 'company_name', 'organization', 'organização', 'organizacao', 'razao_social'],
  cpf_cnpj: ['cpf', 'cnpj', 'cpf_cnpj', 'documento', 'vat', 'tax_id', 'cpf/cnpj', 'cpf ou cnpj', 'cpf_ou_cnpj'],
  address: ['endereco', 'endereço', 'address', 'logradouro', 'rua', 'street'],
  neighborhood: ['bairro', 'neighborhood', 'district'],
  address_number: ['numero', 'número', 'nro', 'num', 'number', 'address_number'],
  address_complement: ['complemento', 'compl', 'complement', 'address_complement', 'apto', 'apartamento'],
  city: ['cidade', 'city', 'municipio', 'município'],
  state: ['estado', 'state', 'uf'],
  zip_code: ['cep', 'zip', 'zip_code', 'postal', 'postal_code', 'codigo_postal'],
  origin: ['origem', 'origin', 'source', 'fonte', 'canal'],
  priority: ['prioridade', 'priority', 'urgencia', 'urgência'],
  contract_value: ['valor', 'value', 'contract_value', 'valor_contrato', 'amount', 'total'],
  brand_name: ['marca', 'brand', 'brand_name', 'nome_marca', 'nome da marca'],
};

/**
 * Parse CSV file
 */
export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const headers = results.meta.fields || [];
        const data: ParsedClient[] = results.data.map((row: unknown, index: number) => ({
          _raw: row as Record<string, unknown>,
          _rowIndex: index,
        }));
        
        resolve({
          data,
          headers,
          errors: results.errors.map(e => e.message),
          format: 'csv',
        });
      },
      error: (error) => {
        reject(new Error(`Erro ao processar CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Parse Excel file (XLSX/XLS)
 */
export function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        
        if (jsonData.length === 0) {
          resolve({ data: [], headers: [], errors: ['Planilha vazia'], format: 'xlsx' });
          return;
        }
        
        // First row is headers
        const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());
        
        // Rest is data
        const parsedData: ParsedClient[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            const rawRow: Record<string, unknown> = {};
            headers.forEach((header, index) => {
              rawRow[header] = row[index];
            });
            parsedData.push({
              _raw: rawRow,
              _rowIndex: i - 1,
            });
          }
        }
        
        const format = file.name.toLowerCase().endsWith('.xls') ? 'xls' : 'xlsx';
        resolve({ data: parsedData, headers, errors: [], format });
      } catch (error) {
        reject(new Error(`Erro ao processar Excel: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo Excel'));
    };
    
    reader.readAsBinaryString(file);
  });
}

/**
 * Parse XML file
 */
export function parseXML(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        // Check for parsing errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
          reject(new Error('Erro ao processar XML: formato inválido'));
          return;
        }
        
        // Try to find client/contact nodes (common structures)
        const clientNodes = 
          xmlDoc.querySelectorAll('client, contact, customer, lead, cliente, contato') ||
          xmlDoc.querySelectorAll('row, record, item');
        
        if (clientNodes.length === 0) {
          // Try root children
          const root = xmlDoc.documentElement;
          const children = Array.from(root.children);
          
          if (children.length === 0) {
            resolve({ data: [], headers: [], errors: ['Nenhum registro encontrado no XML'], format: 'xml' });
            return;
          }
          
          const headers = new Set<string>();
          const parsedData: ParsedClient[] = [];
          
          children.forEach((child, index) => {
            const rawRow: Record<string, unknown> = {};
            Array.from(child.children).forEach(field => {
              const key = field.tagName;
              headers.add(key);
              rawRow[key] = field.textContent?.trim() || '';
            });
            
            // Also check attributes
            Array.from(child.attributes).forEach(attr => {
              headers.add(attr.name);
              rawRow[attr.name] = attr.value;
            });
            
            parsedData.push({ _raw: rawRow, _rowIndex: index });
          });
          
          resolve({ data: parsedData, headers: Array.from(headers), errors: [], format: 'xml' });
          return;
        }
        
        const headers = new Set<string>();
        const parsedData: ParsedClient[] = [];
        
        clientNodes.forEach((node, index) => {
          const rawRow: Record<string, unknown> = {};
          
          Array.from(node.children).forEach(field => {
            const key = field.tagName;
            headers.add(key);
            rawRow[key] = field.textContent?.trim() || '';
          });
          
          Array.from(node.attributes).forEach(attr => {
            headers.add(attr.name);
            rawRow[attr.name] = attr.value;
          });
          
          parsedData.push({ _raw: rawRow, _rowIndex: index });
        });
        
        resolve({ data: parsedData, headers: Array.from(headers), errors: [], format: 'xml' });
      } catch (error) {
        reject(new Error(`Erro ao processar XML: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo XML'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Auto-suggest field mappings based on header names
 */
export function suggestFieldMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  
  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim().replace(/[_\-\s]+/g, '_');
    
    for (const [systemField, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some(alias => {
        const normalizedAlias = alias.toLowerCase().replace(/[_\-\s]+/g, '_');
        return normalizedHeader === normalizedAlias || 
               normalizedHeader.includes(normalizedAlias) ||
               normalizedAlias.includes(normalizedHeader);
      })) {
        mapping[header] = systemField;
        break;
      }
    }
    
    if (!mapping[header]) {
      mapping[header] = null; // No mapping found
    }
  });
  
  return mapping;
}

/**
 * Apply field mapping to parsed data
 */
export function applyFieldMapping(data: ParsedClient[], mapping: FieldMapping): ParsedClient[] {
  return data.map(row => {
    const mappedClient: ParsedClient = { _rowIndex: row._rowIndex };
    
    Object.entries(mapping).forEach(([fileColumn, systemField]) => {
      if (systemField && row._raw?.[fileColumn] !== undefined) {
        let value = row._raw[fileColumn];
        
        // Type conversions
        if (systemField === 'contract_value' && value) {
          const numValue = parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
          if (!isNaN(numValue)) {
            (mappedClient as Record<string, unknown>)[systemField] = numValue;
          }
        } else {
          (mappedClient as Record<string, unknown>)[systemField] = String(value || '').trim();
        }
      }
    });
    
    return mappedClient;
  });
}

/**
 * Validate parsed client data
 */
export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export function validateClients(clients: ParsedClient[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenEmails = new Set<string>();
  
  clients.forEach((client, index) => {
    // Email validation
    if (!client.email) {
      errors.push({ rowIndex: index, field: 'email', message: 'E-mail é obrigatório' });
    } else {
      const email = client.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ rowIndex: index, field: 'email', message: 'E-mail inválido' });
      } else if (seenEmails.has(email)) {
        errors.push({ rowIndex: index, field: 'email', message: 'E-mail duplicado no arquivo' });
      } else {
        seenEmails.add(email);
      }
    }
    
    // Name validation
    if (!client.full_name || client.full_name.trim().length < 2) {
      errors.push({ rowIndex: index, field: 'full_name', message: 'Nome é obrigatório' });
    }
    
    // CPF/CNPJ validation (if provided)
    if (client.cpf_cnpj) {
      const doc = client.cpf_cnpj.replace(/\D/g, '');
      if (doc.length !== 11 && doc.length !== 14) {
        errors.push({ rowIndex: index, field: 'cpf_cnpj', message: 'CPF/CNPJ inválido' });
      }
    }
  });
  
  return errors;
}

/**
 * Detect file format and parse accordingly
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'csv':
      return parseCSV(file);
    case 'xlsx':
    case 'xls':
      return parseExcel(file);
    case 'xml':
      return parseXML(file);
    case 'pdf':
      // PDF requires server-side processing
      throw new Error('PDF_REQUIRES_SERVER');
    default:
      throw new Error(`Formato não suportado: ${extension}`);
  }
}
