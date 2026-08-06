"use client"

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatCurrencyBR, getBillingModel, isBillableClass } from '../lib/billing'
import {
  addDaysISO,
  InvoiceLesson,
  InvoiceSchedule,
  resolveLessonDetails,
  saoPauloISODate,
} from '../lib/invoices'
import { supabase } from '../lib/supabase'

type Props = {
  alunoId: string
  alunoNome: string
  infoFaturamento: any
  aulas: any[]
  agendas: any[]
  professores: any[]
  onCreated: () => void | Promise<void>
}

function defaultLessonValue(info: any) {
  const directValue = Number(info?.valor_por_aula || 0)
  if (directValue > 0) return directValue

  const packageSize = Math.max(1, Number(info?.creditos_por_pagamento || 4))
  return Number((Number(info?.valor_mensalidade || 0) / packageSize).toFixed(2))
}

function billedLessonValue(lesson: any, fallback: number) {
  const frozenValue = Number(lesson?.valor_aula_faturado || 0)
  return frozenValue > 0 ? frozenValue : fallback
}

export function CreateInvoiceModal({
  alunoId,
  alunoNome,
  infoFaturamento,
  aulas,
  agendas,
  professores,
  onCreated,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [unitValue, setUnitValue] = useState('')
  const [notes, setNotes] = useState('')

  const pendingLessons = useMemo(
    () =>
      aulas
        .filter((lesson) => isBillableClass(lesson.status) && !lesson.fatura_id)
        .sort(
          (a, b) =>
            new Date(a.data_aula).getTime() - new Date(b.data_aula).getTime(),
        ),
    [aulas],
  )

  const professorNames = useMemo(
    () =>
      Object.fromEntries(
        professores.map((professor) => [professor.id, professor.nome_completo]),
      ),
    [professores],
  )

  const selectedLessons = pendingLessons.filter((lesson) =>
    selectedIds.includes(String(lesson.id)),
  )
  const total = selectedLessons.reduce(
    (sum, lesson) => sum + billedLessonValue(lesson, Number(unitValue || 0)),
    0,
  )

  const openModal = () => {
    const today = saoPauloISODate()
    setSelectedIds(pendingLessons.map((lesson) => String(lesson.id)))
    setDueDate(
      addDaysISO(today, Number(infoFaturamento?.prazo_vencimento_dias || 7)),
    )
    setUnitValue(defaultLessonValue(infoFaturamento).toFixed(2))
    setNotes('')
    setIsOpen(true)
  }

  const toggleLesson = (lessonId: string) => {
    setSelectedIds((current) =>
      current.includes(lessonId)
        ? current.filter((id) => id !== lessonId)
        : [...current, lessonId],
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (selectedIds.length === 0) return alert('Selecione pelo menos uma aula.')
    if (Number(unitValue) <= 0) return alert('Informe um valor por aula válido.')

    setIsSubmitting(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setIsSubmitting(false)
      return alert('Sua sessão expirou. Entre novamente.')
    }

    try {
      const response = await fetch('/api/faturamento/faturas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          alunoId,
          historicoAulaIds: selectedIds,
          dataVencimento: dueDate,
          valorUnitario: Number(unitValue),
          observacoes: notes,
        }),
      })
      const responseText = await response.text()
      let result: any = {}
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }
      if (!response.ok) {
        throw new Error(
          result.error ||
          result.message ||
          `Não foi possível emitir a fatura (erro ${response.status}).`,
        )
      }

      setIsOpen(false)
      await onCreated()
      window.open(`/faturas/${result.invoice.id}`, '_blank')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao emitir a fatura.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={openModal}
        disabled={pendingLessons.length === 0}
        className="w-full py-4 rounded-2xl bg-cyan-600 text-white font-bold text-sm shadow-md hover:bg-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title={
          pendingLessons.length === 0
            ? 'Não há aulas realizadas pendentes de faturamento.'
            : 'Gerar uma fatura com as aulas pendentes.'
        }
      >
        📄 Gerar fatura ({pendingLessons.length})
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[100]"
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 20 }}
              className="bg-white/95 backdrop-blur-2xl border border-white p-6 md:p-8 rounded-[2rem] w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-600">
                    Emissão manual
                  </p>
                  <h2 className="text-2xl font-bold text-slate-800 mt-1">
                    Nova fatura para {alunoNome}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-2">
                    Modelo atual: {getBillingModel(infoFaturamento).replaceAll('_', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Aulas pendentes</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        As aulas selecionadas não poderão entrar em outra fatura.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(
                          selectedIds.length === pendingLessons.length
                            ? []
                            : pendingLessons.map((lesson) => String(lesson.id)),
                        )
                      }
                      className="text-xs font-bold text-cyan-700"
                    >
                      {selectedIds.length === pendingLessons.length
                        ? 'Limpar seleção'
                        : 'Selecionar todas'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {pendingLessons.map((lesson) => {
                      const details = resolveLessonDetails(
                        lesson as InvoiceLesson,
                        agendas as InvoiceSchedule[],
                        professorNames,
                      )
                      const checked = selectedIds.includes(String(lesson.id))
                      return (
                        <label
                          key={lesson.id}
                          className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                            checked
                              ? 'bg-cyan-50 border-cyan-300'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLesson(String(lesson.id))}
                            className="h-5 w-5 accent-cyan-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-800">
                              {new Date(
                                `${String(lesson.data_aula).slice(0, 10)}T12:00:00`,
                              ).toLocaleDateString('pt-BR')}
                              {lesson.horario_inicio
                                ? ` • ${lesson.horario_inicio.slice(0, 5)}`
                                : ''}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {details.modalidade} • Prof. {details.professorName}
                            </p>
                          </div>
                          <p className="font-bold text-cyan-700">
                            {formatCurrencyBR(billedLessonValue(lesson, Number(unitValue || 0)))}
                          </p>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Valor padrão por aula
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={unitValue}
                      onChange={(event) => setUnitValue(event.target.value)}
                      className="w-full mt-1 p-3.5 rounded-xl border border-slate-200 bg-white font-bold text-emerald-700 outline-none focus:border-cyan-500"
                    />
                    <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
                      Aulas de turma mantêm o valor congelado no dia da realização.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Vencimento
                    </label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="w-full mt-1 p-3.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Observações da fatura (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ex.: encerramento da matrícula e cobrança das aulas realizadas."
                    className="w-full mt-1 p-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-cyan-500 resize-none h-24"
                  />
                </div>

                <div className="rounded-2xl bg-slate-900 text-white p-5 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-300 font-semibold">
                      {selectedLessons.length} aula(s) selecionada(s)
                    </p>
                    <p className="text-2xl font-bold mt-1">{formatCurrencyBR(total)}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedLessons.length === 0}
                    className="px-6 py-3.5 rounded-xl bg-cyan-500 text-white font-bold text-sm hover:bg-cyan-400 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Emitindo...' : 'Emitir fatura'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
