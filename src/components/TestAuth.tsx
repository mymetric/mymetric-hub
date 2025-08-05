import { useState } from 'react'
import { api } from '../services/api'

const TestAuth = () => {
  const [testResult, setTestResult] = useState<string>('')

  const testTokenValidation = async () => {
    const token = localStorage.getItem('auth-token')
    if (!token) {
      setTestResult('❌ No token found')
      return
    }

    setTestResult('✅ Token validation disabled - token exists in storage')
  }

  const testProfileFetch = async () => {
    const token = localStorage.getItem('auth-token')
    if (!token) {
      setTestResult('❌ No token found')
      return
    }

    try {
      setTestResult('🔄 Testing profile fetch...')
      const profile = await api.getProfile(token)
      setTestResult(`✅ Profile fetched: ${JSON.stringify(profile, null, 2)}`)
    } catch (error) {
      setTestResult(`❌ Error: ${error}`)
    }
  }

  const clearStorage = () => {
    localStorage.clear()
    setTestResult('🗑️ Storage cleared')
  }

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div className="fixed top-4 right-4 bg-blue-800 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">🧪 Test Auth</h3>
      <div className="space-y-2">
        <button 
          onClick={testTokenValidation}
          className="block w-full bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
        >
          Test Token
        </button>
        <button 
          onClick={testProfileFetch}
          className="block w-full bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
        >
          Test Profile
        </button>
        <button 
          onClick={clearStorage}
          className="block w-full bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
        >
          Clear Storage
        </button>
      </div>
      <div className="mt-2 p-2 bg-black/20 rounded text-xs">
        <pre className="whitespace-pre-wrap">{testResult}</pre>
      </div>
    </div>
  )
}

export default TestAuth 