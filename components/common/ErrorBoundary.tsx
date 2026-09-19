import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: any;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = {
        hasError: false,
        error: null
    };

    public readonly props: Readonly<ErrorBoundaryProps>;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.props = props;
    }

    static getDerivedStateFromError(error: any): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="d-flex align-items-center justify-content-center vh-100 bg-dark" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999}}>
                    <div className="container text-center">
                        <div className="card border-danger bg-black text-white p-4 shadow-lg mx-auto" style={{maxWidth: '600px'}}>
                            <div className="card-body">
                                <i className="bi bi-exclamation-octagon-fill text-danger mb-3" style={{fontSize: '3rem'}}></i>
                                <h4 className="fw-bold text-danger mb-3">System Protocol Failure</h4>
                                <p className="text-white-50 mb-4">
                                    A critical rendering error occurred. The application state has been preserved safely in the database.
                                </p>
                                <div className="bg-dark border border-secondary border-opacity-25 rounded p-3 text-start mb-4 font-monospace small text-danger overflow-auto" style={{maxHeight: '150px'}}>
                                    {this.state.error?.message || "Unknown Error"}
                                </div>
                                <button className="btn btn-primary px-4" onClick={() => window.location.reload()}>
                                    <i className="bi bi-arrow-clockwise me-2"></i> Reboot Hypatia
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
