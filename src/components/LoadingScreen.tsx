import { useState, useEffect } from 'react'
import Logo from './Logo'

interface LoadingScreenProps {
  message?: string
  showAuthStatus?: boolean
}

const LoadingScreen = ({ message = 'Carregando...', showAuthStatus = false }: LoadingScreenProps) => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  
  // Frases motivacionais sobre dados
  const dataQuotes = [
    "Os dados são o novo petróleo do século XXI",
    "Cada métrica conta uma história única",
    "Transformando números em insights valiosos",
    "Dados bem analisados são decisões bem tomadas",
    "A informação é poder, os dados são conhecimento",
    "Descobrindo padrões ocultos nos seus dados",
    "Analytics que impulsionam resultados",
    "Cada clique, cada conversão, cada oportunidade",
    "Dados em tempo real, insights instantâneos",
    "Conectando pontos para revelar o quadro completo",
    "Performance que fala por números",
    "Otimizando seu negócio através de métricas",
    "Dados precisos, estratégias certeiras",
    "Visualizando o futuro através dos números",
    "Inteligência de dados em ação"
  ]

  // Rotacionar frases a cada 3 segundos com animação
  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false)
      setTimeout(() => {
        setCurrentQuoteIndex((prevIndex) => 
          (prevIndex + 1) % dataQuotes.length
        )
        setIsVisible(true)
      }, 300)
    }, 3000)

    return () => clearInterval(interval)
  }, [])
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        {/* Logo animado */}
        <div className="mb-8">
          <Logo size="xl" />
        </div>
        
        {/* Spinner */}
        <div className="mb-6">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div>
        
        {/* Mensagem principal */}
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {message}
        </h2>
        
        {/* Frase motivacional sobre dados */}
        <div className="mb-4 px-4">
          <div className="min-h-[2.5rem] flex items-center justify-center">
            <p className={`text-sm text-gray-600 italic transition-all duration-300 ease-in-out ${
              isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'
            }`}>
              "{dataQuotes[currentQuoteIndex]}"
            </p>
          </div>
        </div>
        
        {/* Status de autenticação */}
        {showAuthStatus && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Verificando autenticação...</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Restaurando sua sessão anterior
            </p>
          </div>
        )}
        
        {/* Indicador de progresso */}
        <div className="mt-6 w-48 bg-gray-200 rounded-full h-1 mx-auto overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
        </div>
        
        {/* Dicas */}
        <div className="mt-8 text-sm text-gray-500 max-w-md mx-auto">
          <p>Se esta tela persistir por muito tempo, tente:</p>
          <ul className="mt-2 space-y-1 text-left">
            <li>• Verificar sua conexão com a internet</li>
            <li>• Recarregar a página (F5)</li>
            <li>• Limpar o cache do navegador</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen 