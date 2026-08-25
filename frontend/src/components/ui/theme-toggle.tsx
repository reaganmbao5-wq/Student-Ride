"use client"

import React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { themeMode, setThemeMode } = useTheme()
  const isDark = themeMode === "dark" || (themeMode === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const handleToggle = () => {
    setThemeMode(isDark ? "light" : "dark")
  }

  return (
    <div
      className={`relative flex w-16 h-8 p-1 rounded-full cursor-pointer transition-all duration-300 select-none ${
        isDark 
          ? "bg-zinc-950 border border-zinc-800 shadow-inner" 
          : "bg-zinc-200 border border-zinc-300 shadow-inner"
      } ${className}`}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      aria-label="Toggle theme"
    >
      <div className="flex justify-between items-center w-full relative">
        <div
          className={`flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300 ${
            isDark 
              ? "transform translate-x-0 bg-zinc-800 shadow-sm" 
              : "transform translate-x-8 bg-white shadow-md"
          }`}
        >
          {isDark ? (
            <Moon 
              className="w-3.5 h-3.5 text-white" 
              strokeWidth={2}
            />
          ) : (
            <Sun 
              className="w-3.5 h-3.5 text-amber-500" 
              strokeWidth={2}
            />
          )}
        </div>
        <div
          className={`flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300 ${
            isDark 
              ? "bg-transparent opacity-40" 
              : "transform -translate-x-8 opacity-40"
          }`}
        >
          {isDark ? (
            <Sun 
              className="w-3.5 h-3.5 text-zinc-400" 
              strokeWidth={1.5}
            />
          ) : (
            <Moon 
              className="w-3.5 h-3.5 text-zinc-600" 
              strokeWidth={1.5}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ThemeToggle
