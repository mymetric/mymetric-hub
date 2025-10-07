import { useState, useEffect } from 'react'
import { MapPin, Globe, Map, TrendingUp, Package } from 'lucide-react'
import { api, validateTableName } from '../services/api'

interface OrdersByLocationProps {
  selectedTable: string
  startDate: string
  endDate: string
}

interface MetricItem {
  Data: string
  Cluster: string
  Plataforma: string
  city?: string
  region?: string
  country?: string
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
  [key: string]: any
}

interface LocationStats {
  city: string
  region: string
  country: string
  orders: number
  revenue: number
  avgOrderValue: number
}

const OrdersByLocation = ({ selectedTable, startDate, endDate }: OrdersByLocationProps) => {
  const [metrics, setMetrics] = useState<MetricItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'city' | 'region' | 'country'>('city')
  const [sortField, setSortField] = useState<'orders' | 'revenue'>('revenue')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showAll, setShowAll] = useState(false)

  // Resetar showAll quando mudar o agrupamento
  useEffect(() => {
    setShowAll(false)
  }, [groupBy])

  const loadMetrics = async () => {
    if (!selectedTable || !validateTableName(selectedTable)) {
      console.warn('⚠️ Table name inválido, não carregando métricas por localização')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('auth-token') || ''
      
      const requestParams = {
        start_date: startDate,
        end_date: endDate,
        table_name: selectedTable,
        cluster: 'Todos'
      }

      console.log('🌍 Metrics by Location API Request:', requestParams)
      
      const response = await api.getMetrics(token, requestParams)
      
      if (!response || !response.data) {
        console.error('❌ Resposta da API inválida:', response)
        throw new Error('Resposta da API está vazia ou inválida')
      }

      const newMetrics = (response.data || []) as MetricItem[]
      
      console.log('📦 Metrics received:', newMetrics.length)
      if (newMetrics.length > 0) {
        console.log('📍 Sample metric location data:', {
          city: (newMetrics[0] as any).city,
          region: (newMetrics[0] as any).region,
          country: (newMetrics[0] as any).country,
          allFields: Object.keys(newMetrics[0])
        })
      }

      setMetrics(newMetrics)
      setError(null)
    } catch (err) {
      console.error('Erro ao buscar métricas por localização:', err)
      setError(err instanceof Error ? err.message : 'Erro ao buscar métricas')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, startDate, endDate])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Agrupar métricas por localização
  const groupedData = (): LocationStats[] => {
    const grouped: { [key: string]: LocationStats } = {}

    metrics.forEach(metric => {
      const locationKey = metric[groupBy] || 'Não informado'
      
      if (!grouped[locationKey]) {
        grouped[locationKey] = {
          city: metric.city || 'Não informado',
          region: metric.region || 'Não informado',
          country: metric.country || 'Não informado',
          orders: 0,
          revenue: 0,
          avgOrderValue: 0
        }
      }

      const stats = grouped[locationKey]
      stats.orders += metric.Pedidos || 0
      stats.revenue += metric.Receita || 0
    })

    // Calcular ticket médio e converter para array
    const dataArray: LocationStats[] = Object.values(grouped).map((stats: LocationStats) => {
      stats.avgOrderValue = stats.orders > 0 ? stats.revenue / stats.orders : 0
      return stats
    })

    // Ordenar
    dataArray.sort((a: LocationStats, b: LocationStats) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1
      if (sortField === 'orders') {
        return (a.orders - b.orders) * multiplier
      } else {
        return (a.revenue - b.revenue) * multiplier
      }
    })

    return dataArray
  }

  const locationData = groupedData()
  const INITIAL_DISPLAY_LIMIT = 10
  const displayedData = showAll ? locationData : locationData.slice(0, INITIAL_DISPLAY_LIMIT)
  const hasMore = locationData.length > INITIAL_DISPLAY_LIMIT

  const handleSort = (field: 'orders' | 'revenue') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: 'orders' | 'revenue') => {
    if (sortField !== field) {
      return <span className="text-gray-300">↕</span>
    }
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const totalOrders = metrics.reduce((sum, metric) => sum + (metric.Pedidos || 0), 0)
  const totalRevenue = metrics.reduce((sum, metric) => sum + (metric.Receita || 0), 0)
  const metricsWithLocation = metrics.filter(metric => metric[groupBy] && metric[groupBy] !== 'Não informado')
  const ordersWithLocation = metricsWithLocation.reduce((sum, metric) => sum + (metric.Pedidos || 0), 0)
  const locationCoverage = totalOrders > 0 ? (ordersWithLocation / totalOrders) * 100 : 0

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-red-200">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <MapPin className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Erro ao carregar dados de localização</h3>
        </div>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={() => loadMetrics()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Tentar novamente
        </button>
        <p className="text-xs text-gray-500 mt-3">
          Verifique o console do navegador (F12) para mais detalhes sobre o erro.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pedidos por Localização</h3>
            <p className="text-sm text-gray-500">
              Análise geográfica dos pedidos
            </p>
          </div>
        </div>

        {/* Group By Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Agrupar por:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'city' | 'region' | 'country')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="city">Cidade</option>
            <option value="region">Estado/Região</option>
            <option value="country">País</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">Total de Pedidos</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{formatNumber(totalOrders)}</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs text-green-600 font-medium">Receita Total</span>
          </div>
          <p className="text-2xl font-bold text-green-900">{formatCurrency(totalRevenue)}</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
          <div className="flex items-center gap-2 mb-1">
            {groupBy === 'city' && <MapPin className="w-4 h-4 text-purple-600" />}
            {groupBy === 'region' && <Map className="w-4 h-4 text-purple-600" />}
            {groupBy === 'country' && <Globe className="w-4 h-4 text-purple-600" />}
            <span className="text-xs text-purple-600 font-medium">
              {groupBy === 'city' ? 'Cidades' : groupBy === 'region' ? 'Estados/Regiões' : 'Países'}
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-900">{formatNumber(locationData.length)}</p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-orange-600 font-medium">Cobertura de Dados</span>
          </div>
          <p className="text-2xl font-bold text-orange-900">{locationCoverage.toFixed(1)}%</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* No Data */}
      {!isLoading && locationData.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum dado de localização disponível</p>
          <p className="text-sm text-gray-400 mt-1">
            Os pedidos podem não conter informações de localização
          </p>
        </div>
      )}

      {/* Data Table */}
      {!isLoading && locationData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {groupBy === 'city' ? 'Cidade' : groupBy === 'region' ? 'Estado/Região' : 'País'}
                </th>
                {groupBy === 'city' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado/Região
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      País
                    </th>
                  </>
                )}
                {groupBy === 'region' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    País
                  </th>
                )}
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('orders')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Pedidos {getSortIcon('orders')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('revenue')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Receita {getSortIcon('revenue')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticket Médio
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Pedidos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayedData.map((location: LocationStats, index: number) => {
                const percentOfTotal = totalOrders > 0 ? (location.orders / totalOrders) * 100 : 0
                const locationName = groupBy === 'city' ? location.city : groupBy === 'region' ? location.region : location.country
                
                return (
                  <tr key={`${locationName}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {groupBy === 'city' && <MapPin className="w-4 h-4 text-gray-400" />}
                        {groupBy === 'region' && <Map className="w-4 h-4 text-gray-400" />}
                        {groupBy === 'country' && <Globe className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm font-medium text-gray-900">
                          {locationName}
                        </span>
                      </div>
                    </td>
                    {groupBy === 'city' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {location.region}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {location.country}
                        </td>
                      </>
                    )}
                    {groupBy === 'region' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {location.country}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatNumber(location.orders)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600">
                      {formatCurrency(location.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {formatCurrency(location.avgOrderValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {percentOfTotal.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Ver Mais Button */}
          {hasMore && !showAll && (
            <div className="mt-4 text-center border-t border-gray-200 pt-4">
              <button
                onClick={() => setShowAll(true)}
                className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                <span>Ver mais {locationData.length - INITIAL_DISPLAY_LIMIT} {groupBy === 'city' ? 'cidades' : groupBy === 'region' ? 'estados/regiões' : 'países'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}

          {/* Ver Menos Button */}
          {showAll && hasMore && (
            <div className="mt-4 text-center border-t border-gray-200 pt-4">
              <button
                onClick={() => setShowAll(false)}
                className="inline-flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm"
              >
                <span>Ver menos</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OrdersByLocation

