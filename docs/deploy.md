# Deploy

## Produção

- App: https://patudos-five.vercel.app (Vercel, projeto `patudos`, branch de produção `main`).
- Base de dados e autenticação: Supabase, projeto `Patudos` (`zummozltkillcaaewnlo`, eu-west-1).
- Email dos códigos: SMTP do Resend, remetente `patudos@miguelgazela.com`.

## Variáveis de ambiente (Vercel, Production e Preview)

| Nome                                   | Valor                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://zummozltkillcaaewnlo.supabase.co`                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave `publishable` do projeto                                                       |
| `RESEND_API_KEY`                       | API key do Resend (**só Production**, sem `NEXT_PUBLIC_`), para os emails de convite |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`         | chave **pública** VAPID (ver «Lembretes por push e email»), Production e Preview     |

`RESEND_API_KEY` é só de servidor: os convites são enviados por Server Actions, pela API HTTP do Resend, com o remetente `Patudos <patudos@miguelgazela.com>` (domínio já verificado). Sem esta variável o convite fica criado mas o email não sai, e o ecrã «Pessoas» avisa e oferece «Reenviar». Pode ser a mesma key usada no SMTP do Supabase, ou outra só de envio. Em local e nos testes e2e o envio vai para o Mailpit (`MAILPIT_URL=http://127.0.0.1:55324`, ver `.env.example`), nunca para o Resend.

Nunca pôr a service role key (nem a `secret`) no Vercel nem no cliente. As variáveis `NEXT_PUBLIC_*` entram no build: depois de as mudar, é preciso novo deploy.

## Migrações

```bash
supabase link --project-ref zummozltkillcaaewnlo
supabase db push --linked
```

## Configuração de autenticação

A configuração de produção está em `supabase/config.toml`, em `[remotes.production]` (Site URL, redirects, SMTP). Para a aplicar:

```bash
read -s RESEND_API_KEY && export RESEND_API_KEY
supabase config push --project-ref zummozltkillcaaewnlo
```

A key do Resend é lida da variável de ambiente e nunca vai para o repositório. Os templates `magic_link` e `confirmation` só têm `{{ .Token }}` (código de 6 dígitos, validade de 1 hora). Sem SMTP próprio o Supabase gratuito não deixa alterar templates, por isso o SMTP é obrigatório para o login por código.

## Limites de envio de email

- SMTP de base do Supabase: poucos emails por hora e só para membros da equipa do projeto. Não serve para este produto.
- Resend gratuito: 100 emails/dia e 3 000/mês, uma só área de domínio por conta gratuita. Chega para a v1.
- O Supabase limita também os pedidos de código por endereço (`auth.rate_limit`, `max_frequency`); em produção o intervalo mínimo entre códigos para o mesmo email é de 1 minuto por defeito.

## Mudar de remetente ou para um domínio do Patudos

Quando houver domínio próprio (por exemplo `patudos.pt`):

1. No Resend, **Domains → Add Domain** e escolher a região da UE.
2. Criar no DNS do domínio os registos que o Resend indicar: SPF (TXT), DKIM (CNAME/TXT) e, recomendado, DMARC (TXT `_dmarc`). Esperar pelo estado **Verified**.
3. Em `supabase/config.toml`, em `[remotes.production.auth.email.smtp]`, mudar `admin_email` (por exemplo `codigo@patudos.pt`).
4. Em `[remotes.production.auth]`, mudar `site_url` e `additional_redirect_urls` para o novo domínio da app, e acrescentar o domínio no Vercel (Settings → Domains).
5. Voltar a correr `supabase config push` (com `RESEND_API_KEY` exportada) e fazer novo deploy se mudar o URL.
6. Testar o login com um email que não seja o teu.

## Lembretes por push e email (Fase 3, passo 2)

Arquitetura: `pg_cron` (5 em 5 min, porque o Vercel Cron do plano Hobby só corre 1×/dia) chama `run_reminder_cycle()`, que gera as ocorrências e usa `pg_net` para invocar a Edge Function `send-reminders`. A função tem o service role do lado do Supabase; a Vercel **não** recebe a chave privada VAPID nem o service role. A função autentica o cron com um segredo partilhado (`x-cron-secret`); o botão «Enviar notificação de teste» usa o JWT do utilizador.

Regras de envio: só ocorrências devidas há menos de 24 h, não feitas, de lembretes ativos e animais não arquivados; cada ocorrência é «reclamada» por canal numa transação (`for update skip locked`), por isso não há duplicados. Os lembretes de **medicação** vão só por push (nunca por email).

