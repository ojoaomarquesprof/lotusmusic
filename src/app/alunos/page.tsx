"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'

// --- VARIÁVEIS DE ANIMAÇÃO EM CASCATA ---
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

export default function ListaAlunos() {
  const { s } = useStyles()
  const router = useRouter()
  
  // FIX DE HYDRATION DO NEXT.JS
  const [isMounted, setIsMounted] = useState(false)

  const [alunos, setAlunos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'Ativo' | 'Inativo'>('Ativo')
  const [busca, setBusca] = useState('')

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarAlunos() }, [isMounted])

  async function carregarAlunos() {
    const { data } = await supabase.from('profiles').select('id, nome_completo, email, telefone, avatar_url, alunos_info(status, valor_mensalidade)').eq('role', 'ALUNO').order('nome_completo')
    setAlunos(data || []); setLoading(false)
  }

  const alunosFiltrados = alunos.filter(aluno => {
    const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info;
    const statusMatricula = info?.status || 'Ativo';
    return statusMatricula === filtroStatus && aluno.nome_completo?.toLowerCase().includes(busca.toLowerCase());
  })

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-12">
      
      {/* TÍTULO LIMPO E MODERNO */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">Gestão de Alunos</h2>
          <p className={`text-slate-500 text-sm mt-1`}>Todos os matriculados</p>
        </div>
      </motion.div>

      {/* FILTROS E BUSCA COM VIDRO */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-8">
        <div className={`flex p-1.5 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-inner`}>
          <button 
            onClick={() => setFiltroStatus('Ativo')} 
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${filtroStatus === 'Ativo' ? 'bg-indigo-500 text-white shadow-md' : `text-slate-600 hover:bg-white/60`}`}
          >
            Matrículas Ativas
          </button>
          <button 
            onClick={() => setFiltroStatus('Inativo')} 
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${filtroStatus === 'Inativo' ? 'bg-rose-500 text-white shadow-md' : `text-slate-600 hover:bg-white/60`}`}
          >
            Inativos
          </button>
        </div>
        
        <div className="w-full lg:w-96 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-lg">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar aluno pelo nome..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/50 backdrop-blur-md border border-white/60 font-medium text-sm text-slate-800 shadow-inner transition-all focus:bg-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none placeholder:text-slate-400`} 
          />
        </div>
      </motion.div>

      {/* GRID DE ALUNOS COM EFEITO CASCATA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {alunosFiltrados.map((aluno) => {
            const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info;
            return (
              <motion.button 
                variants={itemVariants}
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={aluno.id} 
                onClick={() => router.push(`/alunos/${aluno.id}`)} 
                className={`group bg-white/60 backdrop-blur-md border border-white/80 p-6 rounded-[2rem] text-left shadow-sm hover:shadow-xl transition-all relative overflow-hidden flex flex-col justify-between h-full`}
              >
                {/* Linha colorida lateral (agora mais sutil) */}
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${filtroStatus === 'Ativo' ? 'bg-indigo-400' : 'bg-rose-400'} opacity-80 group-hover:opacity-100 transition-colors`}></div>
                
                <div className="flex items-center gap-4 mb-4 pl-2">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-md border-2 border-white overflow-hidden flex-shrink-0 ${filtroStatus === 'Ativo' ? 'bg-gradient-to-br from-indigo-100 to-cyan-50 text-indigo-600' : 'bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600'}`}>
                    {aluno.avatar_url ? (
                      <img src={aluno.avatar_url} alt="Foto" className={`w-full h-full object-cover ${filtroStatus === 'Inativo' ? 'grayscale opacity-70' : ''}`} onError={(e) => e.currentTarget.style.display = 'none'} />
                    ) : (
                      aluno.nome_completo?.charAt(0)
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className={`font-bold text-base truncate leading-tight transition-colors ${filtroStatus === 'Ativo' ? 'text-slate-800 group-hover:text-indigo-600' : 'text-slate-600 group-hover:text-rose-600'}`}>
                      {aluno.nome_completo}
                    </p>
                    <p className={`text-slate-500 text-[11px] font-medium mt-1`}>{aluno.telefone || 'Sem telefone'}</p>
                  </div>
                </div>
                
                <div className="pl-2 pt-4 border-t border-white/60 flex justify-between items-center mt-auto">
                  <p className={`text-slate-500 text-[10px] font-semibold uppercase tracking-wider`}>
                    Mensalidade: <span className={filtroStatus === 'Ativo' ? 'text-emerald-600 font-bold' : 'font-bold text-slate-600'}>R$ {info?.valor_mensalidade || '0,00'}</span>
                  </p>
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-bold shadow-sm border ${filtroStatus === 'Ativo' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {filtroStatus}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      {/* ESTADO VAZIO (NENHUM ALUNO ENCONTRADO) */}
      {alunosFiltrados.length === 0 && (
        <motion.div variants={itemVariants} className={`w-full py-16 rounded-[2rem] border border-dashed border-slate-300 bg-white/40 backdrop-blur-md text-center flex flex-col items-center justify-center shadow-sm mt-4`}>
          <span className="text-5xl mb-4 opacity-50 block grayscale">🕵️‍♂️</span>
          <p className="font-bold text-slate-700 text-lg tracking-tight">Nenhum aluno encontrado</p>
          <p className="text-sm font-medium text-slate-500 mt-1">Tente buscar por outro nome ou mude o filtro.</p>
        </motion.div>
      )}

    </motion.div>
  )
}