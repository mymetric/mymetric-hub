import { useEffect, useState, useRef, useCallback, Fragment, useMemo } from 'react'
import { User, ChevronRight, ChevronDown, Maximize2, Minimize2, DollarSign, TrendingUp, Mail, Phone, Calendar, Clock, ShoppingBag } from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { LeadsOrderItem, LeadsOrdersRequest } from '../types'

interface GroupedLeadItem extends LeadsOrderItem {
	orders_count: number
	total_value: number
	orders: LeadsOrderItem[]
}
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatDateToString } from '../utils/dateUtils'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

interface LeadsTabProps {
	selectedTable: string
	startDate: string
	endDate: string
}

const LeadsTab = ({ selectedTable, startDate, endDate }: LeadsTabProps) => {
	// Verificação de props
	if (!selectedTable || !startDate || !endDate) {
		return (
			<div className="p-4 sm:p-6 lg:p-8">
				<div className="bg-red-50 border border-red-200 rounded-lg p-4">
					<h3 className="text-red-800 font-medium">Erro de Configuração</h3>
					<p className="text-red-600 text-sm mt-1">
						Props inválidas: selectedTable={selectedTable}, startDate={startDate}, endDate={endDate}
					</p>
				</div>
			</div>
		)
	}
	const [leads, setLeads] = useState<LeadsOrderItem[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [searchTerm, setSearchTerm] = useState<string>('')
	const [totalRows, setTotalRows] = useState(0)
	const [retryCount, setRetryCount] = useState(0)
	const [useCache, setUseCache] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [cacheInfo, setCacheInfo] = useState<any>(null)
	const [allLeads, setAllLeads] = useState<LeadsOrderItem[]>([])
	const [hasMoreData, setHasMoreData] = useState(true)
	const [lastOffset, setLastOffset] = useState(0)
	const [loadAllData, setLoadAllData] = useState(false)
	const abortControllerRef = useRef<AbortController | null>(null)


	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
	}

	const formatDateTime = (value?: string) => {
		if (!value) return '—'
		const d = new Date(value)
		if (isNaN(d.getTime())) return value
		return d.toLocaleString('pt-BR', { hour12: false })
	}

	const display = (val?: string) => {
		const s = (val ?? '').toString().trim()
		if (!s || s === '(not set)') return 'Não informado'
		return s
	}

	const formatDuration = (days: number, minutes: number) => {
		if (days > 0) {
			return `${days} dia${days > 1 ? 's' : ''}`
		}
		if (minutes > 0) {
			const hours = Math.floor(minutes / 60)
			const mins = minutes % 60
			if (hours > 0) {
				return `${hours}h ${mins}m`
			}
			return `${minutes}m`
		}
		return '—'
	}

	// Função para agrupar leads por email
	const groupLeadsByEmail = (leads: LeadsOrderItem[]): GroupedLeadItem[] => {
		const emailGroups = new Map<string, LeadsOrderItem[]>()
		
		// Agrupar por email
		leads.forEach(lead => {
			if (!lead || !lead.email) return
			
			const email = lead.email.toLowerCase().trim()
			if (!emailGroups.has(email)) {
				emailGroups.set(email, [])
			}
			emailGroups.get(email)!.push(lead)
		})
		
		// Consolidar dados por email
		const groupedLeads: GroupedLeadItem[] = []
		
		emailGroups.forEach((orders, email) => {
			if (orders.length === 0) return
			
			// Usar o primeiro pedido como base
			const baseLead = orders[0]
			
			// Calcular totais
			const totalValue = orders.reduce((sum, order) => sum + (order.value || 0), 0)
			
			// Criar lead agrupado
			const groupedLead: GroupedLeadItem = {
				...baseLead,
				orders_count: orders.length,
				total_value: totalValue,
				orders: orders.sort((a, b) => {
					const dateA = new Date(a.purchase_timestamp || 0).getTime()
					const dateB = new Date(b.purchase_timestamp || 0).getTime()
					return dateA - dateB
				})
			}
			
			groupedLeads.push(groupedLead)
		})
		
		// Ordenar por total_value decrescente
		return groupedLeads.sort((a, b) => b.total_value - a.total_value)
	}

	// Processar dados baseado na opção de agrupamento
	const processedLeads = useMemo(() => {
		try {
			if (!allLeads || allLeads.length === 0) return []
			
			// Sempre agrupar por email
			return groupLeadsByEmail(allLeads)
		} catch (error) {
			console.error('Erro ao processar leads:', error)
			return allLeads || []
		}
	}, [allLeads])

	// Atualizar título da aba com status de carregamento
	const getTabTitle = () => {
		if (isLoading && hasMoreData && totalRows > 0) {
			const percentage = Math.round((allLeads.length / totalRows) * 100)
			return `Leads (${percentage}%) 🔄`
		} else if (isLoading) {
			return 'Leads 🔄'
		} else if (processedLeads.length > 0) {
			const uniqueEmails = processedLeads.length
			const totalOrders = allLeads.length
			return `Leads (${uniqueEmails} emails, ${totalOrders} pedidos)`
		}
		return 'Leads'
	}

	useDocumentTitle(getTabTitle())

	const toggleExpand = (id: string) => {
		setExpanded((prev) => {
			const copy = new Set(prev)
			if (copy.has(id)) copy.delete(id)
			else copy.add(id)
			return copy
		})
	}

	const fetchLeads = useCallback(async (retryAttempt = 0, useCacheParam?: boolean, offset = 0, autoLoadAll = false) => {
		const maxRetries = 3
		const retryDelay = 2000 // 2 segundos
		const initialBatchSize = 50 // Carregar apenas 50 leads inicialmente

		console.log(`🚀 fetchLeads chamado - retryAttempt: ${retryAttempt}, offset: ${offset}, autoLoadAll: ${autoLoadAll}, useCacheParam: ${useCacheParam}`)

		// Evitar chamadas duplicadas
		if (isLoading && offset > 0) {
			console.log('⏸️ Evitando chamada duplicada - já carregando')
			return
		}

		// Evitar chamadas com o mesmo offset
		if (offset === lastOffset && offset > 0) {
			console.log('⏸️ Evitando chamada com mesmo offset:', offset)
			return
		}

		try {
			setIsLoading(true)
			setError(null)
			setRetryCount(retryAttempt)

			const token = localStorage.getItem('auth-token') || ''
			if (!token) throw new Error('Token não encontrado')

			const body: LeadsOrdersRequest = {
				table_name: selectedTable,
				limit: autoLoadAll ? 5000 : initialBatchSize,
				offset: offset
			}

			// Se não está usando cache, adicionar datas
			if (!useCacheParam) {
				body.start_date = startDate
				body.end_date = endDate
			} else {
				body.last_cache = true
			}

			if (!validateTableName(selectedTable)) {
				console.warn('⚠️ Leads - Requisição não enviada: table_name inválido:', selectedTable)
				setIsLoading(false)
				return
			}

			if (abortControllerRef.current) abortControllerRef.current.abort()
			abortControllerRef.current = new AbortController()

			const response = await api.getLeadsOrders(token, body, abortControllerRef.current.signal)
			console.log(`✅ Leads - Resposta completa (offset ${offset}):`, response)

			const newLeads = response?.data || []
			const totalRowsFromAPI = response?.total_rows || 0
			const totalRecordsFromAPI = response?.total_records || 0
			const cacheInfoFromAPI = response?.cache_info || null
			const summaryFromAPI = response?.summary || null
			const paginationFromAPI = response?.pagination || null

			console.log(`📊 Dados da API - total_rows: ${totalRowsFromAPI}, total_records: ${totalRecordsFromAPI}`)
			setTotalRows(totalRecordsFromAPI) // Usar total_records para cálculo de progresso
			setCacheInfo(cacheInfoFromAPI)
			setSummary(summaryFromAPI)

			if (offset === 0) {
				// Primeira página - substituir dados
				setLeads([...newLeads])
				setAllLeads([...newLeads])
			} else {
				// Páginas subsequentes - adicionar aos dados existentes
				setLeads(prev => [...prev, ...newLeads])
				setAllLeads(prev => [...prev, ...newLeads])
			}

			// Verificar se há mais dados usando o campo has_more da API
			const hasMore = paginationFromAPI?.has_more || false
			const currentTotal = offset + newLeads.length
			setHasMoreData(hasMore)

			console.log(`📊 Paginação API - Offset atual: ${offset}, Registros recebidos: ${newLeads.length}, Total carregado: ${currentTotal}, Total records: ${totalRecordsFromAPI}, HasMore da API: ${hasMore}`)

			// Atualizar último offset processado
			setLastOffset(offset)

			// Se autoLoadAll está ativado e há mais dados, continuar carregando
			if (autoLoadAll && hasMore) {
				console.log(`🔄 Auto-carregando próxima página (novo offset: ${currentTotal})`)
				// Pequeno delay para não sobrecarregar a API
				setTimeout(() => {
					fetchLeads(retryAttempt, useCacheParam, currentTotal, true)
				}, 500)
				return
			}

			// Só definir como completo quando não há mais dados para carregar
			setRetryCount(0) // Reset retry count on success
			setIsLoading(false)
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				console.log('⏹️ Requisição de leads cancelada (AbortError) — ignorando mensagem de erro visível')
				return
			}

			// Verificar se deve tentar novamente (timeout ou erros de rede)
			const isTimeout = err instanceof Error && (
				err.message.includes('timeout') ||
				err.message.includes('Timeout') ||
				err.message.includes('Network error') ||
				err.message.includes('Failed to fetch') ||
				err.message.includes('fetch') ||
				(err instanceof TypeError && err.message.includes('Failed'))
			)

			// Também tentar novamente para outros erros (como 500, 503, etc)
			const shouldRetry = isTimeout || (
				err instanceof Error &&
				err.message.includes('HTTP error! status: 5')
			)

			if (shouldRetry && retryAttempt < maxRetries) {
				const nextRetry = retryAttempt + 1
				console.log(`🔄 Leads - Tentativa ${nextRetry}/${maxRetries} falhou (${isTimeout ? 'timeout/erro de rede' : 'erro do servidor'}). Tentando novamente em ${retryDelay/1000}s...`)
				setRetryCount(nextRetry)

				// Aguardar antes de tentar novamente
				await new Promise(resolve => setTimeout(resolve, retryDelay))

				// Tentar novamente
				return fetchLeads(nextRetry, useCacheParam, offset, autoLoadAll)
			}

			console.error('❌ Erro ao obter leads após todas as tentativas:', err)
			setError(err instanceof Error ? err.message : 'Erro ao obter leads')
		} finally {
			setIsLoading(false)
		}
	}, [selectedTable, startDate, endDate])

	useEffect(() => {
		console.log('🧭 Acessando aba Leads | table:', selectedTable, '| período:', startDate, '->', endDate)
		console.log('🔄 Inicializando paginação - resetando estados')
		setHasMoreData(true)
		setAllLeads([]) // Limpar dados anteriores
		setLastOffset(0) // Reset offset
		setLoadAllData(false) // Reset flag de carregar todos
		fetchLeads(0, undefined, 0, false) // Carregar apenas lote inicial
		return () => {
			if (abortControllerRef.current) abortControllerRef.current.abort()
		}
	}, [selectedTable, startDate, endDate])

	const handleLoadAllData = async () => {
		setLoadAllData(true)
		setHasMoreData(true)
		setLastOffset(0)
		await fetchLeads(0, undefined, 0, true) // Carregar todos os dados
	}
	const handleRefresh = async () => {
		setIsRefreshing(true)
		setHasMoreData(true)
		setLastOffset(0) // Reset offset
		await fetchLeads(0, false, 0, true) // Forçar refresh sem cache e auto-carregar tudo
		setIsRefreshing(false)
	}


	// Filtrar leads por termo de pesquisa
	const filteredLeadsRaw = useMemo(() => {
		return (processedLeads || []).filter(lead => {
			const searchLower = searchTerm.toLowerCase().trim()
			if (!searchTerm) return true
			
			return (
				lead.name?.toLowerCase().includes(searchLower) ||
				lead.email?.toLowerCase().includes(searchLower) ||
				lead.phone?.toLowerCase().includes(searchLower) ||
				lead.fsm_source?.toLowerCase().includes(searchLower) ||
				lead.fsm_medium?.toLowerCase().includes(searchLower) ||
				lead.fsm_campaign?.toLowerCase().includes(searchLower) ||
				lead.source?.toLowerCase().includes(searchLower) ||
				lead.medium?.toLowerCase().includes(searchLower) ||
				lead.campaign?.toLowerCase().includes(searchLower) ||
				lead.transaction_id?.toLowerCase().includes(searchLower)
			)
		})
	}, [processedLeads, searchTerm])

	// Limitar exibição a 30 resultados
	const filteredLeads = filteredLeadsRaw.slice(0, 30)

	// Resumo dos dados da API
	const [summary, setSummary] = useState<any>(null)


	// Preparar dados para timeline agregados por dia
	const timelineData = useMemo(() => {
		const leadsByDay: Record<string, { leads: number; sales: number; revenue: number }> = {}
		
		allLeads.forEach(lead => {
			// Agrupar por dia de inscrição (captura de leads)
			if (lead.subscribe_timestamp) {
				const date = lead.subscribe_timestamp.split('T')[0]
				if (!leadsByDay[date]) {
					leadsByDay[date] = { leads: 0, sales: 0, revenue: 0 }
				}
				leadsByDay[date].leads++
			}
			
			// Agrupar por dia de compra (vendas)
			if (lead.purchase_timestamp && lead.transaction_id) {
				const date = lead.purchase_timestamp.split('T')[0]
				if (!leadsByDay[date]) {
					leadsByDay[date] = { leads: 0, sales: 0, revenue: 0 }
				}
				leadsByDay[date].sales++
				leadsByDay[date].revenue += lead.value || 0
			}
		})
		
		// Converter para array e ordenar por data
		return Object.entries(leadsByDay)
			.map(([date, data]) => ({
				date,
				leads: data.leads,
				sales: data.sales,
				revenue: data.revenue
			}))
			.sort((a, b) => a.date.localeCompare(b.date))
	}, [allLeads])

	const formatDateForChart = (dateStr: string) => {
		if (!dateStr) return 'Data inválida'
		
		try {
			const [year, month, day] = dateStr.split('-').map(Number)
			
			// Verificar se os valores são válidos
			if (isNaN(year) || isNaN(month) || isNaN(day)) {
				console.error('Data inválida:', dateStr)
				return 'Data inválida'
			}
			
			const date = new Date(year, month - 1, day)
			
			// Verificar se a data é válida
			if (isNaN(date.getTime())) {
				console.error('Data inválida após criação:', dateStr)
				return 'Data inválida'
			}
			
			return date.toLocaleDateString('pt-BR', { 
				day: '2-digit', 
				month: '2-digit' 
			})
		} catch (error) {
			console.error('Erro ao formatar data:', dateStr, error)
			return 'Data inválida'
		}
	}

	const CustomTooltip = ({ active, payload }: any) => {
		if (active && payload && payload.length) {
			const getLabel = (name: string) => {
				if (name === 'leads') return 'Captura de Leads'
				if (name === 'sales') return 'Vendas'
				if (name === 'revenue') return 'Receita'
				return name
			}
			
			const formatValue = (name: string, value: number) => {
				if (name === 'revenue') {
					return formatCurrency(value)
				}
				return new Intl.NumberFormat('pt-BR').format(value)
			}
			
			const dateStr = payload[0]?.payload?.date
			const dateLabel = dateStr ? formatDateForChart(dateStr) : ''
			
			return (
				<div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
					<p className="font-semibold text-gray-900 mb-2">
						Data: {dateLabel}
					</p>
					{payload.map((entry: any, index: number) => (
						<p key={index} className="text-sm" style={{ color: entry.color }}>
							{getLabel(entry.dataKey)}: <span className="font-semibold">{formatValue(entry.dataKey, entry.value)}</span>
						</p>
					))}
				</div>
			)
		}
		return null
	}

	const TableBlock = (
		<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
			<table className="w-full">
				<thead className="bg-gray-50 sticky top-0 z-10">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Detalhes</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nome</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Telefone</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Data de Inscrição</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pedidos</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Origem</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mídia</th>
						<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Campanha</th>
					</tr>
				</thead>
				<tbody className="bg-white divide-y divide-gray-200">
					{filteredLeads.map((lead, idx) => {
						// Criar uma key única combinando múltiplos campos para evitar duplicatas
						// Usar transaction_id se disponível, senão combinar email + timestamp + índice
						const uniqueId = lead.transaction_id 
							? `tx-${lead.transaction_id}-${idx}` 
							: `lead-${lead.email || 'no-email'}-${lead.subscribe_timestamp || 'no-ts'}-${idx}`
						const isOpen = expanded.has(uniqueId)
						const hasPurchase = lead.transaction_id && lead.transaction_id !== ''
						return (
							<Fragment key={uniqueId}>
								<tr className="hover:bg-gray-50 cursor-pointer transition-colors odd:bg-white even:bg-gray-50/40">
									<td className="px-6 py-4 whitespace-nowrap">
										<button onClick={() => toggleExpand(uniqueId)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
											{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
											<span>{isOpen ? 'Ocultar' : 'Detalhes'}</span>
										</button>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										<div className="flex items-center gap-2">
											<User className="w-4 h-4 text-gray-500" />
											<span className="font-medium">{display(lead.name)}</span>
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
										<div className="flex items-center gap-1">
											<Mail className="w-4 h-4 text-gray-400" />
											{display(lead.email)}
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
										<div className="flex items-center gap-1">
											<Phone className="w-4 h-4 text-gray-400" />
											{display(lead.phone)}
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
										<div className="flex items-center gap-1">
											<Calendar className="w-4 h-4 text-gray-400" />
											{formatDateTime(lead.subscribe_timestamp)}
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										{hasPurchase ? (
											<span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Convertido</span>
										) : (
											<span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">Lead</span>
										)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
										<div className="flex items-center gap-2">
											<ShoppingBag className="w-4 h-4 text-gray-400" />
											<div className="text-center">
												<div className="font-medium text-gray-900">
													{(lead as GroupedLeadItem).orders_count} pedido{(lead as GroupedLeadItem).orders_count > 1 ? 's' : ''}
												</div>
												<div className="text-xs text-green-600 font-medium">
													{formatCurrency((lead as GroupedLeadItem).total_value)}
												</div>
											</div>
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">{display(lead.fsm_source || lead.source)}</span>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">{display(lead.fsm_medium || lead.medium)}</span>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm">
										<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200 truncate max-w-xs" title={display(lead.fsm_campaign || lead.campaign)}>{display(lead.fsm_campaign || lead.campaign)}</span>
									</td>
								</tr>

								{isOpen && (
									<tr>
										<td colSpan={10} className="px-6 pb-6 pt-2 bg-gray-50">
											<div className="space-y-3">
												{/* Resumo do lead */}
												<div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
													<div className="text-sm text-gray-700">
														<span className="font-medium text-gray-900">{display(lead.name)}</span>
														<span className="mx-2 text-gray-300">•</span>
														<span>{display(lead.email)}</span>
													</div>
													<div className="flex items-center gap-2">
														<span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
															{(lead as GroupedLeadItem).orders_count} pedido{(lead as GroupedLeadItem).orders_count > 1 ? 's' : ''}
														</span>
														<span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
															{formatCurrency((lead as GroupedLeadItem).total_value)}
														</span>
													</div>
												</div>

												<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
													{/* Informações de Contato */}
													<div className="border border-blue-100 rounded-lg bg-white p-4 shadow-sm">
														<h4 className="text-sm font-semibold text-blue-700 mb-2">Informações de Contato</h4>
														<div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
															<div><span className="text-gray-500">Nome:</span> <span className="font-medium">{display(lead.name)}</span></div>
															<div><span className="text-gray-500">Email:</span> <span className="font-medium">{display(lead.email)}</span></div>
															<div><span className="text-gray-500">Telefone:</span> <span className="font-medium">{display(lead.phone)}</span></div>
															<div><span className="text-gray-500">Data de Inscrição:</span> <span className="font-medium">{formatDateTime(lead.subscribe_timestamp)}</span></div>
														</div>
													</div>

													{/* Informações de Conversão */}
													<div className="border border-green-100 rounded-lg bg-white p-4 shadow-sm">
														<h4 className="text-sm font-semibold text-green-700 mb-2">Informações de Conversão</h4>
														<div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
															{hasPurchase ? (
																<>
																	<div><span className="text-gray-500">ID da Transação:</span> <span className="font-medium">{display(lead.transaction_id)}</span></div>
																	<div><span className="text-gray-500">Data da Compra:</span> <span className="font-medium">{formatDateTime(lead.purchase_timestamp)}</span></div>
																	<div><span className="text-gray-500">Valor:</span> <span className="font-medium text-green-600">{formatCurrency(lead.value)}</span></div>
																	<div className="flex items-center gap-1">
																		<Clock className="w-4 h-4 text-gray-400" />
																		<span className="text-gray-500">Tempo até conversão:</span> 
																		<span className="font-medium ml-1">{formatDuration(lead.days_between_subscribe_and_purchase, lead.minutes_between_subscribe_and_purchase)}</span>
																	</div>
																</>
															) : (
																<div className="text-gray-500 italic">Ainda não converteu</div>
															)}
														</div>
													</div>

													{/* Atribuição no Primeiro Lead */}
													<div className="border border-purple-100 rounded-lg bg-white p-4 shadow-sm">
														<h4 className="text-sm font-semibold text-purple-700 mb-2">Atribuição (Primeiro Lead)</h4>
														<div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
															<div><span className="text-gray-500">Origem:</span> <span className="font-medium">{display(lead.fsm_source)}</span></div>
															<div><span className="text-gray-500">Mídia:</span> <span className="font-medium">{display(lead.fsm_medium)}</span></div>
															<div className="break-words"><span className="text-gray-500">Campanha:</span> <span className="font-medium">{display(lead.fsm_campaign)}</span></div>
														</div>
													</div>

													{(lead as GroupedLeadItem).orders_count > 1 && (
														<div className="border border-orange-100 rounded-lg bg-white p-4 shadow-sm">
															<h4 className="text-sm font-semibold text-orange-700 mb-3">Todos os Pedidos</h4>
															<div className="space-y-2">
																{(lead as GroupedLeadItem).orders.map((order, orderIdx) => (
																	<div key={orderIdx} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
																		<div className="text-sm">
																			<div className="font-medium text-gray-900">{formatDateTime(order.purchase_timestamp)}</div>
																			<div className="text-gray-500 text-xs">ID: {display(order.transaction_id)}</div>
																		</div>
																		<div className="text-sm font-medium text-green-600">
																			{formatCurrency(order.value)}
																		</div>
																	</div>
																))}
															</div>
														</div>
													)}

													{/* Atribuição na Compra (se houver) */}
													{hasPurchase && (
														<div className="border border-orange-100 rounded-lg bg-white p-4 shadow-sm">
															<h4 className="text-sm font-semibold text-orange-700 mb-2">Atribuição na Compra</h4>
															<div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
																<div><span className="text-gray-500">Origem:</span> <span className="font-medium">{display(lead.source)}</span></div>
																<div><span className="text-gray-500">Mídia:</span> <span className="font-medium">{display(lead.medium)}</span></div>
																<div className="break-words"><span className="text-gray-500">Campanha:</span> <span className="font-medium">{display(lead.campaign)}</span></div>
															</div>
														</div>
													)}
												</div>
											</div>
										</td>
									</tr>
								)}
							</Fragment>
						)
					})}
				</tbody>
			</table>
			
			{/* Botão para carregar todos os dados */}
			{!loadAllData && hasMoreData && !isLoading && (
				<div className="bg-white border-t border-gray-200 px-6 py-4">
					<div className="flex justify-center">
						<button
							onClick={handleLoadAllData}
							className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
						>
							📥 Carregar Todos os Dados
						</button>
					</div>
				</div>
			)}
			
			{/* Resumo de carregamento */}
			{!isLoading && totalRows > 0 && (
				<div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
					<div className="text-sm text-gray-600">
						<span>
							Mostrando <strong>{filteredLeads.length}</strong> de <strong>{filteredLeadsRaw.length}</strong> emails únicos filtrados
							{filteredLeadsRaw.length > 30 && (
								<span className="ml-2 text-orange-600">(limitado a 30 na exibição)</span>
							)}
							{totalRows > filteredLeadsRaw.length && (
								<span className="ml-2 text-gray-500">de {totalRows} total</span>
							)}
							<span className="ml-2 text-blue-600">({allLeads.length} pedidos totais)</span>
						</span>
					</div>
				</div>
			)}
		</div>
	)

	return (
		<div className="p-4 sm:p-6 lg:p-8">
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<div className="p-2 bg-purple-100 rounded-lg">
						<User className="w-5 h-5 text-purple-600" />
					</div>
					<div>
						<h2 className="text-xl font-semibold text-gray-900">Leads</h2>
						<p className="text-sm text-gray-500">
							{startDate} • {endDate} • {selectedTable}
							{retryCount > 0 && (
								<span className="ml-2 text-orange-600 font-medium">(Tentativa {retryCount}/3)</span>
							)}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setIsFullscreen(true)}
						className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
						title="Tela cheia"
					>
						<Maximize2 className="w-4 h-4" />
						Tela cheia
					</button>
				</div>
			</div>

			{/* Barra de Progresso - sempre visível quando há carregamento ou dados parciais */}
			{(isLoading || (hasMoreData && totalRows > 0)) && (
				<div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
					<div className="flex items-center justify-between text-sm text-gray-600 mb-2">
						<span>Progresso do Carregamento</span>
						<span>{Math.round((allLeads.length / totalRows) * 100)}%</span>
					</div>
					<div className="w-full bg-gray-200 rounded-full h-2">
						<div 
							className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
							style={{ width: `${Math.min((allLeads.length / totalRows) * 100, 100)}%` }}
						></div>
					</div>
					<div className="flex items-center justify-between text-xs text-gray-500 mt-1">
						<span>{allLeads.length.toLocaleString()} leads carregados</span>
						<span>{totalRows.toLocaleString()} total</span>
					</div>
				</div>
			)}

			{/* Controles de Cache e Agrupamento */}
			<div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<label className="flex items-center gap-2 text-sm text-gray-700">
							<input
								type="checkbox"
								checked={useCache}
								onChange={(e) => setUseCache(e.target.checked)}
								className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
							/>
							Usar cache
						</label>
						{cacheInfo && useCache && (
							<span className="text-xs text-blue-600">
								Cache de {new Date(cacheInfo.cached_at + 'Z').toLocaleString('pt-BR', {
									timeZone: 'America/Sao_Paulo',
									day: '2-digit',
									month: '2-digit',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								}).replace(',', '')}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={handleRefresh}
							disabled={isRefreshing}
							className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isRefreshing ? (
								<>
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
									Atualizando...
								</>
							) : (
								<>
									<TrendingUp className="w-4 h-4" />
									Atualizar Dados
								</>
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Resumo dos Dados */}
			{allLeads.length > 0 && (
				<div className="space-y-6 mb-6">
					{/* Linha 1: Métricas Principais */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{/* Tempo Médio entre Lead e Conversão */}
						<div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<p className="text-sm font-medium text-gray-600 mb-1">Tempo Médio Lead → Conversão</p>
									<p className="text-3xl font-bold text-gray-900">
										{(() => {
											const leadsWithPurchase = allLeads.filter(lead => 
												lead.purchase_timestamp && 
												lead.days_between_subscribe_and_purchase !== null
											)
											
											if (leadsWithPurchase.length === 0) return '0d'
											
											const totalDays = leadsWithPurchase.reduce((sum, lead) => 
												sum + (lead.days_between_subscribe_and_purchase || 0), 0
											)
											
											const avgDays = Math.round(totalDays / leadsWithPurchase.length)
											
											if (avgDays === 0) {
												const totalMinutes = leadsWithPurchase.reduce((sum, lead) => 
													sum + (lead.minutes_between_subscribe_and_purchase || 0), 0
												)
												const avgMinutes = Math.round(totalMinutes / leadsWithPurchase.length)
												return `${avgMinutes}m`
											}
											
											return `${avgDays}d`
										})()}
									</p>
									<p className="text-xs text-gray-500 mt-1">
										{allLeads.filter(lead => lead.purchase_timestamp).length} conversões analisadas
									</p>
								</div>
								<div className="p-3 bg-blue-100 rounded-lg">
									<Clock className="w-6 h-6 text-blue-600" />
								</div>
							</div>
						</div>

						{/* Taxa de Conversão Lead em Cliente */}
						<div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl border-2 border-emerald-200 p-5 shadow-sm">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<p className="text-sm font-medium text-emerald-700 mb-1">Taxa de Conversão Lead em Cliente</p>
									<p className="text-3xl font-bold text-emerald-600">
										{summary?.total_distinct_emails > 0 ? 
											(((summary?.total_distinct_emails_with_purchase || 0) - (summary?.total_distinct_emails_with_purchase_no_lead || 0)) / summary?.total_distinct_emails * 100).toFixed(1) : 0}%
									</p>
									<p className="text-xs text-emerald-600 mt-1">
										{(summary?.total_distinct_emails_with_purchase || 0) - (summary?.total_distinct_emails_with_purchase_no_lead || 0)} convertidos
									</p>
								</div>
								<div className="p-3 bg-emerald-100 rounded-lg">
									<TrendingUp className="w-6 h-6 text-emerald-600" />
								</div>
							</div>
						</div>

						{/* Taxa de Compras com Leads Antes */}
						<div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border-2 border-blue-200 p-5 shadow-sm">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<p className="text-sm font-medium text-blue-700 mb-1">Taxa de Compras com Leads Antes</p>
									<p className="text-3xl font-bold text-blue-600">
										{summary?.total_distinct_emails_with_purchase > 0 ? 
											((1 - ((summary?.total_distinct_emails_with_purchase_no_lead || 0) / summary?.total_distinct_emails_with_purchase)) * 100).toFixed(1) : 0}%
									</p>
									<p className="text-xs text-blue-600 mt-1">
										{(summary?.total_distinct_emails_with_purchase || 0) - (summary?.total_distinct_emails_with_purchase_no_lead || 0)} de {summary?.total_distinct_emails_with_purchase || 0}
									</p>
								</div>
								<div className="p-3 bg-blue-100 rounded-lg">
									<ShoppingBag className="w-6 h-6 text-blue-600" />
								</div>
							</div>
						</div>
					</div>

					{/* Linha 2: Métricas Secundárias */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{/* Receita Total */}
						<div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<p className="text-sm font-medium text-gray-600 mb-1">Receita Total</p>
									<p className="text-3xl font-bold text-green-600">{formatCurrency(summary?.total_revenue || 0)}</p>
									{summary?.total_distinct_emails_with_purchase > 0 && (
										<p className="text-xs text-gray-500 mt-1">
											Ticket: {formatCurrency((summary?.total_revenue || 0) / summary?.total_distinct_emails_with_purchase)}
										</p>
									)}
								</div>
								<div className="p-3 bg-green-100 rounded-lg">
									<DollarSign className="w-6 h-6 text-green-600" />
								</div>
							</div>
						</div>

						{/* Receita por Lead */}
						<div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<p className="text-sm font-medium text-gray-600 mb-1">Receita por Lead</p>
									<p className="text-2xl font-bold text-green-600">
										{summary?.total_leads > 0 ? formatCurrency((summary?.total_revenue || 0) / summary?.total_leads) : formatCurrency(0)}
									</p>
									<p className="text-xs text-gray-500 mt-1">
										Média de receita por lead
									</p>
								</div>
								<div className="p-3 bg-green-100 rounded-lg">
									<TrendingUp className="w-6 h-6 text-green-600" />
								</div>
							</div>
						</div>

						{/* Tempo Médio de Conversão */}
						<div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									<p className="text-sm font-medium text-gray-600 mb-1">Emails Únicos</p>
									<p className="text-2xl font-bold text-blue-600">{summary?.total_distinct_emails?.toLocaleString() || 0}</p>
									<p className="text-xs text-gray-500 mt-1">
										{summary?.total_distinct_emails_with_purchase || 0} com compra
									</p>
								</div>
								<div className="p-3 bg-blue-100 rounded-lg">
									<Clock className="w-6 h-6 text-blue-600" />
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Timeline de Captura de Leads e Vendas */}
			{!isLoading && timelineData.length > 0 && (
				<div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
					<h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Timeline de Captura de Leads e Vendas (Agregado por Semana)</h3>
					<div className="h-80">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={timelineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
								<XAxis 
									dataKey="date" 
									stroke="#6b7280"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={formatDateForChart}
									interval="preserveStartEnd"
								/>
								<YAxis 
									yAxisId="left"
									stroke="#6b7280"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => new Intl.NumberFormat('pt-BR').format(value)}
								/>
								<YAxis 
									yAxisId="right"
									orientation="right"
									stroke="#6b7280"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => new Intl.NumberFormat('pt-BR', {
										style: 'currency',
										currency: 'BRL',
										minimumFractionDigits: 0,
										notation: 'compact'
									}).format(value)}
								/>
								<Tooltip content={<CustomTooltip />} />
								<Legend 
									wrapperStyle={{ paddingTop: '20px' }}
									formatter={(value) => {
										if (value === 'leads') return 'Captura de Leads'
										if (value === 'sales') return 'Vendas'
										if (value === 'revenue') return 'Receita'
										return value
									}}
								/>
								<Line
									yAxisId="left"
									type="monotone"
									dataKey="leads"
									stroke="#9333ea"
									strokeWidth={3}
									dot={false}
									activeDot={{ r: 7, stroke: '#9333ea', strokeWidth: 2 }}
									name="leads"
								/>
								<Line
									yAxisId="left"
									type="monotone"
									dataKey="sales"
									stroke="#3b82f6"
									strokeWidth={3}
									dot={false}
									activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
									name="sales"
								/>
								<Line
									yAxisId="right"
									type="monotone"
									dataKey="revenue"
									stroke="#10b981"
									strokeWidth={3}
									dot={false}
									activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2 }}
									name="revenue"
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4 flex flex-wrap gap-4 justify-center">
						<div className="flex items-center gap-2 text-sm">
							<div className="w-3 h-3 rounded-full bg-purple-500" />
							<span className="text-gray-600">Captura de Leads</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<div className="w-3 h-3 rounded-full bg-blue-500" />
							<span className="text-gray-600">Vendas</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<div className="w-3 h-3 rounded-full bg-green-500" />
							<span className="text-gray-600">Receita</span>
						</div>
					</div>
				</div>
			)}

			{/* Pesquisa */}
			<div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
				<label className="text-sm text-gray-700">
					<span className="block mb-2 font-semibold text-gray-900">🔍 Pesquisar</span>
					<input 
						type="text" 
						value={searchTerm} 
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Digite nome, email, telefone ou ID da transação..."
						className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
					/>
				</label>
				{filteredLeads.length !== allLeads.length && (
					<div className="mt-3 text-sm text-gray-600">
						Mostrando <strong className="text-gray-900">{filteredLeads.length}</strong> de <strong className="text-gray-900">{allLeads.length}</strong> leads
					</div>
				)}
			</div>

			{error ? (
				<div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
					<div className="text-red-600 mb-4">{error}</div>
					<button
						onClick={() => fetchLeads(0)}
						className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
					>
						Tentar novamente
					</button>
				</div>
			) : processedLeads.length === 0 && !isLoading ? (
				<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">Nenhum lead no período.</div>
			) : (
				TableBlock
			)}

			{isFullscreen && (
				<div className="fixed inset-0 z-50 bg-white">
					<div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
						<div className="flex items-center gap-2">
							<User className="w-4 h-4 text-purple-600" />
							<span className="font-semibold">Leads (Tela cheia)</span>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => setIsFullscreen(false)}
								className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
								title="Sair da tela cheia"
							>
								<Minimize2 className="w-4 h-4" />
								Fechar
							</button>
						</div>
					</div>
					<div className="pt-14 p-4 sm:p-6 overflow-auto h-full">
						{TableBlock}
					</div>
				</div>
			)}
		</div>
	)
}

export default LeadsTab

