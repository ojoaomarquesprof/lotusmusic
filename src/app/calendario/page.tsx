"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpenCheck,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  History,
  PauseCircle,
  Plus,
  Star,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatEventDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  })
}

function getEventStyle(tipo: string): {
  Icon: LucideIcon
  dot: string
  chip: string
  icon: string
} {
  if (tipo === 'Feriado') {
    return {
      Icon: CalendarOff,
      dot: 'bg-rose-500',
      chip: 'bg-rose-50 text-rose-700 border-rose-100',
      icon: 'bg-rose-50 text-rose-700',
    }
  }
  if (tipo === 'Recesso') {
    return {
      Icon: PauseCircle,
      dot: 'bg-amber-500',
      chip: 'bg-amber-50 text-amber-800 border-amber-100',
      icon: 'bg-amber-50 text-amber-700',
    }
  }
  return {
    Icon: Star,
    dot: 'bg-[#1f4a3a]',
    chip: 'bg-[#e7efe9] text-[#2d5a49] border-[#cfddd4]',
    icon: 'bg-[#e7efe9] text-[#1f4a3a]',
  }
}

export default function CalendarioEscolar() {
  const router = useRouter()

  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [eventos, setEventos] = useState<any[]>([])
  const [mesVisivel, setMesVisivel] = useState(() => new Date())
  const [formOpen, setFormOpen] = useState(false)

  const [historicoAulas, setHistoricoAulas] = useState<any[]>([])
  const [historicoPage, setHistoricoPage] = useState(0)
  const [hasMoreHistorico, setHasMoreHistorico] = useState(false)
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [tipo, setTipo] = useState('Feriado')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted) carregarDados()
  }, [isMounted])

  async function carregarDados() {
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    if (profile?.role === 'ALUNO') {
      router.push('/portal')
      return
    }

    await Promise.all([fetchEventos(), fetchHistorico(0)])
    setHistoricoPage(0)
    setLoading(false)
  }

  async function fetchEventos() {
    const { data } = await supabase
      .from('eventos_calendario')
      .select('*')
      .order('data_evento', { ascending: true })
    setEventos(data || [])
  }

  async function fetchHistorico(pageIndex: number) {
    setLoadingHistorico(true)
    const limite = 10
    const from = pageIndex * limite
    const to = from + limite - 1

    const { data, count } = await supabase
      .from('historico_aulas')
      .select('*, aluno:profiles!aluno_id(nome_completo)', { count: 'exact' })
      .order('id', { ascending: false })
      .range(from, to)

    setHistoricoAulas(data || [])
    setHasMoreHistorico(count !== null && to + 1 < count)
    setLoadingHistorico(false)
  }

  function openEventForm(date?: Date) {
    setTitulo('')
    setTipo('Feriado')
    setDataEvento(date ? toDateKey(date) : '')
    setFormOpen(true)
  }

  async function handleAddEvento(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    const { error } = await supabase.from('eventos_calendario').insert([
      {
        titulo: titulo.trim(),
        data_evento: dataEvento,
        tipo,
      },
    ])

    if (error) {
      alert(`Erro ao salvar evento: ${error.message}`)
    } else {
      setFormOpen(false)
      await fetchEventos()
    }
    setIsSubmitting(false)
  }

  async function handleExcluirEvento(id: string) {
    if (!confirm('Apagar este evento do calendário da escola?')) return
    await supabase.from('eventos_calendario').delete().eq('id', id)
    await fetchEventos()
  }

  function changeMonth(offset: number) {
    setMesVisivel(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    )
  }

  const hojeStr = isMounted ? toDateKey(new Date()) : ''
  const eventosFuturos = eventos.filter((event) => event.data_evento >= hojeStr)
  const eventosPassados = eventos
    .filter((event) => event.data_evento < hojeStr)
    .reverse()

  const calendario = useMemo(() => {
    const year = mesVisivel.getFullYear()
    const month = mesVisivel.getMonth()
    const firstDay = new Date(year, month, 1)
    const mondayOffset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const totalCells = mondayOffset + daysInMonth <= 35 ? 35 : 42
    const startDate = new Date(year, month, 1 - mondayOffset)

    return Array.from({ length: totalCells }, (_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)
      const key = toDateKey(date)
      return {
        date,
        key,
        currentMonth: date.getMonth() === month,
        events: eventos.filter((event) => event.data_evento === key),
      }
    })
  }, [eventos, mesVisivel])

  const eventosDoMes = eventos.filter((event) => {
    const date = new Date(`${event.data_evento}T12:00:00`)
    return (
      date.getFullYear() === mesVisivel.getFullYear() &&
      date.getMonth() === mesVisivel.getMonth()
    )
  })

  const monthLabel = mesVisivel.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  if (!isMounted) return null
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#1f4a3a]" />
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="pb-12 w-full max-w-[1500px] mx-auto"
    >
      <motion.header
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-7"
      >
        <div>
          <div className="premium-kicker mb-2">Planejamento</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            Calendário escolar
          </h2>
          <p className="text-slate-500 text-sm mt-1.5">
            Feriados, recessos e eventos que impactam a rotina da escola.
          </p>
        </div>
        <button
          onClick={() => openEventForm()}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#1f4a3a] text-white text-sm font-semibold shadow-[0_10px_24px_rgba(31,74,58,0.18)] hover:bg-[#173c2e] transition-colors"
        >
          <Plus size={17} />
          Novo evento
        </button>
      </motion.header>

      <motion.section variants={itemVariants} className="premium-panel overflow-hidden">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 border-b border-[#dfded7]">
          <div className="flex items-center gap-2">
            <button
              aria-label="Mês anterior"
              onClick={() => changeMonth(-1)}
              className="h-10 w-10 rounded-xl border border-[#dfded7] bg-white text-slate-600 flex items-center justify-center hover:bg-[#e7efe9] hover:text-[#1f4a3a] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Próximo mês"
              onClick={() => changeMonth(1)}
              className="h-10 w-10 rounded-xl border border-[#dfded7] bg-white text-slate-600 flex items-center justify-center hover:bg-[#e7efe9] hover:text-[#1f4a3a] transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setMesVisivel(new Date())}
              className="ml-1 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-[#efeee9] transition-colors"
            >
              Hoje
            </button>
          </div>
          <h3 className="text-lg font-semibold capitalize text-slate-800 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            {monthLabel}
          </h3>
          <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Feriado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Recesso
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1f4a3a]" /> Evento
            </span>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-7 bg-[#f3f2ed] border-b border-[#dfded7]">
          {weekDays.map((day) => (
            <div
              key={day}
              className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 border-r border-[#e4e2dc] last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="hidden md:grid grid-cols-7">
          {calendario.map((day, index) => (
            <button
              key={day.key}
              onClick={() => openEventForm(day.date)}
              aria-label={`Adicionar evento em ${formatEventDate(day.key)}`}
              className={`min-h-28 p-2.5 text-left border-r border-b border-[#ebe9e3] hover:bg-[#f7f7f3] focus:bg-[#f7f7f3] focus:outline-none transition-colors ${
                (index + 1) % 7 === 0 ? 'border-r-0' : ''
              } ${day.currentMonth ? 'bg-white' : 'bg-[#faf9f6] text-slate-300'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`h-7 min-w-7 px-1 rounded-full flex items-center justify-center text-xs font-semibold ${
                    day.key === hojeStr
                      ? 'bg-[#1f4a3a] text-white'
                      : day.currentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                  }`}
                >
                  {day.date.getDate()}
                </span>
                {day.events.length > 2 && (
                  <span className="text-[9px] font-semibold text-slate-400">
                    +{day.events.length - 2}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {day.events.slice(0, 2).map((event) => {
                  const style = getEventStyle(event.tipo)
                  return (
                    <div
                      key={event.id}
                      className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold truncate ${style.chip}`}
                      title={event.titulo}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${style.dot}`} />
                      {event.titulo}
                    </div>
                  )
                })}
              </div>
            </button>
          ))}
        </div>

        <div className="md:hidden divide-y divide-[#ebe9e3]">
          {eventosDoMes.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <CalendarDays size={24} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Nenhum evento neste mês</p>
              <p className="text-xs text-slate-500 mt-1">Use “Novo evento” para adicionar uma data.</p>
            </div>
          ) : (
            eventosDoMes.map((event) => {
              const style = getEventStyle(event.tipo)
              const Icon = style.Icon
              return (
                <div key={event.id} className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${style.icon}`}>
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-800 truncate">{event.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatEventDate(event.data_evento, { weekday: 'short' })} · {event.tipo}
                    </p>
                  </div>
                  <button
                    aria-label={`Apagar ${event.titulo}`}
                    onClick={() => handleExcluirEvento(event.id)}
                    className="h-9 w-9 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </motion.section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 mt-6">
        <motion.section variants={itemVariants} className="premium-panel overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-[#dfded7]">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2.5">
                <BookOpenCheck size={19} className="text-[#1f4a3a]" />
                Diário recente
              </h3>
              <p className="text-xs text-slate-500 mt-1">Últimas aulas lançadas no sistema.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400 mr-1">
                Página {historicoPage + 1}
              </span>
              <button
                aria-label="Página anterior do diário"
                disabled={historicoPage === 0 || loadingHistorico}
                onClick={() => {
                  const nextPage = historicoPage - 1
                  setHistoricoPage(nextPage)
                  fetchHistorico(nextPage)
                }}
                className="h-9 w-9 rounded-xl border border-[#dfded7] text-slate-600 flex items-center justify-center hover:bg-[#e7efe9] disabled:opacity-35 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label="Próxima página do diário"
                disabled={!hasMoreHistorico || loadingHistorico}
                onClick={() => {
                  const nextPage = historicoPage + 1
                  setHistoricoPage(nextPage)
                  fetchHistorico(nextPage)
                }}
                className="h-9 w-9 rounded-xl border border-[#dfded7] text-slate-600 flex items-center justify-center hover:bg-[#e7efe9] disabled:opacity-35 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#ebe9e3] min-h-64">
            {loadingHistorico ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1f4a3a]" />
              </div>
            ) : historicoAulas.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <History size={24} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Nenhum registro de aula.</p>
              </div>
            ) : (
              historicoAulas.map((aula) => {
                const createdAt = aula.criado_em || aula.created_at
                const isDone = aula.status === 'Realizada'
                const isCancelled = aula.status === 'Desmarcada'
                const StatusIcon = isDone
                  ? CheckCircle2
                  : isCancelled
                    ? XCircle
                    : CircleAlert
                const tone = isDone
                  ? 'bg-emerald-50 text-emerald-700'
                  : isCancelled
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-amber-50 text-amber-700'

                return (
                  <div key={aula.id} className="px-5 py-4 flex items-start gap-3.5 hover:bg-[#faf9f6] transition-colors">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                      <StatusIcon size={17} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="font-semibold text-sm text-slate-800 truncate">
                          {aula.aluno?.nome_completo || 'Aluno desconhecido'}
                        </p>
                        <span className={`text-[10px] font-semibold ${tone.split(' ')[1]}`}>
                          {aula.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-500">
                        <span>
                          Aula em {new Date(aula.data_aula).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                        {createdAt && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1">
                              <Clock3 size={11} />
                              Lançada em {new Date(createdAt).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(createdAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        )}
                      </div>
                      {aula.observacoes && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-1">{aula.observacoes}</p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </motion.section>

        <motion.aside variants={itemVariants} className="premium-panel overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-[#dfded7]">
            <h3 className="text-lg font-semibold flex items-center gap-2.5">
              <CalendarDays size={19} className="text-[#1f4a3a]" />
              Próximas datas
            </h3>
            <p className="text-xs text-slate-500 mt-1">Agenda geral, além do mês visível.</p>
          </div>
          <div className="divide-y divide-[#ebe9e3]">
            {eventosFuturos.length === 0 ? (
              <div className="py-12 px-6 text-center text-sm text-slate-500">
                Nenhuma data futura cadastrada.
              </div>
            ) : (
              eventosFuturos.slice(0, 8).map((event) => {
                const style = getEventStyle(event.tipo)
                const Icon = style.Icon
                return (
                  <div key={event.id} className="p-4 flex items-center gap-3 group">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${style.icon}`}>
                      <Icon size={18} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-800 truncate">{event.titulo}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatEventDate(event.data_evento)} · {event.tipo}
                      </p>
                    </div>
                    <button
                      aria-label={`Apagar ${event.titulo}`}
                      onClick={() => handleExcluirEvento(event.id)}
                      className="h-8 w-8 rounded-lg text-slate-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </motion.aside>
      </div>

      {eventosPassados.length > 0 && (
        <motion.details variants={itemVariants} className="premium-panel mt-6 group">
          <summary className="list-none cursor-pointer px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <History size={18} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Eventos passados</span>
              <span className="text-[10px] font-bold text-slate-400">{eventosPassados.length}</span>
            </div>
            <ChevronDown size={18} className="text-slate-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="border-t border-[#dfded7] divide-y divide-[#ebe9e3]">
            {eventosPassados.map((event) => (
              <div key={event.id} className="px-5 py-3.5 flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${getEventStyle(event.tipo).dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-600 truncate">{event.titulo}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatEventDate(event.data_evento)} · {event.tipo}
                  </p>
                </div>
                <button
                  aria-label={`Apagar ${event.titulo}`}
                  onClick={() => handleExcluirEvento(event.id)}
                  className="h-8 w-8 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </motion.details>
      )}

      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-[#10231c]/55 backdrop-blur-sm p-4 flex items-center justify-center"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setFormOpen(false)
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-form-title"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-lg bg-[#fffefa] rounded-3xl border border-white/60 shadow-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#e4e2dc]">
                <div>
                  <div className="premium-kicker mb-2">Agenda da escola</div>
                  <h3 id="event-form-title" className="text-2xl font-semibold">
                    Novo evento
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
                    Feriados e recessos bloqueiam automaticamente a grade daquele dia.
                  </p>
                </div>
                <button
                  aria-label="Fechar"
                  onClick={() => setFormOpen(false)}
                  className="h-9 w-9 rounded-xl text-slate-400 hover:bg-[#efeee9] hover:text-slate-700 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddEvento} className="p-6 space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Título</label>
                  <input
                    autoFocus
                    required
                    placeholder="Ex.: Feriado de Tiradentes"
                    value={titulo}
                    onChange={(event) => setTitulo(event.target.value)}
                    className="w-full mt-1.5 px-4 py-3.5 rounded-xl bg-white border border-[#deddd6] text-sm font-medium outline-none focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Data</label>
                    <input
                      type="date"
                      required
                      value={dataEvento}
                      onChange={(event) => setDataEvento(event.target.value)}
                      className="w-full mt-1.5 px-4 py-3.5 rounded-xl bg-white border border-[#deddd6] text-sm font-medium outline-none focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Tipo</label>
                    <select
                      required
                      value={tipo}
                      onChange={(event) => setTipo(event.target.value)}
                      className="w-full mt-1.5 px-4 py-3.5 rounded-xl bg-white border border-[#deddd6] text-sm font-medium outline-none focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10"
                    >
                      <option value="Feriado">Feriado — bloqueia a grade</option>
                      <option value="Recesso">Recesso — bloqueia a grade</option>
                      <option value="Apresentação">Evento ou apresentação</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="px-5 py-3 rounded-xl border border-[#deddd6] text-sm font-semibold text-slate-600 hover:bg-[#f3f2ed]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-xl bg-[#1f4a3a] text-white text-sm font-semibold hover:bg-[#173c2e] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Salvando...' : 'Salvar evento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
