import { NextRequest } from 'next/server'
import { createAsaasCustomer, createAsaasPayment } from '../../../../lib/asaas'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { unmask } from '../../../../lib/formatters'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type DateParts = {
  year: number
  month: number
  day: number
}

function saoPauloDateParts(date = new Date()): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return { year: get('year'), month: get('month'), day: get('day') }
}

function getCompetence(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('competencia')
  if (requested && /^\d{4}-\d{2}$/.test(requested)) {
    const [year, month] = requested.split('-').map(Number)
    return { year, month, forced: true }
  }

  const { year, month, day } = saoPauloDateParts()
  const previousMonth = new Date(Date.UTC(year, month - 2, 1))
  return {
    year: previousMonth.getUTCFullYear(),
    month: previousMonth.getUTCMonth() + 1,
    forced: false,
    isClosingWindow: day === 1,
  }
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function closeMonth(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const competence = getCompetence(request)
  if (!competence.forced && !competence.isClosingWindow) {
    return Response.json({
      success: true,
      skipped: true,
      reason: 'Hoje não é o primeiro dia do mês em São Paulo.',
    })
  }

  const admin = getSupabaseAdmin()
  const month = String(competence.month).padStart(2, '0')
  const lastDay = new Date(Date.UTC(competence.year, competence.month, 0)).getUTCDate()
  const startDate = `${competence.year}-${month}-01`
  const endDate = `${competence.year}-${month}-${String(lastDay).padStart(2, '0')}`

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, nome_completo, email, telefone, cpf, cep, endereco, numero, complemento, bairro, alunos_info(*)')
    .eq('role', 'ALUNO')

  if (profilesError) {
    return Response.json({ error: profilesError.message }, { status: 500 })
  }

  const monthlyStudents = (profiles || []).filter((profile: any) => {
    const info = Array.isArray(profile.alunos_info)
      ? profile.alunos_info[0]
      : profile.alunos_info
    return info?.status !== 'Inativo' && info?.modelo_faturamento === 'MENSAL_FECHADO'
  })

  if (monthlyStudents.length === 0) {
    return Response.json({ success: true, competence: startDate, processed: [] })
  }

  const studentIds = monthlyStudents.map((student: any) => student.id)
  const { data: classHistory, error: classHistoryError } = await admin
    .from('historico_aulas')
    .select('aluno_id, data_aula, status')
    .in('aluno_id', studentIds)
    .gte('data_aula', startDate)
    .lte('data_aula', `${endDate}T23:59:59`)
    .in('status', ['Realizada', 'Reposição'])

  if (classHistoryError) {
    return Response.json({ error: classHistoryError.message }, { status: 500 })
  }

  const processed: any[] = []

  for (const student of monthlyStudents) {
    const info = Array.isArray(student.alunos_info)
      ? student.alunos_info[0]
      : student.alunos_info
    const lessonCount = (classHistory || []).filter(
      (lesson: any) => lesson.aluno_id === student.id,
    ).length
    const lessonValue = Number(info?.valor_por_aula || 0)
    const total = Number((lessonCount * lessonValue).toFixed(2))

    const { data: existingInvoice } = await admin
      .from('faturas')
      .select('*')
      .eq('aluno_id', student.id)
      .eq('competencia', startDate)
      .eq('modelo_faturamento', 'MENSAL_FECHADO')
      .maybeSingle()

    if (existingInvoice) {
      processed.push({
        alunoId: student.id,
        status: 'already_processed',
        invoiceId: existingInvoice.id,
      })
      continue
    }

    const dueDate = addDays(endDate, Number(info?.prazo_vencimento_dias || 7))
    const { data: invoice, error: invoiceError } = await admin
      .from('faturas')
      .insert({
        aluno_id: student.id,
        competencia: startDate,
        modelo_faturamento: 'MENSAL_FECHADO',
        quantidade_aulas: lessonCount,
        valor_unitario: lessonValue,
        valor_total: total,
        data_emissao: endDate,
        data_vencimento: dueDate,
        status: total > 0 ? 'RASCUNHO' : 'SEM_MOVIMENTO',
        provider: process.env.ASAAS_API_KEY ? 'ASAAS' : 'MANUAL',
        external_reference: `${student.id}:${startDate}`,
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      processed.push({
        alunoId: student.id,
        status: 'error',
        error: invoiceError?.message || 'Não foi possível criar a fatura.',
      })
      continue
    }

    if (total <= 0) {
      processed.push({ alunoId: student.id, status: 'no_classes', invoiceId: invoice.id })
      continue
    }

    if (!process.env.ASAAS_API_KEY) {
      await admin.from('faturas').update({ status: 'PENDENTE' }).eq('id', invoice.id)
      processed.push({
        alunoId: student.id,
        status: 'manual',
        invoiceId: invoice.id,
      })
      continue
    }

    try {
      let customerId = info?.asaas_customer_id
      if (!customerId) {
        const customer = await createAsaasCustomer({
          name: student.nome_completo,
          cpfCnpj: unmask(student.cpf),
          email: student.email || undefined,
          mobilePhone: unmask(student.telefone) || undefined,
          postalCode: unmask(student.cep) || undefined,
          address: student.endereco || undefined,
          addressNumber: student.numero || undefined,
          complement: student.complemento || undefined,
          province: student.bairro || undefined,
          externalReference: student.id,
        })
        customerId = customer.id
        await admin
          .from('alunos_info')
          .update({ asaas_customer_id: customerId })
          .eq('id', student.id)
      }

      const payment = await createAsaasPayment({
        customer: customerId,
        value: total,
        dueDate,
        description: `Aulas Lotus Music — ${month}/${competence.year} (${lessonCount} aula${lessonCount === 1 ? '' : 's'})`,
        externalReference: invoice.id,
      })

      await admin
        .from('faturas')
        .update({
          status: 'PENDENTE',
          provider_customer_id: customerId,
          provider_payment_id: payment.id,
          invoice_url: payment.invoiceUrl || payment.bankSlipUrl || null,
          erro_integracao: null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', invoice.id)

      processed.push({
        alunoId: student.id,
        status: 'issued',
        invoiceId: invoice.id,
        providerPaymentId: payment.id,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido no Asaas.'
      await admin
        .from('faturas')
        .update({
          status: 'ERRO',
          erro_integracao: message,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', invoice.id)
      processed.push({
        alunoId: student.id,
        status: 'error',
        invoiceId: invoice.id,
        error: message,
      })
    }
  }

  return Response.json({ success: true, competence: startDate, processed })
}

export async function GET(request: NextRequest) {
  return closeMonth(request)
}

export async function POST(request: NextRequest) {
  return closeMonth(request)
}
