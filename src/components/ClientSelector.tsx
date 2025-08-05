import { useState } from 'react'
import { ChevronDown, Building2 } from 'lucide-react'

interface ClientSelectorProps {
  onClientChange: (client: string) => void
  currentClient: string
}

const clients = [
  { id: '3dfila', name: '3DFila' },
  { id: 'gringa', name: 'Gringa' },
  { id: 'orthocrin', name: 'Orthocrin' },
  { id: 'meurodape', name: 'Meu Roda Pé' },
  { id: 'coffeemais', name: 'CoffeeMais' },
  { id: 'universomaschio', name: 'Universo Maschio' },
  { id: 'oculosshop', name: 'Óculos Shop' },
  { id: 'evoke', name: 'Evoke' },
  { id: 'hotbuttered', name: 'Hot Buttered' },
  { id: 'use', name: 'Use' },
  { id: 'wtennis', name: 'WTennis' },
  { id: 'constance', name: 'Constance' },
  { id: 'jcdecor', name: 'JC Decor' },
  { id: 'parededepapel', name: 'Parede de Papel' },
  { id: 'bemcolar', name: 'Bem Colar' },
  { id: 'poesiamuda', name: 'Poesia Muda' },
  { id: 'caramujo', name: 'Caramujo' },
  { id: 'europa', name: 'Europa' },
  { id: 'leveros', name: 'Leveros' },
  { id: 'abcdaconstrucao', name: 'ABCDA Construção' },
  { id: 'kaisan', name: 'Kaisan' },
  { id: 'endogen', name: 'Endogen' },
  { id: 'bocarosa', name: 'Bocarosa' },
  { id: 'mymetric', name: 'MyMetric' },
  { id: 'buildgrowth', name: 'Build Growth' },
  { id: 'alvisi', name: 'Alvisi' },
  { id: 'coroasparavelorio', name: 'Coroas Para Velório' },
  { id: 'coroinhasportoalegre', name: 'Coroinhas Porto Alegre' },
  { id: 'coroinhasbrasilia', name: 'Coroinhas Brasília' },
  { id: 'coroinhascampinas', name: 'Coroinhas Campinas' },
  { id: 'coroinhascuritiba', name: 'Coroinhas Curitiba' },
  { id: 'coroinhasbelohorizonte', name: 'Coroinhas Belo Horizonte' },
  { id: 'coroinhasgoiania', name: 'Coroinhas Goiânia' },
  { id: 'coroinhasrecife', name: 'Coroinhas Recife' },
  { id: 'coroinhasriodejaneiro', name: 'Coroinhas Rio de Janeiro' },
  { id: 'coroinhassaopaulo', name: 'Coroinhas São Paulo' },
  { id: 'lacoscorporativos', name: 'Laços Corporativos' },
  { id: 'exitlag', name: 'ExitLag' },
  { id: 'havaianas', name: 'Havaianas' },
  { id: 'linus', name: 'Linus' },
  { id: 'iwannasleep', name: 'I Wanna Sleep' },
  { id: 'asos', name: 'ASOS' },
  { id: 'safeweb', name: 'SafeWeb' },
  { id: 'queimadiaria', name: 'Queima Diária' },
  { id: 'augym', name: 'AuGym' },
  { id: 'waz', name: 'Waz' }
]

const ClientSelector = ({ onClientChange, currentClient }: ClientSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const selectedClient = clients.find(client => client.id === currentClient) || clients[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
      >
        <Building2 className="w-5 h-5 text-gray-500" />
        <div className="text-left">
          <div className="font-medium text-gray-900">{selectedClient.name}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => {
                  onClientChange(client.id)
                  setIsOpen(false)
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 ${
                  currentClient === client.id ? 'bg-primary-50 border-r-2 border-primary-500' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{client.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overlay para fechar o dropdown quando clicar fora */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default ClientSelector 