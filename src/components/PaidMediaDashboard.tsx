import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
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
  ChevronUp,
  BarChart3,
  Layers,
  Star,
  Award,
  Loader2,
  CheckCircle
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { AdsCampaignData, AdsCampaignResponse, CacheInfo, AdsCampaignSummary, AdsCreativeData, AdsCreativeResponse, PaidMediaCampaignResult } from '../types'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { compareDateStrings, parseDateString, convertBrazilianDateToISO } from '../utils/dateUtils'
import SortableHeader from './SortableHeader'
import PaidMediaTimeline from './PaidMediaTimeline'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface PaidMediaDashboardProps {
  selectedTable: string
  startDate: string
  endDate: string
  token: string
}

const PaidMediaDashboard = ({ selectedTable, startDate, endDate, token }: PaidMediaDashboardProps) => {
  const [campaignData, setCampaignData] = useState<AdsCampaignData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<string>('cost')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [metricSearchTerm, setMetricSearchTerm] = useState<string>('')
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [attributionModel, setAttributionModel] = useState<'origin_stack' | 'last_non_direct'>('origin_stack')
  const [isComparisonExpanded, setIsComparisonExpanded] = useState(false)
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false)
  const [showPlatformComparison, setShowPlatformComparison] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [summary, setSummary] = useState<AdsCampaignSummary | null>(null)
  const [useCache, setUseCache] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)
  const [error500Occurred, setError500Occurred] = useState(false)
  
  // Cache inteligente - armazena dados históricos
  const [historicalData, setHistoricalData] = useState<{
    [key: string]: {
      data: AdsCampaignData[]
      summary: AdsCampaignSummary | null
      cacheInfo: CacheInfo | null
      dateRange: { start: string, end: string }
    }
  }>({})
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false)
  const [isFullWidth, setIsFullWidth] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'creatives'>('overview')
  const [reloadNonce, setReloadNonce] = useState(0)
  
  // Estados para modo creatives (declarados antes dos useEffects que os usam)
  const [creativeData, setCreativeData] = useState<AdsCreativeData[]>([])
  const [isLoadingCreatives, setIsLoadingCreatives] = useState(false)
  
  const lastCampaignsKeyRef = useRef<string | null>(null)
  const lastCreativesKeyRef = useRef<string | null>(null)
  const prevIsLoadingRef = useRef<boolean>(false)
  const prevIsLoadingCreativesRef = useRef<boolean>(false)
  const prevIsRefreshingRef = useRef<boolean>(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasScheduledRetryRef = useRef(false)
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  
  // Estados para nova API (request/polling/data retrieve)
  const [jobId, setJobId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [jobStatus, setJobStatus] = useState<string>('idle') // idle, processing, completed, error
  const [jobProgress, setJobProgress] = useState<string>('')
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null)
  const [allCampaignData, setAllCampaignData] = useState<AdsCampaignData[]>([]) // Dados completos dos últimos 90 dias
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const additionalPollRef = useRef<NodeJS.Timeout | null>(null)
  const currentPollingJobIdRef = useRef<string | null>(null)
  const hasStartedProcessingRef = useRef<string | null>(null) // Evitar múltiplas execuções
  const isProcessingRef = useRef<boolean>(false) // Flag para evitar múltiplos jobs simultâneos

  const playDoneSound = () => {
    try {
      if (typeof window === 'undefined') return
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(880, ctx.currentTime)
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
      o.connect(g)
      g.connect(ctx.destination)
      o.start()
      o.stop(ctx.currentTime + 0.3)
      // Close context shortly after to release resources
      setTimeout(() => ctx.close().catch(() => {}), 400)
    } catch {}
  }

  // Função helper para converter valores para número (trata null, undefined, NaN, strings)
  const toNumber = (value: any): number => {
    if (value === null || value === undefined) {
      return 0
    }
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  // Função para obter o token da API 2.0
  const getV2Token = (): string | null => {
    try {
      const authV2Response = localStorage.getItem('mymetric-auth-v2-response')
      if (authV2Response) {
        const parsed = JSON.parse(authV2Response)
        return parsed.token || null
      }
    } catch (error) {
      console.error('Error getting V2 token:', error)
    }
    return null
  }

  // Função para converter PaidMediaCampaignResult para AdsCampaignData
  const convertPaidMediaToAdsCampaignData = (item: PaidMediaCampaignResult): AdsCampaignData => {
    return {
      platform: item.platform,
      campaign_name: item.campaign_name,
      date: item.date,
      cost: toNumber(item.cost),
      impressions: toNumber(item.impressions),
      clicks: toNumber(item.clicks),
      leads: toNumber(item.leads),
      transactions: toNumber(item.transactions), // last_non_direct
      revenue: toNumber(item.revenue), // last_non_direct
      transactions_first: toNumber(item.first_transaction),
      revenue_first: toNumber(item.first_revenue),
      transactions_origin_stack: toNumber(item.fsm_transactions),
      revenue_origin_stack: toNumber(item.fsm_revenue),
      transactions_first_origin_stack: toNumber(item.fsm_first_transaction),
      revenue_first_origin_stack: toNumber(item.fsm_first_revenue),
      pixel_transactions: toNumber(item.pixel_transactions),
      pixel_revenue: toNumber(item.pixel_revenue),
      recurring_annual_revenue: toNumber(item.recurring_annual_revenue),
      recurring_annual_subscriptions: toNumber(item.recurring_annual_subscriptions),
      recurring_montly_revenue: toNumber(item.recurring_montly_revenue),
      recurring_montly_subscriptions: toNumber(item.recurring_montly_subscriptions),
      first_annual_revenue: toNumber(item.first_annual_revenue),
      first_annual_subscriptions: toNumber(item.first_annual_subscriptions),
      first_montly_revenue: toNumber(item.first_montly_revenue),
      first_montly_subscriptions: toNumber(item.first_montly_subscriptions)
    }
  }

  // Função para calcular summary
  const recalculateSummary = (data: AdsCampaignData[]) => {
    if (!data || data.length === 0) return null
    
    const totals = data.reduce((acc, campaign) => ({
      cost: acc.cost + campaign.cost,
      impressions: acc.impressions + campaign.impressions,
      clicks: acc.clicks + campaign.clicks,
      leads: acc.leads + campaign.leads,
      transactions: acc.transactions + campaign.transactions,
      transactions_first: acc.transactions_first + campaign.transactions_first,
      revenue: acc.revenue + campaign.revenue,
      revenue_first: acc.revenue_first + campaign.revenue_first,
      pixel_transactions: acc.pixel_transactions + (campaign.pixel_transactions || 0),
      pixel_revenue: acc.pixel_revenue + (campaign.pixel_revenue || 0),
    }), {
      cost: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      transactions: 0,
      transactions_first: 0,
      revenue: 0,
      revenue_first: 0,
      pixel_transactions: 0,
      pixel_revenue: 0
    })
    
    const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    const avgCPC = totals.clicks > 0 ? totals.cost / totals.clicks : 0
    const avgCPV = totals.transactions > 0 ? totals.cost / totals.transactions : 0
    const avgCPA = totals.transactions_first > 0 ? totals.cost / totals.transactions_first : 0
    const avgROAS = totals.cost > 0 ? totals.revenue / totals.cost : 0
    const avgROASFirst = totals.cost > 0 ? totals.revenue_first / totals.cost : 0
    
    return {
      ...totals,
      avg_ctr: avgCTR,
      avg_cpc: avgCPC,
      avg_cpv: avgCPV,
      avg_cpa: avgCPA,
      avg_roas: avgROAS,
      avg_roas_first: avgROASFirst,
      ctr: avgCTR,
      cpm: totals.impressions > 0 ? (totals.cost / totals.impressions) * 1000 : 0,
      cpc: avgCPC,
      conversion_rate: totals.clicks > 0 ? (totals.transactions / totals.clicks) * 100 : 0,
      roas: avgROAS,
      total_cost: totals.cost,
      total_revenue: totals.revenue,
      total_impressions: totals.impressions,
      total_clicks: totals.clicks,
      total_leads: totals.leads,
      total_transactions: totals.transactions,
      pixel_transactions: totals.pixel_transactions,
      pixel_revenue: totals.pixel_revenue,
      periodo: `${startDate} - ${endDate}`,
      tablename: selectedTable,
      user_access: 'all'
    } as AdsCampaignSummary
  }

  // Função para filtrar dados por intervalo de datas
  const filterDataByDateRange = useCallback((data: AdsCampaignData[], start: string, end: string) => {
    if (!start || !end) {
      setCampaignData(data)
      // Recalcular summary quando não há filtro de data
      const calculatedSummary = recalculateSummary(data)
      if (calculatedSummary) {
        setSummary(calculatedSummary)
      }
      return
    }
    
    const filtered = data.filter(item => {
      const itemDate = item.date
      return itemDate >= start && itemDate <= end
    })
    
    setCampaignData(filtered)
    // Recalcular summary com dados filtrados
    const calculatedSummary = recalculateSummary(filtered)
    if (calculatedSummary) {
      setSummary(calculatedSummary)
    }
  }, [startDate, endDate, selectedTable])

  // Função para buscar dados com retry
  const fetchDataWithRetry = useCallback(async (token: string, currentJobId: string, maxRetries = 10, retryDelay = 3000) => {
    console.log('📥 Iniciando busca de dados de campanhas para job:', currentJobId)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dataResponse = await api.getPaidMediaCampaignsData(token, currentJobId)
        console.log('✅ Data fetched successfully:', {
          jobId: currentJobId,
          count: dataResponse?.count,
          dataLength: dataResponse?.data?.length,
          attempt
        })
        
        if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
          // Converter dados da nova API para o formato esperado
          const convertedData = dataResponse.data.map(convertPaidMediaToAdsCampaignData)
          
          // Verificar se o jobId ainda é o mesmo antes de atualizar os dados
          if (currentPollingJobIdRef.current && currentPollingJobIdRef.current !== currentJobId) {
            console.log('⚠️ Job ID mudou durante busca de dados, ignorando dados antigos')
            return
          }
          
          // Armazenar todos os dados (últimos 90 dias)
          setAllCampaignData(convertedData)
          
          // Filtrar por data se necessário (startDate e endDate)
          if (startDate && endDate) {
            filterDataByDateRange(convertedData, startDate, endDate)
          } else {
            setCampaignData(convertedData)
          }
          
          // Calcular e atualizar summary
          const calculatedSummary = recalculateSummary(convertedData)
          if (calculatedSummary) {
            setSummary(calculatedSummary)
          }
          
          setJobStatus('completed')
          setJobProgress(`Dados carregados: ${dataResponse.count || convertedData.length} campanhas`)
          setIsLoading(false)
          setIsPolling(false)
          console.log('✅ Estado atualizado, dados devem ser renderizados agora')
          return
        } else {
          console.warn('⚠️ Unexpected data structure:', dataResponse)
          setJobStatus('error')
          setIsLoading(false)
          return
        }
      } catch (error: any) {
        console.error(`❌ Error fetching data (attempt ${attempt}/${maxRetries}):`, error)
        
        if (error?.isRetryable && error?.status === 404 && attempt < maxRetries) {
          setJobProgress(`Dados ainda não disponíveis, tentando novamente... (${attempt}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        setJobStatus('error')
        setIsLoading(false)
        setIsPolling(false)
        return
      }
    }
    
    setJobStatus('error')
    setIsLoading(false)
    setIsPolling(false)
  }, [startDate, endDate, filterDataByDateRange])

  // Função para fazer polling do status
  const startPolling = useCallback((currentJobId: string, token: string) => {
    // Parar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (additionalPollRef.current) {
      clearInterval(additionalPollRef.current)
      additionalPollRef.current = null
    }
    
    setIsPolling(true)
    setJobStatus('processing')
    currentPollingJobIdRef.current = currentJobId
    console.log('🔄 Iniciando polling para job:', currentJobId)

    const poll = async () => {
      // Verificar se o jobId ainda é o mesmo
      if (currentPollingJobIdRef.current !== currentJobId) {
        console.log('⚠️ Job ID mudou durante polling, parando polling antigo')
        setIsPolling(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        return
      }
      
      try {
        const statusResponse = await api.getPaidMediaCampaignsJobStatus(token, currentJobId)
        console.log('📊 Job Status Response:', { 
          jobId: currentJobId, 
          status: statusResponse.status, 
          progress: statusResponse.progress,
          elapsed: statusResponse.elapsed_seconds 
        })
        
        // Verificar novamente se o jobId ainda é o mesmo
        if (currentPollingJobIdRef.current !== currentJobId) {
          console.log('⚠️ Job ID mudou durante processamento da resposta, ignorando')
          return
        }
        
        // Atualizar elapsed_seconds se disponível
        if (statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null) {
          setElapsedSeconds(statusResponse.elapsed_seconds)
        }
        
        // Formatar progresso com tempo decorrido
        const progressText = statusResponse.progress || 'Processando...'
        const elapsedText = statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null
          ? ` (${Math.round(statusResponse.elapsed_seconds)}s)`
          : ''
        setJobProgress(`${progressText}${elapsedText}`)

        if (statusResponse.status === 'completed') {
          // Job concluído, buscar dados
          console.log('✅ Job concluído, buscando dados para job:', currentJobId)
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          if (additionalPollRef.current) {
            clearInterval(additionalPollRef.current)
            additionalPollRef.current = null
          }

          setJobProgress('Processamento concluído, baixando dados...')
          await fetchDataWithRetry(token, currentJobId)
        } else if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
          // Job falhou
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          if (additionalPollRef.current) {
            clearInterval(additionalPollRef.current)
            additionalPollRef.current = null
          }
          setJobStatus('error')
          setIsLoading(false)
        }
        // Se ainda está processando, continua o polling
      } catch (error) {
        console.error('Error polling status:', error)
        // Não para o polling em caso de erro temporário
      }
    }

    // Executar primeira verificação imediatamente
    poll()
    
    // Configurar polling principal a cada 3 segundos
    pollingIntervalRef.current = setInterval(poll, 3000)
    console.log('⏰ Polling configurado para verificar a cada 3 segundos')
  }, [fetchDataWithRetry])

  // Função para iniciar o processamento
  const startProcessing = useCallback(async () => {
    // Proteção contra múltiplas execuções simultâneas - verificar ANTES de qualquer operação
    if (isProcessingRef.current) {
      console.log('⚠️ Processamento já em andamento, ignorando chamada duplicada')
      return
    }
    
    // Verificar se o selectedTable ainda é o mesmo que iniciou o processamento
    if (hasStartedProcessingRef.current !== selectedTable) {
      console.log('⚠️ selectedTable mudou, cancelando processamento')
      return
    }

    // Marcar imediatamente para evitar race condition
    isProcessingRef.current = true

    const token = getV2Token()
    if (!token) {
      setJobStatus('error')
      setIsLoading(false)
      isProcessingRef.current = false
      return
    }

    if (!validateTableName(selectedTable)) {
      setJobStatus('error')
      setIsLoading(false)
      isProcessingRef.current = false
      return
    }

    // Limpar dados e estado antes de iniciar novo processamento
    console.log('🔄 Iniciando novo processamento de campanhas para:', selectedTable)
    
    // Parar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (additionalPollRef.current) {
      clearInterval(additionalPollRef.current)
      additionalPollRef.current = null
    }
    
    setIsLoading(true)
    setJobStatus('processing')
    setJobProgress('Iniciando processamento...')
    setElapsedSeconds(null)
    setJobId(null)
    setAllCampaignData([])
    setCampaignData([])

    try {
      // Criar o job (sempre busca últimos 90 dias)
      const jobResponse = await api.createPaidMediaCampaignsJob(token, selectedTable)
      console.log('📦 Job Response inicial:', jobResponse)
      console.log('📦 Job ID:', jobResponse.job_id)
      
      setJobId(jobResponse.job_id)
      setJobProgress('Job criado, aguardando processamento...')

      // Iniciar polling
      startPolling(jobResponse.job_id, token)
      
      // Resetar flag após um delay para permitir que o job seja criado
      // Mas manter por mais tempo para evitar chamadas duplicadas
      // Só resetar se ainda estiver processando o mesmo selectedTable
      setTimeout(() => {
        if (hasStartedProcessingRef.current === selectedTable) {
          isProcessingRef.current = false
        }
      }, 2000)
    } catch (error) {
      console.error('Error starting processing:', error)
      setJobStatus('error')
      setIsLoading(false)
      isProcessingRef.current = false
    }
  }, [selectedTable, startPolling])

  // Tocar som quando o carregamento principal finalizar
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      playDoneSound()
    }
    prevIsLoadingRef.current = isLoading
  }, [isLoading])

  // Tocar som quando o carregamento de criativos finalizar
  useEffect(() => {
    if (prevIsLoadingCreativesRef.current && !isLoadingCreatives) {
      playDoneSound()
    }
    prevIsLoadingCreativesRef.current = isLoadingCreatives
  }, [isLoadingCreatives])

  // Tocar som quando o refresh em background finalizar
  useEffect(() => {
    if (prevIsRefreshingRef.current && !isRefreshing) {
      playDoneSound()
    }
    prevIsRefreshingRef.current = isRefreshing
  }, [isRefreshing])

  // Gerenciar countdown visual e retry automático quando não houver dados
  useEffect(() => {
    const noData = !isLoading && (campaignData?.length || 0) === 0
    if (noData && !hasScheduledRetryRef.current) {
      hasScheduledRetryRef.current = true
      setRetryCountdown(10)
      // Garantir limpeza de timeout antigo
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      // Iniciar intervalo de 1s para countdown
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current)
        retryIntervalRef.current = null
      }
      retryIntervalRef.current = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev == null) return prev
          if (prev <= 1) {
            // Finaliza contagem e executa retry
            if (retryIntervalRef.current) {
              clearInterval(retryIntervalRef.current)
              retryIntervalRef.current = null
            }
            hasScheduledRetryRef.current = false
            setRetryCountdown(null)
            setReloadNonce((p: number) => p + 1)
            return null
          }
          return prev - 1
        })
      }, 1000)
    }

    if (!noData) {
      // Limpar timers e countdown quando começar a carregar ou houver dados
      hasScheduledRetryRef.current = false
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current)
        retryIntervalRef.current = null
      }
      if (retryCountdown !== null) setRetryCountdown(null)
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current)
        retryIntervalRef.current = null
      }
    }
  }, [isLoading, campaignData])
  
  // Estados para modo creatives (drilldown)
  const [drilldownLevel, setDrilldownLevel] = useState<'campaign' | 'adgroup' | 'creative'>('campaign')
  const [selectedCreativeCampaign, setSelectedCreativeCampaign] = useState<string | null>(null)
  const [selectedAdGroup, setSelectedAdGroup] = useState<string | null>(null)
  // Carregar colunas visíveis de criativos do localStorage ou usar padrão
  const getInitialCreativeVisibleColumns = () => {
    const saved = localStorage.getItem('paidMediaCreativeVisibleColumns')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return {
          platform: true,
          campaign_name: true,
          cost: true,
          impressions: false,
          clicks: false,
          ctr: false,
          cpc: false,
          leads: false,
          transactions: true,
          transactions_first: false,
          transactions_delta: true,
          new_customers_percentage: true,
          revenue: true,
          revenue_first: false,
          cpv: false,
          cpa: false,
          cpa_delta: true,
          roas: true,
          roas_first: false
        }
      }
    }
    return {
      platform: true,
      campaign_name: true,
      cost: true,
      impressions: false,
      clicks: false,
      ctr: false,
      cpc: false,
      leads: false,
      transactions: true,
      transactions_first: false,
      transactions_delta: true,
      new_customers_percentage: true,
      revenue: true,
      revenue_first: false,
      cpv: false,
      cpa: false,
      cpa_delta: true,
      roas: true,
      roas_first: false
    }
  }
  
  const [creativeVisibleColumns, setCreativeVisibleColumns] = useState(getInitialCreativeVisibleColumns())
  const [showCreativeColumnSelector, setShowCreativeColumnSelector] = useState(false)
  
  // Salvar colunas visíveis de criativos no localStorage quando mudarem
  useEffect(() => {
    localStorage.setItem('paidMediaCreativeVisibleColumns', JSON.stringify(creativeVisibleColumns))
  }, [creativeVisibleColumns])

  // Funções auxiliares para cache inteligente
  const getCacheKey = (start: string, end: string) => `${start}_${end}`
  
  const isDateRangeInCache = (start: string, end: string) => {
    const cacheKey = getCacheKey(start, end)
    return historicalData[cacheKey] !== undefined
  }
  
  const isDateRangeSubsetOfCache = (start: string, end: string) => {
    const requestedStart = new Date(start)
    const requestedEnd = new Date(end)
    
    return Object.values(historicalData).some(cache => {
      const cacheStart = new Date(cache.dateRange.start)
      const cacheEnd = new Date(cache.dateRange.end)
      return requestedStart >= cacheStart && requestedEnd <= cacheEnd
    })
  }
  
  const findBestCacheForDateRange = (start: string, end: string) => {
    const requestedStart = new Date(start)
    const requestedEnd = new Date(end)
    
    let bestCache = null
    let bestCoverage = 0
    
    Object.entries(historicalData).forEach(([key, cache]) => {
      const cacheStart = new Date(cache.dateRange.start)
      const cacheEnd = new Date(cache.dateRange.end)
      
      // Verifica se o cache cobre o período solicitado
      if (requestedStart >= cacheStart && requestedEnd <= cacheEnd) {
        const coverage = (requestedEnd.getTime() - requestedStart.getTime()) / 
                        (cacheEnd.getTime() - cacheStart.getTime())
        
        if (coverage > bestCoverage) {
          bestCoverage = coverage
          bestCache = { key, ...cache }
        }
      }
    })
    
    return bestCache
  }
  
  
  // Carregar colunas visíveis do localStorage ou usar padrão
  const getInitialVisibleColumns = () => {
    const saved = localStorage.getItem('paidMediaVisibleColumns')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return {
          platform: true,
          campaign_name: true,
          cost: true,
          impressions: false,
          clicks: false,
          ctr: false,
          cpc: false,
          leads: false,
          transactions: true,
          transactions_first: false,
          transactions_delta: true,
          new_customers_percentage: true,
          revenue: true,
          revenue_first: false,
          roas: true,
          roas_first: false,
          cpv: false,
          cpa: false,
          cpa_delta: true
        }
      }
    }
    return {
      platform: true,
      campaign_name: true,
      cost: true,
      impressions: false,
      clicks: false,
      ctr: false,
      cpc: false,
      leads: false,
      transactions: true,
      transactions_first: false,
      transactions_delta: true,
      new_customers_percentage: true,
      revenue: true,
      revenue_first: false,
      roas: true,
      roas_first: false,
      cpv: false,
      cpa: false,
          cpa_delta: true,
          pixel_transactions: false,
          pixel_revenue: false,
          pixel_transactions_delta: false,
          pixel_revenue_delta: false,
          first_annual_revenue: false,
          first_annual_subscriptions: false,
          first_montly_revenue: false,
          first_montly_subscriptions: false
        }
  }
  
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns())
  const [showColumnSelector, setShowColumnSelector] = useState(false)

  // Salvar colunas visíveis no localStorage quando mudarem
  useEffect(() => {
    localStorage.setItem('paidMediaVisibleColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // Título dinâmico da aba baseado no estado de carregamento
  const getPageTitle = () => {
    try {
      if (isLoading) {
        return '🔄 Carregando... - Mídia Paga'
      }
      if (isBackgroundLoading) {
        return '🔄 Atualizando... - Mídia Paga'
      }
      if (filteredData && filteredData.length > 0) {
        const totalCost = filteredData.reduce((sum, campaign) => sum + campaign.cost, 0)
        const totalRevenue = filteredData.reduce((sum, campaign) => {
          const baseRevenue = campaign.revenue || 0
          // Descontar recorrências mensais e anuais da receita total
          return sum + (baseRevenue - (campaign.recurring_montly_revenue || 0) - (campaign.recurring_annual_revenue || 0))
        }, 0)
        const roas = totalCost > 0 ? (totalRevenue / totalCost).toFixed(1) : '0.0'
        
        // Formata as datas para exibição
        const startDateFormatted = parseDateString(startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        const endDateFormatted = parseDateString(endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        
        const filterInfo = selectedCampaign ? ` | Filtrado: ${selectedCampaign}` : ''
        return `✅ ${filteredData.length} campanhas | R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} | ROAS ${roas}x | ${startDateFormatted} - ${endDateFormatted}${filterInfo} - Mídia Paga`
      }
      return 'Mídia Paga - Dashboard'
    } catch (error) {
      console.error('❌ Erro no getPageTitle:', error)
      return 'Mídia Paga - Dashboard'
    }
  }

  useDocumentTitle(getPageTitle())

  const fetchCreativeData = async (forceRefresh = false, useCacheFirst = false) => {
    if (!validateTableName(selectedTable)) {
      console.log('❌ Table name inválido para busca de criativos')
      return
    }

    setIsLoadingCreatives(true)

    try {
      // Tentar cache primeiro apenas se indicado (ex.: primeiro load da aba)
      let response: any = null
      let cacheWorked = false
      
      if (useCacheFirst) {
        try {
          console.log('🚀 [Criativos] Tentando cache (last_cache: true)...')
          response = await api.getAdsCreatives(token, {
            start_date: startDate,
            end_date: endDate,
            table_name: selectedTable,
            last_cache: true,
            force_refresh: false
          })
          if (response && response.data && response.data.length > 0) {
            cacheWorked = true
          }
        } catch (cacheError) {
          cacheWorked = false
        }
      }
      
      // Se o cache não funcionou (ou não foi tentado), fazer request novo sem cache
      // Sempre usar force_refresh: false
      if (!cacheWorked) {
        console.log('🚀 [Criativos] Request sem cache (sem force_refresh)...')
        try {
          response = await api.getAdsCreatives(token, {
            start_date: startDate,
            end_date: endDate,
            table_name: selectedTable,
            last_cache: false,
            force_refresh: false
          })
          console.log('✅ Request novo de criativos concluído. Dados recebidos:', response?.data?.length || 0, 'registros')
        } catch (error) {
          console.error('❌ Erro ao buscar dados de criativos (request novo):', error)
          setCreativeData([])
          setCacheInfo(null)
          setIsLoadingCreatives(false)
          return
        }
      }
      
      // Converter dados da API para o formato esperado
      const convertedData: AdsCreativeData[] = (response?.data || []).map((item: any) => ({
        platform: item.platform,
        campaign_name: item.campaign_name,
        ad_group_name: item.adset_name || item.ad_group_name || 'N/A',
        creative_name: item.ad_name || item.creative_name || 'N/A',
        date: convertBrazilianDateToISO(item.date),
        cost: item.cost,
        impressions: item.impressions,
        clicks: item.clicks,
        leads: item.leads,
        transactions: item.transactions,
        revenue: item.revenue,
        transactions_first: item.transactions_first,
        revenue_first: item.revenue_first,
        transactions_origin_stack: item.transactions_origin_stack,
        revenue_origin_stack: item.revenue_origin_stack,
        transactions_first_origin_stack: item.transactions_first_origin_stack,
        revenue_first_origin_stack: item.revenue_first_origin_stack
      }))
      
        setCreativeData(convertedData)
        setCacheInfo(response?.cache_info || null)
        
        console.log('✅ Dados de criativos carregados:', convertedData.length, 'registros')
        console.log('📊 Amostra dos dados convertidos:', convertedData.slice(0, 3))
    } catch (error) {
      console.error('❌ Erro ao buscar dados de criativos:', error)
      // Em caso de erro, limpar dados e manter loading state
      setCreativeData([])
      setCacheInfo(null)
    } finally {
      setIsLoadingCreatives(false)
    }
  }

  // Funções para drilldown de criativos
  const applyDrilldown = (level: 'campaign' | 'adgroup' | 'creative', value: string | null) => {
    console.log('🔍 Aplicando drilldown:', { 
      level, 
      value, 
      currentLevel: drilldownLevel,
      currentSelectedCampaign: selectedCreativeCampaign,
      currentSelectedAdGroup: selectedAdGroup
    })
    
    setDrilldownLevel(level)
    
    if (level === 'adgroup') {
      // Quando vamos para o nível de grupo de anúncio, o value é o nome do grupo selecionado
      setSelectedAdGroup(value)
      console.log('🔍 Definindo grupo de anúncio selecionado:', value)
      console.log('🔍 Mantendo campanha selecionada:', selectedCreativeCampaign)
    } else if (level === 'creative') {
      // Quando vamos para o nível de criativo, manter campanha e grupo selecionados
      console.log('🔍 Indo para nível de criativo, mantendo:', {
        campaign: selectedCreativeCampaign,
        adGroup: selectedAdGroup
      })
    }
    
    console.log('🔍 Estado após drilldown:', { 
      newLevel: level, 
      selectedCampaign: level === 'campaign' ? value : selectedCreativeCampaign,
      selectedAdGroup: level === 'adgroup' ? value : selectedAdGroup
    })
  }

  const goBackDrilldown = () => {
    if (drilldownLevel === 'creative') {
      setDrilldownLevel('adgroup')
      setSelectedAdGroup(null)
      // Manter selectedCreativeCampaign para poder voltar ao nível de campanha
    } else if (drilldownLevel === 'adgroup') {
      setDrilldownLevel('campaign')
      setSelectedAdGroup(null)
      // Manter selectedCreativeCampaign para poder voltar ao nível de campanha
    } else if (drilldownLevel === 'campaign') {
      // Voltar ao nível inicial - limpar tudo
      setDrilldownLevel('campaign')
      setSelectedCreativeCampaign(null)
      setSelectedAdGroup(null)
    }
  }

  const getDrilldownTitle = () => {
    if (drilldownLevel === 'campaign') return 'Campanhas'
    if (drilldownLevel === 'adgroup') return 'Grupos de Anúncio'
    return 'Criativos'
  }

  const getNextDrilldownLevel = () => {
    if (drilldownLevel === 'campaign') return 'adgroup'
    if (drilldownLevel === 'adgroup') return 'creative'
    return null
  }

  const canDrilldown = () => {
    return getNextDrilldownLevel() !== null
  }

  // useEffect para iniciar processamento quando selectedTable mudar
  useEffect(() => {
    if (!selectedTable || !validateTableName(selectedTable)) {
      return
    }

    // Verificar e marcar de forma atômica para evitar race condition no Strict Mode
    // Se já está processando este selectedTable, ignorar
    if (hasStartedProcessingRef.current === selectedTable) {
      console.log('⚠️ Processamento já iniciado para:', selectedTable)
      return
    }
    
    // Se está processando outro selectedTable, aguardar
    if (isProcessingRef.current) {
      console.log('⚠️ Processamento em andamento para outro selectedTable, aguardando...')
      return
    }
    
    // Marcar IMEDIATAMENTE antes de qualquer outra operação
    // Isso previne que a segunda execução do Strict Mode passe pela verificação
    hasStartedProcessingRef.current = selectedTable
    
    // Limpar polling anterior se houver
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (additionalPollRef.current) {
      clearInterval(additionalPollRef.current)
      additionalPollRef.current = null
    }
    
    console.log('🚀 Iniciando processamento para:', selectedTable)
    
    // Usar setTimeout para garantir que a marcação foi feita antes da execução
    // Isso ajuda a evitar que o Strict Mode execute duas vezes
    const timeoutId = setTimeout(() => {
      startProcessing()
    }, 0)
    
    // Cleanup ao desmontar ou mudar selectedTable
    return () => {
      clearTimeout(timeoutId)
      
      // Resetar a ref quando selectedTable mudar
      if (hasStartedProcessingRef.current === selectedTable) {
        hasStartedProcessingRef.current = null
      }
      
      // Resetar flag de processamento apenas se não estiver mais processando
      // (pode estar processando outro selectedTable)
      if (hasStartedProcessingRef.current !== selectedTable) {
        isProcessingRef.current = false
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      if (additionalPollRef.current) {
        clearInterval(additionalPollRef.current)
        additionalPollRef.current = null
      }
    }
  }, [selectedTable, startProcessing])

  // useEffect para filtrar dados quando startDate ou endDate mudarem (sem fazer novo request)
  useEffect(() => {
    if (allCampaignData.length > 0 && startDate && endDate) {
      filterDataByDateRange(allCampaignData, startDate, endDate)
    }
  }, [startDate, endDate, allCampaignData, filterDataByDateRange])

  // useEffect para buscar dados de criativos quando a aba mudar
  useEffect(() => {
    if (activeTab === 'creatives') {
      const requestKey = `${selectedTable}::${startDate}::${endDate}`
      const isFirstLoad = lastCreativesKeyRef.current === null
      const isNewDateRange = lastCreativesKeyRef.current !== requestKey
      fetchCreativeData(isNewDateRange, isFirstLoad)
      lastCreativesKeyRef.current = requestKey
    }
  }, [activeTab, selectedTable, startDate, endDate, token])

  // Função para verificar se o cache é antigo (mais de 4 horas)
  const isCacheOld = () => {
    if (!cacheInfo) return false
    const cacheDate = new Date(cacheInfo.cached_at + 'Z')
    const now = new Date()
    const diffHours = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60)
    return diffHours > 4
  }

  // Função para atualizar dados em background
  const refreshData = async () => {
    console.log('🔄 ===== INICIANDO refreshData =====')
    setIsRefreshing(true)
    
    try {
      let token = localStorage.getItem('auth-token')
      if (!token) return

      if (!validateTableName(selectedTable)) {
        return
      }

      console.log('🔄 Atualizando dados em background...')
      console.log('🔄 Parâmetros do request:', {
        start_date: startDate,
        end_date: endDate,
        table_name: selectedTable,
        force_refresh: false
      })
      
      // Aguarda um pouco para garantir que o token seja renovado se necessário
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Pega o token atualizado (caso tenha sido renovado)
      token = localStorage.getItem('auth-token')
      console.log('🔄 Token após aguardar:', token ? 'disponível' : 'não disponível')
      
      // Faz request normal em background sem force_refresh
      const response = await api.getAdsCampaigns(token || '', {
        start_date: startDate,
        end_date: endDate,
        table_name: selectedTable,
        force_refresh: false
      })

      console.log('✅ Dados atualizados em background:', response)
      
      // Atualiza os dados sem afetar a interface
      setCampaignData(response.data || [])
      setCacheInfo(response.cache_info || null)
      setSummary(response.summary || null)
      setUsedFallback(false)
      setError500Occurred(false) // Reset erro 500
      
    } catch (error) {
      console.error('❌ Erro ao atualizar dados em background:', error)
      console.error('❌ Tipo do erro:', typeof error)
      console.error('❌ Mensagem do erro:', error instanceof Error ? error.message : String(error))
      
      // Se for erro 5xx ou erro de rede/timeout, volta para o cache
      const is5xxError = error instanceof Error && (
        /5\d{2}/.test(error.message) || 
        ((error as any).status && (error as any).status >= 500 && (error as any).status < 600) ||
        (error as any).isNetworkError ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network error')
      )
      console.log('🔍 Verificando se é erro 5xx ou rede:', is5xxError)
      console.log('🔍 Regex test result:', error instanceof Error ? /5\d{2}/.test(error.message) : 'N/A')
      console.log('🔍 Status HTTP do erro:', (error as any).status || 'não disponível')
      console.log('🔍 É erro de rede:', (error as any).isNetworkError || false)
      
      if (is5xxError) {
        console.log('⚠️ Erro 5xx ou de rede detectado, voltando para o cache...')
        setError500Occurred(true)
        try {
          // Pega o token atualizado para o fallback
          const updatedToken = localStorage.getItem('auth-token')
          console.log('🔄 Token para fallback:', updatedToken ? 'disponível' : 'não disponível')
          
          const cacheResponse = await api.getAdsCampaigns(updatedToken || '', { 
            table_name: selectedTable, 
            last_cache: true 
          })
          
          console.log('✅ Cache restaurado após erro 5xx:', cacheResponse)
          setCampaignData(cacheResponse.data || [])
          setCacheInfo(cacheResponse.cache_info || null)
          setSummary(cacheResponse.summary || null)
          setUsedFallback(false)
        } catch (cacheError) {
          console.error('❌ Erro ao restaurar cache:', cacheError)
        }
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filtrar dados por campanha, plataforma e termo de busca (apenas para aba overview)
  const filteredData = campaignData.filter(item => {
    const matchesCampaign = selectedCampaign ? item.campaign_name === selectedCampaign : true
    // Aplicar filtro de plataforma apenas na aba overview
    const matchesPlatform = (activeTab === 'overview' && selectedPlatform) ? item.platform === selectedPlatform : true
    const matchesSearch = searchTerm ? 
      item.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.platform.toLowerCase().includes(searchTerm.toLowerCase())
      : true
    
    // Debug específico para Google Ads
    if (selectedPlatform === 'google_ads' && !matchesPlatform && activeTab === 'overview') {
      console.log('🔍 Item não corresponde ao filtro Google Ads:', {
        itemPlatform: item.platform,
        selectedPlatform,
        matchesPlatform,
        activeTab
      })
    }
    
    return matchesCampaign && matchesPlatform && matchesSearch
  })

  // Debug: Verificar plataformas disponíveis
  const availablePlatforms = [...new Set(campaignData.map(item => item.platform))]
  console.log('🔍 Debug Filtro de Plataforma:', {
    activeTab,
    selectedPlatform,
    availablePlatforms,
    campaignDataLength: campaignData.length,
    filteredDataLength: filteredData.length,
    samplePlatforms: campaignData.slice(0, 5).map(item => item.platform),
    filteredSample: filteredData.slice(0, 3).map(item => ({ platform: item.platform, campaign: item.campaign_name })),
    filterApplied: activeTab === 'overview' && selectedPlatform ? 'SIM' : 'NÃO',
    googleAdsCount: campaignData.filter(item => item.platform === 'google_ads').length,
    metaAdsCount: campaignData.filter(item => item.platform === 'meta_ads').length
  })


  // Agrupar dados por campanha
  const groupedData = filteredData.length > 0 ? filteredData.reduce((acc, item) => {
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
        pixel_transactions: 0,
        pixel_revenue: 0,
        recurring_annual_revenue: 0,
        recurring_annual_subscriptions: 0,
        recurring_montly_revenue: 0,
        recurring_montly_subscriptions: 0,
        first_annual_revenue: 0,
        first_annual_subscriptions: 0,
        first_montly_revenue: 0,
        first_montly_subscriptions: 0,
        records: []
      }
    }
    
    acc[key].cost += item.cost
    acc[key].impressions += item.impressions
    acc[key].clicks += item.clicks
    acc[key].leads += item.leads
    
    // Os dados já foram convertidos pela função convertPaidMediaToAdsCampaignData
    // Usar os campos já convertidos (não mais os campos originais da API)
    const transactionsLND = toNumber(item.transactions ?? 0) // last_non_direct
    const revenueLND = toNumber(item.revenue ?? 0) // last_non_direct
    const transactionsFirstLND = toNumber(item.transactions_first ?? 0)
    const revenueFirstLND = toNumber(item.revenue_first ?? 0)
    
    const transactionsOS = toNumber(item.transactions_origin_stack ?? 0) // origin_stack (fsm_*)
    const revenueOS = toNumber(item.revenue_origin_stack ?? 0) // origin_stack (fsm_*)
    const transactionsFirstOS = toNumber(item.transactions_first_origin_stack ?? 0)
    const revenueFirstOS = toNumber(item.revenue_first_origin_stack ?? 0)
    
    // Usar as métricas corretas baseado no modelo de atribuição selecionado
    if (attributionModel === 'origin_stack') {
      acc[key].transactions += transactionsOS
      acc[key].revenue += revenueOS
      acc[key].transactions_first += transactionsFirstOS
      acc[key].revenue_first += revenueFirstOS
    } else {
      acc[key].transactions += transactionsLND
      acc[key].revenue += revenueLND
      acc[key].transactions_first += transactionsFirstLND
      acc[key].revenue_first += revenueFirstLND
    }
    
    // Sempre armazenar ambos os modelos para calcular deltas
    acc[key].transactions_origin_stack += transactionsOS
    acc[key].revenue_origin_stack += revenueOS
    acc[key].transactions_first_origin_stack += transactionsFirstOS
    acc[key].revenue_first_origin_stack += revenueFirstOS
    
    // Adicionar métricas de pixel
    acc[key].pixel_transactions += toNumber(item.pixel_transactions || 0)
    acc[key].pixel_revenue += toNumber(item.pixel_revenue || 0)
    
    // Adicionar métricas de recurring
    acc[key].recurring_annual_revenue += toNumber(item.recurring_annual_revenue || 0)
    acc[key].recurring_annual_subscriptions += toNumber(item.recurring_annual_subscriptions || 0)
    acc[key].recurring_montly_revenue += toNumber(item.recurring_montly_revenue || 0)
    acc[key].recurring_montly_subscriptions += toNumber(item.recurring_montly_subscriptions || 0)
    
    // Adicionar métricas de first (primeiras)
    acc[key].first_annual_revenue += toNumber(item.first_annual_revenue || 0)
    acc[key].first_annual_subscriptions += toNumber(item.first_annual_subscriptions || 0)
    acc[key].first_montly_revenue += toNumber(item.first_montly_revenue || 0)
    acc[key].first_montly_subscriptions += toNumber(item.first_montly_subscriptions || 0)
    
    acc[key].records.push(item)
    
    return acc
  }, {} as { [key: string]: any }) : {}

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
        case 'transactions_delta':
          // Usar valores originais (não afetados pelo filtro de atribuição)
          const aRevenueLND = a.records && a.records.length > 0 
            ? a.records.reduce((sum: number, record: any) => sum + (record.revenue || 0), 0)
            : a.revenue;
          const aRevenueOS = a.records && a.records.length > 0 
            ? a.records.reduce((sum: number, record: any) => sum + (record.revenue_origin_stack || 0), 0)
            : a.revenue_origin_stack;
          const aRoasLND = a.cost > 0 ? aRevenueLND / a.cost : 0
          const aRoasOS = a.cost > 0 ? aRevenueOS / a.cost : 0
          aValue = aRoasLND > 0 ? ((aRoasOS - aRoasLND) / aRoasLND) * 100 : 0
          
          const bRevenueLND = b.records && b.records.length > 0 
            ? b.records.reduce((sum: number, record: any) => sum + (record.revenue || 0), 0)
            : b.revenue;
          const bRevenueOS = b.records && b.records.length > 0 
            ? b.records.reduce((sum: number, record: any) => sum + (record.revenue_origin_stack || 0), 0)
            : b.revenue_origin_stack;
          const bRoasLND = b.cost > 0 ? bRevenueLND / b.cost : 0
          const bRoasOS = b.cost > 0 ? bRevenueOS / b.cost : 0
          bValue = bRoasLND > 0 ? ((bRoasOS - bRoasLND) / bRoasLND) * 100 : 0
          break
        case 'new_customers_percentage':
          const aTransactions = attributionModel === 'origin_stack' ? (a.transactions_origin_stack || a.transactions) : a.transactions
          const aTransactionsFirst = attributionModel === 'origin_stack' ? (a.transactions_first_origin_stack || a.transactions_first) : a.transactions_first
          aValue = aTransactions > 0 ? (aTransactionsFirst / aTransactions) * 100 : 0
          const bTransactions = attributionModel === 'origin_stack' ? (b.transactions_origin_stack || b.transactions) : b.transactions
          const bTransactionsFirst = attributionModel === 'origin_stack' ? (b.transactions_first_origin_stack || b.transactions_first) : b.transactions_first
          bValue = bTransactions > 0 ? (bTransactionsFirst / bTransactions) * 100 : 0
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
        case 'cpv':
          aValue = a.transactions > 0 ? a.cost / a.transactions : 0
          bValue = b.transactions > 0 ? b.cost / b.transactions : 0
          break
        case 'cpa':
          aValue = a.transactions_first > 0 ? a.cost / a.transactions_first : 0
          bValue = b.transactions_first > 0 ? b.cost / b.transactions_first : 0
          break
        case 'cpa_delta':
          // Usar valores originais (não afetados pelo filtro de atribuição)
          const aTransactionsFirstLND = a.records && a.records.length > 0 
            ? a.records.reduce((sum: number, record: any) => sum + record.transactions_first, 0)
            : a.transactions_first;
          const aTransactionsFirstOS = a.records && a.records.length > 0 
            ? a.records.reduce((sum: number, record: any) => sum + (record.transactions_first_origin_stack || 0), 0)
            : a.transactions_first_origin_stack;
          const aCPALND = aTransactionsFirstLND > 0 ? a.cost / aTransactionsFirstLND : 0
          const aCPAOS = aTransactionsFirstOS > 0 ? a.cost / aTransactionsFirstOS : 0
          aValue = aCPALND > 0 ? ((aCPALND - aCPAOS) / aCPALND) * 100 : 0
          
          const bTransactionsFirstLND = b.records && b.records.length > 0 
            ? b.records.reduce((sum: number, record: any) => sum + record.transactions_first, 0)
            : b.transactions_first;
          const bTransactionsFirstOS = b.records && b.records.length > 0 
            ? b.records.reduce((sum: number, record: any) => sum + (record.transactions_first_origin_stack || 0), 0)
            : b.transactions_first_origin_stack;
          const bCPALND = bTransactionsFirstLND > 0 ? b.cost / bTransactionsFirstLND : 0
          const bCPAOS = bTransactionsFirstOS > 0 ? b.cost / bTransactionsFirstOS : 0
          bValue = bCPALND > 0 ? ((bCPALND - bCPAOS) / bCPALND) * 100 : 0
          break
        case 'pixel_transactions_delta':
          // Calcular delta entre pixel_transactions e transactions_origin_stack
          const aPixelTransactions = a.pixel_transactions || 0
          const aOriginStackTransactions = a.records && a.records.length > 0 
            ? a.records.reduce((sum: number, record: any) => sum + (record.transactions_origin_stack || 0), 0)
            : a.transactions_origin_stack || 0
          aValue = aOriginStackTransactions > 0 
            ? ((aPixelTransactions - aOriginStackTransactions) / aOriginStackTransactions) * 100 
            : 0
          
          const bPixelTransactions = b.pixel_transactions || 0
          const bOriginStackTransactions = b.records && b.records.length > 0 
            ? b.records.reduce((sum: number, record: any) => sum + (record.transactions_origin_stack || 0), 0)
            : b.transactions_origin_stack || 0
          bValue = bOriginStackTransactions > 0 
            ? ((bPixelTransactions - bOriginStackTransactions) / bOriginStackTransactions) * 100 
            : 0
          break
        case 'pixel_revenue_delta':
          // Calcular delta entre pixel_revenue e revenue_origin_stack
          const aPixelRevenue = a.pixel_revenue || 0
          const aOriginStackRevenue = a.records && a.records.length > 0 
            ? a.records.reduce((sum: number, record: any) => sum + (record.revenue_origin_stack || 0), 0)
            : a.revenue_origin_stack || 0
          aValue = aOriginStackRevenue > 0 
            ? ((aPixelRevenue - aOriginStackRevenue) / aOriginStackRevenue) * 100 
            : 0
          
          const bPixelRevenue = b.pixel_revenue || 0
          const bOriginStackRevenue = b.records && b.records.length > 0 
            ? b.records.reduce((sum: number, record: any) => sum + (record.revenue_origin_stack || 0), 0)
            : b.revenue_origin_stack || 0
          bValue = bOriginStackRevenue > 0 
            ? ((bPixelRevenue - bOriginStackRevenue) / bOriginStackRevenue) * 100 
            : 0
          break
        case 'recurring_annual_revenue':
          aValue = a.recurring_annual_revenue || 0
          bValue = b.recurring_annual_revenue || 0
          break
        case 'recurring_annual_subscriptions':
          aValue = a.recurring_annual_subscriptions || 0
          bValue = b.recurring_annual_subscriptions || 0
          break
        case 'recurring_montly_revenue':
          aValue = a.recurring_montly_revenue || 0
          bValue = b.recurring_montly_revenue || 0
          break
        case 'recurring_montly_subscriptions':
          aValue = a.recurring_montly_subscriptions || 0
          bValue = b.recurring_montly_subscriptions || 0
          break
        case 'first_annual_revenue':
          aValue = a.first_annual_revenue || 0
          bValue = b.first_annual_revenue || 0
          break
        case 'first_annual_subscriptions':
          aValue = a.first_annual_subscriptions || 0
          bValue = b.first_annual_subscriptions || 0
          break
        case 'first_montly_revenue':
          aValue = a.first_montly_revenue || 0
          bValue = b.first_montly_revenue || 0
          break
        case 'first_montly_subscriptions':
          aValue = a.first_montly_subscriptions || 0
          bValue = b.first_montly_subscriptions || 0
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

  // Funções para processar dados de criativos
  const getGroupedCreativeData = () => {
    console.log('🔍 getGroupedCreativeData chamada:', {
      creativeDataLength: creativeData.length,
      drilldownLevel,
      selectedCreativeCampaign,
      selectedAdGroup,
      selectedPlatform,
      availableCreativePlatforms: [...new Set(creativeData.map(item => item.platform))]
    })
    
    let filteredData = creativeData.filter((item) => {
      // Aplicar filtro de plataforma apenas na aba creatives
      const matchesPlatform = (activeTab === 'creatives' && selectedPlatform) ? item.platform === selectedPlatform : true
      const matchesSearch = !searchTerm || 
        item.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ad_group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.creative_name.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Aplicar filtros de drilldown baseado no nível atual
      let drilldownMatch = true
      
      // Aplicar filtro de campanha se estiver selecionada
      if (selectedCreativeCampaign) {
        drilldownMatch = drilldownMatch && item.campaign_name === selectedCreativeCampaign
      }
      
      // Aplicar filtro de grupo de anúncio se estiver selecionado
      if (selectedAdGroup) {
        drilldownMatch = drilldownMatch && item.ad_group_name === selectedAdGroup
      }
      
      const result = matchesPlatform && matchesSearch && drilldownMatch
      
      if (!result && selectedPlatform === 'google_ads' && activeTab === 'creatives') {
        console.log('🔍 Item filtrado (Google Ads - Criativos):', {
          item: item.campaign_name,
          platform: item.platform,
          matchesPlatform,
          matchesSearch,
          drilldownMatch,
          drilldownLevel,
          selectedPlatform,
          searchTerm,
          selectedCreativeCampaign,
          selectedAdGroup,
          activeTab
        })
      }
      
      return result
    })

    console.log('🔍 Debug drilldown:', {
      drilldownLevel,
      selectedCreativeCampaign,
      selectedAdGroup,
      creativeDataLength: creativeData.length,
      filteredDataLength: filteredData.length,
      sampleData: creativeData.slice(0, 2),
      filteredSampleData: filteredData.slice(0, 2),
      allCampaigns: [...new Set(creativeData.map(item => item.campaign_name))],
      allAdGroups: [...new Set(creativeData.map(item => item.ad_group_name))]
    })
    
    // Log específico para debug do filtro de campanha
    if (drilldownLevel === 'adgroup' && selectedCreativeCampaign) {
      const campaignItems = creativeData.filter(item => item.campaign_name === selectedCreativeCampaign)
      console.log('🔍 Itens da campanha selecionada:', {
        selectedCampaign: selectedCreativeCampaign,
        totalItemsInCampaign: campaignItems.length,
        sampleItems: campaignItems.slice(0, 3).map(item => ({
          campaign: item.campaign_name,
          adGroup: item.ad_group_name,
          platform: item.platform
        })),
        allAdGroupsInCampaign: [...new Set(campaignItems.map(item => item.ad_group_name))]
      })
    }
    
    // Log específico para debug quando não há dados filtrados
    if (filteredData.length === 0) {
      console.log('🔍 NENHUM DADO FILTRADO! Verificando:', {
        drilldownLevel,
        selectedCreativeCampaign,
        selectedAdGroup,
        selectedPlatform,
        searchTerm,
        activeTab,
        totalCreativeData: creativeData.length,
        sampleCreativeData: creativeData.slice(0, 3).map(item => ({
          campaign: item.campaign_name,
          adGroup: item.ad_group_name,
          platform: item.platform
        }))
      })
      
      // Verificar se há dados da campanha selecionada
      if (selectedCreativeCampaign) {
        const campaignData = creativeData.filter(item => item.campaign_name === selectedCreativeCampaign)
        console.log('🔍 Dados da campanha selecionada:', {
          selectedCampaign: selectedCreativeCampaign,
          campaignDataLength: campaignData.length,
          sampleCampaignData: campaignData.slice(0, 3)
        })
      }
    }

    if (drilldownLevel === 'campaign') {
      const result = filteredData.reduce((acc, item) => {
        const key = item.campaign_name
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
          }
        }
        acc[key].cost += item.cost
        acc[key].impressions += item.impressions
        acc[key].clicks += item.clicks
        acc[key].leads += item.leads
        
        // API 2.0: fsm_* = origin_stack, campos normais = last_non_direct
        // Os dados já foram convertidos pela função convertPaidMediaToAdsCampaignData
        // Usar os campos já convertidos (não mais os campos originais da API)
        const transactionsLND = toNumber(item.transactions ?? 0) // last_non_direct
        const revenueLND = toNumber(item.revenue ?? 0) // last_non_direct
        const transactionsFirstLND = toNumber(item.transactions_first ?? 0)
        const revenueFirstLND = toNumber(item.revenue_first ?? 0)
        
        const transactionsOS = toNumber(item.transactions_origin_stack ?? 0) // origin_stack (fsm_*)
        const revenueOS = toNumber(item.revenue_origin_stack ?? 0) // origin_stack (fsm_*)
        const transactionsFirstOS = toNumber(item.transactions_first_origin_stack ?? 0)
        const revenueFirstOS = toNumber(item.revenue_first_origin_stack ?? 0)
        
        // Usar as métricas corretas baseado no modelo de atribuição selecionado
        if (attributionModel === 'origin_stack') {
          acc[key].transactions += transactionsOS
          acc[key].revenue += revenueOS
          acc[key].transactions_first += transactionsFirstOS
          acc[key].revenue_first += revenueFirstOS
        } else {
          acc[key].transactions += transactionsLND
          acc[key].revenue += revenueLND
          acc[key].transactions_first += transactionsFirstLND
          acc[key].revenue_first += revenueFirstLND
        }
        
        // Sempre armazenar ambos os modelos para calcular deltas
        acc[key].transactions_origin_stack += transactionsOS
        acc[key].revenue_origin_stack += revenueOS
        acc[key].transactions_first_origin_stack += transactionsFirstOS
        acc[key].revenue_first_origin_stack += revenueFirstOS
        return acc
      }, {} as Record<string, any>)
      
      console.log('🔍 Agrupamento por campanha:', {
        filteredDataLength: filteredData.length,
        resultKeys: Object.keys(result),
        sampleResult: Object.values(result).slice(0, 2)
      })
      
      return result
    } else if (drilldownLevel === 'adgroup') {
      console.log('🔍 Iniciando agrupamento por grupo de anúncio:', {
        filteredDataLength: filteredData.length,
        selectedCampaign: selectedCreativeCampaign,
        sampleFilteredData: filteredData.slice(0, 3).map(item => ({
          campaign: item.campaign_name,
          adGroup: item.ad_group_name,
          platform: item.platform
        }))
      })
      
      const result = filteredData.reduce((acc, item) => {
        const key = item.ad_group_name
        if (!acc[key]) {
          acc[key] = {
            platform: item.platform,
            campaign_name: item.campaign_name,
            ad_group_name: item.ad_group_name,
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
          }
        }
        acc[key].cost += item.cost
        acc[key].impressions += item.impressions
        acc[key].clicks += item.clicks
        acc[key].leads += item.leads
        
        // API 2.0: fsm_* = origin_stack, campos normais = last_non_direct
        // Os dados já foram convertidos pela função convertPaidMediaToAdsCampaignData
        // Usar os campos já convertidos (não mais os campos originais da API)
        const transactionsLND = toNumber(item.transactions ?? 0) // last_non_direct
        const revenueLND = toNumber(item.revenue ?? 0) // last_non_direct
        const transactionsFirstLND = toNumber(item.transactions_first ?? 0)
        const revenueFirstLND = toNumber(item.revenue_first ?? 0)
        
        const transactionsOS = toNumber(item.transactions_origin_stack ?? 0) // origin_stack (fsm_*)
        const revenueOS = toNumber(item.revenue_origin_stack ?? 0) // origin_stack (fsm_*)
        const transactionsFirstOS = toNumber(item.transactions_first_origin_stack ?? 0)
        const revenueFirstOS = toNumber(item.revenue_first_origin_stack ?? 0)
        
        // Usar as métricas corretas baseado no modelo de atribuição selecionado
        if (attributionModel === 'origin_stack') {
          acc[key].transactions += transactionsOS
          acc[key].revenue += revenueOS
          acc[key].transactions_first += transactionsFirstOS
          acc[key].revenue_first += revenueFirstOS
        } else {
          acc[key].transactions += transactionsLND
          acc[key].revenue += revenueLND
          acc[key].transactions_first += transactionsFirstLND
          acc[key].revenue_first += revenueFirstLND
        }
        
        // Sempre armazenar ambos os modelos para calcular deltas
        acc[key].transactions_origin_stack += transactionsOS
        acc[key].revenue_origin_stack += revenueOS
        acc[key].transactions_first_origin_stack += transactionsFirstOS
        acc[key].revenue_first_origin_stack += revenueFirstOS
        return acc
      }, {} as Record<string, any>)
      
      console.log('🔍 Agrupamento por grupo de anúncio concluído:', {
        resultKeys: Object.keys(result),
        resultLength: Object.keys(result).length,
        sampleResult: Object.values(result).slice(0, 2),
        allAdGroupsInFilteredData: [...new Set(filteredData.map(item => item.ad_group_name))]
      })
      
      console.log('🔍 Agrupamento por grupo de anúncio:', {
        filteredDataLength: filteredData.length,
        resultKeys: Object.keys(result),
        sampleResult: Object.values(result).slice(0, 2)
      })
      
      return result
    } else {
      const result = filteredData.reduce((acc, item) => {
        const key = item.creative_name
        if (!acc[key]) {
          acc[key] = {
            platform: item.platform,
            campaign_name: item.campaign_name,
            ad_group_name: item.ad_group_name,
            creative_name: item.creative_name,
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
          }
        }
        acc[key].cost += item.cost
        acc[key].impressions += item.impressions
        acc[key].clicks += item.clicks
        acc[key].leads += item.leads
        
        // API 2.0: fsm_* = origin_stack, campos normais = last_non_direct
        // Os dados já foram convertidos pela função convertPaidMediaToAdsCampaignData
        // Usar os campos já convertidos (não mais os campos originais da API)
        const transactionsLND = toNumber(item.transactions ?? 0) // last_non_direct
        const revenueLND = toNumber(item.revenue ?? 0) // last_non_direct
        const transactionsFirstLND = toNumber(item.transactions_first ?? 0)
        const revenueFirstLND = toNumber(item.revenue_first ?? 0)
        
        const transactionsOS = toNumber(item.transactions_origin_stack ?? 0) // origin_stack (fsm_*)
        const revenueOS = toNumber(item.revenue_origin_stack ?? 0) // origin_stack (fsm_*)
        const transactionsFirstOS = toNumber(item.transactions_first_origin_stack ?? 0)
        const revenueFirstOS = toNumber(item.revenue_first_origin_stack ?? 0)
        
        // Usar as métricas corretas baseado no modelo de atribuição selecionado
        if (attributionModel === 'origin_stack') {
          acc[key].transactions += transactionsOS
          acc[key].revenue += revenueOS
          acc[key].transactions_first += transactionsFirstOS
          acc[key].revenue_first += revenueFirstOS
        } else {
          acc[key].transactions += transactionsLND
          acc[key].revenue += revenueLND
          acc[key].transactions_first += transactionsFirstLND
          acc[key].revenue_first += revenueFirstLND
        }
        
        // Sempre armazenar ambos os modelos para calcular deltas
        acc[key].transactions_origin_stack += transactionsOS
        acc[key].revenue_origin_stack += revenueOS
        acc[key].transactions_first_origin_stack += transactionsFirstOS
        acc[key].revenue_first_origin_stack += revenueFirstOS
        return acc
      }, {} as Record<string, any>)
      
      console.log('🔍 Agrupamento por criativo:', {
        filteredDataLength: filteredData.length,
        resultKeys: Object.keys(result),
        sampleResult: Object.values(result).slice(0, 2)
      })
      
      return result
    }
  }

  const groupedCreativeData = getGroupedCreativeData()
  const sortedCreativeData = Object.values(groupedCreativeData).sort((a: any, b: any) => {
    const aValue = a[sortField] || 0
    const bValue = b[sortField] || 0
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
  })
  
  console.log('🔍 Dados finais para renderização:', {
    groupedDataKeys: Object.keys(groupedCreativeData),
    sortedDataLength: sortedCreativeData.length,
    sampleSortedData: sortedCreativeData.slice(0, 2)
  })

  console.log('🔍 Debug agrupamento:', {
    groupedDataKeys: Object.keys(groupedCreativeData),
    sortedDataLength: sortedCreativeData.length,
    sampleGrouped: Object.values(groupedCreativeData).slice(0, 2)
  })

  // Calcular totais - usar campaignSummaries se disponível, senão calcular diretamente de filteredData
  const totals = campaignSummaries.length > 0 ? campaignSummaries.reduce((acc, item) => {
    const baseRevenue = attributionModel === 'origin_stack' ? (item.revenue_origin_stack || item.revenue) : item.revenue
    // Descontar recorrências mensais e anuais da receita total
    const revenue = baseRevenue - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0)
    // Receita de compras s/ recorrência: receita base descontando recorrências e primeiras anuais/mensais
    const revenueAvulsa = baseRevenue - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0) - (item.first_annual_revenue || 0) - (item.first_montly_revenue || 0)
    
    return {
      cost: acc.cost + item.cost,
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      leads: acc.leads + item.leads,
      transactions: acc.transactions + (attributionModel === 'origin_stack' ? (item.transactions_origin_stack || item.transactions) : item.transactions),
      revenue: acc.revenue + revenue,
      transactions_first: acc.transactions_first + (attributionModel === 'origin_stack' ? (item.transactions_first_origin_stack || item.transactions_first) : item.transactions_first),
      revenue_first: acc.revenue_first + (attributionModel === 'origin_stack' ? (item.revenue_first_origin_stack || item.revenue_first) : item.revenue_first),
      recurring_annual_revenue: acc.recurring_annual_revenue + (item.recurring_annual_revenue || 0),
      recurring_annual_subscriptions: acc.recurring_annual_subscriptions + (item.recurring_annual_subscriptions || 0),
      recurring_montly_revenue: acc.recurring_montly_revenue + (item.recurring_montly_revenue || 0),
      recurring_montly_subscriptions: acc.recurring_montly_subscriptions + (item.recurring_montly_subscriptions || 0),
      first_annual_revenue: acc.first_annual_revenue + (item.first_annual_revenue || 0),
      first_annual_subscriptions: acc.first_annual_subscriptions + (item.first_annual_subscriptions || 0),
      first_montly_revenue: acc.first_montly_revenue + (item.first_montly_revenue || 0),
      first_montly_subscriptions: acc.first_montly_subscriptions + (item.first_montly_subscriptions || 0),
      // Receita de compras s/ recorrência: receita base descontando recorrências e primeiras anuais/mensais
      revenue_avulsa: acc.revenue_avulsa + revenueAvulsa,
    }
  }, {
    cost: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
    recurring_annual_revenue: 0,
    recurring_annual_subscriptions: 0,
    recurring_montly_revenue: 0,
    recurring_montly_subscriptions: 0,
    first_annual_revenue: 0,
    first_annual_subscriptions: 0,
    first_montly_revenue: 0,
    first_montly_subscriptions: 0,
    revenue_avulsa: 0,
  }) : filteredData.length > 0 ? filteredData.reduce((acc, item) => {
    const baseRevenue = attributionModel === 'origin_stack' ? (item.revenue_origin_stack || item.revenue) : item.revenue
    // Descontar recorrências mensais e anuais da receita total
    const revenue = baseRevenue - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0)
    // Receita de compras s/ recorrência: receita base descontando recorrências e primeiras anuais/mensais
    const revenueAvulsa = baseRevenue - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0) - (item.first_annual_revenue || 0) - (item.first_montly_revenue || 0)
    
    return {
      cost: acc.cost + item.cost,
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      leads: acc.leads + item.leads,
      transactions: acc.transactions + (attributionModel === 'origin_stack' ? (item.transactions_origin_stack || item.transactions) : item.transactions),
      revenue: acc.revenue + revenue,
      transactions_first: acc.transactions_first + (attributionModel === 'origin_stack' ? (item.transactions_first_origin_stack || item.transactions_first) : item.transactions_first),
      revenue_first: acc.revenue_first + (attributionModel === 'origin_stack' ? (item.revenue_first_origin_stack || item.revenue_first) : item.revenue_first),
      recurring_annual_revenue: acc.recurring_annual_revenue + (item.recurring_annual_revenue || 0),
      recurring_annual_subscriptions: acc.recurring_annual_subscriptions + (item.recurring_annual_subscriptions || 0),
      recurring_montly_revenue: acc.recurring_montly_revenue + (item.recurring_montly_revenue || 0),
      recurring_montly_subscriptions: acc.recurring_montly_subscriptions + (item.recurring_montly_subscriptions || 0),
      first_annual_revenue: acc.first_annual_revenue + (item.first_annual_revenue || 0),
      first_annual_subscriptions: acc.first_annual_subscriptions + (item.first_annual_subscriptions || 0),
      first_montly_revenue: acc.first_montly_revenue + (item.first_montly_revenue || 0),
      first_montly_subscriptions: acc.first_montly_subscriptions + (item.first_montly_subscriptions || 0),
      // Receita de compras s/ recorrência: receita base descontando recorrências e primeiras anuais/mensais
      revenue_avulsa: acc.revenue_avulsa + revenueAvulsa,
    }
  }, {
    cost: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
    recurring_annual_revenue: 0,
    recurring_annual_subscriptions: 0,
    recurring_montly_revenue: 0,
    recurring_montly_subscriptions: 0,
    first_annual_revenue: 0,
    first_annual_subscriptions: 0,
    first_montly_revenue: 0,
    first_montly_subscriptions: 0,
    revenue_avulsa: 0,
  }) : {
    cost: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
    recurring_annual_revenue: 0,
    recurring_annual_subscriptions: 0,
    recurring_montly_revenue: 0,
    recurring_montly_subscriptions: 0,
    first_annual_revenue: 0,
    first_annual_subscriptions: 0,
    first_montly_revenue: 0,
    first_montly_subscriptions: 0,
  }

  // Calcular totais para criativos
  const creativeTotals = sortedCreativeData.length > 0 ? sortedCreativeData.reduce((acc: any, item: any) => {
    const baseRevenue = attributionModel === 'origin_stack' ? (item.revenue_origin_stack || item.revenue) : item.revenue
    const baseRevenueOS = item.revenue_origin_stack || 0
    // Descontar recorrências mensais e anuais da receita total
    const revenue = baseRevenue - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0)
    const revenueOS = baseRevenueOS - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0)
    
    return {
      cost: acc.cost + item.cost,
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      leads: acc.leads + item.leads,
      transactions: acc.transactions + (attributionModel === 'origin_stack' ? (item.transactions_origin_stack || item.transactions) : item.transactions),
      revenue: acc.revenue + revenue,
      transactions_first: acc.transactions_first + (attributionModel === 'origin_stack' ? (item.transactions_first_origin_stack || item.transactions_first) : item.transactions_first),
      revenue_first: acc.revenue_first + (attributionModel === 'origin_stack' ? (item.revenue_first_origin_stack || item.revenue_first) : item.revenue_first),
      transactions_origin_stack: acc.transactions_origin_stack + (item.transactions_origin_stack || 0),
      revenue_origin_stack: acc.revenue_origin_stack + revenueOS,
      transactions_first_origin_stack: acc.transactions_first_origin_stack + (item.transactions_first_origin_stack || 0),
      revenue_first_origin_stack: acc.revenue_first_origin_stack + (item.revenue_first_origin_stack || 0),
    }
  }, {
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
  }) : {
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
  }

  // Calcular totais separados para o comparativo
  const originStackTotals = sortedCreativeData.length > 0 ? sortedCreativeData.reduce((acc: any, item: any) => {
    const baseRevenueOS = item.revenue_origin_stack || 0
    // Descontar recorrências mensais e anuais da receita total
    const revenueOS = baseRevenueOS - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0)
    
    return {
      transactions: acc.transactions + (item.transactions_origin_stack || 0),
      revenue: acc.revenue + revenueOS,
      transactions_first: acc.transactions_first + (item.transactions_first_origin_stack || 0),
      revenue_first: acc.revenue_first + (item.revenue_first_origin_stack || 0),
    }
  }, {
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
  }) : {
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
  }

  const lastNonDirectTotals = sortedCreativeData.length > 0 ? sortedCreativeData.reduce((acc: any, item: any) => {
    const baseRevenue = item.revenue || 0
    // Descontar recorrências mensais e anuais da receita total
    const revenue = baseRevenue - (item.recurring_montly_revenue || 0) - (item.recurring_annual_revenue || 0)
    
    return {
      transactions: acc.transactions + item.transactions,
      revenue: acc.revenue + revenue,
      transactions_first: acc.transactions_first + item.transactions_first,
      revenue_first: acc.revenue_first + item.revenue_first,
    }
  }, {
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
  }) : {
    transactions: 0,
    revenue: 0,
    transactions_first: 0,
    revenue_first: 0,
  }

  // Verificar se há dados recurring não zerados - verificar tanto nos summaries quanto nos totais
  const hasRecurringData = campaignSummaries.some(campaign => 
    (campaign.recurring_annual_revenue || 0) > 0 ||
    (campaign.recurring_annual_subscriptions || 0) > 0 ||
    (campaign.recurring_montly_revenue || 0) > 0 ||
    (campaign.recurring_montly_subscriptions || 0) > 0
  ) || (totals.recurring_annual_revenue || 0) > 0 || 
       (totals.recurring_annual_subscriptions || 0) > 0 || 
       (totals.recurring_montly_revenue || 0) > 0 || 
       (totals.recurring_montly_subscriptions || 0) > 0

  // Verificar se há dados first (primeiras) não zerados - verificar tanto nos summaries quanto nos totais
  const hasFirstData = campaignSummaries.some(campaign => 
    (campaign.first_annual_revenue || 0) > 0 ||
    (campaign.first_annual_subscriptions || 0) > 0 ||
    (campaign.first_montly_revenue || 0) > 0 ||
    (campaign.first_montly_subscriptions || 0) > 0
  ) || (totals.first_annual_revenue || 0) > 0 || 
       (totals.first_annual_subscriptions || 0) > 0 || 
       (totals.first_montly_revenue || 0) > 0 || 
       (totals.first_montly_subscriptions || 0) > 0

  // Debug: Log dos totais de assinatura
  console.log('🔍 Debug Totais de Assinatura:', {
    hasRecurringData,
    hasFirstData,
    recurring_annual_revenue: totals.recurring_annual_revenue,
    recurring_annual_subscriptions: totals.recurring_annual_subscriptions,
    recurring_montly_revenue: totals.recurring_montly_revenue,
    recurring_montly_subscriptions: totals.recurring_montly_subscriptions,
    first_annual_revenue: totals.first_annual_revenue,
    first_annual_subscriptions: totals.first_annual_subscriptions,
    first_montly_revenue: totals.first_montly_revenue,
    first_montly_subscriptions: totals.first_montly_subscriptions,
    sampleCampaign: campaignSummaries[0] ? {
      recurring_annual_revenue: campaignSummaries[0].recurring_annual_revenue,
      first_annual_revenue: campaignSummaries[0].first_annual_revenue
    } : null
  })

  // Métricas calculadas
  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const avgCPC = totals.clicks > 0 ? totals.cost / totals.clicks : 0
  const avgCPV = totals.transactions > 0 ? totals.cost / totals.transactions : 0
  const avgCPA = totals.transactions_first > 0 ? totals.cost / totals.transactions_first : 0
  const avgCPL = totals.leads > 0 ? totals.cost / totals.leads : 0
  const avgCPM = totals.impressions > 0 ? (totals.cost / totals.impressions) * 1000 : 0
  const totalROAS = totals.cost > 0 ? totals.revenue / totals.cost : 0
  const totalROASFirst = totals.cost > 0 ? totals.revenue_first / totals.cost : 0
  const totalROASAvulsa = totals.cost > 0 ? (totals.revenue_avulsa || 0) / totals.cost : 0

  // Obter plataformas únicas (usar dados filtrados)
  const platforms = [...new Set(filteredData.map(item => item.platform))]

  // Preparar dados para gráficos de pizza (usar dados filtrados)
  const platformData = platforms.length > 0 ? platforms.map(platform => {
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
  }).filter((item: any) => item.cost > 0) : [] // Remove plataformas sem investimento

  // Cores discretas para os gráficos
  const COLORS = ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9']
  
  // Função para obter cor específica da plataforma
  const getPlatformColor = (platformName: string) => {
    const name = platformName.toLowerCase()
    if (name.includes('google') || (name.includes('ads') && !name.includes('meta'))) {
      return '#10b981' // Verde para Google Ads
    }
    if (name.includes('meta') || name.includes('facebook') || name.includes('instagram') || name === 'meta_ads') {
      return '#3b82f6' // Azul para Meta Ads
    }
    // Cores padrão para outras plataformas
    return COLORS[0]
  }

  // Dados para comparativo entre modelos de atribuição - usando dados brutos para comparação real
  const attributionComparison = campaignData.length > 0 ? {
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
  } : {
    last_non_direct: {
      transactions: 0,
      revenue: 0,
      transactions_first: 0,
      revenue_first: 0,
    },
    origin_stack: {
      transactions: 0,
      revenue: 0,
      transactions_first: 0,
      revenue_first: 0,
    }
  }

  // Comparativo por plataforma (Google vs Meta)
  const platformAttributionComparison = campaignData.length > 0 ? {
    google: {
      last_non_direct: campaignData
        .filter((item: any) => item.platform?.toLowerCase().includes('google') || 
                               (item.platform?.toLowerCase().includes('ads') && !item.platform?.toLowerCase().includes('meta')))
        .reduce((acc: any, item: any) => ({
          transactions: acc.transactions + item.transactions,
          revenue: acc.revenue + item.revenue,
          transactions_first: acc.transactions_first + item.transactions_first,
          revenue_first: acc.revenue_first + item.revenue_first,
          cost: acc.cost + item.cost,
        }), {
          transactions: 0,
          revenue: 0,
          transactions_first: 0,
          revenue_first: 0,
          cost: 0,
        }),
      origin_stack: campaignData
        .filter((item: any) => item.platform?.toLowerCase().includes('google') || 
                               (item.platform?.toLowerCase().includes('ads') && !item.platform?.toLowerCase().includes('meta')))
        .reduce((acc: any, item: any) => ({
          transactions: acc.transactions + item.transactions_origin_stack,
          revenue: acc.revenue + item.revenue_origin_stack,
          transactions_first: acc.transactions_first + item.transactions_first_origin_stack,
          revenue_first: acc.revenue_first + item.revenue_first_origin_stack,
          cost: acc.cost + item.cost,
        }), {
          transactions: 0,
          revenue: 0,
          transactions_first: 0,
          revenue_first: 0,
          cost: 0,
        })
    },
    meta: {
      last_non_direct: campaignData
        .filter((item: any) => item.platform?.toLowerCase().includes('meta') || 
                               item.platform?.toLowerCase().includes('facebook') || 
                               item.platform?.toLowerCase().includes('instagram'))
        .reduce((acc: any, item: any) => ({
          transactions: acc.transactions + item.transactions,
          revenue: acc.revenue + item.revenue,
          transactions_first: acc.transactions_first + item.transactions_first,
          revenue_first: acc.revenue_first + item.revenue_first,
          cost: acc.cost + item.cost,
        }), {
          transactions: 0,
          revenue: 0,
          transactions_first: 0,
          revenue_first: 0,
          cost: 0,
        }),
      origin_stack: campaignData
        .filter((item: any) => item.platform?.toLowerCase().includes('meta') || 
                               item.platform?.toLowerCase().includes('facebook') || 
                               item.platform?.toLowerCase().includes('instagram'))
        .reduce((acc: any, item: any) => ({
          transactions: acc.transactions + item.transactions_origin_stack,
          revenue: acc.revenue + item.revenue_origin_stack,
          transactions_first: acc.transactions_first + item.transactions_first_origin_stack,
          revenue_first: acc.revenue_first + item.revenue_first_origin_stack,
          cost: acc.cost + item.cost,
        }), {
          transactions: 0,
          revenue: 0,
          transactions_first: 0,
          revenue_first: 0,
          cost: 0,
        })
    }
  } : {
    google: {
      last_non_direct: { transactions: 0, revenue: 0, transactions_first: 0, revenue_first: 0, cost: 0 },
      origin_stack: { transactions: 0, revenue: 0, transactions_first: 0, revenue_first: 0, cost: 0 }
    },
    meta: {
      last_non_direct: { transactions: 0, revenue: 0, transactions_first: 0, revenue_first: 0, cost: 0 },
      origin_stack: { transactions: 0, revenue: 0, transactions_first: 0, revenue_first: 0, cost: 0 }
    }
  }

  // Calcular métricas para cada modelo
  const lastNonDirectMetrics = {
    cpv: attributionComparison.last_non_direct.transactions > 0 
      ? totals.cost / attributionComparison.last_non_direct.transactions : 0,
    roas: totals.cost > 0 
      ? attributionComparison.last_non_direct.revenue / totals.cost : 0,
    cpa: attributionComparison.last_non_direct.transactions_first > 0 
      ? totals.cost / attributionComparison.last_non_direct.transactions_first : 0,
    roasFirst: totals.cost > 0 
      ? attributionComparison.last_non_direct.revenue_first / totals.cost : 0,
  }

  const originStackMetrics = {
    cpv: attributionComparison.origin_stack.transactions > 0 
      ? totals.cost / attributionComparison.origin_stack.transactions : 0,
    roas: totals.cost > 0 
      ? attributionComparison.origin_stack.revenue / totals.cost : 0,
    cpa: attributionComparison.origin_stack.transactions_first > 0 
      ? totals.cost / attributionComparison.origin_stack.transactions_first : 0,
    roasFirst: totals.cost > 0 
      ? attributionComparison.origin_stack.revenue_first / totals.cost : 0,
  }

  // Métricas por plataforma
  const googleMetrics = {
    lastNonDirect: {
      cpv: platformAttributionComparison.google.last_non_direct.transactions > 0 
        ? platformAttributionComparison.google.last_non_direct.cost / platformAttributionComparison.google.last_non_direct.transactions : 0,
      roas: platformAttributionComparison.google.last_non_direct.cost > 0 
        ? platformAttributionComparison.google.last_non_direct.revenue / platformAttributionComparison.google.last_non_direct.cost : 0,
      cpa: platformAttributionComparison.google.last_non_direct.transactions_first > 0 
        ? platformAttributionComparison.google.last_non_direct.cost / platformAttributionComparison.google.last_non_direct.transactions_first : 0,
      roasFirst: platformAttributionComparison.google.last_non_direct.cost > 0 
        ? platformAttributionComparison.google.last_non_direct.revenue_first / platformAttributionComparison.google.last_non_direct.cost : 0,
    },
    originStack: {
      cpv: platformAttributionComparison.google.origin_stack.transactions > 0 
        ? platformAttributionComparison.google.origin_stack.cost / platformAttributionComparison.google.origin_stack.transactions : 0,
      roas: platformAttributionComparison.google.origin_stack.cost > 0 
        ? platformAttributionComparison.google.origin_stack.revenue / platformAttributionComparison.google.origin_stack.cost : 0,
      cpa: platformAttributionComparison.google.origin_stack.transactions_first > 0 
        ? platformAttributionComparison.google.origin_stack.cost / platformAttributionComparison.google.origin_stack.transactions_first : 0,
      roasFirst: platformAttributionComparison.google.origin_stack.cost > 0 
        ? platformAttributionComparison.google.origin_stack.revenue_first / platformAttributionComparison.google.origin_stack.cost : 0,
    }
  }

  const metaMetrics = {
    lastNonDirect: {
      cpv: platformAttributionComparison.meta.last_non_direct.transactions > 0 
        ? platformAttributionComparison.meta.last_non_direct.cost / platformAttributionComparison.meta.last_non_direct.transactions : 0,
      roas: platformAttributionComparison.meta.last_non_direct.cost > 0 
        ? platformAttributionComparison.meta.last_non_direct.revenue / platformAttributionComparison.meta.last_non_direct.cost : 0,
      cpa: platformAttributionComparison.meta.last_non_direct.transactions_first > 0 
        ? platformAttributionComparison.meta.last_non_direct.cost / platformAttributionComparison.meta.last_non_direct.transactions_first : 0,
      roasFirst: platformAttributionComparison.meta.last_non_direct.cost > 0 
        ? platformAttributionComparison.meta.last_non_direct.revenue_first / platformAttributionComparison.meta.last_non_direct.cost : 0,
    },
    originStack: {
      cpv: platformAttributionComparison.meta.origin_stack.transactions > 0 
        ? platformAttributionComparison.meta.origin_stack.cost / platformAttributionComparison.meta.origin_stack.transactions : 0,
      roas: platformAttributionComparison.meta.origin_stack.cost > 0 
        ? platformAttributionComparison.meta.origin_stack.revenue / platformAttributionComparison.meta.origin_stack.cost : 0,
      cpa: platformAttributionComparison.meta.origin_stack.transactions_first > 0 
        ? platformAttributionComparison.meta.origin_stack.cost / platformAttributionComparison.meta.origin_stack.transactions_first : 0,
      roasFirst: platformAttributionComparison.meta.origin_stack.cost > 0 
        ? platformAttributionComparison.meta.origin_stack.revenue_first / platformAttributionComparison.meta.origin_stack.cost : 0,
    }
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

  // Função para download XLSX
  const handleDownloadXLSX = () => {
    try {
      // Preparar dados para exportação
      const dataToExport = sortedData.map(campaign => ({
        'Plataforma': campaign.platform,
        'Campanha': campaign.campaign_name,
        'Investimento': campaign.cost,
        'Impressões': campaign.impressions,
        'Cliques': campaign.clicks,
        'CTR (%)': campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0.00',
        'CPC': campaign.clicks > 0 ? campaign.cost / campaign.clicks : 0,
        'Leads': campaign.leads,
        'Transações': campaign.transactions,
        'Transações 1ª Compra': campaign.transactions_first,
        '% Novos Clientes': campaign.transactions > 0 ? ((campaign.transactions_first / campaign.transactions) * 100).toFixed(1) : '0.0',
        'Receita': campaign.revenue - (campaign.recurring_montly_revenue || 0) - (campaign.recurring_annual_revenue || 0),
        'Receita 1ª Compra': campaign.revenue_first,
        'ROAS': campaign.cost > 0 ? ((campaign.revenue - (campaign.recurring_montly_revenue || 0) - (campaign.recurring_annual_revenue || 0)) / campaign.cost).toFixed(2) : '0.00',
        'ROAS 1ª Compra': campaign.cost > 0 ? (campaign.revenue_first / campaign.cost).toFixed(2) : '0.00',
        'CPV': campaign.transactions > 0 ? campaign.cost / campaign.transactions : 0,
        'CPA': campaign.transactions_first > 0 ? campaign.cost / campaign.transactions_first : 0
      }))

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dataToExport)

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 15 }, // Plataforma
        { wch: 40 }, // Campanha
        { wch: 15 }, // Investimento
        { wch: 15 }, // Impressões
        { wch: 12 }, // Cliques
        { wch: 10 }, // CTR
        { wch: 12 }, // CPC
        { wch: 10 }, // Leads
        { wch: 12 }, // Transações
        { wch: 18 }, // Transações 1ª
        { wch: 15 }, // % Novos
        { wch: 15 }, // Receita
        { wch: 18 }, // Receita 1ª
        { wch: 10 }, // ROAS
        { wch: 15 }, // ROAS 1ª
        { wch: 12 }, // CPV
        { wch: 12 }  // CPA
      ]
      ws['!cols'] = colWidths

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Campanhas')

      // Gerar nome do arquivo com data
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const filename = `paid-media-${selectedTable}-${dateStr}.xlsx`

      // Download do arquivo
      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error('Erro ao gerar XLSX:', error)
      alert('Erro ao gerar arquivo Excel. Por favor, tente novamente.')
    }
  }

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Métricas calculadas para criativos
  const creativeAvgCTR = creativeTotals.impressions > 0 ? (creativeTotals.clicks / creativeTotals.impressions) * 100 : 0
  const creativeAvgCPC = creativeTotals.clicks > 0 ? creativeTotals.cost / creativeTotals.clicks : 0
  const creativeAvgCPV = creativeTotals.transactions > 0 ? creativeTotals.cost / creativeTotals.transactions : 0
  const creativeAvgCPL = creativeTotals.leads > 0 ? creativeTotals.cost / creativeTotals.leads : 0

  // Formatar número
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Processar dados para timeline de mídia paga (usar dados filtrados - apenas campanhas)
  const timelineData = filteredData.length > 0 ? filteredData.reduce((acc, item) => {
    const isoDate = convertBrazilianDateToISO(item.date)
    const existingDate = acc.find(d => d.date === isoDate)
    if (existingDate) {
      existingDate.cost += item.cost
      existingDate.impressions += item.impressions
      existingDate.clicks += item.clicks
      existingDate.leads += item.leads
      
      // Aplicar modelo de atribuição na timeline
      if (attributionModel === 'origin_stack') {
        existingDate.transactions += item.transactions_origin_stack
        existingDate.revenue += item.revenue_origin_stack
        existingDate.transactions_first += item.transactions_first_origin_stack
        existingDate.revenue_first += item.revenue_first_origin_stack
      } else {
        existingDate.transactions += item.transactions
        existingDate.revenue += item.revenue
        existingDate.transactions_first += item.transactions_first
        existingDate.revenue_first += item.revenue_first
      }
    } else {
      // Aplicar modelo de atribuição na timeline
      const timelineItem = {
        date: convertBrazilianDateToISO(item.date),
        cost: item.cost,
        impressions: item.impressions,
        clicks: item.clicks,
        leads: item.leads,
        transactions: attributionModel === 'origin_stack' ? item.transactions_origin_stack : item.transactions,
        revenue: attributionModel === 'origin_stack' ? item.revenue_origin_stack : item.revenue,
        transactions_first: attributionModel === 'origin_stack' ? item.transactions_first_origin_stack : item.transactions_first,
        revenue_first: attributionModel === 'origin_stack' ? item.revenue_first_origin_stack : item.revenue_first,
        ctr: 0,
        cpc: 0,
        cpv: 0,
        cpa: 0,
        roas: 0,
        roas_first: 0
      }
      acc.push(timelineItem)
    }
    return acc
  }, [] as {
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
  }[]).map(item => ({
    ...item,
    ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
    cpc: item.clicks > 0 ? item.cost / item.clicks : 0,
    cpv: item.transactions > 0 ? item.cost / item.transactions : 0,
    cpa: item.transactions_first > 0 ? item.cost / item.transactions_first : 0,
    roas: item.cost > 0 ? item.revenue / item.cost : 0,
    roas_first: item.cost > 0 ? item.revenue_first / item.cost : 0
  })).sort((a, b) => compareDateStrings(a.date, b.date)) : []

  // Processar dados para timeline de criativos (usar dados de criativos)
  const creativeTimelineData = creativeData.length > 0 ? creativeData.reduce((acc, item) => {
    const isoDate = convertBrazilianDateToISO(item.date)
    const existingDate = acc.find(d => d.date === isoDate)
    if (existingDate) {
      existingDate.cost += item.cost
      existingDate.impressions += item.impressions
      existingDate.clicks += item.clicks
      existingDate.leads += item.leads
      existingDate.transactions += item.transactions
      existingDate.revenue += item.revenue
      existingDate.transactions_first += item.transactions_first
      existingDate.revenue_first += item.revenue_first
    } else {
      acc.push({
        date: isoDate,
        cost: item.cost,
        impressions: item.impressions,
        clicks: item.clicks,
        leads: item.leads,
        transactions: item.transactions,
        revenue: item.revenue,
        transactions_first: item.transactions_first,
        revenue_first: item.revenue_first,
        ctr: 0,
        cpc: 0,
        cpv: 0,
        cpa: 0,
        roas: 0,
        roas_first: 0
      })
    }
    return acc
  }, [] as {
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
  }[]).map(item => ({
    ...item,
    ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
    cpc: item.clicks > 0 ? item.cost / item.clicks : 0,
    cpv: item.transactions > 0 ? item.cost / item.transactions : 0,
    cpa: item.transactions_first > 0 ? item.cost / item.transactions_first : 0,
    roas: item.cost > 0 ? item.revenue / item.cost : 0,
    roas_first: item.cost > 0 ? item.revenue_first / item.cost : 0
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : []

  // Debug: Comparar receitas da timeline vs totais
  const timelineRevenueTotal = timelineData.reduce((acc, item) => acc + item.revenue, 0)
  const timelineRevenueFirstTotal = timelineData.reduce((acc, item) => acc + item.revenue_first, 0)
  
  console.log('🔍 Debug Timeline vs Totais:', {
    timelineDataLength: timelineData.length,
    timelineRevenueTotal,
    timelineRevenueFirstTotal,
    dashboardRevenueTotal: totals.revenue,
    dashboardRevenueFirstTotal: totals.revenue_first,
    filteredDataLength: filteredData.length,
    campaignSummariesLength: campaignSummaries.length,
    difference: Math.abs(timelineRevenueTotal - totals.revenue),
    differenceFirst: Math.abs(timelineRevenueFirstTotal - totals.revenue_first)
  })



  if (isLoading && !jobId && !isPolling) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Aguarde, seus dados serão carregados</p>
        </div>
      </div>
    )
  }

  if (campaignData.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado de mídia paga encontrado</h3>
        <p className="text-gray-600 mb-4">
          Não foram encontrados dados de campanhas para a tabela selecionada no período.
        </p>
        {retryCountdown !== null && (
          <div className="mt-4">
            <div className="text-sm text-gray-700 mb-2">Tentando novamente em {retryCountdown}s</div>
            <div className="w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-blue-600 transition-all"
                style={{ width: `${((10 - (retryCountdown || 0)) / 10) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (filteredData.length === 0 && campaignData.length > 0) {
  return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum resultado encontrado</h3>
        <p className="text-gray-600 mb-4">
          Nenhuma campanha corresponde aos filtros aplicados.
          {selectedCampaign && (
            <span className="block mt-2 text-sm text-blue-600">
              Filtro ativo: <strong>{selectedCampaign}</strong>
            </span>
          )}
        </p>
        <button
          onClick={() => {
            setSelectedCampaign(null)
            setSelectedPlatform('')
            setSearchTerm('')
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Limpar Filtros
        </button>
      </div>
    )
  }

  return (
    <div className={`${isFullWidth ? 'fixed inset-0 z-50 bg-white overflow-auto' : 'space-y-6'}`}>
      {/* Status do Polling - Sempre visível quando houver polling ou status ativo */}
      {(isLoading || isPolling || jobStatus === 'completed' || jobStatus === 'processing' || jobStatus === 'error' || jobId) && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4">
            {jobStatus === 'processing' || isPolling ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {jobProgress || 'Processando dados de campanhas...'}
                  </p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {jobId && (
                      <p className="text-xs text-gray-500">
                        Job ID: <span className="font-mono font-medium">{jobId}</span>
                      </p>
                    )}
                    {elapsedSeconds !== null && (
                      <p className="text-xs text-gray-500">
                        Tempo decorrido: <span className="font-medium">{Math.round(elapsedSeconds)}s</span>
                      </p>
                    )}
                    {isPolling && (
                      <p className="text-xs text-blue-600 font-medium">
                        🔄 Verificando status...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : jobStatus === 'completed' ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {jobProgress || 'Dados carregados com sucesso!'}
                  </p>
                  {elapsedSeconds !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                      Processamento concluído em {Math.round(elapsedSeconds)}s
                    </p>
                  )}
                </div>
              </div>
            ) : jobStatus === 'error' ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 text-red-600 flex-shrink-0">⚠️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900">
                    Erro ao processar dados
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {jobProgress || 'Tente atualizar os dados novamente'}
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {jobProgress || 'Carregando dados...'}
                  </p>
                  {jobId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Job ID: <span className="font-mono font-medium">{jobId}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Informações do Cache e Botão Atualizar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-800">
              {isRefreshing 
                ? 'Atualizando em background...'
                : useCache 
                  ? (usedFallback ? 'Dados Atualizados (sem cache)' : 'Dados do Cache')
                  : 'Dados Atualizados'
              }
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
          <div className="flex items-center gap-2">
          {(!cacheInfo || isCacheOld() || isRefreshing) && (
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
            
            {/* Indicador de carregamento em background */}
            {isBackgroundLoading && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-md border border-orange-200">
                <div className="w-3 h-3 border border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                Atualizando em background...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seletor de Modelo de Atribuição */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Modelo de Atribuição</h3>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-500" />
              <select
                value={attributionModel}
                onChange={(e) => setAttributionModel(e.target.value as 'origin_stack' | 'last_non_direct')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
              >
                <option value="origin_stack">Origin Stack (Padrão)</option>
                <option value="last_non_direct">Last Non-Direct (Alternativo)</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">
              {attributionModel === 'origin_stack' ? 'Origin Stack' : 'Last Non-Direct Session'}
            </span>
            <span className="ml-2 text-gray-400">
              • {attributionModel === 'origin_stack' 
                ? 'Atribui conversões ao primeiro toque da jornada' 
                : 'Atribui conversões ao último toque não direto'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Sistema de Abas */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Visão Geral</span>
            </button>
            <button
              onClick={() => setActiveTab('creatives')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'creatives'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Criativos</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Filtro de Plataforma */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtrar por Plataforma</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPlatform('')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedPlatform === '' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setSelectedPlatform('google_ads')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  selectedPlatform === 'google_ads' 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                }`}
              >
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Google Ads
              </button>
              <button
                onClick={() => setSelectedPlatform('meta_ads')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  selectedPlatform === 'meta_ads' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Meta Ads
              </button>
            </div>
          </div>
          
          {/* Indicador de Filtro Ativo */}
          {selectedPlatform && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Filtro ativo:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                selectedPlatform === 'google_ads' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedPlatform === 'google_ads' ? 'Google Ads' : 'Meta Ads'}
              </span>
              <button
                onClick={() => setSelectedPlatform('')}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Limpar filtro"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
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
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPV: {formatCurrency(avgCPV)}</span>
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
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPA 1ª: {formatCurrency(avgCPA)}</span>
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

          {/* Receita Compras s/ Recorrência */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Receita Compras s/ Recorrência</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.revenue_avulsa || 0)}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              totalROASAvulsa >= 3 ? 'bg-green-100 text-green-700' : 
              totalROASAvulsa >= 2 ? 'bg-yellow-100 text-yellow-700' : 
              'bg-red-100 text-red-700'
            }`}>
              ROAS s/ Recorrência: {totalROASAvulsa.toFixed(2)}x
            </span>
          </div>

          {/* Métricas de Assinatura - Apenas se houver dados */}
          {hasRecurringData && (
            <>
              {/* Receita Recorrente Anual */}
              {((totals.recurring_annual_revenue || 0) > 0 || (totals.recurring_annual_subscriptions || 0) > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Receita Rec. Anual</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.recurring_annual_revenue || 0)}</p>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    Assinaturas: {formatNumber(Math.round(totals.recurring_annual_subscriptions || 0))}
                  </span>
                </div>
              )}

              {/* Receita Recorrente Mensal */}
              {((totals.recurring_montly_revenue || 0) > 0 || (totals.recurring_montly_subscriptions || 0) > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Receita Rec. Mensal</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.recurring_montly_revenue || 0)}</p>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    Assinaturas: {formatNumber(Math.round(totals.recurring_montly_subscriptions || 0))}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Métricas de Primeiras Assinaturas - Apenas se houver dados */}
          {hasFirstData && (
            <>
              {/* Receita Primeira Anual */}
              {((totals.first_annual_revenue || 0) > 0 || (totals.first_annual_subscriptions || 0) > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Receita 1ª Anual</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.first_annual_revenue || 0)}</p>
                    </div>
                    <div className="p-2 bg-cyan-50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-cyan-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    Assinaturas: {formatNumber(Math.round(totals.first_annual_subscriptions || 0))}
                  </span>
                </div>
              )}

              {/* Receita Primeira Mensal */}
              {((totals.first_montly_revenue || 0) > 0 || (totals.first_montly_subscriptions || 0) > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Receita 1ª Mensal</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.first_montly_revenue || 0)}</p>
                    </div>
                    <div className="p-2 bg-pink-50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-pink-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    Assinaturas: {formatNumber(Math.round(totals.first_montly_subscriptions || 0))}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>


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
                    {platformData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={getPlatformColor(item.name)} />
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
                      style={{ backgroundColor: getPlatformColor(item.name) }}
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
                    {platformData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={getPlatformColor(item.name)} />
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
                      style={{ backgroundColor: getPlatformColor(item.name) }}
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
                    {platformData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={getPlatformColor(item.name)} />
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
                      style={{ backgroundColor: getPlatformColor(item.name) }}
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
                    {platformData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={getPlatformColor(item.name)} />
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
                      style={{ backgroundColor: getPlatformColor(item.name) }}
                    />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline de Mídia Paga */}
      {activeTab === 'overview' && timelineData.length > 0 && (
        <PaidMediaTimeline
          data={timelineData}
          title="📈 Timeline de Performance - Mídia Paga"
        />
      )}
      
      {/* Timeline de Criativos */}
      {(activeTab as string) === 'creatives' && creativeTimelineData && creativeTimelineData.length > 0 && (
        <PaidMediaTimeline
          data={creativeTimelineData}
          title="📈 Timeline de Performance - Criativos"
        />
      )}

      {/* Comparativo de Modelos de Atribuição */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-6 p-6 rounded-lg transition-colors"
          onClick={() => setIsComparisonExpanded(!isComparisonExpanded)}
        >
          <h3 className="text-lg font-semibold text-gray-900">⚖️ Comparativo: Modelos de Atribuição</h3>
          <div className="flex items-center gap-4">
            {/* Toggle para comparativo por plataforma */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <label className="text-sm text-gray-600">Por plataforma:</label>
              <button
                onClick={() => setShowPlatformComparison(!showPlatformComparison)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showPlatformComparison ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showPlatformComparison ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
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
        </div>
        
        {/* Explicação dos Modelos - Ocultável */}
        {isComparisonExpanded && (
          <div className="mb-6">
            <button
              onClick={() => setIsExplanationExpanded(!isExplanationExpanded)}
              className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 hover:from-blue-100 hover:to-purple-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">
                  {isExplanationExpanded ? 'Ocultar' : 'Ver'} Explicação dos Modelos de Atribuição
                </span>
              </div>
              <svg 
                className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${isExplanationExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isExplanationExpanded && (
              <div className="mt-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Last Non-Direct Session */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-gray-600 text-white rounded-full flex items-center justify-center text-sm font-bold">L</span>
                      <h4 className="text-lg font-semibold text-gray-800">Last Non-Direct Session (LNDS)</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Atribui 100% do crédito da conversão à última sessão não-direta antes da compra. 
                        Este modelo é ideal para entender qual foi o último canal que influenciou a decisão de compra.
                      </p>
                      
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <h5 className="text-xs font-semibold text-gray-700 mb-2">Como funciona:</h5>
                        <ul className="text-xs text-gray-600 space-y-1">
                          <li>• Identifica a última sessão antes da conversão</li>
                          <li>• Ignora sessões diretas (digitação de URL)</li>
                          <li>• Atribui todo o crédito a essa sessão</li>
                        </ul>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        <strong>Melhor para:</strong> Entender o último toque antes da conversão
                      </div>
                    </div>
                  </div>
                  
                  {/* Origin Stack */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">O</span>
                      <h4 className="text-lg font-semibold text-gray-800">Origin Stack</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Sistema de atribuição baseado em prioridades que segue uma ordem específica na jornada do usuário. 
                        O crédito é atribuído ao primeiro evento que ocorrer na sequência.
                      </p>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <h5 className="text-xs font-semibold text-blue-700 mb-2">Ordem de Prioridade:</h5>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            <span className="text-xs text-gray-700">Captura de Lead</span>
              </div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            <span className="text-xs text-gray-700">First Session de Mídia Paga</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            <span className="text-xs text-gray-700">Last Session de Mídia Paga</span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-blue-600 font-medium">
                          ⚡ O que vier primeiro na jornada recebe o crédito
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <h5 className="text-xs font-semibold text-yellow-700 mb-2">Exemplos Práticos:</h5>
                        <div className="space-y-2">
              <div>
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Cenário 1:</strong> Meta Ads (lead) → Google Ads → Conversão
                </p>
                            <p className="text-xs text-gray-600">
                              <strong>Resultado:</strong> Crédito vai para Meta Ads (gerou o lead)
                </p>
              </div>
              <div>
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Cenário 2:</strong> Google Ads → Meta Ads (lead) → Conversão
                            </p>
                            <p className="text-xs text-gray-600">
                              <strong>Resultado:</strong> Crédito vai para Meta Ads (gerou o lead)
                </p>
              </div>
              <div>
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Cenário 3:</strong> Google Ads → Facebook Ads → Conversão (sem lead)
                            </p>
                            <p className="text-xs text-gray-600">
                              <strong>Resultado:</strong> Crédito vai para Google Ads (1ª sessão de mídia paga)
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        <strong>Melhor para:</strong> Entender o ponto de origem na jornada de conversão
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Hint para Melhorar Origin Stack */}
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                      💡
                    </div>
                    <div className="flex-1">
                      <h5 className="text-sm font-semibold text-green-800 mb-2">Dica para Melhorar o Origin Stack</h5>
                      <p className="text-xs text-green-700 mb-3">
                        Para maximizar a eficácia do modelo Origin Stack, invista em estratégias de captura de leads:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-green-400 text-white rounded-full flex items-center justify-center text-xs">1</span>
                            <span className="text-xs text-green-700 font-medium">Popups com Cupons de Desconto</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-green-400 text-white rounded-full flex items-center justify-center text-xs">2</span>
                            <span className="text-xs text-green-700 font-medium">Formulários de Newsletter</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-green-400 text-white rounded-full flex items-center justify-center text-xs">3</span>
                            <span className="text-xs text-green-700 font-medium">Quiz Interativos</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-green-400 text-white rounded-full flex items-center justify-center text-xs">4</span>
                            <span className="text-xs text-green-700 font-medium">E-books e Materiais Gratuitos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-green-400 text-white rounded-full flex items-center justify-center text-xs">5</span>
                            <span className="text-xs text-green-700 font-medium">Webinars e Lives</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-green-400 text-white rounded-full flex items-center justify-center text-xs">6</span>
                            <span className="text-xs text-green-700 font-medium">Testes e Avaliações</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-800">
                        <strong>💡 Resultado:</strong> Mais leads capturados = mais crédito atribuído ao Origin Stack = melhor performance nas métricas
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Prévia Minimizada - Design Compacto */}
        {!isComparisonExpanded && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="text-center mb-4">
              <h5 className="text-sm font-semibold text-gray-700 mb-1 flex items-center justify-center gap-2">
                <span className="text-lg">📊</span>
                Comparativo de Modelos de Atribuição
              </h5>
              <p className="text-xs text-gray-600">Origin Stack vs Last Non-Direct Session</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Ganho Transações - Compacto */}
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-600 mb-1">Transações</p>
                <p className={`text-lg font-bold ${
                  attributionComparison.origin_stack.transactions > attributionComparison.last_non_direct.transactions 
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(() => {
                    const lnds = attributionComparison.last_non_direct.transactions
                    const origin = attributionComparison.origin_stack.transactions
                    const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                    return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                  })()}
                </p>
              </div>
              
              {/* Ganho Receita - Compacto */}
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-600 mb-1">Receita</p>
                <p className={`text-lg font-bold ${
                  attributionComparison.origin_stack.revenue > attributionComparison.last_non_direct.revenue 
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(() => {
                    const lnds = attributionComparison.last_non_direct.revenue
                    const origin = attributionComparison.origin_stack.revenue
                    const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                    return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                  })()}
                </p>
              </div>
              
              {/* Melhoria CPV - Compacto */}
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-600 mb-1">CPV</p>
                <p className={`text-lg font-bold ${
                  originStackMetrics.cpv < lastNonDirectMetrics.cpv ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(() => {
                    const lnds = lastNonDirectMetrics.cpv
                    const origin = originStackMetrics.cpv
                    const gain = lnds > 0 ? ((lnds - origin) / lnds * 100) : 0
                    return gain > 0 ? `-${gain.toFixed(1)}%` : `+${Math.abs(gain).toFixed(1)}%`
                  })()}
                </p>
              </div>
              
              {/* Melhoria ROAS - Compacto */}
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-600 mb-1">ROAS</p>
                <p className={`text-lg font-bold ${
                  originStackMetrics.roas > lastNonDirectMetrics.roas ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(() => {
                    const lnds = lastNonDirectMetrics.roas
                    const origin = originStackMetrics.roas
                      const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                      return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                    })()}
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
                <p className="text-xs text-green-600">CPV: {formatCurrency(lastNonDirectMetrics.cpv)}</p>
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
                <p className="text-xs text-blue-600">CPA: {formatCurrency(lastNonDirectMetrics.cpa)}</p>
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
                <p className="text-xs text-green-600">CPV: {formatCurrency(originStackMetrics.cpv)}</p>
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
                <p className="text-xs text-blue-600">CPA: {formatCurrency(originStackMetrics.cpa)}</p>
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

        {/* Resumo das Diferenças - Design Embelezado */}
        <div className="mt-6 p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-md">
          <div className="text-center mb-4">
            <h5 className="text-lg font-bold text-gray-800 mb-1 flex items-center justify-center gap-2">
              <span className="text-xl">📈</span>
              Análise Comparativa
            </h5>
            <p className="text-xs text-gray-600">Percentual de ganho do Origin Stack sobre o modelo padrão</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Ganho Transações */}
            <div className="group bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-green-300">
            <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h6 className="text-xs font-semibold text-gray-700 mb-2">Ganho Transações</h6>
                <p className={`text-2xl font-bold mb-2 ${
                attributionComparison.origin_stack.transactions > attributionComparison.last_non_direct.transactions 
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                  {(() => {
                    const lnds = attributionComparison.last_non_direct.transactions
                    const origin = attributionComparison.origin_stack.transactions
                    const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                    return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                  })()}
                </p>
                <p className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {formatNumber(attributionComparison.origin_stack.transactions - attributionComparison.last_non_direct.transactions)} transações
                </p>
              </div>
            </div>
            
            {/* Ganho Receita */}
            <div className="group bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300">
            <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h6 className="text-xs font-semibold text-gray-700 mb-2">Ganho Receita</h6>
                <p className={`text-2xl font-bold mb-2 ${
                attributionComparison.origin_stack.revenue > attributionComparison.last_non_direct.revenue 
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                  {(() => {
                    const lnds = attributionComparison.last_non_direct.revenue
                    const origin = attributionComparison.origin_stack.revenue
                    const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                    return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                  })()}
                </p>
                <p className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {formatCurrency(attributionComparison.origin_stack.revenue - attributionComparison.last_non_direct.revenue)}
              </p>
              </div>
            </div>
            
            {/* Melhoria CPV */}
            <div className="group bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-blue-300">
            <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h6 className="text-xs font-semibold text-gray-700 mb-2">Melhoria CPV</h6>
                <p className={`text-2xl font-bold mb-2 ${
                  originStackMetrics.cpv < lastNonDirectMetrics.cpv ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(() => {
                    const lnds = lastNonDirectMetrics.cpv
                    const origin = originStackMetrics.cpv
                    const gain = lnds > 0 ? ((lnds - origin) / lnds * 100) : 0
                    return gain > 0 ? `-${gain.toFixed(1)}%` : `+${Math.abs(gain).toFixed(1)}%`
                  })()}
                </p>
                <p className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {originStackMetrics.cpv < lastNonDirectMetrics.cpv ? 'Origin Stack' : 'Last Non-Direct'}
                </p>
              </div>
            </div>
            
            {/* Melhoria ROAS */}
            <div className="group bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-purple-300">
            <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h6 className="text-xs font-semibold text-gray-700 mb-2">Melhoria ROAS</h6>
                <p className={`text-2xl font-bold mb-2 ${
                  originStackMetrics.roas > lastNonDirectMetrics.roas ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(() => {
                    const lnds = lastNonDirectMetrics.roas
                    const origin = originStackMetrics.roas
                    const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                    return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                  })()}
                </p>
                <p className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {originStackMetrics.roas > lastNonDirectMetrics.roas ? 'Origin Stack' : 'Last Non-Direct'}
              </p>
              </div>
            </div>
          </div>
        </div>
          </div>
        )}

        {/* Comparativo por Plataforma */}
        {isComparisonExpanded && showPlatformComparison && (
          <div className="mt-8">
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-xl">🏢</span>
                Comparativo por Plataforma: Google vs Meta
              </h4>
              <p className="text-sm text-gray-600">
                Análise detalhada dos modelos de atribuição separados por plataforma
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Google Ads */}
              <div className="border border-green-200 rounded-lg p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="flex items-center justify-between mb-6">
                  <h5 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Google Ads
                  </h5>
                  <div className="text-sm text-gray-600">
                    Investimento: {formatCurrency(platformAttributionComparison.google.last_non_direct.cost)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Last Non-Direct para Google */}
                  <div className="bg-white/80 rounded-lg p-4 border border-green-200">
                    <h6 className="text-sm font-semibold text-gray-700 mb-3">Last Non-Direct</h6>
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Transações</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatNumber(platformAttributionComparison.google.last_non_direct.transactions)}
                        </p>
                        <p className="text-xs text-green-600">
                          CPV: {formatCurrency(googleMetrics.lastNonDirect.cpv)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Receita</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(platformAttributionComparison.google.last_non_direct.revenue)}
                        </p>
                        <p className={`text-xs ${
                          googleMetrics.lastNonDirect.roas >= 3 ? 'text-green-600' : 
                          googleMetrics.lastNonDirect.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          ROAS: {googleMetrics.lastNonDirect.roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Origin Stack para Google */}
                  <div className="bg-white/80 rounded-lg p-4 border border-green-200">
                    <h6 className="text-sm font-semibold text-gray-700 mb-3">Origin Stack</h6>
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Transações</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatNumber(platformAttributionComparison.google.origin_stack.transactions)}
                        </p>
                        <p className="text-xs text-green-600">
                          CPV: {formatCurrency(googleMetrics.originStack.cpv)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Receita</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(platformAttributionComparison.google.origin_stack.revenue)}
                        </p>
                        <p className={`text-xs ${
                          googleMetrics.originStack.roas >= 3 ? 'text-green-600' : 
                          googleMetrics.originStack.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          ROAS: {googleMetrics.originStack.roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ganho Google */}
                <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                  <h6 className="text-sm font-semibold text-gray-700 mb-3 text-center">Ganho Origin Stack vs Last Non-Direct</h6>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Transações</p>
                      <p className={`text-lg font-bold ${
                        platformAttributionComparison.google.origin_stack.transactions > platformAttributionComparison.google.last_non_direct.transactions 
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(() => {
                          const lnds = platformAttributionComparison.google.last_non_direct.transactions
                          const origin = platformAttributionComparison.google.origin_stack.transactions
                          const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                          return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                        })()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Receita</p>
                      <p className={`text-lg font-bold ${
                        platformAttributionComparison.google.origin_stack.revenue > platformAttributionComparison.google.last_non_direct.revenue 
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(() => {
                          const lnds = platformAttributionComparison.google.last_non_direct.revenue
                          const origin = platformAttributionComparison.google.origin_stack.revenue
                          const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                          return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta Ads */}
              <div className="border border-blue-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between mb-6">
                  <h5 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    Meta Ads
                  </h5>
                  <div className="text-sm text-gray-600">
                    Investimento: {formatCurrency(platformAttributionComparison.meta.last_non_direct.cost)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Last Non-Direct para Meta */}
                  <div className="bg-white/80 rounded-lg p-4 border border-blue-200">
                    <h6 className="text-sm font-semibold text-gray-700 mb-3">Last Non-Direct</h6>
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Transações</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatNumber(platformAttributionComparison.meta.last_non_direct.transactions)}
                        </p>
                        <p className="text-xs text-blue-600">
                          CPV: {formatCurrency(metaMetrics.lastNonDirect.cpv)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Receita</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(platformAttributionComparison.meta.last_non_direct.revenue)}
                        </p>
                        <p className={`text-xs ${
                          metaMetrics.lastNonDirect.roas >= 3 ? 'text-green-600' : 
                          metaMetrics.lastNonDirect.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          ROAS: {metaMetrics.lastNonDirect.roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Origin Stack para Meta */}
                  <div className="bg-white/80 rounded-lg p-4 border border-blue-200">
                    <h6 className="text-sm font-semibold text-gray-700 mb-3">Origin Stack</h6>
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Transações</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatNumber(platformAttributionComparison.meta.origin_stack.transactions)}
                        </p>
                        <p className="text-xs text-blue-600">
                          CPV: {formatCurrency(metaMetrics.originStack.cpv)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Receita</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(platformAttributionComparison.meta.origin_stack.revenue)}
                        </p>
                        <p className={`text-xs ${
                          metaMetrics.originStack.roas >= 3 ? 'text-green-600' : 
                          metaMetrics.originStack.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          ROAS: {metaMetrics.originStack.roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ganho Meta */}
                <div className="bg-white/60 rounded-lg p-4 border border-blue-200">
                  <h6 className="text-sm font-semibold text-gray-700 mb-3 text-center">Ganho Origin Stack vs Last Non-Direct</h6>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Transações</p>
                      <p className={`text-lg font-bold ${
                        platformAttributionComparison.meta.origin_stack.transactions > platformAttributionComparison.meta.last_non_direct.transactions 
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(() => {
                          const lnds = platformAttributionComparison.meta.last_non_direct.transactions
                          const origin = platformAttributionComparison.meta.origin_stack.transactions
                          const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                          return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                        })()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Receita</p>
                      <p className={`text-lg font-bold ${
                        platformAttributionComparison.meta.origin_stack.revenue > platformAttributionComparison.meta.last_non_direct.revenue 
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(() => {
                          const lnds = platformAttributionComparison.meta.last_non_direct.revenue
                          const origin = platformAttributionComparison.meta.origin_stack.revenue
                          const gain = lnds > 0 ? ((origin - lnds) / lnds * 100) : 0
                          return gain > 0 ? `+${gain.toFixed(1)}%` : `${gain.toFixed(1)}%`
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo Comparativo entre Plataformas */}
            <div className="mt-6 p-6 bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 rounded-xl border border-gray-200 shadow-md">
              <h5 className="text-lg font-bold text-gray-800 mb-4 text-center flex items-center justify-center gap-2">
                <span className="text-xl">📊</span>
                Resumo Comparativo: Google vs Meta
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Investimento Total */}
                <div className="bg-white/80 rounded-lg p-4 border border-gray-200 text-center">
                  <h6 className="text-sm font-semibold text-gray-700 mb-2">Investimento Total</h6>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Google
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(platformAttributionComparison.google.last_non_direct.cost)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Meta
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(platformAttributionComparison.meta.last_non_direct.cost)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transações Origin Stack */}
                <div className="bg-white/80 rounded-lg p-4 border border-gray-200 text-center">
                  <h6 className="text-sm font-semibold text-gray-700 mb-2">Transações (Origin Stack)</h6>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Google
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatNumber(platformAttributionComparison.google.origin_stack.transactions)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Meta
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatNumber(platformAttributionComparison.meta.origin_stack.transactions)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Receita Origin Stack */}
                <div className="bg-white/80 rounded-lg p-4 border border-gray-200 text-center">
                  <h6 className="text-sm font-semibold text-gray-700 mb-2">Receita (Origin Stack)</h6>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Google
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(platformAttributionComparison.google.origin_stack.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Meta
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(platformAttributionComparison.meta.origin_stack.revenue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ROAS Origin Stack */}
                <div className="bg-white/80 rounded-lg p-4 border border-gray-200 text-center">
                  <h6 className="text-sm font-semibold text-gray-700 mb-2">ROAS (Origin Stack)</h6>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Google
                      </span>
                      <span className={`text-sm font-bold ${
                        googleMetrics.originStack.roas >= 3 ? 'text-green-600' : 
                        googleMetrics.originStack.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {googleMetrics.originStack.roas.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Meta
                      </span>
                      <span className={`text-sm font-bold ${
                        metaMetrics.originStack.roas >= 3 ? 'text-green-600' : 
                        metaMetrics.originStack.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {metaMetrics.originStack.roas.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de campanhas */}
      <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${isFullWidth ? 'fixed inset-0 z-50 m-0 rounded-none' : ''}`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col gap-4">
            {/* Header com título e botão */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            
              {/* Botões de controle */}
              <div className="flex gap-2">
                {/* Botão Dropdown de Métricas */}
                <div className="relative">
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                      showColumnSelector 
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span>Métricas</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      showColumnSelector 
                        ? 'bg-white/20 text-white' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {Object.values(visibleColumns).filter(Boolean).length}
                    </span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${showColumnSelector ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Botão Download XLSX */}
                <button
                  onClick={handleDownloadXLSX}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 shadow-sm"
                  title="Baixar dados em Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>XLSX</span>
                </button>

                {/* Botão Full Width */}
                <button
                  onClick={() => setIsFullWidth(!isFullWidth)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    isFullWidth 
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                >
                  {isFullWidth ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5" />
                      </svg>
                      <span>Tela Normal</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      <span>Tela Cheia</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filtros em linha separada */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Filtro de Campanha Ativa */}
              {selectedCampaign && (
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-700">Filtrado por:</span>
                  <span className="text-sm text-blue-800 font-semibold truncate max-w-[200px]">{selectedCampaign}</span>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="text-blue-600 hover:text-blue-800 transition-colors flex-shrink-0"
                    title="Limpar filtro de campanha"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Filtro por plataforma */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[140px]"
                >
                  <option value="">Todas as plataformas</option>
                  {platforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </div>

              {/* Busca */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar campanha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dropdown de Métricas - Overlay Elegante */}
        {showColumnSelector && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => {
                setShowColumnSelector(false)
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
                        <p className="text-blue-100 text-sm">Escolha quais colunas exibir na tabela</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowColumnSelector(false)
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
                      value={metricSearchTerm}
                      onChange={(e) => setMetricSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {metricSearchTerm && (
                      <button
                        onClick={() => setMetricSearchTerm('')}
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
                    {metricSearchTerm && (() => {
                      const allMetrics = [
                        { key: 'platform', label: 'Plataforma', icon: '🏢' },
                        { key: 'campaign_name', label: 'Campanha', icon: '📢' },
                        { key: 'cost', label: 'Investimento', icon: '💰' },
                        { key: 'impressions', label: 'Impressões', icon: '👁️' },
                        { key: 'clicks', label: 'Cliques', icon: '👆' },
                        { key: 'ctr', label: 'CTR', icon: '📊' },
                        { key: 'cpc', label: 'CPC', icon: '💸' },
                        { key: 'leads', label: 'Leads', icon: '🎯' },
                        { key: 'transactions', label: 'Transações', icon: '🛒' },
                        { key: 'transactions_first', label: 'Trans. 1ª Compra', icon: '🆕' },
                        { key: 'transactions_delta', label: 'Δ ROAS %', icon: '📊' },
                        { key: 'new_customers_percentage', label: '% Novos Clientes', icon: '👥' },
                        { key: 'revenue', label: 'Receita', icon: '💵' },
                        { key: 'revenue_first', label: 'Receita 1ª Compra', icon: '💎' },
                        { key: 'roas', label: 'ROAS', icon: '📈' },
                        { key: 'roas_first', label: 'ROAS 1ª Compra', icon: '🚀' },
                        { key: 'cpv', label: 'CPV', icon: '💳' },
                        { key: 'cpa', label: 'CPA', icon: '🎯' },
                        { key: 'cpa_delta', label: 'Δ CPA %', icon: '📊' }
                      ]
                      
                      const hasResults = allMetrics.some(metric => 
                        metric.label.toLowerCase().includes(metricSearchTerm.toLowerCase()) ||
                        metric.key.toLowerCase().includes(metricSearchTerm.toLowerCase())
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
                              onClick={() => setMetricSearchTerm('')}
                              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              Limpar busca
                            </button>
                          </div>
                        )
                      }
                      return null
                    })()}
                    {/* Categoria: Identificação */}
                    {(() => {
                      const identificationMetrics = [
                        { key: 'platform', label: 'Plataforma', icon: '🏢' },
                        { key: 'campaign_name', label: 'Campanha', icon: '📢' }
                      ].filter(metric => 
                        !metricSearchTerm || 
                        metric.label.toLowerCase().includes(metricSearchTerm.toLowerCase()) ||
                        metric.key.toLowerCase().includes(metricSearchTerm.toLowerCase())
                      )
                      
                      if (identificationMetrics.length === 0) return null
                      
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <h4 className="text-sm font-semibold text-gray-900">Identificação</h4>
                          </div>
                          <div className="space-y-2">
                            {identificationMetrics.map(({ key, label, icon }) => (
                              <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[key as keyof typeof visibleColumns]}
                                  onChange={(e) => setVisibleColumns(prev => ({
                                    ...prev,
                                    [key]: e.target.checked
                                  }))}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                />
                                <span className="text-lg">{icon}</span>
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Categoria: Investimento e Alcance */}
                    {(() => {
                      const investmentMetrics = [
                        { key: 'cost', label: 'Investimento', icon: '💰' },
                        { key: 'impressions', label: 'Impressões', icon: '👁️' },
                        { key: 'clicks', label: 'Cliques', icon: '👆' },
                        { key: 'ctr', label: 'CTR', icon: '📊' },
                        { key: 'cpc', label: 'CPC', icon: '💸' }
                      ].filter(metric => 
                        !metricSearchTerm || 
                        metric.label.toLowerCase().includes(metricSearchTerm.toLowerCase()) ||
                        metric.key.toLowerCase().includes(metricSearchTerm.toLowerCase())
                      )
                      
                      if (investmentMetrics.length === 0) return null
                      
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <h4 className="text-sm font-semibold text-gray-900">Investimento e Alcance</h4>
                          </div>
                          <div className="space-y-2">
                            {investmentMetrics.map(({ key, label, icon }) => (
                              <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[key as keyof typeof visibleColumns]}
                                  onChange={(e) => setVisibleColumns(prev => ({
                                    ...prev,
                                    [key]: e.target.checked
                                  }))}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                />
                                <span className="text-lg">{icon}</span>
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Categoria: Conversões e Receita */}
                    {(() => {
                      const conversionMetrics = [
                        { key: 'leads', label: 'Leads', icon: '🎯' },
                        { key: 'transactions', label: 'Transações', icon: '🛒' },
                        { key: 'transactions_first', label: 'Trans. 1ª Compra', icon: '🆕' },
                        { key: 'transactions_delta', label: 'Δ ROAS %', icon: '📊' },
                        { key: 'revenue', label: 'Receita', icon: '💵' },
                        { key: 'revenue_first', label: 'Receita 1ª Compra', icon: '💎' },
                        { key: 'pixel_transactions', label: 'Trans. Pixel', icon: '📱' },
                        { key: 'pixel_revenue', label: 'Receita Pixel', icon: '💰' },
                        { key: 'pixel_transactions_delta', label: 'Δ Trans. Pixel %', icon: '📊' },
                        { key: 'pixel_revenue_delta', label: 'Δ Receita Pixel %', icon: '📊' },
                        ...(hasRecurringData ? [
                          { key: 'recurring_annual_revenue', label: 'Receita Recorrente Anual', icon: '📅' },
                          { key: 'recurring_annual_subscriptions', label: 'Assinaturas Anuais', icon: '📋' },
                          { key: 'recurring_montly_revenue', label: 'Receita Recorrente Mensal', icon: '📆' },
                          { key: 'recurring_montly_subscriptions', label: 'Assinaturas Mensais', icon: '📝' }
                        ] : []),
                        ...(hasFirstData ? [
                          { key: 'first_annual_revenue', label: 'Receita 1ª Anual', icon: '🎁' },
                          { key: 'first_annual_subscriptions', label: 'Assin. 1ª Anuais', icon: '🎯' },
                          { key: 'first_montly_revenue', label: 'Receita 1ª Mensal', icon: '🎊' },
                          { key: 'first_montly_subscriptions', label: 'Assin. 1ª Mensais', icon: '🎈' }
                        ] : [])
                      ].filter(metric => 
                        !metricSearchTerm || 
                        metric.label.toLowerCase().includes(metricSearchTerm.toLowerCase()) ||
                        metric.key.toLowerCase().includes(metricSearchTerm.toLowerCase())
                      )
                      
                      if (conversionMetrics.length === 0) return null
                      
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <h4 className="text-sm font-semibold text-gray-900">Conversões e Receita</h4>
                          </div>
                          <div className="space-y-2">
                            {conversionMetrics.map(({ key, label, icon }) => (
                              <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[key as keyof typeof visibleColumns]}
                                  onChange={(e) => setVisibleColumns(prev => ({
                                    ...prev,
                                    [key]: e.target.checked
                                  }))}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                />
                                <span className="text-lg">{icon}</span>
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Categoria: Performance */}
                    {(() => {
                      const performanceMetrics = [
                        { key: 'roas', label: 'ROAS', icon: '📈' },
                        { key: 'roas_first', label: 'ROAS 1ª Compra', icon: '🚀' },
                        { key: 'cpv', label: 'CPV', icon: '💳' },
                        { key: 'cpa', label: 'CPA', icon: '🎯' },
                        { key: 'cpa_delta', label: 'Δ CPA %', icon: '📊' }
                      ].filter(metric => 
                        !metricSearchTerm || 
                        metric.label.toLowerCase().includes(metricSearchTerm.toLowerCase()) ||
                        metric.key.toLowerCase().includes(metricSearchTerm.toLowerCase())
                      )
                      
                      if (performanceMetrics.length === 0) return null
                      
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <h4 className="text-sm font-semibold text-gray-900">Performance</h4>
                          </div>
                          <div className="space-y-2">
                            {performanceMetrics.map(({ key, label, icon }) => (
                              <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[key as keyof typeof visibleColumns]}
                                  onChange={(e) => setVisibleColumns(prev => ({
                                    ...prev,
                                    [key]: e.target.checked
                                  }))}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                />
                                <span className="text-lg">{icon}</span>
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVisibleColumns({
                          platform: true,
                          campaign_name: true,
                          cost: true,
                          impressions: true,
                          clicks: true,
                          ctr: true,
                          cpc: true,
                          leads: true,
                          transactions: true,
                          transactions_first: true,
                          revenue: true,
                          revenue_first: true,
                          roas: true,
                          roas_first: true,
                          cpv: true,
                          cpa: true
                        })}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Todas
                      </button>
                      <button
                        onClick={() => setVisibleColumns({
                          platform: true,
                          campaign_name: true,
                          cost: false,
                          impressions: false,
                          clicks: false,
                          ctr: false,
                          cpc: false,
                          leads: false,
                          transactions: false,
                          transactions_first: false,
                          revenue: false,
                          revenue_first: false,
                          roas: false,
                          roas_first: false,
                          cpv: false,
                          cpa: false
                        })}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Básicas
                      </button>
                    </div>
                    <div className="text-sm text-gray-500">
                      {Object.values(visibleColumns).filter(Boolean).length} de {Object.keys(visibleColumns).length} selecionadas
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`overflow-x-auto ${isFullWidth ? 'h-[calc(100vh-120px)] overflow-y-auto' : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                {visibleColumns.platform && (
                <SortableHeader
                  field="platform"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                    className="sticky left-0 z-10 bg-gray-50"
                >
                  Plataforma
                </SortableHeader>
                )}
                {visibleColumns.campaign_name && (
                <SortableHeader
                  field="campaign_name"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                    className={`${visibleColumns.platform ? 'sticky left-[120px]' : 'sticky left-0'} z-10 bg-gray-50`}
                >
                  Campanha
                </SortableHeader>
                )}
                {visibleColumns.cost && (
                <SortableHeader
                  field="cost"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Investimento
                </SortableHeader>
                )}
                {visibleColumns.impressions && (
                <SortableHeader
                  field="impressions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Impressões
                </SortableHeader>
                )}
                {visibleColumns.clicks && (
                <SortableHeader
                  field="clicks"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Cliques
                </SortableHeader>
                )}
                {visibleColumns.ctr && (
                <SortableHeader
                  field="ctr"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  CTR
                </SortableHeader>
                )}
                {visibleColumns.cpc && (
                <SortableHeader
                  field="cpc"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  CPC
                </SortableHeader>
                )}
                {visibleColumns.leads && (
                <SortableHeader
                  field="leads"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Leads
                </SortableHeader>
                )}
                {visibleColumns.transactions && (
                <SortableHeader
                  field="transactions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Transações
                </SortableHeader>
                )}
                {visibleColumns.transactions_first && (
                <SortableHeader
                  field="transactions_first"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Trans. 1ª Compra
                </SortableHeader>
                )}
                {visibleColumns.transactions_delta && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSort('transactions_delta')}
                      className="flex items-center gap-1 hover:text-gray-700 group"
                    >
                      <span>Δ ROAS %</span>
                      <div className="flex flex-col">
                        <svg 
                          className={`w-3 h-3 ${sortField === 'transactions_delta' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M5 10l5-5 5 5H5z" />
                        </svg>
                        <svg 
                          className={`w-3 h-3 -mt-1 ${sortField === 'transactions_delta' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M15 10l-5 5-5-5h10z" />
                        </svg>
                      </div>
                    </button>
                    <div className="relative group">
                      <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-[99999] pointer-events-none border border-gray-700">
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900"></div>
                        <div className="font-semibold mb-1">Delta ROAS entre modelos de atribuição</div>
                        <div className="space-y-1">
                          <p>Compara o ROAS entre Last Non-Direct (LND) e Origin Stack (OS):</p>
                          <p className="text-emerald-300">💚 Verde escuro: Muito acima da média (+50%)</p>
                          <p className="text-green-300">🟢 Verde claro: Acima da média</p>
                          <p className="text-orange-300">🟠 Laranja: Abaixo da média</p>
                          <p className="text-red-300">🔴 Vermelho: Muito abaixo da média (-50%)</p>
                          <p className="text-gray-400 mt-1">Fórmula: ((ROAS_OS - ROAS_LND) / ROAS_LND) × 100</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </th>
                )}
                {visibleColumns.new_customers_percentage && (
                <SortableHeader
                  field="new_customers_percentage"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  % Novos Clientes
                </SortableHeader>
                )}
                {visibleColumns.revenue && (
                <SortableHeader
                  field="revenue"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita
                </SortableHeader>
                )}
                {visibleColumns.revenue_first && (
                <SortableHeader
                  field="revenue_first"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita 1ª Compra
                </SortableHeader>
                )}
                {visibleColumns.pixel_transactions && (
                <SortableHeader
                  field="pixel_transactions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Trans. Pixel
                </SortableHeader>
                )}
                {visibleColumns.pixel_revenue && (
                <SortableHeader
                  field="pixel_revenue"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita Pixel
                </SortableHeader>
                )}
                {visibleColumns.pixel_transactions_delta && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSort('pixel_transactions_delta')}
                      className="flex items-center gap-1 hover:text-gray-700 group"
                    >
                      <span>Δ Trans. Pixel %</span>
                      <div className="flex flex-col">
                        <svg 
                          className={`w-3 h-3 ${sortField === 'pixel_transactions_delta' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M5 10l5-5 5 5H5z" />
                        </svg>
                        <svg 
                          className={`w-3 h-3 -mt-1 ${sortField === 'pixel_transactions_delta' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M15 10l-5 5-5-5h10z" />
                        </svg>
                      </div>
                    </button>
                  </div>
                </th>
                )}
                {visibleColumns.pixel_revenue_delta && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSort('pixel_revenue_delta')}
                      className="flex items-center gap-1 hover:text-gray-700 group"
                    >
                      <span>Δ Receita Pixel %</span>
                      <div className="flex flex-col">
                        <svg 
                          className={`w-3 h-3 ${sortField === 'pixel_revenue_delta' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M5 10l5-5 5 5H5z" />
                        </svg>
                        <svg 
                          className={`w-3 h-3 -mt-1 ${sortField === 'pixel_revenue_delta' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M15 10l-5 5-5-5h10z" />
                        </svg>
                      </div>
                    </button>
                  </div>
                </th>
                )}
                {hasRecurringData && visibleColumns.recurring_annual_revenue && (
                <SortableHeader
                  field="recurring_annual_revenue"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita Rec. Anual
                </SortableHeader>
                )}
                {hasRecurringData && visibleColumns.recurring_annual_subscriptions && (
                <SortableHeader
                  field="recurring_annual_subscriptions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Assin. Anuais
                </SortableHeader>
                )}
                {hasRecurringData && visibleColumns.recurring_montly_revenue && (
                <SortableHeader
                  field="recurring_montly_revenue"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita Rec. Mensal
                </SortableHeader>
                )}
                {hasRecurringData && visibleColumns.recurring_montly_subscriptions && (
                <SortableHeader
                  field="recurring_montly_subscriptions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Assin. Mensais
                </SortableHeader>
                )}
                {hasFirstData && visibleColumns.first_annual_revenue && (
                <SortableHeader
                  field="first_annual_revenue"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita 1ª Anual
                </SortableHeader>
                )}
                {hasFirstData && visibleColumns.first_annual_subscriptions && (
                <SortableHeader
                  field="first_annual_subscriptions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Assin. 1ª Anuais
                </SortableHeader>
                )}
                {hasFirstData && visibleColumns.first_montly_revenue && (
                <SortableHeader
                  field="first_montly_revenue"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Receita 1ª Mensal
                </SortableHeader>
                )}
                {hasFirstData && visibleColumns.first_montly_subscriptions && (
                <SortableHeader
                  field="first_montly_subscriptions"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Assin. 1ª Mensais
                </SortableHeader>
                )}
                {visibleColumns.roas && (
                <SortableHeader
                  field="roas"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  ROAS
                </SortableHeader>
                )}
                {visibleColumns.roas_first && (
                <SortableHeader
                  field="roas_first"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  ROAS 1ª Compra
                </SortableHeader>
                )}
                {visibleColumns.cpv && (
                <SortableHeader
                    field="cpv"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                    CPV
                </SortableHeader>
                )}
                {visibleColumns.cpa && (
                <SortableHeader
                    field="cpa"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                    CPA
                </SortableHeader>
                )}
                {visibleColumns.cpa_delta && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSort('cpa_delta')}
                      className="flex items-center gap-1 hover:text-gray-700 group"
                    >
                      <span>Δ CPA %</span>
                      <div className="flex flex-col">
                        <svg 
                          className={`w-3 h-3 ${sortField === 'cpa_delta' && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M5 10l5-5 5 5H5z" />
                        </svg>
                        <svg 
                          className={`w-3 h-3 -mt-1 ${sortField === 'cpa_delta' && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M15 10l-5 5-5-5h10z" />
                        </svg>
                      </div>
                    </button>
                    <div className="relative group">
                      <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-[99999] pointer-events-none border border-gray-700">
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900"></div>
                        <div className="font-semibold mb-1">Delta CPA entre modelos de atribuição</div>
                        <div className="space-y-1">
                          <p>Compara o CPA entre Last Non-Direct (LND) e Origin Stack (OS):</p>
                          <p className="text-emerald-300">💚 Verde escuro: Muito acima da média (+50%)</p>
                          <p className="text-green-300">🟢 Verde claro: Acima da média</p>
                          <p className="text-orange-300">🟠 Laranja: Abaixo da média</p>
                          <p className="text-red-300">🔴 Vermelho: Muito abaixo da média (-50%)</p>
                          <p className="text-gray-400 mt-1">Fórmula: ((CPA_LND - CPA_OS) / CPA_LND) × 100</p>
                          <p className="text-xs text-gray-400">Nota: CPA menor é melhor, então valor positivo = OS mais eficiente</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                // Calcular médias dos deltas para destaque
                const roasDeltas: number[] = []
                const cpaDeltas: number[] = []
                
                displayedRecords.forEach(campaign => {
                  // Delta ROAS
                  const revenueLND = campaign.records && campaign.records.length > 0 
                    ? campaign.records.reduce((sum: number, record: any) => sum + (record.revenue || 0), 0)
                    : campaign.revenue;
                  const revenueOS = campaign.records && campaign.records.length > 0 
                    ? campaign.records.reduce((sum: number, record: any) => sum + (record.revenue_origin_stack || 0), 0)
                    : campaign.revenue_origin_stack;
                  const roasLND = campaign.cost > 0 ? revenueLND / campaign.cost : 0;
                  const roasOS = campaign.cost > 0 ? revenueOS / campaign.cost : 0;
                  if (roasLND > 0) {
                    roasDeltas.push(((roasOS - roasLND) / roasLND) * 100)
                  }
                  
                  // Delta CPA
                  const transactionsLND = campaign.records && campaign.records.length > 0 
                    ? campaign.records.reduce((sum: number, record: any) => sum + record.transactions_first, 0)
                    : campaign.transactions_first;
                  const transactionsOS = campaign.records && campaign.records.length > 0 
                    ? campaign.records.reduce((sum: number, record: any) => sum + (record.transactions_first_origin_stack || 0), 0)
                    : campaign.transactions_first_origin_stack;
                  const cpaLND = transactionsLND > 0 ? campaign.cost / transactionsLND : 0;
                  const cpaOS = transactionsOS > 0 ? campaign.cost / transactionsOS : 0;
                  if (cpaLND > 0) {
                    cpaDeltas.push(((cpaLND - cpaOS) / cpaLND) * 100)
                  }
                })
                
                const avgRoasDelta = roasDeltas.length > 0 ? roasDeltas.reduce((a, b) => a + b, 0) / roasDeltas.length : 0
                const avgCpaDelta = cpaDeltas.length > 0 ? cpaDeltas.reduce((a, b) => a + b, 0) / cpaDeltas.length : 0
                
                return displayedRecords.map((campaign, index) => {
                const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0
                const cpc = campaign.clicks > 0 ? campaign.cost / campaign.clicks : 0
                // Descontar recorrências mensais e anuais da receita para cálculo do ROAS
                const adjustedRevenue = campaign.revenue - (campaign.recurring_montly_revenue || 0) - (campaign.recurring_annual_revenue || 0)
                const roas = campaign.cost > 0 ? adjustedRevenue / campaign.cost : 0
                const roasFirst = campaign.cost > 0 ? campaign.revenue_first / campaign.cost : 0
                const cpv = campaign.transactions > 0 ? campaign.cost / campaign.transactions : 0
                const cpa = campaign.transactions_first > 0 ? campaign.cost / campaign.transactions_first : 0
                
                // Calcular % de novos clientes baseado no modelo de atribuição
                const currentTransactions = attributionModel === 'origin_stack' ? (campaign.transactions_origin_stack || campaign.transactions) : campaign.transactions
                const currentTransactionsFirst = attributionModel === 'origin_stack' ? (campaign.transactions_first_origin_stack || campaign.transactions_first) : campaign.transactions_first
                const newCustomersPercentage = currentTransactions > 0 ? (currentTransactionsFirst / currentTransactions) * 100 : 0

                return (
                  <tr key={index} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {visibleColumns.platform && (
                      <td className={`px-6 py-4 whitespace-nowrap sticky left-0 z-10 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {campaign.platform}
                      </span>
                    </td>
                    )}
                    {visibleColumns.campaign_name && (
                      <td className={`px-6 py-4 max-w-xs ${visibleColumns.platform ? 'sticky left-[120px]' : 'sticky left-0'} z-10 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <button
                        onClick={() => setSelectedCampaign(campaign.campaign_name)}
                        className={`text-sm font-medium truncate text-left w-full hover:underline transition-colors ${
                          selectedCampaign === campaign.campaign_name 
                            ? 'text-blue-600 font-semibold' 
                            : 'text-gray-900 hover:text-blue-600'
                        }`}
                        title={`Filtrar por: ${campaign.campaign_name}`}
                      >
                        {campaign.campaign_name}
                        {selectedCampaign === campaign.campaign_name && (
                          <span className="ml-1 text-blue-500">✓</span>
                        )}
                      </button>
                    </td>
                    )}
                    {visibleColumns.cost && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {formatCurrency(campaign.cost)}
                    </td>
                    )}
                    {visibleColumns.impressions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatNumber(campaign.impressions)}
                    </td>
                    )}
                    {visibleColumns.clicks && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatNumber(campaign.clicks)}
                    </td>
                    )}
                    {visibleColumns.ctr && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {ctr.toFixed(2)}%
                    </td>
                    )}
                    {visibleColumns.cpc && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-teal-600">
                      {formatCurrency(cpc)}
                    </td>
                    )}
                    {visibleColumns.leads && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {formatNumber(campaign.leads)}
                    </td>
                    )}
                    {visibleColumns.transactions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formatNumber(campaign.transactions)}
                    </td>
                    )}
                    {visibleColumns.transactions_first && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatNumber(campaign.transactions_first)}
                    </td>
                    )}
                    {visibleColumns.transactions_delta && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(() => {
                        // ROAS Last Non-Direct: usar sempre os valores originais (não afetados pelo filtro)
                        const revenueLND = campaign.records && campaign.records.length > 0 
                          ? campaign.records.reduce((sum: number, record: any) => sum + (record.revenue || 0), 0)
                          : campaign.revenue;
                        const roasLND = campaign.cost > 0 ? revenueLND / campaign.cost : 0;
                        
                        // ROAS Origin Stack: usar sempre os valores originais
                        const revenueOS = campaign.records && campaign.records.length > 0 
                          ? campaign.records.reduce((sum: number, record: any) => sum + (record.revenue_origin_stack || 0), 0)
                          : campaign.revenue_origin_stack;
                        const roasOS = campaign.cost > 0 ? revenueOS / campaign.cost : 0;
                        
                        // Delta percentual: ((ROAS_OS - ROAS_LND) / ROAS_LND) * 100
                        const deltaValue = roasLND > 0 ? ((roasOS - roasLND) / roasLND) * 100 : null;
                        const deltaPercentage = deltaValue !== null ? deltaValue.toFixed(1) : '-';
                        const isPositive = deltaValue !== null && deltaValue > 0;
                        const isNegative = deltaValue !== null && deltaValue < 0;
                        const isAboveAvg = deltaValue !== null && deltaValue > avgRoasDelta;
                        const isBelowAvg = deltaValue !== null && deltaValue < avgRoasDelta;
                        
                        // Cores e estilos baseados em 4 níveis
                        let bgColor = '';
                        let textColor = '';
                        let fontWeight = 'font-semibold';
                        
                        // Muito acima da média (top 25%)
                        if (deltaValue !== null && deltaValue > avgRoasDelta * 1.5) {
                          bgColor = 'bg-emerald-100';
                          textColor = 'text-emerald-800';
                          fontWeight = 'font-bold';
                        }
                        // Acima da média
                        else if (isAboveAvg) {
                          bgColor = 'bg-green-100';
                          textColor = 'text-green-700';
                          fontWeight = 'font-bold';
                        } 
                        // Muito abaixo da média
                        else if (deltaValue !== null && deltaValue < avgRoasDelta * 0.5) {
                          bgColor = 'bg-red-100';
                          textColor = 'text-red-700';
                        }
                        // Abaixo da média
                        else if (isBelowAvg) {
                          bgColor = 'bg-orange-100';
                          textColor = 'text-orange-700';
                        } 
                        // Na média
                        else {
                          textColor = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600';
                        }
                        
                        const sign = isPositive ? '+' : '';
                        return (
                          <div className={`${bgColor} ${textColor} ${fontWeight} rounded px-2 py-1 inline-block`}>
                            {deltaPercentage !== '-' ? `${sign}${deltaPercentage}%` : '-'}
                          </div>
                        );
                      })()}
                    </td>
                    )}
                    {visibleColumns.new_customers_percentage && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {currentTransactions > 0 ? `${newCustomersPercentage.toFixed(1)}%` : '-'}
                    </td>
                    )}
                    {visibleColumns.revenue && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(campaign.revenue - (campaign.recurring_montly_revenue || 0) - (campaign.recurring_annual_revenue || 0))}
                    </td>
                    )}
                    {visibleColumns.revenue_first && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                      {formatCurrency(campaign.revenue_first)}
                    </td>
                    )}
                    {visibleColumns.pixel_transactions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formatNumber(Math.round(campaign.pixel_transactions || 0))}
                    </td>
                    )}
                    {visibleColumns.pixel_revenue && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formatCurrency(Math.round((campaign.pixel_revenue || 0) * 100) / 100)}
                    </td>
                    )}
                    {visibleColumns.pixel_transactions_delta && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(() => {
                        // Calcular delta entre pixel_transactions e transactions_origin_stack
                        const pixelTransactions = campaign.pixel_transactions || 0
                        const originStackTransactions = campaign.records && campaign.records.length > 0 
                          ? campaign.records.reduce((sum: number, record: any) => sum + (record.transactions_origin_stack || 0), 0)
                          : campaign.transactions_origin_stack || 0
                        
                        // Delta percentual: ((pixel - origin_stack) / origin_stack) * 100
                        const deltaValue = originStackTransactions > 0 
                          ? ((pixelTransactions - originStackTransactions) / originStackTransactions) * 100 
                          : null
                        const deltaPercentage = deltaValue !== null ? deltaValue.toFixed(1) : '-'
                        const isPositive = deltaValue !== null && deltaValue > 0
                        const isNegative = deltaValue !== null && deltaValue < 0
                        
                        // Cores baseadas no delta
                        let bgColor = ''
                        let textColor = ''
                        
                        if (deltaValue !== null) {
                          if (deltaValue > 20) {
                            bgColor = 'bg-green-100'
                            textColor = 'text-green-700'
                          } else if (deltaValue > 0) {
                            bgColor = 'bg-green-50'
                            textColor = 'text-green-600'
                          } else if (deltaValue < -20) {
                            bgColor = 'bg-red-100'
                            textColor = 'text-red-700'
                          } else if (deltaValue < 0) {
                            bgColor = 'bg-red-50'
                            textColor = 'text-red-600'
                          } else {
                            textColor = 'text-gray-600'
                          }
                        }
                        
                        const sign = isPositive ? '+' : ''
                        return (
                          <div className={`${bgColor} ${textColor} rounded px-2 py-1 inline-block font-medium`}>
                            {deltaPercentage !== '-' ? `${sign}${deltaPercentage}%` : '-'}
                          </div>
                        )
                      })()}
                    </td>
                    )}
                    {visibleColumns.pixel_revenue_delta && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(() => {
                        // Calcular delta entre pixel_revenue e revenue_origin_stack
                        const pixelRevenue = campaign.pixel_revenue || 0
                        const originStackRevenue = campaign.records && campaign.records.length > 0 
                          ? campaign.records.reduce((sum: number, record: any) => sum + (record.revenue_origin_stack || 0), 0)
                          : campaign.revenue_origin_stack || 0
                        
                        // Delta percentual: ((pixel - origin_stack) / origin_stack) * 100
                        const deltaValue = originStackRevenue > 0 
                          ? ((pixelRevenue - originStackRevenue) / originStackRevenue) * 100 
                          : null
                        const deltaPercentage = deltaValue !== null ? deltaValue.toFixed(1) : '-'
                        const isPositive = deltaValue !== null && deltaValue > 0
                        const isNegative = deltaValue !== null && deltaValue < 0
                        
                        // Cores baseadas no delta
                        let bgColor = ''
                        let textColor = ''
                        
                        if (deltaValue !== null) {
                          if (deltaValue > 20) {
                            bgColor = 'bg-green-100'
                            textColor = 'text-green-700'
                          } else if (deltaValue > 0) {
                            bgColor = 'bg-green-50'
                            textColor = 'text-green-600'
                          } else if (deltaValue < -20) {
                            bgColor = 'bg-red-100'
                            textColor = 'text-red-700'
                          } else if (deltaValue < 0) {
                            bgColor = 'bg-red-50'
                            textColor = 'text-red-600'
                          } else {
                            textColor = 'text-gray-600'
                          }
                        }
                        
                        const sign = isPositive ? '+' : ''
                        return (
                          <div className={`${bgColor} ${textColor} rounded px-2 py-1 inline-block font-medium`}>
                            {deltaPercentage !== '-' ? `${sign}${deltaPercentage}%` : '-'}
                          </div>
                        )
                      })()}
                    </td>
                    )}
                    {hasRecurringData && visibleColumns.recurring_annual_revenue && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {formatCurrency(campaign.recurring_annual_revenue || 0)}
                    </td>
                    )}
                    {hasRecurringData && visibleColumns.recurring_annual_subscriptions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {formatNumber(Math.round(campaign.recurring_annual_subscriptions || 0))}
                    </td>
                    )}
                    {hasRecurringData && visibleColumns.recurring_montly_revenue && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {formatCurrency(campaign.recurring_montly_revenue || 0)}
                    </td>
                    )}
                    {hasRecurringData && visibleColumns.recurring_montly_subscriptions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {formatNumber(Math.round(campaign.recurring_montly_subscriptions || 0))}
                    </td>
                    )}
                    {hasFirstData && visibleColumns.first_annual_revenue && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-600">
                      {formatCurrency(campaign.first_annual_revenue || 0)}
                    </td>
                    )}
                    {hasFirstData && visibleColumns.first_annual_subscriptions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-600">
                      {formatNumber(Math.round(campaign.first_annual_subscriptions || 0))}
                    </td>
                    )}
                    {hasFirstData && visibleColumns.first_montly_revenue && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pink-600">
                      {formatCurrency(campaign.first_montly_revenue || 0)}
                    </td>
                    )}
                    {hasFirstData && visibleColumns.first_montly_subscriptions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pink-600">
                      {formatNumber(Math.round(campaign.first_montly_subscriptions || 0))}
                    </td>
                    )}
                    {visibleColumns.roas && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${roas >= 3 ? 'text-green-600' : roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {roas.toFixed(2)}x
                      </span>
                    </td>
                    )}
                    {visibleColumns.roas_first && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${roasFirst >= 3 ? 'text-green-600' : roasFirst >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {roasFirst.toFixed(2)}x
                      </span>
                    </td>
                    )}
                    {visibleColumns.cpv && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                        {formatCurrency(cpv)}
                    </td>
                    )}
                    {visibleColumns.cpa && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                        {formatCurrency(cpa)}
                    </td>
                    )}
                    {visibleColumns.cpa_delta && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(() => {
                        // CPA Last Non-Direct: usar sempre os valores originais (não afetados pelo filtro)
                        const transactionsLND = campaign.records && campaign.records.length > 0 
                          ? campaign.records.reduce((sum: number, record: any) => sum + record.transactions_first, 0)
                          : campaign.transactions_first;
                        const cpaLND = transactionsLND > 0 ? campaign.cost / transactionsLND : 0;
                        
                        // CPA Origin Stack: usar sempre os valores originais
                        const transactionsOS = campaign.records && campaign.records.length > 0 
                          ? campaign.records.reduce((sum: number, record: any) => sum + (record.transactions_first_origin_stack || 0), 0)
                          : campaign.transactions_first_origin_stack;
                        const cpaOS = transactionsOS > 0 ? campaign.cost / transactionsOS : 0;
                        
                        // Delta percentual: ((CPA_LND - CPA_OS) / CPA_LND) * 100
                        // CPA menor é melhor, então invertemos: se OS for menor, delta é positivo (verde)
                        const deltaValue = cpaLND > 0 ? ((cpaLND - cpaOS) / cpaLND) * 100 : null;
                        const deltaPercentage = deltaValue !== null ? deltaValue.toFixed(1) : '-';
                        const isPositive = deltaValue !== null && deltaValue > 0;
                        const isNegative = deltaValue !== null && deltaValue < 0;
                        const isAboveAvg = deltaValue !== null && deltaValue > avgCpaDelta;
                        const isBelowAvg = deltaValue !== null && deltaValue < avgCpaDelta;
                        
                        // Cores e estilos baseados em 4 níveis
                        let bgColor = '';
                        let textColor = '';
                        let fontWeight = 'font-semibold';
                        
                        // Muito acima da média (top 25%)
                        if (deltaValue !== null && deltaValue > avgCpaDelta * 1.5) {
                          bgColor = 'bg-emerald-100';
                          textColor = 'text-emerald-800';
                          fontWeight = 'font-bold';
                        }
                        // Acima da média
                        else if (isAboveAvg) {
                          bgColor = 'bg-green-100';
                          textColor = 'text-green-700';
                          fontWeight = 'font-bold';
                        } 
                        // Muito abaixo da média
                        else if (deltaValue !== null && deltaValue < avgCpaDelta * 0.5) {
                          bgColor = 'bg-red-100';
                          textColor = 'text-red-700';
                        }
                        // Abaixo da média
                        else if (isBelowAvg) {
                          bgColor = 'bg-orange-100';
                          textColor = 'text-orange-700';
                        } 
                        // Na média
                        else {
                          textColor = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600';
                        }
                        
                        const sign = isPositive ? '+' : '';
                        return (
                          <div className={`${bgColor} ${textColor} ${fontWeight} rounded px-2 py-1 inline-block`}>
                            {deltaPercentage !== '-' ? `${sign}${deltaPercentage}%` : '-'}
                          </div>
                        );
                      })()}
                    </td>
                    )}
                  </tr>
                )
              })})()}
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
      )}

      {/* Aba Criativos - Mesmo layout da Visão Geral */}
      {activeTab === 'creatives' && (
        <div className="space-y-6">
          {/* Disclaimer */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Informação Importante
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Esta aba atualmente exibe apenas dados de <strong>Meta Ads</strong>. 
                    Os dados de Google Ads serão adicionados em breve.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Header com breadcrumb de drilldown */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <span>Criativos</span>
                {selectedCreativeCampaign && (
                  <>
                    <span>›</span>
                    <span>{selectedCreativeCampaign}</span>
                  </>
                )}
                {selectedAdGroup && (
                  <>
                    <span>›</span>
                    <span>{selectedAdGroup}</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{getDrilldownTitle()}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Análise detalhada por criativo e grupo de anúncio
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {(selectedCreativeCampaign || selectedAdGroup || drilldownLevel !== 'campaign') && (
                <button
                  onClick={goBackDrilldown}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <span>← Voltar</span>
                </button>
              )}

          {/* Toggle tela cheia como na visão geral */}
          <button
            onClick={() => setIsFullWidth(prev => !prev)}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title={isFullWidth ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            <span>{isFullWidth ? 'Sair Tela Cheia' : 'Tela Cheia'}</span>
          </button>
            </div>
          </div>

          {/* Loading state */}
          {isLoadingCreatives ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : sortedCreativeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium mb-2">Nenhum dado de criativos encontrado</h3>
              <p className="text-sm text-center">
                Não há dados de criativos disponíveis para o período selecionado.
              </p>
            </div>
          ) : (
            <>
              {/* Métricas principais - Mesmo layout da Visão Geral */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Investimento */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Investimento Total</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(creativeTotals.cost)}</p>
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
                      <p className="text-xl font-bold text-gray-900">{formatNumber(creativeTotals.impressions)}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPM: {formatCurrency(creativeTotals.impressions > 0 ? (creativeTotals.cost / creativeTotals.impressions) * 1000 : 0)}</span>
                </div>

                {/* Cliques */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Cliques</p>
                      <p className="text-xl font-bold text-gray-900">{formatNumber(creativeTotals.clicks)}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                      <MousePointer className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CTR: {creativeAvgCTR.toFixed(1)}%</span>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPC: {formatCurrency(creativeAvgCPC)}</span>
                  </div>
                </div>

                {/* Leads */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Leads</p>
                      <p className="text-xl font-bold text-gray-900">{formatNumber(creativeTotals.leads)}</p>
                    </div>
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <Users className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPL: {formatCurrency(creativeAvgCPL)}</span>
                </div>

              </div>

              {/* Segunda linha de métricas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Transações */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Transações</p>
                      <p className="text-xl font-bold text-gray-900">{formatNumber(creativeTotals.transactions)}</p>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPV: {formatCurrency(creativeAvgCPV)}</span>
                </div>

                {/* Receita */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Receita Total</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(creativeTotals.revenue)}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">ROAS: {(creativeTotals.cost > 0 ? creativeTotals.revenue / creativeTotals.cost : 0).toFixed(1)}x</span>
                </div>

                {/* Transações 1ª Compra */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Transações 1ª</p>
                      <p className="text-xl font-bold text-gray-900">{formatNumber(creativeTotals.transactions_first)}</p>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <Star className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">CPA 1ª: {formatCurrency(creativeTotals.transactions_first > 0 ? creativeTotals.cost / creativeTotals.transactions_first : 0)}</span>
                </div>

                {/* Receita 1ª Compra */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Receita 1ª</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(creativeTotals.revenue_first)}</p>
                    </div>
                    <div className="p-2 bg-yellow-50 rounded-lg">
                      <Award className="w-5 h-5 text-yellow-600" />
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">ROAS 1ª: {(creativeTotals.cost > 0 ? creativeTotals.revenue_first / creativeTotals.cost : 0).toFixed(1)}x</span>
                </div>
              </div>

              {/* Comparativo de Atribuição */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                  Comparativo de Modelos de Atribuição
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Origin Stack */}
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-blue-900">Origin Stack (Padrão)</h4>
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Layers className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Transações:</span>
                        <span className="font-semibold text-blue-900">{formatNumber(originStackTotals.transactions)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Receita:</span>
                        <span className="font-semibold text-blue-900">{formatCurrency(originStackTotals.revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">ROAS:</span>
                        <span className="font-semibold text-blue-900">{(creativeTotals.cost > 0 ? originStackTotals.revenue / creativeTotals.cost : 0).toFixed(1)}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Transações 1ª:</span>
                        <span className="font-semibold text-blue-900">{formatNumber(originStackTotals.transactions_first)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Receita 1ª:</span>
                        <span className="font-semibold text-blue-900">{formatCurrency(originStackTotals.revenue_first)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Last Non Direct */}
                  <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-green-900">Last Non-Direct (Alternativo)</h4>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Target className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">Transações:</span>
                        <span className="font-semibold text-green-900">{formatNumber(lastNonDirectTotals.transactions)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">Receita:</span>
                        <span className="font-semibold text-green-900">{formatCurrency(lastNonDirectTotals.revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">ROAS:</span>
                        <span className="font-semibold text-green-900">{(creativeTotals.cost > 0 ? lastNonDirectTotals.revenue / creativeTotals.cost : 0).toFixed(1)}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">Transações 1ª:</span>
                        <span className="font-semibold text-green-900">{formatNumber(lastNonDirectTotals.transactions_first)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">Receita 1ª:</span>
                        <span className="font-semibold text-green-900">{formatCurrency(lastNonDirectTotals.revenue_first)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diferenças */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Diferenças entre os modelos:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Diferença em Transações:</span>
                      <span className={`ml-2 font-semibold ${originStackTotals.transactions > lastNonDirectTotals.transactions ? 'text-green-600' : 'text-red-600'}`}>
                        {originStackTotals.transactions > lastNonDirectTotals.transactions ? '+' : ''}
                        {formatNumber(originStackTotals.transactions - lastNonDirectTotals.transactions)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Diferença em Receita:</span>
                      <span className={`ml-2 font-semibold ${originStackTotals.revenue > lastNonDirectTotals.revenue ? 'text-green-600' : 'text-red-600'}`}>
                        {originStackTotals.revenue > lastNonDirectTotals.revenue ? '+' : ''}
                        {formatCurrency(originStackTotals.revenue - lastNonDirectTotals.revenue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <select
                      value={selectedPlatform}
                      onChange={(e) => setSelectedPlatform(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todas as plataformas</option>
                      {Array.from(new Set(creativeData.map(item => item.platform))).map((platform) => (
                        <option key={platform} value={platform}>{platform}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder={`Buscar ${getDrilldownTitle().toLowerCase()}...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Atribuição:</label>
                    <select
                      value={attributionModel}
                      onChange={(e) => setAttributionModel(e.target.value as 'origin_stack' | 'last_non_direct')}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="origin_stack">Origin Stack (Padrão)</option>
                      <option value="last_non_direct">Last Non-Direct (Alternativo)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botões de controle */}
              <div className="flex gap-2 mb-4">
                {/* Botão Dropdown de Métricas */}
                <div className="relative">
                  <button
                    onClick={() => setShowCreativeColumnSelector(!showCreativeColumnSelector)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                      showCreativeColumnSelector 
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span>Métricas</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      showCreativeColumnSelector 
                        ? 'bg-white/20 text-white' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {Object.values(creativeVisibleColumns).filter(Boolean).length}
                    </span>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-200 ${showCreativeColumnSelector ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabela simples */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {getDrilldownTitle()} ({sortedCreativeData.length})
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plataforma
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {drilldownLevel === 'campaign' ? 'Campanha' : drilldownLevel === 'adgroup' ? 'Grupo de Anúncio' : 'Criativo'}
                        </th>
                        {creativeVisibleColumns.cost && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Investimento</th>)}
                        {creativeVisibleColumns.revenue && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receita</th>)}
                        {creativeVisibleColumns.revenue_first && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receita 1ª</th>)}
                        {creativeVisibleColumns.impressions && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressões</th>)}
                        {creativeVisibleColumns.clicks && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliques</th>)}
                        {creativeVisibleColumns.leads && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>)}
                        {creativeVisibleColumns.transactions && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transações</th>)}
                        {creativeVisibleColumns.transactions_first && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transações 1ª</th>)}
                        {creativeVisibleColumns.transactions_delta && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                            <div className="flex items-center gap-1">
                              <span>Δ ROAS %</span>
                              <div className="relative group">
                                <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-[99999] pointer-events-none border border-gray-700">
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900"></div>
                                  <div className="font-semibold mb-1">Delta ROAS</div>
                                  <div className="space-y-1">
                                    <p>Compara ROAS entre LND e OS:</p>
                                    <p className="text-emerald-300">💚 Muito acima (+50%)</p>
                                    <p className="text-green-300">🟢 Acima da média</p>
                                    <p className="text-orange-300">🟠 Abaixo da média</p>
                                    <p className="text-red-300">🔴 Muito abaixo (-50%)</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </th>
                        )}
                        {creativeVisibleColumns.new_customers_percentage && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Novos Clientes</th>)}
                        {creativeVisibleColumns.ctr && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>)}
                        {creativeVisibleColumns.cpc && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPC</th>)}
                        {creativeVisibleColumns.cpv && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPV</th>)}
                        {creativeVisibleColumns.cpa && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPA</th>)}
                        {creativeVisibleColumns.cpa_delta && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                            <div className="flex items-center gap-1">
                              <span>Δ CPA %</span>
                              <div className="relative group">
                                <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-[99999] pointer-events-none border border-gray-700">
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900"></div>
                                  <div className="font-semibold mb-1">Delta CPA</div>
                                  <div className="space-y-1">
                                    <p>Compara CPA entre LND e OS:</p>
                                    <p className="text-emerald-300">💚 Muito acima (+50%)</p>
                                    <p className="text-green-300">🟢 Acima da média</p>
                                    <p className="text-orange-300">🟠 Abaixo da média</p>
                                    <p className="text-red-300">🔴 Muito abaixo (-50%)</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </th>
                        )}
                        {creativeVisibleColumns.roas && (<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>)}
                        {canDrilldown() && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ações
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        // Calcular médias dos deltas para destaque
                        const roasDeltas: number[] = []
                        const cpaDeltas: number[] = []
                        
                        sortedCreativeData.slice(0, 20).forEach((item: any) => {
                        // Delta ROAS - API 2.0: fsm_* = origin_stack
                        const revenueLND = toNumber(item.revenue || 0)
                        const revenueOS = toNumber(item.revenue_origin_stack || 0)
                        const roasLND = item.cost > 0 ? revenueLND / item.cost : 0;
                        const roasOS = item.cost > 0 ? revenueOS / item.cost : 0;
                        if (roasLND > 0 && revenueOS > 0) {
                          roasDeltas.push(((roasOS - roasLND) / roasLND) * 100)
                        }
                        
                        // Delta CPA - API 2.0: fsm_* = origin_stack
                        const transactionsLND = toNumber(item.transactions_first || 0)
                        const transactionsOS = toNumber(item.transactions_first_origin_stack || 0)
                        const cpaLND = transactionsLND > 0 ? item.cost / transactionsLND : 0;
                        const cpaOS = transactionsOS > 0 ? item.cost / transactionsOS : 0;
                        if (cpaLND > 0 && transactionsOS > 0) {
                          cpaDeltas.push(((cpaLND - cpaOS) / cpaLND) * 100)
                        }
                        })
                        
                        const avgRoasDelta = roasDeltas.length > 0 ? roasDeltas.reduce((a, b) => a + b, 0) / roasDeltas.length : 0
                        const avgCpaDelta = cpaDeltas.length > 0 ? cpaDeltas.reduce((a, b) => a + b, 0) / cpaDeltas.length : 0
                        
                        return sortedCreativeData.slice(0, 20).map((item: any, index) => {
                        const currentRevenue = attributionModel === 'origin_stack' ? (item.revenue_origin_stack || item.revenue) : item.revenue
                        const roas = item.cost > 0 ? currentRevenue / item.cost : 0
                        const displayName = drilldownLevel === 'campaign' ? item.campaign_name : 
                                           drilldownLevel === 'adgroup' ? item.ad_group_name : 
                                           item.creative_name
                        
                        // Calcular % de novos clientes
                        const currentTransactions = attributionModel === 'origin_stack' ? (item.transactions_origin_stack || item.transactions) : item.transactions
                        const currentTransactionsFirst = attributionModel === 'origin_stack' ? (item.transactions_first_origin_stack || item.transactions_first) : item.transactions_first
                        const newCustomersPercentage = currentTransactions > 0 ? (currentTransactionsFirst / currentTransactions) * 100 : 0
                        
                        console.log('🔍 Renderizando item:', {
                          index,
                          drilldownLevel,
                          displayName,
                          itemCampaign: item.campaign_name,
                          itemAdGroup: item.ad_group_name,
                          itemCreative: item.creative_name,
                          selectedCampaign: selectedCreativeCampaign,
                          selectedAdGroup: selectedAdGroup
                        })
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {item.platform}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <span className="truncate max-w-xs block" title={displayName}>
                                {displayName}
                              </span>
                            </td>
                            {creativeVisibleColumns.cost && (<td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.cost)}</td>)}
                            {creativeVisibleColumns.revenue && (<td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(attributionModel === 'origin_stack' ? (item.revenue_origin_stack || item.revenue) : item.revenue)}</td>)}
                            {creativeVisibleColumns.revenue_first && (<td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(attributionModel === 'origin_stack' ? (item.revenue_first_origin_stack || item.revenue_first) : item.revenue_first)}</td>)}
                            {creativeVisibleColumns.impressions && (<td className="px-4 py-3 text-sm text-gray-900">{formatNumber(item.impressions)}</td>)}
                            {creativeVisibleColumns.clicks && (<td className="px-4 py-3 text-sm text-gray-900">{formatNumber(item.clicks)}</td>)}
                            {creativeVisibleColumns.leads && (<td className="px-4 py-3 text-sm text-gray-900">{formatNumber(item.leads)}</td>)}
                            {creativeVisibleColumns.transactions && (<td className="px-4 py-3 text-sm text-gray-900">{formatNumber(attributionModel === 'origin_stack' ? (item.transactions_origin_stack || item.transactions) : item.transactions)}</td>)}
                            {creativeVisibleColumns.transactions_first && (<td className="px-4 py-3 text-sm text-gray-900">{formatNumber(attributionModel === 'origin_stack' ? (item.transactions_first_origin_stack || item.transactions_first) : item.transactions_first)}</td>)}
                            {creativeVisibleColumns.transactions_delta && (
                              <td className="px-4 py-3 text-sm">
                                {(() => {
                                  // API 2.0: fsm_* = origin_stack
                                  // Usar valores agregados do item (já calculados no agrupamento)
                                  const revenueLND = toNumber(item.revenue || 0)
                                  const revenueOS = toNumber(item.revenue_origin_stack || 0)
                                  
                                  // Se não temos dados de ambos os modelos, não podemos calcular o delta
                                  if (revenueOS === 0 && revenueLND === 0) {
                                    return <span className="text-gray-400">—</span>
                                  }
                                  
                                  const roasLND = item.cost > 0 ? revenueLND / item.cost : 0;
                                  const roasOS = item.cost > 0 ? revenueOS / item.cost : 0;
                                  
                                  // Se não temos ROAS LND, não podemos calcular o delta
                                  if (roasLND === 0) {
                                    return <span className="text-gray-400">—</span>
                                  }
                                  
                                  // Delta percentual: ((ROAS_OS - ROAS_LND) / ROAS_LND) * 100
                                  const deltaValue = roasLND > 0 ? ((roasOS - roasLND) / roasLND) * 100 : null;
                                  const deltaPercentage = deltaValue !== null ? deltaValue.toFixed(1) : '-';
                                  const isPositive = deltaValue !== null && deltaValue > 0;
                                  const isNegative = deltaValue !== null && deltaValue < 0;
                                  const isAboveAvg = deltaValue !== null && deltaValue > avgRoasDelta;
                                  const isBelowAvg = deltaValue !== null && deltaValue < avgRoasDelta;
                                  
                                  // Cores e estilos baseados em 4 níveis
                                  let bgColor = '';
                                  let textColor = '';
                                  let fontWeight = 'font-semibold';
                                  
                                  // Muito acima da média (top 25%)
                                  if (deltaValue !== null && deltaValue > avgRoasDelta * 1.5) {
                                    bgColor = 'bg-emerald-100';
                                    textColor = 'text-emerald-800';
                                    fontWeight = 'font-bold';
                                  }
                                  // Acima da média
                                  else if (isAboveAvg) {
                                    bgColor = 'bg-green-100';
                                    textColor = 'text-green-700';
                                    fontWeight = 'font-bold';
                                  } 
                                  // Muito abaixo da média
                                  else if (deltaValue !== null && deltaValue < avgRoasDelta * 0.5) {
                                    bgColor = 'bg-red-100';
                                    textColor = 'text-red-700';
                                  }
                                  // Abaixo da média
                                  else if (isBelowAvg) {
                                    bgColor = 'bg-orange-100';
                                    textColor = 'text-orange-700';
                                  } 
                                  // Na média
                                  else {
                                    textColor = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600';
                                  }
                                  
                                  const sign = isPositive ? '+' : '';
                                  return (
                                    <div className={`${bgColor} ${textColor} ${fontWeight} rounded px-2 py-1 inline-block`}>
                                      {deltaPercentage !== '-' ? `${sign}${deltaPercentage}%` : '-'}
                                    </div>
                                  );
                                })()}
                              </td>
                            )}
                            {creativeVisibleColumns.new_customers_percentage && (
                              <td className="px-4 py-3 text-sm font-medium text-indigo-600">
                                {currentTransactions > 0 ? `${newCustomersPercentage.toFixed(1)}%` : '-'}
                              </td>
                            )}
                            {creativeVisibleColumns.ctr && (<td className="px-4 py-3 text-sm text-gray-900">{(item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0).toFixed(2)}%</td>)}
                            {creativeVisibleColumns.cpc && (<td className="px-4 py-3 text-sm text-gray-900">{item.clicks > 0 ? formatCurrency(item.cost / item.clicks) : '—'}</td>)}
                            {creativeVisibleColumns.cpv && (<td className="px-4 py-3 text-sm text-gray-900">{(attributionModel === 'origin_stack' ? (item.transactions_origin_stack || item.transactions) : item.transactions) > 0 ? formatCurrency(item.cost / (attributionModel === 'origin_stack' ? (item.transactions_origin_stack || item.transactions) : item.transactions)) : '—'}</td>)}
                            {creativeVisibleColumns.cpa && (<td className="px-4 py-3 text-sm text-gray-900">{(attributionModel === 'origin_stack' ? (item.transactions_first_origin_stack || item.transactions_first) : item.transactions_first) > 0 ? formatCurrency(item.cost / (attributionModel === 'origin_stack' ? (item.transactions_first_origin_stack || item.transactions_first) : item.transactions_first)) : '—'}</td>)}
                            {creativeVisibleColumns.cpa_delta && (
                              <td className="px-4 py-3 text-sm">
                                {(() => {
                                  // API 2.0: fsm_* = origin_stack
                                  // Usar valores agregados do item (já calculados no agrupamento)
                                  const transactionsLND = toNumber(item.transactions_first || 0)
                                  const transactionsOS = toNumber(item.transactions_first_origin_stack || 0)
                                  
                                  // Se não temos dados de ambos os modelos, não podemos calcular o delta
                                  if (transactionsOS === 0 && transactionsLND === 0) {
                                    return <span className="text-gray-400">—</span>
                                  }
                                  
                                  const cpaLND = transactionsLND > 0 ? item.cost / transactionsLND : 0;
                                  const cpaOS = transactionsOS > 0 ? item.cost / transactionsOS : 0;
                                  
                                  // Se não temos CPA LND, não podemos calcular o delta
                                  if (cpaLND === 0) {
                                    return <span className="text-gray-400">—</span>
                                  }
                                  
                                  // Delta percentual: ((CPA_LND - CPA_OS) / CPA_LND) * 100
                                  // CPA menor é melhor, então invertemos: se OS for menor, delta é positivo (verde)
                                  const deltaValue = cpaLND > 0 ? ((cpaLND - cpaOS) / cpaLND) * 100 : null;
                                  const deltaPercentage = deltaValue !== null ? deltaValue.toFixed(1) : '-';
                                  const isPositive = deltaValue !== null && deltaValue > 0;
                                  const isNegative = deltaValue !== null && deltaValue < 0;
                                  const isAboveAvg = deltaValue !== null && deltaValue > avgCpaDelta;
                                  const isBelowAvg = deltaValue !== null && deltaValue < avgCpaDelta;
                                  
                                  // Cores e estilos baseados em 4 níveis
                                  let bgColor = '';
                                  let textColor = '';
                                  let fontWeight = 'font-semibold';
                                  
                                  // Muito acima da média (top 25%)
                                  if (deltaValue !== null && deltaValue > avgCpaDelta * 1.5) {
                                    bgColor = 'bg-emerald-100';
                                    textColor = 'text-emerald-800';
                                    fontWeight = 'font-bold';
                                  }
                                  // Acima da média
                                  else if (isAboveAvg) {
                                    bgColor = 'bg-green-100';
                                    textColor = 'text-green-700';
                                    fontWeight = 'font-bold';
                                  } 
                                  // Muito abaixo da média
                                  else if (deltaValue !== null && deltaValue < avgCpaDelta * 0.5) {
                                    bgColor = 'bg-red-100';
                                    textColor = 'text-red-700';
                                  }
                                  // Abaixo da média
                                  else if (isBelowAvg) {
                                    bgColor = 'bg-orange-100';
                                    textColor = 'text-orange-700';
                                  } 
                                  // Na média
                                  else {
                                    textColor = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600';
                                  }
                                  
                                  const sign = isPositive ? '+' : '';
                                  return (
                                    <div className={`${bgColor} ${textColor} ${fontWeight} rounded px-2 py-1 inline-block`}>
                                      {deltaPercentage !== '-' ? `${sign}${deltaPercentage}%` : '-'}
                                    </div>
                                  );
                                })()}
                              </td>
                            )}
                            {creativeVisibleColumns.roas && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  roas >= 2 
                                    ? 'bg-green-100 text-green-800' 
                                    : roas >= 1
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {roas.toFixed(1)}x
                                </span>
                              </td>
                            )}
                            {canDrilldown() && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <button
                                  onClick={() => {
                                    const nextLevel = getNextDrilldownLevel()!
                                    console.log('🔍 Clicando em detalhar:', {
                                      nextLevel,
                                      displayName,
                                      currentLevel: drilldownLevel,
                                      itemCampaign: item.campaign_name,
                                      itemAdGroup: item.ad_group_name
                                    })
                                    
                                    // Se estamos no nível de campanha e vamos para adgroup, 
                                    // precisamos definir a campanha selecionada e não passar grupo ainda
                                    if (drilldownLevel === 'campaign' && nextLevel === 'adgroup') {
                                      setSelectedCreativeCampaign(item.campaign_name)
                                      setSelectedAdGroup(null) // Limpar grupo selecionado
                                      console.log('🔍 Definindo campanha selecionada no click:', item.campaign_name)
                                      // Só mudar o nível, não passar value para adgroup ainda
                                      setDrilldownLevel('adgroup')
                                    } else {
                                      applyDrilldown(nextLevel, displayName)
                                    }
                                  }}
                                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
                                >
                                  <span>Detalhar →</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })})()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dropdown de Métricas para Criativos - Overlay Elegante */}
              {showCreativeColumnSelector && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                  {/* Backdrop */}
                  <div 
                    className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                    onClick={() => {
                      setShowCreativeColumnSelector(false)
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
                              <p className="text-blue-100 text-sm">Escolha quais colunas exibir na tabela</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setShowCreativeColumnSelector(false)
                            }}
                            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 max-h-96 overflow-y-auto">
                        <div className="grid grid-cols-1 gap-6">
                          {/* Categoria: Identificação */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <h4 className="text-sm font-semibold text-gray-900">Identificação</h4>
                            </div>
                            <div className="space-y-2">
                              {[
                                { key: 'platform', label: 'Plataforma', icon: '🏢' },
                                { key: 'campaign_name', label: 'Campanha', icon: '📢' }
                              ].map(({ key, label, icon }) => (
                                <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={creativeVisibleColumns[key as keyof typeof creativeVisibleColumns]}
                                    onChange={(e) => setCreativeVisibleColumns(prev => ({
                                      ...prev,
                                      [key]: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                  />
                                  <span className="text-lg">{icon}</span>
                                  <span className="text-sm font-medium text-gray-700">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Categoria: Financeiro */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <h4 className="text-sm font-semibold text-gray-900">Financeiro</h4>
                            </div>
                            <div className="space-y-2">
                              {[
                                { key: 'cost', label: 'Investimento', icon: '💰' },
                                { key: 'revenue', label: 'Receita', icon: '💵' },
                                { key: 'revenue_first', label: 'Receita 1ª Compra', icon: '💎' },
                                { key: 'roas', label: 'ROAS', icon: '📈' },
                                { key: 'roas_first', label: 'ROAS 1ª Compra', icon: '🚀' }
                              ].map(({ key, label, icon }) => (
                                <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={creativeVisibleColumns[key as keyof typeof creativeVisibleColumns]}
                                    onChange={(e) => setCreativeVisibleColumns(prev => ({
                                      ...prev,
                                      [key]: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                  />
                                  <span className="text-lg">{icon}</span>
                                  <span className="text-sm font-medium text-gray-700">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Categoria: Performance */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <h4 className="text-sm font-semibold text-gray-900">Performance</h4>
                            </div>
                            <div className="space-y-2">
                              {[
                                { key: 'impressions', label: 'Impressões', icon: '👁️' },
                                { key: 'clicks', label: 'Cliques', icon: '👆' },
                                { key: 'ctr', label: 'CTR', icon: '📊' },
                                { key: 'cpc', label: 'CPC', icon: '💸' }
                              ].map(({ key, label, icon }) => (
                                <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={creativeVisibleColumns[key as keyof typeof creativeVisibleColumns]}
                                    onChange={(e) => setCreativeVisibleColumns(prev => ({
                                      ...prev,
                                      [key]: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                  />
                                  <span className="text-lg">{icon}</span>
                                  <span className="text-sm font-medium text-gray-700">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Categoria: Conversões */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                              <h4 className="text-sm font-semibold text-gray-900">Conversões</h4>
                            </div>
                            <div className="space-y-2">
                              {[
                                { key: 'leads', label: 'Leads', icon: '🎯' },
                                { key: 'transactions', label: 'Transações', icon: '🛒' },
                                { key: 'transactions_first', label: 'Trans. 1ª Compra', icon: '🆕' },
                                { key: 'transactions_delta', label: 'Δ ROAS %', icon: '📊' },
                                { key: 'cpv', label: 'CPV', icon: '💳' },
                                { key: 'cpa', label: 'CPA', icon: '🎯' },
                                { key: 'cpa_delta', label: 'Δ CPA %', icon: '📊' }
                              ].map(({ key, label, icon }) => (
                                <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={creativeVisibleColumns[key as keyof typeof creativeVisibleColumns]}
                                    onChange={(e) => setCreativeVisibleColumns(prev => ({
                                      ...prev,
                                      [key]: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                                  />
                                  <span className="text-lg">{icon}</span>
                                  <span className="text-sm font-medium text-gray-700">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setCreativeVisibleColumns({
                                  platform: true,
                                  campaign_name: true,
                                  cost: true,
                                  impressions: true,
                                  clicks: true,
                                  ctr: true,
                                  cpc: true,
                                  leads: true,
                                  transactions: true,
                                  transactions_first: true,
                                  revenue: true,
                                  revenue_first: true,
                                  cpv: true,
                                  cpa: true,
                                  roas: true,
                                  roas_first: true
                                })
                              }}
                              className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              Selecionar Todas
                            </button>
                            <button
                              onClick={() => {
                                setCreativeVisibleColumns({
                                  platform: false,
                                  campaign_name: false,
                                  cost: false,
                                  impressions: false,
                                  clicks: false,
                                  ctr: false,
                                  cpc: false,
                                  leads: false,
                                  transactions: false,
                                  transactions_first: false,
                                  revenue: false,
                                  revenue_first: false,
                                  cpv: false,
                                  cpa: false,
                                  roas: false,
                                  roas_first: false
                                })
                              }}
                              className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              Limpar Todas
                            </button>
                          </div>
                          <div className="text-sm text-gray-500">
                            {Object.values(creativeVisibleColumns).filter(Boolean).length} de {Object.keys(creativeVisibleColumns).length} selecionadas
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default PaidMediaDashboard
