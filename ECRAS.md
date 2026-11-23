# Patudos — Ecrãs

Descrição de todos os ecrãs da app, para desenhar no Claude Design e depois implementar no Claude Code.
Ver também `PLAN.md` (decisões, modelo de dados, fases).

## Indicações gerais para o design

- **Dispositivo:** iPhone, 390 × 844 px, PWA instalada no ecrã principal (sem barra do Safari). Respeitar a safe area (notch e barra inferior).
- **Idioma:** português de Portugal em todos os textos.
- **Tom:** caloroso e simples, sem ser infantil. Os animais são o centro: fotos grandes e nomes em destaque.
- **Simplicidade acima de tudo:** poucos campos à vista, o resto em "Mais detalhes"; valores pré-preenchidos; alvos de toque grandes (mín. 44 px) e longe das margens.
- **Utilizadores:** o **dono** (eu) e **cuidadores** (ex.: os meus pais), que podem ser menos habituados a apps. Onde o ecrã muda conforme o papel, está indicado.
- **Cores por animal:** cada animal tem uma cor/foto que o identifica nas listas, no ecrã "Hoje" e na cronologia.
- **Sem modo offline:** sem ligação mostra-se um aviso simples, não uma app vazia.

## Navegação

Barra inferior com 4 separadores e o botão "+" ao centro:

| Hoje | Animais | **+** | Despesas | Perfil |
|---|---|---|---|---|

O botão "+" abre o menu de ações rápidas (ecrã 6) a partir de qualquer separador.

## Resumo dos ecrãs

| # | Ecrã | Fase |
|---|---|---|
| 1 | Instalar a app | 0 |
| 2 | Entrar — email | 0 |
| 3 | Entrar — código | 0 |
| 4 | Primeira vez — o teu nome | 0 |
| 5 | Hoje | 0 (estrutura) · 3 (completo) |
| 6 | Menu "+" | 1 |
| 7 | Animais | 1 |
| 8 | Ficha do animal — Resumo | 1 |
| 9 | Ficha do animal — Cronologia | 1 |
| 10 | Ficha do animal — Peso | 1 |
| 11 | Ficha do animal — Documentos | 4 |
| 12 | Novo / editar animal | 1 |
| 13 | Registar consulta | 1 |
| 14 | Adicionar vacina ou desparasitação (painel) | 1 |
| 15 | Adicionar medicação (painel) | 1 |
| 16 | Registar tratamento (fora de consulta) | 1 |
| 17 | Registar peso (painel) | 1 |
| 18 | Detalhe da consulta | 1 |
| 19 | Detalhe de um registo | 1 |
| 20 | Pessoas do animal | 2 |
| 21 | Convidar cuidador | 2 |
| 22 | Lembretes do animal | 3 |
| 23 | Novo / editar lembrete | 3 |
| 24 | Ativar notificações | 3 |
| 25 | Despesas | 4 |
| 26 | Nova / editar despesa | 4 |
| 27 | Adicionar documento | 4 |
| 28 | Ver documento | 4 |
| 29 | Perfil e definições | 0 (base) · 3 (notificações) |
| 30 | Ligar ao Google Calendar | 3 |
| 31 | Animais arquivados | 1 |
| 32 | Ficha em PDF | 5 |
| 33 | Página de apresentação | 6 |
| 34 | Termos e privacidade | 6 |
| 35 | Apagar conta / exportar dados | 6 |

Mais: componentes e estados comuns, emails e notificações (no fim).

---

## Entrada

### 1. Instalar a app
- **Quando aparece:** a app é aberta no Safari sem estar instalada no ecrã principal.
- **Conteúdo:** logótipo e nome Patudos; frase curta sobre o que é; instruções ilustradas em 3 passos (botão Partilhar → "Adicionar ao ecrã principal" → abrir o Patudos a partir do ícone); explicação de que só assim recebe lembretes.
- **Ações:** "Continuar no browser" (link discreto).

### 2. Entrar — email
- **Conteúdo:** logótipo; campo de email (teclado de email, preenchimento automático); texto "Vamos enviar-te um código para entrares".
- **Ações:** "Enviar código".
- **Estados:** a enviar; email inválido; erro de envio.

### 3. Entrar — código
- **Conteúdo:** "Enviámos um código para *email*"; 6 caixas para os dígitos (teclado numérico, colar e preenchimento automático do iOS).
- **Ações:** entra sozinho ao completar os 6 dígitos; "Reenviar código" (com contagem decrescente); "Mudar email".
- **Estados:** a verificar; código errado; código expirado.

### 4. Primeira vez — o teu nome
- **Quando aparece:** só no primeiro login.
- **Conteúdo:** "Como te chamas?" + campo de nome (aparece aos outros como "registado por…").
- **Ações:** "Continuar".
- **Depois:**
  - Se tem convites pendentes → vai para "Hoje" com os animais partilhados e uma mensagem "Agora cuidas da *Nina* com o *Pedro*".
  - Se não tem animais → estado vazio do ecrã "Animais" com "Adicionar o primeiro patudo".

---

## Dia a dia

### 5. Hoje
- **Objetivo:** responder a "o que tenho de fazer?" num relance. É o ecrã inicial.
- **Conteúdo:**
  - Saudação curta ("Bom dia, Pedro").
  - Secções: **Em atraso** (destaque em cor de alerta) · **Hoje** · **Próximos 30 dias**.
  - Cada item: foto/cor do animal, nome do animal, o quê (ex.: "Desparasitação externa"), data relativa ("há 2 dias", "amanhã") e botão **"Feito"**.
  - Itens concluídos recentemente aparecem por breves momentos com "Feito por Mãe · Desfazer".
  - Atalho para "Registar consulta" se não houver nada pendente.
- **Ações:** "Feito" (abre confirmação rápida com data de hoje e, se for tratamento, regista-o e sugere a próxima data); tocar no item abre o animal ou o lembrete.
- **Estados:** tudo em dia ("Está tudo em dia 🐾"); sem animais (convite a adicionar o primeiro).
- **Papel:** igual para dono e cuidador, mas cada um vê só os seus animais.

### 6. Menu "+"
- **Formato:** painel que sobe de baixo.
- **Ações (grandes, com ícone):** **Consulta** · **Tratamento** (vacina/desparasitação feita fora do veterinário) · **Peso** · **Despesa** · **Documento**.
- Se houver só um animal, as ações abrem já com ele escolhido; se houver vários, o formulário vem com o último usado pré-selecionado.

---

## Animais

### 7. Animais
- **Conteúdo:** cartões grandes por animal: foto, nome, espécie e idade, próxima coisa a fazer, e indicação "Partilhado com Mãe, Pai" ou "Cuidas com Pedro" (para cuidadores).
- **Ações:** abrir animal; "Adicionar animal" (só cria animais próprios); secção "Em memória" (7b); link "Animais arquivados" no fim.
- **Estados:** vazio ("Adiciona o teu primeiro patudo" com ilustração).

### 8. Ficha do animal — Resumo
- **Cabeçalho:** foto grande, nome, espécie, raça, idade, sexo, esterilizado, n.º do chip (copiar); avatares das pessoas que cuidam dele.
- **Separadores:** Resumo · Cronologia · Peso · Documentos.
- **Blocos do resumo:**
  - **Próximas datas** (vacinas, desparasitações, lembretes) com "Feito".
  - **Medicação ativa** (nome, dose, frequência, até quando).
  - **Último peso** com mini-gráfico e variação.
  - **Última consulta** (data, motivo, quem foi).
  - Atalho "Registar consulta".
- **Menu "⋯":** Editar ficha (dono) · Pessoas · Lembretes · Ficha em PDF (fase 5) · Arquivar (dono).

### 9. Ficha do animal — Cronologia
- **Conteúdo:** lista cronológica (mais recente primeiro), agrupada por mês. Cada entrada: ícone do tipo, título, data, resumo e "Registado por Mãe".
- **Filtros (chips):** Tudo · Consultas · Vacinas · Desparasitações · Medicação · Peso · Despesas · Documentos.
- **Ações:** tocar abre o detalhe (18 ou 19).

### 10. Ficha do animal — Peso
- **Conteúdo:** gráfico de linha (6 meses · 1 ano · tudo); lista de pesagens (data, kg, onde: consulta/casa).
- **Ações:** "Registar peso".

### 11. Ficha do animal — Documentos
- **Conteúdo:** grelha/lista de documentos com miniatura, título, tipo e data; filtro por tipo (Fatura · Boletim sanitário · Seguro · Chip · Outro).
- **Ações:** "Adicionar documento"; abrir documento.

### 12. Novo / editar animal
- **Campos à vista:** foto (câmara ou galeria), nome, espécie (Cão / Gato, botões grandes), data de nascimento (ou "idade aproximada").
- **Mais detalhes:** raça (com sugestões), sexo, esterilizado, n.º do chip, cor de identificação, notas.
- **Ações:** "Guardar".
- **Depois de criar:** sugestão opcional "Queres registar as últimas vacinas e desparasitações?" (abre 16) e "Convidar alguém para cuidar da *Nina*?" (abre 21).
- **Papel:** só o dono edita.
- **Fim do ecrã (só novo animal):** link «Em memória de…» (ecrã 37).