Tudo isto corre no teu terminal (nada disto está no repositório):

```bash
# 1. Chaves VAPID (guarda o resultado; a privada nunca vai para a Vercel)
npx web-push generate-vapid-keys

# 2. Segredos da função (no Supabase)
supabase secrets set --project-ref zummozltkillcaaewnlo \
  VAPID_PUBLIC_KEY='<pública>' VAPID_PRIVATE_KEY='<privada>' \
  VAPID_SUBJECT='mailto:<o teu email>' \
  RESEND_API_KEY='<key do Resend>' \
  APP_URL='https://patudos-five.vercel.app' \
  CRON_SECRET="$(openssl rand -hex 32)"
```

Para o `CRON_SECRET`, usa um valor que também vais colar no Vault (passo seguinte): gera-o antes (`openssl rand -hex 32`), guarda-o e usa o mesmo nos dois sítios.

Na Vercel (Production e Preview), acrescenta `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (a pública) e volta a fazer deploy (entra no build).

No SQL Editor do Supabase (depois do `supabase db push`), guarda no Vault o URL e o segredo que o cron usa:

```sql
select vault.create_secret('https://zummozltkillcaaewnlo.supabase.co/functions/v1', 'patudos_functions_url');
select vault.create_secret('<o mesmo CRON_SECRET>', 'patudos_cron_secret');
```

Sem estes dois segredos o cron só gera ocorrências (não envia nada).

Deploy da função e verificação:

```bash
supabase functions deploy send-reminders --project-ref zummozltkillcaaewnlo --no-verify-jwt
# Teste manual (devia responder {"ok":true,...}):
curl -X POST -H "x-cron-secret: <CRON_SECRET>" https://zummozltkillcaaewnlo.supabase.co/functions/v1/send-reminders
```

Logs: Supabase → Edge Functions → `send-reminders`; execuções do cron: `select * from cron.job_run_details order by start_time desc limit 10;`.

### Local

`supabase/functions/.env` (ignorado pelo git) tem chaves VAPID de desenvolvimento, `CRON_SECRET` e `MAILPIT_URL`. Para testar: `supabase start`, `supabase functions serve` e `npm run test:functions` (Deno; email para o Mailpit, push para um endpoint falso).

## Limites de utilização (Fase 6, passo 3)

Aplicados na base de dados (migração `limites_de_utilizacao`), nunca só no cliente. Pensados para o uso normal nunca os atingir; servem para travar abusos e custos. Os contadores ficam em `rate_limit_events` (por utilizador, ação e janela; limpeza automática ao fim de 2 dias).

| O quê                        | Limite                                                 | Onde                                                            | Mensagem na app                              |
| ---------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------- |
| Convites (criar/reenviar)    | 20 por dia por utilizador                              | `invite_to_pet` → `take_rate_limit`                             | «Enviaste muitos convites hoje (máximo 20…)» |
| Notificação de teste         | 1 por minuto e 10 por dia por utilizador               | Edge Function `send-reminders` → `consume_test_push` (HTTP 429) | «Espera um minuto antes de enviar outra…»    |
| Animais                      | 30 ativos (não arquivados) por dono                    | trigger `pets_limit`                                            | «Chegaste ao limite de 30 animais ativos…»   |
| Armazenamento por animal     | 200 MB (fotos + documentos)                            | trigger `documents_quota`, soma de `storage.objects`            | «Este animal já tem 200 MB de ficheiros…»    |
| Armazenamento por utilizador | 1 GB (ficheiros que carregou)                          | idem                                                            | «Já usaste 1 GB de armazenamento…»           |
| Exportação de dados          | 3 por hora por utilizador                              | `consume_export` (HTTP 429 no manifesto)                        | «Já pediste 3 exportações na última hora…»   |
| Feed `.ics`                  | 60 pedidos por hora por token (além da cache de 5 min) | `calendar_feed` devolve `limited` → HTTP 429 + `Retry-After`    | (os calendários só veem 429)                 |
| Pedidos de código (OTP)      | gerido pelo Supabase Auth (`auth.rate_limit`)          | —                                                               | mensagem própria no ecrã de entrada          |

Notas: o limite de armazenamento é verificado ao gravar o documento (o ficheiro já está carregado; se passar, a gravação falha e a app apaga o ficheiro). As fotos de animais não têm verificação própria (uma por animal, redimensionada, 10 MB no bucket). Para mudar um valor, nova migração a alterar o número na função/trigger respetiva (`take_rate_limit` recebe janelas e máximos).

## Operação

### Verificação de saúde

`GET /api/saude` responde `200 {"ok":true}` se a base de dados responde (função `health_ping`, sem dados) e `503 {"ok":false}` caso contrário. Serve para monitorização externa opcional (por exemplo UptimeRobot, a cada 5 min, no plano gratuito): é só criar um monitor HTTP para `https://patudos-five.vercel.app/api/saude`. Nota: o plano gratuito do Supabase pausa o projeto após 7 dias sem atividade; este monitor também o mantém ativo.

