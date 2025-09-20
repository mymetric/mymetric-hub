import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, DollarSign, Users, ShoppingCart, Target, Eye, MousePointer } from 'lucide-react'
import React, { useState } from 'react'

interface PaidMediaTimelineData {
  date: string
  cost: number
  impressions: number
  clicks: number
  leads: number
  transactions: number
  revenue: number
  transactions_first: number
  revenue_first: number
  ctr: number
  cpc: number
  cpv: number
  cpa: number
  roas: number
  roas_first: number
}

interface PaidMediaTimelineProps {
  data: PaidMediaTimelineData[]
  title: string
}

// Definição das métricas específicas de mídia paga
const paidMediaMetrics = [
  { key: 'cost', label: 'Investimento', color: '#dc2626', icon: DollarSign, yAxisId: 'right' },
  { key: 'impressions', label: 'Impressões', color: '#3b82f6', icon: Eye, yAxisId: 'left' },
  { key: 'clicks', label: 'Cliques', color: '#8b5cf6', icon: MousePointer, yAxisId: 'left' },
  { key: 'leads', label: 'Leads', color: '#f59e0b', icon: Users, yAxisId: 'left' },
  { key: 'transactions', label: 'Transações', color: '#ef4444', icon: ShoppingCart, yAxisId: 'left' },
  { key: 'revenue', label: 'Receita', color: '#10b981', icon: DollarSign, yAxisId: 'right' },
  { key: 'transactions_first', label: '1ª Compra', color: '#06b6d4', icon: Users, yAxisId: 'left' },
  { key: 'revenue_first', label: 'Receita 1ª', color: '#059669', icon: DollarSign, yAxisId: 'right' },
  { key: 'ctr', label: 'CTR (%)', color: '#7c3aed', icon: Target, yAxisId: 'left' },
  { key: 'cpc', label: 'CPC', color: '#d97706', icon: DollarSign, yAxisId: 'right' },
  { key: 'cpv', label: 'CPV', color: '#dc2626', icon: DollarSign, yAxisId: 'right' },
  { key: 'cpa', label: 'CPA', color: '#0891b2', icon: DollarSign, yAxisId: 'right' },
  { key: 'roas', label: 'ROAS', color: '#16a34a', icon: TrendingUp, yAxisId: 'left' },
  { key: 'roas_first', label: 'ROAS 1ª', color: '#0d9488', icon: TrendingUp, yAxisId: 'left' },
]

const PaidMediaTimeline = ({ data, title }: PaidMediaTimelineProps) => {
  const [selectedMetrics, setSelectedMetrics] = useState(['cost', 'revenue'])
  const [showMetricSelector, setShowMetricSelector] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const toggleMetric = (metricKey: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
            {new Date(label).toLocaleDateString('pt-BR')}
          </p>
          {payload.map((entry: any, index: number) => {
            const metric = paidMediaMetrics.find(m => m.key === entry.dataKey)
            if (!metric) return null
            
            const value = entry.value
            const formattedValue = metric.key.includes('cost') || metric.key.includes('cpc') || metric.key.includes('cpv') || metric.key.includes('cpa') || metric.key.includes('revenue')
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
              : metric.key.includes('ctr') || metric.key.includes('roas')
              ? `${value.toFixed(2)}${metric.key.includes('ctr') ? '%' : 'x'}`
              : new Intl.NumberFormat('pt-BR').format(value)
            
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-600">{metric.label}:</span>
                <span className="font-medium text-gray-900">{formattedValue}</span>
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  const selectedMetricsData = paidMediaMetrics.filter(metric => 
    selectedMetrics.includes(metric.key)
  )

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        
        {/* Botão Dropdown de Métricas */}
        <div className="relative">
          <button
            onClick={() => setShowMetricSelector(!showMetricSelector)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              showMetricSelector 
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Métricas</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              showMetricSelector 
                ? 'bg-white/20 text-white' 
                : 'bg-blue-100 text-blue-600'
            }`}>
              {selectedMetrics.length}
            </span>
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${showMetricSelector ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown de Métricas - Overlay Elegante */}
      {showMetricSelector && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => {
              setShowMetricSelector(false)
              setSearchTerm('')
            }}
          />
          
          {/* Dropdown Content */}
          <div className="absolute top-20 right-6 w-96 max-w-[calc(100vw-3rem)]">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-300">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Selecionar Métricas</h3>
                      <p className="text-blue-100 text-sm">Escolha quais métricas exibir no gráfico</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowMetricSelector(false)
                      setSearchTerm('')
                    }}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar métricas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-1 gap-6">
                  {/* Mensagem quando não há resultados */}
                  {searchTerm && (() => {
                    const hasResults = paidMediaMetrics.some(metric => 
                      metric.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      metric.key.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    
                    if (!hasResults) {
                      return (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma métrica encontrada</h3>
                          <p className="text-sm text-gray-500 mb-4">Tente buscar por termos como "receita", "cliques", "roas", etc.</p>
                          <button
                            onClick={() => setSearchTerm('')}
                            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Limpar busca
                          </button>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Lista de métricas */}
                  <div>
                    <div className="space-y-2">
                      {paidMediaMetrics
                        .filter(metric => 
                          !searchTerm || 
                          metric.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          metric.key.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(metric => (
                          <label key={metric.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedMetrics.includes(metric.key)}
                              onChange={() => toggleMetric(metric.key)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                            />
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: metric.color }}
                            />
                            <metric.icon className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedMetrics(paidMediaMetrics.map(m => m.key))}
                      className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Todas
                    </button>
                    <button
                      onClick={() => setSelectedMetrics(['cost', 'revenue'])}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Básicas
                    </button>
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedMetrics.length} de {paidMediaMetrics.length} selecionadas
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              stroke="#666"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            />
            <YAxis 
              yAxisId="left"
              stroke="#666"
              fontSize={12}
              tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#666"
              fontSize={12}
              tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value)}
            />
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

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap gap-4">
        {selectedMetricsData.map(metric => (
          <div key={metric.key} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: metric.color }}
            />
            <span className="text-gray-600">{metric.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PaidMediaTimeline
