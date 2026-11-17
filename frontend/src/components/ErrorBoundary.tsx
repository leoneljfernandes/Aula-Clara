import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";

import { reportError } from "@/lib/telemetry";

export interface FallbackProps {
  error: Error;
  reset: () => void;
}

interface ErrorBoundaryProps {
  /** Identifica la zona en telemetría ("checkout", "sidebar"...). */
  scope: string;
  // Componente, no función: con hooks o con React Compiler debe renderizarse como tal.
  fallback: ComponentType<FallbackProps>;
  /** Si alguna cambia (p. ej. el id de la ruta), la boundary se resetea sola. */
  resetKeys?: ReadonlyArray<unknown>;
  onReset?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const changed = (a: ReadonlyArray<unknown> = [], b: ReadonlyArray<unknown> = []): boolean =>
  a.length !== b.length || a.some((item, i) => !Object.is(item, b[i]));

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { scope: this.props.scope, componentStack: info.componentStack ?? undefined });
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
    // Solo se resetea un error que ya estaba en pantalla. Si el error llegó en el mismo commit que
    // el cambio de keys (navegar a una página rota), resetear lo volvería a lanzar y reportar dos veces.
    if (prevState.error && this.state.error && changed(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = (): void => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    const Fallback = this.props.fallback;
    return error ? <Fallback error={error} reset={this.reset} /> : this.props.children;
  }
}

export function DefaultFallback({ error, reset }: FallbackProps): ReactNode {
  return (
    <div role="alert" className="rounded-xl border-2 border-[var(--border)] p-4">
      <p className="font-bold">Algo salió mal en esta sección.</p>
      {import.meta.env.DEV ? <pre className="mt-2 whitespace-pre-wrap text-sm">{error.message}</pre> : null}
      <button type="button" onClick={reset} className="mt-3 min-h-12 rounded-xl border-2 px-4 font-bold">
        Reintentar
      </button>
    </div>
  );
}
