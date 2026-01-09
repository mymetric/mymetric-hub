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
  legacy?: unknown
}

const DASHBOARD_API_BASE_URL: string =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DASHBOARD_API_BASE_URL || '').trim()

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Erro desconhecido'
  }
}

type FetchJsonOk<T> = { ok: true; data: T }
type FetchJsonErr = { ok: false; status?: number; message: string; bodyText?: string }
type FetchJsonResult<T> = FetchJsonOk<T> | FetchJsonErr

function isFetchOk<T>(r: FetchJsonResult<T>): r is FetchJsonOk<T> {
  return r.ok === true
}

async function fetchJson<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<FetchJsonResult<T>> {
  const url = `${DASHBOARD_API_BASE_URL}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })

    const status = response.status

    // Tentar ler JSON; se falhar, capturar texto para debug
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok) {
      let bodyText: string | undefined
      try {
        bodyText = await response.text()
      } catch {
        // ignore (best-effort)
      }
      return { ok: false, status, message: `HTTP ${status} (${url})`, bodyText }
    }

    if (contentType.includes('application/json')) {
      const data = (await response.json()) as T
      return { ok: true, data }
    }

    // Mesmo quando ok, se não é JSON, isso é inesperado para nossa API
    const bodyText = await response.text().catch(() => '')
    return { ok: false, status, message: `Resposta não-JSON em ${url}`, bodyText }
  } catch (err: unknown) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    const message = isAbort ? `Timeout após ${timeoutMs}ms (${url})` : getErrorMessage(err) || `Falha ao chamar ${url}`
    return { ok: false, message }
  } finally {
    clearTimeout(timeout)
  }
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

      const result = await fetchJson<{ success: boolean; docId?: string; error?: string; message?: string }>(
        '/api/dashboard/save',
        {
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
        },
      )

      if (!isFetchOk(result)) {
        console.error('❌ Falha no /api/dashboard/save:', result)
        throw new Error(result.message)
      }

      console.log('✅ Configuração salva no Firestore via API:', { tableName, docId: result.data.docId })
    } catch (error: unknown) {
      console.error('❌ Erro ao salvar configuração no Firestore:', error)
      console.error('Detalhes completos do erro:', {
        message: getErrorMessage(error),
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

      const result = await fetchJson<{ success: boolean; config: DashboardConfig | null; error?: string; message?: string }>(
        `/api/dashboard/load?${params.toString()}`
      )
      if (!isFetchOk(result)) {
        console.error('❌ Falha no /api/dashboard/load:', result)
        throw new Error(result.message)
      }
      
      if (result.data.config) {
        console.log('✅ Configuração carregada do Firestore via API:', { tableName })
        return result.data.config as DashboardConfig
      }
      
      return null
    } catch (error: unknown) {
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
      const result = await fetchJson<{ success: boolean; error?: string; message?: string }>(
        '/api/dashboard/delete-universal-tab',
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tabId,
          accessControl,
          userTableName
        })
        },
      )

      if (!isFetchOk(result)) {
        console.error('❌ Falha no /api/dashboard/delete-universal-tab:', result)
        throw new Error(result.message)
      }

      console.log('✅ Aba universal deletada do documento _universal:', tabId)
    } catch (error: unknown) {
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
      const result = await fetchJson<{ success: boolean; dataSources?: DataSource[]; error?: string; message?: string }>(
        `/api/dashboard/data-sources?${params.toString()}`
      )
      if (!isFetchOk(result)) {
        console.error('❌ Falha no /api/dashboard/data-sources:', result)
        throw new Error(result.message)
      }
      
      if (result.data.success && result.data.dataSources) {
        console.log('✅ Fontes de dados carregadas:', { 
          tableName, 
          count: result.data.dataSources.length 
        })
        return result.data.dataSources as DataSource[]
      }
      
      return []
    } catch (error: unknown) {
      console.error('❌ Erro ao buscar fontes de dados:', error)
      return []
    }
  }

  /**
   * Testar conexão com o Firestore via API backend
   */
  static async testConnection(): Promise<{ success: boolean; error?: unknown; message: string }> {
    console.log('🧪 [TEST] Iniciando teste de conexão com Firestore via API...')
    
    try {
      // No Vercel, o endpoint de health check da função serverless está em /api/dashboard/health.
      // No servidor local (server/firestore-api.js), historicamente era /api/health.
      // Para evitar travar/gerar 404 no deploy, tentamos o caminho novo e fazemos fallback.
      const healthEndpoints = ['/api/dashboard/health', '/api/health']
      let response: Response | null = null
      let lastError: unknown = null

      for (const endpoint of healthEndpoints) {
        try {
          const r = await fetchJson<unknown>(endpoint, undefined, 10000)
          if (isFetchOk(r)) {
            response = new Response(JSON.stringify(r.data), { status: 200, headers: { 'content-type': 'application/json' } })
            break
          }
          lastError = new Error(r.message)
        } catch (e) {
          lastError = e
          response = null
        }
      }

      if (!response) {
        throw lastError instanceof Error ? lastError : new Error('Falha ao chamar endpoint de health check')
      }
      
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
    } catch (error: unknown) {
      console.error('❌ [TEST] Erro ao testar conexão:', error)
      return { 
        success: false, 
        error,
        message: `Erro ao testar conexão: ${getErrorMessage(error)}` 
      }
    }
  }
}
