'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { searchAddress } from '../../map/services/nominatim';
import finalPlaces from '../../data/final_places.json';

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
      return { bg: 'bg-fuchsia-500/15 dark:bg-fuchsia-500/25', text: 'text-fuchsia-600 dark:text-fuchsia-400', fill: '#C026D3' };
    case 'hospital':
      return { bg: 'bg-red-500/15 dark:bg-red-500/25', text: 'text-red-600 dark:text-red-400', fill: '#DC2626' };
    case 'school':
    case 'college':
      return { bg: 'bg-amber-500/15 dark:bg-amber-500/25', text: 'text-amber-600 dark:text-amber-400', fill: '#D97706' };
    case 'restaurant':
    case 'cafe':
    case 'bar':
      return { bg: 'bg-orange-500/15 dark:bg-orange-500/25', text: 'text-orange-600 dark:text-orange-400', fill: '#EA580C' };
    case 'bank':
      return { bg: 'bg-yellow-500/15 dark:bg-yellow-500/25', text: 'text-yellow-600 dark:text-yellow-400', fill: '#CA8A04' };
    case 'park':
    case 'pitch':
      return { bg: 'bg-emerald-500/15 dark:bg-emerald-500/25', text: 'text-emerald-600 dark:text-emerald-400', fill: '#16A34A' };
    case 'shop':
    case 'grocery':
      return { bg: 'bg-blue-500/15 dark:bg-blue-500/25', text: 'text-blue-600 dark:text-blue-400', fill: '#2563EB' };
    case 'police':
    case 'post':
    case 'bus':
      return { bg: 'bg-indigo-500/15 dark:bg-indigo-500/25', text: 'text-indigo-600 dark:text-indigo-400', fill: '#4F46E5' };
    case 'place-of-worship':
      return { bg: 'bg-purple-500/15 dark:bg-purple-500/25', text: 'text-purple-600 dark:text-purple-400', fill: '#7C3AED' };
    default:
      return { bg: 'bg-zinc-500/15 dark:bg-zinc-500/25', text: 'text-zinc-600 dark:text-zinc-400', fill: '#64748B' };
  }
};

export const ActionSearchBar = ({
  locations = [],
  onSelectLocation,
  placeholder = "Search campus places, hostels...",
  className = ""
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingApi, setLoadingApi] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const apiTimeoutRef = useRef(null);

  // Pre-indexed database of campus places + extra locations
  const preindexedLocations = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Add finalPlaces
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

    // 2. Add dynamic locations prop
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

  // Instant local filtering (< 1ms) + Debounced API search
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults([]);
      setLoadingApi(false);
      if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
      return;
    }

    // 1. INSTANT local results
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

    const instantLocalResults = [...startsWithName, ...containsName, ...containsCategory].slice(0, 10);
    setResults(instantLocalResults);

    // 2. Debounced API search for external addresses if query length >= 3
    if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);

    if (q.length >= 3) {
      setLoadingApi(true);
      apiTimeoutRef.current = setTimeout(async () => {
        try {
          const apiData = await searchAddress(q);
          if (apiData && Array.isArray(apiData)) {
            const externalResults = apiData.map((item, idx) => {
              const primaryName = item.display_name.split(',')[0].trim();
              const category = item.type || item.class || 'Address';
              const makiIcon = categoryToMaki(category, primaryName);
              return {
                id: `api_${item.place_id || idx}`,
                name: primaryName,
                category: category,
                makiIcon: makiIcon,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                address: item.display_name,
                isLocal: false
              };
            });

            setResults((prev) => {
              const seenNames = new Set(prev.map(p => p.name.toLowerCase()));
              const filteredApi = externalResults.filter(p => !seenNames.has(p.name.toLowerCase()));
              return [...prev, ...filteredApi].slice(0, 12);
            });
          }
        } catch (err) {
          console.error('API search error:', err);
        } finally {
          setLoadingApi(false);
        }
      }, 350);
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

  // Close on outside click
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
            isDark
              ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
              : "bg-white border-zinc-200 text-zinc-700 hover:text-zinc-950"
          }`}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-zinc-400 dark:text-zinc-300" />
          ) : (
            <Search className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
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
                isDark
                  ? "bg-zinc-900/98 border-zinc-800 text-white"
                  : "bg-white/98 border-zinc-200 text-zinc-900"
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
                  className="w-full bg-transparent text-sm border-none outline-none focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 shadow-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium pr-2"
                  style={{ outline: "none", boxShadow: "none", border: "none" }}
                />
              </div>

              {/* Far Right Search / Loading Icon */}
              <div className="w-10 h-10 grid place-items-center shrink-0 pr-1 text-zinc-400">
                {loadingApi ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute left-0 top-14 w-[300px] sm:w-[340px] max-h-64 overflow-y-auto rounded-2xl border shadow-2xl p-2 z-40 backdrop-blur-2xl ${
              isDark
                ? "bg-zinc-950/98 border-zinc-800 text-white"
                : "bg-white/98 border-zinc-200 text-zinc-900"
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
                const colorToken = getCategoryColor(item.makiIcon);
                return (
                  <motion.li
                    key={item.id || idx}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      show: { opacity: 1, y: 0 }
                    }}
                    onClick={() => handleSelect(item)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isDark
                        ? "hover:bg-zinc-900/90 text-zinc-200 active:bg-zinc-800"
                        : "hover:bg-zinc-100 text-zinc-800 active:bg-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      
                      {/* Category Maki Icon Badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorToken.bg}`}>
                        <img
                          src={`/icons/${item.makiIcon}.svg`}
                          alt={item.category}
                          className="w-4 h-4 object-contain filter drop-shadow-sm"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextSibling) {
                              e.currentTarget.nextSibling.style.display = 'block';
                            }
                          }}
                        />
                        <MapPin className="w-4 h-4 hidden text-zinc-400" />
                      </div>

                      {/* Name & Category Label */}
                      <div className="truncate min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">
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
