# Republicar o site (webmarcas.net) com a versão atual — leitura de PDF em Recursos INPI

## Diagnóstico (confirmado)

- No preview do Lovable, o envio e a leitura de PDF na aba Recursos INPI funcionam ("Lido").
- No site publicado ([www.webmarcas.net](http://www.webmarcas.net)), a página falha com `Failed to fetch dynamically imported module: .../assets/pdf.worker.min-BVPM1tzH...` — o site publicado referencia um arquivo de build antigo que não existe mais na hospedagem. Ou seja: **a hospedagem está com build desatualizado ou parcial** (index.html novo sem os assets correspondentes, ou vice-versa).
- O código-fonte atual do projeto já contém toda a atualização da aba Recursos (upload, leitura com IA, estados Enviando/Lido). Não há nada a corrigir no código — falta **sincronizar e republicar**.
- O repositório git deste projeto é o interno do Lovable; não há acesso direto daqui ao GitHub do cliente nem à hospedagem (Apache, com `.htaccess`).

## O que eu faço (aqui no projeto)

1. Conferir estaticamente que o leitor de PDF (`pdfjs-dist` com worker empacotado) está correto no código atual e que o build gera o `pdf.worker` com hash correspondente — garantir que, uma vez publicado o build completo, o erro não se repete.
2. Garantir que o código esteja íntegro (typecheck) para a sincronização.

## O que precisa ser feito por você (não tenho acesso)

3. **Enviar o código atual para o GitHub**, por um dos caminhos:
  - Se o projeto já está conectado ao GitHub no Lovable (menu **+ → GitHub**), as alterações já sincronizam automaticamente a cada atualização — verificar se a conexão está ativa; se não estiver, reconectar;
  - Alternativa: no editor de código do Lovable, **Download codebase**, e subir o conteúdo no repositório do GitHub.
4. **Republicar o site completo na hospedagem**: gerar o build (`npm run build`) e enviar a pasta `dist/` **inteira** para o servidor (incluindo `index.html` e toda a pasta `assets/`), substituindo os arquivos antigos. É o envio parcial (só o index.html, ou sem a pasta assets) que causa exatamente esse erro.
  - Se o deploy é automático a partir do GitHub (ex.: GitHub Actions ou hook da hospedagem), basta o código novo chegar ao repositório e o deploy rodar de ponta a ponta.

## Validação

5. Após o deploy, abrir [www.webmarcas.net](http://www.webmarcas.net) → Recursos INPI → Documentos do caso, anexar um PDF e confirmar que aparece "Lido" (ou "Lido em parte"), sem "Falha na leitura".
6. Se ainda falhar, testar em aba anônima (para descartar cache do navegador) e me informar — aí investigo com o console do navegador.

## Limites

- Não altero nenhuma funcionalidade, layout ou regra — apenas a sincronização/publicação do que já existe.
- Não tenho acesso ao GitHub nem ao servidor de hospedagem; os passos 3 e 4 são executados por você (ou pela conexão GitHub do Lovable, que só você pode autorizar). NAO SO ISSO MAIS TODAS AS ATUALIZACOES FEITAS VEJA SE TEVE ALGUMA QUE NAO FOI SEJA NA ABA RECURRSO INPI COMO TODO CRM 