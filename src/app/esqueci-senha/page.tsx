"use client"

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Pega a URL atual (funciona no localhost e quando for pro ar)
    const redirectUrl = `${window.location.origin}/redefinir-senha`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (error) {
      alert("Erro ao enviar o e-mail: " + error.message)
    } else {
      setSucesso(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
        
        {/* Detalhe de Design */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
            {sucesso ? '📬' : '🔑'}
          </div>
          <h2 className="text-2xl font-black uppercase italic text-slate-800 tracking-tight">Recuperar Acesso</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">
            {sucesso ? 'Verifique sua caixa de entrada' : 'Digite seu e-mail cadastrado'}
          </p>
        </div>

        {sucesso ? (
          <div className="text-center animate-in slide-in-from-bottom-4">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-6">
              <p className="text-xs font-black text-emerald-700 uppercase">E-mail enviado!</p>
              <p className="text-[10px] font-bold text-emerald-600 mt-1">Enviamos um link seguro para <strong>{email}</strong>. Clique nele para criar sua nova senha.</p>
            </div>
            <button onClick={() => router.push('/login')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:scale-[1.02] transition-all">
              Voltar para o Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRecuperar} className="space-y-6 relative z-10">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 block mb-2">E-mail da sua conta</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="exemplo@email.com" 
                className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all" 
              />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-500/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2">
              {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
            </button>
            <div className="text-center pt-4">
              <Link href="/login" className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors tracking-widest">
                ← Voltar e tentar logar
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}