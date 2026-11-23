# Patudos — Plano de desenvolvimento

App para gerir a vida dos animais de estimação: saúde, lembretes, despesas e documentos.
Objetivo principal: ser **o mais simples e intuitiva possível**, sobretudo a registar dados.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Público | Fase 1: eu e quem cuida dos meus animais (ex.: os meus pais). Mais tarde: talvez público. |
| Animais (v1) | Cães e gatos |
| Plataforma | Web app instalável (PWA), pensada para iPhone |
| Stack | Next.js (App Router, TypeScript) + Supabase + Vercel |
| Dados | Cloud com conta (Supabase). **Sem modo offline.** |
| Autenticação | **Só código por email (OTP de 6 dígitos).** Sem link mágico, sem passwords, sem login social. |
| Idioma | **Só português de Portugal.** Sem i18n. |
| Inserção de dados | **Manual**, com formulários mínimos. Sem leitura de documentos por IA. |
| **Partilha** | **Por animal.** Cada patudo pode ter cuidadores próprios (ex.: os meus pais cuidam da cadela, mas não veem os gatos). Cuidadores registam consultas, pesos, despesas e marcam lembretes como feitos. |
| Lembretes | Push (Web Push) + email + feed de calendário (.ics) para o Google Calendar |
| Ritmo | Projeto cuidado, sem pressa; arquitetura pronta para abrir ao público |
| Desenvolvimento | Claude Code |

## Princípios de experiência (UX)

1. **A consulta é o registo central.** Um só fluxo "Registar consulta" cria de uma vez: consulta, vacinas/desparasitações, medicação, peso, despesa, anexo opcional e próximos lembretes.
2. **Ecrã inicial "Hoje":** em atraso · hoje · a seguir, cada item com botão "Feito".
3. **Botão "+" sempre visível** com 5 ações: Consulta · Tratamento · Peso · Despesa · Documento. Descrição completa dos ecrãs em `ECRAS.md`.
4. **Formulários mínimos:**
   - Data de hoje e último animal usado pré-preenchidos.
   - Só os campos essenciais à vista; o resto em "Mais detalhes".
   - Seletor de data nativo do iPhone; teclado numérico para valores e peso.
   - Sugestões a partir do histórico (nome do veterinário, vacinas, medicamentos já usados).
5. **Próxima data sugerida automaticamente** ao registar vacina, desparasitação ou medicação (ex.: desparasitação externa → +1 mês; vacina anual → +1 ano), sempre editável.
6. **Poucos passos e nada de configurações** antes de começar a usar. Alvos de toque grandes, longe das margens do ecrã.
7. **Nunca perder dados:** guardar com confirmação visível; avisar ao sair de um formulário por gravar.
8. **Pensado também para cuidadores menos habituados a apps** (ex.: pais): o cuidador entra com o código por email e vê logo só os animais que cuida, com o botão "+" e o ecrã "Hoje". Cada registo mostra quem o fez ("Consulta registada pela Mãe").

## Partilha por animal

- Cada animal tem membros com um papel:
  - **Dono** — tudo, incluindo convidar/remover cuidadores, editar a ficha e arquivar o animal.
  - **Cuidador** — vê o historial completo do animal; regista consultas, vacinas, medicação, pesos, despesas e documentos; marca lembretes como feitos; edita os registos que criou. Não apaga o animal nem gere membros.
- Convite: o dono escreve o email do cuidador → o cuidador recebe um email → entra com código e já vê o animal. Não precisa de configurar nada.
- Cada membro escolhe, por animal, se recebe os lembretes (ex.: os pais recebem os da cadela; eu recebo de todos).
- Despesas têm **"Pago por"** (por defeito, quem regista), para saber o que paguei eu e o que pagaram os cuidadores.
- Um animal pode ter vários donos (ex.: casal), embora o normal seja um.

## Stack em detalhe

- **Frontend/servidor:** Next.js (App Router), TypeScript estrito, Server Components + Server Actions.
- **UI:** Tailwind CSS + shadcn/ui; mobile-first, pensada para ecrã de iPhone.
- **Base de dados:** Supabase Postgres, migrações versionadas com a Supabase CLI.
- **Segurança:** Row Level Security em todas as tabelas, com acesso **por animal** (`pet_members`).
- **Ficheiros:** Supabase Storage (bucket privado `documentos`, caminhos `{pet_id}/{ficheiro}`), com políticas por animal.
- **Email:** Resend como SMTP do Supabase Auth (códigos), convites e emails de lembrete.
- **Agendamento:** `pg_cron` + `pg_net` no Supabase a chamar uma Edge Function de lembretes a cada 5 minutos.
- **Push:** Web Push com chaves VAPID. No iPhone só funciona com a app adicionada ao ecrã principal (iOS 16.4+).
- **PDF:** geração da ficha do animal no servidor (ex.: `@react-pdf/renderer`).
- **Alojamento:** Vercel (produção + previews por branch).

## Autenticação (código por email)

1. Utilizador escreve o email → `supabase.auth.signInWithOtp({ email })` (sem `emailRedirectTo`).
2. Template de email do Supabase alterado para mostrar só `{{ .Token }}` (nenhum link).
3. Utilizador introduz o código → `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
4. Sessão por cookies com `@supabase/ssr`.
5. SMTP próprio (Resend) para evitar os limites do SMTP por defeito do Supabase.
6. Ecrã do código com `autocomplete="one-time-code"` e `inputmode="numeric"`.
7. Ao entrar pela primeira vez, convites pendentes para esse email são aceites automaticamente.

## Modelo de dados (v1)

Identificadores em inglês; textos visíveis em português. Todos os registos têm `created_by` e `created_at`.

- `profiles` — `id` (= `auth.users.id`), `name`, `email`
- `pets` — `id`, `name`, `species` (`dog` | `cat`), `breed`, `sex`, `birth_date`, `neutered`, `microchip`, `photo_path`, `notes`, `archived_at`
- `pet_members` — `pet_id`, `user_id`, `role` (`owner` | `caregiver`), `notify` (recebe lembretes deste animal)
- `pet_invites` — `id`, `pet_id`, `email`, `role`, `invited_by`, `token`, `expires_at`, `accepted_at`
- `vet_visits` — `id`, `pet_id`, `visited_on`, `reason`, `vet_name`, `clinic`, `notes`
- `weights` — `id`, `pet_id`, `measured_on`, `weight_kg`, `vet_visit_id` (opcional)
- `health_events` — `id`, `pet_id`, `type` (`vaccine` | `deworming_internal` | `deworming_external` | `surgery` | `lab_test` | `other`), `occurred_on`, `title`, `notes`, `vet_visit_id` (opcional), `next_due_on`
- `medications` — `id`, `pet_id`, `name`, `dose`, `schedule_rrule`, `starts_on`, `ends_on`, `notes`, `vet_visit_id` (opcional)
- `reminders` — `id`, `pet_id`, `title`, `rrule` *ou* `due_at`, `channels` (`push`, `email`, `calendar`), `source_type`/`source_id` (ligação opcional a vacina, medicação, etc.), `active`
- `reminder_occurrences` — `id`, `reminder_id`, `scheduled_for`, `push_sent_at`, `email_sent_at`, `done_at`, `done_by`
- `push_subscriptions` — `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`
- `calendar_feeds` — `user_id`, `token` (secreto, regenerável)
- `expenses` — `id`, `spent_on`, `category`, `amount_cents`, `description`, `paid_by`, `vet_visit_id` (opcional), `document_id` (opcional)
- `expense_splits` — `expense_id`, `pet_id`, `amount_cents` (uma despesa pode ser dividida entre animais, ex.: ração para dois gatos)
- `documents` — `id`, `pet_id`, `kind` (`invoice` | `health_record` | `insurance` | `microchip` | `other`), `title`, `storage_path`, `mime_type`, `document_date`, `vet_visit_id` (opcional)
- `care_presets` — modelos de vacinas/desparasitações comuns por espécie com intervalo sugerido (seed, editável)

Regras gerais:
- Acesso a qualquer registo = ser membro do animal a que pertence (`pet_members`). Despesas: visíveis a quem é membro de algum dos animais das suas `expense_splits`; só se pode dividir uma despesa entre animais a que se tem acesso.
- Datas/horas em `timestamptz`, fuso de referência `Europe/Lisbon`; dinheiro em cêntimos (inteiro), moeda EUR.
- O registo de uma consulta grava tudo numa única transação.

## Lembretes — como funcionam

- Recorrências guardadas como RRULE (biblioteca `rrule`), ex.: "a cada 3 meses", "todos os dias às 8h".
- Edge Function corre a cada 5 min: gera as ocorrências devidas e envia push/email **aos membros do animal com `notify` ativo**; regista o envio.
- Notificação com ação "Feito" que marca a ocorrência como concluída, com quem a concluiu — visível para todos os membros (ex.: "Desparasitação feita pelo Pai").
- Calendário: rota `/api/calendario/[token].ics` com os próximos eventos dos animais desse utilizador; subscreve-se no Google Calendar. Nota: o Google atualiza feeds subscritos com atraso (horas), por isso o calendário é complemento e não substitui push/email.

## Fases

### Fase 0 — Fundações
- Repositório, Next.js + TypeScript + Tailwind + shadcn/ui, lint e formatação.
- Projeto Supabase (dev e produção), Supabase CLI, primeiras migrações.
- Login por código de email (fluxo completo acima) + criação automática de perfil.
- Modelo de acesso por animal (`pets` + `pet_members`) e RLS base com testes de políticas.
- Manifest PWA, ícones, service worker mínimo (sem cache offline).
- Navegação base: "Hoje", "Animais", "Despesas" + botão "+".
- Deploy na Vercel; variáveis de ambiente.
- **Concluída quando:** consigo instalar o Patudos no iPhone e entrar com um código.

### Fase 1 — Animais e registo de consulta
- Criar/editar/arquivar animais, com foto.
- Fluxo "Registar consulta": motivo, veterinário, vacinas/desparasitações, medicação, peso, custo e anexo opcional — tudo num só ecrã, gravado de uma vez.
- Registos rápidos fora de consulta: peso, desparasitação feita em casa.
- Presets de vacinas e desparasitações por espécie, com próxima data sugerida.
- Ficha do animal: resumo (próximas datas, medicação ativa, último peso) + cronologia com quem registou + gráfico de peso.
- **Concluída quando:** registo uma consulta completa em menos de um minuto.

### Fase 2 — Cuidadores
- Convidar cuidadores por animal (email), aceitar convite ao entrar, remover cuidador.
- Permissões de dono vs. cuidador aplicadas na RLS e na UI.
- "Registado por" em toda a cronologia; "Pago por" nas despesas.
- Primeira experiência do cuidador: entra e vê só os animais que cuida, sem configurar nada.
- **Concluída quando:** os meus pais registam uma consulta da cadela no telemóvel deles e eu vejo-a no meu.

### Fase 3 — Lembretes e ecrã "Hoje"
- Motor de recorrências e ocorrências; lembretes criados automaticamente a partir das próximas datas.
- Ecrã "Hoje" (em atraso · hoje · a seguir) com "Feito", para todos os animais a que o utilizador tem acesso.
- Push (subscrição, envio, ação "Feito"), email via Resend, feed .ics.
- Preferência por animal: receber ou não os lembretes.
- **Concluída quando:** eu e os meus pais recebemos o lembrete da próxima desparasitação da cadela, e quando um marca "Feito" o outro vê.

### Fase 4 — Despesas e documentos
- Despesas avulsas (ração, areia, seguro…), por categoria; dividir entre animais; "Pago por".
- Resumo mensal e anual, por animal, por categoria e por quem pagou.
- Documentos avulsos (boletim sanitário, seguro, chip) por foto ou PDF.
- **Concluída quando:** sei quanto gastei por animal este ano e encontro qualquer documento em segundos.

### Fase 5 — Polimento
- Design system consolidado, estados vazios, erros, acessibilidade.
- Ficha do animal em PDF (para veterinário, pet sitter, viagens).
- Pesquisa e filtros.
- Testes end-to-end (Playwright) dos fluxos principais, incluindo dono + cuidador.

### Fase 6 — Abrir ao público
- Onboarding, página de apresentação, termos e privacidade.
- RGPD: exportar dados, apagar conta (incluindo o que acontece aos animais partilhados).
- Monitorização de erros, limites de utilização, backups. **Feito** (passo 3): Sentry (UE, sem dados pessoais), limites na BD, `/api/saude`. **Backups por decidir**: por agora não há (a política de privacidade di-lo); opções em `docs/deploy.md`.

## Fora de âmbito (por agora)

- Modo offline
- Outras línguas
- Outras espécies além de cães e gatos
- App nativa nas lojas
- Link mágico, passwords, login social
- Leitura de documentos por IA, "veterinário IA", pontuações de saúde, funções sociais

## Por confirmar

- Domínio (`patudos.pt` ou alternativa).
