# Patudos · Design system «Prado»

Guia curto para quem implementa. Valores exatos em `tokens.css`; CSS dos mockups em `referencia/prado.css` (fonte de verdade em caso de dúvida). Só modo claro. Largura de referência: iPhone 390 px.

## Princípios

1. **Simplicidade.** Um ecrã, uma tarefa. Só campos essenciais à vista; o resto em «Mais detalhes».
2. **Pré-preencher.** Data de hoje, último animal usado, sugestões do histórico, próxima data sugerida (vacinas, desparasitações).
3. **Só PT-PT.** Texto direto nos componentes, tom simples e calmo («Guardar», «Feito», não «Submeter»).
4. **Pensado para quem usa pouco apps** (ex.: os pais do dono): texto grande, alvos grandes, uma ação principal por ecrã, nada escondido em gestos.
5. **Cor nunca é a única pista.** Estado e animal vão sempre com texto ou ícone.

## Cores

### Base

| Nome | Hex | Uso | Contraste |
|---|---|---|---|
| Pinheiro | `#0B6B5F` | Ação principal, links, foco, separador ativo | branco 6,4:1 |
| Pinheiro escuro | `#0B4F46` | Texto sobre Menta | 7,8:1 sobre Menta |
| Menta | `#D5EEE9` | Botão secundário, realces, anel de foco, separador ativo | — |
| Sol | `#FFC53D` | **Só** botão «+» central e destaques. Texto/ícone por cima sempre Tinta | Tinta 10,8:1. **Nunca** texto Sol sobre Pinheiro (4,1:1) nem sobre branco |
| Névoa | `#F2F5F4` | Fundo da app | — |
| Branco | `#FFFFFF` | Cartões, campos, barras, painéis | — |
| Tinta | `#0E1F1C` | Texto principal | 15,5:1 sobre Névoa |
| Tinta suave | `#475A56` | Texto secundário, legendas | 6,7:1 sobre Névoa, 7,3:1 sobre branco |
| Placeholder | `#5F6F6B` | Texto de exemplo nos campos | 5,3:1 sobre branco |
| Linha | `#D6E0DD` | Contorno de cartões e campos | — |
| Linha suave | `#E6ECEA` | Separadores, chips neutros, segmentos | — |

### Estados

| Estado | Texto/ícone | Fundo | Contraste |
|---|---|---|---|
| Atraso / erro / destrutivo | `#A61B12` | `#FDE3E0` (borda `#F3C2BC`, campo `#FFF7F6`) | 6,2:1 sobre o fundo; 7,5:1 sobre branco |
| Feito | `#17703A` (ícones) · `#0F5A2C` (texto) | `#D9F2DF` | texto 7,0:1 sobre o fundo |
| Aviso | `#6B4A00` (banner `#5A3E00`) | `#FFF1C7` | 7,2:1 |

Controlos desativados: texto `#6E7C79` sobre `#E3E9E7` (3,5:1, isento de AA por ser inativo; o botão desativado continua legível pelo rótulo).

### Cores dos animais (8)

Cada animal tem uma cor, atribuída ao criar (a próxima livre). Três variantes:

- **Cor** (anel do avatar 3 px, ponto, gráficos): nunca para texto pequeno.
- **Fundo** (avatar, etiqueta, chip selecionado em claro).
- **Texto** (nome do animal, escurecido): mínimo 4,5:1 sobre branco **e** sobre o fundo.

| Nome | Cor | Fundo | Texto | Texto/fundo | Texto/branco |
|---|---|---|---|---|---|
| Laranja (Nina) | `#D9580F` | `#FDE7D9` | `#B14609` | 4,7:1 | 5,6:1 |
| Azul (Simba) | `#2563EB` | `#DEE8FD` | `#1D4FC4` | 5,8:1 | 7,1:1 |
| Uva (Pimenta) | `#8B3FD9` | `#EDE1FB` | `#7A30C4` | 5,5:1 | 6,9:1 |
| Framboesa | `#C92A6E` | `#F6DDE8` | `#AB245E` | 5,2:1 | 6,7:1 |
| Relva | `#2F8A3E` | `#DEECE0` | `#287535` | 4,7:1 | 5,7:1 |
| Mar | `#0E7F96` | `#D8EBEE` | `#0C6C80` | 4,9:1 | 6,1:1 |
| Mel | `#B07800` | `#F2E9D6` | `#8B5F00` | 4,7:1 | 5,6:1 |
| Ardósia | `#52606D` | `#E3E6E8` | `#46525D` | 6,4:1 | 8,0:1 |

