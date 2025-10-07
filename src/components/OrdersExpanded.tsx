import { useState, useEffect, useRef } from 'react'
import { X, ShoppingBag, Calendar, User, Package, RefreshCw } from 'lucide-react'
import { api, validateTableName } from '../services/api'

interface Order {
  Horario: string
  ID_da_Transacao: string
  Primeiro_Nome: string
  Status: string
  Receita: number
  Canal: string
  Categoria_de_Trafico: string
  Origem: string
  Midia: string
  Campanha: string
  Conteudo: string
  Pagina_de_Entrada: string
  Parametros_de_URL: string
  Categoria_de_Trafico_Primeiro_Clique: string
  Origem_Primeiro_Clique: string
  Midia_Primeiro_Clique: string
  Campanha_Primeiro_Clique: string
  Conteudo_Primeiro_Clique: string
  Pagina_de_Entrada_Primeiro_Clique: string
  Parametros_de_URL_Primeiro_Clique: string
  Categoria_de_Trafico_Primeiro_Lead: string
  Origem_Primeiro_Lead: string
  Midia_Primeiro_Lead: string
  Campanha_Primeiro_Lead: string
  Conteudo_Primeiro_Lead: string
  Pagina_de_Entrada_Primeiro_Lead: string
  Parametros_de_URL_Primeiro_Lead: string
  city?: string
  region?: string
  country?: string
}

interface OrdersExpandedProps {
  isOpen: boolean
  onClose: () => void
  trafficCategory: string
  startDate: string
  endDate: string
  tableName: string
  attributionModel: string
}

// Cache para armazenar pedidos já carregados
const ordersCache = new Map<string, {
  orders: Order[]
  timestamp: number
  isLoading: boolean
}>()

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

