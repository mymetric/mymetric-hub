import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Loader2, CheckCircle, AlertCircle, Maximize2, Minimize2, Download, MessageSquare, Users, ShoppingCart, Package, ArrowDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { api } from '../services/api'
import DateRangePicker from './DateRangePicker'
import WhatsAppTimeline from './WhatsAppTimeline'
import { getDatePresets } from '../utils/dateUtils'

interface WhatsAppFunnelDataItem {
  event_date: string
  message_chat_assign_to_human: number
  message_chat_begin_checkout: number
  message_chat_catalog: number
  message_chat_ended: number
  message_chat_shipping_info: number
  message_chat_started: number
  message_chat_user_inactivity: number
  message_order: number
  messages: number
}

interface WhatsAppFunnelProps {
  selectedTable: string
}

const WhatsAppFunnel = ({ selectedTable }: WhatsAppFunnelProps) => {
  const [data, setData] = useState<WhatsAppFunnelDataItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('idle') // idle, processing, completed, error
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [isLoadingNewData, setIsLoadingNewData] = useState(false)
  const [jobResponse, setJobResponse] = useState<any>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const additionalPollRef = useRef<NodeJS.Timeout | null>(null)
  const currentPollingJobIdRef = useRef<string | null>(null)
  const hasStartedRef = useRef(false)

  // Inicializar datas padrão (últimos 90 dias)
  useEffect(() => {
    if (!startDate || !endDate) {
      const presets = getDatePresets()
      setStartDate(presets.last90days.start)
      setEndDate(presets.last90days.end)
    }
  }, [])

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

  // Função para buscar dados com retry
  const fetchDataWithRetry = useCallback(async (token: string, currentJobId: string, maxRetries = 10, retryDelay = 3000) => {
    console.log('📥 Iniciando busca de dados para job:', currentJobId)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dataResponse = await api.getWhatsAppFunnelData(token, currentJobId)
        console.log('✅ Data fetched successfully:', {
          jobId: currentJobId,
          count: dataResponse?.count,
          dataLength: dataResponse?.data?.length,
          attempt
        })
        
        if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
          const cleanedData = cleanData(dataResponse.data)
          console.log('📊 Dados limpos e prontos para exibição:', {
            count: cleanedData.length,
            jobId: currentJobId,
            sample: cleanedData.slice(0, 2)
          })
          
          if (currentPollingJobIdRef.current && currentPollingJobIdRef.current !== currentJobId) {
            console.log('⚠️ Job ID mudou durante busca de dados, ignorando dados antigos')
            return
          }
          
          console.log('✅ Atualizando dados no estado:', {
            count: cleanedData.length,
            jobId: currentJobId
          })
          setData(cleanedData)
          setStatus('completed')
          setProgress(`Dados carregados: ${dataResponse.count || cleanedData.length} registros`)
          setIsLoading(false)
          setIsLoadingNewData(false)
          console.log('✅ Estado atualizado, dados devem ser renderizados agora')
          return
        } else {
          console.warn('⚠️ Unexpected data structure:', dataResponse)
          setError('Estrutura de dados inesperada. Verifique o console para mais detalhes.')
          setStatus('error')
          setIsLoading(false)
          return
        }
      } catch (error: any) {
        console.error(`❌ Error fetching data (attempt ${attempt}/${maxRetries}):`, error)
        
        if (error?.isRetryable && error?.status === 404 && attempt < maxRetries) {
          setProgress(`Dados ainda não disponíveis, tentando novamente... (${attempt}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar dados'
        setError(errorMessage)
        setStatus('error')
        setIsLoading(false)
        setIsLoadingNewData(false)
        return
      }
    }
    
    setError('Não foi possível buscar os dados após várias tentativas. Tente novamente mais tarde.')
    setStatus('error')
    setIsLoading(false)
    setIsLoadingNewData(false)
  }, [])

  // Função para iniciar o processamento
  const startProcessing = async () => {
    const token = getV2Token()
    if (!token) {
      setError('Token de autenticação não encontrado. Faça login novamente.')
      setStatus('error')
      return
    }

    if (!startDate || !endDate) {
      setError('Por favor, selecione um período de datas.')
      setStatus('error')
      return
    }

    console.log('🔄 Iniciando novo processamento com:', { selectedTable, startDate, endDate })
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setIsLoading(true)
    setIsLoadingNewData(true)
    setStatus('processing')
    setError(null)
    setElapsedSeconds(null)
    setProgress('Iniciando processamento...')
    setJobId(null)
    setData([])

    try {
      const jobResponse = await api.createWhatsAppFunnelJob(token, selectedTable, startDate, endDate)
      console.log('📦 Job Response inicial:', jobResponse)
      console.log('📦 Job ID:', jobResponse.job_id)
      setJobResponse(jobResponse)
      
      if (jobResponse.applied_period) {
        const apiStartDate = jobResponse.applied_period.date_start?.split('T')[0] || jobResponse.applied_period.date_start
        const apiEndDate = jobResponse.applied_period.date_end?.split('T')[0] || jobResponse.applied_period.date_end
        
        const currentStartDate = startDate?.split('T')[0] || startDate
        const currentEndDate = endDate?.split('T')[0] || endDate
        
        if (apiStartDate && apiEndDate && (apiStartDate !== currentStartDate || apiEndDate !== currentEndDate)) {
          console.log('🔄 Atualizando datas baseado no retorno da API:', { 
            apiStartDate, 
            apiEndDate,
            currentStartDate,
            currentEndDate
          })
          setStartDate(apiStartDate)
          setEndDate(apiEndDate)
        }
      }
      
      setJobId(jobResponse.job_id)
      setProgress('Job criado, aguardando processamento...')

      startPolling(jobResponse.job_id, token)
    } catch (error) {
      console.error('Error starting processing:', error)
      setError(error instanceof Error ? error.message : 'Erro ao iniciar processamento')
      setStatus('error')
      setIsLoading(false)
      setIsLoadingNewData(false)
    }
  }

  // Função para fazer polling do status
  const startPolling = (currentJobId: string, token: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (additionalPollRef.current) {
      clearInterval(additionalPollRef.current)
      additionalPollRef.current = null
    }
    
    setIsPolling(true)
    currentPollingJobIdRef.current = currentJobId
    console.log('🔄 Iniciando polling para job:', currentJobId)

    const poll = async () => {
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
        const statusResponse = await api.getWhatsAppFunnelJobStatus(token, currentJobId)
        console.log('📊 Job Status Response:', { 
          jobId: currentJobId, 
          status: statusResponse.status, 
          progress: statusResponse.progress,
          elapsed: statusResponse.elapsed_seconds 
        })
        
        if (currentPollingJobIdRef.current !== currentJobId) {
          console.log('⚠️ Job ID mudou durante processamento da resposta, ignorando')
          return
        }
        
        if (statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null) {
          setElapsedSeconds(statusResponse.elapsed_seconds)
        }
        
        const progressText = statusResponse.progress || 'Processando...'
        const elapsedText = statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null
          ? ` (${Math.round(statusResponse.elapsed_seconds)}s)`
          : ''
        setProgress(`${progressText}${elapsedText}`)

        if (statusResponse.status === 'completed') {
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

          setProgress('Processamento concluído, baixando dados...')
          await fetchDataWithRetry(token, currentJobId)
        } else if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          if (additionalPollRef.current) {
            clearInterval(additionalPollRef.current)
            additionalPollRef.current = null
          }
          setError('O processamento falhou. Tente novamente.')
          setStatus('error')
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }

    poll()
    pollingIntervalRef.current = setInterval(poll, 3000)
    console.log('⏰ Polling configurado para verificar a cada 3 segundos')
    
    additionalPollRef.current = setInterval(async () => {
      if (currentPollingJobIdRef.current !== currentJobId) {
        if (additionalPollRef.current) {
          clearInterval(additionalPollRef.current)
          additionalPollRef.current = null
        }
        return
      }
      
      if (!pollingIntervalRef.current) {
        if (additionalPollRef.current) {
          clearInterval(additionalPollRef.current)
          additionalPollRef.current = null
        }
        return
      }
      try {
        api.getWhatsAppFunnelJobStatus(token, currentJobId)
          .then(statusResponse => {
            if (currentPollingJobIdRef.current !== currentJobId) {
              return
            }
            
            if (statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null) {
              setElapsedSeconds(statusResponse.elapsed_seconds)
            }
            
            if (statusResponse.status === 'completed') {
              if (additionalPollRef.current) {
                clearInterval(additionalPollRef.current)
                additionalPollRef.current = null
              }
              setIsPolling(false)
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
              setProgress('Processamento concluído, baixando dados...')
              fetchDataWithRetry(token, currentJobId)
            } else if (statusResponse.status === 'failed' || statusResponse.status === 'error') {
              if (additionalPollRef.current) {
                clearInterval(additionalPollRef.current)
                additionalPollRef.current = null
              }
              setIsPolling(false)
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
              setError(`Job falhou com status: ${statusResponse.status}`)
              setStatus('error')
              setIsLoading(false)
            } else {
              const progressText = statusResponse.progress || 'Processando...'
              const elapsedText = statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null
                ? ` (${Math.round(statusResponse.elapsed_seconds)}s)`
                : ''
              setProgress(`${progressText}${elapsedText}`)
            }
          })
          .catch(() => {
            // Ignorar erros em requests adicionais
          })
      } catch (error) {
        // Ignorar erros
      }
    }, 2500)
  }

  useEffect(() => {
    if (selectedTable) {
      hasStartedRef.current = false
      setData([])
      setJobResponse(null)
      setStatus('idle')
      setError(null)
    }
  }, [selectedTable])

  useEffect(() => {
    const processKey = `${selectedTable}-${startDate}-${endDate}`
    
    if (selectedTable && startDate && endDate) {
      const lastProcessKey = sessionStorage.getItem('lastWhatsAppFunnelProcess')
      
      if (lastProcessKey !== processKey) {
        console.log('🔄 Nova combinação detectada, iniciando processamento:', { processKey, lastProcessKey })
        hasStartedRef.current = false
        sessionStorage.setItem('lastWhatsAppFunnelProcess', processKey)
        
        setData([])
        setJobResponse(null)
        setJobId(null)
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
      
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        setTimeout(() => {
          startProcessing()
        }, 100)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, startDate, endDate])

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      if (additionalPollRef.current) {
        clearInterval(additionalPollRef.current)
        additionalPollRef.current = null
      }
    }
  }, [])

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) {
      return '0'
    }
    return new Intl.NumberFormat('pt-BR').format(num)
  }

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('pt-BR')
    } catch {
      return dateStr
    }
  }

  const handleDownloadXLSX = () => {
    if (data.length === 0) {
      alert('Não há dados para exportar.')
      return
    }

    try {
      const dataToExport = data.map(item => ({
        'Data': formatDate(item.event_date),
        'Chat Iniciado': item.message_chat_started,
        'Atribuído a Humano': item.message_chat_assign_to_human,
        'Catálogo': item.message_chat_catalog,
        'Iniciar Checkout': item.message_chat_begin_checkout,
        'Informações de Frete': item.message_chat_shipping_info,
        'Pedido': item.message_order,
        'Chat Encerrado': item.message_chat_ended,
        'Inatividade do Usuário': item.message_chat_user_inactivity,
        'Total de Mensagens': item.messages
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dataToExport)

      const colWidths = [
        { wch: 12 }, // Data
        { wch: 15 }, // Chat Iniciado
        { wch: 18 }, // Atribuído a Humano
        { wch: 12 }, // Catálogo
        { wch: 18 }, // Iniciar Checkout
        { wch: 20 }, // Informações de Frete
        { wch: 12 }, // Pedido
        { wch: 15 }, // Chat Encerrado
        { wch: 22 }, // Inatividade do Usuário
        { wch: 20 }  // Total de Mensagens
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Funil WhatsApp')

      const date = new Date()
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const filename = `funil-whatsapp-${selectedTable}-${dateStr}.xlsx`

      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error('Erro ao gerar XLSX:', error)
      alert('Erro ao gerar arquivo Excel. Por favor, tente novamente.')
    }
  }

  const cleanData = (items: WhatsAppFunnelDataItem[]): WhatsAppFunnelDataItem[] => {
    return items.map(item => ({
      ...item,
      message_chat_assign_to_human: isNaN(item.message_chat_assign_to_human) ? 0 : item.message_chat_assign_to_human,
      message_chat_begin_checkout: isNaN(item.message_chat_begin_checkout) ? 0 : item.message_chat_begin_checkout,
      message_chat_catalog: isNaN(item.message_chat_catalog) ? 0 : item.message_chat_catalog,
      message_chat_ended: isNaN(item.message_chat_ended) ? 0 : item.message_chat_ended,
      message_chat_shipping_info: isNaN(item.message_chat_shipping_info) ? 0 : item.message_chat_shipping_info,
      message_chat_started: isNaN(item.message_chat_started) ? 0 : item.message_chat_started,
      message_chat_user_inactivity: isNaN(item.message_chat_user_inactivity) ? 0 : item.message_chat_user_inactivity,
      message_order: isNaN(item.message_order) ? 0 : item.message_order,
      messages: isNaN(item.messages) ? 0 : item.messages
    }))
  }

  // Preparar dados para a timeline do WhatsApp (usando os dados reais)
  const timelineData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    // Mapear e ordenar por data
    const mappedData = data.map(item => ({
      date: item.event_date,
      message_chat_started: item.message_chat_started,
      message_chat_assign_to_human: item.message_chat_assign_to_human,
      message_chat_catalog: item.message_chat_catalog,
      message_chat_begin_checkout: item.message_chat_begin_checkout,
      message_chat_shipping_info: item.message_chat_shipping_info,
      message_order: item.message_order,
      message_chat_ended: item.message_chat_ended,
      message_chat_user_inactivity: item.message_chat_user_inactivity,
      messages: item.messages
    }))
    
    // Ordenar por data (crescente - mais antigo para mais recente)
    return mappedData.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })
  }, [data])

  if (!selectedTable) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Selecione uma tabela</h2>
          <p className="text-gray-600">Por favor, selecione uma tabela no menu superior para visualizar o funil de vendas por WhatsApp.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
      <div className={`bg-white ${isFullscreen ? 'min-h-full' : 'rounded-lg shadow-sm border border-gray-200'}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Funil de Vendas por WhatsApp</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Análise do funil de conversão por WhatsApp
                </p>
              </div>
              {data.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadXLSX}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    title="Baixar dados em Excel"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm">XLSX</span>
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    title={isFullscreen ? 'Sair do modo tela cheia' : 'Modo tela cheia'}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-4 h-4" />
                        <span className="text-sm">Sair</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-4 h-4" />
                        <span className="text-sm">Tela Cheia</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {/* Seletor de Datas */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Período de Análise
                  </label>
                  {jobResponse?.applied_period && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Aplicado: {(() => {
                          try {
                            const start = jobResponse.applied_period.date_start?.split('T')[0] || jobResponse.applied_period.date_start
                            const end = jobResponse.applied_period.date_end?.split('T')[0] || jobResponse.applied_period.date_end
                            return `${new Date(start).toLocaleDateString('pt-BR')} até ${new Date(end).toLocaleDateString('pt-BR')}`
                          } catch (e) {
                            return `${jobResponse.applied_period.date_start} até ${jobResponse.applied_period.date_end}`
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onDateRangeChange={(start, end) => {
                    localStorage.removeItem('lastWhatsAppFunnelProcess')
                    hasStartedRef.current = false
                    setStartDate(start)
                    setEndDate(end)
                    setIsLoadingNewData(true)
                    setStatus('idle')
                    setError(null)
                    setElapsedSeconds(null)
                    setJobResponse(null)
                  }}
                />
                {jobResponse?.applied_period && (
                  <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                    {jobResponse.applied_period.date_column && (
                      <p>
                        <span className="font-medium">Coluna de data:</span> {jobResponse.applied_period.date_column}
                      </p>
                    )}
                    {jobResponse.applied_period.default_period_days && (
                      <p>
                        <span className="font-medium">Período padrão:</span> {jobResponse.applied_period.default_period_days} dias
                      </p>
                    )}
                  </div>
                )}
              </div>

              {(!startDate || !endDate) && !data.length && (
                <div className="text-sm text-gray-500 italic">
                  Selecione um período para iniciar a análise
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        {(isLoading || isPolling || status === 'completed' || isLoadingNewData) && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            {status === 'processing' || isPolling || isLoadingNewData ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {isLoadingNewData && data.length > 0 
                      ? `Atualizando dados... (mantendo dados anteriores até conclusão)`
                      : progress}
                  </p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {jobId && (
                      <p className="text-xs text-gray-500">Job ID: {jobId}</p>
                    )}
                    {elapsedSeconds !== null && (
                      <p className="text-xs text-gray-500">
                        Tempo decorrido: <span className="font-medium">{Math.round(elapsedSeconds)}s</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : status === 'completed' ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{progress}</p>
                  {elapsedSeconds !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                      Processamento concluído em {Math.round(elapsedSeconds)}s
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm font-medium text-red-900">{error}</p>
            </div>
          </div>
        )}

        {/* Funil Visual */}
        {data.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Funil de Vendas por WhatsApp</h3>
              </div>
              
              {(() => {
                // Calcular totais agregados
                const totals = data.reduce((acc, item) => ({
                  chatStarted: acc.chatStarted + item.message_chat_started,
                  assignToHuman: acc.assignToHuman + item.message_chat_assign_to_human,
                  catalog: acc.catalog + item.message_chat_catalog,
                  beginCheckout: acc.beginCheckout + item.message_chat_begin_checkout,
                  shippingInfo: acc.shippingInfo + item.message_chat_shipping_info,
                  order: acc.order + item.message_order,
                  chatEnded: acc.chatEnded + item.message_chat_ended
                }), {
                  chatStarted: 0,
                  assignToHuman: 0,
                  catalog: 0,
                  beginCheckout: 0,
                  shippingInfo: 0,
                  order: 0,
                  chatEnded: 0
                })

                const maxValue = totals.chatStarted

                const funnelSteps = [
                  {
                    name: 'Chat Iniciado',
                    value: totals.chatStarted,
                    percentage: 100,
                    funnelWidth: 100,
                    color: 'from-blue-500 to-blue-600',
                    bgColor: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    icon: MessageSquare
                  },
                  {
                    name: 'Atribuído a Humano',
                    value: totals.assignToHuman,
                    percentage: maxValue > 0 ? (totals.assignToHuman / maxValue) * 100 : 0,
                    funnelWidth: maxValue > 0 ? (totals.assignToHuman / maxValue) * 100 : 0,
                    color: 'from-purple-500 to-purple-600',
                    bgColor: 'bg-purple-100',
                    iconColor: 'text-purple-600',
                    icon: Users
                  },
                  {
                    name: 'Catálogo',
                    value: totals.catalog,
                    percentage: maxValue > 0 ? (totals.catalog / maxValue) * 100 : 0,
                    funnelWidth: maxValue > 0 ? (totals.catalog / maxValue) * 100 : 0,
                    color: 'from-orange-500 to-orange-600',
                    bgColor: 'bg-orange-100',
                    iconColor: 'text-orange-600',
                    icon: Package
                  },
                  {
                    name: 'Iniciar Checkout',
                    value: totals.beginCheckout,
                    percentage: maxValue > 0 ? (totals.beginCheckout / maxValue) * 100 : 0,
                    funnelWidth: maxValue > 0 ? (totals.beginCheckout / maxValue) * 100 : 0,
                    color: 'from-red-500 to-red-600',
                    bgColor: 'bg-red-100',
                    iconColor: 'text-red-600',
                    icon: ShoppingCart
                  },
                  {
                    name: 'Informações de Frete',
                    value: totals.shippingInfo,
                    percentage: maxValue > 0 ? (totals.shippingInfo / maxValue) * 100 : 0,
                    funnelWidth: maxValue > 0 ? (totals.shippingInfo / maxValue) * 100 : 0,
                    color: 'from-cyan-500 to-cyan-600',
                    bgColor: 'bg-cyan-100',
                    iconColor: 'text-cyan-600',
                    icon: Package
                  },
                  {
                    name: 'Pedido',
                    value: totals.order,
                    percentage: maxValue > 0 ? (totals.order / maxValue) * 100 : 0,
                    funnelWidth: maxValue > 0 ? (totals.order / maxValue) * 100 : 0,
                    color: 'from-green-500 to-green-600',
                    bgColor: 'bg-green-100',
                    iconColor: 'text-green-600',
                    icon: CheckCircle
                  }
                ]

                // Calcular taxas de conversão
                const conversionRates = {
                  chatToOrder: totals.chatStarted > 0 ? (totals.order / totals.chatStarted) * 100 : 0,
                  chatToCheckout: totals.chatStarted > 0 ? (totals.beginCheckout / totals.chatStarted) * 100 : 0,
                  checkoutToOrder: totals.beginCheckout > 0 ? (totals.order / totals.beginCheckout) * 100 : 0
                }

                return (
                  <>
                    <div className="flex flex-col items-center space-y-3">
                      {funnelSteps.map((step, index) => {
                        const isLast = index === funnelSteps.length - 1
                        const IconComponent = step.icon
                        
                        return (
                          <div key={index} className="w-full max-w-4xl">
                            {/* Etapa do Funil */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 ${step.bgColor} rounded-lg flex items-center justify-center`}>
                                  <IconComponent className={`w-4 h-4 ${step.iconColor}`} />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm">{step.name}</h4>
                                  <p className="text-xs text-gray-500">Etapa {index + 1} de {funnelSteps.length}</p>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-900">{formatNumber(step.value)}</div>
                                <div className="text-xs text-gray-500">{step.percentage.toFixed(2)}%</div>
                              </div>
                            </div>

                            {/* Barra do Funil */}
                            <div className="relative">
                              <div className="w-full bg-gray-100 rounded-xl h-12 overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${step.color} rounded-xl flex items-center justify-center transition-all duration-1000 ease-out`}
                                  style={{ 
                                    width: `${step.funnelWidth}%`,
                                    minWidth: step.value > 0 ? '40px' : '0px'
                                  }}
                                >
                                  {step.value > 0 && (
                                    <span className="text-white font-bold text-sm px-2">
                                      {formatNumber(step.value)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Indicador de perda */}
                              {!isLast && (
                                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                                  <div className="flex items-center gap-1 text-red-500">
                                    <ArrowDown className="w-3 h-3" />
                                    <span className="text-xs font-medium">
                                      {formatNumber(step.value - (funnelSteps[index + 1]?.value || 0))} perdidos
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Espaçamento entre etapas */}
                            {!isLast && (
                              <div className="flex justify-center mt-6">
                                <div className="w-1 h-6 bg-gradient-to-b from-gray-300 to-gray-100 rounded-full"></div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Resumo do Funil */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Taxa Conversão Geral</h4>
                          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-slate-600 bg-clip-text text-transparent">
                            {conversionRates.chatToOrder.toFixed(2)}%
                          </div>
                          <p className="text-gray-600 text-xs mt-1">
                            {formatNumber(totals.order)} pedidos de {formatNumber(totals.chatStarted)} chats iniciados
                          </p>
                        </div>
                        <div className="text-center">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Taxa Chat → Checkout</h4>
                          <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                            {conversionRates.chatToCheckout.toFixed(2)}%
                          </div>
                          <p className="text-gray-600 text-xs mt-1">
                            {formatNumber(totals.beginCheckout)} checkouts iniciados
                          </p>
                        </div>
                        <div className="text-center">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Taxa Checkout → Pedido</h4>
                          <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {conversionRates.checkoutToOrder.toFixed(2)}%
                          </div>
                          <p className="text-gray-600 text-xs mt-1">
                            {formatNumber(totals.order)} pedidos de {formatNumber(totals.beginCheckout)} checkouts
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* Timeline Chart */}
        {data.length > 0 && timelineData.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-200">
            <WhatsAppTimeline 
              data={timelineData}
              title="Timeline de Métricas WhatsApp"
            />
          </div>
        )}

        {/* Tabela */}
        {data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chat Iniciado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Atribuído a Humano
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catálogo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Iniciar Checkout
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Informações de Frete
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chat Encerrado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inatividade do Usuário
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total de Mensagens
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((item, index) => (
                  <tr key={`${item.event_date}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(item.event_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.message_chat_started)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.message_chat_assign_to_human)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.message_chat_catalog)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.message_chat_begin_checkout)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.message_chat_shipping_info)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600">
                      {formatNumber(item.message_order)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.message_chat_ended)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.message_chat_user_inactivity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      {formatNumber(item.messages)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isPolling && data.length === 0 && !error && status === 'idle' && (
          <div className="px-6 py-12 text-center">
            <div className="max-w-md mx-auto">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aguardando processamento</h3>
              <p className="text-gray-500 mb-4">
                {!selectedTable 
                  ? 'Selecione uma tabela para iniciar a análise.'
                  : !startDate || !endDate
                  ? 'Selecione um período de datas para iniciar a análise.'
                  : 'O processamento será iniciado automaticamente. Aguarde...'}
              </p>
              {selectedTable && startDate && endDate && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Tabela:</strong> {selectedTable}
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    <strong>Período:</strong> {new Date(startDate).toLocaleDateString('pt-BR')} até {new Date(endDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WhatsAppFunnel

