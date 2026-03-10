"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image' // 👈 Importando o componente otimizado do Next.js
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()

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
    <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden z-0">
      
      {/* BOLHAS ANIMADAS DE FUNDO */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-slate-50">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-indigo-300/40 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-cyan-300/40 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* CONTAINER PRINCIPAL COM VIDRO FOSCO */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
        className="bg-white/40 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] w-full max-w-sm relative"
      >
        
        {/* CABEÇALHO COM A LOGO FIXA */}
        <div className="flex flex-col items-center justify-center mb-8 text-center min-h-[120px]">
          
          {/* 👇 Aqui a logo é chamada direto da pasta public (ex: public/logo.png) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative w-full max-w-[200px] h-24 mb-2"
          >
            <Image 
              src="/logo.png" // ⚠️ Coloque o arquivo da sua logo na pasta "public" com este nome!
              alt="Logo do Sistema" 
              fill
              className="object-contain drop-shadow-md"
              priority // Carrega a imagem mais rápido por ser a tela de login
            />
          </motion.div>

          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-3 bg-white/50 border border-white/60 backdrop-blur-sm px-4 py-1.5 rounded-full inline-block shadow-sm">
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
              className="w-full p-4 rounded-xl bg-white/50 border border-white/50 text-slate-900 font-bold focus:border-indigo-500/50 focus:bg-white/80 focus:ring-4 focus:ring-indigo-500/10 mt-1 transition-all outline-none shadow-inner" 
            />
          </div>
          
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
            <input 
              type="password" 
              required 
              value={senha} 
              onChange={(e) => setSenha(e.target.value)} 
              className="w-full p-4 rounded-xl bg-white/50 border border-white/50 text-slate-900 font-bold focus:border-indigo-500/50 focus:bg-white/80 focus:ring-4 focus:ring-indigo-500/10 mt-1 transition-all outline-none shadow-inner" 
            />
          </div>

          <div className="flex justify-end mt-2">
            <Link 
              href="/esqueci-senha"
              className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 transition-colors tracking-widest"
            >
              Esqueceu a senha?
            </Link>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={loading} 
            className="w-full py-4 mt-4 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-black uppercase text-xs rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:hover:y-0"
          >
            {loading ? 'Validando Acesso...' : 'Entrar no Sistema'}
          </motion.button>
        </form>

      </motion.div>
    </div>
  )
}