import { useState, useEffect } from 'react'
import { 
  Download,
  RefreshCw,
  Target,
  Zap,
  TrendingUpIcon,
  TrendingDownIcon,
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Maximize2,
  X,
  DollarSign
} from 'lucide-react'
import TimelineAB from './TimelineAB'

interface ExperimentData {
  event_date: string
  experiment_id: string
  experiment_name: string
  experiment_variant: string
  category: string
  sessions: number
  users: number
  transactions: number
  revenue: number
  add_to_cart: number
  begin_checkout: number
  add_shipping_info: number
  add_payment_info: number
}

interface AggregatedExperiment {
  experiment_id: string
  experiment_name: string
  category: string
  variants: {
    [variant: string]: {
      sessions: number
      users: number
      users_percentage: number
      transactions: number
      revenue: number
      conversion_rate: number
      revenue_per_session: number
      sessions_per_user: number
      avg_order_value: number
      category: string
      variant: string
      add_to_cart: number
      begin_checkout: number
      add_shipping_info: number
      add_payment_info: number
      add_to_cart_rate: number
      begin_checkout_rate: number
      add_shipping_info_rate: number
      add_payment_info_rate: number
    }
  }
  total_sessions: number
  total_users: number
  total_transactions: number
  total_revenue: number
  overall_conversion_rate: number
  overall_revenue_per_session: number
  // Adicionar dados separados por categoria
  mobile_data: { sessions: number; transactions: number; revenue: number } | null
  desktop_data: { sessions: number; transactions: number; revenue: number } | null
}

interface ABTestingProps {
  selectedTable: string
  startDate: string
  endDate: string
}

