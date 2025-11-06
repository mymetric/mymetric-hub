import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, X, CalendarDays, Clock } from 'lucide-react'
import { getDatePresets, validateDateRange, getTodayString } from '../utils/dateUtils'

interface DateRangeSelectorProps {
  onDateRangeChange: (startDate: string, endDate: string) => void
  startDate: string
  endDate: string
}

const DateRangeSelector = ({ onDateRangeChange, startDate, endDate }: DateRangeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localStartDate, setLocalStartDate] = useState(startDate)
  const [localEndDate, setLocalEndDate] = useState(endDate)
  const [errors, setErrors] = useState<{start?: string, end?: string}>({})
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Forçar sincronização imediata quando as props mudarem
  useEffect(() => {
    setLocalStartDate(startDate)
    setLocalEndDate(endDate)
  }, [startDate, endDate])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    // Criar data de forma mais segura para evitar problemas de timezone
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const validateDates = (start: string, end: string) => {
    const validation = validateDateRange(start, end)
    setErrors(validation.errors)
    return validation.isValid
  }

  const handleStartDateChange = (value: string) => {
    setLocalStartDate(value)
    validateDates(value, localEndDate)
  }

  const handleEndDateChange = (value: string) => {
    setLocalEndDate(value)
    validateDates(localStartDate, value)
  }

  const handleQuickSelect = (preset: string) => {
    const presets = getDatePresets()
    const selectedPreset = presets[preset as keyof typeof presets]
    
    if (!selectedPreset) return

    setLocalStartDate(selectedPreset.start)
    setLocalEndDate(selectedPreset.end)
    validateDates(selectedPreset.start, selectedPreset.end)
  }

  const clearSelection = () => {
    setLocalStartDate('')
    setLocalEndDate('')
    setErrors({})
  }

  const hasErrors = Object.keys(errors).length > 0
  const hasSelection = localStartDate && localEndDate

  const presets = [
    { key: 'today', label: 'Hoje', icon: CalendarDays },
    { key: 'yesterday', label: 'Ontem', icon: Clock },
    { key: 'last7days', label: 'Últimos 7 dias', icon: Calendar },
    { key: 'last30days', label: 'Últimos 30 dias', icon: Calendar },
    { key: 'thisMonth', label: 'Este mês', icon: Calendar },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors ${
          hasErrors ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Calendar className={`w-5 h-5 flex-shrink-0 ${hasErrors ? 'text-red-500' : 'text-gray-500'}`} />
          <div className="text-left min-w-0">
            <div className={`font-medium truncate ${hasErrors ? 'text-red-700' : 'text-gray-900'}`}>
              {hasSelection 
                ? `${formatDate(localStartDate)} - ${formatDate(localEndDate)}`
                : 'Selecionar período'
              }
            </div>
            <div className="text-xs text-gray-500">Clique para alterar</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSelection && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                clearSelection()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  clearSelection()
                }
              }}
              className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              title="Limpar seleção"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Mensagens de erro */}
      {hasErrors && (
        <div className="mt-1 text-xs text-red-600">
          {errors.start && <div>• {errors.start}</div>}
          {errors.end && <div>• {errors.end}</div>}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl p-4 min-w-[320px] left-0 right-0">
          {/* Presets rápidos */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Períodos rápidos</h4>
            <div className="grid grid-cols-2 gap-2">
              {presets.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleQuickSelect(key)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-left bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                >
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs personalizados */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Período personalizado</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={localStartDate || ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  max={getTodayString()}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.start ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data final
                </label>
                <input
                  type="date"
                  value={localEndDate || ''}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  min={localStartDate}
                  max={getTodayString()}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.end ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={clearSelection}
              className="text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              Limpar tudo
            </button>
            
            <button
              onClick={() => {
                const isClearing = !localStartDate && !localEndDate
                const isValid = validateDates(localStartDate, localEndDate)
                if (isClearing || isValid) {
                  onDateRangeChange(localStartDate || '', localEndDate || '')
                  setIsOpen(false)
                }
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangeSelector 