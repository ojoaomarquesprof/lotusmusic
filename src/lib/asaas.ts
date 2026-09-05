type AsaasCustomerInput = {
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  postalCode?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  externalReference: string
}

type AsaasPaymentInput = {
  customer: string
  value: number
  dueDate: string
  description: string
  externalReference: string
}

type AsaasCustomer = {
  id: string
}

export type AsaasPayment = {
  id: string
  invoiceUrl?: string
  bankSlipUrl?: string
  status?: string
}

function getAsaasBaseUrl() {
  return process.env.ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'
}

async function asaasRequest<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada.')

  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      'User-Agent': 'LotusMusic/1.0',
      ...init.headers,
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload?.errors?.map((item: any) => item.description).join('; ') ||
      payload?.message ||
      `Erro ${response.status} na API do Asaas.`
    throw new Error(message)
  }

  return payload as T
}

export function createAsaasCustomer(input: AsaasCustomerInput) {
  return asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      notificationDisabled: false,
    }),
  })
}

export function createAsaasPayment(input: AsaasPaymentInput) {
  return asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      billingType: 'UNDEFINED',
      postalService: false,
    }),
  })
}
