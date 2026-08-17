import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, MapPin, Building } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

function useDebounce(value, delay = 200) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

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
  const debouncedQuery = useDebounce(query, 180);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Filter locations on query change
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    const q = debouncedQuery.toLowerCase().trim();
    const filtered = locations.filter(loc => {
      const name = (loc.name || loc.label || loc.title || "").toLowerCase();
      const desc = (loc.description || loc.category || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
    setResults(filtered);
  }, [debouncedQuery, locations]);

  // Focus input on expand
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setQuery("");
      setResults([]);
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
  };

  const handleSelect = (item) => {
    if (onSelectLocation) {
      onSelectLocation(item);
    }
    handleCollapse();
  };

  return (
    <div ref={containerRef} className={`relative z-30 ${className}`}>
      {/* Search Trigger Circle -> Expands to Full Input */}
      <motion.div
        layout
        initial={false}
        animate={{
          width: isOpen ? "280px" : "48px",
          height: "48px",
          borderRadius: isOpen ? "16px" : "9999px"
        }}
        transition={{
          type: "spring",
          stiffness: 140,
          damping: 18,
          mass: 0.8
        }}
        className={`flex items-center overflow-hidden shadow-2xl backdrop-blur-xl border transition-colors cursor-pointer ${
          isDark
            ? "bg-zinc-900/95 border-zinc-800 text-white"
            : "bg-white/95 border-zinc-200 text-zinc-900"
        }`}
        onClick={() => {
          if (!isOpen) setIsOpen(true);
        }}
      >
        {/* Search Icon */}
        <div className="w-12 h-12 flex items-center justify-center shrink-0">
          <Search className={`w-5 h-5 ${isDark ? "text-zinc-300" : "text-zinc-600"}`} />
        </div>

        {/* Text Input (Visible when expanded) */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex items-center pr-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className={`w-full bg-transparent border-none text-sm font-medium focus:outline-none ${
                isDark ? "text-white placeholder:text-zinc-500" : "text-zinc-900 placeholder:text-zinc-400"
              }`}
              style={{ outline: "none", boxShadow: "none", border: "none" }}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="p-1 hover:opacity-75 transition-opacity"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute left-0 top-14 w-[300px] sm:w-[340px] max-h-64 overflow-y-auto rounded-2xl border shadow-2xl p-2 z-40 backdrop-blur-2xl ${
              isDark
                ? "bg-zinc-950/95 border-zinc-800 text-white"
                : "bg-white/95 border-zinc-200 text-zinc-900"
            }`}
          >
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.05 }
                }
              }}
              className="space-y-1"
            >
              {results.map((item, idx) => (
                <motion.li
                  key={item.id || idx}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 }
                  }}
                  onClick={() => handleSelect(item)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isDark
                      ? "hover:bg-zinc-900 text-zinc-200"
                      : "hover:bg-zinc-100 text-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                    }`}>
                      {item.category === "hostel" ? (
                        <Building className="w-4 h-4 text-blue-400" />
                      ) : (
                        <MapPin className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold truncate leading-snug">
                        {item.name || item.label || item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-zinc-400 truncate">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActionSearchBar;
