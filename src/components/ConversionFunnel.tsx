import { useState, useEffect } from 'react'
import { BarChart3, Users, ShoppingCart, CreditCard, CheckCircle, TrendingUp, TrendingDown, ArrowDown, Calendar } from 'lucide-react'
import { api } from '../services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DotProps } from 'recharts'

interface FunnelDataItem {
  Data: string
  Visualizacao_de_Item: number
  Adicionar_ao_Carrinho: number
  Iniciar_Checkout: number
  Adicionar_Informacao_de_Frete: number
  Adicionar_Informacao_de_Pagamento: number
  Pedido: number
}

interface ConversionFunnelProps {
  selectedTable: string
  startDate: string
  endDate: string
  selectedCluster: string
}

const ConversionFunnel = ({ selectedTable, startDate, endDate, selectedCluster }: ConversionFunnelProps) => {
  const [funnelData, setFunnelData] = useState<FunnelDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibleSeries, setVisibleSeries] = useState({
    'Visualização → Carrinho': false,
    'Carrinho → Checkout': false,
    'Checkout → Frete': false,
    'Frete → Pagamento': false,
    'Pagamento → Pedido': false,
    'Checkout → Pedido': false,
    'Visualização → Pedido': true
  })

  // Estado para série selecionada no dropdown
  const [selectedSeries, setSelectedSeries] = useState<string>('Visualização → Pedido')

  // Obter a série atualmente selecionada
  const getCurrentSeries = () => {
    const series = Object.keys(visibleSeries).find(key => visibleSeries[key as keyof typeof visibleSeries])
    return series || 'Visualização → Pedido'
  }

  // Atualizar série selecionada
  const handleSeriesChange = (seriesName: string) => {
    setSelectedSeries(seriesName)
    setVisibleSeries(prev => {
      const newVisibleSeries = { ...prev }
      Object.keys(newVisibleSeries).forEach(key => {
        newVisibleSeries[key as keyof typeof prev] = key === seriesName
      })
      return newVisibleSeries
    })
  }

  useEffect(() => {
    const fetchFunnelData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const token = localStorage.getItem('auth-token')
        if (!token) {
          setError('Token de autenticação não encontrado')
          return
        }

        const requestData = {
          start_date: startDate,
          end_date: endDate,
          table_name: selectedTable,
          ...(selectedCluster !== 'Todos' && { cluster: selectedCluster })
        }

        console.log('🔍 ConversionFunnel - selectedCluster:', selectedCluster)
        console.log('🔍 ConversionFunnel - requestData:', requestData)

        const response = await api.getFunnelData(token, requestData)

        console.log('🔍 ConversionFunnel - response.data:', response.data)
        console.log('🔍 ConversionFunnel - data length:', response.data?.length || 0)
        
        // Verificar se os dados contêm o cluster correto
        if (selectedCluster !== 'Todos' && response.data) {
          const hasClusterData = response.data.some((item: any) => item.Cluster === selectedCluster)
          console.log('🔍 ConversionFunnel - hasClusterData:', hasClusterData)
          console.log('🔍 ConversionFunnel - available clusters:', [...new Set(response.data.map((item: any) => item.Cluster))])
        }
        
        setFunnelData(response.data || [])
      } catch (err) {
        console.error('Erro ao buscar dados do funil:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados do funil')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFunnelData()
  }, [selectedTable, startDate, endDate, selectedCluster])

  // Calcular totais
  const totals = funnelData.reduce((acc, item) => ({
    visualizacoes: acc.visualizacoes + item.Visualizacao_de_Item,
    adicoesCarrinho: acc.adicoesCarrinho + item.Adicionar_ao_Carrinho,
    iniciarCheckout: acc.iniciarCheckout + item.Iniciar_Checkout,
    adicionarFrete: acc.adicionarFrete + item.Adicionar_Informacao_de_Frete,
    adicionarPagamento: acc.adicionarPagamento + item.Adicionar_Informacao_de_Pagamento,
    pedidos: acc.pedidos + item.Pedido
  }), {
    visualizacoes: 0,
    adicoesCarrinho: 0,
    iniciarCheckout: 0,
    adicionarFrete: 0,
    adicionarPagamento: 0,
    pedidos: 0
  })

  // Calcular taxas de conversão
  const taxasConversao = {
    visualizacaoParaCarrinho: totals.visualizacoes > 0 ? (totals.adicoesCarrinho / totals.visualizacoes) * 100 : 0,
    carrinhoParaCheckout: totals.adicoesCarrinho > 0 ? (totals.iniciarCheckout / totals.adicoesCarrinho) * 100 : 0,
    checkoutParaFrete: totals.iniciarCheckout > 0 ? (totals.adicionarFrete / totals.iniciarCheckout) * 100 : 0,
    freteParaPagamento: totals.adicionarFrete > 0 ? (totals.adicionarPagamento / totals.adicionarFrete) * 100 : 0,
    pagamentoParaPedido: totals.adicionarPagamento > 0 ? (totals.pedidos / totals.adicionarPagamento) * 100 : 0,
    visualizacaoParaPedido: totals.visualizacoes > 0 ? (totals.pedidos / totals.visualizacoes) * 100 : 0
  }

  // Formatar número
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Formatar porcentagem
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  // Calcular largura do funil baseada no valor máximo
  const maxValue = Math.max(totals.visualizacoes, totals.adicoesCarrinho, totals.iniciarCheckout, totals.adicionarFrete, totals.adicionarPagamento, totals.pedidos)
  
  const getFunnelWidth = (value: number) => {
    return maxValue > 0 ? (value / maxValue) * 100 : 0
  }

  // Preparar dados para os gráficos
  const chartData = funnelData.map(item => {
    const visualizacaoParaCarrinho = item.Visualizacao_de_Item > 0 ? (item.Adicionar_ao_Carrinho / item.Visualizacao_de_Item) * 100 : 0
    const carrinhoParaCheckout = item.Adicionar_ao_Carrinho > 0 ? (item.Iniciar_Checkout / item.Adicionar_ao_Carrinho) * 100 : 0
    const checkoutParaFrete = item.Iniciar_Checkout > 0 ? (item.Adicionar_Informacao_de_Frete / item.Iniciar_Checkout) * 100 : 0
    const freteParaPagamento = item.Adicionar_Informacao_de_Frete > 0 ? (item.Adicionar_Informacao_de_Pagamento / item.Adicionar_Informacao_de_Frete) * 100 : 0
    const pagamentoParaPedido = item.Adicionar_Informacao_de_Pagamento > 0 ? (item.Pedido / item.Adicionar_Informacao_de_Pagamento) * 100 : 0
    const checkoutParaPedido = item.Iniciar_Checkout > 0 ? (item.Pedido / item.Iniciar_Checkout) * 100 : 0
    const visualizacaoParaPedido = item.Visualizacao_de_Item > 0 ? (item.Pedido / item.Visualizacao_de_Item) * 100 : 0

    return {
      data: formatDate(item.Data),
      'Visualização → Carrinho': parseFloat(visualizacaoParaCarrinho.toFixed(2)),
      'Carrinho → Checkout': parseFloat(carrinhoParaCheckout.toFixed(2)),
      'Checkout → Frete': parseFloat(checkoutParaFrete.toFixed(2)),
      'Frete → Pagamento': parseFloat(freteParaPagamento.toFixed(2)),
      'Pagamento → Pedido': parseFloat(pagamentoParaPedido.toFixed(2)),
      'Checkout → Pedido': parseFloat(checkoutParaPedido.toFixed(2)),
      'Visualização → Pedido': parseFloat(visualizacaoParaPedido.toFixed(2))
    }
  })

  // Dados do funil
  const funnelSteps = [
    {
      name: 'Visualizações de Página de Produto',
      value: totals.visualizacoes,
      percentage: 100,
      funnelWidth: getFunnelWidth(totals.visualizacoes),
      color: 'from-blue-400 to-blue-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: Users
    },
    {
      name: 'Adicionar ao Carrinho',
      value: totals.adicoesCarrinho,
      percentage: taxasConversao.visualizacaoParaCarrinho,
      funnelWidth: getFunnelWidth(totals.adicoesCarrinho),
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: ShoppingCart
    },
    {
      name: 'Iniciar Checkout',
      value: totals.iniciarCheckout,
      percentage: taxasConversao.carrinhoParaCheckout,
      funnelWidth: getFunnelWidth(totals.iniciarCheckout),
      color: 'from-blue-600 to-blue-700',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: CreditCard
    },
    {
      name: 'Adicionar Informações de Frete',
      value: totals.adicionarFrete,
      percentage: taxasConversao.checkoutParaFrete,
      funnelWidth: getFunnelWidth(totals.adicionarFrete),
      color: 'from-blue-700 to-blue-800',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: TrendingUp
    },
    {
      name: 'Adicionar Informações de Pagamento',
      value: totals.adicionarPagamento,
      percentage: taxasConversao.pagamentoParaPedido,
      funnelWidth: getFunnelWidth(totals.adicionarPagamento),
      color: 'from-slate-600 to-slate-700',
      bgColor: 'bg-slate-50',
      iconColor: 'text-slate-600',
      icon: TrendingDown
    },
    {
      name: 'Pedidos',
      value: totals.pedidos,
      percentage: taxasConversao.visualizacaoParaPedido,
      funnelWidth: getFunnelWidth(totals.pedidos),
      color: 'from-slate-800 to-slate-900',
      bgColor: 'bg-slate-50',
      iconColor: 'text-slate-600',
      icon: CheckCircle
    }
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Funil de Conversão</h2>
              <p className="text-sm text-gray-600">Análise detalhada do funil de conversão</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados do funil...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Funil de Conversão</h2>
              <p className="text-sm text-gray-600">Análise detalhada do funil de conversão</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  if (funnelData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Funil de Conversão</h2>
              <p className="text-sm text-gray-600">Análise detalhada do funil de conversão</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
          <p className="text-gray-600 mb-4">
            Não foram encontrados dados para a tabela <strong>{selectedTable}</strong> no período selecionado.
          </p>
        </div>
      </div>
    )
  }

  // Definir tipo para as chaves das séries
  type SeriesKey =
    | 'Visualização → Carrinho'
    | 'Carrinho → Checkout'
    | 'Checkout → Frete'
    | 'Frete → Pagamento'
    | 'Pagamento → Pedido'
    | 'Checkout → Pedido'
    | 'Visualização → Pedido'

  // Calcular domínio dinâmico do eixo Y conforme as séries visíveis
  const getYAxisDomain = () => {
    const activeKeys = Object.keys(visibleSeries).filter((key) => visibleSeries[key as SeriesKey]) as SeriesKey[]
    let min = Infinity
    let max = -Infinity
    chartData.forEach((item) => {
      activeKeys.forEach((key) => {
        const value = item[key as SeriesKey]
        if (typeof value === 'number') {
          if (value < min) min = value
          if (value > max) max = value
        }
      })
    })
    // Se não houver dados, use [0, 100] como padrão
    if (!isFinite(min) || !isFinite(max)) return [0, 100]
    // Se min == max, expanda um pouco para visualização
    if (min === max) return [Math.max(0, min - 5), max + 5]
    // Para taxas, garanta que o eixo comece em 0 e vá até no máximo 100
    return [Math.max(0, Math.floor(min)), Math.min(100, Math.ceil(max))]
  }

  // Cálculo de média e desvio padrão para cada série visível
  const getSeriesStats = () => {
    const stats: Record<SeriesKey, { mean: number; std: number }> = {} as any
    const activeKeys = Object.keys(visibleSeries).filter((key) => visibleSeries[key as SeriesKey]) as SeriesKey[]
    activeKeys.forEach((key) => {
      const values = chartData.map((item) => item[key]).filter((v) => typeof v === 'number') as number[]
      const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1)
      const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length || 1))
      stats[key] = { mean, std }
    })
    return stats
  }
  const seriesStats = getSeriesStats()

  // Detectar etapas com outliers
  const getFunnelStepsWithOutliers = () => {
    const stepsWithOutliers: Record<string, boolean> = {}
    
    // Mapear nomes das etapas para as séries correspondentes
    const stepToSeriesMap: Record<string, SeriesKey> = {
      'Visualizações de Página de Produto': 'Visualização → Pedido',
      'Adicionar ao Carrinho': 'Visualização → Carrinho',
      'Iniciar Checkout': 'Carrinho → Checkout',
      'Adicionar Informações de Frete': 'Checkout → Frete',
      'Adicionar Informações de Pagamento': 'Frete → Pagamento',
      'Pedidos': 'Visualização → Pedido'
    }
    
    funnelSteps.forEach((step) => {
      const seriesKey = stepToSeriesMap[step.name]
      if (seriesKey && seriesStats[seriesKey]) {
        const { mean, std } = seriesStats[seriesKey]
        const hasOutliers = chartData.some((item) => {
          const value = item[seriesKey]
          return typeof value === 'number' && (value > mean + 2 * std || value < mean - 2 * std)
        })
        stepsWithOutliers[step.name] = hasOutliers
      }
    })
    
    return stepsWithOutliers
  }
  
  const stepsWithOutliers = getFunnelStepsWithOutliers()

  // Função para customizar o dot destacando outliers
  const getDot = (seriesKey: SeriesKey, color: string) => (props: any) => {
    const cx = typeof props.cx === 'number' ? props.cx : 0
    const cy = typeof props.cy === 'number' ? props.cy : 0
    const value = typeof props.value === 'number' ? props.value : 0
    const { mean, std } = seriesStats[seriesKey] || { mean: 0, std: 1 }
    // Outlier acima de 2 desvios (positivo)
    if (value > mean + 2 * std) {
      return <circle cx={cx} cy={cy} r={7} fill="#60a5fa" stroke={color} strokeWidth={2} />
    }
    // Outlier abaixo de 2 desvios (negativo)
    if (value < mean - 2 * std) {
      return <circle cx={cx} cy={cy} r={7} fill="#64748b" stroke={color} strokeWidth={2} />
    }
    // Normal
    return <circle cx={cx} cy={cy} r={4} fill={color} strokeWidth={2} />
  }

  return (
    <div className="space-y-6">


      {/* Nova Visualização do Funil */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Funil de Conversão</h3>
          {selectedCluster !== 'Todos' && (
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Cluster: {selectedCluster}
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-center space-y-3">
          {funnelSteps.map((step, index) => {
            const Icon = step.icon
            const isLast = index === funnelSteps.length - 1
            
            return (
              <div key={index} className="w-full max-w-4xl">
                {/* Etapa do Funil */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${step.bgColor} rounded-lg flex items-center justify-center relative`}>
                      <step.icon className={`w-4 h-4 ${step.iconColor}`} />
                      {stepsWithOutliers[step.name] && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{step.name}</h4>
                      <p className="text-xs text-gray-500">Etapa {index + 1} de {funnelSteps.length}</p>
                    </div>
                  </div>
                  {stepsWithOutliers[step.name] && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-full">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs font-medium text-red-700">Outliers</span>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">{formatNumber(step.value)}</div>
                    <div className="text-xs text-gray-500">{formatPercentage(step.percentage)}</div>
                  </div>
                </div>

                {/* Barra do Funil */}
                <div className="relative">
                  <div className="w-full bg-gray-100 rounded-xl h-12 overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${step.color} rounded-xl flex items-center justify-center transition-all duration-1000 ease-out`}
                      style={{ 
                        width: `${step.funnelWidth}%`,
                        minWidth: '40px'
                      }}
                    >
                      <span className="text-white font-bold text-sm px-2">
                        {formatNumber(step.value)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Indicador de perda */}
                  {!isLast && (
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                      <div className="flex items-center gap-1 text-red-500">
                        <ArrowDown className="w-3 h-3" />
                        <span className="text-xs font-medium">
                          {formatPercentage(100 - step.percentage)} perdidos
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
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Taxa de Conversão Geral</h4>
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-slate-600 bg-clip-text text-transparent">
              {formatPercentage(taxasConversao.visualizacaoParaPedido)}
            </div>
            <p className="text-gray-600 text-xs mt-1">
              {formatNumber(totals.pedidos)} pedidos de {formatNumber(totals.visualizacoes)} visualizações
            </p>
          </div>
        </div>
      </div>

      {/* Timeline das Taxas de Conversão */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Timeline das Taxas de Conversão</h3>
          </div>
          {selectedCluster !== 'Todos' && (
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Cluster: {selectedCluster}
            </div>
          )}
        </div>

        {/* Explicação dos Outliers */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <h4 className="text-sm font-semibold text-blue-800">Outliers Detectados</h4>
          </div>
          <div className="flex items-center gap-6 text-xs text-blue-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span>Valor acima de 2 desvios padrão (positivo)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
              <span>Valor abaixo de 2 desvios padrão (negativo)</span>
            </div>
          </div>
        </div>
        
        {/* Controles das Séries */}
        <div className="mb-6 p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Selecionar Métrica
          </h4>
          <div className="max-w-md">
            <div className="relative">
              <select
                value={selectedSeries}
                onChange={(e) => handleSeriesChange(e.target.value)}
                className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer"
              >
                {Object.keys(visibleSeries).map((seriesName) => (
                  <option key={seriesName} value={seriesName}>
                    {seriesName}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Selecione uma métrica para visualizar na timeline
            </p>
          </div>
        </div>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="data" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                domain={getYAxisDomain()}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Taxa']}
                labelFormatter={(label) => `Data: ${label}`}
              />
              {visibleSeries['Visualização → Carrinho'] && (
                <Line 
                  type="monotone" 
                  dataKey="Visualização → Carrinho" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={getDot('Visualização → Carrinho', '#3b82f6')}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleSeries['Carrinho → Checkout'] && (
                <Line 
                  type="monotone" 
                  dataKey="Carrinho → Checkout" 
                  stroke="#1d4ed8" 
                  strokeWidth={2}
                  dot={getDot('Carrinho → Checkout', '#1d4ed8')}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleSeries['Checkout → Frete'] && (
                <Line 
                  type="monotone" 
                  dataKey="Checkout → Frete" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  dot={getDot('Checkout → Frete', '#6366f1')}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleSeries['Frete → Pagamento'] && (
                <Line 
                  type="monotone" 
                  dataKey="Frete → Pagamento" 
                  stroke="#475569" 
                  strokeWidth={2}
                  dot={getDot('Frete → Pagamento', '#475569')}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleSeries['Pagamento → Pedido'] && (
                <Line 
                  type="monotone" 
                  dataKey="Pagamento → Pedido" 
                  stroke="#1e40af" 
                  strokeWidth={2}
                  dot={getDot('Pagamento → Pedido', '#1e40af')}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleSeries['Checkout → Pedido'] && (
                <Line 
                  type="monotone" 
                  dataKey="Checkout → Pedido" 
                  stroke="#334155" 
                  strokeWidth={2}
                  dot={getDot('Checkout → Pedido', '#334155')}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleSeries['Visualização → Pedido'] && (
                <Line 
                  type="monotone" 
                  dataKey="Visualização → Pedido" 
                  stroke="#0f172a" 
                  strokeWidth={3}
                  dot={getDot('Visualização → Pedido', '#0f172a')}
                  activeDot={{ r: 7 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>


    </div>
  )
}

export default ConversionFunnel 