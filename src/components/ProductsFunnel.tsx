import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../services/api'

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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasStartedRef = useRef(false)

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

  // Função para iniciar o processamento
  const startProcessing = async () => {
    const token = getV2Token()
    if (!token) {
      setError('Token de autenticação não encontrado. Faça login novamente.')
      setStatus('error')
      return
    }

    setIsLoading(true)
    setStatus('processing')
    setError(null)
    setData([])
    setProgress('Iniciando processamento...')

    try {
      // Criar o job
      const jobResponse = await api.createProductsFunnelJob(token, selectedTable)
      setJobId(jobResponse.job_id)
      setProgress('Job criado, aguardando processamento...')

      // Iniciar polling
      startPolling(jobResponse.job_id, token)
    } catch (error) {
      console.error('Error starting processing:', error)
      setError(error instanceof Error ? error.message : 'Erro ao iniciar processamento')
      setStatus('error')
      setIsLoading(false)
    }
  }

  // Função para fazer polling do status
  const startPolling = (jobId: string, token: string) => {
    setIsPolling(true)

    const poll = async () => {
      try {
        const statusResponse = await api.getProductsFunnelJobStatus(token, jobId)
        
        setProgress(statusResponse.progress || 'Processando...')

        if (statusResponse.status === 'completed') {
          // Job concluído, buscar dados
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          setProgress('Processamento concluído, baixando dados...')
          
          // Função para buscar dados com retry em caso de 404
          const fetchDataWithRetry = async (maxRetries = 10, retryDelay = 3000) => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                const dataResponse = await api.getProductsFunnelData(token, jobId)
                console.log('✅ Data fetched successfully:', dataResponse)
                
            if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
              // Limpar dados: substituir NaN por valores válidos
              const cleanedData = cleanData(dataResponse.data)
              setData(cleanedData)
              setStatus('completed')
              setProgress(`Dados carregados: ${dataResponse.count || cleanedData.length} produtos`)
              setIsLoading(false)
                  return // Sucesso, sair da função
                } else {
                  console.warn('⚠️ Unexpected data structure:', dataResponse)
                  setError('Estrutura de dados inesperada. Verifique o console para mais detalhes.')
                  setStatus('error')
                  setIsLoading(false)
                  return
                }
              } catch (error: any) {
                console.error(`❌ Error fetching data (attempt ${attempt}/${maxRetries}):`, error)
                
                // Se for erro 404 e ainda temos tentativas, continuar tentando
                if (error?.isRetryable && error?.status === 404 && attempt < maxRetries) {
                  setProgress(`Dados ainda não disponíveis, tentando novamente... (${attempt}/${maxRetries})`)
                  console.log(`⏳ Retrying in ${retryDelay}ms...`)
                  await new Promise(resolve => setTimeout(resolve, retryDelay))
                  continue // Tentar novamente
                }
                
                // Se não for retryable ou esgotou as tentativas, mostrar erro
                const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar dados'
                console.error('Error details:', {
                  error,
                  message: errorMessage,
                  stack: error instanceof Error ? error.stack : undefined
                })
                setError(errorMessage)
                setStatus('error')
                setIsLoading(false)
                return
              }
            }
            
            // Se chegou aqui, esgotou todas as tentativas
            setError('Não foi possível buscar os dados após várias tentativas. Tente novamente mais tarde.')
            setStatus('error')
            setIsLoading(false)
          }
          
          // Iniciar busca com retry
          fetchDataWithRetry()
        } else if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
          // Job falhou
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
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

    // Executar imediatamente
    poll()

    // Configurar polling a cada 3 segundos
    pollingIntervalRef.current = setInterval(poll, 3000)
  }

  // Iniciar processamento automaticamente ao montar o componente
  useEffect(() => {
    if (!hasStartedRef.current && selectedTable) {
      hasStartedRef.current = true
      startProcessing()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable])

  // Limpar polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Funil de Produtos</h2>
            <p className="text-sm text-gray-600 mt-1">
              Análise do funil de conversão por produto
            </p>
          </div>
        </div>

        {/* Status */}
        {(isLoading || isPolling || status === 'completed') && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            {status === 'processing' || isPolling ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{progress}</p>
                  {jobId && (
                    <p className="text-xs text-gray-500 mt-1">Job ID: {jobId}</p>
                  )}
                </div>
              </div>
            ) : status === 'completed' ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-gray-900">{progress}</p>
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
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Iniciar Checkout
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adicionar Frete
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adicionar Pagamento
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compras
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
                {data.map((item, index) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.add_to_cart)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.begin_checkout)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.add_shipping_info)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatNumber(item.add_payment_info)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatNumber(item.purchase)}
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

        {/* Empty State */}
        {!isLoading && !isPolling && data.length === 0 && !error && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">Clique em "Gerar Relatório" para iniciar a análise do funil de produtos.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductsFunnel

