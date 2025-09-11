import { useState, useEffect } from 'react'

const TokenDebug = () => {
  const [tokenInfo, setTokenInfo] = useState<any>(null)

  const decodeJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Error decoding JWT:', error)
      return null
    }
  }

  useEffect(() => {
    const updateTokenInfo = () => {
      const storedData = localStorage.getItem('mymetric-auth-complete')
      if (storedData) {
        const parsed = JSON.parse(storedData)
        const now = Date.now()
        
        const accessTokenPayload = parsed.accessToken ? decodeJWT(parsed.accessToken) : null
        const refreshTokenPayload = parsed.refreshToken ? decodeJWT(parsed.refreshToken) : null
        
        setTokenInfo({
          stored: parsed,
          accessToken: accessTokenPayload,
          refreshToken: refreshTokenPayload,
          now: now,
          accessTokenExpired: parsed.expiresAt <= now,
          refreshTokenExpired: parsed.refreshExpiresAt <= now,
          timeUntilAccessExpiry: parsed.expiresAt - now,
          timeUntilRefreshExpiry: parsed.refreshExpiresAt - now
        })
      }
    }

    updateTokenInfo()
    const interval = setInterval(updateTokenInfo, 1000) // Atualizar a cada segundo

    return () => clearInterval(interval)
  }, [])

  if (!tokenInfo) {
    return <div className="p-4 bg-gray-100 rounded">Nenhum token encontrado</div>
  }

  return (
    <div className="p-4 bg-white border rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">Token Debug Info</h3>
      
      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded">
          <h4 className="font-semibold">Access Token</h4>
          <p>Exp: {tokenInfo.accessToken?.exp ? new Date(tokenInfo.accessToken.exp * 1000).toLocaleString() : 'N/A'}</p>
          <p>Stored Exp: {new Date(tokenInfo.stored.expiresAt).toLocaleString()}</p>
          <p>Expired: <span className={tokenInfo.accessTokenExpired ? 'text-red-600' : 'text-green-600'}>{tokenInfo.accessTokenExpired ? 'Yes' : 'No'}</span></p>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <h4 className="font-semibold">Refresh Token</h4>
          <p>Exp: {tokenInfo.refreshToken?.exp ? new Date(tokenInfo.refreshToken.exp * 1000).toLocaleString() : 'N/A'}</p>
          <p>Stored Exp: {new Date(tokenInfo.stored.refreshExpiresAt).toLocaleString()}</p>
          <p>Expired: <span className={tokenInfo.refreshTokenExpired ? 'text-red-600' : 'text-green-600'}>{tokenInfo.refreshTokenExpired ? 'Yes' : 'No'}</span></p>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <h4 className="font-semibold">Raw Payloads</h4>
          <details>
            <summary>Access Token Payload</summary>
            <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(tokenInfo.accessToken, null, 2)}</pre>
          </details>
          <details className="mt-2">
            <summary>Refresh Token Payload</summary>
            <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(tokenInfo.refreshToken, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  )
}

export default TokenDebug
