Plano para deixar o download do PDF muito mais rápido:

1. Trocar o botão principal para um download rápido via impressão nativa
   - Usar o próprio navegador para gerar o PDF a partir do preview já renderizado.
   - Isso evita o processo lento atual, que captura bloco por bloco com html2canvas.
   - Resultado esperado: abre quase instantaneamente a janela de salvar/imprimir PDF.

2. Manter uma opção de alta fidelidade como alternativa
   - Preservar o gerador atual como “PDF completo/alta qualidade” ou “PDF com anexos renderizados”, caso seja necessário.
   - Assim não perdemos o fallback quando houver imagens/anexos complexos.

3. Ajustar os rótulos da interface
   - Botão principal: “Baixar PDF rápido”.
   - Botão secundário: “Gerar PDF completo”.
   - Mensagens claras de progresso apenas no modo completo.

4. Otimizar o gerador completo existente
   - Reduzir capturas desnecessárias.
   - Ignorar blocos vazios ou invisíveis.
   - Usar escala menor quando o documento tiver muitos blocos/anexos.
   - Evitar esperar indefinidamente por imagens que não carregam.

5. Validar visualmente
   - Conferir que o PDF rápido mantém cabeçalho, conteúdo, assinatura e rodapé.
   - Conferir que o PDF completo ainda não corta texto nem sobrepõe rodapé.

Observação importante: download 100% instantâneo em PDF real só é possível se o PDF já estiver pré-gerado e salvo. Sem isso, o mais rápido é usar a impressão nativa do navegador, que é muito mais leve do que html2canvas.