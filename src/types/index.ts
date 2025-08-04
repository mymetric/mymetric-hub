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