### 31. Animais arquivados
- Dois grupos: **«Em memória»** (animais que faleceram: linha discreta com avatar, nome e «2012 – 2026», abre o tributo, ecrã 36) e os que **já não estão contigo** (cartão com «Arquivado a dd/mm/aaaa» e «Reativar», só o dono). O historial de ambos fica só de leitura.
- Arquivar (menu «⋯» da ficha ou fim de «Editar ficha») abre um painel que pergunta o **motivo**: «Faleceu» (pede quando: Dia · Mês · Ano, por defeito hoje; passa a ter tributo) ou «Já não está comigo».

### 36. Tributo (animal que faleceu)
- **Tom:** calmo e respeitoso. Sem emojis, sem Sol nem cores vivas: Névoa, branco, Menta e Pinheiro. Texto sem frases feitas.
- **Cabeçalho centrado:** foto grande (160 px, anel na cor do animal), «EM MEMÓRIA» (13/800, maiúsculas, tinta suave), nome (32/800), «2012 – 2026» (20/800), «Gato · Faleceu em setembro de 2026» (14, tinta suave).
- **Palavras do dono:** cartão branco com o texto. Se estiver vazio, só o dono vê um convite a escrever.
- **Memórias:** cartões brancos com foto opcional, texto e assinatura «Mãe · 12/10/2026» (a própria pessoa vê «Tu»). Botão «⋯» (44 px) em cada memória: o autor edita e apaga; o dono apaga qualquer uma. Vazio: «Ainda ninguém deixou uma memória. Podes ser tu a primeira.» Botão secundário «Deixar uma memória» (painel: texto até 600 letras, «Juntar foto»).
- **Anular:** o dono tem «Afinal não faleceu» (ligação de texto, com diálogo de confirmação): o animal volta à lista de ativos; as **memórias são apagadas** (com as fotos); o texto do dono fica.
- **Fim:** «Ver o historial de saúde» (ficha só de leitura, sem «Registar»; mostra faixa «Em memória de … · Ver tributo») e, para o dono, «Editar o tributo» (quando faleceu + palavras).
- **Só dentro da app:** sem link público; quem quiser ver é convidado como membro (ecrã 21).
- Animais falecidos não geram lembretes nem notificações, não aparecem em «Hoje» nem no calendário, e não contam para o limite de 30 animais ativos.

### 37. Em memória de…
- Acesso: link discreto «Em memória de…» no fim de «Novo animal» (ecrã 12). Para animais que nunca estiveram na app.
- **Campos:** foto, nome, Cão/Gato, **quando faleceu** (Dia · Mês · Ano; obrigatório; por defeito Mês), «Mais detalhes»: quando nasceu (Dia · Mês · Ano, opcional), e «Umas palavras (opcional)».
- Guardar abre logo o tributo (36).

### 7b. Animais — secção «Em memória»
- Entre a lista de animais e o link «Animais arquivados»: título «Em memória» e uma linha por animal falecido (foto 56 px, nome, «2012 – 2026»). Justificação: o tributo é um sítio a que se volta com carga emocional; não deve ficar enterrado ao lado dos animais dados. Só aparece se existir algum. O link «Animais arquivados (n)» conta só os restantes.

---

## Registar

### 13. Registar consulta ⭐ (ecrã mais importante)
- **Objetivo:** registar uma consulta completa em menos de um minuto, num só ecrã.
- **Campos à vista:**
  - **Animal** (pré-selecionado; chips com fotos se houver vários).
  - **Data** (hoje por defeito; seletor nativo).
  - **Motivo** (texto curto com sugestões: Vacinação, Check-up, Doença, Urgência, Controlo).
  - **Veterinário / clínica** (sugestões do histórico; último usado pré-preenchido).
- **"O que foi feito?"** — botões para acrescentar blocos, cada um aparece como cartão removível:
  - Vacina · Desparasitação (abre 14)
  - Medicação (abre 15)
  - Peso (campo kg inline)
  - Análises · Cirurgia · Outro (título + nota)
