import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Database, ArrowRight, Loader2 } from 'lucide-react'
import { useClientList } from '../hooks/useClientList'

interface SpotlightClientSelectorProps {
  currentTable: string
  onTableChange: (table: string) => void
  availableTables?: string[]
  useCSV?: boolean
  hideClientName?: boolean
}

const SpotlightClientSelector = ({ 
  currentTable, 
  onTableChange, 
  availableTables = [], 
  useCSV = true, 
  hideClientName = false 
}: SpotlightClientSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Só executar o hook se useCSV for true
  const { clients, isLoading, error } = useClientList(useCSV)

  // Atalho Command + K para abrir o spotlight
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar se é Command + K (Mac) ou Ctrl + K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setIsOpen(true)
        setSearchTerm('')
        setSelectedIndex(0)
        
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

  // Filtrar tabelas baseado no termo de busca
  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) {
      return tables.slice(0, 8) // Mostrar apenas os primeiros 8 quando não há busca
    }
    
    return tables.filter(table => {
      const tableName = table.toLowerCase()
      const search = searchTerm.toLowerCase()
      return tableName.includes(search)
    }).slice(0, 8) // Limitar a 8 resultados
  }, [tables, searchTerm])

  // Resetar índice selecionado quando a lista muda
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredTables])

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredTables.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredTables.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredTables.length > 0 && filteredTables[selectedIndex]) {
          onTableChange(filteredTables[selectedIndex])
          setIsOpen(false)
          setSearchTerm('')
          setSelectedIndex(0)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchTerm('')
        setSelectedIndex(0)
        break
    }
  }

  // Fechar quando clicar fora
  const handleOverlayClick = () => {
    setIsOpen(false)
    setSearchTerm('')
    setSelectedIndex(0)
  }

  // Mostrar nome do cliente
  const getTableDisplayName = (tableName: string) => {
    if (hideClientName) {
      return 'Cliente Selecionado'
    }
    return tableName
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
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }}
        className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-sm hover:bg-white hover:shadow-md transition-all duration-200 min-w-[200px] group"
        disabled={isActuallyLoading}
        title="Selecionar cliente (⌘K para buscar)"
      >
        <Database className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
        <div className="flex-1 text-left">
          {isActuallyLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              <span className="text-gray-500 text-sm">Carregando...</span>
            </div>
          ) : (
            <div className="font-medium text-gray-900 truncate">
              {getTableDisplayName(currentTable)}
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
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
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-12 pr-4 py-4 text-lg bg-transparent border-none outline-none placeholder-gray-400"
                  autoFocus
                  ref={searchInputRef}
                />
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
              ) : filteredTables.length > 0 ? (
                filteredTables.map((table, index) => (
                  <button
                    key={table}
                    onClick={() => {
                      onTableChange(table)
                      setIsOpen(false)
                      setSearchTerm('')
                      setSelectedIndex(0)
                    }}
                    className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50/50 transition-colors group ${
                      index === selectedIndex ? 'bg-blue-50/50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {table.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {getTableDisplayName(table)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Cliente
                      </div>
                    </div>
                    <ArrowRight className={`w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors ${
                      index === selectedIndex ? 'text-blue-500' : ''
                    }`} />
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <div className="font-medium">
                    {tables.length === 0 ? 'Nenhum cliente disponível' : 'Nenhum cliente encontrado'}
                  </div>
                  <div className="text-sm mt-1">
                    {searchTerm ? `Tente buscar por "${searchTerm}"` : 'Digite para buscar clientes'}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer com dicas */}
            <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 text-center">
              <div className="flex items-center justify-center gap-4">
                <span>↑↓ Navegar</span>
                <span>•</span>
                <span>Enter Selecionar</span>
                <span>•</span>
                <span>Esc Fechar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SpotlightClientSelector
