"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'

export default function CalendarioEscolar() {
  const { s, toggleTheme } = useStyles()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [eventos, setEventos] = useState<any[]>([])
  
  // ESTADOS DO FORMULÁRIO
  const [titulo, setTitulo] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [tipo, setTipo] = useState('Feriado') // Feriado, Recesso, Evento Especial

  useEffect(() => { carregarEventos() }, [])

  async function carregarEventos() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role === 'ALUNO') return router.push('/portal')

    // Busca eventos ordenados da data mais próxima para a mais distante
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
    return '⭐' // Evento Especial/Apresentação
  }

  const getCorTipo = (tipo: string) => {
    if (tipo === 'Feriado') return 'text-rose-500 bg-rose-50 border-rose-200'
    if (tipo === 'Recesso') return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-indigo-600 bg-indigo-50 border-indigo-200'
  }

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  const hojeStr = new Date().toISOString().split('T')[0]
  const eventosFuturos = eventos.filter(e => e.data_evento >= hojeStr)
  const eventosPassados = eventos.filter(e => e.data_evento < hojeStr).reverse() // Passados mostram do mais recente para o mais antigo

  return (
    <div className="animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      
      <div className="mb-10">
        <h2 className="text-3xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Calendário Escolar</h2>
        <p className={`${s.textMuted} text-xs font-bold uppercase tracking-widest mt-1`}>Feriados, Recessos e Eventos</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO DE CADASTRO */}
        <div className="xl:col-span-1">
          <div className={`${s.card} p-8 rounded-[2.5rem] border shadow-xl sticky top-6`}>
            <div className="mb-6 border-b border-slate-500/10 pb-6">
              <h3 className="text-lg font-black uppercase flex items-center gap-3 mb-2"><span className="text-indigo-500 text-2xl">📅</span> Novo Evento</h3>
              <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                Atenção: Ao cadastrar <span className="text-rose-500 font-black">Feriados</span> ou <span className="text-amber-500 font-black">Recessos</span>, a grade de aulas daquele dia será automaticamente bloqueada no Painel Central e no app do aluno.
              </p>
            </div>

            <form onSubmit={handleAddEvento} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">O que vai acontecer?</label>
                <input required placeholder="Ex: Feriado de Tiradentes" value={titulo} onChange={e => setTitulo(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} />
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Data</label>
                <input type="date" required value={dataEvento} onChange={e => setDataEvento(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} />
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Tipo de Evento</label>
                <select required value={tipo} onChange={e => setTipo(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-black mt-1 ${s.input}`}>
                  <option value="Feriado">🏖️ Feriado Nacional/Local (Bloqueia Grade)</option>
                  <option value="Recesso">⏸️ Recesso da Escola (Bloqueia Grade)</option>
                  <option value="Apresentação">⭐ Evento Especial / Apresentação</option>
                </select>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-500/30 hover:scale-[1.02] transition-all disabled:opacity-50">
                {isSubmitting ? 'Salvando...' : '+ Cadastrar no Calendário'}
              </button>
            </form>
          </div>
        </div>

        {/* COLUNA DIREITA: LISTA DE EVENTOS */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* EVENTOS FUTUROS */}
          <div className={`${s.card} p-8 md:p-10 rounded-[2.5rem] border shadow-xl`}>
            <h3 className="text-xl font-black uppercase flex items-center gap-3 mb-6"><span className="text-emerald-500">🗓️</span> Próximas Datas</h3>
            
            {eventosFuturos.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-500/20 rounded-3xl opacity-50">
                <span className="text-5xl block mb-3">👀</span>
                <p className="font-black uppercase text-sm">A agenda está limpa.</p>
                <p className="text-[10px] font-bold tracking-widest mt-1">Nenhum evento futuro programado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eventosFuturos.map(ev => (
                  <div key={ev.id} className={`p-5 rounded-2xl border-2 flex flex-col justify-between shadow-sm relative group overflow-hidden ${getCorTipo(ev.tipo)}`}>
                    <div className="absolute -right-4 -top-4 text-7xl opacity-10 pointer-events-none">{getEmojiTipo(ev.tipo)}</div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-3 py-1 bg-white/60 rounded-lg text-[9px] font-black uppercase tracking-widest backdrop-blur-sm shadow-sm">{ev.tipo}</span>
                        <button onClick={() => handleExcluirEvento(ev.id)} className="h-8 w-8 bg-white/50 text-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all backdrop-blur-sm shadow-sm" title="Apagar Evento">✖</button>
                      </div>
                      <p className="font-black text-lg tracking-tight leading-tight mb-1">{ev.titulo}</p>
                      <p className="text-xs font-bold opacity-80 flex items-center gap-1"><span>📅</span> {new Date(ev.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HISTÓRICO (EVENTOS PASSADOS) */}
          {eventosPassados.length > 0 && (
            <div className={`${s.card} p-8 rounded-[2.5rem] border shadow-sm opacity-70 hover:opacity-100 transition-opacity`}>
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-6 text-slate-400"><span>⏱️</span> Eventos Passados</h3>
              <div className="space-y-3">
                {eventosPassados.map(ev => (
                  <div key={ev.id} className={`${s.cardInterno} p-4 rounded-xl border flex justify-between items-center group`}>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl grayscale opacity-50">{getEmojiTipo(ev.tipo)}</span>
                      <div>
                        <p className="font-black text-sm uppercase text-slate-600 line-through decoration-slate-300">{ev.titulo}</p>
                        <p className="text-[10px] font-bold text-slate-400">{new Date(ev.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                      </div>
                    </div>
                    <button onClick={() => handleExcluirEvento(ev.id)} className="h-8 w-8 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm">✖</button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}