- **Custo:** valor em € (teclado numérico) + "Pago por" (eu por defeito).
- **Mais detalhes:** notas, anexar foto/PDF (fatura ou relatório).
- **Resumo antes de gravar:** "Próximas datas criadas: Vacina antirrábica — 21/11/2027; Desparasitação — 21/12/2026" (editáveis).
- **Ações:** "Guardar consulta" (fixo no fundo).
- **Estados:** a guardar; aviso ao sair sem gravar; sucesso com resumo e "Ver na cronologia".
- **Variante:** editar consulta existente (mesmo ecrã, com "Apagar consulta").

### 14. Adicionar vacina ou desparasitação (painel)
- **Conteúdo:** lista de presets por espécie (ex. Cão: Polivalente, Antirrábica, Leishmaniose, Tosse do canil; Desparasitação interna, Desparasitação externa — pipeta/coleira/comprimido); campo "Outro".
- **Campos:** produto/marca (opcional, com sugestões do histórico); **próxima data** sugerida pelo intervalo do preset (editável) e interruptor "Lembrar-me".
- **Ações:** "Adicionar".

### 15. Adicionar medicação (painel)
- **Campos:** nome do medicamento (sugestões), dose (ex.: "½ comprimido"), frequência (botões: 1× dia · 2× dia · De X em X dias · Outra), horas, duração (X dias · Até data · Contínua).
- **Interruptor:** "Lembrar cada toma".
- **Ações:** "Adicionar".

### 16. Registar tratamento (fora de consulta)
- **Uso:** vacina ou desparasitação feita em casa ou registo de algo antigo.
- **Campos:** animal, data, tipo (presets como em 14), produto, próxima data + "Lembrar-me".
- **Opcional:** custo (cria despesa).
- **Ações:** "Guardar".

### 17. Registar peso (painel)
- **Campos:** animal, data (hoje), peso em kg (teclado numérico, valor anterior como referência: "Último: 12,4 kg").
- **Ações:** "Guardar".

### 18. Detalhe da consulta
- **Conteúdo:** data, motivo, veterinário/clínica, tudo o que foi feito (vacinas, medicação, peso…), custo e quem pagou, anexos, notas, "Registado por Mãe em 12/03".
- **Ações:** editar / apagar (dono ou quem criou).

### 19. Detalhe de um registo
- **Uso:** vacina, desparasitação, medicação, peso, análise, etc.
- **Conteúdo:** dados do registo, ligação à consulta (se existir), próxima data e lembrete associado; para medicação, histórico de tomas marcadas como feitas.
- **Ações:** editar / apagar; "Terminar medicação".

---

## Pessoas

### 20. Pessoas do animal
- **Conteúdo:** lista de membros com avatar, nome, email e papel (Dono / Cuidador); convites pendentes com "Reenviar" / "Cancelar".
- **Ações (dono):** "Convidar"; mudar papel; remover.
- **Ações (cuidador):** só leitura + "Deixar de cuidar da *Nina*".
- Explicação curta do que cada papel pode fazer.

### 21. Convidar cuidador
- **Campos:** email; papel (Cuidador por defeito · Dono).
- **Texto:** "A *Mãe* vai poder ver o historial da *Nina*, registar consultas e despesas, e receber lembretes."
- **Ações:** "Enviar convite".

---

## Lembretes

### 22. Lembretes do animal
- **Conteúdo:** lista de lembretes ativos (título, próxima data, recorrência, origem — ex.: "da vacina de 21/11"); secção de lembretes terminados.
- **Interruptor no topo:** "Receber lembretes da *Nina*" (preferência pessoal de cada membro).
- **Ações:** "Novo lembrete"; editar; pausar; apagar.

### 23. Novo / editar lembrete
- **Campos:** animal, o quê (texto com sugestões: Comprar ração, Banho, Cortar unhas…), data e hora, repetir (Nunca · Diariamente · Semanalmente · Mensalmente · De X em X meses · Anualmente), canais (Notificação · Email · Calendário).
- **Ações:** "Guardar".

### 24. Ativar notificações
- **Quando aparece:** ao criar o primeiro lembrete, ou a partir do Perfil.
- **Conteúdo:** porque são úteis; pedido de permissão; se a app não estiver instalada no ecrã principal, explica que é preciso instalá-la primeiro (ligação ao ecrã 1).
- **Ações:** "Ativar notificações"; "Enviar notificação de teste"; "Agora não".
- **Estados:** ativadas; recusadas (como reativar nas Definições do iPhone).

---

## Despesas e documentos

