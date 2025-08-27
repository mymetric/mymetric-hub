import Logo from './Logo'

interface LoadingScreenProps {
  message?: string
  showAuthStatus?: boolean
}

const LoadingScreen = ({ message = 'Carregando...', showAuthStatus = false }: LoadingScreenProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        {/* Logo animado */}
        <div className="mb-8">
          <Logo size="xl" />
        </div>
        
        {/* Spinner */}
        <div className="mb-6">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div>
        
        {/* Mensagem principal */}
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {message}
        </h2>
        
        {/* Status de autenticação */}
        {showAuthStatus && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Verificando autenticação...</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Restaurando sua sessão anterior
            </p>
          </div>
        )}
        
        {/* Indicador de progresso */}
        <div className="mt-6 w-48 bg-gray-200 rounded-full h-1 mx-auto overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
        </div>
        
        {/* Dicas */}
        <div className="mt-8 text-sm text-gray-500 max-w-md mx-auto">
          <p>Se esta tela persistir por muito tempo, tente:</p>
          <ul className="mt-2 space-y-1 text-left">
            <li>• Verificar sua conexão com a internet</li>
            <li>• Recarregar a página (F5)</li>
            <li>• Limpar o cache do navegador</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen 