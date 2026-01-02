import { useEffect, useCallback } from 'react'

interface TokenExpiryInfo {
  shouldRenew: boolean
  timeUntilExpiry: number
  isExpired: boolean
  renewed?: boolean
}

export const useTokenExpiry = (checkTokenExpiry: () => Promise<TokenExpiryInfo> | TokenExpiryInfo) => {
  const formatTime = useCallback((milliseconds: number): string => {
    if (milliseconds <= 0) return 'Expirado'
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60))
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }, [])

  const showExpiryNotification = useCallback((info: TokenExpiryInfo) => {
    if (info.shouldRenew && !info.isExpired) {
      const timeLeft = formatTime(info.timeUntilExpiry)
      
      // Mostrar notificação no navegador se suportado
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('MyMetricHUB - Sessão Expirando', {
          body: `Sua sessão expira em ${timeLeft}. Faça login novamente para continuar.`,
          icon: '/favicon.ico',
          tag: 'token-expiry'
        })
      }
      
      // Mostrar alerta visual na página
      const existingAlert = document.getElementById('token-expiry-alert')
      if (!existingAlert) {
        const alert = document.createElement('div')
        alert.id = 'token-expiry-alert'
        alert.className = 'fixed top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg z-50 max-w-sm'
        alert.innerHTML = `
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <svg class="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-medium text-yellow-800">Sessão Expirando</h3>
              <p class="mt-1 text-sm text-yellow-700">Sua sessão expira em ${timeLeft}. Faça login novamente para continuar.</p>
              <div class="mt-3 flex gap-2">
                <button onclick="window.location.reload()" class="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition-colors">
                  Renovar Agora
                </button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-xs text-yellow-600 hover:text-yellow-800 transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        `
        document.body.appendChild(alert)
        
        // Auto-remover após 30 segundos
        setTimeout(() => {
          if (alert.parentElement) {
            alert.remove()
          }
        }, 30000)
      }
    }
  }, [formatTime])

  useEffect(() => {
    // Verificar expiração a cada 5 minutos
    const interval = setInterval(async () => {
      const info = await Promise.resolve(checkTokenExpiry())
      showExpiryNotification(info)
    }, 5 * 60 * 1000)

    // Verificação inicial
    const checkInitial = async () => {
      const info = await Promise.resolve(checkTokenExpiry())
      showExpiryNotification(info)
    }
    checkInitial()

    return () => clearInterval(interval)
  }, [checkTokenExpiry, showExpiryNotification])

  // Solicitar permissão para notificações
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return { formatTime }
}
