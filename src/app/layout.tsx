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
  
  // Novo estado para controlar o menu no celular
  const [menuAberto, setMenuAberto] = useState(false)

  // Fecha o menu automaticamente quando a rota (página) muda no celular
  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const { data: p } = await supabase.from('profiles').select('nome_completo, role').eq('id', session.user.id).single()
        setPerfil(p)

        if (p?.role === 'ALUNO' && !pathname.startsWith('/portal') && pathname !== '/login') {
          router.push('/portal')
          return
        }
        
        if (p?.role !== 'ALUNO' && pathname.startsWith('/portal') && pathname !== '/login') {
          router.push('/')
          return
        }

      } else {
        setPerfil(null)
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
    <div className={`min-h-screen ${s.bg} ${s.text} font-sans transition-colors duration-500 flex flex-col xl:flex-row relative`}>
      
      {/* Fundo escurecido no mobile quando o menu está aberto */}
      {menuAberto && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 xl:hidden transition-opacity"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* SIDEBAR: Agora ela desliza no mobile e fica fixa no desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-[280px] h-screen border-r ${s.card} p-6 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out
        xl:relative xl:translate-x-0 
        ${menuAberto ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          <div className="mb-10 flex justify-center px-2 relative">
            {/* Botão de fechar no mobile */}
            <button 
              className="xl:hidden absolute -right-2 top-0 p-2 text-slate-400 hover:text-rose-500"
              onClick={() => setMenuAberto(false)}
            >
              ✕
            </button>

            {configEscola?.logo_url ? (
              <img src={configEscola.logo_url} alt="Logo" className="h-24 w-full max-w-[200px] object-contain drop-shadow-sm" />
            ) : (
              <h1 className="text-center text-2xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 leading-none mt-2">
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
        
        {/* CABEÇALHO MOBILE: Hambúrguer, Logo e Tema */}
        <header className={`xl:hidden flex items-center justify-between mb-6 backdrop-blur-md p-4 rounded-[2rem] border ${s.card} shadow-lg`}>
            
            <button 
              onClick={() => setMenuAberto(true)} 
              className={`p-2 rounded-xl ${s.cardInterno} border hover:border-indigo-500/50 transition-colors flex flex-col gap-1.5 justify-center items-center w-10 h-10`}
            >
              <div className={`w-5 h-0.5 rounded-full ${s.text} bg-current`}></div>
              <div className={`w-5 h-0.5 rounded-full ${s.text} bg-current`}></div>
              <div className={`w-5 h-0.5 rounded-full ${s.text} bg-current`}></div>
            </button>

            <div className="flex-1 flex justify-center px-4">
              {configEscola?.logo_url ? (
                <img src={configEscola.logo_url} alt="Logo" className="h-8 max-w-[140px] object-contain" />
              ) : (
                <h1 className="text-base font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 truncate max-w-[150px]">
                  {configEscola?.nome_escola || 'Lótus'}
                </h1>
              )}
            </div>

            <button onClick={toggleTheme} className={`h-8 w-14 rounded-full ${s.chaveBg} relative shadow-inner flex-shrink-0`}><span className={`h-6 w-6 flex items-center justify-center rounded-full transition-all text-[10px] mt-1 ${s.chaveBola}`}>{s.icone}</span></button>
        </header>

        {children}

      </main>
    </div>
  )
}