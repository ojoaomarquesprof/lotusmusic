"use client"

import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  isDark: true,
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('diretoaocanto_tema')
    if (saved === 'light') setIsDark(false)
  }, [])

  const toggleTheme = () => {
    const newVal = !isDark
    setIsDark(newVal)
    localStorage.setItem('diretoaocanto_tema', newVal ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)