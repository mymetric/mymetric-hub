import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { 
  BarChart3,
  ShoppingBag,
  DollarSign,
  Coins,
  Users,
  Globe,
  Target,
  TrendingUp,
  CheckCircle,
  ShoppingCart,
  Loader2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  Settings
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface OverviewDataItem {
  add_to_carts: number
  city: string
  clicks: number
  cost: number
  country: string
  event_date: string
  leads: number
  new_customers: number
  orders: number
  paid_orders: number
  paid_revenue: number
  platform: string
  region: string
  revenue: number
  revenue_new_customers: number
  sessions: number
  traffic_category: string
}

interface OverviewDashboardProps {
  selectedTable: string // Identificador do cliente (usado para personalizações exclusivas por cliente)
  startDate: string
  endDate: string
}

// Todas as personalizações (dimensões, métricas, cards, timeline, filtros, ordem) são salvas no localStorage
// usando selectedTable como identificador único do cliente, garantindo que cada cliente tenha suas próprias configurações
const OverviewDashboard = ({ selectedTable, startDate, endDate }: OverviewDashboardProps) => {
  const [data, setData] = useState<OverviewDataItem[]>([])
  const [allData, setAllData] = useState<OverviewDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para job/polling
  const [jobId, setJobId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [jobStatus, setJobStatus] = useState<string>('idle') // idle, processing, completed, error
  const [jobProgress, setJobProgress] = useState<string>('')
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentPollingJobIdRef = useRef<string | null>(null)
  const isProcessingRef = useRef<boolean>(false)
  const hasStartedProcessingRef = useRef<string | null>(null)
  
  // Estado para limite de linhas
  const [rowLimit, setRowLimit] = useState<number | null>(10)
  
  // Estado para sidebar do seletor
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Estado para drag and drop dos cards
  const [draggedCard, setDraggedCard] = useState<string | null>(null)
  const [dragOverCard, setDragOverCard] = useState<string | null>(null)
  
  // Estado para métricas da timeline (máximo 2)
  // Personalização salva por cliente usando selectedTable como identificador
  const [timelineMetrics, setTimelineMetrics] = useState<string[]>(() => {
    const storageKey = `overview-timeline-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  
  // Salvar métricas da timeline no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-timeline-metrics-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify(timelineMetrics))
  }, [timelineMetrics, selectedTable])
  
  // Resetar métricas da timeline quando mudar de cliente
  useEffect(() => {
    const storageKey = `overview-timeline-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setTimelineMetrics(JSON.parse(saved))
      } catch {
        setTimelineMetrics([])
      }
    } else {
      setTimelineMetrics([])
    }
  }, [selectedTable])
  
  const toggleTimelineMetric = (metricKey: string) => {
    setTimelineMetrics(prev => {
      if (prev.includes(metricKey)) {
        return prev.filter(key => key !== metricKey)
      } else {
        // Máximo de 2 métricas
        if (prev.length >= 2) {
          return prev
        }
        return [...prev, metricKey]
      }
    })
  }
  
  
  // Função para obter o valor da métrica
  const getMetricValue = (metricKey: string): number => {
    if (metricKey === 'sessions') return totals.sessions
    if (metricKey === 'clicks') return totals.clicks
    if (metricKey === 'add_to_carts') return totals.add_to_carts
    if (metricKey === 'orders') return totals.orders
    if (metricKey === 'paid_orders') return totals.paid_orders
    if (metricKey === 'revenue') return totals.revenue
    if (metricKey === 'paid_revenue') return totals.paid_revenue
    if (metricKey === 'cost') return totals.cost
    if (metricKey === 'leads') return totals.leads
    if (metricKey === 'new_customers') return totals.new_customers
    if (metricKey === 'revenue_new_customers') return totals.revenue_new_customers
    if (metricKey === 'conversion_rate') return conversionRate
    if (metricKey === 'add_to_cart_rate') return addToCartRate
    if (metricKey === 'leads_conversion_rate') return leadsConversionRate
    if (metricKey === 'paid_conversion_rate') return paidConversionRate
    if (metricKey === 'revenue_per_session') return revenuePerSession
    if (metricKey === 'avg_order_value') return avgOrderValue
    if (metricKey === 'roas') return roas
    if (metricKey === 'new_customer_rate') return newCustomerRate
    return 0
  }
  
  // Função para obter o ícone da métrica
  const getMetricIcon = (metricKey: string) => {
    if (['sessions', 'leads'].includes(metricKey)) return Users
    if (['orders', 'paid_orders'].includes(metricKey)) return ShoppingBag
    if (['revenue', 'paid_revenue', 'revenue_new_customers', 'revenue_per_session', 'avg_order_value'].includes(metricKey)) return DollarSign
    if (['cost'].includes(metricKey)) return Coins
    if (['add_to_carts'].includes(metricKey)) return ShoppingCart
    if (['clicks'].includes(metricKey)) return Target
    if (['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'new_customer_rate'].includes(metricKey)) return TrendingUp
    if (['roas'].includes(metricKey)) return BarChart3
    return CheckCircle
  }
  
  // Estado para ordenação da tabela
  // Personalização salva por cliente usando selectedTable como identificador
  const [sortField, setSortField] = useState<string | null>(() => {
    const storageKey = `overview-sort-field-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    return saved || null
  })
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const storageKey = `overview-sort-direction-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    return (saved as 'asc' | 'desc') || 'desc'
  })
  
  // Salvar ordenação no localStorage quando mudar (por cliente)
  useEffect(() => {
    const fieldKey = `overview-sort-field-${selectedTable}` // Chave única por cliente
    const directionKey = `overview-sort-direction-${selectedTable}` // Chave única por cliente
    if (sortField) {
      localStorage.setItem(fieldKey, sortField)
    } else {
      localStorage.removeItem(fieldKey)
    }
    localStorage.setItem(directionKey, sortDirection)
  }, [sortField, sortDirection, selectedTable])
  
  // Resetar ordenação quando mudar de cliente
  useEffect(() => {
    const fieldKey = `overview-sort-field-${selectedTable}` // Chave única por cliente
    const directionKey = `overview-sort-direction-${selectedTable}` // Chave única por cliente
    const savedField = localStorage.getItem(fieldKey)
    const savedDirection = localStorage.getItem(directionKey)
    setSortField(savedField || null)
    setSortDirection((savedDirection as 'asc' | 'desc') || 'desc')
  }, [selectedTable])
  
  // Estado para filtros de dimensões (aplicados ao dashboard inteiro)
  // Personalização salva por cliente usando selectedTable como identificador
  const [dimensionFilters, setDimensionFilters] = useState<Record<string, Set<string>>>(() => {
    const storageKey = `overview-dimension-filters-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Converter arrays para Sets
        const result: Record<string, Set<string>> = {}
        for (const [key, value] of Object.entries(parsed)) {
          result[key] = new Set(value as string[])
        }
        return result
      } catch {
        return {}
      }
    }
    return {}
  })
  
  // Salvar filtros no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-dimension-filters-${selectedTable}` // Chave única por cliente
    // Converter Sets para arrays para JSON
    const serializable: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(dimensionFilters)) {
      serializable[key] = Array.from(value)
    }
    localStorage.setItem(storageKey, JSON.stringify(serializable))
  }, [dimensionFilters, selectedTable])
  
  // Resetar filtros quando mudar de cliente
  useEffect(() => {
    const storageKey = `overview-dimension-filters-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const result: Record<string, Set<string>> = {}
        for (const [key, value] of Object.entries(parsed)) {
          result[key] = new Set(value as string[])
        }
        setDimensionFilters(result)
      } catch {
        setDimensionFilters({})
      }
    } else {
      setDimensionFilters({})
    }
  }, [selectedTable])
  
  // Função para toggle de filtro de dimensão
  const toggleDimensionFilter = (dimensionKey: string, value: string) => {
    setDimensionFilters(prev => {
      const newFilters = { ...prev }
      if (!newFilters[dimensionKey]) {
        newFilters[dimensionKey] = new Set()
      }
      const newSet = new Set(newFilters[dimensionKey])
      if (newSet.has(value)) {
        newSet.delete(value)
      } else {
        newSet.add(value)
      }
      // Se o set ficou vazio, remover a chave
      if (newSet.size === 0) {
        delete newFilters[dimensionKey]
      } else {
        newFilters[dimensionKey] = newSet
      }
      return newFilters
    })
  }
  
  // Função para limpar filtros de uma dimensão
  const clearDimensionFilter = (dimensionKey: string) => {
    setDimensionFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[dimensionKey]
      return newFilters
    })
  }
  
  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    setDimensionFilters({})
  }
  
  // Dimensões e métricas disponíveis
  const dimensions = [
    { key: 'event_date', label: 'Data' },
    { key: 'platform', label: 'Plataforma' },
    { key: 'traffic_category', label: 'Categoria de Tráfego' },
    { key: 'city', label: 'Cidade' },
    { key: 'region', label: 'Região' },
    { key: 'country', label: 'País' }
  ]
  
  const metrics = [
    { key: 'sessions', label: 'Sessões', type: 'number' },
    { key: 'clicks', label: 'Cliques', type: 'number' },
    { key: 'add_to_carts', label: 'Adições ao Carrinho', type: 'number' },
    { key: 'orders', label: 'Pedidos', type: 'number' },
    { key: 'paid_orders', label: 'Pedidos Pagos', type: 'number' },
    { key: 'revenue', label: 'Receita', type: 'currency' },
    { key: 'paid_revenue', label: 'Receita Paga', type: 'currency' },
    { key: 'cost', label: 'Investimento', type: 'currency' },
    { key: 'leads', label: 'Leads', type: 'number' },
    { key: 'new_customers', label: 'Novos Clientes', type: 'number' },
    { key: 'revenue_new_customers', label: 'Receita Novos Clientes', type: 'currency' },
    // Métricas calculadas
    { key: 'conversion_rate', label: 'Taxa de Conversão Geral', type: 'percentage' },
    { key: 'add_to_cart_rate', label: 'Taxa de Adição ao Carrinho', type: 'percentage' },
    { key: 'leads_conversion_rate', label: 'Taxa de Conversão de Leads', type: 'percentage' },
    { key: 'paid_conversion_rate', label: 'Taxa de Pagamento', type: 'percentage' },
    { key: 'revenue_per_session', label: 'Receita por Sessão', type: 'currency' },
    { key: 'avg_order_value', label: 'Ticket Médio', type: 'currency' },
    { key: 'roas', label: 'ROAS', type: 'number' },
    { key: 'new_customer_rate', label: 'Taxa de Novos Clientes', type: 'percentage' }
  ]
  
  // Estado para métricas de cards (baseado nas métricas)
  // Personalização salva por cliente usando selectedTable como identificador
  const [cardMetrics, setCardMetrics] = useState<string[]>(() => {
    const storageKey = `overview-card-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  
  // Estado para ordem dos cards (drag and drop)
  // Personalização salva por cliente usando selectedTable como identificador
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const storageKey = `overview-card-order-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  
  // Salvar ordem dos cards no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-card-order-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify(cardOrder))
  }, [cardOrder, selectedTable])
  
  // Sincronizar cardOrder com cardMetrics quando cardMetrics mudar
  useEffect(() => {
    setCardOrder(prevOrder => {
      // Filtrar ordem atual para incluir apenas métricas que ainda estão em cardMetrics
      const validOrder = prevOrder.filter(key => cardMetrics.includes(key))
      // Adicionar novas métricas que não estão na ordem no final
      const missingMetrics = cardMetrics.filter(key => !validOrder.includes(key))
      return [...validOrder, ...missingMetrics]
    })
  }, [cardMetrics])
  
  // Função para lidar com drag start
  const handleDragStart = (e: React.DragEvent, cardKey: string) => {
    setDraggedCard(cardKey)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cardKey)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }
  
  // Função para lidar com drag over
  const handleDragOver = (e: React.DragEvent, cardKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (cardKey !== draggedCard) {
      setDragOverCard(cardKey)
    }
  }
  
  // Função para lidar com drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCard(null)
  }
  
  // Função para lidar com drag end
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedCard(null)
    setDragOverCard(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }
  
  // Função para lidar com drop
  const handleDrop = (e: React.DragEvent, dropCardKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    const dragCardKey = draggedCard || e.dataTransfer.getData('text/plain')
    
    if (!dragCardKey || dragCardKey === dropCardKey) {
      setDraggedCard(null)
      setDragOverCard(null)
      return
    }
    
    setCardOrder(prevOrder => {
      // Filtrar apenas os cards que estão em cardMetrics para manter a ordem correta
      const filteredOrder = prevOrder.filter(key => cardMetrics.includes(key))
      const dragIndex = filteredOrder.indexOf(dragCardKey)
      const dropIndex = filteredOrder.indexOf(dropCardKey)
      
      if (dragIndex === -1 || dropIndex === -1) {
        setDraggedCard(null)
        setDragOverCard(null)
        return prevOrder
      }
      
      const newOrder = [...filteredOrder]
      newOrder.splice(dragIndex, 1)
      newOrder.splice(dropIndex, 0, dragCardKey)
      
      setDraggedCard(null)
      setDragOverCard(null)
      return newOrder
    })
  }
  
  // Salvar métricas de cards no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-card-metrics-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify(cardMetrics))
  }, [cardMetrics, selectedTable])
  
  // Resetar métricas de cards quando mudar de cliente
  useEffect(() => {
    const storageKey = `overview-card-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setCardMetrics(JSON.parse(saved))
      } catch {
        setCardMetrics([])
      }
    } else {
      setCardMetrics([])
    }
    
    // Resetar ordem dos cards quando mudar de tabela
    const orderKey = `overview-card-order-${selectedTable}` // Chave única por cliente
    const savedOrder = localStorage.getItem(orderKey)
    if (savedOrder) {
      try {
        setCardOrder(JSON.parse(savedOrder))
      } catch {
        setCardOrder([])
      }
    } else {
      setCardOrder([])
    }
  }, [selectedTable])
  
  const toggleCardMetric = (metricKey: string) => {
    setCardMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    )
  }
  
  const toggleAllCardMetrics = () => {
    if (cardMetrics.length === metrics.length) {
      setCardMetrics([])
    } else {
      setCardMetrics(metrics.map(m => m.key))
    }
  }
  
  const toggleAllTableMetrics = () => {
    if (selectedMetrics.length === metrics.length) {
      setSelectedMetrics([])
    } else {
      setSelectedMetrics(metrics.map(m => m.key))
    }
  }
  
  // Carregar seleções do localStorage baseado no cliente (selectedTable é o identificador do cliente)
  const getInitialSelections = useCallback(() => {
    const storageKey = `overview-selections-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return { dimensions: [], metrics: [] }
      }
    }
    // Padrão: selecionar apenas métricas diretas (não calculadas)
    // Nota: tacos foi removido da lista pois só aparece no card, não na tabela
    const calculatedMetrics = ['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'revenue_per_session', 'avg_order_value', 'roas', 'new_customer_rate']
    const directMetrics = metrics.filter(m => !calculatedMetrics.includes(m.key))
    return {
      dimensions: dimensions.map(d => d.key),
      metrics: directMetrics.map(m => m.key)
    }
  }, [selectedTable, dimensions, metrics])
  
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(() => getInitialSelections().dimensions)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => getInitialSelections().metrics)
  
  // Salvar seleções no localStorage quando mudarem (por cliente)
  useEffect(() => {
    const storageKey = `overview-selections-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify({
      dimensions: selectedDimensions,
      metrics: selectedMetrics
    }))
  }, [selectedDimensions, selectedMetrics, selectedTable])
  
  // Resetar seleções quando mudar o cliente
  useEffect(() => {
    const selections = getInitialSelections()
    setSelectedDimensions(selections.dimensions)
    setSelectedMetrics(selections.metrics)
  }, [getInitialSelections])
  
  // Funções para toggle de seleção
  const toggleDimension = (key: string) => {
    setSelectedDimensions(prev => 
      prev.includes(key) 
        ? prev.filter(d => d !== key)
        : [...prev, key]
    )
  }
  
  const toggleMetric = (key: string) => {
    setSelectedMetrics(prev =>
      prev.includes(key)
        ? prev.filter(m => m !== key)
        : [...prev, key]
    )
  }
  
  const toggleAllDimensions = () => {
    if (selectedDimensions.length === dimensions.length) {
      setSelectedDimensions([])
    } else {
      setSelectedDimensions(dimensions.map(d => d.key))
    }
  }
  

  // Função para obter o token da API 2.0
  const getV2Token = (): string | null => {
    try {
      const authV2Response = localStorage.getItem('mymetric-auth-v2-response')
      if (authV2Response) {
        const parsed = JSON.parse(authV2Response)
        return parsed.token || null
      }
    } catch (error) {
      console.error('Error getting V2 token:', error)
    }
    return null
  }

  // Função para filtrar dados por data
  const filterDataByDateRange = (allDataItems: OverviewDataItem[], start: string, end: string) => {
    if (!start || !end) {
      setData(allDataItems)
      return
    }

    const startDateObj = new Date(start)
    const endDateObj = new Date(end)
    
    const filtered = allDataItems.filter(item => {
      const itemDate = new Date(item.event_date)
      return itemDate >= startDateObj && itemDate <= endDateObj
    })

    setData(filtered)
  }

  // Função para buscar dados com retry
  const fetchDataWithRetry = useCallback(async (token: string, currentJobId: string, maxRetries = 10, retryDelay = 3000) => {
    console.log('📥 Iniciando busca de dados de overview para job:', currentJobId)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dataResponse = await api.getOverviewData(token, currentJobId)
        console.log('✅ Data fetched successfully:', {
          jobId: currentJobId,
          count: dataResponse?.count,
          dataLength: dataResponse?.data?.length,
          attempt
        })
        
        if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
          // Verificar se o jobId ainda é o mesmo antes de atualizar os dados
          if (currentPollingJobIdRef.current && currentPollingJobIdRef.current !== currentJobId) {
            console.log('⚠️ Job ID mudou durante busca de dados, ignorando dados antigos')
            return
          }
          
          // Armazenar todos os dados
          setAllData(dataResponse.data)
          
          // Filtrar por data se necessário (startDate e endDate)
          if (startDate && endDate) {
            const startDateObj = new Date(startDate)
            const endDateObj = new Date(endDate)
            
            const filtered = dataResponse.data.filter((item: OverviewDataItem) => {
              const itemDate = new Date(item.event_date)
              return itemDate >= startDateObj && itemDate <= endDateObj
            })
            
            setData(filtered)
            console.log('📅 Dados filtrados por data:', { 
              total: dataResponse.data.length, 
              filtered: filtered.length,
              startDate,
              endDate
            })
          } else {
            setData(dataResponse.data)
            console.log('📊 Dados carregados sem filtro de data:', dataResponse.data.length)
          }
          
          setJobStatus('completed')
          setJobProgress(`Dados carregados: ${dataResponse.count || dataResponse.data.length} registros`)
          setIsLoading(false)
          setIsPolling(false)
          console.log('✅ Overview data loaded successfully, data length:', dataResponse.data.length)
          return
        }
      } catch (error: any) {
        console.error(`❌ Error fetching overview data (attempt ${attempt}/${maxRetries}):`, error)
        
        // Se for erro retryable (404), tentar novamente
        if (error.isRetryable && attempt < maxRetries) {
          console.log(`⏳ Aguardando ${retryDelay}ms antes de tentar novamente...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        // Se não for retryable ou excedeu tentativas, lançar erro
        if (attempt === maxRetries) {
          setJobStatus('error')
          setError('Erro ao buscar dados. Tente novamente.')
          setIsLoading(false)
          setIsPolling(false)
          throw error
        }
      }
    }
  }, [startDate, endDate])

  // Função para fazer polling do status
  const startPolling = useCallback((currentJobId: string, token: string) => {
    // Parar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setIsPolling(true)
    setJobStatus('processing')
    currentPollingJobIdRef.current = currentJobId
    console.log('🔄 Iniciando polling para job:', currentJobId)

    const poll = async () => {
      // Verificar se o jobId ainda é o mesmo
      if (currentPollingJobIdRef.current !== currentJobId) {
        console.log('⚠️ Job ID mudou durante polling, parando polling antigo')
        setIsPolling(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        return
      }
      
      try {
        const statusResponse = await api.getOverviewJobStatus(token, currentJobId)
        console.log('📊 Job Status Response:', { 
          jobId: currentJobId, 
          status: statusResponse.status, 
          progress: statusResponse.progress,
          elapsed: statusResponse.elapsed_seconds 
        })
        
        // Verificar novamente se o jobId ainda é o mesmo
        if (currentPollingJobIdRef.current !== currentJobId) {
          console.log('⚠️ Job ID mudou durante processamento da resposta, ignorando')
          return
        }
        
        // Atualizar elapsed_seconds se disponível
        if (statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null) {
          setElapsedSeconds(statusResponse.elapsed_seconds)
        }
        
        // Formatar progresso com tempo decorrido
        const progressText = statusResponse.progress || 'Processando...'
        const elapsedText = statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null
          ? ` (${Math.round(statusResponse.elapsed_seconds)}s)`
          : ''
        setJobProgress(`${progressText}${elapsedText}`)

        if (statusResponse.status === 'completed') {
          // Job concluído, buscar dados
          console.log('✅ Job concluído, buscando dados para job:', currentJobId)
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          setJobProgress('Processamento concluído, baixando dados...')
          await fetchDataWithRetry(token, currentJobId)
        } else if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
          // Job falhou
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setJobStatus('error')
          setIsLoading(false)
          setError('Erro ao processar dados. Tente novamente.')
        }
        // Se ainda está processando, continua o polling
      } catch (error) {
        console.error('Error polling status:', error)
        // Não para o polling em caso de erro temporário
      }
    }

    // Executar primeira verificação imediatamente
    poll()
    
    // Configurar polling principal a cada 3 segundos
    pollingIntervalRef.current = setInterval(poll, 3000)
    console.log('⏰ Polling configurado para verificar a cada 3 segundos')
  }, [fetchDataWithRetry])

  // Função para iniciar o processamento
  const startProcessing = useCallback(async () => {
    // Proteção contra múltiplas execuções simultâneas
    if (isProcessingRef.current) {
      console.log('⚠️ Processamento já em andamento, ignorando chamada duplicada')
      return
    }
    
    // Verificar se o selectedTable ainda é o mesmo que iniciou o processamento
    if (hasStartedProcessingRef.current !== selectedTable) {
      console.log('⚠️ selectedTable mudou, cancelando processamento')
      return
    }

    // Marcar imediatamente para evitar race condition
    isProcessingRef.current = true

    const token = getV2Token()
    if (!token) {
      setJobStatus('error')
      setIsLoading(false)
      setError('Token de autenticação não encontrado')
      isProcessingRef.current = false
      return
    }

    if (!validateTableName(selectedTable)) {
      setJobStatus('error')
      setIsLoading(false)
      setError('Tabela inválida')
      isProcessingRef.current = false
      return
    }

    // Limpar dados e estado antes de iniciar novo processamento
    console.log('🔄 Iniciando novo processamento de overview para:', selectedTable)
    
    // Parar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setIsLoading(true)
    setJobStatus('processing')
    setJobProgress('Iniciando processamento...')
    setElapsedSeconds(null)
    setError(null)
    setData([])
    setAllData([])

    try {
      // Criar job
      const jobResponse = await api.createOverviewJob(token, selectedTable)
      console.log('📦 Job criado:', jobResponse)
      
      const newJobId = jobResponse.id || jobResponse.job_id || jobResponse.request_id
      if (!newJobId) {
        throw new Error('Job ID não encontrado na resposta')
      }
      
      setJobId(newJobId)
      hasStartedProcessingRef.current = selectedTable
      currentPollingJobIdRef.current = newJobId
      
      // Iniciar polling
      startPolling(newJobId, token)
      isProcessingRef.current = false
    } catch (error) {
      console.error('❌ Erro ao criar job:', error)
      setJobStatus('error')
      setIsLoading(false)
      setError(error instanceof Error ? error.message : 'Erro ao iniciar processamento')
      isProcessingRef.current = false
    }
  }, [selectedTable, startPolling])

  // Iniciar processamento quando selectedTable mudar
  useEffect(() => {
    if (!selectedTable) return
    
    hasStartedProcessingRef.current = selectedTable
    startProcessing()

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      isProcessingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable])

  // Filtrar dados quando startDate ou endDate mudarem (se já houver dados)
  useEffect(() => {
    if (allData.length > 0 && startDate && endDate) {
      filterDataByDateRange(allData, startDate, endDate)
    }
  }, [startDate, endDate, allData])
  
  // Aplicar filtros de dimensões aos dados
  const filteredData = useMemo(() => {
    if (Object.keys(dimensionFilters).length === 0) {
      return data
    }
    
    return data.filter(item => {
      // Verificar se o item passa por todos os filtros
      for (const [dimensionKey, filterValues] of Object.entries(dimensionFilters)) {
        const itemValue = String(item[dimensionKey as keyof OverviewDataItem] || '')
        if (!filterValues.has(itemValue)) {
          return false
        }
      }
      return true
    })
  }, [data, dimensionFilters])

  // Preparar dados para timeline usando dados filtrados
  const timelineData = useMemo(() => {
    if (!filteredData || filteredData.length === 0 || timelineMetrics.length === 0) return []
    
    // Agrupar dados por data
    const groupedByDate = filteredData.reduce((acc, item) => {
      const date = item.event_date
      if (!acc[date]) {
        acc[date] = {
          date,
          sessions: 0,
          clicks: 0,
          add_to_carts: 0,
          orders: 0,
          paid_orders: 0,
          revenue: 0,
          paid_revenue: 0,
          cost: 0,
          leads: 0,
          new_customers: 0,
          revenue_new_customers: 0,
          conversion_rate: 0,
          add_to_cart_rate: 0,
          leads_conversion_rate: 0,
          paid_conversion_rate: 0,
          revenue_per_session: 0,
          avg_order_value: 0,
          roas: 0,
          new_customer_rate: 0
        }
      }
      acc[date].sessions += item.sessions || 0
      acc[date].clicks += item.clicks || 0
      acc[date].add_to_carts += item.add_to_carts || 0
      acc[date].orders += item.orders || 0
      acc[date].paid_orders += item.paid_orders || 0
      acc[date].revenue += item.revenue || 0
      acc[date].paid_revenue += item.paid_revenue || 0
      acc[date].cost += item.cost || 0
      acc[date].leads += item.leads || 0
      acc[date].new_customers += item.new_customers || 0
      acc[date].revenue_new_customers += item.revenue_new_customers || 0
      return acc
    }, {} as Record<string, any>)
    
    // Calcular métricas derivadas para cada data
    return Object.values(groupedByDate)
      .map(item => {
        const sessions = item.sessions || 0
        const orders = item.orders || 0
        const paid_orders = item.paid_orders || 0
        const revenue = item.revenue || 0
        const paid_revenue = item.paid_revenue || 0
        const cost = item.cost || 0
        const add_to_carts = item.add_to_carts || 0
        const leads = item.leads || 0
        const new_customers = item.new_customers || 0
        
        return {
          ...item,
          conversion_rate: orders > 0 && sessions > 0 ? (orders / sessions) * 100 : 0,
          add_to_cart_rate: add_to_carts > 0 && sessions > 0 ? (add_to_carts / sessions) * 100 : 0,
          leads_conversion_rate: leads > 0 && sessions > 0 ? (leads / sessions) * 100 : 0,
          paid_conversion_rate: paid_orders > 0 && orders > 0 ? (paid_orders / orders) * 100 : 0,
          revenue_per_session: revenue > 0 && sessions > 0 ? revenue / sessions : 0,
          avg_order_value: revenue > 0 && orders > 0 ? revenue / orders : 0,
          roas: cost > 0 ? revenue / cost : 0,
          new_customer_rate: new_customers > 0 && orders > 0 ? (new_customers / orders) * 100 : 0
        }
      })
      .sort((a, b) => {
        const [yearA, monthA, dayA] = a.date.split('-').map(Number)
        const [yearB, monthB, dayB] = b.date.split('-').map(Number)
        const dateA = new Date(yearA, monthA - 1, dayA)
        const dateB = new Date(yearB, monthB - 1, dayB)
        return dateA.getTime() - dateB.getTime()
      })
  }, [filteredData, timelineMetrics])

  // Calcular totais agregados usando filteredData para estar consistente com filtros
  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => {
      acc.add_to_carts += item.add_to_carts || 0
      acc.clicks += item.clicks || 0
      acc.cost += item.cost || 0
      acc.leads += item.leads || 0
      acc.new_customers += item.new_customers || 0
      acc.orders += item.orders || 0
      acc.paid_orders += item.paid_orders || 0
      acc.paid_revenue += item.paid_revenue || 0
      acc.revenue += item.revenue || 0
      acc.revenue_new_customers += item.revenue_new_customers || 0
      acc.sessions += item.sessions || 0
      return acc
    }, {
      add_to_carts: 0,
      clicks: 0,
      cost: 0,
      leads: 0,
      new_customers: 0,
      orders: 0,
      paid_orders: 0,
      paid_revenue: 0,
      revenue: 0,
      revenue_new_customers: 0,
      sessions: 0
    })
  }, [filteredData])
  
  // Debug: log dos dados
  useEffect(() => {
    console.log('📊 Estado dos dados:', {
      dataLength: data.length,
      allDataLength: allData.length,
      filteredDataLength: filteredData.length,
      cardMetricsCount: cardMetrics.length,
      selectedDimensionsCount: selectedDimensions.length,
      selectedMetricsCount: selectedMetrics.length,
      jobStatus,
      isLoading,
      isPolling
    })
  }, [data.length, allData.length, filteredData.length, cardMetrics.length, selectedDimensions.length, selectedMetrics.length, jobStatus, isLoading, isPolling])

  // Calcular métricas derivadas
  const conversionRate = totals.sessions > 0 ? (totals.orders / totals.sessions) * 100 : 0
  const paidConversionRate = totals.orders > 0 ? (totals.paid_orders / totals.orders) * 100 : 0
  const addToCartRate = totals.sessions > 0 ? (totals.add_to_carts / totals.sessions) * 100 : 0
  const revenuePerSession = totals.sessions > 0 ? totals.revenue / totals.sessions : 0
  const avgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0
  const tacos = totals.revenue > 0 ? (totals.cost / totals.revenue) * 100 : 0
  const roas = totals.cost > 0 ? totals.revenue / totals.cost : 0
  const leadsConversionRate = totals.sessions > 0 ? (totals.leads / totals.sessions) * 100 : 0
  const newCustomerRate = totals.orders > 0 ? (totals.new_customers / totals.orders) * 100 : 0

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    format = 'number',
    color = 'blue' 
  }: {
    title: string
    value: number
    icon: any
    format?: 'number' | 'currency' | 'percentage'
    color?: string
  }) => {
    const formatValue = () => {
      switch (format) {
        case 'currency':
          return formatCurrency(value)
        case 'percentage':
          return `${value.toFixed(2)}%`
        default:
          return formatNumber(value)
      }
    }

    const colorClasses = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
      red: 'bg-red-100 text-red-600',
      gray: 'bg-gray-100 text-gray-600'
    }

    return (
      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-900">{formatValue()}</p>
      </div>
    )
  }

  // Se estiver processando, mostrar indicador inline no topo
  const isProcessing = isLoading || isPolling || jobStatus === 'processing'

  if (error || jobStatus === 'error') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Erro: {error || 'Erro ao processar dados'}</p>
          <button
            onClick={() => startProcessing()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header com botão de personalizar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Removido indicador do header para evitar duplicação - apenas no indicador grande abaixo */}
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors shadow-sm"
        >
          <Settings className="w-4 h-4" />
          Personalizar Dashboard
        </button>
      </div>

      {/* Indicador de processamento quando não há dados ainda */}
      {isProcessing && data.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="text-blue-800 font-medium">{jobProgress || 'Processando dados...'}</p>
              {elapsedSeconds !== null && (
                <p className="text-blue-600 text-sm mt-1">Tempo decorrido: {Math.round(elapsedSeconds)}s</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Indicador de Filtros Ativos */}
      {Object.keys(dimensionFilters).length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-blue-900">Filtros ativos:</span>
              {Object.entries(dimensionFilters).map(([dimKey, values]) => {
                const dimension = dimensions.find(d => d.key === dimKey)
                return (
                  <div key={dimKey} className="flex items-center gap-1">
                    <span className="text-xs font-medium text-blue-700">{dimension?.label}:</span>
                    {Array.from(values).map((value, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {value}
                        <button
                          onClick={() => toggleDimensionFilter(dimKey, value)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => clearDimensionFilter(dimKey)}
                      className="text-xs text-blue-600 hover:text-blue-800 ml-1"
                    >
                      Limpar
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              onClick={clearAllFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpar Todos
            </button>
          </div>
        </div>
      )}

      {/* Mensagem quando há dados mas nenhuma seleção para exibir */}
      {filteredData.length > 0 && cardMetrics.length === 0 && selectedDimensions.length === 0 && selectedMetrics.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            Dados carregados ({filteredData.length} registros), mas nenhuma métrica ou dimensão selecionada. 
            Use o botão "Personalizar Dashboard" para selecionar o que deseja visualizar.
          </p>
        </div>
      )}

      {/* Cards de Métricas */}
      {cardMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {cardOrder.filter(key => cardMetrics.includes(key)).map((cardKey, index) => {
            const metric = metrics.find(m => m.key === cardKey)
            if (!metric) return null
            
            const value = getMetricValue(cardKey)
            const Icon = getMetricIcon(cardKey)
            const color = 'blue' // Cor padrão, pode ser personalizada
            
            let format: 'number' | 'currency' | 'percentage' = 'number'
            if (metric.type === 'currency') {
              format = 'currency'
            } else if (metric.type === 'percentage') {
              format = 'percentage'
            }
            
            // Estado para drag and drop
            const isDragging = draggedCard === cardKey
            const isDragOver = dragOverCard === cardKey
            
            // Tratamento especial para ROAS
            if (cardKey === 'roas') {
              return (
                <div 
                  key={cardKey}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cardKey)}
                  onDragOver={(e) => handleDragOver(e, cardKey)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, cardKey)}
                  className={`bg-white rounded-xl shadow-lg p-4 border transition-all cursor-move ${
                    isDragging 
                      ? 'opacity-50 border-blue-300' 
                      : isDragOver 
                        ? 'border-blue-500 border-2 shadow-xl scale-105' 
                        : 'border-gray-100 hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-1">{metric.label}</h3>
                  <p className="text-2xl font-bold text-gray-900">{value.toFixed(3)}x</p>
                </div>
              )
            }
            
            return (
              <div
                key={cardKey}
                draggable
                onDragStart={(e) => handleDragStart(e, cardKey)}
                onDragOver={(e) => handleDragOver(e, cardKey)}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, cardKey)}
                className={`cursor-move transition-all ${
                  isDragging 
                    ? 'opacity-50' 
                    : isDragOver 
                      ? 'transform scale-105' 
                      : ''
                }`}
              >
                <MetricCard
                  title={metric.label}
                  value={value}
                  icon={Icon}
                  format={format}
                  color={color}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      {timelineMetrics.length > 0 && timelineData.length > 0 && (
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Timeline de Métricas</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={timelineData}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    // value já está no formato YYYY-MM-DD
                    const parts = value.split('-')
                    if (parts.length === 3) {
                      return `${parts[2]}/${parts[1]}`
                    }
                    return value
                  }}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    return new Intl.NumberFormat('pt-BR', { 
                      maximumFractionDigits: 0,
                      minimumFractionDigits: 0 
                    }).format(Math.round(value))
                  }}
                  label={{ 
                    value: timelineMetrics[0] ? metrics.find(m => m.key === timelineMetrics[0])?.label : '', 
                    angle: -90, 
                    position: 'insideLeft', 
                    offset: 10,
                    style: { fill: '#3b82f6', fontWeight: 'bold' }
                  }}
                  width={80}
                />
                {timelineMetrics.length === 2 && (
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      return new Intl.NumberFormat('pt-BR', { 
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0 
                      }).format(Math.round(value))
                    }}
                    label={{ 
                      value: timelineMetrics[1] ? metrics.find(m => m.key === timelineMetrics[1])?.label : '', 
                      angle: 90, 
                      position: 'insideRight', 
                      offset: 10,
                      style: { fill: '#10b981', fontWeight: 'bold' }
                    }}
                    width={80}
                  />
                )}
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    const metric = metrics.find(m => m.key === name)
                    if (!metric) {
                      // Se não encontrar métrica, arredondar e formatar
                      return new Intl.NumberFormat('pt-BR', { 
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0 
                      }).format(Math.round(value || 0))
                    }
                    if (metric.type === 'currency') {
                      return formatCurrency(value)
                    } else if (metric.type === 'percentage') {
                      // Arredondar porcentagem sem decimais
                      return `${Math.round(value)}%`
                    } else if (name === 'roas') {
                      return value.toFixed(3) + 'x'
                    }
                    // Para todas as outras métricas, arredondar e formatar com separador de milhar, sem decimais
                    const roundedValue = Math.round(value || 0)
                    return new Intl.NumberFormat('pt-BR', { 
                      maximumFractionDigits: 0,
                      minimumFractionDigits: 0 
                    }).format(roundedValue)
                  }}
                  labelFormatter={(label) => {
                    // label já está no formato YYYY-MM-DD
                    const parts = label.split('-')
                    if (parts.length === 3) {
                      return `${parts[2]}/${parts[1]}/${parts[0]}`
                    }
                    return label
                  }}
                />
                {timelineMetrics.map((metricKey, index) => {
                  const metric = metrics.find(m => m.key === metricKey)
                  if (!metric) return null
                  
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                  const color = colors[index % colors.length]
                  const yAxisId = index === 0 ? 'left' : 'right'
                  
                  return (
                    <Line
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      name={metric.label}
                      stroke={color}
                      strokeWidth={3}
                      dot={false}
                      yAxisId={yAxisId}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-6 relative">
          {/* Sidebar */}
          <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="h-full flex flex-col">
              {/* Header da Sidebar */}
              <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Personalizar Dashboard
                </h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                  aria-label="Fechar sidebar"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              
              {/* Conteúdo da Sidebar */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Dimensões */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">Dimensões</h3>
                      <button
                        onClick={toggleAllDimensions}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {selectedDimensions.length === dimensions.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {dimensions.map(dimension => {
                        const isSelected = selectedDimensions.includes(dimension.key)
                        return (
                          <label
                            key={dimension.key}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm text-gray-700 flex-1">{dimension.label}</span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDimension(dimension.key)}
                              className="sr-only"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Métricas */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">Métricas</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleAllTableMetrics}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {selectedMetrics.length === metrics.length ? 'Tabela: Todas' : 'Tabela: Nenhuma'}
                        </button>
                        <span className="text-xs text-gray-400">|</span>
                        <button
                          onClick={toggleAllCardMetrics}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {cardMetrics.length === metrics.length ? 'Card: Todas' : 'Card: Nenhuma'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {metrics.map(metric => {
                        const isInTable = selectedMetrics.includes(metric.key)
                        const isInCard = cardMetrics.includes(metric.key)
                        const isInTimeline = timelineMetrics.includes(metric.key)
                        return (
                          <div
                            key={metric.key}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-50"
                          >
                            <span className="text-sm text-gray-700 flex-1">{metric.label}</span>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isInTable}
                                  onChange={() => toggleMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-600">Tabela</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isInCard}
                                  onChange={() => toggleCardMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-600">Card</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isInTimeline}
                                  onChange={() => toggleTimelineMetric(metric.key)}
                                  disabled={!isInTimeline && timelineMetrics.length >= 2}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className="text-xs text-gray-600">Timeline</span>
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {timelineMetrics.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 italic">
                        Timeline: {timelineMetrics.map(key => metrics.find(m => m.key === key)?.label).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Overlay quando sidebar está aberta */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          
          {/* Tabela - mostrar mensagem se não houver seleções */}
          {selectedDimensions.length === 0 || selectedMetrics.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-center">
                {selectedDimensions.length === 0 && selectedMetrics.length === 0 
                  ? 'Selecione dimensões e métricas no painel de personalização para visualizar os dados na tabela.'
                  : selectedDimensions.length === 0
                  ? 'Selecione pelo menos uma dimensão no painel de personalização.'
                  : 'Selecione pelo menos uma métrica no painel de personalização.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Dados Agrupados</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Agrupados por {selectedDimensions.map(d => dimensions.find(dim => dim.key === d)?.label).filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="row-limit-select" className="text-sm text-gray-600">
                      Limite de linhas:
                    </label>
                    <select
                      id="row-limit-select"
                      value={rowLimit === null ? 'all' : String(rowLimit)}
                      onChange={(e) => {
                        const value = e.target.value
                        setRowLimit(value === 'all' ? null : parseInt(value, 10))
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:ring-2 focus:border-blue-500 bg-white"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="500">500</option>
                      <option value="all">Todas</option>
                    </select>
                  </div>
                </div>
              </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {selectedDimensions.map(dimKey => {
                    const dimension = dimensions.find(d => d.key === dimKey)
                    if (!dimension) return null
                    const isSorted = sortField === dimKey
                    return (
                      <th
                        key={dimKey}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === dimKey) {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField(dimKey)
                            setSortDirection('asc')
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {dimension.label}
                          {isSorted && (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                    )
                  })}
                  {selectedMetrics.map(metKey => {
                    const metric = metrics.find(m => m.key === metKey)
                    if (!metric) return null
                    const isSorted = sortField === metKey
                    return (
                      <th
                        key={metKey}
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === metKey) {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField(metKey)
                            setSortDirection('desc')
                          }
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {metric.label}
                          {isSorted && (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  // Agrupar dados pelas dimensões selecionadas (usando dados filtrados)
                  const groupedData = filteredData.reduce((acc, item) => {
                    // Criar chave única baseada nas dimensões selecionadas
                    const groupKey = selectedDimensions.map(dimKey => 
                      String(item[dimKey as keyof OverviewDataItem] || '-')
                    ).join('|')
                    
                    if (!acc[groupKey]) {
                      // Inicializar o grupo com os valores das dimensões e zerar as métricas
                      acc[groupKey] = {
                        dimensions: selectedDimensions.reduce((dims, dimKey) => {
                          dims[dimKey] = item[dimKey as keyof OverviewDataItem]
                          return dims
                        }, {} as Record<string, any>),
                        // Inicializar todas as métricas base sempre, além das selecionadas
                        metrics: (() => {
                          const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers']
                          const allMetricsToInit = [...new Set([...baseMetrics, ...selectedMetrics])]
                          return allMetricsToInit.reduce((mets, metKey) => {
                            mets[metKey] = 0
                            return mets
                          }, {} as Record<string, number>)
                        })()
                      }
                    }
                    
                    // Sempre somar todas as métricas base (necessárias para calcular as derivadas)
                    // Lista de métricas base que sempre devem ser somadas
                    const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers']
                    baseMetrics.forEach(metKey => {
                      const value = item[metKey as keyof OverviewDataItem] as number || 0
                      acc[groupKey].metrics[metKey] = (acc[groupKey].metrics[metKey] || 0) + value
                    })
                    
                    return acc
                  }, {} as Record<string, { dimensions: Record<string, any>, metrics: Record<string, number> }>)
                  
                  // Converter para array
                  let groupedArray = Object.values(groupedData)
                  
                  // Calcular métricas derivadas para cada grupo
                  groupedArray = groupedArray.map(group => {
                    const calcMetrics = { ...group.metrics }
                    const sessions = group.metrics.sessions || 0
                    const orders = group.metrics.orders || 0
                    const paid_orders = group.metrics.paid_orders || 0
                    const revenue = group.metrics.revenue || 0
                    const paid_revenue = group.metrics.paid_revenue || 0
                    const cost = group.metrics.cost || 0
                    const add_to_carts = group.metrics.add_to_carts || 0
                    const leads = group.metrics.leads || 0
                    const new_customers = group.metrics.new_customers || 0
                    
                    // Taxa de Conversão Geral
                    if (selectedMetrics.includes('conversion_rate')) {
                      calcMetrics.conversion_rate = sessions > 0 ? (orders / sessions) * 100 : 0
                    }
                    
                    // Taxa de Adição ao Carrinho
                    if (selectedMetrics.includes('add_to_cart_rate')) {
                      calcMetrics.add_to_cart_rate = sessions > 0 ? (add_to_carts / sessions) * 100 : 0
                    }
                    
                    // Taxa de Conversão de Leads
                    if (selectedMetrics.includes('leads_conversion_rate')) {
                      calcMetrics.leads_conversion_rate = sessions > 0 ? (leads / sessions) * 100 : 0
                    }
                    
                    // Taxa de Conversão Paga
                    if (selectedMetrics.includes('paid_conversion_rate')) {
                      calcMetrics.paid_conversion_rate = orders > 0 ? (paid_orders / orders) * 100 : 0
                    }
                    
                    // Receita por Sessão
                    if (selectedMetrics.includes('revenue_per_session')) {
                      calcMetrics.revenue_per_session = sessions > 0 ? revenue / sessions : 0
                    }
                    
                    // Ticket Médio
                    if (selectedMetrics.includes('avg_order_value')) {
                      calcMetrics.avg_order_value = orders > 0 ? revenue / orders : 0
                    }
                    
                    // ROAS
                    if (selectedMetrics.includes('roas')) {
                      calcMetrics.roas = cost > 0 ? revenue / cost : 0
                    }
                    
                    // Taxa de Novos Clientes
                    if (selectedMetrics.includes('new_customer_rate')) {
                      calcMetrics.new_customer_rate = orders > 0 ? (new_customers / orders) * 100 : 0
                    }
                    
                    return {
                      ...group,
                      metrics: calcMetrics
                    }
                  })
                  
                  // Aplicar ordenação se houver campo selecionado
                  if (sortField) {
                    groupedArray = groupedArray.sort((a, b) => {
                      let aValue: any
                      let bValue: any
                      
                      // Verificar se é uma dimensão ou métrica
                      if (selectedDimensions.includes(sortField)) {
                        aValue = a.dimensions[sortField]
                        bValue = b.dimensions[sortField]
                      } else if (selectedMetrics.includes(sortField)) {
                        aValue = a.metrics[sortField] || 0
                        bValue = b.metrics[sortField] || 0
                      } else {
                        return 0
                      }
                      
                      // Para métricas, sempre tratar como número
                      if (selectedMetrics.includes(sortField)) {
                        const aNum = typeof aValue === 'number' ? aValue : parseFloat(String(aValue)) || 0
                        const bNum = typeof bValue === 'number' ? bValue : parseFloat(String(bValue)) || 0
                        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
                      }
                      
                      // Para dimensões, comparar como string
                      const aStr = String(aValue || '').toLowerCase()
                      const bStr = String(bValue || '').toLowerCase()
                      
                      if (sortDirection === 'asc') {
                        return aStr.localeCompare(bStr)
                      } else {
                        return bStr.localeCompare(aStr)
                      }
                    })
                  }
                  
                  // Aplicar limite de linhas se especificado
                  const displayData = rowLimit === null ? groupedArray : groupedArray.slice(0, rowLimit)
                  
                  return (
                    <>
                      {displayData.map((group, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {selectedDimensions.map(dimKey => {
                            const value = group.dimensions[dimKey]
                            const stringValue = String(value || '-')
                            const isFiltered = dimensionFilters[dimKey]?.has(stringValue)
                            return (
                              <td 
                                key={dimKey} 
                                className={`px-6 py-4 whitespace-nowrap text-sm cursor-pointer ${
                                  isFiltered 
                                    ? 'bg-blue-100 text-blue-800 font-medium' 
                                    : 'text-gray-900 hover:bg-gray-100'
                                }`}
                                onClick={() => toggleDimensionFilter(dimKey, stringValue)}
                                title={isFiltered ? 'Clique para remover filtro' : 'Clique para filtrar por este valor'}
                              >
                                {stringValue}
                              </td>
                            )
                          })}
                          {selectedMetrics.map(metKey => {
                            const value = group.metrics[metKey] || 0
                            const metric = metrics.find(m => m.key === metKey)
                            const metricType = metric?.type || 'number'
                            
                            let displayValue: string
                            if (metricType === 'currency') {
                              displayValue = formatCurrency(value)
                            } else if (metricType === 'percentage') {
                              displayValue = `${value.toFixed(2)}%`
                            } else if (metKey === 'roas') {
                              displayValue = value.toFixed(3) + 'x'
                            } else {
                              displayValue = formatNumber(value)
                            }
                            
                            return (
                              <td key={metKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {displayValue}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {rowLimit !== null && groupedArray.length > rowLimit && (
                        <tr>
                          <td 
                            colSpan={selectedDimensions.length + selectedMetrics.length}
                            className="px-6 py-4 text-center text-sm text-gray-500"
                          >
                            Mostrando {rowLimit} de {formatNumber(groupedArray.length)} grupos
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })()}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default OverviewDashboard
