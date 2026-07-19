import { INPIResourcePDFPreview } from '@/components/admin/INPIResourcePDFPreview';
import { supabase } from '@/integrations/supabase/client';
import html2canvas from 'html2canvas';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    __h2c?: typeof html2canvas;
  }
}

window.__h2c = html2canvas;

type HarnessResource = {
  id: string;
  brand_name: string | null;
  process_number: string | null;
  ncl_class: string | null;
  holder: string | null;
  approved_at: string | null;
};

type HarnessResourceRow = HarnessResource & {
  resource_type?: string | null;
  final_content?: string | null;
  draft_content?: string | null;
};

type HarnessEvidence = {
  id: string;
  storage_path: string;
  caption: string | null;
  source_file_name: string | null;
  page_number: number | null;
  placement: 'inline' | 'annex';
  display_order: number;
  included: boolean;
  docNumber?: number;
  dataUrl?: string;
  width?: number;
  height?: number;
};

const mockResource: HarnessResource = {
  id: '0964fe3f-e1ca-48b4-b4e8-d1cf8fee9f47',
  brand_name: 'Opera Idiomas',
  process_number: '937364827',
  ncl_class: '16',
  holder: 'OPERA IDIOMAS INSTITUICAO EDUCACIONAL LTDA',
  approved_at: new Date().toISOString(),
};

const mockContent = `EXCELENTÍSSIMO SENHOR PRESIDENTE DA DIRETORIA DE MARCAS, PATENTES E DESENHOS INDUSTRIAIS DO INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI

Processo INPI nº: 937364827
Marca: Opera Idiomas
Classe NCL (12ª Ed.): 16
Titular/Requerente: OPERA IDIOMAS INSTITUICAO EDUCACIONAL LTDA [BR/BA]
Examinador(a): VINICIUS PILLAR LEAL
Procurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79

I – SÍNTESE DOS FATOS E DO HISTÓRICO PROCESSUAL

1. Com a devida vênia do ilustre examinador, inicia-se a presente peça com a exposição cronológica e pormenorizada dos fatos que motivaram o indeferimento ora atacado, com prova documental inserida no corpo do recurso [DOC:01].

2. O conjunto probatório demonstra a existência e apresentação visual da marca, bem como o contexto documental analisado [DOC:02].

II – DO DIREITO

3. A marca em questão possui distintividade suficiente para o registro, conforme se demonstrará a seguir, com base na Lei da Propriedade Industrial (Lei nº 9.279/96), inclusive pela prova de uso e apresentação ao consumidor [DOC:03].

III – DA JURISPRUDÊNCIA

4. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

5. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

6. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

7. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

8. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

9. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

10. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

11. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

12. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

13. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

14. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

15. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

16. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

17. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

18. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.

19. A motivação do indeferimento está expressa em termos sintéticos no documento decisório, e a marca reproduz ou imita os seguintes registros de terceiros, sendo, portanto, irregistrável de acordo com o inciso XIX do Art. 124 da LPI. Transcrito na própria peça o dispositivo legal invocado, verifica-se que não são registráveis como marca a reprodução ou imitação, no todo ou em parte, ainda que com acréscimo, de marca alheia registrada, para distinguir ou certificar produto ou serviço idêntico, semelhante ou afim, suscetível de causar confusão ou associação com marca alheia.`;

const createEvidenceDataUrl = (index: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 1450;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = index % 2 === 0 ? '#f4f7fb' : '#fff7ed';
  ctx.fillRect(38, 38, canvas.width - 76, canvas.height - 76);
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 8;
  ctx.strokeRect(58, 58, canvas.width - 116, canvas.height - 116);
  ctx.fillStyle = '#1e3a5f';
  ctx.font = 'bold 78px Georgia';
  ctx.fillText(`EVIDÊNCIA ${index}`, 110, 170);
  ctx.fillStyle = '#c46a21';
  ctx.fillRect(110, 225, 700, 28);
  ctx.fillStyle = '#111827';
  ctx.font = '36px Georgia';
  for (let i = 0; i < 20; i++) {
    ctx.fillText(`Linha demonstrativa de prova documental ${index}.${i + 1}`, 110, 340 + i * 48);
  }
  return canvas.toDataURL('image/jpeg', 0.82);
};

export default function PDFTestHarness() {
  const [resource, setResource] = useState<HarnessResource>(mockResource);
  const [content, setContent] = useState(mockContent);
  const [debugEvidence, setDebugEvidence] = useState<HarnessEvidence[] | undefined>();

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('heavy')) return;
    const evidences = Array.from({ length: 7 }, (_, i) => {
      const n = i + 1;
      return {
        id: `debug-${n}`,
        storage_path: `debug/evidence-${n}.jpg`,
        caption: `Evidência pesada simulada ${n}`,
        source_file_name: `evidencia-${n}.jpg`,
        page_number: n,
        placement: 'inline' as const,
        display_order: n,
        included: true,
        docNumber: n,
        dataUrl: createEvidenceDataUrl(n),
        width: 1100,
        height: 1450,
      };
    });
    setDebugEvidence(evidences);
    setContent(`${mockContent}\n\n20. Prova complementar inserida no corpo do recurso [DOC:04].\n\n21. Prova complementar inserida no corpo do recurso [DOC:05].\n\n22. Prova complementar inserida no corpo do recurso [DOC:06].\n\n23. Prova complementar inserida no corpo do recurso [DOC:07].`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('inpi_resources')
      .select('id, brand_name, process_number, ncl_class, holder, approved_at, resource_type, final_content, draft_content')
      .eq('id', mockResource.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as HarnessResourceRow;
        setResource({
          id: row.id,
          brand_name: row.brand_name,
          process_number: row.process_number,
          ncl_class: row.ncl_class,
          holder: row.holder,
          approved_at: row.approved_at,
        });
        setContent(row.final_content || row.draft_content || mockContent);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 24, background: '#e5e7eb', minHeight: '100vh' }}>
      <INPIResourcePDFPreview resource={resource} content={content} resourceType="indeferimento" debugEvidenceOverride={debugEvidence} />
    </div>
  );
}