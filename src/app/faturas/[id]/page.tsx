"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatCurrencyBR, getBillingModelLabel } from '../../../lib/billing'
import { buildAddress, formatInvoiceNumber } from '../../../lib/invoices'
import { supabase } from '../../../lib/supabase'

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : ''
}

const STATUS_STYLES: Record<string, string> = {
  PAGO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PENDENTE: 'bg-amber-100 text-amber-700 border-amber-200',
  VENCIDO: 'bg-rose-100 text-rose-700 border-rose-200',
  ERRO: 'bg-rose-100 text-rose-700 border-rose-200',
  CANCELADO: 'bg-slate-100 text-slate-600 border-slate-200',
  RASCUNHO: 'bg-blue-100 text-blue-700 border-blue-200',
  SEM_MOVIMENTO: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function InvoicePage() {
  const { id } = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerRole, setViewerRole] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadInvoice()
  }, [id])

  async function loadInvoice() {
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('faturas')
      .select('*')
      .eq('id', id)
      .single()

    if (invoiceError || !invoiceData) {
      setError('Fatura não encontrada ou indisponível para este usuário.')
      setLoading(false)
      return
    }

    const [{ data: invoiceItems }, { data: student }, { data: settings }, { data: viewer }] =
      await Promise.all([
        supabase
          .from('fatura_itens')
          .select('*')
          .eq('fatura_id', id)
          .order('data_aula', { ascending: true }),
        supabase
          .from('profiles')
          .select(
            'nome_completo, cpf, email, telefone, cep, endereco, numero, complemento, bairro, cidade, estado',
          )
          .eq('id', invoiceData.aluno_id)
          .maybeSingle(),
        supabase
          .from('configuracoes')
          .select(
            'escola_nome, escola_documento, escola_email, escola_telefone, escola_cep, escola_endereco, escola_numero, escola_complemento, escola_bairro, escola_cidade, escola_estado, chave_pix',
          )
          .eq('id', 1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle(),
      ])

    setInvoice({
      ...invoiceData,
      aluno_nome: invoiceData.aluno_nome || student?.nome_completo,
      aluno_documento: invoiceData.aluno_documento || student?.cpf,
      aluno_email: invoiceData.aluno_email || student?.email,
      aluno_telefone: invoiceData.aluno_telefone || student?.telefone,
      aluno_endereco: invoiceData.aluno_endereco || buildAddress(student || {}),
      emitente_nome: invoiceData.emitente_nome || settings?.escola_nome || 'Lotus Music',
      emitente_documento:
        invoiceData.emitente_documento || settings?.escola_documento,
      emitente_email: invoiceData.emitente_email || settings?.escola_email,
      emitente_telefone:
        invoiceData.emitente_telefone || settings?.escola_telefone,
      emitente_endereco:
        invoiceData.emitente_endereco ||
        buildAddress({
          endereco: settings?.escola_endereco,
          numero: settings?.escola_numero,
          complemento: settings?.escola_complemento,
          bairro: settings?.escola_bairro,
          cidade: settings?.escola_cidade,
          estado: settings?.escola_estado,
          cep: settings?.escola_cep,
        }),
      chave_pix: settings?.chave_pix,
    })
    setItems(invoiceItems || [])
    setViewerRole(viewer?.role || '')
    setLoading(false)
  }

  async function cancelInvoice() {
    if (!window.confirm('Cancelar esta fatura? As aulas voltarão para as pendências e poderão ser faturadas novamente.')) {
      return
    }

    setIsCancelling(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sua sessão expirou. Entre novamente.')

      const response = await fetch(`/api/faturamento/faturas/${id}/cancelar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
          `Não foi possível cancelar a fatura (erro ${response.status}).`,
        )
      }

      await loadInvoice()
      alert('Fatura cancelada. As aulas voltaram para as pendências.')
    } catch (cancelError) {
      alert(
        cancelError instanceof Error
          ? cancelError.message
          : 'Não foi possível cancelar a fatura.',
      )
    } finally {
      setIsCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 rounded-3xl bg-white border border-slate-200 text-center">
        <p className="text-lg font-bold text-slate-800">{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-6 px-6 py-3 bg-slate-800 text-white rounded-xl font-bold"
        >
          Voltar
        </button>
      </div>
    )
  }

  const invoiceNumber = formatInvoiceNumber(invoice.numero, invoice.id)
  const canCancel =
    viewerRole === 'ADMIN' &&
    !['PAGO', 'CANCELADO', 'SEM_MOVIMENTO'].includes(invoice.status)
  const densityClass =
    items.length > 12
      ? 'invoice-density-high'
      : items.length > 8
        ? 'invoice-density-medium'
        : ''

  return (
    <div className="invoice-page max-w-5xl mx-auto pb-12 print:p-0 print:max-w-none">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6 print:hidden">
        <button
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm"
        >
          ← Voltar
        </button>
        <div className="flex gap-3">
          {canCancel && (
            <button
              onClick={cancelInvoice}
              disabled={isCancelling}
              className="px-5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm disabled:opacity-50"
            >
              {isCancelling ? 'Cancelando...' : 'Cancelar fatura'}
            </button>
          )}
          {invoice.invoice_url && (
            <button
              onClick={() => window.open(invoice.invoice_url, '_blank')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm"
            >
              Abrir cobrança
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm"
          >
            Imprimir / salvar PDF
          </button>
        </div>
      </div>

      <article className={`invoice-sheet ${densityClass} bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none`}>
        <header className="invoice-header p-8 md:p-10 border-b border-slate-200 bg-gradient-to-br from-slate-950 to-cyan-950 text-white print:bg-white print:text-slate-900">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] font-bold text-cyan-300 print:text-cyan-700">
                Emitente
              </p>
              <h1 className="text-3xl font-bold mt-2">{invoice.emitente_nome}</h1>
              {invoice.emitente_documento && (
                <p className="text-sm mt-2 text-slate-300 print:text-slate-600">
                  CPF/CNPJ: {invoice.emitente_documento}
                </p>
              )}
              {invoice.emitente_endereco && (
                <p className="text-sm mt-1 text-slate-300 print:text-slate-600 max-w-xl">
                  {invoice.emitente_endereco}
                </p>
              )}
              <p className="text-sm mt-1 text-slate-300 print:text-slate-600">
                {[invoice.emitente_telefone, invoice.emitente_email]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            <div className="md:text-right">
              <p className="text-xs uppercase tracking-[0.25em] font-bold text-cyan-300 print:text-cyan-700">
                Fatura
              </p>
              <p className="text-2xl font-bold mt-2">{invoiceNumber}</p>
              <span
                className={`inline-block mt-3 px-3 py-1 rounded-full border text-xs font-bold ${
                  STATUS_STYLES[invoice.status] || STATUS_STYLES.RASCUNHO
                }`}
              >
                {invoice.status}
              </span>
            </div>
          </div>
        </header>

        <div className="invoice-content p-8 md:p-10">
          <section className="invoice-recipient grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-slate-200">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Faturado para
              </p>
              <p className="text-xl font-bold text-slate-800 mt-2">
                {invoice.aluno_nome}
              </p>
              {invoice.aluno_documento && (
                <p className="text-sm text-slate-600 mt-1">
                  CPF/CNPJ: {invoice.aluno_documento}
                </p>
              )}
              {invoice.aluno_endereco && (
                <p className="text-sm text-slate-600 mt-1">{invoice.aluno_endereco}</p>
              )}
              <p className="text-sm text-slate-600 mt-1">
                {[invoice.aluno_telefone, invoice.aluno_email]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase font-bold text-slate-400">Emissão</dt>
                <dd className="font-bold text-slate-700 mt-1">
                  {formatDate(invoice.data_emissao)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase font-bold text-slate-400">Vencimento</dt>
                <dd className="font-bold text-rose-600 mt-1">
                  {formatDate(invoice.data_vencimento)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase font-bold text-slate-400">Período</dt>
                <dd className="font-semibold text-slate-700 mt-1">
                  {formatDate(invoice.periodo_inicio)} a {formatDate(invoice.periodo_fim)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase font-bold text-slate-400">Modelo</dt>
                <dd className="font-semibold text-slate-700 mt-1">
                  {getBillingModelLabel(invoice.modelo_faturamento)}
                </dd>
              </div>
            </dl>
          </section>

          {invoice.status === 'CANCELADO' && (
            <div className="invoice-cancelled mt-5 p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-sm font-bold">
              Fatura cancelada em {formatDate(invoice.cancelada_em)}. As aulas foram liberadas para um novo faturamento.
            </div>
          )}

          <section className="invoice-lessons py-8">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              Aulas realizadas
            </h2>
            <div className="overflow-x-auto">
              <table className="invoice-table w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="text-left p-3 text-xs uppercase text-slate-500">Data</th>
                    <th className="text-left p-3 text-xs uppercase text-slate-500">
                      Modalidade
                    </th>
                    <th className="text-left p-3 text-xs uppercase text-slate-500">
                      Professor
                    </th>
                    <th className="text-right p-3 text-xs uppercase text-slate-500">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="p-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {formatDate(item.data_aula)}
                        {item.horario_inicio && (
                          <span className="block text-xs font-normal text-slate-400 mt-0.5">
                            {formatTime(item.horario_inicio)}
                            {item.horario_fim ? `–${formatTime(item.horario_fim)}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-slate-700">{item.modalidade}</td>
                      <td className="p-3 text-sm text-slate-700">
                        {item.professor_nome}
                      </td>
                      <td className="p-3 text-sm font-bold text-slate-800 text-right">
                        {formatCurrencyBR(item.valor_total)}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-sm text-slate-500">
                        Esta fatura não possui aulas detalhadas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="invoice-summary border-t border-slate-200 pt-6 flex flex-col md:flex-row justify-between gap-6">
            <div className="max-w-xl">
              {invoice.observacoes && (
                <>
                  <p className="text-xs uppercase font-bold text-slate-400">
                    Observações
                  </p>
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                    {invoice.observacoes}
                  </p>
                </>
              )}
              {invoice.chave_pix && (
                <p className="text-sm text-slate-600 mt-4">
                  <strong>Chave PIX:</strong> {invoice.chave_pix}
                </p>
              )}
            </div>
            <div className="md:text-right">
              <p className="text-xs uppercase font-bold text-slate-400">
                Total da fatura
              </p>
              <p className="invoice-total-amount text-4xl font-bold text-slate-900 mt-2">
                {formatCurrencyBR(invoice.valor_total)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {invoice.quantidade_aulas} aula(s)
              </p>
            </div>
          </section>
        </div>
      </article>
    </div>
  )
}
