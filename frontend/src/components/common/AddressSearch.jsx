import React, { useState, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

export const AddressSearch = ({ onLocationSelect, placeholder = "Search for a location..." }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (query.length < 3) {
            setResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setLoading(true);
            try {
                // Nominatim API - Free geocoding from OpenStreetMap
                // Bias search to Zambia/Kabwe area
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?` +
                    `q=${encodeURIComponent(query)}&` +
                    `format=json&` +
                    `limit=5&` +
                    `countrycodes=zm&` + // Zambia
                    `viewbox=28.0,14.0,29.0,15.0&` + // Kabwe area bounding box
                    `bounded=0`,
                    {
                        headers: {
                            'User-Agent': 'MulungushiRides/1.0' // Required by Nominatim
                        }
                    }
                );
                const data = await response.json();
                setResults(data);
                setShowResults(true);
            } catch (error) {
                console.error('Geocoding error:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 500); // Debounce 500ms to respect rate limits

        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSelect = (result) => {
        const location = {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            address: result.display_name
        };
        onLocationSelect(location);
        setQuery(result.display_name);
        setShowResults(false);
    };

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 z-10" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    placeholder={placeholder}
                    className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all font-medium"
                />
                {loading && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold animate-spin" />
                )}
            </div>

            {/* Results Dropdown */}
            {showResults && results.length > 0 && (
                <div className="absolute left-0 right-0 z-[100] mt-2 rounded-xl overflow-hidden border border-white/10 bg-[#1A1A1A] shadow-2xl max-h-68 overflow-y-auto">
                    {results.map((result, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelect(result)}
                            className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 flex items-start gap-3"
                        >
                            <MapPin className="w-4 h-4 text-gold mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">
                                    {result.display_name.split(',')[0]}
                                </p>
                                <p className="text-white/50 text-xs truncate">
                                    {result.display_name}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* No Results */}
            {showResults && !loading && query.length >= 3 && results.length === 0 && (
                <div className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden border border-white/10 bg-[#1A1A1A] shadow-xl">
                    <div className="px-4 py-3 text-white/50 text-sm text-center">
                        No locations found. Try clicking on the map instead.
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddressSearch;
