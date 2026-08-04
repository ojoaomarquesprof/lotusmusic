export type InvoiceLesson = {
  id: string | number
  data_aula: string
  horario_inicio?: string | null
  horario_fim?: string | null
  professor_id?: string | null
  modalidade?: string | null
}

export type InvoiceSchedule = {
  dia?: string | null
  horario_inicio?: string | null
  professor_id?: string | null
  instrumento_aula?: string | null
  professor?: { nome_completo?: string | null } | Array<{ nome_completo?: string | null }> | null
}

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

function normalizeTime(value?: string | null) {
  return value?.slice(0, 5) || ''
}

export function getWeekdayName(dateValue: string) {
  const date = new Date(`${dateValue.slice(0, 10)}T12:00:00Z`)
  return WEEKDAYS[date.getUTCDay()]
}

export function getScheduleProfessorName(schedule?: InvoiceSchedule | null) {
  if (!schedule?.professor) return null
  return Array.isArray(schedule.professor)
    ? schedule.professor[0]?.nome_completo || null
    : schedule.professor.nome_completo || null
}

export function resolveLessonDetails(
  lesson: InvoiceLesson,
  schedules: InvoiceSchedule[],
  professorNames: Record<string, string> = {},
) {
  const lessonDay = getWeekdayName(lesson.data_aula)
  const sameDay = schedules.filter((schedule) => schedule.dia === lessonDay)
  const sameTime = sameDay.find(
    (schedule) =>
      normalizeTime(schedule.horario_inicio) === normalizeTime(lesson.horario_inicio),
  )
  const schedule = sameTime || sameDay[0] || schedules[0] || null
  const professorId = lesson.professor_id || schedule?.professor_id || null
  const professorName =
    (professorId ? professorNames[professorId] : null) ||
    getScheduleProfessorName(schedule) ||
    'Professor não informado'

  return {
    professorId,
    professorName,
    modalidade:
      lesson.modalidade ||
      schedule?.instrumento_aula ||
      'Modalidade não informada',
  }
}

export function buildAddress(data: {
  endereco?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
}) {
  const street = [data.endereco, data.numero].filter(Boolean).join(', ')
  const complement = data.complemento ? ` - ${data.complemento}` : ''
  const district = data.bairro || ''
  const cityState = [data.cidade, data.estado].filter(Boolean).join('/')
  const cep = data.cep ? `CEP ${data.cep}` : ''

  return [
    `${street}${complement}`.trim(),
    district,
    cityState,
    cep,
  ]
    .filter(Boolean)
    .join(' • ')
}

export function addDaysISO(dateValue: string, days: number) {
  const date = new Date(`${dateValue.slice(0, 10)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function saoPauloISODate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatInvoiceNumber(numero?: number | string | null, id?: string | null) {
  if (numero) return `FAT-${String(numero).padStart(6, '0')}`
  return `FAT-${String(id || '').slice(0, 8).toUpperCase()}`
}
