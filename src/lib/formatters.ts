const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function formatCPF(value: string) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function formatCNPJ(value: string) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatCPFOrCNPJ(value: string) {
  return onlyDigits(value).length > 11 ? formatCNPJ(value) : formatCPF(value)
}

export function formatCEP(value: string) {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

export function formatBrazilianPhone(value: string) {
  let digits = onlyDigits(value)

  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
  digits = digits.slice(0, 11)

  if (digits.length <= 2) return digits ? `(${digits}` : ''

  const ddd = digits.slice(0, 2)
  const local = digits.slice(2)

  if (local.length <= 4) return `(${ddd}) ${local}`
  if (local.length <= 8) return `(${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`
  return `(${ddd}) ${local.slice(0, 5)}-${local.slice(5, 9)}`
}

export function ensureBrazilianNinthDigit(value: string) {
  let digits = onlyDigits(value)
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
  if (digits.length === 10) digits = `${digits.slice(0, 2)}9${digits.slice(2)}`
  return formatBrazilianPhone(digits)
}

export function formatDateInput(value: string) {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
}

export function dateInputToISO(value: string) {
  const digits = onlyDigits(value)
  if (digits.length !== 8) return null

  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isoToDateInput(value?: string | null) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

export function normalizeName(value: string) {
  const lowercaseWords = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) => {
      const lowered = word.toLocaleLowerCase('pt-BR')
      if (index > 0 && lowercaseWords.has(lowered)) return lowered
      return lowered.charAt(0).toLocaleUpperCase('pt-BR') + lowered.slice(1)
    })
    .join(' ')
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

export function unmask(value?: string | null) {
  return onlyDigits(value || '')
}
