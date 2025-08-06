# Sistema de Expansão de Pedidos - MyMetricHUB

## Visão Geral

Este documento descreve a implementação do sistema de expansão de pedidos no dashboard do MyMetricHUB, permitindo que os usuários visualizem detalhes individuais dos pedidos diretamente na interface.

## Funcionalidades Principais

### 1. Download e Visualização de Pedidos
- **Download First, Then View**: Sistema de download em background seguido de visualização
- **Cache Inteligente**: Armazenamento local de pedidos baixados com duração de 5 minutos
- **Cancelamento de Requisições**: Uso de `AbortController` para cancelar requisições em andamento
- **Timer de Progresso**: Sistema de timer para gerenciar expectativa do cliente durante downloads longos

### 2. Sistema de Timer de Download
- **Contador Decrescente**: Timer visual mostrando tempo restante (60s → 0s)
- **Mensagens de Progresso**: Feedback dinâmico baseado no tempo restante
- **Estados Visuais**: Diferentes indicadores para cada fase do download
- **Limpeza Automática**: Estados limpos quando filtros mudam

#### Mensagens de Progresso por Tempo Restante:
- **60-50s**: "Iniciando download..."
- **49-40s**: "Processando dados..."
- **39-20s**: "Analisando atribuições..."
- **19-10s**: "Finalizando download..."
- **9-5s**: "Quase pronto..."
- **4-1s**: "Finalizando..."
- **0s**: "Aguarde..."

### 3. Interface de Usuário
- **Botão Dinâmico**: Muda entre download, loading e visualização
- **Indicadores Visuais**: Spinner, timer e mensagens de status
- **Tooltip Informativo**: Mostra tempo decorrido e status atual
- **Layout Responsivo**: Adapta-se a diferentes tamanhos de tela

## Arquitetura Técnica

### Componentes Principais

#### 1. Dashboard.tsx
**Responsabilidades:**
- Gerenciamento de estado de download
- Controle de cache de pedidos
- Interface de botões de download
- Sistema de timer e mensagens

**Estados Principais:**
```typescript
const [downloadingOrders, setDownloadingOrders] = useState<Set<string>>(new Set())
const [downloadedOrders, setDownloadedOrders] = useState<Set<string>>(new Set())
const [downloadStartTimes, setDownloadStartTimes] = useState<Map<string, number>>(new Map())
const [downloadMessages, setDownloadMessages] = useState<Map<string, string>>(new Map())
```

**Funções Principais:**
- `handleDownloadOrders()`: Gerencia download com timer
- `handleExpandOrders()`: Abre modal de visualização
- `handleCloseOrders()`: Fecha modal

#### 2. OrdersExpanded.tsx
**Responsabilidades:**
- Modal de detalhes dos pedidos
- Cache local de dados
- Formatação de datas robusta
- Exibição de atribuições múltiplas

**Funcionalidades:**
- **Cache Local**: Map com duração de 5 minutos
- **Formatação de Data**: Suporte a múltiplos formatos
- **Atribuições**: Último Clique Não Direto, Primeiro Clique, Primeiro Lead
- **Filtro de Diferenças**: Mostra apenas pedidos com atribuições diferentes

### 3. API Integration (api.ts)
**Endpoint Principal:**
```typescript
POST /metrics/orders
```

**Parâmetros Dinâmicos:**
- `traffic_category`: Para modelo "Último Clique Não Direto"
- `fs_traffic_category`: Para modelo "Primeiro Clique"

**Estrutura de Resposta:**
```typescript
interface Order {
  Horario: string
  ID_da_Transacao: string
  Primeiro_Nome: string
  Status: string
  Receita: number
  // Campos de atribuição
  Categoria_de_Trafico: string
  Origem: string
  Midia: string
  Campanha: string
  // Campos de Primeiro Clique
  Categoria_de_Trafico_Primeiro_Clique: string
  // Campos de Primeiro Lead
  Categoria_de_Trafico_Primeiro_Lead: string
  // ... outros campos
}
```

## Fluxo de Funcionamento

### 1. Download de Pedidos
```
Usuário clica no ícone de download
↓
Sistema inicia timer e mostra "Iniciando download..."
↓
API call com parâmetros baseados no modelo de atribuição
↓
Timer atualiza mensagens conforme tempo decorrido
↓
Dados recebidos → Cache salvo → Modal abre automaticamente
```

### 2. Visualização de Pedidos
```
Modal abre com dados do cache
↓
Se cache expirado, nova requisição em background
↓
Dados formatados e exibidos com atribuições múltiplas
↓
Filtro opcional para diferenças de atribuição
```

### 3. Sistema de Cache
```
Cache Key: `${table}-${cluster}-${startDate}-${endDate}-${attributionModel}`
↓
Duração: 5 minutos
↓
Limpeza automática quando filtros mudam
```

## Melhorias de UX

### 1. Feedback Visual
- **Spinner animado** durante download
- **Timer decrescente** mostrando tempo restante (60s → 0s)
- **Mensagens contextuais** baseadas no progresso
- **Indicadores de status** (download, pronto, erro)

### 2. Performance
- **Download em background** não bloqueia interface
- **Cache inteligente** evita requisições desnecessárias
- **Cancelamento de requisições** previne race conditions
- **Limpeza automática** de estados obsoletos

### 3. Acessibilidade
- **Tooltips informativos** com status atual
- **Estados desabilitados** durante operações
- **Feedback textual** além de indicadores visuais
- **Navegação por teclado** suportada

## Terminologia

### Modelos de Atribuição
- **"Último Clique Não Direto"**: Atribuição baseada no último clique não direto
- **"Primeiro Clique"**: Atribuição baseada no primeiro clique da jornada

### Campos de Dados
- **Categoria de Tráfego**: Canal principal (Google Ads, Facebook, etc.)
- **Origem**: Fonte específica do tráfego
- **Mídia**: Tipo de mídia (cpc, cpm, orgânico, etc.)
- **Campanha**: Nome da campanha específica

## Considerações Técnicas

### 1. Performance
- Downloads assíncronos não bloqueiam UI
- Cache reduz carga no servidor
- Timer otimizado com setInterval

### 2. Robustez
- Tratamento de erros em todas as operações
- Fallbacks para dados inválidos
- Limpeza automática de recursos

### 3. Manutenibilidade
- Código modular e bem documentado
- Estados centralizados e consistentes
- Interfaces TypeScript bem definidas

## Próximas Melhorias

1. **Progress Bar**: Barra de progresso visual
2. **Retry Mechanism**: Tentativas automáticas em caso de falha
3. **Batch Downloads**: Download de múltiplos clusters simultaneamente
4. **Export Options**: Exportação de dados para CSV/Excel
5. **Real-time Updates**: Atualizações em tempo real via WebSocket 