import { ChevronUp, ChevronDown } from 'lucide-react'

interface SortableHeaderProps {
  field: string
  currentSortField: string
  currentSortDirection: 'asc' | 'desc'
  onSort: (field: string) => void
  children: React.ReactNode
  className?: string
}

const SortableHeader = ({ 
  field, 
  currentSortField, 
  currentSortDirection, 
  onSort, 
  children, 
  className = '' 
}: SortableHeaderProps) => {
  const isActive = currentSortField === field

  return (
    <th 
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        <div className="flex flex-col">
          <ChevronUp 
            className={`w-3 h-3 ${isActive && currentSortDirection === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} 
          />
          <ChevronDown 
            className={`w-3 h-3 ${isActive && currentSortDirection === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} 
          />
        </div>
      </div>
    </th>
  )
}

export default SortableHeader 