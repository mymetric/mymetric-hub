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
  Layers
} from 'lucide-react'
import { api } from '../services/api'

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
}

interface GroupedData {
  [key: string]: DetailedDataItem[]
}

interface DetailedDataProps {
  startDate: string
  endDate: string
  selectedTable: string
  attributionModel: string
}

const DetailedData = ({ startDate, endDate, selectedTable, attributionModel }: DetailedDataProps) => {
  const [data, setData] = useState<DetailedDataItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    cupom: '',
    cluster: '',
    origem: '',
    midia: '',
    termo: ''
  })
  const [activeTab, setActiveTab] = useState('cluster')
  const [showAllGroups, setShowAllGroups] = useState(false)

  // Buscar dados detalhados
  useEffect(() => {
    const fetchDetailedData = async () => {
      if (!selectedTable) return

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
      item.Cluster.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.Termo && item.Termo.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesFilters = 
      (!filters.cupom || item.Cupom.includes(filters.cupom)) &&
      (!filters.cluster || item.Cluster.includes(filters.cluster)) &&
      (!filters.origem || item.Origem.includes(filters.origem)) &&
      (!filters.midia || item.Midia.includes(filters.midia)) &&
      (!filters.termo || (item.Termo && item.Termo.includes(filters.termo)))

    return matchesSearch && matchesFilters
  })



  // Agrupar dados por diferentes critérios
  const groupedData: { [key: string]: GroupedData } = {
    cluster: {},
    origemMidia: {},
    campanha: {},
    paginaEntrada: {},
    conteudo: {},
    termo: {},
    cupom: {}
  }

  filteredData.forEach(item => {
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

    // Agrupar por Termo
    const termoKey = item.Termo || 'Sem Termo'
    if (!groupedData.termo[termoKey]) {
      groupedData.termo[termoKey] = []
    }
    groupedData.termo[termoKey].push(item)

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



  const renderGroupedTable = (groupKey: string, groupData: GroupedData) => {
    const groupEntries = Object.entries(groupData).sort((a, b) => {
      const aTotal = calculateGroupTotals(a[1]).Receita
      const bTotal = calculateGroupTotals(b[1]).Receita
      return bTotal - aTotal
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
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessões
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adições ao Carrinho
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedidos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedidos Pagos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita Paga
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedEntries.map(([groupName, items]) => {
                  const totals = calculateGroupTotals(items)
                  return (
                    <tr key={groupName} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-48 truncate" title={groupName}>
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
    { id: 'termo', label: 'Por Termo', icon: <Hash className="w-4 h-4" /> },
    { id: 'cupom', label: 'Por Cupom', icon: <Tag className="w-4 h-4" /> }
  ]

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setShowAllGroups(false) // Reset para mostrar apenas 10 linhas quando mudar de aba
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dados Detalhados</h2>
            <p className="text-sm text-gray-500">
              {formatNumber(filteredData.length)} registros encontrados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
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
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cupom</label>
              <input
                type="text"
                placeholder="Filtrar por cupom"
                value={filters.cupom}
                onChange={(e) => setFilters({ ...filters, cupom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cluster</label>
              <input
                type="text"
                placeholder="Filtrar por cluster"
                value={filters.cluster}
                onChange={(e) => setFilters({ ...filters, cluster: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Origem</label>
              <input
                type="text"
                placeholder="Filtrar por origem"
                value={filters.origem}
                onChange={(e) => setFilters({ ...filters, origem: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mídia</label>
              <input
                type="text"
                placeholder="Filtrar por mídia"
                value={filters.midia}
                onChange={(e) => setFilters({ ...filters, midia: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Termo</label>
              <input
                type="text"
                placeholder="Filtrar por termo"
                value={filters.termo}
                onChange={(e) => setFilters({ ...filters, termo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
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