const OrdersExpanded = ({ 
  isOpen, 
  onClose, 
  trafficCategory, 
  startDate, 
  endDate, 
  tableName,
  attributionModel
}: OrdersExpandedProps) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [showOnlyDifferentAttribution, setShowOnlyDifferentAttribution] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Gerar chave única para o cache
  const getCacheKey = () => {
    return `${tableName}-${trafficCategory}-${startDate}-${endDate}-${attributionModel}`
  }

  useEffect(() => {
    if (isOpen) {
      // Verificar se já temos dados em cache primeiro
      const cacheKey = getCacheKey()
      const cached = ordersCache.get(cacheKey)
      
      if (cached && cached.orders.length > 0) {
        // Se temos dados em cache, usar imediatamente
        setOrders(cached.orders)
        setIsLoading(false)
        setError(null)
        setIsInitialLoad(false)
      } else {
        // Se não temos dados, carregar
        loadOrders()
      }
    } else {
      // Limpar dados quando fechar
      setOrders([])
      setError(null)
      setIsInitialLoad(true)
    }

    return () => {
      // Cancelar requisição em andamento se o componente for desmontado
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [isOpen, trafficCategory, startDate, endDate, tableName, attributionModel])

  const loadOrders = async () => {
    const cacheKey = getCacheKey()
    const cached = ordersCache.get(cacheKey)
    
    // Verificar se há dados em cache válidos
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setOrders(cached.orders)
      setIsLoading(false)
      setError(null)
      setIsInitialLoad(false)
      return
    }

    // Se já está carregando, não fazer nova requisição
    if (cached?.isLoading) {
      setIsLoading(true)
      return
    }

    // Marcar como carregando no cache
    ordersCache.set(cacheKey, {
      orders: [],
      timestamp: Date.now(),
      isLoading: true
    })

    setIsLoading(true)
    setError(null)
    setIsInitialLoad(true)

    try {
      // Cancelar requisição anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Criar novo controller para esta requisição
      abortControllerRef.current = new AbortController()
      
      const token = localStorage.getItem('auth-token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      // Validar que tableName não é "all" - não deve consultar diretamente
      if (!validateTableName(tableName)) {
        return
      }

      // Preparar parâmetros baseados no modelo de atribuição
      const requestParams: any = {
        start_date: startDate,
        end_date: endDate,
        table_name: tableName,
        limit: 100
      }
      
      // Usar parâmetro correto baseado no modelo de atribuição
      if (attributionModel === 'Primeiro Clique') {
        requestParams.fs_traffic_category = trafficCategory
      } else {
        requestParams.traffic_category = trafficCategory
      }
      
      console.log('🔄 OrdersExpanded - Baixando pedidos com parâmetros:', requestParams)
      
      const response = await api.getOrders(token, requestParams, abortControllerRef.current.signal)

      const newOrders = response.data || []
      
      // Debug: verificar campos de data disponíveis
      if (newOrders.length > 0) {
        console.log('📅 Campos de data disponíveis no primeiro pedido:', {
          Horario: newOrders[0].Horario,
          Data: newOrders[0].Data,
          created_at: newOrders[0].created_at,
          data_criacao: newOrders[0].data_criacao,
          timestamp: newOrders[0].timestamp
        })
        console.log('📅 Todos os campos do primeiro pedido:', newOrders[0])
      }
      
      // Atualizar cache
      ordersCache.set(cacheKey, {
        orders: newOrders,
        timestamp: Date.now(),
        isLoading: false
      })

      setOrders(newOrders)
      setError(null)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Requisição foi cancelada, não fazer nada
        return
      }
      
      console.error('Erro ao buscar pedidos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao buscar pedidos')
      
      // Remover do cache em caso de erro
      ordersCache.delete(cacheKey)
    } finally {
      setIsLoading(false)
      setIsInitialLoad(false)
    }
  }

  const handleRetry = () => {
    const cacheKey = getCacheKey()
    ordersCache.delete(cacheKey) // Limpar cache para forçar nova busca
    loadOrders()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    console.log('📅 Tentando formatar data:', dateString)
    
    if (!dateString || dateString.trim() === '') {
      console.log('📅 Data vazia ou nula')
      return 'Data não informada'
    }
    
    try {
      // Tentar diferentes formatos de data
      let date: Date
      
      // Se é uma string ISO
      if (dateString.includes('T') || dateString.includes('Z')) {
        console.log('📅 Formato ISO detectado')
        date = new Date(dateString)
      }
      // Se é uma string de data simples
      else if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        console.log('📅 Formato YYYY-MM-DD detectado')
        date = new Date(dateString + 'T00:00:00')
      }
      // Se é uma string de data brasileira
      else if (dateString.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        console.log('📅 Formato DD/MM/YYYY detectado')
        const [day, month, year] = dateString.split('/')
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
      // Se é um timestamp numérico
      else if (/^\d+$/.test(dateString)) {
        console.log('📅 Timestamp numérico detectado')
        date = new Date(parseInt(dateString))
      }
      // Tentar parse direto
      else {
        console.log('📅 Tentando parse direto')
        date = new Date(dateString)
      }
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        console.log('📅 Data inválida após parsing')
        return dateString || 'Data inválida'
      }
      
      const formattedDate = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      
      console.log('📅 Data formatada com sucesso:', formattedDate)
      return formattedDate
    } catch (error) {
      console.log('❌ Erro ao formatar data:', dateString, error)
      return dateString || 'Data inválida'
    }
  }

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    switch (status.toLowerCase()) {
      case 'paid':
      case 'pago':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
      case 'cancelado':
        return 'bg-red-100 text-red-800'
      case 'refunded':
      case 'reembolsado':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOrderDate = (order: Order) => {
    // Tentar diferentes campos de data possíveis
    const possibleDateFields = [
      'Horario',
      'Data',
      'created_at',
      'data_criacao',
      'timestamp',
      'data_pedido',
      'data_transacao',
      'date',
      'data',
      'hora',
      'time'
    ]
    
    console.log('🔍 Procurando data para pedido:', order.ID_da_Transacao)
    
    for (const field of possibleDateFields) {
      const value = (order as any)[field]
      console.log(`🔍 Campo ${field}:`, value)
      
      if (value && value.toString().trim() !== '') {
        const formattedDate = formatDate(value.toString())
        console.log(`✅ Data encontrada no campo ${field}:`, formattedDate)
        return formattedDate
      }
    }
    
    // Se não encontrou nos campos conhecidos, procurar por qualquer campo que contenha 'data' ou 'hora'
    const allFields = Object.keys(order)
    console.log('🔍 Todos os campos disponíveis:', allFields)
    
    for (const field of allFields) {
      const value = (order as any)[field]
      if (value && 
          value.toString().trim() !== '' && 
          (field.toLowerCase().includes('data') || 
           field.toLowerCase().includes('hora') || 
           field.toLowerCase().includes('time') ||
           field.toLowerCase().includes('date'))) {
        const formattedDate = formatDate(value.toString())
        console.log(`✅ Data encontrada no campo ${field}:`, formattedDate)
        return formattedDate
      }
    }
    
    console.log('❌ Nenhuma data encontrada para o pedido:', order.ID_da_Transacao)
    return 'Data não informada'
  }

  const hasDifferentAttribution = (order: Order) => {
    const lastClick = order.Categoria_de_Trafico
    const firstClick = order.Categoria_de_Trafico_Primeiro_Clique
    
    // Se algum dos campos estiver vazio, considerar como igual
    if (!lastClick || !firstClick || 
        lastClick.trim() === '' || firstClick.trim() === '') {
      return false
    }
    
    return lastClick !== firstClick
  }

  const filteredOrders = showOnlyDifferentAttribution 
    ? orders.filter(hasDifferentAttribution)
    : orders

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Pedidos - {trafficCategory}
              </h2>
              <p className="text-sm text-gray-500">
                {startDate} a {endDate} • {tableName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Filtro de Atribuição Diferente */}
            <div className="flex items-center gap-2 mr-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyDifferentAttribution}
                  onChange={(e) => setShowOnlyDifferentAttribution(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="whitespace-nowrap">Apenas atribuições diferentes</span>
              </label>
              {showOnlyDifferentAttribution && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {filteredOrders.length} de {orders.length}
                </span>
              )}
            </div>
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Atualizar pedidos"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
          {isLoading && isInitialLoad ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando pedidos...</p>
                <p className="text-sm text-gray-500 mt-2">Isso pode levar alguns segundos</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar pedidos</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {showOnlyDifferentAttribution ? 'Nenhum pedido com atribuição diferente' : 'Nenhum pedido encontrado'}
                </h3>
                <p className="text-gray-600">
                  {showOnlyDifferentAttribution 
                    ? `Todos os ${orders.length} pedidos têm a mesma atribuição entre primeiro e último clique.`
                    : `Não foram encontrados pedidos para ${trafficCategory} no período selecionado.`
                  }
                </p>
              </div>
            </div>
          ) : (
                          <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''} encontrado{filteredOrders.length !== 1 ? 's' : ''}
                    {showOnlyDifferentAttribution && orders.length !== filteredOrders.length && (
                      <span className="text-gray-500 ml-1">
                        (de {orders.length} total)
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    {orders.length > 5 && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        <span>Role para ver mais</span>
                      </div>
                    )}
                    {isLoading && !isInitialLoad && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        <span>Atualizando...</span>
                      </div>
                    )}
                  </div>
                </div>
              
                              <div className="space-y-4">
                  {filteredOrders.map((order, index) => (
                   <div key={order.ID_da_Transacao || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                     {/* Order Header */}
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-3">
                         <div className="flex items-center gap-2">
                           <Package className="w-4 h-4 text-gray-500" />
                           <span className="font-medium text-gray-900">
                             {order.ID_da_Transacao}
                           </span>
                         </div>
                         <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.Status)}`}>
                           {order.Status}
                         </span>
                       </div>
                       <div className="text-right">
                         <p className="text-lg font-semibold text-green-600">
                           {formatCurrency(order.Receita)}
                         </p>
                         <p className="text-xs text-gray-500">
                           {getOrderDate(order)}
                         </p>
                       </div>
                     </div>

                     {/* Customer Info */}
                     <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                       <div className="flex items-center gap-1">
                         <User className="w-4 h-4" />
                         <span>{order.Primeiro_Nome || 'Nome não informado'}</span>
                       </div>
                       <div className="flex items-center gap-1">
                         <Calendar className="w-4 h-4" />
                         <span>{getOrderDate(order)}</span>
                       </div>
                     </div>

                     {/* Traffic Info - Last Click */}
                     <div className="border-t border-gray-100 pt-3">
                       <h4 className="text-sm font-medium text-blue-700 mb-2">🔄 Último Clique Não Direto (Atribuição Atual):</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                         <div>
                           <p className="text-gray-600"><strong>Categoria:</strong> {order.Categoria_de_Trafico}</p>
                           <p className="text-gray-600"><strong>Origem:</strong> {order.Origem}</p>
                           <p className="text-gray-600"><strong>Mídia:</strong> {order.Midia}</p>
                           <p className="text-gray-600"><strong>Canal:</strong> {order.Canal}</p>
                         </div>
                         <div>
                           <p className="text-gray-600"><strong>Campanha:</strong> {order.Campanha}</p>
                           <p className="text-gray-600"><strong>Conteúdo:</strong> {order.Conteudo}</p>
                           <p className="text-gray-600"><strong>Página de Entrada:</strong> 
                             <a href={order.Pagina_de_Entrada} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                               {order.Pagina_de_Entrada}
                             </a>
                           </p>
                         </div>
                       </div>
                     </div>

                     {/* Traffic Info - First Click */}
                     <div className="border-t border-gray-100 pt-3">
                       <h4 className="text-sm font-medium text-green-700 mb-2">🎯 Primeiro Clique:</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                         <div>
                           <p className="text-gray-600"><strong>Categoria:</strong> {order.Categoria_de_Trafico_Primeiro_Clique || 'Não informado'}</p>
                           <p className="text-gray-600"><strong>Origem:</strong> {order.Origem_Primeiro_Clique || 'Não informado'}</p>
                           <p className="text-gray-600"><strong>Mídia:</strong> {order.Midia_Primeiro_Clique || 'Não informado'}</p>
                         </div>
                         <div>
                           <p className="text-gray-600"><strong>Campanha:</strong> {order.Campanha_Primeiro_Clique || 'Não informado'}</p>
                           <p className="text-gray-600"><strong>Conteúdo:</strong> {order.Conteudo_Primeiro_Clique || 'Não informado'}</p>
                           <p className="text-gray-600"><strong>Página de Entrada:</strong> 
                             {order.Pagina_de_Entrada_Primeiro_Clique ? (
                               <a href={order.Pagina_de_Entrada_Primeiro_Clique} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline ml-1">
                                 {order.Pagina_de_Entrada_Primeiro_Clique}
                               </a>
                             ) : (
                               <span className="text-gray-500 ml-1">Não informado</span>
                             )}
                           </p>
                         </div>
                       </div>
                     </div>

                     {/* Traffic Info - First Lead */}
                     {order.Categoria_de_Trafico_Primeiro_Lead && order.Categoria_de_Trafico_Primeiro_Lead.trim() !== '' && (
                       <div className="border-t border-gray-100 pt-3">
                         <h4 className="text-sm font-medium text-purple-700 mb-2">📞 Primeiro Lead:</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                           <div>
                             <p className="text-gray-600"><strong>Categoria:</strong> {order.Categoria_de_Trafico_Primeiro_Lead}</p>
                             <p className="text-gray-600"><strong>Origem:</strong> {order.Origem_Primeiro_Lead}</p>
                             <p className="text-gray-600"><strong>Mídia:</strong> {order.Midia_Primeiro_Lead}</p>
                           </div>
                           <div>
                             <p className="text-gray-600"><strong>Campanha:</strong> {order.Campanha_Primeiro_Lead}</p>
                             <p className="text-gray-600"><strong>Conteúdo:</strong> {order.Conteudo_Primeiro_Lead}</p>
                             <p className="text-gray-600"><strong>Página de Entrada:</strong> 
                               {order.Pagina_de_Entrada_Primeiro_Lead ? (
                                 <a href={order.Pagina_de_Entrada_Primeiro_Lead} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline ml-1">
                                   {order.Pagina_de_Entrada_Primeiro_Lead}
                                 </a>
                               ) : (
                                 <span className="text-gray-500 ml-1">Não informado</span>
                               )}
                             </p>
                           </div>
                         </div>
                       </div>
                     )}

                     {/* Debug Info - Temporário */}
                     {getOrderDate(order) === 'Data não informada' && (
                       <div className="border-t border-gray-100 pt-3">
                         <h4 className="text-sm font-medium text-red-700 mb-2">Debug - Campos Disponíveis:</h4>
                         <div className="bg-red-50 p-2 rounded text-xs">
                           <pre className="whitespace-pre-wrap overflow-x-auto">
                             {JSON.stringify(order, null, 2)}
                           </pre>
                         </div>
                       </div>
                     )}

                     {/* Comparison Section */}
                     <div className="border-t border-gray-100 pt-3">
                       <h4 className="text-sm font-medium text-gray-700 mb-2">📊 Comparação de Atribuição:</h4>
                       <div className="bg-gradient-to-r from-blue-50 to-green-50 p-3 rounded-lg">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                           <div className="text-center">
                             <div className="font-semibold text-blue-700 mb-1">🔄 Último Clique Não Direto</div>
                             <div className="bg-white p-2 rounded border border-blue-200">
                               <div className="font-medium">{order.Categoria_de_Trafico}</div>
                               <div className="text-gray-600">{order.Campanha}</div>
                             </div>
                           </div>
                           <div className="text-center">
                             <div className="font-semibold text-green-700 mb-1">🎯 Primeiro Clique</div>
                             <div className="bg-white p-2 rounded border border-green-200">
                               <div className="font-medium">{order.Categoria_de_Trafico_Primeiro_Clique || 'Não informado'}</div>
                               <div className="text-gray-600">{order.Campanha_Primeiro_Clique || 'Não informado'}</div>
                             </div>
                           </div>
                         </div>
                         {(order.Categoria_de_Trafico !== order.Categoria_de_Trafico_Primeiro_Clique) && (
                           <div className="mt-2 text-center">
                             <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                               ⚠️ Diferentes fontes de tráfego
                             </span>
                           </div>
                         )}
                       </div>
                     </div>

                     {/* URL Parameters */}
                     {order.Parametros_de_URL && (
                       <div className="border-t border-gray-100 pt-3">
                         <h4 className="text-sm font-medium text-gray-700 mb-2">Parâmetros da URL:</h4>
                         <div className="bg-gray-50 p-2 rounded text-xs font-mono break-all">
                           {order.Parametros_de_URL}
                         </div>
                       </div>
                     )}
                   </div>
                 ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrdersExpanded 