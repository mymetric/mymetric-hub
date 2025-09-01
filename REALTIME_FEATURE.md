# Funcionalidade de Dados em Tempo Real

## Visão Geral
Esta documentação descreve a implementação da nova aba "Dados em Tempo Real" no dashboard MyMetricHUB, que permite visualizar eventos de usuários sendo capturados em tempo real.

## Arquivos Implementados/Modificados

### 1. Serviço de API (`src/services/api.ts`)
- **Novos Tipos Adicionados:**
  - `RealtimeDataRequest` - Interface para requisições de dados em tempo real
  - `RealtimeDataItem` - Interface para itens individuais de dados em tempo real
  - `RealtimeDataResponse` - Interface para resposta da API

- **Nova Função:**
  - `getRealtimeData()` - Busca dados em tempo real do endpoint `/metrics/realtime`

### 2. Tipos (`src/types/index.ts`)
- Adicionadas interfaces exportadas para dados em tempo real:
  - `RealtimeDataItem`
  - `RealtimeDataRequest` 
  - `RealtimeDataResponse`

### 3. Componente RealtimeData (`src/components/RealtimeData.tsx`)
- **Funcionalidades principais:**
  - Auto-refresh configurável (padrão: 30 segundos)
  - Exibição de métricas resumidas em tempo real
  - Lista de eventos com informações detalhadas
  - Formatação de timestamps e tempo relativo
  - Categorização visual de canais de tráfego
  - Interface responsiva para mobile e desktop

- **Métricas Exibidas:**
  - Total de eventos capturados
  - Eventos dos últimos 5 minutos
  - Sessões únicas ativas
  - Receita gerada

- **Informações por Evento:**
  - Timestamp do evento
  - Página visitada
  - Produto/item (se aplicável)
  - Receita gerada (se aplicável)
  - Canal de tráfego (source/medium)
  - Campanha (se disponível)
  - ID da sessão

### 4. Dashboard Principal (`src/components/Dashboard.tsx`)
- **Navegação:**
  - Adicionada nova aba "Tempo Real" na navegação desktop
  - Adicionada aba "Live" na navegação mobile horizontal
  - Adicionada opção "Tempo Real" no menu dropdown mobile

- **Conteúdo:**
  - Integração do componente `RealtimeData` na aba `tempo-real`

## Funcionalidades Implementadas

### Auto-Refresh
- **Intervalo:** 30 segundos (configurável)
- **Controles:** Botões para pausar/retomar e refresh manual
- **Estado Visual:** Indicador de status do auto-refresh

### Interface de Usuário
- **Design Responsivo:** Adaptado para mobile e desktop
- **Métricas em Cards:** Visualização rápida de KPIs
- **Lista de Eventos:** Stream ao vivo dos eventos mais recentes
- **Indicadores Visuais:** 
  - Ponto verde pulsante para eventos ao vivo
  - Cores diferenciadas por canal de tráfego
  - Timestamps formatados em português brasileiro

### Tratamento de Erros
- **Validação:** Verifica se a tabela selecionada é válida
- **Estados de Loading:** Indicadores de carregamento durante requisições
- **Mensagens de Erro:** Exibição amigável de erros com opção de retry

## Endpoint da API
- **URL:** `POST /metrics/realtime`
- **Parâmetros:**
  ```json
  {
    "table_name": "string"
  }
  ```
- **Resposta:**
  ```json
  {
    "data": [
      {
        "event_timestamp": "2025-08-30T13:57:46.273147",
        "session_id": "1756562266552181643.1754837651",
        "transaction_id": "",
        "item_category": "",
        "item_name": "",
        "quantity": 0,
        "item_revenue": 0.0,
        "source": "direct",
        "medium": "direct",
        "campaign": "(not set)",
        "content": "(not set)",
        "term": "(not set)",
        "page_location": "https://exemplo.com/pagina"
      }
    ]
  }
  ```

## Como Usar

1. **Acessar a Aba:** Clique em "Tempo Real" na navegação do dashboard
2. **Visualizar Métricas:** As métricas resumidas são exibidas no topo
3. **Monitorar Eventos:** A lista de eventos é atualizada automaticamente
4. **Controlar Refresh:** Use os botões para pausar/retomar ou atualizar manualmente
5. **Filtrar por Tabela:** Selecione diferentes tabelas usando o seletor no header

## Considerações Técnicas

### Performance
- Limitação de 50 eventos exibidos simultaneamente
- Auto-refresh pode ser desabilitado para economizar recursos
- Limpeza adequada de intervalos para evitar vazamentos de memória

### Responsividade
- Layout adaptativo para diferentes tamanhos de tela
- Navegação mobile otimizada
- Cards de métricas reorganizados em grid responsivo

### Acessibilidade
- Botões com estados visuais claros
- Indicadores de loading apropriados
- Mensagens de erro informativas

## Próximos Passos Sugeridos

1. **Filtragem Avançada:** Adicionar filtros por canal, produto, período
2. **Notificações:** Alertas para eventos específicos (alta receita, conversões)
3. **Exportação:** Possibilidade de exportar dados em tempo real
4. **Gráficos em Tempo Real:** Visualizações gráficas dos dados
5. **Configurações:** Personalização do intervalo de refresh
6. **Websockets:** Migração para comunicação em tempo real via websockets
