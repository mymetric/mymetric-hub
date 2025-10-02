import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FreteDataItem } from '../types'
import { 
  Truck, 
  MapPin, 
  Calculator, 
  ShoppingCart, 
  DollarSign,
  Calendar,
  TrendingUp,
  Users,
  Activity,
  Download,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface FreteDashboardProps {
  selectedTable: string
  startDate: string
  endDate: string
}

const FreteDashboard: React.FC<FreteDashboardProps> = ({
  selectedTable,
  startDate,
  endDate
}) => {
  const [freteData, setFreteData] = useState<FreteDataItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('calculations')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [detailSortField, setDetailSortField] = useState<string>('event_date')
  const [detailSortDirection, setDetailSortDirection] = useState<'asc' | 'desc'>('desc')

  // Buscar dados de frete
  useEffect(() => {
    const fetchFreteData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const token = localStorage.getItem('auth-token')
        if (!token) {
          throw new Error('Token de acesso não encontrado')
        }

        const response = await api.getFreteData(token, {
          start_date: startDate,
          end_date: endDate,
          table_name: selectedTable
        })

        setFreteData(response.data)
      } catch (err) {
        console.error('❌ Erro ao buscar dados de frete:', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setIsLoading(false)
      }
    }

    if (selectedTable && startDate && endDate) {
      fetchFreteData()
    } else {
      setIsLoading(false)
    }
  }, [selectedTable, startDate, endDate])

  // Calcular métricas agregadas
  const calculateMetrics = () => {
    if (!freteData.length) return null

    const totalCalculations = freteData.reduce((sum, item) => sum + item.calculations, 0)
    const totalCalculationsFreightUnavailable = freteData.reduce((sum, item) => sum + item.calculations_freight_unavailable, 0)
    const totalTransactions = freteData.reduce((sum, item) => sum + item.transactions, 0)
    const totalRevenue = freteData.reduce((sum, item) => sum + (item.revenue || 0), 0)
    const uniqueZipcodes = new Set(freteData.map(item => item.zipcode)).size
    const uniqueRegions = new Set(freteData.map(item => item.zipcode_region)).size
    const conversionRate = totalCalculations > 0 ? (totalTransactions / totalCalculations) * 100 : 0
    
    // Taxa de sucesso do frete = (cálculos totais - cálculos indisponíveis) / cálculos totais * 100
    const freightSuccessRate = totalCalculations > 0 
      ? ((totalCalculations - totalCalculationsFreightUnavailable) / totalCalculations) * 100 
      : 0

    return {
      totalCalculations,
      totalCalculationsFreightUnavailable,
      totalTransactions,
      totalRevenue,
      uniqueZipcodes,
      uniqueRegions,
      conversionRate,
      freightSuccessRate
    }
  }

  const metrics = calculateMetrics()

  // Agrupar dados por região - otimizado para grandes volumes
  const dataByRegion = React.useMemo(() => {
    const result = freteData.reduce((acc, item) => {
      if (!acc[item.zipcode_region]) {
        acc[item.zipcode_region] = {
          region: item.zipcode_region,
          calculations: 0,
          calculations_freight_unavailable: 0,
          transactions: 0,
          revenue: 0,
          zipcodes: new Set()
        }
      }
      acc[item.zipcode_region].calculations += item.calculations
      acc[item.zipcode_region].calculations_freight_unavailable += item.calculations_freight_unavailable
      acc[item.zipcode_region].transactions += item.transactions
      acc[item.zipcode_region].revenue += item.revenue || 0
      acc[item.zipcode_region].zipcodes.add(item.zipcode)
      return acc
    }, {} as Record<string, any>)

    const regionData = Object.values(result).map((region: any) => ({
      ...region,
      zipcodeCount: region.zipcodes.size,
      conversionRate: region.calculations > 0 ? (region.transactions / region.calculations) * 100 : 0,
      freightSuccessRate: region.calculations > 0 
        ? ((region.calculations - region.calculations_freight_unavailable) / region.calculations) * 100 
        : 0
    }))

    // Calcular médias das taxas
    const avgConversionRate = regionData.length > 0 
      ? regionData.reduce((sum, region) => sum + region.conversionRate, 0) / regionData.length 
      : 0
    
    const avgFreightSuccessRate = regionData.length > 0 
      ? regionData.reduce((sum, region) => sum + region.freightSuccessRate, 0) / regionData.length 
      : 0

    // Ordenar por campo selecionado
    regionData.sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]
      
      if (sortField === 'region') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
    
    return { regionData, avgConversionRate, avgFreightSuccessRate }
  }, [freteData, sortField, sortDirection])

  const { regionData, avgConversionRate, avgFreightSuccessRate } = dataByRegion

  // Ordenar dados detalhados
  const sortedDetailData = React.useMemo(() => {
    const sorted = [...freteData].sort((a, b) => {
      let aValue = a[detailSortField as keyof FreteDataItem]
      let bValue = b[detailSortField as keyof FreteDataItem]
      
      if (detailSortField === 'event_date') {
        // Converter datas de forma segura para evitar problemas de timezone
        const [yearA, monthA, dayA] = (aValue as string).split('-').map(Number)
        const [yearB, monthB, dayB] = (bValue as string).split('-').map(Number)
        aValue = new Date(yearA, monthA - 1, dayA).getTime()
        bValue = new Date(yearB, monthB - 1, dayB).getTime()
      } else if (detailSortField === 'zipcode') {
        aValue = (aValue as string).toLowerCase()
        bValue = (bValue as string).toLowerCase()
      } else if (detailSortField === 'zipcode_region') {
        aValue = (aValue as string).toLowerCase()
        bValue = (bValue as string).toLowerCase()
      }
      
      if (detailSortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
    
    return sorted
  }, [freteData, detailSortField, detailSortDirection])

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

  // Funções de ordenação
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleDetailSort = (field: string) => {
    if (detailSortField === field) {
      setDetailSortDirection(detailSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setDetailSortField(field)
      setDetailSortDirection('desc')
    }
  }

  const getSortIcon = (field: string, currentField: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) return null
    return direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados de frete...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <Truck className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (!freteData.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Truck className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h3>
          <p className="text-gray-600">
            Não há dados de cálculo de frete para o período selecionado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Análise de Frete</h2>
              <p className="text-gray-600">
                Dados de cálculo de frete de {startDate} até {endDate}
              </p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>

        {/* Métricas Principais - Primeira Linha */}
        {metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-200 rounded-lg">
                    <Calculator className="w-6 h-6 text-blue-700" />
                  </div>
                  <span className="text-sm font-medium text-blue-700">Cálculos de Frete</span>
                </div>
                <p className="text-3xl font-bold text-blue-900">
                  {formatNumber(metrics.totalCalculations)}
                </p>
                <p className="text-xs text-blue-600 mt-1">Total de consultas realizadas</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-200 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-green-700" />
                  </div>
                  <span className="text-sm font-medium text-green-700">Transações</span>
                </div>
                <p className="text-3xl font-bold text-green-900">
                  {formatNumber(metrics.totalTransactions)}
                </p>
                <p className="text-xs text-green-600 mt-1">Pedidos convertidos</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-200 rounded-lg">
                    <DollarSign className="w-6 h-6 text-purple-700" />
                  </div>
                  <span className="text-sm font-medium text-purple-700">Receita Total</span>
                </div>
                <p className="text-3xl font-bold text-purple-900">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <p className="text-xs text-purple-600 mt-1">Valor gerado</p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-orange-200 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-orange-700" />
                  </div>
                  <span className="text-sm font-medium text-orange-700">Taxa de Conversão</span>
                </div>
                <p className="text-3xl font-bold text-orange-900">
                  {formatPercentage(metrics.conversionRate)}
                </p>
                <p className="text-xs text-orange-600 mt-1">Cálculos → Pedidos</p>
              </div>
            </div>

            {/* Segunda Linha */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-200 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-700" />
                  </div>
                  <span className="text-sm font-medium text-green-700">Taxa de Sucesso</span>
                </div>
                <p className="text-3xl font-bold text-green-900">
                  {formatPercentage(metrics.freightSuccessRate)}
                </p>
                <p className="text-xs text-green-600 mt-1">Frete disponível</p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-200 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-700" />
                  </div>
                  <span className="text-sm font-medium text-red-700">Frete Indisponível</span>
                </div>
                <p className="text-3xl font-bold text-red-900">
                  {formatNumber(metrics.totalCalculationsFreightUnavailable)}
                </p>
                <p className="text-xs text-red-600 mt-1">Cálculos sem opção de frete</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-200 rounded-lg">
                    <MapPin className="w-6 h-6 text-indigo-700" />
                  </div>
                  <span className="text-sm font-medium text-indigo-700">CEPs Únicos</span>
                </div>
                <p className="text-3xl font-bold text-indigo-900">
                  {formatNumber(metrics.uniqueZipcodes)}
                </p>
                <p className="text-xs text-indigo-600 mt-1">Códigos postais consultados</p>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-pink-200 rounded-lg">
                    <Users className="w-6 h-6 text-pink-700" />
                  </div>
                  <span className="text-sm font-medium text-pink-700">Regiões Atendidas</span>
                </div>
                <p className="text-3xl font-bold text-pink-900">
                  {formatNumber(metrics.uniqueRegions)}
                </p>
                <p className="text-xs text-pink-600 mt-1">Áreas geográficas diferentes</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dados por Região */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Performance por Região
          </h3>
          <p className="text-gray-600 mt-1">
            Análise detalhada dos cálculos de frete por região
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('region')}
                >
                  <div className="flex items-center gap-1">
                    Região
                    {getSortIcon('region', sortField, sortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('zipcodeCount')}
                >
                  <div className="flex items-center gap-1">
                    CEPs Únicos
                    {getSortIcon('zipcodeCount', sortField, sortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('calculations')}
                >
                  <div className="flex items-center gap-1">
                    Cálculos
                    {getSortIcon('calculations', sortField, sortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('calculations_freight_unavailable')}
                >
                  <div className="flex items-center gap-1">
                    Frete Indisponível
                    {getSortIcon('calculations_freight_unavailable', sortField, sortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('freightSuccessRate')}
                >
                  <div className="flex items-center gap-1">
                    Taxa de Sucesso
                    {getSortIcon('freightSuccessRate', sortField, sortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('transactions')}
                >
                  <div className="flex items-center gap-1">
                    Transações
                    {getSortIcon('transactions', sortField, sortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('conversionRate')}
                >
                  <div className="flex items-center gap-1">
                    Taxa de Conversão
                    {getSortIcon('conversionRate', sortField, sortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('revenue')}
                >
                  <div className="flex items-center gap-1">
                    Receita
                    {getSortIcon('revenue', sortField, sortDirection)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {regionData.map((region, index) => (
                <tr key={region.region} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {region.region}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(region.zipcodeCount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(region.calculations)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        region.calculations_freight_unavailable > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatNumber(region.calculations_freight_unavailable)}
                      </span>
                      {region.calculations_freight_unavailable > 0 && (
                        <AlertTriangle className="w-4 h-4 text-red-600 ml-1" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        region.freightSuccessRate >= avgFreightSuccessRate * 1.1 ? 'text-green-600' : 
                        region.freightSuccessRate >= avgFreightSuccessRate * 0.9 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(region.freightSuccessRate)}
                      </span>
                      {region.freightSuccessRate >= avgFreightSuccessRate * 1.1 && (
                        <CheckCircle className="w-4 h-4 text-green-600 ml-1" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(region.transactions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        region.conversionRate >= avgConversionRate * 1.2 ? 'text-green-600' : 
                        region.conversionRate >= avgConversionRate * 0.8 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(region.conversionRate)}
                      </span>
                      {region.conversionRate >= avgConversionRate * 1.2 && (
                        <TrendingUp className="w-4 h-4 text-green-600 ml-1" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(region.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dados Detalhados */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Dados Detalhados por CEP
          </h3>
          <p className="text-gray-600 mt-1">
            Visualização completa de todos os cálculos de frete
          </p>
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Mostrando os primeiros 100 registros</strong> de {formatNumber(freteData.length)} registros totais.
            Para ver todos os dados, considere filtrar por um período menor.
          </p>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDetailSort('event_date')}
                >
                  <div className="flex items-center gap-1">
                    Data
                    {getSortIcon('event_date', detailSortField, detailSortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDetailSort('zipcode')}
                >
                  <div className="flex items-center gap-1">
                    CEP
                    {getSortIcon('zipcode', detailSortField, detailSortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDetailSort('zipcode_region')}
                >
                  <div className="flex items-center gap-1">
                    Região
                    {getSortIcon('zipcode_region', detailSortField, detailSortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDetailSort('calculations')}
                >
                  <div className="flex items-center gap-1">
                    Cálculos
                    {getSortIcon('calculations', detailSortField, detailSortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDetailSort('calculations_freight_unavailable')}
                >
                  <div className="flex items-center gap-1">
                    Frete Indisponível
                    {getSortIcon('calculations_freight_unavailable', detailSortField, detailSortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDetailSort('transactions')}
                >
                  <div className="flex items-center gap-1">
                    Transações
                    {getSortIcon('transactions', detailSortField, detailSortDirection)}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleDetailSort('revenue')}
                >
                  <div className="flex items-center gap-1">
                    Receita
                    {getSortIcon('revenue', detailSortField, detailSortDirection)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDetailData.slice(0, 100).map((item, index) => (
                <tr key={`frete-${index}-${item.event_date}-${item.zipcode}-${item.zipcode_region}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      {(() => {
                        // Converter data de forma segura para evitar problemas de timezone
                        const [year, month, day] = item.event_date.split('-').map(Number)
                        const date = new Date(year, month - 1, day)
                        return date.toLocaleDateString('pt-BR')
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {item.zipcode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.zipcode_region}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(item.calculations)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        item.calculations_freight_unavailable > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatNumber(item.calculations_freight_unavailable)}
                      </span>
                      {item.calculations_freight_unavailable > 0 && (
                        <AlertTriangle className="w-4 h-4 text-red-600 ml-1" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(item.transactions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.revenue ? formatCurrency(item.revenue) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default FreteDashboard
