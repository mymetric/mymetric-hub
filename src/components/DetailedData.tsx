import { useState, useEffect } from 'react'
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
  Users2
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import TimelineChart from './TimelineChart'

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
  const [data, setData] = useState<DetailedDataItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    cluster: '',
    origem: '',
    midia: '',
    campanha: '',
    paginaEntrada: '',
    conteudo: '',
    cupom: ''
  })
  const [activeTab, setActiveTab] = useState('cluster')
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [sortField, setSortField] = useState('Receita_Paga')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [filteredByGroup, setFilteredByGroup] = useState<DetailedDataItem[]>([])

  // Buscar dados detalhados
  useEffect(() => {
    const fetchDetailedData = async () => {
      if (!selectedTable) return

      // Validar que selectedTable não é "all" - não deve consultar diretamente
      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const token = localStorage.getItem('auth-token')
        if (!token) return

        const response = await api.getDetailedData(token, {
          start_date: startDate,
          end_date: endDate,
          table_name: selectedTable,
          attribution_model: attributionModel
        })

        setData(response.data || [])
      } catch (err) {
        console.error('Error fetching detailed data:', err)
        setError('Erro ao carregar dados detalhados')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetailedData()
  }, [startDate, endDate, selectedTable, attributionModel])

  // Filtrar dados
  const filteredData = data.filter(item => {
    const matchesSearch = 
      item.Data.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Origem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Midia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Campanha.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Cupom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.Cluster.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilters = 
      (!filters.cluster || item.Cluster.includes(filters.cluster)) &&
      (!filters.origem || item.Origem.includes(filters.origem)) &&
      (!filters.midia || item.Midia.includes(filters.midia)) &&
      (!filters.campanha || item.Campanha.includes(filters.campanha)) &&
      (!filters.paginaEntrada || item.Pagina_de_Entrada.includes(filters.paginaEntrada)) &&
      (!filters.conteudo || item.Conteudo.includes(filters.conteudo)) &&
      (!filters.cupom || item.Cupom.includes(filters.cupom))

    return matchesSearch && matchesFilters
  })



  // Agrupar dados por diferentes critérios
  const groupedData: { [key: string]: GroupedData } = {
    cluster: {},
    origemMidia: {},
    campanha: {},
    paginaEntrada: {},
    conteudo: {},
    cupom: {}
  }

  // Usar dados filtrados por grupo se houver um grupo selecionado
  const dataToGroup = selectedGroup ? filteredByGroup : filteredData

  // Usar dados filtrados por grupo para métricas e timeline também
  const dataForMetrics = selectedGroup ? filteredByGroup : filteredData

  // Funções para gerar opções ordenadas por receita para cada filtro
  const getClusterOptions = () => {
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
  }

  const getOrigemOptions = () => {
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
  }

  const getMidiaOptions = () => {
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
  }

  const getCampanhaOptions = () => {
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
  }

  const getPaginaEntradaOptions = () => {
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
  }

  const getConteudoOptions = () => {
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
  }



  const getCupomOptions = () => {
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
  }

  dataToGroup.forEach(item => {
    // Agrupar por Cluster
    const clusterKey = item.Cluster || 'Sem Cluster'
    if (!groupedData.cluster[clusterKey]) {
      groupedData.cluster[clusterKey] = []
    }
    groupedData.cluster[clusterKey].push(item)

    // Agrupar por Origem/Mídia
    const origemMidiaKey = `${item.Origem || 'Sem Origem'} / ${item.Midia || 'Sem Mídia'}`
    if (!groupedData.origemMidia[origemMidiaKey]) {
      groupedData.origemMidia[origemMidiaKey] = []
    }
    groupedData.origemMidia[origemMidiaKey].push(item)

    // Agrupar por Campanha
    const campanhaKey = item.Campanha || 'Sem Campanha'
    if (!groupedData.campanha[campanhaKey]) {
      groupedData.campanha[campanhaKey] = []
    }
    groupedData.campanha[campanhaKey].push(item)

    // Agrupar por Página de Entrada
    const paginaKey = item.Pagina_de_Entrada || 'Sem Página'
    if (!groupedData.paginaEntrada[paginaKey]) {
      groupedData.paginaEntrada[paginaKey] = []
    }
    groupedData.paginaEntrada[paginaKey].push(item)

    // Agrupar por Conteúdo
    const conteudoKey = item.Conteudo || 'Sem Conteúdo'
    if (!groupedData.conteudo[conteudoKey]) {
      groupedData.conteudo[conteudoKey] = []
    }
    groupedData.conteudo[conteudoKey].push(item)



    // Agrupar por Cupom
    const cupomKey = item.Cupom || 'Sem Cupom'
    if (!groupedData.cupom[cupomKey]) {
      groupedData.cupom[cupomKey] = []
    }
    groupedData.cupom[cupomKey].push(item)
  })



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

  // Preparar dados para a timeline
  const timelineData = dataForMetrics
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

  // Calcular totais para as métricas
  const totals = dataForMetrics.reduce((acc, item) => ({
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

  // Calcular métricas derivadas
  const avgOrderValue = totals.pedidos > 0 ? totals.receita / totals.pedidos : 0
  const conversionRate = totals.sessoes > 0 ? (totals.pedidos / totals.sessoes) * 100 : 0
  const addToCartRate = totals.sessoes > 0 ? (totals.adicoesCarrinho / totals.sessoes) * 100 : 0
  const revenuePerSession = totals.sessoes > 0 ? totals.receita / totals.sessoes : 0
  const newCustomerRate = totals.pedidos > 0 ? (totals.novosClientes / totals.pedidos) * 100 : 0


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
                       title="Clique para filtrar dados por este grupo"
                     >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-48 truncate group-hover:text-blue-600" title={groupName}>
                        {groupName}
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
          <span className="text-gray-700">Carregando dados detalhados...</span>
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
    // Reset do filtro quando mudar de aba manualmente
    setSelectedGroup('')
    setFilteredByGroup([])
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
    // Filtrar dados originais baseado no critério da aba atual
    let filteredItems: DetailedDataItem[] = []
    
    switch (activeTab) {
      case 'cluster':
        filteredItems = filteredData.filter(item => (item.Cluster || 'Sem Cluster') === groupName)
        break
      case 'origemMidia':
        const [origem, midia] = groupName.split(' / ')
        filteredItems = filteredData.filter(item => 
          (item.Origem || 'Sem Origem') === origem && (item.Midia || 'Sem Mídia') === midia
        )
        break
      case 'campanha':
        filteredItems = filteredData.filter(item => (item.Campanha || 'Sem Campanha') === groupName)
        break
      case 'paginaEntrada':
        filteredItems = filteredData.filter(item => (item.Pagina_de_Entrada || 'Sem Página') === groupName)
        break
      case 'conteudo':
        filteredItems = filteredData.filter(item => (item.Conteudo || 'Sem Conteúdo') === groupName)
        break

      case 'cupom':
        filteredItems = filteredData.filter(item => (item.Cupom || 'Sem Cupom') === groupName)
        break
      default:
        filteredItems = items
    }
    
    // Aplicar filtro na aba atual
    setFilteredByGroup(filteredItems)
    setSelectedGroup(groupName)
    
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
            {selectedGroup && (
              <p className="text-sm text-blue-600">
                • Filtrado por: {selectedGroup}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            {selectedGroup && (
              <button
                onClick={() => {
                  setSelectedGroup('')
                  setFilteredByGroup([])
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
              >
                Limpar Filtro
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

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* Primeira linha - Cluster, Origem, Mídia, Campanha */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cluster</label>
                <select
                value={filters.cluster}
                onChange={(e) => setFilters({ ...filters, cluster: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Todos os clusters</option>
                  {getClusterOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Origem</label>
                <select
                value={filters.origem}
                onChange={(e) => setFilters({ ...filters, origem: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Todas as origens</option>
                  {getOrigemOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mídia</label>
                <select
                value={filters.midia}
                onChange={(e) => setFilters({ ...filters, midia: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Todas as mídias</option>
                  {getMidiaOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Campanha</label>
                <select
                  value={filters.campanha}
                  onChange={(e) => setFilters({ ...filters, campanha: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Todas as campanhas</option>
                  {getCampanhaOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Segunda linha - Página de Entrada, Conteúdo, Termo, Cupom */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Página de Entrada</label>
                <select
                  value={filters.paginaEntrada}
                  onChange={(e) => setFilters({ ...filters, paginaEntrada: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Todas as páginas</option>
                  {getPaginaEntradaOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Conteúdo</label>
                <select
                  value={filters.conteudo}
                  onChange={(e) => setFilters({ ...filters, conteudo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Todos os conteúdos</option>
                  {getConteudoOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cupom</label>
                <select
                  value={filters.cupom}
                  onChange={(e) => setFilters({ ...filters, cupom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Todos os cupons</option>
                  {getCupomOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
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
            value={avgOrderValue}
            icon={DollarSign}
            format="currency"
            color="orange"
          />
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Taxa de Conversão"
            value={conversionRate}
            icon={Sparkles}
            format="percentage"
            color="red"
          />
          <MetricCard
            title="Taxa de Adição ao Carrinho"
            value={addToCartRate}
            icon={ShoppingBag}
            format="percentage"
            color="blue"
          />
          <MetricCard
            title="Receita por Sessão"
            value={revenuePerSession}
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
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              </button>
          ))}
        </nav>
            </div>

      {/* Content */}
      <div className="p-6">
        {renderGroupedTable(activeTab, groupedData[activeTab])}
        </div>
    </div>
  )
}

export default DetailedData 