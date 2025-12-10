import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Database, BarChart3, TrendingUp, Filter, Truck, ShoppingCart, Activity, Package, Target, Settings, ArrowRight, Loader2, MessageSquare } from 'lucide-react'
import { useClientList } from '../hooks/useClientList'

interface SpotlightUnifiedProps {
  currentTable: string
  onTableChange: (table: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
  availableTables?: string[]
  useCSV?: boolean
  hideClientName?: boolean
  user?: any
  autoOpen?: boolean
}

type SpotlightCategory = 'clients' | 'tabs'

interface SpotlightItem {
  id: string
  label: string
  description: string
  icon: any
  category: SpotlightCategory
  action: () => void
}

const SpotlightUnified = ({ 
  currentTable, 
  onTableChange, 
  activeTab,
  onTabChange,
  availableTables = [], 
  useCSV = true, 
  hideClientName = false,
  user,
  autoOpen = false
}: SpotlightUnifiedProps) => {
  console.log('🎨 SpotlightUnified renderizado com autoOpen:', autoOpen)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<SpotlightCategory>('clients')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasAutoOpenedRef = useRef(false)
  
  // Só executar o hook se useCSV for true
  const { clients, isLoading, error } = useClientList(useCSV)

  // Abrir automaticamente se autoOpen for true (apenas uma vez)
  useEffect(() => {
    if (autoOpen && !hasAutoOpenedRef.current && !isOpen) {
      console.log('🚀 SpotlightUnified: autoOpen é true, abrindo spotlight...', { isOpen, autoOpen })
      hasAutoOpenedRef.current = true
      
      // Usar um delay para garantir que o componente está totalmente renderizado
      const timer = setTimeout(() => {
        console.log('🎯 Abrindo spotlight agora')
        setIsOpen(true)
        setSearchTerm('')
        setSelectedIndex(0)
        setSelectedCategory('clients')
        
        // Focar no campo de busca após um pequeno delay adicional
        setTimeout(() => {
          searchInputRef.current?.focus()
          console.log('✅ Spotlight aberto e focado')
        }, 200)
      }, 600)
      
      return () => clearTimeout(timer)
    }
  }, [autoOpen, isOpen])

  // Atalho Command + K para abrir o spotlight
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar se é Command + K (Mac) ou Ctrl + K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setIsOpen(true)
        setSearchTerm('')
        setSelectedIndex(0)
        setSelectedCategory('clients')
        
        // Focar no campo de busca após um pequeno delay
        setTimeout(() => {
          searchInputRef.current?.focus()
        }, 100)
      }
      
      // Fechar com Escape
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault()
        setIsOpen(false)
        setSearchTerm('')
        setSelectedIndex(0)
        setSelectedCategory('clients')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Usar clientes do CSV ou fallback para availableTables
  const tables = useMemo(() => {
    if (!useCSV) {
      return availableTables.length > 0 ? availableTables : []
    }
    
    if (clients.length > 0) {
      return clients
    }
    if (availableTables.length > 0) {
      return availableTables
    }
    return []
  }, [clients, availableTables, useCSV])

  // Configuração das abas disponíveis
  const tabConfig = {
    'visao-geral': { label: 'Visão Geral', icon: BarChart3, description: 'Métricas gerais e KPIs' },
    'midia-paga': { label: 'Mídia Paga', icon: TrendingUp, description: 'Análise de campanhas pagas' },
    'funil-conversao': { label: 'Funil de Conversão', icon: Filter, description: 'Jornada do cliente' },
    'dados-detalhados': { label: 'Dados Detalhados', icon: Database, description: 'Dados brutos e análises' },
    'frete': { label: 'Frete', icon: Truck, description: 'Análise de frete e logística' },
    'produtos': { label: 'Produtos', icon: ShoppingCart, description: 'Performance de produtos' },
    'tempo-real': { label: 'Tempo Real', icon: Activity, description: 'Dados em tempo real' },
    'havaianas': { label: 'Product Scoring', icon: Package, description: 'Scoring de produtos (Havaianas)' },
    'funil-whatsapp': { label: 'Funil de Vendas por WhatsApp', icon: MessageSquare, description: 'Funil de conversão por WhatsApp' },
    'ab-testing': { label: 'Testes A/B', icon: Target, description: 'Experimentos e testes' },
    'configuracao': { label: 'Configuração', icon: Settings, description: 'Configurações do sistema' }
  }

  // Abas visíveis baseado no cliente e permissões
  const visibleTabs = [
    'visao-geral',
    'midia-paga', 
    'funil-conversao',
    'dados-detalhados',
    'tempo-real'
  ]

  const submenuTabs = [
    ...(currentTable === 'havaianas' ? ['havaianas'] : []),
    ...(currentTable === 'coroasparavelorio' ? ['funil-whatsapp'] : []),
    'frete',
    'ab-testing',
    'produtos',
    ...(user?.admin ? ['configuracao'] : [])
  ]

  const allTabs = [...visibleTabs, ...submenuTabs]

  // Criar itens do spotlight
  const spotlightItems = useMemo(() => {
    const items: SpotlightItem[] = []

    // Adicionar clientes (apenas se não estiver oculto)
    if (!hideClientName) {
      tables.forEach(table => {
        items.push({
          id: `client-${table}`,
          label: table,
          description: 'Cliente',
          icon: Database,
          category: 'clients',
          action: () => {
            onTableChange(table)
            setIsOpen(false)
            setSearchTerm('')
            setSelectedIndex(0)
          }
        })
      })
    }

    // Adicionar abas (sempre disponíveis)
    allTabs.forEach(tabId => {
      const config = tabConfig[tabId as keyof typeof tabConfig]
      if (config) {
        items.push({
          id: `tab-${tabId}`,
          label: config.label,
          description: config.description,
          icon: config.icon,
          category: 'tabs',
          action: () => {
            onTabChange(tabId)
            setIsOpen(false)
            setSearchTerm('')
            setSelectedIndex(0)
          }
        })
      }
    })

    return items
  }, [tables, allTabs, hideClientName, onTableChange, onTabChange])

  // Filtrar itens baseado no termo de busca
  const filteredItems = useMemo(() => {
    let items = spotlightItems

    // Se há termo de busca, buscar em todas as categorias
    if (searchTerm.trim()) {
      items = items.filter(item => {
        const search = searchTerm.toLowerCase()
        return item.label.toLowerCase().includes(search) || 
               item.description.toLowerCase().includes(search)
      })
    } else {
      // Se não há busca, mostrar apenas a categoria selecionada
      items = items.filter(item => item.category === selectedCategory)
    }

    return items.slice(0, 12) // Aumentar limite para busca global
  }, [spotlightItems, selectedCategory, searchTerm])

  // Efeito para ajustar categoria automaticamente quando não há itens
  useEffect(() => {
    if (!searchTerm.trim() && filteredItems.length === 0) {
      const otherCategory = selectedCategory === 'clients' ? 'tabs' : 'clients'
      const otherItems = spotlightItems.filter(item => item.category === otherCategory)
      if (otherItems.length > 0) {
        setSelectedCategory(otherCategory)
      }
    }
  }, [filteredItems.length, selectedCategory, searchTerm, spotlightItems])

  // Resetar índice selecionado apenas quando a categoria muda ou quando há busca
  useEffect(() => {
    setSelectedIndex(0)
  }, [selectedCategory, searchTerm])

