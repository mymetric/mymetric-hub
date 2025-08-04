import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import LoadingScreen from './components/LoadingScreen'
import { useAuth } from './hooks/useAuth'

function App() {
  const { isAuthenticated, user, isLoading, login, logout } = useAuth()

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