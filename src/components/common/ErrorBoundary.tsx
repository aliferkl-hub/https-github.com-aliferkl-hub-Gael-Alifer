import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-[#07090e]">
          <div className="max-w-lg w-full bg-[#0b1120] border border-red-500/30 rounded-2xl p-6 shadow-2xl text-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {this.props.fallbackTitle || 'Ocorreu uma instabilidade na interface'}
                </h3>
                <p className="text-xs text-slate-400">
                  A aplicação protegeu seus dados e evitou travamento global.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-mono text-red-300 mb-5 break-words max-h-40 overflow-y-auto">
              {this.state.error?.message || 'Erro inesperado na renderização.'}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Tentar Novamente
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
