import { useState, useEffect } from 'react'
import { 
  Filter,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  EyeOff,
  PieChart,
  Globe,
  Target,
  FileText,
  Hash,
  Tag
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
  Cupom: string
  Cluster: string
  Sessoes: number
  Adicoes_ao_Carrinho: number
  Pedidos: number
  Receita: number
  Pedidos_Pagos: number
  Receita_Paga: number
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
  const [sortField, setSortField] = useState<string>('Data')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    cupom: '',
    cluster: '',
    origem: '',
    midia: ''
  })

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
      item.Cluster.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilters = 
      (!filters.cupom || item.Cupom.includes(filters.cupom)) &&
      (!filters.cluster || item.Cluster.includes(filters.cluster)) &&
      (!filters.origem || item.Origem.includes(filters.origem)) &&
      (!filters.midia || item.Midia.includes(filters.midia))

    return matchesSearch && matchesFilters
  })

  // Ordenar dados
  const sortedData = [...filteredData].sort((a, b) => {
    const aValue = a[sortField as keyof DetailedDataItem]
    const bValue = b[sortField as keyof DetailedDataItem]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  // Paginação
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage)

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th 
      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dados Detalhados</h2>
            <p className="text-sm text-gray-500">
              {formatNumber(sortedData.length)} registros encontrados
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
              placeholder="Buscar por data, origem, mídia, campanha, cupom ou cluster..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
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
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="Data">Data</SortableHeader>
              <SortableHeader field="Hora">Hora</SortableHeader>
              <SortableHeader field="Origem">Origem</SortableHeader>
              <SortableHeader field="Midia">Mídia</SortableHeader>
              <SortableHeader field="Campanha">Campanha</SortableHeader>
              <SortableHeader field="Cupom">Cupom</SortableHeader>
              <SortableHeader field="Cluster">Cluster</SortableHeader>
              <SortableHeader field="Sessoes">Sessões</SortableHeader>
              <SortableHeader field="Adicoes_ao_Carrinho">Adições</SortableHeader>
              <SortableHeader field="Pedidos">Pedidos</SortableHeader>
              <SortableHeader field="Receita">Receita</SortableHeader>
              <SortableHeader field="Pedidos_Pagos">Pedidos Pagos</SortableHeader>
              <SortableHeader field="Receita_Paga">Receita Paga</SortableHeader>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Data}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatTime(item.Hora)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Origem || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Midia || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Campanha || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Cupom}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Cluster || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(item.Sessoes)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(item.Adicoes_ao_Carrinho)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(item.Pedidos)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(item.Receita)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(item.Pedidos_Pagos)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(item.Receita_Paga)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, sortedData.length)} de {sortedData.length} resultados
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-3 py-2 text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetailedData 