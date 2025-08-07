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
- **Error Handling**: Tratamento de erros sem fallback hardcoded
- **Busca em Tempo Real**: Filtro dinâmico por nome do cliente
- **Controle de Acesso**: Lista completa apenas para usuários com `access_control: 'all'`
- **Fonte Única**: Sistema usa apenas o CSV, sem listas hardcoded
- **Sem Fallbacks**: Eliminação completa de listas hardcoded no código

### Correção do Controle de Acesso

#### Problema Identificado
O sistema anteriormente carregava a lista completa do CSV para todos os usuários, independente do nível de acesso, permitindo que usuários restritos vissem todos os clientes.

#### Solução Implementada

##### 1. Nova Prop `useCSV`
```typescript
interface TableSelectorProps {
  currentTable: string
  onTableChange: (table: string) => void
  availableTables?: string[]
  useCSV?: boolean // Controla se deve usar CSV ou não
}
```

##### 2. Lógica Condicional
```typescript
// Dashboard - Passa prop baseada no nível de acesso
<TableSelector
  currentTable={selectedTable}
  onTableChange={setSelectedTable}
  useCSV={user?.access_control === 'all' || user?.tablename === 'all'} // Usar CSV apenas para usuários com acesso total
  availableTables={
    user?.access_control === 'all' || user?.tablename === 'all'
      ? [] // Vazio para usar apenas o CSV
      : [user?.tablename || 'coffeemais'] // Cliente específico para usuários restritos
  }
/>

// TableSelector - Lógica condicional com hook otimizado
const { clients, isLoading, error } = useClientList(useCSV) // Hook só executa quando useCSV é true

const tables = useMemo(() => {
  // Usuários restritos: não carregam CSV
  if (!useCSV) {
    return availableTables.length > 0 ? availableTables : ['coffeemais']
  }
  
  // Usuários com acesso total: carregam CSV
  if (clients.length > 0) {
    return clients
  }
  // ... fallback logic
}, [clients, availableTables, useCSV])

// Loading state condicional
const isActuallyLoading = useCSV ? isLoading : false
```

### Correção do Controle de Acesso - Suporte a tablename === 'all'

#### Problema Identificado
O sistema estava verificando apenas `access_control === 'all'` para determinar acesso total, mas alguns usuários têm `tablename: 'all'` e `access_control: '[]'`, o que deveria também dar acesso total.

#### Solução Implementada

##### 1. Lógica Condicional Atualizada
```typescript
// Antes: Apenas access_control
useCSV={user?.access_control === 'all'}

// Depois: access_control OU tablename
useCSV={user?.access_control === 'all' || user?.tablename === 'all'}

// Antes: Apenas access_control
availableTables = user?.access_control === 'all' 
  ? [] 
  : [user?.tablename || '']

// Depois: access_control OU tablename
availableTables = user?.access_control === 'all' || user?.tablename === 'all'
  ? [] 
  : [user?.tablename || '']
```

##### 2. Casos de Uso Suportados

**Caso 1: `access_control: 'all'`**
```json
{
  "access_control": "all",
  "tablename": "specific_client"
}
```
- ✅ **Acesso Total**: Lista completa do CSV
- ✅ **Hook Executa**: `useClientList(true)`
- ✅ **Interface Completa**: Dropdown com busca

**Caso 2: `tablename: 'all'`**
```json
{
  "access_control": "[]",
  "tablename": "all"
}
```
- ✅ **Acesso Total**: Lista completa do CSV
- ✅ **Hook Executa**: `useClientList(true)`
- ✅ **Interface Completa**: Dropdown com busca

**Caso 3: Acesso Restrito**
```json
{
  "access_control": "specific",
  "tablename": "specific_client"
}
```
- ✅ **Acesso Limitado**: Apenas cliente específico
- ✅ **Hook Não Executa**: `useClientList(false)`
- ✅ **Interface Simplificada**: Dropdown com um cliente

#### Benefícios da Correção

##### 1. Compatibilidade
- ✅ **Suporte Legado**: Usuários com `tablename: 'all'` funcionam
- ✅ **Flexibilidade**: Múltiplas formas de definir acesso total
- ✅ **Backward Compatible**: Não quebra usuários existentes
- ✅ **Forward Compatible**: Suporta novos formatos

##### 2. Segurança
- ✅ **Controle Duplo**: Verifica tanto `access_control` quanto `tablename`
- ✅ **Isolamento Mantido**: Usuários restritos ainda isolados
- ✅ **Validação Robusta**: Múltiplas verificações de acesso
- ✅ **Auditoria**: Rastreamento de ambos os campos

##### 3. Manutenibilidade
- ✅ **Código Limpo**: Lógica condicional clara
- ✅ **Documentação**: Casos de uso bem definidos
- ✅ **Testes**: Fácil validação de diferentes cenários
- ✅ **Escalabilidade**: Fácil adição de novos critérios

#### Validação da Correção

##### 1. Testes de Acesso
- ✅ **access_control: 'all'**: Lista completa carregada
- ✅ **tablename: 'all'**: Lista completa carregada
- ✅ **Ambos 'all'**: Lista completa carregada
- ✅ **Acesso Restrito**: Apenas cliente específico

##### 2. Testes de Performance
- ✅ **Hook Executa**: Para usuários com acesso total
- ✅ **Hook Não Executa**: Para usuários restritos
- ✅ **Carregamento Rápido**: Interface responsiva
- ✅ **Cache Eficiente**: Otimização mantida

##### 3. Testes de Interface
- ✅ **Dropdown Completo**: Para usuários com acesso total
- ✅ **Dropdown Simples**: Para usuários restritos
- ✅ **Busca Funcional**: Filtro em tempo real
- ✅ **Loading States**: Feedback visual correto

### Otimização do Hook useClientList

#### Problema Identificado
O hook `useClientList` estava sendo executado sempre, mesmo para usuários com acesso restrito, causando requisições desnecessárias e problemas de performance.

#### Solução Implementada

##### 1. Parâmetro Condicional
```typescript
export const useClientList = (shouldFetch: boolean = true): UseClientListReturn => {
  const [clients, setClients] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(shouldFetch) // Iniciar loading apenas se deve fazer fetch
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Se não deve fazer fetch, retornar imediatamente
    if (!shouldFetch) {
      setIsLoading(false)
      return
    }

    const fetchClients = async () => {
      // ... lógica de fetch
    }

    fetchClients()
  }, [shouldFetch]) // Adicionar shouldFetch como dependência

  return { clients, isLoading, error }
}
```

##### 2. Uso Otimizado no TableSelector
```typescript
// Hook só executa quando useCSV é true
const { clients, isLoading, error } = useClientList(useCSV)

// Loading state condicional
const isActuallyLoading = useCSV ? isLoading : false
```

#### Benefícios da Otimização

##### 1. Performance
- ✅ **Menos Requisições**: Hook só executa quando necessário
- ✅ **Carregamento Rápido**: Usuários restritos não esperam CSV
- ✅ **Cache Inteligente**: Evita fetch desnecessário
- ✅ **Recursos Economizados**: Menos uso de rede e processamento

##### 2. Experiência do Usuário
- ✅ **Interface Responsiva**: Dropdown carrega instantaneamente
- ✅ **Sem Loading Desnecessário**: Usuários restritos não veem spinner
- ✅ **Comportamento Consistente**: Interface adaptada ao nível de acesso
- ✅ **Feedback Visual Correto**: Loading apenas quando relevante

##### 3. Manutenibilidade
- ✅ **Código Limpo**: Lógica condicional clara
- ✅ **Debugging Fácil**: Estados de loading previsíveis
- ✅ **Testes Simples**: Comportamento isolado por nível
- ✅ **Escalabilidade**: Fácil adição de novos níveis de acesso

#### Fluxo Otimizado

##### 1. Usuários com `access_control: 'all'`
1. **Prop `useCSV: true`**: Sistema carrega CSV
2. **Hook Executa**: `useClientList(true)` faz fetch
3. **Loading State**: Interface mostra "Carregando clientes..."
4. **Lista Completa**: Todos os clientes disponíveis

##### 2. Usuários com Acesso Restrito
1. **Prop `useCSV: false`**: Sistema não carrega CSV
2. **Hook Não Executa**: `useClientList(false)` retorna imediatamente
3. **Sem Loading**: Interface carrega instantaneamente
4. **Cliente Único**: Apenas `user.tablename` disponível

#### Validação da Otimização

##### 1. Testes de Performance
- ✅ **Network Tab**: Apenas usuários autorizados fazem requisição
- ✅ **Loading Times**: Usuários restritos carregam instantaneamente
- ✅ **Memory Usage**: Menos uso de memória para usuários restritos
- ✅ **CPU Usage**: Processamento otimizado

##### 2. Testes de Funcionalidade
- ✅ **Usuário Admin**: Vê lista completa do CSV
- ✅ **Usuário Restrito**: Vê apenas seu cliente
- ✅ **Loading States**: Feedback visual correto
- ✅ **Error Handling**: Tratamento de erros adequado

##### 3. Testes de Segurança
- ✅ **Isolamento de Dados**: Usuários não veem dados não autorizados
- ✅ **Controle de Interface**: UI adaptada ao nível de acesso
- ✅ **Validação Backend**: Recomendado para segurança adicional

### Eliminação de Listas Hardcoded

#### Objetivo
Remover completamente todas as listas hardcoded de clientes do código, deixando apenas o CSV como fonte única de dados.

#### Mudanças Implementadas

##### 1. Hook useClientList
```typescript
// Antes: Fallback para lista hardcoded
catch (err) {
  const fallbackClients = [
    '3dfila', 'gringa', 'orthocrin', 'meurodape', 'coffeemais',
    // ... lista completa hardcoded
  ]
  setClients(fallbackClients)
}

// Depois: Sem fallback hardcoded
catch (err) {
  setClients([]) // Retorna array vazio em caso de erro
  setError(err instanceof Error ? err.message : 'Erro ao buscar lista de clientes')
}
```

##### 2. TableSelector
```typescript
// Antes: Fallback para 'coffeemais'
if (!useCSV) {
  return availableTables.length > 0 ? availableTables : ['coffeemais']
}

// Depois: Sem fallback hardcoded
if (!useCSV) {
  return availableTables.length > 0 ? availableTables : []
}
```

##### 3. Dashboard
```typescript
// Antes: Fallback para 'coffeemais'
const [selectedTable, setSelectedTable] = useState<string>(user?.tablename || 'coffeemais')

// Depois: Sem fallback hardcoded
const [selectedTable, setSelectedTable] = useState<string>(user?.tablename || '')

// Antes: Título com nomes hardcoded
`Dashboard ${selectedTable === 'coffeemais' ? 'CoffeeMais' : selectedTable === 'constance' ? 'Constance' : ...} | MyMetricHUB`

// Depois: Título simples
`Dashboard ${selectedTable} | MyMetricHUB`
```

##### 4. Componente ClientSelector
- **Removido**: Componente `ClientSelector.tsx` com lista hardcoded completa
- **Motivo**: Não estava sendo usado, substituído pelo `TableSelector`

#### Benefícios da Eliminação

##### 1. Manutenibilidade
- ✅ **Fonte Única**: Apenas o CSV precisa ser atualizado
- ✅ **Sem Duplicação**: Eliminação de listas duplicadas no código
- ✅ **Consistência**: Mesma lista em todos os ambientes
- ✅ **Simplicidade**: Código mais limpo e organizado

##### 2. Flexibilidade
- ✅ **Atualizações Dinâmicas**: Lista pode ser modificada sem código
- ✅ **Sem Deploy**: Mudanças refletem automaticamente
- ✅ **Versionamento**: Controle de versão via Google Sheets
- ✅ **Escalabilidade**: Fácil adição/remoção de clientes

##### 3. Segurança
- ✅ **Controle Centralizado**: Apenas CSV autorizado como fonte
- ✅ **Sem Vazamentos**: Não há dados hardcoded no código
- ✅ **Auditoria**: Rastreamento de mudanças via Google Sheets
- ✅ **Isolamento**: Dados isolados da aplicação

#### Fluxo de Funcionamento Atualizado

##### 1. Carregamento Normal
1. **CSV Disponível**: Lista carregada do Google Sheets
2. **Interface Atualizada**: Clientes disponíveis no dropdown
3. **Busca Funcional**: Filtro em tempo real
4. **Seleção Ativa**: Mudança de cliente funciona

##### 2. Erro no CSV
1. **CSV Indisponível**: Erro na requisição
2. **Array Vazio**: `clients = []`
3. **Interface Vazia**: Dropdown sem opções
4. **Mensagem de Erro**: "Erro ao carregar clientes"

##### 3. Usuários Restritos
1. **Hook Não Executa**: `useClientList(false)`
2. **Cliente Único**: Apenas `user.tablename`
3. **Interface Simplificada**: Dropdown com um cliente
4. **Sem CSV**: Não carrega lista completa

#### Validação da Eliminação

##### 1. Testes de Funcionalidade
- ✅ **CSV Funcionando**: Lista carregada corretamente
- ✅ **CSV com Erro**: Array vazio retornado
- ✅ **Usuários Restritos**: Apenas cliente específico
- ✅ **Usuários Admin**: Lista completa do CSV

##### 2. Testes de Performance
- ✅ **Carregamento Rápido**: Sem processamento de listas hardcoded
- ✅ **Menos Memória**: Não há arrays grandes no código
- ✅ **Menos Código**: Eliminação de listas desnecessárias
- ✅ **Cache Eficiente**: Hook otimizado

##### 3. Testes de Manutenção
- ✅ **Sem Deploy**: Mudanças no CSV refletem automaticamente
- ✅ **Versionamento**: Controle via Google Sheets
- ✅ **Backup**: Cópia de segurança do CSV
- ✅ **Rollback**: Fácil reversão de mudanças

#### Impacto da Mudança

##### 1. Positivo
- ✅ **Fonte Única**: Apenas CSV como fonte de dados
- ✅ **Manutenção Simplificada**: Atualizações via Google Sheets
- ✅ **Código Limpo**: Eliminação de listas hardcoded
- ✅ **Flexibilidade**: Mudanças sem deploy

##### 2. Considerações
- ⚠️ **Dependência Externa**: Sistema depende do CSV estar disponível
- ⚠️ **Tratamento de Erros**: Interface vazia em caso de erro
- ⚠️ **Backup Necessário**: Manter cópia de segurança do CSV
- ⚠️ **Validação**: Verificar formato e dados do CSV

## Sistema de Métricas Avançadas

### Visão Geral
O sistema implementa métricas avançadas que fornecem insights detalhados sobre o desempenho dos clusters de tráfego, incluindo análises específicas de perda de conversão.

### Métricas Principais

#### 1. Métricas Básicas
- **Sessões**: Total de sessões no período
- **Pedidos Pagos**: Total de pedidos pagos
- **Receita Paga**: Receita total paga
- **Ticket Médio**: Valor médio por pedido

#### 2. Métricas de Conversão
- **Taxa de Conversão**: Percentual de sessões que geraram pedidos
- **Taxa de Adição ao Carrinho**: Percentual de sessões com adições ao carrinho
- **Receita por Sessão**: Valor médio gerado por sessão
- **Taxa de Novos Clientes**: Percentual de pedidos de novos clientes

