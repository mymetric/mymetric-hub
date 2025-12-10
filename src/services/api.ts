import { AdsCampaignRequest, AdsCampaignResponse, FreteRequest, FreteResponse, LeadsOrdersRequest, LeadsOrdersResponse, AdsCampaignTrendRequest, AdsCampaignTrendResponse } from '../types'

const API_BASE_URL = (typeof window !== 'undefined' && window.location.origin.includes('localhost'))
  ? '/api'
  : 'https://api.mymetric.app'

// Função para validar table_name - não permite "all" ou strings vazias como valores válidos para consultas
export const validateTableName = (tableName: string): boolean => {
  if (!tableName || tableName.trim() === '') {
    console.log('⚠️ Tentativa de consultar table_name vazio bloqueada')
    return false
  }
  if (tableName === 'all') {
    console.log('⚠️ Tentativa de consultar table_name = "all" bloqueada')
    return false
  }
  return true
}

// Função removida - o tratamento de erro 401 é feito pelo interceptor global no App.tsx

interface LoginData {
  email: string
  password: string
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  table_name?: string
  access_control?: string
  admin?: boolean
}

interface RefreshTokenRequest {
  refresh_token: string
}

interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  table_name?: string
  access_control?: string
  admin?: boolean
}

interface ProfileResponse {
  email: string
  admin: boolean
  access_control: string
  tablename: string
}

interface MetricsRequest {
  start_date: string
  end_date: string
  table_name: string
  cluster?: string
  attribution_model?: string
}

interface OrdersRequest {
  start_date: string
  end_date: string
  table_name: string
  traffic_category?: string
  fs_traffic_category?: string
  limit?: number
}

interface DetailedDataRequest {
  start_date: string
  end_date: string
  table_name: string
  attribution_model?: string
  limit?: number
  offset?: number
  order_by?: string
}

interface GoalsRequest {
  table_name: string
}

interface GoalsResponse {
  username: string
  goals: {
    metas_mensais: {
      [key: string]: {
        meta_receita_paga: number
      }
    }
  }
  message: string
}

interface TrafficCategoriesRequest {
  table_name: string
}

interface TrafficCategoriesResponse {
  data: Array<{
    nome: string
    descricao: string
    regras: {
      type: string
      rules: {
        [key: string]: string
      }
    }
  }>
  total_rows: number
}

interface DeleteGoalRequest {
  table_name: string
  month: string
  goal_type: string
}

interface DeleteTrafficCategoryRequest {
  category_name: string
  table_name: string
}

interface SaveMonthlyGoalRequest {
  table_name: string
  month: string
  goal_value: number
  goal_type: string
}

interface SaveTrafficCategoryRequest {
  category_name: string
  description: string
  rules: {
    type: string
    rules: Record<string, string>
  }
  table_name: string
}

interface HavaianasRequest {
  table_name: string
}

interface HavaianasItem {
  event_date: string
  item_id: string
  item_name: string
  elegible: number
  item_views: number
  size_score: number
  promo_label: number
  transactions: number
  purchase_revenue: number
}

interface HavaianasResponse {
  data: HavaianasItem[]
}

interface ProductTrendRequest {
  table_name: string
  limit?: number
  offset?: number
  order_by?: string
}

interface ProductTrendItem {
  item_id: string
  item_name: string
  purchases_week_1: number
  purchases_week_2: number
  purchases_week_3: number
  purchases_week_4: number
  percent_change_w1_w2: number
  percent_change_w2_w3: number
  percent_change_w3_w4: number
  trend_status: string
  trend_consistency: string
}

interface ProductTrendResponse {
  data: ProductTrendItem[]
}





interface RealtimeDataRequest {
  table_name: string
}

interface RealtimeDataItem {
  event_timestamp: string
  session_id: string
  transaction_id: string
  item_category: string
  item_name: string
  quantity: number
  item_revenue: number
  source: string
  medium: string
  campaign: string
  content: string
  term: string
  page_location: string
}

