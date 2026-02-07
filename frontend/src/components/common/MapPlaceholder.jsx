import React from 'react';
import { Map, MapPin } from 'lucide-react';
import { GlassCard } from '../components/common/GlassComponents';

const MapPlaceholder = ({ pickup, dropoff }) => {
    return (
        <div className="relative w-full h-[300px] md:h-full bg-white/5 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                }}
            />

            <div className="text-center p-6 z-10 max-w-sm">
                <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Map className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-white font-bold mb-2">Map Integration Pending</h3>
                <p className="text-white/60 text-sm mb-4">
                    Google Maps integration will appear here. This placeholder simulates the map view for:
                </p>

                {(pickup || dropoff) && (
                    <div className="space-y-2 text-left bg-black/40 p-3 rounded-xl">
                        {pickup && (
                            <div className="flex items-center gap-2 text-sm text-white/80">
                                <MapPin className="w-4 h-4 text-green-400" />
                                <span className="truncate">{pickup.name || 'Pickup Location'}</span>
                            </div>
                        )}
                        {dropoff && (
                            <div className="flex items-center gap-2 text-sm text-white/80">
                                <MapPin className="w-4 h-4 text-red-400" />
                                <span className="truncate">{dropoff.name || 'Dropoff Location'}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Future Integration Comments
            TODO: Google Maps Integration
            1. Install @react-google-maps/api
            2. Get API Key with Maps JS, Places, and Directions APIs enabled
            3. Replace this component with GoogleMap
            4. Use DirectionsService for routing
            5. Use DistanceMatrixService for price validation
        */}
        </div>
    );
};

export default MapPlaceholder;
