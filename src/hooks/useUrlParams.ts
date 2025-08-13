import { useCallback } from 'react'

interface UrlParams {
  table?: string
  startDate?: string
  endDate?: string
  tab?: string
  cluster?: string
  detailedFilter?: string
  detailedFilterType?: string
}

export const useUrlParams = () => {
  // Função para obter parâmetros da URL
  const getUrlParams = useCallback((): UrlParams => {
    const urlParams = new URLSearchParams(window.location.search)
    return {
      table: urlParams.get('table') || undefined,
      startDate: urlParams.get('startDate') || undefined,
      endDate: urlParams.get('endDate') || undefined,
      tab: urlParams.get('tab') || undefined,
      cluster: urlParams.get('cluster') || undefined,
      detailedFilter: urlParams.get('detailedFilter') || undefined,
      detailedFilterType: urlParams.get('detailedFilterType') || undefined
    }
  }, [])

  // Função para atualizar parâmetros da URL
  const updateUrlParams = useCallback((params: Partial<UrlParams>) => {
    const url = new URL(window.location.href)
    const searchParams = url.searchParams

    // Atualizar apenas os parâmetros fornecidos
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value)
      } else {
        searchParams.delete(key)
      }
    })

    // Atualizar a URL sem recarregar a página
    window.history.replaceState({}, '', url.toString())
  }, [])

  // Função para limpar todos os parâmetros
  const clearUrlParams = useCallback(() => {
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Função para obter URL compartilhável
  const getShareableUrl = useCallback(() => {
    return window.location.href
  }, [])

  // Função para copiar URL para clipboard
  const copyShareableUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      return true
    } catch (error) {
      console.error('Erro ao copiar URL:', error)
      return false
    }
  }, [])

  return {
    getUrlParams,
    updateUrlParams,
    clearUrlParams,
    getShareableUrl,
    copyShareableUrl
  }
} 