#### 3. Métricas Específicas de Cluster
- **🍪 Perda de Cookies**: Percentual de vendas no cluster "Perda de Cookies" em relação ao total

### Implementação do Percentual de Perda de Cookies

#### 1. Cálculo da Métrica
```typescript
// Calcular percentual de vendas do cluster "🍪 Perda de Cookies"
const cookieLossCluster = clusterTotals.find(cluster => cluster.cluster === '🍪 Perda de Cookies')
const cookieLossPercentage = totals.pedidos > 0 && cookieLossCluster 
  ? (cookieLossCluster.totals.pedidos / totals.pedidos) * 100 
  : 0
```

#### 2. Exibição no Dashboard
```typescript
<MetricCard
  title="🍪 Perda de Cookies"
  value={cookieLossPercentage}
  icon={Cookie}
  format="percentage"
  color="orange"
/>
```

#### 3. Posicionamento
- **Localização**: Segunda linha de métricas no topo da visão geral
- **Ícone**: Cookie (🍪) para representar o cluster
- **Formato**: Percentual com duas casas decimais
- **Cor**: Laranja para destacar a métrica

### Benefícios da Implementação

#### 1. Visibilidade
- ✅ **Alerta Ultra Discreto**: Tamanho mínimo e visual sutil
- ✅ **Design Minimalista**: Apenas elementos essenciais
- ✅ **Layout Limpo**: Sem ícones desnecessários
- ✅ **Mensagem Única**: Tudo em uma linha horizontal
- ✅ **Espaço Mínimo**: Ocupa o menor espaço possível
- ✅ **Tooltip Customizado**: Hover com CSS puro e animação suave
- ✅ **Botão Fechar**: Permite esconder o alerta temporariamente
- ✅ **Threshold Inteligente**: Só aparece quando >= 5% (requer atenção)

#### 2. Análise de Performance
- ✅ **Monitoramento Contínuo**: Acompanhamento em tempo real
- ✅ **Níveis de Severidade**: Classificação automática por percentual
- ✅ **Identificação de Problemas**: Detecção imediata de perdas de conversão
- ✅ **Otimização**: Base para melhorias de performance

#### 3. Tomada de Decisão
- ✅ **Alertas Inteligentes**: Notificações baseadas em thresholds
- ✅ **Priorização**: Identificação de problemas críticos
- ✅ **Ações Corretivas**: Base para estratégias de melhoria
- ✅ **ROI**: Medição do impacto das otimizações

### Casos de Uso

#### 1. Monitoramento Diário
- **Objetivo**: Acompanhar status de perda de cookies
- **Ação**: Verificar alerta no topo do dashboard
- **Resultado**: Identificação rápida do nível de severidade

#### 2. Análise de Tendências
- **Objetivo**: Comparar níveis de alerta ao longo do tempo
- **Ação**: Observar mudanças nas cores e mensagens
- **Resultado**: Identificação de padrões e tendências

#### 3. Otimização de Performance
- **Objetivo**: Reduzir percentual de perda de cookies
- **Ação**: Implementar melhorias baseadas no nível de alerta
- **Resultado**: Mudança de alerta vermelho para amarelo/verde

#### 4. Relatórios Executivos
- **Objetivo**: Fornecer insights visuais para stakeholders
- **Ação**: Incluir status do alerta em relatórios
- **Resultado**: Decisões baseadas em indicadores visuais

#### 5. Gestão de Crises
- **Objetivo**: Responder rapidamente a problemas críticos
- **Ação**: Alerta vermelho dispara ações imediatas
- **Resultado**: Redução do tempo de resposta a problemas

### Validação da Implementação

#### 1. Testes de Funcionalidade
- ✅ **Cálculo Correto**: Percentual calculado adequadamente
- ✅ **Exibição Visual**: Alerta aparece no local correto
- ✅ **Níveis de Severidade**: Cores e mensagens corretas por percentual
- ✅ **Design Limpo**: Sem ícones desnecessários
- ✅ **Design Ultra Discreto**: Tamanho mínimo e estilo sutil
- ✅ **Tooltip Funcional**: Hover mostra mensagem informativa
- ✅ **Botão Fechar**: Permite esconder o alerta temporariamente
- ✅ **Threshold Mínimo**: Só aparece quando >= 5% (requer atenção)

#### 2. Testes de Performance
- ✅ **Carregamento Rápido**: Cálculo não impacta performance
- ✅ **Atualização Dinâmica**: Alerta atualiza com filtros
- ✅ **Responsividade**: Funciona em diferentes dispositivos
- ✅ **Cache Eficiente**: Não recalcula desnecessariamente
- ✅ **Renderização Mínima**: Elementos visuais ultra simples

#### 3. Testes de Usabilidade
- ✅ **Posicionamento Intuitivo**: Fácil localização no topo
- ✅ **Compreensão Clara**: Cores e mensagens são autoexplicativas
- ✅ **Consistência Visual**: Segue padrão de design do sistema
- ✅ **Acessibilidade**: Legível em diferentes resoluções
- ✅ **Design Ultra Discreto**: Interferência mínima na experiência

