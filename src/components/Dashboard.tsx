import { useState, useEffect } from 'react'
import { 
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  LogOut,
  User,
  Globe,
  Coins,
  Sparkles,
  ArrowUpCircle,
  Users2,
  CheckCircle,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Target,
  Download,
  Eye,
  Filter
} from 'lucide-react'
import { api } from '../services/api'
import Logo from './Logo'
import TableSelector from './TableSelector'
import DateRangePicker from './DateRangePicker'
import SortableHeader from './SortableHeader'
import DebugMetrics from './DebugMetrics'
import TimelineChart from './TimelineChart'
import MetricsCarousel from './MetricsCarousel'
import ConversionFunnel from './ConversionFunnel'
import OrdersExpanded from './OrdersExpanded'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useUrlParams } from '../hooks/useUrlParams'

interface User {
  email: string
  admin: boolean
  access_control: string
  tablename: string
  username: string
  lastLogin: string
}

interface MetricsDataItem {
  Data: string
  Cluster: string
  Investimento: number
  Cliques: number
  Sessoes: number
  Adicoes_ao_Carrinho: number
  Pedidos: number
  Receita: number
  Pedidos_Pagos: number
  Receita_Paga: number
  Novos_Clientes: number
  Receita_Novos_Clientes: number
}

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

  // Função para calcular datas dos últimos 30 dias
  const getLast30Days = () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 30)
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  }

  // Função para buscar goals
  const fetchGoals = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

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

  // Função para calcular run rate da meta do mês
  const calculateRunRate = () => {
    if (!goals || !totals.receitaPaga) return null

    const currentDate = new Date()
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    
    const monthlyGoal = goals.goals?.metas_mensais?.[currentMonth]?.meta_receita_paga
    if (!monthlyGoal) return null

    // Calcular dias no mês atual
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const currentDay = currentDate.getDate()
    
    // Calcular run rate (receita atual * dias no mês / dia atual)
    const runRate = (totals.receitaPaga * daysInMonth) / currentDay
    
    // Calcular percentual da meta
    const percentageOfGoal = (runRate / monthlyGoal) * 100
    
    return {
      runRate,
      monthlyGoal,
      percentageOfGoal,
      currentDay,
      daysInMonth
    }
  }
  
  const [metrics, setMetrics] = useState<MetricsDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const [startDate, setStartDate] = useState<string>(() => {
    const last7Days = getLast7Days()
    return last7Days.start
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const last7Days = getLast7Days()
    return last7Days.end
  })
  const [selectedCluster, setSelectedCluster] = useState<string>('Todos')
  const [selectedTable, setSelectedTable] = useState<string>(user?.tablename || 'coffeemais') // Valor padrão
  const [sortField, setSortField] = useState<string>('receita')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('visao-geral')
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [attributionModel, setAttributionModel] = useState<string>('Último Clique Não Direto')
  
  // Estados para dados históricos
  const [previousMetrics, setPreviousMetrics] = useState<MetricsDataItem[]>([])
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  
  // Estados para goals e run rate
  const [goals, setGoals] = useState<any>(null)
  const [isLoadingGoals, setIsLoadingGoals] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<{
    isOpen: boolean
    trafficCategory: string
  }>({
    isOpen: false,
    trafficCategory: ''
  })
  
  // Estado para controlar pedidos baixados
  const [downloadedOrders, setDownloadedOrders] = useState<Set<string>>(new Set())
  
  // Estado para controlar downloads em andamento
  const [downloadingOrders, setDownloadingOrders] = useState<Set<string>>(new Set())
  
  // Estados para timer de download
  const [downloadStartTimes, setDownloadStartTimes] = useState<Map<string, number>>(new Map())
  const [downloadMessages, setDownloadMessages] = useState<Map<string, string>>(new Map())
  
  // const tokenCheckInterval = useRef<NodeJS.Timeout | null>(null)

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
  }, []) // Removendo getUrlParams da dependência para evitar loop

  // Sincronizar mudanças de estado com a URL
  useEffect(() => {
    updateUrlParams({
      table: selectedTable,
      startDate,
      endDate,
      tab: activeTab,
      cluster: selectedCluster
    })
  }, [selectedTable, startDate, endDate, activeTab, selectedCluster]) // Removendo updateUrlParams da dependência

  // Função para calcular período anterior
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

  // Função para lidar com mudança de aba
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    
    // Se for a aba do funil de conversão, definir período padrão de 30 dias
    if (tab === 'funil-conversao') {
      const last30Days = getLast30Days()
      setStartDate(last30Days.start)
      setEndDate(last30Days.end)
    }
  }

  // Título dinâmico baseado no estado do dashboard
  useDocumentTitle(
    isLoading 
      ? 'Carregando Dashboard... | MyMetricHUB'
      : `Dashboard ${selectedTable} | MyMetricHUB`
  )

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('auth-token')
        if (!token) return

        // Verificar se selectedTable tem um valor válido
        if (!selectedTable || selectedTable.trim() === '') {
          console.log('⚠️ selectedTable está vazio, aguardando...')
          return
        }

        console.log('🔄 Fetching metrics for table:', selectedTable)
        setIsTableLoading(true)
        setIsLoadingPrevious(true)
        
        const requestEndDate = endDate
        const requestStartDate = startDate

        console.log('📊 Request params:', {
          start_date: requestStartDate,
          end_date: requestEndDate,
          table_name: selectedTable
        })

        // Buscar dados do período atual
        const response = await api.getMetrics(token, {
          start_date: requestStartDate,
          end_date: requestEndDate,
          table_name: selectedTable,
          attribution_model: attributionModel
        })

        console.log('✅ Response received:', response)
        console.log('📈 Data length:', response.data?.length || 0)

        setMetrics(response.data || [])
        
        // Buscar dados do período anterior para comparação
        const previousPeriod = getPreviousPeriod()
        console.log('📊 Fetching previous period:', previousPeriod)
        
        try {
          const previousResponse = await api.getMetrics(token, {
            start_date: previousPeriod.start,
            end_date: previousPeriod.end,
            table_name: selectedTable,
            attribution_model: attributionModel
          })
          
          console.log('✅ Previous period response:', previousResponse)
          setPreviousMetrics(previousResponse.data || [])
        } catch (previousError) {
          console.error('❌ Error fetching previous metrics:', previousError)
          setPreviousMetrics([])
        }
        
        setIsLoading(false)
        setIsTableLoading(false)
        setIsLoadingPrevious(false)
      } catch (error) {
        console.error('❌ Error fetching metrics:', error)
        setIsLoading(false)
        setIsTableLoading(false)
        setIsLoadingPrevious(false)
        setMetrics([])
        setPreviousMetrics([])
      }
    }

    fetchMetrics()
    
    // Limpar cache de pedidos quando mudar tabela, datas ou modelo de atribuição
    setDownloadedOrders(new Set())
    setDownloadingOrders(new Set())
  }, [user, selectedTable, startDate, endDate, attributionModel])

  // Verificação periódica do token removida - não é mais necessária
  // useEffect(() => {
  //   const checkToken = async () => {
  //     const token = localStorage.getItem('auth-token')
  //     if (token) {
  //       try {
  //         const isValid = await api.validateToken(token)
  //         if (!isValid) {
  //           console.log('🔐 Token inválido detectado na verificação periódica, deslogando...')
  //           onLogout()
  //         }
  //       } catch (error) {
  //         console.error('❌ Erro na verificação periódica do token:', error)
  //         onLogout()
  //       }
  //     }
  //   }

  //   // Verificar imediatamente
  //   checkToken()

  //   // Configurar verificação a cada 5 minutos
  //   tokenCheckInterval.current = setInterval(checkToken, 5 * 60 * 1000)

  //   // Cleanup
  //   return () => {
  //     if (tokenCheckInterval.current) {
  //       clearInterval(tokenCheckInterval.current)
  //     }
  //   }
  // }, [onLogout])

  // Limpar estados de timer quando filtros mudarem
  useEffect(() => {
    setDownloadingOrders(new Set())
    setDownloadedOrders(new Set())
    setDownloadStartTimes(new Map())
    setDownloadMessages(new Map())
  }, [selectedTable, startDate, endDate, attributionModel])

  // Buscar goals quando a tabela mudar
  useEffect(() => {
    fetchGoals()
  }, [selectedTable])

  // Filtrar dados por cluster
  const filteredMetrics = selectedCluster === 'Todos' 
    ? metrics 
    : metrics.filter(item => item.Cluster === selectedCluster)

  // Calcular totais e médias baseados nos dados filtrados
  const totals = filteredMetrics.reduce((acc, item) => ({
    receita: acc.receita + item.Receita,
    pedidos: acc.pedidos + item.Pedidos,
    sessoes: acc.sessoes + item.Sessoes,
    novosClientes: acc.novosClientes + item.Novos_Clientes,
    adicoesCarrinho: acc.adicoesCarrinho + item.Adicoes_ao_Carrinho,
    receitaPaga: acc.receitaPaga + item.Receita_Paga,
    pedidosPagos: acc.pedidosPagos + item.Pedidos_Pagos,
    receitaNovosClientes: acc.receitaNovosClientes + item.Receita_Novos_Clientes,
    investimento: acc.investimento + item.Investimento,
    cliques: acc.cliques + item.Cliques
  }), {
    receita: 0,
    pedidos: 0,
    sessoes: 0,
    novosClientes: 0,
    adicoesCarrinho: 0,
    receitaPaga: 0,
    pedidosPagos: 0,
    receitaNovosClientes: 0,
    investimento: 0,
    cliques: 0
  })

  // Calcular totais do período anterior
  const previousTotals = previousMetrics.reduce((acc, item) => ({
    receita: acc.receita + item.Receita,
    pedidos: acc.pedidos + item.Pedidos,
    sessoes: acc.sessoes + item.Sessoes,
    novosClientes: acc.novosClientes + item.Novos_Clientes,
    adicoesCarrinho: acc.adicoesCarrinho + item.Adicoes_ao_Carrinho,
    receitaPaga: acc.receitaPaga + item.Receita_Paga,
    pedidosPagos: acc.pedidosPagos + item.Pedidos_Pagos,
    receitaNovosClientes: acc.receitaNovosClientes + item.Receita_Novos_Clientes,
    investimento: acc.investimento + item.Investimento,
    cliques: acc.cliques + item.Cliques
  }), {
    receita: 0,
    pedidos: 0,
    sessoes: 0,
    novosClientes: 0,
    adicoesCarrinho: 0,
    receitaPaga: 0,
    pedidosPagos: 0,
    receitaNovosClientes: 0,
    investimento: 0,
    cliques: 0
  })

  const avgOrderValue = totals.pedidos > 0 ? totals.receita / totals.pedidos : 0
  const conversionRate = totals.sessoes > 0 ? (totals.pedidos / totals.sessoes) * 100 : 0

  const revenuePerSession = totals.sessoes > 0 ? totals.receita / totals.sessoes : 0
  const newCustomerRate = totals.pedidos > 0 ? (totals.novosClientes / totals.pedidos) * 100 : 0
  // Taxa de adição ao carrinho - limitando a um máximo de 100% por sessão
  const addToCartRate = totals.sessoes > 0 ? Math.min((totals.adicoesCarrinho / totals.sessoes) * 100, 100) : 0

  // Métricas do período anterior
  const previousAvgOrderValue = previousTotals.pedidos > 0 ? previousTotals.receita / previousTotals.pedidos : 0
  const previousConversionRate = previousTotals.sessoes > 0 ? (previousTotals.pedidos / previousTotals.sessoes) * 100 : 0
  const previousRevenuePerSession = previousTotals.sessoes > 0 ? previousTotals.receita / previousTotals.sessoes : 0
  const previousNewCustomerRate = previousTotals.pedidos > 0 ? (previousTotals.novosClientes / previousTotals.pedidos) * 100 : 0
  const previousAddToCartRate = previousTotals.sessoes > 0 ? Math.min((previousTotals.adicoesCarrinho / previousTotals.sessoes) * 100, 100) : 0

  // Calcular run rate da meta do mês
  const runRateData = calculateRunRate()

  // Preparar dados para a timeline baseados nos dados filtrados
  const timelineData = filteredMetrics
    .reduce((acc, item) => {
      const existingDate = acc.find(d => d.date === item.Data)
      if (existingDate) {
        existingDate.sessions += item.Sessoes
        existingDate.revenue += item.Receita
        existingDate.clicks += item.Cliques
        existingDate.addToCart += item.Adicoes_ao_Carrinho
        existingDate.orders += item.Pedidos
        existingDate.newCustomers += item.Novos_Clientes
        existingDate.paidOrders += item.Pedidos_Pagos
        existingDate.paidRevenue += item.Receita_Paga
        existingDate.newCustomerRevenue += item.Receita_Novos_Clientes
        existingDate.investment += item.Investimento
      } else {
        acc.push({
          date: item.Data,
          sessions: item.Sessoes,
          revenue: item.Receita,
          clicks: item.Cliques,
          addToCart: item.Adicoes_ao_Carrinho,
          orders: item.Pedidos,
          newCustomers: item.Novos_Clientes,
          paidOrders: item.Pedidos_Pagos,
          paidRevenue: item.Receita_Paga,
          newCustomerRevenue: item.Receita_Novos_Clientes,
          investment: item.Investimento
        })
      }
      return acc
    }, [] as { 
      date: string; 
      sessions: number; 
      revenue: number;
      clicks: number;
      addToCart: number;
      orders: number;
      newCustomers: number;
      paidOrders: number;
      paidRevenue: number;
      newCustomerRevenue: number;
      investment: number;
    }[])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Obter clusters únicos
  const clusters = [...new Set(metrics.map(item => item.Cluster))]

  // Agrupar dados por cluster
  const groupedMetrics = filteredMetrics.reduce((acc, item) => {
    const cluster = item.Cluster
    if (!acc[cluster]) {
      acc[cluster] = []
    }
    acc[cluster].push(item)
    return acc
  }, {} as { [key: string]: MetricsDataItem[] })

  // Calcular totais por cluster
  const clusterTotals = Object.entries(groupedMetrics).map(([cluster, items]) => {
    const totals = items.reduce((acc, item) => ({
      sessoes: acc.sessoes + item.Sessoes,
      adicoesCarrinho: acc.adicoesCarrinho + item.Adicoes_ao_Carrinho,
      pedidos: acc.pedidos + item.Pedidos,
      receita: acc.receita + item.Receita,
      novosClientes: acc.novosClientes + item.Novos_Clientes,
      receitaPaga: acc.receitaPaga + item.Receita_Paga,
      pedidosPagos: acc.pedidosPagos + item.Pedidos_Pagos,
      receitaNovosClientes: acc.receitaNovosClientes + item.Receita_Novos_Clientes,
      investimento: acc.investimento + item.Investimento,
      cliques: acc.cliques + item.Cliques
    }), {
      sessoes: 0,
      adicoesCarrinho: 0,
      pedidos: 0,
      receita: 0,
      novosClientes: 0,
      receitaPaga: 0,
      pedidosPagos: 0,
      receitaNovosClientes: 0,
      investimento: 0,
      cliques: 0
    })

    return {
      cluster,
      totals,
      items
    }
  })

  // Calcular percentual de vendas do cluster "🍪 Perda de Cookies"
  const cookieLossCluster = clusterTotals.find(cluster => cluster.cluster === '🍪 Perda de Cookies')
  const calculatedCookieLossPercentage = totals.pedidos > 0 && cookieLossCluster 
    ? (cookieLossCluster.totals.pedidos / totals.pedidos) * 100 
    : 0

  // Estado para controlar a visibilidade do alerta
  const [cookieLossPercentage, setCookieLossPercentage] = useState(calculatedCookieLossPercentage)

  // Atualizar o estado quando o cálculo mudar
  useEffect(() => {
    setCookieLossPercentage(calculatedCookieLossPercentage)
  }, [calculatedCookieLossPercentage])

  // Função de ordenação
  const sortData = (data: typeof clusterTotals) => {
    return [...data].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'cluster':
          aValue = a.cluster
          bValue = b.cluster
          break
        case 'sessoes':
          aValue = a.totals.sessoes
          bValue = b.totals.sessoes
          break
        case 'adicoesCarrinho':
          aValue = a.totals.adicoesCarrinho
          bValue = b.totals.adicoesCarrinho
          break
        case 'pedidos':
          aValue = a.totals.pedidos
          bValue = b.totals.pedidos
          break
        case 'receita':
          aValue = a.totals.receita
          bValue = b.totals.receita
          break
        case 'receitaPaga':
          aValue = a.totals.receitaPaga
          bValue = b.totals.receitaPaga
          break
        case 'novosClientes':
          aValue = a.totals.novosClientes
          bValue = b.totals.novosClientes
          break
        case 'receitaNovosClientes':
          aValue = a.totals.receitaNovosClientes
          bValue = b.totals.receitaNovosClientes
          break
        case 'investimento':
          aValue = a.totals.investimento
          bValue = b.totals.investimento
          break
        case 'cliques':
          aValue = a.totals.cliques
          bValue = b.totals.cliques
          break
        case 'pedidosPagos':
          aValue = a.totals.pedidosPagos
          bValue = b.totals.pedidosPagos
          break
        case 'taxaConversao':
          aValue = a.totals.sessoes > 0 ? (a.totals.pedidos / a.totals.sessoes) * 100 : 0
          bValue = b.totals.sessoes > 0 ? (b.totals.pedidos / b.totals.sessoes) * 100 : 0
          break
        default:
          aValue = a.cluster
          bValue = b.cluster
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  // Dados ordenados
  const sortedClusterTotals = sortData(clusterTotals)
  
  // Paginação - mostrar apenas 10 registros inicialmente
  const displayedRecords = showAllRecords ? sortedClusterTotals : sortedClusterTotals.slice(0, 10)
  const hasMoreRecords = sortedClusterTotals.length > 10

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Formatar número
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Calcular crescimento (simulado)
  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? 100 : 0 // Se não havia dados antes e agora há, crescimento de 100%
    }
    if (current === 0) {
      return previous > 0 ? -100 : 0 // Se havia dados antes e agora não há, queda de 100%
    }
    return ((current - previous) / previous) * 100
  }

  // Função para lidar com ordenação
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Função para baixar pedidos
  const handleDownloadOrders = async (trafficCategory: string) => {
    const cacheKey = `${selectedTable}-${trafficCategory}-${startDate}-${endDate}-${attributionModel}`
    
    // Se já está baixando, não fazer nada
    if (downloadingOrders.has(cacheKey)) {
      return
    }
    
    // Se já foi baixado, apenas abrir o modal
    if (downloadedOrders.has(cacheKey)) {
      handleExpandOrders(trafficCategory)
      return
    }
    
    try {
      // Marcar como baixando e iniciar timer
      setDownloadingOrders(prev => new Set(prev).add(cacheKey))
      setDownloadStartTimes(prev => new Map(prev).set(cacheKey, Date.now()))
      setDownloadMessages(prev => new Map(prev).set(cacheKey, 'Iniciando download...'))
      
      // Iniciar timer decrescente (60 segundos)
      let timeLeft = 60
      const timerInterval = setInterval(() => {
        timeLeft--
        
        // Atualizar mensagens baseadas no tempo restante
        setDownloadMessages(prev => {
          const newMessages = new Map(prev)
          let message = 'Baixando pedidos...'
          
          if (timeLeft >= 50) {
            message = 'Iniciando download...'
          } else if (timeLeft >= 40) {
            message = 'Processando dados...'
          } else if (timeLeft >= 20) {
            message = 'Analisando atribuições...'
          } else if (timeLeft >= 10) {
            message = 'Finalizando download...'
          } else if (timeLeft >= 5) {
            message = 'Quase pronto...'
          } else if (timeLeft > 0) {
            message = 'Finalizando...'
          } else {
            message = 'Aguarde...'
          }
          
          newMessages.set(cacheKey, message)
          return newMessages
        })
        
        // Parar timer quando chegar a 0
        if (timeLeft <= 0) {
          clearInterval(timerInterval)
        }
      }, 1000)
      
      const token = localStorage.getItem('auth-token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }
      
      // Preparar parâmetros baseados no modelo de atribuição
      const requestParams: any = {
        start_date: startDate,
        end_date: endDate,
        table_name: selectedTable,
        limit: 100
      }
      
      // Usar parâmetro correto baseado no modelo de atribuição
      if (attributionModel === 'Primeiro Clique') {
        requestParams.fs_traffic_category = trafficCategory
      } else {
        requestParams.traffic_category = trafficCategory
      }
      
      console.log('🔄 Baixando pedidos com parâmetros:', requestParams)
      
      // Fazer a requisição para baixar os dados
      await api.getOrders(token, requestParams)
      
      // Limpar timer
      clearInterval(timerInterval)
      
      // Marcar como baixado
      setDownloadedOrders(prev => new Set(prev).add(cacheKey))
      
      // Limpar estados de timer
      setDownloadStartTimes(prev => {
        const newStartTimes = new Map(prev)
        newStartTimes.delete(cacheKey)
        return newStartTimes
      })
      setDownloadMessages(prev => {
        const newMessages = new Map(prev)
        newMessages.delete(cacheKey)
        return newMessages
      })
      
      // Abrir o modal automaticamente após o download
      handleExpandOrders(trafficCategory)
      
    } catch (error) {
      console.error('Erro ao baixar pedidos:', error)
      // Em caso de erro, não marcar como baixado
    } finally {
      // Remover do estado de download
      setDownloadingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(cacheKey)
        return newSet
      })
      
      // Limpar estados de timer em caso de erro
      setDownloadStartTimes(prev => {
        const newStartTimes = new Map(prev)
        newStartTimes.delete(cacheKey)
        return newStartTimes
      })
      setDownloadMessages(prev => {
        const newMessages = new Map(prev)
        newMessages.delete(cacheKey)
        return newMessages
      })
    }
  }

  // Função para expandir pedidos (agora só abre o modal)
  const handleExpandOrders = (trafficCategory: string) => {
    setExpandedOrders({
      isOpen: true,
      trafficCategory
    })
  }

  // Função para fechar pedidos expandidos
  const handleCloseOrders = () => {
    setExpandedOrders({
      isOpen: false,
      trafficCategory: ''
    })
  }

  const RunRateHighlight = ({ runRateData, isLoadingGoals }: { runRateData: any, isLoadingGoals: boolean }) => {
    if (isLoadingGoals) {
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
            <Target className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <h3 className="text-base font-semibold text-gray-700">Run Rate da Meta</h3>
            <p className="text-xs text-gray-500">Meta não disponível</p>
          </div>
        </div>
      )
    }

    const { runRate, monthlyGoal, percentageOfGoal, currentDay, daysInMonth } = runRateData
    const isOnTrack = percentageOfGoal >= 100
    const progressWidth = Math.min(percentageOfGoal, 100)

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <Target className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Run Rate da Meta</h2>
              <p className="text-xs text-gray-600">Projeção mensal</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-md text-center ${
            isOnTrack 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <p className="text-xs font-medium">
              {isOnTrack ? 'No caminho' : 'Atrasado'}
            </p>
            <p className="text-xs text-gray-600">
              {currentDay}/{daysInMonth}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-4">
          {/* Run Rate Projetado */}
          <div className="text-center">
            <p className="text-xs font-medium text-gray-600 mb-1">Run Rate</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(runRate)}</p>
          </div>

          {/* Meta Mensal */}
          <div className="text-center">
            <p className="text-xs font-medium text-gray-600 mb-1">Meta</p>
            <p className="text-base font-bold text-gray-700">{formatCurrency(monthlyGoal)}</p>
          </div>

          {/* Progresso */}
          <div className="text-center">
            <p className="text-xs font-medium text-gray-600 mb-1">Progresso</p>
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className={`text-lg font-bold ${
                isOnTrack ? 'text-green-600' : 'text-red-600'
              }`}>
                {percentageOfGoal.toFixed(1)}%
              </span>
              {isOnTrack ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isOnTrack ? 'bg-green-600' : 'bg-red-600'
                }`}
                style={{ width: `${progressWidth}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Baseado em {currentDay} dias</span>
            <span className={`font-medium ${
              isOnTrack ? 'text-green-600' : 'text-red-600'
            }`}>
              {isOnTrack ? 'Meta será atingida' : 'Meta em risco'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    growth, 
    format = 'number',
    color = 'blue' 
  }: {
    title: string
    value: number
    icon: any
    growth?: number
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
      blue: 'bg-gray-300',
      green: 'bg-gray-300',
      purple: 'bg-gray-300',
      orange: 'bg-gray-300',
      red: 'bg-gray-300'
    }

    return (
      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} text-gray-700`}>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando métricas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Logo size="xl" />
            </div>
            
            <div className="flex items-center gap-8 sm:gap-10 relative z-30">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{user?.username || 'Usuário'}</span>
              </div>
              <div className="w-28 sm:w-48">
                <TableSelector
                  currentTable={selectedTable}
                  onTableChange={setSelectedTable}
                  useCSV={user?.access_control === 'all' || user?.tablename === 'all'} // Usar CSV para usuários com acesso total
                  availableTables={
                    user?.access_control === 'all' || user?.tablename === 'all'
                      ? [] // Deixar vazio para usar apenas o CSV via useClientList
                      : [user?.tablename || '']
                  }
                />
              </div>
              <button
                onClick={onLogout}
                className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors relative z-40 min-w-[40px] sm:min-w-auto"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
                          <button
                onClick={() => handleTabChange('visao-geral')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'visao-geral'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Visão Geral
                </div>
              </button>
                          <button
                onClick={() => handleTabChange('funil-conversao')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'funil-conversao'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Funil de Conversão
                </div>
              </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mobile Full Width Container for Big Numbers */}
        <div className="md:hidden -mx-4 px-4">
          {/* Run Rate Highlight Mobile */}
          <div className="mb-6">
            <RunRateHighlight 
              runRateData={runRateData} 
              isLoadingGoals={isLoadingGoals} 
            />
          </div>
          
          <div className="mb-8">
            <MetricsCarousel
              metrics={[
                {
                  title: "Sessões",
                  value: totals.sessoes,
                  icon: Globe,
                  growth: calculateGrowth(totals.sessoes, previousTotals.sessoes),
                  color: "blue"
                },
                {
                  title: "Pedidos Pagos",
                  value: totals.pedidosPagos,
                  icon: CheckCircle,
                  growth: calculateGrowth(totals.pedidosPagos, previousTotals.pedidosPagos),
                  color: "green"
                },
                {
                  title: "Receita Paga",
                  value: totals.receitaPaga,
                  icon: Coins,
                  growth: calculateGrowth(totals.receitaPaga, previousTotals.receitaPaga),
                  format: "currency",
                  color: "purple"
                },
                {
                  title: "Ticket Médio",
                  value: avgOrderValue,
                  icon: DollarSign,
                  format: "currency",
                  color: "orange",
                  growth: calculateGrowth(avgOrderValue, previousAvgOrderValue)
                },

                {
                  title: "Taxa de Conversão",
                  value: conversionRate,
                  icon: Sparkles,
                  format: "percentage" as const,
                  color: "red",
                  growth: calculateGrowth(conversionRate, previousConversionRate)
                },
                {
                  title: "Taxa de Adição ao Carrinho",
                  value: addToCartRate,
                  icon: ShoppingBag,
                  format: "percentage" as const,
                  color: "blue",
                  growth: calculateGrowth(addToCartRate, previousAddToCartRate)
                },
                {
                  title: "Receita por Sessão",
                  value: revenuePerSession,
                  icon: ArrowUpCircle,
                  format: "currency" as const,
                  color: "green",
                  growth: calculateGrowth(revenuePerSession, previousRevenuePerSession)
                },
                {
                  title: "Taxa de Novos Clientes",
                  value: newCustomerRate,
                  icon: Users2,
                  format: "percentage" as const,
                  color: "purple",
                  growth: calculateGrowth(newCustomerRate, previousNewCustomerRate)
                }
              ]}
            />
          </div>
        </div>

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

        {/* Filters */}
        <div className="mb-6">
          {/* Mobile Collapsible Header */}
          <div className="md:hidden mb-3">
            <button
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className="flex items-center justify-between w-full p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-gray-900 block">Filtros</span>
                  <span className="text-xs text-gray-500">
                    {selectedCluster === 'Todos' ? 'Todos os clusters' : selectedCluster} • {startDate} a {endDate}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">
                  {filtersCollapsed ? 'Expandir' : 'Recolher'}
                </span>
                {filtersCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </button>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
          </div>
          
          {/* Filters Content */}
          <div className={`transition-all duration-300 ease-in-out relative ${
            filtersCollapsed ? 'md:block hidden' : 'block'
          }`}>
            {/* Mobile Layout - Vertical */}
            <div className="md:hidden space-y-3">
              {/* Date Range Picker Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onDateRangeChange={(start, end) => {
                    setStartDate(start)
                    setEndDate(end)
                  }}
                />
              </div>
              
              {/* Cluster Filter Card */}
              {activeTab !== 'funil-conversao' && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Cluster
                  </label>
                  <div className="relative">
                    <PieChart className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <select
                      value={selectedCluster}
                      onChange={(e) => {
                        console.log('🔍 Dashboard - Mobile Cluster changed to:', e.target.value)
                        setSelectedCluster(e.target.value)
                      }}
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="Todos">Todos os clusters</option>
                      {clusters.map(cluster => (
                        <option key={cluster} value={cluster}>{cluster}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}


            </div>

            {/* Desktop Layout - Horizontal */}
            <div className="hidden md:flex flex-row items-start gap-4">
              {/* Date Range Picker */}
              <div className="flex-1">
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onDateRangeChange={(start, end) => {
                    setStartDate(start)
                    setEndDate(end)
                  }}
                />
              </div>
              
              {/* Cluster Filter */}
              {activeTab !== 'funil-conversao' && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cluster
                  </label>
                  <div className="relative">
                    <PieChart className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <select
                      value={selectedCluster}
                      onChange={(e) => {
                        console.log('🔍 Dashboard - Desktop Cluster changed to:', e.target.value)
                        setSelectedCluster(e.target.value)
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="Todos">Todos os clusters</option>
                      {clusters.map(cluster => (
                        <option key={cluster} value={cluster}>{cluster}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}


            </div>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'visao-geral' && (
          <>
            {/* No Data Message */}
            {metrics.length === 0 && !isTableLoading ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
                <p className="text-gray-600 mb-4">
                  Não foram encontrados dados para a tabela <strong>{selectedTable}</strong> no período selecionado.
                </p>
                <div className="text-sm text-gray-500">
                  <p>Tente selecionar uma tabela diferente ou verificar se há dados disponíveis.</p>
                </div>
              </div>
            ) : (
              <>

                {/* Metrics Grid (Desktop) */}
                <div className="hidden md:block">
                  {/* Run Rate Highlight */}
                  <RunRateHighlight 
                    runRateData={runRateData} 
                    isLoadingGoals={isLoadingGoals} 
                  />

                  {/* Metrics Grid - First Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <MetricCard
                      title="Sessões"
                      value={totals.sessoes}
                      icon={Globe}
                      growth={calculateGrowth(totals.sessoes, previousTotals.sessoes)}
                      color="blue"
                    />
                    <MetricCard
                      title="Pedidos Pagos"
                      value={totals.pedidosPagos}
                      icon={CheckCircle}
                      growth={calculateGrowth(totals.pedidosPagos, previousTotals.pedidosPagos)}
                      color="green"
                    />
                    <MetricCard
                      title="Receita Paga"
                      value={totals.receitaPaga}
                      icon={Coins}
                      growth={calculateGrowth(totals.receitaPaga, previousTotals.receitaPaga)}
                      format="currency"
                      color="purple"
                    />
                    <MetricCard
                      title="Ticket Médio"
                      value={avgOrderValue}
                      icon={DollarSign}
                      format="currency"
                      color="orange"
                      growth={calculateGrowth(avgOrderValue, previousAvgOrderValue)}
                    />
                  </div>

                  {/* Metrics Grid - Second Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <MetricCard
                      title="Taxa de Conversão"
                      value={conversionRate}
                      icon={Sparkles}
                      format="percentage"
                      color="red"
                      growth={calculateGrowth(conversionRate, previousConversionRate)}
                    />
                    <MetricCard
                      title="Taxa de Adição ao Carrinho"
                      value={addToCartRate}
                      icon={ShoppingBag}
                      format="percentage"
                      color="blue"
                      growth={calculateGrowth(addToCartRate, previousAddToCartRate)}
                    />
                    <MetricCard
                      title="Receita por Sessão"
                      value={revenuePerSession}
                      icon={ArrowUpCircle}
                      format="currency"
                      color="green"
                      growth={calculateGrowth(revenuePerSession, previousRevenuePerSession)}
                    />
                    <MetricCard
                      title="Taxa de Novos Clientes"
                      value={newCustomerRate}
                      icon={Users2}
                      format="percentage"
                      color="purple"
                      growth={calculateGrowth(newCustomerRate, previousNewCustomerRate)}
                    />
                  </div>
                </div>



                {/* Timeline Chart */}
                <div className="mb-6">
                  <TimelineChart 
                    data={timelineData}
                    title="Evolução de Sessões e Receita"
                  />
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    {/* Desktop Header */}
                    <div className="hidden md:flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Dados Agrupados por Cluster</h2>
                        <p className="text-sm text-gray-500">Métricas consolidadas por cluster</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Attribution Model Selector */}
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                            Modelo de Atribuição:
                          </label>
                          <div className="relative">
                            <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <select
                              value={attributionModel}
                              onChange={(e) => {
                                console.log('🔍 Dashboard - Table Attribution Model changed to:', e.target.value)
                                setAttributionModel(e.target.value)
                              }}
                              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
                            >
                              <option value="Último Clique Não Direto">Último Clique Não Direto</option>
                              <option value="Primeiro Clique">Primeiro Clique</option>
                            </select>
                          </div>
                        </div>
                        {isTableLoading && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span>Carregando...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile Header */}
                    <div className="md:hidden">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">Dados Agrupados por Cluster</h2>
                          <p className="text-sm text-gray-500">Métricas consolidadas por cluster</p>
                        </div>
                        {isTableLoading && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span>Carregando...</span>
                          </div>
                        )}
                      </div>
                      {/* Mobile Attribution Model Selector */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                          Modelo de Atribuição:
                        </label>
                        <div className="relative flex-1">
                          <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <select
                            value={attributionModel}
                            onChange={(e) => {
                              console.log('🔍 Dashboard - Mobile Table Attribution Model changed to:', e.target.value)
                              setAttributionModel(e.target.value)
                            }}
                            className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            <option value="Último Clique Não Direto">Último Clique Não Direto</option>
                            <option value="Primeiro Clique">Primeiro Clique</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <SortableHeader
                            field="cluster"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Cluster
                          </SortableHeader>
                          <SortableHeader
                            field="sessoes"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Sessões
                          </SortableHeader>
                          <SortableHeader
                            field="adicoesCarrinho"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Carrinho
                          </SortableHeader>
                          <SortableHeader
                            field="pedidos"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Pedidos
                          </SortableHeader>
                          <SortableHeader
                            field="receita"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Receita
                          </SortableHeader>
                          <SortableHeader
                            field="receitaPaga"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Receita Paga
                          </SortableHeader>
                          <SortableHeader
                            field="novosClientes"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Novos Clientes
                          </SortableHeader>
                          <SortableHeader
                            field="receitaNovosClientes"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Receita Novos
                          </SortableHeader>
                          <SortableHeader
                            field="pedidosPagos"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Pedidos Pagos
                          </SortableHeader>
                          <SortableHeader
                            field="taxaConversao"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Taxa Conv.
                          </SortableHeader>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {displayedRecords.map((clusterData, index) => {
                          const { cluster, totals } = clusterData
                          const conversionRate = totals.sessoes > 0 ? (totals.pedidos / totals.sessoes) * 100 : 0
                          
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-lg">{cluster}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatNumber(totals.sessoes)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatNumber(totals.adicoesCarrinho)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  <span>{formatNumber(totals.pedidos)}</span>
                                  {totals.pedidos > 0 && (() => {
                                    const cacheKey = `${selectedTable}-${cluster}-${startDate}-${endDate}-${attributionModel}`
                                    const isDownloading = downloadingOrders.has(cacheKey)
                                    const isDownloaded = downloadedOrders.has(cacheKey)
                                    const downloadMessage = downloadMessages.get(cacheKey) || ''
                                    const startTime = downloadStartTimes.get(cacheKey) || 0
                                    const elapsedSeconds = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0
                                    const timeLeft = Math.max(0, 60 - elapsedSeconds)
                                    
                                    return (
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleDownloadOrders(cluster)}
                                          disabled={isDownloading}
                                          className="p-1 hover:bg-blue-100 rounded transition-colors group relative disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={
                                            isDownloading 
                                              ? `${downloadMessage} (${timeLeft}s restantes)` 
                                              : isDownloaded 
                                                ? `Ver ${formatNumber(totals.pedidos)} pedido${totals.pedidos !== 1 ? 's' : ''} baixados`
                                                : `Baixar ${formatNumber(totals.pedidos)} pedido${totals.pedidos !== 1 ? 's' : ''}`
                                          }
                                        >
                                          {isDownloading ? (
                                            <div className="flex items-center gap-1">
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                              <span className="text-xs text-blue-600 font-medium">{timeLeft}s</span>
                                            </div>
                                          ) : isDownloaded ? (
                                            <Eye className="w-3 h-3 text-green-600 group-hover:text-green-700" />
                                          ) : (
                                            <Download className="w-3 h-3 text-blue-600 group-hover:text-blue-700" />
                                          )}
                                          {isDownloaded && (
                                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                                          )}
                                        </button>
                                        {isDownloading && (
                                          <div className="text-xs text-gray-500 max-w-24 truncate">
                                            {downloadMessage}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(totals.receita)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{formatCurrency(totals.receitaPaga)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">{formatNumber(totals.novosClientes)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{formatCurrency(totals.receitaNovosClientes)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-teal-600">{formatNumber(totals.pedidosPagos)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">{conversionRate.toFixed(2)}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Botão para expandir/recolher registros */}
                  {hasMoreRecords && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => setShowAllRecords(!showAllRecords)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {showAllRecords ? (
                          <>
                            <span>Mostrar menos</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>Mostrar todos os {sortedClusterTotals.length} registros</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Funil de Conversão Tab */}
        {activeTab === 'funil-conversao' && (
          <ConversionFunnel 
            selectedTable={selectedTable}
            startDate={startDate}
            endDate={endDate}
            attributionModel={attributionModel}
          />
        )}
      </main>
      <DebugMetrics 
        metrics={metrics}
        selectedTable={selectedTable}
        isLoading={isLoading}
        isTableLoading={isTableLoading}
      />

      {/* Orders Expanded Modal */}
      <OrdersExpanded
        isOpen={expandedOrders.isOpen}
        onClose={handleCloseOrders}
        trafficCategory={expandedOrders.trafficCategory}
        startDate={startDate}
        endDate={endDate}
        tableName={selectedTable}
        attributionModel={attributionModel}
      />
    </div>
  )
}

export default Dashboard 