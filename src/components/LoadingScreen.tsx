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
    "O dado não erra. Ele só reflete o que você não quis ver.",
    "Insight sem execução é só ego bem alimentado.",
    "Métrica bonita sem lucro é arte abstrata.",
    "Quem entende a jornada, não precisa de remarketing.",
    "Atribuição não é sobre o último clique — é sobre o primeiro impacto.",
    "O cliente não some. Ele apenas encontrou alguém que o entendeu melhor.",
    "O funil não acabou. Ele só ficou invisível.",
    "Você não escala tráfego. Você escala verdade.",
    "Dados contam histórias. Performance reescreve finais.",
    "A diferença entre um analista e um estrategista? Contexto.",
    "Se tudo parece performar, alguém não está medindo direito.",
    "O pixel rastreia. Mas o propósito converte.",
    "O GA4 não é confuso. Você que ainda pensa com mentalidade de UA.",
    "Quem controla o dado controla o discurso.",
    "O dado mostra o que aconteceu. Mas o setup mostra quem você é.",
    "Branding é o funil que não tem CTA.",
    "Growth é o encontro entre dado e desejo.",
    "O criativo certo não escala. Ele transborda.",
    "A marca que entende o algoritmo ganha o jogo. A que entende o ser humano muda as regras.",
    "Enquanto uns tentam vender, outros criam contexto.",
    "Performance é só a superfície. Profundidade é o que fideliza.",
    "Nem toda campanha é pra vender. Algumas são pra fazer o cliente pensar.",
    "O público não é um número. É uma conversa estatisticamente previsível.",
    "Os dados são frios. O que você faz com eles define a temperatura da marca.",
    "O que o algoritmo entende como relevância é o reflexo da sua consistência.",
    "Venda é neurociência com planilhas.",
    "Toda compra começa muito antes do carrinho.",
    "A emoção decide, o dado justifica.",
    "A melhor landing page é a mente do cliente.",
    "Conversão é só o ponto final de uma história bem contada.",
    "O checkout é o espelho do quanto você entendeu o comportamento humano.",
    "Ninguém quer comprar. As pessoas querem se reconhecer em algo.",
    "O vendedor do futuro é o algoritmo com empatia.",
    "Se o cliente precisou pensar demais, você já perdeu a venda.",
    "O gatilho mais forte é o da coerência.",
    "Dado é só verdade sem legenda.",
    "O banco de dados é o inconsciente do negócio.",
    "Quem entende o ruído, entende o mercado.",
    "A base não mente — mas quem a alimenta mente pra si mesmo.",
    "Cada tabela conta uma história que o marketing tenta simplificar demais.",
    "Os melhores dashboards são os que incomodam.",
    "O insight chega quando o ego sai.",
    "KPI não é objetivo. É sintoma.",
    "Você não analisa dados. Você decodifica comportamentos.",
    "Todo erro de medição nasce de uma pergunta mal feita."
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