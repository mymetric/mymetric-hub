import { useState } from 'react'

interface DebugMetricsProps {
  metrics: any[]
  selectedTable: string
  isLoading: boolean
  isTableLoading: boolean
}

const DebugMetrics = ({ metrics, selectedTable, isLoading, isTableLoading }: DebugMetricsProps) => {
  const [isVisible, setIsVisible] = useState(false)

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium"
      >
        🐛 Debug
      </button>

      {isVisible && (
        <div className="absolute bottom-12 left-0 bg-black/90 text-white p-4 rounded-lg text-xs max-w-md">
          <h3 className="font-bold mb-2">Debug Metrics</h3>
          <div className="space-y-1">
            <div><strong>Selected Table:</strong> {selectedTable}</div>
            <div><strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}</div>
            <div><strong>Is Table Loading:</strong> {isTableLoading ? 'Yes' : 'No'}</div>
            <div><strong>Metrics Count:</strong> {metrics.length}</div>
            <div><strong>Metrics Type:</strong> {Array.isArray(metrics) ? 'Array' : typeof metrics}</div>
            {metrics.length > 0 && (
              <div>
                <strong>First Item:</strong>
                <pre className="text-xs mt-1 bg-gray-800 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(metrics[0], null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DebugMetrics 