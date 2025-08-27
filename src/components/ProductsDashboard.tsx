import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Package, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  SortAsc,
  SortDesc
} from 'lucide-react'
import { api, validateTableName } from '../services/api'

interface ProductTrendItem {
  item_id: string
  item_name: string
  purchases_week_1: number
  purchases_week_2: number
  purchases_week_3: number
  purchases_week_4: number
  percent_change_w1_w2: number
  percent_change_w2_w3: number
  percent_change_w3_w4: number
  trend_status: string
  trend_consistency: string
}

interface ProductsDashboardProps {
  selectedTable: string
}

const ProductsDashboard = ({ selectedTable }: ProductsDashboardProps) => {
  const [products, setProducts] = useState<ProductTrendItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<string>('purchases_week_1')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterTrend, setFilterTrend] = useState<string>('all')
  const [limit, setLimit] = useState(100)

  // Buscar dados de produtos
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('auth-token')
        if (!token || !selectedTable) return

        // Validar que selectedTable não é "all"
        if (!validateTableName(selectedTable)) {
          return
        }

        setIsLoading(true)
        console.log('🔄 Fetching product trends for table:', selectedTable)
        
        const response = await api.getProductTrend(token, {
          table_name: selectedTable,
          limit
        })

        console.log('✅ Product trends response:', response)
        setProducts(response.data || [])
      } catch (error) {
        console.error('❌ Error fetching product trends:', error)
        setProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [selectedTable, limit])

  // Filtrar e ordenar produtos
  const filteredAndSortedProducts = products
    .filter(product => {
      const matchesSearch = product.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.item_id.includes(searchTerm)
      
      const matchesTrend = filterTrend === 'all' || 
                          (filterTrend === 'up' && product.trend_consistency.includes('Growth')) ||
                          (filterTrend === 'down' && product.trend_consistency.includes('Decline')) ||
                          (filterTrend === 'stable' && product.trend_consistency.includes('Stable'))
      
      return matchesSearch && matchesTrend
    })
    .sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'item_name':
          aValue = a.item_name.toLowerCase()
          bValue = b.item_name.toLowerCase()
          break
        case 'purchases_week_1':
          aValue = a.purchases_week_1
          bValue = b.purchases_week_1
          break
        case 'purchases_week_2':
          aValue = a.purchases_week_2
          bValue = b.purchases_week_2
          break
        case 'purchases_week_3':
          aValue = a.purchases_week_3
          bValue = b.purchases_week_3
          break
        case 'purchases_week_4':
          aValue = a.purchases_week_4
          bValue = b.purchases_week_4
          break
        case 'percent_change_w1_w2':
          aValue = a.percent_change_w1_w2
          bValue = b.percent_change_w1_w2
          break
        case 'percent_change_w2_w3':
          aValue = a.percent_change_w2_w3
          bValue = b.percent_change_w2_w3
          break
        case 'percent_change_w3_w4':
          aValue = a.percent_change_w3_w4
          bValue = b.percent_change_w3_w4
          break
        default:
          aValue = a.purchases_week_1
          bValue = b.purchases_week_1
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    })

  // Função para lidar com ordenação
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Função para formatar número
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Função para formatar percentual
  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  // Função para obter ícone de tendência
  const getTrendIcon = (consistency: string) => {
    if (consistency.includes('Growth')) {
      return <TrendingUp className="w-4 h-4 text-green-600" />
    } else if (consistency.includes('Decline')) {
      return <TrendingDown className="w-4 h-4 text-red-600" />
    } else {
      return <Minus className="w-4 h-4 text-gray-600" />
    }
  }

  // Função para obter cor da tendência
  const getTrendColor = (consistency: string) => {
    if (consistency.includes('Growth')) {
      return 'text-green-600 bg-green-50 border-green-200'
    } else if (consistency.includes('Decline')) {
      return 'text-red-600 bg-red-50 border-red-200'
    } else {
      return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // Calcular estatísticas
  const totalProducts = products.length
  const growingProducts = products.filter(p => p.trend_consistency.includes('Growth')).length
  const decliningProducts = products.filter(p => p.trend_consistency.includes('Decline')).length




  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando dados de produtos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              Análise de Tendência de Produtos
            </h1>
            <p className="text-gray-600 mt-2">
              Acompanhe o desempenho e tendências dos produtos nas últimas 4 semanas
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Últimas 4 semanas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explicação das Faixas de Tempo */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 opacity-75 hover:opacity-100 transition-opacity">
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-2">Períodos analisados (excluindo hoje)</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div className="text-gray-700">
                <span className="font-medium">W1:</span> 1-7 dias atrás
              </div>
              <div className="text-gray-700">
                <span className="font-medium">W2:</span> 8-15 dias atrás
              </div>
              <div className="text-gray-700">
                <span className="font-medium">W3:</span> 15-22 dias atrás
              </div>
              <div className="text-gray-700">
                <span className="font-medium">W4:</span> 22-29 dias atrás
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Produtos</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(totalProducts)}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Em Crescimento</p>
              <p className="text-2xl font-bold text-green-600">{formatNumber(growingProducts)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Em Declínio</p>
              <p className="text-2xl font-bold text-red-600">{formatNumber(decliningProducts)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>


      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Busca */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou ID do produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filtro de Tendência */}
          <div className="lg:w-48">
            <select
              value={filterTrend}
              onChange={(e) => setFilterTrend(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todas as Tendências</option>
              <option value="up">Em Crescimento</option>
              <option value="down">Em Declínio</option>
              <option value="stable">Estáveis</option>
            </select>
          </div>

          {/* Limite de Registros */}
          <div className="lg:w-32">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={50}>50 itens</option>
              <option value={100}>100 itens</option>
              <option value={200}>200 itens</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th 
                  className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('purchases_week_1')}
                >
                  <div className="flex items-center justify-center gap-1">
                    W1
                    {sortField === 'purchases_week_1' && (
                      sortDirection === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('purchases_week_2')}
                >
                  <div className="flex items-center justify-center gap-1">
                    W2
                    {sortField === 'purchases_week_2' && (
                      sortDirection === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('purchases_week_3')}
                >
                  <div className="flex items-center justify-center gap-1">
                    W3
                    {sortField === 'purchases_week_3' && (
                      sortDirection === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('purchases_week_4')}
                >
                  <div className="flex items-center justify-center gap-1">
                    W4
                    {sortField === 'purchases_week_4' && (
                      sortDirection === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  W1→W2
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  W2→W3
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  W3→W4
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Consistência
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Nenhum produto encontrado</p>
                    <p className="text-sm">Tente ajustar os filtros ou a busca</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedProducts.map((product) => (
                  <tr key={product.item_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.item_name}</div>
                        <div className="text-sm text-gray-500">ID: {product.item_id}</div>
                      </div>
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-900 text-center">
                      {formatNumber(product.purchases_week_1)}
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-900 text-center">
                      {formatNumber(product.purchases_week_2)}
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-xs text-gray-900 text-center">
                      {formatNumber(product.purchases_week_3)}
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-xs font-medium text-gray-900 text-center">
                      {formatNumber(product.purchases_week_4)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        {product.percent_change_w1_w2 > 0 ? (
                          <ArrowUpRight className="w-3 h-3 text-green-600" />
                        ) : product.percent_change_w1_w2 < 0 ? (
                          <ArrowDownRight className="w-3 h-3 text-red-600" />
                        ) : (
                          <Minus className="w-3 h-3 text-gray-600" />
                        )}
                        <span className={`text-xs font-medium ${
                          product.percent_change_w1_w2 > 0 ? 'text-green-600' : 
                          product.percent_change_w1_w2 < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {formatPercentage(product.percent_change_w1_w2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        {product.percent_change_w2_w3 > 0 ? (
                          <ArrowUpRight className="w-3 h-3 text-green-600" />
                        ) : product.percent_change_w2_w3 < 0 ? (
                          <ArrowDownRight className="w-3 h-3 text-red-600" />
                        ) : (
                          <Minus className="w-3 h-3 text-gray-600" />
                        )}
                        <span className={`text-xs font-medium ${
                          product.percent_change_w2_w3 > 0 ? 'text-green-600' : 
                          product.percent_change_w2_w3 < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {formatPercentage(product.percent_change_w2_w3)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        {product.percent_change_w3_w4 > 0 ? (
                          <ArrowUpRight className="w-3 h-3 text-green-600" />
                        ) : product.percent_change_w3_w4 < 0 ? (
                          <ArrowDownRight className="w-3 h-3 text-red-600" />
                        ) : (
                          <Minus className="w-3 h-3 text-gray-600" />
                        )}
                        <span className={`text-xs font-medium ${
                          product.percent_change_w3_w4 > 0 ? 'text-green-600' : 
                          product.percent_change_w3_w4 < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {formatPercentage(product.percent_change_w3_w4)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium">{product.trend_status}</span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {getTrendIcon(product.trend_consistency)}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${getTrendColor(product.trend_consistency)}`}>
                          {product.trend_consistency.replace('🔴', '').replace('🟢', '').replace('⚪', '').trim()}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer com estatísticas */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Mostrando {filteredAndSortedProducts.length} de {totalProducts} produtos
            </span>
            <span>
              {searchTerm && `Filtrado por: "${searchTerm}"`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductsDashboard
