import { AdsCampaignRequest, AdsCampaignResponse } from '../types'

const API_BASE_URL = 'https://api.mymetric.app'

// Função para validar table_name - não permite "all" como valor válido para consultas
export const validateTableName = (tableName: string): boolean => {
  if (tableName === 'all') {
    console.log('⚠️ Tentativa de consultar table_name = "all" bloqueada')
    return false
  }
  return true
}

// Função para verificar se é um erro de autenticação e deslogar se necessário
const handleAuthError = (status: number) => {
  if (status === 401) {
    console.log('🔐 Token inválido detectado, deslogando usuário...')
    localStorage.removeItem('auth-token')
    localStorage.removeItem('mymetric-auth')
    // Redirecionar para a página de login
    window.location.href = '/'
  }
}

interface LoginData {
  email: string
  password: string
}

interface LoginResponse {
  access_token: string
  token_type: string
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
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Login error:', error)
      throw new Error('Erro ao conectar com o servidor. Verifique se a API está rodando.')
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
        handleAuthError(response.status)
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
        handleAuthError(response.status)
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
        handleAuthError(response.status)
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
        handleAuthError(response.status)
        const errorText = await response.text()
        console.error('❌ Orders API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Orders API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Orders fetch error:', error)
      throw new Error('Erro ao buscar pedidos.')
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
        handleAuthError(response.status)
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
        handleAuthError(response.status)
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
        handleAuthError(response.status)
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
        handleAuthError(response.status)
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
      console.log('🌐 Ads Campaigns API Request:', {
        url: `${API_BASE_URL}/metrics/ads-campaigns-results`,
        method: 'POST',
        body: adsData
      })

      const response = await fetch(`${API_BASE_URL}/metrics/ads-campaigns-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(adsData),
      })

      console.log('📡 Ads Campaigns Response status:', response.status, response.statusText)

      if (!response.ok) {
        handleAuthError(response.status)
        const errorText = await response.text()
        console.error('❌ Ads Campaigns API Error:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📦 Ads Campaigns API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ Ads Campaigns fetch error:', error)
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
        handleAuthError(response.status)
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
  }
} 