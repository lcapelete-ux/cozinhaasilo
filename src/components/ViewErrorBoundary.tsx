import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  error: Error | null
}

export default class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('View error:', error, info)
  }

  reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="bg-white rounded-3xl shadow-sm p-8 max-w-md w-full">
            <AlertTriangle size={40} className="text-orange-400 mx-auto mb-4" />
            <h2 className="font-serif italic text-xl text-accent-dark mb-2">Ops, algo deu errado</h2>
            <p className="text-sm text-gray-500 mb-1">Erro nesta tela:</p>
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mb-5 font-mono text-left break-all">
              {this.state.error.message}
            </p>
            <button
              onClick={this.reset}
              className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-5 py-2.5 rounded-2xl text-sm font-medium transition-colors mx-auto"
            >
              <RotateCcw size={15} />
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
