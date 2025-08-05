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
  const [isLoading, setIsLoading] = useState(false)

  // Removida a verificação automática de token no useEffect
  // Agora o token só será validado quando necessário

  const login = async (username: string) => {
    const token = localStorage.getItem('auth-token')
    
    if (token) {
      try {
        // Buscar dados do perfil da API
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