import { useState, useMemo } from 'react'
import { Database, Search, X } from 'lucide-react'

interface TableSelectorProps {
  currentTable: string
  onTableChange: (table: string) => void
  availableTables?: string[]
}

const TableSelector = ({ currentTable, onTableChange, availableTables = [] }: TableSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Tabelas padrão se não houver disponíveis
  const tables = availableTables.length > 0 ? availableTables : [
    '3dfila',
    'gringa',
    'orthocrin',
    'meurodape',
    'coffeemais',
    'universomaschio',
    'oculosshop',
    'evoke',
    'hotbuttered',
    'use',
    'wtennis',
    'constance',
    'jcdecor',
    'parededepapel',
    'bemcolar',
    'poesiamuda',
    'caramujo',
    'europa',
    'leveros',
    'abcdaconstrucao',
    'kaisan',
    'endogen',
    'bocarosa',
    'mymetric',
    'buildgrowth',
    'alvisi',
    'coroasparavelorio',
    'coroinhasportoalegre',
    'coroinhasbrasilia',
    'coroinhascampinas',
    'coroinhascuritiba',
    'coroinhasbelohorizonte',
    'coroinhasgoiania',
    'coroinhasrecife',
    'coroinhasriodejaneiro',
    'coroinhassaopaulo',
    'lacoscorporativos',
    'exitlag',
    'havaianas',
    'linus',
    'iwannasleep',
    'asos',
    'safeweb',
    'queimadiaria',
    'augym',
    'waz'
  ]

  const getTableDisplayName = (tableName: string) => {
    const displayNames: { [key: string]: string } = {
      '3dfila': '3DFila',
      'gringa': 'Gringa',
      'orthocrin': 'Orthocrin',
      'meurodape': 'Meu Roda Pé',
      'coffeemais': 'CoffeeMais',
      'universomaschio': 'Universo Maschio',
      'oculosshop': 'Óculos Shop',
      'evoke': 'Evoke',
      'hotbuttered': 'Hot Buttered',
      'use': 'Use',
      'wtennis': 'WTennis',
      'constance': 'Constance',
      'jcdecor': 'JC Decor',
      'parededepapel': 'Parede de Papel',
      'bemcolar': 'Bem Colar',
      'poesiamuda': 'Poesia Muda',
      'caramujo': 'Caramujo',
      'europa': 'Europa',
      'leveros': 'Leveros',
      'abcdaconstrucao': 'ABCDA Construção',
      'kaisan': 'Kaisan',
      'endogen': 'Endogen',
      'bocarosa': 'Bocarosa',
      'mymetric': 'MyMetric',
      'buildgrowth': 'Build Growth',
      'alvisi': 'Alvisi',
      'coroasparavelorio': 'Coroas Para Velório',
      'coroinhasportoalegre': 'Coroinhas Porto Alegre',
      'coroinhasbrasilia': 'Coroinhas Brasília',
      'coroinhascampinas': 'Coroinhas Campinas',
      'coroinhascuritiba': 'Coroinhas Curitiba',
      'coroinhasbelohorizonte': 'Coroinhas Belo Horizonte',
      'coroinhasgoiania': 'Coroinhas Goiânia',
      'coroinhasrecife': 'Coroinhas Recife',
      'coroinhasriodejaneiro': 'Coroinhas Rio de Janeiro',
      'coroinhassaopaulo': 'Coroinhas São Paulo',
      'lacoscorporativos': 'Laços Corporativos',
      'exitlag': 'ExitLag',
      'havaianas': 'Havaianas',
      'linus': 'Linus',
      'iwannasleep': 'I Wanna Sleep',
      'asos': 'ASOS',
      'safeweb': 'SafeWeb',
      'queimadiaria': 'Queima Diária',
      'augym': 'AuGym',
      'waz': 'Waz'
    }
    return displayNames[tableName] || tableName
  }

  const getTableDescription = (tableName: string) => {
    const descriptions: { [key: string]: string } = {
      '3dfila': '',
      'gringa': '',
      'orthocrin': '',
      'meurodape': '',
      'coffeemais': '',
      'universomaschio': '',
      'oculosshop': '',
      'evoke': '',
      'hotbuttered': '',
      'use': '',
      'wtennis': '',
      'constance': '',
      'jcdecor': '',
      'parededepapel': '',
      'bemcolar': '',
      'poesiamuda': '',
      'caramujo': '',
      'europa': '',
      'leveros': '',
      'abcdaconstrucao': '',
      'kaisan': '',
      'endogen': '',
      'bocarosa': '',
      'mymetric': '',
      'buildgrowth': '',
      'alvisi': '',
      'coroasparavelorio': '',
      'coroinhasportoalegre': '',
      'coroinhasbrasilia': '',
      'coroinhascampinas': '',
      'coroinhascuritiba': '',
      'coroinhasbelohorizonte': '',
      'coroinhasgoiania': '',
      'coroinhasrecife': '',
      'coroinhasriodejaneiro': '',
      'coroinhassaopaulo': '',
      'lacoscorporativos': '',
      'exitlag': '',
      'havaianas': '',
      'linus': '',
      'iwannasleep': '',
      'asos': '',
      'safeweb': '',
      'queimadiaria': '',
      'augym': '',
      'waz': ''
    }
    return descriptions[tableName] || ''
  }

  // Filtrar tabelas baseado no termo de busca
  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) {
      return tables.slice(0, 10) // Mostrar apenas os primeiros 10 quando não há busca
    }
    
    return tables.filter(table => {
      const displayName = getTableDisplayName(table).toLowerCase()
      const tableName = table.toLowerCase()
      const search = searchTerm.toLowerCase()
      
      return displayName.includes(search) || tableName.includes(search)
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
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <Database className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="text-left min-w-0 flex-1">
            <div className="font-medium text-gray-900 truncate">{getTableDisplayName(currentTable)}</div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl sm:shadow-2xl max-h-80 overflow-hidden">
          {/* Campo de busca */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
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
            {filteredTables.length > 0 ? (
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
                Nenhum cliente encontrado
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