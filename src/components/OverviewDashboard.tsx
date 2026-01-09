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
  Maximize2,
  Minimize2,
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
  Calculator,
  type LucideIcon
} from 'lucide-react'
import { api, validateTableName } from '../services/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { 
  applyCalculatedMetricsToRows,
  evaluateFormula,
  evaluateAggregateFormula,
  hasAggregateFunctions,
  extractFormulaIdentifiers,
  type CalculatedMetric
} from '../utils/calculatedMetrics'

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
  dataSource?: string // Endpoint da collection 'tables' do Firestore que será usado para buscar dados
}

// Interface para sub abas personalizadas
interface CustomTab {
  id: string
  name: string
  icon: string // Nome do ícone do lucide-react
  order: number
  createdAt: string
  updatedAt: string
  isUniversal?: boolean // Se true, a aba é acessível para todos os clientes
  createdBy?: string // Email do usuário que criou a aba (para abas universais)
  dataSource?: string // Endpoint da fonte de dados associada a esta aba
}

// Interface para fonte de dados disponível
interface DataSource {
  endpoint: string // Nome do endpoint (ex: "overview", "coffeemais/overview")
  label: string // Nome amigável para exibição
  restricted?: boolean // Se true, é restrito a clientes específicos
  dateField?: string // Campo usado como data para filtros (padrão: "event_date")
  metrics?: Array<{
    key: string
    label: string
    type: 'number' | 'currency' | 'percentage'
    isCalculated?: boolean
    formula?: string
  }> // Métricas mapeadas desta fonte
  dimensions?: Array<{key: string, label: string}> // Dimensões mapeadas desta fonte
  isLoaded?: boolean // Se os dados foram carregados e mapeados
  isLoading?: boolean // Se está carregando dados
}

// Interface para todas as configurações do dashboard
interface DashboardConfig {
  widgets: Widget[]
  customTabs?: CustomTab[] // Sub abas personalizadas
  dataSources?: DataSource[] // Fontes de dados disponíveis para este dashboard
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

// Utilitário centralizado para gerenciar configurações no localStorage e Firestore
class DashboardStorage {
  private static readonly STORAGE_PREFIX = 'overview-dashboard'
  private static readonly CURRENT_VERSION = '2.0'
  private static firestoreInitialized = false

  // Inicializar Firestore de forma lazy
  static async initFirestore() {
    console.log('🔄 [initFirestore-1] Iniciando initFirestore, firestoreInitialized:', this.firestoreInitialized)
    if (this.firestoreInitialized) {
      console.log('🔄 [initFirestore-2] Firestore já inicializado, retornando')
      return
    }
    
    try {
      // Verificar se o Firestore está configurado
      // Usa o mesmo projectId do GCP_PROJECT_ID que está no .env
      const projectId = 'mymetric-hub-shopify' // Mesmo valor do GCP_PROJECT_ID
      const hasFirestoreConfig = projectId
      console.log('🔄 [initFirestore-3] projectId:', projectId, 'hasFirestoreConfig:', hasFirestoreConfig)
      
      if (hasFirestoreConfig) {
        try {
          console.log('🔄 [initFirestore-4] Importando firebase...')
          // Importar dinamicamente para evitar erros se Firebase não estiver configurado
          await import('../services/firebase') // Garantir que o Firebase está inicializado primeiro
          console.log('🔄 [initFirestore-5] Firebase importado, importando dashboardFirestore...')
          await import('../services/dashboardFirestore')
          console.log('🔄 [initFirestore-6] dashboardFirestore importado')
          this.firestoreInitialized = true
          console.log('✅ [initFirestore-7] Firestore inicializado com sucesso')
        } catch (error) {
          console.error('❌ [initFirestore-ERRO] Erro ao inicializar Firestore:', error)
          console.error('Detalhes do erro:', {
            message: (error as any)?.message,
            stack: (error as any)?.stack,
            name: (error as any)?.name
          })
          this.firestoreInitialized = false
        }
      } else {
        console.warn('⚠️ [initFirestore-SKIP] Firestore não configurado - projectId não encontrado')
      }
    } catch (error) {
      console.warn('⚠️ [initFirestore-ERRO] Firestore não disponível, usando apenas localStorage:', error)
    }
  }

  // Obter chave de storage para um cliente
  private static getStorageKey(tableName: string): string {
    return `${this.STORAGE_PREFIX}-${tableName}`
  }

  // Carregar todas as configurações de um cliente (versão assíncrona - tenta Firestore primeiro, depois localStorage)
  static async loadConfigAsync(tableName: string): Promise<DashboardConfig | null> {
    if (!tableName) return null

    try {
      // Tentar carregar do Firestore primeiro
      await this.initFirestore()
      if (this.firestoreInitialized) {
        try {
          const { DashboardFirestore } = await import('../services/dashboardFirestore')
          const firestoreConfig = await DashboardFirestore.loadConfig(tableName)
          if (firestoreConfig) {
            // Sincronizar com localStorage como backup
            const storageKey = this.getStorageKey(tableName)
            localStorage.setItem(storageKey, JSON.stringify(firestoreConfig))
            console.log('✅ Configuração carregada do Firestore e sincronizada com localStorage')
            return firestoreConfig
          }
        } catch (error) {
          console.warn('⚠️ Erro ao carregar do Firestore, tentando localStorage:', error)
        }
      }
    } catch (error) {
      console.warn('⚠️ Firestore não disponível, usando localStorage:', error)
    }

    // Fallback para localStorage
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
      console.error('❌ Erro ao carregar configurações do localStorage:', error)
    }

    return null
  }

