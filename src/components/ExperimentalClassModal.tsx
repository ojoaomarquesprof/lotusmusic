"use client"

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Clock3, FlaskConical, Phone, UserRound, X } from 'lucide-react'
import { ensureBrazilianNinthDigit, formatBrazilianPhone, normalizeName } from '../lib/formatters'
import { supabase } from '../lib/supabase'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

function localISODate(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function nextFullHour() {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(Math.min(21, Math.max(7, date.getHours() + 1)))
  return `${String(date.getHours()).padStart(2, '0')}:00`
}

function addHour(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, hours, minutes)
  date.setHours(date.getHours() + 1)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function ExperimentalClassModal({ isOpen, onClose, onSaved }: Props) {
  const [initialTime] = useState(() => nextFullHour())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(localISODate())
  const [startTime, setStartTime] = useState(initialTime)
  const [endTime, setEndTime] = useState(addHour(initialTime))
  const [modality, setModality] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [notes, setNotes] = useState('')
  const [teachers, setTeachers] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [modalities, setModalities] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    Promise.all([
      supabase.from('profiles').select('id, nome_completo').in('role', ['PROFESSOR', 'ADMIN']).order('nome_completo'),
      supabase.from('salas').select('id, nome').order('nome'),
      supabase.from('modalidades').select('nome').order('nome'),
    ]).then(([teacherResult, roomResult, modalityResult]) => {
      setTeachers(teacherResult.data || [])
      setRooms(roomResult.data || [])
      setModalities(modalityResult.data || [])
    })
  }, [isOpen])

  const resetAndClose = () => {
    const time = nextFullHour()
    setName('')
    setPhone('')
    setDate(localISODate())
    setStartTime(time)
    setEndTime(addHour(time))
    setModality('')
    setTeacherId('')
    setRoomId('')
    setNotes('')
    onClose()
  }

  const handleStartTime = (value: string) => {
    setStartTime(value)
    setEndTime(addHour(value))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim().length < 2) return alert('Informe o nome do interessado.')
    if (phone.replace(/\D/g, '').length < 10) return alert('Informe um telefone válido.')
    if (!date || !startTime || !endTime || endTime <= startTime) {
      return alert('Revise a data e o horário da aula experimental.')
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('aulas_experimentais').insert({
      nome: normalizeName(name),
      telefone: ensureBrazilianNinthDigit(phone),
      data_aula: date,
      horario_inicio: startTime,
      horario_fim: endTime,
      modalidade: modality || null,
      professor_id: teacherId || null,
      sala_id: roomId ? Number(roomId) : null,
      observacoes: notes.trim() || null,
    })
    setIsSubmitting(false)

    if (error) {
      const migrationMissing = error.message.includes('aulas_experimentais')
      return alert(
        migrationMissing
          ? 'A atualização de aulas experimentais ainda precisa ser aplicada no Supabase.'
          : `Não foi possível agendar a aula experimental: ${error.message}`,
      )
    }

    onSaved?.()
    resetAndClose()
  }

  const controlClass = 'premium-form-control'
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0d1d17]/55 p-3 backdrop-blur-sm md:p-4">
          <motion.div initial={{ scale: 0.97, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 18 }} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
            <div className="flex items-start justify-between gap-5 border-b border-[#dfded7] bg-[#fbfaf6] px-5 py-5 md:px-7">
              <div>
                <div className="premium-kicker">Primeiro contato</div>
                <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900"><FlaskConical size={22} className="text-[#b98b4f]" /> Nova aula experimental</h2>
                <p className="mt-1 text-sm text-slate-500">Agende rapidamente. A ficha completa será solicitada somente na matrícula.</p>
              </div>
              <button type="button" aria-label="Fechar aula experimental" onClick={resetAndClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 transition hover:text-[#1f4a3a]"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="premium-scrollarea min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 md:px-7">
                <section className="rounded-2xl border border-[#dfded7] bg-white p-5 md:p-6">
                  <div className="mb-5">
                    <h3 className="text-base font-semibold text-slate-900">Dados essenciais</h3>
                    <p className="mt-1 text-xs text-slate-500">Somente nome, telefone e horário são obrigatórios.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><label className={labelClass}><UserRound size={13} className="mr-1 inline" /> Nome</label><input required value={name} onChange={(event) => setName(event.target.value)} onBlur={() => setName(normalizeName(name))} placeholder="Nome do interessado" className={controlClass} /></div>
                    <div><label className={labelClass}><Phone size={13} className="mr-1 inline" /> WhatsApp</label><input required inputMode="tel" value={phone} onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))} onBlur={() => setPhone(ensureBrazilianNinthDigit(phone))} placeholder="(43) 99999-9999" maxLength={15} className={controlClass} /></div>
                    <div><label className={labelClass}><CalendarDays size={13} className="mr-1 inline" /> Data</label><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={controlClass} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelClass}><Clock3 size={13} className="mr-1 inline" /> Início</label><input required type="time" value={startTime} onChange={(event) => handleStartTime(event.target.value)} className={controlClass} /></div>
                      <div><label className={labelClass}>Fim</label><input required type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={controlClass} /></div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#dfded7] bg-white p-5 md:p-6">
                  <div className="mb-5"><h3 className="text-base font-semibold text-slate-900">Detalhes opcionais</h3><p className="mt-1 text-xs text-slate-500">Você pode completar agora ou definir no momento da aula.</p></div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div><label className={labelClass}>Modalidade</label><select value={modality} onChange={(event) => setModality(event.target.value)} className={controlClass}><option value="">Não definida</option>{modalities.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></div>
                    <div><label className={labelClass}>Professor</label><select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={controlClass}><option value="">Não definido</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></div>
                    <div><label className={labelClass}>Sala</label><select value={roomId} onChange={(event) => setRoomId(event.target.value)} className={controlClass}><option value="">Não definida</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
                  </div>
                  <div className="mt-4"><label className={labelClass}>Observações</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Interesse, instrumento, origem do contato..." className="min-h-24 w-full resize-none rounded-xl border border-[#d9d7ce] bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#1f4a3a] focus:ring-2 focus:ring-[#1f4a3a]/10" /></div>
                </section>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-end md:px-7">
                <button type="button" onClick={resetAndClose} disabled={isSubmitting} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-[#1f4a3a] px-6 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,74,58,0.18)] disabled:opacity-50">{isSubmitting ? 'Agendando...' : 'Agendar experimental'}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