  // Garantir que o índice selecionado seja válido quando a lista muda
  useEffect(() => {
    if (selectedIndex >= filteredItems.length && filteredItems.length > 0) {
      setSelectedIndex(0)
    }
  }, [filteredItems.length, selectedIndex])

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredItems.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => {
          const newIndex = prev < filteredItems.length - 1 ? prev + 1 : 0
          return Math.min(newIndex, filteredItems.length - 1)
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : filteredItems.length - 1
          return Math.max(newIndex, 0)
        })
        break
      case 'Enter':
        e.preventDefault()
        if (filteredItems.length > 0 && filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchTerm('')
        setSelectedIndex(0)
        setSelectedCategory('clients')
        break
      case 'Tab':
        e.preventDefault()
        setSelectedCategory(prev => prev === 'clients' ? 'tabs' : 'clients')
        setSelectedIndex(0)
        break
    }
  }

  // Fechar quando clicar fora
  const handleOverlayClick = () => {
    setIsOpen(false)
    setSearchTerm('')
    setSelectedIndex(0)
    setSelectedCategory('clients')
  }

  const isActuallyLoading = useCSV ? isLoading : false

  return (
    <>
      {/* Botão para abrir o spotlight */}
      <button
        onClick={() => {
          setIsOpen(true)
          setSearchTerm('')
          setSelectedIndex(0)
          setSelectedCategory('clients')
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }}
        className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg shadow-sm hover:bg-white hover:shadow-md transition-all duration-200 min-w-[140px] group"
        disabled={isActuallyLoading}
        title="Spotlight - Clientes e Abas (⌘K)"
      >
        <Search className="w-4 h-4 text-gray-500 group-hover:text-gray-700 transition-colors" />
        <div className="flex-1 text-left">
          {isActuallyLoading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
              <span className="text-gray-500 text-xs">Carregando...</span>
            </div>
          ) : (
            <div className="font-medium text-gray-900 truncate text-sm">
              {hideClientName ? 'Spotlight' : currentTable}
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
          ⌘K
        </div>
      </button>

      {/* Spotlight Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          {/* Overlay com blur */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={handleOverlayClick}
          />
          
          {/* Modal do Spotlight */}
          <div 
            ref={containerRef}
            className="relative w-full max-w-2xl mx-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
          >
            {/* Campo de busca */}
            <div className="p-6 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar em todos os clientes e abas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-12 pr-4 py-4 text-lg bg-transparent border-none outline-none placeholder-gray-400"
                  autoFocus
                  ref={searchInputRef}
                />
              </div>
            </div>

            {/* Categorias */}
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="flex gap-2">
                {/* Botão Clientes - apenas se houver clientes disponíveis */}
                {spotlightItems.some(item => item.category === 'clients') && (
                  <button
                    onClick={() => {
                      setSelectedCategory('clients')
                      setSelectedIndex(0)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === 'clients'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Database className="w-4 h-4 inline mr-2" />
                    Clientes
                  </button>
                )}
                {/* Botão Abas - sempre disponível */}
                <button
                  onClick={() => {
                    setSelectedCategory('tabs')
                    setSelectedIndex(0)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === 'tabs'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 inline mr-2" />
                  Abas
                </button>
                {searchTerm.trim() && (
                  <div className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700">
                    <Search className="w-4 h-4 inline mr-2" />
                    Busca Global
                  </div>
                )}
              </div>
            </div>
            
            {/* Lista de resultados */}
            <div className="max-h-80 overflow-y-auto">
              {isActuallyLoading ? (
                <div className="p-8 text-center">
                  <div className="flex items-center justify-center gap-3 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Carregando clientes...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="p-8 text-center text-red-500">
                  <div className="font-medium">Erro ao carregar clientes</div>
                  <div className="text-sm text-gray-500 mt-1">{error}</div>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item, index) => {
                  const IconComponent = item.icon
                  const isSelected = index === selectedIndex
                  
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50/50 transition-colors group ${
                        isSelected ? 'bg-blue-100 border-r-4 border-blue-500 shadow-sm' : ''
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm ${
                        item.category === 'clients' 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                          : 'bg-gradient-to-br from-green-500 to-teal-600'
                      }`}>
                        {item.category === 'clients' 
                          ? item.label.charAt(0).toUpperCase()
                          : <IconComponent className="w-5 h-5" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {item.label}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <span>{item.description}</span>
                          {searchTerm.trim() && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.category === 'clients' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {item.category === 'clients' ? 'Cliente' : 'Aba'}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className={`w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors ${
                        isSelected ? 'text-blue-500' : ''
                      }`} />
                    </button>
                  )
                })
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <div className="font-medium">
                    {spotlightItems.length === 0 ? 'Nenhum item disponível' : 'Nenhum item encontrado'}
                  </div>
                  <div className="text-sm mt-1">
                    {searchTerm ? `Tente buscar por "${searchTerm}"` : 'Digite para buscar'}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer com dicas */}
            <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 text-center">
              <div className="flex items-center justify-center gap-4">
                <span>↑↓ Navegar</span>
                <span>•</span>
                <span>Tab Alternar</span>
                <span>•</span>
                <span>Enter Selecionar</span>
                <span>•</span>
                <span>Esc Fechar</span>
                {!searchTerm.trim() && (
                  <>
                    <span>•</span>
                    <span>Digite para busca global</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SpotlightUnified
