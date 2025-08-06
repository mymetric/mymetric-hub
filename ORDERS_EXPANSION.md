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

### 3. Comparativo Real de Métricas
- **Dados Históricos**: Busca automática de dados do período anterior
- **Comparação Real**: Crescimento calculado com dados reais, não simulados
- **Período Dinâmico**: Calcula período anterior baseado no período selecionado
- **Indicadores Visuais**: Mostra crescimento/queda com cores e ícones
- **Loading States**: Indicador "Comparando..." durante carregamento de dados históricos

### 4. Interface de Usuário
- **Botão Dinâmico**: Muda entre download, loading e visualização
- **Indicadores Visuais**: Spinner, timer e mensagens de status
- **Tooltip Informativo**: Mostra tempo decorrido e status atual
- **Layout Responsivo**: Adapta-se a diferentes tamanhos de tela

### 5. Sistema de Clientes Dinâmicos
- **CSV Remoto**: Lista de clientes carregada de URL externa
- **Slugs Limpos**: Exibição apenas dos slugs, sem nomes amigáveis
- **Loading States**: Indicadores visuais durante carregamento
- **Fallback Inteligente**: Lista padrão em caso de erro na API
- **Busca em Tempo Real**: Filtro dinâmico por nome do cliente
- **Controle de Acesso**: Lista completa apenas para usuários com `access_control: 'all'`

## Controle de Acesso de Usuários

### Visão Geral
O sistema implementa controle de acesso baseado no campo `access_control` do usuário, determinando quais funcionalidades e dados estão disponíveis para cada tipo de usuário.

### Tipos de Acesso

#### 1. Acesso Total (`access_control: 'all'`)
**Funcionalidades Disponíveis:**
- ✅ **Lista Completa de Clientes**: Dropdown com todas as empresas
- ✅ **Navegação Livre**: Acesso a qualquer cliente do sistema
- ✅ **Compartilhamento**: URLs com qualquer cliente
- ✅ **Análises Comparativas**: Comparação entre diferentes clientes

**Comportamento:**
```typescript
availableTables = user?.access_control === 'all' 
  ? [lista_completa_de_clientes]
  : [user?.tablename || 'coffeemais']
```

#### 2. Acesso Restrito (`access_control: 'specific'`)
**Funcionalidades Disponíveis:**
- ✅ **Cliente Único**: Acesso apenas ao cliente específico (`tablename`)
- ✅ **Análises Limitadas**: Dados apenas do cliente autorizado
- ✅ **Interface Simplificada**: Dropdown com apenas um cliente

**Comportamento:**
```typescript
availableTables = [user?.tablename || 'coffeemais']
```

### Implementação Técnica

#### 1. Interface de Usuário
```typescript
interface User {
  email: string
  admin: boolean
  access_control: string  // 'all' ou 'specific'
  tablename: string       // Cliente específico (quando access_control !== 'all')
  username: string
  lastLogin: string
}
```

#### 2. Lógica de Controle
```typescript
// TableSelector - Lista de clientes disponíveis
const availableTables = user?.access_control === 'all' 
  ? [
      '3dfila', 'gringa', 'orthocrin', 'meurodape', 'coffeemais',
      'universomaschio', 'oculosshop', 'evoke', 'hotbuttered',
      // ... lista completa
    ]
  : [user?.tablename || 'coffeemais']

// Cliente padrão selecionado
const defaultTable = user?.access_control === 'all'
  ? (params.table || user?.tablename || 'coffeemais')
  : (user?.tablename || 'coffeemais')
```

#### 3. Validação de Acesso
- **Frontend**: Interface adaptada ao nível de acesso
- **Backend**: Validação adicional de permissões
- **URL Params**: Respeita restrições de acesso
- **Compartilhamento**: URLs filtradas por permissão

### Benefícios

#### 1. Segurança
- ✅ **Isolamento de Dados**: Usuários veem apenas dados autorizados
- ✅ **Controle Granular**: Diferentes níveis de acesso
- ✅ **Validação Dupla**: Frontend e backend
- ✅ **Auditoria**: Rastreamento de acessos

#### 2. Experiência do Usuário
- ✅ **Interface Adaptada**: UI simplificada para usuários restritos
- ✅ **Navegação Intuitiva**: Apenas opções relevantes
- ✅ **Performance**: Menos dados carregados
- ✅ **Clareza**: Funcionalidades claras por nível

#### 3. Manutenibilidade
- ✅ **Configuração Centralizada**: Controle via `access_control`
- ✅ **Escalabilidade**: Fácil adição de novos níveis
- ✅ **Flexibilidade**: Adaptação rápida a mudanças
- ✅ **Consistência**: Comportamento uniforme

### Casos de Uso

#### 1. Administradores
- **Acesso**: `access_control: 'all'`
- **Funcionalidades**: Lista completa, comparações, relatórios gerais
- **Uso**: Gestão geral, análises comparativas, suporte

#### 2. Analistas de Cliente
- **Acesso**: `access_control: 'specific'`
- **Funcionalidades**: Cliente específico, análises focadas
- **Uso**: Análises diárias, relatórios específicos, otimizações

#### 3. Consultores
- **Acesso**: `access_control: 'all'` ou `access_control: 'specific'`
- **Funcionalidades**: Depende do tipo de consultoria
- **Uso**: Análises comparativas ou focadas

### Fluxo de Funcionamento

1. **Login**: Sistema identifica nível de acesso do usuário
2. **Carregamento**: Interface adaptada ao `access_control`
3. **Navegação**: Opções limitadas conforme permissão
4. **Dados**: Apenas dados autorizados carregados
5. **Compartilhamento**: URLs respeitam restrições

## Sistema de Clientes Dinâmicos

### Visão Geral
O sistema de clientes dinâmicos carrega automaticamente a lista de clientes disponíveis de uma URL CSV externa, permitindo atualizações centralizadas sem necessidade de deploy.

### Funcionalidades

#### 1. Carregamento de CSV Remoto
```typescript
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQNqKWaGX0EUBtFGSaMnHoHJSoLKFqjPrjydOtcSexU3xVGyoEnhgKQh8A6-6_hOOQ0CfmV-IfoC8d/pub?gid=771281747&single=true&output=csv'
```

#### 2. Hook Personalizado (useClientList)
```typescript
interface UseClientListReturn {
  clients: string[]
  isLoading: boolean
  error: string | null
}
```

**Funcionalidades:**
- **Fetch Automático**: Carrega dados ao montar componente
- **Parse CSV**: Extrai slugs da primeira coluna
- **Tratamento de Erros**: Fallback para lista padrão
- **Loading States**: Indicadores de carregamento

#### 3. Exibição de Slugs Limpos
- **Sem Nomes Amigáveis**: Mostra apenas os slugs dos clientes
- **Busca Simplificada**: Filtro direto por slug
- **Interface Limpa**: Visual mais técnico e direto

#### 4. Estados de Interface

**Loading:**
- **Botão**: Spinner + "Carregando..."
- **Dropdown**: "Carregando clientes..."
- **Desabilitado**: Interação bloqueada

**Erro:**
- **Fallback**: Lista padrão carregada
- **Mensagem**: "Erro ao carregar clientes"
- **Funcionalidade**: Sistema continua operacional

**Sucesso:**
- **Lista Dinâmica**: Clientes do CSV
- **Busca Funcional**: Filtro em tempo real
- **Seleção**: Mudança de cliente ativa

### Benefícios

#### 1. Manutenibilidade
- ✅ **Atualização Centralizada**: CSV único para todos os clientes
- ✅ **Sem Deploy**: Mudanças refletem imediatamente
- ✅ **Versionamento**: Controle de versão via Google Sheets

#### 2. Flexibilidade
- ✅ **Adição Rápida**: Novos clientes via CSV
- ✅ **Remoção Simples**: Clientes removidos automaticamente
- ✅ **Edição Fácil**: Interface familiar do Google Sheets

#### 3. Robustez
- ✅ **Fallback Inteligente**: Lista padrão em caso de erro
- ✅ **Loading States**: Feedback visual durante carregamento
- ✅ **Tratamento de Erros**: Sistema não quebra

### Fluxo de Funcionamento

1. **Inicialização**: Hook carrega CSV ao montar componente
2. **Parse**: Extrai slugs da primeira coluna
3. **Fallback**: Se erro, usa lista padrão
4. **Exibição**: Mostra slugs limpos no dropdown
5. **Busca**: Filtro dinâmico por slug
6. **Seleção**: Mudança de cliente atualiza dashboard

### Estrutura do CSV

**Formato Esperado:**
```csv
slug
gringa
constance
coffeemais
3dfila
orthocrin
...
```

**Processamento:**
- **Header**: Ignora linha "slug"
- **Dados**: Extrai primeira coluna de cada linha
- **Limpeza**: Remove espaços e linhas vazias
- **Validação**: Filtra slugs válidos

## Sistema de Comparação de Métricas

### Visão Geral
O sistema de comparação de métricas substitui os valores fictícios por dados reais do período anterior, proporcionando insights verdadeiros sobre o crescimento ou queda das métricas.

### Funcionalidades

#### 1. Cálculo de Período Anterior
```typescript
const getPreviousPeriod = () => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  const previousEnd = new Date(start)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - daysDiff + 1)
  
  return {
    start: previousStart.toISOString().split('T')[0],
    end: previousEnd.toISOString().split('T')[0]
  }
}
```

#### 2. Busca de Dados Históricos
- **Requisição Paralela**: Dados históricos buscados simultaneamente aos dados atuais
- **Tratamento de Erros**: Falha na busca histórica não afeta dados principais
- **Cache Inteligente**: Dados históricos atualizados quando filtros mudam

#### 3. Cálculo de Crescimento Real
```typescript
const calculateGrowth = (current: number, previous: number) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0 // Crescimento de 100% se não havia dados
  }
  if (current === 0) {
    return previous > 0 ? -100 : 0 // Queda de 100% se havia dados
  }
  return ((current - previous) / previous) * 100
}
```

#### 4. Métricas Comparadas
- **Sessões**: Comparação direta de volume de tráfego
- **Pedidos Pagos**: Evolução de conversões pagas
- **Receita Paga**: Crescimento de receita efetiva
- **Ticket Médio**: Variação do valor médio por pedido
- **Taxa de Conversão**: Evolução da eficiência de conversão
- **Taxa de Adição ao Carrinho**: Mudança no engajamento
- **Receita por Sessão**: Eficiência monetária por visita
- **Taxa de Novos Clientes**: Evolução da aquisição

### Estados Visuais

#### 1. Carregamento
- **Indicador**: Spinner + "Comparando..."
- **Cor**: Azul
- **Posição**: Canto superior direito do card

#### 2. Crescimento Positivo
- **Ícone**: Seta para cima (↗️)
- **Cor**: Verde
- **Formato**: "+X.X%"

#### 3. Queda Negativa
- **Ícone**: Seta para baixo (↘️)
- **Cor**: Vermelho
- **Formato**: "-X.X%"

#### 4. Sem Mudança
- **Ícone**: Nenhum
- **Cor**: Cinza
- **Formato**: "0.0%"

### Benefícios

#### 1. Insights Reais
- ✅ **Dados Verdadeiros**: Comparação com período real, não simulado
- ✅ **Tendências Reais**: Identificação de padrões de crescimento/queda
- ✅ **Performance Real**: Avaliação precisa de campanhas e estratégias

#### 2. Flexibilidade
- ✅ **Período Dinâmico**: Funciona com qualquer período selecionado
- ✅ **Filtros Consistentes**: Mesmos filtros aplicados ao período anterior
- ✅ **Atualização Automática**: Dados atualizados quando filtros mudam

#### 3. Experiência do Usuário
- ✅ **Feedback Visual**: Indicadores claros de crescimento/queda
- ✅ **Loading States**: Feedback durante carregamento de dados
- ✅ **Tratamento de Erros**: Interface não quebra se dados históricos falharem

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