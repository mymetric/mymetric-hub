import { useEffect, useState } from 'react'

const DebugAuth = () => {
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    const updateDebugInfo = () => {
      const token = localStorage.getItem('auth-token')
      const storedAuth = localStorage.getItem('mymetric-auth')
      
      setDebugInfo({
        token: token ? `${token.substring(0, 20)}...` : 'none',
        hasToken: !!token,
        storedAuth: storedAuth ? JSON.parse(storedAuth) : 'none',
        hasStoredAuth: !!storedAuth,
        localStorageKeys: Object.keys(localStorage),
        timestamp: new Date().toISOString()
      })
    }

    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, 1000)
    
    return () => clearInterval(interval)
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">🔍 Debug Auth</h3>
      <pre className="whitespace-pre-wrap">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  )
}

export default DebugAuth 