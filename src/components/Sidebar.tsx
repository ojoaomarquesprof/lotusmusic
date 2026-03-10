"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useStyles } from '../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const { s } = useStyles() 
  const router = useRouter()
  const pathname = usePathname() 
  
  const [perfil, setPerfil] = useState<any>(null)
  const [configEscola, setConfigEscola] = useState<any>(null)
  const [menuAberto, setMenuAberto] = useState(false)

  const rotasPublicas = ['/login', '/esqueci-senha', '/redefinir-senha']

  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const { data: p } = await supabase.from('profiles').select('nome_completo, role').eq('id', session.user.id).single()
        setPerfil(p)

        if (pathname === '/login') {
          if (p?.role === 'ALUNO') {
            router.push('/portal')
          } else {
            router.push('/')
          }
          return
        }

        if (p?.role === 'ALUNO' && !pathname.startsWith('/portal') && !rotasPublicas.includes(pathname)) {
          router.push('/portal')
          return
        }
        
        if (p?.role !== 'ALUNO' && pathname.startsWith('/portal') && !rotasPublicas.includes(pathname)) {
          router.push('/')
          return
        }

      } else {
        setPerfil(null)
        if (!rotasPublicas.includes(pathname)) {
          router.push('/login')
          return
        }
      }
      
      const { data: c } = await supabase.from('configuracoes').select('nome_escola, logo_url, favicon_url').eq('id', 1).single()
      setConfigEscola(c)
    }
    load()
  }, [pathname]) 

  useEffect(() => {
    if (configEscola) {
      if (configEscola.nome_escola) { document.title = `${configEscola.nome_escola} | Gestão` }
      if (configEscola.favicon_url) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = configEscola.favicon_url;
      }
    }
  }, [configEscola, pathname]) 

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (rotasPublicas.includes(pathname) || pathname?.startsWith('/portal')) {
    return (
      <main className="flex-1 flex flex-col w-full relative min-h-screen">
        {children}
      </main>
    )
  }

  // Componente de botão animado reutilizável para manter o código limpo
  const NavButton = ({ rota, icone, texto, corAtivo }: { rota: string, icone: string, texto: string, corAtivo: string }) => {
    const isActive = pathname === rota || (rota !== '/' && pathname.includes(rota))
    
    return (
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push(rota)} 
        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl uppercase text-xs transition-colors duration-300 w-full text-left
          ${isActive 
            ? `bg-white/60 backdrop-blur-md border border-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${corAtivo} font-black` 
            : 'bg-white/10 border border-transparent hover:bg-white/40 hover:border-white/50 text-slate-600 font-bold hover:shadow-sm'
          }`}
      >
        <span className="text-lg drop-shadow-sm">{icone}</span> {texto}
      </motion.button>
    )
  }

  const NavLinks = () => (
    <div className="flex flex-col gap-3 w-full">
      <NavButton rota="/" icone="🏠" texto="Painel Central" corAtivo="text-indigo-700" />
      <NavButton rota="/alunos" icone="👥" texto="Gestão de Alunos" corAtivo="text-indigo-700" />
      <NavButton rota="/financeiro" icone="📊" texto="Financeiro" corAtivo="text-emerald-700" />
      <NavButton rota="/calendario" icone="📅" texto="Calendário" corAtivo="text-amber-700" />
      <NavButton rota="/gerencia" icone="⚙️" texto="Gerência / Setup" corAtivo="text-indigo-700" />
      
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleLogout} 
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-rose-600 font-black uppercase text-xs hover:bg-rose-50/50 hover:backdrop-blur-md hover:border hover:border-rose-200 border border-transparent transition-colors text-left mt-4"
      >
        <span className="text-lg drop-shadow-sm">🚪</span> Sair do Sistema
      </motion.button>
    </div>
  )

  return (
    <div className={`min-h-screen w-full text-slate-900 font-sans flex flex-col xl:flex-row relative z-0`}>
      
      {/* Overlay do Menu Mobile animado com Framer Motion */}
      <AnimatePresence>
        {menuAberto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 xl:hidden" 
            onClick={() => setMenuAberto(false)} 
          />
        )}
      </AnimatePresence>
      
      <motion.aside 
        // Animação condicional para mobile vs desktop
        initial={false}
        animate={{ x: menuAberto ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1280 ? '-100%' : 0) }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={`fixed inset-y-0 left-0 z-50 w-[280px] h-screen border-r border-white/50 bg-white/40 backdrop-blur-2xl p-6 flex flex-col justify-between shadow-[8px_0_30px_rgba(0,0,0,0.03)] xl:relative`}
      >
        <div>
          <div className="mb-10 flex justify-center px-2 relative">
            <button className="xl:hidden absolute -right-2 top-0 p-2 text-slate-400 hover:text-rose-500 text-lg transition-colors" onClick={() => setMenuAberto(false)}>✕</button>
            {configEscola?.logo_url ? (
              <motion.img whileHover={{ scale: 1.05 }} src={configEscola.logo_url} alt="Logo" className="h-24 w-full max-w-[200px] object-contain drop-shadow-md cursor-pointer" />
            ) : (
              <h1 className="text-center text-3xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 leading-none mt-2 drop-shadow-sm">{configEscola?.nome_escola || 'Lótus'}</h1>
            )}
          </div>
          <NavLinks />
        </div>
        
        <motion.div 
          whileHover={{ y: -2 }}
          className={`p-4 bg-white/50 backdrop-blur-md shadow-sm hover:bg-white/70 transition-colors rounded-2xl flex items-center justify-between border border-white/60 mt-4 cursor-default`}
        >
            <div className="overflow-hidden pr-2">
              <p className="font-black text-xs uppercase text-slate-800 truncate">{perfil?.nome_completo || 'Carregando...'}</p>
              <p className={`text-slate-500 text-[9px] uppercase font-bold mt-0.5`}>{perfil?.role}</p>
            </div>
        </motion.div>
      </motion.aside>

      <main className="flex-1 w-full p-4 md:p-8 overflow-x-hidden flex flex-col relative z-0">
        <header className={`xl:hidden flex items-center justify-between mb-6 backdrop-blur-xl bg-white/40 p-4 rounded-[2rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative z-10 transition-all`}>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setMenuAberto(true)} 
              className={`p-2 rounded-xl bg-white/30 backdrop-blur-sm border border-white/50 hover:bg-white/60 transition-colors flex flex-col gap-1.5 justify-center items-center w-10 h-10 shadow-sm`}
            >
              <div className={`w-5 h-0.5 rounded-full bg-slate-700`}></div>
              <div className={`w-5 h-0.5 rounded-full bg-slate-700`}></div>
              <div className={`w-5 h-0.5 rounded-full bg-slate-700`}></div>
            </motion.button>
            <div className="flex-1 flex justify-center px-4">{configEscola?.logo_url ? (<img src={configEscola.logo_url} alt="Logo" className="h-8 max-w-[140px] object-contain drop-shadow-sm" />) : (<h1 className="text-base font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 truncate max-w-[150px]">{configEscola?.nome_escola || 'Lótus'}</h1>)}</div>
            <div className="w-10"></div>
        </header>
        
        {/* Usando AnimatePresence para animar a entrada do conteúdo da página */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
        
      </main>
    </div>
  )
}