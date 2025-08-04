import { useState } from 'react'
import { Database } from 'lucide-react'

interface TableSelectorProps {
  currentTable: string
  onTableChange: (table: string) => void
  availableTables?: string[]
}

const TableSelector = ({ currentTable, onTableChange, availableTables = [] }: TableSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)

  // Tabelas padrão se não houver disponíveis
  const tables = availableTables.length > 0 ? availableTables : [
    'coffeemais',
    'constance',
    'gringa',
    'bocarosa'
  ]

  const getTableDisplayName = (tableName: string) => {
    const displayNames: { [key: string]: string } = {
      'coffeemais': 'CoffeeMais',
      'constance': 'Constance',
      'gringa': 'Gringa',
      'bocarosa': 'Bocarosa'
    }
    return displayNames[tableName] || tableName
  }

  const getTableDescription = (tableName: string) => {
    const descriptions: { [key: string]: string } = {
      'coffeemais': '',
      'constance': '',
      'gringa': '',
      'bocarosa': ''
    }
    return descriptions[tableName] || ''
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
        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl sm:shadow-2xl">
          <div className="py-1 sm:py-2">
            {tables.map((table) => (
              <button
                key={table}
                onClick={() => {
                  onTableChange(table)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-sm hover:bg-gray-50 transition-colors ${
                  currentTable === table ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                }`}
              >
                <div className="font-medium">{getTableDisplayName(table)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overlay para fechar quando clicar fora */}
      {isOpen && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default TableSelector 