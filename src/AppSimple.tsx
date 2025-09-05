import { useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import LoadingScreen from './components/LoadingScreen'
import DebugAuth from './components/DebugAuth'
import TestAuth from './components/TestAuth'
import { useAuthSimple } from './hooks/useAuthSimple'
import { useTokenExpiry } from './hooks/useTokenExpiry'
import { useDocumentTitle } from './hooks/useDocumentTitle'

function AppSimple() {
  const { isAuthenticated, user, isLoading, isInitialized, login, logout, checkTokenExpiry } = useAuthSimple()
  
  // Hook para gerenciar expiração do token
  useTokenExpiry(checkTokenExpiry)

  // Interceptor global para capturar erros 401
  useEffect(() => {
    // Interceptar erros de fetch globalmente
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        
        // Se for erro 401, deslogar o usuário (exceto durante login)
        if (response.status === 401) {
          const url = args[0]?.toString() || ''
          const isLoginRequest = url.includes('/login')
          
          if (!isLoginRequest) {
            console.log('🔐 SIMPLE AUTH - Erro 401 detectado, deslogando usuário...')
            logout()
          } else {
            console.log('🔐 SIMPLE AUTH - Erro 401 durante login - não deslogando usuário')
          }
        }
        
        return response
      } catch (error) {
        throw error
      }
    }

    // Cleanup function
    return () => {
      window.fetch = originalFetch
    }
  }, [logout])

  // Títulos dinâmicos baseados no estado da aplicação
  useDocumentTitle(
    isLoading 
      ? 'Carregando... | MyMetricHUB'
      : isAuthenticated 
        ? `Dashboard | MyMetricHUB${user?.username ? ` - ${user.username}` : ''}`
        : 'Login | MyMetricHUB'
  )

  const handleLogin = async (username: string, rememberMe: boolean) => {
    await login(username, rememberMe)
  }

  const handleLogout = () => {
    logout()
  }

  // Mostrar loading enquanto inicializa ou carrega
  if (isLoading || !isInitialized) {
    const message = !isInitialized 
      ? 'Inicializando aplicação...' 
      : 'Carregando...'
    
    return (
      <LoadingScreen 
        message={message} 
        showAuthStatus={!isInitialized && !isAuthenticated}
      />
    )
  }

  return (
    <div className="min-h-screen">
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} user={user} />
      ) : (
        <div className="min-h-screen flex items-center justify-center p-4">
          <LoginScreen onLogin={handleLogin} />
        </div>
      )}
      <DebugAuth />
      <TestAuth />
    </div>
  )
}

export default AppSimple 