> **Correção face aos mockups:** o texto do Nina era `#B84A0C` (4,4:1 sobre `#FDE7D9`, falha AA). Passa a `#B14609` (4,7:1). Fundos de Framboesa, Relva, Mar, Mel e Ardósia foram derivados (cor a 16 % sobre branco); texto verificado por cálculo.

**Regra:** a cor nunca é a única pista. Aparece sempre junto do nome (e da foto/avatar). Os anéis de cor têm 3,8–6,5:1 sobre branco, só decoração.

## Tipografia

**Plus Jakarta Sans**, pesos 400–800 (carregar com `next/font`, `variable: "--font-jakarta"`). Números tabulares em todo o lado (`font-variant-numeric: tabular-nums`).

| Papel | Tamanho / peso | Notas |
|---|---|---|
| Ecrã (H1) | 32 / 800 | entrelinha 1,15, tracking −0,02em |
| Título | 26 / 800 | |
| Cabeçalho de barra | 22 / 800 | tracking −0,01em |
| Secção | 20 / 800 | |
| Corpo | 17 / 500–600 | entrelinha 1,45; destaque 700/800 |
| Etiqueta | 15 / 700 | etiquetas de campos, chips, botões pequenos |
| Legenda | 14 / 600 | **mínimo** para texto corrido. Exceções do mockup: etiquetas `tag` e separadores da barra inferior a 13 px/800–600 |
| Número grande | 24 / 800 | campos de peso e valor |

Formatos PT-PT: data `21/11/2026` (apresentada em `Europe/Lisbon`); dinheiro `45,00 €` e `1 234,56 €` (espaço fino/normal antes do €); peso `12,4 kg`. Usar `Intl.NumberFormat('pt-PT')`.

## Espaçamento, tamanhos e raios

- Escala: **4 / 8 / 12 / 16 / 24 / 32**. Margem lateral dos ecrãs: **20 px**. Intervalo vertical entre blocos: 20 px.
- Alvos de toque **≥ 44 px**: botão 58, «Feito» 52, campo 56, chip 46, botão de ícone 44, item de lista ≥ 64, separador 90 (barra), interruptor 52×32.
- Raios: botões, chips, etiquetas, toasts, segmentos em **cápsula** (999); campos **16**; cartões e listas **24**; diálogos **28**; painéis **32** só nos cantos de cima; botão «+» 20.
- Contornos: cartões/listas 1,5 px `Linha`; campos 2 px `Linha`; cartão em atraso 2 px `#F3C2BC`.
- Ícones: **Lucide**, traço **2,2** (2,8 em ícones sobre cor, ex. visto num botão), 24 px (18 px em linhas de texto).

## Componentes

**Botões** (largura total por defeito, texto 17/800, ícone opcional à esquerda, intervalo 10)
- Principal: Pinheiro + branco, 58 px. Uma só por ecrã.
- Secundário: Menta + Pinheiro escuro.
- Destrutivo: branco, borda 2 px `#F3C2BC`, texto Atraso; só a confirmação final é cheia (`#A61B12` + branco).
- Texto/ligação: transparente, Pinheiro, sublinhado (offset 4), 48 px; links 16/800, área ≥ 44 px.
- «Feito»: Feito-fundo + Feito-texto, 52 px, ícone de visto; muda o estado do lembrete e mostra toast com «Desfazer».
- Desativado: `#E3E9E7`/`#6E7C79`. A ocupado: Pinheiro a 85 % e rótulo do tipo «A guardar…».

