import { useState } from 'react'
import { LogOut, User, Shield } from 'lucide-react'

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
  const [showDetails, setShowDetails] = useState(false)

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
                  <Shield className="w-5 h-5 text-yellow-600" />
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
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <button
                onClick={onLogout}
                className="w-full px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
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
