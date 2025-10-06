import { useEffect, useState, useRef, useCallback } from 'react'
import { ShoppingBag, Package, User, ChevronRight, ChevronDown, Maximize2, Minimize2, Filter, ChevronUp, DollarSign, TrendingUp } from 'lucide-react'
import { api, validateTableName } from '../services/api'

interface OrdersTabProps {
	selectedTable: string
	startDate: string
	endDate: string
}

interface OrderItem {
	Horario: string
	ID_da_Transacao: string
	Primeiro_Nome: string
	Status: string
	Receita: number
	Canal: string
	Categoria_de_Trafico: string
	Origem: string
	Midia: string
	Campanha: string
	Conteudo: string
	Pagina_de_Entrada: string
	Parametros_de_URL: string
	Categoria_de_Trafico_Primeiro_Clique: string
	Origem_Primeiro_Clique: string
	Midia_Primeiro_Clique: string
	Campanha_Primeiro_Clique: string
	Conteudo_Primeiro_Clique: string
	Pagina_de_Entrada_Primeiro_Clique: string
	Parametros_de_URL_Primeiro_Clique: string
	Categoria_de_Trafico_Primeiro_Lead: string
	Origem_Primeiro_Lead: string
	Midia_Primeiro_Lead: string
	Campanha_Primeiro_Lead: string
	Conteudo_Primeiro_Lead: string
	Pagina_de_Entrada_Primeiro_Lead: string
	Parametros_de_URL_Primeiro_Lead: string
	[key: string]: any
}

const OrdersTab = ({ selectedTable, startDate, endDate }: OrdersTabProps) => {
	const [orders, setOrders] = useState<OrderItem[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [filterLast, setFilterLast] = useState<string[]>([])
	const [filterFirst, setFilterFirst] = useState<string[]>([])
	const [filterLead, setFilterLead] = useState<string[]>([])
	const [filterStatus, setFilterStatus] = useState<string[]>([])
	
	// Filtros de Origem por atribuição
	const [filterOrigemLast, setFilterOrigemLast] = useState<string[]>([])
	const [filterOrigemFirst, setFilterOrigemFirst] = useState<string[]>([])
	const [filterOrigemLead, setFilterOrigemLead] = useState<string[]>([])
	
	// Filtros de Mídia por atribuição
	const [filterMidiaLast, setFilterMidiaLast] = useState<string[]>([])
	const [filterMidiaFirst, setFilterMidiaFirst] = useState<string[]>([])
	const [filterMidiaLead, setFilterMidiaLead] = useState<string[]>([])
	
	const [searchTerm, setSearchTerm] = useState<string>('')
	const [totalRows, setTotalRows] = useState(0)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [retryCount, setRetryCount] = useState(0)
	const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false)
	
	// Estados para collapse dos filtros
	const [filtersExpanded, setFiltersExpanded] = useState(false)
	const abortControllerRef = useRef<AbortController | null>(null)

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
	}

	// Funções auxiliares para seleção múltipla
	const toggleFilterValue = (currentValues: string[], value: string, setter: (values: string[]) => void) => {
		if (value === 'Todos') {
			setter([])
		} else {
			const newValues = currentValues.includes(value)
				? currentValues.filter(v => v !== value)
				: [...currentValues, value]
			setter(newValues)
		}
	}

	const isFilterActive = (values: string[]) => values.length > 0
	const getFilterDisplayText = (values: string[], label: string) => {
		if (values.length === 0) return label
		if (values.length === 1) return values[0]
		return `${values.length} selecionados`
	}

	// Contar filtros ativos
	const getActiveFiltersCount = () => {
		return [
			isFilterActive(filterLast), isFilterActive(filterFirst), isFilterActive(filterLead),
			isFilterActive(filterStatus), isFilterActive(filterOrigemLast), isFilterActive(filterOrigemFirst),
			isFilterActive(filterOrigemLead), isFilterActive(filterMidiaLast), isFilterActive(filterMidiaFirst),
			isFilterActive(filterMidiaLead)
		].filter(Boolean).length
	}

	const hasActiveFilters = getActiveFiltersCount() > 0

	// Componente de dropdown com seleção múltipla
	const MultiSelectDropdown = ({ 
		label, 
		options, 
		selectedValues, 
		onToggle, 
		className = "" 
	}: {
		label: string
		options: string[]
		selectedValues: string[]
		onToggle: (value: string) => void
		className?: string
	}) => {
		const [isOpen, setIsOpen] = useState(false)
		const dropdownRef = useRef<HTMLDivElement>(null)
		const displayText = getFilterDisplayText(selectedValues, label)
		const isActive = isFilterActive(selectedValues)

		// Fechar dropdown quando clicar fora
		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
					setIsOpen(false)
				}
			}

			if (isOpen) {
				document.addEventListener('mousedown', handleClickOutside)
			}

			return () => {
				document.removeEventListener('mousedown', handleClickOutside)
			}
		}, [isOpen])

		return (
			<div ref={dropdownRef} className={`relative ${className}`}>
				<label className="text-sm text-gray-700">
					<span className="block mb-1 font-medium">{label}</span>
					<button
						type="button"
						onClick={() => setIsOpen(!isOpen)}
						className={`w-full px-3 py-2 border rounded-lg text-sm text-left flex items-center justify-between transition-colors ${
							isActive 
								? 'border-blue-500 bg-blue-50 text-blue-700' 
								: 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
						}`}
					>
						<span className="truncate">{displayText}</span>
						<ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
					</button>
				</label>
				
				{isOpen && (
					<div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
						<div className="p-2">
							{options.map(option => {
								const isSelected = selectedValues.includes(option)
								return (
									<label key={option} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
										<input
											type="checkbox"
											checked={isSelected}
											onChange={() => onToggle(option)}
											className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
										/>
										<span className="text-sm text-gray-700 flex-1">{option}</span>
									</label>
								)
							})}
						</div>
					</div>
				)}
			</div>
		)
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

	const getStatusClasses = (status?: string) => {
		const s = (status || '').toLowerCase()
		if (s === 'paid' || s === 'pago') return 'bg-green-100 text-green-800'
		if (s === 'pending' || s === 'pendente') return 'bg-yellow-100 text-yellow-800'
		if (s === 'cancelled' || s === 'cancelado') return 'bg-red-100 text-red-800'
		if (s === 'refunded' || s === 'reembolsado') return 'bg-orange-100 text-orange-800'
		return 'bg-gray-100 text-gray-800'
	}

	const toggleExpand = (id: string) => {
		setExpanded((prev) => {
			const copy = new Set(prev)
			if (copy.has(id)) copy.delete(id)
			else copy.add(id)
			return copy
		})
	}

	const fetchOrders = useCallback(async (offset = 0, append = false, retryAttempt = 0) => {
		const maxRetries = 3
		const retryDelay = 2000 // 2 segundos
		
		try {
			if (offset === 0) {
				setIsLoading(true)
				setRetryCount(0)
				setIsInitialLoadComplete(false)
			} else {
				setIsLoadingMore(true)
			}
			setError(null)

			const token = localStorage.getItem('auth-token') || ''
			if (!token) throw new Error('Token não encontrado')

			const body = {
				start_date: startDate,
				end_date: endDate,
				table_name: selectedTable,
				limit: 100,
				offset: offset
			}

			if (offset === 0 && retryAttempt === 0) {
				const maskedToken = token.length > 12 ? `${token.slice(0, 6)}...${token.slice(-4)}` : '***'
				const curl = `curl --request POST \\\n  --url https://api.mymetric.app/metrics/orders \\\n  --header 'Authorization: Bearer ${maskedToken}' \\\n  --header 'Content-Type': 'application/json' \\\n  --data '${JSON.stringify(body, null, 2)}'`
				console.log('🧾 Pedidos • cURL (token mascarado):\n' + curl)
				console.log('🚀 Pedidos - Request (equivalente ao cURL):', {
					url: 'https://api.mymetric.app/metrics/orders',
					method: 'POST',
					headers: {
						Authorization: `Bearer ${maskedToken}`,
						'Content-Type': 'application/json'
					},
					body
				})
			}

			if (!validateTableName(selectedTable)) {
				console.warn('⚠️ Pedidos - Requisição não enviada: table_name inválido:', selectedTable)
				if (offset === 0) setIsLoading(false)
				else setIsLoadingMore(false)
				return
			}

			if (abortControllerRef.current) abortControllerRef.current.abort()
			abortControllerRef.current = new AbortController()

			const response = await api.getOrders(token, body, abortControllerRef.current.signal)
			console.log(`✅ Pedidos - Resposta completa (offset: ${offset}):`, response)
			console.log(`📦 Pedidos - Data length: ${Array.isArray(response?.data) ? response.data.length : 0}`)
			
			const newOrders = response?.data || []
			const totalRowsFromAPI = response?.total_rows || 0
			
			console.log(`🔍 Debug paginação: offset=${offset}, newOrders.length=${newOrders.length}, totalRowsFromAPI=${totalRowsFromAPI}`)
			console.log(`🔍 Condição: newOrders.length === 100? ${newOrders.length === 100}, (offset + 100) < totalRowsFromAPI? ${(offset + 100) < totalRowsFromAPI}`)
			console.log(`🔍 Cálculo: offset + 100 = ${offset + 100}, totalRowsFromAPI = ${totalRowsFromAPI}`)
			console.log(`🔍 Vai buscar próxima página? ${newOrders.length === 100 && (offset + 100) < totalRowsFromAPI}`)
			
			// Atualizar total baseado nos pedidos carregados, não no total_rows da API
			if (append) {
				// Não alterar totalRows quando está adicionando páginas
			} else {
				// Na primeira página, definir totalRows baseado na resposta
				setTotalRows(totalRowsFromAPI)
			}
			setRetryCount(0) // Reset retry count on success
			
			if (append) {
				setOrders(prev => {
					const newTotal = [...prev, ...newOrders]
					console.log(`📊 Adicionando ${newOrders.length} pedidos. Total atual: ${newTotal.length}`)
					return newTotal
				})
			} else {
				setOrders(newOrders)
				console.log(`📊 Definindo ${newOrders.length} pedidos como inicial`)
			}

			// Se retornou 100 pedidos, assume que pode haver mais e tenta buscar a próxima página
			if (newOrders.length === 100) {
				console.log(`🔄 Retornou 100 pedidos, tentando próxima página: offset ${offset + 100}`)
				try {
					await fetchOrders(offset + 100, true, 0)
				} catch (nextPageError) {
					// Se a próxima página falhar (provavelmente não há mais dados), continua normalmente
					console.log(`✅ Não há mais páginas disponíveis. Busca finalizada com ${newOrders.length} pedidos nesta página`)
				}
			} else {
				console.log(`✅ Busca finalizada: ${newOrders.length} pedidos nesta página (menos de 100, última página)`)
			}

			// Marcar busca inicial como completa quando não há mais páginas para buscar
			if (offset === 0 || newOrders.length < 100) {
				setIsInitialLoadComplete(true)
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				console.log('⏹️ Pedido cancelado (AbortError) — ignorando mensagem de erro visível')
				return
			}
			
			// Verificar se deve tentar novamente
			if (retryAttempt < maxRetries) {
				const nextRetry = retryAttempt + 1
				console.log(`🔄 Tentativa ${nextRetry}/${maxRetries} falhou. Tentando novamente em ${retryDelay/1000}s...`)
				setRetryCount(nextRetry)
				
				// Aguardar antes de tentar novamente
				await new Promise(resolve => setTimeout(resolve, retryDelay))
				
				// Tentar novamente
				return fetchOrders(offset, append, nextRetry)
			}
			
			console.error('❌ Erro ao obter pedidos após todas as tentativas:', err)
			setError(err instanceof Error ? err.message : 'Erro ao obter pedidos')
		} finally {
			if (offset === 0) {
				setIsLoading(false)
			} else {
				setIsLoadingMore(false)
			}
			// Garantir que a busca inicial está marcada como completa
			if (offset === 0) {
				setIsInitialLoadComplete(true)
			}
		}
	}, [selectedTable, startDate, endDate])

	useEffect(() => {
		console.log('🧭 Acessando aba Pedidos | table:', selectedTable, '| período:', startDate, '->', endDate)
		fetchOrders()
		return () => {
			if (abortControllerRef.current) abortControllerRef.current.abort()
		}
	}, [fetchOrders])

	// Opções de filtros baseadas nos dados carregados
	const lastCategories = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Categoria_de_Trafico ?? '').toString().trim()).filter(Boolean)))].slice(0, 200)
	const firstCategories = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Categoria_de_Trafico_Primeiro_Clique ?? '').toString().trim()).filter(Boolean)))].slice(0, 200)
	const leadCategories = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Categoria_de_Trafico_Primeiro_Lead ?? '').toString().trim()).filter(Boolean)))].slice(0, 200)
	const statusOptions = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Status ?? '').toString().trim()).filter(Boolean)))].slice(0, 50)
	
	// Opções de Origem por atribuição
	const origemLastOptions = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Origem ?? '').toString().trim()).filter(Boolean)))].slice(0, 50)
	const origemFirstOptions = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Origem_Primeiro_Clique ?? '').toString().trim()).filter(Boolean)))].slice(0, 50)
	const origemLeadOptions = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Origem_Primeiro_Lead ?? '').toString().trim()).filter(Boolean)))].slice(0, 50)
	
	// Opções de Mídia por atribuição
	const midiaLastOptions = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Midia ?? '').toString().trim()).filter(Boolean)))].slice(0, 50)
	const midiaFirstOptions = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Midia_Primeiro_Clique ?? '').toString().trim()).filter(Boolean)))].slice(0, 50)
	const midiaLeadOptions = ['Todos', ...Array.from(new Set((orders || []).map(o => (o.Midia_Primeiro_Lead ?? '').toString().trim()).filter(Boolean)))].slice(0, 50)

	// Aplicar filtros aos pedidos
	const filteredOrders = (orders || []).filter(o => {
		// Categorias de tráfego
		const last = (o.Categoria_de_Trafico ?? '').toString().trim()
		const first = (o.Categoria_de_Trafico_Primeiro_Clique ?? '').toString().trim()
		const lead = (o.Categoria_de_Trafico_Primeiro_Lead ?? '').toString().trim()
		
		// Origens por atribuição
		const origemLast = (o.Origem ?? '').toString().trim()
		const origemFirst = (o.Origem_Primeiro_Clique ?? '').toString().trim()
		const origemLead = (o.Origem_Primeiro_Lead ?? '').toString().trim()
		
		// Mídias por atribuição
		const midiaLast = (o.Midia ?? '').toString().trim()
		const midiaFirst = (o.Midia_Primeiro_Clique ?? '').toString().trim()
		const midiaLead = (o.Midia_Primeiro_Lead ?? '').toString().trim()
		
		// Outros campos
		const status = (o.Status ?? '').toString().trim()
		const idTransacao = (o.ID_da_Transacao ?? '').toString().trim()
		const primeiroNome = (o.Primeiro_Nome ?? '').toString().trim()
		
		// Filtros de categoria de tráfego
		const okLast = filterLast.length === 0 || filterLast.includes(last)
		const okFirst = filterFirst.length === 0 || filterFirst.includes(first)
		const okLead = filterLead.length === 0 || filterLead.includes(lead)
		
		// Filtros de origem por atribuição
		const okOrigemLast = filterOrigemLast.length === 0 || filterOrigemLast.includes(origemLast)
		const okOrigemFirst = filterOrigemFirst.length === 0 || filterOrigemFirst.includes(origemFirst)
		const okOrigemLead = filterOrigemLead.length === 0 || filterOrigemLead.includes(origemLead)
		
		// Filtros de mídia por atribuição
		const okMidiaLast = filterMidiaLast.length === 0 || filterMidiaLast.includes(midiaLast)
		const okMidiaFirst = filterMidiaFirst.length === 0 || filterMidiaFirst.includes(midiaFirst)
		const okMidiaLead = filterMidiaLead.length === 0 || filterMidiaLead.includes(midiaLead)
		
		// Filtros adicionais
		const okStatus = filterStatus.length === 0 || filterStatus.includes(status)
		
		// Pesquisa por ID ou nome
		const searchLower = searchTerm.toLowerCase().trim()
		const okSearch = !searchTerm || 
			idTransacao.toLowerCase().includes(searchLower) ||
			primeiroNome.toLowerCase().includes(searchLower)
		
		return okLast && okFirst && okLead && 
			   okOrigemLast && okOrigemFirst && okOrigemLead &&
			   okMidiaLast && okMidiaFirst && okMidiaLead &&
			   okStatus && okSearch
	})

	// Calcular resumo dos dados
	const calculateSummary = () => {
		const data = filteredOrders.length > 0 ? filteredOrders : orders
		
		const totalRevenue = data.reduce((sum, order) => sum + (order.Receita || 0), 0)
		const paidOrders = data.filter(order => order.Status === 'paid').length
		const pendingOrders = data.filter(order => order.Status === 'pending').length
		const cancelledOrders = data.filter(order => order.Status === 'cancelled').length
		
		return {
			totalOrders: data.length,
			totalRevenue,
			paidOrders,
			pendingOrders,
			cancelledOrders,
			averageOrderValue: data.length > 0 ? totalRevenue / data.length : 0
		}
	}

	const summary = calculateSummary()

	const TableBlock = (
		<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
			<table className="w-full">
					<thead className="bg-gray-50 sticky top-0 z-10">
						<tr>
							<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Detalhes</th>
							<th title="ID_da_Transacao" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID da Transação</th>
							<th title="Horario" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Horário</th>
							<th title="Primeiro_Nome" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Primeiro Nome</th>
							<th title="Status" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
							<th title="Receita" className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Receita</th>
							<th title="Categoria_de_Trafico" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoria de Tráfego</th>
							<th title="Categoria_de_Trafico_Primeiro_Clique" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoria de Tráfego (1º Clique)</th>
							<th title="Categoria_de_Trafico_Primeiro_Lead" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoria de Tráfego (1º Lead)</th>
						</tr>
					</thead>
					<tbody className="bg-white divide-y divide-gray-200">
						{filteredOrders.map((order, idx) => {
							const id = order.ID_da_Transacao || String(idx)
							const isOpen = expanded.has(id)
							return (
								<>
									<tr key={id} className="hover:bg-gray-50 cursor-pointer transition-colors odd:bg-white even:bg-gray-50/40">
										<td className="px-6 py-4 whitespace-nowrap">
											<button onClick={() => toggleExpand(id)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
												{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
												<span>{isOpen ? 'Ocultar' : 'Detalhes'}</span>
											</button>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
											<div className="flex items-center gap-2">
												<Package className="w-4 h-4 text-gray-500" />
												<span className="font-medium">{display(order.ID_da_Transacao)}</span>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(order.Horario)}</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
											<div className="flex items-center gap-1"><User className="w-4 h-4" />{display(order.Primeiro_Nome)}</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<span className={`px-2 py-0.5 rounded-full text-xs ${getStatusClasses(order.Status)}`}>{display(order.Status)}</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">{formatCurrency(order.Receita)}</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">{display(order.Categoria_de_Trafico)}</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">{display(order.Categoria_de_Trafico_Primeiro_Clique)}</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">{display(order.Categoria_de_Trafico_Primeiro_Lead)}</span>
										</td>
									</tr>

									{isOpen && (
										<tr>
											<td colSpan={9} className="px-6 pb-6 pt-2 bg-gray-50">
												<div className="space-y-3">
													{/* Resumo do pedido */}
													<div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
														<div className="text-sm text-gray-700">
															<span className="font-medium text-gray-900">{display(order.ID_da_Transacao)}</span>
															<span className="mx-2 text-gray-300">•</span>
															<span>{formatDateTime(order.Horario)}</span>
														</div>
														<div className="flex items-center gap-2">
															<span className={`px-2 py-0.5 rounded-full text-xs ${getStatusClasses(order.Status)}`}>{display(order.Status)}</span>
															<span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">{formatCurrency(order.Receita)}</span>
														</div>
													</div>

													<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
														{/* Último Clique (atribuição atual) */}
														<div className="border border-blue-100 rounded-lg bg-white p-4 shadow-sm">
															<h4 className="text-sm font-semibold text-blue-700 mb-2">Último Clique Não Direto</h4>
															<div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
																<div><span className="text-gray-500">Categoria de Tráfego:</span> <span className="font-medium">{display(order.Categoria_de_Trafico)}</span></div>
																<div><span className="text-gray-500">Origem:</span> <span className="font-medium">{display(order.Origem)}</span></div>
																<div><span className="text-gray-500">Mídia:</span> <span className="font-medium">{display(order.Midia)}</span></div>
																<div><span className="text-gray-500">Canal:</span> <span className="font-medium">{display(order.Canal)}</span></div>
																<div className="break-words"><span className="text-gray-500">Campanha:</span> <span className="font-medium">{display(order.Campanha)}</span></div>
																<div className="break-words"><span className="text-gray-500">Conteúdo:</span> <span className="font-medium">{display(order.Conteudo)}</span></div>
																<div className="break-words">
																	<span className="text-gray-500">Página de Entrada:</span> {display(order.Pagina_de_Entrada) !== 'Não informado' ? (
																		<a href={order.Pagina_de_Entrada} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1 truncate inline-block max-w-full align-bottom" title={order.Pagina_de_Entrada}>{order.Pagina_de_Entrada}</a>
																	) : <span className="font-medium">Não informado</span>}
																</div>
																{order.Parametros_de_URL && order.Parametros_de_URL !== '(not set)' && (
																	<div className="text-xs break-all"><span className="text-gray-500">Parâmetros de URL:</span> <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[11px] text-gray-700">{order.Parametros_de_URL}</span></div>
																)}
															</div>
														</div>

														{/* Primeiro Clique */}
														<div className="border border-green-100 rounded-lg bg-white p-4 shadow-sm">
															<h4 className="text-sm font-semibold text-green-700 mb-2">Primeiro Clique</h4>
															<div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
																<div><span className="text-gray-500">Categoria de Tráfego:</span> <span className="font-medium">{display(order.Categoria_de_Trafico_Primeiro_Clique)}</span></div>
																<div><span className="text-gray-500">Origem:</span> <span className="font-medium">{display(order.Origem_Primeiro_Clique)}</span></div>
																<div><span className="text-gray-500">Mídia:</span> <span className="font-medium">{display(order.Midia_Primeiro_Clique)}</span></div>
																<div className="break-words"><span className="text-gray-500">Campanha:</span> <span className="font-medium">{display(order.Campanha_Primeiro_Clique)}</span></div>
																<div className="break-words"><span className="text-gray-500">Conteúdo:</span> <span className="font-medium">{display(order.Conteudo_Primeiro_Clique)}</span></div>
																<div className="break-words">
																	<span className="text-gray-500">Página de Entrada:</span> {display(order.Pagina_de_Entrada_Primeiro_Clique) !== 'Não informado' ? (
																		<a href={order.Pagina_de_Entrada_Primeiro_Clique} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline ml-1 truncate inline-block max-w-full align-bottom" title={order.Pagina_de_Entrada_Primeiro_Clique}>{order.Pagina_de_Entrada_Primeiro_Clique}</a>
																	) : <span className="font-medium">Não informado</span>}
																</div>
																{order.Parametros_de_URL_Primeiro_Clique && order.Parametros_de_URL_Primeiro_Clique !== '(not set)' && (
																	<div className="text-xs break-all"><span className="text-gray-500">Parâmetros de URL (1º Clique):</span> <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[11px] text-gray-700">{order.Parametros_de_URL_Primeiro_Clique}</span></div>
																)}
															</div>
														</div>

														{/* Primeiro Lead */}
														<div className="border border-purple-100 rounded-lg bg-white p-4 shadow-sm">
															<h4 className="text-sm font-semibold text-purple-700 mb-2">Primeiro Lead</h4>
															<div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
																<div><span className="text-gray-500">Categoria de Tráfego:</span> <span className="font-medium">{display(order.Categoria_de_Trafico_Primeiro_Lead)}</span></div>
																<div><span className="text-gray-500">Origem:</span> <span className="font-medium">{display(order.Origem_Primeiro_Lead)}</span></div>
																<div><span className="text-gray-500">Mídia:</span> <span className="font-medium">{display(order.Midia_Primeiro_Lead)}</span></div>
																<div className="break-words"><span className="text-gray-500">Campanha:</span> <span className="font-medium">{display(order.Campanha_Primeiro_Lead)}</span></div>
																<div className="break-words"><span className="text-gray-500">Conteúdo:</span> <span className="font-medium">{display(order.Conteudo_Primeiro_Lead)}</span></div>
																<div className="break-words">
																	<span className="text-gray-500">Página de Entrada:</span> {display(order.Pagina_de_Entrada_Primeiro_Lead) !== 'Não informado' ? (
																		<a href={order.Pagina_de_Entrada_Primeiro_Lead} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline ml-1 truncate inline-block max-w-full align-bottom" title={order.Pagina_de_Entrada_Primeiro_Lead}>{order.Pagina_de_Entrada_Primeiro_Lead}</a>
																	) : <span className="font-medium">Não informado</span>}
																</div>
																<div className="text-xs break-all"><span className="text-gray-500">Parâmetros de URL (1º Lead):</span> <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[11px] text-gray-700">{display(order.Parametros_de_URL_Primeiro_Lead)}</span></div>
															</div>
														</div>
													</div>
												</div>
											</td>
										</tr>
									)}
								</>
							)
						})}
					</tbody>
			</table>
			
			{/* Indicador de carregamento de mais pedidos */}
			{isLoadingMore && (
				<div className="bg-blue-50 border-t border-blue-200 px-6 py-4">
					<div className="flex items-center justify-center gap-3 text-blue-700">
						<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
						<span className="text-sm font-medium">
							{retryCount > 0 ? `Tentativa ${retryCount}/3 - Carregando mais pedidos...` : 'Carregando mais pedidos...'}
						</span>
					</div>
				</div>
			)}
			
			{/* Resumo de carregamento */}
			{!isLoading && !isLoadingMore && totalRows > 0 && (
				<div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
					<div className="flex items-center justify-between text-sm text-gray-600">
						<span>Total de pedidos: <strong>{orders.length}</strong> de <strong>{totalRows}</strong></span>
						{orders.length < totalRows && (
							<span className="text-blue-600">Todos os pedidos foram carregados automaticamente</span>
						)}
					</div>
				</div>
			)}
		</div>
	)

	return (
		<div className="p-4 sm:p-6 lg:p-8">
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<div className="p-2 bg-blue-100 rounded-lg">
						<ShoppingBag className="w-5 h-5 text-blue-600" />
					</div>
					<div>
						<h2 className="text-xl font-semibold text-gray-900">Pedidos</h2>
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

			{/* Status de Loading */}
			{isLoading && (
				<div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
					<div className="flex items-center justify-center gap-3">
						<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
						<div className="text-center">
							<p className="text-sm font-medium text-gray-900">Carregando pedidos...</p>
							{retryCount > 0 && (
								<p className="text-xs text-orange-600 mt-1">
									Tentativa {retryCount} de 3
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Status de Loading Mais Pedidos */}
			{isLoadingMore && (
				<div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-4">
					<div className="flex items-center justify-center gap-3">
						<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
						<div className="text-center">
							<p className="text-sm font-medium text-blue-900">Carregando mais pedidos...</p>
							<p className="text-xs text-blue-600 mt-1">
								{orders.length} pedidos carregados até agora
							</p>
							{totalRows > 0 && (
								<p className="text-xs text-blue-500 mt-1">
									Buscando todos os pedidos disponíveis...
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Resumo dos Dados */}
			{isInitialLoadComplete && orders.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
					{/* Total de Pedidos */}
					<div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600">Total de Pedidos</p>
								<p className="text-2xl font-bold text-gray-900">{summary.totalOrders.toLocaleString()}</p>
								{filteredOrders.length !== orders.length && (
									<p className="text-xs text-blue-600 mt-1">
										{filteredOrders.length} filtrados
									</p>
								)}
							</div>
							<div className="p-3 bg-blue-100 rounded-lg">
								<ShoppingBag className="w-6 h-6 text-blue-600" />
							</div>
						</div>
					</div>

					{/* Receita Total */}
					<div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600">Receita Total</p>
								<p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalRevenue)}</p>
								<p className="text-xs text-gray-500 mt-1">
									Ticket médio: {formatCurrency(summary.averageOrderValue)}
								</p>
							</div>
							<div className="p-3 bg-green-100 rounded-lg">
								<DollarSign className="w-6 h-6 text-green-600" />
							</div>
						</div>
					</div>

					{/* Status dos Pedidos */}
					<div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600">Status</p>
								<div className="flex gap-2 mt-1">
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
										{summary.paidOrders} pagos
									</span>
									{summary.pendingOrders > 0 && (
										<span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
											{summary.pendingOrders} pendentes
										</span>
									)}
									{summary.cancelledOrders > 0 && (
										<span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
											{summary.cancelledOrders} cancelados
										</span>
									)}
								</div>
							</div>
							<div className="p-3 bg-orange-100 rounded-lg">
								<TrendingUp className="w-6 h-6 text-orange-600" />
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Filtros e Pesquisa */}
			<div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 space-y-6">
				{/* Pesquisa e Controles */}
				<div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
					<div className="flex-1">
						<label className="text-sm text-gray-700">
							<span className="block mb-2 font-semibold text-gray-900">🔍 Pesquisar por ID ou Nome</span>
							<input 
								type="text" 
								value={searchTerm} 
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Digite ID da transação ou nome do cliente..."
								className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</label>
					</div>
					<div className="flex gap-2">
						<button
							onClick={() => setFiltersExpanded(!filtersExpanded)}
							className={`px-4 py-3 text-sm border rounded-lg transition-colors flex items-center gap-2 ${
								hasActiveFilters
									? 'text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100'
									: 'text-gray-600 border-gray-300 bg-white hover:bg-gray-50 hover:text-gray-800'
							}`}
						>
							<Filter className="w-4 h-4" />
							{filtersExpanded ? 'Ocultar Filtros' : 'Mostrar Filtros'}
							{filtersExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
							{!filtersExpanded && hasActiveFilters && (
								<span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
									{getActiveFiltersCount()}
								</span>
							)}
						</button>
						<button
							onClick={() => {
								setSearchTerm('')
								setFilterLast([])
								setFilterFirst([])
								setFilterLead([])
								setFilterStatus([])
								setFilterOrigemLast([])
								setFilterOrigemFirst([])
								setFilterOrigemLead([])
								setFilterMidiaLast([])
								setFilterMidiaFirst([])
								setFilterMidiaLead([])
							}}
							className="px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
						>
							Limpar Todos os Filtros
						</button>
					</div>
				</div>

				{/* Filtros por Atribuição */}
				{filtersExpanded && (
					<div className="space-y-4">
						<h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Filtros por Atribuição</h3>
					
						{/* Último Clique */}
						<div className="bg-blue-50 rounded-lg p-4">
							<h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
								<span className="w-2 h-2 bg-blue-500 rounded-full"></span>
								Último Clique (Atribuição Atual)
							</h4>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<MultiSelectDropdown
									label="Categoria de Tráfego"
									options={lastCategories}
									selectedValues={filterLast}
									onToggle={(value) => toggleFilterValue(filterLast, value, setFilterLast)}
								/>
								<MultiSelectDropdown
									label="Origem"
									options={origemLastOptions}
									selectedValues={filterOrigemLast}
									onToggle={(value) => toggleFilterValue(filterOrigemLast, value, setFilterOrigemLast)}
								/>
								<MultiSelectDropdown
									label="Mídia"
									options={midiaLastOptions}
									selectedValues={filterMidiaLast}
									onToggle={(value) => toggleFilterValue(filterMidiaLast, value, setFilterMidiaLast)}
								/>
							</div>
						</div>

						{/* Primeiro Clique */}
						<div className="bg-green-50 rounded-lg p-4">
							<h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
								<span className="w-2 h-2 bg-green-500 rounded-full"></span>
								Primeiro Clique
							</h4>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<MultiSelectDropdown
									label="Categoria de Tráfego"
									options={firstCategories}
									selectedValues={filterFirst}
									onToggle={(value) => toggleFilterValue(filterFirst, value, setFilterFirst)}
								/>
								<MultiSelectDropdown
									label="Origem"
									options={origemFirstOptions}
									selectedValues={filterOrigemFirst}
									onToggle={(value) => toggleFilterValue(filterOrigemFirst, value, setFilterOrigemFirst)}
								/>
								<MultiSelectDropdown
									label="Mídia"
									options={midiaFirstOptions}
									selectedValues={filterMidiaFirst}
									onToggle={(value) => toggleFilterValue(filterMidiaFirst, value, setFilterMidiaFirst)}
								/>
							</div>
						</div>

						{/* Primeiro Lead */}
						<div className="bg-purple-50 rounded-lg p-4">
							<h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
								<span className="w-2 h-2 bg-purple-500 rounded-full"></span>
								Primeiro Lead
							</h4>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<MultiSelectDropdown
									label="Categoria de Tráfego"
									options={leadCategories}
									selectedValues={filterLead}
									onToggle={(value) => toggleFilterValue(filterLead, value, setFilterLead)}
								/>
								<MultiSelectDropdown
									label="Origem"
									options={origemLeadOptions}
									selectedValues={filterOrigemLead}
									onToggle={(value) => toggleFilterValue(filterOrigemLead, value, setFilterOrigemLead)}
								/>
								<MultiSelectDropdown
									label="Mídia"
									options={midiaLeadOptions}
									selectedValues={filterMidiaLead}
									onToggle={(value) => toggleFilterValue(filterMidiaLead, value, setFilterMidiaLead)}
								/>
							</div>
						</div>

						{/* Filtros Gerais */}
						<div className="bg-gray-50 rounded-lg p-4">
							<h4 className="text-sm font-semibold text-gray-800 mb-3">Filtros Gerais</h4>
							<div className="grid grid-cols-1 md:grid-cols-1 gap-3">
								<MultiSelectDropdown
									label="Status do Pedido"
									options={statusOptions}
									selectedValues={filterStatus}
									onToggle={(value) => toggleFilterValue(filterStatus, value, setFilterStatus)}
									className="md:w-1/3"
								/>
							</div>
						</div>
					</div>
				)}

				{/* Contador de resultados */}
				<div className="text-sm text-gray-600 border-t border-gray-200 pt-4 flex items-center justify-between">
					<div>
						Mostrando <strong className="text-gray-900">{filteredOrders.length}</strong> de <strong className="text-gray-900">{orders.length}</strong> pedidos carregados
						{(searchTerm || hasActiveFilters) && (
							<span className="text-blue-600 ml-2 font-medium">(filtrados)</span>
						)}
						{orders.length === 100 && (
							<span className="text-orange-600 ml-2 text-xs">(pode haver mais pedidos)</span>
						)}
					</div>
					{filteredOrders.length !== orders.length && (
						<div className="text-xs text-gray-500">
							{Math.round((filteredOrders.length / orders.length) * 100)}% dos pedidos carregados
						</div>
					)}
				</div>
			</div>

			{error ? (
				<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-red-600">{error}</div>
			) : !isInitialLoadComplete ? (
				<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">
					<div className="flex items-center justify-center gap-3">
						<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
						<span>Carregando pedidos...</span>
					</div>
				</div>
			) : orders.length === 0 ? (
				<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">Nenhum pedido no período.</div>
			) : (
				TableBlock
			)}

			{isFullscreen && (
				<div className="fixed inset-0 z-50 bg-white">
					<div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
						<div className="flex items-center gap-2">
							<ShoppingBag className="w-4 h-4 text-blue-600" />
							<span className="font-semibold">Pedidos (Tela cheia)</span>
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

export default OrdersTab