  // Carregar todas as configurações de um cliente (versão síncrona - tenta localStorage primeiro, mas Firestore é primário)
  // NOTA: Esta função é síncrona para compatibilidade, mas o sistema agora usa Firestore como primário
  // Para carregar do Firestore, use loadConfigAsync()
  static loadConfig(tableName: string): DashboardConfig | null {
    if (!tableName) return null

    try {
      // Tentar carregar do localStorage (cache/backup)
      const storageKey = this.getStorageKey(tableName)
      const saved = localStorage.getItem(storageKey)
      
      if (saved) {
        const parsed = JSON.parse(saved)
        
        if (parsed.widgets && Array.isArray(parsed.widgets) && parsed.widgets.length > 0 && parsed.version === this.CURRENT_VERSION) {
          return parsed as DashboardConfig
        }
        
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

  // Salvar todas as configurações de um cliente (salva em localStorage e Firestore)
  static async saveConfig(tableName: string, config: Partial<DashboardConfig>): Promise<void> {
    console.log('💾 [saveConfig-1] saveConfig chamado:', { tableName, config: { widgets: config.widgets?.length, customTabs: config.customTabs?.length } })
    // TEMPORÁRIO: log bem visível
    console.warn('🔔 DEBUG saveConfig:', tableName)
    if (!tableName) {
      console.warn('⚠️ [saveConfig-SKIP] tableName vazio, retornando')
      return
    }

    try {
      console.log('💾 [saveConfig-2] Iniciando salvamento...')
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

      // Salvar no Firestore primeiro (fonte primária)
      console.log('🔄 [1] Iniciando processo de salvamento no Firestore (fonte primária)...')
      try {
        const { DashboardFirestore } = await import('../services/dashboardFirestore')
        console.log('📤 [2] Tentando salvar no Firestore...', { 
          tableName, 
          widgets: updated.widgets.length, 
          customTabs: updated.customTabs?.length || 0,
          widgetsWithDataSource: updated.widgets.filter(w => w.dataSource).map(w => ({ id: w.id, dataSource: w.dataSource }))
        })
        // Garantir que widgets tenham dataSource preservado
        const widgetsToSave = updated.widgets.map(w => ({
          ...w,
          // Preservar dataSource se existir, mesmo que seja string vazia (será tratado como null no backend)
          ...(w.dataSource !== undefined && w.dataSource !== null ? { dataSource: w.dataSource } : {})
        }))
        const configToSave = {
          ...updated,
          widgets: widgetsToSave
        }
        console.log('📤 [2.5] Widgets a serem salvos com dataSource:', widgetsToSave.map(w => ({ id: w.id, type: w.type, dataSource: w.dataSource })))
        await DashboardFirestore.saveConfig(tableName, configToSave)
        console.log('✅ [3] Configurações salvas no Firestore com sucesso!', { tableName })
        
        // Após salvar no Firestore com sucesso, salvar no localStorage como backup/cache
        console.log('💾 [4] Salvando no localStorage como backup...')
        localStorage.setItem(storageKey, JSON.stringify(updated))
        console.log('💾 [5] Configurações salvas no localStorage (backup):', { tableName, widgets: updated.widgets.length, customTabs: updated.customTabs?.length || 0 })
      } catch (error) {
        console.error('❌ [ERRO] Erro ao salvar no Firestore:', error)
        console.error('Detalhes do erro:', {
          message: (error as any)?.message,
          code: (error as any)?.code,
          stack: (error as any)?.stack,
          name: (error as any)?.name
        })
        
        // Se falhar no Firestore, salvar no localStorage como fallback
        console.warn('⚠️ Salvando no localStorage como fallback (Firestore falhou)')
        localStorage.setItem(storageKey, JSON.stringify(updated))
        console.log('💾 Configurações salvas no localStorage (fallback):', { tableName })
      }
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

  static async deleteCustomTab(tableName: string, tabId: string): Promise<void> {
    const tabs = this.getCustomTabs(tableName)
    const tabToDelete = tabs.find(t => t.id === tabId)
    const isUniversal = tabToDelete?.isUniversal === true
    
    const updatedTabs = tabs.filter(t => t.id !== tabId)
    await this.saveConfig(tableName, { customTabs: updatedTabs })
    
    // Se for uma aba universal, também remover do documento _universal
    if (isUniversal) {
      try {
        const { DashboardFirestore } = await import('../services/dashboardFirestore')
        await DashboardFirestore.deleteUniversalTab(tabId)
        console.log('✅ Aba universal removida do documento _universal:', tabId)
      } catch (error) {
        console.error('❌ Erro ao remover aba universal do documento _universal:', error)
      }
    }
    
    // Remover widgets associados a esta aba
    const config = this.loadConfig(tableName)
    if (config?.widgets) {
      const updatedWidgets = config.widgets.filter(w => w.customTabId !== tabId)
      await this.saveConfig(tableName, { widgets: updatedWidgets })
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
  console.log('🎬 [DEBUG] OverviewDashboard renderizado:', {
    selectedTable,
    startDate,
    endDate,
    timestamp: new Date().toISOString()
  })
  
  // Helper para verificar se o usuário tem nível de acesso "all"
  const hasAllAccess = useMemo(() => {
    try {
      // 1. Tentar login-response
      const loginResponse = localStorage.getItem('login-response')
      if (loginResponse) {
        const parsed = JSON.parse(loginResponse)
        const hasAccess = parsed.table_name === 'all' || parsed.access_control === 'all'
        console.log('🔍 Verificação de acesso "all":', { 
          table_name: parsed.table_name,
          access_control: parsed.access_control,
          hasAllAccess: hasAccess
        })
        return hasAccess
      }
      
      // 2. Tentar mymetric-auth (fallback)
      const authData = localStorage.getItem('mymetric-auth')
      if (authData) {
        const parsed = JSON.parse(authData)
        const user = parsed.user || parsed
        const hasAccess = user?.tablename === 'all' || user?.access_control === 'all'
        console.log('🔍 Verificação de acesso "all" (mymetric-auth):', { 
          tablename: user?.tablename,
          access_control: user?.access_control,
          hasAllAccess: hasAccess
        })
        return hasAccess
      }
      
      // 3. Tentar mymetric-auth-complete (fallback)
      const authComplete = localStorage.getItem('mymetric-auth-complete')
      if (authComplete) {
        const parsed = JSON.parse(authComplete)
        const user = parsed.authData?.user || parsed.user
        const hasAccess = user?.tablename === 'all' || user?.access_control === 'all'
        console.log('🔍 Verificação de acesso "all" (mymetric-auth-complete):', { 
          tablename: user?.tablename,
          access_control: user?.access_control,
          hasAllAccess: hasAccess
        })
        return hasAccess
      }
    } catch (error) {
      console.error('Erro ao verificar nível de acesso do usuário:', error)
    }
    console.log('⚠️ Usuário não tem acesso "all" - edição de abas universais bloqueada')
    return false
  }, [])

  // Helper para verificar se o usuário tem email @mymetric.com.br (mantido para compatibilidade)
  const isMyMetricUser = useMemo(() => {
    try {
      // Tentar múltiplas fontes de email
      let email = ''
      
      // 1. Tentar login-response
      const loginResponse = localStorage.getItem('login-response')
      if (loginResponse) {
        const parsed = JSON.parse(loginResponse)
        email = parsed.email || parsed.user?.email || parsed.user_email || ''
        console.log('🔍 login-response:', { parsed, email })
      }
      
      // 2. Tentar mymetric-auth (fallback)
      if (!email) {
        const authData = localStorage.getItem('mymetric-auth')
        if (authData) {
          const parsed = JSON.parse(authData)
          email = parsed.user?.email || parsed.email || ''
          console.log('🔍 mymetric-auth:', { parsed, email })
        }
      }
      
      // 3. Tentar mymetric-auth-complete (fallback)
      if (!email) {
        const authComplete = localStorage.getItem('mymetric-auth-complete')
        if (authComplete) {
          const parsed = JSON.parse(authComplete)
          email = parsed.authData?.user?.email || parsed.email || ''
          console.log('🔍 mymetric-auth-complete:', { parsed, email })
        }
      }
      
      const isMyMetric = email && email.includes('@mymetric.com.br')
      console.log('🔍 Verificação de usuário MyMetric:', { 
        email, 
        isMyMetric,
        sources: {
          loginResponse: !!loginResponse,
          mymetricAuth: !!localStorage.getItem('mymetric-auth'),
          mymetricAuthComplete: !!localStorage.getItem('mymetric-auth-complete')
        }
      })
      return isMyMetric
    } catch (error) {
      console.error('Erro ao verificar email do usuário:', error)
    }
    console.log('⚠️ Usuário não é @mymetric.com.br - checkbox de aba universal não será exibido')
    return false
  }, [])

  const [data, setData] = useState<OverviewDataItem[]>([])
  const [allData, setAllData] = useState<OverviewDataItem[]>([])
  // Dados por fonte de dados (dataSource -> dados)
  const [dataBySource, setDataBySource] = useState<Map<string, OverviewDataItem[]>>(new Map())
  const [allDataBySource, setAllDataBySource] = useState<Map<string, OverviewDataItem[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Função para extrair métricas e dimensões disponíveis dos dados
  const extractMetricsAndDimensions = useCallback((dataItems: OverviewDataItem[]) => {
    if (!dataItems || dataItems.length === 0) {
      // Retornar padrões se não há dados
      return {
        dimensions: [
          { key: 'event_date', label: 'Data' },
          { key: 'platform', label: 'Plataforma' },
          { key: 'traffic_category', label: 'Categoria de Tráfego' },
          { key: 'city', label: 'Cidade' },
          { key: 'region', label: 'Região' },
          { key: 'country', label: 'País' }
        ],
        metrics: [
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
          { key: 'revenue_new_customers', label: 'Receita Novos Clientes', type: 'currency' }
        ]
      }
    }

    // Analisar o primeiro item para descobrir campos disponíveis
    const sample = dataItems[0]
    const extractedDimensions: {key: string, label: string}[] = []
    const extractedMetrics: {key: string, label: string, type: 'number' | 'currency' | 'percentage'}[] = []
    
    // Campos conhecidos que são sempre dimensões
    const knownDimensions = ['event_date', 'platform', 'traffic_category', 'city', 'region', 'country', 'campaign', 'ad_group', 'keyword', 'device', 'browser', 'os']
    
    // Campos conhecidos que são sempre métricas numéricas
    const knownNumericMetrics = ['sessions', 'clicks', 'add_to_carts', 'orders', 'paid_orders', 'leads', 'new_customers']
    
    // Campos conhecidos que são métricas monetárias
    const knownCurrencyMetrics = ['revenue', 'paid_revenue', 'cost', 'revenue_new_customers', 'spend', 'impressions']
    
    Object.keys(sample).forEach(key => {
      const value = sample[key as keyof OverviewDataItem]
      const valueType = typeof value
      
      // Se é uma dimensão conhecida
      if (knownDimensions.includes(key)) {
        const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        extractedDimensions.push({ key, label })
        return
      }
      
      // Se é uma métrica conhecida
      if (knownNumericMetrics.includes(key)) {
        const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        extractedMetrics.push({ key, label, type: 'number' })
        return
      }
      
      if (knownCurrencyMetrics.includes(key)) {
        const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        extractedMetrics.push({ key, label, type: 'currency' })
        return
      }
      
      // Classificar baseado no tipo do valor
      if (valueType === 'string' || key.includes('date') || key.includes('id') || key.includes('name')) {
        // Provável dimensão
        const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        if (!extractedDimensions.find(d => d.key === key)) {
          extractedDimensions.push({ key, label })
        }
      } else if (valueType === 'number') {
        // Provável métrica
        const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        // Não classificar automaticamente como currency - todas serão 'number' por padrão
        // Apenas detectar percentage baseado no nome
        const isPercentage = /rate|percent|percentage|ratio/i.test(key)
        
        let type: 'number' | 'currency' | 'percentage' = 'number'
        if (isPercentage) type = 'percentage'
        // Currency não será detectado automaticamente - deve ser configurado manualmente se necessário
        
        if (!extractedMetrics.find(m => m.key === key)) {
          extractedMetrics.push({ key, label, type })
        }
      }
    })
    
    // Ordenar dimensões e métricas
    extractedDimensions.sort((a, b) => a.label.localeCompare(b.label))
    extractedMetrics.sort((a, b) => a.label.localeCompare(b.label))
    
    return { dimensions: extractedDimensions, metrics: extractedMetrics }
  }, [])

  // Estado para todas as fontes de dados disponíveis (da API)
  const [allAvailableDataSources, setAllAvailableDataSources] = useState<DataSource[]>([])
  
  // Estado para fontes de dados configuradas no dashboard (com métricas/dimensões mapeadas)
  const [configuredDataSources, setConfiguredDataSources] = useState<DataSource[]>([])

  // Estados para sub abas personalizadas (precisam estar antes de getWidgetMetricsAndDimensions)
  const [customTabs, setCustomTabs] = useState<CustomTab[]>(() => {
    if (!selectedTable) return []
    return DashboardStorage.getCustomTabs(selectedTable).sort((a, b) => a.order - b.order)
  })

  // Estados para jobs e dados por fonte de dados (precisam estar antes de getWidgetMetricsAndDimensions)
  const jobsBySourceRef = useRef<Map<string, string>>(new Map()) // dataSource -> jobId
  const isProcessingBySourceRef = useRef<Map<string, boolean>>(new Map()) // dataSource -> isProcessing
  const previousDataBySourceRef = useRef<Map<string, OverviewDataItem[]>>(new Map()) // dataSource -> dados do período anterior
  const isLoadingBySource = useState<Map<string, boolean>>(new Map())[0]
  const setIsLoadingBySource = useState<Map<string, boolean>>(new Map())[1]
  
  // Estado centralizado de carregamento por aba
  const [isTabLoading, setIsTabLoading] = useState(false)
  const [tabLoadingProgress, setTabLoadingProgress] = useState<{
    total: number
    loading: number
    loaded: number
    dataSources: string[]
  }>({ total: 0, loading: 0, loaded: 0, dataSources: [] })
  
  // Estado para rastrear elapsed_seconds por dataSource
  const [elapsedSecondsBySource, setElapsedSecondsBySource] = useState<Map<string, number>>(new Map())

  // Função para obter métricas e dimensões de um widget específico
  const getWidgetMetricsAndDimensions = useCallback((widget: Widget) => {
    // Determinar qual dataSource usar: widget > aba > padrão
    let widgetDataSource: string | undefined = widget.dataSource
    
    // Se o widget não tem dataSource, verificar se a aba tem
    if (!widgetDataSource && widget.customTabId) {
      const tab = customTabs.find(t => t.id === widget.customTabId)
      if (tab?.dataSource) {
        widgetDataSource = tab.dataSource
        console.log('📊 Widget herdando dataSource da aba para métricas:', widget.customTabId, widgetDataSource)
      }
    }
    
    // Se há um dataSource (do widget ou da aba), usar métricas mapeadas dessa fonte
    if (widgetDataSource) {
      // Primeiro, tentar usar métricas mapeadas da fonte de dados configurada
      const configuredSource = configuredDataSources.find(ds => ds.endpoint === widgetDataSource)
      if (configuredSource && configuredSource.metrics && configuredSource.dimensions) {
        console.log('📊 Usando métricas mapeadas da fonte de dados:', widgetDataSource, {
          metrics: configuredSource.metrics.length,
          dimensions: configuredSource.dimensions.length
        })
        return {
          metrics: configuredSource.metrics,
          dimensions: configuredSource.dimensions
        }
      }
      
      // Se não há métricas mapeadas, tentar extrair dos dados carregados
      const widgetData = dataBySource.get(widgetDataSource) || []
      if (widgetData.length > 0) {
        console.log('📊 Extraindo métricas dos dados carregados:', widgetDataSource, widgetData.length, 'registros')
        return extractMetricsAndDimensions(widgetData)
      }
      
      // Se os dados ainda não foram carregados, iniciar carregamento
      console.log('🔄 Dados ainda não carregados para fonte:', widgetDataSource, '- iniciando carregamento')
      const isProcessing = isProcessingBySourceRef.current.get(widgetDataSource)
      const isLoading = isLoadingBySource.get(widgetDataSource)
      if (!isProcessing && !isLoading) {
        // fetchDataSourceData será definido depois, então não podemos chamá-lo aqui diretamente
        // Em vez disso, retornar métricas vazias e o useEffect que monitora widgets iniciará o carregamento
      }
      
      // Retornar métricas vazias temporariamente (serão atualizadas quando dados carregarem)
      return { metrics: [], dimensions: [] }
    }
    
    // Caso contrário, usar dados padrão e métricas/dimensões padrão
    if (data.length > 0) {
      return extractMetricsAndDimensions(data)
    }
    
    // Fallback para métricas e dimensões padrão
    return extractMetricsAndDimensions([])
  }, [data, dataBySource, customTabs, configuredDataSources, extractMetricsAndDimensions, isLoadingBySource])
  
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

  // Estados para sub abas personalizadas (customTabs já foi declarado acima)
  const [activeCustomTab, setActiveCustomTab] = useState<string | null>(null) // null = mostrar widgets sem aba
  const [showCustomTabModal, setShowCustomTabModal] = useState(false)
  const [editingCustomTab, setEditingCustomTab] = useState<CustomTab | null>(null)
  const [customTabFormData, setCustomTabFormData] = useState({ name: '', icon: 'BarChart3', order: 0, isUniversal: false, dataSource: '' })
  const [draggedCustomTab, setDraggedCustomTab] = useState<string | null>(null)

  // Estados para edição de widgets individuais
  const [editingWidget, setEditingWidget] = useState<{ id: string; type: 'cards' | 'timeline' | 'table' | 'runrate' } | null>(null)
  
  // Estado para modal de reordenação
  const [showReorderModal, setShowReorderModal] = useState(false)
  
  // Estado para modal de adicionar widget
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false)
  // Estado para controlar a etapa do modal (seleção de fonte ou tipo de widget)
  const [addWidgetStep, setAddWidgetStep] = useState<'selectDataSource' | 'selectWidgetType'>('selectDataSource')
  
  // Estado para modo de edição/visualização (padrão: visualização)
  const [isEditMode, setIsEditMode] = useState(false)

  // Fullscreen (overlay) do widget de tabela
  const [fullscreenTableWidgetId, setFullscreenTableWidgetId] = useState<string | null>(null)
  
  // Estados para busca nos modais de edição
  const [cardsMetricSearch, setCardsMetricSearch] = useState('')
  const [timelineMetricSearch, setTimelineMetricSearch] = useState('')
  const [tableMetricSearch, setTableMetricSearch] = useState('')
  const [tableDimensionSearch, setTableDimensionSearch] = useState('')
  
  // Busca por widget (ex.: tabela)
  const [tableWidgetSearchById, setTableWidgetSearchById] = useState<Record<string, string>>({})

  // Estado para busca de métricas na sidebar
  const [metricSearchTerm, setMetricSearchTerm] = useState('')
  
  // Estado para modal de gerenciamento de fontes de dados
  const [showDataSourcesModal, setShowDataSourcesModal] = useState(false)
  
  // Estado para mostrar amostra de dados de uma fonte
  const [showingDataSample, setShowingDataSample] = useState<string | null>(null)

  // Fechar fullscreen do widget de tabela com ESC e travar scroll do body
  useEffect(() => {
    if (!fullscreenTableWidgetId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenTableWidgetId(null)
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [fullscreenTableWidgetId])

  // Estado para modal de métricas calculadas por fonte
  const [calculatedMetricsDataSource, setCalculatedMetricsDataSource] = useState<string | null>(null)
  const [editingCalculatedMetricKey, setEditingCalculatedMetricKey] = useState<string | null>(null)
  const [calculatedMetricForm, setCalculatedMetricForm] = useState<{
    key: string
    label: string
    type: 'number' | 'currency' | 'percentage'
    formula: string
  }>({ key: '', label: '', type: 'number', formula: '' })

  const closeCalculatedMetricsModal = useCallback(() => {
    setCalculatedMetricsDataSource(null)
    setEditingCalculatedMetricKey(null)
    setCalculatedMetricForm({ key: '', label: '', type: 'number', formula: '' })
  }, [])

  const recomputeCalculatedMetricsForSource = useCallback((endpoint: string, sourcesOverride?: DataSource[]) => {
    const sources = sourcesOverride || configuredDataSources
    const source = sources.find(ds => ds.endpoint === endpoint)
    if (!source) return
    const calculated = (source.metrics || [])
      .filter((m: any) => m?.isCalculated && typeof m?.formula === 'string')
      .map((m: any) => ({
        key: m.key,
        label: m.label,
        type: m.type,
        isCalculated: true,
        formula: m.formula
      })) as CalculatedMetric[]

    if (!calculated.length) return

    const allRows = allDataBySource.get(endpoint) || []
    
    // IMPORTANTE: Para métricas agregadas (como sum() / sum()), precisamos aplicar o filtro de data ANTES do cálculo
    // Para métricas não-agregadas (linha por linha), calculamos em todos os dados e filtramos depois
    const hasAggregateMetrics = calculated.some(m => hasAggregateFunctions(m.formula))
    
    // Preparar dados filtrados se necessário (para métricas agregadas com filtro de data)
    let rowsToCalculate = allRows
    if (hasAggregateMetrics && startDate && endDate) {
      const dateField = source.dateField || 'event_date'
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)
      rowsToCalculate = allRows.filter((item: any) => {
        const dateValue = item[dateField]
        if (!dateValue) return false
        const d = new Date(dateValue)
        if (isNaN(d.getTime())) return false
        return d >= startDateObj && d <= endDateObj
      })
      console.log(`🔍 Filtro de data aplicado antes do cálculo de métricas agregadas: ${rowsToCalculate.length} linhas de ${allRows.length} totais`)
    }
    
    // Aplicar métricas calculadas nos dados apropriados
    const computedFiltered = applyCalculatedMetricsToRows(
      rowsToCalculate as unknown as Record<string, unknown>[],
      calculated
    ) as unknown as OverviewDataItem[]

    // Se há métricas agregadas, os valores calculados devem ser aplicados a todas as linhas
    // (porque são valores agregados do período)
    let finalAllRows: OverviewDataItem[]
    if (hasAggregateMetrics && rowsToCalculate.length < allRows.length) {
      // Separar métricas agregadas das não-agregadas
      const aggregateMetrics = calculated.filter(m => hasAggregateFunctions(m.formula))
      const nonAggregateMetrics = calculated.filter(m => !hasAggregateFunctions(m.formula))
      
      // Extrair valores agregados (são os mesmos para todas as linhas do período filtrado)
      const aggregateValues = new Map<string, number>()
      if (computedFiltered.length > 0) {
        aggregateMetrics.forEach(m => {
          aggregateValues.set(m.key, computedFiltered[0][m.key] as number)
        })
      }
      
      // Para métricas não-agregadas, calcular em todos os dados
      if (nonAggregateMetrics.length > 0) {
        const computedNonAggregate = applyCalculatedMetricsToRows(
          allRows as unknown as Record<string, unknown>[],
          nonAggregateMetrics
        ) as unknown as OverviewDataItem[]
        
        // Combinar: métricas agregadas (do período filtrado) + métricas não-agregadas (calculadas linha por linha)
        finalAllRows = allRows.map((row: any, index: number) => {
          const nonAggRow = computedNonAggregate[index] || row
          const result = {...row}
          // Adicionar métricas não-agregadas
          nonAggregateMetrics.forEach(m => {
            result[m.key] = nonAggRow[m.key]
          })
          // Adicionar métricas agregadas (mesmo valor para todas as linhas)
          aggregateValues.forEach((value, key) => {
            result[key] = value
          })
          return result
        }) as OverviewDataItem[]
      } else {
        // Apenas métricas agregadas: aplicar o mesmo valor agregado a todas as linhas
        finalAllRows = allRows.map((row: any) => {
          const result = {...row}
          aggregateValues.forEach((value, key) => {
            result[key] = value
          })
          return result
        }) as OverviewDataItem[]
      }
    } else {
      // Sem métricas agregadas ou sem filtro: usar cálculo direto
      finalAllRows = computedFiltered
    }

    setAllDataBySource(prev => {
      const next = new Map(prev)
      next.set(endpoint, finalAllRows)
      return next
    })

    // Atualizar também o dataset filtrado (respeitando dateField e range atual)
    let filteredRows = finalAllRows
    if (startDate && endDate) {
      const dateField = source.dateField || 'event_date'
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)
      filteredRows = finalAllRows.filter((item: any) => {
        const dateValue = item[dateField]
        if (!dateValue) return false
        const d = new Date(dateValue)
        if (isNaN(d.getTime())) return false
        return d >= startDateObj && d <= endDateObj
      })
    }

    setDataBySource(prev => {
      const next = new Map(prev)
      next.set(endpoint, filteredRows)
      return next
    })
  }, [allDataBySource, configuredDataSources, setAllDataBySource, setDataBySource, startDate, endDate, hasAggregateFunctions])
  
  
  const [selectedDataSourceForNewWidget, setSelectedDataSourceForNewWidget] = useState<string | null>(null)
  
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

  // Testar conexão com Firestore quando selectedTable mudar (apenas uma vez)
  useEffect(() => {
    if (selectedTable) {
      // Testar conexão com Firestore
      DashboardStorage.initFirestore()
        .then(async () => {
          console.log('🧪 Testando conexão com Firestore...')
          const { DashboardFirestore } = await import('../services/dashboardFirestore')
          const result = await DashboardFirestore.testConnection()
          if (result.success) {
            console.log('✅ Teste de conexão com Firestore: SUCESSO!', result.message)
          } else {
            console.error('❌ Teste de conexão com Firestore: FALHOU!', result.message, result.error)
          }
        })
        .catch((error) => {
          console.error('❌ Erro ao testar conexão com Firestore:', error)
        })
    }
  }, [selectedTable])

  // Nota: A busca de fontes disponíveis agora é feita no useEffect que carrega allAvailableDataSources (linha ~1450)
  // E as fontes configuradas são carregadas junto com o DashboardConfig (linha ~1250)
  
  // Definir fonte padrão para novos widgets quando configuredDataSources mudar
  // IMPORTANTE: Não alterar quando activeCustomTab mudar - a fonte de dados deve ser independente da aba
  useEffect(() => {
    if (configuredDataSources.length === 1) {
      setSelectedDataSourceForNewWidget(configuredDataSources[0].endpoint)
    } else if (configuredDataSources.length > 1) {
      // Se há múltiplas fontes, definir a primeira não restrita ou a primeira disponível
      // Mas apenas se ainda não foi definido (preservar seleção do usuário)
      const currentSelection = selectedDataSourceForNewWidget
      if (!currentSelection || !configuredDataSources.find(s => s.endpoint === currentSelection)) {
        const defaultSource = configuredDataSources.find(s => !s.restricted) || configuredDataSources[0]
        setSelectedDataSourceForNewWidget(defaultSource?.endpoint || null)
      }
    } else {
      setSelectedDataSourceForNewWidget(null)
    }
  }, [configuredDataSources]) // Apenas quando configuredDataSources mudar, NÃO quando activeCustomTab mudar

  // Recarregar customTabs quando selectedTable mudar (carregar do Firestore primeiro)
  useEffect(() => {
    if (selectedTable) {
      console.log('🔄 Carregando abas para cliente:', selectedTable)
      // Carregar do Firestore primeiro (fonte primária) - isso já inclui abas universais
      DashboardStorage.loadConfigAsync(selectedTable)
        .then((config) => {
          const tabs = (config?.customTabs || []).sort((a, b) => a.order - b.order)
          console.log('📑 Abas carregadas:', {
            total: tabs.length,
            clientTabs: tabs.filter(t => !t.isUniversal).length,
            universalTabs: tabs.filter(t => t.isUniversal).length,
            tabs: tabs.map(t => ({ name: t.name, isUniversal: t.isUniversal, dataSource: t.dataSource }))
          })
          setCustomTabs(tabs)
          
          // Carregar fontes de dados configuradas
          if (config?.dataSources && Array.isArray(config.dataSources)) {
            console.log('📊 Fontes de dados carregadas do Firestore:', config.dataSources.length)
            setConfiguredDataSources(config.dataSources)
          } else {
            console.log('⚠️ Nenhuma fonte de dados encontrada na configuração')
            setConfiguredDataSources([])
          }
          
          // Abrir a primeira aba customizada ao carregar o dashboard
          if (tabs.length > 0) {
            setActiveCustomTab(tabs[0].id)
            console.log('📑 Primeira aba customizada ativada ao abrir o dashboard:', tabs[0].name)
          } else {
            setActiveCustomTab(null)
            console.log('📑 Nenhuma aba customizada disponível')
          }
        })
        .catch((error) => {
          console.error('❌ Erro ao carregar customTabs do Firestore:', error)
          // Fallback: tentar localStorage
          const tabs = DashboardStorage.getCustomTabs(selectedTable).sort((a, b) => a.order - b.order)
          console.log('📑 Abas carregadas do localStorage (fallback):', tabs.length)
          setCustomTabs(tabs)
          
          // Abrir a primeira aba customizada ao carregar o dashboard (fallback)
          if (tabs.length > 0) {
            setActiveCustomTab(tabs[0].id)
            console.log('📑 Primeira aba customizada ativada ao abrir o dashboard (fallback):', tabs[0].name)
          } else {
            setActiveCustomTab(null)
            console.log('📑 Nenhuma aba customizada disponível (fallback)')
          }
        })
      
      // Tentar inicializar Firestore quando selectedTable mudar
      DashboardStorage.initFirestore().catch((error) => {
        console.warn('⚠️ Erro ao inicializar Firestore:', error)
      })
    } else {
      setCustomTabs([])
      setActiveCustomTab(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable])

  // Filtrar widgets por sub aba ativa
  const filteredWidgets = useMemo(() => {
    console.log('🔍 Filtrando widgets:', {
      totalWidgets: widgets.length,
      activeCustomTab,
      widgetsWithTabId: widgets.filter(w => w.customTabId).length,
      widgetsWithoutTabId: widgets.filter(w => !w.customTabId).length
    })
    
    if (activeCustomTab === null) {
      // Se não há aba ativa, não mostrar widgets
      console.log('📋 Nenhuma aba ativa, não mostrando widgets')
      return []
    }
    // Mostrar widgets da sub aba ativa
    const filtered = widgets.filter(w => w.customTabId === activeCustomTab)
    console.log('📋 Widgets filtrados (aba específica):', filtered.length, 'para aba', activeCustomTab)
    return filtered
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
      console.log('💾 [SAVE-1] Widgets mudaram, salvando...', { 
        widgets: widgets.length, 
        selectedTable,
        prevWidgets: prevWidgetsRef.current.length 
      })
      console.log('💾 [SAVE-1.5] Widgets com dataSource:', widgets.map(w => ({ id: w.id, type: w.type, dataSource: w.dataSource })))
      console.log('💾 [SAVE-2] Chamando DashboardStorage.saveConfig...')
      // TEMPORÁRIO: alert para debug
      if (window.location.hostname === 'localhost') {
        console.warn('🔔 DEBUG: Widgets mudaram, iniciando salvamento')
      }
      DashboardStorage.saveConfig(selectedTable, { widgets })
        .then(() => {
          console.log('💾 [SAVE-3] DashboardStorage.saveConfig concluído')
        })
        .catch((error) => {
          console.error('❌ [SAVE-ERRO] Erro ao salvar widgets:', error)
          console.error('Stack:', error?.stack)
        })
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
        // Carregar do Firestore primeiro (fonte primária)
        DashboardStorage.loadConfigAsync(selectedTable)
          .then((config) => {
            console.log('📥 [LOAD] Config carregada do Firestore:', {
              hasConfig: !!config,
              widgetsCount: config?.widgets?.length || 0,
              widgets: config?.widgets,
              customTabsCount: config?.customTabs?.length || 0
            })
            
            if (config) {
              // Sempre atualizar widgets, mesmo se vazio (para limpar estado antigo)
              if (config.widgets && Array.isArray(config.widgets)) {
                // Verificar se dataSource está presente nos widgets e preservá-lo
                const widgetsWithDataSource = config.widgets.map(w => {
                  console.log('🔍 Widget carregado:', { id: w.id, type: w.type, dataSource: w.dataSource, hasDataSource: 'dataSource' in w })
                  // Garantir que o campo dataSource seja preservado mesmo se for null ou undefined
                  return {
                    ...w,
                    // Preservar dataSource se existir (mesmo que seja null ou string vazia)
                    ...(w.dataSource !== undefined ? { dataSource: w.dataSource } : {})
                  }
                })
                console.log('📊 Widgets processados:', widgetsWithDataSource.map(w => ({ id: w.id, type: w.type, dataSource: w.dataSource })))
                setWidgets(widgetsWithDataSource)
                prevWidgetsRef.current = widgetsWithDataSource
                isWidgetsInitialMountRef.current = true
                hasLoadedWidgetsRef.current = true
                console.log('✅ Widgets carregados do Firestore:', widgetsWithDataSource.length, 'widgets')
                console.log('📊 Widgets com dataSource:', widgetsWithDataSource.filter(w => w.dataSource).map(w => ({ id: w.id, dataSource: w.dataSource })))
              } else {
                // Se não há widgets na config, limpar
                console.log('⚠️ Config sem widgets, limpando estado')
                setWidgets([])
                prevWidgetsRef.current = []
                isWidgetsInitialMountRef.current = true
                hasLoadedWidgetsRef.current = true
              }
            } else {
              // Fallback: tentar localStorage
              console.log('⚠️ Config não encontrada no Firestore, tentando localStorage...')
              const localConfig = DashboardStorage.loadConfig(selectedTable)
              if (localConfig?.widgets && Array.isArray(localConfig.widgets) && localConfig.widgets.length > 0) {
                setWidgets(localConfig.widgets)
                prevWidgetsRef.current = localConfig.widgets
                isWidgetsInitialMountRef.current = true
                hasLoadedWidgetsRef.current = true
                console.log('✅ Widgets recarregados do localStorage (fallback):', localConfig.widgets.length, 'widgets')
              } else {
                console.log('⚠️ Nenhum widget encontrado em nenhuma fonte')
                setWidgets([])
                prevWidgetsRef.current = []
                isWidgetsInitialMountRef.current = true
                hasLoadedWidgetsRef.current = true
              }
            }
          })
          .catch((error) => {
            console.error('❌ Erro ao carregar widgets do Firestore:', error)
            // Fallback: tentar localStorage
            const localConfig = DashboardStorage.loadConfig(selectedTable)
            if (localConfig?.widgets && localConfig.widgets.length > 0) {
              setWidgets(localConfig.widgets)
              prevWidgetsRef.current = localConfig.widgets
              isWidgetsInitialMountRef.current = true
              hasLoadedWidgetsRef.current = true
              console.log('🔄 Widgets recarregados do localStorage (fallback após erro):', localConfig.widgets.length, 'widgets')
            }
          })
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
  const isUniversalTabId = useCallback((tabId?: string | null): boolean => {
    if (!tabId) return false
    const tab = customTabs.find(t => t.id === tabId)
    return tab?.isUniversal === true
  }, [customTabs])

  const canModifyWidget = useCallback((widget?: Widget): boolean => {
    if (!widget) return true
    if (!isUniversalTabId(widget.customTabId)) return true
    return hasAllAccess
  }, [hasAllAccess, isUniversalTabId])

  const addWidget = (type: 'cards' | 'timeline' | 'table' | 'runrate', dataSource?: string) => {
    // Bloquear criação de widgets em abas universais para usuários sem acesso "all"
    if (isUniversalTabId(activeCustomTab) && !hasAllAccess) {
      alert('Você não tem permissão para editar widgets de uma aba universal.')
      return
    }

    // Prevenir adição duplicada
    if (addingWidgetRef.current) {
      return
    }
    
    addingWidgetRef.current = true
    
    // Se não foi fornecido dataSource, usar o selecionado ou null (usa selectedTable como padrão)
    const widgetDataSource = dataSource || selectedDataSourceForNewWidget || null
    
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
      customTabId: activeCustomTab || undefined, // Associar à sub aba ativa
      // Sempre incluir dataSource se fornecido (mesmo que seja string vazia, será tratado como null)
      ...(widgetDataSource && widgetDataSource.trim() !== '' ? { dataSource: widgetDataSource } : {})
    }
    console.log('🆕 Novo widget criado:', { id: newWidget.id, type: newWidget.type, dataSource: newWidget.dataSource, widgetDataSource })
    setWidgets(prev => {
      const newWidgets = [...prev, newWidget]
      console.log('📋 Widgets após adicionar novo:', newWidgets.map(w => ({ id: w.id, type: w.type, dataSource: w.dataSource })))
      return newWidgets
    })
    setEditingWidget({ id: newWidget.id, type })
    
    // Resetar após um pequeno delay
    setTimeout(() => {
      addingWidgetRef.current = false
    }, 100)
  }

  const removeWidget = (id: string) => {
    setWidgets(prev => {
      const target = prev.find(w => w.id === id)
      if (!canModifyWidget(target)) {
        console.warn('🚫 Tentativa de remover widget de aba universal sem permissão:', { widgetId: id })
        return prev
      }
      const newWidgets = prev.filter(w => w.id !== id)
      // Salvar imediatamente
      if (selectedTable) {
        console.log('💾 Removendo widget, salvando...', { widgets: newWidgets.length })
        DashboardStorage.saveConfig(selectedTable, { widgets: newWidgets }).catch((error) => {
          console.error('❌ Erro ao salvar após remover widget:', error)
        })
      }
      return newWidgets
    })
  }

  const removeAllWidgets = () => {
    if (window.confirm('Tem certeza que deseja remover todos os widgets? Esta ação não pode ser desfeita.')) {
      setWidgets(prev => {
        if (!hasAllAccess) {
          // Manter widgets que pertencem a abas universais
          const kept = prev.filter(w => isUniversalTabId(w.customTabId))
          const removedCount = prev.length - kept.length
          if (removedCount > 0) {
            alert('Foram removidos apenas widgets não-universais. Widgets de abas universais não podem ser removidos.')
          }
          if (selectedTable) {
            DashboardStorage.saveConfig(selectedTable, { widgets: kept }).catch((error) => {
              console.error('❌ Erro ao salvar após remover widgets não-universais:', error)
            })
          }
          return kept
        }

        // Admin/all: remover tudo
        if (selectedTable) {
          console.log('💾 Removendo todos os widgets, salvando...')
          DashboardStorage.saveConfig(selectedTable, { widgets: [] }).catch((error) => {
            console.error('❌ Erro ao salvar após remover todos os widgets:', error)
          })
        }
        return []
      })
    }
  }

  // ========== FUNÇÕES DE GERENCIAMENTO DE FONTES DE DADOS ==========
  
  // Carregar todas as fontes disponíveis da API
  useEffect(() => {
    if (selectedTable) {
      (async () => {
        try {
          const { DashboardFirestore } = await import('../services/dashboardFirestore')
          const sources = await DashboardFirestore.getDataSources(selectedTable)
          // O backend já filtra corretamente baseado no clientSlug:
          // - Endpoints com clientSlug vazio são acessíveis a todos
          // - Endpoints com clientSlug igual ao selectedTable são incluídos
          // - Endpoints com clientSlug diferente são excluídos
          setAllAvailableDataSources(sources)
          console.log('✅ Fontes disponíveis carregadas:', {
            total: sources.length,
            forClient: selectedTable,
            endpoints: sources.map(s => s.endpoint)
          })
        } catch (error) {
          console.error('❌ Erro ao buscar fontes disponíveis:', error)
          setAllAvailableDataSources([])
        }
      })()
    } else {
      // Se não há cliente selecionado, limpar as fontes disponíveis
      setAllAvailableDataSources([])
    }
  }, [selectedTable])

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(prev => {
      const widget = prev.find(w => w.id === id)
      if (!canModifyWidget(widget)) {
        console.warn('🚫 Tentativa de editar widget de aba universal sem permissão:', { widgetId: id, updates })
        return prev
      }
      const updated = prev.map(w => w.id === id ? { ...w, ...updates } : w)
      const updatedWidget = updated.find(w => w.id === id)
      
      // Se o dataSource foi atualizado, iniciar busca imediatamente
      if (updates.dataSource && updatedWidget?.dataSource) {
        const oldDataSource = widget?.dataSource
        const newDataSource = updatedWidget.dataSource
        
        if (oldDataSource !== newDataSource) {
          console.log('🔄 DataSource atualizado, iniciando busca imediata:', {
            widgetId: id,
            oldDataSource,
            newDataSource
          })
          
          // Iniciar busca para o novo dataSource será feito quando fetchDataSourceData estiver disponível
          // Será tratado pelo useEffect que monitora widgets com dataSource
          console.log('🔄 DataSource atualizado, busca será iniciada automaticamente:', newDataSource)
        }
      }
      
      // Salvar imediatamente
      if (selectedTable) {
        console.log('💾 Atualizando widget, salvando...', { widgetId: id, updates, updatedWidget: updatedWidget?.dataSource })
        console.log('💾 Widgets a serem salvos:', updated.map(w => ({ id: w.id, type: w.type, dataSource: w.dataSource })))
        DashboardStorage.saveConfig(selectedTable, { widgets: updated }).catch((error) => {
          console.error('❌ Erro ao salvar após atualizar widget:', error)
        })
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
      // Bloquear reordenação de widgets em abas universais para usuários sem acesso "all"
      if (!hasAllAccess) {
        const dragged = prev.find(w => w.id === draggedWidget)
        const dropped = prev.find(w => w.id === dropWidgetId)
        if (!canModifyWidget(dragged) || !canModifyWidget(dropped)) {
          console.warn('🚫 Tentativa de reordenar widget de aba universal sem permissão:', {
            draggedWidget,
            dropWidgetId
          })
          return prev
        }
      }

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
  const moveWidgetUp = (filteredIndex: number) => {
    if (filteredIndex === 0 || !selectedTable) return
    
    setWidgets(prev => {
      // Obter apenas os widgets da sub aba ativa
      const filtered = activeCustomTab === null
        ? []
        : prev.filter(w => w.customTabId === activeCustomTab)
      
      if (filteredIndex === 0 || filteredIndex >= filtered.length) return prev
      
      // Encontrar o widget no array completo
      const widgetToMove = filtered[filteredIndex]
      const widgetToSwap = filtered[filteredIndex - 1]
      
      if (!widgetToMove || !widgetToSwap) return prev
      
      const newWidgets = [...prev]
      const indexToMove = newWidgets.findIndex(w => w.id === widgetToMove.id)
      const indexToSwap = newWidgets.findIndex(w => w.id === widgetToSwap.id)
      
      if (indexToMove === -1 || indexToSwap === -1) return prev
      
      // Trocar posições
      const temp = newWidgets[indexToSwap]
      newWidgets[indexToSwap] = newWidgets[indexToMove]
      newWidgets[indexToMove] = temp
      
      // Salvar imediatamente
      DashboardStorage.saveConfig(selectedTable, { widgets: newWidgets })
      console.log('✅ Widgets reordenados e salvos:', newWidgets.length)
      
      return newWidgets
    })
  }

  const moveWidgetDown = (filteredIndex: number) => {
    if (!selectedTable) return
    
    setWidgets(prev => {
      // Obter apenas os widgets da sub aba ativa
      const filtered = activeCustomTab === null
        ? []
        : prev.filter(w => w.customTabId === activeCustomTab)
      
      if (filteredIndex >= filtered.length - 1) return prev
      
      // Encontrar o widget no array completo
      const widgetToMove = filtered[filteredIndex]
      const widgetToSwap = filtered[filteredIndex + 1]
      
      if (!widgetToMove || !widgetToSwap) return prev
      
      const newWidgets = [...prev]
      const indexToMove = newWidgets.findIndex(w => w.id === widgetToMove.id)
      const indexToSwap = newWidgets.findIndex(w => w.id === widgetToSwap.id)
      
      if (indexToMove === -1 || indexToSwap === -1) return prev
      
      // Trocar posições
      const temp = newWidgets[indexToSwap]
      newWidgets[indexToSwap] = newWidgets[indexToMove]
      newWidgets[indexToMove] = temp
      
      // Salvar imediatamente
      console.log('💾 Reordenando widgets (down), salvando...', { widgets: newWidgets.length })
      DashboardStorage.saveConfig(selectedTable, { widgets: newWidgets }).catch((error) => {
        console.error('❌ Erro ao salvar widgets reordenados:', error)
      })
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
  
  
  // Função para calcular totais a partir de dados específicos (dinâmica - soma todas as métricas numéricas)
  // Função auxiliar para obter todas as métricas calculadas de todas as fontes de dados
  const getAllCalculatedMetrics = useCallback((): CalculatedMetric[] => {
    const allCalculated: CalculatedMetric[] = []
    configuredDataSources.forEach(source => {
      if (source.metrics) {
        source.metrics.forEach((m: any) => {
          if (m?.isCalculated && typeof m?.formula === 'string') {
            allCalculated.push({
              key: m.key,
              label: m.label,
              type: m.type || 'number',
              isCalculated: true,
              formula: m.formula
            })
          }
        })
      }
    })
    return allCalculated
  }, [configuredDataSources])

  const calculateTotalsFromData = useCallback((dataItems: OverviewDataItem[]) => {
    if (!dataItems || dataItems.length === 0) {
      return {} as any
    }
    
    // Obter todas as métricas calculadas para excluí-las da soma
    const calculatedMetrics = getAllCalculatedMetrics()
    const calculatedMetricKeys = new Set(calculatedMetrics.map(m => m.key))
    
    // Também excluir métricas derivadas hardcoded
    const hardcodedCalculatedMetrics = new Set([
      'conversion_rate',
      'add_to_cart_rate',
      'leads_conversion_rate',
      'paid_conversion_rate',
      'revenue_per_session',
      'avg_order_value',
      'roas',
      'new_customer_rate'
    ])
    
    // Começar com valores padrão conhecidos
    const baseTotals: any = {
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
    }
    
    // Coletar todas as chaves numéricas de TODOS os itens (não apenas o primeiro)
    // Isso garante que métricas que aparecem apenas em alguns registros sejam incluídas
    const numericKeys = new Set<string>()
    
    // Verificar todos os itens para encontrar todas as chaves numéricas
    dataItems.forEach((item: any) => {
      Object.keys(item).forEach(key => {
        const value = item[key]
        // Ignorar campos que não são numéricos (strings, objetos, datas, etc)
        // Mas ser mais permissivo - apenas excluir campos claramente não-numéricos
        // IMPORTANTE: Excluir métricas calculadas - elas não devem ser somadas!
        if (typeof value === 'number' && !isNaN(value) && 
            !calculatedMetricKeys.has(key) && 
            !hardcodedCalculatedMetrics.has(key)) {
          // Excluir apenas campos que claramente não são métricas
          const lowerKey = key.toLowerCase()
          if (!lowerKey.includes('date') && 
              !lowerKey.includes('_id') && 
              !lowerKey.endsWith('_id') &&
              !lowerKey.includes('name') &&
              !lowerKey.includes('email') &&
              !lowerKey.includes('url') &&
              !lowerKey.includes('link')) {
            numericKeys.add(key)
            if (!(key in baseTotals)) {
              baseTotals[key] = 0
            }
          }
        }
      })
    })
    
    // Somar todos os valores numéricos (EXCLUINDO métricas calculadas)
    const result = dataItems.reduce((acc, item: any) => {
      numericKeys.forEach(key => {
        const value = item[key]
        if (typeof value === 'number' && !isNaN(value) &&
            !calculatedMetricKeys.has(key) &&
            !hardcodedCalculatedMetrics.has(key)) {
          acc[key] = (acc[key] || 0) + value
        }
      })
      return acc
    }, { ...baseTotals })
    
    console.log('📊 [DEBUG] calculateTotalsFromData:', {
      dataItemsCount: dataItems.length,
      numericKeysCount: numericKeys.size,
      calculatedMetricsExcluded: Array.from(calculatedMetricKeys),
      numericKeys: Array.from(numericKeys).slice(0, 20), // Primeiras 20 para debug
      sampleTotals: Object.keys(result).slice(0, 10).reduce((obj: any, key) => {
        obj[key] = result[key]
        return obj
      }, {})
    })
    
    return result
  }, [getAllCalculatedMetrics])

  // Função para obter o valor da métrica (agora aceita dados opcionais do widget e é dinâmica)
  const getMetricValue = (metricKey: string, widgetData?: OverviewDataItem[]): number => {
    // Se dados do widget foram fornecidos, calcular totais a partir deles
    const widgetTotals = widgetData ? calculateTotalsFromData(widgetData) : null
    const totalsToUse = widgetTotals || totals
    
    // Verificar se é uma métrica calculada (personalizada)
    const allCalculatedMetrics = getAllCalculatedMetrics()
    const calculatedMetric = allCalculatedMetrics.find(m => m.key === metricKey)
    
    if (calculatedMetric) {
      // Recalcular métrica calculada a partir dos totais agregados
      try {
        // Para métricas calculadas com agregações (sum(), avg(), etc), usar evaluateAggregateFormula
        if (hasAggregateFunctions(calculatedMetric.formula)) {
          // Usar os dados originais para calcular agregações
          const dataToCalculate = widgetData || filteredData
          if (dataToCalculate.length > 0) {
            const rawResult = evaluateAggregateFormula(calculatedMetric.formula, dataToCalculate as unknown as Record<string, unknown>[])
            const result = calculatedMetric.type === 'percentage' ? rawResult * 100 : rawResult
            console.log(`🧮 Métrica calculada agregada "${metricKey}": ${calculatedMetric.formula} = ${result}`)
            return result
          }
        } else {
          // Para métricas não-agregadas, calcular usando os totais
          const rawResult = evaluateFormula(calculatedMetric.formula, totalsToUse as any)
          const result = calculatedMetric.type === 'percentage' ? rawResult * 100 : rawResult
          console.log(`🧮 Métrica calculada "${metricKey}": ${calculatedMetric.formula} = ${result}`)
          console.log(`   Totais usados:`, {
            paid_revenue: totalsToUse.paid_revenue,
            cost: totalsToUse.cost,
            revenue: totalsToUse.revenue
          })
          return result
        }
      } catch (error) {
        console.error(`❌ Erro ao calcular métrica "${metricKey}":`, error)
        return 0
      }
    }
    
    // Calcular métricas derivadas hardcoded se necessário
    const widgetConversionRate = widgetTotals && widgetTotals.sessions > 0 
      ? (widgetTotals.orders / widgetTotals.sessions) * 100 
      : conversionRate
    const widgetAddToCartRate = widgetTotals && widgetTotals.sessions > 0 
      ? (widgetTotals.add_to_carts / widgetTotals.sessions) * 100 
      : addToCartRate
    const widgetLeadsConversionRate = widgetTotals && widgetTotals.leads > 0 
      ? (widgetTotals.orders / widgetTotals.leads) * 100 
      : leadsConversionRate
    const widgetPaidConversionRate = widgetTotals && widgetTotals.orders > 0 
      ? (widgetTotals.paid_orders / widgetTotals.orders) * 100 
      : paidConversionRate
    const widgetRevenuePerSession = widgetTotals && widgetTotals.sessions > 0 
      ? widgetTotals.revenue / widgetTotals.sessions 
      : revenuePerSession
    const widgetAvgOrderValue = widgetTotals && widgetTotals.orders > 0 
      ? widgetTotals.revenue / widgetTotals.orders 
      : avgOrderValue
    const widgetRoas = widgetTotals && widgetTotals.cost > 0 
      ? widgetTotals.revenue / widgetTotals.cost 
      : roas
    const widgetNewCustomerRate = widgetTotals && widgetTotals.orders > 0 
      ? (widgetTotals.new_customers / widgetTotals.orders) * 100 
      : newCustomerRate
    
    // Métricas derivadas (calculadas hardcoded)
    if (metricKey === 'conversion_rate') return widgetConversionRate
    if (metricKey === 'add_to_cart_rate') return widgetAddToCartRate
    if (metricKey === 'leads_conversion_rate') return widgetLeadsConversionRate
    if (metricKey === 'paid_conversion_rate') return widgetPaidConversionRate
    if (metricKey === 'revenue_per_session') return widgetRevenuePerSession
    if (metricKey === 'avg_order_value') return widgetAvgOrderValue
    if (metricKey === 'roas') return widgetRoas
    if (metricKey === 'new_customer_rate') return widgetNewCustomerRate
    
    // Métricas diretas - buscar dinamicamente no totalsToUse
    // Primeiro, tentar busca exata
    if (metricKey in totalsToUse) {
      const value = (totalsToUse as any)[metricKey]
      if (value !== undefined && value !== null) {
        return typeof value === 'number' ? value : 0
      }
    }
    
    // Se não encontrou com busca exata, tentar busca case-insensitive
    const totalsKeys = Object.keys(totalsToUse)
    const matchingKey = totalsKeys.find(key => key.toLowerCase() === metricKey.toLowerCase())
    if (matchingKey) {
      const value = (totalsToUse as any)[matchingKey]
      if (value !== undefined && value !== null) {
        console.log('🔍 [DEBUG] Métrica encontrada com busca case-insensitive:', {
          metricKey,
          matchingKey,
          value
        })
        return typeof value === 'number' ? value : 0
      }
    }
    
    // Log de debug se não encontrou
    if (widgetData && widgetData.length > 0) {
      console.warn('⚠️ [DEBUG] Métrica não encontrada nos totais:', {
        metricKey,
        widgetDataLength: widgetData.length,
        totalsKeys: totalsKeys.slice(0, 10), // Primeiras 10 chaves para debug
        sampleDataKeys: widgetData[0] ? Object.keys(widgetData[0]).filter(k => {
          const val = (widgetData[0] as any)[k]
          return typeof val === 'number'
        }) : []
      })
    }
    
    // Se não encontrou, retornar 0
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

  // Rastrear quando os filtros foram aplicados via clique em uma tabela,
  // para exibir/remover o filtro no próprio widget (e não no topo do dashboard).
  const [filterAppliedByTableWidgetId, setFilterAppliedByTableWidgetId] = useState<string | null>(null)
  
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
    setFilterAppliedByTableWidgetId(null)
  }

  // Se não há mais filtros, limpar origem
  useEffect(() => {
    if (Object.keys(dimensionFilters).length === 0) {
      setFilterAppliedByTableWidgetId(null)
    }
  }, [dimensionFilters])
  
  // Dimensões e métricas disponíveis (padrão - usado quando não há widget específico)
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
  
  // Obter widget atual sendo editado e suas métricas/dimensões
  const currentWidget = editingWidget ? widgets.find(w => w.id === editingWidget.id) : null
  const widgetMetricsAndDimensions = useMemo(() => {
    if (currentWidget) {
      const result = getWidgetMetricsAndDimensions(currentWidget)
      console.log('📊 Métricas/dimensões do widget:', {
        widgetId: currentWidget.id,
        dataSource: currentWidget.dataSource,
        metricsCount: result.metrics.length,
        dimensionsCount: result.dimensions.length
      })
      return result
    }
    return { dimensions, metrics }
  }, [currentWidget, getWidgetMetricsAndDimensions, dimensions, metrics, configuredDataSources, dataBySource])
  
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
      const widgetMetrics = widgetMetricsAndDimensions.metrics
      const currentMetrics = currentWidget.cardMetrics || []
      if (currentMetrics.length === widgetMetrics.length) {
        updateWidget(editingWidget.id, { 
          cardMetrics: [],
          cardOrder: []
        })
      } else {
        const allMetrics = widgetMetrics.map(m => m.key)
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
      const widgetMetrics = widgetMetricsAndDimensions.metrics
      const currentMetrics = currentWidget.selectedMetrics || []
      if (currentMetrics.length === widgetMetrics.length) {
        updateWidget(editingWidget.id, { selectedMetrics: [] })
      } else {
        updateWidget(editingWidget.id, { selectedMetrics: widgetMetrics.map(m => m.key) })
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
  
  const toggleAllDimensions = () => {
    // Se estiver editando um widget de tabela, atualizar o widget específico
    if (editingWidget && editingWidget.type === 'table' && currentWidget) {
      const widgetDimensions = widgetMetricsAndDimensions.dimensions
      const currentDimensions = currentWidget.selectedDimensions || []
      if (currentDimensions.length === widgetDimensions.length) {
        updateWidget(editingWidget.id, { selectedDimensions: [] })
      } else {
        updateWidget(editingWidget.id, { selectedDimensions: widgetDimensions.map(d => d.key) })
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
          // Usar valores padrão sem depender de dimensions/metrics que mudam a cada render
          const defaultDimensions = ['event_date', 'platform', 'traffic_category', 'city', 'region', 'country']
          setSelectedDimensions(defaultDimensions)
          const calculatedMetrics = ['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'revenue_per_session', 'avg_order_value', 'roas', 'new_customer_rate']
          const allMetrics = ['sessions', 'clicks', 'add_to_carts', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'leads', 'new_customers', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
          const directMetrics = allMetrics.filter(m => !calculatedMetrics.includes(m))
          setSelectedMetrics(directMetrics)
        }
      } else {
        // Usar valores padrão sem depender de dimensions/metrics que mudam a cada render
        const defaultDimensions = ['event_date', 'platform', 'traffic_category', 'city', 'region', 'country']
        setSelectedDimensions(defaultDimensions)
        const calculatedMetrics = ['conversion_rate', 'add_to_cart_rate', 'leads_conversion_rate', 'paid_conversion_rate', 'revenue_per_session', 'avg_order_value', 'roas', 'new_customer_rate']
        const allMetrics = ['sessions', 'clicks', 'add_to_carts', 'orders', 'paid_orders', 'revenue', 'paid_revenue', 'cost', 'leads', 'new_customers', 'revenue_new_customers', 'paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
        const directMetrics = allMetrics.filter(m => !calculatedMetrics.includes(m))
        setSelectedMetrics(directMetrics)
      }
      prevSelectedTableRef.current = selectedTable
    }
  }, [selectedTable]) // Removido dimensions e metrics das dependências para evitar loop infinito
  
  // Carregar presets do cliente separadamente (só quando selectedTable mudar)
  useEffect(() => {
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
  }, [selectedTable])
  
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
        ? []
        : allWidgets.filter(w => w.customTabId === activeCustomTab)

      // Obter nome da aba para o nome do arquivo
      const tabName = customTabs.find(t => t.id === activeCustomTab)?.name || 'Aba'

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
          ? existingWidgets // Se não há aba ativa, manter todos
          : existingWidgets.filter(w => w.customTabId !== activeCustomTab) // Manter widgets de outras abas

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
        console.log('💾 Importando widgets, salvando...', { widgets: allWidgets.length })
        DashboardStorage.saveConfig(selectedTable, {
          widgets: allWidgets,
          legacy: parsed.legacy || undefined
        }).catch((error) => {
          console.error('❌ Erro ao salvar widgets importados:', error)
        })

        // Salvar presets no localStorage
        const presetStorageKey = `overview-presets-${selectedTable}`
        localStorage.setItem(presetStorageKey, JSON.stringify(importedPresets))

        // Atualizar estado
        setWidgets(allWidgets)
        setPresets(importedPresets)

        const tabName = customTabs.find(t => t.id === activeCustomTab)?.name || 'aba atual'
        
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

  // Função para buscar dados do período anterior para um dataSource específico
  const fetchPreviousPeriodDataForSource = async (dataSource: string) => {
    try {
      if (!selectedTable || !startDate || !endDate) return

      const previousPeriod = getPreviousPeriod()
      console.log('📊 [DEBUG] Fetching previous period for dataSource:', dataSource, previousPeriod)
      
      const token = getV2Token()
      if (!token) {
        console.error('❌ Token não encontrado para buscar dados do período anterior da fonte:', dataSource)
        return
      }

      // Usar a mesma lógica de fetchDataSourceData
      const customer = selectedTable
      const endpoint = dataSource
      
      console.log('📤 Criando job para período anterior:', { customer, endpoint, dataSource, period: previousPeriod })
      
      let jobResponse
      try {
        jobResponse = await api.createOverviewJob(token, customer, endpoint)
      } catch (error) {
        console.error('❌ [DEBUG] Erro ao criar job para período anterior:', {
          dataSource,
          customer,
          endpoint,
          error
        })
        return
      }
      
      const jobId = jobResponse.id || jobResponse.job_id || jobResponse.request_id
      
      if (!jobId) {
        console.error('❌ [DEBUG] Job ID não encontrado na resposta para período anterior:', {
          dataSource,
          jobResponse
        })
        return
      }

      console.log('✅ [DEBUG] Job criado para período anterior:', { dataSource, jobId })

      // Polling do status do job
      const pollStatus = async (): Promise<OverviewDataItem[]> => {
        try {
          const statusResponse = await api.getOverviewJobStatus(token, jobId)
          
          if (statusResponse.status === 'completed') {
            // Job concluído, buscar dados com retry
            const dataResponse = await getOverviewDataWithRetry(token, jobId, 5, 2000)
            
            if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
              const sourceData = dataResponse.data as OverviewDataItem[]
              
              // Aplicar filtro de data se necessário
              let filteredData = sourceData
              if (previousPeriod.start && previousPeriod.end) {
                const configuredSource = configuredDataSources.find(ds => ds.endpoint === dataSource)
                const dateField = configuredSource?.dateField || 'event_date'
                
                const startDateObj = new Date(previousPeriod.start)
                const endDateObj = new Date(previousPeriod.end)
                endDateObj.setHours(23, 59, 59, 999)
                
                filteredData = sourceData.filter((item: any) => {
                  const dateValue = item[dateField]
                  if (!dateValue) return false
                  const itemDate = new Date(dateValue)
                  if (isNaN(itemDate.getTime())) return false
                  return itemDate >= startDateObj && itemDate <= endDateObj
                })
              }
              
              // Armazenar dados do período anterior para este dataSource
              previousDataBySourceRef.current.set(dataSource, filteredData)
              console.log('✅ [DEBUG] Dados do período anterior carregados para:', dataSource, filteredData.length, 'registros')
              
              return filteredData
            }
            
            return []
          }
          
          if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
            console.error('❌ [DEBUG] Job falhou para período anterior:', { dataSource, jobId, status: statusResponse.status })
            return []
          }
          
          // Continuar polling
          await new Promise(resolve => setTimeout(resolve, 2000))
          return pollStatus()
        } catch (error) {
          console.error('❌ [DEBUG] Erro ao verificar status do job para período anterior:', { dataSource, jobId, error })
          return []
        }
      }
      
      return await pollStatus()
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao buscar dados do período anterior para dataSource:', dataSource, error)
      return []
    }
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
      
      // Buscar dados do período anterior para a tabela padrão
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
      
      // Buscar dados do período anterior para cada dataSource usado pelos widgets ativos
      const activeDataSources = new Set<string>()
      filteredWidgets.forEach(widget => {
        let widgetDataSource = widget.dataSource
        if (!widgetDataSource && widget.customTabId) {
          const tab = customTabs.find(t => t.id === widget.customTabId)
          widgetDataSource = tab?.dataSource
        }
        if (widgetDataSource) {
          activeDataSources.add(widgetDataSource)
        }
      })
      
      // Buscar dados do período anterior para cada dataSource em segundo tempo (sequencial + pequeno atraso)
      for (const dataSource of Array.from(activeDataSources)) {
        // Evitar brigar com carregamento/processamento do período atual
        const isProcessing = isProcessingBySourceRef.current.get(dataSource)
        const isLoading = isLoadingBySource.get(dataSource)
        if (isProcessing || isLoading) {
          console.log('⏳ [PREV] Aguardando dataSource estabilizar antes do comparativo:', { dataSource, isProcessing, isLoading })
          await new Promise(resolve => setTimeout(resolve, 1200))
        }

        await fetchPreviousPeriodDataForSource(dataSource)
        await new Promise(resolve => setTimeout(resolve, 400))
      }
      
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

  // Função helper para fazer retry do getOverviewData
  const getOverviewDataWithRetry = useCallback(async (
    token: string,
    jobId: string,
    maxRetries: number = 5,
    retryDelay: number = 2000
  ): Promise<any> => {
    let lastError: any = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dataResponse = await api.getOverviewData(token, jobId)
        
        if (dataResponse && dataResponse.data) {
          console.log(`✅ [RETRY] Dados recuperados com sucesso na tentativa ${attempt}/${maxRetries}`)
          return dataResponse
        }
        
        // Se não tem dados mas não deu erro, considerar como erro
        throw new Error('Resposta sem dados')
      } catch (error) {
        lastError = error
        console.warn(`⚠️ [RETRY] Tentativa ${attempt}/${maxRetries} falhou ao recuperar dados:`, error)
        
        // Se não é a última tentativa, aguardar antes de tentar novamente
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1) // Backoff exponencial
          console.log(`⏳ [RETRY] Aguardando ${delay}ms antes da próxima tentativa...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // Se todas as tentativas falharam, lançar o último erro
    console.error(`❌ [RETRY] Todas as ${maxRetries} tentativas falharam ao recuperar dados`)
    throw lastError || new Error('Falha ao recuperar dados após múltiplas tentativas')
  }, [api])

  // Função para buscar dados com retry
  const fetchDataWithRetry = useCallback(async (token: string, currentJobId: string, maxRetries = 10, retryDelay = 3000) => {
    console.log('📥 Iniciando busca de dados de overview para job:', currentJobId)
    
    try {
      // Usar a função helper de retry
      const dataResponse = await getOverviewDataWithRetry(token, currentJobId, maxRetries, retryDelay)
      console.log('✅ Data fetched successfully:', {
        jobId: currentJobId,
        count: dataResponse?.count,
        dataLength: dataResponse?.data?.length
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
          
          return
        }
      } catch (error: any) {
        console.error(`❌ Error fetching overview data após retry:`, error)
        setJobStatus('error')
        setError('Erro ao buscar dados. Tente novamente.')
        setIsLoading(false)
        setIsPolling(false)
        throw error
      }
  }, [startDate, endDate, getOverviewDataWithRetry, fetchPreviousPeriodData])

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
    }
    
    // Também filtrar dados por fonte quando datas mudarem
    if (startDate && endDate) {
      setDataBySource(prev => {
        const newMap = new Map()
        prev.forEach((sourceAllData, dataSource) => {
          // Obter o campo de data configurado para esta fonte
          const configuredSource = configuredDataSources.find(ds => ds.endpoint === dataSource)
          const dateField = configuredSource?.dateField || 'event_date'
          
          const startDateObj = new Date(startDate)
          const endDateObj = new Date(endDate)
          endDateObj.setHours(23, 59, 59, 999)
          
          console.log('🔵 [DEBUG] Reaplicando filtro de data (datas mudaram):', {
            dataSource,
            dateField,
            startDate,
            endDate,
            totalRecords: sourceAllData.length
          })
          
          const filtered = sourceAllData.filter((item: any) => {
            const dateValue = item[dateField]
            if (!dateValue) {
              if (sourceAllData.indexOf(item) < 3) {
                console.warn('⚠️ [DEBUG] Item sem campo de data ao reaplicar filtro:', {
                  dataSource,
                  dateField,
                  item,
                  availableFields: Object.keys(item)
                })
              }
              return false
            }
            
            const itemDate = new Date(dateValue)
            if (isNaN(itemDate.getTime())) {
              if (sourceAllData.indexOf(item) < 3) {
                console.warn('⚠️ [DEBUG] Data inválida ao reaplicar filtro:', {
                  dataSource,
                  dateField,
                  dateValue
                })
              }
              return false
            }
            
            return itemDate >= startDateObj && itemDate <= endDateObj
          })
          
          console.log('✅ [DEBUG] Filtro reaplicado:', {
            dataSource,
            dateField,
            totalBefore: sourceAllData.length,
            filteredAfter: filtered.length
          })
          
          newMap.set(dataSource, filtered)
        })
        return newMap
      })
    }
  }, [startDate, endDate, allData])

  // Disparar comparativo do período anterior em "segundo tempo":
  // aguarda a aba estabilizar (sem loading/processamento) e então busca o período anterior.
  const previousFetchKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedTable || !startDate || !endDate) return
    if (jobStatus !== 'completed') return
    if (isTabLoading) return
    if (isLoading || isPolling) return

    // Assinatura do estado "visível" da aba atual (mudanças em widgets devem refazer o comparativo)
    const activeTabWidgets = activeCustomTab
      ? widgets.filter(w => w.customTabId === activeCustomTab)
      : widgets.filter(w => !w.customTabId)

    const widgetSignature = activeTabWidgets
      .map(w => `${w.id}:${w.type}:${w.dataSource || ''}`)
      .sort()
      .join('|')

    const key = `${selectedTable}:${activeCustomTab || 'default'}:${startDate}:${endDate}:${widgetSignature}`
    if (previousFetchKeyRef.current === key) return
    previousFetchKeyRef.current = key

    const schedule = (cb: () => void) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(cb, { timeout: 1500 })
      } else {
        setTimeout(cb, 800)
      }
    }

    schedule(() => {
      // Se mudou algo desde o agendamento, não dispara
      if (previousFetchKeyRef.current !== key) return
      fetchPreviousPeriodData()
    })
  }, [
    selectedTable,
    startDate,
    endDate,
    jobStatus,
    isTabLoading,
    isLoading,
    isPolling,
    activeCustomTab,
    widgets,
    fetchPreviousPeriodData
  ])

  // Função para buscar dados de uma fonte específica
  const fetchDataSourceData = useCallback(async (dataSource: string, currentAllDataBySource?: Map<string, OverviewDataItem[]>) => {
    console.log('🔵 [DEBUG] fetchDataSourceData chamado:', {
      dataSource,
      selectedTable,
      currentAllDataBySourceKeys: currentAllDataBySource ? Array.from(currentAllDataBySource.keys()) : [],
      dataBySourceKeys: Array.from(dataBySource.keys()),
      configuredDataSources: configuredDataSources.map(ds => ds.endpoint),
      isConfigured: configuredDataSources.some(ds => ds.endpoint === dataSource)
    })
    
    if (!dataSource || !selectedTable) {
      console.log('⏸️ [DEBUG] Não buscando - dataSource ou selectedTable ausente:', { dataSource, selectedTable })
      return
    }

    // Verificar se o dataSource está configurado (opcional, mas recomendado)
    const isConfigured = configuredDataSources.some(ds => ds.endpoint === dataSource)
    if (!isConfigured) {
      console.warn('⚠️ [DEBUG] DataSource não está configurado, mas tentando carregar mesmo assim:', dataSource)
    }

    // Usar o Map passado ou o estado atual
    const dataMap = currentAllDataBySource || allDataBySource
    
    // Verificar se já está processando
    if (isProcessingBySourceRef.current.get(dataSource)) {
      console.log('⏸️ [DEBUG] Dados da fonte já estão sendo carregados:', dataSource)
      return
    }
    
    // Verificar se já tem dados
    if (dataMap && dataMap.has(dataSource)) {
      const existingData = dataMap.get(dataSource)
      console.log('⏸️ [DEBUG] Dados da fonte já carregados:', {
        dataSource,
        recordCount: existingData?.length || 0
      })
      return
    }
    
    console.log('🚀 [DEBUG] Iniciando busca de dados para dataSource:', {
      dataSource,
      selectedTable,
      isConfigured
    })

    const token = getV2Token()
    if (!token) {
      console.error('❌ Token não encontrado para buscar dados da fonte:', dataSource)
      return
    }

    // Marcar como processando
    isProcessingBySourceRef.current.set(dataSource, true)
    setIsLoadingBySource(prev => {
      const newMap = new Map(prev)
      newMap.set(dataSource, true)
      return newMap
    })

    try {
      console.log('🔄 Iniciando busca de dados para fonte:', dataSource)
      
      // O selectedTable é o cliente (ex: "coffeemais")
      // O dataSource é o endpoint (ex: "overview", "paid_media/campaigns_results", etc.)
      const customer = selectedTable
      const endpoint = dataSource
      
      console.log('📤 Criando job:', { customer, endpoint, dataSource })
      
      let jobResponse
      try {
        jobResponse = await api.createOverviewJob(token, customer, endpoint)
      } catch (error) {
        console.error('❌ [DEBUG] Erro ao criar job:', {
          dataSource,
          customer,
          endpoint,
          error
        })
        throw error
      }
      
      const jobId = jobResponse.id || jobResponse.job_id || jobResponse.request_id
      
      if (!jobId) {
        console.error('❌ [DEBUG] Job ID não encontrado na resposta:', {
          dataSource,
          jobResponse
        })
        throw new Error('Job ID não encontrado na resposta')
      }

      jobsBySourceRef.current.set(dataSource, jobId)
      console.log('✅ [DEBUG] Job criado com sucesso para fonte:', { dataSource, jobId })

      // Polling do status do job
      const pollStatus = async (): Promise<void> => {
        try {
          const statusResponse = await api.getOverviewJobStatus(token, jobId)
          
          // Atualizar elapsed_seconds se disponível
          if (statusResponse.elapsed_seconds !== undefined && statusResponse.elapsed_seconds !== null) {
            setElapsedSecondsBySource(prev => {
              const newMap = new Map(prev)
              newMap.set(dataSource, statusResponse.elapsed_seconds)
              return newMap
            })
          }
          
          if (statusResponse.status === 'completed') {
            // Job concluído, buscar dados com retry
            const dataResponse = await getOverviewDataWithRetry(token, jobId, 5, 2000)
            
            if (dataResponse && dataResponse.data && Array.isArray(dataResponse.data)) {
              // Aplicar métricas calculadas (se houver) ANTES de salvar/filtrar
              const configuredSource = configuredDataSources.find(ds => ds.endpoint === dataSource)
              const calculatedMetrics = (configuredSource?.metrics || [])
                .filter((m: any) => m?.isCalculated && typeof m?.formula === 'string')
                .map((m: any) => ({
                  key: m.key,
                  label: m.label,
                  type: m.type,
                  isCalculated: true,
                  formula: m.formula
                })) as CalculatedMetric[]

              const rawSourceData = dataResponse.data as OverviewDataItem[]
              const sourceData = calculatedMetrics.length > 0
                ? (applyCalculatedMetricsToRows(
                    rawSourceData as unknown as Record<string, unknown>[],
                    calculatedMetrics
                  ) as unknown as OverviewDataItem[])
                : rawSourceData
              
              // Filtrar por data se necessário
              let filteredSourceData = sourceData
              if (startDate && endDate) {
                // Obter o campo de data configurado para esta fonte
                const dateField = configuredSource?.dateField || 'event_date'
                
                const startDateObj = new Date(startDate)
                const endDateObj = new Date(endDate)
                // Ajustar endDate para incluir todo o dia (23:59:59)
                endDateObj.setHours(23, 59, 59, 999)
                
                console.log('🔵 [DEBUG] Aplicando filtro de data:', {
                  dataSource,
                  dateField,
                  startDate,
                  endDate,
                  startDateObj: startDateObj.toISOString(),
                  endDateObj: endDateObj.toISOString(),
                  totalRecords: sourceData.length,
                  sampleDates: sourceData.slice(0, 5).map(item => {
                    const dateValue = (item as any)[dateField]
                    return {
                      [dateField]: dateValue,
                      dateFieldType: typeof dateValue,
                      parsedDate: dateValue ? new Date(dateValue).toISOString() : null,
                      allFields: Object.keys(item)
                    }
                  })
                })
                
                filteredSourceData = sourceData.filter((item: any) => {
                  const dateValue = item[dateField]
                  
                  if (!dateValue) {
                    if (sourceData.indexOf(item) < 3) {
                      console.warn('⚠️ [DEBUG] Item sem campo de data:', {
                        dateField,
                        item,
                        availableFields: Object.keys(item)
                      })
                    }
                    return false
                  }
                  
                  const itemDate = new Date(dateValue)
                  
                  // Verificar se a data é válida
                  if (isNaN(itemDate.getTime())) {
                    if (sourceData.indexOf(item) < 3) {
                      console.warn('⚠️ [DEBUG] Data inválida:', {
                        dateField,
                        dateValue,
                        item
                      })
                    }
                    return false
                  }
                  
                  const isInRange = itemDate >= startDateObj && itemDate <= endDateObj
                  
                  if (!isInRange && sourceData.indexOf(item) < 3) {
                    console.log('🔍 [DEBUG] Item fora do range (primeiros 3):', {
                      dateField,
                      dateValue,
                      itemDate: itemDate.toISOString(),
                      startDateObj: startDateObj.toISOString(),
                      endDateObj: endDateObj.toISOString(),
                      beforeStart: itemDate < startDateObj,
                      afterEnd: itemDate > endDateObj
                    })
                  }
                  
                  return isInRange
                })
                
                console.log('✅ [DEBUG] Filtro de data aplicado:', {
                  dataSource,
                  dateField,
                  totalBefore: sourceData.length,
                  filteredAfter: filteredSourceData.length,
                  removed: sourceData.length - filteredSourceData.length
                })
              }

              // Armazenar dados por fonte
              console.log('🔵 [DEBUG] Armazenando dados no allDataBySource:', {
                dataSource,
                totalRecords: sourceData.length,
                sampleRecord: sourceData[0] || null
              })
              
              setAllDataBySource(prev => {
                const newMap = new Map(prev)
                newMap.set(dataSource, sourceData)
                console.log('✅ [DEBUG] allDataBySource atualizado:', {
                  dataSource,
                  records: sourceData.length,
                  allDataSources: Array.from(newMap.keys()),
                  allDataCounts: Array.from(newMap.entries()).map(([key, value]) => ({ key, count: value.length }))
                })
                return newMap
              })
              
              console.log('🔵 [DEBUG] Armazenando dados no dataBySource:', {
                dataSource,
                filteredRecords: filteredSourceData.length,
                sampleRecord: filteredSourceData[0] || null
              })
              
              setDataBySource(prev => {
                const newMap = new Map(prev)
                newMap.set(dataSource, filteredSourceData)
                console.log('✅ [DEBUG] dataBySource atualizado:', {
                  dataSource,
                  records: filteredSourceData.length,
                  allDataSources: Array.from(newMap.keys()),
                  allDataCounts: Array.from(newMap.entries()).map(([key, value]) => ({ key, count: value.length }))
                })
                return newMap
              })

              console.log('✅ [DEBUG] Dados carregados e armazenados para fonte:', { 
                dataSource, 
                total: sourceData.length, 
                filtered: filteredSourceData.length,
                hasData: filteredSourceData.length > 0
              })
            }
            
            isProcessingBySourceRef.current.set(dataSource, false)
            setIsLoadingBySource(prev => {
              const newMap = new Map(prev)
              newMap.set(dataSource, false)
              return newMap
            })
            // Limpar elapsed_seconds quando concluído
            setElapsedSecondsBySource(prev => {
              const newMap = new Map(prev)
              newMap.delete(dataSource)
              return newMap
            })
          } else if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
            console.error('❌ Job falhou para fonte:', dataSource)
            isProcessingBySourceRef.current.set(dataSource, false)
            setIsLoadingBySource(prev => {
              const newMap = new Map(prev)
              newMap.set(dataSource, false)
              return newMap
            })
            // Limpar elapsed_seconds em caso de erro
            setElapsedSecondsBySource(prev => {
              const newMap = new Map(prev)
              newMap.delete(dataSource)
              return newMap
            })
          } else {
            // Ainda processando, tentar novamente após 3 segundos
            setTimeout(() => pollStatus(), 3000)
          }
        } catch (error) {
          console.error('❌ Erro ao fazer polling para fonte:', dataSource, error)
          isProcessingBySourceRef.current.set(dataSource, false)
          setIsLoadingBySource(prev => {
            const newMap = new Map(prev)
            newMap.set(dataSource, false)
            return newMap
          })
        }
      }

      // Iniciar polling
      pollStatus()
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao buscar dados da fonte:', {
        dataSource,
        selectedTable,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      })
      isProcessingBySourceRef.current.set(dataSource, false)
      setIsLoadingBySource(prev => {
        const newMap = new Map(prev)
        newMap.set(dataSource, false)
        return newMap
      })
    }
  }, [startDate, endDate, allDataBySource, configuredDataSources, getV2Token, api, setIsLoadingBySource, selectedTable, getOverviewDataWithRetry])

  // ========== FUNÇÕES DE GERENCIAMENTO DE FONTES DE DADOS (DEPOIS DE fetchDataSourceData) ==========
  
  // Função para adicionar uma fonte de dados ao dashboard
  const addDataSource = useCallback(async (source: DataSource) => {
    if (!selectedTable) return
    
    // Verificar se já está configurada
    setConfiguredDataSources(prev => {
      if (prev.find(ds => ds.endpoint === source.endpoint)) {
        console.log('⚠️ Fonte já está configurada:', source.endpoint)
        return prev
      }
      
      // Marcar como carregando
      const newSource: DataSource = {
        ...source,
        isLoading: true,
        isLoaded: false
      }
      
      // Iniciar carregamento em background
      setTimeout(async () => {
        try {
          // Carregar dados da fonte
          await fetchDataSourceData(source.endpoint)
        } catch (error) {
          console.error('❌ Erro ao iniciar carregamento de fonte de dados:', error)
          setConfiguredDataSources(prevSources => prevSources.filter(ds => ds.endpoint !== source.endpoint))
        }
      }, 100)
      
      return [...prev, newSource]
    })
  }, [selectedTable, fetchDataSourceData])

  // useEffect para mapear métricas/dimensões quando dados são carregados
  useEffect(() => {
    configuredDataSources.forEach(source => {
      if (source.isLoading && !source.isLoaded) {
        const loadedData = allDataBySource.get(source.endpoint)
        const isStillLoading = isLoadingBySource.get(source.endpoint) || isProcessingBySourceRef.current.get(source.endpoint)
        
        if (loadedData && loadedData.length > 0 && !isStillLoading) {
          // Mapear métricas e dimensões
          const { dimensions: mappedDimensions, metrics: mappedMetrics } = extractMetricsAndDimensions(loadedData)
          
          // Atualizar fonte com métricas e dimensões mapeadas
          setConfiguredDataSources(prevSources => {
            const updatedSources = prevSources.map(ds => 
              ds.endpoint === source.endpoint 
                ? {
                    ...ds,
                    // Preservar métricas customizadas (ex: calculadas) e manter mapeadas atualizadas
                    metrics: (() => {
                      const existing = Array.isArray(ds.metrics) ? ds.metrics : []
                      const preserved = existing.filter((m: any) => m?.isCalculated || !mappedMetrics.find(mm => mm.key === m?.key))
                      const byKey = new Map<string, any>()
                      mappedMetrics.forEach(m => byKey.set(m.key, m))
                      preserved.forEach(m => {
                        if (m?.key) byKey.set(m.key, m)
                      })
                      return Array.from(byKey.values())
                    })(),
                    dimensions: mappedDimensions,
                    isLoaded: true,
                    isLoading: false
                  }
                : ds
            )
            
            // Salvar no Firestore
            DashboardStorage.saveConfig(selectedTable, { dataSources: updatedSources }).catch(error => {
              console.error('❌ Erro ao salvar fontes de dados:', error)
            })
            
            console.log('✅ Fonte de dados mapeada:', source.endpoint, {
              metrics: mappedMetrics.length,
              dimensions: mappedDimensions.length
            })
            
            return updatedSources
          })
        }
      }
    })
  }, [configuredDataSources, allDataBySource, isLoadingBySource, extractMetricsAndDimensions, selectedTable])

  // Função para remover uma fonte de dados
  const removeDataSource = useCallback(async (endpoint: string) => {
    if (!selectedTable) return
    
    // Verificar se há widgets usando esta fonte
    const widgetsUsingSource = widgets.filter(w => w.dataSource === endpoint)
    if (widgetsUsingSource.length > 0) {
      const confirmMessage = `Existem ${widgetsUsingSource.length} widget(s) usando esta fonte. Deseja remover mesmo assim? Os widgets serão atualizados para usar a fonte padrão.`
      if (!window.confirm(confirmMessage)) {
        return
      }
      
      // Atualizar widgets para remover dataSource
      setWidgets(prev => prev.map(w => 
        w.dataSource === endpoint ? { ...w, dataSource: undefined } : w
      ))
    }
    
    // Remover fonte
    const updatedSources = configuredDataSources.filter(ds => ds.endpoint !== endpoint)
    setConfiguredDataSources(updatedSources)
    
    // Salvar no Firestore
    await DashboardStorage.saveConfig(selectedTable, { 
      dataSources: updatedSources,
      widgets: widgets.map(w => w.dataSource === endpoint ? { ...w, dataSource: undefined } : w)
    })
    
    console.log('✅ Fonte de dados removida:', endpoint)
  }, [selectedTable, configuredDataSources, widgets])

  // Função helper para obter dados para um widget específico baseado no dataSource
  const getWidgetData = useCallback((widget: Widget): OverviewDataItem[] => {
    console.log('🔵 [DEBUG] getWidgetData chamado:', {
      widgetId: widget.id,
      widgetType: widget.type,
      widgetDataSource: widget.dataSource,
      widgetCustomTabId: widget.customTabId,
      activeCustomTab,
      dataBySourceKeys: Array.from(dataBySource.keys()),
      dataBySourceCounts: Array.from(dataBySource.entries()).map(([key, value]) => ({ key, count: value.length }))
    })
    
    // Determinar qual dataSource usar: widget > aba > padrão
    let widgetDataSource: string | undefined = widget.dataSource
    
    // Se o widget não tem dataSource, verificar se a aba tem
    if (!widgetDataSource && widget.customTabId) {
      const tab = customTabs.find(t => t.id === widget.customTabId)
      if (tab?.dataSource) {
        widgetDataSource = tab.dataSource
        console.log('📊 [DEBUG] Widget herdando dataSource da aba:', {
          widgetId: widget.id,
          customTabId: widget.customTabId,
          tabName: tab.name,
          inheritedDataSource: widgetDataSource
        })
      }
    }
    
    // Se há um dataSource (do widget ou da aba), usar dados específicos para essa fonte
    if (widgetDataSource) {
      // Tentar buscar com a chave exata primeiro
      let sourceData = dataBySource.get(widgetDataSource) || []
      let allSourceData = allDataBySource.get(widgetDataSource) || []
      
      // Se não encontrou, tentar encontrar a chave (pode haver diferença de formatação)
      if (sourceData.length === 0) {
        const allKeys = Array.from(dataBySource.keys())
        const matchingKey = allKeys.find(key => {
          // Comparação exata
          if (key === widgetDataSource) return true
          // Comparação ignorando espaços
          if (key.trim() === widgetDataSource.trim()) return true
          // Comparação case-insensitive
          if (key.toLowerCase() === widgetDataSource.toLowerCase()) return true
          return false
        })
        
        if (matchingKey) {
          console.log('🔍 [DEBUG] Chave encontrada com correspondência alternativa:', {
            widgetDataSource,
            matchingKey,
            exactMatch: matchingKey === widgetDataSource
          })
          sourceData = dataBySource.get(matchingKey) || []
          allSourceData = allDataBySource.get(matchingKey) || []
        }
      }
      
      // Verificar todas as chaves disponíveis para debug
      const allDataBySourceKeys = Array.from(allDataBySource.keys())
      const allDataBySourceEntries = Array.from(allDataBySource.entries()).map(([key, value]) => ({ 
        key, 
        keyType: typeof key,
        keyLength: key.length,
        count: value.length 
      }))
      const dataBySourceKeys = Array.from(dataBySource.keys())
      const dataBySourceEntries = Array.from(dataBySource.entries()).map(([key, value]) => ({ 
        key, 
        keyType: typeof key,
        keyLength: key.length,
        count: value.length 
      }))
      
      // Verificação detalhada de correspondência
      const exactMatchAll = allDataBySourceKeys.find(k => k === widgetDataSource)
      const exactMatchData = dataBySourceKeys.find(k => k === widgetDataSource)
      const strictEqualityCheck = allDataBySourceKeys.map(k => ({
        key: k,
        matches: k === widgetDataSource,
        widgetDataSource,
        comparison: {
          typeMatch: typeof k === typeof widgetDataSource,
          lengthMatch: k.length === widgetDataSource.length,
          charByChar: k.split('').map((c, i) => ({
            pos: i,
            keyChar: c,
            widgetChar: widgetDataSource[i],
            match: c === widgetDataSource[i]
          }))
        }
      }))
      
      console.log('📊 [DEBUG] getWidgetData - usando dataSource específico:', {
        widgetId: widget.id,
        widgetDataSource,
        widgetDataSourceType: typeof widgetDataSource,
        widgetDataSourceLength: widgetDataSource.length,
        sourceDataCount: sourceData.length,
        allSourceDataCount: allSourceData.length,
        hasData: sourceData.length > 0,
        dataBySourceHasKey: dataBySource.has(widgetDataSource),
        allDataBySourceHasKey: allDataBySource.has(widgetDataSource),
        exactMatchAll,
        exactMatchData,
        allDataBySourceKeys,
        allDataBySourceEntries,
        dataBySourceKeys,
        dataBySourceEntries,
        strictEqualityCheck,
        keyMatch: allDataBySourceKeys.includes(widgetDataSource) || dataBySourceKeys.includes(widgetDataSource)
      })
      
      // Se não encontrou dados, verificar se há alguma chave similar
      if (sourceData.length === 0 && allSourceData.length === 0) {
        const similarKeys = allDataBySourceKeys.filter(key => 
          key.includes(widgetDataSource) || widgetDataSource.includes(key) || 
          key.replace(/\//g, '_') === widgetDataSource.replace(/\//g, '_')
        )
        if (similarKeys.length > 0) {
          console.warn('⚠️ [DEBUG] DataSource não encontrado, mas há chaves similares:', {
            widgetDataSource,
            similarKeys,
            suggestion: 'Verifique se há diferença na formatação da chave (espaços, caracteres especiais, etc.)'
          })
        } else {
          console.error('❌ [DEBUG] DataSource não encontrado e nenhuma chave similar:', {
            widgetDataSource,
            availableKeys: allDataBySourceKeys,
            widgetDataSourceChars: widgetDataSource.split('').map((c, i) => ({ pos: i, char: c, code: c.charCodeAt(0) }))
          })
        }
      }
      
      // Removido: Não fazer side effects (fetchDataSourceData) durante renderização
      // O carregamento deve ser feito apenas pelo useEffect que monitora widgets/activeCustomTab
      // Isso evita múltiplas requisições para a mesma fonte quando vários widgets são renderizados
      
      if (sourceData.length > 0) {
        console.log('✅ [DEBUG] getWidgetData retornando dados do dataSource:', {
          widgetId: widget.id,
          widgetDataSource,
          recordCount: sourceData.length,
          firstRecord: sourceData[0] || null
        })
      } else {
        // Apenas logar - o useEffect já vai cuidar do carregamento
        const isProcessing = isProcessingBySourceRef.current.get(widgetDataSource)
        const isLoading = isLoadingBySource.get(widgetDataSource)
        console.log('⏳ [DEBUG] Widget sem dados ainda (será carregado pelo useEffect):', {
          widgetId: widget.id,
          widgetDataSource,
          isProcessing,
          isLoading
        })
      }
      
      return sourceData
    }
    
    // Se não tem dataSource, usar dados gerais (selectedTable)
    console.log('📊 [DEBUG] getWidgetData usando dados gerais:', {
      widgetId: widget.id,
      generalDataCount: data.length,
      hasGeneralData: data.length > 0
    })
      return data
  }, [data, dataBySource, customTabs, activeCustomTab, allDataBySource])

  // Função helper para verificar se um widget está carregando dados
  const isWidgetLoading = useCallback((widget: Widget): boolean => {
    // Se a aba está carregando, não mostrar indicador individual do widget (evita duplicação)
    // O indicador centralizado da aba já está sendo exibido
    if (isTabLoading) {
      return false
    }
    
    // Determinar qual dataSource usar: widget > aba > padrão
    let widgetDataSource: string | undefined = widget.dataSource
    
    // Se o widget não tem dataSource, verificar se a aba tem
    if (!widgetDataSource && widget.customTabId) {
      const tab = customTabs.find(t => t.id === widget.customTabId)
      if (tab?.dataSource) {
        widgetDataSource = tab.dataSource
      }
    }
    
    // Se há um dataSource, verificar se está carregando
    if (widgetDataSource) {
      const isLoading = isLoadingBySource.get(widgetDataSource) || false
      const isProcessing = isProcessingBySourceRef.current.get(widgetDataSource) || false
      const widgetData = getWidgetData(widget)
      const hasData = widgetData.length > 0
      
      // Está carregando se está processando/carregando E não tem dados ainda
      return (isLoading || isProcessing) && !hasData
    }
    
    // Se não tem dataSource, verificar loading geral
    const hasData = data.length > 0
    return isLoading && !hasData
  }, [data, dataBySource, allDataBySource, customTabs, isLoadingBySource, getWidgetData, isTabLoading])

  // Ref para rastrear última combinação processada e evitar requisições duplicadas
  const lastProcessedRef = useRef<{
    selectedTable: string | null
    activeCustomTab: string | null
    widgetIds: string
    tabDataSources: string
  } | null>(null)

  // Cache de abas carregadas: rastreia quais abas já carregaram seus dados
  // Chave: `${selectedTable}:${activeCustomTab}:${startDate}:${endDate}`
  // Valor: Set<string> com os dataSources que já foram carregados para essa aba
  const loadedTabsCacheRef = useRef<Map<string, Set<string>>>(new Map())

  // useEffect para carregar dados apenas da aba ativa (com cache por aba)
  useEffect(() => {
    if (!selectedTable) {
      console.log('⏸️ [DEBUG] selectedTable ausente, não carregando dataSources')
      return
    }
    
    // Criar chave única para o cache desta aba (inclui período de datas)
    const cacheKey = `${selectedTable}:${activeCustomTab || 'default'}:${startDate}:${endDate}`
    
    // Obter cache desta aba ou criar novo
    let tabCache = loadedTabsCacheRef.current.get(cacheKey)
    if (!tabCache) {
      tabCache = new Set<string>()
      loadedTabsCacheRef.current.set(cacheKey, tabCache)
      console.log('🆕 [CACHE] Criando novo cache para aba:', cacheKey)
    }
    
    // Criar chave única para a combinação atual
    const activeTabWidgets = activeCustomTab 
      ? widgets.filter(w => w.customTabId === activeCustomTab)
      : widgets.filter(w => !w.customTabId)
    
    const widgetIds = activeTabWidgets.map(w => w.id).sort().join(',')
    const widgetDataSources = activeTabWidgets
      .map(w => w.dataSource)
      .filter(Boolean)
      .sort()
      .join(',')
    const tabDataSource = activeCustomTab ? customTabs.find(t => t.id === activeCustomTab)?.dataSource || '' : ''
    const tabDataSources = [tabDataSource, widgetDataSources].filter(Boolean).join(',')
    
    const currentKey = {
      selectedTable,
      activeCustomTab: activeCustomTab || null,
      widgetIds,
      tabDataSources
    }
    
    // Verificar se já processamos essa combinação
    const lastProcessed = lastProcessedRef.current
    if (lastProcessed &&
        lastProcessed.selectedTable === currentKey.selectedTable &&
        lastProcessed.activeCustomTab === currentKey.activeCustomTab &&
        lastProcessed.widgetIds === currentKey.widgetIds &&
        lastProcessed.tabDataSources === currentKey.tabDataSources) {
      console.log('⏸️ [DEBUG] Mesma combinação já processada, pulando carregamento:', currentKey)
      return
    }
    
    console.log('🔄 [DEBUG] useEffect de carregamento de dataSources EXECUTADO:', {
      selectedTable,
      activeCustomTab,
      cacheKey,
      cachedDataSources: Array.from(tabCache),
      customTabsCount: customTabs.length,
      widgetsCount: widgets.length,
      activeTabWidgetsCount: activeTabWidgets.length
    })
    
    // Coletar apenas os dataSources necessários para a aba ativa
    const dataSourcesToLoad = new Set<string>()
    
    // Adicionar dataSource da aba ativa
    if (activeCustomTab) {
      const activeTab = customTabs.find(t => t.id === activeCustomTab)
      console.log('📊 [DEBUG] Aba ativa encontrada:', {
        activeCustomTab,
        activeTab: activeTab ? { id: activeTab.id, name: activeTab.name, dataSource: activeTab.dataSource } : null
      })
      
      if (activeTab?.dataSource) {
        dataSourcesToLoad.add(activeTab.dataSource)
        console.log('✅ [DEBUG] DataSource da aba ativa adicionado:', activeTab.dataSource)
      } else {
        console.log('⚠️ [DEBUG] Aba ativa não tem dataSource configurado:', activeTab?.name)
      }
    } else {
      console.log('📊 [DEBUG] Nenhuma aba customizada ativa (aba padrão)')
    }
    
    // Adicionar dataSources dos widgets da aba ativa (apenas se o widget tiver dataSource próprio)
    // activeTabWidgets já foi declarado acima
    console.log('📊 [DEBUG] Widgets da aba ativa:', {
      activeCustomTab,
      activeTabWidgetsCount: activeTabWidgets.length,
      widgetsDetails: activeTabWidgets.map(w => ({
        id: w.id,
        type: w.type,
        dataSource: w.dataSource,
        customTabId: w.customTabId
      }))
    })
    
    activeTabWidgets.forEach(widget => {
      // Apenas adicionar se o widget tiver dataSource próprio (não herdado da aba)
      if (widget.dataSource) {
        dataSourcesToLoad.add(widget.dataSource)
        console.log('✅ [DEBUG] Widget com dataSource próprio adicionado:', widget.id, widget.dataSource)
      } else {
        console.log('📊 [DEBUG] Widget sem dataSource próprio (herdará da aba):', widget.id)
      }
      // Se o widget não tem dataSource próprio, ele herdará da aba (já adicionada acima)
    })
    
    console.log('📊 [DEBUG] DataSources coletados para carregar:', {
      activeCustomTab,
      dataSourcesToLoad: Array.from(dataSourcesToLoad),
      cachedDataSources: Array.from(tabCache),
      currentAllDataBySource: Array.from(allDataBySource.keys()),
      currentDataBySource: Array.from(dataBySource.keys()),
      configuredDataSources: configuredDataSources.map(ds => ds.endpoint)
    })
    
    // Se não há dataSources para carregar, logar e retornar
    if (dataSourcesToLoad.size === 0) {
      console.log('⚠️ [DEBUG] Nenhum dataSource para carregar:', {
        activeCustomTab,
        hasActiveTab: !!activeCustomTab,
        activeTabHasDataSource: activeCustomTab ? customTabs.find(t => t.id === activeCustomTab)?.dataSource : null,
        widgetsCount: activeTabWidgets.length,
        widgetsWithDataSource: activeTabWidgets.filter(w => w.dataSource).length
      })
      // Resetar estado de carregamento se não há nada para carregar
      setIsTabLoading(false)
      setTabLoadingProgress({ total: 0, loading: 0, loaded: 0, dataSources: [] })
      setElapsedSecondsBySource(new Map())
      lastProcessedRef.current = currentKey
      return
    }
    
    // Filtrar dataSources que já estão no cache (já foram carregados para esta aba)
    const dataSourcesToFetch: string[] = []
    
    dataSourcesToLoad.forEach(dataSource => {
      // Verificar cache primeiro (dados já carregados para esta aba)
      if (tabCache.has(dataSource)) {
        console.log('✅ [CACHE] DataSource já carregado no cache desta aba:', {
          dataSource,
          cacheKey,
          recordCount: allDataBySource.get(dataSource)?.length || 0
        })
        return
      }
      
      // Verificar se já está carregado em memória (mesmo que não esteja no cache desta aba)
      const hasData = allDataBySource.has(dataSource)
      const isProcessing = isProcessingBySourceRef.current.get(dataSource)
      const isLoading = isLoadingBySource.get(dataSource)
      
      // Se já está carregado, adicionar ao cache e não recarregar
      if (hasData && !isProcessing && !isLoading) {
        tabCache.add(dataSource)
        console.log('✅ [CACHE] DataSource já está em memória, adicionando ao cache:', {
          dataSource,
          cacheKey,
          recordCount: allDataBySource.get(dataSource)?.length || 0
        })
        return
      }
      
      // Se está processando, não adicionar à lista (já está sendo carregado)
      if (isProcessing || isLoading) {
        console.log('⏳ [DEBUG] DataSource já está sendo carregado:', {
          dataSource,
          isProcessing,
          isLoading
        })
        return
      }
      
      // Precisa carregar
      dataSourcesToFetch.push(dataSource)
    })
    
    // Carregar todos os dataSources necessários
    if (dataSourcesToFetch.length > 0) {
      console.log('🚀 [CACHE] Iniciando carregamento de dataSources (não estão no cache):', {
        count: dataSourcesToFetch.length,
        dataSources: dataSourcesToFetch,
        cacheKey
      })
      
      // Marcar como processado ANTES de iniciar carregamento para evitar re-execuções durante o carregamento
      lastProcessedRef.current = currentKey
      
      // Atualizar estado de carregamento centralizado
      setIsTabLoading(true)
      setTabLoadingProgress({
        total: dataSourcesToLoad.size,
        loading: dataSourcesToFetch.length,
        loaded: dataSourcesToLoad.size - dataSourcesToFetch.length,
        dataSources: dataSourcesToFetch
      })
      
      // Iniciar carregamento - fetchDataSourceData gerencia o estado internamente
      dataSourcesToFetch.forEach(dataSource => {
        // Não usar await aqui para não bloquear - fetchDataSourceData é assíncrono e gerencia seu próprio estado
        fetchDataSourceData(dataSource, allDataBySource).catch(error => {
          console.error('❌ [DEBUG] Erro ao iniciar carregamento do dataSource:', dataSource, error)
          // Atualizar progresso em caso de erro
          setTabLoadingProgress(prev => ({
            ...prev,
            loading: Math.max(0, prev.loading - 1),
            loaded: prev.loaded + 1
          }))
        })
      })
    } else {
      // Se não há nada para carregar (tudo já está carregado ou no cache), marcar como processado
      lastProcessedRef.current = currentKey
      setIsTabLoading(false)
      setTabLoadingProgress({
        total: dataSourcesToLoad.size,
        loading: 0,
        loaded: dataSourcesToLoad.size,
        dataSources: []
      })
      console.log('✅ [CACHE] Todos os dataSources já estão carregados ou no cache:', {
        cacheKey,
        cachedDataSources: Array.from(tabCache)
      })
    }
  }, [widgets, customTabs, activeCustomTab, selectedTable, startDate, endDate, fetchDataSourceData, configuredDataSources, allDataBySource])

  // Resetar estado de carregamento quando a aba mudar
  useEffect(() => {
    // Resetar estado de carregamento quando mudar de aba
    setIsTabLoading(false)
    setTabLoadingProgress({ total: 0, loading: 0, loaded: 0, dataSources: [] })
    setElapsedSecondsBySource(new Map())
  }, [activeCustomTab])

  // Limpar cache quando selectedTable ou período de datas mudarem
  useEffect(() => {
    // Limpar todo o cache quando a tabela mudar (novo cliente)
    console.log('🧹 [CACHE] Limpando cache devido a mudança de selectedTable ou datas:', {
      selectedTable,
      startDate,
      endDate
    })
    // Resetar estado de carregamento quando mudar de tabela ou período
    setIsTabLoading(false)
    setTabLoadingProgress({ total: 0, loading: 0, loaded: 0, dataSources: [] })
    setElapsedSecondsBySource(new Map())
    // O cache será reconstruído automaticamente pelo useEffect acima quando necessário
    // Não precisamos limpar manualmente, pois a chave do cache inclui selectedTable e datas
    // Apenas limpar entradas antigas do cache se necessário para evitar vazamento de memória
    const maxCacheSize = 50 // Limitar cache a 50 entradas
    if (loadedTabsCacheRef.current.size > maxCacheSize) {
      const entries = Array.from(loadedTabsCacheRef.current.entries())
      // Remover as entradas mais antigas (mantém as mais recentes)
      entries.slice(0, entries.length - maxCacheSize).forEach(([key]) => {
        loadedTabsCacheRef.current.delete(key)
        console.log('🧹 [CACHE] Removendo entrada antiga do cache:', key)
      })
    }
  }, [selectedTable, startDate, endDate])

  // Monitorar allDataBySource e adicionar ao cache quando novos dados forem carregados
  useEffect(() => {
    if (!selectedTable) return

    // Criar chave única para o cache desta aba (inclui período de datas)
    const cacheKey = `${selectedTable}:${activeCustomTab || 'default'}:${startDate}:${endDate}`
    
    // Obter ou criar cache desta aba
    let tabCache = loadedTabsCacheRef.current.get(cacheKey)
    if (!tabCache) {
      tabCache = new Set<string>()
      loadedTabsCacheRef.current.set(cacheKey, tabCache)
    }

    // Verificar quais dataSources foram carregados e adicionar ao cache
    let hasNewData = false
    allDataBySource.forEach((data, dataSource) => {
      if (data && data.length > 0 && !tabCache.has(dataSource)) {
        tabCache.add(dataSource)
        hasNewData = true
        console.log('✅ [CACHE] DataSource detectado como carregado e adicionado ao cache:', {
          dataSource,
          cacheKey,
          recordCount: data.length
        })
      }
    })
    
    // Atualizar estado de carregamento quando novos dados forem carregados
    if (hasNewData && isTabLoading) {
      // Verificar se todos os dataSources necessários foram carregados
      const activeTabWidgets = activeCustomTab 
        ? widgets.filter(w => w.customTabId === activeCustomTab)
        : widgets.filter(w => !w.customTabId)
      
      const dataSourcesNeeded = new Set<string>()
      if (activeCustomTab) {
        const activeTab = customTabs.find(t => t.id === activeCustomTab)
        if (activeTab?.dataSource) {
          dataSourcesNeeded.add(activeTab.dataSource)
        }
      }
      activeTabWidgets.forEach(widget => {
        if (widget.dataSource) {
          dataSourcesNeeded.add(widget.dataSource)
        }
      })
      
      // Verificar quantos já foram carregados
      const loadedCount = Array.from(dataSourcesNeeded).filter(ds => {
        const hasData = allDataBySource.has(ds) && (allDataBySource.get(ds)?.length || 0) > 0
        const isStillLoading = isLoadingBySource.get(ds) || isProcessingBySourceRef.current.get(ds)
        return hasData && !isStillLoading
      }).length
      
      const loadingCount = Array.from(dataSourcesNeeded).filter(ds => {
        return isLoadingBySource.get(ds) || isProcessingBySourceRef.current.get(ds)
      }).length
      
      setTabLoadingProgress(prev => ({
        total: dataSourcesNeeded.size,
        loading: loadingCount,
        loaded: loadedCount,
        dataSources: Array.from(dataSourcesNeeded).filter(ds => 
          isLoadingBySource.get(ds) || isProcessingBySourceRef.current.get(ds)
        )
      }))
      
      // Se todos foram carregados, marcar como completo
      if (loadingCount === 0 && loadedCount === dataSourcesNeeded.size) {
        setIsTabLoading(false)
        console.log('✅ [TAB] Todos os dataSources da aba foram carregados')
      }
    }
  }, [allDataBySource, selectedTable, activeCustomTab, startDate, endDate, isTabLoading, widgets, customTabs, isLoadingBySource])

  // Aplicar filtros de dimensões aos dados
  const applyDimensionFiltersToRows = useCallback((rows: OverviewDataItem[]) => {
    if (Object.keys(dimensionFilters).length === 0) return rows
    return rows.filter((item: any) => {
      for (const [dimensionKey, filterValues] of Object.entries(dimensionFilters)) {
        // Se o campo não existe nesta fonte/linha, não bloquear o item (permite filtrar "a aba toda"
        // sem zerar widgets de dataSources que não têm essa dimensão).
        if (item?.[dimensionKey] === undefined || item?.[dimensionKey] === null) {
          continue
        }
        const itemValue = String(item[dimensionKey])
        if (!filterValues.has(itemValue)) {
          return false
        }
      }
      return true
    })
  }, [dimensionFilters])

  const filteredData = useMemo(() => {
    return applyDimensionFiltersToRows(data)
  }, [data, applyDimensionFiltersToRows])
  
  // Função helper para obter filteredData para um widget específico baseado no dataSource
  const getWidgetFilteredData = useCallback((widget: Widget): OverviewDataItem[] => {
    const widgetData = getWidgetData(widget)
    return applyDimensionFiltersToRows(widgetData)
  }, [getWidgetData, applyDimensionFiltersToRows])

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
  const getMetricGrowth = (metricKey: string, widgetData?: OverviewDataItem[], widgetPreviousData?: OverviewDataItem[]): number | undefined => {
    if (isLoadingPrevious) return undefined

    // Verificar se é uma métrica calculada (personalizada) para permitir crescimento também nesses casos
    const allCalculatedMetrics = getAllCalculatedMetrics()
    const calculatedMetric = allCalculatedMetrics.find(m => m.key === metricKey)
    
    // Se dados do widget foram fornecidos, calcular crescimento baseado nesses dados
    if (widgetData && widgetData.length > 0) {
      // Se há dados do período anterior específicos do widget, usar eles (inclui métricas calculadas)
      if (widgetPreviousData && widgetPreviousData.length > 0) {
        const currentValue = getMetricValue(metricKey, widgetData)
        const previousValue = getMetricValue(metricKey, widgetPreviousData)

        const growth = calculateGrowth(currentValue, previousValue)
        console.log('📊 [DEBUG] Crescimento calculado (widget específico):', {
          metricKey,
          currentValue,
          previousValue,
          growth
        })
        return growth
      }
      
      // Se não há dados do período anterior específicos, tentar usar dados globais como fallback
      // Calcular usando os totais do widget atual vs dados globais do período anterior
      const widgetTotals = calculateTotalsFromData(widgetData)
      const currentValue = widgetTotals[metricKey as keyof typeof widgetTotals]
      const previousValue = (previousTotals as any)[metricKey]
      
      if (currentValue !== undefined && previousValue !== undefined) {
        const growth = calculateGrowth(
          typeof currentValue === 'number' ? currentValue : 0,
          typeof previousValue === 'number' ? previousValue : 0
        )
        console.log('📊 [DEBUG] Crescimento calculado (widget atual vs global anterior):', {
          metricKey,
          currentValue,
          previousValue,
          growth
        })
        return growth
      }
      
      console.log('⚠️ [DEBUG] Widget sem dados do período anterior e métrica não encontrada:', {
        metricKey,
        widgetDataLength: widgetData.length,
        widgetPreviousDataLength: widgetPreviousData?.length || 0,
        widgetTotalsKeys: Object.keys(widgetTotals).slice(0, 10)
      })
    }
    
    // Se for uma métrica calculada (não-agregada), calcular o valor anterior a partir de previousTotals
    // (Para fórmulas agregadas, não temos um "dataset" global do período anterior aqui.)
    if (calculatedMetric && !hasAggregateFunctions(calculatedMetric.formula)) {
      try {
        const currentValue = getMetricValue(metricKey, widgetData)
        const rawPrevious = evaluateFormula(calculatedMetric.formula, previousTotals as any)
        const previousValue = calculatedMetric.type === 'percentage' ? rawPrevious * 100 : rawPrevious
        return calculateGrowth(currentValue, previousValue)
      } catch (e) {
        console.warn('⚠️ [DEBUG] Erro ao calcular crescimento de métrica calculada:', metricKey, e)
      }
    }

    // Fallback para dados globais - primeiro tentar busca dinâmica
    const currentValue = (totals as any)[metricKey]
    const previousValue = (previousTotals as any)[metricKey]
    
    if (currentValue !== undefined && previousValue !== undefined) {
      return calculateGrowth(
        typeof currentValue === 'number' ? currentValue : 0,
        typeof previousValue === 'number' ? previousValue : 0
      )
    }
    
    // Se não encontrou com busca direta, tentar busca case-insensitive
    const totalsKeys = Object.keys(totals)
    const previousTotalsKeys = Object.keys(previousTotals)
    const matchingCurrentKey = totalsKeys.find(key => key.toLowerCase() === metricKey.toLowerCase())
    const matchingPreviousKey = previousTotalsKeys.find(key => key.toLowerCase() === metricKey.toLowerCase())
    
    if (matchingCurrentKey && matchingPreviousKey) {
      const current = (totals as any)[matchingCurrentKey]
      const previous = (previousTotals as any)[matchingPreviousKey]
      if (current !== undefined && previous !== undefined) {
        return calculateGrowth(
          typeof current === 'number' ? current : 0,
          typeof previous === 'number' ? previous : 0
        )
      }
    }
    
    // Fallback para métricas hardcoded conhecidas (comportamento original)
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
    if (metricKey === 'paid_new_annual_orders') return calculateGrowth(totals.paid_new_annual_orders || 0, previousTotals.paid_new_annual_orders || 0)
    if (metricKey === 'paid_new_annual_revenue') return calculateGrowth(totals.paid_new_annual_revenue || 0, previousTotals.paid_new_annual_revenue || 0)
    if (metricKey === 'paid_new_montly_orders') return calculateGrowth(totals.paid_new_montly_orders || 0, previousTotals.paid_new_montly_orders || 0)
    if (metricKey === 'paid_new_montly_revenue') return calculateGrowth(totals.paid_new_montly_revenue || 0, previousTotals.paid_new_montly_revenue || 0)
    if (metricKey === 'paid_recurring_annual_orders') return calculateGrowth(totals.paid_recurring_annual_orders || 0, previousTotals.paid_recurring_annual_orders || 0)
    if (metricKey === 'paid_recurring_annual_revenue') return calculateGrowth(totals.paid_recurring_annual_revenue || 0, previousTotals.paid_recurring_annual_revenue || 0)
    if (metricKey === 'paid_recurring_montly_orders') return calculateGrowth(totals.paid_recurring_montly_orders || 0, previousTotals.paid_recurring_montly_orders || 0)
    if (metricKey === 'paid_recurring_montly_revenue') return calculateGrowth(totals.paid_recurring_montly_revenue || 0, previousTotals.paid_recurring_montly_revenue || 0)
    
    // Se não encontrou, retornar undefined (não mostrar comparativo)
    console.warn('⚠️ [DEBUG] Métrica não encontrada para crescimento:', metricKey, {
      totalsKeys: totalsKeys.slice(0, 10),
      previousTotalsKeys: previousTotalsKeys.slice(0, 10)
    })
    return undefined
  }

  const formatCurrency = (value: number) => {
    // Removido formatação de moeda - usar apenas número
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(value)
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
            <p className="text-xl font-bold text-blue-900">{new Intl.NumberFormat('pt-BR').format(runRate)}</p>
            <p className="text-xs text-blue-600 mt-1">Projeção mensal</p>
          </div>

          {/* Meta Mensal */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center border border-purple-100">
            <p className="text-sm font-medium text-purple-700 mb-2">Meta Mensal</p>
            <p className="text-xl font-bold text-purple-900">{new Intl.NumberFormat('pt-BR').format(monthlyGoal)}</p>
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
          // Removido formatação de moeda - tratar como número
          return formatNumber(value)
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
          ) : growth !== undefined && !Number.isNaN(growth) && (
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
      {Object.keys(dimensionFilters).length > 0 && !filterAppliedByTableWidgetId && (
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



      {/* Botão para adicionar widgets */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-normal rounded-lg transition-all duration-200 ${
              isEditMode
                ? 'text-blue-600 bg-blue-50/50 border border-blue-200/50 hover:bg-blue-50'
                : 'text-gray-500 bg-transparent border border-gray-200/50 hover:bg-gray-50/50'
            }`}
            title={isEditMode ? 'Clique para salvar as alterações' : 'Clique para editar'}
          >
            {isEditMode ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salvar</span>
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && customTabs.length === 0 && (
            <button
              onClick={() => {
                setEditingCustomTab(null)
                setCustomTabFormData({ name: '', icon: 'BarChart3', order: 0, isUniversal: false, dataSource: '' })
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
                title={`Exportar configurações da aba atual (${customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
              >
                <Download className="w-4 h-4" />
                Exportar Aba
              </button>
              <button
                onClick={handleImportDashboardConfigClick}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                title={`Importar configurações para a aba atual (${customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
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
                onClick={() => setShowDataSourcesModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
              >
                <Database className="w-4 h-4 text-gray-500" />
                Fontes de Dados
              </button>
              <button
                onClick={() => {
                  // Verificar se há uma aba ativa com dataSource
                  if (activeCustomTab) {
                    const activeTab = customTabs.find(t => t.id === activeCustomTab)
                    if (activeTab?.dataSource) {
                      // Se a aba tem dataSource, usar ele e ir direto para seleção de tipo
                      setSelectedDataSourceForNewWidget(activeTab.dataSource)
                      setAddWidgetStep('selectWidgetType')
                    } else {
                      // Se a aba não tem dataSource, mostrar aviso
                      alert('Esta aba não tem uma fonte de dados configurada. Configure a fonte de dados da aba antes de adicionar widgets.')
                      return
                    }
                  } else {
                    alert('Selecione uma aba antes de adicionar widgets.')
                    return
                  }
                  setShowAddWidgetModal(true)
                }}
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
            {/* Sub abas personalizadas */}
            {customTabs.map((tab) => {
              const IconComponent = iconMap[tab.icon] || BarChart3
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    console.log('🔄 Mudando de aba:', { 
                      de: activeCustomTab, 
                      para: tab.id,
                      selectedDataSourceForNewWidget 
                    })
                    setActiveCustomTab(tab.id)
                    // Não alterar selectedDataSourceForNewWidget ao mudar de aba
                    // A fonte de dados deve ser independente da aba
                  }}
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
                          // Bloquear edição de abas universais para usuários sem acesso "all"
                          if (tab.isUniversal && !hasAllAccess) {
                            alert('Apenas usuários com nível de acesso "all" podem editar abas universais.')
                            return
                          }
                          setEditingCustomTab(tab)
                          setCustomTabFormData({ 
                            name: tab.name, 
                            icon: tab.icon, 
                            order: tab.order,
                            isUniversal: tab.isUniversal || false,
                            dataSource: tab.dataSource || ''
                          })
                          setShowCustomTabModal(true)
                        }}
                        className={`p-1 rounded opacity-70 hover:opacity-100 ${
                          tab.isUniversal && !hasAllAccess 
                            ? 'hover:bg-gray-400 cursor-not-allowed' 
                            : 'hover:bg-blue-700'
                        }`}
                        title={
                          tab.isUniversal && !hasAllAccess 
                            ? 'Apenas usuários com acesso "all" podem editar abas universais'
                            : 'Editar aba'
                        }
                        disabled={tab.isUniversal && !hasAllAccess}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          // Bloquear deleção de abas universais para usuários sem acesso "all"
                          if (tab.isUniversal && !hasAllAccess) {
                            alert('Apenas usuários com nível de acesso "all" podem excluir abas universais.')
                            return
                          }
                          if (confirm(`Tem certeza que deseja excluir a aba "${tab.name}"? Os widgets desta aba também serão removidos.`)) {
                            try {
                              await DashboardStorage.deleteCustomTab(selectedTable, tab.id)
                              const updated = customTabs.filter(t => t.id !== tab.id)
                              setCustomTabs(updated)
                              if (activeCustomTab === tab.id) {
                                setActiveCustomTab(updated.length > 0 ? updated[0].id : null)
                              }
                              console.log('✅ Aba deletada com sucesso')
                            } catch (error) {
                              console.error('❌ Erro ao deletar aba:', error)
                              alert('Erro ao deletar aba. Tente novamente.')
                            }
                          }
                        }}
                        className={`p-1 rounded opacity-70 hover:opacity-100 ${
                          tab.isUniversal && !hasAllAccess 
                            ? 'hover:bg-gray-400 cursor-not-allowed' 
                            : 'hover:bg-red-600'
                        }`}
                        title={
                          tab.isUniversal && !hasAllAccess 
                            ? 'Apenas usuários com acesso "all" podem excluir abas universais'
                            : 'Excluir aba'
                        }
                        disabled={tab.isUniversal && !hasAllAccess}
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
                  setCustomTabFormData({ name: '', icon: 'BarChart3', order: customTabs.length, isUniversal: false, dataSource: '' })
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

      {/* Indicador de carregamento centralizado da aba */}
      {isTabLoading && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Carregando dados da aba...
                </p>
                {tabLoadingProgress.total > 0 && (
                  <p className="text-xs text-blue-700 mt-1">
                    {tabLoadingProgress.loaded} de {tabLoadingProgress.total} fonte{tabLoadingProgress.total !== 1 ? 's' : ''} carregada{tabLoadingProgress.total !== 1 ? 's' : ''}
                    {tabLoadingProgress.loading > 0 && (
                      <span className="ml-2">
                        ({tabLoadingProgress.loading} carregando...)
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            {tabLoadingProgress.dataSources.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                {tabLoadingProgress.dataSources.map((ds) => {
                  const elapsedSeconds = elapsedSecondsBySource.get(ds)
                  return (
                    <span
                      key={ds}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md font-medium flex items-center gap-1"
                    >
                      {configuredDataSources.find(s => s.endpoint === ds)?.label || ds}
                      {elapsedSeconds !== undefined && (
                        <span className="text-blue-600 font-semibold">
                          ({Math.round(elapsedSeconds)}s)
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
          {tabLoadingProgress.total > 0 && (
            <div className="mt-3 w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${(tabLoadingProgress.loaded / tabLoadingProgress.total) * 100}%`
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Renderizar múltiplos widgets */}
      {filteredWidgets.map((widget, widgetIndex) => {
        const isWidgetLocked = isUniversalTabId(widget.customTabId) && !hasAllAccess

        if (widget.type === 'cards') {
          return (
            <div
              key={widget.id}
              className="mb-6 relative group transition-all duration-200 border border-transparent rounded-xl"
            >
              {!isWidgetLocked && (
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
              )}
              {/* Título do widget */}
              {widget.title && (
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">{widget.title}</h3>
                </div>
              )}
              {isWidgetLoading(widget) ? (
                <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-sm text-gray-600">Carregando dados...</span>
                  </div>
                </div>
              ) : widget.cardMetrics && widget.cardMetrics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(() => {
                    // Obter dados específicos do widget se tiver dataSource
                    const widgetData = getWidgetFilteredData(widget)
                    const widgetMetrics = getWidgetMetricsAndDimensions(widget).metrics
                    
                    // Determinar dataSource do widget para buscar dados do período anterior
                    let widgetDataSource: string | undefined = widget.dataSource
                    if (!widgetDataSource && widget.customTabId) {
                      const tab = customTabs.find(t => t.id === widget.customTabId)
                      widgetDataSource = tab?.dataSource
                    }
                    
                    // Obter dados do período anterior para este widget
                    const widgetPreviousData = widgetDataSource 
                      ? applyDimensionFiltersToRows(previousDataBySourceRef.current.get(widgetDataSource) || [])
                      : []
                    
                    return (widget.cardOrder || widget.cardMetrics).filter(key => {
                      if (!widget.cardMetrics?.includes(key)) return false
                      const newMetrics = ['paid_new_annual_orders', 'paid_new_annual_revenue', 'paid_new_montly_orders', 'paid_new_montly_revenue', 'paid_recurring_annual_orders', 'paid_recurring_annual_revenue', 'paid_recurring_montly_orders', 'paid_recurring_montly_revenue']
                      if (newMetrics.includes(key)) {
                        const value = getMetricValue(key, widgetData)
                        return value > 0
                      }
                      return true
                    }).map((cardKey) => {
                      const metric = widgetMetrics.find(m => m.key === cardKey) || metrics.find(m => m.key === cardKey)
                      if (!metric) return null
                      const value = getMetricValue(cardKey, widgetData)
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
                              const growth = getMetricGrowth(cardKey, widgetData, widgetPreviousData)
                              return growth !== undefined && !Number.isNaN(growth) && (
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
                          <p className="text-2xl font-bold text-gray-900">{value.toFixed(2)}x</p>
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
                          growth={getMetricGrowth(cardKey, widgetData, widgetPreviousData)}
                        />
                      </div>
                    )
                  })
                  })()}
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
          // Obter dados específicos do widget se tiver dataSource
          const widgetData = getWidgetFilteredData(widget)
          const dataToUse = widgetData.length > 0 ? widgetData : filteredData
          
          // Preparar dados da timeline para este widget específico
          const getWidgetTimelineData = (widgetMetrics: string[] | undefined) => {
            if (!widgetMetrics || widgetMetrics.length === 0) return []
            
            const timelineDataMap = new Map<string, any>()
            
            dataToUse.forEach(item => {
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
              {!isWidgetLocked && (
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
              )}
              {isWidgetLoading(widget) ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-sm text-gray-600">Carregando dados...</span>
                  </div>
                </div>
              ) : widget.timelineMetrics && widget.timelineMetrics.length > 0 && widgetTimelineData.length > 0 ? (
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
                            // Removido formatação de moeda - tratar como número
                            return new Intl.NumberFormat('pt-BR', { 
                              maximumFractionDigits: 0,
                              minimumFractionDigits: 0 
                            }).format(Math.round(value || 0))
                          } else if (metric.type === 'percentage') {
                            return `${Math.round(value)}%`
                          } else if (name === 'roas') {
                            return value.toFixed(2) + 'x'
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
          // Obter métricas e dimensões específicas para este widget
          const widgetMetricsAndDims = getWidgetMetricsAndDimensions(widget)
          const widgetDimensions = widgetMetricsAndDims.dimensions
          const widgetMetrics = widgetMetricsAndDims.metrics
          
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
            rowLimit: number | null | undefined,
            searchTerm?: string
          ) => {
            if (!selectedDims || !selectedMets || 
                selectedDims.length === 0 || selectedMets.length === 0) {
              return []
            }
            
            // Usar dados filtrados específicos para este widget baseado no dataSource
            const widgetFilteredData = getWidgetFilteredData(widget)
            
            const grouped = new Map<string, any>()
            
            widgetFilteredData.forEach(item => {
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

            // Aplicar busca (filtro textual)
            const q = (searchTerm || '').toString().trim().toLowerCase()
            if (q) {
              result = result.filter((row: any) => {
                return selectedDims.some(dimKey => String(row?.[dimKey] ?? '').toLowerCase().includes(q))
              })
            }
            
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
            widget.rowLimit,
            tableWidgetSearchById[widget.id] || ''
          )

          const widgetTableFullData = getWidgetTableData(
            widget.selectedDimensions,
            widget.selectedMetrics,
            widget.sortField,
            widget.sortDirection,
            null,
            tableWidgetSearchById[widget.id] || ''
          )

          const canShowMoreRows =
            widget.rowLimit !== null &&
            typeof widget.rowLimit === 'number' &&
            widgetTableFullData.length > widgetTableData.length

          const canShowLessRows =
            widget.rowLimit === null ||
            (typeof widget.rowLimit === 'number' && widget.rowLimit > 10)

          const handleShowMoreRows = () => {
            const current = typeof widget.rowLimit === 'number' ? widget.rowLimit : 10
            updateWidget(widget.id, { rowLimit: current + 10 })
          }

          const handleShowLessRows = () => {
            // Se está mostrando "todas", voltar para o padrão (10)
            if (widget.rowLimit === null) {
              updateWidget(widget.id, { rowLimit: 10 })
              return
            }

            const current = typeof widget.rowLimit === 'number' ? widget.rowLimit : 10
            const next = Math.max(10, current - 10)
            updateWidget(widget.id, { rowLimit: next })
          }

          const handleDownloadWidgetTableXLSX = () => {
            if (
              !widget.selectedDimensions ||
              !widget.selectedMetrics ||
              widget.selectedDimensions.length === 0 ||
              widget.selectedMetrics.length === 0 ||
              widgetTableFullData.length === 0
            ) {
              alert('Não há dados para exportar neste widget.')
              return
            }

            try {
              const dataToExport = widgetTableFullData.map((row: any) => {
                const out: Record<string, any> = {}

                // Dimensões
                widget.selectedDimensions!.forEach(dimKey => {
                  const dim = widgetDimensions.find(d => d.key === dimKey)
                  out[dim?.label || dimKey] = row[dimKey] ?? '-'
                })

                // Métricas
                widget.selectedMetrics!.forEach(metKey => {
                  const met = widgetMetrics.find(m => m.key === metKey)
                  const value = typeof row[metKey] === 'number' ? row[metKey] : 0

                  if (!met) {
                    out[metKey] = value
                    return
                  }

                  if (met.type === 'percentage') {
                    // Excel: porcentagem como decimal
                    out[met.label] = value / 100
                  } else {
                    // currency/number: manter número
                    out[met.label] = value
                  }
                })

                return out
              })

              const wb = XLSX.utils.book_new()
              const ws = XLSX.utils.json_to_sheet(dataToExport)
              XLSX.utils.book_append_sheet(wb, ws, 'Dados')

              const safeTitle = String(widget.title || 'tabela')
                .toLowerCase()
                .replace(/[^\w-]+/g, '_')
                .slice(0, 40)

              const today = new Date()
              const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
              const safeTable = selectedTable.replace(/[^\w-]/g, '_')
              const filename = `overview-${safeTable}-${safeTitle}-${dateStr}.xlsx`

              XLSX.writeFile(wb, filename)
            } catch (error) {
              console.error('Erro ao gerar XLSX do widget:', error)
              alert('Erro ao gerar XLSX. Por favor, tente novamente.')
            }
          }

          const applyTabFilterFromRow = (row: any) => {
            if (!widget.selectedDimensions || widget.selectedDimensions.length === 0) return

            // Ao clicar, "fixar" a correspondência daquela linha para a aba inteira
            // (limpa filtros anteriores para evitar combinações inesperadas).
            setDimensionFilters(() => {
              const next: Record<string, Set<string>> = {}
              widget.selectedDimensions!.forEach(dimKey => {
                const value = row?.[dimKey]
                next[dimKey] = new Set([String(value ?? '')])
              })
              return next
            })
            setFilterAppliedByTableWidgetId(widget.id)
          }
          
          return (
            <div
              key={widget.id}
              className="mb-6 relative group transition-all duration-200 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
            >
              {isWidgetLoading(widget) ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-sm text-gray-600">Carregando dados...</span>
                  </div>
                </div>
              ) : widget.selectedDimensions && widget.selectedDimensions.length > 0 && 
               widget.selectedMetrics && widget.selectedMetrics.length > 0 ? (
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{widget.title || 'Dados Agrupados'}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Agrupados por {widget.selectedDimensions.map(d => widgetDimensions.find(dim => dim.key === d)?.label).filter(Boolean).join(', ')}
          </p>
        </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative hidden sm:block">
                          <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            value={tableWidgetSearchById[widget.id] || ''}
                            onChange={(e) =>
                              setTableWidgetSearchById(prev => ({ ...prev, [widget.id]: e.target.value }))
                            }
                            placeholder="Buscar..."
                            className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-44"
                          />
                        </div>
                        <button
                          onClick={handleDownloadWidgetTableXLSX}
                          className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
                          title="Baixar XLSX"
                        >
                          Baixar XLSX
                        </button>
                        <button
                          onClick={() => setFullscreenTableWidgetId(widget.id)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Tela cheia"
                          aria-label="Abrir tabela em tela cheia"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        {!isWidgetLocked && (
                          <>
                            <button
                              onClick={() => setEditingWidget({ id: widget.id, type: 'table' })}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Editar tabela"
                              aria-label="Editar tabela"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeWidget(widget.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remover widget"
                              aria-label="Remover widget"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {widget.selectedDimensions.map(dimKey => {
                            const dimension = widgetDimensions.find(d => d.key === dimKey)
                            if (!dimension) {
                              console.warn('⚠️ Dimensão não encontrada:', dimKey, 'Disponíveis:', widgetDimensions.map(d => d.key))
                              return null
                            }
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
                            const metric = widgetMetrics.find(m => m.key === metKey)
                            if (!metric) {
                              console.warn('⚠️ Métrica não encontrada:', metKey, 'Disponíveis:', widgetMetrics.map(m => m.key))
                              return null
                            }
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
                          <tr
                            key={idx}
                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                            onClick={() => applyTabFilterFromRow(row)}
                            title="Clique para filtrar a aba por esta linha"
                          >
                            {widget.selectedDimensions!.map(dimKey => (
                              <td key={dimKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {row[dimKey] || '-'}
                              </td>
                            ))}
                            {widget.selectedMetrics!.map(metKey => {
                              const metric = widgetMetrics.find(m => m.key === metKey)
                              const value = row[metKey] || 0
                              return (
                                <td key={metKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {metric?.type === 'currency' ? new Intl.NumberFormat('pt-BR').format(value) :
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
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                      <div className="flex-1">
                        {filterAppliedByTableWidgetId === widget.id && Object.keys(dimensionFilters).length > 0 && (
                          <div className="mb-2 flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-600">Filtro da tabela:</span>
                            {Object.entries(dimensionFilters).map(([dimKey, values]) => {
                              const dimLabel =
                                widgetDimensions.find(d => d.key === dimKey)?.label ||
                                dimensions.find(d => d.key === dimKey)?.label ||
                                dimKey
                              return (
                                <div key={dimKey} className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600">{dimLabel}:</span>
                                  {Array.from(values).map((value, idx) => (
                                    <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                      {value}
                                      <button
                                        onClick={() => toggleDimensionFilter(dimKey, value)}
                                        className="ml-1 text-gray-500 hover:text-gray-800"
                                        title="Remover"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )
                            })}
                            <button
                              onClick={clearAllFilters}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                              title="Remover filtro aplicado pela tabela"
                            >
                              Limpar filtro
                            </button>
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          {widget.rowLimit !== null && typeof widget.rowLimit === 'number' ? (
                            <>Mostrando {Math.min(widgetTableData.length, widget.rowLimit)} de {formatNumber(widgetTableFullData.length)} linhas</>
                          ) : (
                            <>Mostrando {formatNumber(widgetTableFullData.length)} linhas</>
                          )}
                        </div>
                      </div>

                      {(canShowLessRows || canShowMoreRows) && (
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {canShowLessRows && (
                            <button
                              onClick={handleShowLessRows}
                              className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
                              title="Exibir menos linhas"
                            >
                              Ver menos
                            </button>
                          )}
                          {canShowMoreRows && (
                            <button
                              onClick={handleShowMoreRows}
                              className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                              title="Exibir mais linhas"
                            >
                              Ver mais
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Selecione dimensões e métricas no painel de edição para visualizar os dados na tabela.
        </div>
      )}

              {fullscreenTableWidgetId === widget.id && (
                <div className="fixed inset-0 z-[90] bg-white">
                  <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-gray-900 truncate">
                          {widget.title || 'Dados Agrupados'}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">• Tela cheia</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {widget.selectedDimensions?.length
                          ? `Agrupados por ${widget.selectedDimensions
                              .map(d => widgetDimensions.find(dim => dim.key === d)?.label)
                              .filter(Boolean)
                              .join(', ')}`
                          : 'Tabela'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative hidden sm:block">
                        <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          value={tableWidgetSearchById[widget.id] || ''}
                          onChange={(e) =>
                            setTableWidgetSearchById(prev => ({ ...prev, [widget.id]: e.target.value }))
                          }
                          placeholder="Buscar..."
                          className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56"
                        />
                      </div>
                      <button
                        onClick={handleDownloadWidgetTableXLSX}
                        className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
                        title="Baixar XLSX"
                      >
                        Baixar XLSX
                      </button>
                      <button
                        onClick={() => setFullscreenTableWidgetId(null)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Sair da tela cheia (ESC)"
                        aria-label="Sair da tela cheia"
                      >
                        <Minimize2 className="w-4 h-4" />
                        Fechar
                      </button>
                    </div>
                  </div>

                  <div className="h-[calc(100vh-3.5rem)] overflow-auto p-4 sm:p-6">
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              {widget.selectedDimensions?.map(dimKey => {
                                const dimension = widgetDimensions.find(d => d.key === dimKey)
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
                              {widget.selectedMetrics?.map(metKey => {
                                const metric = widgetMetrics.find(m => m.key === metKey)
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
                            {widgetTableFullData.map((row, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-blue-50 cursor-pointer transition-colors"
                                onClick={() => {
                                  applyTabFilterFromRow(row)
                                  setFullscreenTableWidgetId(null)
                                }}
                                title="Clique para filtrar a aba por esta linha"
                              >
                                {widget.selectedDimensions?.map(dimKey => (
                                  <td key={dimKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {row[dimKey] || '-'}
                                  </td>
                                ))}
                                {widget.selectedMetrics?.map(metKey => {
                                  const metric = widgetMetrics.find(m => m.key === metKey)
                                  const value = row[metKey] || 0
                                  return (
                                    <td key={metKey} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                      {metric?.type === 'currency'
                                        ? new Intl.NumberFormat('pt-BR').format(value)
                                        : metric?.type === 'percentage'
                                          ? `${value.toFixed(1)}%`
                                          : new Intl.NumberFormat('pt-BR').format(value)}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-6 py-4 border-t border-gray-200 text-xs text-gray-500">
                        Mostrando {formatNumber(widgetTableFullData.length)} linhas
                      </div>
                    </div>
                  </div>
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
              {!isWidgetLocked && (
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
              )}
              {/* Título do widget */}
              {widget.title && (
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">{widget.title}</h3>
                </div>
              )}
              {isWidgetLoading(widget) ? (
                <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-sm text-gray-600">Carregando dados...</span>
                  </div>
                </div>
              ) : (
                <RunRateHighlight 
                  runRateData={runRateData} 
                  isLoadingGoals={isLoadingGoals}
                  isLoadingCurrentMonth={isLoadingCurrentMonth}
                />
              )}
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
          {isLoading && data.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">Carregando dados...</span>
              </div>
            </div>
          ) : (
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
                  <p className="text-2xl font-bold text-gray-900">{value.toFixed(2)}x</p>
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
          )}
        </div>
      )}

      {/* Timeline (legado - só mostrar se não houver widgets do novo sistema) */}
      {widgets.length === 0 && timelineMetrics.length > 0 && (
        <>
          {isLoading && timelineData.length === 0 ? (
            <div className="mb-6 bg-white rounded-xl shadow-lg p-8 border border-gray-200 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">Carregando dados...</span>
              </div>
            </div>
          ) : timelineData.length > 0 && (
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
                      // Removido formatação de moeda - tratar como número
                      return new Intl.NumberFormat('pt-BR', { 
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0 
                      }).format(Math.round(value || 0))
                    } else if (metric.type === 'percentage') {
                      // Arredondar porcentagem sem decimais
                      return `${Math.round(value)}%`
                    } else if (name === 'roas') {
                      return value.toFixed(2) + 'x'
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
        </>
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
                        title={`Exportar configurações da aba atual (${customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Exportar Aba
                      </button>
                      <button
                        onClick={handleImportDashboardConfigClick}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-1"
                        title={`Importar configurações para a aba atual (${customTabs.find(t => t.id === activeCustomTab)?.name || 'atual'})`}
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
          
          {/* Modal para gerenciar fontes de dados */}
          {showDataSourcesModal && (
            <>
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={() => setShowDataSourcesModal(false)}
              />
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-50 max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Gerenciar Fontes de Dados
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        console.log('🔄 [DEBUG] Botão de recarregar fontes clicado')
                        // Forçar recarregamento de todas as fontes configuradas
                        configuredDataSources.forEach(source => {
                          if (source.isLoaded && allDataBySource.has(source.endpoint)) {
                            // Limpar dados existentes para forçar recarregamento
                            setAllDataBySource(prev => {
                              const newMap = new Map(prev)
                              newMap.delete(source.endpoint)
                              return newMap
                            })
                            setDataBySource(prev => {
                              const newMap = new Map(prev)
                              newMap.delete(source.endpoint)
                              return newMap
                            })
                            isProcessingBySourceRef.current.set(source.endpoint, false)
                            setIsLoadingBySource(prev => {
                              const newMap = new Map(prev)
                              newMap.set(source.endpoint, false)
                              return newMap
                            })
                            console.log('🔄 [DEBUG] Dados limpos para recarregar:', source.endpoint)
                          }
                          // Forçar carregamento
                          if (source.endpoint) {
                            console.log('🚀 [DEBUG] Forçando carregamento de:', source.endpoint)
                            fetchDataSourceData(source.endpoint, allDataBySource)
                          }
                        })
                      }}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all"
                      title="Recarregar todas as fontes de dados"
                    >
                      🔄 Recarregar
                    </button>
                    <button
                      onClick={() => setShowDataSourcesModal(false)}
                      className="p-2 hover:bg-gray-200/60 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-sm text-gray-600 mb-4">
                    Configure quais fontes de dados estarão disponíveis para os widgets deste dashboard. 
                    Ao adicionar uma fonte, os dados serão carregados e as métricas/dimensões serão mapeadas automaticamente.
                  </p>
                  
                  {/* Lista de fontes configuradas */}
                  <div className="mb-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Fontes Configuradas</h3>
                    {configuredDataSources.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                        Nenhuma fonte de dados configurada. Adicione uma fonte abaixo.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {configuredDataSources.map((source) => (
                          <React.Fragment key={source.endpoint}>
                            <div
                              className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900">{source.label}</span>
                                  {source.restricted && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                      Restrito
                                    </span>
                                  )}
                                  {source.isLoading && (
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                  )}
                                  {source.isLoaded && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                      Carregado
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mb-2 break-all">{source.endpoint}</p>
                                {source.isLoaded && (
                                  <div className="text-xs text-gray-600">
                                    {source.metrics?.length || 0} métricas • {source.dimensions?.length || 0} dimensões
                                  </div>
                                )}
                                <div className="text-xs text-gray-600 mt-1">
                                  Campo de data: <strong>{source.dateField || 'event_date'}</strong>
                                </div>
                                {source.isLoaded && allDataBySource.get(source.endpoint) && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    Dados: {allDataBySource.get(source.endpoint)?.length || 0} registros totais
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {source.isLoaded && allDataBySource.get(source.endpoint) && (
                                  <button
                                    onClick={() => setShowingDataSample(showingDataSample === source.endpoint ? null : source.endpoint)}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                    title="Ver amostra dos dados"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setCalculatedMetricsDataSource(source.endpoint)
                                    setEditingCalculatedMetricKey(null)
                                    setCalculatedMetricForm({ key: '', label: '', type: 'number', formula: '' })
                                  }}
                                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                  title="Métricas calculadas"
                                >
                                  <Calculator className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    const currentDateField = source.dateField || 'event_date'
                                    const newDateField = prompt(
                                      `Configurar campo de data para "${source.label}":\n\nDigite o nome do campo que contém a data nos dados.\n\nCampo atual: ${currentDateField}`,
                                      currentDateField
                                    )
                                    if (newDateField !== null && newDateField.trim()) {
                                      const updatedSources = configuredDataSources.map(ds =>
                                        ds.endpoint === source.endpoint
                                          ? { ...ds, dateField: newDateField.trim() }
                                          : ds
                                      )
                                      setConfiguredDataSources(updatedSources)
                                      DashboardStorage.saveConfig(selectedTable, { dataSources: updatedSources }).catch(error => {
                                        console.error('❌ Erro ao salvar configuração de campo de data:', error)
                                      })
                                      console.log('✅ Campo de data atualizado:', source.endpoint, newDateField.trim())
                                    }
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Configurar campo de data"
                                >
                                  <Calendar className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeDataSource(source.endpoint)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Remover fonte"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {/* Totais das métricas e dimensões */}
                            {showingDataSample === source.endpoint && allDataBySource.get(source.endpoint) && (() => {
                              const sourceData = allDataBySource.get(source.endpoint) || []
                              const sourceMetrics = source.metrics || []
                              const sourceDimensions = source.dimensions || []
                              
                              // Calcular totais das métricas configuradas
                              const metricTotals = sourceMetrics.reduce((acc, metric) => {
                                const total = sourceData.reduce((sum, item: any) => {
                                  const value = item[metric.key]
                                  if (typeof value === 'number') {
                                    return sum + value
                                  }
                                  return sum
                                }, 0)
                                
                                acc[metric.key] = {
                                  label: metric.label,
                                  total,
                                  type: metric.type
                                }
                                return acc
                              }, {} as Record<string, { label: string; total: number; type: string }>)
                              
                              // Calcular valores únicos por dimensão
                              const dimensionUniqueCounts = sourceDimensions.reduce((acc, dimension) => {
                                const uniqueValues = new Set<string>()
                                sourceData.forEach((item: any) => {
                                  const value = item[dimension.key]
                                  if (value !== null && value !== undefined && value !== '') {
                                    uniqueValues.add(String(value))
                                  }
                                })
                                acc[dimension.key] = {
                                  label: dimension.label,
                                  uniqueCount: uniqueValues.size
                                }
                                return acc
                              }, {} as Record<string, { label: string; uniqueCount: number }>)
                              
                              return (
                                <div className="mt-3 space-y-3">
                                  {/* Totais das Métricas */}
                                  <div className="p-4 bg-white rounded-lg border-2 border-green-300">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-sm font-semibold text-gray-900">Totais das Métricas</h4>
                                      <button
                                        onClick={() => setShowingDataSample(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <div className="text-xs space-y-2">
                                      <div className="text-gray-500 mb-2">
                                        {sourceData.length} registros processados
                                      </div>
                                      {Object.keys(metricTotals).length > 0 ? (
                                        <div className="space-y-2">
                                          {Object.entries(metricTotals).map(([key, metric]) => (
                                            <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                              <span className="font-medium text-gray-700">{metric.label}:</span>
                                              <span className="font-semibold text-gray-900">
                                                {metric.type === 'currency' 
                                                  ? new Intl.NumberFormat('pt-BR').format(metric.total)
                                                  : metric.type === 'percentage'
                                                  ? `${metric.total.toFixed(2)}%`
                                                  : new Intl.NumberFormat('pt-BR').format(metric.total)
                                                }
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-gray-500 text-center py-4">
                                          Nenhuma métrica configurada para esta fonte
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Dimensões e Valores Únicos */}
                                  <div className="p-4 bg-white rounded-lg border-2 border-blue-300">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-sm font-semibold text-gray-900">Dimensões Reconhecidas</h4>
                                    </div>
                                    <div className="text-xs space-y-2">
                                      {Object.keys(dimensionUniqueCounts).length > 0 ? (
                                        <div className="space-y-2">
                                          {Object.entries(dimensionUniqueCounts).map(([key, dimension]) => (
                                            <div key={key} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
                                              <span className="font-medium text-gray-700">{dimension.label}:</span>
                                              <span className="font-semibold text-blue-900">
                                                {new Intl.NumberFormat('pt-BR').format(dimension.uniqueCount)} valores únicos
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-gray-500 text-center py-4">
                                          Nenhuma dimensão reconhecida para esta fonte
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Lista de fontes disponíveis para adicionar */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Adicionar Fonte de Dados</h3>
                    {allAvailableDataSources.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                        Carregando fontes disponíveis...
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {allAvailableDataSources
                          .filter(source => !configuredDataSources.find(ds => ds.endpoint === source.endpoint))
                          .map((source) => (
                            <button
                              key={source.endpoint}
                              onClick={() => addDataSource(source)}
                              className="w-full p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-900">{source.label}</span>
                                    {source.restricted && (
                                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                        Restrito
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">{source.endpoint}</p>
                                </div>
                                <Plus className="w-5 h-5 text-blue-600" />
                              </div>
                            </button>
                          ))}
                        {allAvailableDataSources.filter(source => !configuredDataSources.find(ds => ds.endpoint === source.endpoint)).length === 0 && (
                          <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                            Todas as fontes disponíveis já estão configuradas.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Modal para métricas calculadas */}
          {calculatedMetricsDataSource && (
            <>
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300"
                onClick={closeCalculatedMetricsModal}
              />
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-[60] max-h-[90vh] overflow-hidden flex flex-col">
                {(() => {
                  const source = configuredDataSources.find(s => s.endpoint === calculatedMetricsDataSource)
                  const sourceLabel = source?.label || calculatedMetricsDataSource
                  const existingMetrics = source?.metrics || []
                  const calculatedOnly = existingMetrics.filter((m: any) => m?.isCalculated)
                  const availableKeys = new Set<string>([
                    ...existingMetrics.map(m => m.key),
                    ...Object.keys((allDataBySource.get(calculatedMetricsDataSource)?.[0] as any) || {})
                  ])

                  const validate = (): string | null => {
                    const key = calculatedMetricForm.key.trim()
                    const label = calculatedMetricForm.label.trim()
                    const formula = calculatedMetricForm.formula.trim()
                    if (!key) return 'Key é obrigatório'
                    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return 'Key inválido (use letras, números e _; não comece com número)'
                    if (!label) return 'Label é obrigatório'
                    if (!formula) return 'Fórmula é obrigatória'

                    const isEditing = !!editingCalculatedMetricKey
                    if (!isEditing) {
                      if (existingMetrics.find(m => m.key === key)) return `Já existe uma métrica com key "${key}"`
                    } else if (editingCalculatedMetricKey !== key) {
                      if (existingMetrics.find(m => m.key === key)) return `Já existe uma métrica com key "${key}"`
                    }

                    // Validar identificadores usados - sem preview (somente chaves conhecidas da fonte)
                    const processedKeys = new Set(availableKeys)
                    const ids = extractFormulaIdentifiers(formula)
                    const unknown = ids.filter(id => !processedKeys.has(id) && id !== key)
                    if (unknown.length > 0) return `Campos não encontrados na fonte: ${unknown.join(', ')}`

                    // Validar sintaxe do parser (sem executar preview em amostra de dados)
                    try {
                      if (hasAggregateFunctions(formula)) {
                        // Sem dados: identificadores já foram validados acima
                        evaluateAggregateFormula(formula, [])
                      } else {
                        evaluateFormula(formula, {}) // valida parser apenas
                      }
                    } catch (e: any) {
                      return e?.message || 'Fórmula inválida'
                    }

                    return null
                  }

                  const error = validate()

                  const save = async () => {
                    if (!selectedTable || !source) return
                    const err = validate()
                    if (err) {
                      alert(err)
                      return
                    }

                    const nextMetric = {
                      key: calculatedMetricForm.key.trim(),
                      label: calculatedMetricForm.label.trim(),
                      type: calculatedMetricForm.type,
                      isCalculated: true,
                      formula: calculatedMetricForm.formula.trim()
                    }

                    const updatedSources = configuredDataSources.map(ds => {
                      if (ds.endpoint !== calculatedMetricsDataSource) return ds
                      const prev = ds.metrics || []
                      // Se editando, substituir; senão, adicionar
                      const without = editingCalculatedMetricKey
                        ? prev.filter((m: any) => m.key !== editingCalculatedMetricKey)
                        : prev
                      return {
                        ...ds,
                        metrics: [...without, nextMetric]
                      }
                    })

                    setConfiguredDataSources(updatedSources)
                    await DashboardStorage.saveConfig(selectedTable, { dataSources: updatedSources })
                    try {
                      recomputeCalculatedMetricsForSource(calculatedMetricsDataSource, updatedSources)
                    } catch (e: any) {
                      console.error('❌ Erro ao recalcular métricas:', e)
                      alert(e?.message || 'Erro ao recalcular métricas')
                    }

                    setEditingCalculatedMetricKey(null)
                    setCalculatedMetricForm({ key: '', label: '', type: 'number', formula: '' })
                  }

                  const remove = async (key: string) => {
                    if (!selectedTable) return
                    if (!window.confirm(`Remover a métrica calculada "${key}"?`)) return
                    const updatedSources = configuredDataSources.map(ds => {
                      if (ds.endpoint !== calculatedMetricsDataSource) return ds
                      const prev = ds.metrics || []
                      return { ...ds, metrics: prev.filter((m: any) => m.key !== key) }
                    })
                    setConfiguredDataSources(updatedSources)
                    await DashboardStorage.saveConfig(selectedTable, { dataSources: updatedSources })
                    try {
                      recomputeCalculatedMetricsForSource(calculatedMetricsDataSource, updatedSources)
                    } catch (e: any) {
                      console.error('❌ Erro ao recalcular métricas:', e)
                      alert(e?.message || 'Erro ao recalcular métricas')
                    }
                    if (editingCalculatedMetricKey === key) {
                      setEditingCalculatedMetricKey(null)
                      setCalculatedMetricForm({ key: '', label: '', type: 'number', formula: '' })
                    }
                  }

                  const startEdit = (m: any) => {
                    setEditingCalculatedMetricKey(m.key)
                    setCalculatedMetricForm({
                      key: m.key || '',
                      label: m.label || '',
                      type: m.type || 'number',
                      formula: m.formula || ''
                    })
                  }

                  return (
                    <>
                      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-purple-600" />
                            Métricas calculadas
                          </h2>
                          <p className="text-xs text-gray-500 mt-1">
                            Fonte: <span className="font-medium text-gray-700">{sourceLabel}</span>
                          </p>
                        </div>
                        <button
                          onClick={closeCalculatedMetricsModal}
                          className="p-2 hover:bg-gray-200/60 rounded-lg transition-all"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Existentes</h3>
                            <span className="text-xs text-gray-600">{calculatedOnly.length} métrica(s)</span>
                          </div>
                          {calculatedOnly.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-6">
                              Nenhuma métrica calculada ainda.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {calculatedOnly
                                .slice()
                                .sort((a: any, b: any) => (a.label || a.key).localeCompare(b.label || b.key))
                                .map((m: any) => (
                                  <div key={m.key} className="p-3 bg-white rounded-lg border border-gray-200 flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-gray-900">{m.label}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        <span className="font-mono">{m.key}</span> • <span className="font-mono">{m.formula}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => startEdit(m)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                        title="Editar"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => remove(m.key)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                        title="Remover"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {editingCalculatedMetricKey ? 'Editar métrica' : 'Nova métrica'}
                            </h3>
                            {editingCalculatedMetricKey && (
                              <button
                                onClick={() => {
                                  setEditingCalculatedMetricKey(null)
                                  setCalculatedMetricForm({ key: '', label: '', type: 'number', formula: '' })
                                }}
                                className="text-xs text-gray-600 hover:text-gray-800 underline"
                              >
                                Cancelar edição
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Key</label>
                              <input
                                value={calculatedMetricForm.key}
                                onChange={(e) => setCalculatedMetricForm(prev => ({ ...prev, key: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="ex: roas_calc"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                              <input
                                value={calculatedMetricForm.label}
                                onChange={(e) => setCalculatedMetricForm(prev => ({ ...prev, label: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="ex: ROAS (calc)"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                              <select
                                value={calculatedMetricForm.type}
                                onChange={(e) => setCalculatedMetricForm(prev => ({ ...prev, type: e.target.value as any }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              >
                                <option value="number">Número</option>
                                <option value="currency">Moeda</option>
                                <option value="percentage">Percentual</option>
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Fórmula</label>
                              <input
                                value={calculatedMetricForm.formula}
                                onChange={(e) => setCalculatedMetricForm(prev => ({ ...prev, formula: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="ex: paid_revenue / cost"
                              />
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-xs text-gray-500">
                                  Suporta: + - * / ( ) e campos (ex: <span className="font-mono">revenue</span>)
                                </div>
                              </div>
                              {error && (
                                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                  {error}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                              onClick={closeCalculatedMetricsModal}
                              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200"
                            >
                              Fechar
                            </button>
                            <button
                              onClick={save}
                              disabled={!!error}
                              className="px-4 py-2 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {editingCalculatedMetricKey ? 'Salvar alterações' : 'Criar métrica'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </>
          )}
          
          {/* Modal para adicionar novo widget */}
          {showAddWidgetModal && (
            <>
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={() => {
                  setShowAddWidgetModal(false)
                  setAddWidgetStep('selectDataSource')
                }}
              />
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl z-50">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                    {addWidgetStep === 'selectDataSource' ? 'Selecionar Fonte de Dados' : 'Adicionar Widget'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddWidgetModal(false)
                      setAddWidgetStep('selectDataSource')
                    }}
                    className="p-2 hover:bg-gray-200/60 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="p-6">
                  {(() => {
                    // Obter dataSource da aba ativa
                    const activeTab = activeCustomTab ? customTabs.find(t => t.id === activeCustomTab) : null
                    const tabDataSource = activeTab?.dataSource
                    
                    if (!tabDataSource) {
                      return (
                        <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-sm text-yellow-800 mb-3">
                            ⚠️ Esta aba não tem uma fonte de dados configurada.
                          </p>
                          <p className="text-xs text-yellow-700 mb-3">
                            Configure a fonte de dados da aba antes de adicionar widgets.
                          </p>
                          <button
                            onClick={() => {
                              setShowAddWidgetModal(false)
                              if (activeTab) {
                                setEditingCustomTab(activeTab)
                                setCustomTabFormData({ 
                                  name: activeTab.name, 
                                  icon: activeTab.icon, 
                                  order: activeTab.order,
                                  isUniversal: activeTab.isUniversal || false,
                                  dataSource: activeTab.dataSource || ''
                                })
                                setShowCustomTabModal(true)
                              }
                            }}
                            className="text-sm text-yellow-800 underline hover:text-yellow-900"
                          >
                            Configurar fonte de dados da aba
                          </button>
                        </div>
                      )
                    }
                    
                    return (
                      <>
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Database className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                              Fonte de dados da aba:
                            </span>
                          </div>
                          <p className="text-sm text-blue-700">
                            {configuredDataSources.find(s => s.endpoint === tabDataSource)?.label || tabDataSource}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Todos os widgets desta aba usarão esta fonte de dados
                          </p>
                        </div>
                      
                      <p className="text-sm text-gray-600 mb-4">Escolha o tipo de widget que deseja adicionar:</p>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={() => {
                            // Não passar dataSource - o widget herdará da aba
                            addWidget('cards')
                            setShowAddWidgetModal(false)
                            setAddWidgetStep('selectDataSource')
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
                            // Não passar dataSource - o widget herdará da aba
                            addWidget('timeline')
                            setShowAddWidgetModal(false)
                            setAddWidgetStep('selectDataSource')
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
                            // Não passar dataSource - o widget herdará da aba
                            addWidget('table')
                            setShowAddWidgetModal(false)
                            setAddWidgetStep('selectDataSource')
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
                            // Não passar dataSource - o widget herdará da aba
                            addWidget('runrate')
                            setShowAddWidgetModal(false)
                            setAddWidgetStep('selectDataSource')
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
                    </>
                  )
                  })()}
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
                  {/* Seletor de fonte de dados (mostrar apenas se houver múltiplas fontes configuradas) */}
                  {configuredDataSources.length > 1 && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fonte de Dados
                      </label>
                      <select
                        value={currentWidget?.dataSource || ''}
                        onChange={(e) => updateWidget(editingWidget.id, { 
                          dataSource: e.target.value || undefined 
                        })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="">Padrão ({selectedTable})</option>
                        {configuredDataSources.map((source) => (
                          <option key={source.endpoint} value={source.endpoint}>
                            {source.label} {source.restricted && '(Restrito)'}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Escolha de qual fonte de dados este widget irá buscar informações. 
                        Se não selecionar, usará a fonte padrão do dashboard.
                      </p>
                    </div>
                  )}
                  
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
                              const metric = widgetMetricsAndDimensions.metrics.find(m => m.key === cardKey)
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
                                  className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing group"
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-xs font-medium text-gray-500 w-6 flex-shrink-0">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900 flex-1">
                                    {metric.label}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (currentWidget && editingWidget) {
                                        const currentMetrics = currentWidget.cardMetrics || []
                                        const currentOrder = currentWidget.cardOrder || []
                                        
                                        // Remover da lista de métricas selecionadas
                                        const newMetrics = currentMetrics.filter(key => key !== cardKey)
                                        // Remover da ordem
                                        const newOrder = currentOrder.filter(key => key !== cardKey)
                                        
                                        updateWidget(editingWidget.id, {
                                          cardMetrics: newMetrics,
                                          cardOrder: newOrder
                                        })
                                      }
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    title="Remover métrica"
                                    aria-label="Remover métrica"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
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
                            {(currentWidget?.cardMetrics?.length || 0) === widgetMetricsAndDimensions.metrics.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
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
                          {widgetMetricsAndDimensions.metrics
                            .filter(metric => {
                              // Filtrar métricas já selecionadas - não mostrar na lista
                              const isInCard = (currentWidget?.cardMetrics || []).includes(metric.key)
                              if (isInCard) return false
                              
                              // Aplicar filtro de busca
                              if (!cardsMetricSearch) return true
                              const searchLower = cardsMetricSearch.toLowerCase()
                              return metric.label.toLowerCase().includes(searchLower) || 
                                     metric.key.toLowerCase().includes(searchLower)
                            })
                            .map(metric => {
                            return (
                              <label
                                key={metric.key}
                                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all bg-white border border-gray-200 hover:border-gray-300"
                              >
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => toggleCardMetric(metric.key)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium flex-1 text-gray-700">
                                  {metric.label}
                                </span>
                              </label>
                            )
                          })}
                          {widgetMetricsAndDimensions.metrics.filter(metric => (currentWidget?.cardMetrics || []).includes(metric.key)).length === widgetMetricsAndDimensions.metrics.length && (
                            <p className="text-sm text-gray-500 text-center py-4">
                              Todas as métricas disponíveis já estão selecionadas
                            </p>
                          )}
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
                          {widgetMetricsAndDimensions.metrics
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
                                Selecionadas: {currentWidget.timelineMetrics.map(key => widgetMetricsAndDimensions.metrics.find(m => m.key === key)?.label).filter(Boolean).join(', ')}
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
                            {(currentWidget?.selectedDimensions?.length || 0) === widgetMetricsAndDimensions.dimensions.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
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
                          {widgetMetricsAndDimensions.dimensions
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
                            {(currentWidget?.selectedMetrics?.length || 0) === widgetMetricsAndDimensions.metrics.length ? 'Desselecionar Todas' : 'Selecionar Todas'}
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
                          {widgetMetricsAndDimensions.metrics
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
                  {filteredWidgets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Nenhum widget para reordenar.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredWidgets.map((widget, index) => {
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
                                disabled={index === filteredWidgets.length - 1}
                                className={`p-2 rounded-lg transition-all ${
                                  index === filteredWidgets.length - 1
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
                              // Removido formatação de moeda - tratar como número
                              displayValue = new Intl.NumberFormat('pt-BR').format(value)
                            } else if (metricType === 'percentage') {
                              displayValue = `${value.toFixed(2)}%`
                            } else if (metKey === 'roas') {
                              displayValue = value.toFixed(2) + 'x'
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

              {/* Opção para tornar aba universal (apenas para usuários com acesso "all") */}
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                hasAllAccess 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}>
                <input
                  type="checkbox"
                  id="isUniversal"
                  checked={customTabFormData.isUniversal || false}
                  onChange={(e) => {
                    if (hasAllAccess) {
                      setCustomTabFormData({ ...customTabFormData, isUniversal: e.target.checked })
                    } else {
                      alert('Apenas usuários com nível de acesso "all" podem criar abas universais')
                    }
                  }}
                  disabled={!hasAllAccess}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex-1">
                  <label 
                    htmlFor="isUniversal" 
                    className={`block text-sm font-medium cursor-pointer ${
                      hasAllAccess ? 'text-gray-900' : 'text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    🌍 Tornar aba universal
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    {hasAllAccess 
                      ? 'Esta aba ficará acessível para todos os clientes.'
                      : 'Apenas usuários com nível de acesso "all" podem criar abas universais.'
                    }
                  </p>
                </div>
              </div>
              
              {/* Seletor de Fonte de Dados */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fonte de Dados
                </label>
                <select
                  value={customTabFormData.dataSource || ''}
                  onChange={(e) => setCustomTabFormData({ ...customTabFormData, dataSource: e.target.value || '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                >
                  <option value="">Selecione uma fonte de dados</option>
                  {configuredDataSources.map((source) => (
                    <option key={source.endpoint} value={source.endpoint}>
                      {source.label} {source.restricted && '(Restrito)'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Todos os widgets desta aba usarão esta fonte de dados
                </p>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCustomTabModal(false)
                  setEditingCustomTab(null)
                  setCustomTabFormData({ name: '', icon: 'BarChart3', order: 0, isUniversal: false, dataSource: '' })
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
                  
                  // Obter email do usuário para abas universais
                  let userEmail = ''
                  try {
                    const loginResponse = localStorage.getItem('login-response')
                    if (loginResponse) {
                      const parsed = JSON.parse(loginResponse)
                      userEmail = parsed.email || parsed.user?.email || ''
                    }
                  } catch (error) {
                    console.error('Erro ao obter email do usuário:', error)
                  }

                  if (editingCustomTab) {
                    // Bloquear edição de abas universais para usuários sem acesso "all"
                    if (editingCustomTab.isUniversal && !hasAllAccess) {
                      alert('Apenas usuários com nível de acesso "all" podem editar abas universais.')
                      return
                    }
                    
                    // Atualizar aba existente
                    const updates: any = { 
                      name: customTabFormData.name, 
                      icon: customTabFormData.icon,
                      dataSource: customTabFormData.dataSource || undefined
                    }
                    // Só permitir alterar isUniversal se for usuário com acesso "all"
                    if (hasAllAccess) {
                      updates.isUniversal = customTabFormData.isUniversal
                      if (customTabFormData.isUniversal && !editingCustomTab.createdBy) {
                        updates.createdBy = userEmail
                      }
                    } else if (editingCustomTab.isUniversal) {
                      // Manter isUniversal como true se já era universal e usuário não tem acesso all
                      // (não pode remover o status universal, mas pode editar outros campos se não for universal)
                      // Na verdade, se chegou aqui e é universal sem acesso all, não deveria editar
                      // Mas por segurança, vamos manter o isUniversal
                      updates.isUniversal = true
                    }
                    const updated = DashboardStorage.updateCustomTab(
                      selectedTable,
                      editingCustomTab.id,
                      updates
                    )
                    if (updated) {
                      const updatedTabs = customTabs.map(t => t.id === updated.id ? updated : t)
                      setCustomTabs(updatedTabs.sort((a, b) => a.order - b.order))
                    }
                  } else {
                    // Criar nova aba
                    // Bloquear criação de abas universais para usuários sem acesso "all"
                    if (customTabFormData.isUniversal && !hasAllAccess) {
                      alert('Apenas usuários com nível de acesso "all" podem criar abas universais.')
                      return
                    }
                    
                    const newTabData: any = {
                      name: customTabFormData.name,
                      icon: customTabFormData.icon,
                      order: customTabs.length
                    }
                    // Adicionar isUniversal e createdBy se for usuário com acesso "all"
                    if (hasAllAccess && customTabFormData.isUniversal) {
                      newTabData.isUniversal = true
                      newTabData.createdBy = userEmail
                    }
                    const newTab = DashboardStorage.addCustomTab(selectedTable, newTabData)
                    const updatedTabs = [...customTabs, newTab].sort((a, b) => a.order - b.order)
                    setCustomTabs(updatedTabs)
                    setActiveCustomTab(newTab.id)
                  }
                  
                  setShowCustomTabModal(false)
                  setEditingCustomTab(null)
                  setCustomTabFormData({ name: '', icon: 'BarChart3', order: 0, isUniversal: false, dataSource: '' })
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


