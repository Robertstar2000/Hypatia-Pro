import React, { useState, useCallback, useContext } from 'react';
import { ToastContextType } from './config';

export const ToastContext = React.createContext<ToastContextType | null>(null);

interface ToastProviderProps {
    children: React.ReactNode;
}

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'danger' | 'warning' | 'info';
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{zIndex: 1100}}>
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast show align-items-center bg-${toast.type} text-white border-0 mb-2 shadow-sm`} role="alert" aria-live="assertive" aria-atomic="true">
                        <div className="d-flex">
                            <div className="toast-body">{toast.message}</div>
                            <button
                                type="button"
                                className="btn-close btn-close-white me-2 m-auto"
                                aria-label="Close notification"
                                onClick={() => removeToast(toast.id)}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};