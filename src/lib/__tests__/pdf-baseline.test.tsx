// Gera PDFs BASELINE do gerador REAL de contratos (generateContractPDF) com:
//  - LOGO REAL (src/assets/webmarcas-logo-mark.webp convertido offline para PNG,
//    fixture webmarcas-logo-mark.png — mesma imagem que produção serve);
//  - fixtures 100% sintéticas (sem dados de cliente/modelo real);
//  - relógio congelado (determinístico);
//  - variações que o gerador realmente suporta: SEM assinatura blockchain e COM
//    certificação blockchain (hash/timestamp/txId/network fixos).
// Artefatos: comparação visual/estrutural da migração jsPDF 4.0.0 -> 4.2.1.
// O nome do arquivo carrega a versão INSTALADA do jspdf (lida do package.json).
import { it, vi, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const h = vi.hoisted(() => ({ logo: '' }));
vi.mock('@/components/contracts/ContractRenderer', () => ({
  getLogoBase64: async () => h.logo,
}));

import { generateContractPDF } from '@/hooks/useContractPdfGenerator';

const CONTENT = [
  'CONTRATANTE: Empresa Fictícia de Testes LTDA, CNPJ 00.000.000/0001-00, com sede na Rua Exemplo, 123, São Paulo/SP.',
  'CONTRATADA: WebMarcas Exemplo, com sede na Av. Amostra, 456, São Paulo/SP.',
  'CLÁUSULA PRIMEIRA — DO OBJETO: prestação de serviços de assessoramento para registro de marca junto ao INPI, classe NICE 30.',
  'CLÁUSULA SEGUNDA — DO PREÇO: R$ 1.139,00 (mil cento e trinta e nove reais), pagamento via PIX.',
  'CLÁUSULA TERCEIRA — DO PRAZO: vigência de 12 (doze) meses a partir da assinatura.',
  'Texto longo de preenchimento para exercitar quebra de linha e paginação do gerador: '.repeat(40),
].join('\n\n');

const jspdfVersion = createRequire(import.meta.url)('jspdf/package.json').version as string;
const outBase = `/tmp/fix/pdf-baseline-jspdf-${jspdfVersion}`;

const render = async (signed: boolean) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T12:00:00-03:00'));
  const blob = await generateContractPDF(CONTENT, {
    brandName: 'MARCA EXEMPLO SYNTH',
    clientName: 'Maria Exemplo Silva',
    clientCpf: '000.000.000-00',
    ...(signed ? {
      blockchainSignature: {
        hash: 'a'.repeat(64),
        timestamp: '2026-10-20 15:30:00 UTC',
        txId: 'b'.repeat(64),
        network: 'Bitcoin (OpenTimestamps)',
        ipAddress: '192.0.2.1',
      },
    } : {}),
  });
  vi.useRealTimers();
  return Buffer.from(await blob.arrayBuffer());
};

it('gera baseline COM certificação blockchain (logo real)', async () => {
  h.logo = 'data:image/png;base64,' + readFileSync('src/lib/__tests__/fixtures/webmarcas-logo-mark.png').toString('base64');
  const buf = await render(true);
  writeFileSync(`${outBase}-signed.pdf`, buf);
  expect(buf.length).toBeGreaterThan(5000);
  expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
});

it('gera baseline SEM assinatura (logo real)', async () => {
  h.logo = 'data:image/png;base64,' + readFileSync('src/lib/__tests__/fixtures/webmarcas-logo-mark.png').toString('base64');
  const buf = await render(false);
  writeFileSync(`${outBase}-unsigned.pdf`, buf);
  expect(buf.length).toBeGreaterThan(5000);
  expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
});
