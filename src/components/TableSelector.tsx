import { useState, useMemo, useEffect, useRef } from 'react'
import { Database, Search, X, Loader2 } from 'lucide-react'
import { useClientList } from '../hooks/useClientList'

interface TableSelectorProps {
  currentTable: string
  onTableChange: (table: string) => void
  availableTables?: string[]
  useCSV?: boolean // Nova prop para controlar se deve usar CSV
  hideClientName?: boolean // Prop para ocultar o nome do cliente
}

const TableSelector = ({ currentTable, onTableChange, availableTables = [], useCSV = true, hideClientName = false }: TableSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Só executar o hook se useCSV for true
  const { clients, isLoading, error } = useClientList(useCSV)

  // Atalho Command + K para focar na busca
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar se é Command + K (Mac) ou Ctrl + K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        
        // Abrir dropdown se não estiver aberto
        if (!isOpen) {
          setIsOpen(true)
        }
        
        // Focar no campo de busca após um pequeno delay para garantir que o dropdown está aberto
        setTimeout(() => {
          searchInputRef.current?.focus()
        }, 100)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Usar clientes do CSV ou fallback para availableTables ou lista padrão
  const tables = useMemo(() => {
    // Se não deve usar CSV, usar apenas availableTables
    if (!useCSV) {
      return availableTables.length > 0 ? availableTables : []
    }
    
    // Se deve usar CSV, seguir a lógica normal
    if (clients.length > 0) {
      return clients
    }
    if (availableTables.length > 0) {
      return availableTables
    }
    // Em caso de erro no CSV, retornar array vazio
    return []
  }, [clients, availableTables, useCSV])

  // Determinar se está carregando baseado no useCSV
  const isActuallyLoading = useCSV ? isLoading : false

  // Mostrar apenas o slug (sem nomes amigáveis)
  const getTableDisplayName = (tableName: string) => {
    if (hideClientName) {
      return 'Cliente Selecionado'
    }
    return tableName
  }

  // Filtrar tabelas baseado no termo de busca
  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) {
      return tables.slice(0, 10) // Mostrar apenas os primeiros 10 quando não há busca
    }
    
    return tables.filter(table => {
      const tableName = table.toLowerCase()
      const search = searchTerm.toLowerCase()
      
      return tableName.includes(search)
    })
  }, [tables, searchTerm])

  // Limpar busca quando fechar o dropdown
  const handleCloseDropdown = () => {
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-2 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-white hover:bg-gray-50 transition-colors min-w-[120px] sm:min-w-[200px]"
        disabled={isActuallyLoading}
        title="Selecionar cliente (⌘K para buscar)"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <Database className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="text-left min-w-0 flex-1">
            {isActuallyLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-gray-500">Carregando...</span>
              </div>
            ) : (
              <div className="font-medium text-gray-900 truncate">{getTableDisplayName(currentTable)}</div>
            )}
          </div>
        </div>
        {!isActuallyLoading && (
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl sm:shadow-2xl max-h-80 overflow-hidden">
          {/* Campo de busca */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente... (Enter para selecionar o primeiro)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredTables.length > 0) {
                    e.preventDefault()
                    // Selecionar o primeiro cliente da lista filtrada
                    onTableChange(filteredTables[0])
                    handleCloseDropdown()
                  }
                }}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
                ref={searchInputRef}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Lista de tabelas */}
          <div className="py-1 sm:py-2 max-h-60 overflow-y-auto">
            {searchTerm && filteredTables.length > 0 && (
              <div className="px-3 sm:px-4 py-1 text-xs text-gray-500 text-center border-b border-gray-100">
                Pressione Enter para selecionar "{filteredTables[0]}"
              </div>
            )}
            {isActuallyLoading ? (
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-gray-500 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Carregando clientes...</span>
                </div>
              </div>
            ) : error ? (
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-red-500 text-center">
                <div className="text-red-500">Erro ao carregar clientes</div>
                <div className="text-xs text-gray-500 mt-1">{error}</div>
              </div>
            ) : filteredTables.length > 0 ? (
              filteredTables.map((table) => (
                <button
                  key={table}
                  onClick={() => {
                    onTableChange(table)
                    handleCloseDropdown()
                  }}
                  className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-sm hover:bg-gray-50 transition-colors ${
                    currentTable === table ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <div className="font-medium">{getTableDisplayName(table)}</div>
                </button>
              ))
            ) : (
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-gray-500 text-center">
                {tables.length === 0 ? 'Nenhum cliente disponível' : 'Nenhum cliente encontrado'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay para fechar quando clicar fora */}
      {isOpen && (
        <div
          className="fixed inset-0 z-5"
          onClick={handleCloseDropdown}
        />
      )}
    </div>
  )
}

export default TableSelector 