import { useState } from 'react'
import { ChevronDown, Building2 } from 'lucide-react'

interface ClientSelectorProps {
  onClientChange: (client: string) => void
  currentClient: string
}

const clients = [
  { id: 'coffeemais', name: 'CoffeeMais', description: 'Café e bebidas' },
  { id: 'constance', name: 'Constance', description: 'Construção civil' }
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
          <div className="text-xs text-gray-500">{selectedClient.description}</div>
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
                <div className="text-sm text-gray-500">{client.description}</div>
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