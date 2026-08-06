import { NextRequest } from 'next/server'
import { createAsaasCustomer, createAsaasPayment } from '../../../../lib/asaas'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { unmask } from '../../../../lib/formatters'
import {
  addDaysISO,
  buildAddress,
  InvoiceLesson,
  InvoiceSchedule,
  resolveLessonDetails,
} from '../../../../lib/invoices'

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

  const studentIds = (profiles || []).map((student: any) => student.id)
  const { data: classHistory, error: classHistoryError } = await admin
    .from('historico_aulas')
    .select('id, aluno_id, data_aula, horario_inicio, horario_fim, status, professor_id, modalidade, fatura_id, turma_id, valor_aula_faturado')
    .in('aluno_id', studentIds)
    .gte('data_aula', startDate)
    .lte('data_aula', `${endDate}T23:59:59`)
    .in('status', ['Realizada', 'Reposição'])
    .is('fatura_id', null)

  if (classHistoryError) {
    return Response.json({ error: classHistoryError.message }, { status: 500 })
  }

  const billingStudents = (profiles || []).filter((profile: any) => {
    const info = Array.isArray(profile.alunos_info)
      ? profile.alunos_info[0]
      : profile.alunos_info
    const hasGroupLessons = (classHistory || []).some(
      (lesson: any) => lesson.aluno_id === profile.id && lesson.turma_id,
    )
    return (info?.status !== 'Inativo' && info?.modelo_faturamento === 'MENSAL_FECHADO')
      || hasGroupLessons
  })

  if (billingStudents.length === 0) {
    return Response.json({ success: true, competence: startDate, processed: [] })
  }

  const { data: schoolSettings } = await admin
    .from('configuracoes')
    .select(
      'escola_nome, escola_documento, escola_email, escola_telefone, escola_cep, escola_endereco, escola_numero, escola_complemento, escola_bairro, escola_cidade, escola_estado',
    )
    .eq('id', 1)
    .maybeSingle()

  const processed: any[] = []

  for (const student of billingStudents) {
    const info = Array.isArray(student.alunos_info)
      ? student.alunos_info[0]
      : student.alunos_info
    const isMonthlyStudent = info?.status !== 'Inativo' && info?.modelo_faturamento === 'MENSAL_FECHADO'
    const studentLessons = (classHistory || []).filter(
      (lesson: any) =>
        lesson.aluno_id === student.id
        && (isMonthlyStudent || Boolean(lesson.turma_id)),
    )
    const lessonCount = studentLessons.length
    const defaultLessonValue = Number(info?.valor_por_aula || 0)
    const lessonValues = studentLessons.map((lesson: any) => {
      const frozenValue = Number(lesson.valor_aula_faturado || 0)
      return frozenValue > 0 ? frozenValue : defaultLessonValue
    })
    const total = Number(lessonValues.reduce((sum, value) => sum + value, 0).toFixed(2))
    const lessonValue = lessonCount > 0 ? Number((total / lessonCount).toFixed(2)) : 0
    const groupIds = Array.from(new Set(studentLessons.map((lesson: any) => lesson.turma_id).filter(Boolean)))
    const turmaId = groupIds[0] || null

    const { data: existingInvoice } = await admin
      .from('faturas')
      .select('*')
      .eq('aluno_id', student.id)
      .eq('competencia', startDate)
      .eq('modelo_faturamento', 'MENSAL_FECHADO')
      .eq('tipo_emissao', 'AUTOMATICA')
      .neq('status', 'CANCELADO')
      .maybeSingle()

    if (existingInvoice) {
      processed.push({
        alunoId: student.id,
        status: 'already_processed',
        invoiceId: existingInvoice.id,
      })
      continue
    }

    const dueDate = addDaysISO(endDate, Number(info?.prazo_vencimento_dias || 7))
    const { data: invoice, error: invoiceError } = await admin
      .from('faturas')
      .insert({
        aluno_id: student.id,
        competencia: startDate,
        modelo_faturamento: 'MENSAL_FECHADO',
        tipo_emissao: 'AUTOMATICA',
        periodo_inicio: startDate,
        periodo_fim: endDate,
        quantidade_aulas: lessonCount,
        valor_unitario: lessonValue,
        valor_total: total,
        turma_id: turmaId,
        data_emissao: endDate,
        data_vencimento: dueDate,
        status: total > 0 ? 'RASCUNHO' : 'SEM_MOVIMENTO',
        provider: process.env.ASAAS_API_KEY ? 'ASAAS' : 'MANUAL',
        external_reference: `${student.id}:${startDate}`,
        aluno_nome: student.nome_completo,
        aluno_documento: student.cpf,
        aluno_email: student.email,
        aluno_telefone: student.telefone,
        aluno_endereco: buildAddress(student),
        emitente_nome: schoolSettings?.escola_nome || 'Lotus Music',
        emitente_documento: schoolSettings?.escola_documento || null,
        emitente_email: schoolSettings?.escola_email || null,
        emitente_telefone: schoolSettings?.escola_telefone || null,
        emitente_endereco: buildAddress({
          endereco: schoolSettings?.escola_endereco,
          numero: schoolSettings?.escola_numero,
          complemento: schoolSettings?.escola_complemento,
          bairro: schoolSettings?.escola_bairro,
          cidade: schoolSettings?.escola_cidade,
          estado: schoolSettings?.escola_estado,
          cep: schoolSettings?.escola_cep,
        }),
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

    if (studentLessons.length > 0) {
      try {
        const { data: schedules, error: schedulesError } = await admin
          .from('agenda')
          .select(
            'dia, horario_inicio, professor_id, instrumento_aula, professor:profiles!professor_id(nome_completo)',
          )
          .eq('aluno_id', student.id)
          .order('horario_inicio')
        if (schedulesError) throw schedulesError

        const professorIds = Array.from(
          new Set(
            [
              ...studentLessons.map((lesson: any) => lesson.professor_id),
              ...(schedules || []).map((schedule: any) => schedule.professor_id),
            ].filter(Boolean),
          ),
        )
        const professorNames: Record<string, string> = {}
        if (professorIds.length > 0) {
          const { data: professors, error: professorsError } = await admin
            .from('profiles')
            .select('id, nome_completo')
            .in('id', professorIds)
          if (professorsError) throw professorsError
          for (const professor of professors || []) {
            professorNames[professor.id] = professor.nome_completo
          }
        }

        const items = studentLessons.map((lesson: any, index: number) => {
          const details = resolveLessonDetails(
            lesson as InvoiceLesson,
            (schedules || []) as InvoiceSchedule[],
            professorNames,
          )
          return {
            fatura_id: invoice.id,
            historico_aula_id: String(lesson.id),
            data_aula: String(lesson.data_aula).slice(0, 10),
            horario_inicio: lesson.horario_inicio || null,
            horario_fim: lesson.horario_fim || null,
            modalidade: details.modalidade,
            professor_id: details.professorId,
            professor_nome: details.professorName,
            descricao: lesson.turma_id ? 'Aula em turma' : `Aula ${lesson.status.toLowerCase()}`,
            quantidade: 1,
            valor_unitario: lessonValues[index],
            valor_total: lessonValues[index],
          }
        })

        const { error: itemsError } = await admin.from('fatura_itens').insert(items)
        if (itemsError) throw itemsError

        const { data: linkedLessons, error: linkError } = await admin
          .from('historico_aulas')
          .update({
            fatura_id: invoice.id,
            faturado_em: new Date().toISOString(),
          })
          .in('id', studentLessons.map((lesson: any) => lesson.id))
          .is('fatura_id', null)
          .select('id')
        if (linkError || linkedLessons?.length !== studentLessons.length) {
          throw linkError || new Error('As aulas mudaram durante o fechamento.')
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Não foi possível detalhar as aulas da fatura.'
        await admin
          .from('historico_aulas')
          .update({ fatura_id: null, faturado_em: null })
          .eq('fatura_id', invoice.id)
        await admin.from('faturas').delete().eq('id', invoice.id)
        processed.push({
          alunoId: student.id,
          status: 'error',
          error: message,
        })
        continue
      }
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
