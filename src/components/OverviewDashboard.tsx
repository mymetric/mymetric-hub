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
  Settings,
  Save,
  Trash2,
  FolderOpen,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  GripVertical
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'

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
  // Novas métricas
  paid_new_annual_orders?: number
  paid_new_annual_revenue?: number
  paid_new_montly_orders?: number
  paid_new_montly_revenue?: number
  paid_recurring_annual_orders?: number
  paid_recurring_annual_revenue?: number
  paid_recurring_montly_orders?: number
  paid_recurring_montly_revenue?: number
}

interface OverviewDashboardProps {
  selectedTable: string // Identificador do cliente (usado para personalizações exclusivas por cliente)
  startDate: string
  endDate: string
}

interface DashboardPreset {
  id: string
  name: string
  selectedDimensions: string[]
  selectedMetrics: string[]
  cardMetrics: string[]
  timelineMetrics: string[]
  cardOrder: string[]
  sortField: string | null
  sortDirection: 'asc' | 'desc'
  createdAt: string
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
  
  // Estado para busca de métricas na sidebar
  const [metricSearchTerm, setMetricSearchTerm] = useState('')
  
  // Estado para presets
  const [presets, setPresets] = useState<DashboardPreset[]>(() => {
    const storageKey = `overview-presets-${selectedTable}`
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
  const [presetName, setPresetName] = useState('')
  const [showPresetInput, setShowPresetInput] = useState(false)
  
  // Estados para goals e run rate
  const [goals, setGoals] = useState<any>(null)
  const [isLoadingGoals, setIsLoadingGoals] = useState(false)
  const [currentMonthData, setCurrentMonthData] = useState<any>(null)
  const [isLoadingCurrentMonth, setIsLoadingCurrentMonth] = useState(false)
  
  // Estados para comparação com período anterior
  const [previousTotals, setPreviousTotals] = useState({
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
    paid_new_annual_orders: 0,
    paid_new_annual_revenue: 0,
    paid_new_montly_orders: 0,
    paid_new_montly_revenue: 0,
    paid_recurring_annual_orders: 0,
    paid_recurring_annual_revenue: 0,
    paid_recurring_montly_orders: 0,
    paid_recurring_montly_revenue: 0
  })
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  
  // Estados para modal de meta
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [goalFormData, setGoalFormData] = useState({
    month: '',
    goal_value: ''
  })
  
  // Estado para drag and drop dos cards
  const [draggedCard, setDraggedCard] = useState<string | null>(null)
  const [dragOverCard, setDragOverCard] = useState<string | null>(null)
  const isDraggingRef = useRef(false)
  const dragOverCardRef = useRef<string | null>(null)
  
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
    // Novas métricas
    if (metricKey === 'paid_new_annual_orders') return totals.paid_new_annual_orders || 0
    if (metricKey === 'paid_new_annual_revenue') return totals.paid_new_annual_revenue || 0
    if (metricKey === 'paid_new_montly_orders') return totals.paid_new_montly_orders || 0
    if (metricKey === 'paid_new_montly_revenue') return totals.paid_new_montly_revenue || 0
    if (metricKey === 'paid_recurring_annual_orders') return totals.paid_recurring_annual_orders || 0
    if (metricKey === 'paid_recurring_annual_revenue') return totals.paid_recurring_annual_revenue || 0
    if (metricKey === 'paid_recurring_montly_orders') return totals.paid_recurring_montly_orders || 0
    if (metricKey === 'paid_recurring_montly_revenue') return totals.paid_recurring_montly_revenue || 0
    return 0
  }
  
  // Função para obter o ícone da métrica
  const getMetricIcon = (metricKey: string) => {
    if (['sessions', 'leads'].includes(metricKey)) return Users
    if (['orders', 'paid_orders', 'paid_new_annual_orders', 'paid_new_montly_orders', 'paid_recurring_annual_orders', 'paid_recurring_montly_orders'].includes(metricKey)) return ShoppingBag
    if (['revenue', 'paid_revenue', 'revenue_new_customers', 'revenue_per_session', 'avg_order_value', 'paid_new_annual_revenue', 'paid_new_montly_revenue', 'paid_recurring_annual_revenue', 'paid_recurring_montly_revenue'].includes(metricKey)) return DollarSign
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
    { key: 'new_customer_rate', label: 'Taxa de Novos Clientes', type: 'percentage' },
    // Novas métricas de assinaturas pagas
    { key: 'paid_new_annual_orders', label: 'Pedidos Novos Anuais Pagos', type: 'number' },
    { key: 'paid_new_annual_revenue', label: 'Receita Novos Anuais Pagos', type: 'currency' },
    { key: 'paid_new_montly_orders', label: 'Pedidos Novos Mensais Pagos', type: 'number' },
    { key: 'paid_new_montly_revenue', label: 'Receita Novos Mensais Pagos', type: 'currency' },
    { key: 'paid_recurring_annual_orders', label: 'Pedidos Recorrentes Anuais Pagos', type: 'number' },
    { key: 'paid_recurring_annual_revenue', label: 'Receita Recorrentes Anuais Pagos', type: 'currency' },
    { key: 'paid_recurring_montly_orders', label: 'Pedidos Recorrentes Mensais Pagos', type: 'number' },
    { key: 'paid_recurring_montly_revenue', label: 'Receita Recorrentes Mensais Pagos', type: 'currency' }
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
  // Mas apenas adicionar novas métricas, não reordenar as existentes
  // Usar useRef para evitar reordenação durante drag
  const prevCardMetricsRef = useRef<string[]>(cardMetrics)
  const syncCardOrderRef = useRef(false)
  
  useEffect(() => {
    // Não sincronizar durante drag and drop
    if (isDraggingRef.current || syncCardOrderRef.current) {
      return
    }
    
    // Comparar arrays para ver se realmente mudou
    const arraysEqual = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false
      return a.every((val, index) => val === b[index])
    }
    
    if (arraysEqual(prevCardMetricsRef.current, cardMetrics)) {
      return
    }
    
    syncCardOrderRef.current = true
    
    setCardOrder(prevOrder => {
      // Filtrar ordem atual para incluir apenas métricas que ainda estão em cardMetrics
      const validOrder = prevOrder.filter(key => cardMetrics.includes(key))
      // Adicionar novas métricas que não estão na ordem no final
      const missingMetrics = cardMetrics.filter(key => !validOrder.includes(key))
      // Preservar a ordem existente e apenas adicionar as novas no final
      if (missingMetrics.length > 0) {
        prevCardMetricsRef.current = [...cardMetrics]
        syncCardOrderRef.current = false
        return [...validOrder, ...missingMetrics]
      }
      // Se não há novas métricas, manter a ordem atual
      prevCardMetricsRef.current = [...cardMetrics]
      syncCardOrderRef.current = false
      return prevOrder
    })
  }, [cardMetrics])
  
  // Função para lidar com drag start - SIMPLIFICADA
  const handleDragStart = (e: React.DragEvent, cardKey: string) => {
    isDraggingRef.current = true
    setDraggedCard(cardKey)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cardKey)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }
  
