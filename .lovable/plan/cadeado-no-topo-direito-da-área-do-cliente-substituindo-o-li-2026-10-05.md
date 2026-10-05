# Cadeado no topo direito da Área do Cliente (substituindo o link "Área do Administrador")

## O que entendi

Hoje, ao abrir a Área do Cliente, o login mostra um link escrito **"Área do Administrador →"** no rodapé do card, logo abaixo de "Esqueceu sua senha?". Isso confunde o cliente, porque parece mais uma opção de acesso dele.

A troca é: **sumir com esse link de texto** e colocar no lugar um **ícone de cadeado no canto superior direito da tela**. O administrador olha, reconhece o cadeado e clica ali para entrar no painel administrativo. O cliente comum simplesmente ignora o cadeado e continua usando o login normalmente.

Ou seja: mesma porta de entrada (o painel admin), só que escondida atrás de um símbolo discreto em vez de um escrito no meio do login.

## O que muda

- **Remover** o parágrafo com o link "Área do Administrador →" do card de login da Área do Cliente.
- **Adicionar** um botão com ícone de cadeado fixo no **canto superior direito da tela** de login (fora do card, sobre o fundo), que leva exatamente ao mesmo destino de antes: a tela de entrada do painel administrativo.
- O cadeado será **discreto** (tom suave, ganhando destaque apenas ao passar o cursor), com texto de apoio "Área do Administrador" ao passar o mouse e acessível por teclado (Tab + Enter).
- **"Esqueceu sua senha?" e "← Voltar ao site" continuam exatamente como estão**, sem mudança de posição ou estilo.
- Nada mais é tocado: nenhum campo, botão, validação, regra de acesso, rota ou tela do cliente muda de comportamento.

## Como fica

```text
+------------------------------------------------------+
|                                            [cadeado]  |
|                  (logo WebMarcas)                     |
|                   Área do Cliente                     |
|        Acesse sua conta para acompanhar seus ...      |
|  +----------------------------------------------+    |
|  |  Email  [ seu@email.com ]                    |    |
|  |  Senha  [ ............  ]                    |    |
|  |  [            Entrar             ]           |    |
|  |  Primeiro acesso? Use a senha padrão: 123Mudar@|   |
|  |  Esqueceu sua senha?                          |    |
|  |  ← Voltar ao site                             |    |
|  +----------------------------------------------+    |
+------------------------------------------------------+
```

## Detalhes técnicos

- Arquivo alterado: `src/pages/cliente/Login.tsx` (único). O link atual está nas linhas 131–136, dentro do bloco de textos abaixo do formulário.
- Removido o `<p><Link to="/admin/login">Área do Administrador →</Link></p>`.
- O container principal do login recebe `relative`, e dentro dele um `<Link to="/admin/login">` posicionado com `absolute right-4 top-4` (em telas maiores, `right-6 top-6`), contendo o ícone `Lock` do `lucide-react` (já importado no arquivo) dentro de um pequeno botão arredondado com fundo suave e borda sutil.
- Acessibilidade: `aria-label="Área do administrador"`, área de toque de pelo menos 40x40 px, `title="Área do administrador"` como dica ao passar o mouse, e foco visível com o anel padrão do tema.
- Estilo segue os tokens do tema (sem cores fixas no componente), então o cadeado se adapta ao fundo claro da tela de login.
- Nenhuma rota, política de acesso ou lógica de login é alterada — o destino continua sendo `/admin/login`, que já existe.

## Como confiro

- Compilação e verificação de tipos sem erros.
- Captura de tela da tela de login em desktop e em celular (390 px) para confirmar: o cadeado aparece no canto superior direito, não sobrepõe o card, o texto "Área do Administrador" sumiu do rodapé e os demais links seguem no lugar.
- Clique no cadeado leva à tela de entrada do painel administrativo.
