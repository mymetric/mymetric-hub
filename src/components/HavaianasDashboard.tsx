import { useState, useEffect } from 'react'
import { 
  Package,
  TrendingDown,
  Search,
  TrendingUp
} from 'lucide-react'
import { api } from '../services/api'
import { HavaianasItem } from '../types'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'

interface HavaianasDashboardProps {
  selectedTable: string
  startDate: string
  endDate: string
}

// Tipo para produtos agregados
interface AggregatedProduct {
  item_id: string;
  item_name: string;
  totalViews: number;
  totalTransactions: number;
  totalRevenue: number;
  avgScore: number;
  avgPromo: number;
  daysCount: number;
}

const HavaianasDashboard = ({ selectedTable, startDate, endDate }: HavaianasDashboardProps) => {
  const [havaianasData, setHavaianasData] = useState<HavaianasItem[]>([])
  const [filteredData, setFilteredData] = useState<AggregatedProduct[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Buscar dados da Havaianas
  useEffect(() => {
    const fetchHavaianasData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const token = localStorage.getItem('auth-token')
        if (!token) {
          throw new Error('Token de autenticação não encontrado')
        }

        console.log('🔄 Buscando dados da Havaianas...')
        
        const response = await api.getHavaianasData(token, {
          table_name: selectedTable
        })

        console.log('✅ Dados da Havaianas recebidos:', response)
        setHavaianasData(response.data || [])
        // Os dados filtrados serão inicializados no useEffect que depende de aggregatedProducts
      } catch (error) {
        console.error('❌ Erro ao buscar dados da Havaianas:', error)
        setError(error instanceof Error ? error.message : 'Erro desconhecido')
        setHavaianasData([])
      } finally {
        setIsLoading(false)
      }
    }

    if (selectedTable) {
      fetchHavaianasData()
    }
  }, [selectedTable])

  // Filtrar dados por data
  const filteredByDate = havaianasData.filter(item => {
    // Converter datas de forma segura para evitar problemas de timezone
    const [itemYear, itemMonth, itemDay] = item.event_date.split('-').map(Number)
    const itemDate = new Date(itemYear, itemMonth - 1, itemDay)
    
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
    const start = new Date(startYear, startMonth - 1, startDay)
    
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
    const end = new Date(endYear, endMonth - 1, endDay)
    
    return itemDate >= start && itemDate <= end
  })

  // Preparar dados agregados por produto
  const aggregatedProducts = filteredByDate
    .reduce((acc, item) => {
      const existingProduct = acc.find(p => p.item_id === item.item_id)
      if (existingProduct) {
        existingProduct.totalViews += item.item_views
        existingProduct.totalTransactions += item.transactions
        existingProduct.totalRevenue += item.purchase_revenue
        existingProduct.avgScore += item.size_score
        existingProduct.avgPromo += item.promo_label
        existingProduct.daysCount += 1
      } else {
        acc.push({
          item_id: item.item_id,
          item_name: item.item_name,
          totalViews: item.item_views,
          totalTransactions: item.transactions,
          totalRevenue: item.purchase_revenue,
          avgScore: item.size_score,
          avgPromo: item.promo_label,
          daysCount: 1
        })
      }
      return acc
    }, [] as {
      item_id: string;
      item_name: string;
      totalViews: number;
      totalTransactions: number;
      totalRevenue: number;
      avgScore: number;
      avgPromo: number;
      daysCount: number;
    }[])
    .map(product => ({
      ...product,
      avgScore: product.daysCount > 0 ? product.avgScore / product.daysCount : 0,
      avgPromo: product.daysCount > 0 ? product.avgPromo / product.daysCount : 0
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue) // Ordenar por receita decrescente

  // Filtrar produtos agregados baseado no termo de busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredData(aggregatedProducts)
    } else {
      const filtered = aggregatedProducts.filter(product => 
        product.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.item_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredData(filtered)
    }
  }, [aggregatedProducts, searchTerm])

  // Preparar dados agregados por data para timeline
  const timelineData = (selectedProduct 
    ? filteredByDate.filter(item => item.item_id === selectedProduct)
    : filteredByDate
  ).reduce((acc, item) => {
      const existingDate = acc.find(d => d.date === item.event_date)
      if (existingDate) {
        existingDate.totalViews += item.item_views
        existingDate.totalTransactions += item.transactions
        existingDate.totalRevenue += item.purchase_revenue
        existingDate.avgScore += item.size_score
        existingDate.avgPromo += item.promo_label
        existingDate.itemCount += 1
      } else {
        acc.push({
          date: item.event_date,
          totalViews: item.item_views,
          totalTransactions: item.transactions,
          totalRevenue: item.purchase_revenue,
          avgScore: item.size_score,
          avgPromo: item.promo_label,
          itemCount: 1
        })
      }
      return acc
    }, [] as {
      date: string;
      totalViews: number;
      totalTransactions: number;
      totalRevenue: number;
      avgScore: number;
      avgPromo: number;
      itemCount: number;
    }[])
    .sort((a, b) => {
      // Ordenar datas de forma segura para evitar problemas de timezone
      const [yearA, monthA, dayA] = a.date.split('-').map(Number)
      const [yearB, monthB, dayB] = b.date.split('-').map(Number)
      const dateA = new Date(yearA, monthA - 1, dayA)
      const dateB = new Date(yearB, monthB - 1, dayB)
      return dateA.getTime() - dateB.getTime()
    })
    .map(item => ({
      ...item,
      avgScore: item.itemCount > 0 ? (item.avgScore / item.itemCount) * 100 : 0, // Converter para porcentagem
      avgPromo: item.itemCount > 0 ? item.avgPromo / item.itemCount : 0
    }))

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



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados da Havaianas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  if (havaianasData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
          <p className="text-gray-600">
            Não foram encontrados dados para a tabela <strong>{selectedTable}</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Timeline Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Evolução Temporal</h2>
                <p className="text-sm text-gray-600">
                  {selectedProduct 
                    ? `Métricas do produto selecionado por data`
                    : 'Métricas agregadas por data'
                  }
                </p>
              </div>
            </div>
            
            {/* Botão para limpar filtro */}
            {selectedProduct && (
              <button
                onClick={() => setSelectedProduct('')}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Ver todos os produtos
              </button>
            )}
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    // Converter data de forma segura para evitar problemas de timezone
                    const [year, month, day] = value.split('-').map(Number)
                    const date = new Date(year, month - 1, day)
                    return date.toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    })
                  }}
                />
                <YAxis 
                  yAxisId="left"
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
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                />
                <Tooltip 
                                     formatter={(value: any, name: string) => {
                     if (name === 'Receita') {
                       return [new Intl.NumberFormat('pt-BR', {
                         style: 'currency',
                         currency: 'BRL',
                         minimumFractionDigits: 0
                       }).format(value), name]
                     } else if (name === 'Score de Grade') {
                       return [`${value.toFixed(1)}%`, name]
                     } else if (name === 'Score de Desconto') {
                       return [`${value.toFixed(1)}%`, name]
                     }
                     return [value, name]
                   }}
                  labelFormatter={(label) => {
                    // Converter data de forma segura para evitar problemas de timezone
                    const [year, month, day] = label.split('-').map(Number)
                    const date = new Date(year, month - 1, day)
                    return date.toLocaleDateString('pt-BR')
                  }}
                />
                
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalRevenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2 }}
                  name="Receita"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
                  name="Score de Grade"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgPromo"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#f59e0b', strokeWidth: 2 }}
                  name="Score de Desconto"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Dados dos Produtos Havaianas</h1>
                  <p className="text-gray-600">
                    Análise detalhada por produto e data
                    {filteredData.length > 0 && (
                      <span className="ml-2 text-sm text-gray-500">
                        • {filteredData.length.toLocaleString()} de {filteredByDate.length.toLocaleString()} registros ({startDate} a {endDate})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Campo de busca */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome ou ID do produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-80 pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visualizações Totais
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score de Grade Médio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score de Promoção Médio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transações Totais
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dias
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.slice(0, 20).map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.item_name}</div>
                        <div className="text-sm text-gray-500">{product.item_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(product.totalViews)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{product.avgScore.toFixed(2)}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${product.avgScore * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.avgPromo.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(product.totalTransactions)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(product.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.daysCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => setSelectedProduct(product.item_id)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          selectedProduct === product.item_id
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={selectedProduct === product.item_id ? "Produto selecionado" : "Ver na timeline"}
                      >
                        {selectedProduct === product.item_id ? 'Selecionado' : 'Ver na Timeline'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length > 20 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600 text-center">
                Mostrando 20 de {filteredData.length} registros filtrados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HavaianasDashboard
