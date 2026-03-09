"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<any>(null)
  
  // 👇 Estado para controlar se a imagem da logo quebrou no carregamento
  const [erroLogo, setErroLogo] = useState(false) 
  const router = useRouter()

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('configuracoes').select('nome_escola, logo_url').eq('id', 1).single()
      setConfig(data)
    }
    loadConfig()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (authError) {
      alert('Erro: E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    if (authData.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
      if (profile?.role === 'ALUNO') {
        router.push('/portal')
      } else {
        router.push('/')
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-2xl w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* CABEÇALHO COM PROTEÇÃO CONTRA IMAGEM QUEBRADA */}
        <div className="flex flex-col items-center justify-center mb-8 text-center min-h-[120px]">
          {config?.logo_url && !erroLogo ? (
            <img 
              src={config.logo_url} 
              alt="Logo da Escola" 
              onError={() => setErroLogo(true)} // 👈 Se a imagem der erro, ele exibe o fallback
              className="h-28 w-full max-w-[220px] object-contain drop-shadow-sm mb-2" 
            />
          ) : (
            <>
              <span className="text-5xl block mb-2 text-indigo-500">🎵</span>
              <h1 className="text-2xl font-black text-slate-900 uppercase italic leading-tight">
                {config?.nome_escola || 'Acesso ao Sistema'}
              </h1>
            </>
          )}
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-3 bg-slate-100 px-4 py-1.5 rounded-full inline-block">
            Área Restrita
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 mt-1 transition-all outline-none" 
            />
          </div>
          
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
            <input 
              type="password" 
              required 
              value={senha} 
              onChange={(e) => setSenha(e.target.value)} 
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 mt-1 transition-all outline-none" 
            />
          </div>

          <div className="flex justify-end mt-2">
            {/* 👇 USANDO O COMPONENTE LINK OFICIAL DO NEXT.JS */}
            <Link 
              href="/esqueci-senha"
              className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-700 transition-colors tracking-widest"
            >
              Esqueceu a senha?
            </Link>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-4 mt-4 bg-indigo-600 text-white font-black uppercase text-xs rounded-2xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Validando Acesso...' : 'Entrar no Sistema'}
          </button>
        </form>

      </div>
    </div>
  )
}