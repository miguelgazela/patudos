# Patudos

PWA para gerir a vida dos animais de estimação (cães e gatos): saúde, lembretes, despesas e documentos.
O plano completo e as fases estão em `PLAN.md` — lê-o antes de começar uma tarefa nova.

## Stack

- Next.js (App Router) + TypeScript estrito
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth, Storage, Edge Functions, pg_cron
- Vercel
- Resend (email)

## Regras do produto (não alterar sem confirmar comigo)

- **Autenticação só por código de email (OTP de 6 dígitos).** Nunca link mágico, passwords ou login social. Usar `signInWithOtp` sem `emailRedirectTo` e `verifyOtp({ type: 'email' })`.
- **Só português de Portugal** (PT-PT, não PT-BR). Sem biblioteca de i18n; o texto fica direto nos componentes.
- **Sem modo offline.** O service worker serve só para instalação PWA e push; não fazer cache de dados.
- Espécies suportadas na v1: `dog` e `cat`.
- Pensado primeiro para iPhone (PWA instalada no ecrã principal).
- **Inserção de dados manual.** Sem leitura de documentos por IA nem funcionalidades de "veterinário IA".

## Simplicidade acima de tudo

A app tem de ser o mais simples e intuitiva possível, sobretudo a registar dados. Ver "Princípios de experiência" em `PLAN.md`. Em resumo:

- A consulta é o registo central: um só ecrã grava consulta, vacinas, medicação, peso, despesa e anexo numa única transação.
- Pré-preencher sempre: data de hoje, último animal usado, sugestões do histórico.
- Só campos essenciais à vista; o resto em "Mais detalhes".
- Sugerir a próxima data (vacinas, desparasitações) em vez de a pedir.
- Seletor de data nativo, teclado numérico, alvos de toque grandes e longe das margens.
- Se um ecrã novo precisar de mais de um passo ou de configuração prévia, propõe primeiro uma alternativa mais simples.

## Convenções de código

- Identificadores, tabelas e colunas em inglês; tudo o que o utilizador vê em português.
- Server Components por defeito; Server Actions para escritas; `"use client"` só quando necessário.
- Cliente Supabase via `@supabase/ssr` (cookies). Nunca usar a service role key no cliente.
- Datas/horas: `timestamptz` na BD, apresentação em `Europe/Lisbon`, formato `dd/MM/yyyy`.
- Dinheiro: inteiro em cêntimos (`amount_cents`), moeda EUR, apresentação `1 234,56 €`.
- Recorrências em RRULE (biblioteca `rrule`).
- Validação com Zod nas fronteiras (forms, Server Actions, Edge Functions).

## Base de dados

- Todas as alterações de esquema via migração da Supabase CLI (`supabase migration new <nome>`); nunca editar o esquema à mão em produção.
- **RLS ativo em todas as tabelas.** O acesso é sempre **por animal**, através de `pet_members` (papéis `owner` e `caregiver`). Não existe conceito de agregado: cada animal tem os seus próprios membros.
- `caregiver` pode criar registos e editar os que criou; só `owner` gere membros, edita a ficha e arquiva o animal.
- Todos os registos guardam `created_by`; a UI mostra sempre quem registou.
- Cada nova tabela vem com as suas políticas e um teste de políticas (cobrir dono, cuidador e utilizador sem acesso).
- Depois de alterar o esquema, regenerar os tipos TypeScript.
- Storage: bucket privado `documentos`, caminho `{pet_id}/{ficheiro}`, com políticas por animal.

## Comandos

```bash
npm run dev          # servidor local
npm run lint         # lint
npm run typecheck    # tsc --noEmit
npm test             # testes unitários
npm run test:e2e     # Playwright
supabase start       # Supabase local
supabase db reset    # recria a BD local com migrações + seed
supabase gen types typescript --local > src/lib/database.types.ts
```

## Antes de dar uma tarefa por terminada

- `lint`, `typecheck` e testes a passar.
- Novas tabelas com RLS e políticas testadas.
- Ecrãs verificados em largura de iPhone (390 px).
- Textos revistos em PT-PT.
