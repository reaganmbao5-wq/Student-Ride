import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

const SWUpdateManager = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState(null);

    useEffect(() => {
        const handleUpdateFound = (event) => {
            const registration = event.detail;
            setWaitingWorker(registration.waiting);
            setShowUpdate(true);
        };

        window.addEventListener('pwa-update-available', handleUpdateFound);

        return () => {
            window.removeEventListener('pwa-update-available', handleUpdateFound);
        };
    }, []);

    const handleUpdate = () => {
        if (waitingWorker) {
            // Command the waiting worker to activate
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            setShowUpdate(false);
        }
    };

    const handleDismiss = () => {
        setShowUpdate(false);
    };

    if (!showUpdate) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-[9999] animate-in slide-in-from-top-5 fade-in duration-300">
            <div className="bg-[#1A1A1A] border border-blue-500/30 rounded-2xl shadow-2xl p-4 flex items-start sm:items-center justify-between gap-4 max-w-md mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin-slow" />
                    </div>
                    <div>
                        <h4 className="text-white font-medium text-sm">Update Available</h4>
                        <p className="text-white/60 text-xs mt-0.5">
                            A new version of Jaey Ride is ready. Reload to update.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleUpdate}
                        className="bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        Update
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-white/40 hover:text-white transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SWUpdateManager;