#### 4. Testes de Thresholds
- ✅ **< 5%**: Alerta não aparece (nível aceitável)
- ✅ **5-10%**: Alerta amarelo com status "Moderado"
- ✅ **> 10%**: Alerta vermelho com status "Preocupante"
- ✅ **0%**: Alerta não aparece (sem dados)
- ✅ **Cálculo Preciso**: Percentual correto baseado em dados reais

## Atalhos de Teclado

### Command + K - Busca de Clientes
O sistema implementa um atalho de teclado para acesso rápido à busca de clientes.

#### 1. Funcionalidade
- **Atalho**: Command + K (Mac) / Ctrl + K (Windows/Linux)
- **Ação**: Abre o dropdown de clientes e foca no campo de busca
- **Escopo**: Funciona em qualquer lugar da aplicação
- **Feedback**: Tooltip no botão mostra o atalho

#### 2. Implementação Técnica
```typescript
// Hook para detectar atalho global
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault()
      
      // Abrir dropdown se não estiver aberto
      if (!isOpen) {
        setIsOpen(true)
      }
      
      // Focar no campo de busca
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
}, [isOpen])
```

#### 3. Experiência do Usuário
- **Acesso Rápido**: Atalho de teclado para busca
- **Comportamento Intuitivo**: Abre e foca automaticamente
- **Cross-platform**: Funciona em diferentes sistemas operacionais
- **Dica Visual**: Tooltip mostra o atalho no botão
- **Responsivo**: Funciona em todos os dispositivos

#### 4. Benefícios
- **Produtividade**: Acesso rápido sem usar mouse
- **Acessibilidade**: Suporte para usuários que preferem teclado
- **UX Moderna**: Padrão comum em aplicações web
- **Eficiência**: Reduz tempo para trocar de cliente

## Períodos Padrão do Dashboard

### Configuração de Períodos

#### 1. Visão Geral
- **Período Padrão**: Últimos 7 dias
- **Cálculo Dinâmico**: Baseado na data atual
- **Atualização Automática**: Sempre reflete os últimos 7 dias
- **URL Params**: Podem sobrescrever o padrão

#### 2. Funil de Conversão
- **Período Padrão**: Últimos 30 dias
- **Cálculo Dinâmico**: Baseado na data atual
- **Análise Mais Ampliada**: Para melhor visualização do funil
- **URL Params**: Podem sobrescrever o padrão

#### 3. Implementação Técnica
```typescript
// Função para calcular datas dos últimos 7 dias
const getLast7Days = () => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 7)
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  }
}

// Estados iniciais com últimos 7 dias
const [startDate, setStartDate] = useState<string>(() => {
  const last7Days = getLast7Days()
  return last7Days.start
})
const [endDate, setEndDate] = useState<string>(() => {
  const last7Days = getLast7Days()
  return last7Days.end
})
```

#### 4. Lógica de Carregamento
- **URL Params**: Prioridade máxima quando presentes
- **Fallback**: Últimos 7 dias quando não há parâmetros
- **Atualização**: Sempre reflete período atual
- **Consistência**: Mesmo período em todas as abas

#### 5. Benefícios
- **Relevância**: Sempre mostra dados recentes
- **Consistência**: Padrão uniforme em toda aplicação
- **Flexibilidade**: URL params permitem personalização
- **Usabilidade**: Períodos intuitivos para análise

## Sistema de URL Params

### Funcionalidades

#### 1. Parâmetros Sincronizados
- ✅ **Nome do Cliente**: `table` - Cliente selecionado
- ✅ **Datas**: `startDate` e `endDate` - Período selecionado
- ✅ **Aba Ativa**: `tab` - Aba atual (visao-geral, funil-conversao)
- ✅ **Cluster**: `cluster` - Cluster selecionado
- ✅ **Sincronização Automática**: URL atualiza automaticamente
- ✅ **Carregamento Inicial**: Estados carregados da URL

#### 2. Hook useUrlParams
```typescript
interface UrlParams {
  table?: string
  startDate?: string
  endDate?: string
  tab?: string
  cluster?: string
}

export const useUrlParams = () => {
  // Função para obter parâmetros da URL
  const getUrlParams = useCallback((): UrlParams => {
    const urlParams = new URLSearchParams(window.location.search)
    return {
      table: urlParams.get('table') || undefined,
      startDate: urlParams.get('startDate') || undefined,
      endDate: urlParams.get('endDate') || undefined,
      tab: urlParams.get('tab') || undefined,
      cluster: urlParams.get('cluster') || undefined
    }
  }, [])

  // Função para atualizar parâmetros da URL
  const updateUrlParams = useCallback((params: Partial<UrlParams>) => {
    const url = new URL(window.location.href)
    const searchParams = url.searchParams

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value)
      } else {
        searchParams.delete(key)
      }
    })

    window.history.replaceState({}, '', url.toString())
  }, [])

  // Função para copiar URL para clipboard
  const copyShareableUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      return true
    } catch (error) {
      console.error('Erro ao copiar URL:', error)
      return false
    }
  }, [])

  return {
    getUrlParams,
    updateUrlParams,
    copyShareableUrl
  }
}
```

