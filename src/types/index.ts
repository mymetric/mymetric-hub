export interface LoginForm {
  username: string
  password: string
}

export interface MetricCard {
  title: string
  value: string
  change: string
  isPositive: boolean
  icon: React.ReactNode
  color: string
}

export interface Activity {
  id: number
  action: string
  time: string
  type: 'success' | 'info' | 'warning' | 'error'
}

// Tipos para Havaianas
export interface HavaianasItem {
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

export interface HavaianasResponse {
  data: HavaianasItem[]
}

export interface HavaianasTimelineData {
  date: string
  totalViews: number
  totalTransactions: number
  totalRevenue: number
  avgSizeScore: number
  avgPromoLabel: number
  itemCount: number
}

// Tipos para Mídia Paga
export interface AdsCampaignData {
  platform: string
  campaign_name: string
  date: string
  cost: number
  impressions: number
  clicks: number
  leads: number
  transactions: number
  revenue: number
  transactions_first: number
  revenue_first: number
  transactions_origin_stack: number
  revenue_origin_stack: number
  transactions_first_origin_stack: number
  revenue_first_origin_stack: number
}

export interface AdsCampaignRequest {
  start_date?: string
  end_date?: string
  table_name: string
  last_cache?: boolean
  force_refresh?: boolean
}

export interface CacheInfo {
  source: string
  cached_at: string
  ttl_hours: number
}

export interface AdsCampaignSummary {
  total_cost: number
  total_revenue: number
  total_impressions: number
  total_clicks: number
  total_leads: number
  total_transactions: number
  ctr: number
  cpm: number
  cpc: number
  conversion_rate: number
  roas: number
  periodo: string
  tablename: string
  user_access: string
}

export interface AdsCampaignResponse {
  data: AdsCampaignData[]
  total_rows?: number
  summary?: AdsCampaignSummary
  cache_info?: CacheInfo
}

// Tipos para Dados em Tempo Real
export interface RealtimeDataItem {
  event_timestamp: string
  session_id: string
  transaction_id: string
  item_category: string
  item_name: string
  quantity: number
  item_revenue: number
  source: string
  medium: string
  traffic_category?: string
  campaign: string
  content: string
  term: string
  page_location: string
}

export interface RealtimeDataRequest {
  table_name: string
}

export interface RealtimeDataResponse {
  data: RealtimeDataItem[]
}

// Tipos para dados de Frete
export interface FreteDataItem {
  event_date: string
  zipcode: string
  zipcode_region: string
  calculations: number
  calculations_freight_unavailable: number
  transactions: number
  revenue: number | null
  item_id?: string
  item_name?: string
  item_brand?: string
  item_variant?: string
  item_category?: string
}

export interface FreteRequest {
  start_date: string
  end_date: string
  table_name: string
}

export interface FreteResponse {
  data: FreteDataItem[]
  total_rows?: number
}

// Tipos para Criativos de Mídia Paga
export interface AdsCreativeData {
  platform: string
  campaign_name: string
  ad_group_name: string
  creative_name: string
  date: string
  cost: number
  impressions: number
  clicks: number
  leads: number
  transactions: number
  revenue: number
  transactions_first: number
  revenue_first: number
  transactions_origin_stack: number
  revenue_origin_stack: number
  transactions_first_origin_stack: number
  revenue_first_origin_stack: number
}

export interface AdsCreativeRequest {
  start_date?: string
  end_date?: string
  table_name: string
  last_cache?: boolean
  force_refresh?: boolean
}

export interface AdsCreativeSummary {
  total_cost: number
  total_revenue: number
  total_impressions: number
  total_clicks: number
  total_leads: number
  total_transactions: number
  ctr: number
  cpm: number
  cpc: number
  conversion_rate: number
  roas: number
  periodo: string
  tablename: string
  user_access: string
}

export interface AdsCreativeResponse {
  data: AdsCreativeData[]
  total_rows?: number
  summary?: AdsCreativeSummary
  cache_info?: CacheInfo
} 