import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportClientError } from '../services/observability';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    reportId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            reportId: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const reportId = `ui-${Date.now().toString(36)}`;
        this.setState({ errorInfo, reportId });
        reportClientError(error, {
            reportId,
            componentStack: errorInfo.componentStack?.slice(0, 1500),
        });
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null, reportId: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-brand-950 flex items-center justify-center p-6">
                    <div className="max-w-md w-full glass rounded-3xl p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>

                        <h2 className="text-xl font-bold text-white mb-2">
                            Something went wrong
                        </h2>

                        <p className="text-brand-400 text-sm mb-2">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </p>

                        {this.state.reportId && (
                            <p className="text-brand-500 text-xs mb-6">
                                Reference: {this.state.reportId}
                            </p>
                        )}

                        {!this.state.reportId && <div className="mb-6" />}

                        <button
                            onClick={this.handleRetry}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-100 text-brand-950 rounded-xl font-semibold hover:bg-white transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                        </button>

                        {import.meta.env.DEV && this.state.errorInfo && (
                            <details className="mt-6 text-left">
                                <summary className="text-xs text-brand-500 cursor-pointer">
                                    Error Details
                                </summary>
                                <pre className="mt-2 p-3 bg-brand-900 rounded-lg text-xs text-red-300 overflow-auto max-h-40">
                                    {this.state.error?.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
