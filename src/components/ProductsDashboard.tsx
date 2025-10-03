import { useState, useEffect, useCallback } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Package, 
  ArrowUpRight,
  ArrowDownRight,
  Search,
  SortAsc,
  SortDesc,
  Loader2
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
  // Campos específicos para Google Merchant Center (podem ser null para outros clientes)
  benchmark_week_1?: number | null
  benchmark_week_2?: number | null
  benchmark_week_3?: number | null
  benchmark_week_4?: number | null
  clicks_week_1?: number | null
  clicks_week_2?: number | null
  clicks_week_3?: number | null
  clicks_week_4?: number | null
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
  const [isFullWidth, setIsFullWidth] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

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

  // Função para calcular variação percentual de benchmark (invertido - queda é positiva)
  const calculateBenchmarkChange = (current: number | null | undefined, previous: number | null | undefined) => {
    if (current === null || current === undefined || previous === null || previous === undefined) {
      return null
    }
    if (previous === 0) {
      return current > 0 ? -100 : 0
    }
    return -((current - previous) / previous) * 100
  }

  // Função para calcular variação percentual de clicks
  const calculateClicksChange = (current: number | null | undefined, previous: number | null | undefined) => {
    if (current === null || current === undefined || previous === null || previous === undefined) {
      return null
    }
    if (previous === 0) {
      return current > 0 ? 100 : 0
    }
    return ((current - previous) / previous) * 100
  }

  // Função para calcular variação percentual de score de grade
  const calculateSizeScoreChange = (current: number | null | undefined, previous: number | null | undefined) => {
    if (current === null || current === undefined || previous === null || previous === undefined) {
      return null
    }
    if (previous === 0) {
      return current > 0 ? 100 : 0
    }
    return ((current - previous) / previous) * 100
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

  // Função para alternar expansão do produto
  const toggleProductExpansion = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Nenhum produto encontrado</p>
                    <p className="text-sm">Tente ajustar os filtros ou a busca</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isExpanded = expandedProducts.has(product.item_id)
                  return (
                    <>
                      <tr key={product.item_id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleProductExpansion(product.item_id)}>
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
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg flex items-center gap-1">
                            {isExpanded ? (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                Ocultar
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                Expandir
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Linha expandida com métricas detalhadas */}
                      {isExpanded && (
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={11} className="px-6 py-4">
                            <div className="space-y-4">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Análise Correlacional - Últimas 4 Semanas
                              </h4>
                              
                              {/* Tabela de correlação - Layout horizontal para fácil comparação */}
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium text-gray-700">Métrica</th>
                                      <th className="px-2 py-2 text-center font-medium text-gray-700">W1</th>
                                      <th className="px-2 py-2 text-center font-medium text-gray-700">W2</th>
                                      <th className="px-2 py-2 text-center font-medium text-gray-700">W3</th>
                                      <th className="px-2 py-2 text-center font-medium text-gray-700">W4</th>
                                      <th className="px-2 py-2 text-center font-medium text-gray-700">W1→W2</th>
                                      <th className="px-2 py-2 text-center font-medium text-gray-700">W2→W3</th>
                                      <th className="px-2 py-2 text-center font-medium text-gray-700">W3→W4</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {/* Vendas */}
                                    <tr className="hover:bg-blue-50">
                                      <td className="px-3 py-2 font-medium text-blue-700">Vendas</td>
                                      <td className="px-2 py-2 text-center">{formatNumber(product.purchases_week_1)}</td>
                                      <td className="px-2 py-2 text-center">{formatNumber(product.purchases_week_2)}</td>
                                      <td className="px-2 py-2 text-center">{formatNumber(product.purchases_week_3)}</td>
                                      <td className="px-2 py-2 text-center font-medium">{formatNumber(product.purchases_week_4)}</td>
                                      <td className="px-2 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {product.percent_change_w1_w2 > 0 ? (
                                            <ArrowUpRight className="w-3 h-3 text-green-600" />
                                          ) : product.percent_change_w1_w2 < 0 ? (
                                            <ArrowDownRight className="w-3 h-3 text-red-600" />
                                          ) : (
                                            <Minus className="w-3 h-3 text-gray-600" />
                                          )}
                                          <span className={`font-medium ${
                                            product.percent_change_w1_w2 > 0 ? 'text-green-600' : 
                                            product.percent_change_w1_w2 < 0 ? 'text-red-600' : 'text-gray-600'
                                          }`}>
                                            {formatPercentage(product.percent_change_w1_w2)}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {product.percent_change_w2_w3 > 0 ? (
                                            <ArrowUpRight className="w-3 h-3 text-green-600" />
                                          ) : product.percent_change_w2_w3 < 0 ? (
                                            <ArrowDownRight className="w-3 h-3 text-red-600" />
                                          ) : (
                                            <Minus className="w-3 h-3 text-gray-600" />
                                          )}
                                          <span className={`font-medium ${
                                            product.percent_change_w2_w3 > 0 ? 'text-green-600' : 
                                            product.percent_change_w2_w3 < 0 ? 'text-red-600' : 'text-gray-600'
                                          }`}>
                                            {formatPercentage(product.percent_change_w2_w3)}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {product.percent_change_w3_w4 > 0 ? (
                                            <ArrowUpRight className="w-3 h-3 text-green-600" />
                                          ) : product.percent_change_w3_w4 < 0 ? (
                                            <ArrowDownRight className="w-3 h-3 text-red-600" />
                                          ) : (
                                            <Minus className="w-3 h-3 text-gray-600" />
                                          )}
                                          <span className={`font-medium ${
                                            product.percent_change_w3_w4 > 0 ? 'text-green-600' : 
                                            product.percent_change_w3_w4 < 0 ? 'text-red-600' : 'text-gray-600'
                                          }`}>
                                            {formatPercentage(product.percent_change_w3_w4)}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>

                                    {/* Benchmark (se disponível) */}
                                    {(product.benchmark_week_1 !== null || 
                                      product.benchmark_week_2 !== null || 
                                      product.benchmark_week_3 !== null || 
                                      product.benchmark_week_4 !== null) && (
                                      <tr className="hover:bg-green-50">
                                        <td className="px-3 py-2 font-medium text-green-700">Benchmark (%) - Google Merchant Center</td>
                                        <td className="px-2 py-2 text-center">
                                          {product.benchmark_week_1 !== null && product.benchmark_week_1 !== undefined ? `${(product.benchmark_week_1 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {product.benchmark_week_2 !== null && product.benchmark_week_2 !== undefined ? `${(product.benchmark_week_2 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {product.benchmark_week_3 !== null && product.benchmark_week_3 !== undefined ? `${(product.benchmark_week_3 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center font-medium">
                                          {product.benchmark_week_4 !== null && product.benchmark_week_4 !== undefined ? `${(product.benchmark_week_4 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateBenchmarkChange(product.benchmark_week_2, product.benchmark_week_1)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateBenchmarkChange(product.benchmark_week_3, product.benchmark_week_2)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateBenchmarkChange(product.benchmark_week_4, product.benchmark_week_3)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                      </tr>
                                    )}

                                    {/* Cliques (se disponível) */}
                                    {(product.clicks_week_1 !== null || 
                                      product.clicks_week_2 !== null || 
                                      product.clicks_week_3 !== null || 
                                      product.clicks_week_4 !== null) && (
                                      <tr className="hover:bg-purple-50">
                                        <td className="px-3 py-2 font-medium text-purple-700">Cliques - Google Merchant Center</td>
                                        <td className="px-2 py-2 text-center">
                                          {product.clicks_week_1 !== null && product.clicks_week_1 !== undefined ? formatNumber(product.clicks_week_1) : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {product.clicks_week_2 !== null && product.clicks_week_2 !== undefined ? formatNumber(product.clicks_week_2) : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {product.clicks_week_3 !== null && product.clicks_week_3 !== undefined ? formatNumber(product.clicks_week_3) : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center font-medium">
                                          {product.clicks_week_4 !== null && product.clicks_week_4 !== undefined ? formatNumber(product.clicks_week_4) : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateClicksChange(product.clicks_week_2, product.clicks_week_1)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateClicksChange(product.clicks_week_3, product.clicks_week_2)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateClicksChange(product.clicks_week_4, product.clicks_week_3)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                      </tr>
                                    )}

                                    {/* Score de Grade - Havaianas (se disponível) */}
                                    {selectedTable === 'havaianas' && (
                                      product.size_score_week_1 !== null || 
                                      product.size_score_week_2 !== null || 
                                      product.size_score_week_3 !== null || 
                                      product.size_score_week_4 !== null
                                    ) && (
                                      <tr className="hover:bg-blue-50">
                                        <td className="px-3 py-2 font-medium text-blue-700">Score de Grade (%)</td>
                                        <td className="px-2 py-2 text-center">
                                          {product.size_score_week_1 !== null && product.size_score_week_1 !== undefined ? `${(product.size_score_week_1 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {product.size_score_week_2 !== null && product.size_score_week_2 !== undefined ? `${(product.size_score_week_2 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {product.size_score_week_3 !== null && product.size_score_week_3 !== undefined ? `${(product.size_score_week_3 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center font-medium">
                                          {product.size_score_week_4 !== null && product.size_score_week_4 !== undefined ? `${(product.size_score_week_4 * 100).toFixed(1)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateSizeScoreChange(product.size_score_week_2, product.size_score_week_1)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateSizeScoreChange(product.size_score_week_3, product.size_score_week_2)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {(() => {
                                            const change = calculateSizeScoreChange(product.size_score_week_4, product.size_score_week_3)
                                            return change !== null ? (
                                              <div className="flex items-center justify-center gap-1">
                                                {change > 0 ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : change < 0 ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-600" />}
                                                <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                  {formatPercentage(change)}
                                                </span>
                                              </div>
                                            ) : <span className="text-gray-400">-</span>
                                          })()}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Observações específicas */}
                              {selectedTable === 'havaianas' && product.size_score_trend_status && (
                                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                  <h5 className="font-medium text-purple-900 mb-2">Score de Grade</h5>
                                  <p className="text-purple-700">{product.size_score_trend_status}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
              
              {/* Indicador de carregamento automático */}
              {isAutoLoading && (
                <tr>
                  <td colSpan={11} className="px-6 py-6 text-center bg-blue-50">
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

    </div>
  )
}

export default ProductsDashboard
