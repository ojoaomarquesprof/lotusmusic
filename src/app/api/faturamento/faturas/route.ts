import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  buildAddress,
  InvoiceLesson,
  InvoiceSchedule,
  resolveLessonDetails,
  saoPauloISODate,
} from '../../../../lib/invoices'

export const dynamic = 'force-dynamic'

type ManualInvoiceBody = {
  alunoId?: string
  historicoAulaIds?: Array<string | number>
  dataVencimento?: string
  valorUnitario?: number
  observacoes?: string
}

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function getAuthenticatedClient(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('A conexão pública com o Supabase não está configurada.')
  }

  const database = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return { database, token }
}

async function requireAdmin(database: SupabaseClient, token: string) {
  const { data: { user }, error } = await database.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await database
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.role === 'ADMIN' ? profile : null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Erro desconhecido.')
  }
  return 'Não foi possível emitir a fatura.'
}

export async function POST(request: Request) {
  let database: SupabaseClient
  let token: string

  try {
    const authenticated = getAuthenticatedClient(request)
    database = authenticated.database
    token = authenticated.token
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }

  const requester = await requireAdmin(database, token)
  if (!requester) {
    return Response.json(
      { error: 'Somente administradores podem emitir faturas.' },
      { status: 403 },
    )
  }

  let invoiceId: string | null = null

  try {
    const body = (await request.json()) as ManualInvoiceBody
    const alunoId = body.alunoId?.trim()
    const lessonIds = Array.from(
      new Set((body.historicoAulaIds || []).map((value) => String(value))),
    )
    const issueDate = saoPauloISODate()
    const dueDate = body.dataVencimento?.slice(0, 10)
    const unitValue = Number(body.valorUnitario)

    if (!alunoId) {
      return Response.json({ error: 'Aluno não informado.' }, { status: 400 })
    }
    if (lessonIds.length === 0 || lessonIds.length > 200) {
      return Response.json(
        { error: 'Selecione entre 1 e 200 aulas pendentes.' },
        { status: 400 },
      )
    }
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return Response.json({ error: 'Informe uma data de vencimento válida.' }, { status: 400 })
    }
    if (!Number.isFinite(unitValue) || unitValue <= 0) {
      return Response.json({ error: 'Informe um valor por aula maior que zero.' }, { status: 400 })
    }

    const { data: student, error: studentError } = await database
      .from('profiles')
      .select(
        'id, nome_completo, email, telefone, cpf, cep, endereco, numero, complemento, bairro, cidade, estado, alunos_info(*)',
      )
      .eq('id', alunoId)
      .eq('role', 'ALUNO')
      .single()

    if (studentError || !student) {
      return Response.json({ error: 'Aluno não encontrado.' }, { status: 404 })
    }

    const { data: lessons, error: lessonsError } = await database
      .from('historico_aulas')
      .select(
        'id, aluno_id, data_aula, horario_inicio, horario_fim, status, professor_id, modalidade, fatura_id, turma_id, valor_aula_faturado',
      )
      .eq('aluno_id', alunoId)
      .in('id', lessonIds)
      .in('status', ['Realizada', 'Reposição'])
      .is('fatura_id', null)
      .order('data_aula', { ascending: true })

    if (lessonsError) throw lessonsError
    if (!lessons || lessons.length !== lessonIds.length) {
      return Response.json(
        {
          error:
            'Uma ou mais aulas já foram faturadas ou deixaram de estar disponíveis. Atualize o perfil e tente novamente.',
        },
        { status: 409 },
      )
    }

    const { data: schedules, error: schedulesError } = await database
      .from('agenda')
      .select(
        'dia, horario_inicio, professor_id, instrumento_aula, professor:profiles!professor_id(nome_completo)',
      )
      .eq('aluno_id', alunoId)
      .order('horario_inicio')

    if (schedulesError) throw schedulesError

    const professorIds = Array.from(
      new Set(
        [
          ...(lessons || []).map((lesson: any) => lesson.professor_id),
          ...(schedules || []).map((schedule: any) => schedule.professor_id),
        ].filter(Boolean),
      ),
    )
    const professorNames: Record<string, string> = {}

    if (professorIds.length > 0) {
      const { data: professors, error: professorsError } = await database
        .from('profiles')
        .select('id, nome_completo')
        .in('id', professorIds)
      if (professorsError) throw professorsError
      for (const professor of professors || []) {
        professorNames[professor.id] = professor.nome_completo
      }
    }

    const { data: schoolSettings } = await database
      .from('configuracoes')
      .select(
        'escola_nome, escola_documento, escola_email, escola_telefone, escola_cep, escola_endereco, escola_numero, escola_complemento, escola_bairro, escola_cidade, escola_estado',
      )
      .eq('id', 1)
      .maybeSingle()

    const info = getRelation<any>(student.alunos_info)
    const dates = lessons.map((lesson: any) => String(lesson.data_aula).slice(0, 10)).sort()
    const periodStart = dates[0]
    const periodEnd = dates[dates.length - 1]
    const lessonValues = lessons.map((lesson: any) => {
      const frozenValue = Number(lesson.valor_aula_faturado || 0)
      return frozenValue > 0 ? frozenValue : unitValue
    })
    const total = Number(lessonValues.reduce((sum, value) => sum + value, 0).toFixed(2))
    const invoiceUnitValue = Number((total / lessons.length).toFixed(2))
    const competence = `${periodStart.slice(0, 7)}-01`
    const groupIds = Array.from(new Set(lessons.map((lesson: any) => lesson.turma_id).filter(Boolean)))
    const turmaId = groupIds[0] || null

    const { data: invoice, error: invoiceError } = await database
      .from('faturas')
      .insert({
        aluno_id: alunoId,
        competencia: competence,
        modelo_faturamento: turmaId ? 'MENSAL_FECHADO' : info?.modelo_faturamento || 'VENCIMENTO_FIXO',
        tipo_emissao: 'MANUAL',
        periodo_inicio: periodStart,
        periodo_fim: periodEnd,
        quantidade_aulas: lessons.length,
        valor_unitario: invoiceUnitValue,
        valor_total: total,
        turma_id: turmaId,
        data_emissao: issueDate,
        data_vencimento: dueDate,
        status: 'PENDENTE',
        provider: 'MANUAL',
        external_reference: `manual:${alunoId}:${Date.now()}`,
        observacoes: body.observacoes?.trim() || null,
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
      throw invoiceError || new Error('Não foi possível criar a fatura.')
    }
    invoiceId = invoice.id

    const items = lessons.map((lesson: any, index: number) => {
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

    const { error: itemsError } = await database.from('fatura_itens').insert(items)
    if (itemsError) throw itemsError

    const { data: linkedLessons, error: linkError } = await database
      .from('historico_aulas')
      .update({
        fatura_id: invoice.id,
        faturado_em: new Date().toISOString(),
      })
      .eq('aluno_id', alunoId)
      .in('id', lessonIds)
      .is('fatura_id', null)
      .select('id')

    if (linkError || linkedLessons?.length !== lessons.length) {
      throw linkError || new Error('As aulas mudaram durante a emissão. Tente novamente.')
    }

    return Response.json({ success: true, invoice })
  } catch (error) {
    if (invoiceId) {
      await database.from('historico_aulas').update({
        fatura_id: null,
        faturado_em: null,
      }).eq('fatura_id', invoiceId)
      await database.from('faturas').delete().eq('id', invoiceId)
    }

    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