  // Função para lidar com drag over - versão simplificada
  const handleCardDragOver = (e: React.DragEvent, cardKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    
    if (cardKey !== draggedCard && dragOverCardRef.current !== cardKey) {
      dragOverCardRef.current = cardKey
      setDragOverCard(cardKey)
    }
  }
  
  // Função para lidar com drag leave - SIMPLIFICADA
  const handleDragLeave = () => {
    setDragOverCard(null)
    dragOverCardRef.current = null
  }
  
  // Função para lidar com drag end - SIMPLIFICADA
  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    // Limpar estado apenas se não houve drop (handleDrop já limpa se houver drop)
    setTimeout(() => {
      if (draggedCard) {
        setDraggedCard(null)
        setDragOverCard(null)
        dragOverCardRef.current = null
        isDraggingRef.current = false
      }
    }, 100)
  }
  
  // Função para lidar com drop - VERSÃO ULTRA SIMPLIFICADA
  const handleDrop = (e: React.DragEvent, dropCardKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const dragCardKey = draggedCard
    
    if (!dragCardKey || dragCardKey === dropCardKey) {
      setDraggedCard(null)
      setDragOverCard(null)
      dragOverCardRef.current = null
      isDraggingRef.current = false
      return
    }
    
    // Reordenar de forma simples e direta
    setCardOrder(prevOrder => {
      const newOrder = [...prevOrder]
      const dragIndex = newOrder.indexOf(dragCardKey)
      const dropIndex = newOrder.indexOf(dropCardKey)
      
      if (dragIndex === -1 || dropIndex === -1 || dragIndex === dropIndex) {
        return prevOrder
      }
      
      // Remover da posição original
      newOrder.splice(dragIndex, 1)
      // Inserir na nova posição
      newOrder.splice(dropIndex, 0, dragCardKey)
      
      return newOrder
    })
    
    // Limpar estados
    setDraggedCard(null)
    setDragOverCard(null)
    dragOverCardRef.current = null
    isDraggingRef.current = false
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
  
  // Estados para dimensões e métricas selecionadas - carregar diretamente do localStorage
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(() => {
    const storageKey = `overview-selections-${selectedTable}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.dimensions || []
      } catch {
        return []
      }
    }
    return []
  })
  
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => {
    const storageKey = `overview-selections-${selectedTable}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.metrics || []
      } catch {
        return []
      }
    }
    return []
  })
  
  // Rastrear se é o mount inicial para não salvar no primeiro render
  const isInitialMountRef = useRef<boolean>(true)
  
  // Salvar seleções no localStorage quando mudarem (por cliente)
  // Não salvar no mount inicial para evitar sobrescrever com valores vazios
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }
    const storageKey = `overview-selections-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify({
      dimensions: selectedDimensions,
      metrics: selectedMetrics
    }))
  }, [selectedDimensions, selectedMetrics, selectedTable])
  
  // Rastrear selectedTable anterior para só resetar quando realmente mudar
  const prevSelectedTableRef = useRef<string>(selectedTable)
  
  // Resetar seleções quando mudar o cliente (apenas quando selectedTable realmente mudar, não no mount inicial)
  useEffect(() => {
    // Só resetar se o selectedTable realmente mudou (não no mount inicial)
    if (prevSelectedTableRef.current !== selectedTable) {
      const storageKey = `overview-selections-${selectedTable}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setSelectedDimensions(parsed.dimensions || [])
          setSelectedMetrics(parsed.metrics || [])
        } catch {
          setSelectedDimensions(dimensions.map(d => d.key))
          const calculatedMetrics = ['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'revenue_per_session', 'avg_order_value', 'roas', 'new_customer_rate']
          const directMetrics = metrics.filter(m => !calculatedMetrics.includes(m.key))
          setSelectedMetrics(directMetrics.map(m => m.key))
        }
      } else {
        setSelectedDimensions(dimensions.map(d => d.key))
        const calculatedMetrics = ['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'revenue_per_session', 'avg_order_value', 'roas', 'new_customer_rate']
        const directMetrics = metrics.filter(m => !calculatedMetrics.includes(m.key))
        setSelectedMetrics(directMetrics.map(m => m.key))
      }
      prevSelectedTableRef.current = selectedTable
    }
    
    // Carregar presets do cliente (sempre, pois pode mudar mesmo sem mudar selectedTable)
    const presetStorageKey = `overview-presets-${selectedTable}`
    const savedPresets = localStorage.getItem(presetStorageKey)
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets))
      } catch {
        setPresets([])
      }
    } else {
      setPresets([])
    }
  }, [selectedTable, dimensions, metrics])
  
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

  // Funções para gerenciar presets
  const savePreset = () => {
    if (!presetName.trim()) {
      alert('Por favor, digite um nome para o preset')
      return
    }
    
    const newPreset: DashboardPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      selectedDimensions: [...selectedDimensions],
      selectedMetrics: [...selectedMetrics],
      cardMetrics: [...cardMetrics],
      timelineMetrics: [...timelineMetrics],
      cardOrder: [...cardOrder],
      sortField: sortField,
      sortDirection: sortDirection,
      createdAt: new Date().toISOString()
    }
    
    const updatedPresets = [...presets, newPreset]
    setPresets(updatedPresets)
    
    const storageKey = `overview-presets-${selectedTable}`
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets))
    
    setPresetName('')
    setShowPresetInput(false)
  }
  
  const loadPreset = (preset: DashboardPreset) => {
    setSelectedDimensions([...preset.selectedDimensions])
    setSelectedMetrics([...preset.selectedMetrics])
    setCardMetrics([...preset.cardMetrics])
    setTimelineMetrics([...preset.timelineMetrics])
    setCardOrder([...preset.cardOrder])
    // Carregar ordenação da tabela (com valores padrão para presets antigos)
    setSortField(preset.sortField !== undefined ? preset.sortField : null)
    setSortDirection(preset.sortDirection || 'desc')
  }
  
  // Carregar automaticamente o primeiro preset disponível quando os presets forem carregados
  const hasLoadedFirstPresetRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const clientKey = selectedTable
    if (presets.length > 0 && !hasLoadedFirstPresetRef.current[clientKey]) {
      loadPreset(presets[0])
      hasLoadedFirstPresetRef.current[clientKey] = true
    }
  }, [presets, selectedTable])
  
  const deletePreset = (presetId: string) => {
    if (!confirm('Tem certeza que deseja deletar este preset?')) {
      return
    }
    
    const updatedPresets = presets.filter(p => p.id !== presetId)
    setPresets(updatedPresets)
    
    const storageKey = `overview-presets-${selectedTable}`
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets))
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

  // Função para calcular período anterior
  const getPreviousPeriod = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    // Para períodos de 1 dia, usar o dia anterior
    if (daysDiff === 0) {
      const previousDay = new Date(start)
      previousDay.setDate(previousDay.getDate() - 1)
      return {
        start: previousDay.toISOString().split('T')[0],
        end: previousDay.toISOString().split('T')[0]
      }
    }
    
    const previousEnd = new Date(start)
    previousEnd.setDate(previousEnd.getDate() - 1)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - daysDiff + 1)
    
    return {
      start: previousStart.toISOString().split('T')[0],
      end: previousEnd.toISOString().split('T')[0]
    }
  }

  // Função para calcular crescimento percentual
  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? 100 : 0 // Se não havia dados antes e agora há, crescimento de 100%
    }
    if (current === 0) {
      return previous > 0 ? -100 : 0 // Se havia dados antes e agora não há, queda de 100%
    }
    return ((current - previous) / previous) * 100
  }

  // Função para buscar dados do período anterior
  const fetchPreviousPeriodData = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable || !startDate || !endDate) return

      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoadingPrevious(true)
      
      const previousPeriod = getPreviousPeriod()
      console.log('📊 Fetching previous period:', previousPeriod)
      
      const response = await api.getMetrics(token, {
        start_date: previousPeriod.start,
        end_date: previousPeriod.end,
        table_name: selectedTable
      })

      // Calcular totais do período anterior
      const totals = (response.data || []).reduce((acc: any, item: any) => {
        return {
          sessions: acc.sessions + (item.Sessoes || 0),
          clicks: acc.clicks + (item.Cliques || 0),
          add_to_carts: acc.add_to_carts + (item.Adicoes_ao_Carrinho || 0),
          orders: acc.orders + (item.Pedidos || 0),
          paid_orders: acc.paid_orders + (item.Pedidos_Pagos || 0),
          revenue: acc.revenue + (item.Receita || 0),
          paid_revenue: acc.paid_revenue + (item.Receita_Paga || 0),
          cost: acc.cost + (item.Investimento || 0),
          leads: acc.leads + (item.Leads || 0),
          new_customers: acc.new_customers + (item.Novos_Clientes || 0),
          revenue_new_customers: acc.revenue_new_customers + (item.Receita_Novos_Clientes || 0),
          paid_new_annual_orders: acc.paid_new_annual_orders + (item.Pedidos_Assinatura_Anual_Inicial || 0),
          paid_new_annual_revenue: acc.paid_new_annual_revenue + (item.Receita_Assinatura_Anual_Inicial || 0),
          paid_new_montly_orders: acc.paid_new_montly_orders + (item.Pedidos_Assinatura_Mensal_Inicial || 0),
          paid_new_montly_revenue: acc.paid_new_montly_revenue + (item.Receita_Assinatura_Mensal_Inicial || 0),
          paid_recurring_annual_orders: acc.paid_recurring_annual_orders + (item.Pedidos_Assinatura_Anual_Recorrente || 0),
          paid_recurring_annual_revenue: acc.paid_recurring_annual_revenue + (item.Receita_Assinatura_Anual_Recorrente || 0),
          paid_recurring_montly_orders: acc.paid_recurring_montly_orders + (item.Pedidos_Assinatura_Mensal_Recorrente || 0),
          paid_recurring_montly_revenue: acc.paid_recurring_montly_revenue + (item.Receita_Assinatura_Mensal_Recorrente || 0)
        }
      }, {
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
        paid_new_annual_orders: 0,
        paid_new_annual_revenue: 0,
        paid_new_montly_orders: 0,
        paid_new_montly_revenue: 0,
        paid_recurring_annual_orders: 0,
        paid_recurring_annual_revenue: 0,
        paid_recurring_montly_orders: 0,
        paid_recurring_montly_revenue: 0
      })

      console.log('✅ Previous period totals:', totals)
      setPreviousTotals(totals)
    } catch (error) {
      console.error('❌ Error fetching previous period data:', error)
      setPreviousTotals({
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
        paid_new_annual_orders: 0,
        paid_new_annual_revenue: 0,
        paid_new_montly_orders: 0,
        paid_new_montly_revenue: 0,
        paid_recurring_annual_orders: 0,
        paid_recurring_annual_revenue: 0,
        paid_recurring_montly_orders: 0,
        paid_recurring_montly_revenue: 0
      })
    } finally {
      setIsLoadingPrevious(false)
    }
  }

  // Função para buscar goals
  const fetchGoals = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoadingGoals(true)
      console.log('🎯 Fetching goals for table:', selectedTable)
      
      const response = await api.getGoals(token, {
        table_name: selectedTable
      })
      
      console.log('✅ Goals response:', response)
      setGoals(response)
    } catch (error) {
      console.error('❌ Error fetching goals:', error)
      setGoals(null)
    } finally {
      setIsLoadingGoals(false)
    }
  }

  // Função para buscar dados do mês atual
  const fetchCurrentMonthData = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoadingCurrentMonth(true)
      
      const currentDate = new Date()
      const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      const startOfMonth = `${currentMonth}-01`
      const endOfMonth = `${currentMonth}-${new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}`

      console.log('📊 Fetching current month data:', { startOfMonth, endOfMonth, selectedTable })
      
      const response = await api.getMetrics(token, {
        start_date: startOfMonth,
        end_date: endOfMonth,
        table_name: selectedTable
      })

      const currentMonthReceitaPaga = response.data?.reduce((total: number, item: any) => total + (item.Receita_Paga || 0), 0) || 0
      
      setCurrentMonthData({ currentMonthReceitaPaga })
    } catch (error) {
      console.error('❌ Error fetching current month data:', error)
      setCurrentMonthData(null)
    } finally {
      setIsLoadingCurrentMonth(false)
    }
  }

  // Função para calcular run rate da meta do mês
  const calculateRunRate = () => {
    if (!goals || !currentMonthData) return null

    const currentDate = new Date()
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    
    const monthlyGoal = goals.goals?.metas_mensais?.[currentMonth]?.meta_receita_paga
    if (!monthlyGoal) return null

    // Calcular dias no mês atual
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const currentDay = currentDate.getDate()
    
    // Usar receita paga do mês atual
    const currentMonthReceitaPaga = currentMonthData.currentMonthReceitaPaga
    
    // Calcular run rate (receita do mês atual * dias no mês / dia atual)
    const runRate = (currentMonthReceitaPaga * daysInMonth) / currentDay
    
    // Calcular percentual da meta
    const percentageOfGoal = (runRate / monthlyGoal) * 100
    
    return {
      runRate,
      monthlyGoal,
      percentageOfGoal,
      currentDay,
      daysInMonth,
      currentMonthReceitaPaga
    }
  }

  // Salvar meta
  const saveGoal = async () => {
    if (!goalFormData.month || !goalFormData.goal_value) {
      alert('Por favor, preencha todos os campos.')
      return
    }

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      await api.saveMonthlyGoal(token, {
        table_name: selectedTable,
        month: goalFormData.month,
        goal_value: parseFloat(goalFormData.goal_value),
        goal_type: 'revenue_goal'
      })
      
      // Fechar modal e recarregar metas
      setShowGoalModal(false)
      setGoalFormData({ month: '', goal_value: '' })
      setEditingGoal(null)
      fetchGoals()
      
      alert(editingGoal ? 'Meta atualizada com sucesso!' : 'Meta cadastrada com sucesso!')
    } catch (error) {
      console.error('Error saving goal:', error)
      alert('Erro ao salvar meta. Tente novamente.')
    }
  }

  // Abrir modal de nova meta
  const openNewGoalModal = () => {
    setGoalFormData({ month: '', goal_value: '' })
    setEditingGoal(null)
    setShowGoalModal(true)
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
          
          // Buscar dados do período anterior para comparação
          if (startDate && endDate) {
            fetchPreviousPeriodData()
          }
          
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

  // Buscar goals quando a tabela mudar (não bloqueia render)
  useEffect(() => {
    if (!selectedTable) return
    
    // Usar requestIdleCallback ou setTimeout para não bloquear render
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fetchGoals()
      }, { timeout: 100 })
    } else {
      setTimeout(() => {
        fetchGoals()
      }, 0)
    }
  }, [selectedTable])

  // Buscar dados do mês atual quando a tabela mudar (não bloqueia render)
  useEffect(() => {
    if (!selectedTable) return
    
    // Usar requestIdleCallback ou setTimeout para não bloquear render
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fetchCurrentMonthData()
      }, { timeout: 100 })
    } else {
      setTimeout(() => {
        fetchCurrentMonthData()
      }, 0)
    }
  }, [selectedTable])

  // Filtrar dados quando startDate ou endDate mudarem (se já houver dados)
  useEffect(() => {
    if (allData.length > 0 && startDate && endDate) {
      filterDataByDateRange(allData, startDate, endDate)
      // Buscar dados do período anterior quando datas mudarem
      fetchPreviousPeriodData()
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
      // Novas métricas
      acc[date].paid_new_annual_orders += item.paid_new_annual_orders || 0
      acc[date].paid_new_annual_revenue += item.paid_new_annual_revenue || 0
      acc[date].paid_new_montly_orders += item.paid_new_montly_orders || 0
      acc[date].paid_new_montly_revenue += item.paid_new_montly_revenue || 0
      acc[date].paid_recurring_annual_orders += item.paid_recurring_annual_orders || 0
      acc[date].paid_recurring_annual_revenue += item.paid_recurring_annual_revenue || 0
      acc[date].paid_recurring_montly_orders += item.paid_recurring_montly_orders || 0
      acc[date].paid_recurring_montly_revenue += item.paid_recurring_montly_revenue || 0
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
      // Novas métricas
      acc.paid_new_annual_orders += item.paid_new_annual_orders || 0
      acc.paid_new_annual_revenue += item.paid_new_annual_revenue || 0
      acc.paid_new_montly_orders += item.paid_new_montly_orders || 0
      acc.paid_new_montly_revenue += item.paid_new_montly_revenue || 0
      acc.paid_recurring_annual_orders += item.paid_recurring_annual_orders || 0
      acc.paid_recurring_annual_revenue += item.paid_recurring_annual_revenue || 0
      acc.paid_recurring_montly_orders += item.paid_recurring_montly_orders || 0
      acc.paid_recurring_montly_revenue += item.paid_recurring_montly_revenue || 0
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
      sessions: 0,
      // Novas métricas
      paid_new_annual_orders: 0,
      paid_new_annual_revenue: 0,
      paid_new_montly_orders: 0,
      paid_new_montly_revenue: 0,
      paid_recurring_annual_orders: 0,
      paid_recurring_annual_revenue: 0,
      paid_recurring_montly_orders: 0,
      paid_recurring_montly_revenue: 0
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

  // Calcular métricas derivadas do período anterior
  const previousConversionRate = previousTotals.sessions > 0 ? (previousTotals.orders / previousTotals.sessions) * 100 : 0
  const previousPaidConversionRate = previousTotals.orders > 0 ? (previousTotals.paid_orders / previousTotals.orders) * 100 : 0
  const previousAddToCartRate = previousTotals.sessions > 0 ? (previousTotals.add_to_carts / previousTotals.sessions) * 100 : 0
  const previousRevenuePerSession = previousTotals.sessions > 0 ? previousTotals.revenue / previousTotals.sessions : 0
  const previousAvgOrderValue = previousTotals.orders > 0 ? previousTotals.revenue / previousTotals.orders : 0
  const previousTacos = previousTotals.revenue > 0 ? (previousTotals.cost / previousTotals.revenue) * 100 : 0
  const previousRoas = previousTotals.cost > 0 ? previousTotals.revenue / previousTotals.cost : 0
  const previousLeadsConversionRate = previousTotals.sessions > 0 ? (previousTotals.leads / previousTotals.sessions) * 100 : 0
  const previousNewCustomerRate = previousTotals.orders > 0 ? (previousTotals.new_customers / previousTotals.orders) * 100 : 0

  // Função para obter o growth de uma métrica
  const getMetricGrowth = (metricKey: string): number | undefined => {
    if (isLoadingPrevious) return undefined
    
    if (metricKey === 'sessions') return calculateGrowth(totals.sessions, previousTotals.sessions)
    if (metricKey === 'clicks') return calculateGrowth(totals.clicks, previousTotals.clicks)
    if (metricKey === 'add_to_carts') return calculateGrowth(totals.add_to_carts, previousTotals.add_to_carts)
    if (metricKey === 'orders') return calculateGrowth(totals.orders, previousTotals.orders)
    if (metricKey === 'paid_orders') return calculateGrowth(totals.paid_orders, previousTotals.paid_orders)
    if (metricKey === 'revenue') return calculateGrowth(totals.revenue, previousTotals.revenue)
    if (metricKey === 'paid_revenue') return calculateGrowth(totals.paid_revenue, previousTotals.paid_revenue)
    if (metricKey === 'cost') return calculateGrowth(totals.cost, previousTotals.cost)
    if (metricKey === 'leads') return calculateGrowth(totals.leads, previousTotals.leads)
    if (metricKey === 'new_customers') return calculateGrowth(totals.new_customers, previousTotals.new_customers)
    if (metricKey === 'revenue_new_customers') return calculateGrowth(totals.revenue_new_customers, previousTotals.revenue_new_customers)
    if (metricKey === 'conversion_rate') return calculateGrowth(conversionRate, previousConversionRate)
    if (metricKey === 'add_to_cart_rate') return calculateGrowth(addToCartRate, previousAddToCartRate)
    if (metricKey === 'leads_conversion_rate') return calculateGrowth(leadsConversionRate, previousLeadsConversionRate)
    if (metricKey === 'paid_conversion_rate') return calculateGrowth(paidConversionRate, previousPaidConversionRate)
    if (metricKey === 'revenue_per_session') return calculateGrowth(revenuePerSession, previousRevenuePerSession)
    if (metricKey === 'avg_order_value') return calculateGrowth(avgOrderValue, previousAvgOrderValue)
    if (metricKey === 'roas') return calculateGrowth(roas, previousRoas)
    if (metricKey === 'new_customer_rate') return calculateGrowth(newCustomerRate, previousNewCustomerRate)
    // Novas métricas
    if (metricKey === 'paid_new_annual_orders') return calculateGrowth(totals.paid_new_annual_orders || 0, previousTotals.paid_new_annual_orders)
    if (metricKey === 'paid_new_annual_revenue') return calculateGrowth(totals.paid_new_annual_revenue || 0, previousTotals.paid_new_annual_revenue)
    if (metricKey === 'paid_new_montly_orders') return calculateGrowth(totals.paid_new_montly_orders || 0, previousTotals.paid_new_montly_orders)
    if (metricKey === 'paid_new_montly_revenue') return calculateGrowth(totals.paid_new_montly_revenue || 0, previousTotals.paid_new_montly_revenue)
    if (metricKey === 'paid_recurring_annual_orders') return calculateGrowth(totals.paid_recurring_annual_orders || 0, previousTotals.paid_recurring_annual_orders)
    if (metricKey === 'paid_recurring_annual_revenue') return calculateGrowth(totals.paid_recurring_annual_revenue || 0, previousTotals.paid_recurring_annual_revenue)
    if (metricKey === 'paid_recurring_montly_orders') return calculateGrowth(totals.paid_recurring_montly_orders || 0, previousTotals.paid_recurring_montly_orders)
    if (metricKey === 'paid_recurring_montly_revenue') return calculateGrowth(totals.paid_recurring_montly_revenue || 0, previousTotals.paid_recurring_montly_revenue)
    return undefined
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Calcular run rate da meta do mês
  const runRateData = calculateRunRate()

  // Componente RunRateHighlight
  const RunRateHighlight = ({ runRateData, isLoadingGoals, isLoadingCurrentMonth }: { runRateData: any, isLoadingGoals: boolean, isLoadingCurrentMonth: boolean }) => {
    if (isLoadingGoals || isLoadingCurrentMonth) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
            <span className="text-sm text-gray-700">Carregando metas...</span>
          </div>
        </div>
      )
    }

    if (!runRateData) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="text-center">
            <Target className="w-5 h-5 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-700 mb-2">Run Rate da Meta</h3>
            <p className="text-xs text-gray-500 mb-4">Meta não disponível</p>
            <button
              onClick={openNewGoalModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 mx-auto"
            >
              <Target className="w-4 h-4" />
              Cadastrar Meta
            </button>
          </div>
        </div>
      )
    }

    const { runRate, monthlyGoal, percentageOfGoal, currentDay, daysInMonth } = runRateData
    const isOnTrack = percentageOfGoal >= 100
    const progressWidth = Math.min(percentageOfGoal, 100)

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Run Rate da Meta</h2>
              <p className="text-sm text-gray-600">Projeção mensal</p>
            </div>
          </div>
          
          {/* Status Badge - Mobile Optimized */}
          <div className={`px-4 py-2 rounded-xl text-center shadow-sm ${
            isOnTrack 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
              : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200'
          }`}>
            <p className="text-sm font-semibold">
              {isOnTrack ? '✅ No caminho' : '⚠️ Atrasado'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Dia {currentDay} de {daysInMonth}
            </p>
          </div>
        </div>

        {/* Main Content - Mobile Optimized Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Run Rate Projetado */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center border border-blue-100">
            <p className="text-sm font-medium text-blue-700 mb-2">Run Rate Projetado</p>
            <p className="text-xl font-bold text-blue-900">{formatCurrency(runRate)}</p>
            <p className="text-xs text-blue-600 mt-1">Projeção mensal</p>
          </div>

          {/* Meta Mensal */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center border border-purple-100">
            <p className="text-sm font-medium text-purple-700 mb-2">Meta Mensal</p>
            <p className="text-xl font-bold text-purple-900">{formatCurrency(monthlyGoal)}</p>
            <p className="text-xs text-purple-600 mt-1">Objetivo</p>
          </div>

          {/* Progresso */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 text-center border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Progresso</p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`text-2xl font-bold ${
                isOnTrack ? 'text-green-600' : 'text-red-600'
              }`}>
                {percentageOfGoal.toFixed(1)}%
              </span>
              {isOnTrack ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
            </div>
            
            {/* Progress Bar - Enhanced */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ease-out ${
                  isOnTrack ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-pink-500'
                }`}
                style={{ width: `${progressWidth}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600">
              {progressWidth.toFixed(1)}% da meta
            </p>
          </div>
        </div>

        {/* Enhanced Progress Visualization - Mobile Optimized */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Progresso Visual</span>
            <span className="text-xs text-gray-500">
              {currentDay}/{daysInMonth} dias
            </span>
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-700 ease-out shadow-sm ${
                  isOnTrack 
                    ? 'bg-gradient-to-r from-green-400 via-green-500 to-emerald-500' 
                    : 'bg-gradient-to-r from-red-400 via-red-500 to-pink-500'
                }`}
                style={{ width: `${progressWidth}%` }}
              ></div>
            </div>
            
            {/* Progress Indicator */}
            <div 
              className={`absolute top-0 w-1 h-3 rounded-full shadow-lg ${
                isOnTrack ? 'bg-green-600' : 'bg-red-600'
              }`}
              style={{ left: `calc(${progressWidth}% - 2px)` }}
            ></div>
          </div>
          
          {/* Progress Labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Bottom Info - Enhanced */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-gray-700">Baseado em {currentDay} dias</p>
              <p className="text-xs text-gray-500">Dados até hoje</p>
            </div>
            <div className="text-center sm:text-right">
              <p className={`text-sm font-semibold ${
                isOnTrack ? 'text-green-600' : 'text-red-600'
              }`}>
                {isOnTrack ? '🎯 Meta será atingida' : '⚠️ Meta em risco'}
              </p>
              <p className="text-xs text-gray-500">
                {isOnTrack ? 'Continue assim!' : 'Ação necessária'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Função para exportar dados da tabela para XLSX
  const handleDownloadXLSX = () => {
    if (selectedDimensions.length === 0 || selectedMetrics.length === 0 || filteredData.length === 0) {
      alert('Não há dados para exportar. Selecione dimensões e métricas no painel de personalização.')
      return
    }

    try {
      // Agrupar dados pelas dimensões selecionadas (mesma lógica da tabela)
      const groupedData = filteredData.reduce((acc, item) => {
        const groupKey = selectedDimensions.map(dimKey => 
          String(item[dimKey as keyof OverviewDataItem] || '-')
        ).join('|')
        
        if (!acc[groupKey]) {
          acc[groupKey] = {
            dimensions: selectedDimensions.reduce((dims, dimKey) => {
              dims[dimKey] = item[dimKey as keyof OverviewDataItem]
              return dims
            }, {} as Record<string, any>),
            metrics: (() => {
              const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
              const allMetricsToInit = [...new Set([...baseMetrics, ...selectedMetrics])]
              return allMetricsToInit.reduce((mets, metKey) => {
                mets[metKey] = 0
                return mets
              }, {} as Record<string, number>)
            })()
          }
        }
        
        const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
        baseMetrics.forEach(metKey => {
          const value = item[metKey as keyof OverviewDataItem] as number || 0
          acc[groupKey].metrics[metKey] = (acc[groupKey].metrics[metKey] || 0) + value
        })
        
        return acc
      }, {} as Record<string, { dimensions: Record<string, any>, metrics: Record<string, number> }>)
      
      // Converter para array e calcular métricas derivadas
      let groupedArray = Object.values(groupedData).map(group => {
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
        
        if (selectedMetrics.includes('conversion_rate')) {
          calcMetrics.conversion_rate = sessions > 0 ? (orders / sessions) * 100 : 0
        }
        if (selectedMetrics.includes('add_to_cart_rate')) {
          calcMetrics.add_to_cart_rate = sessions > 0 ? (add_to_carts / sessions) * 100 : 0
        }
        if (selectedMetrics.includes('leads_conversion_rate')) {
          calcMetrics.leads_conversion_rate = sessions > 0 ? (leads / sessions) * 100 : 0
        }
        if (selectedMetrics.includes('paid_conversion_rate')) {
          calcMetrics.paid_conversion_rate = orders > 0 ? (paid_orders / orders) * 100 : 0
        }
        if (selectedMetrics.includes('revenue_per_session')) {
          calcMetrics.revenue_per_session = sessions > 0 ? revenue / sessions : 0
        }
        if (selectedMetrics.includes('avg_order_value')) {
          calcMetrics.avg_order_value = orders > 0 ? revenue / orders : 0
        }
        if (selectedMetrics.includes('roas')) {
          calcMetrics.roas = cost > 0 ? revenue / cost : 0
        }
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
          
          if (selectedDimensions.includes(sortField)) {
            aValue = a.dimensions[sortField]
            bValue = b.dimensions[sortField]
          } else if (selectedMetrics.includes(sortField)) {
            aValue = a.metrics[sortField] || 0
            bValue = b.metrics[sortField] || 0
          } else {
            return 0
          }
          
          if (selectedMetrics.includes(sortField)) {
            const aNum = typeof aValue === 'number' ? aValue : parseFloat(String(aValue)) || 0
            const bNum = typeof bValue === 'number' ? bValue : parseFloat(String(bValue)) || 0
            return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
          }
          
          const aStr = String(aValue || '').toLowerCase()
          const bStr = String(bValue || '').toLowerCase()
          return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
        })
      }
      
      // Preparar dados para exportação
      const dataToExport = groupedArray.map(group => {
        const row: Record<string, any> = {}
        
        // Adicionar dimensões
        selectedDimensions.forEach(dimKey => {
          const dimension = dimensions.find(d => d.key === dimKey)
          row[dimension?.label || dimKey] = group.dimensions[dimKey] || '-'
        })
        
        // Adicionar métricas formatadas
        selectedMetrics.forEach(metKey => {
          const metric = metrics.find(m => m.key === metKey)
          const value = group.metrics[metKey] || 0
          
          if (!metric) {
            row[metKey] = value
            return
          }
          
          if (metric.type === 'currency') {
            // Para Excel, usar número em vez de string formatada
            row[metric.label] = value
          } else if (metric.type === 'percentage') {
            // Para Excel, usar número (porcentagem como decimal)
            row[metric.label] = value / 100
          } else if (metKey === 'roas') {
            row[metric.label] = value
          } else {
            row[metric.label] = value
          }
        })
        
        return row
      })
      
      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dataToExport)
      
      // Ajustar largura das colunas
      const colCount = selectedDimensions.length + selectedMetrics.length
      const colWidths = Array(colCount).fill(null).map(() => ({ wch: 15 }))
      ws['!cols'] = colWidths
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Dados')
      
      // Gerar nome do arquivo com data
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const safeTable = selectedTable.replace(/[^\w-]/g, '_')
      const filename = `overview-${safeTable}-${dateStr}.xlsx`
      
      // Download do arquivo
      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error('Erro ao gerar XLSX:', error)
      alert('Erro ao gerar arquivo Excel. Por favor, tente novamente.')
    }
  }

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    format = 'number',
    color = 'blue',
    isDragOver = false,
    growth
  }: {
    title: string
    value: number
    icon: any
    format?: 'number' | 'currency' | 'percentage'
    color?: string
    isDragOver?: boolean
    growth?: number
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
      <div className={`bg-white rounded-xl shadow-lg p-4 border transition-all duration-200 ${
        isDragOver 
          ? 'border-blue-500 border-2 shadow-2xl bg-blue-50/30' 
          : 'border-gray-100 hover:shadow-xl hover:border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg transition-transform ${
            colorClasses[color as keyof typeof colorClasses] || colorClasses.blue
          } ${isDragOver ? 'scale-110' : ''}`}>
            <Icon className="w-5 h-5" />
          </div>
          {isLoadingPrevious ? (
            <div className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span className="text-xs text-gray-500">Comparando...</span>
            </div>
          ) : growth !== undefined && growth !== 0 && (
            <div className="flex items-center gap-1">
              {growth > 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : growth < 0 ? (
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              ) : null}
              <span className={`text-sm font-medium ${growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
              </span>
            </div>
          )}
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
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
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

      {/* Run Rate da Meta */}
      <RunRateHighlight 
        runRateData={runRateData} 
        isLoadingGoals={isLoadingGoals}
        isLoadingCurrentMonth={isLoadingCurrentMonth}
      />

      {/* Cards de Métricas */}
      {cardMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {(() => {
            // Filtrar e manter a ordem do cardOrder
            const visibleCards = cardOrder.filter(key => {
              if (!cardMetrics.includes(key)) return false
              // Filtrar novas métricas: exibir apenas se > 0
              const newMetrics = ['paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
              if (newMetrics.includes(key)) {
                const value = getMetricValue(key)
                return value > 0
              }
              return true
            })
            return visibleCards
          })().map((cardKey, index) => {
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
            
            // Tratamento especial para ROAS
            if (cardKey === 'roas') {
              return (
                <div 
                  key={cardKey}
                  className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-200 ease-out"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    {isLoadingPrevious ? (
                      <div className="flex items-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        <span className="text-xs text-gray-500">Comparando...</span>
                      </div>
                    ) : (() => {
                      const growth = getMetricGrowth(cardKey)
                      return growth !== undefined && growth !== 0 && (
                        <div className="flex items-center gap-1">
                          {growth > 0 ? (
                            <ArrowUpRight className="w-4 h-4 text-green-600" />
                          ) : growth < 0 ? (
                            <ArrowDownRight className="w-4 h-4 text-red-600" />
                          ) : null}
                          <span className={`text-sm font-medium ${growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-1">{metric.label}</h3>
                  <p className="text-2xl font-bold text-gray-900">{value.toFixed(3)}x</p>
                </div>
              )
            }
            
            return (
              <div
                key={cardKey}
                className="transition-all duration-200 ease-out hover:scale-[1.02]"
              >
                <MetricCard
                  title={metric.label}
                  value={value}
                  icon={Icon}
                  format={format}
                  color={color}
                  isDragOver={false}
                  growth={getMetricGrowth(cardKey)}
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
          <div className={`fixed top-0 right-0 h-full w-96 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-xl shadow-2xl z-50 transform transition-all duration-300 ease-out ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="h-full flex flex-col border-l border-gray-200/50">
              {/* Header da Sidebar */}
              <div className="px-6 py-5 border-b border-gray-200/60 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white/80 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Personalizar
                  </span>
                </h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-gray-200/60 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 group"
                  aria-label="Fechar sidebar"
                >
                  <X className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
                </button>
              </div>
              
              {/* Conteúdo da Sidebar */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <div className="space-y-8">
                  {/* Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900">Presets</h3>
                      {!showPresetInput && (
                        <button
                          onClick={() => setShowPresetInput(true)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200 flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Salvar Preset
                        </button>
                      )}
                    </div>
                    
                    {showPresetInput && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border border-blue-200/50">
                        <input
                          type="text"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              savePreset()
                            } else if (e.key === 'Escape') {
                              setShowPresetInput(false)
                              setPresetName('')
                            }
                          }}
                          placeholder="Nome do preset"
                          className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={savePreset}
                            className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => {
                              setShowPresetInput(false)
                              setPresetName('')
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {presets.length > 0 && (
                      <div className="space-y-2 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50">
                        {presets.map(preset => (
                          <div
                            key={preset.id}
                            className="p-3 rounded-xl hover:bg-gray-50/80 border border-gray-200/50 transition-all duration-200 group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900 truncate">{preset.name}</span>
                              </div>
                              <button
                                onClick={() => deletePreset(preset.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Deletar preset"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                            <button
                              onClick={() => loadPreset(preset)}
                              className="w-full px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              Carregar
                            </button>
                            <div className="mt-2 text-xs text-gray-500">
                              {new Date(preset.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {presets.length === 0 && !showPresetInput && (
                      <div className="p-4 text-center text-sm text-gray-500 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50">
                        Nenhum preset salvo. Clique em "Salvar Preset" para criar um.
                      </div>
                    )}
                  </div>
                  
                  {/* Dimensões */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900">Dimensões</h3>
                      <button
                        onClick={toggleAllDimensions}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200"
                      >
                        {selectedDimensions.length === dimensions.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                      </button>
                    </div>
                    <div className="space-y-1.5 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50">
                      {dimensions.map(dimension => {
                        const isSelected = selectedDimensions.includes(dimension.key)
                        return (
                          <label
                            key={dimension.key}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                              isSelected 
                                ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 shadow-sm' 
                                : 'hover:bg-gray-50/80 border border-transparent'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                            <span className={`text-sm font-medium flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                              {dimension.label}
                            </span>
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
                  
                  {/* Ordem dos Cards */}
                  {cardMetrics.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-900">Ordem dos Cards</h3>
                        <span className="text-xs text-gray-500">
                          {cardMetrics.length} {cardMetrics.length === 1 ? 'card' : 'cards'}
                        </span>
                      </div>
                      <div className="space-y-2 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50">
                        {cardOrder
                          .filter(key => cardMetrics.includes(key))
                          .map((cardKey, index) => {
                            const metric = metrics.find(m => m.key === cardKey)
                            if (!metric) return null
                            
                            const isDragging = draggedCard === cardKey
                            const isDragOver = dragOverCard === cardKey
                            
                            return (
                              <div
                                key={cardKey}
                                draggable
                                onDragStart={(e) => handleDragStart(e, cardKey)}
                                onDragOver={(e) => handleCardDragOver(e, cardKey)}
                                onDragLeave={handleDragLeave}
                                onDragEnd={handleDragEnd}
                                onDrop={(e) => handleDrop(e, cardKey)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border ${
                                  isDragging
                                    ? 'opacity-40 border-blue-300 scale-95 cursor-grabbing'
                                    : isDragOver
                                      ? 'border-blue-500 border-2 shadow-lg scale-105 bg-blue-50/50 z-10'
                                      : 'hover:bg-gray-50/80 border-gray-200/50 cursor-grab active:cursor-grabbing'
                                }`}
                              >
                                <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-xs font-medium text-gray-500 w-6 flex-shrink-0">
                                  {index + 1}
                                </span>
                                <span className="text-sm font-medium text-gray-900 flex-1">
                                  {metric.label}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                      {cardOrder.filter(key => cardMetrics.includes(key)).length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50">
                          Nenhum card selecionado. Selecione métricas como "Card" para ordená-las aqui.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Métricas */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900">Métricas</h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={toggleAllTableMetrics}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all duration-200"
                        >
                          {selectedMetrics.length === metrics.length ? 'Tabela: Todas' : 'Tabela: Nenhuma'}
                        </button>
                        <span className="text-xs text-gray-300">•</span>
                        <button
                          onClick={toggleAllCardMetrics}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all duration-200"
                        >
                          {cardMetrics.length === metrics.length ? 'Card: Todas' : 'Card: Nenhuma'}
                        </button>
                      </div>
                    </div>
                    {/* Campo de busca */}
                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={metricSearchTerm}
                          onChange={(e) => setMetricSearchTerm(e.target.value)}
                          placeholder="Buscar métricas..."
                          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                        {metricSearchTerm && (
                          <button
                            onClick={() => setMetricSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="Limpar busca"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                      {metrics
                        .filter(metric => {
                          if (!metricSearchTerm) return true
                          const searchLower = metricSearchTerm.toLowerCase()
                          return metric.label.toLowerCase().includes(searchLower) || 
                                 metric.key.toLowerCase().includes(searchLower)
                        })
                        .map(metric => {
                        const isInTable = selectedMetrics.includes(metric.key)
                        const isInCard = cardMetrics.includes(metric.key)
                        const isInTimeline = timelineMetrics.includes(metric.key)
                        const hasAnySelection = isInTable || isInCard || isInTimeline
                        return (
                          <div
                            key={metric.key}
                            className={`p-3 rounded-xl transition-all duration-200 border ${
                              hasAnySelection 
                                ? 'bg-gradient-to-r from-blue-50/50 to-purple-50/30 border-blue-200/50 shadow-sm' 
                                : 'hover:bg-gray-50/80 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-sm font-medium flex-1 ${hasAnySelection ? 'text-gray-900' : 'text-gray-700'}`}>
                                {metric.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 pl-0.5">
                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isInTable}
                                  onChange={() => toggleMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all"
                                />
                                <span className={`text-xs font-medium transition-colors ${
                                  isInTable ? 'text-blue-700' : 'text-gray-600 group-hover:text-gray-800'
                                }`}>
                                  Tabela
                                </span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isInCard}
                                  onChange={() => toggleCardMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all"
                                />
                                <span className={`text-xs font-medium transition-colors ${
                                  isInCard ? 'text-blue-700' : 'text-gray-600 group-hover:text-gray-800'
                                }`}>
                                  Card
                                </span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isInTimeline}
                                  onChange={() => toggleTimelineMetric(metric.key)}
                                  disabled={!isInTimeline && timelineMetrics.length >= 2}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                />
                                <span className={`text-xs font-medium transition-colors ${
                                  isInTimeline ? 'text-purple-700' : 'text-gray-600 group-hover:text-gray-800'
                                } ${!isInTimeline && timelineMetrics.length >= 2 ? 'opacity-50' : ''}`}>
                                  Timeline
                                </span>
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {timelineMetrics.length > 0 && (
                      <div className="mt-3 px-3 py-2 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-lg border border-purple-200/50">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="text-xs font-medium text-purple-900">
                            Timeline: {timelineMetrics.map(key => metrics.find(m => m.key === key)?.label).filter(Boolean).join(', ')}
                          </span>
                        </div>
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
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
                  <button
                    onClick={handleDownloadXLSX}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 shadow-sm"
                    title="Baixar dados em Excel"
                  >
                    <Download className="w-4 h-4" />
                    <span>XLSX</span>
                  </button>
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
                          const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
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
                    const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
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

      {/* Modal de Nova Meta */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingGoal ? 'Editar Meta' : 'Nova Meta'}</h3>
              <p className="text-sm text-gray-600 mt-1">{editingGoal ? 'Edite a meta de receita' : 'Cadastre uma nova meta de receita'}</p>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
                <input
                  type="month"
                  value={goalFormData.month}
                  onChange={(e) => setGoalFormData({ ...goalFormData, month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="2025-10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor da Meta (R$)</label>
                <input
                  type="number"
                  value={goalFormData.goal_value}
                  onChange={(e) => setGoalFormData({ ...goalFormData, goal_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="10000000"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveGoal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                {editingGoal ? 'Atualizar Meta' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default OverviewDashboard


