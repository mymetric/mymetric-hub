# 🔍 Debug - OrdersByLocation

## Como Debugar o Erro

Se você está vendo "Erro ao carregar dados de localização", siga estes passos:

### 1. Abrir o Console do Navegador
- Pressione **F12** (ou Cmd+Option+I no Mac)
- Vá para a aba **Console**

### 2. Verificar os Logs

Procure por estas mensagens no console:

#### ✅ Logs de Sucesso:
```
🌍 Metrics by Location API Request: {start_date: "...", end_date: "...", ...}
📦 Metrics received: 123
📍 Sample metric location data: {city: "SAO PAULO", region: "SP", country: "Brasil", ...}
```

#### ❌ Logs de Erro:
```
❌ Resposta da API inválida: ...
Erro ao buscar métricas por localização: ...
```

### 3. Problemas Comuns e Soluções

#### Problema 1: "Resposta da API está vazia ou inválida"
**Causa**: A API não retornou dados ou retornou null

**Solução**: 
- Verifique se o período selecionado tem dados
- Verifique se a tabela está selecionada corretamente
- Teste a mesma requisição na aba "Visão Geral" (tabela principal)

#### Problema 2: "Erro ao buscar métricas"
**Causa**: Erro na chamada HTTP ou autenticação

**Solução**:
- Verifique se você está autenticado (não expirou o token)
- Atualize a página e faça login novamente
- Verifique se a API está respondendo

#### Problema 3: "Nenhum dado de localização disponível"
**Causa**: Os dados não contêm os campos `city`, `region`, `country`

**Solução**:
- Verifique no console a estrutura dos dados: `allFields: [...]`
- Se os campos não existem, a API precisa ser atualizada para incluí-los
- Campos esperados: `city`, `region`, `country`

### 4. Estrutura de Dados Esperada

A API deve retornar dados neste formato:

```json
{
  "data": [
    {
      "Data": "2025-10-02",
      "Cluster": "Sem Categoria",
      "Plataforma": "WEB",
      "city": "SAO PAULO",           ← OBRIGATÓRIO
      "region": "SP",                ← OBRIGATÓRIO
      "country": "Brasil",           ← OBRIGATÓRIO
      "Pedidos": 42,
      "Receita": 12524,
      "Pedidos_Pagos": 13,
      "Receita_Paga": 5234,
      ...
    }
  ]
}
```

### 5. Como Testar Manualmente

Você pode testar a API diretamente no console do navegador:

```javascript
// 1. Pegar o token
const token = localStorage.getItem('auth-token')

// 2. Fazer a requisição
fetch('https://api.mymetric.app/metrics/basic-data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    start_date: '2025-10-01',
    end_date: '2025-10-07',
    table_name: 'SUA_TABELA',
    cluster: 'Todos'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Resposta:', data)
  console.log('Primeiro item:', data.data[0])
  console.log('Tem city?', 'city' in data.data[0])
  console.log('Tem region?', 'region' in data.data[0])
  console.log('Tem country?', 'country' in data.data[0])
})
```

### 6. Verificar Campos Disponíveis

No console, você verá algo como:

```
📍 Sample metric location data: {
  city: "SAO PAULO",
  region: "SP", 
  country: "Brasil",
  allFields: [
    "Data",
    "Cluster",
    "Plataforma",
    "city",      ← Deve estar aqui
    "region",    ← Deve estar aqui
    "country",   ← Deve estar aqui
    "Pedidos",
    "Receita",
    ...
  ]
}
```

### 7. Ações Possíveis

#### Se os campos existem mas está dando erro:
1. Clique no botão **"Tentar novamente"**
2. Atualize a página (F5)
3. Faça logout e login novamente

#### Se os campos NÃO existem:
1. A API precisa ser atualizada para incluir `city`, `region`, `country`
2. Verifique com o backend se esses campos estão disponíveis
3. Pode ser necessário adicionar esses campos na query do BigQuery/banco de dados

### 8. Informações para o Suporte

Se o erro persistir, forneça:
- **Mensagem de erro** exibida
- **Logs do console** (F12)
- **Período selecionado** (start_date e end_date)
- **Tabela selecionada**
- **Screenshot do console**

## Checklist Rápido

- [ ] Console está aberto (F12)
- [ ] Vejo a mensagem "🌍 Metrics by Location API Request"
- [ ] Vejo a mensagem "📦 Metrics received: X"
- [ ] Vejo os campos city, region, country nos logs
- [ ] Os dados aparecem na tabela principal da Visão Geral
- [ ] Token está válido (não expirado)

## Contato

Se nada funcionar, provavelmente é um problema no backend/API que precisa incluir os campos de localização nos dados retornados.

