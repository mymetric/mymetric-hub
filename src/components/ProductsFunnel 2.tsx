import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Loader2, CheckCircle, AlertCircle, Maximize2, Minimize2, Download, Search, X, Filter } from 'lucide-react'
import * as XLSX from 'xlsx'
import { api } from '../services/api'
import DateRangePicker from './DateRangePicker'
import { getDatePresets, formatDateToString } from '../utils/dateUtils'

interface ProductsFunnelDataItem {
  add_payment_info: number
  add_shipping_info: number
  add_to_cart: number
  begin_checkout: number
  item_category: string
  item_id: string
  item_name: string
  purchase: number
  revenue: number
  view_item: number
}

interface ProductsFunnelProps {
  selectedTable: string
}

const ProductsFunnel = ({ selectedTable }: ProductsFunnelProps) => {
  const [data, setData] = useState<ProductsFunnelDataItem[]>([])
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
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isLoadingNewData, setIsLoadingNewData] = useState(false) // Flag para indicar que novos dados estão sendo carregados
  const [jobResponse, setJobResponse] = useState<any>(null) // Armazenar resposta inicial do job
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const additionalPollRef = useRef<NodeJS.Timeout | null>(null)
  const currentPollingJobIdRef = useRef<string | null>(null) // Ref para armazenar o jobId atual do polling
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
        const dataResponse = await api.getProductsFunnelData(token, currentJobId)
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
            sample: cleanedData.slice(0, 2),
            firstItem: cleanedData[0]
          })
          
          // Verificar se o jobId ainda é o mesmo antes de atualizar os dados
          // Usar a ref em vez do estado para verificação mais confiável
          // Mas só verificar se a ref estiver definida (pode não estar no primeiro carregamento)
          if (currentPollingJobIdRef.current && currentPollingJobIdRef.current !== currentJobId) {
            console.log('⚠️ Job ID mudou durante busca de dados, ignorando dados antigos:', { 
              currentJobId, 
              currentJobIdInRef: currentPollingJobIdRef.current 
            })
            return
          }
          
          // Sempre substituir dados - não manter dados antigos
          console.log('✅ Atualizando dados no estado:', {
            count: cleanedData.length,
            jobId: currentJobId,
            firstItem: cleanedData[0] ? {
              name: cleanedData[0].item_name,
              category: cleanedData[0].item_category,
              views: cleanedData[0].view_item
            } : null
          })
          setData(cleanedData)
          setStatus('completed')
          setProgress(`Dados carregados: ${dataResponse.count || cleanedData.length} produtos`)
          setIsLoading(false)
          setIsLoadingNewData(false) // Indicar que novos dados foram carregados
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
        setIsLoadingNewData(false) // Parar indicador de carregamento em caso de erro
        return
      }
    }
    
    setError('Não foi possível buscar os dados após várias tentativas. Tente novamente mais tarde.')
    setStatus('error')
    setIsLoading(false)
    setIsLoadingNewData(false) // Parar indicador de carregamento em caso de erro
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

    // Limpar dados e estado antes de iniciar novo processamento
    console.log('🔄 Iniciando novo processamento com:', { selectedTable, startDate, endDate })
    
    // Parar qualquer polling anterior
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
    setJobId(null) // Limpar jobId anterior
    setData([]) // Limpar dados anteriores para garantir que novos dados sejam exibidos

    try {
      // Criar o job com datas
      const jobResponse = await api.createProductsFunnelJob(token, selectedTable, startDate, endDate)
      console.log('📦 Job Response inicial:', jobResponse)
      console.log('📦 Job ID:', jobResponse.job_id)
      setJobResponse(jobResponse) // Armazenar resposta completa
      
      // Se a API retornou um período aplicado diferente, atualizar as datas
      if (jobResponse.applied_period) {
        // Extrair apenas a parte da data (YYYY-MM-DD) se vier com hora
        const apiStartDate = jobResponse.applied_period.date_start?.split('T')[0] || jobResponse.applied_period.date_start
        const apiEndDate = jobResponse.applied_period.date_end?.split('T')[0] || jobResponse.applied_period.date_end
        
        // Comparar apenas a parte da data (sem hora)
        const currentStartDate = startDate?.split('T')[0] || startDate
        const currentEndDate = endDate?.split('T')[0] || endDate
        
        // Atualizar apenas se as datas forem diferentes
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

      // Iniciar polling
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
    
    // Armazenar o jobId atual na ref para verificação durante o polling
    currentPollingJobIdRef.current = currentJobId
    console.log('🔄 Iniciando polling para job:', currentJobId)

    const poll = async () => {
      // Verificar se o jobId ainda é o mesmo usando a ref
      if (currentPollingJobIdRef.current !== currentJobId) {
        console.log('⚠️ Job ID mudou durante polling, parando polling antigo:', { 
          pollingJobId: currentJobId, 
          currentJobIdInRef: currentPollingJobIdRef.current 
        })
        setIsPolling(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        return
      }
      
      try {
        const statusResponse = await api.getProductsFunnelJobStatus(token, currentJobId)
        console.log('📊 Job Status Response:', { 
          jobId: currentJobId, 
          status: statusResponse.status, 
          progress: statusResponse.progress,
          elapsed: statusResponse.elapsed_seconds 
        })
        
        // Verificar novamente se o jobId ainda é o mesmo antes de processar
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
        setProgress(`${progressText}${elapsedText}`)

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

          setProgress('Processamento concluído, baixando dados...')
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
          setError('O processamento falhou. Tente novamente.')
          setStatus('error')
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
    
    // Fazer requests adicionais em paralelo enquanto estiver processando (menos frequente)
    additionalPollRef.current = setInterval(async () => {
      // Verificar se o jobId ainda é o mesmo usando a ref
      if (currentPollingJobIdRef.current !== currentJobId) {
        console.log('⚠️ Job ID mudou, parando polling adicional:', { 
          pollingJobId: currentJobId, 
          currentJobIdInRef: currentPollingJobIdRef.current 
        })
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
        // Fazer request adicional sem aguardar
        api.getProductsFunnelJobStatus(token, currentJobId)
          .then(statusResponse => {
            // Verificar novamente se o jobId ainda é o mesmo
            if (currentPollingJobIdRef.current !== currentJobId) {
              console.log('⚠️ Job ID mudou durante polling adicional, ignorando resposta')
              return
            }
            
            // Atualizar elapsed_seconds se disponível
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
              // Formatar progresso com tempo decorrido
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
    }, 2500) // Request adicional a cada 2.5 segundos (espaçado)
  }

  // Iniciar processamento automaticamente ao montar o componente (apenas quando datas estiverem prontas)
  useEffect(() => {
    // Resetar hasStartedRef quando selectedTable mudar
    if (selectedTable) {
      hasStartedRef.current = false
      // Limpar dados e estado quando a tabela mudar
      setData([])
      setJobResponse(null)
      setStatus('idle')
      setError(null)
    }
  }, [selectedTable])

  useEffect(() => {
    // Criar uma chave única baseada nas dependências para garantir que um novo processamento seja iniciado
    const processKey = `${selectedTable}-${startDate}-${endDate}`
    
    if (selectedTable && startDate && endDate) {
      // Verificar se já processamos para esta combinação específica
      const lastProcessKey = sessionStorage.getItem('lastProductsFunnelProcess')
      
      // Se a chave mudou, significa que as datas ou tabela mudaram - iniciar novo processamento
      if (lastProcessKey !== processKey) {
        console.log('🔄 Nova combinação detectada, iniciando processamento:', { processKey, lastProcessKey })
        hasStartedRef.current = false
        sessionStorage.setItem('lastProductsFunnelProcess', processKey)
        
        // Limpar dados antigos antes de iniciar novo processamento
        setData([])
        setJobResponse(null)
        setJobId(null)
        
        // Parar qualquer polling anterior
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
      
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        // Pequeno delay para garantir que o componente está totalmente renderizado
        setTimeout(() => {
          startProcessing()
        }, 100)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, startDate, endDate])

  // Limpar polling ao desmontar
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

  // Formatar número (trata NaN e null)
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) {
      return '0'
    }
    return new Intl.NumberFormat('pt-BR').format(num)
  }

  // Formatar moeda (trata NaN e null)
  const formatCurrency = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) {
      return 'R$ 0,00'
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num)
  }

  // Calcular taxa de conversão (compras / visualizações * 100)
  const calculateConversionRate = (purchases: number, views: number): number => {
    if (!views || views === 0 || isNaN(views) || isNaN(purchases)) {
      return 0
    }
    return (purchases / views) * 100
  }

  // Calcular taxa de conversão entre duas etapas
  const calculateStepConversionRate = (current: number, previous: number): number => {
    if (!previous || previous === 0 || isNaN(previous) || isNaN(current)) {
      return 0
    }
    return (current / previous) * 100
  }

  // Formatar percentual
  const formatPercentage = (num: number): string => {
    if (isNaN(num) || num === null || num === undefined) {
      return '0,00%'
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num / 100)
  }
  
  // Função para download XLSX
  const handleDownloadXLSX = () => {
    if (data.length === 0) {
      alert('Não há dados para exportar.')
      return
    }

    try {
      // Preparar dados para exportação com taxas calculadas
      const dataToExport = data.map(item => {
        const viewToCart = calculateStepConversionRate(item.add_to_cart, item.view_item)
        const cartToCheckout = calculateStepConversionRate(item.begin_checkout, item.add_to_cart)
        const checkoutToShipping = calculateStepConversionRate(item.add_shipping_info, item.begin_checkout)
        const shippingToPayment = calculateStepConversionRate(item.add_payment_info, item.add_shipping_info)
        const paymentToPurchase = calculateStepConversionRate(item.purchase, item.add_payment_info)
        const overallConversion = calculateConversionRate(item.purchase, item.view_item)

        return {
          'Produto': item.item_name,
          'Categoria': item.item_category,
          'ID do Produto': item.item_id,
          'Visualizações': item.view_item,
          'Adicionar ao Carrinho': item.add_to_cart,
          'Taxa Visualização → Carrinho (%)': viewToCart.toFixed(2),
          'Iniciar Checkout': item.begin_checkout,
          'Taxa Carrinho → Checkout (%)': cartToCheckout.toFixed(2),
          'Adicionar Frete': item.add_shipping_info,
          'Taxa Checkout → Frete (%)': checkoutToShipping.toFixed(2),
          'Adicionar Pagamento': item.add_payment_info,
          'Taxa Frete → Pagamento (%)': shippingToPayment.toFixed(2),
          'Compras': item.purchase,
          'Taxa Pagamento → Compra (%)': paymentToPurchase.toFixed(2),
          'Taxa de Conversão (%)': overallConversion.toFixed(2),
          'Receita (R$)': item.revenue
        }
      })

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dataToExport)

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 50 }, // Produto
        { wch: 30 }, // Categoria
        { wch: 20 }, // ID do Produto
        { wch: 15 }, // Visualizações
        { wch: 20 }, // Adicionar ao Carrinho
        { wch: 25 }, // Taxa Visualização → Carrinho
        { wch: 18 }, // Iniciar Checkout
        { wch: 25 }, // Taxa Carrinho → Checkout
        { wch: 18 }, // Adicionar Frete
        { wch: 25 }, // Taxa Checkout → Frete
        { wch: 20 }, // Adicionar Pagamento
        { wch: 25 }, // Taxa Frete → Pagamento
        { wch: 12 }, // Compras
        { wch: 25 }, // Taxa Pagamento → Compra
        { wch: 20 }, // Taxa de Conversão
        { wch: 18 }  // Receita
      ]
      ws['!cols'] = colWidths

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Funil de Produtos')

      // Gerar nome do arquivo
      const date = new Date()
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const filename = `funil-produtos-${selectedTable}-${dateStr}.xlsx`

      // Fazer download
      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error('Erro ao gerar XLSX:', error)
      alert('Erro ao gerar arquivo Excel. Por favor, tente novamente.')
    }
  }

  // Limpar dados: substituir NaN por null
  const cleanData = (items: ProductsFunnelDataItem[]): ProductsFunnelDataItem[] => {
    return items.map(item => ({
      ...item,
      add_payment_info: isNaN(item.add_payment_info) ? 0 : item.add_payment_info,
      add_shipping_info: isNaN(item.add_shipping_info) ? 0 : item.add_shipping_info,
      add_to_cart: isNaN(item.add_to_cart) ? 0 : item.add_to_cart,
      begin_checkout: isNaN(item.begin_checkout) ? 0 : item.begin_checkout,
      purchase: isNaN(item.purchase) ? 0 : item.purchase,
      revenue: isNaN(item.revenue) ? 0 : item.revenue,
      view_item: isNaN(item.view_item) ? 0 : item.view_item,
      item_category: item.item_category === null || item.item_category === undefined || (typeof item.item_category === 'number' && isNaN(item.item_category)) ? '(not set)' : String(item.item_category),
      item_id: item.item_id === null || item.item_id === undefined || item.item_id === 'undefined' ? '(not set)' : String(item.item_id),
      item_name: item.item_name === null || item.item_name === undefined || item.item_name === '(not set)' ? '(not set)' : String(item.item_name)
    }))
  }

  // Extrair categorias únicas dos dados
  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>()
    data.forEach(item => {
      if (item.item_category && item.item_category !== '(not set)') {
        uniqueCategories.add(item.item_category)
      }
    })
    return Array.from(uniqueCategories).sort()
  }, [data])

  // Resetar filtro de categoria se a categoria selecionada não existir mais
  useEffect(() => {
    if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
      setSelectedCategory('all')
    }
  }, [categories, selectedCategory])

  // Filtrar dados por termo de busca e categoria
  const filteredData = useMemo(() => {
    console.log('🔍 Filtrando dados:', { 
      dataLength: data.length, 
      searchTerm, 
      selectedCategory 
    })
    
    let filtered = data

    // Filtro por categoria
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.item_category === selectedCategory)
    }

    // Filtro por termo de busca
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(item => {
        return (
          item.item_name?.toLowerCase().includes(searchLower) ||
          item.item_category?.toLowerCase().includes(searchLower) ||
          item.item_id?.toLowerCase().includes(searchLower)
        )
      })
    }

    console.log('🔍 Dados filtrados:', { 
      originalLength: data.length, 
      filteredLength: filtered.length 
    })
    
    return filtered
  }, [data, searchTerm, selectedCategory])

  // Se não há selectedTable, mostrar mensagem
  if (!selectedTable) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Selecione uma tabela</h2>
          <p className="text-gray-600">Por favor, selecione uma tabela no menu superior para visualizar o funil de produtos.</p>
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
                <h2 className="text-2xl font-bold text-gray-900">Funil de Produtos</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Análise do funil de conversão por produto
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
            
            {/* Seletor de Datas e Filtros */}
            <div className="space-y-4">
              {/* Período de Análise */}
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
                    // Limpar a chave de processamento para forçar novo processamento
                    localStorage.removeItem('lastProductsFunnelProcess')
                    hasStartedRef.current = false
                    setStartDate(start)
                    setEndDate(end)
                    // Resetar para permitir novo processamento com novas datas
                    setIsLoadingNewData(true) // Indicar que novos dados estão sendo carregados
                    setStatus('idle')
                    setError(null)
                    setElapsedSeconds(null)
                    setJobResponse(null) // Limpar resposta anterior
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

              {/* Filtros de Produtos - Só aparece quando há dados */}
              {data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                  {/* Filtro de Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria
                    </label>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white cursor-pointer transition-colors hover:border-gray-400"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.75rem center',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="all">Todas as categorias</option>
                        {categories.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Busca */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Buscar Produtos
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nome, categoria ou ID..."
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors hover:border-gray-400"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Limpar busca"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Contador de resultados */}
              {data.length > 0 && (searchTerm || selectedCategory !== 'all') && (
                <div className="pt-2">
                  <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg inline-block">
                    <span className="font-medium text-gray-700">{filteredData.length}</span> de <span className="font-medium text-gray-700">{data.length}</span> produto(s) encontrado(s)
                  </p>
                </div>
              )}

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

        {/* Tabela */}
        {data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visualizações
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adicionar ao Carrinho
                    <div className="text-xs font-normal text-gray-400 mt-1">Taxa</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Iniciar Checkout
                    <div className="text-xs font-normal text-gray-400 mt-1">Taxa</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adicionar Frete
                    <div className="text-xs font-normal text-gray-400 mt-1">Taxa</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adicionar Pagamento
                    <div className="text-xs font-normal text-gray-400 mt-1">Taxa</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compras
                    <div className="text-xs font-normal text-gray-400 mt-1">Taxa</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taxa de Conversão
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item, index) => (
                  <tr key={`${item.item_id}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                        <div className="text-sm text-gray-500">{item.item_category}</div>
                        <div className="text-xs text-gray-400">ID: {item.item_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.view_item)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="text-gray-900">{formatNumber(item.add_to_cart)}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {formatPercentage(calculateStepConversionRate(item.add_to_cart, item.view_item))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="text-gray-900">{formatNumber(item.begin_checkout)}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {formatPercentage(calculateStepConversionRate(item.begin_checkout, item.add_to_cart))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="text-gray-900">{formatNumber(item.add_shipping_info)}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {formatPercentage(calculateStepConversionRate(item.add_shipping_info, item.begin_checkout))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="text-gray-900">{formatNumber(item.add_payment_info)}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {formatPercentage(calculateStepConversionRate(item.add_payment_info, item.add_shipping_info))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="font-medium text-gray-900">{formatNumber(item.purchase)}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {formatPercentage(calculateStepConversionRate(item.purchase, item.add_payment_info))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600">
                      {formatPercentage(calculateConversionRate(item.purchase, item.view_item))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      {formatCurrency(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State - Quando não há dados e não está processando */}
        {!isLoading && !isPolling && data.length === 0 && !error && status === 'idle' && (
          <div className="px-6 py-12 text-center">
            <div className="max-w-md mx-auto">
              <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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

        {/* Mensagem quando busca não encontra resultados */}
        {data.length > 0 && filteredData.length === 0 && (searchTerm || selectedCategory !== 'all') && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">Nenhum produto encontrado com os filtros aplicados.</p>
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('all')
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductsFunnel

