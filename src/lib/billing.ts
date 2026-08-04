export type BillingModel = 'CREDITOS' | 'MENSAL_FECHADO' | 'VENCIMENTO_FIXO'

export const DEFAULT_BILLING_MODEL: BillingModel = 'VENCIMENTO_FIXO'

export const BILLING_MODELS: Array<{
  value: BillingModel
  label: string
  shortLabel: string
  description: string
}> = [
  {
    value: 'CREDITOS',
    label: 'Pacote de créditos',
    shortLabel: 'Créditos',
    description: 'Cada pagamento libera 4 aulas. Apenas aulas realizadas consomem o saldo.',
  },
  {
    value: 'MENSAL_FECHADO',
    label: 'Mês fechado',
    shortLabel: 'Mês fechado',
    description: 'Soma as aulas realizadas no mês e emite a fatura no último dia, com 7 dias para pagar.',
  },
  {
    value: 'VENCIMENTO_FIXO',
    label: 'Vencimento fixo',
    shortLabel: 'Vencimento fixo',
    description: 'Mensalidade com dia fixo. Reposições válidas por 30 dias.',
  },
]

export function getBillingModel(info: any): BillingModel {
  const model = info?.modelo_faturamento
  return BILLING_MODELS.some((item) => item.value === model)
    ? model
    : DEFAULT_BILLING_MODEL
}

export function getBillingModelLabel(model?: string | null) {
  return BILLING_MODELS.find((item) => item.value === model)?.shortLabel || 'Vencimento fixo'
}

export function isBillableClass(status?: string | null) {
  return status === 'Realizada' || status === 'Reposição'
}

export function formatCurrencyBR(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function monthPrefix(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
