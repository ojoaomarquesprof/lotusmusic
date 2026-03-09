"use client"

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function RedefinirSenha() {
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSalvarNovaSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // O Supabase atualiza a senha do usuário que clicou no link do e-mail
    const { error } = await supabase.auth.updateUser({ password: senha })

    if (error) {
      alert("Erro ao atualizar senha: " + error.message)
    } else {
      alert("✅ Senha atualizada com sucesso! Você já pode acessar seu portal.")
      router.push('/portal')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Detalhe de Design */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px]"></div>

      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
            🔒
          </div>
          <h2 className="text-2xl font-black uppercase italic text-slate-800 tracking-tight">Nova Senha</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">
            Crie uma nova senha de acesso
          </p>
        </div>

        <form onSubmit={handleSalvarNovaSenha} className="space-y-6">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 block mb-2">Digite sua nova senha</label>
            <input 
              type="password" 
              required 
              minLength={6}
              value={senha} 
              onChange={e => setSenha(e.target.value)} 
              placeholder="Mínimo 6 caracteres" 
              className="w-full p-4 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all" 
            />
          </div>
          
          <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-emerald-500/30 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Salvando...' : 'Salvar e Entrar no Portal'}
          </button>
        </form>
      </div>
    </div>
  )
}