# Troubleshooting - Personalizações do Dashboard no Vercel

## Problema: Dashboard personalizations não carregam do Firestore

### Verificações Necessárias

#### 1. Variáveis de Ambiente
Verifique se TODAS as variáveis de ambiente estão configuradas no Vercel:

```
✅ GCP_PROJECT_ID
✅ GCP_PRIVATE_KEY_ID
✅ GCP_PRIVATE_KEY (com \n literal nas quebras de linha)
✅ GCP_CLIENT_EMAIL
✅ GCP_CLIENT_ID
✅ GCP_AUTH_URI
✅ GCP_TOKEN_URI
✅ GCP_AUTH_PROVIDER_X509_CERT_URL
✅ GCP_CLIENT_X509_CERT_URL
✅ GCP_UNIVERSE_DOMAIN (opcional)
✅ GCP_DATABASE (opcional, padrão: api-admin)
```

**Importante:** O `GCP_PRIVATE_KEY` deve ter as quebras de linha `\n` literalmente na string, não como caracteres de escape.

#### 2. Testar Endpoint de Health Check
Acesse: `https://seu-dominio.vercel.app/api/dashboard/health`

Deve retornar:
```json
{
  "status": "ok",
  "service": "firestore-api",
  "firestoreInitialized": true,
  "timestamp": "..."
}
```

Se `firestoreInitialized` for `false`, o Firebase não está inicializando corretamente.

#### 3. Verificar Logs no Vercel
1. Vá para o dashboard do Vercel
2. Acesse a função serverless `api/dashboard/[...]`
3. Veja os logs para erros de inicialização do Firebase

Procure por:
- `❌ Erro ao inicializar Firebase Admin`
- `❌ Firestore não inicializado`

#### 4. Testar Endpoint de Load
Acesse: `https://seu-dominio.vercel.app/api/dashboard/load?tableName=seu-cliente`

Deve retornar:
```json
{
  "success": true,
  "config": { ... }
}
```

#### 5. Verificar CORS
Se houver erros de CORS, verifique se o middleware `cors()` está sendo aplicado corretamente.

### Possíveis Causas

1. **Variáveis de ambiente não configuradas**
   - Solução: Configure todas as variáveis no painel do Vercel

2. **GCP_PRIVATE_KEY com formatação incorreta**
   - Solução: Certifique-se de que as quebras de linha `\n` estão presentes literalmente

3. **Database ID incorreto**
   - Solução: Verifique se `GCP_DATABASE` está correto (deve ser `api-admin`)

4. **Projeto Firebase incorreto**
   - Solução: Verifique se `GCP_PROJECT_ID` corresponde ao projeto correto

### Debug

Para debugar, adicione logs temporários no código:

```javascript
console.log('🔍 Variáveis de ambiente:', {
  hasProjectId: !!process.env.GCP_PROJECT_ID,
  hasPrivateKey: !!process.env.GCP_PRIVATE_KEY,
  hasClientEmail: !!process.env.GCP_CLIENT_EMAIL,
  databaseId: process.env.GCP_DATABASE
});
```

### Teste Local

Para testar localmente antes de fazer deploy:

1. Configure um arquivo `.env` com as mesmas variáveis
2. Execute: `npm run dev:server`
3. Teste: `curl http://localhost:3001/api/dashboard/health`

