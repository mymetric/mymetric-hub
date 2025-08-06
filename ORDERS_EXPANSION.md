# Funcionalidade de Expansão de Pedidos

## Visão Geral

A funcionalidade de expansão de pedidos permite que os usuários visualizem os pedidos individuais de cada linha da tabela de visão geral. Quando um usuário clica no ícone de olho (👁️) na coluna "Pedidos", um modal é aberto mostrando todos os pedidos detalhados daquele cluster/categoria de tráfego.

## Como Funciona

### 1. Interface do Usuário
- Na tabela de visão geral, cada linha tem uma coluna "Pedidos"
- Quando há pedidos (valor > 0), um ícone de download aparece ao lado do número
- **Primeiro**: Clique no ícone de download para baixar os pedidos
- **Depois**: O ícone muda para olho (verde) indicando que os dados estão prontos
- **Visualizar**: Clique no ícone de olho para abrir o modal com os detalhes

### 2. API Endpoint
A funcionalidade utiliza o endpoint:
```
POST /metrics/orders
```

**Parâmetros:**
- `start_date`: Data de início (YYYY-MM-DD)
- `end_date`: Data de fim (YYYY-MM-DD)
- `table_name`: Nome da tabela
- `traffic_category`: Categoria de tráfego (cluster)
- `limit`: Limite de pedidos (padrão: 100)

**Exemplo de requisição:**
```bash
curl --request POST \
  --url http://localhost:8000/metrics/orders \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "start_date": "2025-08-02",
    "end_date": "2025-08-02",
    "table_name": "gringa",
    "traffic_category": "🟢 Google Ads",
    "limit": 100
  }'
```

### 3. Resposta da API
A API retorna um array de pedidos com a seguinte estrutura:
```json
{
  "data": [
    {
      "Horario": "2025-08-02T10:30:00Z",
      "ID_da_Transacao": "#42965",
      "Primeiro_Nome": "keila valerio",
      "Status": "paid",
      "Receita": 6811.76,
      "Canal": "web",
      "Categoria_de_Trafico": "🟢 Google Ads",
      "Origem": "google",
      "Midia": "cpc",
      "Campanha": "google_cpc_compradoras_pmax_BR",
      "Conteudo": "(not set)",
      "Pagina_de_Entrada": "https://gringa.com.br/",
      "Parametros_de_URL": "utm_source=google&utm_medium=cpc&utm_campaign=google_cpc_compradoras_pmax_BR&gad_source=1&gad_campaignid=17434584383&gbraid=0AAAAACLgR6WoVVPLRvysSRquh27ojpTp6&gclid=EAIaIQobChMI0Nv5x4jtjgMVrEBIAB2OYDCJEAAYASAAEgL97vD_BwE",
      "Categoria_de_Trafico_Primeiro_Clique": "🟢 Google Ads",
      "Origem_Primeiro_Clique": "google",
      "Midia_Primeiro_Clique": "cpc",
      "Campanha_Primeiro_Clique": "google_cpc_compradoras_pmax_BR",
      "Conteudo_Primeiro_Clique": "(not set)",
      "Pagina_de_Entrada_Primeiro_Clique": "https://gringa.com.br/",
      "Parametros_de_URL_Primeiro_Clique": "utm_source=google&utm_medium=cpc&utm_campaign=google_cpc_compradoras_pmax_BR&gad_source=1&gad_campaignid=17434584383&gbraid=0AAAAACLgR6WoVVPLRvysSRquh27ojpTp6&gclid=EAIaIQobChMI_Jqo0-PsjgMVoKzuAR0oJwm9EAAYASAAEgKFxvD_BwE",
      "Categoria_de_Trafico_Primeiro_Lead": "",
      "Origem_Primeiro_Lead": "",
      "Midia_Primeiro_Lead": "",
      "Campanha_Primeiro_Lead": "",
      "Conteudo_Primeiro_Lead": "",
      "Pagina_de_Entrada_Primeiro_Lead": "",
      "Parametros_de_URL_Primeiro_Lead": ""
    }
  ]
}
```

## Componentes Implementados

### 1. OrdersExpanded.tsx
Componente modal que exibe os pedidos expandidos com:
- Lista de pedidos com detalhes
- Informações do cliente
- Itens de cada pedido
- Status e valores
- Loading states e tratamento de erros
- **Sistema de cache** para melhor performance
- **Carregamento em background** sem bloquear interface
- **Cancelamento de requisições** para evitar race conditions
- **Botão de refresh** para atualização manual

### 2. Modificações no Dashboard.tsx
- Adicionado estado para controlar o modal
- **Sistema de download primeiro**: Estado para controlar pedidos baixados
- **Estados de download**: Controle de downloads em andamento
- **Função de download**: Baixa dados antes de exibir
- **Botão dinâmico**: Download → Loading → Olho (verde)
- Integração com o componente OrdersExpanded
- **Tooltip dinâmico** baseado no estado (baixar/ver)
- **Indicador visual** no botão (download/loading/olho)
- **Cache limpo** quando mudar tabela ou datas

### 3. Modificações no api.ts
- Nova interface `OrdersRequest`
- Nova função `getOrders()` para fazer a requisição à API
- **Suporte a AbortController** para cancelamento de requisições

## Estados do Modal

### Loading Inicial
- Spinner de carregamento
- Mensagem "Carregando pedidos..."
- Aviso de que pode levar alguns segundos

### Loading em Background
- Indicador sutil "Atualizando..."
- Dados anteriores permanecem visíveis
- Não bloqueia a interface

### Erro
- Ícone de erro
- Mensagem de erro específica
- Botão "Tentar novamente"
- Possibilidade de retry

