import { useState, useEffect } from 'react'
import { 
  Download,
  RefreshCw,
  Target,
  Zap,
  TrendingUpIcon,
  TrendingDownIcon,
  Monitor,
  Smartphone
} from 'lucide-react'

interface ExperimentData {
  event_date: string
  experiment_id: string
  experiment_name: string
  experiment_variant: string
  category: string
  sessions: number
  transactions: number
  revenue: number
}

interface AggregatedExperiment {
  experiment_id: string
  experiment_name: string
  category: string
  variants: {
    [variant: string]: {
      sessions: number
      transactions: number
      revenue: number
      conversion_rate: number
      revenue_per_session: number
      avg_order_value: number
      category: string
      variant: string
    }
  }
  total_sessions: number
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
          transactions: 0,
          revenue: 0,
          conversion_rate: 0,
          revenue_per_session: 0,
          avg_order_value: 0,
          category: exp.category,
          variant: variant
        }
      }

      experiment.variants[categoryKey].sessions += exp.sessions
      experiment.variants[categoryKey].transactions += exp.transactions
      experiment.variants[categoryKey].revenue += exp.revenue

      experiment.total_sessions += exp.sessions
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
      // Métricas por variante
      Object.values(experiment.variants).forEach(variant => {
        variant.conversion_rate = variant.sessions > 0 ? (variant.transactions / variant.sessions) * 100 : 0
        variant.revenue_per_session = variant.sessions > 0 ? variant.revenue / variant.sessions : 0
        variant.avg_order_value = variant.transactions > 0 ? variant.revenue / variant.transactions : 0
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

  // Filtrar dados agregados (sem filtros, mostrar todos)
  const filteredAndSortedExperiments = aggregatedExperiments





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

    const headers = ['ID do Experimento', 'Nome do Experimento', 'Categoria', 'Variante', 'Sessões', 'Transações', 'Receita', 'Taxa de Conversão', 'Receita por Sessão', 'Ticket Médio']
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedExperiments.flatMap(exp => 
        Object.entries(exp.variants).map(([variant, data]) => [
          exp.experiment_id,
          `"${exp.experiment_name}"`,
          exp.category,
          variant === 'controle' ? 'Controle' : `Variante ${variant}`,
          data.sessions,
          data.transactions,
          data.revenue,
          data.conversion_rate.toFixed(2),
          data.revenue_per_session.toFixed(2),
          data.avg_order_value.toFixed(2)
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
  const calculateLift = (control: any, variant: any, metric: 'revenue_per_session' | 'conversion_rate') => {
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





      {/* Lista de experimentos agregados */}
      <div className="space-y-6">
        {filteredAndSortedExperiments.map(experiment => (
          <div key={experiment.experiment_id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
                    <span><strong>Total Receita:</strong> {formatCurrency(experiment.total_revenue)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabela de variantes */}
            <div className="overflow-x-auto">
              {/* Seção de Métricas por Dispositivo */}
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </div>

              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessões
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transações
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receita
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taxa de Conversão
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receita por Sessão
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket Médio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lift vs Controle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Significância
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
                    
                    return (
                      <tr key={variantKey} className={`${isControl ? 'bg-blue-50' : 'hover:bg-gray-50'} ${isMobile ? 'border-l-4 border-l-blue-200' : 'border-l-4 border-l-green-200'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              isMobile ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {isMobile ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                              {category}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isControl 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {isControl ? 'Controle' : `Variante ${variant}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(data.sessions)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(data.transactions)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(data.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPercentage(data.conversion_rate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(data.revenue_per_session)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(data.avg_order_value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {!isControl && liftRevenuePerSession !== null ? (
                            <div className="flex items-center gap-2">
                              {liftRevenuePerSession > 0 ? (
                                <TrendingUpIcon className="w-4 h-4 text-green-600" />
                              ) : (
                                <TrendingDownIcon className="w-4 h-4 text-red-600" />
                              )}
                              <span className={`text-sm font-medium ${
                                liftRevenuePerSession > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {liftRevenuePerSession > 0 ? '+' : ''}{liftRevenuePerSession.toFixed(2)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {!isControl && controlData ? (
                            (() => {
                              const significance = calculateStatisticalSignificance(controlData, data)
                              if (!significance) return <span className="text-sm text-gray-400">-</span>
                              
                              return (
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
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
                                    <div className="text-gray-500">
                                      p &lt; {significance.pValue.toFixed(3)}
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                      Z: {significance.zScore.toFixed(2)}
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                      Power: {(significance.power * 100).toFixed(0)}%
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
    </div>
  )
}

export default ABTesting
