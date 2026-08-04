import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE'])
const CANCELED_EVENTS = new Set(['PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_REFUND_IN_PROGRESS'])

export async function POST(request: NextRequest) {
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (
    !webhookToken ||
    request.headers.get('asaas-access-token') !== webhookToken
  ) {
    return Response.json({ error: 'Token de webhook inválido.' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  if (!payload?.id || !payload?.event || !payload?.payment?.id) {
    return Response.json({ error: 'Evento inválido.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error: eventError } = await admin.from('billing_webhook_events').insert({
    event_id: payload.id,
    provider: 'ASAAS',
    event_type: payload.event,
    payload,
  })

  if (eventError?.code === '23505') {
    return Response.json({ success: true, duplicate: true })
  }
  if (eventError) {
    return Response.json({ error: eventError.message }, { status: 500 })
  }

  const { data: invoice, error: invoiceError } = await admin
    .from('faturas')
    .select('*')
    .eq('provider_payment_id', payload.payment.id)
    .maybeSingle()

  if (invoiceError) {
    return Response.json({ error: invoiceError.message }, { status: 500 })
  }
  if (!invoice) {
    return Response.json({ success: true, ignored: true })
  }

  if (PAID_EVENTS.has(payload.event)) {
    await admin
      .from('faturas')
      .update({
        status: 'PAGO',
        pago_em: payload.payment.paymentDate || new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', invoice.id)

    const { error: paymentError } = await admin.from('pagamentos').insert({
      aluno_id: invoice.aluno_id,
      fatura_id: invoice.id,
      provider_payment_id: payload.payment.id,
      valor: Number(payload.payment.value || invoice.valor_total),
      status: 'Pago',
      data_pagamento:
        payload.payment.paymentDate ||
        payload.payment.confirmedDate ||
        new Date().toISOString().slice(0, 10),
      metodo_pagamento: payload.payment.billingType || 'Asaas',
    })

    if (paymentError && paymentError.code !== '23505') {
      return Response.json({ error: paymentError.message }, { status: 500 })
    }
  } else if (OVERDUE_EVENTS.has(payload.event)) {
    await admin
      .from('faturas')
      .update({ status: 'VENCIDO', atualizado_em: new Date().toISOString() })
      .eq('id', invoice.id)
  } else if (CANCELED_EVENTS.has(payload.event)) {
    await admin
      .from('faturas')
      .update({ status: 'CANCELADO', atualizado_em: new Date().toISOString() })
      .eq('id', invoice.id)
  }

  return Response.json({ success: true })
}