const ABTesting = ({ selectedTable, startDate, endDate }: ABTestingProps) => {
  const [experiments, setExperiments] = useState<ExperimentData[]>([])
  const [aggregatedExperiments, setAggregatedExperiments] = useState<AggregatedExperiment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedExperimentForTimeline, setSelectedExperimentForTimeline] = useState<string>('')
  const [fullscreenTable, setFullscreenTable] = useState<string | null>(null)

  // Buscar dados dos experimentos
  const fetchExperiments = async () => {
    if (!selectedTable) return

    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) {
        setError('Token de autenticação não encontrado')
        return
      }

      const response = await fetch('https://api.mymetric.app/metrics/experiments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          table_name: selectedTable
        })
      })

      if (response.status === 500) {
        setError('cliente-sem-experimentos')
        return
      }

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`)
      }

      const data = await response.json()
      setExperiments(data || [])
    } catch (err) {
      console.error('Erro ao buscar experimentos:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  // Agregar dados por experimento
  const aggregateDataByExperiment = (data: ExperimentData[]): AggregatedExperiment[] => {
    // Filtrar apenas dados de mobile e desktop, ocultar tablet
    const filteredData = data.filter(exp => exp.category === 'mobile' || exp.category === 'desktop')
    
    const experimentMap = new Map<string, AggregatedExperiment>()

    filteredData.forEach(exp => {
      // Usar apenas experiment_id como chave para agrupar mobile/desktop
      const key = exp.experiment_id
      
      if (!experimentMap.has(key)) {
        experimentMap.set(key, {
          experiment_id: exp.experiment_id,
          experiment_name: exp.experiment_name,
          category: 'mixed', // Categoria mista para indicar que tem mobile e desktop
          variants: {},
          total_sessions: 0,
          total_users: 0,
          total_transactions: 0,
          total_revenue: 0,
          overall_conversion_rate: 0,
          overall_revenue_per_session: 0,
          // Adicionar dados separados por categoria
          mobile_data: null,
          desktop_data: null
        })
      }

      const experiment = experimentMap.get(key)!
      const variant = exp.experiment_variant === '' ? 'controle' : exp.experiment_variant
      const categoryKey = `${exp.category}_${variant}`

      if (!experiment.variants[categoryKey]) {
        experiment.variants[categoryKey] = {
          sessions: 0,
          users: 0,
          users_percentage: 0,
          transactions: 0,
          revenue: 0,
          conversion_rate: 0,
          revenue_per_session: 0,
          sessions_per_user: 0,
          avg_order_value: 0,
          category: exp.category,
          variant: variant,
          add_to_cart: 0,
          begin_checkout: 0,
          add_shipping_info: 0,
          add_payment_info: 0,
          add_to_cart_rate: 0,
          begin_checkout_rate: 0,
          add_shipping_info_rate: 0,
          add_payment_info_rate: 0
        }
      }

      experiment.variants[categoryKey].sessions += exp.sessions
      experiment.variants[categoryKey].users += exp.users || 0
      experiment.variants[categoryKey].transactions += exp.transactions
      experiment.variants[categoryKey].revenue += exp.revenue
      experiment.variants[categoryKey].add_to_cart += exp.add_to_cart || 0
      experiment.variants[categoryKey].begin_checkout += exp.begin_checkout || 0
      experiment.variants[categoryKey].add_shipping_info += exp.add_shipping_info || 0
      experiment.variants[categoryKey].add_payment_info += exp.add_payment_info || 0

      experiment.total_sessions += exp.sessions
      experiment.total_users += exp.users || 0
      experiment.total_transactions += exp.transactions
      experiment.total_revenue += exp.revenue

      // Armazenar dados separados por categoria (apenas mobile e desktop)
      if (exp.category === 'mobile') {
        if (!experiment.mobile_data) {
          experiment.mobile_data = {
            sessions: 0,
            transactions: 0,
            revenue: 0
          }
        }
        experiment.mobile_data.sessions += exp.sessions
        experiment.mobile_data.transactions += exp.transactions
        experiment.mobile_data.revenue += exp.revenue
      } else if (exp.category === 'desktop') {
        if (!experiment.desktop_data) {
          experiment.desktop_data = {
            sessions: 0,
            transactions: 0,
            revenue: 0
          }
        }
        experiment.desktop_data.sessions += exp.sessions
        experiment.desktop_data.transactions += exp.transactions
        experiment.desktop_data.revenue += exp.revenue
      }
    })

    // Calcular métricas derivadas
    experimentMap.forEach(experiment => {
      // Primeiro, calcular total de usuários por categoria para calcular percentuais
      const mobileUsers = Object.entries(experiment.variants)
        .filter(([key]) => key.startsWith('mobile_'))
        .reduce((sum, [, variant]) => sum + variant.users, 0)
      
      const desktopUsers = Object.entries(experiment.variants)
        .filter(([key]) => key.startsWith('desktop_'))
        .reduce((sum, [, variant]) => sum + variant.users, 0)
      
      // Métricas por variante
      Object.values(experiment.variants).forEach(variant => {
        variant.conversion_rate = variant.sessions > 0 ? (variant.transactions / variant.sessions) * 100 : 0
        variant.revenue_per_session = variant.sessions > 0 ? variant.revenue / variant.sessions : 0
        variant.sessions_per_user = variant.users > 0 ? variant.sessions / variant.users : 0
        variant.avg_order_value = variant.transactions > 0 ? variant.revenue / variant.transactions : 0
        variant.add_to_cart_rate = variant.sessions > 0 ? (variant.add_to_cart / variant.sessions) * 100 : 0
        variant.begin_checkout_rate = variant.sessions > 0 ? (variant.begin_checkout / variant.sessions) * 100 : 0
        variant.add_shipping_info_rate = variant.sessions > 0 ? (variant.add_shipping_info / variant.sessions) * 100 : 0
        variant.add_payment_info_rate = variant.sessions > 0 ? (variant.add_payment_info / variant.sessions) * 100 : 0
        
        // Calcular percentual de usuários por categoria
        const totalUsersInCategory = variant.category === 'mobile' ? mobileUsers : desktopUsers
        variant.users_percentage = totalUsersInCategory > 0 ? (variant.users / totalUsersInCategory) * 100 : 0
      })

      // Métricas gerais do experimento
      experiment.overall_conversion_rate = experiment.total_sessions > 0 ? (experiment.total_transactions / experiment.total_sessions) * 100 : 0
      experiment.overall_revenue_per_session = experiment.total_sessions > 0 ? experiment.total_revenue / experiment.total_sessions : 0
    })

    return Array.from(experimentMap.values())
  }

  // Carregar dados quando as datas ou tabela mudarem
  useEffect(() => {
    fetchExperiments()
  }, [selectedTable, startDate, endDate])

  // Agregar dados quando experiments mudar
  useEffect(() => {
    if (experiments.length > 0) {
      const aggregated = aggregateDataByExperiment(experiments)
      setAggregatedExperiments(aggregated)
    }
  }, [experiments])

  // Filtrar dados agregados (remover experimentos com menos de 50 sessões)
  const filteredAndSortedExperiments = aggregatedExperiments.filter(exp => exp.total_sessions >= 50)





  // Formatar valores
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Função para exportar dados
  const exportToCSV = () => {
    if (filteredAndSortedExperiments.length === 0) return

    const headers = ['ID do Experimento', 'Nome do Experimento', 'Categoria', 'Variante', 'Sessões', 'Usuários', '% Tráfego (Usuários)', 'Sessões/Usuário', 'Transações', 'Receita', 'Taxa de Conversão', 'Receita por Sessão', 'Ticket Médio', 'Add to Cart', 'Taxa Add to Cart', 'Begin Checkout', 'Taxa Begin Checkout', 'Add Shipping Info', 'Taxa Add Shipping Info', 'Add Payment Info', 'Taxa Add Payment Info']
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedExperiments.flatMap(exp => 
        Object.entries(exp.variants).map(([variant, data]) => [
          exp.experiment_id,
          `"${exp.experiment_name}"`,
          exp.category,
          variant === 'controle' ? 'Controle' : `Variante ${variant}`,
          data.sessions,
          data.users,
          data.users_percentage.toFixed(2),
          data.sessions_per_user.toFixed(2),
          data.transactions,
          data.revenue,
          data.conversion_rate.toFixed(2),
          data.revenue_per_session.toFixed(2),
          data.avg_order_value.toFixed(2),
          data.add_to_cart,
          data.add_to_cart_rate.toFixed(2),
          data.begin_checkout,
          data.begin_checkout_rate.toFixed(2),
          data.add_shipping_info,
          data.add_shipping_info_rate.toFixed(2),
          data.add_payment_info,
          data.add_payment_info_rate.toFixed(2)
        ].join(','))
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `experimentos_ab_agregados_${startDate}_${endDate}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calcular lift entre variantes
  const calculateLift = (control: any, variant: any, metric: 'revenue_per_session' | 'conversion_rate' | 'add_to_cart_rate' | 'begin_checkout_rate' | 'add_shipping_info_rate' | 'add_payment_info_rate') => {
    if (!control || !variant || control[metric] === 0) return null
    
    const lift = ((variant[metric] - control[metric]) / control[metric]) * 100
    return lift
  }

  // Calcular significância estatística usando teste Z para proporções
  const calculateStatisticalSignificance = (control: any, variant: any): {
    pValue: number
    isSignificant: boolean
    confidence: string
    zScore: number
    effectSize: number
    power: number
  } | null => {
    if (!control || !variant) return null

    // Dados para teste Z: conversões
    const controlConversions = control.transactions
    const variantConversions = variant.transactions

    // Verificar se há dados suficientes
    if (control.sessions === 0 || variant.sessions === 0) return null
    if (controlConversions === 0 && variantConversions === 0) return null

    // Calcular taxas de conversão
    const controlRate = controlConversions / control.sessions
    const variantRate = variantConversions / variant.sessions

    // Calcular erro padrão combinado
    const pooledRate = (controlConversions + variantConversions) / (control.sessions + variant.sessions)
    const pooledVariance = pooledRate * (1 - pooledRate)
    
    const standardError = Math.sqrt(
      pooledVariance * (1 / control.sessions + 1 / variant.sessions)
    )

    // Calcular Z-score
    const zScore = Math.abs((variantRate - controlRate) / standardError)

    // Calcular p-value usando aproximação da distribuição normal
    // Função de erro complementar (erfc) para aproximar a distribuição normal
    const pValue = 2 * (1 - normalCDF(zScore))

    // Calcular tamanho do efeito (Cohen's h)
    const effectSize = 2 * Math.asin(Math.sqrt(variantRate)) - 2 * Math.asin(Math.sqrt(controlRate))

    // Calcular poder estatístico (power)
    const power = calculatePower(control.sessions, variant.sessions, effectSize)

    // Determinar nível de confiança
    let confidence = 'Baixa'
    if (pValue <= 0.001) confidence = '99.9%'
    else if (pValue <= 0.01) confidence = '99%'
    else if (pValue <= 0.05) confidence = '95%'
    else if (pValue <= 0.1) confidence = '90%'

    const isSignificant = pValue <= 0.05

    return {
      pValue,
      isSignificant,
      confidence,
      zScore,
      effectSize,
      power
    }
  }

  // Função para calcular CDF da distribuição normal padrão
  const normalCDF = (z: number): number => {
    // Aproximação usando função de erro complementar
    const t = 1 / (1 + 0.5 * Math.abs(z))
    const tau = t * Math.exp(-z * z - 1.26551223 + 1.00002368 * t + 0.37409196 * t * t + 
                             0.09678418 * t * t * t - 0.18628806 * t * t * t * t + 
                             0.27886807 * t * t * t * t * t - 1.13520398 * t * t * t * t * t * t + 
                             1.48851587 * t * t * t * t * t * t * t - 0.82215223 * t * t * t * t * t * t * t * t + 
                             0.17087277 * t * t * t * t * t * t * t * t * t)
    
    return z >= 0 ? 1 - tau : tau
  }

  // Função para calcular poder estatístico
  const calculatePower = (n1: number, n2: number, effectSize: number): number => {
    // Cálculo aproximado do poder estatístico
    const pooledN = (n1 * n2) / (n1 + n2)
    const criticalZ = 1.96 // Para alpha = 0.05 (bicaudal)
    
    const powerZ = effectSize * Math.sqrt(pooledN / 2) - criticalZ
    return normalCDF(powerZ)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando experimentos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    if (error === 'cliente-sem-experimentos') {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-blue-600 mb-4">
            <Target className="w-12 h-12 mx-auto mb-2" />
            <h3 className="text-lg font-semibold">Nenhum Experimento Ativo</h3>
          </div>
          <p className="text-blue-700 mb-4">
            Este cliente não possui testes A/B ativos no período selecionado ({startDate} a {endDate}).
          </p>
          <p className="text-blue-600 text-sm">
            Os experimentos podem estar em outras datas ou o cliente pode não ter configurado testes A/B ainda.
          </p>
        </div>
      )
    }

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 mb-4">
          <Target className="w-12 h-12 mx-auto mb-2" />
          <h3 className="text-lg font-semibold">Erro ao carregar dados</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchExperiments}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Informação sobre filtro de sessões */}
      {aggregatedExperiments.length > filteredAndSortedExperiments.length && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <span className="font-medium">Filtro ativo:</span> Ocultando {aggregatedExperiments.length - filteredAndSortedExperiments.length} experimento(s) com menos de 50 sessões totais.
        </div>
      )}
      
      {/* Botão Exportar CSV */}
      <div className="flex justify-end mb-4">
        <button
          onClick={exportToCSV}
          disabled={filteredAndSortedExperiments.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Timeline de Experimentos */}
      {experiments.length > 0 && (
        <TimelineAB 
          data={experiments}
          selectedExperimentId={selectedExperimentForTimeline}
          onExperimentSelect={setSelectedExperimentForTimeline}
        />
      )}





      {/* Lista de experimentos agregados */}
      <div className="space-y-8">
        {filteredAndSortedExperiments.map(experiment => (
          <div key={experiment.experiment_id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            {/* Header do experimento */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{experiment.experiment_name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span><strong>ID:</strong> {experiment.experiment_id}</span>
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Monitor className="w-4 h-4" />
                        <strong>Desktop:</strong> {experiment.desktop_data ? formatNumber(experiment.desktop_data.sessions) : '0'} sessões
                      </span>
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-4 h-4" />
                        <strong>Mobile:</strong> {experiment.mobile_data ? formatNumber(experiment.mobile_data.sessions) : '0'} sessões
                      </span>
                    </span>
                    <span><strong>Total Sessões:</strong> {formatNumber(experiment.total_sessions)}</span>
                    <span><strong>Total Usuários:</strong> {formatNumber(experiment.total_users)}</span>
                    <span><strong>Total Receita:</strong> {formatCurrency(experiment.total_revenue)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção de Métricas por Dispositivo */}
            <div className="m-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-gray-200 rounded-lg">
              <div className="px-6 py-3 border-b border-blue-200">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  📊 Resumo por Dispositivo
                </h4>
              </div>
              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card: Desktop */}
                  <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Monitor className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Desktop</h4>
                        <p className="text-sm text-gray-600">Análise para computadores</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Lift Desktop */}
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {(() => {
                            const desktopControl = experiment.variants['desktop_controle']
                            const desktopVariant = experiment.variants['desktop_1'] || experiment.variants['desktop_2']
                            
                            if (!desktopControl || !desktopVariant) return 'N/A'
                            
                            const lift = calculateLift(desktopControl, desktopVariant, 'revenue_per_session')
                            if (lift === null) return 'N/A'
                            
                            return (
                              <span className={lift > 0 ? 'text-green-600' : 'text-red-600'}>
                                {lift > 0 ? '+' : ''}{lift.toFixed(1)}%
                              </span>
                            )
                          })()}
                        </div>
                        <div className="text-sm font-medium text-gray-800">Lift</div>
                        <div className="text-xs text-gray-600">Receita/Sessão</div>
                      </div>
                      
                      {/* Significância Desktop */}
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {(() => {
                            const desktopControl = experiment.variants['desktop_controle']
                            const desktopVariant = experiment.variants['desktop_1'] || experiment.variants['desktop_2']
                            
                            if (!desktopControl || !desktopVariant) return 'N/A'
                            
                            const significance = calculateStatisticalSignificance(desktopControl, desktopVariant)
                            if (!significance) return 'N/A'
                            
                            return (
                              <span className={significance.isSignificant ? 'text-green-600' : 'text-yellow-600'}>
                                {significance.isSignificant ? '✓' : '⚠️'}
                              </span>
                            )
                          })()}
                        </div>
                        <div className="text-sm font-medium text-gray-800">Significância</div>
                        <div className="text-xs text-gray-600">p &lt; 0.05</div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Mobile */}
                  <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Smartphone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Mobile</h4>
                        <p className="text-sm text-gray-600">Análise para dispositivos móveis</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Lift Mobile */}
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {(() => {
                            const mobileControl = experiment.variants['mobile_controle']
                            const mobileVariant = experiment.variants['mobile_1'] || experiment.variants['mobile_2']
                            
                            if (!mobileControl || !mobileVariant) return 'N/A'
                            
                            const lift = calculateLift(mobileControl, mobileVariant, 'revenue_per_session')
                            if (lift === null) return 'N/A'
                            
                            return (
                              <span className={lift > 0 ? 'text-green-600' : 'text-red-600'}>
                                {lift > 0 ? '+' : ''}{lift.toFixed(1)}%
                              </span>
                            )
                          })()}
                        </div>
                        <div className="text-sm font-medium text-gray-800">Lift</div>
                        <div className="text-xs text-gray-600">Receita/Sessão</div>
                      </div>
                      
                      {/* Significância Mobile */}
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-1">
                          {(() => {
                            const mobileControl = experiment.variants['mobile_controle']
                            const mobileVariant = experiment.variants['mobile_1'] || experiment.variants['mobile_2']
                            
                            if (!mobileControl || !mobileVariant) return 'N/A'
                            
                            const significance = calculateStatisticalSignificance(mobileControl, mobileVariant)
                            if (!significance) return 'N/A'
                            
                            return (
                              <span className={significance.isSignificant ? 'text-green-600' : 'text-yellow-600'}>
                                {significance.isSignificant ? '✓' : '⚠️'}
                              </span>
                            )
                          })()}
                        </div>
                        <div className="text-sm font-medium text-gray-800">Significância</div>
                        <div className="text-xs text-gray-600">p &lt; 0.05</div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Projeção Anual */}
                  {(() => {
                    const desktopControl = experiment.variants['desktop_controle']
                    const desktopVariant = experiment.variants['desktop_1'] || experiment.variants['desktop_2']
                    const mobileControl = experiment.variants['mobile_controle']
                    const mobileVariant = experiment.variants['mobile_1'] || experiment.variants['mobile_2']
                    
                    let desktopProjection = 0
                    let mobileProjection = 0
                    let hasDesktopWinner = false
                    let hasMobileWinner = false
                    
                    // Calcular projeção desktop
                    if (desktopControl && desktopVariant) {
                      const significance = calculateStatisticalSignificance(desktopControl, desktopVariant)
                      if (significance?.isSignificant && desktopVariant.revenue_per_session > desktopControl.revenue_per_session) {
                        const liftValue = desktopVariant.revenue_per_session - desktopControl.revenue_per_session
                        const dailySessions = desktopControl.sessions + desktopVariant.sessions
                        const daysInPeriod = Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24) + 1)
                        const avgDailySessions = dailySessions / daysInPeriod
                        desktopProjection = liftValue * avgDailySessions * 365
                        hasDesktopWinner = true
                      }
                    }
                    
                    // Calcular projeção mobile
                    if (mobileControl && mobileVariant) {
                      const significance = calculateStatisticalSignificance(mobileControl, mobileVariant)
                      if (significance?.isSignificant && mobileVariant.revenue_per_session > mobileControl.revenue_per_session) {
                        const liftValue = mobileVariant.revenue_per_session - mobileControl.revenue_per_session
                        const dailySessions = mobileControl.sessions + mobileVariant.sessions
                        const daysInPeriod = Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24) + 1)
                        const avgDailySessions = dailySessions / daysInPeriod
                        mobileProjection = liftValue * avgDailySessions * 365
                        hasMobileWinner = true
                      }
                    }
                    
                    const totalProjection = desktopProjection + mobileProjection
                    
                    if (!hasDesktopWinner && !hasMobileWinner) return null
                    
                    return (
                      <div className="bg-white rounded-lg p-4 border-2 border-green-300 shadow-sm col-span-full">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
                            <DollarSign className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">💰 Projeção de Receita Adicional Anual</h4>
                            <p className="text-sm text-gray-600">Ganho potencial ao implementar a variante vencedora</p>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                          <div className="text-center mb-4">
                            <div className="text-3xl font-bold text-green-700 mb-2">
                              +{formatCurrency(totalProjection)}
                            </div>
                            <div className="text-sm text-green-600">
                              por ano em receita adicional estimada (total)
                            </div>
                          </div>
                          
                          {/* Projeção por Dispositivo */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            {hasDesktopWinner && (
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Monitor className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-700">Desktop</span>
                                </div>
                                <div className="text-2xl font-bold text-blue-600">
                                  +{formatCurrency(desktopProjection)}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {((desktopProjection / totalProjection) * 100).toFixed(1)}% do total
                                </div>
                              </div>
                            )}
                            
                            {hasMobileWinner && (
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Smartphone className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium text-gray-700">Mobile</span>
                                </div>
                                <div className="text-2xl font-bold text-green-600">
                                  +{formatCurrency(mobileProjection)}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {((mobileProjection / totalProjection) * 100).toFixed(1)}% do total
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="pt-3 border-t border-green-200">
                            <div className="text-xs text-gray-600 space-y-1">
                              <div className="flex items-center justify-between">
                                <span>📊 Base de cálculo:</span>
                                <span className="font-medium">Lift de receita/sessão × volume anual</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>📅 Período analisado:</span>
                                <span className="font-medium">{new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>✅ Significância:</span>
                                <span className="font-medium text-green-600">Estatisticamente comprovado (p &lt; 0.05)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-xs text-gray-500 bg-blue-50 rounded px-3 py-2">
                          💡 <strong>Nota:</strong> Esta é uma projeção conservadora baseada no desempenho atual. Resultados reais podem variar devido a sazonalidade e mudanças no comportamento do usuário.
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

            {/* Tabela de variantes */}
            <div className="m-6 border border-gray-200 rounded-lg shadow-sm">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  📈 Detalhamento por Variante e Dispositivo
                </h4>
                <button
                  onClick={() => setFullscreenTable(experiment.experiment_id)}
                  className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                  Tela Cheia
                </button>
              </div>
              
              {/* Legenda dos Eventos de Conversão */}
              <div className="px-6 py-3 bg-purple-50 border-b border-purple-200">
                <div className="flex items-center gap-2 text-xs text-purple-800">
                  <span className="font-semibold">Eventos do Funil:</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-purple-400 rounded-full"></span>
                    Carrinho = Add to Cart
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-purple-400 rounded-full"></span>
                    Checkout = Begin Checkout
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-purple-400 rounded-full"></span>
                    Envio = Add Shipping Info
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-purple-400 rounded-full"></span>
                    Pagamento = Add Payment Info
                  </span>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variante
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessões
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuários
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessões/Usuário
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transações
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receita
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taxa Conv.
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rec./Sessão
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket Médio
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50 border-l-2 border-purple-200">
                      Carrinho
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50">
                      Checkout
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50">
                      Envio
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50 border-r-2 border-purple-200">
                      Pagamento
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lift
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signif.
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(experiment.variants).map(([variantKey, data]) => {
                    const [category, variant] = variantKey.split('_')
                    const isControl = variant === 'controle'
                    const isMobile = category === 'mobile'
                    
                    // Encontrar dados de controle para calcular lift
                    const controlKey = isMobile ? 'mobile_controle' : 'desktop_controle'
                    const controlData = experiment.variants[controlKey]
                    const liftRevenuePerSession = !isControl && controlData ? 
                      calculateLift(controlData, data, 'revenue_per_session') : null
                    
                    // Calcular lifts para os eventos do funil
                    const liftAddToCart = !isControl && controlData ? 
                      calculateLift(controlData, data, 'add_to_cart_rate') : null
                    const liftBeginCheckout = !isControl && controlData ? 
                      calculateLift(controlData, data, 'begin_checkout_rate') : null
                    const liftAddShipping = !isControl && controlData ? 
                      calculateLift(controlData, data, 'add_shipping_info_rate') : null
                    const liftAddPayment = !isControl && controlData ? 
                      calculateLift(controlData, data, 'add_payment_info_rate') : null
                    
                    return (
                      <tr key={variantKey} className={`${isControl ? 'bg-blue-50' : 'hover:bg-gray-50'} ${isMobile ? 'border-l-4 border-l-blue-200' : 'border-l-4 border-l-green-200'}`}>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                              isMobile ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {isMobile ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                              {category}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isControl 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {isControl ? 'Ctrl' : `V${variant}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(data.sessions)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{formatNumber(data.users)}</div>
                            <div className="text-xs text-gray-500">{formatPercentage(data.users_percentage)} do tráfego</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {data.sessions_per_user.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(data.transactions)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(data.revenue)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatPercentage(data.conversion_rate)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(data.revenue_per_session)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(data.avg_order_value)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50 border-l-2 border-purple-200">
                          <div className="text-center">
                            <div className="font-medium">{formatNumber(data.add_to_cart)}</div>
                            <div className="text-xs text-gray-600">{formatPercentage(data.add_to_cart_rate)}</div>
                            {!isControl && liftAddToCart !== null && (
                              <div className={`text-xs font-medium ${liftAddToCart > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {liftAddToCart > 0 ? '↑' : '↓'}{Math.abs(liftAddToCart).toFixed(1)}%
                              </div>
                            )}
                            {isControl && <div className="text-xs text-gray-400">controle</div>}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">
                          <div className="text-center">
                            <div className="font-medium">{formatNumber(data.begin_checkout)}</div>
                            <div className="text-xs text-gray-600">{formatPercentage(data.begin_checkout_rate)}</div>
                            {!isControl && liftBeginCheckout !== null && (
                              <div className={`text-xs font-medium ${liftBeginCheckout > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {liftBeginCheckout > 0 ? '↑' : '↓'}{Math.abs(liftBeginCheckout).toFixed(1)}%
                              </div>
                            )}
                            {isControl && <div className="text-xs text-gray-400">controle</div>}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">
                          <div className="text-center">
                            <div className="font-medium">{formatNumber(data.add_shipping_info)}</div>
                            <div className="text-xs text-gray-600">{formatPercentage(data.add_shipping_info_rate)}</div>
                            {!isControl && liftAddShipping !== null && (
                              <div className={`text-xs font-medium ${liftAddShipping > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {liftAddShipping > 0 ? '↑' : '↓'}{Math.abs(liftAddShipping).toFixed(1)}%
                              </div>
                            )}
                            {isControl && <div className="text-xs text-gray-400">controle</div>}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50 border-r-2 border-purple-200">
                          <div className="text-center">
                            <div className="font-medium">{formatNumber(data.add_payment_info)}</div>
                            <div className="text-xs text-gray-600">{formatPercentage(data.add_payment_info_rate)}</div>
                            {!isControl && liftAddPayment !== null && (
                              <div className={`text-xs font-medium ${liftAddPayment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {liftAddPayment > 0 ? '↑' : '↓'}{Math.abs(liftAddPayment).toFixed(1)}%
                              </div>
                            )}
                            {isControl && <div className="text-xs text-gray-400">controle</div>}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {!isControl && liftRevenuePerSession !== null ? (
                            <div className="flex items-center gap-1">
                              {liftRevenuePerSession > 0 ? (
                                <TrendingUpIcon className="w-4 h-4 text-green-600" />
                              ) : (
                                <TrendingDownIcon className="w-4 h-4 text-red-600" />
                              )}
                              <span className={`text-sm font-medium ${
                                liftRevenuePerSession > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {liftRevenuePerSession > 0 ? '+' : ''}{liftRevenuePerSession.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {!isControl && controlData ? (
                            (() => {
                              const significance = calculateStatisticalSignificance(controlData, data)
                              if (!significance) return <span className="text-sm text-gray-400">-</span>
                              
                              return (
                                <div className="flex items-center gap-1">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                    significance.isSignificant 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {significance.isSignificant ? '✓' : '⚠️'}
                                  </span>
                                  <div className="text-xs">
                                    <div className={`font-medium ${
                                      significance.isSignificant ? 'text-green-700' : 'text-yellow-700'
                                    }`}>
                                      {significance.confidence}
                                    </div>
                                    <div className="text-gray-500 text-xs">
                                      p={significance.pValue.toFixed(3)}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        ))}

        {filteredAndSortedExperiments.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum experimento encontrado</h3>
            <p className="text-gray-600">
              Não há dados de experimentos para o período e filtros selecionados.
            </p>
          </div>
        )}
      </div>

      {/* Modal Tela Cheia */}
      {fullscreenTable && (() => {
        const experiment = filteredAndSortedExperiments.find(exp => exp.experiment_id === fullscreenTable)
        if (!experiment) return null

        return (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{experiment.experiment_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">ID: {experiment.experiment_id}</p>
                </div>
                <button
                  onClick={() => setFullscreenTable(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Conteúdo da Tabela */}
              <div className="flex-1 overflow-auto p-6">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Variante
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sessões
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuários
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sessões/Usuário
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transações
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Receita
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Taxa Conv.
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rec./Sessão
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ticket Médio
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50 border-l-2 border-purple-200">
                        Carrinho
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50">
                        Checkout
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50">
                        Envio
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50 border-r-2 border-purple-200">
                        Pagamento
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lift
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Signif.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(experiment.variants).map(([variantKey, data]) => {
                      const [category, variant] = variantKey.split('_')
                      const isControl = variant === 'controle'
                      const isMobile = category === 'mobile'
                      
                      const controlKey = isMobile ? 'mobile_controle' : 'desktop_controle'
                      const controlData = experiment.variants[controlKey]
                      const liftRevenuePerSession = !isControl && controlData ? 
                        calculateLift(controlData, data, 'revenue_per_session') : null
                      
                      const liftAddToCart = !isControl && controlData ? 
                        calculateLift(controlData, data, 'add_to_cart_rate') : null
                      const liftBeginCheckout = !isControl && controlData ? 
                        calculateLift(controlData, data, 'begin_checkout_rate') : null
                      const liftAddShipping = !isControl && controlData ? 
                        calculateLift(controlData, data, 'add_shipping_info_rate') : null
                      const liftAddPayment = !isControl && controlData ? 
                        calculateLift(controlData, data, 'add_payment_info_rate') : null

                      return (
                        <tr key={variantKey} className={`${isControl ? 'bg-blue-50' : 'hover:bg-gray-50'} ${isMobile ? 'border-l-4 border-l-blue-200' : 'border-l-4 border-l-green-200'}`}>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                                isMobile ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {isMobile ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                                {category}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                isControl 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {isControl ? 'Ctrl' : `V${variant}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(data.sessions)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div className="font-medium">{formatNumber(data.users)}</div>
                              <div className="text-xs text-gray-500">{formatPercentage(data.users_percentage)} do tráfego</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            {data.sessions_per_user.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(data.transactions)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(data.revenue)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatPercentage(data.conversion_rate)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(data.revenue_per_session)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(data.avg_order_value)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50 border-l-2 border-purple-200">
                            <div className="text-center">
                              <div className="font-medium">{formatNumber(data.add_to_cart)}</div>
                              <div className="text-xs text-gray-600">{formatPercentage(data.add_to_cart_rate)}</div>
                              {!isControl && liftAddToCart !== null && (
                                <div className={`text-xs font-medium ${liftAddToCart > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {liftAddToCart > 0 ? '↑' : '↓'}{Math.abs(liftAddToCart).toFixed(1)}%
                                </div>
                              )}
                              {isControl && <div className="text-xs text-gray-400">controle</div>}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">
                            <div className="text-center">
                              <div className="font-medium">{formatNumber(data.begin_checkout)}</div>
                              <div className="text-xs text-gray-600">{formatPercentage(data.begin_checkout_rate)}</div>
                              {!isControl && liftBeginCheckout !== null && (
                                <div className={`text-xs font-medium ${liftBeginCheckout > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {liftBeginCheckout > 0 ? '↑' : '↓'}{Math.abs(liftBeginCheckout).toFixed(1)}%
                                </div>
                              )}
                              {isControl && <div className="text-xs text-gray-400">controle</div>}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">
                            <div className="text-center">
                              <div className="font-medium">{formatNumber(data.add_shipping_info)}</div>
                              <div className="text-xs text-gray-600">{formatPercentage(data.add_shipping_info_rate)}</div>
                              {!isControl && liftAddShipping !== null && (
                                <div className={`text-xs font-medium ${liftAddShipping > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {liftAddShipping > 0 ? '↑' : '↓'}{Math.abs(liftAddShipping).toFixed(1)}%
                                </div>
                              )}
                              {isControl && <div className="text-xs text-gray-400">controle</div>}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50 border-r-2 border-purple-200">
                            <div className="text-center">
                              <div className="font-medium">{formatNumber(data.add_payment_info)}</div>
                              <div className="text-xs text-gray-600">{formatPercentage(data.add_payment_info_rate)}</div>
                              {!isControl && liftAddPayment !== null && (
                                <div className={`text-xs font-medium ${liftAddPayment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {liftAddPayment > 0 ? '↑' : '↓'}{Math.abs(liftAddPayment).toFixed(1)}%
                                </div>
                              )}
                              {isControl && <div className="text-xs text-gray-400">controle</div>}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {!isControl && liftRevenuePerSession !== null ? (
                              <div className="flex items-center gap-1">
                                {liftRevenuePerSession > 0 ? (
                                  <TrendingUpIcon className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDownIcon className="w-4 h-4 text-red-600" />
                                )}
                                <span className={`text-sm font-medium ${
                                  liftRevenuePerSession > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {liftRevenuePerSession > 0 ? '+' : ''}{liftRevenuePerSession.toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {!isControl && controlData ? (
                              (() => {
                                const significance = calculateStatisticalSignificance(controlData, data)
                                if (!significance) return <span className="text-sm text-gray-400">-</span>
                                
                                return (
                                  <div className="flex items-center gap-1">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                      significance.isSignificant 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {significance.isSignificant ? '✓' : '⚠️'}
                                    </span>
                                    <div className="text-xs">
                                      <div className={`font-medium ${
                                        significance.isSignificant ? 'text-green-700' : 'text-yellow-700'
                                      }`}>
                                        {significance.confidence}
                                      </div>
                                      <div className="text-gray-500 text-xs">
                                        p={significance.pValue.toFixed(3)}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default ABTesting
