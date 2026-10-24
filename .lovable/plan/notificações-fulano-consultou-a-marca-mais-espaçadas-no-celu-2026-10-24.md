# Notificações "Fulano consultou a marca..." mais espaçadas no celular

## O que entendi
- Vale para todo o site, mas só no celular.
- Cada notificação continua aparecendo e sumindo como hoje (fica 3 segundos na tela).
- Depois que uma some, a próxima só aparece 30 segundos depois. Hoje esse intervalo é de 2 segundos.
- No computador nada muda: continua com 2 segundos entre uma e outra.
- No celular, quando alguém faz uma consulta de verdade, o aviso dela também não fura a fila: espera completar os 30 segundos.

## Detalhes técnicos
- `src/components/SocialProofNotification.tsx`: o intervalo entre notificações passa a ser 30000 ms quando a tela tem menos de 768px (`window.innerWidth < 768`) e continua 2000 ms nas telas maiores.
- No celular, uma consulta nova que chega em tempo real entra na fila e aparece como a próxima notificação, no lugar de aparecer na hora.
- O tempo que cada notificação fica na tela (3 s) não muda.
