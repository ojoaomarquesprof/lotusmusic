"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Phone,
  Search,
  UsersRound,
} from 'lucide-react'

// --- VARIÁVEIS DE ANIMAÇÃO EM CASCATA ---
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

export default function ListaAlunos() {
  const router = useRouter()
  
  // FIX DE HYDRATION DO NEXT.JS
  const [isMounted, setIsMounted] = useState(false)

  const [alunos, setAlunos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'Ativo' | 'Inativo'>('Ativo')
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState<'nome' | 'valor'>('nome')

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarAlunos() }, [isMounted])

  async function carregarAlunos() {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome_completo, email, telefone, avatar_url, alunos_info(status, valor_mensalidade, modelo_faturamento)')
      .eq('role', 'ALUNO')
      .order('nome_completo')
    setAlunos(data || []); setLoading(false)
  }

  const termoBusca = busca.trim().toLocaleLowerCase('pt-BR')
  const alunosFiltrados = alunos
    .filter(aluno => {
      const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info
      const statusMatricula = info?.status || 'Ativo'
      const conteudoBusca = [aluno.nome_completo, aluno.email, aluno.telefone]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
      return statusMatricula === filtroStatus && conteudoBusca.includes(termoBusca)
    })
    .sort((a, b) => {
      if (ordenacao === 'valor') {
        const infoA = Array.isArray(a.alunos_info) ? a.alunos_info[0] : a.alunos_info
        const infoB = Array.isArray(b.alunos_info) ? b.alunos_info[0] : b.alunos_info
        return Number(infoB?.valor_mensalidade || 0) - Number(infoA?.valor_mensalidade || 0)
      }
      return (a.nome_completo || '').localeCompare(b.nome_completo || '', 'pt-BR')
    })

  const totais = alunos.reduce(
    (acc, aluno) => {
      const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info
      const status = info?.status === 'Inativo' ? 'Inativo' : 'Ativo'
      acc[status] += 1
      return acc
    },
    { Ativo: 0, Inativo: 0 },
  )

  const billingLabels: Record<string, string> = {
    CREDITOS: 'Créditos',
    MENSAL_FECHADO: 'Mês fechado',
    VENCIMENTO_FIXO: 'Vencimento fixo',
  }

  function getInfo(aluno: any) {
    return Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info
  }

  function openStudent(id: string) {
    router.push(`/alunos/${id}`)
  }

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-12">

      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end mb-7 gap-4">
        <div>
          <div className="premium-kicker mb-2">Relacionamento</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">Alunos</h2>
          <p className="text-slate-500 text-sm mt-1.5">
            {totais.Ativo} matrícula{totais.Ativo === 1 ? '' : 's'} ativa{totais.Ativo === 1 ? '' : 's'}
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="premium-panel p-3 md:p-4 mb-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex p-1 rounded-xl bg-[#efeee9] overflow-x-auto w-full xl:w-auto">
            <button
              onClick={() => setFiltroStatus('Ativo')}
              className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${filtroStatus === 'Ativo' ? 'bg-white text-[#1f4a3a] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              aria-pressed={filtroStatus === 'Ativo'}
            >
              Ativos
              <span className="text-[10px] font-bold opacity-60">{totais.Ativo}</span>
            </button>
            <button
              onClick={() => setFiltroStatus('Inativo')}
              className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${filtroStatus === 'Inativo' ? 'bg-white text-[#8e4545] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              aria-pressed={filtroStatus === 'Inativo'}
            >
              Inativos
              <span className="text-[10px] font-bold opacity-60">{totais.Inativo}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="w-full sm:min-w-80 relative">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Buscar por nome, telefone ou e-mail"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-[#dfded7] font-medium text-sm text-slate-800 transition-all focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10 outline-none placeholder:text-slate-400"
              />
            </div>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as 'nome' | 'valor')}
              className="w-full sm:w-44 px-3.5 py-3 rounded-xl bg-white border border-[#dfded7] text-sm font-medium text-slate-600 outline-none"
              aria-label="Ordenar alunos"
            >
              <option value="nome">Nome A–Z</option>
              <option value="valor">Maior valor</option>
            </select>
          </div>
        </div>
      </motion.div>

      {alunosFiltrados.length > 0 ? (
        <>
          <motion.div variants={itemVariants} className="hidden md:block premium-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f3f2ed] border-b border-[#dfded7]">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Aluno</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Contato</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Faturamento</th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Valor base</th>
                    <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</th>
                    <th className="w-12" aria-label="Abrir perfil" />
                  </tr>
                </thead>
                <tbody>
                  {alunosFiltrados.map((aluno) => {
                    const info = getInfo(aluno)
                    return (
                      <tr
                        key={aluno.id}
                        tabIndex={0}
                        role="link"
                        aria-label={`Abrir perfil de ${aluno.nome_completo}`}
                        onClick={() => openStudent(aluno.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openStudent(aluno.id)
                          }
                        }}
                        className="group border-b border-[#ebe9e3] last:border-0 hover:bg-[#f7f7f3] focus:bg-[#f7f7f3] focus:outline-none cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#dfe9e3] text-[#1f4a3a] font-bold border border-[#d2ded6] overflow-hidden shrink-0">
                              {aluno.avatar_url ? (
                                <img
                                  src={aluno.avatar_url}
                                  alt=""
                                  className={`w-full h-full object-cover ${filtroStatus === 'Inativo' ? 'grayscale opacity-70' : ''}`}
                                  onError={(event) => { event.currentTarget.style.display = 'none' }}
                                />
                              ) : (
                                aluno.nome_completo?.charAt(0)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-slate-800 truncate max-w-64 group-hover:text-[#1f4a3a]">
                                {aluno.nome_completo}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-64">{aluno.email || 'E-mail não informado'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone size={14} className="text-slate-400" />
                            {aluno.telefone || 'Não informado'}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-600">
                          {billingLabels[info?.modelo_faturamento] || 'Vencimento fixo'}
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-semibold text-slate-800">
                          {Number(info?.valor_mensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold border ${filtroStatus === 'Ativo' ? 'bg-[#e7efe9] text-[#2d5a49] border-[#cfddd4]' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                            {filtroStatus}
                          </span>
                        </td>
                        <td className="pr-4 text-right">
                          <ChevronRight size={17} className="inline text-slate-300 group-hover:text-[#1f4a3a] group-hover:translate-x-0.5 transition-all" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          <div className="md:hidden space-y-3">
            {alunosFiltrados.map((aluno) => {
              const info = getInfo(aluno)
              return (
                <motion.button
                  variants={itemVariants}
                  key={aluno.id}
                  onClick={() => openStudent(aluno.id)}
                  className="premium-panel !rounded-2xl w-full p-4 text-left flex items-center gap-3.5"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#dfe9e3] text-[#1f4a3a] font-bold border border-[#d2ded6] overflow-hidden shrink-0">
                    {aluno.avatar_url ? (
                      <img
                        src={aluno.avatar_url}
                        alt=""
                        className={`w-full h-full object-cover ${filtroStatus === 'Inativo' ? 'grayscale opacity-70' : ''}`}
                        onError={(event) => { event.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      aluno.nome_completo?.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-800 truncate">{aluno.nome_completo}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{aluno.telefone || aluno.email || 'Contato não informado'}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-medium text-slate-500">
                      <span>{billingLabels[info?.modelo_faturamento] || 'Vencimento fixo'}</span>
                      <span aria-hidden="true">•</span>
                      <span className="font-semibold text-slate-700">
                        {Number(info?.valor_mensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 shrink-0" />
                </motion.button>
              )
            })}
          </div>
        </>
      ) : (
        <motion.div variants={itemVariants} className="premium-panel py-16 px-6 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center mb-4">
            <UsersRound size={22} strokeWidth={1.7} />
          </div>
          <p className="font-semibold text-slate-800 text-lg">Nenhum aluno encontrado</p>
          <p className="text-sm text-slate-500 mt-1">Tente outro termo ou altere o filtro.</p>
        </motion.div>
      )}

    </motion.div>
  )
}
