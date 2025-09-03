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
  token: string
  rememberMe: boolean
  expiresAt: number
}

export const useAuth = () => {
  const [authData, setAuthData] = useState<AuthData>({ isAuthenticated: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Verificação automática de autenticação ao inicializar
  useEffect(() => {
    const checkStoredAuth = async () => {
      try {
        const storedData = localStorage.getItem('mymetric-auth-complete')
        
        if (storedData) {
          const parsed: StoredAuthData = JSON.parse(storedData)
          const now = Date.now()
          
          // Verificar se o token ainda é válido
          if (parsed.expiresAt > now && parsed.token) {
            try {
              // Validar token com a API
              const profile = await api.getProfile(parsed.token)
              
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
                token: parsed.token,
                rememberMe: parsed.rememberMe,
                expiresAt: parsed.expiresAt
              }
              
              localStorage.setItem('mymetric-auth-complete', JSON.stringify(updatedStoredData))
              localStorage.setItem('auth-token', parsed.token)
              localStorage.setItem('mymetric-auth', JSON.stringify(validAuthData))
              
              console.log('✅ Auth restored from storage successfully')
            } catch (error) {
              console.error('❌ Token validation failed:', error)
              // Token inválido, limpar storage
              clearStoredAuth()
            }
          } else {
            console.log('❌ Stored auth expired')
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
      
      // Calcular expiração do token
      const expiresAt = rememberMe 
        ? Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
        : Date.now() + (24 * 60 * 60 * 1000) // 24 horas
      
      // Salvar dados completos de autenticação
      const completeAuthData: StoredAuthData = {
        authData: newAuthData,
        token,
        rememberMe,
        expiresAt
      }
      
      localStorage.setItem('mymetric-auth-complete', JSON.stringify(completeAuthData))
      localStorage.setItem('mymetric-auth', JSON.stringify(newAuthData))
      
      console.log('✅ Login successful, auth data saved:', newAuthData)
      console.log('📦 Login response data used:', loginResponse)
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

  // Verificar se o token está próximo de expirar
  const checkTokenExpiry = () => {
    const storedData = localStorage.getItem('mymetric-auth-complete')
    if (storedData) {
      try {
        const parsed: StoredAuthData = JSON.parse(storedData)
        const now = Date.now()
        const timeUntilExpiry = parsed.expiresAt - now
        
        // Se faltar menos de 1 hora para expirar, renovar
        if (timeUntilExpiry < 60 * 60 * 1000 && timeUntilExpiry > 0) {
          console.log('⚠️ Token expiring soon, consider renewal')
          return { shouldRenew: true, timeUntilExpiry, isExpired: false }
        }
        
        // Se já expirou
        if (timeUntilExpiry <= 0) {
          return { shouldRenew: false, timeUntilExpiry: 0, isExpired: true }
        }
      } catch (error) {
        console.error('Error checking token expiry:', error)
      }
    }
    return { shouldRenew: false, timeUntilExpiry: 0, isExpired: false }
  }

  const isAuthenticated = authData.isAuthenticated
  const user = authData.user

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