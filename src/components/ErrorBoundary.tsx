import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Contiene cualquier fallo de render para que la app no quede en blanco.
 * Muestra un aviso legible con la opción de recargar la vista.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('MemoryWalk: fallo de render', error, info.componentStack)
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__card">
          <p className="kicker">Algo se ha roto</p>
          <h1 className="font-display text-3xl text-ink">La vista no se pudo mostrar</h1>
          <p className="mt-3 text-ink-soft">
            Ha ocurrido un error inesperado al pintar la pantalla. Tus datos siguen guardados en este
            navegador; solo se ha caído la vista.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            <code>{this.state.error.message}</code>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-solid" onClick={this.handleReset}>
              Reintentar
            </button>
            <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={() => window.location.reload()}>
              Recargar la página
            </button>
          </div>
        </div>
      </div>
    )
  }
}