**Campos:** etiqueta **sempre visível** por cima (15/700), nunca só placeholder; altura 56, raio 16, borda 2 px, texto 17/600, teclado adequado (`inputmode="decimal"` para números, seletor de data nativo). Ajuda por baixo em 14/600 suave. Foco: borda Pinheiro + anel Menta 4 px. **Erro:** borda e fundo Atraso, mensagem **por baixo**, com ícone e texto 15/700 («Escreve o peso, por exemplo 12,4»). Campos numéricos grandes (24/800) com unidade à direita. Código OTP: 6 caixas 64 px, 28/800.

**Chips:** altura 46, cápsula, 15/700.
- Animal: avatar 36 px (foto) à esquerda + nome; selecionado = fundo na cor de texto do animal com texto branco.
- Categoria: neutro `Linha suave`; selecionado Pinheiro + branco.
- Filtro (separadores segmentados): fundo `Linha suave`, ativo Tinta + branco, 42 px.
- Pílula de contorno (44 px, 15/800) para ações leves; etiquetas `tag` 13/800 (neutra, feito, atraso, menta, sol).

**Cartões:** branco, borda 1,5 px, raio 24, padding 14, intervalo 12. Estado de atraso: borda 2 px `#F3C2BC` + etiqueta «Em atraso». Mostrar sempre o animal (avatar + nome na cor de texto) e quem registou.

**Listas:** contentor branco raio 24 com linhas ≥ 64 px, padding 12/14, separador 1,5 px `Linha suave`; ícone em círculo 40–46 (Menta; atraso e aviso com as suas cores), título 17/700, detalhe 14/600; chevron à direita quando navega.

**Painel que sobe de baixo (sheet):** branco, cantos de cima 32, pega 44×5 `#C3CFCB`, padding 10/20/40, cabeçalho 22/800 com botão fechar 44 (círculo `Linha suave`); fundo escurecido `rgb(14 31 28 / .55)`. Fechar por «X», toque fora e arrastar.

**Barra inferior:** 90 px, branca, linha 1,5 px por cima; 2 + 2 separadores com ícone 24 e rótulo 13 (inativo 600 suave; ativo 800 Pinheiro, pílula Menta 56×30), **«+» Sol ao centro** (64×56, raio 20, ícone Tinta), sempre visível. Barras de ação de formulário: fundo branco, padding 12/20/34, botão principal por cima do secundário/texto.

**Toasts:** cápsula Tinta, texto branco 16/700, ação em Sol («Desfazer»), a 108 px do fundo; desaparecem sozinhos (~5 s) mas a ação cobre erros evitáveis.

**Diálogos:** só para confirmar ações destrutivas ou irreversíveis. Branco, raio 28, padding 24, 24 px de margem lateral, fundo escurecido. Título claro («Apagar a vacina da Nina?»), consequência numa frase, botão destrutivo + «Cancelar» texto.

**Banners:** raio 20, 15/700, com ícone. Variantes: atraso, aviso (sol), informação (menta), sucesso (feito).

**Carregamento:** esqueletos `#E1E8E5` raio 10 com a forma do conteúdo; sem spinners soltos. **Vazio:** ícone grande em círculo Menta, frase curta e **um** botão com a ação óbvia («Registar a primeira consulta»). **Erro:** banner Atraso + «Tentar outra vez». **Sem ligação:** banner de aviso («Sem ligação. Tenta outra vez quando tiveres internet.»); a app não funciona offline, por isso não promete guardar.

**Outros:** interruptor 52×32 (ligado Pinheiro, desligado `#B9C6C2`); listas chave–valor (`kv`) com 16 px; rótulo de mês em 13/800 maiúsculas, tracking .06em; avatar circular com anel de 3 px na cor do animal (anel removido em chips).

## Ícones da PWA (`icons/`)

`icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (marca a 80 % centrada sobre o verde do ícone), `apple-touch-icon.png` (180), `favicon-32.png`, `favicon-16.png`. Origem: `icone-patudos-1024.png` (amarelo `#FFC53D` sobre verde `#0B6B5F`, cão e gato em coração). O fundo medido no ficheiro original é ligeiramente mais escuro (≈ `#026358`) e foi usado no preenchimento do maskable para não haver emenda. `theme_color` do manifesto: `#0B6B5F`; `background_color`: `#F2F5F4`.
