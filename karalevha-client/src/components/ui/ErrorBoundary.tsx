import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Beklenmeyen istemci ya da parça yükleme hatalarında beyaz ekran yerine kurtarma ekranı gösterir. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary:', error, info);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="kart max-w-md w-full p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-uyari mx-auto mb-3" aria-hidden="true" />
          <h1 className="font-display font-bold text-lg text-tebesir">Sayfa yüklenirken bir sorun oluştu</h1>
          <p className="mt-2 text-sm text-tebesir-soluk">
            Bağlantı kesilmiş ya da yeni bir sürüm yayınlanmış olabilir. Sayfayı yenileyip tekrar dene.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-ana"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Sayfayı yenile
            </button>
          </div>
        </div>
      </div>
    );
  }
}
