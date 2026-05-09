import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[FocusFox] ErrorBoundary caught:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="error-boundary">
          <p>Algo salió mal.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
