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
  pixel_transactions?: number
  pixel_revenue?: number
  recurring_annual_revenue?: number
  recurring_annual_subscriptions?: number
  recurring_montly_revenue?: number
  recurring_montly_subscriptions?: number
  first_annual_revenue?: number
  first_annual_subscriptions?: number
  first_montly_revenue?: number
  first_montly_subscriptions?: number
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
  pixel_transactions?: number
  pixel_revenue?: number
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

// Tipos para Leads
export interface LeadsOrderItem {
  subscribe_timestamp: string
  name: string
  phone: string
  email: string
  fsm_source: string
  fsm_medium: string
  fsm_campaign: string
  transaction_id: string
  purchase_timestamp: string
  value: number
  source: string
  medium: string
  campaign: string
  days_between_subscribe_and_purchase: number
  minutes_between_subscribe_and_purchase: number
}

export interface LeadsOrdersRequest {
  start_date?: string
  end_date?: string
  table_name: string
  limit?: number
  offset?: number
  last_cache?: boolean
}

export interface LeadsOrdersResponse {
  data: LeadsOrderItem[]
  total_rows: number
  total_records?: number
  summary: Record<string, any>
  cache_info: Record<string, any>
  pagination?: {
    limit: number
    offset: number
    has_more: boolean
  }
}

// Tipos para Tendência de Campanhas de Mídia Paga
export interface AdsCampaignTrendItem {
  campaign_name: string
  platform: string
  cost_w1: number
  cost_w2: number
  cost_w3: number
  cost_w4: number
  revenue_w1: number
  revenue_w2: number
  revenue_w3: number
  revenue_w4: number
  roas_w1: number
  roas_w2: number
  roas_w3: number
  roas_w4: number
  roas_growth_w2_vs_w1_pct: number
  roas_growth_w3_vs_w2_pct: number
  roas_growth_w4_vs_w3_pct: number
  roas_trend: string
  avg_daily_cost_w4: number
}

export interface AdsCampaignTrendRequest {
  table_name: string
}

export interface AdsCampaignTrendResponse {
  data: AdsCampaignTrendItem[]
}

// Tipos para Nova API de Campanhas de Mídia Paga (API 2.0)
export interface PaidMediaCampaignResult {
  campaign_id: number
  campaign_name: string
  clicks: number
  cost: number
  date: string
  first_annual_revenue: number
  first_annual_subscriptions: number
  first_montly_revenue: number
  first_montly_subscriptions: number
  first_revenue: number
  first_transaction: number
  fsm_first_annual_revenue: number
  fsm_first_annual_subscriptions: number
  fsm_first_montly_revenue: number
  fsm_first_montly_subscriptions: number
  fsm_first_revenue: number
  fsm_first_transaction: number
  fsm_recurring_annual_revenue: number
  fsm_recurring_annual_subscriptions: number
  fsm_recurring_montly_revenue: number
  fsm_recurring_montly_subscriptions: number
  fsm_revenue: number
  fsm_transactions: number
  impressions: number
  leads: number
  pixel_revenue: number
  pixel_transactions: number
  platform: string
  recurring_annual_revenue: number
  recurring_annual_subscriptions: number
  recurring_montly_revenue: number
  recurring_montly_subscriptions: number
  revenue: number
  transactions: number
}

export interface PaidMediaCampaignsResponse {
  count?: number
  data: PaidMediaCampaignResult[]
} 