// Serviço para gerenciar personalizações do dashboard via API backend
// O backend usa Firebase Admin SDK com as credenciais do .env

// Interfaces exportadas do OverviewDashboard
export interface Widget {
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
  customTabId?: string
  dataSource?: string // Endpoint da collection 'tables' do Firestore
}

export interface DataSource {
  endpoint: string
  label: string
  restricted?: boolean
  metrics?: Array<{
    key: string
    label: string
    type: 'number' | 'currency' | 'percentage'
    isCalculated?: boolean
    formula?: string
  }>
  dimensions?: Array<{key: string, label: string}>
  isLoaded?: boolean
  isLoading?: boolean
}

export interface CustomTab {
  id: string
  name: string
  icon: string
  order: number
  createdAt: string
  updatedAt: string
  isUniversal?: boolean
  createdBy?: string
  dataSource?: string // Endpoint da fonte de dados associada a esta aba
}

export interface DashboardConfig {
  widgets: Widget[]
  customTabs?: CustomTab[]
  dataSources?: DataSource[]
  version: string
  legacy?: any
}

/**
 * Serviço para gerenciar personalizações do dashboard via API backend
 */
export class DashboardFirestore {
  /**
   * Obter userId, email e informações de acesso do localStorage
   */
  private static getUserInfo(): { userId?: string; email?: string; accessControl?: string; tableName?: string } {
    try {
      const loginResponse = localStorage.getItem('login-response')
      if (loginResponse) {
        const parsed = JSON.parse(loginResponse)
        return {
          userId: parsed.user_id || parsed.id,
          email: parsed.email || parsed.user?.email,
          accessControl: parsed.access_control || parsed.user?.access_control,
          tableName: parsed.table_name || parsed.tablename || parsed.user?.tablename
        }
      }
    } catch (error) {
      console.error('Erro ao obter informações do usuário:', error)
    }
    return {}
  }

  /**
   * Salvar configuração do dashboard via API backend
   */
  static async saveConfig(
    tableName: string, 
    config: Partial<DashboardConfig>
  ): Promise<void> {
    if (!tableName) {
      console.warn('⚠️ tableName não fornecido, não salvando no Firestore')
      return
    }

    try {
      console.log('🔍 DashboardFirestore.saveConfig chamado:', { tableName, config })
      
      const { userId, email, accessControl, tableName: userTableName } = this.getUserInfo()
      console.log('👤 Informações do usuário:', { userId, email, accessControl, tableName: userTableName })

      const response = await fetch('/api/dashboard/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableName,
          config,
          userId,
          email,
          accessControl,
          userTableName
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Configuração salva no Firestore via API:', { tableName, docId: result.docId })
    } catch (error: any) {
      console.error('❌ Erro ao salvar configuração no Firestore:', error)
      console.error('Detalhes completos do erro:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        cause: error?.cause
      })
      
      // Re-lançar o erro para que o caller possa tratá-lo
      throw error
    }
  }

  /**
   * Carregar configuração do dashboard via API backend
   */
  static async loadConfig(tableName: string): Promise<DashboardConfig | null> {
    if (!tableName) {
      return null
    }

    try {
      const { userId, email } = this.getUserInfo()
      
      const params = new URLSearchParams({
        tableName,
        ...(userId && { userId }),
        ...(email && { email })
      })

      const response = await fetch(`/api/dashboard/load?${params.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (result.config) {
        console.log('✅ Configuração carregada do Firestore via API:', { tableName })
        return result.config as DashboardConfig
      }
      
      return null
    } catch (error: any) {
      console.error('❌ Erro ao carregar configuração do Firestore:', error)
      return null
    }
  }

  /**
   * Deletar uma aba universal do documento _universal
   */
  static async deleteUniversalTab(tabId: string): Promise<void> {
    try {
      const { accessControl, tableName: userTableName } = this.getUserInfo()
      const response = await fetch('/api/dashboard/delete-universal-tab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tabId,
          accessControl,
          userTableName
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      console.log('✅ Aba universal deletada do documento _universal:', tabId)
    } catch (error: any) {
      console.error('❌ Erro ao deletar aba universal:', error)
      throw error
    }
  }

  /**
   * Buscar fontes de dados disponíveis da collection 'tables'
   */
  static async getDataSources(tableName: string): Promise<DataSource[]> {
    if (!tableName) {
      return []
    }

    try {
      const params = new URLSearchParams({ tableName })
      const response = await fetch(`/api/dashboard/data-sources?${params.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.dataSources) {
        console.log('✅ Fontes de dados carregadas:', { 
          tableName, 
          count: result.dataSources.length 
        })
        return result.dataSources as DataSource[]
      }
      
      return []
    } catch (error: any) {
      console.error('❌ Erro ao buscar fontes de dados:', error)
      return []
    }
  }

  /**
   * Testar conexão com o Firestore via API backend
   */
  static async testConnection(): Promise<{ success: boolean; error?: any; message: string }> {
    console.log('🧪 [TEST] Iniciando teste de conexão com Firestore via API...')
    
    try {
      const response = await fetch('/api/health')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ [TEST] API backend está respondendo:', result)
      
      // Testar salvamento e leitura
      const testTableName = '_test_connection'
      const testConfig = {
        widgets: [],
        customTabs: [],
        version: '2.0'
      }

      console.log('📤 [TEST] Testando salvamento...')
      await this.saveConfig(testTableName, testConfig)
      console.log('✅ [TEST] Salvamento funcionou!')

      console.log('📥 [TEST] Testando leitura...')
      const loaded = await this.loadConfig(testTableName)
      console.log('✅ [TEST] Leitura funcionou!', loaded)

      return { success: true, message: 'Conexão com Firestore via API funcionando corretamente!' }
    } catch (error: any) {
      console.error('❌ [TEST] Erro ao testar conexão:', error)
      return { 
        success: false, 
        error,
        message: `Erro ao testar conexão: ${error?.message || 'Erro desconhecido'}` 
      }
    }
  }
}
