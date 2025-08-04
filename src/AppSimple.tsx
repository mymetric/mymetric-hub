import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import LoadingScreen from './components/LoadingScreen'
import DebugAuth from './components/DebugAuth'
import TestAuth from './components/TestAuth'
import { useAuthSimple } from './hooks/useAuthSimple'

function AppSimple() {
  const { isAuthenticated, user, isLoading, login, logout } = useAuthSimple()

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
      <DebugAuth />
      <TestAuth />
    </div>
  )
}

export default AppSimple 