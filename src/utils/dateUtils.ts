/**
 * Utilitários para manipulação de datas
 * Garante consistência nos cálculos de períodos em todo o sistema
 */

/**
 * Converte uma data para string no formato YYYY-MM-DD
 * Usa o timezone local para evitar problemas de conversão
 */
export const formatDateToString = (date: Date): string => {
  // Usar métodos locais para evitar problemas de timezone
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Obtém a data atual no formato YYYY-MM-DD
 */
export const getTodayString = (): string => {
  return formatDateToString(new Date())
}

/**
 * Calcula datas para diferentes presets de período
 * Usa timezone local para evitar problemas de conversão
 */
export const getDatePresets = () => {
  // Usar uma data fixa para evitar problemas de timezone durante o cálculo
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()
  
  return {
    today: {
      start: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      label: 'Hoje'
    },
    yesterday: {
      start: formatDateToString(new Date(todayYear, todayMonth, todayDate - 1)),
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate - 1)),
      label: 'Ontem'
    },
    last7days: {
      start: formatDateToString(new Date(todayYear, todayMonth, todayDate - 6)), // 7 dias incluindo hoje
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      label: 'Últimos 7 dias'
    },
    last30days: {
      start: formatDateToString(new Date(todayYear, todayMonth, todayDate - 29)), // 30 dias incluindo hoje
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      label: 'Últimos 30 dias'
    },
    last90days: {
      start: formatDateToString(new Date(todayYear, todayMonth, todayDate - 89)), // 90 dias incluindo hoje
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      label: 'Últimos 90 dias'
    },
    last12months: {
      start: formatDateToString(new Date(todayYear, todayMonth, todayDate - 364)), // 365 dias incluindo hoje
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      label: 'Últimos 12 meses'
    },
    thisWeek: {
      start: formatDateToString(new Date(todayYear, todayMonth, todayDate - today.getDay())), // Domingo da semana atual
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      label: 'Esta semana'
    },
    thisMonth: {
      start: formatDateToString(new Date(todayYear, todayMonth, 1)),
      end: formatDateToString(new Date(todayYear, todayMonth, todayDate)),
      label: 'Este mês'
    },
    lastMonth: {
      start: formatDateToString(new Date(todayYear, todayMonth - 1, 1)),
      end: formatDateToString(new Date(todayYear, todayMonth, 0)), // Último dia do mês anterior
      label: 'Mês passado'
    }
  }
}

/**
 * Obtém o período padrão baseado na aba ativa
 */
export const getDefaultPeriodForTab = (tab: string) => {
  const presets = getDatePresets()
  
  switch (tab) {
    case 'visao-geral':
      return {
        start: presets.thisMonth.start,
        end: presets.thisMonth.end
      }
    case 'funil-conversao':
      return {
        start: presets.last30days.start,
        end: presets.last30days.end
      }
    case 'dados-detalhados':
      return {
        start: presets.last7days.start,
        end: presets.last7days.end
      }
    case 'pedidos':
      return {
        start: presets.today.start,
        end: presets.today.end
      }
    case 'leads':
      return {
        start: presets.last12months.start,
        end: presets.last12months.end
      }
    default:
      return {
        start: presets.thisMonth.start,
        end: presets.thisMonth.end
      }
  }
}

/**
 * Valida se uma data está no formato correto
 */
export const isValidDateString = (dateString: string): boolean => {
  if (!dateString) return false
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Cria uma data sem problemas de timezone a partir de uma string YYYY-MM-DD
 * Evita o deslocamento de um dia que ocorre com new Date(string)
 */
export const parseDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Compara duas datas no formato string YYYY-MM-DD
 * Retorna -1 se a primeira é menor, 0 se iguais, 1 se maior
 */
export const compareDateStrings = (dateA: string, dateB: string): number => {
  if (dateA < dateB) return -1
  if (dateA > dateB) return 1
  return 0
}

/**
 * Valida se o período de datas é válido
 */
export const validateDateRange = (startDate: string, endDate: string) => {
  const errors: { start?: string; end?: string } = {}
  const today = getTodayString()
  
  if (startDate && !isValidDateString(startDate)) {
    errors.start = 'Data inicial inválida'
  }
  
  if (endDate && !isValidDateString(endDate)) {
    errors.end = 'Data final inválida'
  }
  
  if (startDate && startDate > today) {
    errors.start = 'Data inicial não pode ser futura'
  }
  
  if (endDate && endDate > today) {
    errors.end = 'Data final não pode ser futura'
  }
  
  if (startDate && endDate && startDate > endDate) {
    errors.end = 'Data final deve ser posterior à inicial'
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Obtém o início do mês para uma data específica
 */
export const getMonthStart = (dateString: string): string => {
  const date = parseDateString(dateString)
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  return formatDateToString(monthStart)
}

/**
 * Obtém o fim do mês para uma data específica
 */
export const getMonthEnd = (dateString: string): string => {
  const date = parseDateString(dateString)
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return formatDateToString(monthEnd)
}

/**
 * Formata uma data para exibição de mês (ex: "Jan/2024")
 */
export const formatMonthRange = (monthStart: string): string => {
  const start = parseDateString(monthStart)
  return start.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

/**
 * Converte uma data brasileira (DD/MM/YYYY) para formato ISO (YYYY-MM-DD)
 */
export const convertBrazilianDateToISO = (brazilianDate: string): string => {
  if (!brazilianDate) return ''
  
  // Se já está no formato ISO, retorna como está
  if (brazilianDate.match(/^\d{4}-\d{2}-\d{2}/)) {
    return brazilianDate
  }
  
  // Se está no formato brasileiro DD/MM/YYYY HH:mm:ss
  if (brazilianDate.match(/^\d{2}\/\d{2}\/\d{4},\s\d{2}:\d{2}:\d{2}/)) {
    const [datePart] = brazilianDate.split(',')
    const [day, month, year] = datePart.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  // Se está no formato brasileiro DD/MM/YYYY
  if (brazilianDate.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const [day, month, year] = brazilianDate.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  return brazilianDate
}
export const groupTimelineDataByMonth = <T extends { date: string; [key: string]: any }>(
  data: T[]
): T[] => {
  if (!data || data.length === 0) return []
  
  // Agrupar por mês
  const monthlyGroups = new Map<string, T[]>()
  
  data.forEach(item => {
    const monthStart = getMonthStart(item.date)
    if (!monthlyGroups.has(monthStart)) {
      monthlyGroups.set(monthStart, [])
    }
    monthlyGroups.get(monthStart)!.push(item)
  })
  
  // Consolidar dados de cada mês
  const monthlyData: T[] = []
  
  monthlyGroups.forEach((monthItems, monthStart) => {
    if (monthItems.length === 0) return
    
    // Criar objeto consolidado para o mês
    const consolidatedItem = { ...monthItems[0] }
    consolidatedItem.date = monthStart
    
    // Somar todas as métricas numéricas
    monthItems.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'date' && typeof item[key] === 'number') {
          consolidatedItem[key] = (consolidatedItem[key] || 0) + item[key]
        }
      })
    })
    
    monthlyData.push(consolidatedItem)
  })
  
  // Ordenar por data
  return monthlyData.sort((a, b) => compareDateStrings(a.date, b.date))
}
