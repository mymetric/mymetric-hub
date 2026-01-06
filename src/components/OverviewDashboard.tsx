import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { 
  BarChart3,
  ShoppingBag,
  DollarSign,
  Coins,
  Users,
  Globe,
  Target,
  TrendingUp,
  CheckCircle,
  ShoppingCart,
  Loader2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  Settings,
  Save,
  Trash2,
  FolderOpen,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  GripVertical,
  Pencil,
  Plus,
  Layout,
  Eye,
  EyeOff,
  Activity,
  Database,
  Package,
  MessageSquare,
  Truck,
  Filter,
  Zap,
  Star,
  Heart,
  Home,
  Briefcase,
  Calendar,
  Clock,
  Bell,
  Bookmark,
  Tag,
  Layers,
  Grid,
  List,
  Columns,
  type LucideIcon
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'

interface OverviewDataItem {
  add_to_carts: number
  city: string
  clicks: number
  cost: number
  country: string
  event_date: string
  leads: number
  new_customers: number
  orders: number
  paid_orders: number
  paid_revenue: number
  platform: string
  region: string
  revenue: number
  revenue_new_customers: number
  sessions: number
  traffic_category: string
  // Novas métricas
  paid_new_annual_orders?: number
  paid_new_annual_revenue?: number
  paid_new_montly_orders?: number
  paid_new_montly_revenue?: number
  paid_recurring_annual_orders?: number
  paid_recurring_annual_revenue?: number
  paid_recurring_montly_orders?: number
  paid_recurring_montly_revenue?: number
}

interface OverviewDashboardProps {
  selectedTable: string // Identificador do cliente (usado para personalizações exclusivas por cliente)
  startDate: string
  endDate: string
}

interface DashboardPreset {
  id: string
  name: string
  selectedDimensions: string[]
  selectedMetrics: string[]
  cardMetrics: string[]
  timelineMetrics: string[]
  cardOrder: string[]
  sortField: string | null
  sortDirection: 'asc' | 'desc'
  createdAt: string
}

interface Widget {
  id: string
  type: 'cards' | 'timeline' | 'table' | 'runrate'
  cardMetrics?: string[]
  cardOrder?: string[]
  timelineMetrics?: string[]
  selectedDimensions?: string[]
  selectedMetrics?: string[]
  sortField?: string | null
  sortDirection?: 'asc' | 'desc'
  rowLimit?: number | null
  title?: string
  customTabId?: string // ID da sub aba à qual este widget pertence
}

// Interface para sub abas personalizadas
interface CustomTab {
  id: string
  name: string
  icon: string // Nome do ícone do lucide-react
  order: number
  createdAt: string
  updatedAt: string
}

// Interface para todas as configurações do dashboard
interface DashboardConfig {
  widgets: Widget[]
  customTabs?: CustomTab[] // Sub abas personalizadas
  // Configurações legadas (mantidas para compatibilidade durante migração)
  legacy?: {
    cardMetrics?: string[]
    cardOrder?: string[]
    timelineMetrics?: string[]
    selectedDimensions?: string[]
    selectedMetrics?: string[]
    sortField?: string | null
    sortDirection?: 'asc' | 'desc'
    dimensionFilters?: Record<string, string[]>
    presets?: DashboardPreset[]
  }
  version: string // Versão do schema para migrações futuras
}

// Utilitário centralizado para gerenciar configurações no localStorage
class DashboardStorage {
  private static readonly STORAGE_PREFIX = 'overview-dashboard'
  private static readonly CURRENT_VERSION = '2.0'

  // Obter chave de storage para um cliente
  private static getStorageKey(tableName: string): string {
    return `${this.STORAGE_PREFIX}-${tableName}`
  }

  // Carregar todas as configurações de um cliente
  static loadConfig(tableName: string): DashboardConfig | null {
    if (!tableName) return null

    try {
      const storageKey = this.getStorageKey(tableName)
      const saved = localStorage.getItem(storageKey)
      
      if (saved) {
        const parsed = JSON.parse(saved)
        
        // Se já tem widgets e versão, retornar direto (não migrar)
        if (parsed.widgets && Array.isArray(parsed.widgets) && parsed.widgets.length > 0 && parsed.version === this.CURRENT_VERSION) {
          return parsed as DashboardConfig
        }
        
        // Migrar de versão antiga se necessário
        if (!parsed.version || parsed.version !== this.CURRENT_VERSION) {
          return this.migrateFromLegacy(tableName, parsed)
        }
        
        return parsed as DashboardConfig
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error)
    }

    return null
  }

  // Salvar todas as configurações de um cliente
  static saveConfig(tableName: string, config: Partial<DashboardConfig>): void {
    if (!tableName) return

    try {
      const storageKey = this.getStorageKey(tableName)
      
      // Carregar existente diretamente do localStorage para evitar migração durante save
      let existing: DashboardConfig | null = null
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          // Preservar widgets e customTabs existentes mesmo se versão for antiga
          if (parsed.widgets && Array.isArray(parsed.widgets)) {
            existing = {
              widgets: parsed.widgets,
              customTabs: Array.isArray(parsed.customTabs) ? parsed.customTabs : [],
              version: parsed.version || this.CURRENT_VERSION,
              legacy: parsed.legacy
            }
          } else if (Array.isArray(parsed.customTabs)) {
            // Caso raro: ter apenas customTabs salvas
            existing = {
              widgets: [],
              customTabs: parsed.customTabs,
              version: parsed.version || this.CURRENT_VERSION,
              legacy: parsed.legacy
            }
          }
        }
      } catch {}

      if (!existing) {
        existing = {
          widgets: [],
          customTabs: [],
          version: this.CURRENT_VERSION
        }
      }

      const updated: DashboardConfig = {
        ...existing,
        ...config,
        version: this.CURRENT_VERSION
      }

      // Se widgets estão sendo atualizados, usar os novos; caso contrário, preservar os existentes
      if (config.widgets !== undefined) {
        // Só atualizar se não for array vazio OU se for explicitamente uma remoção (array vazio quando já havia widgets)
        if (Array.isArray(config.widgets) && config.widgets.length > 0) {
          // Atualizar com novos widgets
          updated.widgets = config.widgets
        } else if (Array.isArray(config.widgets) && config.widgets.length === 0) {
          // Array vazio: só permitir se já estava vazio OU se foi uma remoção explícita
          // Para detectar remoção explícita, verificamos se existing tinha widgets antes
          if (existing.widgets.length === 0) {
            // Já estava vazio, ok manter vazio
            updated.widgets = []
          } else {
            // Tentando limpar widgets existentes - NÃO PERMITIR (preservar)
            console.warn('⚠️ Tentativa de limpar widgets existentes bloqueada. Preservando widgets.')
            updated.widgets = existing.widgets
          }
        } else {
          // Preservar widgets existentes
          updated.widgets = existing.widgets
        }
      } else if (existing.widgets && existing.widgets.length > 0) {
        // Preservar widgets existentes se não estiver sendo atualizado
        updated.widgets = existing.widgets
      }

      // Preservar customTabs existentes se não estiver sendo atualizado
      if (config.customTabs === undefined && existing.customTabs) {
        updated.customTabs = existing.customTabs
      } else if (config.customTabs !== undefined) {
        updated.customTabs = config.customTabs
      }

      localStorage.setItem(storageKey, JSON.stringify(updated))
      console.log('💾 Configurações salvas:', { tableName, widgets: updated.widgets.length, customTabs: updated.customTabs?.length || 0 })
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error)
    }
  }

  // Métodos para gerenciar customTabs
  static getCustomTabs(tableName: string): CustomTab[] {
    const config = this.loadConfig(tableName)
    return config?.customTabs || []
  }

  static addCustomTab(tableName: string, tab: Omit<CustomTab, 'id' | 'createdAt' | 'updatedAt'>): CustomTab {
    const tabs = this.getCustomTabs(tableName)
    const newTab: CustomTab = {
      ...tab,
      id: `custom-tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const updatedTabs = [...tabs, newTab]
    this.saveConfig(tableName, { customTabs: updatedTabs })
    return newTab
  }

  static updateCustomTab(tableName: string, tabId: string, updates: Partial<Omit<CustomTab, 'id' | 'createdAt'>>): CustomTab | null {
    const tabs = this.getCustomTabs(tableName)
    const index = tabs.findIndex(t => t.id === tabId)
    if (index === -1) return null
    
    const updatedTab: CustomTab = {
      ...tabs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    const updatedTabs = [...tabs]
    updatedTabs[index] = updatedTab
    this.saveConfig(tableName, { customTabs: updatedTabs })
    return updatedTab
  }

  static deleteCustomTab(tableName: string, tabId: string): void {
    const tabs = this.getCustomTabs(tableName)
    const updatedTabs = tabs.filter(t => t.id !== tabId)
    this.saveConfig(tableName, { customTabs: updatedTabs })
    
    // Remover widgets associados a esta aba
    const config = this.loadConfig(tableName)
    if (config?.widgets) {
      const updatedWidgets = config.widgets.filter(w => w.customTabId !== tabId)
      this.saveConfig(tableName, { widgets: updatedWidgets })
    }
  }

  static reorderCustomTabs(tableName: string, tabIds: string[]): void {
    const tabs = this.getCustomTabs(tableName)
    const reorderedTabs = tabIds.map((id, index) => {
      const tab = tabs.find(t => t.id === id)
      if (!tab) return null
      return { ...tab, order: index }
    }).filter((tab): tab is CustomTab => tab !== null)
    
    // Adicionar tabs que não foram incluídos na reordenação (mantendo ordem original)
    const remainingTabs = tabs.filter(t => !tabIds.includes(t.id))
    const allTabs = [...reorderedTabs, ...remainingTabs]
    
    this.saveConfig(tableName, { customTabs: allTabs })
  }

  // Migrar configurações antigas para o novo formato
  private static migrateFromLegacy(tableName: string, existing: any): DashboardConfig {
    console.log('🔄 Migrando configurações antigas para novo formato...')
    
    const config: DashboardConfig = {
      widgets: [],
      version: this.CURRENT_VERSION,
      legacy: {}
    }

    // PRIORIDADE 1: Preservar widgets existentes se já houver no novo formato
    if (existing?.widgets && Array.isArray(existing.widgets) && existing.widgets.length > 0) {
      console.log('📦 Preservando widgets existentes do novo formato:', existing.widgets.length)
      config.widgets = existing.widgets
    } else {
      // PRIORIDADE 2: Migrar widgets da chave antiga se existirem
      const widgetsKey = `overview-widgets-${tableName}`
      const savedWidgets = localStorage.getItem(widgetsKey)
      if (savedWidgets) {
        try {
          const parsed = JSON.parse(savedWidgets)
          if (Array.isArray(parsed) && parsed.length > 0) {
            config.widgets = parsed
            console.log('📦 Widgets migrados da chave antiga:', parsed.length)
          }
        } catch (e) {
          console.error('❌ Erro ao migrar widgets da chave antiga:', e)
        }
      }
    }

    // Migrar configurações legadas
    const legacy: any = {}
    
    const cardMetricsKey = `overview-card-metrics-${tableName}`
    const savedCardMetrics = localStorage.getItem(cardMetricsKey)
    if (savedCardMetrics) {
      try {
        legacy.cardMetrics = JSON.parse(savedCardMetrics)
      } catch {}
    }

    const timelineMetricsKey = `overview-timeline-metrics-${tableName}`
    const savedTimelineMetrics = localStorage.getItem(timelineMetricsKey)
    if (savedTimelineMetrics) {
      try {
        legacy.timelineMetrics = JSON.parse(savedTimelineMetrics)
      } catch {}
    }

    const dimensionsKey = `overview-selected-dimensions-${tableName}`
    const savedDimensions = localStorage.getItem(dimensionsKey)
    if (savedDimensions) {
      try {
        const parsed = JSON.parse(savedDimensions)
        legacy.selectedDimensions = parsed.dimensions || parsed
      } catch {}
    }

    const metricsKey = `overview-selected-metrics-${tableName}`
    const savedMetrics = localStorage.getItem(metricsKey)
    if (savedMetrics) {
      try {
        const parsed = JSON.parse(savedMetrics)
        legacy.selectedMetrics = parsed.metrics || parsed
      } catch {}
    }

    const cardOrderKey = `overview-card-order-${tableName}`
    const savedCardOrder = localStorage.getItem(cardOrderKey)
    if (savedCardOrder) {
      try {
        legacy.cardOrder = JSON.parse(savedCardOrder)
      } catch {}
    }

    const sortFieldKey = `overview-sort-field-${tableName}`
    const savedSortField = localStorage.getItem(sortFieldKey)
    if (savedSortField) {
      legacy.sortField = savedSortField
    }

    const sortDirectionKey = `overview-sort-direction-${tableName}`
    const savedSortDirection = localStorage.getItem(sortDirectionKey)
    if (savedSortDirection) {
      legacy.sortDirection = savedSortDirection as 'asc' | 'desc'
    }

    const filtersKey = `overview-dimension-filters-${tableName}`
    const savedFilters = localStorage.getItem(filtersKey)
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters)
        legacy.dimensionFilters = parsed
      } catch {}
    }

    const presetsKey = `overview-presets-${tableName}`
    const savedPresets = localStorage.getItem(presetsKey)
    if (savedPresets) {
      try {
        legacy.presets = JSON.parse(savedPresets)
      } catch {}
    }

    config.legacy = legacy

    // Salvar configuração migrada
    this.saveConfig(tableName, config)

    console.log('✅ Migração concluída')
    return config
  }

  // Limpar todas as configurações de um cliente
  static clearConfig(tableName: string): void {
    if (!tableName) return

    try {
      const storageKey = this.getStorageKey(tableName)
      localStorage.removeItem(storageKey)
      
      // Limpar também chaves antigas para limpeza completa
      const oldKeys = [
        `overview-widgets-${tableName}`,
        `overview-card-metrics-${tableName}`,
        `overview-timeline-metrics-${tableName}`,
        `overview-selected-dimensions-${tableName}`,
        `overview-selected-metrics-${tableName}`,
        `overview-card-order-${tableName}`,
        `overview-sort-field-${tableName}`,
        `overview-sort-direction-${tableName}`,
        `overview-dimension-filters-${tableName}`,
        `overview-presets-${tableName}`
      ]

      oldKeys.forEach(key => localStorage.removeItem(key))
      console.log('🗑️ Configurações removidas:', tableName)
    } catch (error) {
      console.error('❌ Erro ao limpar configurações:', error)
    }
  }
}

// Helper para mapear nomes de ícones para componentes do lucide-react
const iconMap: Record<string, LucideIcon> = {
  BarChart3,
  ShoppingBag,
  DollarSign,
  Coins,
  Users,
  Globe,
  Target,
  TrendingUp,
  CheckCircle,
  ShoppingCart,
  Activity,
  Database,
  Package,
  MessageSquare,
  Truck,
  Filter,
  Zap,
  Star,
  Heart,
  Home,
  Briefcase,
  Calendar,
  Clock,
  Bell,
  Bookmark,
  Tag,
  Layers,
  Grid,
  List,
  Columns
}

// Todas as personalizações (dimensões, métricas, cards, timeline, filtros, ordem) são salvas no localStorage
// usando selectedTable como identificador único do cliente, garantindo que cada cliente tenha suas próprias configurações
const OverviewDashboard = ({ selectedTable, startDate, endDate }: OverviewDashboardProps) => {
  const [data, setData] = useState<OverviewDataItem[]>([])
  const [allData, setAllData] = useState<OverviewDataItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para job/polling
  const [jobId, setJobId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [jobStatus, setJobStatus] = useState<string>('idle') // idle, processing, completed, error
  const [jobProgress, setJobProgress] = useState<string>('')
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentPollingJobIdRef = useRef<string | null>(null)
  const isProcessingRef = useRef<boolean>(false)
  const hasStartedProcessingRef = useRef<string | null>(null)
  
  // Estado para limite de linhas
  const [rowLimit, setRowLimit] = useState<number | null>(10)
  
  // Estado para sidebar do seletor
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Estados para múltiplos widgets
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    if (!selectedTable) return []
    const config = DashboardStorage.loadConfig(selectedTable)
    if (config?.widgets) {
      console.log('📦 Widgets carregados:', config.widgets.length, 'widgets')
      return config.widgets
    }
    console.log('📦 Nenhum widget encontrado')
    return []
  })
  
  // Ref para evitar adicionar widgets duplicados
  const addingWidgetRef = useRef(false)

  // Estados para sub abas personalizadas
  const [customTabs, setCustomTabs] = useState<CustomTab[]>(() => {
    if (!selectedTable) return []
    return DashboardStorage.getCustomTabs(selectedTable).sort((a, b) => a.order - b.order)
  })
  const [activeCustomTab, setActiveCustomTab] = useState<string | null>(null) // null = mostrar widgets sem aba
  const [showCustomTabModal, setShowCustomTabModal] = useState(false)
  const [editingCustomTab, setEditingCustomTab] = useState<CustomTab | null>(null)
  const [customTabFormData, setCustomTabFormData] = useState({ name: '', icon: 'BarChart3', order: 0 })
  const [draggedCustomTab, setDraggedCustomTab] = useState<string | null>(null)

  // Estados para edição de widgets individuais
  const [editingWidget, setEditingWidget] = useState<{ id: string; type: 'cards' | 'timeline' | 'table' | 'runrate' } | null>(null)
  
  // Estado para modal de reordenação
  const [showReorderModal, setShowReorderModal] = useState(false)
  
  // Estado para modal de adicionar widget
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false)
  
  // Estado para modo de edição/visualização (padrão: visualização)
  const [isEditMode, setIsEditMode] = useState(false)
  
  // Estados para busca nos modais de edição
  const [cardsMetricSearch, setCardsMetricSearch] = useState('')
  const [timelineMetricSearch, setTimelineMetricSearch] = useState('')
  const [tableMetricSearch, setTableMetricSearch] = useState('')
  const [tableDimensionSearch, setTableDimensionSearch] = useState('')
  
  // Estado para busca de métricas na sidebar
  const [metricSearchTerm, setMetricSearchTerm] = useState('')
  
  // Estado para presets
  const [presets, setPresets] = useState<DashboardPreset[]>(() => {
    const storageKey = `overview-presets-${selectedTable}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  const [presetName, setPresetName] = useState('')
  const [showPresetInput, setShowPresetInput] = useState(false)
  
  // Estados para goals e run rate
  const [goals, setGoals] = useState<any>(null)
  const [isLoadingGoals, setIsLoadingGoals] = useState(false)
  const [currentMonthData, setCurrentMonthData] = useState<any>(null)
  const [isLoadingCurrentMonth, setIsLoadingCurrentMonth] = useState(false)
  
  // Estados para comparação com período anterior
  const [previousTotals, setPreviousTotals] = useState({
    sessions: 0,
    clicks: 0,
    add_to_carts: 0,
    orders: 0,
    paid_orders: 0,
    revenue: 0,
    paid_revenue: 0,
    cost: 0,
    leads: 0,
    new_customers: 0,
    revenue_new_customers: 0,
    paid_new_annual_orders: 0,
    paid_new_annual_revenue: 0,
    paid_new_montly_orders: 0,
    paid_new_montly_revenue: 0,
    paid_recurring_annual_orders: 0,
    paid_recurring_annual_revenue: 0,
    paid_recurring_montly_orders: 0,
    paid_recurring_montly_revenue: 0
  })
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  
  // Estados para modal de meta
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [goalFormData, setGoalFormData] = useState({
    month: '',
    goal_value: ''
  })
  
  // Estado para drag and drop dos cards
  const [draggedCard, setDraggedCard] = useState<string | null>(null)
  const [dragOverCard, setDragOverCard] = useState<string | null>(null)
  
  // Estado para drag and drop dos widgets
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null)
  const isDraggingRef = useRef(false)
  const dragOverCardRef = useRef<string | null>(null)
  
  // Estado para métricas da timeline (máximo 2)
  // Personalização salva por cliente usando selectedTable como identificador
  const [timelineMetrics, setTimelineMetrics] = useState<string[]>(() => {
    const storageKey = `overview-timeline-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  
  // Salvar métricas da timeline no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-timeline-metrics-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify(timelineMetrics))
  }, [timelineMetrics, selectedTable])
  
  // Resetar métricas da timeline quando mudar de cliente
  useEffect(() => {
    const storageKey = `overview-timeline-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setTimelineMetrics(JSON.parse(saved))
      } catch {
        setTimelineMetrics([])
      }
    } else {
      setTimelineMetrics([])
    }
  }, [selectedTable])

  // Limpar campos de busca quando fechar o modal
  useEffect(() => {
    if (!editingWidget) {
      setCardsMetricSearch('')
      setTimelineMetricSearch('')
      setTableMetricSearch('')
      setTableDimensionSearch('')
    }
  }, [editingWidget])

  // Recarregar customTabs quando selectedTable mudar
  useEffect(() => {
    if (selectedTable) {
      const tabs = DashboardStorage.getCustomTabs(selectedTable).sort((a, b) => a.order - b.order)
      setCustomTabs(tabs)
      // Se houver abas e nenhuma estiver ativa, ativar a primeira
      if (tabs.length > 0 && activeCustomTab === null) {
        setActiveCustomTab(tabs[0].id)
      } else if (tabs.length === 0) {
        setActiveCustomTab(null)
      } else if (activeCustomTab && !tabs.find(t => t.id === activeCustomTab)) {
        // Se a aba ativa não existe mais, ativar a primeira
        setActiveCustomTab(tabs[0].id)
      }
    } else {
      setCustomTabs([])
      setActiveCustomTab(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable])

  // Filtrar widgets por sub aba ativa
  const filteredWidgets = useMemo(() => {
    if (activeCustomTab === null) {
      // Mostrar widgets sem sub aba (customTabId undefined ou null)
      return widgets.filter(w => !w.customTabId)
    }
    // Mostrar widgets da sub aba ativa
    return widgets.filter(w => w.customTabId === activeCustomTab)
  }, [widgets, activeCustomTab])

  // Ref para rastrear se é a primeira renderização dos widgets
  const isWidgetsInitialMountRef = useRef(true)
  const prevWidgetsRef = useRef<Widget[]>([])

  // Salvar widgets no localStorage (apenas quando realmente mudarem, não na inicialização)
  useEffect(() => {
    // Pular na primeira renderização
    if (isWidgetsInitialMountRef.current) {
      isWidgetsInitialMountRef.current = false
      prevWidgetsRef.current = widgets
      return
    }

    // Só salvar se os widgets realmente mudaram
    if (selectedTable && JSON.stringify(prevWidgetsRef.current) !== JSON.stringify(widgets)) {
      DashboardStorage.saveConfig(selectedTable, { widgets })
      prevWidgetsRef.current = widgets
    }
  }, [widgets, selectedTable])

  // Recarregar widgets quando selectedTable mudar (apenas se não houver widgets carregados)
  // Usar ref para evitar recarregar múltiplas vezes
  const hasLoadedWidgetsRef = useRef(false)
  
  useEffect(() => {
    if (selectedTable) {
      // Só carregar se ainda não carregou OU se não há widgets no estado
      if (!hasLoadedWidgetsRef.current || widgets.length === 0) {
        const config = DashboardStorage.loadConfig(selectedTable)
        if (config?.widgets && config.widgets.length > 0) {
          setWidgets(config.widgets)
          prevWidgetsRef.current = config.widgets
          isWidgetsInitialMountRef.current = true // Resetar flag para não salvar na próxima renderização
          hasLoadedWidgetsRef.current = true
          console.log('🔄 Widgets recarregados:', config.widgets.length, 'widgets')
        } else if (widgets.length > 0) {
          // Se não há widgets salvos mas há widgets no estado, preservar (não limpar)
          console.log('⚠️ Nenhum widget encontrado no storage, preservando widgets atuais:', widgets.length)
        }
      }
    }
    
    // Resetar flag quando selectedTable mudar
    return () => {
      hasLoadedWidgetsRef.current = false
    }
  }, [selectedTable])

  // Migrar widgets antigos para o novo sistema na primeira vez
  useEffect(() => {
    if (widgets.length === 0) {
      // Verificar se há configurações antigas
      const cardMetricsKey = `overview-card-metrics-${selectedTable}`
      const timelineMetricsKey = `overview-timeline-metrics-${selectedTable}`
      const selectedDimensionsKey = `overview-selected-dimensions-${selectedTable}`
      const selectedMetricsKey = `overview-selected-metrics-${selectedTable}`
      
      const savedCardMetrics = localStorage.getItem(cardMetricsKey)
      const savedTimelineMetrics = localStorage.getItem(timelineMetricsKey)
      const savedDimensions = localStorage.getItem(selectedDimensionsKey)
      const savedMetrics = localStorage.getItem(selectedMetricsKey)
      
      const newWidgets: Widget[] = []
      
      // Migrar cards se existirem
      if (savedCardMetrics) {
        try {
          const cardMetrics = JSON.parse(savedCardMetrics)
          if (cardMetrics.length > 0) {
            const cardOrderKey = `overview-card-order-${selectedTable}`
            const savedCardOrder = localStorage.getItem(cardOrderKey)
            newWidgets.push({
              id: `widget-${Date.now()}-cards`,
              type: 'cards',
              cardMetrics: cardMetrics,
              cardOrder: savedCardOrder ? JSON.parse(savedCardOrder) : cardMetrics,
              title: 'Cards de Métricas'
            })
          }
        } catch {}
      }
      
      // Migrar timeline se existir
      if (savedTimelineMetrics) {
        try {
          const timelineMetrics = JSON.parse(savedTimelineMetrics)
          if (timelineMetrics.length > 0) {
            newWidgets.push({
              id: `widget-${Date.now()}-timeline`,
              type: 'timeline',
              timelineMetrics: timelineMetrics,
              title: 'Timeline de Métricas'
            })
          }
        } catch {}
      }
      
      // Migrar tabela se existir
      if (savedDimensions && savedMetrics) {
        try {
          const dimensions = JSON.parse(savedDimensions)
          const metrics = JSON.parse(savedMetrics)
          if (dimensions.length > 0 && metrics.length > 0) {
            const sortFieldKey = `overview-sort-field-${selectedTable}`
            const sortDirectionKey = `overview-sort-direction-${selectedTable}`
            const savedSortField = localStorage.getItem(sortFieldKey)
            const savedSortDirection = localStorage.getItem(sortDirectionKey)
            
            newWidgets.push({
              id: `widget-${Date.now()}-table`,
              type: 'table',
              selectedDimensions: dimensions,
              selectedMetrics: metrics,
              sortField: savedSortField || null,
              sortDirection: (savedSortDirection as 'asc' | 'desc') || 'asc',
              rowLimit: 10,
              title: 'Dados Agrupados'
            })
          }
        } catch {}
      }
      
      if (newWidgets.length > 0) {
        setWidgets(newWidgets)
      }
    }
  }, [selectedTable]) // Executar apenas quando selectedTable mudar

  // Funções para gerenciar widgets
  const addWidget = (type: 'cards' | 'timeline' | 'table' | 'runrate') => {
    // Prevenir adição duplicada
    if (addingWidgetRef.current) {
      return
    }
    
    addingWidgetRef.current = true
    
    const newWidget: Widget = {
      id: `widget-${Date.now()}-${Math.random()}-${type}`,
      type,
      ...(type === 'cards' && { cardMetrics: [], cardOrder: [] }),
      ...(type === 'timeline' && { timelineMetrics: [] }),
      ...(type === 'table' && { 
        selectedDimensions: [], 
        selectedMetrics: [],
        sortField: null,
        sortDirection: 'asc',
        rowLimit: 10
      }),
      title: type === 'cards' ? 'Cards de Métricas' : 
             type === 'timeline' ? 'Timeline de Métricas' : 
             type === 'runrate' ? 'Run Rate da Meta' :
             'Dados Agrupados',
      customTabId: activeCustomTab || undefined // Associar à sub aba ativa
    }
    setWidgets(prev => [...prev, newWidget])
    setEditingWidget({ id: newWidget.id, type })
    
    // Resetar após um pequeno delay
    setTimeout(() => {
      addingWidgetRef.current = false
    }, 100)
  }

  const removeWidget = (id: string) => {
    setWidgets(prev => {
      const newWidgets = prev.filter(w => w.id !== id)
      // Salvar imediatamente
      if (selectedTable) {
        DashboardStorage.saveConfig(selectedTable, { widgets: newWidgets })
      }
      return newWidgets
    })
  }

  const removeAllWidgets = () => {
    if (window.confirm('Tem certeza que deseja remover todos os widgets? Esta ação não pode ser desfeita.')) {
      setWidgets([])
      // Salvar imediatamente
      if (selectedTable) {
        DashboardStorage.saveConfig(selectedTable, { widgets: [] })
      }
    }
  }

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, ...updates } : w)
      // Salvar imediatamente no localStorage
      if (selectedTable) {
        DashboardStorage.saveConfig(selectedTable, { widgets: updated })
      }
      return updated
    })
  }

  // Funções para drag and drop de widgets
  const handleWidgetDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggedWidget(widgetId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleWidgetDragOver = (e: React.DragEvent, widgetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (widgetId !== draggedWidget && widgetId !== dragOverWidget) {
      setDragOverWidget(widgetId)
    }
  }

  const handleWidgetDragLeave = () => {
    setDragOverWidget(null)
  }

  const handleWidgetDragEnd = () => {
    setDraggedWidget(null)
    setDragOverWidget(null)
  }

  const handleWidgetDrop = (e: React.DragEvent, dropWidgetId: string) => {
    e.preventDefault()
    if (!draggedWidget || draggedWidget === dropWidgetId) {
      setDraggedWidget(null)
      setDragOverWidget(null)
      return
    }
    
    setWidgets(prev => {
      const newWidgets = [...prev]
      const dragIndex = newWidgets.findIndex(w => w.id === draggedWidget)
      const dropIndex = newWidgets.findIndex(w => w.id === dropWidgetId)
      
      if (dragIndex === -1 || dropIndex === -1 || dragIndex === dropIndex) {
        return prev
      }
      
      // Remover da posição original
      const [removed] = newWidgets.splice(dragIndex, 1)
      // Inserir na nova posição
      newWidgets.splice(dropIndex, 0, removed)
      
      return newWidgets
    })
    
    setDraggedWidget(null)
    setDragOverWidget(null)
  }

  // Funções para reordenar widgets no modal
  const moveWidgetUp = (index: number) => {
    if (index === 0 || !selectedTable) return
    
    setWidgets(prev => {
      const newWidgets = [...prev]
      const [removed] = newWidgets.splice(index, 1)
      newWidgets.splice(index - 1, 0, removed)
      
      // Salvar imediatamente
      DashboardStorage.saveConfig(selectedTable, { widgets: newWidgets })
      console.log('✅ Widgets reordenados e salvos:', newWidgets.length)
      
      return newWidgets
    })
  }

  const moveWidgetDown = (index: number) => {
    if (index === widgets.length - 1 || !selectedTable) return
    
    setWidgets(prev => {
      const newWidgets = [...prev]
      const [removed] = newWidgets.splice(index, 1)
      newWidgets.splice(index + 1, 0, removed)
      
      // Salvar imediatamente
      DashboardStorage.saveConfig(selectedTable, { widgets: newWidgets })
      console.log('✅ Widgets reordenados e salvos:', newWidgets.length)
      
      return newWidgets
    })
  }

  // Função para obter o ícone do tipo de widget
  const getWidgetTypeIcon = (type: string) => {
    switch (type) {
      case 'cards':
        return Layout
      case 'timeline':
        return TrendingUp
      case 'table':
        return BarChart3
      case 'runrate':
        return Target
      default:
        return Layout
    }
  }

  // Função para obter a cor do tipo de widget
  const getWidgetTypeColor = (type: string) => {
    switch (type) {
      case 'cards':
        return 'blue'
      case 'timeline':
        return 'purple'
      case 'table':
        return 'green'
      case 'runrate':
        return 'orange'
      default:
        return 'gray'
    }
  }

  // Função para obter o nome do tipo de widget
  const getWidgetTypeName = (type: string) => {
    switch (type) {
      case 'cards':
        return 'Cards'
      case 'timeline':
        return 'Timeline'
      case 'table':
        return 'Tabela'
      case 'runrate':
        return 'Run Rate'
      default:
        return 'Widget'
    }
  }

  // Obter widget atual sendo editado
  const currentWidget = editingWidget ? widgets.find(w => w.id === editingWidget.id) : null
  
  const toggleTimelineMetric = (metricKey: string) => {
    // Se estiver editando um widget específico, atualizar o widget
    if (editingWidget && editingWidget.type === 'timeline' && currentWidget) {
      const currentMetrics = currentWidget.timelineMetrics || []
      let newMetrics: string[]
      
      if (currentMetrics.includes(metricKey)) {
        newMetrics = currentMetrics.filter(key => key !== metricKey)
      } else {
        // Máximo de 2 métricas
        if (currentMetrics.length >= 2) {
          return
        }
        newMetrics = [...currentMetrics, metricKey]
      }
      
      updateWidget(editingWidget.id, { timelineMetrics: newMetrics })
      return
    }
    
    // Comportamento legado para estado global
    setTimelineMetrics(prev => {
      if (prev.includes(metricKey)) {
        return prev.filter(key => key !== metricKey)
      } else {
        // Máximo de 2 métricas
        if (prev.length >= 2) {
          return prev
        }
        return [...prev, metricKey]
      }
    })
  }
  
  
  // Função para obter o valor da métrica
  const getMetricValue = (metricKey: string): number => {
    if (metricKey === 'sessions') return totals.sessions
    if (metricKey === 'clicks') return totals.clicks
    if (metricKey === 'add_to_carts') return totals.add_to_carts
    if (metricKey === 'orders') return totals.orders
    if (metricKey === 'paid_orders') return totals.paid_orders
    if (metricKey === 'revenue') return totals.revenue
    if (metricKey === 'paid_revenue') return totals.paid_revenue
    if (metricKey === 'cost') return totals.cost
    if (metricKey === 'leads') return totals.leads
    if (metricKey === 'new_customers') return totals.new_customers
    if (metricKey === 'revenue_new_customers') return totals.revenue_new_customers
    if (metricKey === 'conversion_rate') return conversionRate
    if (metricKey === 'add_to_cart_rate') return addToCartRate
    if (metricKey === 'leads_conversion_rate') return leadsConversionRate
    if (metricKey === 'paid_conversion_rate') return paidConversionRate
    if (metricKey === 'revenue_per_session') return revenuePerSession
    if (metricKey === 'avg_order_value') return avgOrderValue
    if (metricKey === 'roas') return roas
    if (metricKey === 'new_customer_rate') return newCustomerRate
    // Novas métricas
    if (metricKey === 'paid_new_annual_orders') return totals.paid_new_annual_orders || 0
    if (metricKey === 'paid_new_annual_revenue') return totals.paid_new_annual_revenue || 0
    if (metricKey === 'paid_new_montly_orders') return totals.paid_new_montly_orders || 0
    if (metricKey === 'paid_new_montly_revenue') return totals.paid_new_montly_revenue || 0
    if (metricKey === 'paid_recurring_annual_orders') return totals.paid_recurring_annual_orders || 0
    if (metricKey === 'paid_recurring_annual_revenue') return totals.paid_recurring_annual_revenue || 0
    if (metricKey === 'paid_recurring_montly_orders') return totals.paid_recurring_montly_orders || 0
    if (metricKey === 'paid_recurring_montly_revenue') return totals.paid_recurring_montly_revenue || 0
    return 0
  }
  
  // Função para obter o ícone da métrica
  const getMetricIcon = (metricKey: string) => {
    if (['sessions', 'leads'].includes(metricKey)) return Users
    if (['orders', 'paid_orders', 'paid_new_annual_orders', 'paid_new_montly_orders', 'paid_recurring_annual_orders', 'paid_recurring_montly_orders'].includes(metricKey)) return ShoppingBag
    if (['revenue', 'paid_revenue', 'revenue_new_customers', 'revenue_per_session', 'avg_order_value', 'paid_new_annual_revenue', 'paid_new_montly_revenue', 'paid_recurring_annual_revenue', 'paid_recurring_montly_revenue'].includes(metricKey)) return DollarSign
    if (['cost'].includes(metricKey)) return Coins
    if (['add_to_carts'].includes(metricKey)) return ShoppingCart
    if (['clicks'].includes(metricKey)) return Target
    if (['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'new_customer_rate'].includes(metricKey)) return TrendingUp
    if (['roas'].includes(metricKey)) return BarChart3
    return CheckCircle
  }
  
  // Estado para ordenação da tabela
  // Personalização salva por cliente usando selectedTable como identificador
  const [sortField, setSortField] = useState<string | null>(() => {
    const storageKey = `overview-sort-field-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    return saved || null
  })
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const storageKey = `overview-sort-direction-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    return (saved as 'asc' | 'desc') || 'desc'
  })
  
  // Salvar ordenação no localStorage quando mudar (por cliente)
  useEffect(() => {
    const fieldKey = `overview-sort-field-${selectedTable}` // Chave única por cliente
    const directionKey = `overview-sort-direction-${selectedTable}` // Chave única por cliente
    if (sortField) {
      localStorage.setItem(fieldKey, sortField)
    } else {
      localStorage.removeItem(fieldKey)
    }
    localStorage.setItem(directionKey, sortDirection)
  }, [sortField, sortDirection, selectedTable])
  
  // Resetar ordenação quando mudar de cliente
  useEffect(() => {
    const fieldKey = `overview-sort-field-${selectedTable}` // Chave única por cliente
    const directionKey = `overview-sort-direction-${selectedTable}` // Chave única por cliente
    const savedField = localStorage.getItem(fieldKey)
    const savedDirection = localStorage.getItem(directionKey)
    setSortField(savedField || null)
    setSortDirection((savedDirection as 'asc' | 'desc') || 'desc')
  }, [selectedTable])
  
  // Estado para filtros de dimensões (aplicados ao dashboard inteiro)
  // Personalização salva por cliente usando selectedTable como identificador
  const [dimensionFilters, setDimensionFilters] = useState<Record<string, Set<string>>>(() => {
    const storageKey = `overview-dimension-filters-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Converter arrays para Sets
        const result: Record<string, Set<string>> = {}
        for (const [key, value] of Object.entries(parsed)) {
          result[key] = new Set(value as string[])
        }
        return result
      } catch {
        return {}
      }
    }
    return {}
  })
  
  // Salvar filtros no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-dimension-filters-${selectedTable}` // Chave única por cliente
    // Converter Sets para arrays para JSON
    const serializable: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(dimensionFilters)) {
      serializable[key] = Array.from(value)
    }
    localStorage.setItem(storageKey, JSON.stringify(serializable))
  }, [dimensionFilters, selectedTable])
  
  // Resetar filtros quando mudar de cliente
  useEffect(() => {
    const storageKey = `overview-dimension-filters-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const result: Record<string, Set<string>> = {}
        for (const [key, value] of Object.entries(parsed)) {
          result[key] = new Set(value as string[])
        }
        setDimensionFilters(result)
      } catch {
        setDimensionFilters({})
      }
    } else {
      setDimensionFilters({})
    }
  }, [selectedTable])
  
  // Função para toggle de filtro de dimensão
  const toggleDimensionFilter = (dimensionKey: string, value: string) => {
    setDimensionFilters(prev => {
      const newFilters = { ...prev }
      if (!newFilters[dimensionKey]) {
        newFilters[dimensionKey] = new Set()
      }
      const newSet = new Set(newFilters[dimensionKey])
      if (newSet.has(value)) {
        newSet.delete(value)
      } else {
        newSet.add(value)
      }
      // Se o set ficou vazio, remover a chave
      if (newSet.size === 0) {
        delete newFilters[dimensionKey]
      } else {
        newFilters[dimensionKey] = newSet
      }
      return newFilters
    })
  }
  
  // Função para limpar filtros de uma dimensão
  const clearDimensionFilter = (dimensionKey: string) => {
    setDimensionFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[dimensionKey]
      return newFilters
    })
  }
  
  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    setDimensionFilters({})
  }
  
  // Dimensões e métricas disponíveis
  const dimensions = [
    { key: 'event_date', label: 'Data' },
    { key: 'platform', label: 'Plataforma' },
    { key: 'traffic_category', label: 'Categoria de Tráfego' },
    { key: 'city', label: 'Cidade' },
    { key: 'region', label: 'Região' },
    { key: 'country', label: 'País' }
  ]
  
  const metrics = [
    { key: 'sessions', label: 'Sessões', type: 'number' },
    { key: 'clicks', label: 'Cliques', type: 'number' },
    { key: 'add_to_carts', label: 'Adições ao Carrinho', type: 'number' },
    { key: 'orders', label: 'Pedidos', type: 'number' },
    { key: 'paid_orders', label: 'Pedidos Pagos', type: 'number' },
    { key: 'revenue', label: 'Receita', type: 'currency' },
    { key: 'paid_revenue', label: 'Receita Paga', type: 'currency' },
    { key: 'cost', label: 'Investimento', type: 'currency' },
    { key: 'leads', label: 'Leads', type: 'number' },
    { key: 'new_customers', label: 'Novos Clientes', type: 'number' },
    { key: 'revenue_new_customers', label: 'Receita Novos Clientes', type: 'currency' },
    // Métricas calculadas
    { key: 'conversion_rate', label: 'Taxa de Conversão Geral', type: 'percentage' },
    { key: 'add_to_cart_rate', label: 'Taxa de Adição ao Carrinho', type: 'percentage' },
    { key: 'leads_conversion_rate', label: 'Taxa de Conversão de Leads', type: 'percentage' },
    { key: 'paid_conversion_rate', label: 'Taxa de Pagamento', type: 'percentage' },
    { key: 'revenue_per_session', label: 'Receita por Sessão', type: 'currency' },
    { key: 'avg_order_value', label: 'Ticket Médio', type: 'currency' },
    { key: 'roas', label: 'ROAS', type: 'number' },
    { key: 'new_customer_rate', label: 'Taxa de Novos Clientes', type: 'percentage' },
    // Novas métricas de assinaturas pagas
    { key: 'paid_new_annual_orders', label: 'Pedidos Novos Anuais Pagos', type: 'number' },
    { key: 'paid_new_annual_revenue', label: 'Receita Novos Anuais Pagos', type: 'currency' },
    { key: 'paid_new_montly_orders', label: 'Pedidos Novos Mensais Pagos', type: 'number' },
    { key: 'paid_new_montly_revenue', label: 'Receita Novos Mensais Pagos', type: 'currency' },
    { key: 'paid_recurring_annual_orders', label: 'Pedidos Recorrentes Anuais Pagos', type: 'number' },
    { key: 'paid_recurring_annual_revenue', label: 'Receita Recorrentes Anuais Pagos', type: 'currency' },
    { key: 'paid_recurring_montly_orders', label: 'Pedidos Recorrentes Mensais Pagos', type: 'number' },
    { key: 'paid_recurring_montly_revenue', label: 'Receita Recorrentes Mensais Pagos', type: 'currency' }
  ]
  
  // Estado para métricas de cards (baseado nas métricas)
  // Personalização salva por cliente usando selectedTable como identificador
  const [cardMetrics, setCardMetrics] = useState<string[]>(() => {
    const storageKey = `overview-card-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  
  // Estado para ordem dos cards (drag and drop)
  // Personalização salva por cliente usando selectedTable como identificador
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const storageKey = `overview-card-order-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  
  // Salvar ordem dos cards no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-card-order-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify(cardOrder))
  }, [cardOrder, selectedTable])
  
  // Sincronizar cardOrder com cardMetrics quando cardMetrics mudar
  // Mas apenas adicionar novas métricas, não reordenar as existentes
  // Usar useRef para evitar reordenação durante drag
  const prevCardMetricsRef = useRef<string[]>(cardMetrics)
  const syncCardOrderRef = useRef(false)
  
  useEffect(() => {
    // Não sincronizar durante drag and drop
    if (isDraggingRef.current || syncCardOrderRef.current) {
      return
    }
    
    // Comparar arrays para ver se realmente mudou
    const arraysEqual = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false
      return a.every((val, index) => val === b[index])
    }
    
    if (arraysEqual(prevCardMetricsRef.current, cardMetrics)) {
      return
    }
    
    syncCardOrderRef.current = true
    
    setCardOrder(prevOrder => {
      // Filtrar ordem atual para incluir apenas métricas que ainda estão em cardMetrics
      const validOrder = prevOrder.filter(key => cardMetrics.includes(key))
      // Adicionar novas métricas que não estão na ordem no final
      const missingMetrics = cardMetrics.filter(key => !validOrder.includes(key))
      // Preservar a ordem existente e apenas adicionar as novas no final
      if (missingMetrics.length > 0) {
        prevCardMetricsRef.current = [...cardMetrics]
        syncCardOrderRef.current = false
        return [...validOrder, ...missingMetrics]
      }
      // Se não há novas métricas, manter a ordem atual
      prevCardMetricsRef.current = [...cardMetrics]
      syncCardOrderRef.current = false
      return prevOrder
    })
  }, [cardMetrics])
  
  // Função para lidar com drag start - SIMPLIFICADA
  const handleDragStart = (e: React.DragEvent, cardKey: string) => {
    isDraggingRef.current = true
    setDraggedCard(cardKey)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cardKey)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }
  
  // Função para lidar com drag over - versão simplificada
  const handleCardDragOver = (e: React.DragEvent, cardKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    
    if (cardKey !== draggedCard && dragOverCardRef.current !== cardKey) {
      dragOverCardRef.current = cardKey
      setDragOverCard(cardKey)
    }
  }
  
  // Função para lidar com drag leave - SIMPLIFICADA
  const handleDragLeave = () => {
    setDragOverCard(null)
    dragOverCardRef.current = null
  }
  
  // Função para lidar com drag end - SIMPLIFICADA
  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    // Limpar estado apenas se não houve drop (handleDrop já limpa se houver drop)
    setTimeout(() => {
      if (draggedCard) {
        setDraggedCard(null)
        setDragOverCard(null)
        dragOverCardRef.current = null
        isDraggingRef.current = false
      }
    }, 100)
  }
  
  // Função para lidar com drop - VERSÃO ULTRA SIMPLIFICADA
  const handleDrop = (e: React.DragEvent, dropCardKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const dragCardKey = draggedCard
    
    if (!dragCardKey || dragCardKey === dropCardKey) {
      setDraggedCard(null)
      setDragOverCard(null)
      dragOverCardRef.current = null
      isDraggingRef.current = false
      return
    }
    
    // Se estiver editando um widget específico, atualizar o widget
    if (editingWidget && editingWidget.type === 'cards' && currentWidget) {
      const currentOrder = currentWidget.cardOrder || currentWidget.cardMetrics || []
      const newOrder = [...currentOrder]
      const dragIndex = newOrder.indexOf(dragCardKey)
      const dropIndex = newOrder.indexOf(dropCardKey)
      
      if (dragIndex !== -1 && dropIndex !== -1 && dragIndex !== dropIndex) {
        // Remover da posição original
        newOrder.splice(dragIndex, 1)
        // Inserir na nova posição
        newOrder.splice(dropIndex, 0, dragCardKey)
        
        updateWidget(editingWidget.id, { cardOrder: newOrder })
      }
      
      // Limpar estados
      setDraggedCard(null)
      setDragOverCard(null)
      dragOverCardRef.current = null
      isDraggingRef.current = false
      return
    }
    
    // Reordenar de forma simples e direta (comportamento legado)
    setCardOrder(prevOrder => {
      const newOrder = [...prevOrder]
      const dragIndex = newOrder.indexOf(dragCardKey)
      const dropIndex = newOrder.indexOf(dropCardKey)
      
      if (dragIndex === -1 || dropIndex === -1 || dragIndex === dropIndex) {
        return prevOrder
      }
      
      // Remover da posição original
      newOrder.splice(dragIndex, 1)
      // Inserir na nova posição
      newOrder.splice(dropIndex, 0, dragCardKey)
      
      return newOrder
    })
    
    // Limpar estados
    setDraggedCard(null)
    setDragOverCard(null)
    dragOverCardRef.current = null
    isDraggingRef.current = false
  }
  
  // Salvar métricas de cards no localStorage (por cliente)
  useEffect(() => {
    const storageKey = `overview-card-metrics-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify(cardMetrics))
  }, [cardMetrics, selectedTable])
  
  // Resetar métricas de cards quando mudar de cliente
  useEffect(() => {
    const storageKey = `overview-card-metrics-${selectedTable}` // Chave única por cliente
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setCardMetrics(JSON.parse(saved))
      } catch {
        setCardMetrics([])
      }
    } else {
      setCardMetrics([])
    }
    
    // Resetar ordem dos cards quando mudar de tabela
    const orderKey = `overview-card-order-${selectedTable}` // Chave única por cliente
    const savedOrder = localStorage.getItem(orderKey)
    if (savedOrder) {
      try {
        setCardOrder(JSON.parse(savedOrder))
      } catch {
        setCardOrder([])
      }
    } else {
      setCardOrder([])
    }
  }, [selectedTable])
  
  const toggleCardMetric = (metricKey: string) => {
    // Se estiver editando um widget específico, atualizar o widget
    if (editingWidget && editingWidget.type === 'cards' && currentWidget) {
      const currentMetrics = currentWidget.cardMetrics || []
      let newMetrics: string[]
      
      if (currentMetrics.includes(metricKey)) {
        newMetrics = currentMetrics.filter(key => key !== metricKey)
      } else {
        newMetrics = [...currentMetrics, metricKey]
      }
      
      // Atualizar também o cardOrder se necessário
      const currentOrder = currentWidget.cardOrder || []
      let newOrder = [...currentOrder]
      
      if (newMetrics.includes(metricKey) && !currentOrder.includes(metricKey)) {
        // Adicionar ao final da ordem se não estiver lá
        newOrder.push(metricKey)
      } else if (!newMetrics.includes(metricKey)) {
        // Remover da ordem se foi removido das métricas
        newOrder = newOrder.filter(key => key !== metricKey)
      }
      
      updateWidget(editingWidget.id, { 
        cardMetrics: newMetrics,
        cardOrder: newOrder
      })
      return
    }
    
    // Comportamento legado para estado global
    setCardMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    )
  }
  
  const toggleAllCardMetrics = () => {
    // Se estiver editando um widget específico, atualizar o widget
    if (editingWidget && editingWidget.type === 'cards' && currentWidget) {
      const currentMetrics = currentWidget.cardMetrics || []
      if (currentMetrics.length === metrics.length) {
        updateWidget(editingWidget.id, { 
          cardMetrics: [],
          cardOrder: []
        })
      } else {
        const allMetrics = metrics.map(m => m.key)
        updateWidget(editingWidget.id, { 
          cardMetrics: allMetrics,
          cardOrder: allMetrics
        })
      }
      return
    }
    
    // Comportamento legado para estado global
    if (cardMetrics.length === metrics.length) {
      setCardMetrics([])
    } else {
      setCardMetrics(metrics.map(m => m.key))
    }
  }
  
  const toggleAllTableMetrics = () => {
    // Se estiver editando um widget de tabela, atualizar o widget específico
    if (editingWidget && editingWidget.type === 'table' && currentWidget) {
      const currentMetrics = currentWidget.selectedMetrics || []
      if (currentMetrics.length === metrics.length) {
        updateWidget(editingWidget.id, { selectedMetrics: [] })
      } else {
        updateWidget(editingWidget.id, { selectedMetrics: metrics.map(m => m.key) })
      }
      return
    }

    // Comportamento legado global
    if (selectedMetrics.length === metrics.length) {
      setSelectedMetrics([])
    } else {
      setSelectedMetrics(metrics.map(m => m.key))
    }
  }
  
  // Estados para dimensões e métricas selecionadas - carregar diretamente do localStorage
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(() => {
    const storageKey = `overview-selections-${selectedTable}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.dimensions || []
      } catch {
        return []
      }
    }
    return []
  })
  
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => {
    const storageKey = `overview-selections-${selectedTable}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.metrics || []
      } catch {
        return []
      }
    }
    return []
  })
  
  // Rastrear se é o mount inicial para não salvar no primeiro render
  const isInitialMountRef = useRef<boolean>(true)
  
  // Salvar seleções no localStorage quando mudarem (por cliente)
  // Não salvar no mount inicial para evitar sobrescrever com valores vazios
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }
    const storageKey = `overview-selections-${selectedTable}` // Chave única por cliente
    localStorage.setItem(storageKey, JSON.stringify({
      dimensions: selectedDimensions,
      metrics: selectedMetrics
    }))
  }, [selectedDimensions, selectedMetrics, selectedTable])
  
  // Rastrear selectedTable anterior para só resetar quando realmente mudar
  const prevSelectedTableRef = useRef<string>(selectedTable)
  
  // Resetar seleções quando mudar o cliente (apenas quando selectedTable realmente mudar, não no mount inicial)
  useEffect(() => {
    // Só resetar se o selectedTable realmente mudou (não no mount inicial)
    if (prevSelectedTableRef.current !== selectedTable) {
      const storageKey = `overview-selections-${selectedTable}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setSelectedDimensions(parsed.dimensions || [])
          setSelectedMetrics(parsed.metrics || [])
        } catch {
          setSelectedDimensions(dimensions.map(d => d.key))
          const calculatedMetrics = ['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'revenue_per_session', 'avg_order_value', 'roas', 'new_customer_rate']
          const directMetrics = metrics.filter(m => !calculatedMetrics.includes(m.key))
          setSelectedMetrics(directMetrics.map(m => m.key))
        }
      } else {
        setSelectedDimensions(dimensions.map(d => d.key))
        const calculatedMetrics = ['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'revenue_per_session', 'avg_order_value', 'roas', 'new_customer_rate']
        const directMetrics = metrics.filter(m => !calculatedMetrics.includes(m.key))
        setSelectedMetrics(directMetrics.map(m => m.key))
      }
      prevSelectedTableRef.current = selectedTable
    }
    
    // Carregar presets do cliente (sempre, pois pode mudar mesmo sem mudar selectedTable)
    const presetStorageKey = `overview-presets-${selectedTable}`
    const savedPresets = localStorage.getItem(presetStorageKey)
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets))
      } catch {
        setPresets([])
      }
    } else {
      setPresets([])
    }
  }, [selectedTable, dimensions, metrics])
  
  // Funções para toggle de seleção
  const toggleDimension = (key: string) => {
    // Se estiver editando um widget de tabela, atualizar o widget específico
    if (editingWidget && editingWidget.type === 'table' && currentWidget) {
      const currentDims = currentWidget.selectedDimensions || []
      const newDims = currentDims.includes(key)
        ? currentDims.filter(d => d !== key)
        : [...currentDims, key]

      updateWidget(editingWidget.id, { selectedDimensions: newDims })
      return
    }

    // Comportamento legado global
    setSelectedDimensions(prev => 
      prev.includes(key) 
        ? prev.filter(d => d !== key)
        : [...prev, key]
    )
  }
  
  const toggleMetric = (key: string) => {
    // Se estiver editando um widget de tabela, atualizar o widget específico
    if (editingWidget && editingWidget.type === 'table' && currentWidget) {
      const currentMetrics = currentWidget.selectedMetrics || []
      const newMetrics = currentMetrics.includes(key)
        ? currentMetrics.filter(m => m !== key)
        : [...currentMetrics, key]

      updateWidget(editingWidget.id, { selectedMetrics: newMetrics })
      return
    }

    // Comportamento legado global
    setSelectedMetrics(prev =>
      prev.includes(key)
        ? prev.filter(m => m !== key)
        : [...prev, key]
    )
  }
  
  const toggleAllDimensions = () => {
    // Se estiver editando um widget de tabela, atualizar o widget específico
    if (editingWidget && editingWidget.type === 'table' && currentWidget) {
      const currentDims = currentWidget.selectedDimensions || []
      if (currentDims.length === dimensions.length) {
        updateWidget(editingWidget.id, { selectedDimensions: [] })
      } else {
        updateWidget(editingWidget.id, { selectedDimensions: dimensions.map(d => d.key) })
      }
      return
    }

    // Comportamento legado global
    if (selectedDimensions.length === dimensions.length) {
      setSelectedDimensions([])
    } else {
      setSelectedDimensions(dimensions.map(d => d.key))
    }
  }

  // Funções para gerenciar presets
  const savePreset = () => {
    if (!presetName.trim()) {
      alert('Por favor, digite um nome para o preset')
      return
    }
    
    const newPreset: DashboardPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      selectedDimensions: [...selectedDimensions],
      selectedMetrics: [...selectedMetrics],
      cardMetrics: [...cardMetrics],
      timelineMetrics: [...timelineMetrics],
      cardOrder: [...cardOrder],
      sortField: sortField,
      sortDirection: sortDirection,
      createdAt: new Date().toISOString()
    }
    
    const updatedPresets = [...presets, newPreset]
    setPresets(updatedPresets)
    
    const storageKey = `overview-presets-${selectedTable}`
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets))
    
    setPresetName('')
    setShowPresetInput(false)
  }
  
  const loadPreset = (preset: DashboardPreset) => {
    setSelectedDimensions([...preset.selectedDimensions])
    setSelectedMetrics([...preset.selectedMetrics])
    setCardMetrics([...preset.cardMetrics])
    setTimelineMetrics([...preset.timelineMetrics])
    setCardOrder([...preset.cardOrder])
    // Carregar ordenação da tabela (com valores padrão para presets antigos)
    setSortField(preset.sortField !== undefined ? preset.sortField : null)
    setSortDirection(preset.sortDirection || 'desc')
  }
  
  // Carregar automaticamente o primeiro preset disponível quando os presets forem carregados
  const hasLoadedFirstPresetRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const clientKey = selectedTable
    if (presets.length > 0 && !hasLoadedFirstPresetRef.current[clientKey]) {
      loadPreset(presets[0])
      hasLoadedFirstPresetRef.current[clientKey] = true
    }
  }, [presets, selectedTable])
  
  const deletePreset = (presetId: string) => {
    if (!confirm('Tem certeza que deseja deletar este preset?')) {
      return
    }
    
    const updatedPresets = presets.filter(p => p.id !== presetId)
    setPresets(updatedPresets)
    
    const storageKey = `overview-presets-${selectedTable}`
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets))
  }

  // Estados para drag and drop de presets
  const [draggedPresetId, setDraggedPresetId] = useState<string | null>(null)
  const [dragOverPresetId, setDragOverPresetId] = useState<string | null>(null)

  const handlePresetDragStart = (presetId: string) => {
    setDraggedPresetId(presetId)
  }

  const handlePresetDragOver = (e: React.DragEvent, presetId: string) => {
    e.preventDefault()
    if (draggedPresetId && draggedPresetId !== presetId) {
      setDragOverPresetId(presetId)
    }
  }

  const handlePresetDragLeave = () => {
    setDragOverPresetId(null)
  }

  const handlePresetDrop = (e: React.DragEvent, targetPresetId: string) => {
    e.preventDefault()
    
    if (!draggedPresetId || draggedPresetId === targetPresetId) {
      setDraggedPresetId(null)
      setDragOverPresetId(null)
      return
    }

    const draggedIndex = presets.findIndex(p => p.id === draggedPresetId)
    const targetIndex = presets.findIndex(p => p.id === targetPresetId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedPresetId(null)
      setDragOverPresetId(null)
      return
    }

    // Reordenar os presets
    const updatedPresets = [...presets]
    const [removed] = updatedPresets.splice(draggedIndex, 1)
    updatedPresets.splice(targetIndex, 0, removed)

    setPresets(updatedPresets)
    
    // Salvar no localStorage
    const storageKey = `overview-presets-${selectedTable}`
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets))

    setDraggedPresetId(null)
    setDragOverPresetId(null)
  }

  const handlePresetDragEnd = () => {
    setDraggedPresetId(null)
    setDragOverPresetId(null)
  }

  const widgetsStateRef = useRef<Widget[] | null>(null)
  widgetsStateRef.current = widgets

  // Exportar/importar configurações do dashboard (widgets + presets) - apenas da sub aba ativa
  const handleExportDashboardConfig = () => {
    if (!selectedTable) {
      alert('Nenhum cliente selecionado para exportar configurações.')
      return
    }

    try {
      const storageKey = (DashboardStorage as any).getStorageKey
        ? (DashboardStorage as any).getStorageKey(selectedTable)
        : `overview-dashboard-${selectedTable}`

      let allWidgets: Widget[] = widgetsStateRef.current || []
      let legacy: DashboardConfig['legacy'] | undefined = undefined

      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed.widgets)) {
            allWidgets = parsed.widgets
          }
          if (parsed.legacy) {
            legacy = parsed.legacy
          }
        }
      } catch {
        // Ignorar erros de leitura, usa estado atual
      }

      // Filtrar widgets apenas da sub aba ativa
      const widgetsToExport = activeCustomTab === null
        ? allWidgets.filter(w => !w.customTabId)
        : allWidgets.filter(w => w.customTabId === activeCustomTab)

      // Obter nome da aba para o nome do arquivo
      const tabName = activeCustomTab === null
        ? 'Geral'
        : customTabs.find(t => t.id === activeCustomTab)?.name || 'Aba'

      const payload = {
        type: 'mymetric-overview-dashboard-config',
        version: '1.0',
        table: selectedTable,
        exportedAt: new Date().toISOString(),
        customTabId: activeCustomTab,
        customTabName: tabName,
        widgets: widgetsToExport,
        legacy: legacy || null,
        presets
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeTable = selectedTable.replace(/[^\w-]/g, '_')
      const safeTabName = tabName.replace(/[^\w-]/g, '_')
      a.href = url
      a.download = `overview-dashboard-${safeTable}-${safeTabName}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erro ao exportar configurações do dashboard:', error)
      alert('Erro ao exportar configurações. Por favor, tente novamente.')
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleImportDashboardConfigClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleImportDashboardConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!selectedTable) {
      alert('Nenhum cliente selecionado para importar configurações.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result
        if (typeof text !== 'string') {
          throw new Error('Arquivo inválido')
        }

        const parsed = JSON.parse(text)

        if (parsed.type !== 'mymetric-overview-dashboard-config') {
          alert('Arquivo de configuração inválido.')
          return
        }

        if (!Array.isArray(parsed.widgets)) {
          alert('Arquivo de configuração não contém widgets válidos.')
          return
        }

        // Carregar widgets existentes
        const config = DashboardStorage.loadConfig(selectedTable)
        const existingWidgets: Widget[] = config?.widgets || []
        
        // Remover widgets da sub aba ativa antes de importar
        const widgetsToKeep = activeCustomTab === null
          ? existingWidgets.filter(w => w.customTabId) // Manter widgets de outras abas
          : existingWidgets.filter(w => w.customTabId !== activeCustomTab) // Manter widgets de outras abas e da aba "Geral"

        // Importar widgets e associá-los à sub aba ativa
        const importedWidgets: Widget[] = parsed.widgets.map((w: Widget) => ({
          ...w,
          id: `widget-${Date.now()}-${Math.random()}-${w.type}`, // Gerar novo ID para evitar conflitos
          customTabId: activeCustomTab || undefined // Associar à sub aba ativa
        }))

        // Combinar widgets mantidos com os importados
        const allWidgets = [...widgetsToKeep, ...importedWidgets]
        
        const importedPresets: DashboardPreset[] = Array.isArray(parsed.presets) ? parsed.presets : []

        // Salvar widgets via DashboardStorage
        DashboardStorage.saveConfig(selectedTable, {
          widgets: allWidgets,
          legacy: parsed.legacy || undefined
        })

        // Salvar presets no localStorage
        const presetStorageKey = `overview-presets-${selectedTable}`
        localStorage.setItem(presetStorageKey, JSON.stringify(importedPresets))

        // Atualizar estado
        setWidgets(allWidgets)
        setPresets(importedPresets)

        const tabName = activeCustomTab === null
          ? 'Geral'
          : customTabs.find(t => t.id === activeCustomTab)?.name || 'aba atual'
        
        alert(`Configurações da aba "${tabName}" importadas com sucesso!`)
      } catch (error) {
        console.error('Erro ao importar configurações do dashboard:', error)
        alert('Erro ao importar configurações. Verifique o arquivo e tente novamente.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  // Função para obter o token da API 2.0
  const getV2Token = (): string | null => {
    try {
      const authV2Response = localStorage.getItem('mymetric-auth-v2-response')
      if (authV2Response) {
        const parsed = JSON.parse(authV2Response)
        return parsed.token || null
      }
    } catch (error) {
      console.error('Error getting V2 token:', error)
    }
    return null
  }

  // Função para calcular período anterior
  const getPreviousPeriod = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    // Para períodos de 1 dia, usar o dia anterior
    if (daysDiff === 0) {
      const previousDay = new Date(start)
      previousDay.setDate(previousDay.getDate() - 1)
      return {
        start: previousDay.toISOString().split('T')[0],
        end: previousDay.toISOString().split('T')[0]
      }
    }
    
    const previousEnd = new Date(start)
    previousEnd.setDate(previousEnd.getDate() - 1)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - daysDiff + 1)
    
    return {
      start: previousStart.toISOString().split('T')[0],
      end: previousEnd.toISOString().split('T')[0]
    }
  }

  // Função para calcular crescimento percentual
  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? 100 : 0 // Se não havia dados antes e agora há, crescimento de 100%
    }
    if (current === 0) {
      return previous > 0 ? -100 : 0 // Se havia dados antes e agora não há, queda de 100%
    }
    return ((current - previous) / previous) * 100
  }

  // Função para buscar dados do período anterior
  const fetchPreviousPeriodData = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable || !startDate || !endDate) return

      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoadingPrevious(true)
      
      const previousPeriod = getPreviousPeriod()
      console.log('📊 Fetching previous period:', previousPeriod)
      
      const response = await api.getMetrics(token, {
        start_date: previousPeriod.start,
        end_date: previousPeriod.end,
        table_name: selectedTable
      })

      // Calcular totais do período anterior
      const totals = (response.data || []).reduce((acc: any, item: any) => {
        return {
          sessions: acc.sessions + (item.Sessoes || 0),
          clicks: acc.clicks + (item.Cliques || 0),
          add_to_carts: acc.add_to_carts + (item.Adicoes_ao_Carrinho || 0),
          orders: acc.orders + (item.Pedidos || 0),
          paid_orders: acc.paid_orders + (item.Pedidos_Pagos || 0),
          revenue: acc.revenue + (item.Receita || 0),
          paid_revenue: acc.paid_revenue + (item.Receita_Paga || 0),
          cost: acc.cost + (item.Investimento || 0),
          leads: acc.leads + (item.Leads || 0),
          new_customers: acc.new_customers + (item.Novos_Clientes || 0),
          revenue_new_customers: acc.revenue_new_customers + (item.Receita_Novos_Clientes || 0),
          paid_new_annual_orders: acc.paid_new_annual_orders + (item.Pedidos_Assinatura_Anual_Inicial || 0),
          paid_new_annual_revenue: acc.paid_new_annual_revenue + (item.Receita_Assinatura_Anual_Inicial || 0),
          paid_new_montly_orders: acc.paid_new_montly_orders + (item.Pedidos_Assinatura_Mensal_Inicial || 0),
          paid_new_montly_revenue: acc.paid_new_montly_revenue + (item.Receita_Assinatura_Mensal_Inicial || 0),
          paid_recurring_annual_orders: acc.paid_recurring_annual_orders + (item.Pedidos_Assinatura_Anual_Recorrente || 0),
          paid_recurring_annual_revenue: acc.paid_recurring_annual_revenue + (item.Receita_Assinatura_Anual_Recorrente || 0),
          paid_recurring_montly_orders: acc.paid_recurring_montly_orders + (item.Pedidos_Assinatura_Mensal_Recorrente || 0),
          paid_recurring_montly_revenue: acc.paid_recurring_montly_revenue + (item.Receita_Assinatura_Mensal_Recorrente || 0)
        }
      }, {
        sessions: 0,
        clicks: 0,
        add_to_carts: 0,
        orders: 0,
        paid_orders: 0,
        revenue: 0,
        paid_revenue: 0,
        cost: 0,
        leads: 0,
        new_customers: 0,
        revenue_new_customers: 0,
        paid_new_annual_orders: 0,
        paid_new_annual_revenue: 0,
        paid_new_montly_orders: 0,
        paid_new_montly_revenue: 0,
        paid_recurring_annual_orders: 0,
        paid_recurring_annual_revenue: 0,
        paid_recurring_montly_orders: 0,
        paid_recurring_montly_revenue: 0
      })

      console.log('✅ Previous period totals:', totals)
      setPreviousTotals(totals)
    } catch (error) {
      console.error('❌ Error fetching previous period data:', error)
      setPreviousTotals({
        sessions: 0,
        clicks: 0,
        add_to_carts: 0,
        orders: 0,
        paid_orders: 0,
        revenue: 0,
        paid_revenue: 0,
        cost: 0,
        leads: 0,
        new_customers: 0,
        revenue_new_customers: 0,
        paid_new_annual_orders: 0,
        paid_new_annual_revenue: 0,
        paid_new_montly_orders: 0,
        paid_new_montly_revenue: 0,
        paid_recurring_annual_orders: 0,
        paid_recurring_annual_revenue: 0,
        paid_recurring_montly_orders: 0,
        paid_recurring_montly_revenue: 0
      })
    } finally {
      setIsLoadingPrevious(false)
    }
  }

  // Função para buscar goals
  const fetchGoals = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoadingGoals(true)
      console.log('🎯 Fetching goals for table:', selectedTable)
      
      const response = await api.getGoals(token, {
        table_name: selectedTable
      })
      
      console.log('✅ Goals response:', response)
      setGoals(response)
    } catch (error) {
      console.error('❌ Error fetching goals:', error)
      setGoals(null)
    } finally {
      setIsLoadingGoals(false)
    }
  }

  // Função para buscar dados do mês atual
  const fetchCurrentMonthData = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token || !selectedTable) return

      if (!validateTableName(selectedTable)) {
        return
      }

      setIsLoadingCurrentMonth(true)
      
      const currentDate = new Date()
      const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      const startOfMonth = `${currentMonth}-01`
      const endOfMonth = `${currentMonth}-${new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}`

      console.log('📊 Fetching current month data:', { startOfMonth, endOfMonth, selectedTable })
      
      const response = await api.getMetrics(token, {
        start_date: startOfMonth,
        end_date: endOfMonth,
        table_name: selectedTable
      })

      const currentMonthReceitaPaga = response.data?.reduce((total: number, item: any) => total + (item.Receita_Paga || 0), 0) || 0
      
      setCurrentMonthData({ currentMonthReceitaPaga })
    } catch (error) {
      console.error('❌ Error fetching current month data:', error)
      setCurrentMonthData(null)
    } finally {
      setIsLoadingCurrentMonth(false)
    }
  }

  // Função para calcular run rate da meta do mês
  const calculateRunRate = () => {
    if (!goals || !currentMonthData) return null

    const currentDate = new Date()
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    
    const monthlyGoal = goals.goals?.metas_mensais?.[currentMonth]?.meta_receita_paga
    if (!monthlyGoal) return null

    // Calcular dias no mês atual
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const currentDay = currentDate.getDate()
    
    // Usar receita paga do mês atual
    const currentMonthReceitaPaga = currentMonthData.currentMonthReceitaPaga
    
    // Calcular run rate (receita do mês atual * dias no mês / dia atual)
    const runRate = (currentMonthReceitaPaga * daysInMonth) / currentDay
    
    // Calcular percentual da meta
    const percentageOfGoal = (runRate / monthlyGoal) * 100
    
    return {
      runRate,
      monthlyGoal,
      percentageOfGoal,
      currentDay,
      daysInMonth,
      currentMonthReceitaPaga
    }
  }

  // Salvar meta
  const saveGoal = async () => {
    if (!goalFormData.month || !goalFormData.goal_value) {
      alert('Por favor, preencha todos os campos.')
      return
    }

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      await api.saveMonthlyGoal(token, {
        table_name: selectedTable,
        month: goalFormData.month,
        goal_value: parseFloat(goalFormData.goal_value),
        goal_type: 'revenue_goal'
      })
      
      // Fechar modal e recarregar metas
      setShowGoalModal(false)
      setGoalFormData({ month: '', goal_value: '' })
      setEditingGoal(null)
      fetchGoals()
      
      alert(editingGoal ? 'Meta atualizada com sucesso!' : 'Meta cadastrada com sucesso!')
    } catch (error) {
      console.error('Error saving goal:', error)
      alert('Erro ao salvar meta. Tente novamente.')
    }
  }

  // Abrir modal de nova meta
  const openNewGoalModal = () => {
    setGoalFormData({ month: '', goal_value: '' })
    setEditingGoal(null)
    setShowGoalModal(true)
  }

  // Função para filtrar dados por data
  const filterDataByDateRange = (allDataItems: OverviewDataItem[], start: string, end: string) => {
    if (!start || !end) {
      setData(allDataItems)
      return
    }

    const startDateObj = new Date(start)
    const endDateObj = new Date(end)
    
    const filtered = allDataItems.filter(item => {
      const itemDate = new Date(item.event_date)
      return itemDate >= startDateObj && itemDate <= endDateObj
    })

    setData(filtered)
  }

  // Função para buscar dados com retry
  const fetchDataWithRetry = useCallback(async (token: string, currentJobId: string, maxRetries = 10, retryDelay = 3000) => {
    console.log('📥 Iniciando busca de dados de overview para job:', currentJobId)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dataResponse = await api.getOverviewData(token, currentJobId)
        console.log('✅ Data fetched successfully:', {
          jobId: currentJobId,
          count: dataResponse?.count,
          dataLength: dataResponse?.data?.length,
          attempt
        })
        
        if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
          // Verificar se o jobId ainda é o mesmo antes de atualizar os dados
          if (currentPollingJobIdRef.current && currentPollingJobIdRef.current !== currentJobId) {
            console.log('⚠️ Job ID mudou durante busca de dados, ignorando dados antigos')
            return
          }
          
          // Armazenar todos os dados
          setAllData(dataResponse.data)
          
          // Filtrar por data se necessário (startDate e endDate)
          if (startDate && endDate) {
            const startDateObj = new Date(startDate)
            const endDateObj = new Date(endDate)
            
            const filtered = dataResponse.data.filter((item: OverviewDataItem) => {
              const itemDate = new Date(item.event_date)
              return itemDate >= startDateObj && itemDate <= endDateObj
            })
            
            setData(filtered)
            console.log('📅 Dados filtrados por data:', { 
              total: dataResponse.data.length, 
              filtered: filtered.length,
              startDate,
              endDate
            })
          } else {
            setData(dataResponse.data)
            console.log('📊 Dados carregados sem filtro de data:', dataResponse.data.length)
          }
          
          setJobStatus('completed')
          setJobProgress(`Dados carregados: ${dataResponse.count || dataResponse.data.length} registros`)
          setIsLoading(false)
          setIsPolling(false)
          console.log('✅ Overview data loaded successfully, data length:', dataResponse.data.length)
          
          // Buscar dados do período anterior para comparação
          if (startDate && endDate) {
            fetchPreviousPeriodData()
          }
          
          return
        }
      } catch (error: any) {
        console.error(`❌ Error fetching overview data (attempt ${attempt}/${maxRetries}):`, error)
        
        // Se for erro retryable (404), tentar novamente
        if (error.isRetryable && attempt < maxRetries) {
          console.log(`⏳ Aguardando ${retryDelay}ms antes de tentar novamente...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        // Se não for retryable ou excedeu tentativas, lançar erro
        if (attempt === maxRetries) {
          setJobStatus('error')
          setError('Erro ao buscar dados. Tente novamente.')
          setIsLoading(false)
          setIsPolling(false)
          throw error
        }
      }
    }
  }, [startDate, endDate])

  // Função para fazer polling do status
  const startPolling = useCallback((currentJobId: string, token: string) => {
    // Parar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setIsPolling(true)
    setJobStatus('processing')
    currentPollingJobIdRef.current = currentJobId
    console.log('🔄 Iniciando polling para job:', currentJobId)

    const poll = async () => {
      // Verificar se o jobId ainda é o mesmo
      if (currentPollingJobIdRef.current !== currentJobId) {
        console.log('⚠️ Job ID mudou durante polling, parando polling antigo')
        setIsPolling(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        return
      }
      
      try {
        const statusResponse = await api.getOverviewJobStatus(token, currentJobId)
        console.log('📊 Job Status Response:', { 
          jobId: currentJobId, 
          status: statusResponse.status, 
          progress: statusResponse.progress,
          elapsed: statusResponse.elapsed_seconds 
        })
        
        // Verificar novamente se o jobId ainda é o mesmo
        if (currentPollingJobIdRef.current !== currentJobId) {
          console.log('⚠️ Job ID mudou durante processamento da resposta, ignorando')
          return
        }
        
        // Atualizar elapsed_seconds se disponível
        if (statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null) {
          setElapsedSeconds(statusResponse.elapsed_seconds)
        }
        
        // Formatar progresso com tempo decorrido
        const progressText = statusResponse.progress || 'Processando...'
        const elapsedText = statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null
          ? ` (${Math.round(statusResponse.elapsed_seconds)}s)`
          : ''
        setJobProgress(`${progressText}${elapsedText}`)

        if (statusResponse.status === 'completed') {
          // Job concluído, buscar dados
          console.log('✅ Job concluído, buscando dados para job:', currentJobId)
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          setJobProgress('Processamento concluído, baixando dados...')
          await fetchDataWithRetry(token, currentJobId)
        } else if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
          // Job falhou
          setIsPolling(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setJobStatus('error')
          setIsLoading(false)
          setError('Erro ao processar dados. Tente novamente.')
        }
        // Se ainda está processando, continua o polling
      } catch (error) {
        console.error('Error polling status:', error)
        // Não para o polling em caso de erro temporário
      }
    }

    // Executar primeira verificação imediatamente
    poll()
    
    // Configurar polling principal a cada 3 segundos
    pollingIntervalRef.current = setInterval(poll, 3000)
    console.log('⏰ Polling configurado para verificar a cada 3 segundos')
  }, [fetchDataWithRetry])

  // Função para iniciar o processamento
  const startProcessing = useCallback(async () => {
    // Proteção contra múltiplas execuções simultâneas
    if (isProcessingRef.current) {
      console.log('⚠️ Processamento já em andamento, ignorando chamada duplicada')
      return
    }
    
    // Verificar se o selectedTable ainda é o mesmo que iniciou o processamento
    if (hasStartedProcessingRef.current !== selectedTable) {
      console.log('⚠️ selectedTable mudou, cancelando processamento')
      return
    }

    // Marcar imediatamente para evitar race condition
    isProcessingRef.current = true

    // Tentar obter o token com retry (aguardar até 5 segundos)
    let token = getV2Token()
    if (!token) {
      console.log('⏳ Token não encontrado imediatamente, aguardando...')
      // Tentar obter o token várias vezes antes de mostrar erro
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)) // Aguardar 500ms
        token = getV2Token()
        if (token) {
          console.log('✅ Token encontrado após espera')
          break
        }
      }
    }

    if (!token) {
      setJobStatus('error')
      setIsLoading(false)
      setError('Token de autenticação não encontrado')
      isProcessingRef.current = false
      return
    }

    if (!validateTableName(selectedTable)) {
      setJobStatus('error')
      setIsLoading(false)
      setError('Tabela inválida')
      isProcessingRef.current = false
      return
    }

    // Limpar dados e estado antes de iniciar novo processamento
    console.log('🔄 Iniciando novo processamento de overview para:', selectedTable)
    
    // Parar qualquer polling anterior
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setIsLoading(true)
    setJobStatus('processing')
    setJobProgress('Iniciando processamento...')
    setElapsedSeconds(null)
    setError(null)
    setData([])
    setAllData([])

    try {
      // Criar job
      const jobResponse = await api.createOverviewJob(token, selectedTable)
      console.log('📦 Job criado:', jobResponse)
      
      const newJobId = jobResponse.id || jobResponse.job_id || jobResponse.request_id
      if (!newJobId) {
        throw new Error('Job ID não encontrado na resposta')
      }
      
      setJobId(newJobId)
      hasStartedProcessingRef.current = selectedTable
      currentPollingJobIdRef.current = newJobId
      
      // Iniciar polling
      startPolling(newJobId, token)
      isProcessingRef.current = false
    } catch (error) {
      console.error('❌ Erro ao criar job:', error)
      setJobStatus('error')
      setIsLoading(false)
      setError(error instanceof Error ? error.message : 'Erro ao iniciar processamento')
      isProcessingRef.current = false
    }
  }, [selectedTable, startPolling])

  // Iniciar processamento quando selectedTable mudar
  useEffect(() => {
    if (!selectedTable) return
    
    hasStartedProcessingRef.current = selectedTable
    startProcessing()

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      isProcessingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable])

  // Buscar goals quando a tabela mudar (não bloqueia render)
  useEffect(() => {
    if (!selectedTable) return
    
    // Usar requestIdleCallback ou setTimeout para não bloquear render
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fetchGoals()
      }, { timeout: 100 })
    } else {
      setTimeout(() => {
        fetchGoals()
      }, 0)
    }
  }, [selectedTable])

  // Buscar dados do mês atual quando a tabela mudar (não bloqueia render)
  useEffect(() => {
    if (!selectedTable) return
    
    // Usar requestIdleCallback ou setTimeout para não bloquear render
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fetchCurrentMonthData()
      }, { timeout: 100 })
    } else {
      setTimeout(() => {
        fetchCurrentMonthData()
      }, 0)
    }
  }, [selectedTable])

  // Filtrar dados quando startDate ou endDate mudarem (se já houver dados)
  useEffect(() => {
    if (allData.length > 0 && startDate && endDate) {
      filterDataByDateRange(allData, startDate, endDate)
      // Buscar dados do período anterior quando datas mudarem
      fetchPreviousPeriodData()
    }
  }, [startDate, endDate, allData])
  
  // Aplicar filtros de dimensões aos dados
  const filteredData = useMemo(() => {
    if (Object.keys(dimensionFilters).length === 0) {
      return data
    }
    
    return data.filter(item => {
      // Verificar se o item passa por todos os filtros
      for (const [dimensionKey, filterValues] of Object.entries(dimensionFilters)) {
        const itemValue = String(item[dimensionKey as keyof OverviewDataItem] || '')
        if (!filterValues.has(itemValue)) {
          return false
        }
      }
      return true
    })
  }, [data, dimensionFilters])

  // Preparar dados para timeline usando dados filtrados
  const timelineData = useMemo(() => {
    if (!filteredData || filteredData.length === 0 || timelineMetrics.length === 0) return []
    
    // Agrupar dados por data
    const groupedByDate = filteredData.reduce((acc, item) => {
      const date = item.event_date
      if (!acc[date]) {
        acc[date] = {
          date,
          sessions: 0,
          clicks: 0,
          add_to_carts: 0,
          orders: 0,
          paid_orders: 0,
          revenue: 0,
          paid_revenue: 0,
          cost: 0,
          leads: 0,
          new_customers: 0,
          revenue_new_customers: 0,
          conversion_rate: 0,
          add_to_cart_rate: 0,
          leads_conversion_rate: 0,
          paid_conversion_rate: 0,
          revenue_per_session: 0,
          avg_order_value: 0,
          roas: 0,
          new_customer_rate: 0
        }
      }
      acc[date].sessions += item.sessions || 0
      acc[date].clicks += item.clicks || 0
      acc[date].add_to_carts += item.add_to_carts || 0
      acc[date].orders += item.orders || 0
      acc[date].paid_orders += item.paid_orders || 0
      acc[date].revenue += item.revenue || 0
      acc[date].paid_revenue += item.paid_revenue || 0
      acc[date].cost += item.cost || 0
      acc[date].leads += item.leads || 0
      acc[date].new_customers += item.new_customers || 0
      acc[date].revenue_new_customers += item.revenue_new_customers || 0
      // Novas métricas
      acc[date].paid_new_annual_orders += item.paid_new_annual_orders || 0
      acc[date].paid_new_annual_revenue += item.paid_new_annual_revenue || 0
      acc[date].paid_new_montly_orders += item.paid_new_montly_orders || 0
      acc[date].paid_new_montly_revenue += item.paid_new_montly_revenue || 0
      acc[date].paid_recurring_annual_orders += item.paid_recurring_annual_orders || 0
      acc[date].paid_recurring_annual_revenue += item.paid_recurring_annual_revenue || 0
      acc[date].paid_recurring_montly_orders += item.paid_recurring_montly_orders || 0
      acc[date].paid_recurring_montly_revenue += item.paid_recurring_montly_revenue || 0
      return acc
    }, {} as Record<string, any>)
    
    // Calcular métricas derivadas para cada data
    return Object.values(groupedByDate)
      .map(item => {
        const sessions = item.sessions || 0
        const orders = item.orders || 0
        const paid_orders = item.paid_orders || 0
        const revenue = item.revenue || 0
        const paid_revenue = item.paid_revenue || 0
        const cost = item.cost || 0
        const add_to_carts = item.add_to_carts || 0
        const leads = item.leads || 0
        const new_customers = item.new_customers || 0
        
        return {
          ...item,
          conversion_rate: orders > 0 && sessions > 0 ? (orders / sessions) * 100 : 0,
          add_to_cart_rate: add_to_carts > 0 && sessions > 0 ? (add_to_carts / sessions) * 100 : 0,
          leads_conversion_rate: leads > 0 && sessions > 0 ? (leads / sessions) * 100 : 0,
          paid_conversion_rate: paid_orders > 0 && orders > 0 ? (paid_orders / orders) * 100 : 0,
          revenue_per_session: revenue > 0 && sessions > 0 ? revenue / sessions : 0,
          avg_order_value: revenue > 0 && orders > 0 ? revenue / orders : 0,
          roas: cost > 0 ? revenue / cost : 0,
          new_customer_rate: new_customers > 0 && orders > 0 ? (new_customers / orders) * 100 : 0
        }
      })
      .sort((a, b) => {
        const [yearA, monthA, dayA] = a.date.split('-').map(Number)
        const [yearB, monthB, dayB] = b.date.split('-').map(Number)
        const dateA = new Date(yearA, monthA - 1, dayA)
        const dateB = new Date(yearB, monthB - 1, dayB)
        return dateA.getTime() - dateB.getTime()
      })
  }, [filteredData, timelineMetrics])

  // Calcular totais agregados usando filteredData para estar consistente com filtros
  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => {
      acc.add_to_carts += item.add_to_carts || 0
      acc.clicks += item.clicks || 0
      acc.cost += item.cost || 0
      acc.leads += item.leads || 0
      acc.new_customers += item.new_customers || 0
      acc.orders += item.orders || 0
      acc.paid_orders += item.paid_orders || 0
      acc.paid_revenue += item.paid_revenue || 0
      acc.revenue += item.revenue || 0
      acc.revenue_new_customers += item.revenue_new_customers || 0
      acc.sessions += item.sessions || 0
      // Novas métricas
      acc.paid_new_annual_orders += item.paid_new_annual_orders || 0
      acc.paid_new_annual_revenue += item.paid_new_annual_revenue || 0
      acc.paid_new_montly_orders += item.paid_new_montly_orders || 0
      acc.paid_new_montly_revenue += item.paid_new_montly_revenue || 0
      acc.paid_recurring_annual_orders += item.paid_recurring_annual_orders || 0
      acc.paid_recurring_annual_revenue += item.paid_recurring_annual_revenue || 0
      acc.paid_recurring_montly_orders += item.paid_recurring_montly_orders || 0
      acc.paid_recurring_montly_revenue += item.paid_recurring_montly_revenue || 0
      return acc
    }, {
      add_to_carts: 0,
      clicks: 0,
      cost: 0,
      leads: 0,
      new_customers: 0,
      orders: 0,
      paid_orders: 0,
      paid_revenue: 0,
      revenue: 0,
      revenue_new_customers: 0,
      sessions: 0,
      // Novas métricas
      paid_new_annual_orders: 0,
      paid_new_annual_revenue: 0,
      paid_new_montly_orders: 0,
      paid_new_montly_revenue: 0,
      paid_recurring_annual_orders: 0,
      paid_recurring_annual_revenue: 0,
      paid_recurring_montly_orders: 0,
      paid_recurring_montly_revenue: 0
    })
  }, [filteredData])
  
  // Debug: log dos dados
  useEffect(() => {
    console.log('📊 Estado dos dados:', {
      dataLength: data.length,
      allDataLength: allData.length,
      filteredDataLength: filteredData.length,
      cardMetricsCount: cardMetrics.length,
      selectedDimensionsCount: selectedDimensions.length,
      selectedMetricsCount: selectedMetrics.length,
      jobStatus,
      isLoading,
      isPolling
    })
  }, [data.length, allData.length, filteredData.length, cardMetrics.length, selectedDimensions.length, selectedMetrics.length, jobStatus, isLoading, isPolling])

  // Calcular métricas derivadas
  const conversionRate = totals.sessions > 0 ? (totals.orders / totals.sessions) * 100 : 0
  const paidConversionRate = totals.orders > 0 ? (totals.paid_orders / totals.orders) * 100 : 0
  const addToCartRate = totals.sessions > 0 ? (totals.add_to_carts / totals.sessions) * 100 : 0
  const revenuePerSession = totals.sessions > 0 ? totals.revenue / totals.sessions : 0
  const avgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0
  const tacos = totals.revenue > 0 ? (totals.cost / totals.revenue) * 100 : 0
  const roas = totals.cost > 0 ? totals.revenue / totals.cost : 0
  const leadsConversionRate = totals.sessions > 0 ? (totals.leads / totals.sessions) * 100 : 0
  const newCustomerRate = totals.orders > 0 ? (totals.new_customers / totals.orders) * 100 : 0

  // Calcular métricas derivadas do período anterior
  const previousConversionRate = previousTotals.sessions > 0 ? (previousTotals.orders / previousTotals.sessions) * 100 : 0
  const previousPaidConversionRate = previousTotals.orders > 0 ? (previousTotals.paid_orders / previousTotals.orders) * 100 : 0
  const previousAddToCartRate = previousTotals.sessions > 0 ? (previousTotals.add_to_carts / previousTotals.sessions) * 100 : 0
  const previousRevenuePerSession = previousTotals.sessions > 0 ? previousTotals.revenue / previousTotals.sessions : 0
  const previousAvgOrderValue = previousTotals.orders > 0 ? previousTotals.revenue / previousTotals.orders : 0
  const previousTacos = previousTotals.revenue > 0 ? (previousTotals.cost / previousTotals.revenue) * 100 : 0
  const previousRoas = previousTotals.cost > 0 ? previousTotals.revenue / previousTotals.cost : 0
  const previousLeadsConversionRate = previousTotals.sessions > 0 ? (previousTotals.leads / previousTotals.sessions) * 100 : 0
  const previousNewCustomerRate = previousTotals.orders > 0 ? (previousTotals.new_customers / previousTotals.orders) * 100 : 0

  // Função para obter o growth de uma métrica
  const getMetricGrowth = (metricKey: string): number | undefined => {
    if (isLoadingPrevious) return undefined
    
    if (metricKey === 'sessions') return calculateGrowth(totals.sessions, previousTotals.sessions)
    if (metricKey === 'clicks') return calculateGrowth(totals.clicks, previousTotals.clicks)
    if (metricKey === 'add_to_carts') return calculateGrowth(totals.add_to_carts, previousTotals.add_to_carts)
    if (metricKey === 'orders') return calculateGrowth(totals.orders, previousTotals.orders)
    if (metricKey === 'paid_orders') return calculateGrowth(totals.paid_orders, previousTotals.paid_orders)
    if (metricKey === 'revenue') return calculateGrowth(totals.revenue, previousTotals.revenue)
    if (metricKey === 'paid_revenue') return calculateGrowth(totals.paid_revenue, previousTotals.paid_revenue)
    if (metricKey === 'cost') return calculateGrowth(totals.cost, previousTotals.cost)
    if (metricKey === 'leads') return calculateGrowth(totals.leads, previousTotals.leads)
    if (metricKey === 'new_customers') return calculateGrowth(totals.new_customers, previousTotals.new_customers)
    if (metricKey === 'revenue_new_customers') return calculateGrowth(totals.revenue_new_customers, previousTotals.revenue_new_customers)
    if (metricKey === 'conversion_rate') return calculateGrowth(conversionRate, previousConversionRate)
    if (metricKey === 'add_to_cart_rate') return calculateGrowth(addToCartRate, previousAddToCartRate)
    if (metricKey === 'leads_conversion_rate') return calculateGrowth(leadsConversionRate, previousLeadsConversionRate)
    if (metricKey === 'paid_conversion_rate') return calculateGrowth(paidConversionRate, previousPaidConversionRate)
    if (metricKey === 'revenue_per_session') return calculateGrowth(revenuePerSession, previousRevenuePerSession)
    if (metricKey === 'avg_order_value') return calculateGrowth(avgOrderValue, previousAvgOrderValue)
    if (metricKey === 'roas') return calculateGrowth(roas, previousRoas)
    if (metricKey === 'new_customer_rate') return calculateGrowth(newCustomerRate, previousNewCustomerRate)
    // Novas métricas
    if (metricKey === 'paid_new_annual_orders') return calculateGrowth(totals.paid_new_annual_orders || 0, previousTotals.paid_new_annual_orders)
    if (metricKey === 'paid_new_annual_revenue') return calculateGrowth(totals.paid_new_annual_revenue || 0, previousTotals.paid_new_annual_revenue)
    if (metricKey === 'paid_new_montly_orders') return calculateGrowth(totals.paid_new_montly_orders || 0, previousTotals.paid_new_montly_orders)
    if (metricKey === 'paid_new_montly_revenue') return calculateGrowth(totals.paid_new_montly_revenue || 0, previousTotals.paid_new_montly_revenue)
    if (metricKey === 'paid_recurring_annual_orders') return calculateGrowth(totals.paid_recurring_annual_orders || 0, previousTotals.paid_recurring_annual_orders)
    if (metricKey === 'paid_recurring_annual_revenue') return calculateGrowth(totals.paid_recurring_annual_revenue || 0, previousTotals.paid_recurring_annual_revenue)
    if (metricKey === 'paid_recurring_montly_orders') return calculateGrowth(totals.paid_recurring_montly_orders || 0, previousTotals.paid_recurring_montly_orders)
    if (metricKey === 'paid_recurring_montly_revenue') return calculateGrowth(totals.paid_recurring_montly_revenue || 0, previousTotals.paid_recurring_montly_revenue)
    return undefined
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Calcular run rate da meta do mês
  const runRateData = calculateRunRate()

  // Componente RunRateHighlight
  const RunRateHighlight = ({ runRateData, isLoadingGoals, isLoadingCurrentMonth }: { runRateData: any, isLoadingGoals: boolean, isLoadingCurrentMonth: boolean }) => {
    if (isLoadingGoals || isLoadingCurrentMonth) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
            <span className="text-sm text-gray-700">Carregando metas...</span>
          </div>
        </div>
      )
    }

    if (!runRateData) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="text-center">
            <Target className="w-5 h-5 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-700 mb-2">Run Rate da Meta</h3>
            <p className="text-xs text-gray-500 mb-4">Meta não disponível</p>
            <button
              onClick={openNewGoalModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 mx-auto"
            >
              <Target className="w-4 h-4" />
              Cadastrar Meta
            </button>
          </div>
        </div>
      )
    }

    const { runRate, monthlyGoal, percentageOfGoal, currentDay, daysInMonth } = runRateData
    const isOnTrack = percentageOfGoal >= 100
    const progressWidth = Math.min(percentageOfGoal, 100)

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Run Rate da Meta</h2>
              <p className="text-sm text-gray-600">Projeção mensal</p>
            </div>
          </div>
          
          {/* Status Badge - Mobile Optimized */}
          <div className={`px-4 py-2 rounded-xl text-center shadow-sm ${
            isOnTrack 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
              : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200'
          }`}>
            <p className="text-sm font-semibold">
              {isOnTrack ? '✅ No caminho' : '⚠️ Atrasado'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Dia {currentDay} de {daysInMonth}
            </p>
          </div>
        </div>

        {/* Main Content - Mobile Optimized Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Run Rate Projetado */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center border border-blue-100">
            <p className="text-sm font-medium text-blue-700 mb-2">Run Rate Projetado</p>
            <p className="text-xl font-bold text-blue-900">{formatCurrency(runRate)}</p>
            <p className="text-xs text-blue-600 mt-1">Projeção mensal</p>
          </div>

          {/* Meta Mensal */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center border border-purple-100">
            <p className="text-sm font-medium text-purple-700 mb-2">Meta Mensal</p>
            <p className="text-xl font-bold text-purple-900">{formatCurrency(monthlyGoal)}</p>
            <p className="text-xs text-purple-600 mt-1">Objetivo</p>
          </div>

          {/* Progresso */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 text-center border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Progresso</p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`text-2xl font-bold ${
                isOnTrack ? 'text-green-600' : 'text-red-600'
              }`}>
                {percentageOfGoal.toFixed(1)}%
              </span>
              {isOnTrack ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
            </div>
            
            {/* Progress Bar - Enhanced */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ease-out ${
                  isOnTrack ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-pink-500'
                }`}
                style={{ width: `${progressWidth}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600">
              {progressWidth.toFixed(1)}% da meta
            </p>
          </div>
        </div>

        {/* Enhanced Progress Visualization - Mobile Optimized */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Progresso Visual</span>
            <span className="text-xs text-gray-500">
              {currentDay}/{daysInMonth} dias
            </span>
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-700 ease-out shadow-sm ${
                  isOnTrack 
                    ? 'bg-gradient-to-r from-green-400 via-green-500 to-emerald-500' 
                    : 'bg-gradient-to-r from-red-400 via-red-500 to-pink-500'
                }`}
                style={{ width: `${progressWidth}%` }}
              ></div>
            </div>
            
            {/* Progress Indicator */}
            <div 
              className={`absolute top-0 w-1 h-3 rounded-full shadow-lg ${
                isOnTrack ? 'bg-green-600' : 'bg-red-600'
              }`}
              style={{ left: `calc(${progressWidth}% - 2px)` }}
            ></div>
          </div>
          
          {/* Progress Labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Bottom Info - Enhanced */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-gray-700">Baseado em {currentDay} dias</p>
              <p className="text-xs text-gray-500">Dados até hoje</p>
            </div>
            <div className="text-center sm:text-right">
              <p className={`text-sm font-semibold ${
                isOnTrack ? 'text-green-600' : 'text-red-600'
              }`}>
                {isOnTrack ? '🎯 Meta será atingida' : '⚠️ Meta em risco'}
              </p>
              <p className="text-xs text-gray-500">
                {isOnTrack ? 'Continue assim!' : 'Ação necessária'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Função para exportar dados da tabela para XLSX
  const handleDownloadXLSX = () => {
    if (selectedDimensions.length === 0 || selectedMetrics.length === 0 || filteredData.length === 0) {
      alert('Não há dados para exportar. Selecione dimensões e métricas no painel de personalização.')
      return
    }

    try {
      // Agrupar dados pelas dimensões selecionadas (mesma lógica da tabela)
      const groupedData = filteredData.reduce((acc, item) => {
        const groupKey = selectedDimensions.map(dimKey => 
          String(item[dimKey as keyof OverviewDataItem] || '-')
        ).join('|')
        
        if (!acc[groupKey]) {
          acc[groupKey] = {
            dimensions: selectedDimensions.reduce((dims, dimKey) => {
              dims[dimKey] = item[dimKey as keyof OverviewDataItem]
              return dims
            }, {} as Record<string, any>),
            metrics: (() => {
              const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
              const allMetricsToInit = [...new Set([...baseMetrics, ...selectedMetrics])]
              return allMetricsToInit.reduce((mets, metKey) => {
                mets[metKey] = 0
                return mets
              }, {} as Record<string, number>)
            })()
          }
        }
        
        const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
        baseMetrics.forEach(metKey => {
          const value = item[metKey as keyof OverviewDataItem] as number || 0
          acc[groupKey].metrics[metKey] = (acc[groupKey].metrics[metKey] || 0) + value
        })
        
        return acc
      }, {} as Record<string, { dimensions: Record<string, any>, metrics: Record<string, number> }>)
      
      // Converter para array e calcular métricas derivadas
      let groupedArray = Object.values(groupedData).map(group => {
        const calcMetrics = { ...group.metrics }
        const sessions = group.metrics.sessions || 0
        const orders = group.metrics.orders || 0
        const paid_orders = group.metrics.paid_orders || 0
        const revenue = group.metrics.revenue || 0
        const paid_revenue = group.metrics.paid_revenue || 0
        const cost = group.metrics.cost || 0
        const add_to_carts = group.metrics.add_to_carts || 0
        const leads = group.metrics.leads || 0
        const new_customers = group.metrics.new_customers || 0
        
        if (selectedMetrics.includes('conversion_rate')) {
          calcMetrics.conversion_rate = sessions > 0 ? (orders / sessions) * 100 : 0
        }
        if (selectedMetrics.includes('add_to_cart_rate')) {
          calcMetrics.add_to_cart_rate = sessions > 0 ? (add_to_carts / sessions) * 100 : 0
        }
        if (selectedMetrics.includes('leads_conversion_rate')) {
          calcMetrics.leads_conversion_rate = sessions > 0 ? (leads / sessions) * 100 : 0
        }
        if (selectedMetrics.includes('paid_conversion_rate')) {
          calcMetrics.paid_conversion_rate = orders > 0 ? (paid_orders / orders) * 100 : 0
        }
        if (selectedMetrics.includes('revenue_per_session')) {
          calcMetrics.revenue_per_session = sessions > 0 ? revenue / sessions : 0
        }
        if (selectedMetrics.includes('avg_order_value')) {
          calcMetrics.avg_order_value = orders > 0 ? revenue / orders : 0
        }
        if (selectedMetrics.includes('roas')) {
          calcMetrics.roas = cost > 0 ? revenue / cost : 0
        }
        if (selectedMetrics.includes('new_customer_rate')) {
          calcMetrics.new_customer_rate = orders > 0 ? (new_customers / orders) * 100 : 0
        }
        
        return {
          ...group,
          metrics: calcMetrics
        }
      })
      
      // Aplicar ordenação se houver campo selecionado
      if (sortField) {
        groupedArray = groupedArray.sort((a, b) => {
          let aValue: any
          let bValue: any
          
          if (selectedDimensions.includes(sortField)) {
            aValue = a.dimensions[sortField]
            bValue = b.dimensions[sortField]
          } else if (selectedMetrics.includes(sortField)) {
            aValue = a.metrics[sortField] || 0
            bValue = b.metrics[sortField] || 0
          } else {
            return 0
          }
          
          if (selectedMetrics.includes(sortField)) {
            const aNum = typeof aValue === 'number' ? aValue : parseFloat(String(aValue)) || 0
            const bNum = typeof bValue === 'number' ? bValue : parseFloat(String(bValue)) || 0
            return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
          }
          
          const aStr = String(aValue || '').toLowerCase()
          const bStr = String(bValue || '').toLowerCase()
          return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
        })
      }
      
      // Preparar dados para exportação
      const dataToExport = groupedArray.map(group => {
        const row: Record<string, any> = {}
        
        // Adicionar dimensões
        selectedDimensions.forEach(dimKey => {
          const dimension = dimensions.find(d => d.key === dimKey)
          row[dimension?.label || dimKey] = group.dimensions[dimKey] || '-'
        })
        
        // Adicionar métricas formatadas
        selectedMetrics.forEach(metKey => {
          const metric = metrics.find(m => m.key === metKey)
          const value = group.metrics[metKey] || 0
          
          if (!metric) {
            row[metKey] = value
            return
          }
          
          if (metric.type === 'currency') {
            // Para Excel, usar número em vez de string formatada
            row[metric.label] = value
          } else if (metric.type === 'percentage') {
            // Para Excel, usar número (porcentagem como decimal)
            row[metric.label] = value / 100
          } else if (metKey === 'roas') {
            row[metric.label] = value
          } else {
            row[metric.label] = value
          }
        })
        
        return row
      })
      
      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dataToExport)
      
      // Ajustar largura das colunas
      const colCount = selectedDimensions.length + selectedMetrics.length
      const colWidths = Array(colCount).fill(null).map(() => ({ wch: 15 }))
      ws['!cols'] = colWidths
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Dados')
      
      // Gerar nome do arquivo com data
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const safeTable = selectedTable.replace(/[^\w-]/g, '_')
      const filename = `overview-${safeTable}-${dateStr}.xlsx`
      
      // Download do arquivo
      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error('Erro ao gerar XLSX:', error)
      alert('Erro ao gerar arquivo Excel. Por favor, tente novamente.')
    }
  }

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    format = 'number',
    color = 'blue',
    isDragOver = false,
    growth
  }: {
    title: string
    value: number
    icon: any
    format?: 'number' | 'currency' | 'percentage'
    color?: string
    isDragOver?: boolean
    growth?: number
  }) => {
    const formatValue = () => {
      switch (format) {
        case 'currency':
          return formatCurrency(value)
        case 'percentage':
          return `${value.toFixed(2)}%`
        default:
          return formatNumber(value)
      }
    }

    const colorClasses = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
      red: 'bg-red-100 text-red-600',
      gray: 'bg-gray-100 text-gray-600'
    }

    return (
      <div className={`bg-white rounded-xl shadow-lg p-4 border transition-all duration-200 ${
        isDragOver 
          ? 'border-blue-500 border-2 shadow-2xl bg-blue-50/30' 
          : 'border-gray-100 hover:shadow-xl hover:border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg transition-transform ${
            colorClasses[color as keyof typeof colorClasses] || colorClasses.blue
          } ${isDragOver ? 'scale-110' : ''}`}>
            <Icon className="w-5 h-5" />
          </div>
          {isLoadingPrevious ? (
            <div className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span className="text-xs text-gray-500">Comparando...</span>
            </div>
          ) : growth !== undefined && growth !== 0 && (
            <div className="flex items-center gap-1">
              {growth > 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : growth < 0 ? (
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              ) : null}
              <span className={`text-sm font-medium ${growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-900">{formatValue()}</p>
      </div>
    )
  }

  // Se estiver processando, mostrar indicador inline no topo
  const isProcessing = isLoading || isPolling || jobStatus === 'processing'

  if (error || jobStatus === 'error') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Erro: {error || 'Erro ao processar dados'}</p>
          <button
            onClick={() => startProcessing()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Removido indicador do header para evitar duplicação - apenas no indicador grande abaixo */}
        </div>
      </div>

      {/* Indicador de processamento quando não há dados ainda */}
      {isProcessing && data.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="text-blue-800 font-medium">{jobProgress || 'Processando dados...'}</p>
              {elapsedSeconds !== null && (
                <p className="text-blue-600 text-sm mt-1">Tempo decorrido: {Math.round(elapsedSeconds)}s</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Indicador de Filtros Ativos */}
      {Object.keys(dimensionFilters).length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-blue-900">Filtros ativos:</span>
              {Object.entries(dimensionFilters).map(([dimKey, values]) => {
                const dimension = dimensions.find(d => d.key === dimKey)
                return (
                  <div key={dimKey} className="flex items-center gap-1">
                    <span className="text-xs font-medium text-blue-700">{dimension?.label}:</span>
                    {Array.from(values).map((value, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {value}
                        <button
                          onClick={() => toggleDimensionFilter(dimKey, value)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => clearDimensionFilter(dimKey)}
                      className="text-xs text-blue-600 hover:text-blue-800 ml-1"
                    >
                      Limpar
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              onClick={clearAllFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpar Todos
            </button>
          </div>
        </div>
      )}


      {/* Run Rate da Meta (legado - só mostrar se não houver widgets do novo sistema) */}
      {widgets.length === 0 && (
      <RunRateHighlight 
        runRateData={runRateData} 
        isLoadingGoals={isLoadingGoals}
        isLoadingCurrentMonth={isLoadingCurrentMonth}
      />
      )}

      {/* Botão para adicionar widgets */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 ${
              isEditMode
                ? 'text-blue-700 bg-blue-50 border border-blue-300 hover:bg-blue-100'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
            title={isEditMode ? 'Modo Edição - Clique para visualização' : 'Modo Visualização - Clique para edição'}
          >
            {isEditMode ? (
              <>
                <Pencil className="w-4 h-4" />
                Modo Edição
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Modo Visualização
              </>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && customTabs.length === 0 && (
            <button
              onClick={() => {
                setEditingCustomTab(null)
                setCustomTabFormData({ name: '', icon: 'BarChart3', order: 0 })
                setShowCustomTabModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
              title="Criar primeira sub aba personalizada"
            >
              <Plus className="w-4 h-4" />
              Criar Sub Aba
            </button>
          )}
          {isEditMode && (
            <>
              <button
                onClick={handleExportDashboardConfig}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                title={`Exportar configurações da aba atual (${activeCustomTab === null ? 'Geral' : customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
              >
                <Download className="w-4 h-4" />
                Exportar Aba
              </button>
              <button
                onClick={handleImportDashboardConfigClick}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                title={`Importar configurações para a aba atual (${activeCustomTab === null ? 'Geral' : customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
              >
                <FolderOpen className="w-4 h-4" />
                Importar Aba
              </button>
            </>
          )}
          {isEditMode && (
            <>
              {widgets.length > 1 && (
                <button
                  onClick={() => setShowReorderModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                >
                  <GripVertical className="w-4 h-4 text-gray-500" />
                  Reordenar Widgets
                </button>
              )}
              <button
                onClick={() => setShowAddWidgetModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Adicionar Widget
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navegação de Sub Abas Personalizadas */}
      {customTabs.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {/* Botão para mostrar widgets sem sub aba */}
            <button
              onClick={() => setActiveCustomTab(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                activeCustomTab === null
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>Geral</span>
            </button>
            
            {/* Sub abas personalizadas */}
            {customTabs.map((tab) => {
              const IconComponent = iconMap[tab.icon] || BarChart3
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCustomTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                    activeCustomTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  draggable={isEditMode}
                  onDragStart={(e) => {
                    if (isEditMode) {
                      setDraggedCustomTab(tab.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }
                  }}
                  onDragOver={(e) => {
                    if (isEditMode && draggedCustomTab && draggedCustomTab !== tab.id) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }}
                  onDrop={(e) => {
                    if (isEditMode && draggedCustomTab && draggedCustomTab !== tab.id) {
                      e.preventDefault()
                      const draggedIndex = customTabs.findIndex(t => t.id === draggedCustomTab)
                      const dropIndex = customTabs.findIndex(t => t.id === tab.id)
                      if (draggedIndex !== -1 && dropIndex !== -1) {
                        const reordered = [...customTabs]
                        const [removed] = reordered.splice(draggedIndex, 1)
                        reordered.splice(dropIndex, 0, removed)
                        const reorderedIds = reordered.map(t => t.id)
                        DashboardStorage.reorderCustomTabs(selectedTable, reorderedIds)
                        setCustomTabs(reordered.map((t, i) => ({ ...t, order: i })))
                      }
                      setDraggedCustomTab(null)
                    }
                  }}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{tab.name}</span>
                  {isEditMode && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingCustomTab(tab)
                          setCustomTabFormData({ name: tab.name, icon: tab.icon, order: tab.order })
                          setShowCustomTabModal(true)
                        }}
                        className="p-1 hover:bg-blue-700 rounded opacity-70 hover:opacity-100"
                        title="Editar aba"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Tem certeza que deseja excluir a aba "${tab.name}"? Os widgets desta aba também serão removidos.`)) {
                            DashboardStorage.deleteCustomTab(selectedTable, tab.id)
                            const updated = customTabs.filter(t => t.id !== tab.id)
                            setCustomTabs(updated)
                            if (activeCustomTab === tab.id) {
                              setActiveCustomTab(updated.length > 0 ? updated[0].id : null)
                            }
                          }
                        }}
                        className="p-1 hover:bg-red-600 rounded opacity-70 hover:opacity-100"
                        title="Excluir aba"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </button>
              )
            })}
            
            {/* Botão para adicionar nova sub aba (apenas no modo edição) */}
            {isEditMode && (
              <button
                onClick={() => {
                  setEditingCustomTab(null)
                  setCustomTabFormData({ name: '', icon: 'BarChart3', order: customTabs.length })
                  setShowCustomTabModal(true)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 transition-all duration-200"
                title="Adicionar nova sub aba"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Aba</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Renderizar múltiplos widgets */}
      {filteredWidgets.map((widget, widgetIndex) => {
        if (widget.type === 'cards') {
          return (
            <div
              key={widget.id}
              className="mb-6 relative group transition-all duration-200 border border-transparent rounded-xl"
            >
              <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                <button
                  onClick={() => setEditingWidget({ id: widget.id, type: 'cards' })}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Editar cards"
                  aria-label="Editar cards"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Remover widget"
                  aria-label="Remover widget"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Título do widget */}
              {widget.title && (
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">{widget.title}</h3>
                </div>
              )}
              {widget.cardMetrics && widget.cardMetrics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(widget.cardOrder || widget.cardMetrics).filter(key => {
                    if (!widget.cardMetrics?.includes(key)) return false
                    const newMetrics = ['paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
                    if (newMetrics.includes(key)) {
                      const value = getMetricValue(key)
                      return value > 0
                    }
                    return true
                  }).map((cardKey) => {
                    const metric = metrics.find(m => m.key === cardKey)
                    if (!metric) return null
                    const value = getMetricValue(cardKey)
                    const Icon = getMetricIcon(cardKey)
                    let format: 'number' | 'currency' | 'percentage' = 'number'
                    if (metric.type === 'currency') format = 'currency'
                    else if (metric.type === 'percentage') format = 'percentage'
                    
                    if (cardKey === 'roas') {
                      return (
                        <div key={cardKey} className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-200 ease-out">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                              <Icon className="w-5 h-5" />
                            </div>
                            {isLoadingPrevious ? (
                              <div className="flex items-center gap-1">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                <span className="text-xs text-gray-500">Comparando...</span>
                              </div>
                            ) : (() => {
                              const growth = getMetricGrowth(cardKey)
                              return growth !== undefined && growth !== 0 && (
                                <div className="flex items-center gap-1">
                                  {growth > 0 ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                                  <span className={`text-sm font-medium ${growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                                  </span>
                                </div>
                              )
                            })()}
                          </div>
                          <h3 className="text-gray-600 text-sm font-medium mb-1">{metric.label}</h3>
                          <p className="text-2xl font-bold text-gray-900">{value.toFixed(3)}x</p>
                        </div>
                      )
                    }
                    
                    return (
                      <div key={cardKey} className="transition-all duration-200 ease-out hover:scale-[1.02]">
                        <MetricCard
                          title={metric.label}
                          value={value}
                          icon={Icon}
                          format={format}
                          color="blue"
                          isDragOver={false}
                          growth={getMetricGrowth(cardKey)}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200 text-center text-gray-500">
                  Nenhuma métrica selecionada. Clique no ícone de editar para configurar.
                </div>
              )}
            </div>
          )
        }
        
        if (widget.type === 'timeline') {
          // Preparar dados da timeline para este widget específico
          const getWidgetTimelineData = (widgetMetrics: string[] | undefined) => {
            if (!widgetMetrics || widgetMetrics.length === 0) return []
            
            const timelineDataMap = new Map<string, any>()
            
            filteredData.forEach(item => {
              const date = item.event_date
              if (!timelineDataMap.has(date)) {
                timelineDataMap.set(date, { date })
              }
              const dayData = timelineDataMap.get(date)
              widgetMetrics.forEach(metricKey => {
                dayData[metricKey] = (dayData[metricKey] || 0) + (item[metricKey as keyof OverviewDataItem] as number || 0)
              })
            })
            
            return Array.from(timelineDataMap.values()).sort((a, b) => a.date.localeCompare(b.date))
          }
          
          const widgetTimelineData = getWidgetTimelineData(widget.timelineMetrics)
          
          return (
            <div
              key={widget.id}
              className="mb-6 relative group transition-all duration-200 bg-white rounded-xl shadow-lg p-4 border border-gray-200"
            >
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <button
                  onClick={() => setEditingWidget({ id: widget.id, type: 'timeline' })}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Editar timeline"
                  aria-label="Editar timeline"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Remover widget"
                  aria-label="Remover widget"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {widget.timelineMetrics && widget.timelineMetrics.length > 0 && widgetTimelineData.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-gray-900">{widget.title || 'Timeline de Métricas'}</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={widgetTimelineData}>
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const parts = value.split('-')
                          if (parts.length === 3) {
                            return `${parts[2]}/${parts[1]}`
                          }
                          return value
                        }}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          return new Intl.NumberFormat('pt-BR', { 
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0 
                          }).format(Math.round(value))
                        }}
                        label={{ 
                          value: widget.timelineMetrics[0] ? metrics.find(m => m.key === widget.timelineMetrics[0])?.label : '', 
                          angle: -90, 
                          position: 'insideLeft', 
                          offset: 10,
                          style: { fill: '#3b82f6', fontWeight: 'bold' }
                        }}
                        width={80}
                      />
                      {widget.timelineMetrics.length === 2 && (
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            return new Intl.NumberFormat('pt-BR', { 
                              maximumFractionDigits: 0,
                              minimumFractionDigits: 0 
                            }).format(Math.round(value))
                          }}
                          label={{ 
                            value: widget.timelineMetrics[1] ? metrics.find(m => m.key === widget.timelineMetrics[1])?.label : '', 
                            angle: 90, 
                            position: 'insideRight', 
                            offset: 10,
                            style: { fill: '#10b981', fontWeight: 'bold' }
                          }}
                          width={80}
                        />
                      )}
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          const metric = metrics.find(m => m.key === name)
                          if (!metric) {
                            return new Intl.NumberFormat('pt-BR', { 
                              maximumFractionDigits: 0,
                              minimumFractionDigits: 0 
                            }).format(Math.round(value || 0))
                          }
                          if (metric.type === 'currency') {
                            return formatCurrency(value)
                          } else if (metric.type === 'percentage') {
                            return `${Math.round(value)}%`
                          } else if (name === 'roas') {
                            return value.toFixed(3) + 'x'
                          }
                          const roundedValue = Math.round(value || 0)
                          return new Intl.NumberFormat('pt-BR', { 
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0 
                          }).format(roundedValue)
                        }}
                        labelFormatter={(label) => {
                          const parts = label.split('-')
                          if (parts.length === 3) {
                            return `${parts[2]}/${parts[1]}/${parts[0]}`
                          }
                          return label
                        }}
                      />
                      {widget.timelineMetrics.map((metricKey, index) => {
                        const metric = metrics.find(m => m.key === metricKey)
                        if (!metric) return null
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                        const color = colors[index % colors.length]
                        const yAxisId = index === 0 ? 'left' : 'right'
                        
                        return (
                          <Line
                            key={metricKey}
                            type="monotone"
                            dataKey={metricKey}
                            name={metric.label}
                            stroke={color}
                            strokeWidth={3}
                            dot={false}
                            yAxisId={yAxisId}
                          />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Nenhuma métrica selecionada. Clique no ícone de editar para configurar.
                </div>
              )}
            </div>
          )
        }
        
        if (widget.type === 'table') {
          // Função para lidar com ordenação ao clicar no cabeçalho
          const handleTableSort = (field: string) => {
            const currentSortField = widget.sortField
            const currentSortDirection = widget.sortDirection || 'asc'
            
            let newSortField: string | null = field
            let newSortDirection: 'asc' | 'desc' = 'desc'
            
            if (currentSortField === field) {
              // Se já está ordenando por este campo, alternar direção
              newSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc'
            } else {
              // Novo campo, começar com desc
              newSortDirection = 'desc'
            }
            
            updateWidget(widget.id, {
              sortField: newSortField,
              sortDirection: newSortDirection
            })
          }
          
          // Preparar dados da tabela para este widget específico
          const getWidgetTableData = (
            selectedDims: string[] | undefined,
            selectedMets: string[] | undefined,
            sortField: string | null | undefined,
            sortDirection: 'asc' | 'desc' | undefined,
            rowLimit: number | null | undefined
          ) => {
            if (!selectedDims || !selectedMets || 
                selectedDims.length === 0 || selectedMets.length === 0) {
              return []
            }
            
            const grouped = new Map<string, any>()
            
            filteredData.forEach(item => {
              const groupKey = selectedDims.map(dim => String(item[dim as keyof OverviewDataItem] || '')).join('|')
              
              if (!grouped.has(groupKey)) {
                const group: any = {}
                selectedDims.forEach(dim => {
                  group[dim] = item[dim as keyof OverviewDataItem] || ''
                })
                selectedMets.forEach(met => {
                  group[met] = 0
                })
                grouped.set(groupKey, group)
              }
              
              const group = grouped.get(groupKey)!
              selectedMets.forEach(met => {
                group[met] = (group[met] || 0) + (item[met as keyof OverviewDataItem] as number || 0)
              })
            })
            
            let result = Array.from(grouped.values())
            
            // Aplicar ordenação se houver
            if (sortField) {
              result.sort((a, b) => {
                const aVal = a[sortField] || 0
                const bVal = b[sortField] || 0
                const direction = sortDirection === 'desc' ? -1 : 1
                return (aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * direction
              })
            }
            
            // Aplicar limite de linhas
            if (rowLimit) {
              result = result.slice(0, rowLimit)
            }
            
            return result
          }
          
          const widgetTableData = getWidgetTableData(
            widget.selectedDimensions,
            widget.selectedMetrics,
            widget.sortField,
            widget.sortDirection,
            widget.rowLimit
          )
          
          return (
            <div
              key={widget.id}
              className="mb-6 relative group transition-all duration-200 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
            >
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <button
                  onClick={() => setEditingWidget({ id: widget.id, type: 'table' })}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Editar tabela"
                  aria-label="Editar tabela"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Remover widget"
                  aria-label="Remover widget"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {widget.selectedDimensions && widget.selectedDimensions.length > 0 && 
               widget.selectedMetrics && widget.selectedMetrics.length > 0 ? (
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{widget.title || 'Dados Agrupados'}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Agrupados por {widget.selectedDimensions.map(d => dimensions.find(dim => dim.key === d)?.label).filter(Boolean).join(', ')}
          </p>
        </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {widget.selectedDimensions.map(dimKey => {
                            const dimension = dimensions.find(d => d.key === dimKey)
                            if (!dimension) return null
                            const isSorted = widget.sortField === dimKey
                            const sortDirection = widget.sortDirection || 'asc'
                            return (
                              <th
                                key={dimKey}
                                onClick={() => handleTableSort(dimKey)}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                              >
                                <div className="flex items-center gap-1">
                                  <span>{dimension.label}</span>
                                  {isSorted ? (
                                    sortDirection === 'asc' ? (
                                      <ArrowUp className="w-3 h-3 text-blue-600" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-blue-600" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
                                  )}
                                </div>
                              </th>
                            )
                          })}
                          {widget.selectedMetrics.map(metKey => {
                            const metric = metrics.find(m => m.key === metKey)
                            if (!metric) return null
                            const isSorted = widget.sortField === metKey
                            const sortDirection = widget.sortDirection || 'asc'
                            return (
                              <th
                                key={metKey}
                                onClick={() => handleTableSort(metKey)}
                                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                              >
                                <div className="flex items-center justify-end gap-1">
                                  <span>{metric.label}</span>
                                  {isSorted ? (
                                    sortDirection === 'asc' ? (
                                      <ArrowUp className="w-3 h-3 text-blue-600" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-blue-600" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
                                  )}
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {widgetTableData.map((row, idx) => (
                          <tr key={idx}>
                            {widget.selectedDimensions!.map(dimKey => (
                              <td key={dimKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {row[dimKey] || '-'}
                              </td>
                            ))}
                            {widget.selectedMetrics!.map(metKey => {
                              const metric = metrics.find(m => m.key === metKey)
                              const value = row[metKey] || 0
                              return (
                                <td key={metKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {metric?.type === 'currency' ? formatCurrency(value) :
                                   metric?.type === 'percentage' ? `${value.toFixed(1)}%` :
                                   new Intl.NumberFormat('pt-BR').format(value)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Selecione dimensões e métricas no painel de edição para visualizar os dados na tabela.
        </div>
      )}
            </div>
          )
        }
        
        if (widget.type === 'runrate') {
          return (
            <div
              key={widget.id}
              className="mb-6 relative group transition-all duration-200 border border-transparent rounded-xl"
            >
              <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                <button
                  onClick={() => setEditingWidget({ id: widget.id, type: 'runrate' })}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Editar run rate"
                  aria-label="Editar run rate"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Remover widget"
                  aria-label="Remover widget"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Título do widget */}
              {widget.title && (
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">{widget.title}</h3>
                </div>
              )}
      <RunRateHighlight 
        runRateData={runRateData} 
        isLoadingGoals={isLoadingGoals}
        isLoadingCurrentMonth={isLoadingCurrentMonth}
      />
            </div>
          )
        }
        
        return null
      })}

      {/* Cards de Métricas (legado - só mostrar se não houver widgets do novo sistema) */}
      {widgets.length === 0 && cardMetrics.length > 0 && (
        <div className="mb-6 relative group">
          <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
            <button
              onClick={() => {
                // Encontrar o widget de cards ou criar um temporário
                const cardsWidget = widgets.find(w => w.type === 'cards')
                if (cardsWidget) {
                  setEditingWidget({ id: cardsWidget.id, type: 'cards' })
                }
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
              title="Editar cards"
              aria-label="Editar cards"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setCardMetrics([])
                setCardOrder([])
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
              title="Remover cards legados"
              aria-label="Remover cards legados"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(() => {
            // Filtrar e manter a ordem do cardOrder
            const visibleCards = cardOrder.filter(key => {
              if (!cardMetrics.includes(key)) return false
              // Filtrar novas métricas: exibir apenas se > 0
              const newMetrics = ['paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
              if (newMetrics.includes(key)) {
                const value = getMetricValue(key)
                return value > 0
              }
              return true
            })
            return visibleCards
          })().map((cardKey, index) => {
            const metric = metrics.find(m => m.key === cardKey)
            if (!metric) return null
            
            const value = getMetricValue(cardKey)
            const Icon = getMetricIcon(cardKey)
            const color = 'blue' // Cor padrão, pode ser personalizada
            
            let format: 'number' | 'currency' | 'percentage' = 'number'
            if (metric.type === 'currency') {
              format = 'currency'
            } else if (metric.type === 'percentage') {
              format = 'percentage'
            }
            
            // Tratamento especial para ROAS
            if (cardKey === 'roas') {
              return (
                <div 
                  key={cardKey}
                  className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-200 ease-out"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    {isLoadingPrevious ? (
                      <div className="flex items-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        <span className="text-xs text-gray-500">Comparando...</span>
                      </div>
                    ) : (() => {
                      const growth = getMetricGrowth(cardKey)
                      return growth !== undefined && growth !== 0 && (
                        <div className="flex items-center gap-1">
                          {growth > 0 ? (
                            <ArrowUpRight className="w-4 h-4 text-green-600" />
                          ) : growth < 0 ? (
                            <ArrowDownRight className="w-4 h-4 text-red-600" />
                          ) : null}
                          <span className={`text-sm font-medium ${growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-1">{metric.label}</h3>
                  <p className="text-2xl font-bold text-gray-900">{value.toFixed(3)}x</p>
                </div>
              )
            }
            
            return (
              <div
                key={cardKey}
                className="transition-all duration-200 ease-out hover:scale-[1.02]"
              >
                <MetricCard
                  title={metric.label}
                  value={value}
                  icon={Icon}
                  format={format}
                  color={color}
                  isDragOver={false}
                  growth={getMetricGrowth(cardKey)}
                />
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* Timeline (legado - só mostrar se não houver widgets do novo sistema) */}
      {widgets.length === 0 && timelineMetrics.length > 0 && timelineData.length > 0 && (
        <div className="mb-6 relative group bg-white rounded-xl shadow-lg p-4 border border-gray-200">
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <button
              onClick={() => {
                const timelineWidget = widgets.find(w => w.type === 'timeline')
                if (timelineWidget) {
                  setEditingWidget({ id: timelineWidget.id, type: 'timeline' })
                }
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
              title="Editar timeline"
              aria-label="Editar timeline"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setTimelineMetrics([])
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
              title="Remover timeline legada"
              aria-label="Remover timeline legada"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Timeline de Métricas</h3>
          </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={timelineData}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    // value já está no formato YYYY-MM-DD
                    const parts = value.split('-')
                    if (parts.length === 3) {
                      return `${parts[2]}/${parts[1]}`
                    }
                    return value
                  }}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    return new Intl.NumberFormat('pt-BR', { 
                      maximumFractionDigits: 0,
                      minimumFractionDigits: 0 
                    }).format(Math.round(value))
                  }}
                  label={{ 
                    value: timelineMetrics[0] ? metrics.find(m => m.key === timelineMetrics[0])?.label : '', 
                    angle: -90, 
                    position: 'insideLeft', 
                    offset: 10,
                    style: { fill: '#3b82f6', fontWeight: 'bold' }
                  }}
                  width={80}
                />
                {timelineMetrics.length === 2 && (
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      return new Intl.NumberFormat('pt-BR', { 
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0 
                      }).format(Math.round(value))
                    }}
                    label={{ 
                      value: timelineMetrics[1] ? metrics.find(m => m.key === timelineMetrics[1])?.label : '', 
                      angle: 90, 
                      position: 'insideRight', 
                      offset: 10,
                      style: { fill: '#10b981', fontWeight: 'bold' }
                    }}
                    width={80}
                  />
                )}
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    const metric = metrics.find(m => m.key === name)
                    if (!metric) {
                      // Se não encontrar métrica, arredondar e formatar
                      return new Intl.NumberFormat('pt-BR', { 
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0 
                      }).format(Math.round(value || 0))
                    }
                    if (metric.type === 'currency') {
                      return formatCurrency(value)
                    } else if (metric.type === 'percentage') {
                      // Arredondar porcentagem sem decimais
                      return `${Math.round(value)}%`
                    } else if (name === 'roas') {
                      return value.toFixed(3) + 'x'
                    }
                    // Para todas as outras métricas, arredondar e formatar com separador de milhar, sem decimais
                    const roundedValue = Math.round(value || 0)
                    return new Intl.NumberFormat('pt-BR', { 
                      maximumFractionDigits: 0,
                      minimumFractionDigits: 0 
                    }).format(roundedValue)
                  }}
                  labelFormatter={(label) => {
                    // label já está no formato YYYY-MM-DD
                    const parts = label.split('-')
                    if (parts.length === 3) {
                      return `${parts[2]}/${parts[1]}/${parts[0]}`
                    }
                    return label
                  }}
                />
                {timelineMetrics.map((metricKey, index) => {
                  const metric = metrics.find(m => m.key === metricKey)
                  if (!metric) return null
                  
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                  const color = colors[index % colors.length]
                  const yAxisId = index === 0 ? 'left' : 'right'
                  
                  return (
                    <Line
                      key={metricKey}
                      type="monotone"
                      dataKey={metricKey}
                      name={metric.label}
                      stroke={color}
                      strokeWidth={3}
                      dot={false}
                      yAxisId={yAxisId}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-6 relative">
          {/* Sidebar */}
          <div className={`fixed top-0 right-0 h-full w-96 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-xl shadow-2xl z-50 transform transition-all duration-300 ease-out ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="h-full flex flex-col border-l border-gray-200/50">
              {/* Header da Sidebar */}
              <div className="px-6 py-5 border-b border-gray-200/60 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white/80 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Personalizar
                  </span>
                </h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-gray-200/60 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 group"
                  aria-label="Fechar sidebar"
                >
                  <X className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
                </button>
              </div>
              
              {/* Conteúdo da Sidebar */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <div className="space-y-8">
                  {/* Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900">Presets</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportDashboardConfig}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-1"
                        title={`Exportar configurações da aba atual (${activeCustomTab === null ? 'Geral' : customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Exportar Aba
                      </button>
                      <button
                        onClick={handleImportDashboardConfigClick}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-1"
                        title={`Importar configurações para a aba atual (${activeCustomTab === null ? 'Geral' : customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Importar Aba
                      </button>
                      {!showPresetInput && (
                        <button
                          onClick={() => setShowPresetInput(true)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200 flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Salvar Preset
                        </button>
                      )}
                    </div>
                    </div>
                    
                    {/* Input oculto para importar JSON de configurações */}
                    <input
                      type="file"
                      accept="application/json"
                      ref={fileInputRef}
                      onChange={handleImportDashboardConfig}
                      className="hidden"
                    />
                    
                    {showPresetInput && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border border-blue-200/50">
                        <input
                          type="text"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              savePreset()
                            } else if (e.key === 'Escape') {
                              setShowPresetInput(false)
                              setPresetName('')
                            }
                          }}
                          placeholder="Nome do preset"
                          className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={savePreset}
                            className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => {
                              setShowPresetInput(false)
                              setPresetName('')
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {presets.length > 0 && (
                      <div className="space-y-2 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50">
                        {presets.map((preset, index) => (
                          <div
                            key={preset.id}
                            draggable
                            onDragStart={() => handlePresetDragStart(preset.id)}
                            onDragOver={(e) => handlePresetDragOver(e, preset.id)}
                            onDragLeave={handlePresetDragLeave}
                            onDrop={(e) => handlePresetDrop(e, preset.id)}
                            onDragEnd={handlePresetDragEnd}
                            className={`p-3 rounded-xl hover:bg-gray-50/80 border transition-all duration-200 group cursor-move ${
                              draggedPresetId === preset.id
                                ? 'opacity-50 border-blue-400 bg-blue-50/50'
                                : dragOverPresetId === preset.id
                                ? 'border-blue-400 bg-blue-50/50 border-2'
                                : 'border-gray-200/50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                                {index === 0 && (
                                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                    Padrão
                                  </span>
                                )}
                                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900 truncate">{preset.name}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deletePreset(preset.id)
                                }}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Deletar preset"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                            <button
                              onClick={() => loadPreset(preset)}
                              className="w-full px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              Carregar
                            </button>
                            <div className="mt-2 text-xs text-gray-500">
                              {new Date(preset.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {presets.length === 0 && !showPresetInput && (
                      <div className="p-4 text-center text-sm text-gray-500 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50">
                        Nenhum preset salvo. Clique em "Salvar Preset" para criar um.
                      </div>
                    )}
                  </div>
                  
                  {/* Dimensões */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900">Dimensões</h3>
                      <button
                        onClick={toggleAllDimensions}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200"
                      >
                        {selectedDimensions.length === dimensions.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                      </button>
                    </div>
                    <div className="space-y-1.5 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50">
                      {dimensions.map(dimension => {
                        const isSelected = selectedDimensions.includes(dimension.key)
                        return (
                          <label
                            key={dimension.key}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                              isSelected 
                                ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 shadow-sm' 
                                : 'hover:bg-gray-50/80 border border-transparent'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                            <span className={`text-sm font-medium flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                              {dimension.label}
                            </span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDimension(dimension.key)}
                              className="sr-only"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Ordem dos Cards */}
                  {cardMetrics.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-900">Ordem dos Cards</h3>
                        <span className="text-xs text-gray-500">
                          {cardMetrics.length} {cardMetrics.length === 1 ? 'card' : 'cards'}
                        </span>
                      </div>
                      <div className="space-y-2 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50">
                        {cardOrder
                          .filter(key => cardMetrics.includes(key))
                          .map((cardKey, index) => {
                            const metric = metrics.find(m => m.key === cardKey)
                            if (!metric) return null
                            
                            const isDragging = draggedCard === cardKey
                            const isDragOver = dragOverCard === cardKey
                            
                            return (
                              <div
                                key={cardKey}
                                draggable
                                onDragStart={(e) => handleDragStart(e, cardKey)}
                                onDragOver={(e) => handleCardDragOver(e, cardKey)}
                                onDragLeave={handleDragLeave}
                                onDragEnd={handleDragEnd}
                                onDrop={(e) => handleDrop(e, cardKey)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border ${
                                  isDragging
                                    ? 'opacity-40 border-blue-300 scale-95 cursor-grabbing'
                                    : isDragOver
                                      ? 'border-blue-500 border-2 shadow-lg scale-105 bg-blue-50/50 z-10'
                                      : 'hover:bg-gray-50/80 border-gray-200/50 cursor-grab active:cursor-grabbing'
                                }`}
                              >
                                <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-xs font-medium text-gray-500 w-6 flex-shrink-0">
                                  {index + 1}
                                </span>
                                <span className="text-sm font-medium text-gray-900 flex-1">
                                  {metric.label}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                      {cardOrder.filter(key => cardMetrics.includes(key)).length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50">
                          Nenhum card selecionado. Selecione métricas como "Card" para ordená-las aqui.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Métricas */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900">Métricas</h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={toggleAllTableMetrics}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all duration-200"
                        >
                          {selectedMetrics.length === metrics.length ? 'Tabela: Todas' : 'Tabela: Nenhuma'}
                        </button>
                        <span className="text-xs text-gray-300">•</span>
                        <button
                          onClick={toggleAllCardMetrics}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all duration-200"
                        >
                          {cardMetrics.length === metrics.length ? 'Card: Todas' : 'Card: Nenhuma'}
                        </button>
                      </div>
                    </div>
                    {/* Campo de busca */}
                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={metricSearchTerm}
                          onChange={(e) => setMetricSearchTerm(e.target.value)}
                          placeholder="Buscar métricas..."
                          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                        {metricSearchTerm && (
                          <button
                            onClick={() => setMetricSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="Limpar busca"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                      {metrics
                        .filter(metric => {
                          if (!metricSearchTerm) return true
                          const searchLower = metricSearchTerm.toLowerCase()
                          return metric.label.toLowerCase().includes(searchLower) || 
                                 metric.key.toLowerCase().includes(searchLower)
                        })
                        .map(metric => {
                        const isInTable = selectedMetrics.includes(metric.key)
                        const isInCard = cardMetrics.includes(metric.key)
                        const isInTimeline = timelineMetrics.includes(metric.key)
                        const hasAnySelection = isInTable || isInCard || isInTimeline
                        return (
                          <div
                            key={metric.key}
                            className={`p-3 rounded-xl transition-all duration-200 border ${
                              hasAnySelection 
                                ? 'bg-gradient-to-r from-blue-50/50 to-purple-50/30 border-blue-200/50 shadow-sm' 
                                : 'hover:bg-gray-50/80 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-sm font-medium flex-1 ${hasAnySelection ? 'text-gray-900' : 'text-gray-700'}`}>
                                {metric.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 pl-0.5">
                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isInTable}
                                  onChange={() => toggleMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all"
                                />
                                <span className={`text-xs font-medium transition-colors ${
                                  isInTable ? 'text-blue-700' : 'text-gray-600 group-hover:text-gray-800'
                                }`}>
                                  Tabela
                                </span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isInCard}
                                  onChange={() => toggleCardMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all"
                                />
                                <span className={`text-xs font-medium transition-colors ${
                                  isInCard ? 'text-blue-700' : 'text-gray-600 group-hover:text-gray-800'
                                }`}>
                                  Card
                                </span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isInTimeline}
                                  onChange={() => toggleTimelineMetric(metric.key)}
                                  disabled={!isInTimeline && timelineMetrics.length >= 2}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                />
                                <span className={`text-xs font-medium transition-colors ${
                                  isInTimeline ? 'text-purple-700' : 'text-gray-600 group-hover:text-gray-800'
                                } ${!isInTimeline && timelineMetrics.length >= 2 ? 'opacity-50' : ''}`}>
                                  Timeline
                                </span>
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {timelineMetrics.length > 0 && (
                      <div className="mt-3 px-3 py-2 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-lg border border-purple-200/50">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="text-xs font-medium text-purple-900">
                            Timeline: {timelineMetrics.map(key => metrics.find(m => m.key === key)?.label).filter(Boolean).join(', ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Overlay quando sidebar está aberta */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          
          {/* Modal para adicionar novo widget */}
          {showAddWidgetModal && (
            <>
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={() => setShowAddWidgetModal(false)}
              />
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl z-50">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                    Adicionar Widget
                  </h2>
                  <button
                    onClick={() => setShowAddWidgetModal(false)}
                    className="p-2 hover:bg-gray-200/60 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-600 mb-4">Escolha o tipo de widget que deseja adicionar:</p>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => {
                        addWidget('cards')
                        setShowAddWidgetModal(false)
                      }}
                      className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Layout className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Cards (Big Numbers)</h3>
                        <p className="text-sm text-gray-500">Exiba métricas importantes em formato de cards</p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        addWidget('timeline')
                        setShowAddWidgetModal(false)
                      }}
                      className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                    >
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <TrendingUp className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Timeline</h3>
                        <p className="text-sm text-gray-500">Gráfico de linha temporal com até 2 métricas</p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        addWidget('table')
                        setShowAddWidgetModal(false)
                      }}
                      className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left"
                    >
                      <div className="p-2 bg-green-100 rounded-lg">
                        <BarChart3 className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Tabela</h3>
                        <p className="text-sm text-gray-500">Dados agrupados em formato tabular</p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        addWidget('runrate')
                        setShowAddWidgetModal(false)
                      }}
                      className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
                    >
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Target className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Run Rate da Meta</h3>
                        <p className="text-sm text-gray-500">Projeção mensal e progresso da meta</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Modais de edição de widgets */}
          {editingWidget && (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={() => setEditingWidget(null)}
              />
              
              {/* Modal de edição */}
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl z-50 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header do Modal */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white/80">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    {editingWidget?.type === 'cards' && 'Editar Cards'}
                    {editingWidget?.type === 'timeline' && 'Editar Timeline'}
                    {editingWidget?.type === 'table' && 'Editar Tabela'}
                    {editingWidget?.type === 'runrate' && 'Editar Run Rate'}
                  </h2>
                  <button
                    onClick={() => setEditingWidget(null)}
                    className="p-2 hover:bg-gray-200/60 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                
                {/* Conteúdo do Modal */}
                <div className="flex-1 overflow-y-auto p-6">
                  {editingWidget?.type === 'cards' && (
                    <div className="space-y-6">
                      {/* Título do Widget */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Título do Widget
                        </label>
                        <input
                          type="text"
                          value={currentWidget?.title || ''}
                          onChange={(e) => updateWidget(editingWidget.id, { title: e.target.value })}
                          placeholder="Ex: Cards de Receita"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Dê um nome único para este widget para diferenciá-lo de outros do mesmo tipo
                        </p>
                      </div>
                      
                      {/* Ordem dos Cards */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-gray-900">Ordem dos Cards</h3>
                          <span className="text-xs text-gray-500">
                            {currentWidget?.cardMetrics?.length || 0} {(currentWidget?.cardMetrics?.length || 0) === 1 ? 'card' : 'cards'}
                          </span>
                        </div>
                        <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
                          {(currentWidget?.cardOrder || currentWidget?.cardMetrics || [])
                            .filter(key => currentWidget?.cardMetrics?.includes(key))
                            .map((cardKey, index) => {
                              const metric = metrics.find(m => m.key === cardKey)
                              if (!metric) return null
                              
                              return (
                                <div
                                  key={cardKey}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, cardKey)}
                                  onDragOver={(e) => handleCardDragOver(e, cardKey)}
                                  onDragLeave={handleDragLeave}
                                  onDragEnd={handleDragEnd}
                                  onDrop={(e) => handleDrop(e, cardKey)}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-xs font-medium text-gray-500 w-6 flex-shrink-0">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900 flex-1">
                                    {metric.label}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                      
                      {/* Métricas de Cards */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-gray-900">Métricas de Cards</h3>
                          <button
                            onClick={toggleAllCardMetrics}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all"
                          >
                            {(currentWidget?.cardMetrics?.length || 0) === metrics.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                          </button>
                        </div>
                        {/* Campo de busca */}
                        <div className="mb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={cardsMetricSearch}
                              onChange={(e) => setCardsMetricSearch(e.target.value)}
                              placeholder="Buscar métricas..."
                              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            />
                            {cardsMetricSearch && (
                              <button
                                onClick={() => setCardsMetricSearch('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                aria-label="Limpar busca"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-[300px] overflow-y-auto">
                          {metrics
                            .filter(metric => {
                              if (!cardsMetricSearch) return true
                              const searchLower = cardsMetricSearch.toLowerCase()
                              return metric.label.toLowerCase().includes(searchLower) || 
                                     metric.key.toLowerCase().includes(searchLower)
                            })
                            .map(metric => {
                              const isInCard = (currentWidget?.cardMetrics || []).includes(metric.key)
                            return (
                              <label
                                key={metric.key}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                  isInCard 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'bg-white border border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isInCard}
                                  onChange={() => toggleCardMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className={`text-sm font-medium flex-1 ${isInCard ? 'text-blue-900' : 'text-gray-700'}`}>
                                  {metric.label}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {editingWidget?.type === 'timeline' && (
                    <div className="space-y-6">
                      {/* Título do Widget */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Título do Widget
                        </label>
                        <input
                          type="text"
                          value={currentWidget?.title || ''}
                          onChange={(e) => updateWidget(editingWidget.id, { title: e.target.value })}
                          placeholder="Ex: Timeline de Receita"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Dê um nome único para este widget para diferenciá-lo de outros do mesmo tipo
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-base font-bold text-gray-900 mb-4">Métricas da Timeline</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Selecione até 2 métricas para exibir na timeline
                        </p>
                        {/* Campo de busca */}
                        <div className="mb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={timelineMetricSearch}
                              onChange={(e) => setTimelineMetricSearch(e.target.value)}
                              placeholder="Buscar métricas..."
                              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                            />
                            {timelineMetricSearch && (
                              <button
                                onClick={() => setTimelineMetricSearch('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                aria-label="Limpar busca"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-[400px] overflow-y-auto">
                          {metrics
                            .filter(metric => {
                              if (!timelineMetricSearch) return true
                              const searchLower = timelineMetricSearch.toLowerCase()
                              return metric.label.toLowerCase().includes(searchLower) || 
                                     metric.key.toLowerCase().includes(searchLower)
                            })
                            .map(metric => {
                            const widgetMetrics = currentWidget?.timelineMetrics || []
                            const isInTimeline = widgetMetrics.includes(metric.key)
                            const isDisabled = !isInTimeline && widgetMetrics.length >= 2
                            return (
                              <label
                                key={metric.key}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                  isInTimeline 
                                    ? 'bg-purple-50 border border-purple-200' 
                                    : 'bg-white border border-gray-200 hover:border-gray-300'
                                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isInTimeline}
                                  onChange={() => toggleTimelineMetric(metric.key)}
                                  disabled={isDisabled}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 disabled:opacity-40"
                                />
                                <span className={`text-sm font-medium flex-1 ${isInTimeline ? 'text-purple-900' : 'text-gray-700'}`}>
                                  {metric.label}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        {currentWidget?.timelineMetrics && currentWidget.timelineMetrics.length > 0 && (
                          <div className="mt-3 px-3 py-2 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-lg border border-purple-200/50">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span className="text-xs font-medium text-purple-900">
                                Selecionadas: {currentWidget.timelineMetrics.map(key => metrics.find(m => m.key === key)?.label).filter(Boolean).join(', ')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {editingWidget?.type === 'table' && (
                    <div className="space-y-6">
                      {/* Título do Widget */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Título do Widget
                        </label>
                        <input
                          type="text"
                          value={currentWidget?.title || ''}
                          onChange={(e) => updateWidget(editingWidget.id, { title: e.target.value })}
                          placeholder="Ex: Tabela por País"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Dê um nome único para este widget para diferenciá-lo de outros do mesmo tipo
                        </p>
                      </div>
                      
                      {/* Dimensões */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-gray-900">Dimensões</h3>
                          <button
                            onClick={toggleAllDimensions}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all"
                          >
                            {(currentWidget?.selectedDimensions?.length || 0) === dimensions.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                          </button>
                        </div>
                        {/* Campo de busca de dimensões */}
                        <div className="mb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={tableDimensionSearch}
                              onChange={(e) => setTableDimensionSearch(e.target.value)}
                              placeholder="Buscar dimensões..."
                              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            />
                            {tableDimensionSearch && (
                              <button
                                onClick={() => setTableDimensionSearch('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                aria-label="Limpar busca"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-[300px] overflow-y-auto">
                          {dimensions
                            .filter(dimension => {
                              if (!tableDimensionSearch) return true
                              const searchLower = tableDimensionSearch.toLowerCase()
                              return dimension.label.toLowerCase().includes(searchLower) || 
                                     dimension.key.toLowerCase().includes(searchLower)
                            })
                            .map(dimension => {
                            const widgetDims = currentWidget?.selectedDimensions || selectedDimensions
                            const isSelected = widgetDims.includes(dimension.key)
                            return (
                              <label
                                key={dimension.key}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'bg-white border border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400" />
                                )}
                                <span className={`text-sm font-medium flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                  {dimension.label}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDimension(dimension.key)}
                                  className="sr-only"
                                />
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      
                      {/* Métricas da Tabela */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-gray-900">Métricas da Tabela</h3>
                          <button
                            onClick={toggleAllTableMetrics}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all"
                          >
                            {(currentWidget?.selectedMetrics?.length || 0) === metrics.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
                          </button>
                        </div>
                        {/* Campo de busca de métricas */}
                        <div className="mb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={tableMetricSearch}
                              onChange={(e) => setTableMetricSearch(e.target.value)}
                              placeholder="Buscar métricas..."
                              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            />
                            {tableMetricSearch && (
                              <button
                                onClick={() => setTableMetricSearch('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                aria-label="Limpar busca"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-[300px] overflow-y-auto">
                          {metrics
                            .filter(metric => {
                              if (!tableMetricSearch) return true
                              const searchLower = tableMetricSearch.toLowerCase()
                              return metric.label.toLowerCase().includes(searchLower) || 
                                     metric.key.toLowerCase().includes(searchLower)
                            })
                            .map(metric => {
                            const widgetMetrics = currentWidget?.selectedMetrics || selectedMetrics
                            const isInTable = widgetMetrics.includes(metric.key)
                            return (
                              <label
                                key={metric.key}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                  isInTable 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'bg-white border border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isInTable}
                                  onChange={() => toggleMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className={`text-sm font-medium flex-1 ${isInTable ? 'text-blue-900' : 'text-gray-700'}`}>
                                  {metric.label}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Modal de edição - Run Rate */}
                  {editingWidget?.type === 'runrate' && (
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Título do Widget
                          </label>
                          <input
                            type="text"
                            value={currentWidget?.title || 'Run Rate da Meta'}
                            onChange={(e) => {
                              if (currentWidget) {
                                updateWidget(currentWidget.id, { title: e.target.value })
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Digite o título do widget"
                          />
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800">
                            O widget de Run Rate da Meta exibe automaticamente a projeção mensal e o progresso em relação à meta configurada.
                            Não é necessário configurar métricas ou dimensões adicionais.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Modal de Reordenação de Widgets */}
          {showReorderModal && (
            <>
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={() => setShowReorderModal(false)}
              />
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-50 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header do Modal */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white/80">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <GripVertical className="w-4 h-4 text-white" />
                    </div>
                    Reordenar Widgets
                  </h2>
                  <button
                    onClick={() => setShowReorderModal(false)}
                    className="p-2 hover:bg-gray-200/60 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Conteúdo do Modal */}
                <div className="p-6 overflow-y-auto flex-1">
                  {widgets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Nenhum widget para reordenar.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {widgets.map((widget, index) => {
                        const Icon = getWidgetTypeIcon(widget.type)
                        const color = getWidgetTypeColor(widget.type)
                        const typeName = getWidgetTypeName(widget.type)
                        const colorClasses = {
                          blue: 'bg-blue-100 text-blue-600',
                          purple: 'bg-purple-100 text-purple-600',
                          green: 'bg-green-100 text-green-600',
                          orange: 'bg-orange-100 text-orange-600',
                          gray: 'bg-gray-100 text-gray-600'
                        }
                        
                        return (
                          <div
                            key={widget.id}
                            className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
                          >
                            {/* Ícone do tipo */}
                            <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.gray}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            
                            {/* Informações do widget */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {widget.title || `${typeName} #${index + 1}`}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {typeName}
                                {widget.type === 'cards' && widget.cardMetrics && (
                                  <span> • {widget.cardMetrics.length} métrica{widget.cardMetrics.length !== 1 ? 's' : ''}</span>
                                )}
                                {widget.type === 'timeline' && widget.timelineMetrics && (
                                  <span> • {widget.timelineMetrics.length} métrica{widget.timelineMetrics.length !== 1 ? 's' : ''}</span>
                                )}
                                {widget.type === 'table' && widget.selectedDimensions && widget.selectedMetrics && (
                                  <span> • {widget.selectedDimensions.length} dimensão{widget.selectedDimensions.length !== 1 ? 'ões' : ''}, {widget.selectedMetrics.length} métrica{widget.selectedMetrics.length !== 1 ? 's' : ''}</span>
                                )}
                              </p>
                            </div>

                            {/* Botões de reordenação */}
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => moveWidgetUp(index)}
                                disabled={index === 0}
                                className={`p-2 rounded-lg transition-all ${
                                  index === 0
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                                }`}
                                title="Mover para cima"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => moveWidgetDown(index)}
                                disabled={index === widgets.length - 1}
                                className={`p-2 rounded-lg transition-all ${
                                  index === widgets.length - 1
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                                }`}
                                title="Mover para baixo"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Footer do Modal */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowReorderModal(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Concluído
                  </button>
                </div>
              </div>
            </>
          )}
          
          {/* Tabela - mostrar mensagem se não houver seleções (legado - só mostrar se não houver widgets do novo sistema) */}
          {widgets.length === 0 && (
            <>
          {selectedDimensions.length === 0 || selectedMetrics.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-center">
                {selectedDimensions.length === 0 && selectedMetrics.length === 0 
                  ? 'Selecione dimensões e métricas no painel de personalização para visualizar os dados na tabela.'
                  : selectedDimensions.length === 0
                  ? 'Selecione pelo menos uma dimensão no painel de personalização.'
                  : 'Selecione pelo menos uma métrica no painel de personalização.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 relative group">
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <button
                  onClick={() => {
                    const tableWidget = widgets.find(w => w.type === 'table')
                    if (tableWidget) {
                      setEditingWidget({ id: tableWidget.id, type: 'table' })
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Editar tabela"
                  aria-label="Editar tabela"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedDimensions([])
                    setSelectedMetrics([])
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Remover tabela legada"
                  aria-label="Remover tabela legada"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Dados Agrupados</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Agrupados por {selectedDimensions.map(d => dimensions.find(dim => dim.key === d)?.label).filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleDownloadXLSX}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 shadow-sm"
                    title="Baixar dados em Excel"
                  >
                    <Download className="w-4 h-4" />
                    <span>XLSX</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <label htmlFor="row-limit-select" className="text-sm text-gray-600">
                      Limite de linhas:
                    </label>
                    <select
                      id="row-limit-select"
                      value={rowLimit === null ? 'all' : String(rowLimit)}
                      onChange={(e) => {
                        const value = e.target.value
                        setRowLimit(value === 'all' ? null : parseInt(value, 10))
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:ring-2 focus:border-blue-500 bg-white"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="500">500</option>
                      <option value="all">Todas</option>
                    </select>
                  </div>
                </div>
              </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {selectedDimensions.map(dimKey => {
                    const dimension = dimensions.find(d => d.key === dimKey)
                    if (!dimension) return null
                    const isSorted = sortField === dimKey
                    return (
                      <th
                        key={dimKey}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === dimKey) {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField(dimKey)
                            setSortDirection('asc')
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {dimension.label}
                          {isSorted && (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                    )
                  })}
                  {selectedMetrics.map(metKey => {
                    const metric = metrics.find(m => m.key === metKey)
                    if (!metric) return null
                    const isSorted = sortField === metKey
                    return (
                      <th
                        key={metKey}
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortField === metKey) {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                          } else {
                            setSortField(metKey)
                            setSortDirection('desc')
                          }
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {metric.label}
                          {isSorted && (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  // Agrupar dados pelas dimensões selecionadas (usando dados filtrados)
                  const groupedData = filteredData.reduce((acc, item) => {
                    // Criar chave única baseada nas dimensões selecionadas
                    const groupKey = selectedDimensions.map(dimKey => 
                      String(item[dimKey as keyof OverviewDataItem] || '-')
                    ).join('|')
                    
                    if (!acc[groupKey]) {
                      // Inicializar o grupo com os valores das dimensões e zerar as métricas
                      acc[groupKey] = {
                        dimensions: selectedDimensions.reduce((dims, dimKey) => {
                          dims[dimKey] = item[dimKey as keyof OverviewDataItem]
                          return dims
                        }, {} as Record<string, any>),
                        // Inicializar todas as métricas base sempre, além das selecionadas
                        metrics: (() => {
                          const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
                          const allMetricsToInit = [...new Set([...baseMetrics, ...selectedMetrics])]
                          return allMetricsToInit.reduce((mets, metKey) => {
                            mets[metKey] = 0
                            return mets
                          }, {} as Record<string, number>)
                        })()
                      }
                    }
                    
                    // Sempre somar todas as métricas base (necessárias para calcular as derivadas)
                    // Lista de métricas base que sempre devem ser somadas
                    const baseMetrics = ['sessions', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'add_to_carts', 'leads', 'new_customers', 'clicks', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
                    baseMetrics.forEach(metKey => {
                      const value = item[metKey as keyof OverviewDataItem] as number || 0
                      acc[groupKey].metrics[metKey] = (acc[groupKey].metrics[metKey] || 0) + value
                    })
                    
                    return acc
                  }, {} as Record<string, { dimensions: Record<string, any>, metrics: Record<string, number> }>)
                  
                  // Converter para array
                  let groupedArray = Object.values(groupedData)
                  
                  // Calcular métricas derivadas para cada grupo
                  groupedArray = groupedArray.map(group => {
                    const calcMetrics = { ...group.metrics }
                    const sessions = group.metrics.sessions || 0
                    const orders = group.metrics.orders || 0
                    const paid_orders = group.metrics.paid_orders || 0
                    const revenue = group.metrics.revenue || 0
                    const paid_revenue = group.metrics.paid_revenue || 0
                    const cost = group.metrics.cost || 0
                    const add_to_carts = group.metrics.add_to_carts || 0
                    const leads = group.metrics.leads || 0
                    const new_customers = group.metrics.new_customers || 0
                    
                    // Taxa de Conversão Geral
                    if (selectedMetrics.includes('conversion_rate')) {
                      calcMetrics.conversion_rate = sessions > 0 ? (orders / sessions) * 100 : 0
                    }
                    
                    // Taxa de Adição ao Carrinho
                    if (selectedMetrics.includes('add_to_cart_rate')) {
                      calcMetrics.add_to_cart_rate = sessions > 0 ? (add_to_carts / sessions) * 100 : 0
                    }
                    
                    // Taxa de Conversão de Leads
                    if (selectedMetrics.includes('leads_conversion_rate')) {
                      calcMetrics.leads_conversion_rate = sessions > 0 ? (leads / sessions) * 100 : 0
                    }
                    
                    // Taxa de Conversão Paga
                    if (selectedMetrics.includes('paid_conversion_rate')) {
                      calcMetrics.paid_conversion_rate = orders > 0 ? (paid_orders / orders) * 100 : 0
                    }
                    
                    // Receita por Sessão
                    if (selectedMetrics.includes('revenue_per_session')) {
                      calcMetrics.revenue_per_session = sessions > 0 ? revenue / sessions : 0
                    }
                    
                    // Ticket Médio
                    if (selectedMetrics.includes('avg_order_value')) {
                      calcMetrics.avg_order_value = orders > 0 ? revenue / orders : 0
                    }
                    
                    // ROAS
                    if (selectedMetrics.includes('roas')) {
                      calcMetrics.roas = cost > 0 ? revenue / cost : 0
                    }
                    
                    // Taxa de Novos Clientes
                    if (selectedMetrics.includes('new_customer_rate')) {
                      calcMetrics.new_customer_rate = orders > 0 ? (new_customers / orders) * 100 : 0
                    }
                    
                    return {
                      ...group,
                      metrics: calcMetrics
                    }
                  })
                  
                  // Aplicar ordenação se houver campo selecionado
                  if (sortField) {
                    groupedArray = groupedArray.sort((a, b) => {
                      let aValue: any
                      let bValue: any
                      
                      // Verificar se é uma dimensão ou métrica
                      if (selectedDimensions.includes(sortField)) {
                        aValue = a.dimensions[sortField]
                        bValue = b.dimensions[sortField]
                      } else if (selectedMetrics.includes(sortField)) {
                        aValue = a.metrics[sortField] || 0
                        bValue = b.metrics[sortField] || 0
                      } else {
                        return 0
                      }
                      
                      // Para métricas, sempre tratar como número
                      if (selectedMetrics.includes(sortField)) {
                        const aNum = typeof aValue === 'number' ? aValue : parseFloat(String(aValue)) || 0
                        const bNum = typeof bValue === 'number' ? bValue : parseFloat(String(bValue)) || 0
                        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
                      }
                      
                      // Para dimensões, comparar como string
                      const aStr = String(aValue || '').toLowerCase()
                      const bStr = String(bValue || '').toLowerCase()
                      
                      if (sortDirection === 'asc') {
                        return aStr.localeCompare(bStr)
                      } else {
                        return bStr.localeCompare(aStr)
                      }
                    })
                  }
                  
                  // Aplicar limite de linhas se especificado
                  const displayData = rowLimit === null ? groupedArray : groupedArray.slice(0, rowLimit)
                  
                  return (
                    <>
                      {displayData.map((group, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {selectedDimensions.map(dimKey => {
                            const value = group.dimensions[dimKey]
                            const stringValue = String(value || '-')
                            const isFiltered = dimensionFilters[dimKey]?.has(stringValue)
                            return (
                              <td 
                                key={dimKey} 
                                className={`px-6 py-4 whitespace-nowrap text-sm cursor-pointer ${
                                  isFiltered 
                                    ? 'bg-blue-100 text-blue-800 font-medium' 
                                    : 'text-gray-900 hover:bg-gray-100'
                                }`}
                                onClick={() => toggleDimensionFilter(dimKey, stringValue)}
                                title={isFiltered ? 'Clique para remover filtro' : 'Clique para filtrar por este valor'}
                              >
                                {stringValue}
                              </td>
                            )
                          })}
                          {selectedMetrics.map(metKey => {
                            const value = group.metrics[metKey] || 0
                            const metric = metrics.find(m => m.key === metKey)
                            const metricType = metric?.type || 'number'
                            
                            let displayValue: string
                            if (metricType === 'currency') {
                              displayValue = formatCurrency(value)
                            } else if (metricType === 'percentage') {
                              displayValue = `${value.toFixed(2)}%`
                            } else if (metKey === 'roas') {
                              displayValue = value.toFixed(3) + 'x'
                            } else {
                              displayValue = formatNumber(value)
                            }
                            
                            return (
                              <td key={metKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {displayValue}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {rowLimit !== null && groupedArray.length > rowLimit && (
                        <tr>
                          <td 
                            colSpan={selectedDimensions.length + selectedMetrics.length}
                            className="px-6 py-4 text-center text-sm text-gray-500"
                          >
                            Mostrando {rowLimit} de {formatNumber(groupedArray.length)} grupos
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })()}
                </tbody>
              </table>
              </div>
            </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal de Nova Meta */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingGoal ? 'Editar Meta' : 'Nova Meta'}</h3>
              <p className="text-sm text-gray-600 mt-1">{editingGoal ? 'Edite a meta de receita' : 'Cadastre uma nova meta de receita'}</p>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
                <input
                  type="month"
                  value={goalFormData.month}
                  onChange={(e) => setGoalFormData({ ...goalFormData, month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="2025-10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor da Meta (R$)</label>
                <input
                  type="number"
                  value={goalFormData.goal_value}
                  onChange={(e) => setGoalFormData({ ...goalFormData, goal_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="10000000"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveGoal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                {editingGoal ? 'Atualizar Meta' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sub Aba Personalizada */}
      {showCustomTabModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingCustomTab ? 'Editar Sub Aba' : 'Nova Sub Aba'}</h3>
              <p className="text-sm text-gray-600 mt-1">{editingCustomTab ? 'Edite os detalhes da sub aba' : 'Crie uma nova sub aba personalizada'}</p>
            </div>
            
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Aba</label>
                <input
                  type="text"
                  value={customTabFormData.name}
                  onChange={(e) => setCustomTabFormData({ ...customTabFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Ex: Análise de Vendas"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ícone</label>
                <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {Object.keys(iconMap).map((iconName) => {
                    const IconComponent = iconMap[iconName]
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setCustomTabFormData({ ...customTabFormData, icon: iconName })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          customTabFormData.icon === iconName
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        title={iconName}
                      >
                        <IconComponent className="w-5 h-5 text-gray-700" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCustomTabModal(false)
                  setEditingCustomTab(null)
                  setCustomTabFormData({ name: '', icon: 'BarChart3', order: 0 })
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!customTabFormData.name.trim()) {
                    alert('Por favor, informe o nome da aba')
                    return
                  }
                  
                  if (editingCustomTab) {
                    // Atualizar aba existente
                    const updated = DashboardStorage.updateCustomTab(
                      selectedTable,
                      editingCustomTab.id,
                      { name: customTabFormData.name, icon: customTabFormData.icon }
                    )
                    if (updated) {
                      const updatedTabs = customTabs.map(t => t.id === updated.id ? updated : t)
                      setCustomTabs(updatedTabs.sort((a, b) => a.order - b.order))
                    }
                  } else {
                    // Criar nova aba
                    const newTab = DashboardStorage.addCustomTab(selectedTable, {
                      name: customTabFormData.name,
                      icon: customTabFormData.icon,
                      order: customTabs.length
                    })
                    const updatedTabs = [...customTabs, newTab].sort((a, b) => a.order - b.order)
                    setCustomTabs(updatedTabs)
                    setActiveCustomTab(newTab.id)
                  }
                  
                  setShowCustomTabModal(false)
                  setEditingCustomTab(null)
                  setCustomTabFormData({ name: '', icon: 'BarChart3', order: 0 })
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingCustomTab ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default OverviewDashboard


