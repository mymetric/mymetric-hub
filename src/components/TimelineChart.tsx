import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, DollarSign, Users, ShoppingCart, Package, Target } from 'lucide-react'
import React, { useState } from 'react'

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
}

interface TimelineChartProps {
  data: TimelineData[]
  title: string
  showMovingAverage?: boolean
}

// Definição das métricas disponíveis
const availableMetrics = [
  { key: 'sessions', label: 'Sessões', color: '#3b82f6', icon: Users, yAxisId: 'left' },
  { key: 'revenue', label: 'Receita', color: '#10b981', icon: DollarSign, yAxisId: 'right' },
  { key: 'clicks', label: 'Cliques', color: '#8b5cf6', icon: Target, yAxisId: 'left' },
  { key: 'addToCart', label: 'Carrinho', color: '#f59e0b', icon: ShoppingCart, yAxisId: 'left' },
  { key: 'orders', label: 'Pedidos', color: '#ef4444', icon: Package, yAxisId: 'left' },
  { key: 'newCustomers', label: 'Novos Clientes', color: '#06b6d4', icon: Users, yAxisId: 'left' },
  { key: 'paidOrders', label: 'Pedidos Pagos', color: '#84cc16', icon: Package, yAxisId: 'left' },
  { key: 'paidRevenue', label: 'Receita Paga', color: '#059669', icon: DollarSign, yAxisId: 'right' },
  { key: 'newCustomerRevenue', label: 'Receita Novos', color: '#7c3aed', icon: DollarSign, yAxisId: 'right' },
  { key: 'investment', label: 'Investimento', color: '#dc2626', icon: DollarSign, yAxisId: 'right' },
  // Métricas de média móvel
  { key: 'sessionsMA', label: 'Sessões (MM)', color: '#1d4ed8', icon: Users, yAxisId: 'left', isMovingAverage: true },
  { key: 'revenueMA', label: 'Receita (MM)', color: '#047857', icon: DollarSign, yAxisId: 'right', isMovingAverage: true },
  { key: 'clicksMA', label: 'Cliques (MM)', color: '#6b21a8', icon: Target, yAxisId: 'left', isMovingAverage: true },
  { key: 'addToCartMA', label: 'Carrinho (MM)', color: '#d97706', icon: ShoppingCart, yAxisId: 'left', isMovingAverage: true },
  { key: 'ordersMA', label: 'Pedidos (MM)', color: '#dc2626', icon: Package, yAxisId: 'left', isMovingAverage: true },
  { key: 'newCustomersMA', label: 'Novos Clientes (MM)', color: '#0891b2', icon: Users, yAxisId: 'left', isMovingAverage: true },
  { key: 'paidOrdersMA', label: 'Pedidos Pagos (MM)', color: '#65a30d', icon: Package, yAxisId: 'left', isMovingAverage: true },
  { key: 'paidRevenueMA', label: 'Receita Paga (MM)', color: '#065f46', icon: DollarSign, yAxisId: 'right', isMovingAverage: true },
  { key: 'newCustomerRevenueMA', label: 'Receita Novos (MM)', color: '#7c2d12', icon: DollarSign, yAxisId: 'right', isMovingAverage: true },
  { key: 'investmentMA', label: 'Investimento (MM)', color: '#991b1b', icon: DollarSign, yAxisId: 'right', isMovingAverage: true }
]

const TimelineChart = ({ data, title, showMovingAverage = false }: TimelineChartProps) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['sessions', 'revenue'])

  // Não alterar as métricas selecionadas automaticamente
  // O usuário mantém suas seleções e elas são automaticamente mapeadas para média móvel

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
  const chartData = data.map(item => ({
    ...item,
    date: (() => {
      // Converter data de forma segura para evitar problemas de timezone
      const [year, month, day] = item.date.split('-').map(Number)
      const date = new Date(year, month - 1, day)
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
    }).format(item.investment)
  }))


  // Calcular totais baseado no modo (normal ou média móvel)
  const totals = data.reduce((acc, item) => {
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
        investment: acc.investment + (item.investmentMA || 0)
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
        investment: acc.investment + (item.investment || 0)
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
    investment: 0
  })

  // Função para alternar métrica selecionada (apenas métricas normais)
  const toggleMetric = (metricKey: string) => {
    // Não permitir selecionar métricas de média móvel diretamente
    const metric = availableMetrics.find(m => m.key === metricKey)
    if (metric?.isMovingAverage) return
    
    setSelectedMetrics(prev => {
      if (prev.includes(metricKey)) {
        // Se já está selecionada, remove (mas mantém pelo menos uma)
        return prev.length > 1 ? prev.filter(m => m !== metricKey) : prev
      } else {
        // Se não está selecionada, adiciona (mas limita a 2)
        return prev.length < 2 ? [...prev, metricKey] : [prev[1], metricKey]
      }
    })
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
    const isSelected = selectedMetrics.includes(metric.key)
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
    if (showMovingAverage && !metric.isMovingAverage) {
      const movingAverageKey = metric.key + 'MA'
      const movingAverageMetric = availableMetrics.find(m => m.key === movingAverageKey)
      return movingAverageMetric || metric
    }
    return metric
  })

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      </div>

      {/* Métricas Selector */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">Comparar métricas:</span>
          <span className="text-xs text-gray-500">(Selecione 1 ou 2)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableMetrics.filter(metric => !metric.isMovingAverage).map((metric) => {
            const isSelected = selectedMetrics.includes(metric.key)
            const Icon = metric.icon
            
            return (
              <button
                key={metric.key}
                onClick={() => toggleMetric(metric.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{metric.label}</span>
                {isSelected && (
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: metric.color }}
                  ></div>
                )}
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-64 mb-6">
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