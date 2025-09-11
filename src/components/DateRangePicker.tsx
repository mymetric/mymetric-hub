import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, X, CalendarDays, Clock } from 'lucide-react'
import { getDatePresets, validateDateRange, getTodayString } from '../utils/dateUtils'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onDateRangeChange: (startDate: string, endDate: string) => void
}

const DateRangePicker = ({ startDate, endDate, onDateRangeChange }: DateRangePickerProps) => {
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


  const formatDisplayDate = (dateString: string) => {
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
    if (validateDates(value, localEndDate)) {
      onDateRangeChange(value, localEndDate)
      // Fechar dropdown após seleção se ambas as datas estão preenchidas
      if (value && localEndDate) {
        setIsOpen(false)
      }
    }
  }

  const handleEndDateChange = (value: string) => {
    setLocalEndDate(value)
    if (validateDates(localStartDate, value)) {
      onDateRangeChange(localStartDate, value)
      // Fechar dropdown após seleção se ambas as datas estão preenchidas
      if (localStartDate && value) {
        setIsOpen(false)
      }
    }
  }

  const handleQuickSelect = (preset: string) => {
    const presets = getDatePresets()
    const selectedPreset = presets[preset as keyof typeof presets]
    
    if (!selectedPreset) return

    setLocalStartDate(selectedPreset.start)
    setLocalEndDate(selectedPreset.end)
    onDateRangeChange(selectedPreset.start, selectedPreset.end)
    setIsOpen(false)
  }

  const clearSelection = () => {
    setLocalStartDate('')
    setLocalEndDate('')
    setErrors({})
    onDateRangeChange('', '')
  }

  const hasErrors = Object.keys(errors).length > 0
  const hasSelection = localStartDate && localEndDate

  const presets = [
    { key: 'today', label: 'Hoje', icon: CalendarDays },
    { key: 'yesterday', label: 'Ontem', icon: Clock },
    { key: 'last7days', label: 'Últimos 7 dias', icon: Calendar },
    { key: 'last30days', label: 'Últimos 30 dias', icon: Calendar },
    { key: 'last90days', label: 'Últimos 90 dias', icon: Calendar },
    { key: 'thisWeek', label: 'Esta semana', icon: Calendar },
    { key: 'thisMonth', label: 'Este mês', icon: Calendar },
    { key: 'lastMonth', label: 'Mês passado', icon: Calendar },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Período
      </label>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors min-w-0 ${
          hasErrors ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className={`w-4 h-4 flex-shrink-0 ${hasErrors ? 'text-red-500' : 'text-gray-500'}`} />
          <span className={`truncate ${hasErrors ? 'text-red-700' : 'text-gray-900'}`}>
            {hasSelection 
              ? `${formatDisplayDate(localStartDate)} - ${formatDisplayDate(localEndDate)}`
              : 'Selecionar período'
            }
          </span>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSelection && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearSelection()
              }}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Limpar seleção"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl p-4 min-w-[320px] max-w-[400px] left-0 md:left-auto md:right-0">
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={localStartDate || ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  max={getTodayString()}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
              onClick={() => setIsOpen(false)}
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

export default DateRangePicker