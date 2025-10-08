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
  Users,
  ChevronDown,
  Truck
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import Logo from './Logo'
import LoadingScreen from './LoadingScreen'
import SpotlightUnified from './SpotlightUnified'
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
import FreteDashboard from './FreteDashboard'
import RealtimeData from './RealtimeData'
import SessionStatus from './SessionStatus'
import Configuracao from './UsersConfig'
import TokenDebug from './TokenDebug'
import OrdersByLocation from './OrdersByLocation'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useUrlParams } from '../hooks/useUrlParams'
import { getDefaultPeriodForTab, getDatePresets, formatDateToString } from '../utils/dateUtils'
import OrdersTab from './OrdersTab'

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
  Plataforma: string
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
  


  // Token de autenticação disponível para filhos
  const authToken = typeof window !== 'undefined' ? (localStorage.getItem('auth-token') || '') : ''
  // Função para calcular datas do mês atual (mantida para compatibilidade)
  const getCurrentMonth = () => {
    const presets = getDatePresets()
    return {
      start: presets.thisMonth.start,
      end: presets.thisMonth.end
    }
  }

  // Função para calcular datas dos últimos 60 dias (mantida para compatibilidade)
  const getLast60Days = () => {
    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 59)
    return {
      start: formatDateToString(startDate),
      end: formatDateToString(today)
    }
  }

  // Função para calcular datas dos últimos 7 dias (mantida para compatibilidade)
  const getLast7Days = () => {
    const presets = getDatePresets()
    return {
      start: presets.last7days.start,
      end: presets.last7days.end
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

  
  const [metrics, setMetrics] = useState<MetricsDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedTable, setSelectedTable] = useState<string>(() => {
    // Inicializar vazio e deixar o useEffect definir o valor correto quando o user for carregado
    return ''
  })
  const [sortField, setSortField] = useState<string>('receita')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [hideClientName, setHideClientName] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('visao-geral')
  const [showMobileTabMenu, setShowMobileTabMenu] = useState(false)
  const [showSubmenu, setShowSubmenu] = useState(false)

  const [attributionModel, setAttributionModel] = useState<string>('Último Clique Não Direto')
  
  // Estado para alternar entre TACoS e ROAS
  const [showROAS, setShowROAS] = useState(false)
  
  // Estado para filtro de cluster
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  
  // Estado para filtro de plataforma
  const [selectedPlataforma, setSelectedPlataforma] = useState<string>('')
  
  // Estado para média móvel na timeline
  const [showMovingAverage, setShowMovingAverage] = useState<boolean>(false)
  
  // Estados para dados históricos
  const [previousMetrics, setPreviousMetrics] = useState<MetricsDataItem[]>([])
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  
  // Estados para goals e run rate
  const [goals, setGoals] = useState<any>(null)
  const [isLoadingGoals, setIsLoadingGoals] = useState(false)
  const [currentMonthData, setCurrentMonthData] = useState<any>(null)
  const [isLoadingCurrentMonth, setIsLoadingCurrentMonth] = useState(false)
  
  // Estados para modal de meta
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [goalFormData, setGoalFormData] = useState({
    month: '',
    goal_value: ''
  })
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
  
  // Atualizar selectedTable baseado no localStorage login-response
  useEffect(() => {
    try {
      const loginResponseStr = localStorage.getItem('login-response')
      
      if (loginResponseStr) {
        const loginResponse = JSON.parse(loginResponseStr)
        
        console.log('🔄 Updating selectedTable based on login-response:', {
          table_name: loginResponse.table_name,
          access_control: loginResponse.access_control,
          admin: loginResponse.admin
        })
        
        // Se o usuário tem table_name = "all" OU access_control = "all", mostrar dropdown e usar cliente padrão
        if (loginResponse.table_name === 'all' || loginResponse.access_control === 'all') {
          setSelectedTable('coffeemais') // Cliente padrão para usuários com acesso total
          console.log('🎯 Usuário com acesso total, cliente padrão definido:', 'coffeemais')
        } else if (loginResponse.table_name) {
          // Usuário tem acesso específico a um cliente - direcionar diretamente
          setSelectedTable(loginResponse.table_name)
          console.log('🎯 Usuário direcionado diretamente para cliente:', loginResponse.table_name)
        } else {
          console.error('❌ Usuário sem table_name válido no login-response:', loginResponse.table_name)
          setSelectedTable('')
        }
      } else {
        console.log('⚠️ No login-response found in localStorage')
        setSelectedTable('')
      }
    } catch (error) {
      console.error('❌ Error parsing login-response:', error)
      setSelectedTable('')
    }
  }, []) // Executar apenas uma vez na inicialização

  // Carregar parâmetros da URL na inicialização (após a definição do selectedTable baseado no login-response)
  useEffect(() => {
    const urlParams = getUrlParams()
    
    // Aplicar parâmetros da URL aos estados (apenas se não for "all")
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
      const defaultPeriod = getDefaultPeriodForTab(currentTab)
      setStartDate(defaultPeriod.start)
      setEndDate(defaultPeriod.end)
    }
  }, []) // Executar apenas uma vez na inicialização



  // Debug: Log das props do TableSelector
  useEffect(() => {
    try {
      const loginResponseStr = localStorage.getItem('login-response')
      const loginResponse = loginResponseStr ? JSON.parse(loginResponseStr) : null
      
      console.log('🔍 Dashboard - TableSelector props:', {
        currentTable: selectedTable,
        useCSV: loginResponse?.admin || loginResponse?.access_control === 'all' || loginResponse?.table_name === 'all',
        availableTables: loginResponse?.admin || loginResponse?.access_control === 'all' || loginResponse?.table_name === 'all'
          ? [] // Deixar vazio para usar apenas o CSV via useClientList
          : [loginResponse?.table_name || ''],
        loginResponse: loginResponse ? {
          email: loginResponse.email,
          access_control: loginResponse.access_control,
          table_name: loginResponse.table_name,
          admin: loginResponse.admin
        } : null
      })
    } catch (error) {
      console.error('❌ Error parsing login-response for TableSelector:', error)
    }
  }, [selectedTable])

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
    // Verificar se usuário não-admin está tentando acessar aba de configuração
    if (tab === 'configuracao' && !user?.admin) {
      console.log('🚫 Usuário não-admin tentou acessar aba de configuração, redirecionando...')
      setActiveTab('visao-geral') // Redirecionar para visão geral
      return
    }
    
    setActiveTab(tab)
    
    // Definir período padrão baseado na aba selecionada
    const defaultPeriod = getDefaultPeriodForTab(tab)
    setStartDate(defaultPeriod.start)
    setEndDate(defaultPeriod.end)
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
  }, [user, selectedTable, startDate, endDate, attributionModel, activeTab])

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

  // Limpar filtros quando a tabela (cliente) mudar
  useEffect(() => {
    setSelectedPlataforma('')
    setSelectedCluster('')
  }, [selectedTable])

  // Filtrar dados por cluster e plataforma
  const filteredMetrics = metrics.filter(item => {
    const clusterMatch = !selectedCluster || item.Cluster === selectedCluster
    const plataformaMatch = !selectedPlataforma || item.Plataforma === selectedPlataforma
    return clusterMatch && plataformaMatch
  })

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

  // Calcular ROAS usando receita paga geral e investimento total
  const roas = totals.investimento > 0 ? totals.receitaPaga / totals.investimento : 0
  
  // Debug logs
  console.log('🔍 ROAS calculation:', {
    receitaPaga: totals.receitaPaga,
    investimento: totals.investimento,
    roas: roas
  })

  // Métricas do período anterior
  const previousAvgOrderValue = previousTotals.pedidos > 0 ? previousTotals.receita / previousTotals.pedidos : 0
  const previousConversionRate = previousTotals.sessoes > 0 ? (previousTotals.pedidos / previousTotals.sessoes) * 100 : 0
  const previousRevenuePerSession = previousTotals.sessoes > 0 ? previousTotals.receita / previousTotals.sessoes : 0
  const previousNewCustomerRate = previousTotals.pedidos > 0 ? (previousTotals.novosClientes / previousTotals.pedidos) * 100 : 0
  const previousAddToCartRate = previousTotals.sessoes > 0 ? Math.min((previousTotals.adicoesCarrinho / previousTotals.sessoes) * 100, 100) : 0

  // Calcular run rate da meta do mês
  const runRateData = calculateRunRate()

  // Função para calcular média móvel
  const calculateMovingAverage = (data: number[], windowSize: number = 7) => {
    if (data.length < windowSize) return []
    
    const result = []
    for (let i = windowSize - 1; i < data.length; i++) {
      const window = data.slice(i - windowSize + 1, i + 1)
      const average = window.reduce((sum, val) => sum + val, 0) / windowSize
      result.push(Math.round(average))
    }
    return result
  }

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
        existingDate.averageTicket = existingDate.orders > 0 ? existingDate.revenue / existingDate.orders : 0
      } else {
        const orders = item.Pedidos
        const revenue = item.Receita
        acc.push({
          date: item.Data,
          sessions: item.Sessoes,
          revenue: revenue,
          clicks: item.Cliques,
          addToCart: item.Adicoes_ao_Carrinho,
          orders: orders,
          newCustomers: item.Novos_Clientes,
          paidOrders: item.Pedidos_Pagos,
          paidRevenue: item.Receita_Paga,
          newCustomerRevenue: item.Receita_Novos_Clientes,
          investment: item.Investimento,
          averageTicket: orders > 0 ? revenue / orders : 0
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
      averageTicket: number;
    }[])
    .sort((a, b) => {
      // Ordenar datas de forma segura para evitar problemas de timezone
      const [yearA, monthA, dayA] = a.date.split('-').map(Number)
      const [yearB, monthB, dayB] = b.date.split('-').map(Number)
      const dateA = new Date(yearA, monthA - 1, dayA)
      const dateB = new Date(yearB, monthB - 1, dayB)
      return dateA.getTime() - dateB.getTime()
    })

  // Aplicar média móvel se ativada
  const processedTimelineData = showMovingAverage ? (() => {
    // Se não há dados suficientes para média móvel, retornar array vazio
    if (timelineData.length < 7) return []
    
    // Extrair todas as métricas
    const sessions = timelineData.map(d => d.sessions)
    const revenue = timelineData.map(d => d.revenue)
    const clicks = timelineData.map(d => d.clicks)
    const addToCart = timelineData.map(d => d.addToCart)
    const orders = timelineData.map(d => d.orders)
    const newCustomers = timelineData.map(d => d.newCustomers)
    const paidOrders = timelineData.map(d => d.paidOrders)
    const paidRevenue = timelineData.map(d => d.paidRevenue)
    const newCustomerRevenue = timelineData.map(d => d.newCustomerRevenue)
    const investment = timelineData.map(d => d.investment)
    const averageTicket = timelineData.map(d => d.averageTicket)
    
    // Calcular média móvel para todas as métricas
    const sessionsMA = calculateMovingAverage(sessions)
    const revenueMA = calculateMovingAverage(revenue)
    const clicksMA = calculateMovingAverage(clicks)
    const addToCartMA = calculateMovingAverage(addToCart)
    const ordersMA = calculateMovingAverage(orders)
    const newCustomersMA = calculateMovingAverage(newCustomers)
    const paidOrdersMA = calculateMovingAverage(paidOrders)
    const paidRevenueMA = calculateMovingAverage(paidRevenue)
    const newCustomerRevenueMA = calculateMovingAverage(newCustomerRevenue)
    const investmentMA = calculateMovingAverage(investment)
    const averageTicketMA = calculateMovingAverage(averageTicket)
    
    // Retornar apenas os dados a partir do 7º dia (índice 6)
    return timelineData.slice(6).map((item, index) => ({
      ...item,
      sessionsMA: sessionsMA[index],
      revenueMA: revenueMA[index],
      clicksMA: clicksMA[index],
      addToCartMA: addToCartMA[index],
      ordersMA: ordersMA[index],
      newCustomersMA: newCustomersMA[index],
      paidOrdersMA: paidOrdersMA[index],
      paidRevenueMA: paidRevenueMA[index],
      newCustomerRevenueMA: newCustomerRevenueMA[index],
      investmentMA: investmentMA[index],
      averageTicketMA: averageTicketMA[index]
    }))
  })() : timelineData

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
      <LoadingScreen message="Carregando métricas..." />
    )
  }

  // Definir abas visíveis baseado no cliente e permissões do usuário
  const visibleTabs = [
    'visao-geral',
    'midia-paga',
    'funil-conversao',
    'dados-detalhados',
    'produtos',
    'tempo-real',
    'pedidos'
  ]

  // Abas que ficam no submenu
  const submenuTabs = [
    ...(selectedTable === 'havaianas' ? ['havaianas'] : []),
    'frete',
    'ab-testing',
    ...(user?.admin ? ['configuracao'] : [])
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Logo size="xl" />
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 relative z-30">
              {/* Spotlight Unificado - Sempre visível */}
              {(() => {
                try {
                  const loginResponseStr = localStorage.getItem('login-response')
                  const loginResponse = loginResponseStr ? JSON.parse(loginResponseStr) : null
                  const hasAccessToAll = loginResponse?.table_name === 'all' || loginResponse?.access_control === 'all'
                  
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-28 sm:w-48">
                        <SpotlightUnified
                          currentTable={selectedTable}
                          onTableChange={setSelectedTable}
                          activeTab={activeTab}
                          onTabChange={setActiveTab}
                          useCSV={hasAccessToAll} // Usar CSV apenas para usuários com acesso total
                          availableTables={
                            hasAccessToAll
                              ? [] // Deixar vazio para usar apenas o CSV via useClientList
                              : [loginResponse?.table_name || '']
                          }
                          hideClientName={hasAccessToAll ? hideClientName : true} // Ocultar nome do cliente se não tem acesso total
                          user={user}
                        />
                      </div>
                      {hasAccessToAll && (
                        <button
                          onClick={() => setHideClientName(!hideClientName)}
                          className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors relative z-40"
                          title="Ocultar dropdown de clientes"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                } catch (error) {
                  console.error('❌ Error parsing login-response for Spotlight display:', error)
                  return null
                }
              })()}
              
              {/* Indicador do Cliente Atual - apenas para usuários com acesso limitado */}
              {(() => {
                try {
                  const loginResponseStr = localStorage.getItem('login-response')
                  const loginResponse = loginResponseStr ? JSON.parse(loginResponseStr) : null
                  const hasAccessToAll = loginResponse?.table_name === 'all' || loginResponse?.access_control === 'all'
                  
                  // Mostrar indicador apenas para usuários com acesso limitado
                  if (!hasAccessToAll && loginResponse?.table_name) {
                    return (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                        <Database className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700">
                          {loginResponse.table_name}
                        </span>
                      </div>
                    )
                  }
                  
                  return null
                } catch (error) {
                  console.error('❌ Error parsing login-response for client indicator:', error)
                  return null
                }
              })()}
              
              <SessionStatus onLogout={onLogout} user={user} />
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex">
            {/* Abas visíveis */}
            {visibleTabs.map((tabId) => {
              const tabConfig = {
                'visao-geral': { label: 'Visão Geral', icon: BarChart3 },
                'midia-paga': { label: 'Mídia Paga', icon: TrendingUp },
                'funil-conversao': { label: 'Funil de Conversão', icon: Filter },
                'dados-detalhados': { label: 'Dados Detalhados', icon: Database },
                'frete': { label: 'Frete', icon: Truck },
                'produtos': { label: 'Produtos', icon: ShoppingCart },
                'tempo-real': { label: 'Tempo Real', icon: Activity },
                'pedidos': { label: 'Pedidos', icon: ShoppingBag }
              }[tabId]

              if (!tabConfig) return null

              const IconComponent = tabConfig.icon
              const isActive = activeTab === tabId

              return (
                <button
                  key={tabId}
                  onClick={() => handleTabChange(tabId)}
                  className={`flex-1 py-3 px-6 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <IconComponent className="w-4 h-4" />
                    {tabConfig.label}
                  </div>
                </button>
              )
            })}

            {/* Submenu para abas adicionais */}
            {submenuTabs.length > 0 && (
              <div className="relative flex-1">
                <button
                  onClick={() => setShowSubmenu(!showSubmenu)}
                  className={`w-full py-3 px-6 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center justify-center gap-2 ${
                    submenuTabs.includes(activeTab)
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>Mais</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showSubmenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown do submenu */}
                {showSubmenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {submenuTabs.map((tabId) => {
                      const tabConfig = {
                        'havaianas': { label: 'Product Scoring', icon: Package },
                        'frete': { label: 'Frete', icon: Truck },
                        'ab-testing': { label: 'Testes A/B', icon: Target },
                        'configuracao': { label: 'Configuração', icon: Users }
                      }[tabId]

                      if (!tabConfig) return null

                      const IconComponent = tabConfig.icon
                      const isActive = activeTab === tabId

                      return (
                        <button
                          key={tabId}
                          onClick={() => {
                            handleTabChange(tabId)
                            setShowSubmenu(false)
                          }}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center gap-3 ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                          {tabConfig.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
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
                  {activeTab === 'frete' && 'Frete'}
                  {activeTab === 'havaianas' && 'Product Scoring'}
                  {activeTab === 'produtos' && 'Produtos'}
                  {activeTab === 'ab-testing' && 'Testes A/B'}
                  {activeTab === 'tempo-real' && 'Tempo Real'}
                  {activeTab === 'configuracao' && user?.admin && 'Configuração'}
                  {activeTab === 'pedidos' && 'Pedidos'}
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

                    <button
                      onClick={() => {
                        handleTabChange('frete')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'frete'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Truck className="w-5 h-5" />
                        <span>Frete</span>
                        {activeTab === 'frete' && (
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

                    <button
                      onClick={() => {
                        handleTabChange('pedidos')
                        setShowMobileTabMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'pedidos'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="w-5 h-5" />
                        <span>Pedidos</span>
                        {activeTab === 'pedidos' && (
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

                <button
                  onClick={() => handleTabChange('frete')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'frete'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    <span>Frete</span>
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

                {/* Botão de Configuração - apenas para usuários admin */}
                {user?.admin && (
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
                )}

                {/* Botão de Token Debug - apenas para usuários admin */}
                {user?.admin && (
                  <button
                    onClick={() => handleTabChange('tokendebug')}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === 'tokendebug'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>Token Debug</span>
                    </div>
                  </button>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtros de Data - Global para todas as abas (exceto tempo-real e produtos) */}
        {activeTab !== 'tempo-real' && activeTab !== 'configuracao' && activeTab !== 'produtos' && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Filtros de Período</h3>
                <p className="text-sm text-gray-600">
                  {activeTab === 'visao-geral' && 'Padrão: Mês atual até hoje'}
                  {activeTab === 'funil-conversao' && 'Padrão: Últimos 60 dias até hoje'}
                  {activeTab === 'dados-detalhados' && 'Padrão: Últimos 7 dias até hoje'}
                  {activeTab === 'pedidos' && 'Padrão: Hoje'}
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

              {/* Filtro de Plataforma - Mobile */}
              <div className="mb-4 bg-white rounded-lg shadow-sm p-3 border border-gray-200">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-gray-700">Filtros:</span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="plataforma-filter-mobile" className="text-xs text-gray-600">
                      Plataforma:
                    </label>
                    <div className="relative">
                      <select
                        id="plataforma-filter-mobile"
                        value={selectedPlataforma}
                        onChange={(e) => setSelectedPlataforma(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Todas</option>
                        {Array.from(new Set(metrics.filter(item => item.Plataforma).map(item => item.Plataforma))).map(plataforma => (
                          <option key={plataforma} value={plataforma}>
                            {plataforma}
                          </option>
                        ))}
                      </select>
                      {selectedPlataforma && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mb-8">
                <MetricsCarousel
                  metrics={[
                    {
                      title: "Pedidos Totais",
                      value: totals.pedidos,
                      icon: ShoppingBag,
                      growth: calculateGrowth(totals.pedidos, previousTotals.pedidos),
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
                      title: "Receita Total",
                      value: totals.receita,
                      icon: DollarSign,
                      growth: calculateGrowth(totals.receita, previousTotals.receita),
                      format: "currency",
                      color: "purple"
                    },
                    {
                      title: "Receita Paga",
                      value: totals.receitaPaga,
                      icon: Coins,
                      growth: calculateGrowth(totals.receitaPaga, previousTotals.receitaPaga),
                      format: "currency",
                      color: "orange"
                    },
                    {
                      title: "Sessões",
                      value: totals.sessoes,
                      icon: Globe,
                      growth: calculateGrowth(totals.sessoes, previousTotals.sessoes),
                      color: "blue"
                    },
                    {
                      title: "Investimento Total",
                      value: totals.investimento,
                      icon: Target,
                      growth: calculateGrowth(totals.investimento, previousTotals.investimento),
                      format: "currency",
                      color: "red"
                    },
                    {
                      title: showROAS ? "ROAS (Receita/Invest)" : "TACoS (Invest/Receita)",
                      value: showROAS ? roas : (totals.receitaPaga > 0 ? (totals.investimento / totals.receitaPaga) * 100 : 0),
                      icon: TrendingUp,
                      growth: showROAS ? 0 : calculateGrowth(
                        totals.receitaPaga > 0 ? (totals.investimento / totals.receitaPaga) * 100 : 0,
                        previousTotals.receitaPaga > 0 ? (previousTotals.investimento / previousTotals.receitaPaga) * 100 : 0
                      ),
                      format: showROAS ? "number" : "percentage",
                      color: "green"
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

                  {/* Filtro de Plataforma - Desktop */}
                  <div className="mb-4 bg-white rounded-lg shadow-sm p-3 border border-gray-200">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-700">Filtros:</span>
                      <div className="flex items-center gap-2">
                        <label htmlFor="plataforma-filter-desktop" className="text-xs text-gray-600">
                          Plataforma:
                        </label>
                        <div className="relative">
                          <select
                            id="plataforma-filter-desktop"
                            value={selectedPlataforma}
                            onChange={(e) => setSelectedPlataforma(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Todas</option>
                            {Array.from(new Set(metrics.filter(item => item.Plataforma).map(item => item.Plataforma))).map(plataforma => (
                              <option key={plataforma} value={plataforma}>
                                {plataforma}
                              </option>
                            ))}
                          </select>
                          {selectedPlataforma && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pedidos e Receita Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <MetricCard
                      title="Pedidos Totais"
                      value={totals.pedidos}
                      icon={ShoppingBag}
                      growth={calculateGrowth(totals.pedidos, previousTotals.pedidos)}
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
                      title="Receita Total"
                      value={totals.receita}
                      icon={DollarSign}
                      growth={calculateGrowth(totals.receita, previousTotals.receita)}
                      format="currency"
                      color="purple"
                    />
                    <MetricCard
                      title="Receita Paga"
                      value={totals.receitaPaga}
                      icon={Coins}
                      growth={calculateGrowth(totals.receitaPaga, previousTotals.receitaPaga)}
                      format="currency"
                      color="orange"
                    />
                  </div>

                  {/* Outras Métricas Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <MetricCard
                      title="Sessões"
                      value={totals.sessoes}
                      icon={Globe}
                      growth={calculateGrowth(totals.sessoes, previousTotals.sessoes)}
                      color="blue"
                    />
                    <MetricCard
                      title="Investimento Total"
                      value={totals.investimento}
                      icon={Target}
                      growth={calculateGrowth(totals.investimento, previousTotals.investimento)}
                      format="currency"
                      color="red"
                    />
                    <div 
                      className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 hover:shadow-xl transition-all duration-200 cursor-pointer"
                      onClick={() => setShowROAS(!showROAS)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-lg bg-gray-300 text-gray-700">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-gray-500">Clique para alternar</span>
                        </div>
                      </div>
                      <div className="mb-2">
                        <h3 className="text-sm font-medium text-gray-600">
                          {showROAS ? 'ROAS (Receita/Invest)' : 'TACoS (Invest/Receita)'}
                        </h3>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {showROAS 
                          ? `${roas.toFixed(2)}x`
                          : `${(totals.receitaPaga > 0 ? (totals.investimento / totals.receitaPaga) * 100 : 0).toFixed(1)}%`
                        }
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {showROAS 
                          ? `R$ ${formatNumber(totals.receitaPaga)} / R$ ${formatNumber(totals.investimento)}`
                          : `R$ ${formatNumber(totals.investimento)} / R$ ${formatNumber(totals.receitaPaga)}`
                        }
                      </div>
                    </div>
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
                  <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Evolução de Sessões e Receita</h3>
                      <div className="flex items-center gap-2">
                        <label htmlFor="moving-average-toggle" className="text-sm text-gray-600">
                          Média Móvel (7 dias):
                        </label>
                        <input
                          id="moving-average-toggle"
                          type="checkbox"
                          checked={showMovingAverage}
                          onChange={(e) => setShowMovingAverage(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                      </div>
                    </div>
                    <TimelineChart 
                      data={processedTimelineData}
                      title=""
                      showMovingAverage={showMovingAverage}
                    />
                  </div>
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

                {/* Orders by Location */}
                <div className="mt-6">
                  <OrdersByLocation
                    selectedTable={selectedTable}
                    startDate={startDate}
                    endDate={endDate}
                  />
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
          <>
            {console.log('🔄 Rendering ProductsDashboard with selectedTable:', selectedTable)}
            <ProductsDashboard 
              selectedTable={selectedTable}
            />
          </>
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
            token={authToken}
          />
        )}

        {/* Frete Tab */}
        {activeTab === 'frete' && (
          <FreteDashboard 
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

        {/* Configuração Tab - apenas para usuários admin */}
        {activeTab === 'configuracao' && user?.admin && (
          <Configuracao 
            selectedTable={selectedTable}
          />
        )}

        {/* Token Debug Tab - apenas para usuários admin */}
        {activeTab === 'tokendebug' && user?.admin && (
          <TokenDebug />
        )}

        {activeTab === 'pedidos' && (
          <OrdersTab selectedTable={selectedTable} startDate={startDate} endDate={endDate} />
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

export default Dashboard 