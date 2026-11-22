# Deploy

## Produção

- App: https://patudos-five.vercel.app (Vercel, projeto `patudos`, branch de produção `main`).
- Base de dados e autenticação: Supabase, projeto `Patudos` (`zummozltkillcaaewnlo`, eu-west-1).
- Email dos códigos: SMTP do Resend, remetente `patudos@miguelgazela.com`.

## Variáveis de ambiente (Vercel, Production e Preview)

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zummozltkillcaaewnlo.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave `publishable` do projeto |
| `RESEND_API_KEY` | API key do Resend (**só Production**, sem `NEXT_PUBLIC_`), para os emails de convite |

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
