// Contencao: abrir a aba Publicacoes NAO deve gravar no banco.
// As rotinas de auto-criar, auto-sincronizar (RPI) e auto-arquivar ao carregar
// ficam desligadas ate decisao explicita. Para religar, mude para true (ou
// substitua por acao manual com confirmacao). Nada foi apagado.
export const PUBLICACOES_AUTOWRITE_ON_LOAD = false;
