import { useState, useEffect } from 'react'
import { LogOut, Clock, User, Shield } from 'lucide-react'

interface SessionStatusProps {
  onLogout: () => void
  user?: {
    username: string
    email: string
    admin: boolean
    lastLogin: string
  }
}

const SessionStatus = ({ onLogout, user }: SessionStatusProps) => {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const updateTimeLeft = () => {
      const storedData = localStorage.getItem('mymetric-auth-complete')
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData)
          const now = Date.now()
          const timeUntilExpiry = parsed.expiresAt - now
          
          if (timeUntilExpiry > 0) {
            const hours = Math.floor(timeUntilExpiry / (1000 * 60 * 60))
            const minutes = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60))
            
            if (hours > 0) {
              setTimeLeft(`${hours}h ${minutes}m`)
            } else {
              setTimeLeft(`${minutes}m`)
            }
          } else {
            setTimeLeft('Expirado')
          }
        } catch (error) {
          setTimeLeft('--')
        }
      }
    }

    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 60000) // Atualizar a cada minuto

    return () => clearInterval(interval)
  }, [])

  const formatLastLogin = (lastLogin: string) => {
    const date = new Date(lastLogin)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="relative">
      {/* Botão principal */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">{user?.username || 'Usuário'}</span>
        <Clock className="w-4 h-4 text-blue-600" />
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          {timeLeft}
        </span>
      </button>

      {/* Dropdown de detalhes */}
      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{user?.username || 'Usuário'}</h3>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
              {user?.admin && (
                <div className="ml-auto">
                  <Shield className="w-5 h-5 text-yellow-600" title="Administrador" />
                </div>
              )}
            </div>

            {/* Informações da sessão */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Último login:</span>
                <span className="text-gray-900">
                  {user?.lastLogin ? formatLastLogin(user.lastLogin) : '--'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Tempo restante:</span>
                <span className={`font-medium ${
                  timeLeft === 'Expirado' ? 'text-red-600' : 'text-green-600'
                }`}>
                  {timeLeft}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  timeLeft === 'Expirado' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {timeLeft === 'Expirado' ? 'Expirada' : 'Ativa'}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Renovar Sessão
              </button>
              <button
                onClick={onLogout}
                className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay para fechar ao clicar fora */}
      {showDetails && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDetails(false)}
        />
      )}
    </div>
  )
}

export default SessionStatus
