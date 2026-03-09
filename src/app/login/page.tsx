"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const router = useRouter()

  // Busca os dados da escola assim que a tela abre
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
      // Verifica qual é o "Cargo" (Role) da pessoa logada
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
      
      // Redirecionamento Inteligente
      if (profile?.role === 'ALUNO') {
        router.push('/portal')
      } else {
        router.push('/')
      }
    }
  }

  return (
    // Fundo sempre claro (bg-slate-50)
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      
      {/* Cartão Branco de Login */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* CABEÇALHO (LOGO OU NOME) */}
        <div className="flex flex-col items-center justify-center mb-8 text-center min-h-[100px]">
          {config?.logo_url ? (
            <img src={config.logo_url} alt="Logo da Escola" className="h-24 w-full max-w-[200px] object-contain drop-shadow-sm" />
          ) : (
            <>
              <span className="text-5xl block mb-2 text-indigo-500">🎵</span>
              <h1 className="text-2xl font-black text-slate-900 uppercase italic leading-tight">
                {config?.nome_escola || 'Acesso ao Sistema'}
              </h1>
            </>
          )}
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 bg-slate-100 px-3 py-1 rounded-full">
            Área Restrita
          </p>
        </div>
        
        {/* FORMULÁRIO */}
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
          {/* Adicione isso embaixo do campo de senha no seu login/page.tsx */}
            <div className="flex justify-end mt-2">
              <a href="/esqueci-senha" className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-700 transition-colors tracking-widest">
                Esqueceu a senha?
              </a>
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