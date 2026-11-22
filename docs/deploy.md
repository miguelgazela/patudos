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
