import { jsPDF } from 'jspdf'

type ReceiptPayment = {
  id: string
  valor: number | string
  data_pagamento: string
  metodo_pagamento?: string | null
  fatura_id?: string | null
  provider_payment_id?: string | null
  fatura?: {
    numero?: number | string | null
    competencia?: string | null
    modelo_faturamento?: string | null
  } | null
}

type ReceiptPerson = {
  nome_completo?: string | null
  cpf?: string | null
  email?: string | null
  telefone?: string | null
}

type ReceiptSchool = {
  escola_nome?: string | null
  nome_escola?: string | null
  escola_documento?: string | null
  cnpj?: string | null
  escola_email?: string | null
  escola_telefone?: string | null
  telefone?: string | null
  escola_endereco?: string | null
  endereco?: string | null
  escola_numero?: string | null
  numero?: string | null
  escola_complemento?: string | null
  complemento?: string | null
  escola_bairro?: string | null
  bairro?: string | null
  escola_cidade?: string | null
  cidade?: string | null
  escola_estado?: string | null
  estado?: string | null
}

export type ReceiptPdfData = {
  payment: ReceiptPayment
  student: ReceiptPerson
  school: ReceiptSchool
  billingModelLabel: string
}

const formatCurrency = (value: number | string) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDate = (value?: string | null) => {
  if (!value) return 'Nao informada'
  const dateOnly = String(value).slice(0, 10)
  return new Date(`${dateOnly}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const compact = (items: Array<string | null | undefined>) => items.filter(Boolean).join(' - ')

const schoolAddress = (school: ReceiptSchool) => {
  const street = school.escola_endereco || school.endereco
  const number = school.escola_numero || school.numero
  const complement = school.escola_complemento || school.complemento
  const district = school.escola_bairro || school.bairro
  const city = school.escola_cidade || school.cidade
  const state = school.escola_estado || school.estado

  return compact([
    compact([street, number]),
    complement,
    district,
    compact([city, state]),
  ])
}

const receiptNumber = (payment: ReceiptPayment) =>
  `REC-${String(payment.id || '').replace(/-/g, '').slice(0, 8).toUpperCase() || 'SEMNUM'}`

const invoiceNumber = (payment: ReceiptPayment) => {
  if (payment.fatura?.numero) return `FAT-${String(payment.fatura.numero).padStart(6, '0')}`
  if (payment.fatura_id) return `FAT-${String(payment.fatura_id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
  return 'Pagamento avulso'
}

const drawReceipt = (doc: jsPDF, data: ReceiptPdfData) => {
  const { payment, student, school, billingModelLabel } = data
  const schoolName = school.escola_nome || school.nome_escola || 'Lotus Music'
  const schoolDocument = school.escola_documento || school.cnpj || ''
  const schoolPhone = school.escola_telefone || school.telefone || ''
  const address = schoolAddress(school)
  const identifier = receiptNumber(payment)

  doc.setFillColor(247, 245, 239)
  doc.rect(0, 0, 210, 297, 'F')

  doc.setFillColor(23, 63, 53)
  doc.roundedRect(14, 14, 182, 48, 5, 5, 'F')
  doc.setTextColor(216, 181, 117)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('RECIBO DE PAGAMENTO', 24, 29)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.text(schoolName, 24, 43)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(identifier, 186, 29, { align: 'right' })
  doc.text('Pagamento confirmado', 186, 43, { align: 'right' })

  doc.setTextColor(52, 67, 61)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('VALOR RECEBIDO', 20, 82)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(23, 81, 67)
  doc.text(formatCurrency(payment.valor), 20, 96)

  doc.setFillColor(228, 236, 231)
  doc.roundedRect(151, 76, 39, 12, 6, 6, 'F')
  doc.setTextColor(29, 104, 79)
  doc.setFontSize(8)
  doc.text('CONFIRMADO', 170.5, 83.5, { align: 'center' })

  doc.setDrawColor(222, 218, 208)
  doc.line(20, 109, 190, 109)

  const fields = [
    ['Recebido de', student.nome_completo || 'Aluno'],
    ['CPF/CNPJ', student.cpf || 'Nao informado'],
    ['Data do pagamento', formatDate(payment.data_pagamento)],
    ['Forma de pagamento', payment.metodo_pagamento || 'Nao informada'],
    ['Modelo de faturamento', billingModelLabel],
    ['Referencia', invoiceNumber(payment)],
  ]

  fields.forEach(([label, value], index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = column === 0 ? 20 : 108
    const y = 124 + row * 25
    doc.setTextColor(116, 128, 121)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(label.toUpperCase(), x, y)
    doc.setTextColor(35, 50, 44)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(String(value), 78), x, y + 7)
  })

  doc.setFillColor(251, 250, 246)
  doc.setDrawColor(222, 218, 208)
  doc.roundedRect(20, 198, 170, 31, 4, 4, 'FD')
  doc.setTextColor(83, 99, 91)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const statement = `Declaramos que recebemos de ${student.nome_completo || 'Aluno'} o valor de ${formatCurrency(payment.valor)}, referente ao faturamento indicado neste recibo.`
  doc.text(doc.splitTextToSize(statement, 154), 28, 211)

  doc.setTextColor(35, 50, 44)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(schoolName, 20, 248)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(104, 116, 110)
  doc.setFontSize(8)
  const issuerLines = [
    schoolDocument ? `CPF/CNPJ: ${schoolDocument}` : '',
    address,
    compact([schoolPhone, school.escola_email]),
  ].filter(Boolean)
  issuerLines.forEach((line, index) => doc.text(doc.splitTextToSize(line, 150), 20, 255 + index * 5))

  doc.setDrawColor(222, 218, 208)
  doc.line(20, 279, 190, 279)
  doc.setTextColor(130, 139, 134)
  doc.setFontSize(7)
  doc.text(`Documento gerado digitalmente em ${new Date().toLocaleString('pt-BR')}.`, 20, 286)
  doc.text(identifier, 190, 286, { align: 'right' })
}

export function buildReceiptPdf(data: ReceiptPdfData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setProperties({
    title: `Recibo ${receiptNumber(data.payment)}`,
    subject: 'Recibo de pagamento',
    author: data.school.escola_nome || data.school.nome_escola || 'Lotus Music',
  })
  drawReceipt(doc, data)
  return doc
}

export function downloadReceiptPdf(data: ReceiptPdfData) {
  const doc = buildReceiptPdf(data)
  doc.save(`${receiptNumber(data.payment)}.pdf`)
}

export function downloadReceiptHistoryPdf(items: ReceiptPdfData[]) {
  if (items.length === 0) return
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setProperties({
    title: `Recibos - ${items[0].student.nome_completo || 'Aluno'}`,
    subject: 'Historico de recibos confirmados',
    author: items[0].school.escola_nome || items[0].school.nome_escola || 'Lotus Music',
  })

  items.forEach((item, index) => {
    if (index > 0) doc.addPage()
    drawReceipt(doc, item)
  })

  const studentName = String(items[0].student.nome_completo || 'Aluno')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  doc.save(`Recibos-${studentName || 'Aluno'}.pdf`)
}
