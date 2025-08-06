import { useState, useEffect } from 'react'

interface UseClientListReturn {
  clients: string[]
  isLoading: boolean
  error: string | null
}

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQNqKWaGX0EUBtFGSaMnHoHJSoLKFqjPrjydOtcSexU3xVGyoEnhgKQh8A6-6_hOOQ0CfmV-IfoC8d/pub?gid=771281747&single=true&output=csv'

export const useClientList = (): UseClientListReturn => {
  const [clients, setClients] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('🔄 Fetching client list from CSV...')
        const response = await fetch(CSV_URL)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const csvText = await response.text()
        console.log('✅ CSV received:', csvText.substring(0, 200) + '...')
        
        // Parse CSV
        const lines = csvText.split('\n')
        const clientList: string[] = []
        
        // Skip header line and process each line
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line && line !== 'slug') {
            // Extract slug from CSV line (assuming it's the first column)
            const slug = line.split(',')[0]?.trim()
            if (slug) {
              clientList.push(slug)
            }
          }
        }
        
        console.log('📋 Parsed clients:', clientList)
        setClients(clientList)
        
      } catch (err) {
        console.error('❌ Error fetching client list:', err)
        setError(err instanceof Error ? err.message : 'Erro ao buscar lista de clientes')
        
        // Fallback para lista padrão em caso de erro
        const fallbackClients = [
          '3dfila', 'gringa', 'orthocrin', 'meurodape', 'coffeemais',
          'universomaschio', 'oculosshop', 'evoke', 'hotbuttered', 'use',
          'wtennis', 'constance', 'jcdecor', 'parededepapel', 'bemcolar',
          'poesiamuda', 'caramujo', 'europa', 'leveros', 'abcdaconstrucao',
          'kaisan', 'endogen', 'bocarosa', 'mymetric', 'buildgrowth',
          'alvisi', 'coroasparavelorio', 'coroinhasportoalegre', 'coroinhasbrasilia',
          'coroinhascampinas', 'coroinhascuritiba', 'coroinhasbelohorizonte',
          'coroinhasgoiania', 'coroinhasrecife', 'coroinhasriodejaneiro',
          'coroinhassaopaulo', 'lacoscorporativos', 'exitlag', 'havaianas',
          'linus', 'iwannasleep', 'asos', 'safeweb', 'queimadiaria', 'augym', 'waz'
        ]
        setClients(fallbackClients)
      } finally {
        setIsLoading(false)
      }
    }

    fetchClients()
  }, [])

  return { clients, isLoading, error }
} 