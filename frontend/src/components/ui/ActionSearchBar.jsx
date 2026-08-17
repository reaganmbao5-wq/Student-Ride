'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { isNightTheme } from '../../map/styles/MapboxStyles';
import finalPlaces from '../../data/final_places.json';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://student-ride-backend-manual.onrender.com";

// Client-Side LRU Search Cache (Persisted in localStorage)
const LOCAL_STORAGE_CACHE_KEY = 'SR_SEARCH_CACHE_V1';

const getClientCache = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveClientCache = (queryKey, data) => {
  try {
    const cache = getClientCache();
    cache[queryKey.toLowerCase().trim()] = {
      timestamp: Date.now(),
      data
    };
    // Keep max 100 queries in client cache
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      delete cache[keys[0]];
    }
    localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota limits
  }
};

const categoryToMaki = (category, name) => {
  const n = String(name || '').toLowerCase().trim();
  if (n.includes('hostel') || n.includes('dormitory') || n.includes('accommodation') || n.includes('hall of residence')) {
    return 'lodging';
  }
  const cat = String(category || '').toLowerCase().trim().replace(/_/g, ' ');
  
  if (['hospital', 'clinic', 'medical laboratory', 'community health center', 'health consultant', 'health post', 'health_post', 'health'].includes(cat)) {
    return 'hospital';
  }
  if (['hostel', 'hotel', 'guest house', 'lodging', 'apartment', 'condominium complex', 'housing society', 'serviced accommodation', 'student housing center', 'boarding', 'boarding house', 'dormitory'].includes(cat)) {
    return 'lodging';
  }
  if (['school', 'kindergarten', 'private educational institution'].includes(cat)) {
    return 'school';
  }
  if (['university', 'college', 'educational institution', 'educational_institution', 'education center', 'auditorium', 'library', 'lecture theatre', 'lecture hall', 'hall'].includes(cat)) {
    return 'college';
  }
  if (['restaurant', 'fast food', 'diner', 'fast_food'].includes(cat)) {
    return 'restaurant';
  }
  if (['bar', 'night club', 'nightclub', 'pub'].includes(cat)) {
    return 'bar';
  }
  if (['cafe'].includes(cat)) {
    return 'cafe';
  }
  if (['fuel'].includes(cat)) {
    return 'fuel';
  }
  if (['supermarket', 'hypermarket', 'convenience', 'grocery'].includes(cat)) {
    return 'grocery';
  }
  if (['shop', 'bakery', 'boutique', 'butcher', 'beverages', 'clothing wholesale market place', 'market', 'mall', 'shoes', 'building materials', 'building_materials'].includes(cat)) {
    return 'shop';
  }
  if (['bank', 'atm', 'financial institution', 'money transfer service', 'money order service', 'building society'].includes(cat)) {
    return 'bank';
  }
  if (['place of worship', 'place_of_worship'].includes(cat)) {
    return 'place-of-worship';
  }
  if (['police', 'security'].includes(cat)) {
    return 'police';
  }
  if (['station', 'transport', 'transportation service'].includes(cat)) {
    return 'bus';
  }
  if (['post office', 'post_office'].includes(cat)) {
    return 'post';
  }
  if (['park', 'playground', 'garden'].includes(cat)) {
    return 'park';
  }
  if (['veterinary'].includes(cat)) {
    return 'veterinary';
  }
  if (['sports', 'pitch'].includes(cat)) {
    return 'pitch';
  }
  return 'marker';
};

