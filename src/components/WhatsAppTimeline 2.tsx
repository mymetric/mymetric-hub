import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'
import { MessageSquare, Users, ShoppingCart, Package, Target, CheckCircle, X, Percent } from 'lucide-react'
import { useState, useMemo } from 'react'
import { parseDateString, groupTimelineDataByMonth } from '../utils/dateUtils'

interface WhatsAppTimelineData {
  date: string
  message_chat_started: number
  message_chat_assign_to_human: number
  message_chat_catalog: number
  message_chat_begin_checkout: number
  message_chat_shipping_info: number
  message_order: number
  message_chat_ended: number
  message_chat_user_inactivity: number
  messages: number
  // Taxas de conversão calculadas
  conversion_rate_chat_to_order?: number
  conversion_rate_chat_to_checkout?: number
  conversion_rate_checkout_to_order?: number
  conversion_rate_catalog_to_order?: number
}

interface WhatsAppTimelineProps {
  data: WhatsAppTimelineData[]
  title: string
}

// Definição das métricas específicas do WhatsApp
const whatsAppMetrics = [
  { key: 'message_chat_started', label: 'Chat Iniciado', color: '#3b82f6', icon: MessageSquare, category: 'Engajamento' },
  { key: 'message_chat_assign_to_human', label: 'Atribuído a Humano', color: '#8b5cf6', icon: Users, category: 'Engajamento' },
  { key: 'message_chat_catalog', label: 'Catálogo', color: '#f59e0b', icon: Target, category: 'Engajamento' },
  { key: 'message_chat_begin_checkout', label: 'Iniciar Checkout', color: '#ef4444', icon: ShoppingCart, category: 'Conversão' },
  { key: 'message_chat_shipping_info', label: 'Informações de Frete', color: '#06b6d4', icon: Package, category: 'Conversão' },
  { key: 'message_order', label: 'Pedido', color: '#10b981', icon: Package, category: 'Conversão' },
  { key: 'message_chat_ended', label: 'Chat Encerrado', color: '#84cc16', icon: CheckCircle, category: 'Finalização' },
  { key: 'message_chat_user_inactivity', label: 'Inatividade do Usuário', color: '#f97316', icon: X, category: 'Finalização' },
  { key: 'messages', label: 'Total de Mensagens', color: '#ec4899', icon: MessageSquare, category: 'Volume' },
  // Taxas de conversão
  { key: 'conversion_rate_chat_to_order', label: 'Taxa Conversão: Chat → Pedido (%)', color: '#10b981', icon: Percent, category: 'Taxas de Conversão', isPercentage: true },
  { key: 'conversion_rate_chat_to_checkout', label: 'Taxa Conversão: Chat → Checkout (%)', color: '#ef4444', icon: Percent, category: 'Taxas de Conversão', isPercentage: true },
  { key: 'conversion_rate_checkout_to_order', label: 'Taxa Conversão: Checkout → Pedido (%)', color: '#06b6d4', icon: Percent, category: 'Taxas de Conversão', isPercentage: true },
  { key: 'conversion_rate_catalog_to_order', label: 'Taxa Conversão: Catálogo → Pedido (%)', color: '#f59e0b', icon: Percent, category: 'Taxas de Conversão', isPercentage: true },
]

