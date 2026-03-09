"use client"

export const THEMES: Record<string, any> = {
  dark: {
    bg: 'bg-slate-950', text: 'text-slate-100', textMuted: 'text-slate-400', card: 'bg-slate-900 border-slate-800', cardInterno: 'bg-slate-800 border-slate-700', input: 'bg-slate-950 border-slate-700 focus:border-indigo-500 focus:ring-indigo-500 text-slate-100', chaveBg: 'bg-indigo-600', chaveBola: 'translate-x-6 bg-white', icone: '🌙'
  },
  light: {
    bg: 'bg-slate-50', text: 'text-slate-900', textMuted: 'text-slate-500', card: 'bg-white border-slate-200', cardInterno: 'bg-slate-50 border-slate-200 shadow-sm', input: 'bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900', chaveBg: 'bg-slate-300', chaveBola: 'translate-x-0 bg-white shadow-md', icone: '☀️'
  }
}

export function useStyles() {
  // Força o sistema inteiro a usar apenas o modo claro
  const temaId = 'light'

  // Função vazia para não quebrar componentes antigos que tentem chamar o toggleTheme
  const toggleTheme = () => {}

  return { s: THEMES[temaId], isDark: false, toggleTheme }
}