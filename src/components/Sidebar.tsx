"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useStyles } from '../lib/useStyles'

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const { s, toggleTheme } = useStyles()
  const router = useRouter()
  const pathname = usePathname() 
  
  const [perfil, setPerfil] = useState<any>(null)
  const [configEscola, setConfigEscola] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const { data: p } = await supabase.from('profiles').select('nome_completo, role').eq('id', session.user.id).single()
        setPerfil(p)

        // 🚨 BLINDAGEM DE SEGURANÇA GLOBAL 🚨
        // 1. Se for ALUNO e tentar acessar qualquer coisa fora do /portal ou /login, é expulso de volta pro Portal.
        if (p?.role === 'ALUNO' && !pathname.startsWith('/portal') && pathname !== '/login') {
          router.push('/portal')
          return
        }
        
        // 2. Se for CHEFE/PROFESSOR e tentar acessar o portal do aluno, é redirecionado pro Painel Central.
        if (p?.role !== 'ALUNO' && pathname.startsWith('/portal') && pathname !== '/login') {
          router.push('/')
          return
        }

      } else {
        setPerfil(null)
        // Se não tiver ninguém logado e não estiver na tela de login, manda pro login.
        if (pathname !== '/login') {
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
      if (configEscola.nome_escola) {
        document.title = `${configEscola.nome_escola} | Gestão`
      }
      
      if (configEscola.favicon_url) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = configEscola.favicon_url;
      }
    }
  }, [configEscola, pathname]) 

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (pathname === '/login' || pathname?.startsWith('/portal')) {
    return <>{children}</>
  }

  const NavLinks = () => (
    <div className="flex flex-col gap-2 w-full">
      <button onClick={() => router.push('/')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-black uppercase text-xs transition-all ${pathname === '/' ? 'bg-indigo-600 text-white shadow-lg scale-105' : `${s.cardInterno} border border-transparent hover:border-indigo-500/30`}`}><span>🏠</span> Painel Central</button>
      <button onClick={() => router.push('/alunos')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-black uppercase text-xs transition-all ${pathname.includes('/alunos') ? 'bg-indigo-600 text-white shadow-lg scale-105' : `${s.cardInterno} border border-transparent hover:border-indigo-500/30`}`}><span>👥</span> Gestão de Alunos</button>
      <button onClick={() => router.push('/financeiro')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-black uppercase text-xs transition-all ${pathname.includes('/financeiro') ? 'bg-emerald-600 text-white shadow-lg scale-105' : `${s.cardInterno} border border-transparent hover:border-emerald-500/30`}`}><span>📊</span> Financeiro</button>
      <button onClick={() => router.push('/calendario')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-black uppercase text-xs transition-all ${pathname.includes('/calendario') ? 'bg-amber-500 text-slate-900 shadow-lg scale-105' : `${s.cardInterno} border border-transparent hover:border-amber-500/30`}`}><span>📅</span> Calendário</button>
      <button onClick={() => router.push('/gerencia')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-black uppercase text-xs transition-all ${pathname.includes('/gerencia') ? 'bg-indigo-600 text-white shadow-lg scale-105' : `${s.cardInterno} border border-transparent hover:border-indigo-500/30`}`}><span>⚙️</span> Gerência / Setup</button>
      <button onClick={handleLogout} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-rose-500 font-black uppercase text-xs hover:bg-rose-500/10 transition-all text-left mt-4`}><span>🚪</span> Sair do Sistema</button>
    </div>
  )

  return (
    <div className={`min-h-screen ${s.bg} ${s.text} font-sans transition-colors duration-500 flex flex-col xl:flex-row`}>
      <aside className={`hidden xl:flex flex-col w-[280px] h-screen sticky top-0 border-r ${s.card} p-6 justify-between shadow-2xl z-20`}>
        <div>
          <div className="mb-10 flex justify-center px-2">
            {configEscola?.logo_url ? (
              <img src={configEscola.logo_url} alt="Logo" className="h-24 w-full max-w-[200px] object-contain drop-shadow-sm" />
            ) : (
              <h1 className="text-center text-2xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 leading-none">
                {configEscola?.nome_escola || 'Sua Escola'}
              </h1>
            )}
          </div>
          <NavLinks />
        </div>

        <div className={`p-4 ${s.cardInterno} rounded-2xl flex items-center justify-between border`}>
            <div className="overflow-hidden pr-2">
              <p className="font-black text-xs uppercase truncate">{perfil?.nome_completo || 'Carregando...'}</p>
              <p className={`${s.textMuted} text-[9px] uppercase font-bold`}>{perfil?.role}</p>
            </div>
            <button onClick={toggleTheme} className={`h-6 w-10 rounded-full ${s.chaveBg} relative shadow-inner flex-shrink-0`}><span className={`h-4 w-4 flex items-center justify-center rounded-full transition-all text-[8px] mt-1 ${s.chaveBola}`}>{s.icone}</span></button>
        </div>
      </aside>

      <main className="flex-1 w-full p-4 md:p-8 overflow-x-hidden flex flex-col">
        <header className={`xl:hidden flex flex-col items-center mb-6 backdrop-blur-md p-4 rounded-[2rem] border ${s.card} shadow-xl gap-4`}>
            <div className="flex justify-between w-full items-center">
              {configEscola?.logo_url ? <img src={configEscola.logo_url} alt="Logo" className="h-10 max-w-[150px] object-contain" /> : <h1 className="text-lg font-black uppercase italic text-indigo-500">{configEscola?.nome_escola || 'Sua Escola'}</h1>}
              <button onClick={toggleTheme} className={`h-8 w-14 rounded-full ${s.chaveBg} relative shadow-inner flex-shrink-0`}><span className={`h-6 w-6 flex items-center justify-center rounded-full transition-all text-[10px] ${s.chaveBola}`}>{s.icone}</span></button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 w-full mt-2">
              <button onClick={() => router.push('/')} className={`px-3 py-2.5 rounded-xl font-black uppercase text-[10px] ${pathname === '/' ? 'bg-indigo-600 text-white' : `${s.cardInterno} border`}`}>🏠 Painel</button>
              <button onClick={() => router.push('/alunos')} className={`px-3 py-2.5 rounded-xl font-black uppercase text-[10px] ${pathname.includes('/alunos') ? 'bg-indigo-600 text-white' : `${s.cardInterno} border`}`}>👥 Alunos</button>
              <button onClick={() => router.push('/financeiro')} className={`px-3 py-2.5 rounded-xl font-black uppercase text-[10px] ${pathname.includes('/financeiro') ? 'bg-emerald-600 text-white' : `${s.cardInterno} border`}`}>📊 Finance</button>
              <button onClick={() => router.push('/calendario')} className={`px-3 py-2.5 rounded-xl font-black uppercase text-[10px] ${pathname.includes('/calendario') ? 'bg-amber-500 text-slate-900' : `${s.cardInterno} border`}`}>📅 Calendário</button>
              <button onClick={() => router.push('/gerencia')} className={`px-3 py-2.5 rounded-xl font-black uppercase text-[10px] ${pathname.includes('/gerencia') ? 'bg-indigo-600 text-white' : `${s.cardInterno} border`}`}>⚙️ Menu</button>
            </div>
        </header>

        {children}

      </main>
    </div>
  )
}