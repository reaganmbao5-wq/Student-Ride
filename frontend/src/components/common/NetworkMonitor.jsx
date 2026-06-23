import React, { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';

const NetworkMonitor = () => {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        let listener;

        const setupNetworkMonitoring = async () => {
            const status = await Network.getStatus();
            setIsOffline(!status.connected);

            listener = await Network.addListener('networkStatusChange', (status) => {
                setIsOffline(!status.connected);
                if (status.connected) {
                    toast.success('Back online!', { duration: 2000 });
                } else {
                    toast.error('You are offline. Please check your connection.', { duration: 4000 });
                }
            });
        };

        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => {
            setIsOffline(false);
            toast.success('Back online!', { duration: 2000 });
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        setupNetworkMonitoring();

        return () => {
            if (listener) {
                listener.remove();
            }
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-red-600 text-white p-3 flex items-center justify-center gap-2 shadow-[0_-5px_20px_rgba(220,38,38,0.3)] safe-area-bottom">
            <WifiOff className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">No Internet Connection</span>
        </div>
    );
};

export default NetworkMonitor;
