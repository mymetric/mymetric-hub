import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  Eye, 
  MousePointer, 
  Users, 
  DollarSign, 
  ShoppingCart, 
  Filter,
  Target,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { AdsCampaignData, AdsCampaignResponse, CacheInfo, AdsCampaignSummary } from '../types'
import SortableHeader from './SortableHeader'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface PaidMediaDashboardProps {
  selectedTable: string
  startDate: string
  endDate: string
}

const PaidMediaDashboard = ({ selectedTable, startDate, endDate }: PaidMediaDashboardProps) => {
  const [campaignData, setCampaignData] = useState<AdsCampaignData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<string>('cost')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [attributionModel, setAttributionModel] = useState<'origin_stack' | 'last_non_direct'>('origin_stack')
  const [isComparisonExpanded, setIsComparisonExpanded] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [summary, setSummary] = useState<AdsCampaignSummary | null>(null)
  const [useCache, setUseCache] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const fetchAdsCampaigns = async () => {
      try {
        const token = localStorage.getItem('auth-token')
        if (!token) return

        if (!validateTableName(selectedTable)) {
          return
        }

        setIsLoading(true)
        console.log('🔄 Fetching ads campaigns for table:', selectedTable)
        
        const requestData = useCache 
          ? { table_name: selectedTable, last_cache: true }
          : { 
              start_date: startDate, 
              end_date: endDate, 
              table_name: selectedTable 
            }

        const response = await api.getAdsCampaigns(token, requestData)

        console.log('✅ Ads campaigns response:', response)
        setCampaignData(response.data || [])
        setCacheInfo(response.cache_info || null)
        setSummary(response.summary || null)
      } catch (error) {
        console.error('❌ Error fetching ads campaigns:', error)
        setCampaignData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchAdsCampaigns()
  }, [selectedTable, attributionModel, useCache, startDate, endDate])

  // Função para verificar se o cache é antigo (mais de 4 horas)
  const isCacheOld = () => {
    if (!cacheInfo) return false
    const cacheDate = new Date(cacheInfo.cached_at + 'Z')
    const now = new Date()
    const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60)
    return diffHours > 4
  }

  // Função para atualizar dados (sem cache)
  const refreshData = async () => {
    setIsRefreshing(true)
    setUseCache(false)
    // O useEffect será executado automaticamente devido à mudança do useCache
    setTimeout(() => {
      setUseCache(true) // Volta para o modo cache após a atualização
      setIsRefreshing(false)
    }, 1000)
  }

  // Filtrar dados por plataforma e termo de busca
  const filteredData = campaignData.filter(item => {
    const matchesPlatform = selectedPlatform ? item.platform === selectedPlatform : true
    const matchesSearch = searchTerm ? 
      item.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.platform.toLowerCase().includes(searchTerm.toLowerCase())
      : true
    return matchesPlatform && matchesSearch
  })

  // Agrupar dados por campanha
  const groupedData = filteredData.reduce((acc, item) => {
    const key = `${item.platform}-${item.campaign_name}`
    if (!acc[key]) {
      acc[key] = {
        platform: item.platform,
        campaign_name: item.campaign_name,
        cost: 0,
        impressions: 0,
        clicks: 0,
        leads: 0,
        transactions: 0,
        revenue: 0,
        transactions_first: 0,
        revenue_first: 0,
        transactions_origin_stack: 0,
        revenue_origin_stack: 0,
        transactions_first_origin_stack: 0,
        revenue_first_origin_stack: 0,
        records: []
      }
    }
    
    acc[key].cost += item.cost
    acc[key].impressions += item.impressions
    acc[key].clicks += item.clicks
    acc[key].leads += item.leads
    
    // Usar as métricas corretas baseado no modelo de atribuição
    if (attributionModel === 'origin_stack') {
      acc[key].transactions += item.transactions_origin_stack
      acc[key].revenue += item.revenue_origin_stack
      acc[key].transactions_first += item.transactions_first_origin_stack
      acc[key].revenue_first += item.revenue_first_origin_stack
    } else {
      acc[key].transactions += item.transactions
      acc[key].revenue += item.revenue
      acc[key].transactions_first += item.transactions_first
      acc[key].revenue_first += item.revenue_first
    }
    
    acc[key].transactions_origin_stack += item.transactions_origin_stack
    acc[key].revenue_origin_stack += item.revenue_origin_stack
    acc[key].transactions_first_origin_stack += item.transactions_first_origin_stack
    acc[key].revenue_first_origin_stack += item.revenue_first_origin_stack
    acc[key].records.push(item)
    
    return acc
  }, {} as { [key: string]: any })

  const campaignSummaries = Object.values(groupedData)

  // Função de ordenação
  const sortData = (data: any[]) => {
    return [...data].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'campaign_name':
          aValue = a.campaign_name
          bValue = b.campaign_name
          break
        case 'platform':
          aValue = a.platform
          bValue = b.platform
          break
        case 'cost':
          aValue = a.cost
          bValue = b.cost
          break
        case 'impressions':
          aValue = a.impressions
          bValue = b.impressions
          break
        case 'clicks':
          aValue = a.clicks
          bValue = b.clicks
          break
        case 'ctr':
          aValue = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0
          bValue = b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0
          break
        case 'cpc':
          aValue = a.clicks > 0 ? a.cost / a.clicks : 0
          bValue = b.clicks > 0 ? b.cost / b.clicks : 0
          break
        case 'leads':
          aValue = a.leads
          bValue = b.leads
          break
        case 'transactions':
          aValue = a.transactions
          bValue = b.transactions
          break
        case 'transactions_first':
          aValue = a.transactions_first
          bValue = b.transactions_first
          break
        case 'revenue':
          aValue = a.revenue
          bValue = b.revenue
          break
        case 'revenue_first':
          aValue = a.revenue_first
          bValue = b.revenue_first
          break
        case 'roas':
          aValue = a.cost > 0 ? a.revenue / a.cost : 0
          bValue = b.cost > 0 ? b.revenue / b.cost : 0
          break
        case 'roas_first':
          aValue = a.cost > 0 ? a.revenue_first / a.cost : 0
          bValue = b.cost > 0 ? b.revenue_first / b.cost : 0
          break
        case 'cpa':
          aValue = a.transactions > 0 ? a.cost / a.transactions : 0
          bValue = b.transactions > 0 ? b.cost / b.transactions : 0
          break
        case 'cpa_first':
          aValue = a.transactions_first > 0 ? a.cost / a.transactions_first : 0
          bValue = b.transactions_first > 0 ? b.cost / b.transactions_first : 0
          break
        default:
          aValue = a.cost
          bValue = b.cost
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  // Dados ordenados
  const sortedData = sortData(campaignSummaries)
  
  // Paginação - mostrar apenas 10 registros inicialmente
  const displayedRecords = showAllRecords ? sortedData : sortedData.slice(0, 10)
  const hasMoreRecords = sortedData.length > 10

  // Calcular totais
  const totals = campaignSummaries.reduce((acc, item) => ({
    cost: acc.cost + item.cost,
    impressions: acc.impressions + item.impressions,
    clicks: acc.clicks + item.clicks,
    leads: acc.leads + item.leads,
    transactions: acc.transactions + item.transactions,
    revenue: acc.revenue + item.revenue,
    transactions_first: acc.transactions_first + item.transactions_first,
    revenue_first: acc.revenue_first + item.revenue_first,
  }), {
    cost: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
  })

  // Métricas calculadas
  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const avgCPC = totals.clicks > 0 ? totals.cost / totals.clicks : 0
  const avgCPA = totals.transactions > 0 ? totals.cost / totals.transactions : 0
  const avgCPAFirst = totals.transactions_first > 0 ? totals.cost / totals.transactions_first : 0
  const avgCPL = totals.leads > 0 ? totals.cost / totals.leads : 0
  const avgCPM = totals.impressions > 0 ? (totals.cost / totals.impressions) * 1000 : 0
  const totalROAS = totals.cost > 0 ? totals.revenue / totals.cost : 0
  const totalROASFirst = totals.cost > 0 ? totals.revenue_first / totals.cost : 0

  // Obter plataformas únicas
  const platforms = [...new Set(campaignData.map(item => item.platform))]

  // Preparar dados para gráficos de pizza
  const platformData = platforms.map(platform => {
    const platformCampaigns = campaignSummaries.filter((item: any) => item.platform === platform)
    return {
      name: platform,
      cost: platformCampaigns.reduce((acc: number, item: any) => acc + item.cost, 0),
      impressions: platformCampaigns.reduce((acc: number, item: any) => acc + item.impressions, 0),
      clicks: platformCampaigns.reduce((acc: number, item: any) => acc + item.clicks, 0),
      revenue: platformCampaigns.reduce((acc: number, item: any) => 
        acc + (attributionModel === 'origin_stack' ? item.revenue : item.revenue), 0
      ),
    }
  }).filter((item: any) => item.cost > 0) // Remove plataformas sem investimento

  // Cores discretas para os gráficos
  const COLORS = ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9']

  // Dados para comparativo entre modelos de atribuição - usando dados brutos para comparação real
  const attributionComparison = {
    last_non_direct: campaignData.reduce((acc: any, item: any) => ({
      transactions: acc.transactions + item.transactions,
      revenue: acc.revenue + item.revenue,
      transactions_first: acc.transactions_first + item.transactions_first,
      revenue_first: acc.revenue_first + item.revenue_first,
    }), {
      transactions: 0,
      revenue: 0,
      transactions_first: 0,
      revenue_first: 0,
    }),
    origin_stack: campaignData.reduce((acc: any, item: any) => ({
      transactions: acc.transactions + item.transactions_origin_stack,
      revenue: acc.revenue + item.revenue_origin_stack,
      transactions_first: acc.transactions_first + item.transactions_first_origin_stack,
      revenue_first: acc.revenue_first + item.revenue_first_origin_stack,
    }), {
      transactions: 0,
      revenue: 0,
      transactions_first: 0,
      revenue_first: 0,
    })
  }

  // Calcular métricas para cada modelo
  const lastNonDirectMetrics = {
    cpa: attributionComparison.last_non_direct.transactions > 0 
      ? totals.cost / attributionComparison.last_non_direct.transactions : 0,
    roas: totals.cost > 0 
      ? attributionComparison.last_non_direct.revenue / totals.cost : 0,
    cpaFirst: attributionComparison.last_non_direct.transactions_first > 0 
      ? totals.cost / attributionComparison.last_non_direct.transactions_first : 0,
    roasFirst: totals.cost > 0 
      ? attributionComparison.last_non_direct.revenue_first / totals.cost : 0,
  }

  const originStackMetrics = {
    cpa: attributionComparison.origin_stack.transactions > 0 
      ? totals.cost / attributionComparison.origin_stack.transactions : 0,
    roas: totals.cost > 0 
      ? attributionComparison.origin_stack.revenue / totals.cost : 0,
    cpaFirst: attributionComparison.origin_stack.transactions_first > 0 
      ? totals.cost / attributionComparison.origin_stack.transactions_first : 0,
    roasFirst: totals.cost > 0 
      ? attributionComparison.origin_stack.revenue_first / totals.cost : 0,
  }

  // Função para lidar com ordenação
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados de mídia paga...</p>
        </div>
      </div>
    )
  }

  if (campaignData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado de mídia paga encontrado</h3>
        <p className="text-gray-600 mb-4">
          Não foram encontrados dados de campanhas para a tabela selecionada no período.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Informações do Cache e Botão Atualizar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-800">
              {useCache ? 'Dados do Cache' : 'Dados Atualizados'}
            </span>
            {cacheInfo && useCache && (
              <span className={`text-xs ${isCacheOld() ? 'text-orange-600' : 'text-blue-600'}`}>
                de {new Date(cacheInfo.cached_at + 'Z').toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }).replace(',', '')}
                {isCacheOld() && (
                  <span className="ml-1 text-orange-500">(desatualizado)</span>
                )}
              </span>
            )}
          </div>
          {(isCacheOld() || isRefreshing) && (
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isRefreshing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRefreshing ? (
                <>
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Atualizando...
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3" />
                  Atualizar Dados
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Funil de Conversão Compacto */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-slate-200">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-1">🎯 Funil de Performance</h2>
          <p className="text-xs text-gray-600">Do investimento ao resultado</p>
        </div>

        {/* Layout em Grid Responsivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Investimento */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Investimento Total</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.cost)}</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          {/* Impressões */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Impressões</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(totals.impressions)}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPM: {formatCurrency(avgCPM)}</span>
          </div>

          {/* Cliques */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Cliques</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(totals.clicks)}</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <MousePointer className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CTR: {avgCTR.toFixed(1)}%</span>
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPC: {formatCurrency(avgCPC)}</span>
            </div>
          </div>

          {/* Leads */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Leads</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(totals.leads)}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPL: {formatCurrency(avgCPL)}</span>
          </div>

          {/* Transações */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Transações</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(totals.transactions)}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPA: {formatCurrency(avgCPA)}</span>
          </div>

          {/* Primeira Compra */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">1ª Compra</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(totals.transactions_first)}</p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPA 1ª: {formatCurrency(avgCPAFirst)}</span>
          </div>

          {/* Receita Total */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Receita Total</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.revenue)}</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              totalROAS >= 3 ? 'bg-green-100 text-green-700' : 
              totalROAS >= 2 ? 'bg-yellow-100 text-yellow-700' : 
              'bg-red-100 text-red-700'
            }`}>
              ROAS: {totalROAS.toFixed(2)}x
            </span>
          </div>

          {/* Receita Primeira Compra */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Receita 1ª Compra</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.revenue_first)}</p>
              </div>
              <div className="p-2 bg-teal-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-teal-600" />
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              totalROASFirst >= 3 ? 'bg-green-100 text-green-700' : 
              totalROASFirst >= 2 ? 'bg-yellow-100 text-yellow-700' : 
              'bg-red-100 text-red-700'
            }`}>
              ROAS 1ª: {totalROASFirst.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>

      {/* Resumo da API (se disponível) */}
      {summary && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">📈 Resumo da API</h2>
            <p className="text-xs text-gray-600">Dados consolidados do período: {summary.periodo}</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-xs font-medium text-gray-600 mb-1">CTR</p>
              <p className="text-lg font-bold text-blue-600">{summary.ctr.toFixed(2)}%</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-xs font-medium text-gray-600 mb-1">CPM</p>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(summary.cpm)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-xs font-medium text-gray-600 mb-1">CPC</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(summary.cpc)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-xs font-medium text-gray-600 mb-1">Taxa Conversão</p>
              <p className="text-lg font-bold text-green-600">{(summary.conversion_rate * 100).toFixed(2)}%</p>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              summary.roas >= 3 ? 'bg-green-100 text-green-800' : 
              summary.roas >= 2 ? 'bg-yellow-100 text-yellow-800' : 
              'bg-red-100 text-red-800'
            }`}>
              ROAS: {summary.roas.toFixed(2)}x
            </span>
          </div>
        </div>
      )}

      {/* Gráficos de Distribuição por Plataforma */}
      {platformData.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Distribuição por Plataforma</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Gráfico de Investimento */}
            <div className="text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Investimento</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformData.map(item => ({ name: item.name, value: item.cost }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {platformData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {platformData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico de Impressões */}
            <div className="text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Impressões</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformData.map(item => ({ name: item.name, value: item.impressions }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {platformData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {platformData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico de Cliques */}
            <div className="text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Cliques</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformData.map(item => ({ name: item.name, value: item.clicks }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {platformData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {platformData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico de Receita */}
            <div className="text-center">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Receita</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformData.map(item => ({ name: item.name, value: item.revenue }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {platformData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {platformData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparativo de Modelos de Atribuição */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-6 p-6 rounded-lg transition-colors"
          onClick={() => setIsComparisonExpanded(!isComparisonExpanded)}
        >
          <h3 className="text-lg font-semibold text-gray-900">⚖️ Comparativo: Modelos de Atribuição</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {isComparisonExpanded ? 'Minimizar' : 'Expandir'}
            </span>
            {isComparisonExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
        
        {/* Prévia Minimizada */}
        {!isComparisonExpanded && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-600 mb-1">Transações</p>
                <p className="text-sm font-semibold text-gray-900">
                  Last: {formatNumber(attributionComparison.last_non_direct.transactions)}
                </p>
                <p className="text-sm font-semibold text-blue-600">
                  Origin: {formatNumber(attributionComparison.origin_stack.transactions)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Receita</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(attributionComparison.last_non_direct.revenue)}
                </p>
                <p className="text-sm font-semibold text-blue-600">
                  {formatCurrency(attributionComparison.origin_stack.revenue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Melhor CPA</p>
                <p className="text-sm font-semibold text-green-600">
                  {originStackMetrics.cpa < lastNonDirectMetrics.cpa ? 'Origin Stack' : 'Last Non-Direct'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Melhor ROAS</p>
                <p className="text-sm font-semibold text-green-600">
                  {originStackMetrics.roas > lastNonDirectMetrics.roas ? 'Origin Stack' : 'Last Non-Direct'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {isComparisonExpanded && (
          <div className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Last Non-Direct Session */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-semibold text-gray-800">📊 Last Non-Direct Session</h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                attributionModel === 'last_non_direct' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {attributionModel === 'last_non_direct' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600 mb-1">Transações</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(attributionComparison.last_non_direct.transactions)}</p>
                <p className="text-xs text-green-600">CPA: {formatCurrency(lastNonDirectMetrics.cpa)}</p>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600 mb-1">Receita</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(attributionComparison.last_non_direct.revenue)}</p>
                <p className={`text-xs ${
                  lastNonDirectMetrics.roas >= 3 ? 'text-green-600' : 
                  lastNonDirectMetrics.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  ROAS: {lastNonDirectMetrics.roas.toFixed(2)}x
                </p>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded">
                <p className="text-xs text-gray-600 mb-1">1ª Compra</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(attributionComparison.last_non_direct.transactions_first)}</p>
                <p className="text-xs text-blue-600">CPA: {formatCurrency(lastNonDirectMetrics.cpaFirst)}</p>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded">
                <p className="text-xs text-gray-600 mb-1">Receita 1ª</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(attributionComparison.last_non_direct.revenue_first)}</p>
                <p className={`text-xs ${
                  lastNonDirectMetrics.roasFirst >= 3 ? 'text-green-600' : 
                  lastNonDirectMetrics.roasFirst >= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  ROAS: {lastNonDirectMetrics.roasFirst.toFixed(2)}x
                </p>
              </div>
            </div>
          </div>

          {/* Origin Stack */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-semibold text-gray-800">🎯 Origin Stack</h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                attributionModel === 'origin_stack' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {attributionModel === 'origin_stack' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600 mb-1">Transações</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(attributionComparison.origin_stack.transactions)}</p>
                <p className="text-xs text-green-600">CPA: {formatCurrency(originStackMetrics.cpa)}</p>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-600 mb-1">Receita</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(attributionComparison.origin_stack.revenue)}</p>
                <p className={`text-xs ${
                  originStackMetrics.roas >= 3 ? 'text-green-600' : 
                  originStackMetrics.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  ROAS: {originStackMetrics.roas.toFixed(2)}x
                </p>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded">
                <p className="text-xs text-gray-600 mb-1">1ª Compra</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(attributionComparison.origin_stack.transactions_first)}</p>
                <p className="text-xs text-blue-600">CPA: {formatCurrency(originStackMetrics.cpaFirst)}</p>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded">
                <p className="text-xs text-gray-600 mb-1">Receita 1ª</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(attributionComparison.origin_stack.revenue_first)}</p>
                <p className={`text-xs ${
                  originStackMetrics.roasFirst >= 3 ? 'text-green-600' : 
                  originStackMetrics.roasFirst >= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  ROAS: {originStackMetrics.roasFirst.toFixed(2)}x
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo das Diferenças */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <h5 className="text-sm font-semibold text-gray-800 mb-3">📈 Análise Comparativa</h5>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            <div className="text-center">
              <p className="text-gray-600 mb-1">Diferença Transações</p>
              <p className={`font-bold ${
                attributionComparison.origin_stack.transactions > attributionComparison.last_non_direct.transactions 
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                {attributionComparison.origin_stack.transactions > attributionComparison.last_non_direct.transactions ? '+' : ''}
                {formatNumber(attributionComparison.origin_stack.transactions - attributionComparison.last_non_direct.transactions)}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 mb-1">Diferença Receita</p>
              <p className={`font-bold ${
                attributionComparison.origin_stack.revenue > attributionComparison.last_non_direct.revenue 
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                {attributionComparison.origin_stack.revenue > attributionComparison.last_non_direct.revenue ? '+' : ''}
                {formatCurrency(attributionComparison.origin_stack.revenue - attributionComparison.last_non_direct.revenue)}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 mb-1">Melhor CPA</p>
              <p className="font-bold text-blue-600">
                {originStackMetrics.cpa < lastNonDirectMetrics.cpa ? 'Origin Stack' : 'Last Non-Direct'}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 mb-1">Melhor ROAS</p>
              <p className="font-bold text-blue-600">
                {originStackMetrics.roas > lastNonDirectMetrics.roas ? 'Origin Stack' : 'Last Non-Direct'}
              </p>
            </div>
          </div>
        </div>
          </div>
        )}
      </div>

      {/* Tabela de campanhas */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Campanhas de Mídia Paga</h2>
              <p className="text-sm text-gray-500">
                Dados consolidados por campanha
                <span className="ml-2 text-xs font-medium text-blue-600">
                  • {attributionModel === 'origin_stack' ? 'Origin Stack' : 'Last Non-Direct Session'}
                </span>
                {sortedData.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400">
                    • {sortedData.length} campanhas
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
              {/* Modelo de atribuição */}
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gray-500" />
                <select
                  value={attributionModel}
                  onChange={(e) => setAttributionModel(e.target.value as 'origin_stack' | 'last_non_direct')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[180px]"
                >
                  <option value="origin_stack">Origin Stack</option>
                  <option value="last_non_direct">Last Non-Direct Session</option>
                </select>
              </div>

              {/* Filtro por plataforma */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[120px]"
                >
                  <option value="">Todas as plataformas</option>
                  {platforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </div>

              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar campanha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader
                  field="platform"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Plataforma
                </SortableHeader>
                <SortableHeader
                  field="campaign_name"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Campanha
                </SortableHeader>
                <SortableHeader
                  field="cost"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Investimento
                </SortableHeader>
                <SortableHeader
                  field="impressions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Impressões
                </SortableHeader>
                <SortableHeader
                  field="clicks"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Cliques
                </SortableHeader>
                <SortableHeader
                  field="ctr"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  CTR
                </SortableHeader>
                <SortableHeader
                  field="cpc"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  CPC
                </SortableHeader>
                <SortableHeader
                  field="leads"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Leads
                </SortableHeader>
                <SortableHeader
                  field="transactions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Transações
                </SortableHeader>
                <SortableHeader
                  field="transactions_first"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Trans. 1ª Compra
                </SortableHeader>
                <SortableHeader
                  field="revenue"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita
                </SortableHeader>
                <SortableHeader
                  field="revenue_first"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita 1ª Compra
                </SortableHeader>
                <SortableHeader
                  field="roas"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  ROAS
                </SortableHeader>
                <SortableHeader
                  field="roas_first"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  ROAS 1ª Compra
                </SortableHeader>
                <SortableHeader
                  field="cpa"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  CPA
                </SortableHeader>
                <SortableHeader
                  field="cpa_first"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  CPA 1ª Compra
                </SortableHeader>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayedRecords.map((campaign, index) => {
                const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0
                const cpc = campaign.clicks > 0 ? campaign.cost / campaign.clicks : 0
                const roas = campaign.cost > 0 ? campaign.revenue / campaign.cost : 0
                const roasFirst = campaign.cost > 0 ? campaign.revenue_first / campaign.cost : 0
                const cpa = campaign.transactions > 0 ? campaign.cost / campaign.transactions : 0
                const cpaFirst = campaign.transactions_first > 0 ? campaign.cost / campaign.transactions_first : 0

                return (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {campaign.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm font-medium text-gray-900 truncate" title={campaign.campaign_name}>
                        {campaign.campaign_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {formatCurrency(campaign.cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatNumber(campaign.impressions)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatNumber(campaign.clicks)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {ctr.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-teal-600">
                      {formatCurrency(cpc)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {formatNumber(campaign.leads)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formatNumber(campaign.transactions)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatNumber(campaign.transactions_first)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(campaign.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                      {formatCurrency(campaign.revenue_first)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${roas >= 3 ? 'text-green-600' : roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${roasFirst >= 3 ? 'text-green-600' : roasFirst >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {roasFirst.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                      {formatCurrency(cpa)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {formatCurrency(cpaFirst)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Botão para expandir/recolher registros */}
        {hasMoreRecords && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setShowAllRecords(!showAllRecords)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {showAllRecords ? (
                <>
                  <span>Mostrar menos</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>Mostrar todas as {sortedData.length} campanhas</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PaidMediaDashboard