#### 3. Integração no Dashboard
```typescript
const Dashboard = ({ onLogout, user }: { onLogout: () => void; user?: User }) => {
  const { getUrlParams, updateUrlParams } = useUrlParams()
  
  // Função para calcular datas dos últimos 7 dias
  const getLast7Days = () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 7)
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  }
  
  // Estados iniciais com últimos 7 dias
  const [startDate, setStartDate] = useState<string>(() => {
    const last7Days = getLast7Days()
    return last7Days.start
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const last7Days = getLast7Days()
    return last7Days.end
  })
  
  // Carregar parâmetros da URL na inicialização
  useEffect(() => {
    const urlParams = getUrlParams()
    const last7Days = getLast7Days()
    
    // Aplicar parâmetros da URL aos estados
    if (urlParams.table) {
      setSelectedTable(urlParams.table)
    }
    if (urlParams.startDate) {
      setStartDate(urlParams.startDate)
    } else {
      setStartDate(last7Days.start)
    }
    if (urlParams.endDate) {
      setEndDate(urlParams.endDate)
    } else {
      setEndDate(last7Days.end)
    }
    if (urlParams.tab) {
      setActiveTab(urlParams.tab)
    }
    if (urlParams.cluster) {
      setSelectedCluster(urlParams.cluster)
    }
  }, [getUrlParams])

  // Sincronizar mudanças de estado com a URL
  useEffect(() => {
    updateUrlParams({
      table: selectedTable,
      startDate,
      endDate,
      tab: activeTab,
      cluster: selectedCluster
    })
  }, [selectedTable, startDate, endDate, activeTab, selectedCluster, updateUrlParams])
}
```

#### 4. Períodos Padrão
- **Visão Geral**: Últimos 7 dias (padrão)
- **Funil de Conversão**: Últimos 30 dias (padrão)
- **URL Params**: Sobrescrevem padrões quando presentes
- **Fallback**: Últimos 7 dias quando não há parâmetros na URL

#### 5. Botão de Compartilhamento
- **Removido**: Botão de compartilhar não está mais disponível
- **URLs Ainda Funcionais**: URLs ainda podem ser copiadas manualmente
- **Sincronização Mantida**: Parâmetros ainda são sincronizados com a URL
- **Navegação Preservada**: Browser back/forward ainda funcionam

#### 6. Exemplo de URL
```
https://app.mymetric.com.br/?table=gringa&startDate=2025-07-27&endDate=2025-08-03&tab=visao-geral&cluster=Todos
```

#### 7. Benefícios
- **Compartilhamento Manual**: URLs podem ser copiadas manualmente do browser
- **Bookmarks**: Usuários podem salvar URLs específicas
- **Navegação**: Browser back/forward funciona corretamente
- **Estado Persistente**: Filtros mantidos ao recarregar página
- **Colaboração**: Equipes podem compartilhar visões específicas manualmente

## Sistema de Clientes Dinâmicos

### Visão Geral
O sistema agora utiliza exclusivamente uma fonte de dados externa (CSV do Google Sheets) para gerenciar a lista de clientes, eliminando a necessidade de listas hardcoded no código.

### Fonte de Dados

#### 1. CSV Remoto
```typescript
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQNqKWaGX0EUBtFGSaMnHoHJSoLKFqjPrjydOtcSexU3xVGyoEnhgKQh8A6-6_hOOQ0CfmV-IfoC8d/pub?gid=771281747&single=true&output=csv'
```

**Estrutura do CSV:**
```csv
slug
gringa
constance
coffeemais
universomaschio
oculosshop
evoke
hotbuttered
use
wtennis
...
```

#### 2. Hook Personalizado (useClientList)
```typescript
interface UseClientListReturn {
  clients: string[]
  isLoading: boolean
  error: string | null
}

export const useClientList = (shouldFetch: boolean = true): UseClientListReturn => {
  const [clients, setClients] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(shouldFetch) // Iniciar loading apenas se deve fazer fetch
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Se não deve fazer fetch, retornar imediatamente
    if (!shouldFetch) {
      setIsLoading(false)
      return
    }

    const fetchClients = async () => {
      try {
        const response = await fetch(CSV_URL)
        const csvText = await response.text()
        
        // Parse CSV - Skip header, extract slugs
        const lines = csvText.split('\n')
        const clientList: string[] = []
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line && line !== 'slug') {
            const slug = line.split(',')[0]?.trim()
            if (slug) {
              clientList.push(slug)
            }
          }
        }
        
        setClients(clientList)
      } catch (err) {
        // Em caso de erro, retornar array vazio em vez de lista hardcoded
        setClients([])
        setError(err instanceof Error ? err.message : 'Erro ao buscar lista de clientes')
      } finally {
        setIsLoading(false)
      }
    }

    fetchClients()
  }, [shouldFetch]) // Adicionar shouldFetch como dependência

  return { clients, isLoading, error }
}
```

**Funcionalidades:**
- **Fetch Condicional**: Carrega dados apenas quando `shouldFetch` é `true`
- **Parse CSV**: Extrai slugs da primeira coluna
- **Tratamento de Erros**: Retorna array vazio em caso de erro
- **Loading States**: Indicadores de carregamento condicionais
- **Performance**: Evita requisições desnecessárias
- **Sem Fallbacks**: Não há listas hardcoded no código

