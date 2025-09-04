import { useState, useEffect, useCallback } from 'react'
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
  SortDesc,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
  Info
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
  // Campos específicos para Havaianas (podem ser null para outros clientes)
  size_score_week_1?: number | null
  size_score_week_2?: number | null
  size_score_week_3?: number | null
  size_score_week_4?: number | null
  size_score_trend_status?: string | null
}

interface ProductsDashboardProps {
  selectedTable: string
}

const ProductsDashboard = ({ selectedTable }: ProductsDashboardProps) => {
  const [products, setProducts] = useState<ProductTrendItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<string>('purchases_week_4')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterTrend, setFilterTrend] = useState<string>('all')
  const [limit, setLimit] = useState(100)
  const [totalLoaded, setTotalLoaded] = useState(0)
  const [isAutoLoading, setIsAutoLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductTrendItem | null>(null)
  const [showProductDetail, setShowProductDetail] = useState(false)
  const [isFullWidth, setIsFullWidth] = useState(false)

  // Função para carregar produtos com paginação automática
  const loadProducts = useCallback(async (currentOffset = 0) => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

      // Validar que selectedTable não é "all"
      if (!validateTableName(selectedTable)) {
        return
      }

      console.log('🔄 Fetching product trends for table:', selectedTable, 'offset:', currentOffset, 'limit:', limit)
      
      const response = await api.getProductTrend(token, {
        table_name: selectedTable,
        limit,
        offset: currentOffset,
        order_by: sortField
      })

      console.log('✅ Product trends response:', response)
      const newProducts = response.data || []
      
      // Evitar duplicatas baseado no item_id
      setProducts(prev => {
        const existingIds = new Set(prev.map(p => p.item_id))
        const uniqueNewProducts = newProducts.filter(p => !existingIds.has(p.item_id))
        return [...prev, ...uniqueNewProducts]
      })
      setTotalLoaded(prev => prev + newProducts.length)
      
      // Se ainda há mais dados, continuar carregando automaticamente
      if (newProducts.length === limit) {
        setIsAutoLoading(true)
        // Pequeno delay para não sobrecarregar a API
        setTimeout(() => {
          loadProducts(currentOffset + limit)
        }, 500)
      } else {
        // Finalizou o carregamento automático
        setIsAutoLoading(false)
      }
      
    } catch (error) {
      console.error('❌ Error fetching product trends:', error)
      setIsAutoLoading(false)
    }
  }, [selectedTable, limit, sortField])

  // Carregar dados iniciais
  useEffect(() => {
    const initializeLoading = async () => {
      console.log('🔄 ProductsDashboard useEffect triggered:', {
        selectedTable,
        limit,
        sortField,
        isLoading
      })
      
      setIsLoading(true)
      setProducts([])
      setTotalLoaded(0)
      setIsAutoLoading(false)
      
      try {
        const token = localStorage.getItem('auth-token')
        console.log('🔍 Token and selectedTable check:', { hasToken: !!token, selectedTable })
        
        if (!token || !selectedTable) {
          console.log('❌ Missing token or selectedTable, aborting')
          setIsLoading(false)
          return
        }

        // Validar que selectedTable não é "all"
        if (!validateTableName(selectedTable)) {
          console.log('❌ Invalid table name, aborting:', selectedTable)
          setIsLoading(false)
          return
        }

        console.log('🔄 Fetching product trends for table:', selectedTable, 'offset: 0, limit:', limit)
        
        const response = await api.getProductTrend(token, {
          table_name: selectedTable,
          limit,
          offset: 0,
          order_by: sortField
        })

        console.log('✅ Product trends response:', response)
        const newProducts = response.data || []
        
        // Garantir que não há duplicatas mesmo no carregamento inicial
        const uniqueProducts = newProducts.filter((product, index, self) => 
          index === self.findIndex(p => p.item_id === product.item_id)
        )
        
        setProducts(uniqueProducts)
        setTotalLoaded(uniqueProducts.length)
        
        // Se ainda há mais dados, continuar carregando automaticamente
        if (newProducts.length === limit) {
          setIsAutoLoading(true)
          // Pequeno delay para não sobrecarregar a API
          setTimeout(() => {
            loadProducts(limit)
          }, 500)
        } else {
          // Finalizou o carregamento automático
          setIsAutoLoading(false)
        }
        
      } catch (error) {
        console.error('❌ Error fetching product trends:', error)
        setIsAutoLoading(false)
      } finally {
        setIsLoading(false)
      }
    }

    initializeLoading()
  }, [selectedTable, limit, sortField, loadProducts]) // Adicionado loadProducts de volta, mas com proteção contra duplicação

  // Filtrar produtos
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.item_id.includes(searchTerm)
      
      const matchesTrend = filterTrend === 'all' || 
                          (filterTrend === 'up' && product.trend_consistency.includes('Growth')) ||
                          (filterTrend === 'down' && product.trend_consistency.includes('Decline')) ||
                          (filterTrend === 'stable' && product.trend_consistency.includes('Stable'))
      
      return matchesSearch && matchesTrend
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

  // Função para abrir modal de detalhamento
  const openProductDetail = (product: ProductTrendItem) => {
    console.log('🔍 Product detail data:', {
      item_id: product.item_id,
      item_name: product.item_name,
      size_score_week_1: product.size_score_week_1,
      size_score_week_2: product.size_score_week_2,
      size_score_week_3: product.size_score_week_3,
      size_score_week_4: product.size_score_week_4,
      size_score_trend_status: product.size_score_trend_status
    })
    setSelectedProduct(product)
    setShowProductDetail(true)
  }

  // Função para fechar modal
  const closeProductDetail = () => {
    setShowProductDetail(false)
    setSelectedProduct(null)
  }

  // Calcular estatísticas
  const totalProducts = products.length
  const growingProducts = products.filter(p => p.trend_consistency.includes('Growth')).length
  const decliningProducts = products.filter(p => p.trend_consistency.includes('Decline')).length




  if (isLoading && products.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando dados de produtos...</p>
        <p className="text-sm text-gray-500 mt-2">Carregando automaticamente em lotes de {limit} produtos</p>
      </div>
    )
  }

  return (
    <div className={`${isFullWidth ? 'fixed inset-0 z-50 bg-white overflow-auto p-6' : 'space-y-6'}`}>
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
            
            {/* Indicador de carregamento automático */}
            {isAutoLoading && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando automaticamente...</span>
                <span className="text-gray-500">({totalLoaded} produtos)</span>
              </div>
            )}
            
            {/* Indicador de conclusão */}
            {!isAutoLoading && totalLoaded > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Package className="w-4 h-4" />
                <span>Carregamento concluído</span>
                <span className="text-gray-500">({totalLoaded} produtos)</span>
              </div>
            )}
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
                <span className="font-medium">W1:</span> 22-29 dias atrás
              </div>
              <div className="text-gray-700">
                <span className="font-medium">W2:</span> 15-22 dias atrás
              </div>
              <div className="text-gray-700">
                <span className="font-medium">W3:</span> 8-15 dias atrás
              </div>
              <div className="text-gray-700">
                <span className="font-medium">W4:</span> 1-7 dias atrás
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

          {/* Botão Full Width */}
          <div className="lg:w-auto">
            <button
              onClick={() => setIsFullWidth(!isFullWidth)}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                isFullWidth 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              {isFullWidth ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5" />
                  </svg>
                  Tela Normal
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Tela Cheia
                </>
              )}
            </button>
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
                                                      {selectedTable === 'havaianas' && products.some(product => 
                  product.size_score_week_1 !== null || 
                  product.size_score_week_2 !== null || 
                  product.size_score_week_3 !== null || 
                  product.size_score_week_4 !== null ||
                  product.size_score_trend_status !== null
                ) && (
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score de Grade
                  </th>
                )}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={selectedTable === 'havaianas' && products.some(p => 
                    p.size_score_week_1 !== null || 
                    p.size_score_week_2 !== null || 
                    p.size_score_week_3 !== null || 
                    p.size_score_week_4 !== null ||
                    p.size_score_trend_status !== null
                  ) ? 12 : 11} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Nenhum produto encontrado</p>
                    <p className="text-sm">Tente ajustar os filtros ou a busca</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
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
                    {selectedTable === 'havaianas' && products.some(p => 
                      p.size_score_week_1 !== null || 
                      p.size_score_week_2 !== null || 
                      p.size_score_week_3 !== null || 
                      p.size_score_week_4 !== null ||
                      p.size_score_trend_status !== null
                    ) && (
                      <td className="px-3 py-4 whitespace-nowrap">
                        {product.size_score_trend_status ? (
                          <span className="text-sm font-medium text-gray-900">
                            {product.size_score_trend_status}
                          </span>
                        ) : null}
                      </td>
                    )}
                    <td className="px-3 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openProductDetail(product)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                      >
                        <Info className="w-3 h-3" />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
              
              {/* Indicador de carregamento automático */}
              {isAutoLoading && (
                <tr>
                  <td colSpan={selectedTable === 'havaianas' && products.some(p => 
                    p.size_score_week_1 !== null || 
                    p.size_score_week_2 !== null || 
                    p.size_score_week_3 !== null || 
                    p.size_score_week_4 !== null ||
                    p.size_score_trend_status !== null
                  ) ? 12 : 11} className="px-6 py-6 text-center bg-blue-50">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-blue-600 font-medium">Carregando mais produtos automaticamente...</span>
                      <span className="text-sm text-gray-500">({totalLoaded} carregados até agora)</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer com estatísticas */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span>
                Total carregado: {totalLoaded} produtos
              </span>
              <span>
                Mostrando {filteredProducts.length} produtos filtrados
              </span>
              {searchTerm && (
                <span className="text-blue-600">
                  Filtrado por: "{searchTerm}"
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {isAutoLoading && (
                <span className="text-blue-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Carregando...
                </span>
              )}
              {!isAutoLoading && totalLoaded > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  Carregamento completo
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalhamento do Produto */}
      {showProductDetail && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedProduct.item_name}</h2>
                <p className="text-sm text-gray-600">ID: {selectedProduct.item_id}</p>
              </div>
              <button
                onClick={closeProductDetail}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-6">
              {/* Análise de Tendência de Vendas */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Análise de Tendência de Vendas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">W1 (22-29 dias atrás)</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(selectedProduct.purchases_week_1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">W2 (15-22 dias atrás)</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(selectedProduct.purchases_week_2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">W3 (8-15 dias atrás)</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(selectedProduct.purchases_week_3)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">W4 (1-7 dias atrás)</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(selectedProduct.purchases_week_4)}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Status da Tendência:</p>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(selectedProduct.trend_consistency)}
                    <span className={`text-sm px-2 py-1 rounded-full border ${getTrendColor(selectedProduct.trend_consistency)}`}>
                      {selectedProduct.trend_consistency.replace('🔴', '').replace('🟢', '').replace('⚪', '').trim()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Análise de Score de Grade (apenas para Havaianas e quando há dados) */}
              {selectedTable === 'havaianas' && (
                selectedProduct.size_score_week_1 !== null || 
                selectedProduct.size_score_week_2 !== null || 
                selectedProduct.size_score_week_3 !== null || 
                selectedProduct.size_score_week_4 !== null
              ) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Análise de Score de Grade de Tamanhos
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">W1</p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedProduct.size_score_week_1 !== null ? `${(selectedProduct.size_score_week_1 * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">W2</p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedProduct.size_score_week_2 !== null ? `${(selectedProduct.size_score_week_2 * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">W3</p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedProduct.size_score_week_3 !== null ? `${(selectedProduct.size_score_week_3 * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">W4</p>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedProduct.size_score_week_4 !== null ? `${(selectedProduct.size_score_week_4 * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Análise de Problemas de Estoque */}
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Análise de Possíveis Problemas de Estoque
                    </h4>
                    {(() => {
                      const scores = [
                        selectedProduct.size_score_week_1,
                        selectedProduct.size_score_week_2,
                        selectedProduct.size_score_week_3,
                        selectedProduct.size_score_week_4
                      ].filter(score => score !== null && score !== undefined) as number[]
                      
                      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100 : 0
                      const hasLowScore = avgScore < 50
                      const isDeclining = selectedProduct.trend_consistency.includes('Decline')
                      
                      if (hasLowScore && isDeclining) {
                        return (
                          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-red-800">⚠️ Possível problema de estoque identificado</p>
                              <p className="text-sm text-red-700 mt-1">
                                O produto apresenta score de grade baixo ({avgScore.toFixed(1)}%) e tendência de declínio nas vendas. 
                                Isso pode indicar falta de tamanhos específicos no estoque.
                              </p>
                            </div>
                          </div>
                        )
                      } else if (hasLowScore) {
                        return (
                          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-yellow-800">⚠️ Score de grade baixo</p>
                              <p className="text-sm text-yellow-700 mt-1">
                                O produto apresenta score de grade baixo ({avgScore.toFixed(1)}%). 
                                Monitore o estoque de tamanhos específicos.
                              </p>
                            </div>
                          </div>
                        )
                      } else {
                        return (
                          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-green-800">✅ Score de grade adequado</p>
                              <p className="text-sm text-green-700 mt-1">
                                O produto apresenta score de grade adequado ({avgScore.toFixed(1)}%). 
                                O estoque de tamanhos parece estar bem distribuído.
                              </p>
                            </div>
                          </div>
                        )
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Recomendações */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Recomendações
                </h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {selectedProduct.trend_consistency.includes('Decline') && (
                    <p>• <strong>Declínio nas vendas:</strong> Considere promoções ou ajustes de preço</p>
                  )}
                  {selectedProduct.trend_consistency.includes('Growth') && (
                    <p>• <strong>Crescimento nas vendas:</strong> Aumente o estoque para aproveitar a demanda</p>
                  )}
                  {selectedProduct.size_score_week_1 !== null && selectedProduct.size_score_week_1 < 0.5 && (
                    <p>• <strong>Score de grade baixo:</strong> Verifique a disponibilidade de tamanhos específicos</p>
                  )}
                  <p>• <strong>Monitoramento:</strong> Acompanhe as métricas semanalmente para identificar tendências</p>
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={closeProductDetail}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductsDashboard
