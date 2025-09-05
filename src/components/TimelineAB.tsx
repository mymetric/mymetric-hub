import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { TrendingUp, DollarSign, Users, Monitor, Smartphone, Target } from 'lucide-react'
import { useState } from 'react'

interface ExperimentTimelineData {
  event_date: string
  experiment_id: string
  experiment_name: string
  experiment_variant: string
  category: string
  sessions: number
  transactions: number
  revenue: number
}

interface TimelineABProps {
  data: ExperimentTimelineData[]
  selectedExperimentId?: string
  onExperimentSelect?: (experimentId: string) => void
}

interface ProcessedTimelineData {
  date: string
  [key: string]: string | number
}

const TimelineAB = ({ data, selectedExperimentId, onExperimentSelect }: TimelineABProps) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['lift'])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['mobile', 'desktop'])

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Timeline de Experimentos</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhum dado disponível para a timeline</p>
        </div>
      </div>
    )
  }

  // Obter experimentos únicos
  const experiments = Array.from(new Set(data.map(item => item.experiment_id)))
    .map(id => {
      const experimentData = data.find(item => item.experiment_id === id)
      return {
        id,
        name: experimentData?.experiment_name || id
      }
    })

  // Obter variantes únicas
  const variants = Array.from(new Set(data.map(item => item.experiment_variant || 'controle')))
  
  // Obter categorias únicas
  const categories = Array.from(new Set(data.map(item => item.category)))

  // Filtrar dados baseado nas seleções
  const filteredData = data.filter(item => {
    const matchesExperiment = !selectedExperimentId || item.experiment_id === selectedExperimentId
    const matchesCategory = selectedCategories.includes(item.category)
    
    return matchesExperiment && matchesCategory
  })

  // Processar dados para o gráfico (lift de receita por sessão acumulado)
  const processTimelineData = (): ProcessedTimelineData[] => {
    const dateMap = new Map<string, any>()

    filteredData.forEach(item => {
      const date = item.event_date
      const variant = item.experiment_variant || 'controle'
      const category = item.category
      const key = `${category}_${variant}`

      if (!dateMap.has(date)) {
        dateMap.set(date, { date })
      }

      const dayData = dateMap.get(date)
      
      // Adicionar dados por categoria e variante
      dayData[`${key}_sessions`] = (dayData[`${key}_sessions`] || 0) + item.sessions
      dayData[`${key}_revenue`] = (dayData[`${key}_revenue`] || 0) + item.revenue
      dayData[`${key}_transactions`] = (dayData[`${key}_transactions`] || 0) + item.transactions
    })

    // Ordenar por data e calcular valores acumulados
    const sortedData = Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calcular valores acumulados
    const accumulatedData = sortedData.map((item, index) => {
      const accumulatedItem = { ...item }
      
      if (index === 0) {
        // Primeiro item mantém os valores originais
        return accumulatedItem
      }
      
      // Acumular valores de todos os dias anteriores
      for (let i = 0; i < index; i++) {
        const previousItem = sortedData[i]
        
        // Acumular todas as chaves numéricas
        Object.keys(previousItem).forEach(key => {
          if (key !== 'date' && typeof previousItem[key] === 'number') {
            accumulatedItem[key] = (accumulatedItem[key] || 0) + previousItem[key]
          }
        })
      }
      
      return accumulatedItem
    })

    // Calcular lift e p-value de receita por sessão acumulado
    const liftData = accumulatedData.map(item => {
      const liftItem: any = { date: item.date }
      
      // Calcular lift e p-value para cada categoria e variante
      categories.forEach(category => {
        const controlKey = `${category}_controle`
        const controlSessions = item[`${controlKey}_sessions`] || 0
        const controlRevenue = item[`${controlKey}_revenue`] || 0
        const controlTransactions = item[`${controlKey}_transactions`] || 0
        const controlRevenuePerSession = controlSessions > 0 ? controlRevenue / controlSessions : 0
        
        // Calcular lift para cada variante (exceto controle)
        variants.forEach(variant => {
          if (variant !== 'controle') {
            const variantKey = `${category}_${variant}`
            const variantSessions = item[`${variantKey}_sessions`] || 0
            const variantRevenue = item[`${variantKey}_revenue`] || 0
            const variantTransactions = item[`${variantKey}_transactions`] || 0
            const variantRevenuePerSession = variantSessions > 0 ? variantRevenue / variantSessions : 0
            
            // Calcular lift percentual
            const lift = controlRevenuePerSession > 0 
              ? ((variantRevenuePerSession - controlRevenuePerSession) / controlRevenuePerSession) * 100 
              : 0
            
            liftItem[`${category}_${variant}_lift`] = lift
            
            // Calcular p-value usando teste Z para proporções (conversões)
            let pValue = 1.0
            if (controlSessions > 0 && variantSessions > 0 && (controlTransactions > 0 || variantTransactions > 0)) {
              const controlRate = controlTransactions / controlSessions
              const variantRate = variantTransactions / variantSessions
              
              // Calcular erro padrão combinado
              const pooledRate = (controlTransactions + variantTransactions) / (controlSessions + variantSessions)
              const pooledVariance = pooledRate * (1 - pooledRate)
              
              const standardError = Math.sqrt(
                pooledVariance * (1 / controlSessions + 1 / variantSessions)
              )
              
              if (standardError > 0) {
                // Calcular Z-score
                const zScore = Math.abs((variantRate - controlRate) / standardError)
                
                // Aproximação simples do p-value usando distribuição normal
                // Para valores de Z > 1.96, p < 0.05
                if (zScore >= 2.576) pValue = 0.01
                else if (zScore >= 1.96) pValue = 0.05
                else if (zScore >= 1.645) pValue = 0.10
                else if (zScore >= 1.282) pValue = 0.20
                else pValue = 0.50
              }
            }
            
            liftItem[`${category}_${variant}_pvalue`] = pValue
          }
        })
      })
      
      return liftItem
    })

    return liftData.map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      })
    }))
  }

  const chartData = processTimelineData()

  // Verificar se há testes vencedores
  const getWinningTests = () => {
    const winners: Array<{category: string, variant: string, lift: number, pValue: number}> = []
    
    if (chartData.length > 0) {
      const lastData = chartData[chartData.length - 1]
      
      selectedCategories.forEach(category => {
        const categoryVariants = variants.filter(v => v !== 'controle' && filteredData.some(d => d.category === category && (d.experiment_variant || 'controle') === v))
        
        categoryVariants.forEach(variant => {
          const liftKey = `${category}_${variant}_lift`
          const pValueKey = `${category}_${variant}_pvalue`
          const currentLift = lastData?.[liftKey] || 0
          const currentPValue = lastData?.[pValueKey] || 1.0
          
          if (currentLift > 0 && currentPValue <= 0.05) {
            winners.push({category, variant, lift: currentLift, pValue: currentPValue})
          }
        })
      })
    }
    
    return winners
  }

  const winningTests = getWinningTests()

  // Definir métricas disponíveis baseadas nos dados
  const availableMetrics = [
    { key: 'lift', label: 'Lift Receita/Sessão', color: '#10b981', icon: TrendingUp, yAxisId: 'left' },
    { key: 'pvalue', label: 'P-Value (Significância)', color: '#ef4444', icon: Target, yAxisId: 'right' }
  ]

  // Função para alternar métrica selecionada
  const toggleMetric = (metricKey: string) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metricKey)) {
        return prev.length > 1 ? prev.filter(m => m !== metricKey) : prev
      } else {
        return prev.length < 2 ? [...prev, metricKey] : [prev[1], metricKey]
      }
    })
  }

  // Função para alternar categoria selecionada
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.length > 1 ? prev.filter(c => c !== category) : prev
      } else {
        return [...prev, category]
      }
    })
  }


  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-sm">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <p className="text-xs text-blue-600 mb-3">📈 Métricas acumuladas vs Controle</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => {
              const [category, variant, metric] = entry.dataKey.split('_')
              const value = entry.value
              
              let formattedValue = ''
              let colorClass = 'text-gray-600'
              
              if (metric === 'lift') {
                formattedValue = `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
                colorClass = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600'
              } else if (metric === 'pvalue') {
                formattedValue = value.toFixed(3)
                colorClass = value <= 0.05 ? 'text-green-600' : value <= 0.1 ? 'text-yellow-600' : 'text-red-600'
              }
              
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span className="text-sm text-gray-600">
                      {category === 'mobile' ? '📱' : '💻'} {variant} - {metric === 'lift' ? 'Lift' : 'P-Value'}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${colorClass}`}>
                    {formattedValue}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return null
  }

  // Gerar linhas do gráfico baseadas nas seleções
  const generateChartLines = () => {
    const lines: any[] = []
    
    selectedCategories.forEach(category => {
      const categoryVariants = variants.filter(v => v !== 'controle' && filteredData.some(d => d.category === category && (d.experiment_variant || 'controle') === v))

      categoryVariants.forEach(variant => {
        selectedMetrics.forEach(metric => {
          const dataKey = `${category}_${variant}_${metric}`
          const color = category === 'mobile' ? '#3b82f6' : '#10b981'
          const strokeDasharray = metric === 'pvalue' ? '5 5' : '0'
          
          lines.push(
            <Line
              key={dataKey}
              yAxisId={metric === 'pvalue' ? 'right' : 'left'}
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={3}
              strokeDasharray={strokeDasharray}
              dot={{ fill: color, strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: color, strokeWidth: 2 }}
              name={`${category === 'mobile' ? '📱' : '💻'} ${variant} - ${metric === 'lift' ? 'Lift' : 'P-Value'}`}
            />
          )
        })
      })
    })

    return lines
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Lift e Significância Estatística (Acumulado)</h3>
        </div>
        <div className="text-sm text-gray-500 bg-green-50 px-3 py-1 rounded-lg">
          📈 Lift e P-Value acumulados vs Controle
        </div>
      </div>

      {/* Banner de Testes Vencedores */}
      {winningTests.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <h4 className="text-lg font-bold text-green-800">Testes Vencedores Detectados!</h4>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {winningTests.map((winner, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {winner.category === 'mobile' ? <Smartphone className="w-4 h-4 text-blue-600" /> : <Monitor className="w-4 h-4 text-green-600" />}
                    <span className="font-medium text-gray-800">
                      {winner.category === 'mobile' ? 'Mobile' : 'Desktop'} - Variante {winner.variant}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">+{winner.lift.toFixed(1)}%</div>
                    <div className="text-xs text-gray-600">p = {winner.pValue.toFixed(3)}</div>
                  </div>
                </div>
                <div className="text-xs text-green-700 mt-2">
                  🎉 <strong>Recomendação:</strong> Implementar esta variante em produção para maximizar a receita por sessão.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seleção de Experimento */}
      {experiments.length > 1 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700">Experimento:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onExperimentSelect?.('')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                !selectedExperimentId
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              }`}
            >
              Todos os Experimentos
            </button>
            {experiments.map((experiment) => (
              <button
                key={experiment.id}
                onClick={() => onExperimentSelect?.(experiment.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedExperimentId === experiment.id
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                {experiment.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Seleção de Categorias */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">Dispositivos:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const Icon = category === 'mobile' ? Smartphone : Monitor
            return (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedCategories.includes(category)
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="capitalize">{category}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Seleção de Métricas */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">Métricas:</span>
          <span className="text-xs text-gray-500">(Selecione 1 ou 2)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableMetrics.map((metric) => {
            const Icon = metric.icon
            return (
              <button
                key={metric.key}
                onClick={() => toggleMetric(metric.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedMetrics.includes(metric.key)
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{metric.label}</span>
                {selectedMetrics.includes(metric.key) && (
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: metric.color }}
                  ></div>
                )}
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-80 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="left"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value.toFixed(1)}%`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toFixed(3)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {generateChartLines()}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Resumo dos dados - Lift e P-Value atuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        {selectedCategories.map(category => {
          const categoryVariants = variants.filter(v => v !== 'controle' && filteredData.some(d => d.category === category && (d.experiment_variant || 'controle') === v))
          
          if (categoryVariants.length === 0) return null
          
          return (
            <div key={category} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                {category === 'mobile' ? <Smartphone className="w-4 h-4 text-blue-600" /> : <Monitor className="w-4 h-4 text-green-600" />}
                <span className="text-sm font-medium text-gray-700">{category === 'mobile' ? 'Mobile' : 'Desktop'}</span>
              </div>
              <div className="space-y-2">
                {categoryVariants.map(variant => {
                  const lastData = chartData[chartData.length - 1]
                  const liftKey = `${category}_${variant}_lift`
                  const pValueKey = `${category}_${variant}_pvalue`
                  const currentLift = lastData?.[liftKey] || 0
                  const currentPValue = lastData?.[pValueKey] || 1.0
                  
                  // Determinar se é vencedor
                  const isWinner = currentLift > 0 && currentPValue <= 0.05
                  const isPromising = currentLift > 0 && currentPValue <= 0.1
                  const isLosing = currentLift < 0 && currentPValue <= 0.05
                  
                  return (
                    <div key={variant} className={`rounded-lg p-3 ${
                      isWinner ? 'bg-green-50 border-2 border-green-200' : 
                      isPromising ? 'bg-yellow-50 border-2 border-yellow-200' :
                      isLosing ? 'bg-red-50 border-2 border-red-200' :
                      'bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-gray-800">Variante {variant}</div>
                        {isWinner && (
                          <div className="flex items-center gap-1 text-green-600">
                            <span className="text-xs">🏆</span>
                            <span className="text-xs font-medium">VENCEDOR</span>
                          </div>
                        )}
                        {isPromising && !isWinner && (
                          <div className="flex items-center gap-1 text-yellow-600">
                            <span className="text-xs">⚡</span>
                            <span className="text-xs font-medium">PROMISSOR</span>
                          </div>
                        )}
                        {isLosing && (
                          <div className="flex items-center gap-1 text-red-600">
                            <span className="text-xs">📉</span>
                            <span className="text-xs font-medium">PERDEDOR</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Lift:</span>
                        <span className={`text-sm font-medium ${
                          currentLift > 0 ? 'text-green-600' : currentLift < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {currentLift > 0 ? '+' : ''}{currentLift.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">P-Value:</span>
                        <span className={`text-sm font-medium ${
                          currentPValue <= 0.05 ? 'text-green-600' : currentPValue <= 0.1 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {currentPValue.toFixed(3)}
                        </span>
                      </div>
                      
                      {/* Comentário automático */}
                      {isWinner && (
                        <div className="text-xs text-green-700 bg-green-100 rounded px-2 py-1 mt-2">
                          🎉 <strong>Teste vencedor!</strong> Variante {variant} apresenta {currentLift.toFixed(1)}% de melhoria com 95% de confiança estatística.
                        </div>
                      )}
                      {isPromising && !isWinner && (
                        <div className="text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-1 mt-2">
                          ⚡ <strong>Resultado promissor!</strong> Variante {variant} mostra {currentLift.toFixed(1)}% de melhoria, mas precisa de mais dados para confirmação.
                        </div>
                      )}
                      {isLosing && (
                        <div className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 mt-2">
                          📉 <strong>Teste perdedor!</strong> Variante {variant} apresenta {Math.abs(currentLift).toFixed(1)}% de queda com significância estatística.
                        </div>
                      )}
                      {!isWinner && !isPromising && !isLosing && currentLift > 0 && (
                        <div className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1 mt-2">
                          📊 Resultado positivo mas sem significância estatística. Continue coletando dados.
                        </div>
                      )}
                      {!isWinner && !isPromising && !isLosing && currentLift < 0 && (
                        <div className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1 mt-2">
                          📊 Resultado negativo mas sem significância estatística. Continue coletando dados.
                        </div>
                      )}
                      {!isWinner && !isPromising && !isLosing && currentLift === 0 && (
                        <div className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1 mt-2">
                          📊 Sem diferença detectada. Continue coletando dados.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TimelineAB
