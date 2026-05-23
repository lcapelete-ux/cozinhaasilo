import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class GlobalErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean; error: string }> {
  state = { crashed: false, error: '' }
  static getDerivedStateFromError(e: Error) { return { crashed: true, error: e.message } }
  componentDidCatch(e: Error, info: unknown) { console.error('Global crash:', e, info) }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F0', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 32, maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌽</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#3A3A28', marginBottom: 8 }}>Ops, algo deu errado</h2>
            <p style={{ fontSize: 12, color: '#e44', background: '#fff0f0', borderRadius: 12, padding: '8px 12px', fontFamily: 'monospace', marginBottom: 20, wordBreak: 'break-all' }}>
              {this.state.error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#5A5A40', color: '#fff', border: 'none', borderRadius: 16, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
