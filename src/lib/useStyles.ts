"use client"
import { useState, useEffect } from 'react'

export const THEMES: Record<string, any> = {
  dark: {
    bg: 'bg-slate-950',
    text: 'text-slate-100',
    textMuted: 'text-slate-400',
    card: 'bg-slate-900 border-slate-800',
    cardInterno: 'bg-slate-800 border-slate-700',
    input: 'bg-slate-950 border-slate-700 focus:border-indigo-500 focus:ring-indigo-500 text-slate-100',
    chaveBg: 'bg-indigo-600',
    chaveBola: 'translate-x-6 bg-white',
    icone: '🌙'
  },
  light: {
    bg: 'bg-slate-50',
    text: 'text-slate-900',
    textMuted: 'text-slate-500',
    card: 'bg-white border-slate-200',
    cardInterno: 'bg-slate-50 border-slate-200 shadow-sm',
    input: 'bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900',
    chaveBg: 'bg-slate-300',
    chaveBola: 'translate-x-0 bg-white shadow-md',
    icone: '☀️'
  }
}

export function useStyles() {
  const [temaId, setTemaId] = useState('dark')

  useEffect(() => {
    const stored = localStorage.getItem('tema_sistema')
    if (stored === 'light' || stored === 'dark') setTemaId(stored)
  }, [])

  const toggleTheme = () => {
    const next = temaId === 'dark' ? 'light' : 'dark'
    setTemaId(next)
    localStorage.setItem('tema_sistema', next)
  }

  return { s: THEMES[temaId], isDark: temaId === 'dark', toggleTheme }
}