### Logs

- **Cron dos lembretes:** SQL Editor do Supabase:
  `select jobname, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;`
  (o `pg_net` guarda as respostas HTTP da função em `net._http_response`: `select status_code, content, created from net._http_response order by created desc limit 20;`).
- **Edge Function `send-reminders`:** Supabase → Edge Functions → `send-reminders` → Logs (ou `supabase functions logs`… só no painel em produção). Respostas esperadas: `{"ok":true,...}` do cron; 429 no teste de notificações quando o limite é atingido.
- **App (Next.js):** Vercel → projeto `patudos` → Logs (Runtime Logs), filtrar por «Error».
- **Limites atingidos:** `select action, count(*) from rate_limit_events where created_at > now() - interval '1 day' group by 1;`

## Monitorização de erros (Sentry)

Sentry (plano gratuito, **região UE**: dados em Frankfurt) recebe erros do browser, do servidor Next.js (`src/instrumentation.ts`, `onRequestError`) e da Edge Function `send-reminders`. Sem DSN definido, tudo fica desligado e a app funciona na mesma.

Privacidade: `dataCollection` tudo desligado (SDK v11: sem utilizador, cookies, cabeçalhos, corpos nem query strings), sem replays, sem traços de desempenho, sem breadcrumbs, e `beforeSend` ([scrub.ts](../src/lib/sentry/scrub.ts)) remove utilizador, cookies, cabeçalhos, corpos de pedidos e query strings, e troca emails e ids por `[email]`/`:id`. Fica só o tipo de erro, a stack, a rota sem ids, o ambiente e a versão. A política de privacidade lista o Sentry como subcontratante.

### Passos a fazer (utilizador)

1. Criar conta em https://sentry.io/signup/ (com o email que quiseres receber os alertas).
2. Em **Create a New Organization**, escolher **Data Storage Location: European Union (EU)**. Não se pode mudar depois. Plano **Developer** (gratuito).
3. Criar um projeto: plataforma **Next.js**, nome `patudos`. Guardar o **DSN** (`https://<chave>@o<n>.ingest.de.sentry.io/<id>`).
4. Na Vercel (Settings → Environment Variables, Production e Preview), definir:
   - `SENTRY_DSN` = o DSN
   - `NEXT_PUBLIC_SENTRY_DSN` = o mesmo DSN (entra no build do browser; o DSN do browser é público por desenho)
   - opcional, para stack traces legíveis: `SENTRY_AUTH_TOKEN` (Settings → Developer Settings → Organization Tokens), `SENTRY_ORG` (slug da organização), `SENTRY_PROJECT` = `patudos`
5. Fazer novo deploy na Vercel.
6. Edge Function (secret no Supabase): `supabase secrets set --project-ref zummozltkillcaaewnlo SENTRY_DSN='<o DSN>'` e `supabase functions deploy send-reminders --project-ref zummozltkillcaaewnlo --no-verify-jwt`.
7. Alertas por email: no Sentry, **Alerts → Create Alert → Issues**, «When a new issue is created → send a notification to» o teu email (normalmente já existe um alerta por defeito).
8. Verificar: abrir a app e, num ecrã de teste, forçar um erro (ou no Sentry, **Settings → Projects → patudos → Client Keys → Test**); confirmar que aparece sem emails nem ids.

## Backups (por decidir)

Decisão atual (23/11/2026): **sem backups**. O plano gratuito do Supabase não tem backups automáticos acessíveis; a política de privacidade di-lo claramente. Opções para mais tarde:

- **Supabase Pro** (~25 USD/mês): backups diários com 7 dias de retenção e PITR opcional.
- **GitHub Actions agendada (grátis)**: `supabase db dump` diário (esquema + dados), cifrado com `age`, chave pública no repositório e privada só com o utilizador, guardado como artefacto com retenção de 30 dias; password da BD como secret do GitHub. Os ficheiros do Storage ficam de fora (ou numa cópia semanal). Se for adotado, voltar a atualizar a política de privacidade (cópias eliminadas em 30 dias) e escrever `docs/backups.md` com o restauro testado.

Risco assumido: perda de dados se o Supabase falhar ou se alguém apagar dados por engano; não há como os recuperar.
