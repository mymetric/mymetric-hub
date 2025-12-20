import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { 
  DollarSign, 
  Loader2,
  CheckCircle,
  TrendingUp,
  Users,
  Search,
  Filter,
  Download,
  X
} from 'lucide-react'
import { api } from '../services/api'
import { InfluencerData } from '../types'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { parseDateString, compareDateStrings, getDatePresets } from '../utils/dateUtils'
import InfluencersTimeline from './InfluencersTimeline'
import SortableHeader from './SortableHeader'

interface InfluencersDashboardProps {
  startDate: string
  endDate: string
  token: string
}

const InfluencersDashboard = ({ startDate, endDate, token }: InfluencersDashboardProps) => {
  const [allInfluencerData, setAllInfluencerData] = useState<InfluencerData[]>([])
  const [filteredData, setFilteredData] = useState<InfluencerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<string>('gross_value')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)
  const [selectedInfluencer, setSelectedInfluencer] = useState<string | null>(null)
  
  // Estados para job/polling
  const [jobId, setJobId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [jobStatus, setJobStatus] = useState<string>('idle')
  const [jobProgress, setJobProgress] = useState<string>('')
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentPollingJobIdRef = useRef<string | null>(null)
  const isProcessingRef = useRef<boolean>(false)

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

  // Função para converter valores para número
  const toNumber = (value: any): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'number') return isNaN(value) ? 0 : value
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  // Função para filtrar dados por intervalo de datas
  const filterDataByDateRange = useCallback((data: InfluencerData[], start: string, end: string) => {
    if (!start || !end) {
      setFilteredData(data)
      return
    }
    
    const filtered = data.filter(item => {
      if (!item.event_date) return false
      const itemDate = item.event_date
      return itemDate >= start && itemDate <= end
    })
    
    setFilteredData(filtered)
  }, [])

  // Função para buscar dados com retry
  const fetchDataWithRetry = useCallback(async (token: string, currentJobId: string, maxRetries = 10, retryDelay = 3000) => {
    console.log('📥 Iniciando busca de dados de influencers para job:', currentJobId)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dataResponse = await api.getInfluencersData(token, currentJobId)
        console.log('✅ Data fetched successfully:', {
          jobId: currentJobId,
          count: dataResponse?.count,
          dataLength: dataResponse?.data?.length,
          attempt
        })
        
        if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
          // Verificar se o jobId ainda é o mesmo antes de atualizar os dados
          if (currentPollingJobIdRef.current && currentPollingJobIdRef.current !== currentJobId) {
            console.log('⚠️ Job ID mudou durante busca de dados, ignorando dados antigos')
            return
          }
          
          // Armazenar todos os dados (últimos 90 dias)
          setAllInfluencerData(dataResponse.data)
          
          // Filtrar por data se necessário (startDate e endDate)
          if (startDate && endDate) {
            filterDataByDateRange(dataResponse.data, startDate, endDate)
          } else {
            setFilteredData(dataResponse.data)
          }
          
          setJobStatus('completed')
          setJobProgress(`Dados carregados: ${dataResponse.count || dataResponse.data.length} registros`)
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
          clearInterval(pollingIntervalRef.current as any)
          pollingIntervalRef.current = null
        }
        return
      }
      
      try {
        const statusResponse = await api.getInfluencersJobStatus(token, currentJobId)
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
            clearInterval(pollingIntervalRef.current as any)
            pollingIntervalRef.current = null
          }

          setJobProgress('Processamento concluído, baixando dados...')
          await fetchDataWithRetry(token, currentJobId)
        } else if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
          // Job falhou
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current as any)
            pollingIntervalRef.current = null
          }
          setJobStatus('error')
          setIsLoading(false)
        }
        // Se ainda está processando, continua o polling
      } catch (error) {
        console.error('Error polling status:', error)
        // Não para o polling em caso de erro temporário - continua tentando
      }
    }

    // Executar primeira verificação imediatamente
    poll().catch(err => console.error('Error in initial poll:', err))
    
    // Configurar polling principal a cada 3 segundos
    // Usar window.setInterval para garantir compatibilidade
    pollingIntervalRef.current = window.setInterval(() => {
      poll().catch(err => console.error('Error in polling interval:', err))
    }, 3000) as any
    console.log('⏰ Polling configurado para verificar a cada 3 segundos')
  }, [fetchDataWithRetry])

  // Função para iniciar o processamento
  const startProcessing = useCallback(async () => {
    // Proteção contra múltiplas execuções simultâneas
    if (isProcessingRef.current) {
      console.log('⚠️ Processamento já em andamento, ignorando chamada duplicada')
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

    // Limpar dados e estado antes de iniciar novo processamento
    console.log('🔄 Iniciando novo processamento de influencers')
    
    // Parar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current as any)
      pollingIntervalRef.current = null
    }
    
    setIsLoading(true)
    setJobStatus('processing')
    setJobProgress('Iniciando processamento...')
    setElapsedSeconds(null)
    setJobId(null)
    setAllInfluencerData([])
    setFilteredData([])

    try {
      // Criar o job (sempre busca últimos 90 dias)
      const jobResponse = await api.createInfluencersJob(token, 'iwannasleep')
      console.log('📦 Job Response inicial:', jobResponse)
      console.log('📦 Job ID:', jobResponse.job_id)
      
      setJobId(jobResponse.job_id)
      setJobProgress('Job criado, aguardando processamento...')

      // Iniciar polling
      startPolling(jobResponse.job_id, token)
      
      // Resetar flag após um delay
      setTimeout(() => {
        isProcessingRef.current = false
      }, 2000)
    } catch (error) {
      console.error('Error starting processing:', error)
      setJobStatus('error')
      setIsLoading(false)
      isProcessingRef.current = false
    }
  }, [startPolling])

  // Efeito para iniciar processamento quando o componente montar
  useEffect(() => {
    startProcessing()
    
    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current as any)
        pollingIntervalRef.current = null
      }
    }
  }, []) // Executar apenas uma vez ao montar

  // Efeito para filtrar dados quando startDate/endDate mudarem
  useEffect(() => {
    if (allInfluencerData.length > 0 && startDate && endDate) {
      filterDataByDateRange(allInfluencerData, startDate, endDate)
    } else if (allInfluencerData.length > 0) {
      setFilteredData(allInfluencerData)
    }
  }, [startDate, endDate, allInfluencerData, filterDataByDateRange])

  // Obter tipos únicos de influenciadores
  const influencerTypes = useMemo(() => {
    const types = new Set<string>()
    filteredData.forEach(item => {
      if (item.type) {
        types.add(item.type)
      }
    })
    return Array.from(types).sort()
  }, [filteredData])

  // Filtrar dados por tipo
  const dataFilteredByType = useMemo(() => {
    if (selectedTypes.length === 0) return filteredData
    return filteredData.filter(item => item.type && selectedTypes.includes(item.type))
  }, [filteredData, selectedTypes])

  // Calcular totais
  const totals = useMemo(() => {
    return dataFilteredByType.reduce((acc, item) => ({
      gross_value: acc.gross_value + toNumber(item.gross_value),
      net_value: acc.net_value + toNumber(item.net_value),
      transactions: acc.transactions + 1
    }), {
      gross_value: 0,
      net_value: 0,
      transactions: 0
    })
  }, [dataFilteredByType])

  // Agrupar por influenciador
  const influencerResults = useMemo(() => {
    const grouped = dataFilteredByType.reduce((acc, item) => {
      const influencerName = item.influencer_name || 'Sem nome'
      if (!acc[influencerName]) {
        acc[influencerName] = {
          influencer_name: influencerName,
          gross_value: 0,
          net_value: 0,
          transactions: 0
        }
      }
      acc[influencerName].gross_value += toNumber(item.gross_value)
      acc[influencerName].net_value += toNumber(item.net_value)
      acc[influencerName].transactions += 1
      return acc
    }, {} as Record<string, { 
      influencer_name: string
      gross_value: number
      net_value: number
      transactions: number
    }>)

    return Object.values(grouped)
  }, [dataFilteredByType])

  // Dados agrupados por source e medium para o influenciador selecionado
  const influencerDrilldown = useMemo(() => {
    if (!selectedInfluencer) return null

    const influencerData = dataFilteredByType.filter(item => item.influencer_name === selectedInfluencer)
    
    // Agrupar por source e medium
    const grouped = influencerData.reduce((acc, item) => {
      const source = item.source || 'Sem origem'
      const medium = item.medium || 'Sem mídia'
      const key = `${source}|||${medium}`
      
      if (!acc[key]) {
        acc[key] = {
          source,
          medium,
          gross_value: 0,
          net_value: 0,
          transactions: 0
        }
      }
      
      acc[key].gross_value += toNumber(item.gross_value)
      acc[key].net_value += toNumber(item.net_value)
      acc[key].transactions += 1
      
      return acc
    }, {} as Record<string, {
      source: string
      medium: string
      gross_value: number
      net_value: number
      transactions: number
    }>)

    return Object.values(grouped).sort((a, b) => b.gross_value - a.gross_value)
  }, [selectedInfluencer, dataFilteredByType])

  // Dados filtrados e ordenados
  const sortedInfluencerResults = useMemo(() => {
    const filtered = influencerResults.filter(item => {
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      return item.influencer_name.toLowerCase().includes(searchLower)
    })

    return filtered.sort((a, b) => {
      const aValue = a[sortField as keyof typeof a] as number
      const bValue = b[sortField as keyof typeof b] as number
      
      if (sortDirection === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })
  }, [influencerResults, searchTerm, sortField, sortDirection])

  // Limitar linhas exibidas
  const displayedResults = useMemo(() => {
    if (showAllRows) return sortedInfluencerResults
    return sortedInfluencerResults.slice(0, 25)
  }, [sortedInfluencerResults, showAllRows])

  // Preparar dados para timeline (filtrado por influenciador se selecionado)
  const timelineData = useMemo(() => {
    let dataToProcess = dataFilteredByType
    
    // Filtrar por influenciador selecionado se houver
    if (selectedInfluencer) {
      dataToProcess = dataFilteredByType.filter(item => item.influencer_name === selectedInfluencer)
    }
    
    const grouped = dataToProcess.reduce((acc, item) => {
      if (!item.event_date) return acc
      const date = item.event_date
      if (!acc[date]) {
        acc[date] = {
          date,
          gross_value: 0,
          net_value: 0,
          transactions: 0
        }
      }
      acc[date].gross_value += toNumber(item.gross_value)
      acc[date].net_value += toNumber(item.net_value)
      acc[date].transactions += 1
      return acc
    }, {} as Record<string, { date: string; gross_value: number; net_value: number; transactions: number }>)

    return Object.values(grouped)
      .sort((a, b) => compareDateStrings(a.date, b.date))
  }, [dataFilteredByType, selectedInfluencer])

  // Título dinâmico
  useDocumentTitle(
    isLoading 
      ? '🔄 Carregando... - Influencers' 
      : `💰 R$ ${totals.gross_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - Influencers`
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Função para exportar dados brutos em XLSX
  const handleExportXLSX = () => {
    try {
      // Preparar dados brutos para exportação
      const dataToExport = dataFilteredByType.map(item => ({
        'Data do Evento': item.event_date || '',
        'Data de Criação': item.created_at || '',
        'ID da Transação': item.transaction_id || '',
        'Valor Bruto': toNumber(item.gross_value),
        'Valor Líquido': toNumber(item.net_value),
        'Source': item.source || '',
        'Medium': item.medium || '',
        'Nome do Influenciador': item.influencer_name || '',
        'Cupom': item.coupon || '',
        'Tipo': item.type || '',
        'YouTube': item.youtube || '',
        'Instagram': item.instagram || '',
        'TikTok': item.tiktok || ''
      }))

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dataToExport)

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 12 }, // Data do Evento
        { wch: 20 }, // Data de Criação
        { wch: 20 }, // ID da Transação
        { wch: 15 }, // Valor Bruto
        { wch: 15 }, // Valor Líquido
        { wch: 15 }, // Source
        { wch: 15 }, // Medium
        { wch: 30 }, // Nome do Influenciador
        { wch: 15 }, // Cupom
        { wch: 15 }, // Tipo
        { wch: 20 }, // YouTube
        { wch: 20 }, // Instagram
        { wch: 20 }  // TikTok
      ]
      ws['!cols'] = colWidths

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Dados Influencers')

      // Gerar nome do arquivo com data
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `influencers_${dateStr}.xlsx`

      // Fazer download
      XLSX.writeFile(wb, fileName)
      
      console.log('✅ Arquivo XLSX exportado com sucesso:', fileName)
    } catch (error) {
      console.error('❌ Erro ao exportar XLSX:', error)
      alert('Erro ao exportar arquivo. Tente novamente.')
    }
  }

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showTypeFilter && !target.closest('.type-filter-container')) {
        setShowTypeFilter(false)
      }
    }

    if (showTypeFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showTypeFilter])

  return (
    <div className="space-y-6">
      {/* Status de Carregamento */}
      {(isLoading || isPolling) && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {isPolling ? 'Processando dados...' : 'Carregando dados...'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{jobProgress}</p>
              {elapsedSeconds !== null && (
                <p className="text-xs text-gray-500 mt-1">
                  Tempo decorrido: {Math.round(elapsedSeconds)}s
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Totais Gerais */}
      {!isLoading && filteredData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Bruto Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(totals.gross_value)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Líquido Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(totals.net_value)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Transações</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {totals.transactions.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {!isLoading && timelineData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              📈 Timeline de Performance
              {selectedInfluencer && (
                <span className="ml-2 text-sm font-normal text-blue-600">
                  - {selectedInfluencer}
                </span>
              )}
            </h3>
            {selectedInfluencer && (
              <button
                onClick={() => setSelectedInfluencer(null)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Limpar filtro
              </button>
            )}
          </div>
          <InfluencersTimeline
            data={timelineData}
            title=""
          />
        </div>
      )}

      {/* Resultado por Influenciador */}
      {!isLoading && filteredData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Resultado por Influenciador</h3>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Tags de tipos selecionados */}
              {selectedTypes.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedTypes.map(type => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                    >
                      {type}
                      <button
                        onClick={() => setSelectedTypes(selectedTypes.filter(t => t !== type))}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Filtro por Tipo - Multi-select */}
              {influencerTypes.length > 0 && (
                <div className="relative type-filter-container">
                  <button
                    onClick={() => setShowTypeFilter(!showTypeFilter)}
                    className={`flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium transition-colors ${
                      selectedTypes.length > 0
                        ? 'bg-blue-50 text-blue-700 border-blue-500'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span>Tipo</span>
                    {selectedTypes.length > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                        {selectedTypes.length}
                      </span>
                    )}
                    <svg 
                      className={`w-4 h-4 transition-transform ${showTypeFilter ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown de Tipos */}
                  {showTypeFilter && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900">Filtrar por Tipo</h4>
                          <button
                            onClick={() => {
                              setSelectedTypes([])
                              setShowTypeFilter(false)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Limpar
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            if (selectedTypes.length === influencerTypes.length) {
                              setSelectedTypes([])
                            } else {
                              setSelectedTypes([...influencerTypes])
                            }
                          }}
                          className="text-xs text-gray-600 hover:text-gray-700"
                        >
                          {selectedTypes.length === influencerTypes.length ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                      </div>
                      <div className="p-2">
                        {influencerTypes.map(type => (
                          <label
                            key={type}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTypes.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTypes([...selectedTypes, type])
                                } else {
                                  setSelectedTypes(selectedTypes.filter(t => t !== type))
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                            />
                            <span className="text-sm text-gray-700">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Busca */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar influenciador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Botão de Exportação */}
              <button
                onClick={handleExportXLSX}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Exportar XLSX
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <SortableHeader
                    field="influencer_name"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="text-left py-3 px-4 font-semibold text-gray-700"
                  >
                    Influenciador
                  </SortableHeader>
                  <SortableHeader
                    field="gross_value"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="text-right py-3 px-4 font-semibold text-gray-700"
                  >
                    Valor Bruto
                  </SortableHeader>
                  <SortableHeader
                    field="net_value"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="text-right py-3 px-4 font-semibold text-gray-700"
                  >
                    Valor Líquido
                  </SortableHeader>
                  <SortableHeader
                    field="transactions"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="text-right py-3 px-4 font-semibold text-gray-700"
                  >
                    Transações
                  </SortableHeader>
                </tr>
              </thead>
              <tbody>
                {displayedResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      Nenhum influenciador encontrado
                    </td>
                  </tr>
                ) : (
                  displayedResults.map((item, index) => (
                    <React.Fragment key={index}>
                      <tr 
                        key={index} 
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedInfluencer === item.influencer_name ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => {
                          if (selectedInfluencer === item.influencer_name) {
                            setSelectedInfluencer(null)
                          } else {
                            setSelectedInfluencer(item.influencer_name)
                          }
                        }}
                      >
                        <td className="py-3 px-4 text-gray-900 font-medium">
                          <div className="flex items-center gap-2">
                            {selectedInfluencer === item.influencer_name ? (
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                            {item.influencer_name}
                            {selectedInfluencer === item.influencer_name && (
                              <span className="ml-2 text-blue-600 text-xs">✓ Selecionado</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 font-medium">
                          {formatCurrency(item.gross_value)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 font-medium">
                          {formatCurrency(item.net_value)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {item.transactions.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                      {/* Drilldown - Origem e Mídia */}
                      {selectedInfluencer === item.influencer_name && influencerDrilldown && influencerDrilldown.length > 0 && (
                        <tr key={`${index}-drilldown`} className="bg-blue-50/30">
                          <td colSpan={4} className="py-4 px-4">
                            <div className="bg-white rounded-lg border border-blue-200 p-4">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                                Origem e Mídia - {item.influencer_name}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Origem (Source)</th>
                                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Mídia (Medium)</th>
                                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Valor Bruto</th>
                                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Valor Líquido</th>
                                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Transações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {influencerDrilldown.map((drillItem, drillIndex) => (
                                      <tr key={drillIndex} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-2 px-3 text-gray-900">{drillItem.source}</td>
                                        <td className="py-2 px-3 text-gray-900">{drillItem.medium}</td>
                                        <td className="py-2 px-3 text-right text-gray-900 font-medium">
                                          {formatCurrency(drillItem.gross_value)}
                                        </td>
                                        <td className="py-2 px-3 text-right text-gray-900 font-medium">
                                          {formatCurrency(drillItem.net_value)}
                                        </td>
                                        <td className="py-2 px-3 text-right text-gray-600">
                                          {drillItem.transactions.toLocaleString('pt-BR')}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Botão Ver Mais / Ver Menos */}
          {sortedInfluencerResults.length > 25 && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowAllRows(!showAllRows)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                {showAllRows ? (
                  <>
                    <span>Ver Menos</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    <span>Ver Mais ({sortedInfluencerResults.length - 25} restantes)</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Informação de total */}
          {sortedInfluencerResults.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Mostrando {displayedResults.length} de {sortedInfluencerResults.length} influenciadores
            </div>
          )}
        </div>
      )}

      {/* Mensagem quando não há dados */}
      {!isLoading && dataFilteredByType.length === 0 && filteredData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <p className="text-gray-500">Nenhum dado encontrado para o tipo selecionado.</p>
        </div>
      )}

      {/* Mensagem quando não há dados */}
      {!isLoading && filteredData.length === 0 && allInfluencerData.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <p className="text-gray-500">Nenhum dado disponível para o período selecionado.</p>
        </div>
      )}
    </div>
  )
}

export default InfluencersDashboard

