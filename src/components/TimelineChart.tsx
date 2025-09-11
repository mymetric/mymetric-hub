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
import { useState } from 'react'

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
}

interface TimelineChartProps {
  data: TimelineData[]
  title: string
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
  { key: 'investment', label: 'Investimento', color: '#dc2626', icon: DollarSign, yAxisId: 'right' }
]

const TimelineChart = ({ data, title }: TimelineChartProps) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['sessions', 'revenue'])

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

  // Calcular totais
  const totals = data.reduce((acc, item) => ({
    sessions: acc.sessions + item.sessions,
    revenue: acc.revenue + item.revenue,
    clicks: acc.clicks + item.clicks,
    addToCart: acc.addToCart + item.addToCart,
    orders: acc.orders + item.orders,
    newCustomers: acc.newCustomers + item.newCustomers,
    paidOrders: acc.paidOrders + item.paidOrders,
    paidRevenue: acc.paidRevenue + item.paidRevenue,
    newCustomerRevenue: acc.newCustomerRevenue + item.newCustomerRevenue,
    investment: acc.investment + item.investment
  }), {
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

  // Função para alternar métrica selecionada
  const toggleMetric = (metricKey: string) => {
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
              
              const formattedValue = entry.payload[`${entry.dataKey}Formatted`]
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

  // Obter métricas selecionadas
  const selectedMetricsData = availableMetrics.filter(metric => 
    selectedMetrics.includes(metric.key)
  )

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
          {availableMetrics.map((metric) => {
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
                dot={{ fill: metric.color, strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: metric.color, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary stats */}
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
    </div>
  )
}

export default TimelineChart 