const WhatsAppTimeline = ({ data, title }: WhatsAppTimelineProps) => {
  const [primaryMetric, setPrimaryMetric] = useState<string>('message_chat_started')
  const [secondaryMetric, setSecondaryMetric] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [secondarySearchTerm, setSecondarySearchTerm] = useState('')
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false)
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false)
  const [granularity, setGranularity] = useState<'daily' | 'monthly'>('daily')

  // Processar dados baseado na granularidade selecionada e calcular taxas de conversão
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    // Calcular taxas de conversão para cada item
    const dataWithRates = data.map(item => {
      const chatStarted = item.message_chat_started || 0
      const checkout = item.message_chat_begin_checkout || 0
      const order = item.message_order || 0
      const catalog = item.message_chat_catalog || 0
      
      return {
        ...item,
        conversion_rate_chat_to_order: chatStarted > 0 ? (order / chatStarted) * 100 : 0,
        conversion_rate_chat_to_checkout: chatStarted > 0 ? (checkout / chatStarted) * 100 : 0,
        conversion_rate_checkout_to_order: checkout > 0 ? (order / checkout) * 100 : 0,
        conversion_rate_catalog_to_order: catalog > 0 ? (order / catalog) * 100 : 0,
      }
    })
    
    // Ordenar por data (crescente - mais antigo para mais recente)
    const sortedData = dataWithRates.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })
    
    if (granularity === 'monthly') {
      // Agrupar por mês e recalcular taxas agregadas
      const monthlyData = groupTimelineDataByMonth(sortedData)
      // Ordenar os dados mensais também
      return monthlyData.map(item => {
        const chatStarted = item.message_chat_started || 0
        const checkout = item.message_chat_begin_checkout || 0
        const order = item.message_order || 0
        const catalog = item.message_chat_catalog || 0
        
        return {
          ...item,
          conversion_rate_chat_to_order: chatStarted > 0 ? (order / chatStarted) * 100 : 0,
          conversion_rate_chat_to_checkout: chatStarted > 0 ? (checkout / chatStarted) * 100 : 0,
          conversion_rate_checkout_to_order: checkout > 0 ? (order / checkout) * 100 : 0,
          conversion_rate_catalog_to_order: catalog > 0 ? (order / catalog) * 100 : 0,
        }
      }).sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateA - dateB
      })
    }
    
    return sortedData
  }, [data, granularity])

  // Filtrar métricas primárias por busca
  const filteredPrimaryMetrics = whatsAppMetrics.filter(metric => {
    if (metric.key === primaryMetric) return false // Não mostrar já selecionada
    if (metric.key === secondaryMetric) return false // Não mostrar métrica secundária
    
    return !searchTerm || 
      metric.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      metric.key.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Filtrar métricas secundárias por busca
  const filteredSecondaryMetrics = whatsAppMetrics.filter(metric => {
    if (metric.key === secondaryMetric) return false // Não mostrar já selecionada
    if (metric.key === primaryMetric) return false // Não mostrar métrica primária
    
    return !secondarySearchTerm || 
      metric.label.toLowerCase().includes(secondarySearchTerm.toLowerCase()) ||
      metric.key.toLowerCase().includes(secondarySearchTerm.toLowerCase())
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
            {granularity === 'monthly' ? label : parseDateString(label).toLocaleDateString('pt-BR')}
          </p>
          {payload.map((entry: any, index: number) => {
            const metric = whatsAppMetrics.find(m => m.key === entry.dataKey)
            if (!metric) return null
            
            const value = entry.value
            const isPercentage = (metric as any).isPercentage
            const formattedValue = isPercentage
              ? `${value.toFixed(2)}%`
              : new Intl.NumberFormat('pt-BR').format(value)
            
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: metric.color }}
                />
                <span className="text-gray-600">{metric.label}:</span>
                <span className="font-semibold text-gray-900">{formattedValue}</span>
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  // Obter métricas selecionadas com eixos atribuídos
  const selectedMetricsData = useMemo(() => {
    const metrics: Array<typeof whatsAppMetrics[0] & { yAxisId: 'left' | 'right' }> = []
    
    // Métrica primária sempre no eixo esquerdo
    const primary = whatsAppMetrics.find(m => m.key === primaryMetric)
    if (primary) {
      metrics.push({ ...primary, yAxisId: 'left' })
    }
    
    // Métrica secundária sempre no eixo direito
    if (secondaryMetric) {
      const secondary = whatsAppMetrics.find(m => m.key === secondaryMetric)
      if (secondary) {
        metrics.push({ ...secondary, yAxisId: 'right' })
      }
    }
    
    return metrics
  }, [primaryMetric, secondaryMetric])

  // Agrupar métricas por categoria
  const metricsByCategory = useMemo(() => {
    const categories: { [key: string]: typeof whatsAppMetrics } = {}
    whatsAppMetrics.forEach(metric => {
      if (!categories[metric.category]) {
        categories[metric.category] = []
      }
      categories[metric.category].push(metric)
    })
    return categories
  }, [])

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-4">
          {/* Seletor de granularidade */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                granularity === 'daily'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Diário
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                granularity === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensal
            </button>
          </div>

          {/* Seletor de métrica primária (Eixo Esquerdo) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPrimaryDropdown(!showPrimaryDropdown)
                setShowSecondaryDropdown(false)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Target className="w-4 h-4" />
              Eixo 1: {whatsAppMetrics.find(m => m.key === primaryMetric)?.label || 'Selecionar'}
            </button>

            {showPrimaryDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 sticky top-0 bg-white">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar métricas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {Object.entries(metricsByCategory).map(([category, metrics]) => {
                    const categoryMetrics = metrics.filter(m => 
                      filteredPrimaryMetrics.includes(m)
                    )
                    if (categoryMetrics.length === 0) return null
                    
                    return (
                      <div key={category}>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {categoryMetrics.map(metric => {
                            const isSelected = metric.key === primaryMetric
                            const IconComponent = metric.icon
                            
                            return (
                              <button
                                key={metric.key}
                                onClick={() => {
                                  setPrimaryMetric(metric.key)
                                  setShowPrimaryDropdown(false)
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div 
                                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                  style={{ backgroundColor: isSelected ? metric.color : 'transparent', borderColor: metric.color }}
                                />
                                <IconComponent className="w-4 h-4" />
                                <span className="flex-1 text-left">{metric.label}</span>
                                {isSelected && (
                                  <CheckCircle className="w-4 h-4 text-blue-600" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Seletor de métrica secundária (Eixo Direito) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSecondaryDropdown(!showSecondaryDropdown)
                setShowPrimaryDropdown(false)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Target className="w-4 h-4" />
              Eixo 2: {secondaryMetric ? whatsAppMetrics.find(m => m.key === secondaryMetric)?.label : 'Nenhuma'}
            </button>

            {showSecondaryDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 sticky top-0 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Métrica Secundária (Eixo Direito)</span>
                    {secondaryMetric && (
                      <button
                        onClick={() => {
                          setSecondaryMetric('')
                          setShowSecondaryDropdown(false)
                        }}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar métricas..."
                      value={secondarySearchTerm}
                      onChange={(e) => setSecondarySearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {Object.entries(metricsByCategory).map(([category, metrics]) => {
                    const categoryMetrics = metrics.filter(m => 
                      filteredSecondaryMetrics.includes(m)
                    )
                    if (categoryMetrics.length === 0) return null
                    
                    return (
                      <div key={category}>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {categoryMetrics.map(metric => {
                            const isSelected = metric.key === secondaryMetric
                            const IconComponent = metric.icon
                            
                            return (
                              <button
                                key={metric.key}
                                onClick={() => {
                                  setSecondaryMetric(metric.key)
                                  setShowSecondaryDropdown(false)
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isSelected
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div 
                                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                  style={{ backgroundColor: isSelected ? metric.color : 'transparent', borderColor: metric.color }}
                                />
                                <IconComponent className="w-4 h-4" />
                                <span className="flex-1 text-left">{metric.label}</span>
                                {isSelected && (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!primaryMetric && (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Selecione uma métrica primária para visualizar</p>
        </div>
      )}

      {primaryMetric && (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                fontSize={12}
                tickFormatter={(value) => granularity === 'monthly' ? value : parseDateString(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis 
                yAxisId="left"
                stroke="#666"
                fontSize={12}
                tickFormatter={(value) => {
                  const primaryMetricData = whatsAppMetrics.find(m => m.key === primaryMetric)
                  const isPercentage = (primaryMetricData as any)?.isPercentage
                  if (isPercentage) {
                    return `${value.toFixed(1)}%`
                  }
                  return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)
                }}
              />
              {secondaryMetric && (
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#666"
                  fontSize={12}
                  tickFormatter={(value) => {
                    const secondaryMetricData = whatsAppMetrics.find(m => m.key === secondaryMetric)
                    const isPercentage = (secondaryMetricData as any)?.isPercentage
                    if (isPercentage) {
                      return `${value.toFixed(1)}%`
                    }
                    return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)
                  }}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              
              {selectedMetricsData.map(metric => (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={{ fill: metric.color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: metric.color, strokeWidth: 2 }}
                  yAxisId={metric.yAxisId}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legenda */}
      {primaryMetric && (
        <div className="mt-4 flex flex-wrap gap-4">
          {selectedMetricsData.map(metric => {
            const IconComponent = metric.icon
            return (
              <div key={metric.key} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: metric.color }}
                />
                <IconComponent className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">{metric.label}</span>
                <span className="text-xs text-gray-500">
                  ({metric.yAxisId === 'left' ? 'Eixo 1' : 'Eixo 2'})
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default WhatsAppTimeline

