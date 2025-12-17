import { useState, useEffect } from 'react'
import { 
  DollarSign, 
  AlertCircle,
  Users,
  Map,
  Tag,
  BarChart3,
  TrendingUp,
  Globe,
  ShoppingBag
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { RealtimeDataItem } from '../types'

interface RealtimeDataProps {
  selectedTable: string
}

interface HourlyMetrics {
  hour: number // 0-23
  hourLabel: string // "00:00", "01:00", etc
  sessions: number
  revenue: number
  isCurrentHour: boolean
}

interface TrafficCategoryMetrics {
  category: string
  sessions: number
  revenue: number
  percentage: number
  color: string
}

interface SourceMediumMetrics {
  source: string
  medium: string
  sessions: number
  revenue: number
  percentage: number
}

interface CampaignMetrics {
  campaign: string
  sessions: number
  revenue: number
  percentage: number
}

interface PageMetrics {
  page: string
  sessions: number
  revenue: number
  percentage: number
}

interface ProductMetrics {
  product: string
  sessions: number
  revenue: number
  percentage: number
}

const RealtimeData = ({ selectedTable }: RealtimeDataProps) => {
  const [data, setData] = useState<RealtimeDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finalRevenue, setFinalRevenue] = useState<number>(0)
  
  // Estados para controle de paginação das tabelas
  const [showAllTrafficCategories, setShowAllTrafficCategories] = useState(false)
  const [showAllSourceMedium, setShowAllSourceMedium] = useState(false)
  const [showAllCampaigns, setShowAllCampaigns] = useState(false)
  const [showAllPages, setShowAllPages] = useState(false)
  const [showAllProducts, setShowAllProducts] = useState(false)
  
  // Estados para controle de ordenação das tabelas
  const [sortTrafficCategories, setSortTrafficCategories] = useState<'sessions' | 'revenue'>('revenue')
  const [sortSourceMedium, setSortSourceMedium] = useState<'sessions' | 'revenue'>('revenue')
  const [sortCampaigns, setSortCampaigns] = useState<'sessions' | 'revenue'>('revenue')
  const [sortPages, setSortPages] = useState<'sessions' | 'revenue'>('revenue')
  const [sortProducts, setSortProducts] = useState<'sessions' | 'revenue'>('revenue')
  
  // Estados para filtros ativos
  const [activeFilters, setActiveFilters] = useState<{
    trafficCategory?: string
    sourceMedium?: { source: string; medium: string }
    campaign?: string
    page?: string
    product?: string
  }>({})

  // Helper para obter data/hora atual em São Paulo
  const getSaoPauloNow = (): Date => {
    return new Date()
  }

  // Helper para converter timestamp da API (UTC) para horário de São Paulo
  const toSaoPauloTime = (timestamp: string): Date => {
    // API provavelmente envia em UTC, converter para São Paulo (UTC-3)
    const utcDate = new Date(timestamp)
    
    // Se o timestamp não tem informação de timezone, assumir que é UTC
    // e subtrair 3 horas para converter para São Paulo
    const saoPauloDate = new Date(utcDate.getTime() - (3 * 60 * 60 * 1000))
    
    return saoPauloDate
  }

  // Função para buscar dados
  const fetchRealtimeData = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

      // Validar que selectedTable não é "all"
      if (!validateTableName(selectedTable)) {
        setError('Tabela inválida selecionada')
        return
      }

      setError(null)
      console.log('🔄 Fetching realtime data for table:', selectedTable)
      
      const response = await api.getRealtimeData(token, {
        table_name: selectedTable
      })
      
      console.log('✅ Realtime data response:', response)
      setData(response.data || [])

      // Buscar receita final em tempo real (agregada)
      try {
        const revenueResp = await api.getRealtimeFinalRevenue(token, { table_name: selectedTable })
        // Suportar chaves alternativas que o backend possa retornar
        const value =
          (revenueResp as any)?.final_revenue ??
          (revenueResp as any)?.total_revenue ??
          (revenueResp as any)?.revenue ??
          0
        setFinalRevenue(typeof value === 'number' ? value : 0)
      } catch (revErr) {
        console.warn('⚠️ Falha ao buscar receita final em tempo real:', revErr)
        setFinalRevenue(0)
      }
    } catch (error) {
      console.error('❌ Error fetching realtime data:', error)
      setError('Erro ao buscar dados')
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  // Buscar dados quando a tabela mudar
  useEffect(() => {
    setIsLoading(true)
    fetchRealtimeData()
  }, [selectedTable])





  // Função para categorizar tráfego
  const categorizeTraffic = (source: string, medium: string): string => {
    const sourceL = source.toLowerCase()
    const mediumL = medium.toLowerCase()
    
    if (sourceL === 'direct' || (sourceL === '(direct)' && mediumL === '(none)')) {
      return 'Tráfego Direto'
    } else if (sourceL.includes('google') && (mediumL.includes('organic') || mediumL.includes('search'))) {
      return 'Busca Orgânica'
    } else if (sourceL.includes('google') && (mediumL.includes('cpc') || mediumL.includes('paid'))) {
      return 'Google Ads'
    } else if (sourceL.includes('facebook') || sourceL.includes('instagram') || mediumL.includes('social')) {
      return 'Redes Sociais'
    } else if (mediumL.includes('email')) {
      return 'E-mail Marketing'
    } else if (mediumL.includes('referral')) {
      return 'Sites de Referência'
    } else if (mediumL.includes('cpc') || mediumL.includes('paid')) {
      return 'Mídia Paga'
    } else {
      return 'Outros'
    }
  }

  // Função para obter cor da categoria
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'Tráfego Direto': return 'bg-gray-500'
      case 'Busca Orgânica': return 'bg-blue-500'
      case 'Google Ads': return 'bg-green-500'
      case 'Redes Sociais': return 'bg-purple-500'
      case 'E-mail Marketing': return 'bg-orange-500'
      case 'Sites de Referência': return 'bg-yellow-500'
      case 'Mídia Paga': return 'bg-red-500'
      default: return 'bg-indigo-500'
    }
  }

  // Função para obter cor do canal (mantida para compatibilidade)
  const getChannelColor = (source: string, medium: string) => {
    const channel = `${source}/${medium}`.toLowerCase()
    
    if (channel.includes('google') || channel.includes('search')) {
      return 'bg-blue-100 text-blue-800'
    } else if (channel.includes('facebook') || channel.includes('social')) {
      return 'bg-purple-100 text-purple-800'
    } else if (channel.includes('email')) {
      return 'bg-green-100 text-green-800'
    } else if (channel.includes('direct')) {
      return 'bg-gray-100 text-gray-800'
    } else if (channel.includes('referral')) {
      return 'bg-orange-100 text-orange-800'
    } else {
      return 'bg-indigo-100 text-indigo-800'
    }
  }

  // Filtrar dados do dia atual (São Paulo)
  const getTodayData = () => {
    const now = getSaoPauloNow()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    
    return data.filter(item => {
      const eventTime = toSaoPauloTime(item.event_timestamp)
      return eventTime >= startOfDay && eventTime < endOfDay
    })
  }

  const todayData = getTodayData()

  // Criar timeline hora a hora do dia atual (00:00 - 23:00) - São Paulo
  const getTodayHourlyTimeline = (): HourlyMetrics[] => {
    const now = getSaoPauloNow()
    const currentHour = now.getHours()
    
    const timeline: HourlyMetrics[] = []
    
    // Criar estrutura para todas as 24 horas
    for (let hour = 0; hour < 24; hour++) {
      timeline.push({
        hour,
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        sessions: 0,
        revenue: 0,
        isCurrentHour: hour === currentHour
      })
    }
    
    // Agrupar eventos por hora
    const eventsByHour: { [key: number]: RealtimeDataItem[] } = {}
    todayData.forEach(item => {
      const eventTime = toSaoPauloTime(item.event_timestamp)
      const hour = eventTime.getHours()
      
      if (!eventsByHour[hour]) {
        eventsByHour[hour] = []
      }
      eventsByHour[hour].push(item)
    })
    
    // Preencher dados para cada hora
    Object.keys(eventsByHour).forEach(hourStr => {
      const hour = parseInt(hourStr)
      const hourEvents = eventsByHour[hour]
      
      // Contar receita
      timeline[hour].revenue = hourEvents.reduce((sum, item) => sum + (item.item_revenue || 0), 0)
      
      // Contar sessões únicas
      const uniqueSessions = new Set(hourEvents.map(item => item.session_id))
      timeline[hour].sessions = uniqueSessions.size
    })
    
    return timeline
  }

  const hourlyTimeline = getTodayHourlyTimeline()

  // Dados filtrados baseados nos filtros ativos
  const getFilteredData = () => {
    let filteredData = [...todayData]

    if (activeFilters.trafficCategory) {
      filteredData = filteredData.filter(item => 
        (item.traffic_category || categorizeTraffic(item.source, item.medium)) === activeFilters.trafficCategory
      )
    }

    if (activeFilters.sourceMedium) {
      filteredData = filteredData.filter(item => 
        item.source === activeFilters.sourceMedium!.source && 
        item.medium === activeFilters.sourceMedium!.medium
      )
    }

    if (activeFilters.campaign) {
      filteredData = filteredData.filter(item => 
        (item.campaign || '(not set)') === activeFilters.campaign
      )
    }

    if (activeFilters.page) {
      filteredData = filteredData.filter(item => 
        (item.page_location || '(not set)') === activeFilters.page
      )
    }

    if (activeFilters.product) {
      filteredData = filteredData.filter(item => 
        item.item_name === activeFilters.product
      )
    }

    return filteredData
  }

  const filteredData = getFilteredData()

  // Calcular métricas por categoria de tráfego
  const getTrafficCategoryMetrics = (): TrafficCategoryMetrics[] => {
    const dataToUse = Object.keys(activeFilters).length > 0 ? filteredData : todayData
    const categoryData: { [key: string]: TrafficCategoryMetrics } = {}
    
    // Agrupar dados por categoria
    dataToUse.forEach(item => {
      const category = item.traffic_category || categorizeTraffic(item.source, item.medium)
      
      if (!categoryData[category]) {
        categoryData[category] = {
          category,
          sessions: 0,
          revenue: 0,
          percentage: 0,
          color: getCategoryColor(category)
        }
      }
      
      categoryData[category].revenue += item.item_revenue || 0
    })
    
    // Contar sessões únicas por categoria
    const sessionsByCategory: { [key: string]: Set<string> } = {}
    dataToUse.forEach(item => {
      const category = item.traffic_category || categorizeTraffic(item.source, item.medium)
      
      if (!sessionsByCategory[category]) {
        sessionsByCategory[category] = new Set()
      }
      sessionsByCategory[category].add(item.session_id)
    })
    
    // Adicionar contagem de sessões e calcular percentuais
    const totalSessions = new Set(dataToUse.map(item => item.session_id)).size
    Object.keys(categoryData).forEach(category => {
      categoryData[category].sessions = sessionsByCategory[category]?.size || 0
      categoryData[category].percentage = totalSessions > 0 ? 
        (categoryData[category].sessions / totalSessions) * 100 : 0
    })
    
    // Retornar ordenado pela métrica selecionada
    return Object.values(categoryData).sort((a, b) => {
      if (sortTrafficCategories === 'sessions') {
        return b.sessions - a.sessions
      } else {
        return b.revenue - a.revenue
      }
    })
  }

  const trafficCategories = getTrafficCategoryMetrics()

  // Calcular métricas por origem e mídia
  const getSourceMediumMetrics = (): SourceMediumMetrics[] => {
    const dataToUse = Object.keys(activeFilters).length > 0 ? filteredData : todayData
    const sourceMediumData: { [key: string]: SourceMediumMetrics } = {}
    
    // Agrupar dados por source/medium
    dataToUse.forEach(item => {
      const key = `${item.source}|${item.medium}`
      
      if (!sourceMediumData[key]) {
        sourceMediumData[key] = {
          source: item.source,
          medium: item.medium,
          sessions: 0,
          revenue: 0,
          percentage: 0
        }
      }
      
      sourceMediumData[key].revenue += item.item_revenue || 0
    })
    
    // Contar sessões únicas por source/medium
    const sessionsBySourceMedium: { [key: string]: Set<string> } = {}
    dataToUse.forEach(item => {
      const key = `${item.source}|${item.medium}`
      
      if (!sessionsBySourceMedium[key]) {
        sessionsBySourceMedium[key] = new Set()
      }
      sessionsBySourceMedium[key].add(item.session_id)
    })
    
    // Adicionar contagem de sessões e calcular percentuais
    const totalSessions = new Set(dataToUse.map(item => item.session_id)).size
    Object.keys(sourceMediumData).forEach(key => {
      sourceMediumData[key].sessions = sessionsBySourceMedium[key]?.size || 0
      sourceMediumData[key].percentage = totalSessions > 0 ? 
        (sourceMediumData[key].sessions / totalSessions) * 100 : 0
    })
    
    // Retornar ordenado pela métrica selecionada
    return Object.values(sourceMediumData).sort((a, b) => {
      if (sortSourceMedium === 'sessions') {
        return b.sessions - a.sessions
      } else {
        return b.revenue - a.revenue
      }
    })
  }

  const sourceMediumMetrics = getSourceMediumMetrics()

  // Calcular métricas por campanha
  const getCampaignMetrics = (): CampaignMetrics[] => {
    const dataToUse = Object.keys(activeFilters).length > 0 ? filteredData : todayData
    const campaignData: { [key: string]: CampaignMetrics } = {}
    
    // Agrupar dados por campanha
    dataToUse.forEach(item => {
      const campaign = item.campaign || '(not set)'
      
      if (!campaignData[campaign]) {
        campaignData[campaign] = {
          campaign,
          sessions: 0,
          revenue: 0,
          percentage: 0
        }
      }
      
      campaignData[campaign].revenue += item.item_revenue || 0
    })
    
    // Contar sessões únicas por campanha
    const sessionsByCampaign: { [key: string]: Set<string> } = {}
    dataToUse.forEach(item => {
      const campaign = item.campaign || '(not set)'
      
      if (!sessionsByCampaign[campaign]) {
        sessionsByCampaign[campaign] = new Set()
      }
      sessionsByCampaign[campaign].add(item.session_id)
    })
    
    // Adicionar contagem de sessões e calcular percentuais
    const totalSessions = new Set(dataToUse.map(item => item.session_id)).size
    Object.keys(campaignData).forEach(key => {
      campaignData[key].sessions = sessionsByCampaign[key]?.size || 0
      campaignData[key].percentage = totalSessions > 0 ? 
        (campaignData[key].sessions / totalSessions) * 100 : 0
    })
    
    // Retornar ordenado pela métrica selecionada
    return Object.values(campaignData).sort((a, b) => {
      if (sortCampaigns === 'sessions') {
        return b.sessions - a.sessions
      } else {
        return b.revenue - a.revenue
      }
    })
  }

  const campaignMetrics = getCampaignMetrics()

  // Calcular métricas por página
  const getPageMetrics = (): PageMetrics[] => {
    const dataToUse = Object.keys(activeFilters).length > 0 ? filteredData : todayData
    const pageData: { [key: string]: PageMetrics } = {}
    
    // Agrupar dados por página
    dataToUse.forEach(item => {
      const page = item.page_location || '(not set)'
      
      if (!pageData[page]) {
        pageData[page] = {
          page,
          sessions: 0,
          revenue: 0,
          percentage: 0
        }
      }
      
      pageData[page].revenue += item.item_revenue || 0
    })
    
    // Contar sessões únicas por página
    const sessionsByPage: { [key: string]: Set<string> } = {}
    dataToUse.forEach(item => {
      const page = item.page_location || '(not set)'
      
      if (!sessionsByPage[page]) {
        sessionsByPage[page] = new Set()
      }
      sessionsByPage[page].add(item.session_id)
    })
    
    // Adicionar contagem de sessões e calcular percentuais
    const totalSessions = new Set(dataToUse.map(item => item.session_id)).size
    Object.keys(pageData).forEach(key => {
      pageData[key].sessions = sessionsByPage[key]?.size || 0
      pageData[key].percentage = totalSessions > 0 ? 
        (pageData[key].sessions / totalSessions) * 100 : 0
    })
    
    // Retornar ordenado pela métrica selecionada
    return Object.values(pageData).sort((a, b) => {
      if (sortPages === 'sessions') {
        return b.sessions - a.sessions
      } else {
        return b.revenue - a.revenue
      }
    })
  }

  const pageMetrics = getPageMetrics()

  // Calcular métricas por produto
  const getProductMetrics = (): ProductMetrics[] => {
    const dataToUse = Object.keys(activeFilters).length > 0 ? filteredData : todayData
    const productData: { [key: string]: ProductMetrics } = {}
    
    // Agrupar dados por produto (apenas eventos com item_name)
    dataToUse.forEach(item => {
      if (item.item_name) {
        const product = item.item_name
        
        if (!productData[product]) {
          productData[product] = {
            product,
            sessions: 0,
            revenue: 0,
            percentage: 0
          }
        }
        
        productData[product].revenue += item.item_revenue || 0
      }
    })
    
    // Contar sessões únicas por produto
    const sessionsByProduct: { [key: string]: Set<string> } = {}
    dataToUse.forEach(item => {
      if (item.item_name) {
        const product = item.item_name
        
        if (!sessionsByProduct[product]) {
          sessionsByProduct[product] = new Set()
        }
        sessionsByProduct[product].add(item.session_id)
      }
    })
    
    // Adicionar contagem de sessões e calcular percentuais
    const totalSessions = new Set(dataToUse.map(item => item.session_id)).size
    Object.keys(productData).forEach(key => {
      productData[key].sessions = sessionsByProduct[key]?.size || 0
      productData[key].percentage = totalSessions > 0 ? 
        (productData[key].sessions / totalSessions) * 100 : 0
    })
    
    // Retornar ordenado pela métrica selecionada
    return Object.values(productData).sort((a, b) => {
      if (sortProducts === 'sessions') {
        return b.sessions - a.sessions
      } else {
        return b.revenue - a.revenue
      }
    })
  }

  const productMetrics = getProductMetrics()

  // Funções para filtros
  const applyFilter = (filterType: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const clearFilter = (filterType: string) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[filterType as keyof typeof prev]
      return newFilters
    })
  }

  const clearAllFilters = () => {
    setActiveFilters({})
  }

  // Timeline filtrada baseada nos filtros ativos
  const getFilteredTimeline = () => {
    if (Object.keys(activeFilters).length === 0) {
      return hourlyTimeline
    }

    const filteredData = getFilteredData()
    const timeline = Array.from({ length: 24 }, (_, hour) => {
      const hourData = filteredData.filter(item => {
        const itemHour = toSaoPauloTime(item.event_timestamp).getHours()
        return itemHour === hour
      })

      return {
        hour,
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        sessions: new Set(hourData.map(item => item.session_id)).size,
        revenue: hourData.reduce((sum, item) => sum + (item.item_revenue || 0), 0),
        isCurrentHour: hour === getSaoPauloNow().getHours()
      }
    })

    return timeline
  }

  const filteredTimeline = getFilteredTimeline()

  // Métricas resumidas do dia atual (São Paulo) ou filtradas
  const dataToUse = Object.keys(activeFilters).length > 0 ? filteredData : todayData
  const timelineToUse = Object.keys(activeFilters).length > 0 ? filteredTimeline : hourlyTimeline
  
  const metrics = {
    totalRevenue: dataToUse.reduce((sum, item) => sum + (item.item_revenue || 0), 0),
    uniqueSessions: new Set(dataToUse.map(item => item.session_id)).size,
    activeHours: timelineToUse.filter(h => h.sessions > 0).length,
    currentHourSessions: timelineToUse.find(h => h.isCurrentHour)?.sessions || 0,
    currentHourRevenue: timelineToUse.find(h => h.isCurrentHour)?.revenue || 0,
    peakHour: timelineToUse.reduce((peak, hour) => 
      hour.sessions > peak.sessions ? hour : peak, timelineToUse[0]),
    avgSessionsPerHour: timelineToUse.filter(h => h.sessions > 0).length > 0 ? 
      Math.round(timelineToUse.reduce((sum, h) => sum + h.sessions, 0) / timelineToUse.filter(h => h.sessions > 0).length) : 0
  }

  if (isLoading && data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Carregando dados...</h3>
        <p className="text-gray-600">Aguarde enquanto buscamos os dados</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar dados</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => fetchRealtimeData()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Indicador de Filtros Ativos */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-800">Filtros ativos:</span>
              <div className="flex flex-wrap gap-2">
                {activeFilters.trafficCategory && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Categoria: {activeFilters.trafficCategory}
                    <button
                      onClick={() => clearFilter('trafficCategory')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {activeFilters.sourceMedium && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Origem: {activeFilters.sourceMedium.source} / {activeFilters.sourceMedium.medium}
            <button
                      onClick={() => clearFilter('sourceMedium')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {activeFilters.campaign && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Campanha: {activeFilters.campaign}
                    <button
                      onClick={() => clearFilter('campaign')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
            </button>
                  </span>
                )}
                {activeFilters.page && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Página: {activeFilters.page.length > 30 ? activeFilters.page.substring(0, 30) + '...' : activeFilters.page}
            <button
                      onClick={() => clearFilter('page')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
            >
                      ×
            </button>
                  </span>
                )}
                {activeFilters.product && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Produto: {activeFilters.product.length > 30 ? activeFilters.product.substring(0, 30) + '...' : activeFilters.product}
                    <button
                      onClick={() => clearFilter('product')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
          </div>
        </div>
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpar todos os filtros
            </button>
      </div>
        </div>
      )}

      {/* Métricas resumidas do dia */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {Object.keys(activeFilters).length > 0 ? 'Métricas Filtradas' : 'Métricas do Dia'}
        </h3>
        {Object.keys(activeFilters).length > 0 && (
          <p className="text-sm text-gray-600">
            Mostrando dados filtrados por {Object.keys(activeFilters).length} critério(s) - Timeline e todas as tabelas atualizadas
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Hoje</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{metrics.uniqueSessions}</h3>
          <p className="text-sm text-gray-600">Sessões únicas</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Hoje</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(metrics.totalRevenue)}
          </h3>
          <p className="text-sm text-gray-600">Receita de Produto</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-gray-500">Hoje</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(finalRevenue)}
          </h3>
          <p className="text-sm text-gray-600">Receita de Pedidos</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Agora</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{metrics.currentHourSessions}</h3>
          <p className="text-sm text-gray-600">Sessões desta hora</p>
        </div>

        
      </div>

      {/* Gráfico de Barras Timeline */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            {Object.keys(activeFilters).length > 0 ? 'Timeline Filtrada' : 'Timeline Gráfico de Barras'}
          </h3>
          <p className="text-sm text-gray-600">
            {Object.keys(activeFilters).length > 0 
              ? `Sessões e receita por hora do dia filtradas (${Object.keys(activeFilters).length} filtro(s) ativo(s))`
              : 'Sessões e receita por hora do dia (00:00 - 23:00)'
            }
          </p>
        </div>

        <div className="p-6">
          {/* Legendas */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span className="text-sm text-gray-700 font-medium">Sessões</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600 rounded"></div>
              <span className="text-sm text-gray-700 font-medium">Receita (R$)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 border-2 border-blue-300 rounded"></div>
              <span className="text-sm text-gray-700 font-medium">Hora Atual</span>
            </div>
          </div>

          {/* Gráfico de Barras */}
          <div className="relative">
            {/* Eixo Y - Escalas */}
            <div className="absolute left-0 top-0 h-64 w-12 flex flex-col justify-between text-xs text-gray-500">
              {(() => {
                const maxSessions = Math.max(...hourlyTimeline.map(h => h.sessions))
                const maxRevenue = Math.max(...hourlyTimeline.map(h => h.revenue))
                const maxValue = Math.max(maxSessions, maxRevenue)
                const steps = 5
                const stepValue = Math.ceil(maxValue / steps)
                
                return Array.from({ length: steps + 1 }, (_, i) => (
                  <div key={i} className="text-right pr-2">
                    {Math.round(stepValue * (steps - i))}
                  </div>
                ))
              })()}
            </div>

            {/* Área do gráfico */}
            <div className="ml-12 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 h-64">
                {Array.from({ length: 6 }, (_, i) => (
                  <div 
                    key={i} 
                    className="absolute w-full border-t border-gray-200"
                    style={{ top: `${(i / 5) * 100}%` }}
                  ></div>
                ))}
              </div>

              {/* Barras */}
              <div className="relative h-64 flex items-end justify-between gap-1">
                {timelineToUse.map((hourData) => {
                  const maxSessions = Math.max(...timelineToUse.map(h => h.sessions))
                  const maxRevenue = Math.max(...timelineToUse.map(h => h.revenue))
                  const maxValue = Math.max(maxSessions, maxRevenue)
                  
                  const sessionsHeight = maxValue > 0 ? (hourData.sessions / maxValue) * 100 : 0
                  const revenueHeight = maxValue > 0 ? (hourData.revenue / maxValue) * 100 : 0
                  
                  return (
                    <div key={hourData.hour} className="flex flex-col items-center group relative">
                      {/* Tooltip */}
                      <div className="invisible group-hover:visible absolute bottom-full mb-2 p-2 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                        <div>{hourData.hourLabel}</div>
                        <div>Sessões: {hourData.sessions}</div>
                        <div>Receita: R$ {hourData.revenue.toFixed(0)}</div>
                      </div>

                      {/* Barras */}
                      <div className="flex items-end gap-0.5 h-64">
                        {/* Barra de Sessões */}
                        <div 
                          className={`w-3 transition-all duration-300 rounded-t ${
                            hourData.isCurrentHour 
                              ? 'bg-blue-500 ring-2 ring-blue-300' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                          style={{ height: `${sessionsHeight}%` }}
                        ></div>
                        
                        {/* Barra de Receita */}
                        <div 
                          className={`w-3 transition-all duration-300 rounded-t ${
                            hourData.isCurrentHour 
                              ? 'bg-green-500 ring-2 ring-green-300' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                          style={{ height: `${revenueHeight}%` }}
                        ></div>
                      </div>

                      {/* Label da hora */}
                      <div className={`mt-2 text-xs text-center ${
                        hourData.isCurrentHour 
                          ? 'font-bold text-blue-700' 
                          : 'text-gray-600'
                      }`}>
                        {hourData.hourLabel}
                      </div>
                      
                      {/* Indicador hora atual */}
                      {hourData.isCurrentHour && (
                        <div className="mt-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Eixo X */}
              <div className="border-t border-gray-300 mt-4"></div>
            </div>
          </div>

          {/* Estatísticas resumidas */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {Math.max(...timelineToUse.map(h => h.sessions))}
              </div>
              <div className="text-sm text-gray-600">Pico de Sessões</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                R$ {Math.max(...timelineToUse.map(h => h.revenue)).toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">Pico de Receita</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-700">
                {timelineToUse.filter(h => h.sessions > 0).length}h
              </div>
              <div className="text-sm text-gray-600">Horas Ativas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Totais por Categoria de Tráfego */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Totais por Categoria de Tráfego
              </h3>
              <p className="text-sm text-gray-600">
                Distribuição de sessões e receita por canal de aquisição
              </p>
            </div>
            
            {/* Controles de Ordenação */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Ordenar por:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSortTrafficCategories('sessions')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortTrafficCategories === 'sessions'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sessões
                </button>
                <button
                  onClick={() => setSortTrafficCategories('revenue')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortTrafficCategories === 'revenue'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Receita
                </button>
              </div>
            </div>
          </div>
        </div>

        {trafficCategories.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma categoria encontrada
            </h3>
            <p className="text-gray-600">
              Não há dados de tráfego para categorizar hoje.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria de Tráfego
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessões
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllTrafficCategories ? trafficCategories : trafficCategories.slice(0, 10)).map((category) => (
                  <tr 
                    key={category.category} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      activeFilters.trafficCategory === category.category ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => applyFilter('trafficCategory', category.category)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div 
                          className={`w-3 h-3 rounded-full ${category.color}`}
                        ></div>
                        <span className="text-sm font-medium text-gray-900">
                          {category.category}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-blue-600">
                        {category.sessions.toLocaleString('pt-BR')}
                        </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(category.revenue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              
              {/* Total na última linha */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-blue-600">
                    {trafficCategories.reduce((sum, cat) => sum + cat.sessions, 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(trafficCategories.reduce((sum, cat) => sum + cat.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            {/* Botão Ver Mais */}
            {trafficCategories.length > 10 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowAllTrafficCategories(!showAllTrafficCategories)}
                  className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showAllTrafficCategories 
                    ? `Mostrar apenas top 10 (de ${trafficCategories.length} categorias)`
                    : `Ver mais ${trafficCategories.length - 10} categorias`
                  }
                </button>
              </div>
            )}
          </div>
        )}
                      </div>

      {/* Tabela por Origem e Mídia */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Map className="w-5 h-5 text-blue-600" />
                Detalhamento por Origem e Mídia
              </h3>
              <p className="text-sm text-gray-600">
                Dados específicos de cada source/medium
              </p>
            </div>
            
            {/* Controles de Ordenação */}
                          <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Ordenar por:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSortSourceMedium('sessions')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortSourceMedium === 'sessions'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sessões
                </button>
                <button
                  onClick={() => setSortSourceMedium('revenue')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortSourceMedium === 'revenue'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Receita
                </button>
              </div>
            </div>
          </div>
        </div>

        {sourceMediumMetrics.length === 0 ? (
          <div className="p-12 text-center">
            <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma origem encontrada
            </h3>
            <p className="text-gray-600">
              Não há dados de origem e mídia para hoje.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '150px'}}>
                    Origem
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '120px'}}>
                    Mídia
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessões
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllSourceMedium ? sourceMediumMetrics : sourceMediumMetrics.slice(0, 10)).map((item) => (
                  <tr 
                    key={`${item.source}-${item.medium}`} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      activeFilters.sourceMedium?.source === item.source && activeFilters.sourceMedium?.medium === item.medium 
                        ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => applyFilter('sourceMedium', { source: item.source, medium: item.medium })}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" style={{width: '150px'}}>
                      <div className="truncate" title={item.source}>
                        <span className="text-sm font-medium text-gray-900">
                          {item.source}
                            </span>
                          </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap" style={{width: '120px'}}>
                      <div className="truncate" title={item.medium}>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getChannelColor(item.source, item.medium)}`}>
                          {item.medium}
                              </span>
                            </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-blue-600">
                        {item.sessions.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(item.revenue)}
                              </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              
              {/* Total na última linha */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-blue-600">
                    {sourceMediumMetrics.reduce((sum, item) => sum + item.sessions, 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(sourceMediumMetrics.reduce((sum, item) => sum + item.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            {/* Botão Ver Mais */}
            {sourceMediumMetrics.length > 10 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowAllSourceMedium(!showAllSourceMedium)}
                  className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showAllSourceMedium 
                    ? `Mostrar apenas top 10 (de ${sourceMediumMetrics.length} origens)`
                    : `Ver mais ${sourceMediumMetrics.length - 10} origens`
                  }
                </button>
              </div>
            )}
                            </div>
                          )}
                        </div>

      {/* Tabela por Campanha */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                Detalhamento por Campanha
              </h3>
              <p className="text-sm text-gray-600">
                Performance de campanhas de marketing
              </p>
            </div>
            
            {/* Controles de Ordenação */}
                          <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Ordenar por:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSortCampaigns('sessions')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortCampaigns === 'sessions'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sessões
                </button>
                <button
                  onClick={() => setSortCampaigns('revenue')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortCampaigns === 'revenue'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Receita
                </button>
              </div>
            </div>
          </div>
        </div>

        {campaignMetrics.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma campanha encontrada
            </h3>
            <p className="text-gray-600">
              Não há dados de campanhas para hoje.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '200px'}}>
                    Campanha
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessões
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllCampaigns ? campaignMetrics : campaignMetrics.slice(0, 10)).map((item) => (
                  <tr 
                    key={item.campaign} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      activeFilters.campaign === item.campaign ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => applyFilter('campaign', item.campaign)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" style={{width: '200px'}}>
                      <div className="truncate" title={item.campaign}>
                        <span className="text-sm font-medium text-gray-900">
                          {item.campaign}
                            </span>
                          </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-blue-600">
                        {item.sessions.toLocaleString('pt-BR')}
                              </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(item.revenue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              
              {/* Total na última linha */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-blue-600">
                    {campaignMetrics.reduce((sum, item) => sum + item.sessions, 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(campaignMetrics.reduce((sum, item) => sum + item.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            {/* Botão Ver Mais */}
            {campaignMetrics.length > 10 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowAllCampaigns(!showAllCampaigns)}
                  className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showAllCampaigns 
                    ? `Mostrar apenas top 10 (de ${campaignMetrics.length} campanhas)`
                    : `Ver mais ${campaignMetrics.length - 10} campanhas`
                  }
                </button>
                            </div>
                          )}
          </div>
        )}
      </div>

      {/* Tabela por Página */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                Detalhamento por Página
              </h3>
              <p className="text-sm text-gray-600">
                Performance de páginas do site
              </p>
                          </div>
            
            {/* Controles de Ordenação */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Ordenar por:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSortPages('sessions')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortPages === 'sessions'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sessões
                </button>
                <button
                  onClick={() => setSortPages('revenue')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortPages === 'revenue'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Receita
                </button>
                        </div>
                      </div>
                    </div>
                  </div>

        {pageMetrics.length === 0 ? (
          <div className="p-12 text-center">
            <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma página encontrada
            </h3>
            <p className="text-gray-600">
              Não há dados de páginas para hoje.
            </p>
                </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '300px'}}>
                    Página
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessões
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllPages ? pageMetrics : pageMetrics.slice(0, 10)).map((item) => (
                  <tr 
                    key={item.page} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      activeFilters.page === item.page ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => applyFilter('page', item.page)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" style={{width: '300px'}}>
                      <div className="truncate" title={item.page}>
                        <span className="text-sm font-medium text-gray-900">
                          {item.page}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-blue-600">
                        {item.sessions.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(item.revenue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              
              {/* Total na última linha */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-blue-600">
                    {pageMetrics.reduce((sum, item) => sum + item.sessions, 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(pageMetrics.reduce((sum, item) => sum + item.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            {/* Botão Ver Mais */}
            {pageMetrics.length > 10 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowAllPages(!showAllPages)}
                  className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showAllPages 
                    ? `Mostrar apenas top 10 (de ${pageMetrics.length} páginas)`
                    : `Ver mais ${pageMetrics.length - 10} páginas`
                  }
                </button>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Tabela por Produto */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                Detalhamento por Produto
              </h3>
              <p className="text-sm text-gray-600">
                Performance de produtos do catálogo
              </p>
            </div>
            
            {/* Controles de Ordenação */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Ordenar por:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSortProducts('sessions')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortProducts === 'sessions'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sessões
                </button>
                <button
                  onClick={() => setSortProducts('revenue')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    sortProducts === 'revenue'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Receita
                </button>
              </div>
            </div>
          </div>
        </div>

        {productMetrics.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum produto encontrado
            </h3>
            <p className="text-gray-600">
              Não há dados de produtos para hoje.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '300px'}}>
                    Produto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessões
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllProducts ? productMetrics : productMetrics.slice(0, 10)).map((item) => (
                  <tr 
                    key={item.product} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      activeFilters.product === item.product ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => applyFilter('product', item.product)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" style={{width: '300px'}}>
                      <div className="truncate" title={item.product}>
                        <span className="text-sm font-medium text-gray-900">
                          {item.product}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-blue-600">
                        {item.sessions.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(item.revenue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              
              {/* Total na última linha */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-blue-600">
                    {productMetrics.reduce((sum, item) => sum + item.sessions, 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(productMetrics.reduce((sum, item) => sum + item.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            {/* Botão Ver Mais */}
            {productMetrics.length > 10 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowAllProducts(!showAllProducts)}
                  className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showAllProducts 
                    ? `Mostrar apenas top 10 (de ${productMetrics.length} produtos)`
                    : `Ver mais ${productMetrics.length - 10} produtos`
                  }
                </button>
          </div>
        )}
      </div>
        )}
      </div>


    </div>
  )
}

export default RealtimeData