### Fluxo de Funcionamento

#### 1. Carregamento Inicial
1. **Componente Monta**: `TableSelector` é renderizado
2. **Hook Executa**: `useClientList` inicia o fetch do CSV
3. **Dados Carregados**: Lista de clientes disponível
4. **Interface Atualizada**: Dropdown populado com clientes

#### 2. Atalho Command + K
```typescript
// Atalho Command + K para focar na busca
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Verificar se é Command + K (Mac) ou Ctrl + K (Windows/Linux)
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault()
      
      // Abrir dropdown se não estiver aberto
      if (!isOpen) {
        setIsOpen(true)
      }
      
      // Focar no campo de busca após um pequeno delay
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
}, [isOpen])
```

**Funcionalidades do Atalho:**
- **Cross-platform**: Funciona em Mac (⌘) e Windows/Linux (Ctrl)
- **Auto-abertura**: Abre dropdown se fechado
- **Auto-foco**: Foca automaticamente no campo de busca
- **Prevent Default**: Evita comportamento padrão do navegador
- **Cleanup**: Remove listener ao desmontar componente
- **Dica Visual**: Tooltip mostra "Selecionar cliente (⌘K para buscar)"

#### 3. Busca e Filtragem

**Loading:**
```typescript
{isLoading ? (
  <div className="flex items-center gap-2">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span>Carregando clientes...</span>
  </div>
) : (
  // Lista de clientes
)}
```

**Error:**
```typescript
{error ? (
  <div className="text-red-500 text-center">
    Erro ao carregar clientes
  </div>
) : (
  // Lista de clientes ou fallback
)}
```

**Success:**
```typescript
{filteredTables.map((table) => (
  <button key={table}>
    <div className="font-medium">{table}</div>
  </button>
))}
```

### Benefícios da Implementação

#### 1. Manutenibilidade
- ✅ **Fonte Única**: Apenas o CSV precisa ser atualizado
- ✅ **Sem Deploy**: Mudanças na lista não requerem nova versão
- ✅ **Consistência**: Mesma lista em todos os ambientes
- ✅ **Simplicidade**: Código mais limpo e organizado

#### 2. Flexibilidade
- ✅ **Atualizações Dinâmicas**: Lista pode ser modificada sem código
- ✅ **Controle de Acesso**: Integração com sistema de permissões
- ✅ **Fallback Robusto**: Sistema continua funcionando mesmo com erro
- ✅ **Performance**: Cache automático do hook

#### 3. Experiência do Usuário
- ✅ **Loading States**: Feedback visual durante carregamento
- ✅ **Error Handling**: Tratamento gracioso de erros
- ✅ **Busca em Tempo Real**: Filtro dinâmico por nome
- ✅ **Interface Responsiva**: Adaptação a diferentes tamanhos

### Casos de Uso

#### 1. Adicionar Novo Cliente
1. **Editar CSV**: Adicionar nova linha com slug
2. **Salvar**: Mudanças refletem automaticamente
3. **Testar**: Verificar se aparece na interface
4. **Validar**: Confirmar funcionamento

#### 2. Remover Cliente
1. **Editar CSV**: Remover linha do cliente
2. **Salvar**: Cliente desaparece da lista
3. **Verificar**: Confirmar que não aparece mais
4. **Limpar**: Remover dados relacionados se necessário

#### 3. Manutenção do Sistema
1. **Backup CSV**: Manter cópia de segurança
2. **Validação**: Verificar formato e dados
3. **Testes**: Validar funcionamento após mudanças
4. **Documentação**: Atualizar documentação se necessário

### Monitoramento e Debug

#### 1. Console Logs
```typescript
console.log('🔄 Fetching client list from CSV...')
console.log('✅ CSV received:', csvText.substring(0, 200) + '...')
console.log('📋 Parsed clients:', clientList)
console.error('❌ Error fetching client list:', err)
```

#### 2. Estados de Debug
- **Loading**: `isLoading = true`
- **Success**: `clients.length > 0`
- **Error**: `error !== null`
- **Fallback**: `clients.length === 0 && availableTables.length === 0`

#### 3. Validação de Dados
- **Formato CSV**: Verificar estrutura
- **Slugs Válidos**: Confirmar que não estão vazios
- **Duplicatas**: Verificar se não há slugs repetidos
- **Caracteres Especiais**: Validar encoding

## Controle de Acesso de Usuários

### Visão Geral
O sistema implementa controle de acesso baseado no campo `access_control` do usuário, determinando quais funcionalidades e dados estão disponíveis para cada tipo de usuário.

### Tipos de Acesso

#### 1. Acesso Total (`access_control: 'all'` OU `tablename: 'all'`)
**Funcionalidades Disponíveis:**
- ✅ **Lista Completa de Clientes**: Dropdown com todas as empresas
- ✅ **Navegação Livre**: Acesso a qualquer cliente do sistema
- ✅ **Compartilhamento**: URLs com qualquer cliente
- ✅ **Análises Comparativas**: Comparação entre diferentes clientes

**Comportamento:**
```typescript
availableTables = user?.access_control === 'all' || user?.tablename === 'all'
  ? [lista_completa_de_clientes]
  : [user?.tablename || '']
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
const availableTables = user?.access_control === 'all' || user?.tablename === 'all'
  ? [] // Vazio para usar apenas o CSV via useClientList
  : [user?.tablename || '']

// Controle de uso do CSV baseado no nível de acesso
const useCSV = user?.access_control === 'all' || user?.tablename === 'all' // Usar CSV para usuários com acesso total

// useClientList hook - Carrega do CSV
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQNqKWaGX0EUBtFGSaMnHoHJSoLKFqjPrjydOtcSexU3xVGyoEnhgKQh8A6-6_hOOQ0CfmV-IfoC8d/pub?gid=771281747&single=true&output=csv'

// Cliente padrão selecionado
const defaultTable = user?.access_control === 'all' || user?.tablename === 'all'
  ? (params.table || user?.tablename || '')
  : (user?.tablename || '')
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
- **Acesso**: `access_control: 'all'` OU `tablename: 'all'`
- **Funcionalidades**: Lista completa, comparações, relatórios gerais
- **Uso**: Gestão geral, análises comparativas, suporte

#### 2. Analistas de Cliente
- **Acesso**: `access_control: 'specific'` E `tablename: 'specific_client'`
- **Funcionalidades**: Cliente específico, análises focadas
- **Uso**: Análises diárias, relatórios específicos, otimizações

#### 3. Consultores
- **Acesso**: `access_control: 'all'` OU `tablename: 'all'` OU `access_control: 'specific'`
- **Funcionalidades**: Depende do tipo de consultoria
- **Uso**: Análises comparativas ou focadas

### Fluxo de Funcionamento

1. **Login**: Sistema identifica nível de acesso do usuário
2. **Carregamento**: Interface adaptada ao `access_control`
3. **Navegação**: Opções limitadas conforme permissão
4. **Dados**: Apenas dados autorizados carregados
5. **Compartilhamento**: URLs respeitam restrições

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

### Implementação do Alerta de Perda de Cookies

#### 1. Cálculo da Métrica
```typescript
// Calcular percentual de vendas do cluster "🍪 Perda de Cookies"
const cookieLossCluster = clusterTotals.find(cluster => cluster.cluster === '🍪 Perda de Cookies')
const cookieLossPercentage = totals.pedidos > 0 && cookieLossCluster 
  ? (cookieLossCluster.totals.pedidos / totals.pedidos) * 100 
  : 0
```

#### 2. Sistema de Alertas
```typescript
{/* Cookie Loss Alert */}
{cookieLossPercentage >= 5 && (
  <div className="mb-3">
    <div className={`rounded-md border px-3 py-2 ${
      cookieLossPercentage < 10 
        ? 'bg-yellow-50 border-yellow-100' 
        : 'bg-red-50 border-red-100'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative group">
            <span 
              className={`text-xs font-medium cursor-help ${
                cookieLossPercentage < 10 
                  ? 'text-yellow-700' 
                  : 'text-red-700'
              }`}
            >
              🍪 Perda de Cookies: {cookieLossPercentage.toFixed(1)}% 
              {cookieLossPercentage < 10 
                ? ' (Moderado)'
                : ' (Preocupante)'
              }
            </span>
            
            {/* Custom Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              Converse com o time MyMetric para discutir formas de melhorar esse ponto
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setCookieLossPercentage(0)}
          className={`text-xs p-1 rounded hover:bg-opacity-20 transition-colors ${
            cookieLossPercentage < 10 
              ? 'text-yellow-500 hover:bg-yellow-500' 
              : 'text-red-500 hover:bg-red-500'
          }`}
          title="Fechar alerta"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
)}
```

#### 3. Níveis de Severidade
- **🟡 Moderado (5-10%)**: Amarelo discreto - Requer atenção
- **🔴 Preocupante (> 10%)**: Vermelho discreto - Requer ação imediata
- **🟢 Bom (< 5%)**: Não exibe alerta - Percentual em níveis aceitáveis

#### 4. Posicionamento
- **Localização**: Topo da página, após o MetricsCarousel
- **Visibilidade**: Aparece apenas quando há dados de perda de cookies >= 5%
- **Responsividade**: Funciona em desktop e mobile
- **Destaque**: Cores e ícones diferenciados por nível

#### 5. Design Ultra Discreto
- **Tamanho Mínimo**: Padding e margens reduzidos ao mínimo
- **Sem Sombras**: Apenas bordas sutis
- **Tipografia Muito Pequena**: Textos em `text-xs`
- **Layout Linear**: Tudo em uma linha horizontal
- **Mensagem Única**: Percentual e status em um só texto
- **Bordas Suaves**: `border-yellow-100` ou `border-red-100`
- **Tooltip Customizado**: Hover com CSS puro e animação suave
- **Botão Fechar**: Permite esconder o alerta temporariamente
- **Threshold Mínimo**: Só aparece quando >= 5%
- **Sem Ícone**: Design mais limpo sem ícone de cookie