interface RealtimeDataResponse {
  data: RealtimeDataItem[]
}

interface RealtimeRevenueRequest {
  table_name: string
}

interface RealtimeRevenueResponse {
  final_revenue: number
}

interface User {
  id?: string
  email: string
  username: string
  admin: boolean
  access_control: string
  tablename: string
  lastLogin?: string
  created_at?: string

}

interface UsersResponse {
  users: User[]
}

interface CreateUserRequest {
  email: string
  table_name: string
  admin?: boolean
  username?: string
  access_control?: string
  password?: string
}

interface CreateUserResponse {
  message: string
  user: User
  generated_password?: string
  note?: string
  email_sent: boolean
}

interface ForgotPasswordRequest {
  email: string
}

interface ForgotPasswordResponse {
  message: string
}



interface MetricsDataItem {
  Data: string
  Cluster: string
  Investimento: number
  Cliques: number
  Sessoes: number
  Adicoes_ao_Carrinho: number
  Pedidos: number
  Receita: number
  Pedidos_Pagos: number
  Receita_Paga: number
  Novos_Clientes: number
  Receita_Novos_Clientes: number
}

interface MetricsResponse {
  data: MetricsDataItem[]
}

export const api = {
  async login(loginData: LoginData): Promise<LoginResponse> {
    try {
      console.log('🌐 Login API Request:', {
        url: `${API_BASE_URL}/login`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: loginData
      })

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      })

      console.log('📡 Login Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Login API Error:', errorText)
        
        // Tratar diferentes tipos de erro baseado no status HTTP
        if (response.status === 401) {
          throw new Error('Credenciais inválidas. Verifique seu usuário e senha.')
        } else if (response.status === 403) {
          throw new Error('Acesso negado. Verifique suas permissões.')
        } else if (response.status >= 500) {
          throw new Error('Erro interno do servidor. Tente novamente mais tarde.')
        } else if (response.status === 0 || !navigator.onLine) {
          throw new Error('Erro de conexão. Verifique sua internet e se a API está rodando.')
        } else {
          throw new Error(`Erro na requisição: ${response.status} - ${errorText}`)
        }
      }

      const data = await response.json()
      console.log('📦 Login API Response data:', data)
      return data
    } catch (error) {
      console.error('Login error:', error)
      
      // Se já é um erro tratado (tem mensagem específica), apenas relança
      if (error instanceof Error && error.message !== 'Erro ao conectar com o servidor. Verifique se a API está rodando.') {
        throw error
      }
      
      // Para outros erros (rede, timeout, etc.)
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Erro ao conectar com o servidor. Verifique se a API está rodando.')
      }
      
      throw new Error('Erro inesperado ao fazer login. Tente novamente.')
    }
  },

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      console.log('🔄 Refresh Token API Request:', {
        url: `${API_BASE_URL}/refresh-token`,
        method: 'POST'
      })

      const response = await fetch(`${API_BASE_URL}/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      console.log('📡 Refresh Token Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Refresh Token API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Refresh Token API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Refresh Token error:', error)
      throw new Error('Erro ao renovar token de autenticação.')
    }
  },

  async getProfile(token: string): Promise<ProfileResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Profile fetch error:', error)
      throw new Error('Erro ao buscar perfil do usuário.')
    }
  },

  async getMetrics(token: string, metricsData: MetricsRequest): Promise<MetricsResponse> {
    try {
      console.log('🌐 API Request:', {
        url: `${API_BASE_URL}/metrics/basic-data`,
        method: 'POST',
        body: metricsData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/basic-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(metricsData),
      })

      console.log('📡 Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Metrics fetch error:', error)
      throw new Error('Erro ao buscar métricas.')
    }
  },

  // Função de validação de token removida - não é mais usada para logout
  // async validateToken(token: string): Promise<boolean> {
  //   try {
  //     const response = await fetch(`${API_BASE_URL}/validate-token`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${token}`,
  //       },
  //     })

  //     if (!response.ok) {
  //       handleAuthError(response.status)
  //     }

  //     return response.ok
  //   } catch (error) {
  //     console.error('Token validation error:', error)
  //     return false
  //   }
  // },

  async getFunnelData(token: string, metricsData: MetricsRequest): Promise<any> {
    try {
      console.log('🌐 Funnel API Request:', {
        url: `${API_BASE_URL}/metrics/daily-metrics`,
        method: 'POST',
        body: metricsData,
        cluster: metricsData.cluster || 'Todos'
      })

      const response = await fetch(`${API_BASE_URL}/metrics/daily-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(metricsData),
      })

      console.log('📡 Funnel Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Funnel API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Funnel API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Funnel fetch error:', error)
      throw new Error('Erro ao buscar dados do funil.')
    }
  },

  async getOrders(token: string, ordersData: OrdersRequest, signal?: AbortSignal): Promise<any> {
    try {
      console.log('🌐 Orders API Request:', {
        url: `${API_BASE_URL}/metrics/orders`,
        method: 'POST',
        body: ordersData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(ordersData),
        signal, // Adicionar signal para cancelamento
      })

      console.log('📡 Orders Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Orders API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Orders API Response data:', data)
      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⏹️ Orders request aborted (AbortError)')
        throw error
      }
      console.error('❌ Orders fetch error:', error)
      throw new Error('Erro ao buscar pedidos.')
    }
  },

  async getLeadsOrders(token: string, leadsData: LeadsOrdersRequest, signal?: AbortSignal): Promise<LeadsOrdersResponse> {
    try {
      console.log('🌐 Leads Orders API Request:', {
        url: `${API_BASE_URL}/metrics/leads_orders`,
        method: 'POST',
        body: leadsData
      })

      // Criar um timeout de 60 segundos
      const timeoutId = setTimeout(() => {
        if (!signal?.aborted) {
          console.warn('⏱️ Leads Orders request timeout após 60s')
        }
      }, 60000)

      try {
        const response = await fetch(`${API_BASE_URL}/metrics/leads_orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(leadsData),
          signal,
        })

        clearTimeout(timeoutId)

        console.log('📡 Leads Orders Response status:', response.status, response.statusText)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ Leads Orders API Error:', errorText)
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        console.log('📦 Leads Orders API Response data:', data)
        return data
      } catch (fetchError) {
        clearTimeout(timeoutId)
        throw fetchError
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⏹️ Leads Orders request aborted (AbortError)')
        throw error
      }
      
      // Detectar timeout
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('❌ Leads Orders fetch error (Network):', error)
        throw new Error('Network error: Falha ao conectar com o servidor. Verifique sua conexão.')
      }
      
      console.error('❌ Leads Orders fetch error:', error)
      throw error instanceof Error ? error : new Error('Erro ao buscar leads e pedidos.')
    }
  },

  async getGoals(token: string, goalsData: GoalsRequest): Promise<GoalsResponse> {
    try {
      console.log('🌐 Goals API Request:', {
        url: `${API_BASE_URL}/metrics/goals`,
        method: 'POST',
        body: goalsData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(goalsData),
      })

      console.log('📡 Goals Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Goals API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Goals API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Goals fetch error:', error)
      throw new Error('Erro ao buscar metas.')
    }
  },

  async getTrafficCategories(token: string, trafficData: TrafficCategoriesRequest): Promise<TrafficCategoriesResponse> {
    try {
      console.log('🌐 Traffic Categories API Request:', {
        url: `${API_BASE_URL}/admin/load-traffic-categories`,
        method: 'POST',
        body: trafficData
      })

      const response = await fetch(`${API_BASE_URL}/admin/load-traffic-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(trafficData),
      })

      console.log('📡 Traffic Categories Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Traffic Categories API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Traffic Categories API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Traffic Categories fetch error:', error)
      throw new Error('Erro ao buscar categorias de tráfego.')
    }
  },

  async deleteGoal(token: string, deleteGoalData: DeleteGoalRequest): Promise<void> {
    try {
      console.log('🌐 Delete Goal API Request:', {
        url: `${API_BASE_URL}/admin/delete-goal`,
        method: 'DELETE',
        body: deleteGoalData
      })

      const response = await fetch(`${API_BASE_URL}/admin/delete-goal`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(deleteGoalData),
      })

      console.log('📡 Delete Goal Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Delete Goal API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      console.log('✅ Goal deleted successfully')
    } catch (error) {
      console.error('❌ Delete Goal error:', error)
      throw new Error('Erro ao deletar meta.')
    }
  },

  async deleteTrafficCategory(token: string, deleteCategoryData: DeleteTrafficCategoryRequest): Promise<void> {
    try {
      console.log('🌐 Delete Traffic Category API Request:', {
        url: `${API_BASE_URL}/admin/traffic-categories`,
        method: 'DELETE',
        body: deleteCategoryData
      })

      const response = await fetch(`${API_BASE_URL}/admin/traffic-categories`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(deleteCategoryData),
      })

      console.log('📡 Delete Traffic Category Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Delete Traffic Category API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      console.log('✅ Traffic Category deleted successfully')
    } catch (error) {
      console.error('❌ Delete Traffic Category error:', error)
      throw new Error('Erro ao deletar categoria de tráfego.')
    }
  },

  async saveMonthlyGoal(token: string, goalData: SaveMonthlyGoalRequest): Promise<void> {
    try {
      console.log('🌐 Save Monthly Goal API Request:', {
        url: `${API_BASE_URL}/admin/save-monthly-goal`,
        method: 'POST',
        body: goalData
      })

      const response = await fetch(`${API_BASE_URL}/admin/save-monthly-goal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(goalData),
      })

      console.log('📡 Save Monthly Goal Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Save Monthly Goal API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      console.log('✅ Monthly Goal saved successfully')
    } catch (error) {
      console.error('❌ Save Monthly Goal error:', error)
      throw new Error('Erro ao salvar meta.')
    }
  },

  async saveTrafficCategory(token: string, categoryData: SaveTrafficCategoryRequest): Promise<void> {
    try {
      console.log('🌐 Save Traffic Category API Request:', {
        url: `${API_BASE_URL}/admin/traffic-categories`,
        method: 'POST',
        body: categoryData
      })

      const response = await fetch(`${API_BASE_URL}/admin/traffic-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(categoryData),
      })

      console.log('📡 Save Traffic Category Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Save Traffic Category API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      console.log('✅ Traffic Category saved successfully')
    } catch (error) {
      console.error('❌ Save Traffic Category error:', error)
      throw new Error('Erro ao salvar categoria de tráfego.')
    }
  },

  async getDetailedData(token: string, detailedData: DetailedDataRequest): Promise<any> {
    try {
      console.log('🌐 Detailed Data API Request:', {
        url: `${API_BASE_URL}/metrics/detailed-data`,
        method: 'POST',
        body: detailedData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/detailed-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(detailedData),
      })

      console.log('📡 Detailed Data Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Detailed Data API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Detailed Data API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Detailed Data fetch error:', error)
      throw new Error('Erro ao buscar dados detalhados.')
    }
  },

  async getHavaianasData(token: string, havaianasData: HavaianasRequest): Promise<HavaianasResponse> {
    try {
      console.log('🌐 Havaianas API Request:', {
        url: `${API_BASE_URL}/havaianas/items-scoring`,
        method: 'POST',
        body: havaianasData
      })

      const response = await fetch(`${API_BASE_URL}/havaianas/items-scoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(havaianasData),
      })

      console.log('📡 Havaianas Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Havaianas API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Havaianas API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Havaianas fetch error:', error)
      throw new Error('Erro ao buscar dados da Havaianas.')
    }
  },

  async getProductTrend(token: string, productData: ProductTrendRequest): Promise<ProductTrendResponse> {
    try {
      console.log('🌐 Product Trend API Request:', {
        url: `${API_BASE_URL}/metrics/product-trend`,
        method: 'POST',
        body: productData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/product-trend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(productData),
      })

      console.log('📡 Product Trend Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Product Trend API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Product Trend API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Product Trend fetch error:', error)
      throw new Error('Erro ao buscar dados de tendência de produtos.')
    }
  },

  async getAdsCampaigns(token: string, adsData: AdsCampaignRequest): Promise<AdsCampaignResponse> {
    try {
      console.log('🚀 ===== INICIANDO getAdsCampaigns =====')
      console.log('🌐 Ads Campaigns API Request:', {
        url: `${API_BASE_URL}/metrics/ads-campaigns-results`,
        method: 'POST',
        body: adsData
      })
      console.log('🌐 Request body JSON:', JSON.stringify(adsData, null, 2))
      console.log('🌐 Fazendo fetch para:', `${API_BASE_URL}/metrics/ads-campaigns-results`)

      const response = await fetch(`${API_BASE_URL}/metrics/ads-campaigns-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(adsData),
      })

      console.log('🌐 Fetch concluído, status:', response.status)

      console.log('📡 Ads Campaigns Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Ads Campaigns API Error:', errorText)
        const error = new Error(`HTTP error! status: ${response.status} - ${errorText}`)
        // Adiciona o status HTTP ao erro para facilitar a detecção
        ;(error as any).status = response.status
        throw error
      }

      const data = await response.json()
      console.log('📦 Ads Campaigns API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Ads Campaigns fetch error:', error)
      // Se for um erro de fetch (TypeError: Failed to fetch), preserva o erro original
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Adiciona informação sobre o erro de rede/timeout
        const networkError = new Error(`Network error: ${error.message}`)
        ;(networkError as any).originalError = error
        ;(networkError as any).isNetworkError = true
        throw networkError
      }
      throw new Error('Erro ao buscar dados de campanhas de ads.')
    }
  },

  async getRealtimeData(token: string, realtimeData: RealtimeDataRequest): Promise<RealtimeDataResponse> {
    try {
      console.log('🌐 Realtime Data API Request:', {
        url: `${API_BASE_URL}/metrics/realtime`,
        method: 'POST',
        body: realtimeData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/realtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(realtimeData),
      })

      console.log('📡 Realtime Data Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Realtime Data API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Realtime Data API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Realtime Data fetch error:', error)
      throw new Error('Erro ao buscar dados em tempo real.')
    }
  },

  async getRealtimeFinalRevenue(token: string, realtimeRevenueData: RealtimeRevenueRequest): Promise<RealtimeRevenueResponse> {
    try {
      console.log('🌐 Realtime Final Revenue API Request:', {
        url: `${API_BASE_URL}/metrics/realtime-revenue`,
        method: 'POST',
        body: realtimeRevenueData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/realtime-revenue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(realtimeRevenueData),
      })

      console.log('📡 Realtime Final Revenue Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Realtime Final Revenue API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Realtime Final Revenue API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Realtime Final Revenue fetch error:', error)
      throw new Error('Erro ao buscar receita final em tempo real.')
    }
  },

  // Funções para gerenciamento de usuários
  async getUsers(token: string, tableName: string): Promise<UsersResponse> {
    try {
      console.log('🌐 Users API Request:', {
        url: `${API_BASE_URL}/users`,
        method: 'GET',
        tableName
      })

      const response = await fetch(`${API_BASE_URL}/users?table_name=${encodeURIComponent(tableName)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      console.log('📡 Users Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Users API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Users API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Users fetch error:', error)
      throw new Error('Erro ao buscar usuários.')
    }
  },

  async createUser(token: string, userData: CreateUserRequest): Promise<CreateUserResponse> {
    try {
      console.log('🌐 Create User API Request:', {
        url: `${API_BASE_URL}/create-user`,
        method: 'POST',
        body: userData
      })

      const response = await fetch(`${API_BASE_URL}/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      })

      console.log('📡 Create User Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Create User API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Create User API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Create User error:', error)
      throw new Error('Erro ao criar usuário.')
    }
  },



  async deleteUser(token: string, userId: string): Promise<void> {
    try {
      console.log('🌐 Delete User API Request:', {
        url: `${API_BASE_URL}/users/${userId}`,
        method: 'DELETE'
      })

      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      console.log('📡 Delete User Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Delete User API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      console.log('✅ User deleted successfully')
    } catch (error) {
      console.error('❌ Delete User error:', error)
      throw new Error('Erro ao remover usuário.')
    }
  },

  async getFreteData(token: string, freteData: FreteRequest): Promise<FreteResponse> {
    try {
      console.log('🌐 Frete API Request:', {
        url: `${API_BASE_URL}/metrics/shipping-calc-analytics`,
        method: 'POST',
        body: freteData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/shipping-calc-analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(freteData),
      })

      console.log('📡 Frete Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Frete API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Frete API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Frete fetch error:', error)
      throw new Error('Erro ao buscar dados de frete.')
    }
  },

  async forgotPassword(forgotPasswordData: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    try {
      console.log('🌐 Forgot Password API Request:', {
        url: `${API_BASE_URL}/forgot-password`,
        method: 'POST',
        body: forgotPasswordData
      })

      const response = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forgotPasswordData),
      })

      console.log('📡 Forgot Password Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Forgot Password API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Forgot Password API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Forgot Password error:', error)
      throw new Error('Erro ao solicitar recuperação de senha.')
    }
  },

  async getAdsCreatives(token: string, creativesData: AdsCampaignRequest): Promise<AdsCampaignResponse> {
    try {
      console.log('🚀 ===== INICIANDO getAdsCreatives =====')
      console.log('🌐 Ads Creatives API Request:', {
        url: `${API_BASE_URL}/metrics/ads-creatives-results`,
        method: 'POST',
        body: creativesData
      })
      console.log('🌐 Request body JSON:', JSON.stringify(creativesData, null, 2))
      console.log('🌐 Fazendo fetch para:', `${API_BASE_URL}/metrics/ads-creatives-results`)

      const response = await fetch(`${API_BASE_URL}/metrics/ads-creatives-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(creativesData),
      })

      console.log('🌐 Fetch concluído, status:', response.status)

      console.log('📡 Ads Creatives Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Ads Creatives API Error:', errorText)
        const error = new Error(`HTTP error! status: ${response.status} - ${errorText}`)
        // Adiciona o status HTTP ao erro para facilitar a detecção
        ;(error as any).status = response.status
        throw error
      }

      const data = await response.json()
      console.log('📦 Ads Creatives API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Ads Creatives fetch error:', error)
      // Se for um erro de fetch (TypeError: Failed to fetch), preserva o erro original
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Adiciona informação sobre o erro de rede/timeout
        const networkError = new Error(`Network error: ${error.message}`)
        ;(networkError as any).originalError = error
        ;(networkError as any).isNetworkError = true
        throw networkError
      }
      throw new Error('Erro ao buscar dados de criativos de ads.')
    }
  },

  async getAdsCampaignsTrend(token: string, trendData: AdsCampaignTrendRequest): Promise<AdsCampaignTrendResponse> {
    try {
      console.log('🌐 Ads Campaigns Trend API Request:', {
        url: `${API_BASE_URL}/metrics/ads-campaigns-trend`,
        method: 'POST',
        body: trendData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/ads-campaigns-trend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(trendData),
      })

      console.log('📡 Ads Campaigns Trend Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Ads Campaigns Trend API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Ads Campaigns Trend API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Ads Campaigns Trend fetch error:', error)
      throw new Error('Erro ao buscar dados de tendência de campanhas de ads.')
    }
  }
} 