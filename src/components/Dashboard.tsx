import { useState, useEffect } from 'react'
import { 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Globe,
  Coins,
  Sparkles,
  ArrowUpCircle,
  Users2,
  CheckCircle,
  ShoppingBag,
  DollarSign,
  Target,
  Download,
  Eye,
  Filter,
  Database,
  EyeOff,
  Package,
  ShoppingCart,
  TrendingUp,
  Activity,
  Users
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import Logo from './Logo'
import TableSelector from './TableSelector'
import DateRangePicker from './DateRangePicker'

import SortableHeader from './SortableHeader'
import DebugMetrics from './DebugMetrics'
import TimelineChart from './TimelineChart'
import MetricsCarousel from './MetricsCarousel'
import ConversionFunnel from './ConversionFunnel'
import OrdersExpanded from './OrdersExpanded'
import DetailedData from './DetailedData'
import HavaianasDashboard from './HavaianasDashboard'
import ABTesting from './ABTesting'
import ProductsDashboard from './ProductsDashboard'
import PaidMediaDashboard from './PaidMediaDashboard'
import RealtimeData from './RealtimeData'
import SessionStatus from './SessionStatus'
import UsersConfig from './UsersConfig'
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
  


  // Função para calcular datas do mês atual
  const getCurrentMonth = () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(1) // Primeiro dia do mês atual
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  }

  // Função para calcular datas dos últimos 60 dias
  const getLast60Days = () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 60)
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  }

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

  // Função para buscar goals
  const fetchGoals = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

      // Validar que selectedTable não é "all" - não deve consultar diretamente
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

      // Validar que selectedTable não é "all" - não deve consultar diretamente
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
        table_name: selectedTable,
        attribution_model: attributionModel
      })

      const currentMonthReceitaPaga = response.data?.reduce((total: number, item: any) => total + item.Receita_Paga, 0) || 0
      
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
  
  const [metrics, setMetrics] = useState<MetricsDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const [startDate, setStartDate] = useState<string>(() => {
    const currentMonth = getCurrentMonth()
    return currentMonth.start
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const currentMonth = getCurrentMonth()
    return currentMonth.end
  })
  const [selectedTable, setSelectedTable] = useState<string>(() => {
    // Se o usuário tem tablename: 'all', usar um cliente padrão em vez de "all"
    if (user?.tablename === 'all') {
      return 'coffeemais' // Cliente padrão para usuários com acesso total
    }
    return user?.tablename || 'coffeemais'
  })
  const [sortField, setSortField] = useState<string>('receita')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [hideClientName, setHideClientName] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('visao-geral')
  const [showMobileTabMenu, setShowMobileTabMenu] = useState(false)

  const [attributionModel, setAttributionModel] = useState<string>('Último Clique Não Direto')
  
  // Estado para filtro de cluster
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  
  // Estados para dados históricos
  const [previousMetrics, setPreviousMetrics] = useState<MetricsDataItem[]>([])
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  
  // Estados para goals e run rate
  const [goals, setGoals] = useState<any>(null)
  const [isLoadingGoals, setIsLoadingGoals] = useState(false)
  const [currentMonthData, setCurrentMonthData] = useState<any>(null)
  const [isLoadingCurrentMonth, setIsLoadingCurrentMonth] = useState(false)
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
  
  // Estados para controle de dados
  const [totalRecords, setTotalRecords] = useState(0)
  
  // Carregar parâmetros da URL na inicialização
  useEffect(() => {
    const urlParams = getUrlParams()
    
    // Aplicar parâmetros da URL aos estados
    if (urlParams.table && urlParams.table !== 'all') {
      setSelectedTable(urlParams.table)
    }
    if (urlParams.tab) {
      setActiveTab(urlParams.tab)
    }
    
    // Definir datas baseado na aba ativa ou parâmetros da URL
    if (urlParams.startDate && urlParams.endDate) {
      setStartDate(urlParams.startDate)
      setEndDate(urlParams.endDate)
    } else {
      // Usar período padrão baseado na aba ativa
      const currentTab = urlParams.tab || 'visao-geral'
      if (currentTab === 'visao-geral') {
        const currentMonth = getCurrentMonth()
        setStartDate(currentMonth.start)
        setEndDate(currentMonth.end)
      } else if (currentTab === 'funil-conversao') {
        const last60Days = getLast60Days()
        setStartDate(last60Days.start)
        setEndDate(last60Days.end)
      } else if (currentTab === 'dados-detalhados') {
        const last7Days = getLast7Days()
        setStartDate(last7Days.start)
        setEndDate(last7Days.end)
      } else {
        // Fallback para outras abas
        const currentMonth = getCurrentMonth()
        setStartDate(currentMonth.start)
        setEndDate(currentMonth.end)
      }
    }
  }, []) // Removendo getUrlParams da dependência para evitar loop

  // Sincronizar mudanças de estado com a URL
  useEffect(() => {
    updateUrlParams({
      table: selectedTable,
      startDate,
      endDate,
      tab: activeTab,
      cluster: 'Todos' // Removido para simplificar
    })
  }, [selectedTable, startDate, endDate, activeTab]) // Removendo updateUrlParams da dependência

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
    
    // Definir período padrão baseado na aba selecionada
    if (tab === 'visao-geral') {
      const currentMonth = getCurrentMonth()
      setStartDate(currentMonth.start)
      setEndDate(currentMonth.end)
    } else if (tab === 'funil-conversao') {
      const last60Days = getLast60Days()
      setStartDate(last60Days.start)
      setEndDate(last60Days.end)
    } else if (tab === 'dados-detalhados') {
      const last7Days = getLast7Days()
      setStartDate(last7Days.start)
      setEndDate(last7Days.end)
    }
  }

  // Título dinâmico baseado no estado do dashboard
  useDocumentTitle(
    isLoading 
      ? 'Carregando Dashboard... | MyMetricHUB'
      : `Dashboard ${hideClientName ? 'Cliente Selecionado' : selectedTable} | MyMetricHUB`
  )



  // Função para buscar métricas com retry em caso de timeout
  const fetchMetricsWithRetry = async (token: string, params: any, isRetry = false) => {
    try {
      const response = await api.getMetrics(token, params)
      return response
    } catch (error) {
      // Verificar se é um erro de timeout
      const isTimeout = error instanceof Error && (
        error.message.includes('timeout') || 
        error.message.includes('Timeout') ||
        error.message.includes('demorou muito tempo')
      )
      
      if (isTimeout && !isRetry) {
        console.log('⏰ Timeout detectado, tentando novamente em 5 segundos...')
        
        // Aguardar 5 segundos
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        console.log('🔄 Tentando novamente...')
        return await fetchMetricsWithRetry(token, params, true)
      }
      
      throw error
    }
  }

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

        // Validar que selectedTable não é "all" - não deve consultar diretamente
        if (!validateTableName(selectedTable)) {
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

        // Buscar dados do período atual com retry
        const response = await fetchMetricsWithRetry(token, {
          start_date: requestStartDate,
          end_date: requestEndDate,
          table_name: selectedTable,
          attribution_model: attributionModel
        })

        console.log('✅ Response received:', response)
        console.log('📈 Data length:', response.data?.length || 0)

        setMetrics(response.data || [])
        setTotalRecords(response.data?.length || 0)
        
        // Buscar dados do período anterior para comparação
        const previousPeriod = getPreviousPeriod()
        console.log('📊 Fetching previous period:', previousPeriod)
        
        try {
          const previousResponse = await fetchMetricsWithRetry(token, {
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

  // Buscar dados do mês atual quando a tabela ou modelo de atribuição mudar
  useEffect(() => {
    fetchCurrentMonthData()
  }, [selectedTable, attributionModel])

  // Filtrar dados por cluster
  const filteredMetrics = selectedCluster 
    ? metrics.filter(item => item.Cluster === selectedCluster)
    : metrics

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
        case 'taxaAdicaoCarrinho':
          aValue = a.totals.sessoes > 0 ? (a.totals.adicoesCarrinho / a.totals.sessoes) * 100 : 0
          bValue = b.totals.sessoes > 0 ? (b.totals.adicoesCarrinho / b.totals.sessoes) * 100 : 0
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
      
      // Validar que selectedTable não é "all" - não deve consultar diretamente
      if (!validateTableName(selectedTable)) {
        return
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
                  hideClientName={hideClientName}
                />
              </div>
              <button
                onClick={() => setHideClientName(!hideClientName)}
                className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors relative z-40"
                title={hideClientName ? "Mostrar nome do cliente" : "Ocultar nome do cliente"}
              >
                {hideClientName ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
              <SessionStatus onLogout={onLogout} user={user} />
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
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
              onClick={() => handleTabChange('midia-paga')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'midia-paga'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Mídia Paga
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
            <button
              onClick={() => handleTabChange('dados-detalhados')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dados-detalhados'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Dados Detalhados
              </div>
            </button>
            {selectedTable === 'havaianas' && (
              <button
                onClick={() => handleTabChange('havaianas')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'havaianas'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Product Scoring
                </div>
              </button>
            )}
            <button
              onClick={() => handleTabChange('produtos')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'produtos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Produtos
              </div>
            </button>
            <button
              onClick={() => handleTabChange('ab-testing')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'ab-testing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Testes A/B
              </div>
            </button>
            <button
              onClick={() => handleTabChange('tempo-real')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'tempo-real'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Tempo Real
              </div>
            </button>
            <button
              onClick={() => handleTabChange('configuracao')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'configuracao'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Configuração
              </div>
            </button>
          </nav>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            {/* Mobile Tab Selector */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Aba atual:</span>
                <span className="text-sm text-blue-600 font-semibold">
                  {activeTab === 'visao-geral' && 'Visão Geral'}
                  {activeTab === 'midia-paga' && 'Mídia Paga'}
                  {activeTab === 'funil-conversao' && 'Funil de Conversão'}
                  {activeTab === 'dados-detalhados' && 'Dados Detalhados'}
                  {activeTab === 'havaianas' && 'Product Scoring'}
                  {activeTab === 'produtos' && 'Produtos'}
                  {activeTab === 'ab-testing' && 'Testes A/B'}
                  {activeTab === 'tempo-real' && 'Tempo Real'}
                  {activeTab === 'configuracao' && 'Configuração'}
                </span>
              </div>
              
              {/* Mobile Tab Menu Button */}
              <button
                onClick={() => setShowMobileTabMenu(!showMobileTabMenu)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Abrir menu de abas"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Mobile Tab Menu Dropdown */}
            {showMobileTabMenu && (
              <>
                {/* Overlay para fechar o menu */}
                <div 
                  className="fixed inset-0 z-40 md:hidden" 
                  onClick={() => setShowMobileTabMenu(false)}
                />
                
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 md:hidden">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        handleTabChange('visao-geral')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'visao-geral'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5" />
                        <span>Visão Geral</span>
                        {activeTab === 'visao-geral' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        handleTabChange('midia-paga')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'midia-paga'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5" />
                        <span>Mídia Paga</span>
                        {activeTab === 'midia-paga' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        handleTabChange('funil-conversao')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'funil-conversao'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Filter className="w-5 h-5" />
                        <span>Funil de Conversão</span>
                        {activeTab === 'funil-conversao' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        handleTabChange('dados-detalhados')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'dados-detalhados'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5" />
                        <span>Dados Detalhados</span>
                        {activeTab === 'dados-detalhados' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>

                    {selectedTable === 'havaianas' && (
                      <button
                        onClick={() => {
                          handleTabChange('havaianas')
                          setShowMobileTabMenu(false)
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          activeTab === 'havaianas'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5" />
                          <span>Product Scoring</span>
                          {activeTab === 'havaianas' && (
                            <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        handleTabChange('produtos')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'produtos'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="w-5 h-5" />
                        <span>Produtos</span>
                        {activeTab === 'produtos' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleTabChange('ab-testing')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'ab-testing'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Target className="w-5 h-5" />
                        <span>Testes A/B</span>
                        {activeTab === 'ab-testing' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        handleTabChange('tempo-real')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'tempo-real'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5" />
                        <span>Tempo Real</span>
                        {activeTab === 'tempo-real' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        handleTabChange('configuracao')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'configuracao'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        <span>Configuração</span>
                        {activeTab === 'configuracao' && (
                          <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Mobile Horizontal Scroll Tabs (Alternative) */}
            <div className="flex overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              <div className="flex space-x-2 min-w-max">
                <button
                  onClick={() => handleTabChange('visao-geral')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'visao-geral'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    <span>Visão Geral</span>
                  </div>
                </button>
                
                <button
                  onClick={() => handleTabChange('midia-paga')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'midia-paga'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Mídia</span>
                  </div>
                </button>
                
                <button
                  onClick={() => handleTabChange('funil-conversao')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'funil-conversao'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    <span>Funil</span>
                  </div>
                </button>
                
                <button
                  onClick={() => handleTabChange('dados-detalhados')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'dados-detalhados'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span>Dados</span>
                  </div>
                </button>
                
                {selectedTable === 'havaianas' && (
                  <button
                    onClick={() => handleTabChange('havaianas')}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === 'havaianas'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      <span>Scoring</span>
                    </div>
                  </button>
                )}
                
                <button
                  onClick={() => handleTabChange('produtos')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'produtos'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    <span>Produtos</span>
                  </div>
                </button>
                <button
                  onClick={() => handleTabChange('ab-testing')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'ab-testing'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>A/B</span>
                  </div>
                </button>

                <button
                  onClick={() => handleTabChange('tempo-real')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'tempo-real'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Live</span>
                  </div>
                </button>

                <button
                  onClick={() => handleTabChange('configuracao')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'configuracao'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>Config</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtros de Data - Global para todas as abas (exceto tempo-real) */}
        {activeTab !== 'tempo-real' && activeTab !== 'configuracao' && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Filtros de Período</h3>
                <p className="text-sm text-gray-600">
                  {activeTab === 'visao-geral' && 'Padrão: Mês atual até hoje'}
                  {activeTab === 'funil-conversao' && 'Padrão: Últimos 60 dias até hoje'}
                  {activeTab === 'dados-detalhados' && 'Padrão: Últimos 7 dias até hoje'}
                  {!['visao-geral', 'funil-conversao', 'dados-detalhados'].includes(activeTab) && 'Padrão: Mês atual até hoje'}
                </p>
              </div>
              {activeTab !== 'configuracao' && (
                <div className="flex items-center gap-4">
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onDateRangeChange={(start, end) => {
                      setStartDate(start)
                      setEndDate(end)
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'visao-geral' && (
          <>
            {/* Mobile Full Width Container for Big Numbers */}
            <div className="md:hidden -mx-4 px-4">
              {/* Run Rate Highlight Mobile - Enhanced */}
              <div className="mb-8 bg-gradient-to-br from-blue-50/30 to-purple-50/30 -mx-4 px-4 py-6 rounded-b-3xl">
                <div className="mb-2">
                  <h3 className="text-lg font-bold text-gray-800 text-center mb-1">
                    📊 Resumo do Mês
                  </h3>
                  <p className="text-sm text-gray-600 text-center">
                    Acompanhe o progresso das suas metas
                  </p>
                </div>
                
                <RunRateHighlight 
                  runRateData={runRateData} 
                  isLoadingGoals={isLoadingGoals}
                  isLoadingCurrentMonth={isLoadingCurrentMonth}
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
                      title: "Novos Clientes",
                      value: newCustomerRate,
                      icon: Users2,
                      format: "percentage",
                      color: "indigo",
                      growth: calculateGrowth(newCustomerRate, previousNewCustomerRate)
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
                    }
                  ]}
                />
              </div>
            </div>

            {/* No Data Message */}
            {metrics.length === 0 && !isTableLoading ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
                <p className="text-gray-600 mb-4">
                  Não foram encontrados dados para a tabela <strong>{hideClientName ? 'Cliente Selecionado' : selectedTable}</strong> no período selecionado.
                </p>
                <div className="text-sm text-gray-500">
                  <p>Tente selecionar uma tabela diferente ou verificar se há dados disponíveis.</p>
                </div>
              </div>
            ) : (
              <>

                {/* Metrics Grid (Desktop) */}
                <div className="hidden md:block">
                  {/* Run Rate Highlight - Enhanced */}
                  <div className="mb-6 bg-gradient-to-br from-blue-50/30 to-purple-50/30 rounded-2xl p-6 border border-blue-100/50">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        📊 Resumo do Mês
                      </h3>
                      <p className="text-gray-600">
                        Acompanhe o progresso das suas metas e projeções
                      </p>
                    </div>
                    
                    <RunRateHighlight 
                      runRateData={runRateData} 
                      isLoadingGoals={isLoadingGoals}
                      isLoadingCurrentMonth={isLoadingCurrentMonth}
                    />
                  </div>

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
                      title="Novos Clientes"
                      value={newCustomerRate}
                      icon={Users2}
                      format="percentage"
                      color="indigo"
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
                        <p className="text-sm text-gray-500">
                          Métricas consolidadas por cluster
                                                      {totalRecords > 0 && (
                              <span className="ml-2 text-xs text-gray-400">
                                • {totalRecords.toLocaleString()} registros
                              </span>
                            )}
                        </p>
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
                          <p className="text-sm text-gray-500">
                            Métricas consolidadas por cluster
                            {totalRecords > 0 && (
                              <span className="ml-2 text-xs text-gray-400">
                                • {totalRecords.toLocaleString()} registros
                              </span>
                            )}
                          </p>
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
                            field="taxaAdicaoCarrinho"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Taxa Carrinho
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
                            field="taxaConversao"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Taxa Conv.
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
                            field="pedidosPagos"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            Pedidos Pagos
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
                            field="taxaReceitaPaga"
                            currentSortField={sortField}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                          >
                            % Receita Paga
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

                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {displayedRecords.map((clusterData, index) => {
                          const { cluster, totals } = clusterData
                          const conversionRate = totals.sessoes > 0 ? (totals.pedidos / totals.sessoes) * 100 : 0
                          
                          return (
                            <tr 
                              key={index} 
                              className={`hover:bg-gray-50 cursor-pointer transition-all duration-200 group ${
                                selectedCluster === cluster ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                              }`}
                              onClick={() => {
                                if (selectedCluster === cluster) {
                                  setSelectedCluster('') // Desmarcar se já está selecionado
                                } else {
                                  setSelectedCluster(cluster) // Selecionar o cluster
                                }
                              }}
                              title={selectedCluster === cluster ? "Clique para remover filtro" : "Clique para filtrar por este cluster"}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className={`text-lg transition-colors ${
                                    selectedCluster === cluster ? 'text-blue-600 font-semibold' : 'group-hover:text-blue-600'
                                  }`}>
                                    {cluster}
                                  </span>
                                  <Filter className={`w-3 h-3 transition-opacity ${
                                    selectedCluster === cluster 
                                      ? 'text-blue-600 opacity-100' 
                                      : 'text-gray-400 opacity-0 group-hover:opacity-100'
                                  }`} />
                                  {selectedCluster === cluster && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                      Filtrado
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatNumber(totals.sessoes)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                {totals.sessoes > 0 ? ((totals.adicoesCarrinho / totals.sessoes) * 100).toFixed(1) : '0.0'}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatNumber(totals.adicoesCarrinho)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">{conversionRate.toFixed(2)}%</td>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-teal-600">{formatNumber(totals.pedidosPagos)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatCurrency(totals.receita)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{formatCurrency(totals.receitaPaga)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-600">
                                {totals.receita > 0 ? ((totals.receitaPaga / totals.receita) * 100).toFixed(1) : '0.0'}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">{formatNumber(totals.novosClientes)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{formatCurrency(totals.receitaNovosClientes)}</td>
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

        {/* Dados Detalhados Tab */}
        {activeTab === 'dados-detalhados' && (
          <DetailedData 
            selectedTable={selectedTable}
            startDate={startDate}
            endDate={endDate}
            attributionModel={attributionModel}
          />
        )}

        {/* Havaianas Tab */}
        {activeTab === 'havaianas' && (
          <HavaianasDashboard 
            selectedTable={selectedTable}
            startDate={startDate}
            endDate={endDate}
          />
        )}

        {/* Produtos Tab */}
        {activeTab === 'produtos' && (
          <ProductsDashboard 
            selectedTable={selectedTable}
          />
        )}

        {/* Testes A/B Tab */}
        {activeTab === 'ab-testing' && (
          <ABTesting 
            selectedTable={selectedTable}
            startDate={startDate}
            endDate={endDate}
          />
        )}

        {/* Mídia Paga Tab */}
        {activeTab === 'midia-paga' && (
          <PaidMediaDashboard 
            selectedTable={selectedTable}
            startDate={startDate}
            endDate={endDate}
          />
        )}

        {/* Dados em Tempo Real Tab */}
        {activeTab === 'tempo-real' && (
          <RealtimeData 
            selectedTable={selectedTable}
          />
        )}

        {/* Configuração Tab */}
        {activeTab === 'configuracao' && (
          <UsersConfig 
            selectedTable={selectedTable}
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