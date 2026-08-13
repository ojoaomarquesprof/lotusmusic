"use client"

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Search,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const HORARIOS = Array.from({ length: 31 }, (_, index) => {
  const minutes = 7 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

type TurmaForm = {
  nome: string
  modalidade: string
  professor_id: string
  dia: string
  horario_inicio: string
  horario_fim: string
  endereco: string
  valor_mensal_total: string
  aulas_previstas_mes: string
  status: 'ATIVA' | 'INATIVA'
}

const emptyForm = (): TurmaForm => ({
  nome: '',
  modalidade: '',
  professor_id: '',
  dia: 'Segunda',
  horario_inicio: '18:00',
  horario_fim: '19:00',
  endereco: '',
  valor_mensal_total: '300.00',
  aulas_previstas_mes: '4',
  status: 'ATIVA',
})

function currency(value: number | string) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function activeMembers(turma: any) {
  return (turma?.turma_alunos || []).filter((item: any) => item.status === 'ATIVO')
}

export default function TurmasPage() {
  const [turmas, setTurmas] = useState<any[]>([])
  const [alunos, setAlunos] = useState<any[]>([])
  const [professores, setProfessores] = useState<any[]>([])
  const [modalidades, setModalidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TurmaForm>(emptyForm())
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ATIVA' | 'INATIVA'>('ATIVA')
  const [lessonGroup, setLessonGroup] = useState<any>(null)
  const [diaryGroup, setDiaryGroup] = useState<any>(null)
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10))
  const [lessonNotes, setLessonNotes] = useState('')
  const [lessonSaving, setLessonSaving] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    const [turmasResult, alunosResult, professoresResult, modalidadesResult] = await Promise.all([
      supabase
        .from('turmas')
        .select(`
          *,
          professor:profiles!professor_id(id, nome_completo),
          turma_alunos(
            id,
            aluno_id,
            status,
            inicio_em,
            fim_em,
            aluno:profiles!aluno_id(id, nome_completo, email, telefone, avatar_url)
          ),
          turma_aulas(
            id,
            data_aula,
            status,
            observacoes,
            valor_mensal_snapshot,
            participantes_snapshot,
            aulas_previstas_snapshot,
            valor_aluno_aula,
            criado_em
          )
        `)
        .order('nome'),
      supabase
        .from('profiles')
        .select('id, nome_completo, email, telefone, avatar_url, alunos_info(status, modelo_faturamento)')
        .eq('role', 'ALUNO')
        .order('nome_completo'),
      supabase
        .from('profiles')
        .select('id, nome_completo')
        .in('role', ['PROFESSOR', 'ADMIN'])
        .order('nome_completo'),
      supabase.from('modalidades').select('nome').order('nome'),
    ])

    if (turmasResult.error) {
      alert(`Não foi possível carregar as turmas: ${turmasResult.error.message}`)
    }
    setTurmas(turmasResult.data || [])
    setAlunos((alunosResult.data || []).filter((aluno: any) => {
      const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info
      return info?.status !== 'Inativo'
    }))
    setProfessores(professoresResult.data || [])
    setModalidades(modalidadesResult.data || [])
    setLoading(false)
  }

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLocaleLowerCase('pt-BR')
    return alunos.filter((aluno) =>
      [aluno.nome_completo, aluno.email, aluno.telefone]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    )
  }, [alunos, studentSearch])

  const filteredGroups = turmas.filter((turma) => turma.status === statusFilter)
  const diaryLessons = (diaryGroup?.turma_aulas || []).slice().sort((a: any, b: any) =>
    String(b.data_aula).localeCompare(String(a.data_aula)),
  )
  const monthlyShare = selectedStudents.length > 0
    ? Number(form.valor_mensal_total || 0) / selectedStudents.length
    : 0
  const classShare = monthlyShare / Math.max(1, Number(form.aulas_previstas_mes || 4))

  function updateForm(field: keyof TurmaForm, value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'horario_inicio') {
        const [hours, minutes] = value.split(':').map(Number)
        const end = hours * 60 + minutes + 60
        next.horario_fim = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
      }
      return next
    })
  }

  function abrirNovaTurma() {
    setEditingId(null)
    setForm(emptyForm())
    setSelectedStudents([])
    setStudentSearch('')
    setIsModalOpen(true)
  }

  function abrirEdicao(turma: any) {
    setEditingId(turma.id)
    setForm({
      nome: turma.nome || '',
      modalidade: turma.modalidade || '',
      professor_id: turma.professor_id || '',
      dia: turma.dia || 'Segunda',
      horario_inicio: String(turma.horario_inicio || '18:00').slice(0, 5),
      horario_fim: String(turma.horario_fim || '19:00').slice(0, 5),
      endereco: turma.endereco || '',
      valor_mensal_total: String(turma.valor_mensal_total || ''),
      aulas_previstas_mes: String(turma.aulas_previstas_mes || 4),
      status: turma.status || 'ATIVA',
    })
    setSelectedStudents(activeMembers(turma).map((item: any) => item.aluno_id))
    setStudentSearch('')
    setIsModalOpen(true)
  }

  function toggleStudent(id: string) {
    setSelectedStudents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  async function salvarTurma(event: React.FormEvent) {
    event.preventDefault()
    if (Number(form.valor_mensal_total) <= 0) return alert('Informe o valor mensal total da turma.')
    if (form.horario_fim <= form.horario_inicio) return alert('O horário final precisa ser posterior ao inicial.')

    setSaving(true)
    const { data: individualConflictRows, error: conflictError } = await supabase
      .from('agenda')
      .select('id, aluno_id')
      .eq('dia', form.dia)
      .eq('professor_id', form.professor_id)
      .lt('horario_inicio', form.horario_fim)
      .gt('horario_fim', form.horario_inicio)

    if (conflictError) {
      setSaving(false)
      return alert(`Não foi possível validar a agenda: ${conflictError.message}`)
    }

    const conflictRows = individualConflictRows || []
    const conflictStudentIds = Array.from(new Set(
      conflictRows.map((row: any) => row.aluno_id).filter(Boolean),
    ))
    let activeConflictStudentIds = new Set<string>()
    if (conflictStudentIds.length > 0) {
      const { data: conflictStudents, error: conflictStudentsError } = await supabase
        .from('alunos_info')
        .select('id, status')
        .in('id', conflictStudentIds)

      if (conflictStudentsError) {
        setSaving(false)
        return alert(`Não foi possível validar os alunos do horário: ${conflictStudentsError.message}`)
      }

      activeConflictStudentIds = new Set(
        (conflictStudents || [])
          .filter((student: any) => student.status !== 'Inativo')
          .map((student: any) => String(student.id)),
      )
    }

    const individualConflicts = conflictRows.filter((row: any) => {
      const studentId = String(row.aluno_id || '')
      return activeConflictStudentIds.has(studentId) && !selectedStudents.includes(studentId)
    })

    let groupConflictQuery = supabase
      .from('turmas')
      .select('id, nome')
      .eq('status', 'ATIVA')
      .eq('dia', form.dia)
      .eq('professor_id', form.professor_id)
      .lt('horario_inicio', form.horario_fim)
      .gt('horario_fim', form.horario_inicio)
    if (editingId) groupConflictQuery = groupConflictQuery.neq('id', editingId)
    const { data: groupConflicts, error: groupConflictError } = await groupConflictQuery

    if (groupConflictError) {
      setSaving(false)
      return alert(`Não foi possível validar as outras turmas: ${groupConflictError.message}`)
    }
    if ((individualConflicts || []).length > 0 || (groupConflicts || []).length > 0) {
      setSaving(false)
      return alert('O professor já possui uma aula nesse período.')
    }

    const payload = {
      nome: form.nome.trim(),
      modalidade: form.modalidade,
      professor_id: form.professor_id,
      dia: form.dia,
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim,
      endereco: form.endereco.trim(),
      valor_mensal_total: Number(form.valor_mensal_total),
      aulas_previstas_mes: Number(form.aulas_previstas_mes),
      status: form.status,
      atualizado_em: new Date().toISOString(),
    }

    let turmaId = editingId
    if (editingId) {
      const { error } = await supabase.from('turmas').update(payload).eq('id', editingId)
      if (error) {
        setSaving(false)
        return alert(`Não foi possível atualizar a turma: ${error.message}`)
      }
    } else {
      const { data, error } = await supabase.from('turmas').insert(payload).select('id').single()
      if (error || !data) {
        setSaving(false)
        return alert(`Não foi possível criar a turma: ${error?.message || 'Erro desconhecido.'}`)
      }
      turmaId = data.id
    }

    const existing = editingId
      ? (turmas.find((turma) => turma.id === editingId)?.turma_alunos || [])
      : []
    const today = new Date().toISOString().slice(0, 10)
    const membershipRows = selectedStudents.map((alunoId) => ({
      turma_id: turmaId,
      aluno_id: alunoId,
      status: 'ATIVO',
      inicio_em: existing.find((item: any) => item.aluno_id === alunoId)?.inicio_em || today,
      fim_em: null,
      atualizado_em: new Date().toISOString(),
    }))
    let memberError: any = null
    if (membershipRows.length > 0) {
      const result = await supabase
        .from('turma_alunos')
        .upsert(membershipRows, { onConflict: 'turma_id,aluno_id' })
      memberError = result.error
    }

    if (memberError) {
      setSaving(false)
      return alert(`A turma foi salva, mas os participantes não: ${memberError.message}`)
    }

    // Se um participante ainda tinha o antigo horário individual exatamente
    // neste período, a nova turma assume esse horário. Outros horários do
    // aluno permanecem intactos.
    if (selectedStudents.length > 0) {
    const { error: migratedSchedulesError } = await supabase
      .from('agenda')
      .delete()
      .in('aluno_id', selectedStudents)
      .eq('dia', form.dia)
      .eq('professor_id', form.professor_id)
      .lt('horario_inicio', form.horario_fim)
      .gt('horario_fim', form.horario_inicio)

    if (migratedSchedulesError) {
      setSaving(false)
      return alert(`A turma foi salva, mas não foi possível liberar os horários individuais: ${migratedSchedulesError.message}`)
    }

    }

    const removedIds = existing
      .filter((item: any) => item.status === 'ATIVO' && !selectedStudents.includes(item.aluno_id))
      .map((item: any) => item.id)
    if (removedIds.length > 0) {
      await supabase
        .from('turma_alunos')
        .update({ status: 'INATIVO', fim_em: today, atualizado_em: new Date().toISOString() })
        .in('id', removedIds)
    }

    if (turmaId && selectedStudents.length > 0) {
      const { error: syncError } = await supabase.rpc('sincronizar_aulas_turma_participantes', {
        p_turma_id: turmaId,
      })
      if (syncError) {
        setSaving(false)
        return alert(`A turma foi salva, mas as aulas anteriores não puderam ser distribuídas: ${syncError.message}`)
      }
    }

    setSaving(false)
    setIsModalOpen(false)
    await carregar()
  }

  async function registrarAula(event: React.FormEvent) {
    event.preventDefault()
    if (!lessonGroup) return
    setLessonSaving(true)
    const { data: result, error } = await supabase.rpc('registrar_aula_turma', {
      p_turma_id: lessonGroup.id,
      p_data_aula: lessonDate,
      p_observacoes: lessonNotes.trim() || null,
    })
    setLessonSaving(false)
    if (error) return alert(`Não foi possível registrar a aula: ${error.message}`)
    setLessonGroup(null)
    setLessonNotes('')
    await carregar()
    const participantes = Number(result?.participantes || 0)
    if (participantes > 0) {
      alert(`Aula registrada para ${participantes} participante${participantes === 1 ? '' : 's'}.`)
    } else {
      alert('Aula coletiva registrada. Ela será distribuída automaticamente quando os participantes forem cadastrados.')
    }
  }

  if (loading) {
    return <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Carregando turmas...</div>
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-12">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="premium-kicker mb-2">Ensino coletivo</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Turmas</h1>
          <p className="mt-1.5 text-sm text-slate-500">Agenda, participantes e divisão da mensalidade em um único lugar.</p>
        </div>
        <button onClick={abrirNovaTurma} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1f4a3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#1f4a3a]/15 hover:bg-[#173d30]">
          <Plus size={18} /> Nova turma
        </button>
      </div>

      <section className="premium-panel mb-5 overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-[#dfded7] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Turmas ativas</p>
            <p className="mt-2 text-3xl font-semibold text-[#1f4a3a]">{turmas.filter((item) => item.status === 'ATIVA').length}</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Participações ativas</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{turmas.reduce((total, turma) => total + activeMembers(turma).length, 0)}</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Receita coletiva prevista</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{currency(turmas.filter((item) => item.status === 'ATIVA').reduce((total, turma) => total + Number(turma.valor_mensal_total || 0), 0))}</p>
          </div>
        </div>
      </section>

      <div className="premium-panel mb-5 flex gap-1 p-1.5">
        {(['ATIVA', 'INATIVA'] as const).map((status) => (
          <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-lg px-4 py-2.5 text-xs font-semibold transition ${statusFilter === status ? 'bg-[#1f4a3a] text-white' : 'text-slate-500 hover:text-slate-800'}`}>
            {status === 'ATIVA' ? 'Ativas' : 'Inativas'}
          </button>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <section className="premium-panel flex min-h-72 flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7efe9] text-[#1f4a3a]"><UsersRound size={22} /></div>
          <p className="text-lg font-semibold text-slate-800">Nenhuma turma nesta lista</p>
          <p className="mt-1 text-sm text-slate-500">Crie a primeira turma e importe os participantes da sua base.</p>
        </section>
      ) : (
        <section className="premium-panel overflow-hidden">
          <div className="hidden grid-cols-[1.3fr_1fr_0.9fr_0.8fr_110px] border-b border-[#dfded7] bg-[#f3f2ed] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 md:grid">
            <span>Turma</span><span>Agenda</span><span>Participantes</span><span>Mensalidade</span><span className="text-right">Ações</span>
          </div>
          <div className="divide-y divide-[#ebe9e3]">
            {filteredGroups.map((turma) => {
              const members = activeMembers(turma)
              const share = members.length ? Number(turma.valor_mensal_total) / members.length : 0
              return (
                <article key={turma.id} className="grid gap-4 px-5 py-5 transition hover:bg-[#faf9f6] md:grid-cols-[1.3fr_1fr_0.9fr_0.8fr_110px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{turma.nome}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{turma.modalidade} · Prof. {turma.professor?.nome_completo || 'Não informado'}</p>
                    <p className="mt-2 flex items-center gap-1.5 truncate text-[11px] text-slate-400"><MapPin size={12} /> {turma.endereco}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><CalendarDays size={14} className="text-[#1f4a3a]" /> {turma.dia}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-500"><Clock3 size={13} /> {String(turma.horario_inicio).slice(0, 5)} — {String(turma.horario_fim).slice(0, 5)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{members.length} aluno{members.length === 1 ? '' : 's'}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{currency(share)} por aluno/mês</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1f4a3a]">{currency(turma.valor_mensal_total)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{turma.aulas_previstas_mes} aulas previstas</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button title="Abrir diário da turma" onClick={() => setDiaryGroup(turma)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e6efe9] text-[#1f4a3a] hover:bg-[#d8e7dd]"><BookOpenCheck size={16} /></button>
                    <button title="Editar turma" onClick={() => abrirEdicao(turma)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfded7] bg-white text-slate-600 hover:text-[#1f4a3a]"><Pencil size={15} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0d1d17]/55 p-4 backdrop-blur-sm">
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
              <div className="flex shrink-0 items-start justify-between border-b border-[#dfded7] bg-[#fbfaf6] px-5 py-5 md:px-7">
                <div>
                  <div className="premium-kicker">{editingId ? 'Editar turma' : 'Nova turma'}</div>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{editingId ? form.nome : 'Cadastro coletivo'}</h2>
                  <p className="mt-1 text-sm text-slate-500">Agenda, preço e participantes em um único cadastro.</p>
                </div>
                <button type="button" aria-label="Fechar cadastro da turma" onClick={() => setIsModalOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 transition hover:border-[#bfc7c1] hover:text-[#1f4a3a]"><X size={18} /></button>
              </div>

              <form onSubmit={salvarTurma} className="flex min-h-0 flex-1 flex-col">
                <div className="premium-scrollarea grid min-h-0 flex-1 gap-6 overflow-y-auto px-5 py-6 md:px-7 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-5">
                  <section className="rounded-2xl border border-[#dfded7] bg-white p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">1</span>
                      <div><h3 className="text-sm font-semibold text-slate-900">Identificação e agenda</h3><p className="mt-0.5 text-xs text-slate-500">Defina onde e quando a turma se reúne.</p></div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="md:col-span-2 text-xs font-semibold text-slate-600">Nome da turma
                        <input required value={form.nome} onChange={(e) => updateForm('nome', e.target.value)} placeholder="Ex.: Turma de música da igreja" className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Modalidade
                        <select required value={form.modalidade} onChange={(e) => updateForm('modalidade', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none">
                          <option value="">Selecione...</option>
                          {modalidades.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Professor
                        <select required value={form.professor_id} onChange={(e) => updateForm('professor_id', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none">
                          <option value="">Selecione...</option>
                          {professores.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Dia
                        <select value={form.dia} onChange={(e) => updateForm('dia', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none">
                          {DIAS.map((dia) => <option key={dia} value={dia}>{dia}</option>)}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-slate-600">Início
                          <select value={form.horario_inicio} onChange={(e) => updateForm('horario_inicio', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-3 py-3 text-sm outline-none">
                            {HORARIOS.map((time) => <option key={time} value={time}>{time}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-slate-600">Fim
                          <select value={form.horario_fim} onChange={(e) => updateForm('horario_fim', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-3 py-3 text-sm outline-none">
                            {HORARIOS.map((time) => <option key={time} value={time}>{time}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="md:col-span-2 text-xs font-semibold text-slate-600">Endereço da aula
                        <input required value={form.endereco} onChange={(e) => updateForm('endereco', e.target.value)} placeholder="Rua, número, bairro e cidade" className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none focus:border-[#1f4a3a]" />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#dfded7] bg-white p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">2</span>
                      <div><div className="flex items-center gap-2"><WalletCards size={16} className="text-[#1f4a3a]" /><h3 className="text-sm font-semibold text-slate-900">Preço da turma</h3></div><p className="mt-0.5 text-xs text-slate-500">O valor pode variar entre as turmas.</p></div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">Mensalidade total
                        <input required min="0.01" step="0.01" type="number" value={form.valor_mensal_total} onChange={(e) => updateForm('valor_mensal_total', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-lg font-semibold text-[#1f4a3a] outline-none" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Aulas previstas por mês
                        <input required min="1" max="12" type="number" value={form.aulas_previstas_mes} onChange={(e) => updateForm('aulas_previstas_mes', e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none" />
                      </label>
                    </div>
                    <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-[#d7e1da] bg-[#edf4ef]">
                      <div className="p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#587066]">Por aluno/mês</p><p className="mt-1 text-lg font-semibold text-[#1f4a3a]">{currency(monthlyShare)}</p></div>
                      <div className="border-l border-[#d7e1da] p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[#587066]">Por aula/aluno</p><p className="mt-1 text-lg font-semibold text-[#1f4a3a]">{currency(classShare)}</p></div>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">A divisão é recalculada para as próximas aulas. As aulas já realizadas mantêm o preço e a quantidade de participantes daquele dia.</p>
                  </section>
                  </div>

                <section className="flex min-h-[520px] flex-col rounded-2xl border border-[#dfded7] bg-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">3</span>
                      <div><h3 className="text-sm font-semibold text-slate-900">Participantes</h3><p className="mt-0.5 text-xs text-slate-500">{selectedStudents.length} selecionado{selectedStudents.length === 1 ? '' : 's'} da base · opcional nesta etapa</p></div>
                    </div>
                    <span className="rounded-full bg-[#e7efe9] px-3 py-1.5 text-xs font-semibold text-[#1f4a3a]">{currency(monthlyShare)} cada</span>
                  </div>
                  <div className="relative mt-4">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Buscar aluno..." className="w-full rounded-xl border border-[#d9d7ce] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#1f4a3a]" />
                  </div>
                  <div className="premium-scrollarea mt-3 max-h-[420px] flex-1 space-y-2 overflow-y-auto pr-2">
                    {filteredStudents.map((aluno) => {
                      const checked = selectedStudents.includes(aluno.id)
                      return (
                        <button type="button" key={aluno.id} onClick={() => toggleStudent(aluno.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${checked ? 'border-[#8bb3a0] bg-[#eef5f0]' : 'border-[#ebe9e3] bg-white hover:bg-[#faf9f6]'}`}>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-[#1f4a3a] bg-[#1f4a3a] text-white' : 'border-slate-300 text-transparent'}`}><Check size={13} /></span>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#dfe9e3] text-xs font-bold text-[#1f4a3a]">
                            {aluno.avatar_url ? <img src={aluno.avatar_url} alt="" className="h-full w-full object-cover" /> : aluno.nome_completo?.charAt(0)}
                          </span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{aluno.nome_completo}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500">{aluno.telefone || aluno.email || 'Sem contato informado'}</span></span>
                        </button>
                      )
                    })}
                  </div>
                </section>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
                  <p className="hidden text-xs text-slate-500 sm:block">{selectedStudents.length ? `${selectedStudents.length} participante${selectedStudents.length === 1 ? '' : 's'} · ${currency(monthlyShare)} por aluno/mês` : 'Você pode cadastrar os participantes depois'}</p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600">Cancelar</button>
                  <button type="submit" disabled={saving} className="h-11 rounded-xl bg-[#1f4a3a] px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar turma'}</button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {diaryGroup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[85] flex items-center justify-center bg-[#0d1d17]/55 p-4 backdrop-blur-sm">
            <motion.section initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }} className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[26px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#dfded7] bg-[#fbfaf6] px-6 py-5">
                <div>
                  <div className="premium-kicker">Diário coletivo</div>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{diaryGroup.nome}</h2>
                  <p className="mt-1 text-sm text-slate-500">Aulas realizadas, valor por aluno e histórico da turma em um só lugar.</p>
                </div>
                <button type="button" aria-label="Fechar diário" onClick={() => setDiaryGroup(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 hover:text-[#1f4a3a]"><X size={18} /></button>
              </header>

              <div className="grid shrink-0 grid-cols-3 border-b border-[#dfded7] bg-white">
                <div className="border-r border-[#e5e3dd] px-6 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Aulas realizadas</p><p className="mt-1 text-2xl font-semibold text-[#1f4a3a]">{diaryLessons.filter((aula: any) => aula.status === 'REALIZADA').length}</p></div>
                <div className="border-r border-[#e5e3dd] px-6 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Participantes atuais</p><p className="mt-1 text-2xl font-semibold text-slate-900">{activeMembers(diaryGroup).length}</p></div>
                <div className="px-6 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Valor por aluno/aula</p><p className="mt-1 text-2xl font-semibold text-slate-900">{currency(diaryLessons[0]?.valor_aluno_aula || (activeMembers(diaryGroup).length ? Number(diaryGroup.valor_mensal_total) / activeMembers(diaryGroup).length / Number(diaryGroup.aulas_previstas_mes || 4) : 0))}</p></div>
              </div>

              <div className="premium-scrollarea min-h-0 flex-1 overflow-y-auto p-5">
                {diaryLessons.length === 0 ? (
                  <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfd8d1] bg-white/60 px-6 text-center">
                    <BookOpenCheck size={28} className="text-[#1f4a3a]" />
                    <p className="mt-3 text-sm font-semibold text-slate-800">Diário ainda vazio</p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">Registre uma aula realizada. O lançamento será refletido imediatamente no histórico financeiro de todos os participantes ativos.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#dfded7] bg-white">
                    <div className="hidden grid-cols-[120px_1fr_120px_120px] border-b border-[#dfded7] bg-[#f3f2ed] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:grid"><span>Data</span><span>Observações</span><span>Participantes</span><span className="text-right">Valor/aluno</span></div>
                    {diaryLessons.map((aula: any) => (
                      <div key={aula.id} className="grid gap-2 border-b border-[#ebe9e3] px-5 py-4 last:border-0 sm:grid-cols-[120px_1fr_120px_120px] sm:items-center">
                        <div><p className="text-sm font-semibold text-slate-900">{new Date(`${String(aula.data_aula).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}</p><p className="mt-1 text-[11px] text-slate-500">{aula.status === 'REALIZADA' ? 'Realizada' : 'Cancelada'}</p></div>
                        <p className="text-xs leading-5 text-slate-600">{aula.observacoes || 'Nenhuma observação registrada.'}</p>
                        <p className="text-xs text-slate-600">{aula.participantes_snapshot || 0} aluno{Number(aula.participantes_snapshot || 0) === 1 ? '' : 's'}</p>
                        <p className="text-right text-sm font-semibold text-[#1f4a3a]">{currency(aula.valor_aluno_aula)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-6 py-4">
                <p className="hidden text-xs text-slate-500 sm:block">Cada aula realizada gera um lançamento financeiro por participante ativo.</p>
                <div className="ml-auto flex gap-3"><button type="button" onClick={() => setDiaryGroup(null)} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600">Fechar</button><button type="button" onClick={() => { setLessonGroup(diaryGroup); setLessonDate(new Date().toISOString().slice(0, 10)); setLessonNotes(''); setDiaryGroup(null) }} className="flex h-11 items-center gap-2 rounded-xl bg-[#1f4a3a] px-5 text-sm font-semibold text-white"><Plus size={16} /> Registrar aula</button></div>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lessonGroup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0d1d17]/55 p-4 backdrop-blur-sm">
            <motion.form onSubmit={registrarAula} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }} className="w-full max-w-lg rounded-[26px] border border-white/60 bg-[#f8f7f2] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div><div className="premium-kicker">Diário coletivo</div><h2 className="mt-1 text-2xl font-semibold text-slate-900">{lessonGroup.nome}</h2><p className="mt-1 text-sm text-slate-500">{activeMembers(lessonGroup).length > 0 ? `A aula será lançada para ${activeMembers(lessonGroup).length} participante${activeMembers(lessonGroup).length === 1 ? '' : 's'}.` : 'Nenhum participante cadastrado ainda. A aula ficará pronta para distribuição quando você adicionar os alunos.'}</p></div>
                <button type="button" onClick={() => setLessonGroup(null)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500"><X size={18} /></button>
              </div>
              <div className="mt-6 rounded-2xl border border-[#d7e1da] bg-[#edf4ef] p-4 text-sm text-[#315949]">
                {activeMembers(lessonGroup).length > 0
                  ? 'Cada participante receberá uma aula realizada no próprio histórico, com o valor congelado desta divisão.'
                  : 'A aula será salva na turma mesmo sem alunos cadastrados. Ao adicionar os participantes depois, ela será distribuída automaticamente no histórico deles.'}
              </div>
              <label className="mt-5 block text-xs font-semibold text-slate-600">Data da aula
                <input required type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none focus:border-[#1f4a3a]" />
              </label>
              <label className="mt-4 block text-xs font-semibold text-slate-600">Observações (opcional)
                <textarea value={lessonNotes} onChange={(e) => setLessonNotes(e.target.value)} placeholder="Conteúdo trabalhado, recados ou observações da aula." className="mt-1.5 h-24 w-full resize-none rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm outline-none focus:border-[#1f4a3a]" />
              </label>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setLessonGroup(null)} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600">Cancelar</button>
                <button type="submit" disabled={lessonSaving} className="flex h-11 items-center gap-2 rounded-xl bg-[#1f4a3a] px-5 text-sm font-semibold text-white disabled:opacity-50"><BookOpenCheck size={16} /> {lessonSaving ? 'Registrando...' : 'Marcar realizada'}</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
