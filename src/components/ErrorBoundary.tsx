import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ocorreu um erro inesperado.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5] p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md border border-[#DADDE1] text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-bold text-[#1C1E21]">
              Não foi possível carregar os dados em tempo real
            </h1>
            <p className="text-sm text-[#65676B] leading-relaxed">
              Verifique sua conexão com a internet e recarregue a página para
              reconectar ao banco de dados.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#166FE5] transition-colors"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Recarregar página</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
