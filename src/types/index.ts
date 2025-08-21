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