"use client"

import { Inter } from 'next/font/google'
import './globals.css'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [config, setConfig] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  // Esconde a barra lateral nas telas do aluno ou de login
  const hideSidebar = pathname === '/login' || pathname === '/portal' || pathname.startsWith('/portal')

  // Busca a logo oficial da escola e os dados do Diretor logado
  useEffect(() => {
    if (!hideSidebar) {
      carregarDadosLayout()
    }
  }, [hideSidebar])

  async function carregarDadosLayout() {
    const { data: conf } = await supabase.from('configuracoes').select('logo_url, nome_escola').eq('id', 1).single()
    if (conf) setConfig(conf)

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: profile } = await supabase.from('profiles').select('nome_completo, role').eq('id', session.user.id).single()
      setUser(profile)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <html lang="pt-BR">
      <head>
        <title>Lótus Music</title>
        <meta name="description" content="Sistema de Gestão Lótus Music" />
        
        {/* PODERES DE APLICATIVO (PWA) */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      
      <body className={`${inter.className} bg-slate-50 text-slate-900 flex min-h-screen overflow-hidden`}>
        
        {!hideSidebar && (
          <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 shadow-lg z-50">
            
            {/* ÁREA DA LOGO OFICIAL */}
            <div className="p-6 flex justify-center items-center border-b border-slate-100 h-28">
              {config?.logo_url ? (
                <img src={config.logo_url} alt="Logo Lótus Music" className="max-h-full max-w-full object-contain drop-shadow-sm" />
              ) : (
                <div className="text-center">
                  <h1 className="font-black text-xl italic text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-700">Lótus Music</h1>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Escola de Música</p>
                </div>
              )}
            </div>
            
            {/* NAVEGAÇÃO */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
              <a href="/" className={`flex items-center gap-3 p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${pathname === '/' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                <span className="text-xl">🏠</span> Painel Central
              </a>
              <a href="/alunos" className={`flex items-center gap-3 p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${pathname.startsWith('/alunos') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                <span className="text-xl">👥</span> Gestão de Alunos
              </a>
              <a href="/financeiro" className={`flex items-center gap-3 p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${pathname.startsWith('/financeiro') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                <span className="text-xl">💳</span> Financeiro
              </a>
              <a href="/calendario" className={`flex items-center gap-3 p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${pathname.startsWith('/calendario') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                <span className="text-xl">📅</span> Calendário
              </a>
              <a href="/gerencia" className={`flex items-center gap-3 p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${pathname.startsWith('/gerencia') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:bg-slate-50'}`}>
                <span className="text-xl">⚙️</span> Gerência / Setup
              </a>
            </nav>

            {/* PERFIL DO USUÁRIO E SAÍDA */}
            <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="overflow-hidden pr-2">
                <p className="font-black text-xs uppercase text-slate-800 truncate" title={user?.nome_completo}>{user?.nome_completo || 'Carregando...'}</p>
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{user?.role === 'ADMIN' ? 'Diretor' : 'Professor'}</p>
              </div>
              <button onClick={handleLogout} className="h-10 w-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 shadow-sm transition-all flex-shrink-0" title="Sair do Sistema">
                🚪
              </button>
            </div>
          </aside>
        )}

        {/* O MIOLO DO SISTEMA: AGORA COM OS ESPAÇAMENTOS (PADDING) RESTAURADOS */}
        <main className={`flex-1 w-full relative h-screen overflow-y-auto bg-slate-50/50 ${!hideSidebar ? 'p-6 md:p-10' : ''}`}>
          {children}
        </main>

        {/* MOTOR INVISÍVEL DO PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('App Lótus Pronto: ', registration.scope);
                  }, function(err) {
                    console.log('Erro no App: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}