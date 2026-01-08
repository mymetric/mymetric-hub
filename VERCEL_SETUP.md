# Configuração do Vercel

Este documento descreve como configurar o projeto para rodar no Vercel com servidor e frontend.

## Estrutura

- **Frontend**: React + Vite (build estático)
- **Backend**: Express serverless function em `/api/dashboard/[...].js`

## Variáveis de Ambiente no Vercel

Configure as seguintes variáveis de ambiente no painel do Vercel:

### Firebase Admin SDK (GCP)
```
GCP_PROJECT_ID=seu-project-id
GCP_PRIVATE_KEY_ID=sua-private-key-id
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GCP_CLIENT_EMAIL=seu-service-account@projeto.iam.gserviceaccount.com
GCP_CLIENT_ID=seu-client-id
GCP_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GCP_TOKEN_URI=https://oauth2.googleapis.com/token
GCP_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GCP_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/seu-service-account%40projeto.iam.gserviceaccount.com
GCP_UNIVERSE_DOMAIN=googleapis.com
GCP_DATABASE=api-admin
```

### Outras
```
NODE_ENV=production
```

## Build Settings no Vercel

1. **Framework Preset**: Vite
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Install Command**: `npm install`

## Estrutura de Rotas

- `/api/dashboard/*` → Serverless function (Express)
- `/*` → Frontend estático (React)

## Endpoints da API

- `POST /api/dashboard/save` - Salvar configuração do dashboard
- `GET /api/dashboard/load` - Carregar configuração do dashboard
- `POST /api/dashboard/delete-universal-tab` - Deletar aba universal
- `GET /api/dashboard/data-sources` - Buscar fontes de dados disponíveis

## Deploy

1. Conecte seu repositório GitHub ao Vercel
2. Configure as variáveis de ambiente no painel do Vercel
3. O Vercel detectará automaticamente o `vercel.json` e fará o deploy

## Notas

- O servidor Express é convertido em serverless function automaticamente pelo Vercel
- As variáveis de ambiente devem ser configuradas no painel do Vercel (Settings > Environment Variables)
- O `GCP_PRIVATE_KEY` deve incluir as quebras de linha `\n` literalmente na string

