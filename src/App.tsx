import { useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import LoadingScreen from './components/LoadingScreen'
import { useAuth } from './hooks/useAuth'
import { useDocumentTitle } from './hooks/useDocumentTitle'

function App() {
  const { isAuthenticated, user, isLoading, login, logout } = useAuth()

  // Interceptor global para capturar erros 401
  useEffect(() => {
    // Interceptar erros de fetch globalmente
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        
        // Se for erro 401, deslogar o usuário
        if (response.status === 401) {
          console.log('🔐 Erro 401 detectado, deslogando usuário...')
          localStorage.removeItem('auth-token')
          localStorage.removeItem('mymetric-auth')
          window.location.href = '/'
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

  const handleLogin = async (username: string) => {
    await login(username)
  }

  const handleLogout = () => {
    logout()
  }

  if (isLoading) {
    return <LoadingScreen />
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
    </div>
  )
}

export default App 