import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { TrendingUp, DollarSign } from 'lucide-react'

interface TimelineData {
  date: string
  sessions: number
  revenue: number
}

interface TimelineChartProps {
  data: TimelineData[]
  title: string
}

const TimelineChart = ({ data, title }: TimelineChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhum dado disponível para a timeline</p>
        </div>
      </div>
    )
  }

  // Preparar dados para o gráfico
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    }),
    sessionsFormatted: new Intl.NumberFormat('pt-BR').format(item.sessions),
    revenueFormatted: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(item.revenue)
  }))

  // Calcular totais
  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0)
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
                     <div className="space-y-1">
             <div className="flex items-center gap-2">
               <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
               <span className="text-sm text-gray-600">Sessões:</span>
               <span className="text-sm font-medium text-gray-900">
                 {payload[0]?.payload.sessionsFormatted}
               </span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
               <span className="text-sm text-gray-600">Receita:</span>
               <span className="text-sm font-medium text-gray-900">
                 {payload[1]?.payload.revenueFormatted}
               </span>
             </div>
           </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        
                 {/* Legend */}
         <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
             <span className="text-sm text-gray-600">Sessões</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
             <span className="text-sm text-gray-600">Receita</span>
           </div>
         </div>
      </div>
      
      {/* Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="left"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Intl.NumberFormat('pt-BR').format(value)}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                notation: 'compact'
              }).format(value)}
            />
            <Tooltip content={<CustomTooltip />} />
                         <Line
               yAxisId="left"
               type="monotone"
               dataKey="sessions"
               stroke="#3b82f6"
               strokeWidth={3}
               dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
               activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
             />
             <Line
               yAxisId="right"
               type="monotone"
               dataKey="revenue"
               stroke="#10b981"
               strokeWidth={3}
               dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
               activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2 }}
             />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                 <div className="text-center">
           <div className="flex items-center justify-center gap-2 mb-2">
             <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
             <span className="text-sm font-medium text-gray-700">Total de Sessões</span>
           </div>
           <p className="text-xl font-bold text-gray-900">
             {new Intl.NumberFormat('pt-BR').format(totalSessions)}
           </p>
         </div>
         <div className="text-center">
           <div className="flex items-center justify-center gap-2 mb-2">
             <DollarSign className="w-4 h-4 text-emerald-500" />
             <span className="text-sm font-medium text-gray-700">Receita Total</span>
           </div>
           <p className="text-xl font-bold text-gray-900">
             {new Intl.NumberFormat('pt-BR', {
               style: 'currency',
               currency: 'BRL',
               minimumFractionDigits: 0
             }).format(totalRevenue)}
           </p>
         </div>
      </div>
    </div>
  )
}

export default TimelineChart 