### 25. Despesas
- **Conteúdo:** seletor de período (mês · ano), total grande; separação por animal (barras ou cartões com cor do animal), por categoria e por "Pago por"; lista de despesas agrupada por dia.
- **Filtros:** animal, categoria, quem pagou.
- **Ações:** "Nova despesa"; abrir despesa.
- **Estados:** sem despesas no período.

### 26. Nova / editar despesa
- **Campos à vista:** valor (€, teclado numérico, grande), categoria (chips: Veterinário · Medicamentos · Alimentação · Higiene · Acessórios · Seguro · Hotel/Pet sitter · Outro), animal(ais).
- **Dividir entre animais:** se escolher mais de um, divide em partes iguais por defeito, com opção de ajustar valores.
- **Mais detalhes:** data (hoje), pago por, descrição, anexo (fatura).
- **Ações:** "Guardar"; apagar (em edição).

### 27. Adicionar documento
- **Campos:** ficheiro (tirar foto · galeria · ficheiro PDF), animal, tipo (Fatura · Boletim sanitário · Seguro · Chip · Outro), título (sugerido pelo tipo), data.
- **Ações:** "Guardar".

### 28. Ver documento
- Visualizador em ecrã inteiro (imagem com zoom ou PDF), título, tipo, data, quem adicionou, ligação à consulta/despesa.
- **Ações:** partilhar/descarregar; editar dados; apagar.

---

## Perfil

### 29. Perfil e definições
- **Conteúdo:**
  - Nome e email (editar nome).
  - **Notificações:** estado (ativas/inativas) → ecrã 24; emails de lembrete (sim/não).
  - **Lembretes por animal:** lista de animais com interruptor "Receber lembretes".
  - **Calendário:** "Ligar ao Google Calendar" → ecrã 30.
  - Animais arquivados.
  - Sobre o Patudos · Termos e privacidade (fase 6).
  - **Terminar sessão.**
  - (Fase 6) Exportar os meus dados · Apagar conta.

### 30. Ligar ao Google Calendar
- **Conteúdo:** explicação de que as datas dos animais aparecem no calendário (com atraso de algumas horas, por isso não substitui as notificações); passos para subscrever no Google Calendar; link do calendário com "Copiar".
- **Ações:** "Copiar link"; "Gerar novo link" (invalida o anterior).

---

## Mais tarde

### 32. Ficha em PDF (fase 5)
- **Pré-visualização** da ficha: dados do animal, chip, vacinas e desparasitações com datas, medicação ativa, historial de peso, últimas consultas, contactos do veterinário.
- **Opções:** o que incluir (tudo / só vacinas); período.
- **Ações:** "Partilhar" (folha de partilha do iPhone).

### 33. Página de apresentação (fase 6)
- Página pública: o que é o Patudos, 3–4 funcionalidades com imagens dos ecrãs, como instalar, "Começar".

### 34. Termos e privacidade (fase 6)
- Texto simples, legível em telemóvel.

### 35. Apagar conta / exportar dados (fase 6)
- Exportar: descarregar todos os dados (ZIP com dados e documentos).
- Apagar: explica o que acontece aos animais partilhados (se for o único dono, pede para transferir a posse ou apagar); confirmação escrevendo "APAGAR".

---

## Componentes e estados comuns

- Barra inferior com botão "+" central.
- Cabeçalho com título e botão de voltar; formulários com botão principal fixo no fundo.
- Painéis que sobem de baixo (para formulários curtos).
- Chips de seleção (animais com foto, categorias, filtros).
- Cartão de item de lembrete com botão "Feito".
- Cartão de entrada da cronologia com "Registado por".
- Avatar de pessoa e avatar de animal (foto ou inicial na cor do animal).
- Campo de valor em € e campo de peso em kg (teclado numérico, vírgula decimal).
- Toasts de confirmação ("Consulta guardada") com "Desfazer" quando fizer sentido.
- Diálogos: sair sem gravar; apagar registo; remover cuidador.
- Estados: a carregar (esqueletos), vazio (ilustração + ação), erro (mensagem + "Tentar de novo"), sem ligação à internet.

## Emails e notificações

Não são ecrãs da app, mas precisam de design:

- **Email — código de entrada:** logótipo, código grande de 6 dígitos, validade.
- **Email — convite:** "O *Pedro* convidou-te para cuidar da *Nina* no Patudos", foto da Nina, botão "Abrir o Patudos", como instalar.
- **Email — lembrete:** animal, o quê, quando, botão "Abrir".
- **Notificação push:** título "Nina · Desparasitação externa", texto "É hoje", ação "Feito".
- **Ícone da app** e ecrã de arranque (splash) da PWA.