const getCategoryColor = (makiIcon, isNight) => {
  if (isNight) {
    switch (makiIcon) {
      case 'lodging':
        return { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' };
      case 'hospital':
        return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
      case 'school':
      case 'college':
        return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
      case 'restaurant':
      case 'cafe':
      case 'bar':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
      case 'bank':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
      case 'park':
      case 'pitch':
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
      case 'shop':
      case 'grocery':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' };
      case 'police':
      case 'post':
      case 'bus':
        return { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' };
      case 'place-of-worship':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' };
      default:
        return { bg: 'bg-zinc-700/30', text: 'text-zinc-300', border: 'border-zinc-700/40' };
    }
  } else {
    // Light Mode map high contrast tokens
    switch (makiIcon) {
      case 'lodging':
        return { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800 font-semibold', border: 'border-fuchsia-200' };
      case 'hospital':
        return { bg: 'bg-red-100', text: 'text-red-800 font-semibold', border: 'border-red-200' };
      case 'school':
      case 'college':
        return { bg: 'bg-amber-100', text: 'text-amber-900 font-semibold', border: 'border-amber-200' };
      case 'restaurant':
      case 'cafe':
      case 'bar':
        return { bg: 'bg-orange-100', text: 'text-orange-900 font-semibold', border: 'border-orange-200' };
      case 'bank':
        return { bg: 'bg-yellow-100', text: 'text-yellow-900 font-semibold', border: 'border-yellow-200' };
      case 'park':
      case 'pitch':
        return { bg: 'bg-emerald-100', text: 'text-emerald-800 font-semibold', border: 'border-emerald-200' };
      case 'shop':
      case 'grocery':
        return { bg: 'bg-blue-100', text: 'text-blue-800 font-semibold', border: 'border-blue-200' };
      case 'police':
      case 'post':
      case 'bus':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800 font-semibold', border: 'border-indigo-200' };
      case 'place-of-worship':
        return { bg: 'bg-purple-100', text: 'text-purple-800 font-semibold', border: 'border-purple-200' };
      default:
        return { bg: 'bg-zinc-100', text: 'text-zinc-700 font-semibold', border: 'border-zinc-200' };
    }
  }
};

export const ActionSearchBar = ({
  locations = [],
  onSelectLocation,
  placeholder = "Search campus places, hostels...",
  className = ""
}) => {
  const { themeMode } = useTheme();
  
  // Directly follow the map's Day/Night style (Daytime = Light Map, Nighttime = Dark Map)
  const isNight = useMemo(() => isNightTheme(themeMode === 'auto' ? null : themeMode), [themeMode]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingApi, setLoadingApi] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const apiTimeoutRef = useRef(null);

  // Pre-indexed database of campus places & hostels (Instant < 1ms response)
  const preindexedLocations = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Add verified finalPlaces
    if (finalPlaces?.features) {
      finalPlaces.features.forEach((feat, idx) => {
        const coords = feat.geometry?.coordinates || [];
        const name = feat.properties?.name || '';
        if (!name || coords.length < 2) return;
        const normalized = name.toLowerCase().trim();
        if (seen.has(normalized)) return;
        seen.add(normalized);

        const category = feat.properties?.category || feat.properties?.category_raw || 'Campus Location';
        const makiIcon = categoryToMaki(category, name);
        list.push({
          id: `fp_${idx}`,
          name,
          category,
          makiIcon,
          lat: coords[1],
          lng: coords[0],
          address: name,
          isLocal: true,
          searchKey: `${normalized} ${category.toLowerCase()}`
        });
      });
    }

    // 2. Add dynamic locations
    if (locations && locations.length > 0) {
      locations.forEach((loc, idx) => {
        const name = loc.name || loc.label || loc.title || '';
        if (!name) return;
        const normalized = name.toLowerCase().trim();
        if (seen.has(normalized)) return;
        seen.add(normalized);

        const category = loc.category || loc.description || 'Location';
        const makiIcon = categoryToMaki(category, name);
        list.push({
          id: loc.id || `loc_${idx}`,
          name,
          category,
          makiIcon,
          lat: loc.lat || loc.latitude,
          lng: loc.lng || loc.longitude,
          address: loc.address || name,
          isLocal: true,
          searchKey: `${normalized} ${category.toLowerCase()}`
        });
      });
    }

    return list;
  }, [locations]);

  // Two-Layer Search Engine: Instant Local Index -> Online MongoDB Cache -> API
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults([]);
      setLoadingApi(false);
      if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
      return;
    }

    // 1. INSTANT In-Memory Local Search (< 1ms)
    const startsWithName = [];
    const containsName = [];
    const containsCategory = [];

    preindexedLocations.forEach((item) => {
      const nameLower = item.name.toLowerCase();
      if (nameLower.startsWith(q)) {
        startsWithName.push(item);
      } else if (nameLower.includes(q)) {
        containsName.push(item);
      } else if (item.searchKey.includes(q)) {
        containsCategory.push(item);
      }
    });

    const instantMatches = [...startsWithName, ...containsName, ...containsCategory].slice(0, 8);
    setResults(instantMatches);

    // 2. Check Client Cache
    const clientCache = getClientCache();
    if (clientCache[q] && Date.now() - clientCache[q].timestamp < 3600000) {
      const cachedList = clientCache[q].data;
      if (Array.isArray(cachedList) && cachedList.length > 0) {
        setResults((prev) => {
          const seenNames = new Set(prev.map(p => p.name.toLowerCase()));
          const extra = cachedList.filter(p => !seenNames.has(p.name.toLowerCase()));
          return [...prev, ...extra].slice(0, 10);
        });
        setLoadingApi(false);
        return;
      }
    }

    // 3. Debounced Online Backend & MongoDB Cache Search (300ms)
    if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);

    if (q.length >= 3) {
      setLoadingApi(true);
      apiTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/places/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const apiData = await res.json();
            if (Array.isArray(apiData)) {
              const formatted = apiData.map((item, idx) => {
                const primaryName = item.display_name ? item.display_name.split(',')[0].trim() : item.name;
                const category = item.category || 'Location';
                const makiIcon = categoryToMaki(category, primaryName);
                return {
                  id: `srv_${item.id || idx}`,
                  name: primaryName,
                  category: category,
                  makiIcon: makiIcon,
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon || item.lng),
                  address: item.display_name || item.name,
                  isLocal: false
                };
              });

              // Save to Client Cache to preserve credits
              saveClientCache(q, formatted);

              setResults((prev) => {
                const seenNames = new Set(prev.map(p => p.name.toLowerCase()));
                const extra = formatted.filter(p => !seenNames.has(p.name.toLowerCase()));
                return [...prev, ...extra].slice(0, 12);
              });
            }
          }
        } catch (err) {
          console.warn('Online place search error:', err);
        } finally {
          setLoadingApi(false);
        }
      }, 300);
    } else {
      setLoadingApi(false);
    }

    return () => {
      if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
    };
  }, [query, preindexedLocations]);

  // Focus input on expand
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setLoadingApi(false);
    }
  }, [isOpen]);

  // Close on outside click / tap
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        handleCollapse();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleCollapse = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setLoadingApi(false);
  };

  const handleSelect = (item) => {
    // Fire-and-forget: Record place visit to boost frequently visited places and cache online
    try {
      fetch(`${BACKEND_URL}/api/places/record-visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          address: item.address,
          lat: item.lat,
          lng: item.lng,
          category: item.category
        })
      }).catch(() => {});
    } catch {}

    if (onSelectLocation) {
      onSelectLocation({
        lat: item.lat,
        lng: item.lng,
        address: item.address || item.name,
        name: item.name,
        category: item.category
      });
    }
    handleCollapse();
  };

  return (
    <div ref={containerRef} className={`relative z-30 ${className}`}>
      
      {/* Search Trigger Circle (Always visible on left, expands to full pill on right) */}
      <div className="relative h-11 flex items-center">
        
        {/* Left Circle Toggle Button (Search -> X) */}
        <button
          type="button"
          aria-label={isOpen ? "Close search" : "Open search"}
          onClick={() => {
            if (isOpen) {
              handleCollapse();
            } else {
              setIsOpen(true);
            }
          }}
          className={`w-11 h-11 z-20 rounded-full border shadow-lg grid place-items-center transition-transform active:scale-95 cursor-pointer ${
            isNight
              ? "bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:text-white"
              : "bg-white border-zinc-300/90 text-zinc-800 hover:text-zinc-950"
          }`}
        >
          {isOpen ? (
            <X className={`w-5 h-5 ${isNight ? "text-zinc-300" : "text-zinc-700"}`} />
          ) : (
            <Search className={`w-5 h-5 ${isNight ? "text-zinc-300" : "text-zinc-700"}`} />
          )}
        </button>

        {/* Animated Expanding Input Pill (Expands to the right, stays 100% rounded-full) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="search-pill"
              initial={{ width: 44, opacity: 0.92 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{
                width: 44,
                opacity: 0,
                transition: { type: "spring", stiffness: 280, damping: 26 }
              }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className={`absolute top-0 left-0 h-11 rounded-full border shadow-2xl overflow-hidden flex items-center z-10 ${
                isNight
                  ? "bg-zinc-900/98 border-zinc-700/80 text-white"
                  : "bg-white/98 border-zinc-300/90 text-zinc-950"
              }`}
            >
              {/* Left spacer matching the circle button */}
              <div className="w-11 h-11 shrink-0" />

              {/* Text Input */}
              <div className="relative flex-1 min-w-0 flex items-center h-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className={`w-full bg-transparent text-sm border-none outline-none focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 shadow-none font-semibold pr-2 ${
                    isNight
                      ? "text-white placeholder:text-zinc-400"
                      : "text-zinc-950 placeholder:text-zinc-500"
                  }`}
                  style={{ outline: "none", boxShadow: "none", border: "none" }}
                />
              </div>

              {/* Far Right Search / Loading Icon */}
              <div className="w-10 h-10 grid place-items-center shrink-0 pr-1 text-zinc-400">
                {loadingApi ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <Search className={`w-4 h-4 ${isNight ? "text-zinc-400" : "text-zinc-600"}`} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Dropdown (Clean, high-visibility frosted glass, NO black scrollbar) */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            className={`absolute left-0 top-14 w-[300px] sm:w-[340px] max-h-64 overflow-y-auto rounded-2xl border p-2 z-40 backdrop-blur-2xl scrollbar-none [&::-webkit-scrollbar]:hidden ${
              isNight
                ? "bg-[#121824]/98 border-zinc-700/60 text-white shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                : "bg-white/98 border-zinc-200/90 text-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
            }`}
          >
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.03 }
                }
              }}
              className="space-y-1"
            >
              {results.map((item, idx) => {
                const colorToken = getCategoryColor(item.makiIcon, isNight);
                return (
                  <motion.li
                    key={item.id || idx}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      show: { opacity: 1, y: 0 }
                    }}
                    onClick={() => handleSelect(item)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isNight
                        ? "hover:bg-zinc-800/80 active:bg-zinc-700/80 text-zinc-100"
                        : "hover:bg-zinc-100/90 active:bg-zinc-200/90 text-zinc-950"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      
                      {/* Category Maki Icon Badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${colorToken.bg} ${colorToken.border}`}>
                        <img
                          src={`/icons/${item.makiIcon}.svg`}
                          alt={item.category}
                          className={`w-4 h-4 object-contain filter drop-shadow-sm ${isNight ? 'brightness-125' : 'brightness-90'}`}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextSibling) {
                              e.currentTarget.nextSibling.style.display = 'block';
                            }
                          }}
                        />
                        <MapPin className={`w-4 h-4 hidden ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`} />
                      </div>

                      {/* Name & Category Label */}
                      <div className="truncate min-w-0">
                        <p className={`text-sm font-bold truncate leading-tight ${isNight ? 'text-white' : 'text-zinc-950'}`}>
                          {item.name}
                        </p>
                        <p className={`text-xs capitalize truncate mt-0.5 ${colorToken.text}`}>
                          {item.category}
                        </p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActionSearchBar;
