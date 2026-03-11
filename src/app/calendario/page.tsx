"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'

// --- VARIÁVEIS DE ANIMAÇÃO ---
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

export default function CalendarioEscolar() {
  const { s, toggleTheme } = useStyles()
  const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [eventos, setEventos] = useState<any[]>([])
  
  // ESTADOS DO FORMULÁRIO
  const [titulo, setTitulo] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [tipo, setTipo] = useState('Feriado') // Feriado, Recesso, Evento Especial

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarEventos() }, [isMounted])

  async function carregarEventos() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role === 'ALUNO') return router.push('/portal')

    const { data } = await supabase.from('eventos_calendario').select('*').order('data_evento', { ascending: true })
    setEventos(data || [])
    setLoading(false)
  }

  const handleAddEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const { error } = await supabase.from('eventos_calendario').insert([{
      titulo,
      data_evento: dataEvento,
      tipo
    }])

    if (error) {
      alert("Erro ao salvar evento: " + error.message)
    } else {
      setTitulo('')
      setDataEvento('')
      setTipo('Feriado')
      carregarEventos()
      alert("✅ Evento adicionado com sucesso ao calendário!")
    }
    setIsSubmitting(false)
  }

  const handleExcluirEvento = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este evento da agenda da escola?")) return
    await supabase.from('eventos_calendario').delete().eq('id', id)
    carregarEventos()
  }

  const getEmojiTipo = (tipo: string) => {
    if (tipo === 'Feriado') return '🏖️'
    if (tipo === 'Recesso') return '⏸️'
    return '⭐' 
  }

  const getCorTipo = (tipo: string) => {
    if (tipo === 'Feriado') return 'bg-rose-50/80 border-rose-200 text-rose-700'
    if (tipo === 'Recesso') return 'bg-amber-50/80 border-amber-200 text-amber-800'
    return 'bg-indigo-50/80 border-indigo-200 text-indigo-700'
  }

  // Classes Globais de Inputs
  const inputClass = "w-full p-3.5 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-medium focus:bg-white/80 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none shadow-inner placeholder:text-slate-400 mt-1";

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  const hojeStr = new Date().toISOString().split('T')[0]
  const eventosFuturos = eventos.filter(e => e.data_evento >= hojeStr)
  const eventosPassados = eventos.filter(e => e.data_evento < hojeStr).reverse() 

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-12 w-full max-w-7xl mx-auto">
      
      <motion.div variants={itemVariants} className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Calendário Escolar</h2>
        <p className={`text-slate-500 text-sm mt-1`}>Feriados, Recessos e Eventos</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO DE CADASTRO */}
        <div className="xl:col-span-1">
          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] sticky top-6`}>
            <div className="mb-6 border-b border-white/60 pb-6">
              <h3 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-3 mb-2"><span className="text-indigo-500 text-2xl drop-shadow-sm">📅</span> Novo Evento</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Atenção: Ao cadastrar <span className="text-rose-500 font-bold">Feriados</span> ou <span className="text-amber-500 font-bold">Recessos</span>, a grade de aulas daquele dia será automaticamente bloqueada no Painel Central e no app do aluno.
              </p>
            </div>

            <form onSubmit={handleAddEvento} className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 ml-1">O que vai acontecer?</label>
                <input required placeholder="Ex: Feriado de Tiradentes" value={titulo} onChange={e => setTitulo(e.target.value)} className={inputClass} />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-slate-600 ml-1">Data</label>
                <input type="date" required value={dataEvento} onChange={e => setDataEvento(e.target.value)} className={inputClass} />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-slate-600 ml-1">Tipo de Evento</label>
                <select required value={tipo} onChange={e => setTipo(e.target.value)} className={inputClass}>
                  <option value="Feriado">🏖️ Feriado (Bloqueia Grade)</option>
                  <option value="Recesso">⏸️ Recesso Escolar (Bloqueia Grade)</option>
                  <option value="Apresentação">⭐ Evento Especial / Apresentação</option>
                </select>
              </div>

              <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isSubmitting} className="w-full py-4 mt-6 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                {isSubmitting ? 'Salvando...' : '+ Cadastrar no Calendário'}
              </motion.button>
            </form>
          </motion.div>
        </div>

        {/* COLUNA DIREITA: LISTA DE EVENTOS */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* EVENTOS FUTUROS */}
          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
            <h3 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-3 mb-6"><span className="text-emerald-500 drop-shadow-sm">🗓️</span> Próximas Datas</h3>
            
            {eventosFuturos.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-slate-300 rounded-[2rem] bg-white/30 opacity-80">
                <span className="text-5xl block mb-3 grayscale">👀</span>
                <p className="font-bold text-slate-700 text-base tracking-tight">A agenda está limpa.</p>
                <p className="text-sm font-medium text-slate-500 mt-1">Nenhum evento futuro programado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {eventosFuturos.map(ev => (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} whileHover={{ y: -4 }} key={ev.id} className={`p-5 rounded-2xl border backdrop-blur-sm shadow-sm relative group overflow-hidden transition-all ${getCorTipo(ev.tipo)}`}>
                      <div className="absolute -right-4 -top-4 text-7xl opacity-10 pointer-events-none drop-shadow-sm">{getEmojiTipo(ev.tipo)}</div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-3 py-1 bg-white/80 border border-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">{ev.tipo}</span>
                          <button onClick={() => handleExcluirEvento(ev.id)} className="h-8 w-8 bg-white/80 text-rose-500 border border-rose-100 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Apagar Evento">✖</button>
                        </div>
                        <p className="font-bold text-lg tracking-tight leading-tight mb-1">{ev.titulo}</p>
                        <p className="text-xs font-semibold opacity-80 flex items-center gap-1.5 mt-2">
                          <span className="text-sm">📅</span> {new Date(ev.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* HISTÓRICO (EVENTOS PASSADOS) */}
          {eventosPassados.length > 0 && (
            <motion.div variants={itemVariants} className={`bg-white/30 backdrop-blur-md border border-white/40 p-8 rounded-[2.5rem] shadow-sm opacity-80 hover:opacity-100 transition-opacity`}>
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2 mb-6 text-slate-500"><span className="drop-shadow-sm">⏱️</span> Eventos Passados</h3>
              <div className="space-y-3">
                {eventosPassados.map(ev => (
                  <div key={ev.id} className={`bg-white/50 border border-white/60 p-4 rounded-xl flex justify-between items-center group shadow-sm transition-all hover:shadow-md`}>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl grayscale opacity-60">{getEmojiTipo(ev.tipo)}</span>
                      <div>
                        <p className="font-bold text-sm text-slate-600 line-through decoration-slate-300">{ev.titulo}</p>
                        <p className="text-xs font-medium text-slate-400 mt-0.5">{new Date(ev.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                      </div>
                    </div>
                    <button onClick={() => handleExcluirEvento(ev.id)} className="h-8 w-8 bg-rose-50 text-rose-500 border border-rose-100 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm">✖</button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </motion.div>
  )
}