### Vazio
- Ícone de pacote vazio
- Mensagem "Nenhum pedido encontrado"
- Contexto sobre o filtro aplicado

### Sucesso
- Lista de pedidos com detalhes
- Contador de pedidos encontrados
- Informações completas de cada pedido
- Botão de refresh no header

## Funcionalidades do Modal

### Informações Exibidas
- **ID da Transação** (número do pedido)
- **Status** (com cores diferenciadas: paid, pending, cancelled, refunded)
- **Receita** (valor total do pedido)
- **Data/Hora** (formatação inteligente com fallback para múltiplos campos)
- **Nome do Cliente** (primeiro nome)
- **Canal** (web, mobile, etc.)
- **Informações de Tráfego**:
  - Categoria de Tráfego
  - Origem (google, facebook, etc.)
  - Mídia (cpc, cpm, etc.)
  - Campanha
  - Conteúdo
  - Página de Entrada (com link clicável)
- **Parâmetros da URL** (UTM parameters em formato legível)

### Campos de Data Suportados
O sistema tenta automaticamente os seguintes campos de data:
1. `Horario` (campo principal)
2. `Data` (campo alternativo)
3. `created_at` (formato padrão)
4. `data_criacao` (formato brasileiro)
5. `timestamp` (timestamp Unix)
6. `data_pedido` (campo específico)
7. `data_transacao` (campo específico)

### Formatação
- **Moeda brasileira** (R$)
- **Data e hora** no formato brasileiro (DD/MM/AAAA HH:MM)
- **Números formatados** com separadores de milhares
- **Tratamento robusto de datas**: Suporta múltiplos formatos (ISO, brasileiro, simples)
- **Fallback inteligente**: Se um campo de data estiver vazio, tenta outros campos
- **Debug automático**: Logs no console para identificar campos de data disponíveis

### Interatividade
- Hover effects nos cards de pedidos
- Botão de fechar no header
- **Scroll interno otimizado** para muitos pedidos
- **Indicador visual** quando há mais de 5 pedidos
- **Scroll suave** para melhor experiência
- Responsivo para mobile

## Status dos Pedidos

Os status são coloridos automaticamente:
- **Paid/Pago**: Verde
- **Pending/Pendente**: Amarelo
- **Cancelled/Cancelado**: Vermelho
- **Refunded/Reembolsado**: Laranja
- **Outros/Inválido**: Cinza

## Informações de Tráfego

Cada pedido inclui informações detalhadas de tráfego:
- **Categoria de Tráfego**: Emoji + nome (ex: 🟢 Google Ads)
- **Origem**: Fonte do tráfego (google, facebook, etc.)
- **Mídia**: Tipo de anúncio (cpc, cpm, etc.)
- **Campanha**: Nome da campanha específica
- **Conteúdo**: Conteúdo do anúncio
- **Página de Entrada**: URL da primeira página visitada
- **Parâmetros da URL**: UTM parameters completos

## Responsividade e Scroll

O modal é totalmente responsivo e otimizado para scroll:
- **Desktop**: Modal grande com scroll interno otimizado
- **Mobile**: Modal que ocupa quase toda a tela
- **Scroll interno**: Área de conteúdo com scroll independente
- **Indicador visual**: Mostra quando há mais de 5 pedidos para rolar
- **Scroll suave**: Transições suaves durante a rolagem
- **Header fixo**: Header permanece visível durante o scroll
- **Adaptação automática**: Conteúdo se adapta ao tamanho da tela

## Performance e Otimizações

### Sistema de Cache
- Cache de 5 minutos para dados já carregados
- Evita requisições desnecessárias
- Melhora significativamente a velocidade de carregamento

### Carregamento em Background
- Dados são carregados sem bloquear a interface
- Indicador sutil de atualização
- Usuário pode interagir enquanto dados carregam

### Cancelamento de Requisições
- AbortController para cancelar requisições antigas
- Evita race conditions
- Melhora performance em mudanças rápidas de filtros

### Otimizações de UX
- **Sistema de download primeiro**: Evita carregamento lento no modal
- **Estados visuais claros**: Download → Loading → Pronto
- **Tooltip dinâmico**: Informações específicas para cada estado
- **Indicador visual**: Cores e ícones diferentes para cada estado
- **Botão de refresh**: Para atualização manual no modal
- **Cache inteligente**: Dados persistidos entre sessões
- **Limpeza automática**: Cache limpo ao mudar filtros

## Segurança

- Token de autenticação obrigatório
- Validação de parâmetros
- Tratamento de erros de API
- Logout automático em caso de token inválido

## Uso

1. Acesse a aba "Visão Geral" no dashboard
2. Selecione as datas desejadas
3. Na tabela, procure uma linha com pedidos > 0
4. **Primeiro**: Clique no ícone de download (⬇️) na coluna "Pedidos"
5. **Aguarde**: O ícone mostra loading enquanto baixa os dados
6. **Depois**: O ícone muda para olho verde (👁️) indicando dados prontos
7. **Visualizar**: Clique no ícone de olho para abrir o modal
8. **Resultado**: Visualize os detalhes dos pedidos no modal
9. Feche o modal clicando no X ou fora dele

## Estados do Botão

### 1. Download (⬇️)
- **Cor**: Azul
- **Ação**: Baixar pedidos
- **Tooltip**: "Baixar X pedidos"

### 2. Loading (🔄)
- **Cor**: Azul com spinner
- **Ação**: Nenhuma (desabilitado)
- **Tooltip**: "Baixando pedidos..."

### 3. Pronto (👁️)
- **Cor**: Verde com indicador
- **Ação**: Abrir modal
- **Tooltip**: "Ver X pedidos baixados" 