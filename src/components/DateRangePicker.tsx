import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onDateRangeChange: (startDate: string, endDate: string) => void
}

const DateRangePicker = ({ startDate, endDate, onDateRangeChange }: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(startDate ? new Date(startDate) : null)
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(endDate ? new Date(endDate) : null)
  const [isSelectingEnd, setIsSelectingEnd] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Adicionar dias vazios do início
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Adicionar dias do mês
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate || !selectedEndDate) return false
    return date >= selectedStartDate && date <= selectedEndDate
  }

  const isDateSelected = (date: Date) => {
    if (selectedStartDate && formatDate(date) === formatDate(selectedStartDate)) return 'start'
    if (selectedEndDate && formatDate(date) === formatDate(selectedEndDate)) return 'end'
    return false
  }

  const handleDateClick = (date: Date) => {
    if (!isSelectingEnd) {
      setSelectedStartDate(date)
      setSelectedEndDate(null)
      setIsSelectingEnd(true)
    } else {
      if (date >= selectedStartDate!) {
        setSelectedEndDate(date)
        setIsSelectingEnd(false)
        onDateRangeChange(formatDate(selectedStartDate!), formatDate(date))
        setIsOpen(false)
      } else {
        setSelectedStartDate(date)
        setSelectedEndDate(null)
        setIsSelectingEnd(true)
      }
    }
  }

  const handleQuickSelect = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    
    setSelectedStartDate(start)
    setSelectedEndDate(end)
    setIsSelectingEnd(false)
    onDateRangeChange(formatDate(start), formatDate(end))
    setIsOpen(false)
  }

  const clearSelection = () => {
    setSelectedStartDate(null)
    setSelectedEndDate(null)
    setIsSelectingEnd(false)
    onDateRangeChange('', '')
  }

  const days = getDaysInMonth(currentMonth)
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Período
      </label>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors min-w-0"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-gray-900">
            {selectedStartDate && selectedEndDate 
              ? `${formatDisplayDate(selectedStartDate)} - ${formatDisplayDate(selectedEndDate)}`
              : 'Selecionar período'
            }
          </span>
        </div>
        {selectedStartDate && selectedEndDate && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              clearSelection()
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 min-w-[320px]">
          {/* Quick Select Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleQuickSelect(7)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              7 dias
            </button>
            <button
              onClick={() => handleQuickSelect(30)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              30 dias
            </button>
            <button
              onClick={() => handleQuickSelect(90)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              90 dias
            </button>
          </div>

          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-medium text-gray-900">
              {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Week days */}
            {weekDays.map(day => (
              <div key={day} className="text-xs text-gray-500 text-center py-1">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day, index) => (
              <div key={index} className="text-center">
                {day ? (
                  <button
                    onClick={() => handleDateClick(day)}
                    disabled={day > new Date()}
                    className={`
                      w-8 h-8 text-sm rounded-full transition-colors
                      ${day > new Date() 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'hover:bg-blue-100 cursor-pointer'
                      }
                      ${isDateInRange(day) ? 'bg-blue-100' : ''}
                      ${isDateSelected(day) === 'start' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                      ${isDateSelected(day) === 'end' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                      ${isDateInRange(day) && !isDateSelected(day) ? 'bg-blue-50' : ''}
                    `}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <div className="w-8 h-8" />
                )}
              </div>
            ))}
          </div>

          {/* Selection Info */}
          {isSelectingEnd && selectedStartDate && (
            <div className="mt-4 p-2 bg-blue-50 rounded text-xs text-blue-700">
              Selecione a data final
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DateRangePicker 