import React, { useState, useEffect } from 'react'
import { 
  Filter,
  Search,
  Download,
  EyeOff,
  PieChart,
  Globe,
  Target,
  FileText,
  Hash,
  Tag,
  Layers,
  ChevronUp,
  ChevronDown,
  Coins,
  CheckCircle,
  DollarSign,
  Sparkles,
  ShoppingBag,
  ArrowUpCircle,
  Users2,
  Database
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import TimelineChart from './TimelineChart'
import { useUrlParams } from '../hooks/useUrlParams'

interface DetailedDataItem {
  Data: string
  Hora: number
  Origem: string
  Midia: string
  Campanha: string
  Pagina_de_Entrada: string
  Conteudo: string
  Termo: string
  Cupom: string
  Cluster: string
  Sessoes: number
  Adicoes_ao_Carrinho: number
  Pedidos: number
  Receita: number
  Pedidos_Pagos: number
  Receita_Paga: number
  Cliques?: number
  Novos_Clientes?: number
  Receita_Novos_Clientes?: number
  Investimento?: number
}

interface GroupedData {
  [key: string]: DetailedDataItem[]
}

interface DetailedDataProps {
  startDate: string
  endDate: string
  selectedTable: string
  attributionModel?: string
  hideClientName?: boolean
}

const DetailedData = ({ startDate, endDate, selectedTable, attributionModel, hideClientName = false }: DetailedDataProps) => {
  const { getUrlParams, updateUrlParams } = useUrlParams()
  const [data, setData] = useState<DetailedDataItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  const [showTabChangeIndicator, setShowTabChangeIndicator] = useState(false)


  const [activeTab, setActiveTab] = useState('cluster')
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [sortField, setSortField] = useState('Receita_Paga')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedFilters, setSelectedFilters] = useState<Array<{type: string, value: string}>>([])
  const [filteredByGroup, setFilteredByGroup] = useState<DetailedDataItem[]>([])

  // Carregar filtros da URL na inicialização
  useEffect(() => {
    const urlParams = getUrlParams()
    if (urlParams.detailedFilter && urlParams.detailedFilterType) {
      setSelectedFilters([{type: urlParams.detailedFilterType, value: urlParams.detailedFilter}])
      setActiveTab(urlParams.detailedFilterType)
    }
    setIsInitialized(true)
  }, []) // Executar apenas na inicialização

  // Função para buscar dados detalhados com retry em caso de timeout
  const fetchDetailedDataWithRetry = async (token: string, params: any, isRetry = false) => {
    try {
      // Adicionar timeout para evitar travamentos
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: A requisição demorou muito tempo')), 30000) // 30 segundos
      })

      const dataPromise = api.getDetailedData(token, params)
      const response = await Promise.race([dataPromise, timeoutPromise]) as any
      return response
    } catch (error) {
      // Verificar se é um erro de timeout
      const isTimeout = error instanceof Error && (
        error.message.includes('timeout') || 
        error.message.includes('Timeout') ||
        error.message.includes('demorou muito tempo')
      )
      
      if (isTimeout && !isRetry) {
        console.log('⏰ Timeout detectado em dados detalhados, tentando novamente em 5 segundos...')
        
        // Aguardar 5 segundos
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        console.log('🔄 Tentando novamente dados detalhados...')
        return await fetchDetailedDataWithRetry(token, params, true)
      }
      
      throw error
    }
  }

  // Buscar dados detalhados
  useEffect(() => {
    const fetchDetailedData = async () => {
      if (!selectedTable || !isInitialized) return

      // Validar que selectedTable não é "all" - não deve consultar diretamente
      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoading(true)
      setLoadingMessage('Iniciando busca de dados...')
      setError(null)

      try {
        const token = localStorage.getItem('auth-token')
        if (!token) return

        console.log('🔄 Iniciando busca de dados detalhados...')
        
        // Atualizar mensagem de loading
        setLoadingMessage('Conectando com o servidor...')
        
        // Adicionar timeout para evitar travamentos
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout: A requisição demorou muito tempo')), 30000) // 30 segundos
        })

        setLoadingMessage('Buscando dados detalhados...')
        
        const response = await fetchDetailedDataWithRetry(token, {
          start_date: startDate,
          end_date: endDate,
          table_name: selectedTable,
          attribution_model: attributionModel
        })

        console.log('✅ Dados detalhados recebidos:', response.data?.length || 0, 'registros')
        
        setData(response.data || [])
      } catch (err) {
        console.error('Error fetching detailed data:', err)
        if (err instanceof Error && err.message.includes('Timeout')) {
          setError('A requisição demorou muito tempo. Tente novamente ou reduza o período de datas.')
        } else {
          setError('Erro ao carregar dados detalhados')
        }
      } finally {
        setIsLoading(false)
        setLoadingMessage('')
      }
    }

    fetchDetailedData()
  }, [startDate, endDate, selectedTable, attributionModel, isInitialized])

  // Aplicar filtros acumulativos quando os dados são carregados
  useEffect(() => {
    if (data.length > 0 && selectedFilters.length > 0) {
      // Usar dados originais em vez de filteredData para evitar loop infinito
      const dataToFilter = data.filter(item => {
        const matchesSearch = 
          item.Data.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Origem.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Midia.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Campanha.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Cupom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.Cluster.toLowerCase().includes(searchTerm.toLowerCase())

        return matchesSearch
      })
      
      // Aplicar todos os filtros acumulativos
      let filteredItems = dataToFilter
      
      selectedFilters.forEach(filter => {
        switch (filter.type) {
          case 'cluster':
            filteredItems = filteredItems.filter(item => (item.Cluster || 'Sem Cluster') === filter.value)
            break
          case 'origemMidia':
            const [origem, midia] = filter.value.split(' / ')
            filteredItems = filteredItems.filter(item => 
              (item.Origem || 'Sem Origem') === origem && (item.Midia || 'Sem Mídia') === midia
            )
            break
          case 'campanha':
            filteredItems = filteredItems.filter(item => (item.Campanha || 'Sem Campanha') === filter.value)
            break
          case 'paginaEntrada':
            filteredItems = filteredItems.filter(item => (item.Pagina_de_Entrada || 'Sem Página') === filter.value)
            break
          case 'conteudo':
            filteredItems = filteredItems.filter(item => (item.Conteudo || 'Sem Conteúdo') === filter.value)
            break
          case 'cupom':
            filteredItems = filteredItems.filter(item => (item.Cupom || 'Sem Cupom') === filter.value)
            break
        }
      })
      
      setFilteredByGroup(filteredItems)
    } else {
      setFilteredByGroup([])
    }
  }, [data, selectedFilters, searchTerm])

  // Filtrar dados
  const filteredData = data.filter(item => {
    const matchesSearch = 
      item.Data.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Origem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Midia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Campanha.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Cupom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Cluster.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })



  // Usar dados filtrados por grupo se houver filtros ativos
  // Quando há filtros, mostra apenas os dados filtrados em todas as abas
  const dataToGroup = selectedFilters.length > 0 ? filteredByGroup : filteredData

  // Usar dados filtrados por grupo para métricas e timeline também
  const dataForMetrics = selectedFilters.length > 0 ? filteredByGroup : filteredData

  // Agrupar dados por diferentes critérios - otimizado para performance
  const groupedData: { [key: string]: { [key: string]: DetailedDataItem[] } } = React.useMemo(() => {
    const groups = {
      cluster: {},
      origemMidia: {},
      campanha: {},
      paginaEntrada: {},
      conteudo: {},
      cupom: {}
    }

    dataToGroup.forEach(item => {
      // Agrupar por Cluster
      const clusterKey = item.Cluster || 'Sem Cluster'
      if (!groups.cluster[clusterKey]) {
        groups.cluster[clusterKey] = []
      }
      groups.cluster[clusterKey].push(item)

      // Agrupar por Origem/Mídia
      const origemMidiaKey = `${item.Origem || 'Sem Origem'} / ${item.Midia || 'Sem Mídia'}`
      if (!groups.origemMidia[origemMidiaKey]) {
        groups.origemMidia[origemMidiaKey] = []
      }
      groups.origemMidia[origemMidiaKey].push(item)

      // Agrupar por Campanha
      const campanhaKey = item.Campanha || 'Sem Campanha'
      if (!groups.campanha[campanhaKey]) {
        groups.campanha[campanhaKey] = []
      }
      groups.campanha[campanhaKey].push(item)

      // Agrupar por Página de Entrada
      const paginaKey = item.Pagina_de_Entrada || 'Sem Página'
      if (!groups.paginaEntrada[paginaKey]) {
        groups.paginaEntrada[paginaKey] = []
      }
      groups.paginaEntrada[paginaKey].push(item)

      // Agrupar por Conteúdo
      const conteudoKey = item.Conteudo || 'Sem Conteúdo'
      if (!groups.conteudo[conteudoKey]) {
        groups.conteudo[conteudoKey] = []
      }
      groups.conteudo[conteudoKey].push(item)

      // Agrupar por Cupom
      const cupomKey = item.Cupom || 'Sem Cupom'
      if (!groups.cupom[cupomKey]) {
        groups.cupom[cupomKey] = []
      }
      groups.cupom[cupomKey].push(item)
    })

    return groups
  }, [dataToGroup])

  // Funções para gerar opções ordenadas por receita para cada filtro - otimizadas com useMemo
  const getClusterOptions = React.useMemo(() => {
    const clusterTotals = dataToGroup.reduce((acc, item) => {
      const cluster = item.Cluster || 'Sem Cluster'
      if (!acc[cluster]) {
        acc[cluster] = { name: cluster, receita: 0 }
      }
      acc[cluster].receita += item.Receita
      return acc
    }, {} as { [key: string]: { name: string; receita: number } })

    return Object.values(clusterTotals)
      .sort((a, b) => b.receita - a.receita)
      .map(item => ({ value: item.name, label: `${item.name} (R$ ${item.receita.toLocaleString('pt-BR')})` }))
  }, [dataToGroup])

  const getOrigemOptions = React.useMemo(() => {
    const origemTotals = dataToGroup.reduce((acc, item) => {
      const origem = item.Origem || 'Sem Origem'
      if (!acc[origem]) {
        acc[origem] = { name: origem, receita: 0 }
      }
      acc[origem].receita += item.Receita
      return acc
    }, {} as { [key: string]: { name: string; receita: number } })

    return Object.values(origemTotals)
      .sort((a, b) => b.receita - a.receita)
      .map(item => ({ value: item.name, label: `${item.name} (R$ ${item.receita.toLocaleString('pt-BR')})` }))
  }, [dataToGroup])

  const getMidiaOptions = React.useMemo(() => {
    const midiaTotals = dataToGroup.reduce((acc, item) => {
      const midia = item.Midia || 'Sem Mídia'
      if (!acc[midia]) {
        acc[midia] = { name: midia, receita: 0 }
      }
      acc[midia].receita += item.Receita
      return acc
    }, {} as { [key: string]: { name: string; receita: number } })

    return Object.values(midiaTotals)
      .sort((a, b) => b.receita - a.receita)
      .map(item => ({ value: item.name, label: `${item.name} (R$ ${item.receita.toLocaleString('pt-BR')})` }))
  }, [dataToGroup])

  const getCampanhaOptions = React.useMemo(() => {
    const campanhaTotals = dataToGroup.reduce((acc, item) => {
      const campanha = item.Campanha || 'Sem Campanha'
      if (!acc[campanha]) {
        acc[campanha] = { name: campanha, receita: 0 }
      }
      acc[campanha].receita += item.Receita
      return acc
    }, {} as { [key: string]: { name: string; receita: number } })

    return Object.values(campanhaTotals)
      .sort((a, b) => b.receita - a.receita)
      .map(item => ({ value: item.name, label: `${item.name} (R$ ${item.receita.toLocaleString('pt-BR')})` }))
  }, [dataToGroup])

  const getPaginaEntradaOptions = React.useMemo(() => {
    const paginaTotals = dataToGroup.reduce((acc, item) => {
      const pagina = item.Pagina_de_Entrada || 'Sem Página'
      if (!acc[pagina]) {
        acc[pagina] = { name: pagina, receita: 0 }
      }
      acc[pagina].receita += item.Receita
      return acc
    }, {} as { [key: string]: { name: string; receita: number } })

    return Object.values(paginaTotals)
      .sort((a, b) => b.receita - a.receita)
      .map(item => ({ value: item.name, label: `${item.name} (R$ ${item.receita.toLocaleString('pt-BR')})` }))
  }, [dataToGroup])

  const getConteudoOptions = React.useMemo(() => {
    const conteudoTotals = dataToGroup.reduce((acc, item) => {
      const conteudo = item.Conteudo || 'Sem Conteúdo'
      if (!acc[conteudo]) {
        acc[conteudo] = { name: conteudo, receita: 0 }
      }
      acc[conteudo].receita += item.Receita
      return acc
    }, {} as { [key: string]: { name: string; receita: number } })

    return Object.values(conteudoTotals)
      .sort((a, b) => b.receita - a.receita)
      .map(item => ({ value: item.name, label: `${item.name} (R$ ${item.receita.toLocaleString('pt-BR')})` }))
  }, [dataToGroup])

  const getCupomOptions = React.useMemo(() => {
    const cupomTotals = dataToGroup.reduce((acc, item) => {
      const cupom = item.Cupom || 'Sem Cupom'
      if (!acc[cupom]) {
        acc[cupom] = { name: cupom, receita: 0 }
      }
      acc[cupom].receita += item.Receita
      return acc
    }, {} as { [key: string]: { name: string; receita: number } })

    return Object.values(cupomTotals)
      .sort((a, b) => b.receita - a.receita)
      .map(item => ({ value: item.name, label: `${item.name} (R$ ${item.receita.toLocaleString('pt-BR')})` }))
  }, [dataToGroup])





    // Calcular totais para cada grupo
  const calculateGroupTotals = (items: DetailedDataItem[]) => {

    
    const totals = items.reduce((acc, item) => ({
      Sessoes: acc.Sessoes + (Number(item.Sessoes) || 0),
      Adicoes_ao_Carrinho: acc.Adicoes_ao_Carrinho + (Number(item.Adicoes_ao_Carrinho) || 0),
      Pedidos: acc.Pedidos + (Number(item.Pedidos) || 0),
      Receita: acc.Receita + (Number(item.Receita) || 0),
      Pedidos_Pagos: acc.Pedidos_Pagos + (Number(item.Pedidos_Pagos) || 0),
      Receita_Paga: acc.Receita_Paga + (Number(item.Receita_Paga) || 0)
    }), {
      Sessoes: 0,
      Adicoes_ao_Carrinho: 0,
      Pedidos: 0,
      Receita: 0,
      Pedidos_Pagos: 0,
      Receita_Paga: 0
    })
    
    return totals
  }

  // Preparar dados para a timeline - otimizado com useMemo
  const timelineData = React.useMemo(() => {
    return dataForMetrics
      .reduce((acc, item) => {
        const existingDate = acc.find(d => d.date === item.Data)
        if (existingDate) {
          existingDate.sessions += item.Sessoes
          existingDate.revenue += item.Receita
          existingDate.clicks += item.Cliques || 0
          existingDate.addToCart += item.Adicoes_ao_Carrinho
          existingDate.orders += item.Pedidos
          existingDate.newCustomers += item.Novos_Clientes || 0
          existingDate.paidOrders += item.Pedidos_Pagos
          existingDate.paidRevenue += item.Receita_Paga
          existingDate.newCustomerRevenue += item.Receita_Novos_Clientes || 0
          existingDate.investment += item.Investimento || 0
        } else {
          acc.push({
            date: item.Data,
            sessions: item.Sessoes,
            revenue: item.Receita,
            clicks: item.Cliques || 0,
            addToCart: item.Adicoes_ao_Carrinho,
            orders: item.Pedidos,
            newCustomers: item.Novos_Clientes || 0,
            paidOrders: item.Pedidos_Pagos,
            paidRevenue: item.Receita_Paga,
            newCustomerRevenue: item.Receita_Novos_Clientes || 0,
            investment: item.Investimento || 0
          })
        }
        return acc
      }, [] as { 
        date: string; 
        sessions: number; 
        revenue: number;
        clicks: number;
        addToCart: number;
        orders: number;
        newCustomers: number;
        paidOrders: number;
        paidRevenue: number;
        newCustomerRevenue: number;
        investment: number;
      }[])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [dataForMetrics])

  // Calcular totais para as métricas - otimizado com useMemo
  const totals = React.useMemo(() => {
    return dataForMetrics.reduce((acc, item) => ({
      sessoes: acc.sessoes + item.Sessoes,
      pedidos: acc.pedidos + item.Pedidos,
      receita: acc.receita + item.Receita,
      novosClientes: acc.novosClientes + (item.Novos_Clientes || 0),
      adicoesCarrinho: acc.adicoesCarrinho + item.Adicoes_ao_Carrinho,
      receitaPaga: acc.receitaPaga + item.Receita_Paga,
      pedidosPagos: acc.pedidosPagos + item.Pedidos_Pagos,
      receitaNovosClientes: acc.receitaNovosClientes + (item.Receita_Novos_Clientes || 0),
      investimento: acc.investimento + (item.Investimento || 0),
      cliques: acc.cliques + (item.Cliques || 0)
    }), {
      sessoes: 0,
      pedidos: 0,
      receita: 0,
      novosClientes: 0,
      adicoesCarrinho: 0,
      receitaPaga: 0,
      pedidosPagos: 0,
      receitaNovosClientes: 0,
      investimento: 0,
      cliques: 0
    })
  }, [dataForMetrics])

  // Calcular métricas derivadas - otimizado com useMemo
  const derivedMetrics = React.useMemo(() => {
    const avgOrderValue = totals.pedidos > 0 ? totals.receita / totals.pedidos : 0
    const conversionRate = totals.sessoes > 0 ? (totals.pedidos / totals.sessoes) * 100 : 0
    const addToCartRate = totals.sessoes > 0 ? (totals.adicoesCarrinho / totals.sessoes) * 100 : 0
    const revenuePerSession = totals.sessoes > 0 ? totals.receita / totals.sessoes : 0
    const newCustomerRate = totals.pedidos > 0 ? (totals.novosClientes / totals.pedidos) * 100 : 0
    
    return {
      avgOrderValue,
      conversionRate,
      addToCartRate,
      revenuePerSession,
      newCustomerRate
    }
  }, [totals])


  // Funções auxiliares
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    format = 'number',
    color = 'blue' 
  }: {
    title: string
    value: number
    icon: any
    format?: 'number' | 'currency' | 'percentage'
    color?: string
  }) => {
    const formatValue = () => {
      switch (format) {
        case 'currency':
          return formatCurrency(value)
        case 'percentage':
          return `${value.toFixed(2)}%`
        default:
          return formatNumber(value)
      }
    }

    const colorClasses = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
      red: 'bg-red-100 text-red-600'
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
        <p className="text-xl font-bold text-gray-900">{formatValue()}</p>
      </div>
    )
  }

  const renderGroupedTable = (groupKey: string, groupData: GroupedData) => {
    const groupEntries = Object.entries(groupData).sort((a, b) => {
      const aTotals = calculateGroupTotals(a[1])
      const bTotals = calculateGroupTotals(b[1])
      
      const aValue = aTotals[sortField as keyof typeof aTotals]
      const bValue = bTotals[sortField as keyof typeof bTotals]
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })

    const displayedEntries = showAllGroups ? groupEntries : groupEntries.slice(0, 10)
    const hasMoreEntries = groupEntries.length > 10

    return (
      <div className="space-y-4">
        {/* Tabela de totais */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48 max-w-48">
                    {tabs.find(tab => tab.id === groupKey)?.label.replace('Por ', '')}
                    <span className="ml-1 text-xs text-gray-400">(clique para filtrar)</span>
                  </th>
                  <SortableHeader field="Sessoes">
                    Sessões
                  </SortableHeader>
                  <SortableHeader field="Adicoes_ao_Carrinho">
                    Adições ao Carrinho
                  </SortableHeader>
                  <SortableHeader field="Pedidos">
                    Pedidos
                  </SortableHeader>
                  <SortableHeader field="Receita">
                    Receita
                  </SortableHeader>
                  <SortableHeader field="Pedidos_Pagos">
                    Pedidos Pagos
                  </SortableHeader>
                  <SortableHeader field="Receita_Paga">
                    Receita Paga
                  </SortableHeader>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                                 {displayedEntries.map(([groupName, items]) => {
                   const totals = calculateGroupTotals(items)
                   return (
                     <tr 
                       key={groupName} 
                       className="hover:bg-gray-50 cursor-pointer transition-colors group"
                       onClick={() => handleRowClick(groupName, items)}
                       title="Clique para filtrar e ir para a próxima aba"
                     >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-48 truncate group-hover:text-blue-600" title={groupName}>
                        <div className="flex items-center gap-2">
                          <span>{groupName}</span>
                          <ArrowUpCircle className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(totals.Sessoes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(totals.Adicoes_ao_Carrinho)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(totals.Pedidos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(totals.Receita)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(totals.Pedidos_Pagos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(totals.Receita_Paga)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Botão Ver Mais */}
        {hasMoreEntries && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAllGroups(!showAllGroups)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              {showAllGroups ? (
                <>
                  Ver menos ({groupEntries.length} grupos)
                </>
              ) : (
                <>
                  Ver mais ({groupEntries.length - 10} grupos restantes)
                </>
              )}
            </button>
          </div>
        )}
      </div>
  )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-gray-700">{loadingMessage || 'Carregando dados detalhados...'}</span>
        </div>
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Isso pode levar alguns segundos dependendo da quantidade de dados</p>
          <p className="mt-2 text-xs">Se demorar muito, tente reduzir o período de datas</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <EyeOff className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // Verificar se há dados para renderizar
  if (data.length === 0 && !isLoading && isInitialized) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
          <p className="text-gray-600">
            Não foram encontrados dados detalhados para o período selecionado.
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>Tente selecionar um período menor ou verificar se há dados disponíveis.</p>
          </div>
        </div>
      </div>
    )
  }

  // Não renderizar nada se ainda não foi inicializado
  if (!isInitialized) {
    return null
  }

  const tabs = [
    { id: 'cluster', label: 'Por Cluster', icon: <Layers className="w-4 h-4" /> },
    { id: 'origemMidia', label: 'Por Origem/Mídia', icon: <Globe className="w-4 h-4" /> },
    { id: 'campanha', label: 'Por Campanha', icon: <Target className="w-4 h-4" /> },
    { id: 'paginaEntrada', label: 'Por Página de Entrada', icon: <FileText className="w-4 h-4" /> },
    { id: 'conteudo', label: 'Por Conteúdo', icon: <PieChart className="w-4 h-4" /> },
    { id: 'cupom', label: 'Por Cupom', icon: <Tag className="w-4 h-4" /> }
  ]

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setShowAllGroups(false) // Reset para mostrar apenas 10 linhas quando mudar de aba
    setSortField('Receita_Paga') // Reset para ordenação padrão
    setSortDirection('desc') // Reset para decrescente
    // Manter o filtro ativo quando mudar de aba
            // setSelectedFilters([])
    // setFilteredByGroup([])
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleRowClick = (groupName: string, items: DetailedDataItem[]) => {
    // Verificar se o filtro já existe
    const existingFilterIndex = selectedFilters.findIndex(filter => 
      filter.type === activeTab && filter.value === groupName
    )
    
    let newFilters: Array<{type: string, value: string}>
    
    if (existingFilterIndex >= 0) {
      // Se o filtro já existe, removê-lo (toggle)
      newFilters = selectedFilters.filter((_, index) => index !== existingFilterIndex)
    } else {
      // Adicionar novo filtro
      newFilters = [...selectedFilters, {type: activeTab, value: groupName}]
    }
    
    // Atualizar filtros
    setSelectedFilters(newFilters)
    
    // Persistir filtros na URL (usar o último filtro para compatibilidade)
    if (newFilters.length > 0) {
      const lastFilter = newFilters[newFilters.length - 1]
      updateUrlParams({
        detailedFilter: lastFilter.value,
        detailedFilterType: lastFilter.type
      })
    } else {
      updateUrlParams({
        detailedFilter: undefined,
        detailedFilterType: undefined
      })
    }
    
    // Pular para a próxima aba à direita
    const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab)
    const nextTabIndex = (currentTabIndex + 1) % tabs.length
    const nextTab = tabs[nextTabIndex]
    
    // Mudar para a próxima aba
    setActiveTab(nextTab.id)
    
    // Mostrar indicador de mudança de aba
    setShowTabChangeIndicator(true)
    setTimeout(() => setShowTabChangeIndicator(false), 2000) // Esconder após 2 segundos
    
    // Resetar estados de visualização
    setShowAllGroups(false)
    setSortField('Receita_Paga')
    setSortDirection('desc')
  }

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Visão Detalhada</h2>
            {selectedFilters.length > 0 && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {selectedFilters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md">
                    <Filter className="w-3 h-3 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">
                      {tabs.find(tab => tab.id === filter.type)?.label.replace('Por ', '')}: {filter.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
          <div className="flex items-center gap-3">
            {selectedFilters.length > 0 && (
              <button
                onClick={() => {
                  setSelectedFilters([])
                  setFilteredByGroup([])
                  // Limpar filtros da URL
                  updateUrlParams({
                    detailedFilter: undefined,
                    detailedFilterType: undefined
                  })
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                title="Remover todos os filtros"
              >
                <Filter className="w-4 h-4" />
                Limpar Filtros ({selectedFilters.length})
              </button>
            )}
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por data, origem, mídia, campanha, cupom, cluster ou termo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>


      </div>

      {/* Metrics Grid */}
      <div className="px-6 py-4">
        {/* First Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <MetricCard
            title="Sessões"
            value={totals.sessoes}
            icon={Globe}
            color="blue"
          />
          <MetricCard
            title="Pedidos Pagos"
            value={totals.pedidosPagos}
            icon={CheckCircle}
            color="green"
          />
          <MetricCard
            title="Receita Paga"
            value={totals.receitaPaga}
            icon={Coins}
            format="currency"
            color="purple"
          />
          <MetricCard
            title="Ticket Médio"
            value={derivedMetrics.avgOrderValue}
            icon={DollarSign}
            format="currency"
            color="orange"
          />
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Taxa de Conversão"
            value={derivedMetrics.conversionRate}
            icon={Sparkles}
            format="percentage"
            color="red"
          />
          <MetricCard
            title="Taxa de Adição ao Carrinho"
            value={derivedMetrics.addToCartRate}
            icon={ShoppingBag}
            format="percentage"
            color="blue"
          />
          <MetricCard
            title="Receita por Sessão"
            value={derivedMetrics.revenuePerSession}
            icon={ArrowUpCircle}
            format="currency"
            color="green"
          />
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="px-6 py-4">
        <TimelineChart 
          data={timelineData}
          title="Evolução das Métricas"
        />
            </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
              <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm relative transition-all duration-200 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {/* Indicador de filtro ativo */}
              {selectedFilters.some(filter => filter.type === tab.id) && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              )}
              </button>
          ))}
        </nav>
            </div>

      {/* Content */}
      <div className="p-6">
        {/* Mensagem informativa quando há filtro ativo */}
        {selectedFilters.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                <strong>Filtros ativos:</strong> {selectedFilters.length} filtro(s) aplicado(s) globalmente
              </span>
            </div>
          </div>
        )}

        {/* Indicador de mudança automática de aba */}
        {showTabChangeIndicator && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full animate-bounce"></div>
              <span className="text-sm text-green-700 font-medium">
                Mudou automaticamente para a próxima aba! 🚀
              </span>
            </div>
          </div>
        )}
        
        {Object.keys(groupedData[activeTab] || {}).length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
            <p className="text-gray-600">
              Não há dados para exibir na aba "{tabs.find(tab => tab.id === activeTab)?.label}" com o filtro atual.
            </p>
            {selectedFilters.length > 0 && (
              <button
                onClick={() => {
                  setSelectedFilters([])
                  setFilteredByGroup([])
                  updateUrlParams({
                    detailedFilter: undefined,
                    detailedFilterType: undefined
                  })
                }}
                className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          renderGroupedTable(activeTab, groupedData[activeTab])
        )}
        </div>
    </div>
  )
}

export default DetailedData 