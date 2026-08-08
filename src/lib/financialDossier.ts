import { getBillingModel, getBillingModelLabel, isBillableClass, isConfirmedPayment } from './billing'

export type FinancialChargeStatus =
  | 'Atrasado'
  | 'A vencer'
  | 'Pago'
  | 'Desconsiderada'
  | 'Em apuração'
  | 'Erro na emissão'
  | 'Sem créditos'
  | 'Créditos em débito'

export type FinancialCharge = {
  id: string
  alunoId: string
  nome: string
  telefone?: string | null
  competencia: string | null
  competenciaLabel: string
  modelo: string
  modeloCodigo: string
  valor: number
  dataVencimento: string | null
  vencimento: string
  vencimentoOrdem: number
  status: FinancialChargeStatus
  diasAtraso: number
  invoiceUrl?: string | null
  invoiceId?: string | null
  paymentId?: string | null
  adjustmentId?: string | null
  adjustmentReason?: string | null
  isAdjusted?: boolean
  saldo?: number
  turmaId?: string | null
}

export type AgingBucket = {
  id: 'a-vencer' | '1-30' | '31-60' | '61-90' | '90+'
  label: string
  quantidade: number
  valor: number
}

type DossierInput = {
  alunos: any[]
  pagamentos: any[]
  faturas: any[]
  ajustes?: any[]
  historicoMes?: any[]
  hoje?: Date
}

function asInfo(aluno: any) {
  return Array.isArray(aluno?.alunos_info) ? aluno.alunos_info[0] : aluno?.alunos_info
}

function dateOnly(value?: string | null) {
  if (!value) return null
  const normalized = String(value).slice(0, 10)
  const [year, month, day] = normalized.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function monthStart(value?: string | null) {
  const parsed = dateOnly(value)
  if (!parsed) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
}

function monthKey(value?: string | Date | null) {
  if (!value) return ''
  const parsed = value instanceof Date ? value : dateOnly(value)
  if (!parsed) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
}

function monthISO(value: Date) {
  return `${monthKey(value)}-01`
}

function monthLabel(value?: string | Date | null) {
  const parsed = value instanceof Date ? value : monthStart(value)
  if (!parsed) return 'Sem competência'
  const label = parsed.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function addMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function dueDateForCompetence(competence: Date, dueDay: number) {
  const safeDay = Math.max(1, Math.min(dueDay || 10, lastDayOfMonth(competence.getFullYear(), competence.getMonth())))
  return new Date(competence.getFullYear(), competence.getMonth(), safeDay)
}

function isoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function daysBetween(later: Date, earlier: Date) {
  const ms = new Date(later.getFullYear(), later.getMonth(), later.getDate()).getTime()
    - new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate()).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

function paymentCompetence(payment: any, invoiceById: Map<string, any>) {
  return monthKey(
    payment?.competencia
    || invoiceById.get(payment?.fatura_id)?.competencia
    || payment?.data_pagamento,
  )
}

function adjustmentKey(alunoId: string, competence: string | Date | null, model: string) {
  return `${alunoId}:${monthKey(competence)}:${model}`
}

function earliestFinancialMonth(aluno: any, info: any, pagamentos: any[], faturas: any[], todayMonth: Date) {
  const explicitStart = monthStart(info?.inicio_faturamento)
  if (explicitStart) return explicitStart

  const candidates = [
    aluno?.created_at,
    info?.modelo_faturamento_desde,
    ...pagamentos.map(item => item.competencia || item.data_pagamento),
    ...faturas.map(item => item.competencia),
  ]
    .map(monthStart)
    .filter((item): item is Date => Boolean(item))
    .sort((a, b) => a.getTime() - b.getTime())

  return candidates[0] || todayMonth
}

function chargeSort(a: FinancialCharge, b: FinancialCharge) {
  const priority = (status: FinancialChargeStatus) => {
    if (status === 'Atrasado' || status === 'Erro na emissão' || status === 'Créditos em débito') return 0
    if (status === 'A vencer' || status === 'Sem créditos') return 1
    if (status === 'Em apuração') return 2
    return 3
  }
  const statusDiff = priority(a.status) - priority(b.status)
  if (statusDiff !== 0) return statusDiff
  if (a.status === 'Pago' && b.status === 'Pago') return b.vencimentoOrdem - a.vencimentoOrdem
  return a.vencimentoOrdem - b.vencimentoOrdem
}

export function buildFinancialDossier({
  alunos,
  pagamentos,
  faturas,
  ajustes = [],
  historicoMes = [],
  hoje = new Date(),
}: DossierInput) {
  const today = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const invoiceById = new Map((faturas || []).map(invoice => [invoice.id, invoice]))
  const confirmedPayments = (pagamentos || []).filter(isConfirmedPayment)
  const adjustmentsByCharge = new Map(
    (ajustes || []).map(item => [
      adjustmentKey(item.aluno_id, item.competencia, item.modelo_faturamento),
      item,
    ]),
  )
  const charges: FinancialCharge[] = []

  for (const aluno of alunos || []) {
    const info = asInfo(aluno)
    if (!info || !Number(info.valor_mensalidade || info.valor_por_aula || 0)) continue

    const model = getBillingModel(info)
    const alunoPayments = confirmedPayments.filter(item => item.aluno_id === aluno.id)
    const allAlunoInvoices = (faturas || []).filter(item =>
      item.aluno_id === aluno.id
      && !['CANCELADO', 'SEM_MOVIMENTO'].includes(String(item.status).toUpperCase()),
    )
    const groupInvoices = allAlunoInvoices.filter(item => item.turma_id)
    const alunoInvoices = allAlunoInvoices.filter(item =>
      !item.turma_id && String(item.modelo_faturamento || model) === model,
    )
    const endMonth = info.status === 'Inativo' && info.data_inativacao
      ? monthStart(info.data_inativacao) || todayMonth
      : todayMonth

    for (const invoice of groupInvoices) {
      const competence = monthStart(invoice.competencia)
      if (!competence) continue
      const dueDate = dateOnly(invoice.data_vencimento)
      const matchingPayment = alunoPayments.find(item => item.fatura_id === invoice.id)
      const paid = String(invoice.status).toUpperCase() === 'PAGO' || Boolean(matchingPayment)
      const erro = String(invoice.status).toUpperCase() === 'ERRO'
      const late = Boolean(!paid && dueDate && dueDate < today)
      const status: FinancialChargeStatus = paid ? 'Pago' : erro ? 'Erro na emissão' : late ? 'Atrasado' : 'A vencer'

      charges.push({
        id: `turma-fatura-${invoice.id}`,
        alunoId: aluno.id,
        nome: aluno.nome_completo,
        telefone: aluno.telefone,
        competencia: monthISO(competence),
        competenciaLabel: `${monthLabel(competence)} · Turma`,
        modelo: 'Turma · Mês fechado',
        modeloCodigo: 'MENSAL_FECHADO',
        valor: Number(invoice.valor_total || 0),
        dataVencimento: dueDate ? isoDate(dueDate) : null,
        vencimento: dueDate ? dueDate.toLocaleDateString('pt-BR') : 'A definir',
        vencimentoOrdem: dueDate?.getTime() || competence.getTime(),
        status,
        diasAtraso: late && dueDate ? daysBetween(today, dueDate) : 0,
        invoiceUrl: invoice.invoice_url || null,
        invoiceId: invoice.id,
        paymentId: matchingPayment?.id || null,
        turmaId: invoice.turma_id,
      })
    }

    const currentGroupLessons = (historicoMes || []).filter(
      item => item.aluno_id === aluno.id && item.turma_id && isBillableClass(item.status),
    )
    const groupLessonsById = new Map<string, any[]>()
    for (const lesson of currentGroupLessons) {
      const key = String(lesson.turma_id)
      groupLessonsById.set(key, [...(groupLessonsById.get(key) || []), lesson])
    }
    for (const [turmaId, lessons] of groupLessonsById) {
      const hasInvoice = groupInvoices.some(
        item => item.turma_id === turmaId && monthKey(item.competencia) === monthKey(todayMonth),
      )
      if (hasInvoice) continue
      charges.push({
        id: `turma-apuracao-${aluno.id}-${turmaId}-${monthKey(todayMonth)}`,
        alunoId: aluno.id,
        nome: aluno.nome_completo,
        telefone: aluno.telefone,
        competencia: monthISO(todayMonth),
        competenciaLabel: `${monthLabel(todayMonth)} · Turma`,
        modelo: 'Turma · Mês fechado',
        modeloCodigo: 'MENSAL_FECHADO',
        valor: lessons.reduce((sum, lesson) => sum + Number(lesson.valor_aula_faturado || 0), 0),
        dataVencimento: null,
        vencimento: 'Após o fechamento',
        vencimentoOrdem: new Date(today.getFullYear(), today.getMonth() + 1, 7).getTime(),
        status: 'Em apuração',
        diasAtraso: 0,
        turmaId,
      })
    }

    if (model === 'VENCIMENTO_FIXO') {
      const startMonth = earliestFinancialMonth(aluno, info, alunoPayments, alunoInvoices, todayMonth)
      for (let competence = startMonth; competence <= endMonth; competence = addMonth(competence, 1)) {
        const competenceKey = monthKey(competence)
        const invoice = alunoInvoices.find(item => monthKey(item.competencia) === competenceKey)
        const matchingPayment = alunoPayments.find(item => paymentCompetence(item, invoiceById) === competenceKey)
        const adjustment = adjustmentsByCharge.get(adjustmentKey(aluno.id, competence, model))
        if (String(adjustment?.tipo).toUpperCase() === 'EXCLUIR') continue
        const ignored = String(adjustment?.tipo).toUpperCase() === 'IGNORAR'
        const paid = Boolean(matchingPayment) || String(invoice?.status).toUpperCase() === 'PAGO'
        const dueDate = adjustment?.vencimento_ajustado
          ? dateOnly(adjustment.vencimento_ajustado) || dueDateForCompetence(competence, Number(info.data_vencimento || 10))
          : invoice?.data_vencimento
          ? dateOnly(invoice.data_vencimento) || dueDateForCompetence(competence, Number(info.data_vencimento || 10))
          : dueDateForCompetence(competence, Number(info.data_vencimento || 10))
        const erro = String(invoice?.status).toUpperCase() === 'ERRO'
        const late = !paid && !ignored && dueDate < today
        const status: FinancialChargeStatus = ignored ? 'Desconsiderada' : paid ? 'Pago' : erro ? 'Erro na emissão' : late ? 'Atrasado' : 'A vencer'

        charges.push({
          id: `fixo-${aluno.id}-${competenceKey}`,
          alunoId: aluno.id,
          nome: aluno.nome_completo,
          telefone: aluno.telefone,
          competencia: monthISO(competence),
          competenciaLabel: monthLabel(competence),
          modelo: getBillingModelLabel(model),
          modeloCodigo: model,
          valor: Number(adjustment?.valor_ajustado ?? invoice?.valor_total ?? info.valor_mensalidade ?? 0),
          dataVencimento: isoDate(dueDate),
          vencimento: dueDate.toLocaleDateString('pt-BR'),
          vencimentoOrdem: dueDate.getTime(),
          status,
          diasAtraso: late ? daysBetween(today, dueDate) : 0,
          invoiceUrl: invoice?.invoice_url || null,
          invoiceId: invoice?.id || null,
          paymentId: matchingPayment?.id || null,
          adjustmentId: adjustment?.id || null,
          adjustmentReason: adjustment?.motivo || null,
          isAdjusted: Boolean(adjustment && !ignored),
        })
      }
      continue
    }

    if (model === 'MENSAL_FECHADO') {
      for (const invoice of alunoInvoices) {
        const competence = monthStart(invoice.competencia)
        if (!competence) continue
        const adjustment = adjustmentsByCharge.get(adjustmentKey(aluno.id, competence, model))
        if (String(adjustment?.tipo).toUpperCase() === 'EXCLUIR') continue
        const ignored = String(adjustment?.tipo).toUpperCase() === 'IGNORAR'
        const dueDate = dateOnly(invoice.data_vencimento)
        const matchingPayment = alunoPayments.find(item => item.fatura_id === invoice.id || paymentCompetence(item, invoiceById) === monthKey(competence))
        const paid = String(invoice.status).toUpperCase() === 'PAGO' || Boolean(matchingPayment)
        const erro = String(invoice.status).toUpperCase() === 'ERRO'
        const adjustedDueDate = adjustment?.vencimento_ajustado ? dateOnly(adjustment.vencimento_ajustado) : dueDate
        const late = Boolean(!paid && !ignored && adjustedDueDate && adjustedDueDate < today)
        const status: FinancialChargeStatus = ignored ? 'Desconsiderada' : paid ? 'Pago' : erro ? 'Erro na emissão' : late ? 'Atrasado' : 'A vencer'

        charges.push({
          id: `fatura-${invoice.id}`,
          alunoId: aluno.id,
          nome: aluno.nome_completo,
          telefone: aluno.telefone,
          competencia: monthISO(competence),
          competenciaLabel: monthLabel(competence),
          modelo: getBillingModelLabel(model),
          modeloCodigo: model,
          valor: Number(adjustment?.valor_ajustado ?? invoice.valor_total ?? 0),
          dataVencimento: adjustedDueDate ? isoDate(adjustedDueDate) : null,
          vencimento: adjustedDueDate ? adjustedDueDate.toLocaleDateString('pt-BR') : 'A definir',
          vencimentoOrdem: adjustedDueDate?.getTime() || competence.getTime(),
          status,
          diasAtraso: late && adjustedDueDate ? daysBetween(today, adjustedDueDate) : 0,
          invoiceUrl: invoice.invoice_url || null,
          invoiceId: invoice.id,
          paymentId: matchingPayment?.id || null,
          adjustmentId: adjustment?.id || null,
          adjustmentReason: adjustment?.motivo || null,
          isAdjusted: Boolean(adjustment && !ignored),
        })
      }

      const currentInvoice = alunoInvoices.some(item => monthKey(item.competencia) === monthKey(todayMonth))
      if (info.status !== 'Inativo' && !currentInvoice) {
        const individualLessons = historicoMes.filter(
          item => item.aluno_id === aluno.id && !item.turma_id && isBillableClass(item.status),
        )
        const classCount = individualLessons.length
        const value = individualLessons.reduce(
          (sum, lesson) => sum + Number(lesson.valor_aula_faturado || info.valor_por_aula || 0),
          0,
        )
        charges.push({
          id: `apuracao-${aluno.id}-${monthKey(todayMonth)}`,
          alunoId: aluno.id,
          nome: aluno.nome_completo,
          telefone: aluno.telefone,
          competencia: monthISO(todayMonth),
          competenciaLabel: monthLabel(todayMonth),
          modelo: getBillingModelLabel(model),
          modeloCodigo: model,
          valor: value,
          dataVencimento: null,
          vencimento: 'Após o fechamento',
          vencimentoOrdem: new Date(today.getFullYear(), today.getMonth() + 1, 7).getTime(),
          status: 'Em apuração',
          diasAtraso: 0,
        })
      }
      continue
    }

    const balance = Number(info.saldo_creditos_faturamento || 0)
    if (info.status !== 'Inativo' && balance <= 0) {
      charges.push({
        id: `creditos-${aluno.id}`,
        alunoId: aluno.id,
        nome: aluno.nome_completo,
        telefone: aluno.telefone,
        competencia: null,
        competenciaLabel: 'Por saldo',
        modelo: getBillingModelLabel(model),
        modeloCodigo: model,
        valor: Number(info.valor_mensalidade || 0),
        dataVencimento: isoDate(today),
        vencimento: 'Renovação necessária',
        vencimentoOrdem: today.getTime(),
        status: balance < 0 ? 'Créditos em débito' : 'Sem créditos',
        diasAtraso: 0,
        saldo: balance,
      })
    }
  }

  return charges.sort(chargeSort)
}

export function getAgingBuckets(charges: FinancialCharge[]): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { id: 'a-vencer', label: 'A vencer', quantidade: 0, valor: 0 },
    { id: '1-30', label: '1–30 dias', quantidade: 0, valor: 0 },
    { id: '31-60', label: '31–60 dias', quantidade: 0, valor: 0 },
    { id: '61-90', label: '61–90 dias', quantidade: 0, valor: 0 },
    { id: '90+', label: 'Acima de 90', quantidade: 0, valor: 0 },
  ]

  for (const charge of charges) {
    let bucket: AgingBucket | undefined
    if (['A vencer', 'Em apuração', 'Sem créditos'].includes(charge.status)) bucket = buckets[0]
    else if (charge.status === 'Atrasado' || charge.status === 'Erro na emissão' || charge.status === 'Créditos em débito') {
      if (charge.diasAtraso <= 30) bucket = buckets[1]
      else if (charge.diasAtraso <= 60) bucket = buckets[2]
      else if (charge.diasAtraso <= 90) bucket = buckets[3]
      else bucket = buckets[4]
    }
    if (!bucket) continue
    bucket.quantidade += 1
    bucket.valor += Number(charge.valor || 0)
  }

  return buckets
}

export function isOpenCharge(charge: FinancialCharge) {
  return !['Pago', 'Desconsiderada'].includes(charge.status)
}

export function isOverdueCharge(charge: FinancialCharge) {
  return ['Atrasado', 'Erro na emissão', 'Créditos em débito'].includes(charge.status)
}

export function summarizeFinancialDossier(charges: FinancialCharge[]) {
  const considered = charges.filter(charge => charge.status !== 'Desconsiderada')
  const open = considered.filter(isOpenCharge)
  const overdue = open.filter(isOverdueCharge)
  const paid = considered.filter(charge => charge.status === 'Pago')

  return {
    considered,
    open,
    overdue,
    paid,
    totalOpen: open.reduce((total, charge) => total + Number(charge.valor || 0), 0),
    totalOverdue: overdue.reduce((total, charge) => total + Number(charge.valor || 0), 0),
    totalPaid: paid.reduce((total, charge) => total + Number(charge.valor || 0), 0),
    priorityCharge: open[0] || null,
  }
}
