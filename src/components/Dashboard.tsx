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
  DollarSign
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
import { useDocumentTitle } from '../hooks/useDocumentTitle'

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
  const [metrics, setMetrics] = useState<MetricsDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const [startDate, setStartDate] = useState<string>('2025-07-27')
  const [endDate, setEndDate] = useState<string>('2025-08-03')
  const [selectedCluster, setSelectedCluster] = useState<string>('Todos')
  const [selectedTable, setSelectedTable] = useState<string>(user?.tablename || 'coffeemais')
  const [sortField, setSortField] = useState<string>('receita')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('visao-geral')
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)

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
      : `Dashboard ${selectedTable === 'coffeemais' ? 'CoffeeMais' : selectedTable === 'constance' ? 'Constance' : selectedTable} | MyMetricHUB`
  )

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('auth-token')
        if (!token) return

        console.log('🔄 Fetching metrics for table:', selectedTable)
        setIsTableLoading(true)
        const requestEndDate = endDate
        const requestStartDate = startDate

        console.log('📊 Request params:', {
          start_date: requestStartDate,
          end_date: requestEndDate,
          table_name: selectedTable
        })

        const response = await api.getMetrics(token, {
          start_date: requestStartDate,
          end_date: requestEndDate,
          table_name: selectedTable
        })

        console.log('✅ Response received:', response)
        console.log('📈 Data length:', response.data?.length || 0)

        setMetrics(response.data || [])
        setIsLoading(false)
        setIsTableLoading(false)
      } catch (error) {
        console.error('❌ Error fetching metrics:', error)
        setIsLoading(false)
        setIsTableLoading(false)
        setMetrics([])
      }
    }

    fetchMetrics()
  }, [user, selectedTable, startDate, endDate])

  // Calcular totais e médias
  const totals = metrics.reduce((acc, item) => ({
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

  // Preparar dados para a timeline
  const timelineData = metrics
    .reduce((acc, item) => {
      const existingDate = acc.find(d => d.date === item.Data)
      if (existingDate) {
        existingDate.sessions += item.Sessoes
        existingDate.revenue += item.Receita
      } else {
        acc.push({
          date: item.Data,
          sessions: item.Sessoes,
          revenue: item.Receita
        })
      }
      return acc
    }, [] as { date: string; sessions: number; revenue: number }[])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Filtrar dados por cluster
  const filteredMetrics = selectedCluster === 'Todos' 
    ? metrics 
    : metrics.filter(item => item.Cluster === selectedCluster)

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
    if (previous === 0 || current === 0) return 0
    return ((current - previous) / previous) * 100
  }

  // Função para lidar com ordenação
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
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
          {growth !== undefined && growth !== 0 && (
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
                  availableTables={
                    user?.tablename === 'all' 
                      ? ['coffeemais', 'constance']
                      : [user?.tablename || 'coffeemais']
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
                  <BarChart3 className="w-4 h-4" />
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
          <div className="mb-8">
            <MetricsCarousel 
              metrics={[
                {
                  title: "Sessões",
                  value: totals.sessoes,
                  icon: Globe,
                  growth: calculateGrowth(totals.sessoes, totals.sessoes * 0.92),
                  color: "blue"
                },
                {
                  title: "Pedidos Pagos",
                  value: totals.pedidosPagos,
                  icon: CheckCircle,
                  growth: calculateGrowth(totals.pedidosPagos, totals.pedidosPagos * 0.95),
                  color: "green"
                },
                {
                  title: "Receita Paga",
                  value: totals.receitaPaga,
                  icon: Coins,
                  growth: calculateGrowth(totals.receitaPaga, totals.receitaPaga * 0.9),
                  format: "currency",
                  color: "purple"
                },
                {
                  title: "Ticket Médio",
                  value: avgOrderValue,
                  icon: DollarSign,
                  format: "currency",
                  color: "orange",
                  growth: calculateGrowth(avgOrderValue, avgOrderValue * 0.93)
                },
                {
                  title: "Taxa de Conversão",
                  value: conversionRate,
                  icon: Sparkles,
                  format: "percentage",
                  color: "red",
                  growth: calculateGrowth(conversionRate, conversionRate * 0.85)
                },
                {
                  title: "Taxa de Adição ao Carrinho",
                  value: addToCartRate,
                  icon: ShoppingBag,
                  format: "percentage",
                  color: "blue",
                  growth: calculateGrowth(addToCartRate, addToCartRate * 0.87)
                },
                {
                  title: "Receita por Sessão",
                  value: revenuePerSession,
                  icon: ArrowUpCircle,
                  format: "currency",
                  color: "green",
                  growth: calculateGrowth(revenuePerSession, revenuePerSession * 0.88)
                },
                {
                  title: "Taxa de Novos Clientes",
                  value: newCustomerRate,
                  icon: Users2,
                  format: "percentage",
                  color: "purple",
                  growth: calculateGrowth(newCustomerRate, newCustomerRate * 0.92)
                }
              ]}
            />
          </div>
        </div>
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
                  {/* Metrics Grid - First Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <MetricCard
                      title="Sessões"
                      value={totals.sessoes}
                      icon={Globe}
                      growth={calculateGrowth(totals.sessoes, totals.sessoes * 0.92)}
                      color="blue"
                    />
                    <MetricCard
                      title="Pedidos Pagos"
                      value={totals.pedidosPagos}
                      icon={CheckCircle}
                      growth={calculateGrowth(totals.pedidosPagos, totals.pedidosPagos * 0.95)}
                      color="green"
                    />
                    <MetricCard
                      title="Receita Paga"
                      value={totals.receitaPaga}
                      icon={Coins}
                      growth={calculateGrowth(totals.receitaPaga, totals.receitaPaga * 0.9)}
                      format="currency"
                      color="purple"
                    />
                    <MetricCard
                      title="Ticket Médio"
                      value={avgOrderValue}
                      icon={DollarSign}
                      format="currency"
                      color="orange"
                      growth={calculateGrowth(avgOrderValue, avgOrderValue * 0.93)}
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
                      growth={calculateGrowth(conversionRate, conversionRate * 0.85)}
                    />
                    <MetricCard
                      title="Taxa de Adição ao Carrinho"
                      value={addToCartRate}
                      icon={ShoppingBag}
                      format="percentage"
                      color="blue"
                      growth={calculateGrowth(addToCartRate, addToCartRate * 0.87)}
                    />
                    <MetricCard
                      title="Receita por Sessão"
                      value={revenuePerSession}
                      icon={ArrowUpCircle}
                      format="currency"
                      color="green"
                      growth={calculateGrowth(revenuePerSession, revenuePerSession * 0.88)}
                    />
                    <MetricCard
                      title="Taxa de Novos Clientes"
                      value={newCustomerRate}
                      icon={Users2}
                      format="percentage"
                      color="purple"
                      growth={calculateGrowth(newCustomerRate, newCustomerRate * 0.92)}
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
                    <div className="flex items-center justify-between">
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatNumber(totals.pedidos)}</td>
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
            selectedCluster={selectedCluster}
          />
        )}
      </main>
      <DebugMetrics 
        metrics={metrics}
        selectedTable={selectedTable}
        isLoading={isLoading}
        isTableLoading={isTableLoading}
      />
    </div>
  )
}

export default Dashboard 