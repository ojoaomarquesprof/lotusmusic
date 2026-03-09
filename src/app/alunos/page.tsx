"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'

export default function ListaAlunos() {
  const { s } = useStyles()
  const router = useRouter()
  
  const [alunos, setAlunos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'Ativo' | 'Inativo'>('Ativo')
  const [busca, setBusca] = useState('')

  useEffect(() => { carregarAlunos() }, [])

  async function carregarAlunos() {
    const { data } = await supabase.from('profiles').select('id, nome_completo, email, telefone, avatar_url, alunos_info(status, valor_mensalidade)').eq('role', 'ALUNO').order('nome_completo')
    setAlunos(data || []); setLoading(false)
  }

  const alunosFiltrados = alunos.filter(aluno => {
    const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info;
    const statusMatricula = info?.status || 'Ativo';
    return statusMatricula === filtroStatus && aluno.nome_completo?.toLowerCase().includes(busca.toLowerCase());
  })

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* TÍTULO LIMPO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Gestão de Alunos</h2>
          <p className={`${s.textMuted} text-xs font-bold uppercase tracking-widest mt-1`}>Todos os matriculados</p>
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-8">
        <div className={`flex p-1 rounded-2xl border ${s.card} shadow-inner`}>
          <button onClick={() => setFiltroStatus('Ativo')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] md:text-xs transition-all ${filtroStatus === 'Ativo' ? 'bg-indigo-600 text-white shadow-lg' : `${s.textMuted} hover:bg-slate-500/10`}`}>Matrículas Ativas</button>
          <button onClick={() => setFiltroStatus('Inativo')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] md:text-xs transition-all ${filtroStatus === 'Inativo' ? 'bg-rose-600 text-white shadow-lg' : `${s.textMuted} hover:bg-slate-500/10`}`}>Inativos</button>
        </div>
        <div className="w-full lg:w-96 relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50">🔍</span><input type="text" placeholder="Buscar aluno pelo nome..." value={busca} onChange={(e) => setBusca(e.target.value)} className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border font-bold text-sm shadow-sm transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${s.input}`} /></div>
      </div>

      {/* GRID DE ALUNOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {alunosFiltrados.map((aluno) => {
          const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info;
          return (
            <button key={aluno.id} onClick={() => router.push(`/alunos/${aluno.id}`)} className={`group ${s.cardInterno} p-6 rounded-[2rem] border text-left hover:shadow-2xl transition-all hover:-translate-y-1 relative overflow-hidden`}>
              <div className={`absolute left-0 top-0 bottom-0 w-2 ${filtroStatus === 'Ativo' ? 'bg-indigo-500' : 'bg-rose-500'} transition-colors`}></div>
              <div className="flex items-center gap-4 mb-4 pl-2">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xl font-black text-white shadow-md border-2 border-white/10 overflow-hidden flex-shrink-0">
                  {aluno.avatar_url ? <img src={aluno.avatar_url} alt="Foto" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} /> : aluno.nome_completo?.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="font-black text-lg truncate leading-tight uppercase group-hover:text-indigo-500 transition-colors">{aluno.nome_completo}</p>
                  <p className={`${s.textMuted} text-[10px] font-bold uppercase mt-1`}>{aluno.telefone || 'Sem telefone'}</p>
                </div>
              </div>
              <div className="pl-2 pt-4 border-t border-slate-500/10 flex justify-between items-center">
                <p className={`${s.textMuted} text-[9px] font-black uppercase`}>Mensalidade: <span className={filtroStatus === 'Ativo' ? 'text-emerald-500' : ''}>R$ {info?.valor_mensalidade || '0,00'}</span></p>
                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${filtroStatus === 'Ativo' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-rose-500/10 text-rose-500'}`}>{filtroStatus}</span>
              </div>
            </button>
          )
        })}
      </div>

      {alunosFiltrados.length === 0 && (
        <div className={`w-full py-16 rounded-[2rem] border border-dashed ${s.card} text-center flex flex-col items-center justify-center`}><span className="text-5xl mb-4 opacity-50 block">🕵️‍♂️</span><p className="font-black uppercase tracking-widest">Nenhum aluno encontrado</p></div>
      )}
    </div>
  )
}