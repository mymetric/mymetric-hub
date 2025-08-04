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

export const useAuthSimple = () => {
  const [authData, setAuthData] = useState<AuthData>(() => {
    // Verifica se há token de autenticação no localStorage
    const token = localStorage.getItem('auth-token')
    const storedAuth = localStorage.getItem('mymetric-auth')
    
    console.log('🔍 SIMPLE AUTH - Initial state check:', { 
      token: !!token, 
      storedAuth: !!storedAuth 
    })
    
    if (token && storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        console.log('✅ SIMPLE AUTH - Restored auth data:', parsedAuth)
        return parsedAuth
      } catch (error) {
        console.error('❌ SIMPLE AUTH - Error parsing stored auth data:', error)
        return { isAuthenticated: false }
      }
    }
    
    console.log('❌ SIMPLE AUTH - No stored auth data found')
    return { isAuthenticated: false }
  })
  const [isLoading, setIsLoading] = useState(false)

  const login = async (username: string) => {
    console.log('🚀 SIMPLE AUTH - Login called with username:', username)
    const token = localStorage.getItem('auth-token')
    
    if (token) {
      try {
        // Buscar dados do perfil da API
        console.log('📡 SIMPLE AUTH - Fetching profile from API...')
        const profile = await api.getProfile(token)
        
        const newAuthData: AuthData = {
          isAuthenticated: true,
          user: {
            email: profile.email,
            admin: profile.admin,
            access_control: profile.access_control,
            tablename: profile.tablename,
            username,
            lastLogin: new Date().toISOString()
          }
        }
        
        console.log('💾 SIMPLE AUTH - Setting auth data:', newAuthData)
        setAuthData(newAuthData)
        localStorage.setItem('mymetric-auth', JSON.stringify(newAuthData))
        console.log('✅ SIMPLE AUTH - Data saved to localStorage')
      } catch (error) {
        console.error('❌ SIMPLE AUTH - Error fetching profile:', error)
        // Fallback para dados básicos se não conseguir buscar o perfil
        const newAuthData: AuthData = {
          isAuthenticated: true,
          user: {
            email: username,
            admin: false,
            access_control: 'read',
            tablename: 'user_metrics',
            username,
            lastLogin: new Date().toISOString()
          }
        }
        
        console.log('💾 SIMPLE AUTH - Using fallback data:', newAuthData)
        setAuthData(newAuthData)
        localStorage.setItem('mymetric-auth', JSON.stringify(newAuthData))
        console.log('✅ SIMPLE AUTH - Fallback data saved to localStorage')
      }
    } else {
      console.error('❌ SIMPLE AUTH - No token found for login')
    }
  }

  const logout = () => {
    console.log('🚪 SIMPLE AUTH - Logout called')
    const newAuthData: AuthData = { isAuthenticated: false }
    setAuthData(newAuthData)
    localStorage.removeItem('auth-token')
    localStorage.removeItem('mymetric-auth')
    console.log('🧹 SIMPLE AUTH - Storage cleared')
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