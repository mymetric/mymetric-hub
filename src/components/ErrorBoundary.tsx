import React from 'react'

type ErrorBoundaryProps = {
  children: React.ReactNode
  title?: string
}

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Intencionalmente vazio: build drop_console remove logs em prod,
    // e este boundary existe para mostrar o erro na UI.
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const title = this.props.title ?? 'Ocorreu um erro ao renderizar o dashboard'
    const message = this.state.error?.message ?? 'Erro desconhecido'

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-slate-300">
            {message}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
            >
              Recarregar
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Dica: abra o DevTools e veja “Console” para o stack trace do erro.
          </p>
        </div>
      </div>
    )
  }
}

