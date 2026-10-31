import React from 'react';
import { TriangleAlert, RotateCcw, Home } from 'lucide-react';

/**
 * Error boundary global: captura fallos de renderizado en React y muestra
 * una pantalla recuperable en lugar de una UI muerta. Los errores se loguean
 * (y llegan a Sentry si está configurado via su propio ErrorBoundary interno).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[var(--color-arcade-navy-dark)] text-white font-sans p-4">
        <div className="max-w-md w-full p-8 rounded-arcade-lg bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] text-center shadow-modal-lg">
          <div className="w-16 h-16 rounded-arcade-lg bg-rose-500/20 border-2 border-rose-500/50 flex items-center justify-center mx-auto mb-4">
            <TriangleAlert className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-wide mb-2">
            Algo salió mal
          </h1>
          <p className="text-sm text-slate-300 mb-1">
            Ocurrió un error inesperado en la interfaz. Tu progreso guardado en
            el servidor está a salvo.
          </p>
          <p className="text-[11px] text-slate-500 font-mono mb-6 truncate">
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="flex-1 py-3 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-b-arcade border-[var(--color-arcade-orange-shadow)] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reintentar
            </button>
            <button
              onClick={this.handleHome}
              className="flex-1 py-3 rounded-arcade bg-[var(--color-arcade-navy-dark)] hover:bg-[var(--color-arcade-navy-hover)] border-3 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-slate-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
