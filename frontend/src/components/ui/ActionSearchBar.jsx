'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import finalPlaces from '../../data/final_places.json';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://student-ride-backend-dev.onrender.com";

// Client-Side LRU Search Cache (Persisted in localStorage for credit preservation)
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

const getCategoryColor = (makiIcon) => {
  switch (makiIcon) {
    case 'lodging':
      return { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400 font-semibold', border: 'border-fuchsia-500/30' };
    case 'hospital':
      return { bg: 'bg-rose-500/20', text: 'text-rose-400 font-semibold', border: 'border-rose-500/30' };
    case 'school':
    case 'college':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400 font-semibold', border: 'border-amber-500/30' };
    case 'restaurant':
    case 'cafe':
    case 'bar':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400 font-semibold', border: 'border-orange-500/30' };
    case 'bank':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400 font-semibold', border: 'border-yellow-500/30' };
    case 'park':
    case 'pitch':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400 font-semibold', border: 'border-emerald-500/30' };
    case 'shop':
    case 'grocery':
      return { bg: 'bg-sky-500/20', text: 'text-sky-400 font-semibold', border: 'border-sky-500/30' };
    case 'police':
    case 'post':
    case 'bus':
      return { bg: 'bg-indigo-500/20', text: 'text-indigo-400 font-semibold', border: 'border-indigo-500/30' };
    case 'place-of-worship':
      return { bg: 'bg-purple-500/20', text: 'text-purple-400 font-semibold', border: 'border-purple-500/30' };
    default:
      return { bg: 'bg-zinc-700/40', text: 'text-zinc-300 font-semibold', border: 'border-zinc-600/40' };
  }
};

// ⚡ GLOBAL PRE-INDEXATION ONCE AT MODULE LOAD (0ms runtime overhead)
const STATIC_INDEXED_PLACES = (() => {
  const list = [];
  const seen = new Set();
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
        id: 'fp_' + idx,
        name,
        category,
        makiIcon,
        lat: coords[1],
        lng: coords[0],
        address: name,
        isLocal: true,
        searchKey: normalized + ' ' + category.toLowerCase()
      });
    });
  }
  return list;
})();

export const ActionSearchBar = ({
  locations = [],
  onSelectLocation,
  placeholder = "Search campus places, hostels...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingApi, setLoadingApi] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const apiTimeoutRef = useRef(null);

  // Merge static preindexed places with any dynamic passed locations
  const preindexedLocations = useMemo(() => {
    if (!locations || locations.length === 0) return STATIC_INDEXED_PLACES;
    const dynamicList = [];
    const seen = new Set(STATIC_INDEXED_PLACES.map(p => p.name.toLowerCase()));

    locations.forEach((loc, idx) => {
      const name = loc.name || loc.label || loc.title || '';
      if (!name) return;
      const normalized = name.toLowerCase().trim();
      if (seen.has(normalized)) return;
      seen.add(normalized);

      const category = loc.category || loc.description || 'Location';
      const makiIcon = categoryToMaki(category, name);
      dynamicList.push({
        id: loc.id || ('loc_' + idx),
        name,
        category,
        makiIcon,
        lat: loc.lat || loc.latitude,
        lng: loc.lng || loc.longitude,
        address: loc.address || name,
        isLocal: true,
        searchKey: normalized + ' ' + category.toLowerCase()
      });
    });

    return [...STATIC_INDEXED_PLACES, ...dynamicList];
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
          const res = await fetch(BACKEND_URL + '/api/places/search?q=' + encodeURIComponent(q));
          if (res.ok) {
            const apiData = await res.json();
            if (Array.isArray(apiData)) {
              const formatted = apiData.map((item, idx) => {
                const primaryName = item.display_name ? item.display_name.split(',')[0].trim() : item.name;
                const category = item.category || 'Location';
                const makiIcon = categoryToMaki(category, primaryName);
                return {
                  id: 'srv_' + (item.id || idx),
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
      setTimeout(() => inputRef.current?.focus(), 50);
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
    // Fire-and-forget: Record place visit
    try {
      fetch(BACKEND_URL + '/api/places/record-visit', {
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
    <div ref={containerRef} className={'relative z-30 ' + className}>
      
      {/* Search Trigger Circle (High Performance Solid Dark Surface - 0 GPU Blur Passes) */}
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
          className="w-11 h-11 z-20 rounded-full border border-white/20 shadow-2xl grid place-items-center transition-transform active:scale-95 cursor-pointer bg-[#181D27] text-white hover:bg-zinc-800"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-zinc-300" />
          ) : (
            <Search className="w-5 h-5 text-zinc-300" />
          )}
        </button>

        {/* Animated Expanding Input Pill - Solid GPU-Accelerated Container */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="search-pill"
              initial={{ width: 44, opacity: 0.95 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{
                width: 44,
                opacity: 0,
                transition: { duration: 0.18, ease: "easeOut" }
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-0 left-0 h-11 rounded-full border border-white/20 shadow-2xl overflow-hidden flex items-center z-10 bg-[#181D27] text-white"
            >
              {/* Left spacer matching the circle button */}
              <div className="w-11 h-11 shrink-0" />

              {/* Text Input - Crisp White Text */}
              <div className="relative flex-1 min-w-0 flex items-center h-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-sm border-none outline-none focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 shadow-none font-semibold pr-2 text-white placeholder:text-zinc-400"
                  style={{ outline: "none", boxShadow: "none", border: "none" }}
                />
              </div>

              {/* Far Right Search / Loading Icon */}
              <div className="w-10 h-10 grid place-items-center shrink-0 pr-1 text-zinc-400">
                {loadingApi ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <Search className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Dropdown (Solid High Performance Surface) */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-14 w-[300px] sm:w-[340px] max-h-64 overflow-y-auto rounded-2xl border border-white/20 p-2 z-40 bg-[#181D27] text-white shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
          >
            <ul className="space-y-1">
              {results.map((item, idx) => {
                const colorToken = getCategoryColor(item.makiIcon);
                return (
                  <li
                    key={item.id || idx}
                    onClick={() => handleSelect(item)}
                    className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/10 active:bg-white/15 text-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      
                      {/* Category Maki Icon Badge */}
                      <div className={'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ' + colorToken.bg + ' ' + colorToken.border}>
                        <img
                          src={'/icons/' + item.makiIcon + '.svg'}
                          alt={item.category}
                          className="w-4 h-4 object-contain filter drop-shadow-sm brightness-125"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextSibling) {
                              e.currentTarget.nextSibling.style.display = 'block';
                            }
                          }}
                        />
                        <MapPin className="w-4 h-4 hidden text-zinc-400" />
                      </div>

                      {/* Name & Category Label - Pure Crisp High-Visibility Typography */}
                      <div className="truncate min-w-0">
                        <p className="text-sm font-bold truncate leading-tight text-white">
                          {item.name}
                        </p>
                        <p className={'text-xs capitalize truncate mt-0.5 ' + colorToken.text}>
                          {item.category}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActionSearchBar;
