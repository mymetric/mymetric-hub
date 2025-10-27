import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, DollarSign, Users, ShoppingCart, Package, Target, Search, X, Filter, Calendar } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { groupTimelineDataByMonth, formatMonthRange } from '../utils/dateUtils'

interface TimelineData {
  date: string
  sessions: number
  revenue: number
  clicks: number
  addToCart: number
  orders: number
  newCustomers: number
  paidOrders: number
  paidRevenue: number
  newCustomerRevenue: number
  investment: number
  leads: number
  averageTicket: number
  sessionsMA?: number
  revenueMA?: number
  clicksMA?: number
  addToCartMA?: number
  ordersMA?: number
  newCustomersMA?: number
  paidOrdersMA?: number
  paidRevenueMA?: number
  newCustomerRevenueMA?: number
  investmentMA?: number
  leadsMA?: number
  averageTicketMA?: number
}

interface TimelineChartProps {
  data: TimelineData[]
  title: string
  showMovingAverage?: boolean
}

// Definição das métricas disponíveis
const availableMetrics = [
  { key: 'sessions', label: 'Sessões', color: '#3b82f6', icon: Users, yAxisId: 'left', category: 'Comportamento' },
  { key: 'clicks', label: 'Cliques', color: '#8b5cf6', icon: Target, yAxisId: 'left', category: 'Comportamento' },
  { key: 'addToCart', label: 'Carrinho', color: '#f59e0b', icon: ShoppingCart, yAxisId: 'left', category: 'Comportamento' },
  { key: 'leads', label: 'Leads', color: '#ec4899', icon: Target, yAxisId: 'left', category: 'Comportamento' },
  { key: 'orders', label: 'Pedidos', color: '#ef4444', icon: Package, yAxisId: 'left', category: 'Conversão' },
  { key: 'paidOrders', label: 'Pedidos Pagos', color: '#84cc16', icon: Package, yAxisId: 'left', category: 'Conversão' },
  { key: 'newCustomers', label: 'Novos Clientes', color: '#06b6d4', icon: Users, yAxisId: 'left', category: 'Conversão' },
  { key: 'revenue', label: 'Receita', color: '#10b981', icon: DollarSign, yAxisId: 'right', category: 'Receita' },
  { key: 'paidRevenue', label: 'Receita Paga', color: '#059669', icon: DollarSign, yAxisId: 'right', category: 'Receita' },
  { key: 'newCustomerRevenue', label: 'Receita Novos', color: '#7c3aed', icon: DollarSign, yAxisId: 'right', category: 'Receita' },
  { key: 'investment', label: 'Investimento', color: '#dc2626', icon: DollarSign, yAxisId: 'right', category: 'Investimento' },
  { key: 'averageTicket', label: 'Ticket Médio', color: '#f97316', icon: DollarSign, yAxisId: 'right', category: 'Receita' },
  // Métricas de média móvel
  { key: 'sessionsMA', label: 'Sessões (MM)', color: '#1d4ed8', icon: Users, yAxisId: 'left', isMovingAverage: true, category: 'Comportamento' },
  { key: 'revenueMA', label: 'Receita (MM)', color: '#047857', icon: DollarSign, yAxisId: 'right', isMovingAverage: true, category: 'Receita' },
  { key: 'clicksMA', label: 'Cliques (MM)', color: '#6b21a8', icon: Target, yAxisId: 'left', isMovingAverage: true, category: 'Comportamento' },
  { key: 'addToCartMA', label: 'Carrinho (MM)', color: '#d97706', icon: ShoppingCart, yAxisId: 'left', isMovingAverage: true, category: 'Comportamento' },
  { key: 'ordersMA', label: 'Pedidos (MM)', color: '#dc2626', icon: Package, yAxisId: 'left', isMovingAverage: true, category: 'Conversão' },
  { key: 'newCustomersMA', label: 'Novos Clientes (MM)', color: '#0891b2', icon: Users, yAxisId: 'left', isMovingAverage: true, category: 'Conversão' },
  { key: 'paidOrdersMA', label: 'Pedidos Pagos (MM)', color: '#65a30d', icon: Package, yAxisId: 'left', isMovingAverage: true, category: 'Conversão' },
  { key: 'paidRevenueMA', label: 'Receita Paga (MM)', color: '#065f46', icon: DollarSign, yAxisId: 'right', isMovingAverage: true, category: 'Receita' },
  { key: 'newCustomerRevenueMA', label: 'Receita Novos (MM)', color: '#7c2d12', icon: DollarSign, yAxisId: 'right', isMovingAverage: true, category: 'Receita' },
  { key: 'investmentMA', label: 'Investimento (MM)', color: '#991b1b', icon: DollarSign, yAxisId: 'right', isMovingAverage: true, category: 'Investimento' },
  { key: 'leadsMA', label: 'Leads (MM)', color: '#be185d', icon: Target, yAxisId: 'left', isMovingAverage: true, category: 'Comportamento' },
  { key: 'averageTicketMA', label: 'Ticket Médio (MM)', color: '#ea580c', icon: DollarSign, yAxisId: 'right', isMovingAverage: true, category: 'Receita' }
]

