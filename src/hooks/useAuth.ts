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

export const useAuth = () => {
  const [authData, setAuthData] = useState<AuthData>(() => {
    // Verifica se há token de autenticação no localStorage
    const token = localStorage.getItem('auth-token')
    const storedAuth = localStorage.getItem('mymetric-auth')
    
    if (token && storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        return parsedAuth
      } catch (error) {
        console.error('Error parsing stored auth data:', error)
        return { isAuthenticated: false }
      }
    }
    
    return { isAuthenticated: false }
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const validateAuth = async () => {
      const token = localStorage.getItem('auth-token')
      const storedAuth = localStorage.getItem('mymetric-auth')
      
      if (token && storedAuth) {
        try {
          // Temporariamente assumindo que o token é válido
          const isValid = true // await api.validateToken(token)
          
          if (isValid) {
            // Token válido, restaurar dados do usuário
            const parsedAuth = JSON.parse(storedAuth)
            setAuthData(parsedAuth)
          } else {
            // Token inválido, limpar dados
            localStorage.removeItem('auth-token')
            localStorage.removeItem('mymetric-auth')
            setAuthData({ isAuthenticated: false })
          }
        } catch (error) {
          console.error('Token validation error:', error)
          localStorage.removeItem('auth-token')
          localStorage.removeItem('mymetric-auth')
          setAuthData({ isAuthenticated: false })
        }
      } else {
        // Sem token ou dados armazenados, limpar estado
        localStorage.removeItem('auth-token')
        localStorage.removeItem('mymetric-auth')
        setAuthData({ isAuthenticated: false })
      }
      
      setIsLoading(false)
    }

    validateAuth()
  }, [])

  const login = async (username: string) => {
    const token = localStorage.getItem('auth-token')
    
    if (token) {
      try {
        // Temporariamente usando dados mock
        const newAuthData: AuthData = {
          isAuthenticated: true,
          user: {
            email: username,
            admin: false,
            access_control: 'read',
            tablename: 'coffeemais',
            username,
            lastLogin: new Date().toISOString()
          }
        }
        
        setAuthData(newAuthData)
        localStorage.setItem('mymetric-auth', JSON.stringify(newAuthData))
      } catch (error) {
        console.error('Error fetching profile:', error)
        // Fallback para dados básicos se não conseguir buscar o perfil
        const newAuthData: AuthData = {
          isAuthenticated: true,
          user: {
            email: username,
            admin: false,
            access_control: 'read',
            tablename: 'coffeemais',
            username,
            lastLogin: new Date().toISOString()
          }
        }
        
        setAuthData(newAuthData)
        localStorage.setItem('mymetric-auth', JSON.stringify(newAuthData))
      }
    } else {
      console.error('No token found for login')
    }
  }

  const logout = () => {
    const newAuthData: AuthData = { isAuthenticated: false }
    setAuthData(newAuthData)
    localStorage.removeItem('auth-token')
    localStorage.removeItem('mymetric-auth')
  }

  const isAuthenticated = authData.isAuthenticated
  const user = authData.user

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout
  }
} 