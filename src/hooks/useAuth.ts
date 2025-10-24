import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface AuthData {
  isAuthenticated: boolean
  user?: {
    email: string
    admin: boolean
    access_control: string
    tablename: string
    username: string
    lastLogin: string
  }
}

interface StoredAuthData {
  authData: AuthData
  accessToken: string
  refreshToken: string
  rememberMe: boolean
  expiresAt: number
  refreshExpiresAt: number
}

// Função para decodificar JWT e obter expiração real
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

export const useAuth = () => {
  const [authData, setAuthData] = useState<AuthData>({ isAuthenticated: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Função para renovar token automaticamente
  const refreshAccessToken = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> => {
    try {
      console.log('🔄 Attempting to refresh access token...')
      const response = await api.refreshToken(refreshToken)
      
      console.log('✅ Token refreshed successfully')
      return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token
      }
    } catch (error) {
      console.error('❌ Failed to refresh token:', error)
      return null
    }
  }

  // Verificação automática de autenticação ao inicializar
  useEffect(() => {
    const checkStoredAuth = async () => {
      try {
        const storedData = localStorage.getItem('mymetric-auth-complete')
        
        if (storedData) {
          const parsed: StoredAuthData = JSON.parse(storedData)
          const now = Date.now()
          
          // Verificar se temos tokens válidos
          if (parsed.accessToken && parsed.refreshToken) {
            let currentAccessToken = parsed.accessToken
            let currentRefreshToken = parsed.refreshToken
            
            // Se o access token expirou, tentar renovar
            if (parsed.expiresAt <= now) {
              console.log('⚠️ Access token expired, attempting refresh...')
              
              // Verificar se o refresh token ainda é válido
              if (parsed.refreshExpiresAt > now) {
                const refreshResult = await refreshAccessToken(parsed.refreshToken)
                
                if (refreshResult) {
                  currentAccessToken = refreshResult.accessToken
                  currentRefreshToken = refreshResult.refreshToken
                  
                  // Decodificar novos tokens para obter expiração real
                  const newAccessTokenPayload = decodeJWT(refreshResult.accessToken)
                  const newRefreshTokenPayload = decodeJWT(refreshResult.refreshToken)
                  
                  // Usar expiração real dos novos tokens
                  const newExpiresAt = newAccessTokenPayload?.exp 
                    ? newAccessTokenPayload.exp * 1000
                    : now + (24 * 60 * 60 * 1000) // Fallback: 24 horas
                  
                  const newRefreshExpiresAt = newRefreshTokenPayload?.exp 
                    ? newRefreshTokenPayload.exp * 1000
                    : now + (7 * 24 * 60 * 60 * 1000) // Fallback: 7 dias
                  
                  const updatedStoredData: StoredAuthData = {
                    ...parsed,
                    accessToken: currentAccessToken,
                    refreshToken: currentRefreshToken,
                    expiresAt: newExpiresAt,
                    refreshExpiresAt: newRefreshExpiresAt
                  }
                  
                  localStorage.setItem('mymetric-auth-complete', JSON.stringify(updatedStoredData))
                  localStorage.setItem('auth-token', currentAccessToken)
                  
                  console.log('✅ Tokens refreshed and stored')
                } else {
                  console.log('❌ Failed to refresh token, clearing auth')
                  clearStoredAuth()
                  return
                }
              } else {
                console.log('❌ Refresh token expired, clearing auth')
                clearStoredAuth()
                return
              }
            }
            
            // Usar dados armazenados em vez de validar com API para melhor performance
            if (parsed.authData && parsed.authData.isAuthenticated) {
              setAuthData(parsed.authData)
              console.log('✅ Auth restored from storage (cached)')
            } else {
              // Fallback: validar token com a API apenas se necessário
              try {
                const profile = await api.getProfile(currentAccessToken)
                
                const validAuthData: AuthData = {
                  isAuthenticated: true,
                  user: {
                    email: profile.email,
                    admin: profile.admin,
                    access_control: profile.access_control,
                    tablename: profile.tablename,
                    username: profile.email || parsed.authData.user?.username || '',
                    lastLogin: parsed.authData.user?.lastLogin || new Date().toISOString()
                  }
                }
                
                setAuthData(validAuthData)
                
                // Atualizar dados armazenados
                const updatedStoredData: StoredAuthData = {
                  authData: validAuthData,
                  accessToken: currentAccessToken,
                  refreshToken: currentRefreshToken,
                  rememberMe: parsed.rememberMe,
                  expiresAt: parsed.expiresAt,
                  refreshExpiresAt: parsed.refreshExpiresAt
                }
                
                localStorage.setItem('mymetric-auth-complete', JSON.stringify(updatedStoredData))
                localStorage.setItem('mymetric-auth', JSON.stringify(validAuthData))
                
                console.log('✅ Auth restored from storage successfully')
              } catch (error) {
                console.error('❌ Token validation failed:', error)
                // Token inválido, limpar storage
                clearStoredAuth()
              }
            }
          } else {
            console.log('❌ No valid tokens found')
            clearStoredAuth()
          }
        }
      } catch (error) {
        console.error('❌ Error checking stored auth:', error)
        clearStoredAuth()
      } finally {
        setIsLoading(false)
        setIsInitialized(true)
      }
    }

    checkStoredAuth()
  }, [])

  const clearStoredAuth = () => {
    localStorage.removeItem('mymetric-auth-complete')
    localStorage.removeItem('auth-token')
    localStorage.removeItem('mymetric-auth')
    localStorage.removeItem('login-response')
    setAuthData({ isAuthenticated: false })
  }

  const login = async (username: string, rememberMe: boolean = false) => {
    setIsLoading(true)
    
    try {
      // O LoginScreen já fez o login na API, então vamos buscar o token e dados do localStorage
      const token = localStorage.getItem('auth-token')
      const loginResponseStr = localStorage.getItem('login-response')
      
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }
      
      if (!loginResponseStr) {
        throw new Error('Dados de login não encontrados')
      }
      
      // Usar os dados da resposta de login em vez de fazer chamada adicional
      const loginResponse = JSON.parse(loginResponseStr)
      
      // Criar dados de autenticação baseados na resposta de login
      const newAuthData: AuthData = {
        isAuthenticated: true,
        user: {
          email: username,
          admin: loginResponse.admin || false,
          access_control: loginResponse.access_control || '[]',
          tablename: loginResponse.table_name || 'all',
          username,
          lastLogin: new Date().toISOString()
        }
      }
      
      setAuthData(newAuthData)
      
      // Decodificar tokens para obter expiração real
      const accessTokenPayload = decodeJWT(loginResponse.access_token)
      const refreshTokenPayload = decodeJWT(loginResponse.refresh_token)
      
      // Usar expiração real dos tokens ou fallback para valores padrão
      const now = Date.now()
      const expiresAt = accessTokenPayload?.exp 
        ? accessTokenPayload.exp * 1000 // Converter de segundos para milissegundos
        : now + (24 * 60 * 60 * 1000) // Fallback: 24 horas
      
      const refreshExpiresAt = refreshTokenPayload?.exp 
        ? refreshTokenPayload.exp * 1000 // Converter de segundos para milissegundos
        : now + (7 * 24 * 60 * 60 * 1000) // Fallback: 7 dias
      
      console.log('🕐 Token expirations:', {
        accessToken: new Date(expiresAt).toLocaleString(),
        refreshToken: new Date(refreshExpiresAt).toLocaleString(),
        accessTokenPayload: accessTokenPayload,
        refreshTokenPayload: refreshTokenPayload
      })
      
      // Salvar dados completos de autenticação com refresh token
      const completeAuthData: StoredAuthData = {
        authData: newAuthData,
        accessToken: loginResponse.access_token,
        refreshToken: loginResponse.refresh_token,
        rememberMe,
        expiresAt,
        refreshExpiresAt
      }
      
      localStorage.setItem('mymetric-auth-complete', JSON.stringify(completeAuthData))
      localStorage.setItem('mymetric-auth', JSON.stringify(newAuthData))
      
      console.log('✅ Login successful, auth data saved:', newAuthData)
      console.log('📦 Login response data used:', loginResponse)
      console.log('🔄 Refresh token stored for automatic renewal')
    } catch (error) {
      console.error('❌ Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    const newAuthData: AuthData = { isAuthenticated: false }
    setAuthData(newAuthData)
    clearStoredAuth()
    console.log('🚪 Logout successful, storage cleared')
  }

  // Verificar se o token está próximo de expirar e renovar automaticamente
  const checkTokenExpiry = async () => {
    const storedData = localStorage.getItem('mymetric-auth-complete')
    if (storedData) {
      try {
        const parsed: StoredAuthData = JSON.parse(storedData)
        const now = Date.now()
        const timeUntilExpiry = parsed.expiresAt - now
        
        // Se faltar menos de 1 hora para expirar, tentar renovar automaticamente
        if (timeUntilExpiry < 60 * 60 * 1000 && timeUntilExpiry > 0) {
          console.log('⚠️ Token expiring soon, attempting automatic renewal...')
          
          // Verificar se o refresh token ainda é válido
          if (parsed.refreshExpiresAt > now) {
            const refreshResult = await refreshAccessToken(parsed.refreshToken)
            
            if (refreshResult) {
              // Decodificar novos tokens para obter expiração real
              const newAccessTokenPayload = decodeJWT(refreshResult.accessToken)
              const newRefreshTokenPayload = decodeJWT(refreshResult.refreshToken)
              
              // Usar expiração real dos novos tokens
              const newExpiresAt = newAccessTokenPayload?.exp 
                ? newAccessTokenPayload.exp * 1000
                : now + (24 * 60 * 60 * 1000) // Fallback: 24 horas
              
              const newRefreshExpiresAt = newRefreshTokenPayload?.exp 
                ? newRefreshTokenPayload.exp * 1000
                : now + (7 * 24 * 60 * 60 * 1000) // Fallback: 7 dias
              
              const updatedStoredData: StoredAuthData = {
                ...parsed,
                accessToken: refreshResult.accessToken,
                refreshToken: refreshResult.refreshToken,
                expiresAt: newExpiresAt,
                refreshExpiresAt: newRefreshExpiresAt
              }
              
              localStorage.setItem('mymetric-auth-complete', JSON.stringify(updatedStoredData))
              localStorage.setItem('auth-token', refreshResult.accessToken)
              
              console.log('✅ Token renewed automatically')
              return { shouldRenew: false, timeUntilExpiry: newExpiresAt - now, isExpired: false, renewed: true }
            }
          }
          
          return { shouldRenew: true, timeUntilExpiry, isExpired: false, renewed: false }
        }
        
        // Se já expirou
        if (timeUntilExpiry <= 0) {
          return { shouldRenew: false, timeUntilExpiry: 0, isExpired: true, renewed: false }
        }
      } catch (error) {
        console.error('Error checking token expiry:', error)
      }
    }
    return { shouldRenew: false, timeUntilExpiry: 0, isExpired: false, renewed: false }
  }

  const isAuthenticated = authData.isAuthenticated
  const user = authData.user

  // Hook para verificar periodicamente a expiração do token
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(async () => {
      await checkTokenExpiry()
    }, 30 * 60 * 1000) // Verificar a cada 30 minutos

    return () => clearInterval(interval)
  }, [isAuthenticated])

  return {
    isAuthenticated,
    user,
    isLoading,
    isInitialized,
    login,
    logout,
    checkTokenExpiry
  }
} 