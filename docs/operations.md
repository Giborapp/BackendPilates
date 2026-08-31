# Operacao e deploy

## Variaveis

O backend utiliza `NODE_ENV`, `PORT`, `DATABASE_URL`, `CORS_ORIGINS`, `PUBLIC_WEB_URL`, os segredos de sessao (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `DEVICE_TOKEN_SECRET`), suas expiracoes, `COOKIE_DOMAIN`, `STORAGE_DRIVER`, `LOCAL_STORAGE_PATH`, `FILE_UPLOAD_MAX_BYTES`, `BOOTSTRAP_SETUP_TOKEN` e as variaveis S3/R2 `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`.

`TURNSTILE_SECRET_KEY` e opcional no backend. Quando configurado, o endpoint publico exige um token Turnstile valido. O frontend pode receber `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; a chave secreta nunca deve ser configurada na Vercel.

## R2 e arquivos

Use `STORAGE_DRIVER=s3` com bucket privado. O endpoint configurado em `S3_ENDPOINT` deve ser o endpoint S3 da conta R2; `S3_REGION` normalmente e `auto`. O sistema gera URLs PUT e GET temporarias e confirma o objeto antes de disponibiliza-lo. Arquivos gerais respeitam `FILE_UPLOAD_MAX_BYTES` (10 MB por padrao); logos aceitam somente PNG/WebP e 2 MB.

Configure CORS do R2 para os dominios do frontend que fazem upload, permitindo `PUT`, `GET`, `HEAD` e os headers `Content-Type`, `Content-Length`, `ETag`. Nunca habilite acesso publico ao bucket. Rotacione as chaves substituindo ambas as variaveis no Render e removendo as antigas no Cloudflare.

## Render

Build command: `pnpm build`.

Start command: `pnpm --filter @pilates-manager/api start`.

Pre-Deploy Command: `pnpm prisma:deploy`.

Antes do pre-deploy, faça backup do PostgreSQL e revise, nesta ordem, as migrations `20260826170000_add_studio_onboarding_branding`, `20260827100000_add_assessment_audience_status`, `20260827120000_add_public_intake_requests`, `20260827130000_add_student_plan_weekly_snapshot` e `20260827140000_add_public_replacement_links`. Verifique `/health` depois do deploy. Nao execute seed em producao.

## Vercel e Turnstile

Configure `NEXT_PUBLIC_API_URL` com a URL da API e, quando o widget estiver ativo, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. O backend deve conter `PUBLIC_WEB_URL` e `TURNSTILE_SECRET_KEY`. A origem do frontend deve estar em `CORS_ORIGINS`. Em desenvolvimento, sem a chave secreta, a validacao Turnstile e desativada.

## Rollback

Rollback da aplicacao pode apontar o Render para o commit anterior. Migrations que criam tabelas/colunas devem permanecer aplicadas; nao reescreva nem apague migrations. Para uma migration com efeito incompatível, restaure o backup em uma janela controlada e reverta a aplicacao para uma versao compatível, validando primeiro em ambiente de teste.

## Checklist

- [ ] Backup PostgreSQL exportado e testado.
- [ ] Migrations revisadas na ordem e ainda nao aplicadas sem aprovacao.
- [ ] Bucket R2 privado e CORS revisado.
- [ ] Chaves R2 rotacionadas sem aparecer em logs.
- [ ] Variaveis Render/Vercel conferidas sem imprimir valores.
- [ ] `/health` e smoke test com dados falsos executados apos deploy.
- [ ] Turnstile configurado somente se o widget for habilitado.

## E2E local e integrado

`pnpm test:e2e` continua sendo a suíte local/mock existente. Ela não representa a integração com PostgreSQL.

`pnpm test:e2e:integration` é reservado para um runner de CI que forneça PostgreSQL efêmero. O comando exige `NODE_ENV=test`, `E2E_INTEGRATION=true`, `DATABASE_URL` PostgreSQL com nome de banco contendo `e2e`, `test` ou `ci`, host local/serviço CI e `LOCAL_STORAGE_PATH` identificado como teste. Hosts externos conhecidos, incluindo Render, são recusados antes de qualquer migration.

No GitHub Actions, o workflow `.github/workflows/e2e-integration.yml` cria PostgreSQL 16 como service do job, executa `prisma migrate deploy` somente nesse banco, inicia API e frontend reais, executa Jest integrado e Playwright integrado e encerra os processos. O workflow é acionado por pull requests e por `workflow_dispatch`; não possui etapas de deploy nem usa secrets de produção.

Backend e frontend são checkouts explícitos de repositórios separados. No `workflow_dispatch`, informe `backend_ref` e `frontend_ref` para as branches ou tags que devem ser testadas. Em pull requests, o workflow tenta a branch do PR nos dois repositórios. Para frontend privado, configure no repositório do backend o secret `PILATES_FRONT_READ_TOKEN` com permissão mínima de leitura de conteúdo; para frontend público, o `GITHUB_TOKEN` padrão é suficiente. A visibilidade dos repositórios deve ser confirmada no GitHub antes da execução, pois o runner não usa uma pasta irmã preexistente.

Os fluxos integrados usam autenticação, autorização, Prisma e API reais. O storage usa o driver local em diretório temporário. R2 e Turnstile não são acessados. As fixtures são criadas pelos testes com dados `example.test`; o seed da aplicação não é executado.

Para investigar uma falha, consulte o log do job e os artefatos `playwright-report` e `e2e-junit` disponibilizados somente quando o job falha. A execução deve terminar em poucos minutos, dependendo da instalação do Playwright e da inicialização do PostgreSQL. Falhas de proteção de ambiente devem ser corrigidas na configuração do job, nunca contornadas com banco persistente.
