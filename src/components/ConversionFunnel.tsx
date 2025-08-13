import { useState, useEffect } from 'react'
import { BarChart3, Users, ShoppingCart, CreditCard, CheckCircle, TrendingUp, TrendingDown, ArrowDown, Calendar } from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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
  attributionModel?: string
  hideClientName?: boolean
}

const ConversionFunnel = ({ selectedTable, startDate, endDate, attributionModel = 'Último Clique Não Direto', hideClientName = false }: ConversionFunnelProps) => {
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

  // Função para alternar série selecionada
  const toggleSeries = (seriesName: string) => {
    setVisibleSeries(prev => ({
      ...prev,
      [seriesName]: !prev[seriesName as keyof typeof prev]
    }))
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

        // Validar que selectedTable não é "all" - não deve consultar diretamente
        if (!validateTableName(selectedTable)) {
          return
        }

        const requestData = {
          start_date: startDate,
          end_date: endDate,
          table_name: selectedTable,
          attribution_model: attributionModel
        }

        console.log('🔍 ConversionFunnel - requestData:', requestData)

        const response = await api.getFunnelData(token, requestData)

        console.log('🔍 ConversionFunnel - response.data:', response.data)
        console.log('🔍 ConversionFunnel - data length:', response.data?.length || 0)
        
        setFunnelData(response.data || [])
      } catch (err) {
        console.error('Erro ao buscar dados do funil:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados do funil')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFunnelData()
  }, [selectedTable, startDate, endDate, attributionModel])

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
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
          <p className="text-gray-600 mb-4">
            Não foram encontrados dados para a tabela <strong>{hideClientName ? 'Cliente Selecionado' : selectedTable}</strong> no período selecionado.
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
        </div>
        
        <div className="flex flex-col items-center space-y-3">
          {funnelSteps.map((step, index) => {

            const isLast = index === funnelSteps.length - 1
            
            return (
              <div key={index} className="w-full max-w-4xl">
                {/* Etapa do Funil */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${step.bgColor} rounded-lg flex items-center justify-center`}>
                      <step.icon className={`w-4 h-4 ${step.iconColor}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{step.name}</h4>
                      <p className="text-xs text-gray-500">Etapa {index + 1} de {funnelSteps.length}</p>
                    </div>
                  </div>

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
        </div>


        
        {/* Controles das Séries */}
        <div className="mb-6 p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Selecionar Métricas para Comparar
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.keys(visibleSeries).map((seriesName) => {
              const isSelected = visibleSeries[seriesName as keyof typeof visibleSeries]
              const getSeriesColor = (name: string) => {
                switch (name) {
                  case 'Visualização → Carrinho': return '#3b82f6'
                  case 'Carrinho → Checkout': return '#1d4ed8'
                  case 'Checkout → Frete': return '#6366f1'
                  case 'Frete → Pagamento': return '#475569'
                  case 'Pagamento → Pedido': return '#1e40af'
                  case 'Checkout → Pedido': return '#334155'
                  case 'Visualização → Pedido': return '#0f172a'
                  default: return '#6b7280'
                }
              }
              
              return (
                <button
                  key={seriesName}
                  onClick={() => toggleSeries(seriesName)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: getSeriesColor(seriesName) }}
                  ></div>
                  <span>{seriesName}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Clique nas métricas para selecionar/deselecionar. Compare múltiplas taxas de conversão simultaneamente.
          </p>
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