const TimelineChart = ({ data, title, showMovingAverage = false }: TimelineChartProps) => {
  const [primaryMetric, setPrimaryMetric] = useState<string>('sessions')
  const [secondaryMetric, setSecondaryMetric] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [secondarySearchTerm, setSecondarySearchTerm] = useState('')
  const [showMetricSelector, setShowMetricSelector] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false)
  const [granularity, setGranularity] = useState<'daily' | 'monthly'>('daily')

  // Processar dados baseado na granularidade selecionada
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    if (granularity === 'monthly') {
      return groupTimelineDataByMonth(data)
    }
    
    return data
  }, [data, granularity])

  // Não alterar as métricas selecionadas automaticamente
  // O usuário mantém suas seleções e elas são automaticamente mapeadas para média móvel

  // Filtrar métricas principais por busca
  const filteredPrimaryMetrics = availableMetrics.filter(metric => {
    if (metric.isMovingAverage) return false
    if (metric.key === primaryMetric) return false // Não mostrar já selecionada
    if (metric.key === secondaryMetric) return false // Não mostrar métrica secundária
    
    return !searchTerm || 
      metric.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      metric.key.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Filtrar métricas secundárias por busca
  const filteredSecondaryMetrics = availableMetrics.filter(metric => {
    if (metric.isMovingAverage) return false
    if (metric.key === secondaryMetric) return false // Não mostrar já selecionada
    if (metric.key === primaryMetric) return false // Não mostrar métrica primária
    
    return !secondarySearchTerm || 
      metric.label.toLowerCase().includes(secondarySearchTerm.toLowerCase()) ||
      metric.key.toLowerCase().includes(secondarySearchTerm.toLowerCase())
  })

  // Métricas disponíveis para dropdown (todas exceto médias móveis)
  const availablePrimaryMetrics = availableMetrics.filter(m => !m.isMovingAverage && m.key !== secondaryMetric)
  const availableSecondaryMetrics = availableMetrics.filter(m => !m.isMovingAverage && m.key !== primaryMetric)

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhum dado disponível para a timeline</p>
        </div>
      </div>
    )
  }

  // Preparar dados para o gráfico
  const chartData = processedData.map(item => ({
    ...item,
    date: (() => {
      // Converter data de forma segura para evitar problemas de timezone
      const [year, month, day] = item.date.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      
      if (granularity === 'monthly') {
        return formatMonthRange(item.date)
      }
      
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      })
    })(),
    sessionsFormatted: new Intl.NumberFormat('pt-BR').format(item.sessions),
    revenueFormatted: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(item.revenue),
    clicksFormatted: new Intl.NumberFormat('pt-BR').format(item.clicks),
    addToCartFormatted: new Intl.NumberFormat('pt-BR').format(item.addToCart),
    ordersFormatted: new Intl.NumberFormat('pt-BR').format(item.orders),
    newCustomersFormatted: new Intl.NumberFormat('pt-BR').format(item.newCustomers),
    paidOrdersFormatted: new Intl.NumberFormat('pt-BR').format(item.paidOrders),
    paidRevenueFormatted: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(item.paidRevenue),
    newCustomerRevenueFormatted: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(item.newCustomerRevenue),
    investmentFormatted: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(item.investment),
    leadsFormatted: new Intl.NumberFormat('pt-BR').format(item.leads || 0),
    averageTicketFormatted: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(item.averageTicket)
  }))


  // Calcular totais baseado no modo (normal ou média móvel)
  const totals = processedData.reduce((acc, item) => {
    if (showMovingAverage) {
      // No modo média móvel, usar os valores de média móvel
      return {
        sessions: acc.sessions + (item.sessionsMA || 0),
        revenue: acc.revenue + (item.revenueMA || 0),
        clicks: acc.clicks + (item.clicksMA || 0),
        addToCart: acc.addToCart + (item.addToCartMA || 0),
        orders: acc.orders + (item.ordersMA || 0),
        newCustomers: acc.newCustomers + (item.newCustomersMA || 0),
        paidOrders: acc.paidOrders + (item.paidOrdersMA || 0),
        paidRevenue: acc.paidRevenue + (item.paidRevenueMA || 0),
        newCustomerRevenue: acc.newCustomerRevenue + (item.newCustomerRevenueMA || 0),
        investment: acc.investment + (item.investmentMA || 0),
        leads: acc.leads + (item.leadsMA || 0),
        averageTicket: acc.averageTicket + (item.averageTicketMA || 0)
      }
    } else {
      // No modo normal, usar os valores originais
      return {
        sessions: acc.sessions + (item.sessions || 0),
        revenue: acc.revenue + (item.revenue || 0),
        clicks: acc.clicks + (item.clicks || 0),
        addToCart: acc.addToCart + (item.addToCart || 0),
        orders: acc.orders + (item.orders || 0),
        newCustomers: acc.newCustomers + (item.newCustomers || 0),
        paidOrders: acc.paidOrders + (item.paidOrders || 0),
        paidRevenue: acc.paidRevenue + (item.paidRevenue || 0),
        newCustomerRevenue: acc.newCustomerRevenue + (item.newCustomerRevenue || 0),
        investment: acc.investment + (item.investment || 0),
        leads: acc.leads + (item.leads || 0),
        averageTicket: acc.averageTicket + (item.averageTicket || 0)
      }
    }
  }, {
    sessions: 0,
    revenue: 0,
    clicks: 0,
    addToCart: 0,
    orders: 0,
    newCustomers: 0,
    paidOrders: 0,
    paidRevenue: 0,
    newCustomerRevenue: 0,
    investment: 0,
    leads: 0,
    averageTicket: 0
  })

  // Função para selecionar métrica primária
  const selectPrimaryMetric = (metricKey: string) => {
    const metric = availableMetrics.find(m => m.key === metricKey)
    if (metric?.isMovingAverage) return
    setPrimaryMetric(metricKey)
    setSearchTerm('')
    setShowDropdown(false)
  }

  // Função para selecionar métrica secundária
  const selectSecondaryMetric = (metricKey: string) => {
    const metric = availableMetrics.find(m => m.key === metricKey)
    if (metric?.isMovingAverage) return
    setSecondaryMetric(metricKey)
    setSecondarySearchTerm('')
    setShowSecondaryDropdown(false)
  }

  // Selecionar todas as métricas da categoria atual (função mantida para compatibilidade)
  const selectAllFiltered = () => {
    const filteredKeys = filteredPrimaryMetrics.map(m => m.key)
    setSelectedMetrics(prev => {
      const newMetrics = [...prev]
      filteredKeys.forEach(key => {
        if (!newMetrics.includes(key)) {
          newMetrics.push(key)
        }
      })
      return newMetrics
    })
  }

  // Desselecionar todas as métricas da categoria atual (função mantida para compatibilidade)
  const deselectAllFiltered = () => {
    const filteredKeys = filteredPrimaryMetrics.map(m => m.key)
    setSelectedMetrics(prev => prev.filter(key => !filteredKeys.includes(key)))
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              const metric = availableMetrics.find(m => m.key === entry.dataKey)
              if (!metric) return null
              
              // Formatar o valor baseado no tipo de métrica
              let formattedValue
              if (metric.yAxisId === 'right') {
                // Métricas monetárias
                formattedValue = new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0
                }).format(entry.value)
              } else {
                // Métricas numéricas
                formattedValue = new Intl.NumberFormat('pt-BR').format(entry.value)
              }
              
              return (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: metric.color }}
                  ></div>
                  <span className="text-sm text-gray-600">{metric.label}:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formattedValue}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return null
  }

  // Obter métricas selecionadas, substituindo por média móvel se ativada
  const selectedMetricsData = availableMetrics.filter(metric => {
    const isSelected = metric.key === primaryMetric || metric.key === secondaryMetric
    const isMovingAverageMetric = metric.isMovingAverage === true
    const isNormalMetric = !metric.isMovingAverage
    
    if (showMovingAverage) {
      // Se média móvel ativada, mostrar as métricas de média móvel correspondentes às selecionadas
      if (isSelected && isNormalMetric) {
        // Mapear métricas normais para suas versões de média móvel
        const movingAverageKey = metric.key + 'MA'
        const hasMovingAverageVersion = availableMetrics.some(m => m.key === movingAverageKey)
        return hasMovingAverageVersion
      }
      return false
    } else {
      // Se média móvel desativada, mostrar apenas métricas normais
      return isSelected && isNormalMetric
    }
  }).map(metric => {
    // Se média móvel ativada, substituir pela versão de média móvel
    let finalMetric = metric
    if (showMovingAverage && !metric.isMovingAverage) {
      const movingAverageKey = metric.key + 'MA'
      const movingAverageMetric = availableMetrics.find(m => m.key === movingAverageKey)
      finalMetric = movingAverageMetric || metric
    }
    
    // Forçar atribuição correta dos eixos: primária = left, secundária = right
    const originalKey = showMovingAverage && finalMetric.key.endsWith('MA') 
      ? finalMetric.key.replace('MA', '') 
      : finalMetric.key
    
    const isSecondary = originalKey === secondaryMetric
    
    return {
      ...finalMetric,
      yAxisId: isSecondary ? 'right' : 'left'
    }
  })

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Controles de Granularidade e Métricas */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-3">
        {/* Seletor de Granularidade */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Granularidade</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                granularity === 'daily'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Diária
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                granularity === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mensal
            </button>
          </div>
        </div>

        {/* Métricas Selector */}
        <div className={`bg-gray-50 rounded-lg ${showMetricSelector ? 'p-3' : 'p-2'}`}>
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowMetricSelector(!showMetricSelector)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Selecionar Métricas</span>
              <span className="text-xs text-gray-500">
                ({[primaryMetric, secondaryMetric].filter(Boolean).length})
              </span>
            </div>
            <div className="text-xs font-medium text-gray-600">
              {showMetricSelector ? '▲' : '▼'}
            </div>
          </div>

        {showMetricSelector && (
          <div className="space-y-2 pt-2 border-t border-gray-200">
            {/* Duas caixas de busca lado a lado */}
            <div className="flex gap-2">
              {/* Caixa 1: Métricas principais */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar métricas..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full pl-9 pr-9 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setShowDropdown(false)
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
                {/* Dropdown de métricas principais */}
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {(searchTerm ? filteredPrimaryMetrics : availablePrimaryMetrics).map((metric) => {
                      const Icon = metric.icon
                      const isSelected = metric.key === primaryMetric
                      return (
                        <button
                          key={metric.key}
                          onClick={() => selectPrimaryMetric(metric.key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left ${
                            isSelected ? 'bg-blue-50' : ''
                          }`}
                        >
                          <Icon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-700">{metric.label}</span>
                          {isSelected && <span className="ml-auto text-xs text-blue-600">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* Caixa 2: Métricas secundárias */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Métricas secundárias..."
                  value={secondarySearchTerm}
                  onChange={(e) => {
                    setSecondarySearchTerm(e.target.value)
                    setShowSecondaryDropdown(true)
                  }}
                  onFocus={() => setShowSecondaryDropdown(true)}
                  className="w-full pl-9 pr-9 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {secondarySearchTerm && (
                  <button
                    onClick={() => {
                      setSecondarySearchTerm('')
                      setShowSecondaryDropdown(false)
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
                {/* Dropdown de métricas secundárias */}
                {showSecondaryDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {(secondarySearchTerm ? filteredSecondaryMetrics : availableSecondaryMetrics).map((metric) => {
                      const Icon = metric.icon
                      const isSelected = metric.key === secondaryMetric
                      return (
                        <button
                          key={metric.key}
                          onClick={() => selectSecondaryMetric(metric.key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left ${
                            isSelected ? 'bg-purple-50' : ''
                          }`}
                        >
                          <Icon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-700">{metric.label}</span>
                          {isSelected && <span className="ml-auto text-xs text-purple-600">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Métricas Selecionadas - Compacto */}
            {(primaryMetric || secondaryMetric) && (
              <div className="flex flex-wrap gap-1.5">
                {primaryMetric && (() => {
                  const metric = availableMetrics.find(m => m.key === primaryMetric && !m.isMovingAverage)
                  if (!metric) return null
                  const Icon = metric.icon
                  return (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-50 border border-blue-200">
                      <Icon className="w-2.5 h-2.5 text-blue-600" />
                      <span className="text-blue-700 font-medium">{metric.label}</span>
                      <div 
                        className="w-1 h-1 rounded-full ml-0.5" 
                        style={{ backgroundColor: metric.color }}
                      ></div>
                      <button
                        onClick={() => setPrimaryMetric('')}
                        className="ml-0.5 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )
                })()}
                {secondaryMetric && (() => {
                  const metric = availableMetrics.find(m => m.key === secondaryMetric && !m.isMovingAverage)
                  if (!metric) return null
                  const Icon = metric.icon
                  return (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-purple-50 border border-purple-200">
                      <Icon className="w-2.5 h-2.5 text-purple-600" />
                      <span className="text-purple-700 font-medium">{metric.label}</span>
                      <div 
                        className="w-1 h-1 rounded-full ml-0.5" 
                        style={{ backgroundColor: metric.color }}
                      ></div>
                      <button
                        onClick={() => setSecondaryMetric('')}
                        className="ml-0.5 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-80 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="left"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Intl.NumberFormat('pt-BR').format(value)}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                notation: 'compact'
              }).format(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {selectedMetricsData.map((metric) => (
              <Line
                key={metric.key}
                yAxisId={metric.yAxisId}
                type="monotone"
                dataKey={metric.key}
                stroke={metric.color}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 7, stroke: metric.color, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary stats - apenas quando não estiver em modo média móvel */}
      {!showMovingAverage && (
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
          {selectedMetricsData.map((metric) => {
            const total = totals[metric.key as keyof typeof totals]
           
            return (
              <div key={metric.key} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: metric.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-700">Total {metric.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {metric.key.includes('revenue') || metric.key === 'investment' 
                    ? new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 0
                      }).format(total)
                    : metric.key === 'averageTicket'
                    ? new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 2
                      }).format(total / processedData.length)
                    : new Intl.NumberFormat('pt-BR').format(total)
                  }
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TimelineChart 