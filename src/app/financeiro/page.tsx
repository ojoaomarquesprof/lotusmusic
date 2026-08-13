"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrencyBR, getBillingModel, getBillingModelLabel, isBillableClass, isConfirmedPayment } from '../../lib/billing'
import {
  buildFinancialDossier,
  FinancialCharge,
  getAgingBuckets,
  isOpenCharge,
  isOverdueCharge,
} from '../../lib/financialDossier'
import { ensureBrazilianNinthDigit, formatBrazilianPhone, formatCEP, formatCPFOrCNPJ, normalizeEmail, normalizeName } from '../../lib/formatters'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  FileText,
  Image as ImageIcon,
  Landmark,
  Loader2,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Settings2,
  Trash2,
  TrendingUp,
  UsersRound,
  WalletCards,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'

const DEFAULT_PENDENTE = "Olá, *{{nome}}*! Tudo bem?\n\nAqui é da *Lotus Music*. Sua cobrança de *{{modelo}}* no valor de *{{valor}}* vence em {{vencimento}}.\n\n{{link}}\nChave PIX: *{{pix}}*\n\nMuito obrigado! 🎶"
const DEFAULT_ATRASADO = "Olá, *{{nome}}*! Tudo bem?\n\nAqui é da *Lotus Music*. A cobrança de *{{modelo}}* no valor de *{{valor}}*, com vencimento em {{vencimento}}, está pendente.\n\n{{link}}\nChave PIX: *{{pix}}*\n\nSe precisar, fale com a gente. 🎶"

const PIE_COLORS = ['#10b981', '#f43f5e', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#64748b']

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } } as const

export default function RelatorioFinanceiro() {
  const { s } = useStyles()
  const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)

  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState({ saldoCaixa: 0, previsaoFaturamento: 0, entradasMes: 0, saidasMes: 0, inadimplencia: 0 })
  const [cobrancas, setCobrancas] = useState<FinancialCharge[]>([])
  const [, setAlunosPendentes] = useState<any[]>([])
  const [extratoUnificado, setExtratoUnificado] = useState<any[]>([])
  const [modelCounts, setModelCounts] = useState({ CREDITOS: 0, MENSAL_FECHADO: 0, VENCIMENTO_FIXO: 0 })
  const [pagamentosInformados, setPagamentosInformados] = useState<any[]>([])
  const [selectedReportedPayment, setSelectedReportedPayment] = useState<any>(null)
  const [reportedPaymentProofUrl, setReportedPaymentProofUrl] = useState('')
  const [reportedPaymentReason, setReportedPaymentReason] = useState('')
  const [isReviewingReportedPayment, setIsReviewingReportedPayment] = useState(false)

  const [dadosGraficoBarra, setDadosGraficoBarra] = useState<any[]>([])
  const [dadosGraficoPizza, setDadosGraficoPizza] = useState<any[]>([])

  const [chavePix, setChavePix] = useState('')
  const [msgPendente, setMsgPendente] = useState(DEFAULT_PENDENTE)
  const [msgAtrasado, setMsgAtrasado] = useState(DEFAULT_ATRASADO)
  const [schoolData, setSchoolData] = useState({
    escola_nome: 'Lotus Music',
    escola_documento: '',
    escola_email: '',
    escola_telefone: '',
    escola_cep: '',
    escola_endereco: '',
    escola_numero: '',
    escola_complemento: '',
    escola_bairro: '',
    escola_cidade: '',
    escola_estado: '',
  })
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tTipo, setTTipo] = useState('Saída')
  const [tCategoria, setTCategoria] = useState('Aluguel')
  const [tDescricao, setTDescricao] = useState('')
  const [tValor, setTValor] = useState('')
  const [tData, setTData] = useState(new Date().toISOString().split('T')[0])

  const [filtroExtrato, setFiltroExtrato] = useState('Todos')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'visao' | 'cobrancas' | 'comprovantes' | 'movimentacoes' | 'analises'>('visao')
  const [filtroCobrancas, setFiltroCobrancas] = useState<'Todas' | 'Atrasado' | 'A vencer' | 'Pago' | 'Em apuração' | 'Desconsiderada'>('Todas')
  const [buscaCobranca, setBuscaCobranca] = useState('')
  const [competenciaCobranca, setCompetenciaCobranca] = useState('Todas')
  const [periodoExtrato, setPeriodoExtrato] = useState<'Tudo' | '12 meses' | '3 meses' | 'Mês atual'>('Tudo')
  const [selectedCharge, setSelectedCharge] = useState<FinancialCharge | null>(null)
  const [isChargePanelOpen, setIsChargePanelOpen] = useState(false)
  const [isChargeActionLoading, setIsChargeActionLoading] = useState(false)
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiveMethod, setReceiveMethod] = useState('PIX')
  const [chargeValue, setChargeValue] = useState('')
  const [chargeDueDate, setChargeDueDate] = useState('')
  const [chargeReason, setChargeReason] = useState('')

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarDadosFinanceiros() }, [isMounted])
  useEffect(() => {
    if (!isMounted) return
    const channel = supabase
      .channel('financeiro-pagamentos-informados')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_informados' }, () => carregarDadosFinanceiros())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_aulas' }, () => carregarDadosFinanceiros())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turma_aulas' }, () => carregarDadosFinanceiros())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alunos_info' }, () => carregarDadosFinanceiros())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isMounted])

  async function carregarDadosFinanceiros() {
    setLoading(true)
    const hoje = new Date()
    const prefixoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const inicioMes = `${prefixoMesAtual}-01`
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()

    const [
      { data: configData },
      { data: allPagamentos },
      { data: allTransacoes },
      { data: allFaturas },
      { data: alunos },
      { data: historicoMes },
      { data: ajustesCobranca },
      { data: reportedPayments },
    ] = await Promise.all([
      supabase.from('configuracoes').select('chave_pix, mensagem_pendente, mensagem_atrasado, escola_nome, escola_documento, escola_email, escola_telefone, escola_cep, escola_endereco, escola_numero, escola_complemento, escola_bairro, escola_cidade, escola_estado').eq('id', 1).single(),
      supabase.from('pagamentos').select('*'),
      supabase.from('transacoes').select('*'),
      supabase.from('faturas').select('*').order('data_emissao', { ascending: false }),
      supabase.from('profiles').select('id, nome_completo, telefone, created_at, alunos_info(*)').eq('role', 'ALUNO'),
      supabase
        .from('historico_aulas')
        .select('aluno_id, data_aula, status, turma_id, valor_aula_faturado')
        .gte('data_aula', inicioMes)
        .lte('data_aula', `${prefixoMesAtual}-${String(fimMes).padStart(2, '0')}T23:59:59`),
      supabase.from('ajustes_cobranca').select('*'),
      supabase.from('pagamentos_informados').select('*').order('criado_em', { ascending: false }),
    ])

    if (configData) {
      setChavePix(configData.chave_pix || '')
      setMsgPendente(configData.mensagem_pendente || DEFAULT_PENDENTE)
      setMsgAtrasado(configData.mensagem_atrasado || DEFAULT_ATRASADO)
      setSchoolData(current => ({
        ...current,
        escola_nome: configData.escola_nome || 'Lotus Music',
        escola_documento: configData.escola_documento || '',
        escola_email: configData.escola_email || '',
        escola_telefone: configData.escola_telefone || '',
        escola_cep: configData.escola_cep || '',
        escola_endereco: configData.escola_endereco || '',
        escola_numero: configData.escola_numero || '',
        escola_complemento: configData.escola_complemento || '',
        escola_bairro: configData.escola_bairro || '',
        escola_cidade: configData.escola_cidade || '',
        escola_estado: configData.escola_estado || '',
      }))
    }

    const pagamentos = allPagamentos || []
    const transacoes = allTransacoes || []
    const faturas = allFaturas || []
    setPagamentosInformados((reportedPayments || []).map(item => ({
      ...item,
      aluno: (alunos || []).find(aluno => aluno.id === item.aluno_id),
      fatura: faturas.find(fatura => fatura.id === item.fatura_id),
    })))
    const pagamentosConfirmados = pagamentos.filter(isConfirmedPayment)
    const dossier = buildFinancialDossier({
      alunos: alunos || [],
      pagamentos,
      faturas,
      ajustes: ajustesCobranca || [],
      historicoMes: historicoMes || [],
      hoje,
    })
    const emAberto = dossier.filter(isOpenCharge)
    const vencidas = emAberto.filter(isOverdueCharge)

    let caixaTotal = pagamentosConfirmados.reduce((total, item) => total + Number(item.valor || 0), 0)
    transacoes.forEach(item => {
      if (item.tipo === 'Entrada') caixaTotal += Number(item.valor || 0)
      if (item.tipo === 'Saída') caixaTotal -= Number(item.valor || 0)
    })

    const pagamentosMes = pagamentosConfirmados.filter(item => String(item.data_pagamento).startsWith(prefixoMesAtual))
    const transacoesMes = transacoes.filter(item => String(item.data_transacao).startsWith(prefixoMesAtual))
    let entradasMes = pagamentosMes.reduce((total, item) => total + Number(item.valor || 0), 0)
    let saidasMes = 0
    transacoesMes.forEach(item => {
      if (item.tipo === 'Entrada') entradasMes += Number(item.valor || 0)
      if (item.tipo === 'Saída') saidasMes += Number(item.valor || 0)
    })

    const nomePorAluno = new Map((alunos || []).map(item => [item.id, item.nome_completo]))
    const extrato = [
      ...pagamentosConfirmados.map(item => ({
        id: `pg-${item.id}`,
        data: item.data_pagamento,
        descricao: `Mensalidade: ${nomePorAluno.get(item.aluno_id) || 'Aluno'}`,
        valor: item.valor,
        tipo: 'Entrada',
        categoria: 'Mensalidade',
        competencia: item.competencia || item.data_pagamento,
      })),
      ...transacoes.map(item => ({
        id: `tr-${item.id}`,
        data: item.data_transacao,
        descricao: item.descricao || item.categoria,
        valor: item.valor,
        tipo: item.tipo,
        categoria: item.categoria,
      })),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    const historicoGrafico: any[] = []
    for (let index = 11; index >= 0; index--) {
      const date = new Date(hoje.getFullYear(), hoje.getMonth() - index, 1)
      historicoGrafico.push({
        name: date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
        mesStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        Entradas: 0,
        Saídas: 0,
      })
    }
    pagamentosConfirmados.forEach(item => {
      const period = historicoGrafico.find(row => row.mesStr === String(item.data_pagamento).slice(0, 7))
      if (period) period.Entradas += Number(item.valor || 0)
    })
    transacoes.forEach(item => {
      const period = historicoGrafico.find(row => row.mesStr === String(item.data_transacao).slice(0, 7))
      if (!period) return
      if (item.tipo === 'Entrada') period.Entradas += Number(item.valor || 0)
      if (item.tipo === 'Saída') period.Saídas += Number(item.valor || 0)
    })

    const despesasCategorias: Record<string, number> = {}
    transacoesMes
      .filter(item => item.tipo === 'Saída')
      .forEach(item => {
        despesasCategorias[item.categoria] = (despesasCategorias[item.categoria] || 0) + Number(item.valor || 0)
      })

    const counts = { CREDITOS: 0, MENSAL_FECHADO: 0, VENCIMENTO_FIXO: 0 }
    ;(alunos || []).forEach(aluno => {
      const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info
      if (!info || info.status === 'Inativo') return
      counts[getBillingModel(info)] += 1
    })

    setCobrancas(dossier)
    setExtratoUnificado(extrato)
    setDadosGraficoBarra(historicoGrafico)
    setDadosGraficoPizza(Object.entries(despesasCategorias).map(([name, value]) => ({ name, value })))
    setModelCounts(counts)
    setResumo({
      saldoCaixa: caixaTotal,
      previsaoFaturamento: emAberto.reduce((total, item) => total + Number(item.valor || 0), 0),
      entradasMes,
      saidasMes,
      inadimplencia: vencidas.reduce((total, item) => total + Number(item.valor || 0), 0),
    })
    setLoading(false)
  }

  async function carregarDadosFinanceirosLegado() {
    const hoje = new Date(); const mesAtual = hoje.getMonth() + 1; const anoAtual = hoje.getFullYear(); const diaAtual = hoje.getDate()

    const { data: configData } = await supabase.from('configuracoes').select('chave_pix, mensagem_pendente, mensagem_atrasado, escola_nome, escola_documento, escola_email, escola_telefone, escola_cep, escola_endereco, escola_numero, escola_complemento, escola_bairro, escola_cidade, escola_estado').eq('id', 1).single()
    if (configData) {
      if (configData.chave_pix) setChavePix(configData.chave_pix)
      if (configData.mensagem_pendente) setMsgPendente(configData.mensagem_pendente)
      if (configData.mensagem_atrasado) setMsgAtrasado(configData.mensagem_atrasado)
      setSchoolData(current => ({
        ...current,
        escola_nome: configData.escola_nome || 'Lotus Music',
        escola_documento: configData.escola_documento || '',
        escola_email: configData.escola_email || '',
        escola_telefone: configData.escola_telefone || '',
        escola_cep: configData.escola_cep || '',
        escola_endereco: configData.escola_endereco || '',
        escola_numero: configData.escola_numero || '',
        escola_complemento: configData.escola_complemento || '',
        escola_bairro: configData.escola_bairro || '',
        escola_cidade: configData.escola_cidade || '',
        escola_estado: configData.escola_estado || '',
      }))
    }

    const { data: allPagamentos } = await supabase.from('pagamentos').select('*')
    const pagamentosConfirmados = (allPagamentos || []).filter(isConfirmedPayment)
    const { data: allTransacoes } = await supabase.from('transacoes').select('*')
    const { data: allFaturas } = await supabase.from('faturas').select('*').order('data_emissao', { ascending: false })
    
    let caixaTotal = 0; 
    pagamentosConfirmados.forEach(p => caixaTotal += Number(p.valor));
    allTransacoes?.forEach(t => { if (t.tipo === 'Entrada') caixaTotal += Number(t.valor); if (t.tipo === 'Saída') caixaTotal -= Number(t.valor) })

    // FIX: Filtragem por prefixo string para evitar bugs de fuso horário em dias 01 ou 31.
    const prefixoMesAtual = `${anoAtual}-${String(mesAtual).padStart(2, '0')}`;
    
    const { data: alunos } = await supabase.from('profiles').select('id, nome_completo, telefone, alunos_info(*)').eq('role', 'ALUNO')
    const inicioMes = `${prefixoMesAtual}-01`
    const fimMes = new Date(anoAtual, mesAtual, 0).getDate()
    const { data: historicoMes } = await supabase
      .from('historico_aulas')
      .select('aluno_id, data_aula, status')
      .gte('data_aula', inicioMes)
      .lte('data_aula', `${prefixoMesAtual}-${String(fimMes).padStart(2, '0')}T23:59:59`)
    
    const pgsMes = pagamentosConfirmados.filter(p => p.data_pagamento.startsWith(prefixoMesAtual))
    const transMes = allTransacoes?.filter(t => t.data_transacao.startsWith(prefixoMesAtual)) || []

    let entradasM = 0; let saidasM = 0; let pendentesTemp: any[] = []; let previsaoTotal = 0;
    const counts = { CREDITOS: 0, MENSAL_FECHADO: 0, VENCIMENTO_FIXO: 0 }
    pgsMes.forEach(pg => entradasM += Number(pg.valor))

    let inadimplenciaM = 0
    alunos?.forEach(aluno => {
      const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info; 
      if (!info || !info.valor_mensalidade || info.status === 'Inativo') return

      const modelo = getBillingModel(info)
      counts[modelo] += 1

      if (modelo === 'VENCIMENTO_FIXO') {
        previsaoTotal += Number(info.valor_mensalidade)
        if (pgsMes.some(pg => pg.aluno_id === aluno.id)) return

        const venc = info.data_vencimento || 10; 
        const status = diaAtual > venc ? 'Atrasado' : 'A Vencer'
        
        if (status === 'Atrasado') {
           inadimplenciaM += Number(info.valor_mensalidade)
        }
        
        pendentesTemp.push({ 
           id: aluno.id, 
           nome: aluno.nome_completo, 
           telefone: aluno.telefone, 
           valor: info.valor_mensalidade, 
           vencimento: `dia ${venc}`,
           vencimentoOrdem: venc,
           status,
           modelo: getBillingModelLabel(modelo),
           alunoId: aluno.id,
           invoiceUrl: null,
           invoiceId: null,
         })
      } else if (modelo === 'CREDITOS') {
        const saldo = Number(info.saldo_creditos_faturamento || 0)
        if (saldo <= 0) {
          previsaoTotal += Number(info.valor_mensalidade)
          pendentesTemp.push({
            id: `creditos-${aluno.id}`,
            nome: aluno.nome_completo,
            telefone: aluno.telefone,
            valor: info.valor_mensalidade,
            vencimento: 'agora',
            vencimentoOrdem: 0,
            status: saldo < 0 ? 'Créditos em débito' : 'Sem créditos',
            modelo: getBillingModelLabel(modelo),
            alunoId: aluno.id,
            invoiceUrl: null,
            invoiceId: null,
            saldo,
          })
        }
      } else {
        const faturaCompetencia = (allFaturas || []).find(f =>
          f.aluno_id === aluno.id &&
          f.status !== 'CANCELADO' &&
          String(f.competencia).startsWith(prefixoMesAtual)
        )
        const aulas = (historicoMes || []).filter(h =>
          h.aluno_id === aluno.id && isBillableClass(h.status)
        ).length
        previsaoTotal += Number(faturaCompetencia?.valor_total || aulas * Number(info.valor_por_aula || 0))
      }
    })

    ;(allFaturas || [])
      .filter(fatura => ['PENDENTE', 'VENCIDO', 'ERRO'].includes(fatura.status))
      .forEach(fatura => {
        const aluno = alunos?.find(item => item.id === fatura.aluno_id)
        if (!aluno) return
        const dueDate = fatura.data_vencimento
          ? new Date(`${String(fatura.data_vencimento).slice(0, 10)}T12:00:00`)
          : null
        const estaAtrasada = fatura.status === 'VENCIDO' || (dueDate ? dueDate < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) : false)
        if (estaAtrasada) inadimplenciaM += Number(fatura.valor_total)
        pendentesTemp.push({
          id: `fatura-${fatura.id}`,
          nome: aluno.nome_completo,
          telefone: aluno.telefone,
          valor: fatura.valor_total,
          vencimento: dueDate ? dueDate.toLocaleDateString('pt-BR') : 'a definir',
          vencimentoOrdem: dueDate?.getTime() || Number.MAX_SAFE_INTEGER,
          status: fatura.status === 'ERRO' ? 'Erro na emissão' : estaAtrasada ? 'Atrasado' : 'A Vencer',
          modelo: getBillingModelLabel(fatura.modelo_faturamento),
          alunoId: aluno.id,
          invoiceUrl: fatura.invoice_url,
          invoiceId: fatura.id,
        })
      })

    pendentesTemp.sort((a, b) => {
       if (a.status === 'Atrasado' && b.status !== 'Atrasado') return -1;
       if (a.status !== 'Atrasado' && b.status === 'Atrasado') return 1;
       return a.vencimentoOrdem - b.vencimentoOrdem;
    })

    transMes.forEach(t => { if (t.tipo === 'Entrada') entradasM += Number(t.valor); if (t.tipo === 'Saída') saidasM += Number(t.valor) })

    const extrato = [
      ...pgsMes.map(p => {
        const nomeAluno = alunos?.find(a => a.id === p.aluno_id)?.nome_completo || 'Aluno'
        return { id: `pg-${p.id}`, data: p.data_pagamento, descricao: `Mensalidade: ${nomeAluno}`, valor: p.valor, tipo: 'Entrada', categoria: 'Mensalidade', icone: '🎤' }
      }), 
      ...transMes.map(t => ({ id: `tr-${t.id}`, data: t.data_transacao, descricao: t.descricao || t.categoria, valor: t.valor, tipo: t.tipo, categoria: t.categoria, icone: t.tipo === 'Entrada' ? '📈' : '📉' }))
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    const historicoGrafico: any[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - 1 - i, 1)
      historicoGrafico.push({
        name: d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
        mesStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        Entradas: 0,
        Saídas: 0
      })
    }

    pagamentosConfirmados.forEach(p => {
      const mesStr = p.data_pagamento.substring(0, 7) // Pega YYYY-MM direto da string
      const hist = historicoGrafico.find(h => h.mesStr === mesStr)
      if (hist) hist.Entradas += Number(p.valor)
    })

    allTransacoes?.forEach(t => {
      const mesStr = t.data_transacao.substring(0, 7) // Pega YYYY-MM direto da string
      const hist = historicoGrafico.find(h => h.mesStr === mesStr)
      if (hist) {
        if (t.tipo === 'Entrada') hist.Entradas += Number(t.valor)
        if (t.tipo === 'Saída') hist.Saídas += Number(t.valor)
      }
    })

    const despesasCategorias: Record<string, number> = {}
    transMes.filter(t => t.tipo === 'Saída').forEach(t => {
      despesasCategorias[t.categoria] = (despesasCategorias[t.categoria] || 0) + Number(t.valor)
    })
    
    const pizzaData = Object.keys(despesasCategorias).map(key => ({
      name: key,
      value: despesasCategorias[key]
    }))

    setDadosGraficoBarra(historicoGrafico)
    setDadosGraficoPizza(pizzaData)
    setResumo({ saldoCaixa: caixaTotal, previsaoFaturamento: previsaoTotal, entradasMes: entradasM, saidasMes: saidasM, inadimplencia: inadimplenciaM })
    setModelCounts(counts)
    setAlunosPendentes(pendentesTemp); setExtratoUnificado(extrato); setLoading(false)
  }

  const handleNovaMovimentacao = () => {
    setEditandoId(null)
    setTTipo('Saída')
    setTCategoria('Aluguel')
    setTDescricao('')
    setTValor('')
    setTData(new Date().toISOString().split('T')[0])
    setIsModalOpen(true)
  }

  const abrirEdicao = (item: any) => {
    setEditandoId(item.id)
    setTTipo(item.tipo)
    setTCategoria(item.categoria)
    setTDescricao(item.descricao)
    setTValor(item.valor.toString())
    setTData(item.data.split('T')[0])
    setIsModalOpen(true)
  }

  const abrirPainelCobranca = (charge: FinancialCharge) => {
    setSelectedCharge(charge)
    setReceiveDate(new Date().toISOString().slice(0, 10))
    setReceiveMethod('PIX')
    setChargeValue(Number(charge.valor || 0).toFixed(2))
    setChargeDueDate(charge.dataVencimento || '')
    setChargeReason(charge.adjustmentReason || '')
    setIsChargePanelOpen(true)
  }

  const fecharPainelCobranca = () => {
    setIsChargePanelOpen(false)
    setSelectedCharge(null)
    setChargeReason('')
  }

  const handleConfirmarRecebimento = async () => {
    if (!selectedCharge || Number(chargeValue) <= 0) return alert('Informe um valor recebido válido.')
    setIsChargeActionLoading(true)
    const competence = selectedCharge.competencia || `${new Date().toISOString().slice(0, 7)}-01`
    const { error } = await supabase.from('pagamentos').insert([{
      aluno_id: selectedCharge.alunoId,
      fatura_id: selectedCharge.invoiceId || null,
      valor: Number(chargeValue),
      status: 'Pago',
      data_pagamento: receiveDate,
      competencia: competence,
      metodo_pagamento: receiveMethod,
    }])
    if (!error && selectedCharge.invoiceId) {
      await supabase.from('faturas').update({
        status: 'PAGO',
        pago_em: `${receiveDate}T12:00:00-03:00`,
        atualizado_em: new Date().toISOString(),
      }).eq('id', selectedCharge.invoiceId)
    }
    setIsChargeActionLoading(false)
    if (error) return alert(`Não foi possível registrar o recebimento: ${error.message}`)
    fecharPainelCobranca()
    await carregarDadosFinanceiros()
  }

  const handleSalvarAjusteCobranca = async () => {
    if (!selectedCharge?.competencia) return alert('Esta cobrança não possui uma competência mensal ajustável.')
    if (!chargeReason.trim()) return alert('Informe o motivo da correção para manter o histórico organizado.')
    if (Number(chargeValue) < 0) return alert('Informe um valor válido.')
    setIsChargeActionLoading(true)
    const { error } = await supabase.from('ajustes_cobranca').upsert({
      aluno_id: selectedCharge.alunoId,
      competencia: selectedCharge.competencia,
      modelo_faturamento: selectedCharge.modeloCodigo,
      tipo: 'AJUSTAR',
      valor_ajustado: Number(chargeValue),
      vencimento_ajustado: chargeDueDate || null,
      motivo: chargeReason.trim(),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'aluno_id,competencia,modelo_faturamento' })
    setIsChargeActionLoading(false)
    if (error) return alert(`Não foi possível corrigir a cobrança: ${error.message}`)
    fecharPainelCobranca()
    await carregarDadosFinanceiros()
  }

  const handleDesconsiderarCobranca = async () => {
    if (!selectedCharge?.competencia) return alert('Esta cobrança não pode ser desconsiderada por competência.')
    if (!chargeReason.trim()) return alert('Informe por que esta cobrança deve ser desconsiderada.')
    if (!window.confirm(`Desconsiderar a cobrança de ${selectedCharge.competenciaLabel} para ${selectedCharge.nome}? Ela continuará disponível no filtro "Desconsideradas".`)) return
    setIsChargeActionLoading(true)
    const { error } = await supabase.from('ajustes_cobranca').upsert({
      aluno_id: selectedCharge.alunoId,
      competencia: selectedCharge.competencia,
      modelo_faturamento: selectedCharge.modeloCodigo,
      tipo: 'IGNORAR',
      valor_ajustado: null,
      vencimento_ajustado: null,
      motivo: chargeReason.trim(),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'aluno_id,competencia,modelo_faturamento' })
    setIsChargeActionLoading(false)
    if (error) return alert(`Não foi possível desconsiderar a cobrança: ${error.message}`)
    fecharPainelCobranca()
    await carregarDadosFinanceiros()
  }

  const handleRestaurarCobranca = async () => {
    if (!selectedCharge?.adjustmentId) return
    setIsChargeActionLoading(true)
    const { error } = await supabase.from('ajustes_cobranca').delete().eq('id', selectedCharge.adjustmentId)
    setIsChargeActionLoading(false)
    if (error) return alert(`Não foi possível restaurar a cobrança: ${error.message}`)
    fecharPainelCobranca()
    await carregarDadosFinanceiros()
  }

  const handleExcluirCobrancaDefinitivamente = async () => {
    if (!selectedCharge?.competencia) return
    if (!window.confirm(`Excluir definitivamente a cobrança de ${selectedCharge.competenciaLabel} para ${selectedCharge.nome}? Ela não aparecerá mais em nenhum filtro.`)) return
    setIsChargeActionLoading(true)
    const { error } = await supabase.from('ajustes_cobranca').upsert({
      aluno_id: selectedCharge.alunoId,
      competencia: selectedCharge.competencia,
      modelo_faturamento: selectedCharge.modeloCodigo,
      tipo: 'EXCLUIR',
      valor_ajustado: null,
      vencimento_ajustado: null,
      motivo: selectedCharge.adjustmentReason || 'Exclusão definitiva realizada no Financeiro',
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'aluno_id,competencia,modelo_faturamento' })
    setIsChargeActionLoading(false)
    if (error) return alert(`Não foi possível excluir a cobrança: ${error.message}`)
    fecharPainelCobranca()
    await carregarDadosFinanceiros()
  }

  const handleReabrirCobranca = async () => {
    if (!selectedCharge) return
    if (!window.confirm(`Remover a baixa de ${selectedCharge.competenciaLabel}? O valor sairá do caixa e a cobrança voltará a ficar pendente.`)) return
    setIsChargeActionLoading(true)
    let errorMessage = ''
    if (selectedCharge.paymentId) {
      const { error } = await supabase.from('pagamentos').delete().eq('id', selectedCharge.paymentId)
      if (error) errorMessage = error.message
    }
    if (!errorMessage && selectedCharge.invoiceId) {
      const { error } = await supabase.from('faturas').update({
        status: 'PENDENTE',
        pago_em: null,
        atualizado_em: new Date().toISOString(),
      }).eq('id', selectedCharge.invoiceId)
      if (error) errorMessage = error.message
    }
    setIsChargeActionLoading(false)
    if (errorMessage) return alert(`Não foi possível reabrir a cobrança: ${errorMessage}`)
    fecharPainelCobranca()
    await carregarDadosFinanceiros()
  }

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingConfig(true)
    const { error } = await supabase.from('configuracoes').upsert({
      id: 1,
      chave_pix: chavePix,
      mensagem_pendente: msgPendente || DEFAULT_PENDENTE,
      mensagem_atrasado: msgAtrasado || DEFAULT_ATRASADO,
      ...schoolData,
    })
    setIsSavingConfig(false); if (error) alert("Erro: " + error.message); else { setIsConfigModalOpen(false); alert("✅ Salvo com sucesso!"); carregarDadosFinanceiros() }
  }

  const handleSalvarTransacao = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!tValor || Number(tValor) <= 0) return alert("Valor inválido.")

    if (editandoId) {
      const prefix = editandoId.substring(0, 3)
      const realId = editandoId.substring(3)

      if (prefix === 'tr-') {
        const { error } = await supabase.from('transacoes').update({ 
          tipo: tTipo, categoria: tCategoria, descricao: tDescricao, valor: parseFloat(tValor), data_transacao: tData 
        }).eq('id', realId)
        if (error) return alert("Erro: " + error.message)
      } else if (prefix === 'pg-') {
        const { error } = await supabase.from('pagamentos').update({ 
          valor: parseFloat(tValor), data_pagamento: tData 
        }).eq('id', realId)
        if (error) return alert("Erro: " + error.message)
      }
      alert("✅ Atualizado com sucesso!")
    } else {
      const { error } = await supabase.from('transacoes').insert([{ 
        tipo: tTipo, categoria: tCategoria, descricao: tDescricao, valor: parseFloat(tValor), data_transacao: tData 
      }])
      if (error) return alert("Erro: " + error.message)
      alert("✅ Salvo com sucesso!")
    }
    
    setIsModalOpen(false)
    carregarDadosFinanceiros()
  }

  const enviarCobrancaWhatsApp = (aluno: any) => {
    if (!aluno.telefone) return alert("Sem WhatsApp cadastrado.")
    let numero = aluno.telefone.replace(/\D/g, ''); if (numero.length === 10 || numero.length === 11) numero = `55${numero}`
    const invoiceLink = aluno.invoiceUrl || (aluno.invoiceId ? `${window.location.origin}/faturas/${aluno.invoiceId}` : '')
    const link = invoiceLink ? `Consulte sua fatura: ${invoiceLink}` : ''
    const msgFinal = (aluno.status === 'Atrasado' ? msgAtrasado : msgPendente)
      .replace(/\{\{nome\}\}/g, aluno.nome.split(' ')[0])
      .replace(/\{\{valor\}\}/g, formatCurrencyBR(aluno.valor))
      .replace(/\{\{vencimento\}\}/g, aluno.vencimento.toString())
      .replace(/\{\{modelo\}\}/g, aluno.modelo)
      .replace(/\{\{link\}\}/g, link)
      .replace(/\{\{pix\}\}/g, chavePix || 'Chave não informada')
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msgFinal)}`, '_blank')
  }

  const selecionarPagamentoInformado = async (pagamento: any) => {
    setSelectedReportedPayment(pagamento)
    setReportedPaymentReason(pagamento.motivo_analise || '')
    setReportedPaymentProofUrl('')
    if (!pagamento.comprovante_path) return

    const { data, error } = await supabase.storage
      .from('comprovantes-pagamento')
      .createSignedUrl(pagamento.comprovante_path, 600)
    if (!error) setReportedPaymentProofUrl(data?.signedUrl || '')
  }

  const analisarPagamentoInformado = async (decisao: 'APROVADO' | 'RECUSADO') => {
    if (!selectedReportedPayment) return
    if (decisao === 'RECUSADO' && reportedPaymentReason.trim().length < 3) {
      return alert('Informe o motivo para o aluno conseguir corrigir o envio.')
    }
    if (decisao === 'APROVADO' && !window.confirm(`Confirmar o recebimento de ${formatCurrencyBR(selectedReportedPayment.valor)} de ${selectedReportedPayment.aluno?.nome_completo || 'este aluno'}?`)) {
      return
    }

    setIsReviewingReportedPayment(true)
    const { error } = await supabase.rpc('analisar_pagamento_informado', {
      p_pagamento_informado_id: selectedReportedPayment.id,
      p_decisao: decisao,
      p_motivo: reportedPaymentReason.trim() || null,
    })
    setIsReviewingReportedPayment(false)
    if (error) return alert(`Não foi possível concluir a análise: ${error.message}`)

    alert(decisao === 'APROVADO'
      ? 'Pagamento confirmado. O valor entrou no caixa e o recibo foi liberado.'
      : 'Envio recusado. O aluno recebeu o motivo no portal.')
    setSelectedReportedPayment(null)
    setReportedPaymentProofUrl('')
    setReportedPaymentReason('')
    await carregarDadosFinanceiros()
  }

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>
  
  const mesNome = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  const mesFormatado = mesNome.charAt(0).toUpperCase() + mesNome.slice(1)
  const hoje = new Date()
  const alunosPendentes = cobrancas.filter(isOpenCharge)
  const limitePeriodoExtrato = (() => {
    if (periodoExtrato === 'Tudo') return null
    if (periodoExtrato === 'Mês atual') return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    return new Date(hoje.getFullYear(), hoje.getMonth() - (periodoExtrato === '3 meses' ? 2 : 11), 1)
  })()

  const extratoFiltrado = extratoUnificado.filter(item => {
    const matchesType = filtroExtrato === 'Todos' ? true : item.tipo === filtroExtrato
    const itemDate = new Date(`${String(item.data).slice(0, 10)}T12:00:00`)
    return matchesType && (!limitePeriodoExtrato || itemDate >= limitePeriodoExtrato)
  })
  const resultadoMes = resumo.entradasMes - resumo.saidasMes
  const cobrancasAtrasadas = cobrancas.filter(isOverdueCharge)
  const cobrancasAVencer = cobrancas.filter(item => ['A vencer', 'Sem créditos'].includes(item.status))
  const cobrancasPagas = cobrancas.filter(item => item.status === 'Pago')
  const cobrancasEmApuracao = cobrancas.filter(item => item.status === 'Em apuração')
  const cobrancasDesconsideradas = cobrancas.filter(item => item.status === 'Desconsiderada')
  const cobrancasAtivas = cobrancas.filter(item => item.status !== 'Desconsiderada')
  const pagamentosInformadosPendentes = pagamentosInformados.filter(item => item.status === 'PENDENTE')
  const agingBuckets = getAgingBuckets(cobrancas)
  const competencias = Array.from(new Map(
    cobrancas
      .filter(item => item.competencia)
      .map(item => [String(item.competencia).slice(0, 7), item.competenciaLabel]),
  ).entries()).sort((a, b) => b[0].localeCompare(a[0]))
  const buscaNormalizada = buscaCobranca.trim().toLocaleLowerCase('pt-BR')
  const cobrancasFiltradas = cobrancas.filter(item => {
    const matchesSearch = !buscaNormalizada || item.nome.toLocaleLowerCase('pt-BR').includes(buscaNormalizada)
    const matchesCompetence = competenciaCobranca === 'Todas'
      || String(item.competencia || '').startsWith(competenciaCobranca)
    let matchesStatus = true
    if (filtroCobrancas === 'Atrasado') matchesStatus = isOverdueCharge(item)
    if (filtroCobrancas === 'A vencer') matchesStatus = ['A vencer', 'Sem créditos'].includes(item.status)
    if (filtroCobrancas === 'Pago') matchesStatus = item.status === 'Pago'
    if (filtroCobrancas === 'Em apuração') matchesStatus = item.status === 'Em apuração'
    if (filtroCobrancas === 'Desconsiderada') matchesStatus = item.status === 'Desconsiderada'
    if (filtroCobrancas === 'Todas') matchesStatus = item.status !== 'Desconsiderada'
    return matchesSearch && matchesCompetence && matchesStatus
  })
  const maiorDespesa = [...dadosGraficoPizza].sort((a, b) => Number(b.value) - Number(a.value))[0]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-[1500px] mx-auto pb-8">
      <motion.header variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <div className="premium-kicker mb-2">Gestão financeira</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Financeiro</h1>
          <p className="text-slate-500 text-sm mt-1.5">Dossiê completo de recebimentos, competências em aberto e caixa.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={() => setIsConfigModalOpen(true)} className="flex-1 md:flex-none px-3.5 py-2.5 rounded-xl border border-[#dfded7] bg-white text-slate-600 text-xs font-semibold flex items-center justify-center gap-2 hover:text-[#1f4a3a] hover:border-[#aebfb4] transition-colors">
            <Settings2 size={15} /> Configurações
          </button>
          <button onClick={handleNovaMovimentacao} className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#17382c] transition-colors">
            <Plus size={15} /> Nova movimentação
          </button>
        </div>
      </motion.header>

      <motion.section variants={itemVariants} className="premium-panel overflow-hidden mb-5">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_2fr]">
          <div className="p-5 md:p-6 bg-[#153b2f] text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">Caixa disponível</p>
            <p className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">{formatCurrencyBR(resumo.saldoCaixa)}</p>
            <div className="flex items-center gap-2 mt-4">
              <span className={`h-7 px-2.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5 ${resultadoMes >= 0 ? 'bg-white/10 text-[#d8eadf]' : 'bg-rose-500/20 text-rose-100'}`}>
                {resultadoMes >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                Resultado do mês: {formatCurrencyBR(resultadoMes)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4">
            <div className="p-4 md:p-5 border-r border-b md:border-b-0 border-[#e5e3dd]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">A receber</p>
              <p className="text-xl font-semibold text-slate-900 mt-1.5">{formatCurrencyBR(resumo.previsaoFaturamento)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{alunosPendentes.length} competência(s) aberta(s)</p>
            </div>
            <div className="p-4 md:p-5 border-b md:border-b-0 md:border-r border-[#e5e3dd]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Entradas</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1.5">{formatCurrencyBR(resumo.entradasMes)}</p>
              <p className="text-[10px] text-slate-500 mt-1">recebido em {mesFormatado}</p>
            </div>
            <div className="p-4 md:p-5 border-r border-[#e5e3dd]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Saídas</p>
              <p className="text-xl font-semibold text-slate-900 mt-1.5">{formatCurrencyBR(resumo.saidasMes)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{maiorDespesa ? `maior: ${maiorDespesa.name}` : 'sem despesas'}</p>
            </div>
            <div className="p-4 md:p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Em atraso</p>
              <p className={`text-xl font-semibold mt-1.5 ${resumo.inadimplencia > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatCurrencyBR(resumo.inadimplencia)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{cobrancasAtrasadas.length} cobrança(s)</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.nav variants={itemVariants} aria-label="Seções financeiras" className="premium-panel p-1.5 flex gap-1 overflow-x-auto custom-scrollbar mb-5">
        {[
          { id: 'visao', label: 'Visão geral', icon: Landmark },
          { id: 'cobrancas', label: 'Cobranças', icon: ReceiptText, count: alunosPendentes.length },
          { id: 'comprovantes', label: 'Comprovantes', icon: Paperclip, count: pagamentosInformadosPendentes.length },
          { id: 'movimentacoes', label: 'Movimentações', icon: WalletCards, count: extratoUnificado.length },
          { id: 'analises', label: 'Análises', icon: BarChart3 },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${isActive ? 'bg-[#1f4a3a] text-white' : 'text-slate-500 hover:bg-[#f3f4ef] hover:text-slate-800'}`}>
              <Icon size={15} /> {tab.label}
              {tab.count !== undefined && <span className={`min-w-5 h-5 px-1 rounded-full text-[9px] flex items-center justify-center ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>}
            </button>
          )
        })}
      </motion.nav>

      {activeTab === 'visao' && (
        <motion.div variants={itemVariants} className="space-y-5">
          <section className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7] flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><Clock3 size={19} className="text-[#1f4a3a]" /> Carteira por vencimento</h2>
                <p className="text-xs text-slate-500 mt-1">Todo o saldo aberto, separado pelo tempo de atraso.</p>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">Posição em {hoje.toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-[#ebe9e3]">
              {agingBuckets.map((bucket, index) => (
                <button key={bucket.id} onClick={() => { setFiltroCobrancas(index === 0 ? 'A vencer' : 'Atrasado'); setActiveTab('cobrancas') }} className="p-4 text-left hover:bg-[#faf9f6] transition-colors">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{bucket.label}</p>
                  <p className={`text-lg font-semibold mt-1.5 ${index > 0 && bucket.valor > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatCurrencyBR(bucket.valor)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{bucket.quantidade} cobrança(s)</p>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-5 items-start">
          <section className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7] flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><AlertTriangle size={19} className="text-[#a56a32]" /> Cobranças prioritárias</h2>
                <p className="text-xs text-slate-500 mt-1">Pendências ordenadas por urgência e vencimento.</p>
              </div>
              <button onClick={() => setActiveTab('cobrancas')} className="text-[11px] font-semibold text-[#1f4a3a] hover:underline">Ver todas</button>
            </div>
            <div className="divide-y divide-[#ebe9e3]">
              {alunosPendentes.slice(0, 6).map(aluno => {
                const isCritical = isOverdueCharge(aluno)
                return (
                  <div key={aluno.id} role="button" tabIndex={0} onClick={() => abrirPainelCobranca(aluno)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') abrirPainelCobranca(aluno) }} className="px-5 py-4 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_auto] gap-3 items-center hover:bg-[#faf9f6] transition-colors cursor-pointer outline-none focus:bg-[#f5f7f3]">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-900 truncate block max-w-full">{aluno.nome}</span>
                      <p className="text-[11px] text-slate-500 mt-1">{aluno.competenciaLabel} · {aluno.vencimento}{aluno.diasAtraso > 0 ? ` · ${aluno.diasAtraso} dias em atraso` : ''}</p>
                    </div>
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrencyBR(aluno.valor)}</p>
                      <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${isCritical ? 'bg-rose-50 text-rose-700' : 'bg-[#fbf1df] text-[#8a5e2f]'}`}>{aluno.status}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {aluno.invoiceId && <button onClick={event => { event.stopPropagation(); window.open(`/faturas/${aluno.invoiceId}`, '_blank') }} aria-label="Abrir fatura" className="h-8 w-8 rounded-lg border border-[#dfded7] bg-white text-slate-500 flex items-center justify-center hover:text-[#1f4a3a]"><FileText size={14} /></button>}
                      <button onClick={event => { event.stopPropagation(); enviarCobrancaWhatsApp(aluno) }} aria-label="Lembrar pelo WhatsApp" className="h-8 w-8 rounded-lg bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center hover:bg-[#d7e5da]"><MessageCircle size={14} /></button>
                    </div>
                  </div>
                )
              })}
              {alunosPendentes.length === 0 && (
                <div className="py-14 px-6 text-center">
                  <CheckCircle2 size={30} strokeWidth={1.5} className="mx-auto text-emerald-500 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Nenhuma cobrança pendente</p>
                  <p className="text-xs text-slate-500 mt-1">A carteira está em dia.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><WalletCards size={19} className="text-[#1f4a3a]" /> Movimentações recentes</h2>
                <p className="text-xs text-slate-500 mt-1">Últimos lançamentos de todo o histórico.</p>
              </div>
              <button onClick={() => setActiveTab('movimentacoes')} className="text-[11px] font-semibold text-[#1f4a3a] hover:underline">Extrato</button>
            </div>
            <div className="divide-y divide-[#ebe9e3]">
              {extratoUnificado.slice(0, 7).map(item => (
                <button key={item.id} onClick={() => abrirEdicao(item)} className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-[#faf9f6] transition-colors">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.tipo === 'Entrada' ? 'bg-[#e7efe9] text-[#1f4a3a]' : 'bg-rose-50 text-rose-600'}`}>
                    {item.tipo === 'Entrada' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.descricao}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(item.data).toLocaleDateString('pt-BR')} · {item.categoria}</p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${item.tipo === 'Entrada' ? 'text-emerald-700' : 'text-rose-700'}`}>{item.tipo === 'Entrada' ? '+' : '−'} {formatCurrencyBR(item.valor)}</p>
                </button>
              ))}
              {extratoUnificado.length === 0 && <div className="py-14 px-6 text-center text-sm text-slate-500">Nenhuma movimentação registrada.</div>}
            </div>
          </aside>
          </div>
        </motion.div>
      )}

      {activeTab === 'cobrancas' && (
        <motion.section variants={itemVariants} className="premium-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-[#dfded7] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><ReceiptText size={19} className="text-[#1f4a3a]" /> Carteira de cobranças</h2>
              <p className="text-xs text-slate-500 mt-1">Histórico completo por aluno, competência e vencimento.</p>
            </div>
            <div className="flex rounded-xl border border-[#dfded7] bg-[#f7f7f3] p-1 overflow-x-auto">
              {[
                { id: 'Todas', label: 'Todas', count: cobrancasAtivas.length },
                { id: 'Atrasado', label: 'Atrasadas', count: cobrancasAtrasadas.length },
                { id: 'A vencer', label: 'A vencer', count: cobrancasAVencer.length },
                { id: 'Em apuração', label: 'Em apuração', count: cobrancasEmApuracao.length },
                { id: 'Pago', label: 'Pagas', count: cobrancasPagas.length },
                { id: 'Desconsiderada', label: 'Desconsideradas', count: cobrancasDesconsideradas.length },
              ].map(option => (
                <button key={option.id} onClick={() => setFiltroCobrancas(option.id as typeof filtroCobrancas)} className={`px-3 py-2 rounded-lg text-[10px] font-semibold whitespace-nowrap ${filtroCobrancas === option.id ? 'bg-white text-[#1f4a3a] shadow-sm' : 'text-slate-500'}`}>
                  {option.label} · {option.count}
                </button>
              ))}
            </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(240px,1fr)_220px] gap-2">
              <label className="h-10 px-3 rounded-xl border border-[#dfded7] bg-white flex items-center gap-2 focus-within:border-[#88a394]">
                <Search size={14} className="text-slate-400" />
                <input value={buscaCobranca} onChange={event => setBuscaCobranca(event.target.value)} placeholder="Buscar aluno..." className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
              </label>
              <label className="h-10 px-3 rounded-xl border border-[#dfded7] bg-white flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <select value={competenciaCobranca} onChange={event => setCompetenciaCobranca(event.target.value)} className="w-full bg-transparent text-xs font-semibold text-slate-600 outline-none">
                  <option value="Todas">Todas as competências</option>
                  {competencias.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="max-h-[650px] overflow-y-auto custom-scrollbar">
            <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_120px_130px_120px_120px_110px] gap-4 px-5 py-2.5 bg-[#faf9f6] border-b border-[#ebe9e3] text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400 sticky top-0 z-10">
              <span>Aluno</span><span>Competência</span><span>Modelo</span><span>Vencimento</span><span>Valor</span><span className="text-right">Ações</span>
            </div>
            <div className="divide-y divide-[#ebe9e3]">
              {cobrancasFiltradas.map(aluno => {
                const isCritical = isOverdueCharge(aluno)
                const isPaid = aluno.status === 'Pago'
                const isIgnored = aluno.status === 'Desconsiderada'
                return (
                  <div key={aluno.id} role="button" tabIndex={0} onClick={() => abrirPainelCobranca(aluno)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') abrirPainelCobranca(aluno) }} className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_120px_130px_120px_120px_110px] gap-3 md:gap-4 px-5 py-4 md:items-center hover:bg-[#faf9f6] transition-colors cursor-pointer outline-none focus:bg-[#f5f7f3] ${isIgnored ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-900 truncate">{aluno.nome}</span>
                      <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold ${isCritical ? 'bg-rose-50 text-rose-700' : isPaid ? 'bg-emerald-50 text-emerald-700' : aluno.status === 'Em apuração' || isIgnored ? 'bg-slate-100 text-slate-600' : 'bg-[#fbf1df] text-[#8a5e2f]'}`}>{aluno.status}</span>
                      {aluno.isAdjusted && <span className="ml-1.5 inline-flex text-[9px] font-semibold text-[#1f4a3a]">Ajustada</span>}
                      {typeof aluno.saldo === 'number' && <p className="text-[10px] text-slate-500 mt-1">Saldo: {aluno.saldo} créditos</p>}
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{aluno.competenciaLabel}</p>
                    <p className="text-xs text-slate-600">{aluno.modelo}</p>
                    <div>
                      <p className="text-xs text-slate-600 flex items-center gap-1.5"><Clock3 size={12} /> {aluno.vencimento}</p>
                      {aluno.diasAtraso > 0 && <p className="text-[9px] font-semibold text-rose-600 mt-1">{aluno.diasAtraso} dias em atraso</p>}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrencyBR(aluno.valor)}</p>
                    <div className="flex md:justify-end gap-1.5">
                      {aluno.invoiceId && <button onClick={event => { event.stopPropagation(); window.open(`/faturas/${aluno.invoiceId}`, '_blank') }} aria-label="Abrir fatura" className="h-8 w-8 rounded-lg border border-[#dfded7] bg-white text-slate-500 flex items-center justify-center"><FileText size={14} /></button>}
                      {!isPaid && !isIgnored && aluno.status !== 'Em apuração' && <button onClick={event => { event.stopPropagation(); enviarCobrancaWhatsApp(aluno) }} aria-label="Enviar cobrança pelo WhatsApp" className="h-8 w-8 rounded-lg bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center"><MessageCircle size={14} /></button>}
                      <button onClick={event => { event.stopPropagation(); abrirPainelCobranca(aluno) }} aria-label="Gerenciar cobrança" className="h-8 w-8 rounded-lg border border-[#dfded7] bg-white text-slate-500 flex items-center justify-center"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                )
              })}
              {cobrancasFiltradas.length === 0 && <div className="py-16 px-6 text-center text-sm text-slate-500">Nenhuma cobrança neste filtro.</div>}
            </div>
          </div>
        </motion.section>
      )}

      {activeTab === 'comprovantes' && (
        <motion.div variants={itemVariants} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <section className="premium-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[#dfded7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2.5 text-lg font-semibold text-slate-900"><Paperclip size={19} className="text-[#1f4a3a]" /> Pagamentos informados</h2>
                <p className="mt-1 text-xs text-slate-500">O caixa e o recibo só são atualizados depois da sua aprovação.</p>
              </div>
              <span className="inline-flex h-8 items-center rounded-full bg-[#fff3d8] px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a6427]">
                {pagamentosInformadosPendentes.length} aguardando
              </span>
            </div>

            <div className="max-h-[690px] divide-y divide-[#ebe9e3] overflow-y-auto custom-scrollbar">
              {pagamentosInformados.map(pagamento => {
                const isSelected = selectedReportedPayment?.id === pagamento.id
                return (
                  <button
                    key={pagamento.id}
                    type="button"
                    onClick={() => selecionarPagamentoInformado(pagamento)}
                    className={`grid w-full gap-3 px-5 py-4 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_150px_110px] sm:items-center ${isSelected ? 'bg-[#edf3ef]' : 'hover:bg-[#faf9f6]'}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{pagamento.aluno?.nome_completo || 'Aluno'}</p>
                        <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${pagamento.status === 'APROVADO' ? 'bg-emerald-50 text-emerald-700' : pagamento.status === 'RECUSADO' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          {pagamento.status === 'APROVADO' ? 'Aprovado' : pagamento.status === 'RECUSADO' ? 'Recusado' : 'Aguardando'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {new Date(`${pagamento.data_pagamento}T12:00:00`).toLocaleDateString('pt-BR')} · {pagamento.metodo_pagamento}
                        {pagamento.comprovante_path ? ' · Com imagem' : ' · Sem imagem'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{String(pagamento.competencia).slice(0, 7).split('-').reverse().join('/')}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{pagamento.fatura?.numero ? `FAT-${String(pagamento.fatura.numero).padStart(6, '0')}` : 'Sem fatura'}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#1f4a3a] sm:text-right">{formatCurrencyBR(pagamento.valor)}</p>
                  </button>
                )
              })}
              {pagamentosInformados.length === 0 && (
                <div className="px-6 py-20 text-center">
                  <ShieldCheck size={30} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Nenhum pagamento enviado</p>
                  <p className="mt-1 text-xs text-slate-500">Os envios feitos pelo portal do aluno aparecerão aqui.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="premium-panel h-fit overflow-hidden xl:sticky xl:top-5">
            {!selectedReportedPayment ? (
              <div className="px-7 py-20 text-center">
                <ImageIcon size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Selecione um envio</p>
                <p className="mt-1 text-xs text-slate-500">Confira os dados e a imagem antes de aprovar.</p>
              </div>
            ) : (
              <>
                <div className="border-b border-[#dfded7] px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="premium-kicker">Conferência do pagamento</div>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedReportedPayment.aluno?.nome_completo || 'Aluno'}</h2>
                    </div>
                    <button type="button" onClick={() => { setSelectedReportedPayment(null); setReportedPaymentProofUrl('') }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfded7] text-slate-500"><X size={14} /></button>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <section className="overflow-hidden rounded-2xl border border-[#d7d4cb] bg-[#153b2f] text-white">
                    <div className="px-5 py-5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">Valor informado</p>
                      <p className="mt-2 text-3xl font-semibold">{formatCurrencyBR(selectedReportedPayment.valor)}</p>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
                      <div className="px-4 py-3">
                        <p className="text-[9px] text-white/50">Data</p>
                        <p className="mt-1 text-xs font-semibold">{new Date(`${selectedReportedPayment.data_pagamento}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[9px] text-white/50">Forma</p>
                        <p className="mt-1 text-xs font-semibold">{selectedReportedPayment.metodo_pagamento}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#d7d4cb] bg-white p-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Competência</p><p className="mt-1 font-semibold text-slate-700">{String(selectedReportedPayment.competencia).slice(0, 7).split('-').reverse().join('/')}</p></div>
                      <div><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Fatura</p><p className="mt-1 font-semibold text-slate-700">{selectedReportedPayment.fatura?.numero ? `FAT-${String(selectedReportedPayment.fatura.numero).padStart(6, '0')}` : 'Não vinculada'}</p></div>
                    </div>
                    {selectedReportedPayment.observacoes && <p className="mt-4 border-t border-[#ebe9e3] pt-4 text-xs leading-relaxed text-slate-600">{selectedReportedPayment.observacoes}</p>}
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-[#d7d4cb] bg-white">
                    <div className="flex items-center justify-between border-b border-[#ebe9e3] px-4 py-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><ImageIcon size={14} /> Comprovante</p>
                      {reportedPaymentProofUrl && <button type="button" onClick={() => window.open(reportedPaymentProofUrl, '_blank')} className="text-[10px] font-semibold text-[#1f4a3a]">Abrir imagem</button>}
                    </div>
                    {selectedReportedPayment.comprovante_path ? (
                      reportedPaymentProofUrl ? (
                        <button type="button" onClick={() => window.open(reportedPaymentProofUrl, '_blank')} className="block w-full bg-[#f5f4ef] p-3">
                          <img src={reportedPaymentProofUrl} alt="Comprovante enviado pelo aluno" className="mx-auto max-h-72 rounded-xl object-contain" />
                        </button>
                      ) : (
                        <div className="flex h-36 items-center justify-center text-xs text-slate-500"><Loader2 size={16} className="mr-2 animate-spin" /> Carregando imagem</div>
                      )
                    ) : (
                      <div className="px-4 py-8 text-center text-xs text-slate-500">O aluno informou o pagamento sem anexar imagem.</div>
                    )}
                  </section>

                  {selectedReportedPayment.status === 'PENDENTE' ? (
                    <section className="rounded-2xl border border-[#d7d4cb] bg-white p-4">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Motivo, se precisar recusar
                        <textarea value={reportedPaymentReason} onChange={event => setReportedPaymentReason(event.target.value)} placeholder="Ex.: imagem ilegível ou valor divergente." className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#dcd9d0] bg-[#fbfaf7] p-3 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none" />
                      </label>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => analisarPagamentoInformado('RECUSADO')} disabled={isReviewingReportedPayment} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 disabled:opacity-50"><X size={14} /> Recusar</button>
                        <button type="button" onClick={() => analisarPagamentoInformado('APROVADO')} disabled={isReviewingReportedPayment} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f4a3a] text-xs font-semibold text-white disabled:opacity-50">
                          {isReviewingReportedPayment ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Aprovar
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className={`rounded-2xl border p-4 ${selectedReportedPayment.status === 'APROVADO' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                      <p className={`text-xs font-semibold ${selectedReportedPayment.status === 'APROVADO' ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {selectedReportedPayment.status === 'APROVADO' ? 'Pagamento aprovado e lançado no caixa.' : 'Envio recusado e devolvido ao aluno.'}
                      </p>
                      {selectedReportedPayment.motivo_analise && <p className="mt-2 text-xs text-slate-600">{selectedReportedPayment.motivo_analise}</p>}
                    </section>
                  )}

                  <button type="button" onClick={() => router.push(`/alunos/${selectedReportedPayment.aluno_id}`)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d7d4cb] bg-white text-xs font-semibold text-slate-700"><UsersRound size={14} /> Abrir perfil do aluno</button>
                </div>
              </>
            )}
          </aside>
        </motion.div>
      )}

      {activeTab === 'movimentacoes' && (
        <motion.section variants={itemVariants} className="premium-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-[#dfded7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><WalletCards size={19} className="text-[#1f4a3a]" /> Extrato financeiro</h2>
              <p className="text-xs text-slate-500 mt-1">Entradas e saídas de todo o histórico, organizadas por data.</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={periodoExtrato} onChange={e => setPeriodoExtrato(e.target.value as typeof periodoExtrato)} className="px-3 py-2.5 rounded-xl border border-[#dfded7] bg-white text-xs font-semibold text-slate-600 outline-none">
                <option value="Tudo">Todo o período</option><option value="12 meses">Últimos 12 meses</option><option value="3 meses">Últimos 3 meses</option><option value="Mês atual">Mês atual</option>
              </select>
              <select value={filtroExtrato} onChange={e => setFiltroExtrato(e.target.value)} className="px-3 py-2.5 rounded-xl border border-[#dfded7] bg-white text-xs font-semibold text-slate-600 outline-none">
                <option value="Todos">Todas</option><option value="Entrada">Entradas</option><option value="Saída">Saídas</option>
              </select>
              <button onClick={handleNovaMovimentacao} className="px-3.5 py-2.5 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center gap-2"><Plus size={14} /> Lançar</button>
            </div>
          </div>
          <div className="max-h-[650px] overflow-y-auto custom-scrollbar">
            <div className="hidden md:grid grid-cols-[120px_minmax(0,1fr)_160px_130px_40px] gap-4 px-5 py-2.5 bg-[#faf9f6] border-b border-[#ebe9e3] text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <span>Data</span><span>Descrição</span><span>Categoria</span><span>Valor</span><span />
            </div>
            <div className="divide-y divide-[#ebe9e3]">
              {extratoFiltrado.map(item => (
                <div key={item.id} className="grid grid-cols-[38px_minmax(0,1fr)_auto] md:grid-cols-[120px_minmax(0,1fr)_160px_130px_40px] gap-3 md:gap-4 px-5 py-4 items-center hover:bg-[#faf9f6] transition-colors">
                  <div className={`md:hidden h-9 w-9 rounded-lg flex items-center justify-center ${item.tipo === 'Entrada' ? 'bg-[#e7efe9] text-[#1f4a3a]' : 'bg-rose-50 text-rose-600'}`}>{item.tipo === 'Entrada' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</div>
                  <p className="hidden md:block text-xs text-slate-600">{new Date(item.data).toLocaleDateString('pt-BR')}</p>
                  <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{item.descricao}</p><p className="md:hidden text-[10px] text-slate-500 mt-1">{new Date(item.data).toLocaleDateString('pt-BR')} · {item.categoria}</p></div>
                  <p className="hidden md:block text-xs text-slate-600">{item.categoria}</p>
                  <p className={`text-sm font-semibold text-right md:text-left ${item.tipo === 'Entrada' ? 'text-emerald-700' : 'text-rose-700'}`}>{item.tipo === 'Entrada' ? '+' : '−'} {formatCurrencyBR(item.valor)}</p>
                  <button onClick={() => abrirEdicao(item)} aria-label="Editar movimentação" className="hidden md:flex h-8 w-8 rounded-lg border border-[#dfded7] text-slate-500 items-center justify-center hover:text-[#1f4a3a]"><Pencil size={13} /></button>
                </div>
              ))}
              {extratoFiltrado.length === 0 && <div className="py-16 px-6 text-center text-sm text-slate-500">Nenhuma movimentação neste filtro.</div>}
            </div>
          </div>
        </motion.section>
      )}

      {activeTab === 'analises' && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] gap-5">
          <section className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7]">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><TrendingUp size={19} className="text-[#1f4a3a]" /> Fluxo dos últimos 12 meses</h2>
              <p className="text-xs text-slate-500 mt-1">Comparação entre valores recebidos e saídas registradas.</p>
            </div>
            <div className="h-[360px] p-4 md:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGraficoBarra} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e6df" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip cursor={{ fill: '#f6f5f0' }} contentStyle={{ backgroundColor: '#fff', borderColor: '#dfded7', borderRadius: '10px', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#475569' }} />
                  <Bar dataKey="Entradas" fill="#1f6a4d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#b76d61" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="space-y-5">
            <section className="premium-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-[#dfded7]">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><AlertTriangle size={19} className="text-[#a56a32]" /> Envelhecimento da dívida</h2>
              </div>
              <div className="divide-y divide-[#ebe9e3]">
                {agingBuckets.map((bucket, index) => (
                  <div key={bucket.id} className="px-5 py-3 grid grid-cols-[1fr_auto] gap-4 items-center">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{bucket.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{bucket.quantidade} cobrança(s)</p>
                    </div>
                    <p className={`text-sm font-semibold ${index > 0 && bucket.valor > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatCurrencyBR(bucket.valor)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="premium-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-[#dfded7]">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><BarChart3 size={19} className="text-[#1f4a3a]" /> Despesas por categoria</h2>
              </div>
              <div className="h-[240px] p-3">
                {dadosGraficoPizza.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosGraficoPizza} cx="50%" cy="45%" innerRadius={48} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                        {dadosGraficoPizza.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrencyBR(Number(value))} contentStyle={{ backgroundColor: '#fff', borderColor: '#dfded7', borderRadius: '10px', fontSize: '11px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#475569' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center"><CheckCircle2 size={26} className="text-slate-300 mb-2" /><p className="text-xs text-slate-500">Sem despesas registradas.</p></div>
                )}
              </div>
            </section>

            <section className="premium-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-[#dfded7]">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><UsersRound size={19} className="text-[#1f4a3a]" /> Modelos de cobrança</h2>
              </div>
              <div className="divide-y divide-[#ebe9e3]">
                <div className="px-5 py-3 flex justify-between text-xs"><span className="text-slate-500">Créditos</span><span className="font-semibold text-slate-900">{modelCounts.CREDITOS}</span></div>
                <div className="px-5 py-3 flex justify-between text-xs"><span className="text-slate-500">Mês fechado</span><span className="font-semibold text-slate-900">{modelCounts.MENSAL_FECHADO}</span></div>
                <div className="px-5 py-3 flex justify-between text-xs"><span className="text-slate-500">Vencimento fixo</span><span className="font-semibold text-slate-900">{modelCounts.VENCIMENTO_FIXO}</span></div>
              </div>
            </section>
          </div>
        </motion.div>
      )}

      {false && (<>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {[
          { color: 'cyan', icon: '🏦', label: 'Saldo Atual', value: resumo.saldoCaixa },
          { color: 'indigo', icon: '🔮', label: 'Previsão Faturamento', value: resumo.previsaoFaturamento },
          { color: 'emerald', icon: '📈', label: 'Entradas', value: resumo.entradasMes },
          { color: 'rose', icon: '📉', label: 'Saídas', value: resumo.saidasMes },
          { color: 'amber', icon: '⚠️', label: 'Inadimplência', value: resumo.inadimplencia }
        ].map((card, index) => (
          <motion.div variants={itemVariants} whileHover={{ y: -5 }} key={index} className={`bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-[2rem] shadow-sm hover:shadow-md border-l-8 border-l-${card.color}-500 relative overflow-hidden flex flex-col justify-between`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${card.color}-400/20 rounded-full blur-2xl`}></div>
            <div className="absolute -right-2 -top-2 opacity-10 text-6xl drop-shadow-sm">{card.icon}</div>
            <p className={`text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1 z-10`}>{card.label}</p>
            <p className={`text-2xl lg:text-3xl font-bold tracking-tight z-10 text-${card.color}-600 drop-shadow-sm`}>
              R$ {card.value.toFixed(2)}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] lg:col-span-2`}>
          <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-cyan-500 drop-shadow-sm">📊</span> Fluxo de Caixa</h3>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGraficoBarra} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderColor: '#e2e8f0', borderRadius: '1rem', fontWeight: 'bold', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '500', color: '#475569' }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
          <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-rose-500 drop-shadow-sm">🍕</span> Despesas do Mês</h3>
          <div className="w-full h-64">
            {dadosGraficoPizza.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dadosGraficoPizza} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {dadosGraficoPizza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderColor: '#e2e8f0', borderRadius: '1rem', fontWeight: 'bold', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '500', color: '#475569' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                <span className="text-4xl mb-2 grayscale opacity-50">🎈</span>
                <p className="text-sm font-medium text-slate-500">Sem despesas registradas</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
          
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-800">
              <span className="text-emerald-500 drop-shadow-sm">📄</span> Extrato do Mês
            </h3>
            <select
              value={filtroExtrato}
              onChange={e => setFiltroExtrato(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/50 border border-slate-200 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Todos">Ambos</option>
              <option value="Entrada">Entradas</option>
              <option value="Saída">Saídas</option>
            </select>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {extratoFiltrado.map(item => (
              <motion.div whileHover={{ scale: 1.01 }} key={item.id} className={`bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-sm flex justify-between items-center hover:shadow-md transition-all`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner ${item.tipo === 'Entrada' ? 'bg-emerald-100/80 border border-emerald-200' : 'bg-rose-100/80 border border-rose-200'}`}>
                    {item.icone}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800 break-words">{item.descricao}</p>
                    <p className={`text-slate-500 text-[11px] font-medium`}>{new Date(item.data).toLocaleDateString('pt-BR')} • {item.categoria}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-bold text-lg tracking-tight ${item.tipo === 'Entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.tipo === 'Entrada' ? '+' : '-'} R$ {Number(item.valor).toFixed(2)}
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => abrirEdicao(item)}
                    className="h-8 w-8 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-sm shadow-sm"
                    title="Editar Movimentação"
                  >
                    ✏️
                  </motion.button>
                </div>
              </motion.div>
            ))}
            {extratoFiltrado.length === 0 && <p className={`text-slate-500 text-center py-8 italic text-sm border border-dashed border-slate-300 rounded-2xl bg-white/30`}>Nenhuma movimentação encontrada.</p>}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
          <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-amber-500 drop-shadow-sm">⏳</span> Pendências</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {alunosPendentes.map(aluno => (
              <motion.div whileHover={{ scale: 1.01 }} key={aluno.id} className={`bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-sm flex items-center justify-between gap-4 group hover:shadow-md transition-all`}>
                <div>
                  <p className="font-bold text-sm text-slate-800">{aluno.nome}</p>
                  <p className="text-slate-500 text-[11px] font-medium">{aluno.modelo} • Vencimento: {aluno.vencimento}</p>
                  {typeof aluno.saldo === 'number' && <p className="text-[10px] font-semibold text-violet-600 mt-1">Saldo atual: {aluno.saldo} créditos</p>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block mr-2">
                    <p className="font-bold text-lg tracking-tight text-slate-800">{formatCurrencyBR(aluno.valor)}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border backdrop-blur-md shadow-sm ${aluno.status === 'Atrasado' || aluno.status === 'Créditos em débito' || aluno.status === 'Erro na emissão' ? 'bg-rose-500/10 text-rose-600 border-rose-200' : 'bg-amber-400/20 text-amber-700 border-amber-200'}`}>
                      {aluno.status}
                    </span>
                  </div>
                  {aluno.invoiceId && <motion.button whileTap={{ scale: 0.9 }} onClick={() => window.open(`/faturas/${aluno.invoiceId}`, '_blank')} className="h-10 w-10 rounded-xl bg-cyan-100 text-cyan-700 border border-cyan-200 hover:bg-cyan-500 hover:text-white transition-all flex items-center justify-center text-lg shadow-sm" title="Abrir fatura detalhada">📄</motion.button>}
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => enviarCobrancaWhatsApp(aluno)} className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-lg shadow-sm" title="Lembrar via WhatsApp">💬</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.push(`/alunos/${aluno.alunoId}`)} className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 border border-indigo-200 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center font-bold shadow-sm" title="Ir para o perfil e dar baixa">$</motion.button>
                </div>
              </motion.div>
            ))}
            {alunosPendentes.length === 0 && (
              <div className="text-center py-10 border border-dashed rounded-3xl border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md shadow-sm">
                <span className="text-4xl mb-2 block drop-shadow-sm">🎉</span>
                <p className="font-bold text-emerald-600 text-sm">Inadimplência Zero!</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      </>)}

      <AnimatePresence>
        {isChargePanelOpen && selectedCharge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={fecharPainelCobranca} className="fixed inset-0 z-[70] bg-[#10251d]/30 backdrop-blur-[2px] flex items-end md:items-stretch justify-end">
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} onClick={event => event.stopPropagation()} className="w-full md:max-w-[520px] max-h-[94vh] md:max-h-none bg-[#fbfaf7] border-l border-[#dcd9d0] shadow-2xl rounded-t-[2rem] md:rounded-none overflow-y-auto custom-scrollbar">
              <div className="sticky top-0 z-10 px-5 md:px-7 py-5 bg-[#fbfaf7]/95 backdrop-blur-xl border-b border-[#dfded7] flex items-start justify-between gap-4">
                <div>
                  <div className="premium-kicker mb-1.5">Gestão da cobrança</div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedCharge.nome}</h2>
                  <p className="text-xs text-slate-500 mt-1">{selectedCharge.competenciaLabel} · {selectedCharge.modelo}</p>
                </div>
                <button type="button" onClick={fecharPainelCobranca} disabled={isChargeActionLoading} aria-label="Fechar painel" className="h-9 w-9 rounded-full border border-[#dfded7] bg-white text-slate-500 flex items-center justify-center hover:text-slate-900 disabled:opacity-50"><X size={17} /></button>
              </div>

              <div className="p-5 md:p-7 space-y-5">
                <section className="overflow-hidden rounded-2xl border border-[#d7d4cb] bg-white">
                  <div className="p-5 bg-[#173f32] text-white flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-white/55">Valor da cobrança</p>
                      <p className="text-3xl font-semibold mt-1">{formatCurrencyBR(selectedCharge.valor)}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${isOverdueCharge(selectedCharge) ? 'bg-rose-400/20 text-rose-100' : selectedCharge.status === 'Pago' ? 'bg-emerald-300/20 text-emerald-100' : 'bg-white/10 text-white/80'}`}>{selectedCharge.status}</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#e7e4dc]">
                    <div className="p-4"><p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-slate-400">Vencimento</p><p className="text-sm font-semibold text-slate-800 mt-1">{selectedCharge.vencimento}</p></div>
                    <div className="p-4"><p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-slate-400">Referência</p><p className="text-sm font-semibold text-slate-800 mt-1">{selectedCharge.invoiceId ? 'Fatura emitida' : 'Mensalidade prevista'}</p></div>
                  </div>
                  {selectedCharge.adjustmentReason && <div className="px-4 py-3 border-t border-[#e7e4dc] bg-[#faf9f6] text-[11px] text-slate-600"><strong>Registro:</strong> {selectedCharge.adjustmentReason}</div>}
                </section>

                {isOpenCharge(selectedCharge) && selectedCharge.status !== 'Em apuração' && (
                  <section className="rounded-2xl border border-[#d7d4cb] bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-700" /> Registrar recebimento</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Dá baixa nesta competência, entra no caixa e libera o recibo.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500">Valor recebido</label>
                        <input type="number" min="0.01" step="0.01" value={chargeValue} onChange={event => setChargeValue(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-[#dcd9d0] bg-[#fbfaf7] text-slate-900 font-semibold outline-none focus:border-[#6e8f7e]" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500">Data</label>
                        <input type="date" value={receiveDate} onChange={event => setReceiveDate(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-[#dcd9d0] bg-[#fbfaf7] text-xs text-slate-700 outline-none focus:border-[#6e8f7e]" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500">Forma</label>
                        <select value={receiveMethod} onChange={event => setReceiveMethod(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-[#dcd9d0] bg-[#fbfaf7] text-xs text-slate-700 outline-none focus:border-[#6e8f7e]">
                          <option value="PIX">PIX</option><option value="Dinheiro">Dinheiro</option><option value="Cartão">Cartão</option><option value="Transferência">Transferência</option>
                        </select>
                      </div>
                    </div>
                    <button type="button" onClick={handleConfirmarRecebimento} disabled={isChargeActionLoading} className="mt-4 w-full h-11 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold hover:bg-[#17382c] disabled:opacity-50">{isChargeActionLoading ? 'Registrando...' : 'Marcar como recebido'}</button>
                  </section>
                )}

                {selectedCharge.status === 'Pago' && (
                  <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                    <h3 className="text-sm font-semibold text-emerald-900">Pagamento confirmado</h3>
                    <p className="text-[11px] leading-relaxed text-emerald-800/75 mt-1">Se esta baixa foi criada por engano ou era apenas um teste, você pode removê-la. O valor sairá do caixa e a competência voltará para a carteira.</p>
                    <button type="button" onClick={handleReabrirCobranca} disabled={isChargeActionLoading} className="mt-4 w-full h-10 rounded-xl border border-emerald-300 bg-white text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><RotateCcw size={14} /> Reabrir cobrança / excluir baixa</button>
                  </section>
                )}

                {selectedCharge.status === 'Desconsiderada' ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900">Cobrança desconsiderada</h3>
                    <p className="text-[11px] text-slate-500 mt-1">Ela não entra nos valores em aberto ou em atraso, mas permanece registrada para auditoria.</p>
                    <button type="button" onClick={handleRestaurarCobranca} disabled={isChargeActionLoading} className="mt-4 w-full h-10 rounded-xl border border-[#d7d4cb] text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><RotateCcw size={14} /> Restaurar cobrança</button>
                    <button type="button" onClick={handleExcluirCobrancaDefinitivamente} disabled={isChargeActionLoading} className="mt-2 w-full h-10 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 size={14} /> Excluir definitivamente</button>
                  </section>
                ) : selectedCharge.status !== 'Pago' && selectedCharge.status !== 'Em apuração' && selectedCharge.competencia && selectedCharge.modeloCodigo !== 'CREDITOS' && (
                  <section className="rounded-2xl border border-[#d7d4cb] bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">Corrigir ou desconsiderar</h3>
                      <p className="text-[11px] text-slate-500 mt-1">A correção fica registrada sem apagar o histórico original.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500">Valor correto</label>
                        <input type="number" min="0" step="0.01" value={chargeValue} onChange={event => setChargeValue(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-[#dcd9d0] bg-[#fbfaf7] text-xs text-slate-700 outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500">Vencimento correto</label>
                        <input type="date" value={chargeDueDate} onChange={event => setChargeDueDate(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-[#dcd9d0] bg-[#fbfaf7] text-xs text-slate-700 outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500">Motivo da alteração</label>
                        <textarea value={chargeReason} onChange={event => setChargeReason(event.target.value)} placeholder="Ex.: cadastro de teste, bolsa concedida, valor corrigido..." className="mt-1 w-full min-h-20 p-3 rounded-xl border border-[#dcd9d0] bg-[#fbfaf7] text-xs text-slate-700 outline-none resize-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                      <button type="button" onClick={handleSalvarAjusteCobranca} disabled={isChargeActionLoading} className="h-10 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold disabled:opacity-50">Salvar correção</button>
                      <button type="button" onClick={handleDesconsiderarCobranca} disabled={isChargeActionLoading} className="h-10 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 size={14} /> Desconsiderar cobrança</button>
                    </div>
                    {selectedCharge.isAdjusted && <button type="button" onClick={handleRestaurarCobranca} disabled={isChargeActionLoading} className="mt-2 w-full h-9 text-[11px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50">Restaurar valor e vencimento originais</button>}
                  </section>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-3">
                  {selectedCharge.invoiceId && <button type="button" onClick={() => window.open(`/faturas/${selectedCharge.invoiceId}`, '_blank')} className="h-10 rounded-xl border border-[#d7d4cb] bg-white text-slate-700 text-xs font-semibold flex items-center justify-center gap-2"><FileText size={14} /> Abrir fatura</button>}
                  <button type="button" onClick={() => router.push(`/alunos/${selectedCharge.alunoId}`)} className="h-10 rounded-xl border border-[#d7d4cb] bg-white text-slate-700 text-xs font-semibold flex items-center justify-center gap-2"><UsersRound size={14} /> Abrir perfil do aluno</button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isConfigModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-slate-500 p-8 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar`}>
              
              <h2 className={`text-2xl font-bold tracking-tight mb-6 text-slate-800 flex items-center gap-3 drop-shadow-sm`}>
                <span>⚙️</span> Configurações de Cobrança
              </h2>
              
              <form onSubmit={handleSalvarConfig} className="space-y-6">
                <div className="rounded-2xl bg-white/50 border border-white/70 p-5">
                  <div className="mb-4">
                    <p className="text-sm font-bold text-slate-800">Dados da escola na fatura</p>
                    <p className="text-xs text-slate-500 mt-1">Estas informações ficam registradas na fatura no momento da emissão.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600 ml-1">Nome da escola / razão social</label>
                      <input required value={schoolData.escola_nome} onChange={e => setSchoolData(current => ({ ...current, escola_nome: normalizeName(e.target.value) }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 font-semibold mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">CPF ou CNPJ</label>
                      <input value={schoolData.escola_documento} onChange={e => setSchoolData(current => ({ ...current, escola_documento: formatCPFOrCNPJ(e.target.value) }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">Telefone</label>
                      <input value={schoolData.escola_telefone} onChange={e => setSchoolData(current => ({ ...current, escola_telefone: formatBrazilianPhone(e.target.value) }))} onBlur={() => setSchoolData(current => ({ ...current, escola_telefone: ensureBrazilianNinthDigit(current.escola_telefone) }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600 ml-1">E-mail</label>
                      <input type="email" value={schoolData.escola_email} onChange={e => setSchoolData(current => ({ ...current, escola_email: normalizeEmail(e.target.value) }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">CEP</label>
                      <input value={schoolData.escola_cep} onChange={e => setSchoolData(current => ({ ...current, escola_cep: formatCEP(e.target.value) }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">Endereço</label>
                      <input value={schoolData.escola_endereco} onChange={e => setSchoolData(current => ({ ...current, escola_endereco: e.target.value }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">Número</label>
                      <input value={schoolData.escola_numero} onChange={e => setSchoolData(current => ({ ...current, escola_numero: e.target.value }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">Complemento</label>
                      <input value={schoolData.escola_complemento} onChange={e => setSchoolData(current => ({ ...current, escola_complemento: e.target.value }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">Bairro</label>
                      <input value={schoolData.escola_bairro} onChange={e => setSchoolData(current => ({ ...current, escola_bairro: e.target.value }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">Cidade</label>
                      <input value={schoolData.escola_cidade} onChange={e => setSchoolData(current => ({ ...current, escola_cidade: e.target.value }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1">Estado</label>
                      <input maxLength={2} value={schoolData.escola_estado} onChange={e => setSchoolData(current => ({ ...current, escola_estado: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))} className="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-700 mt-1" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Sua Chave PIX</label>
                  <input placeholder="Ex: 12.345.678/0001-90" value={chavePix} onChange={e => setChavePix(e.target.value)} className={`w-full p-4 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-medium focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner placeholder:text-slate-400 mt-1`} />
                </div>
                
                <div className="bg-indigo-50/80 backdrop-blur-md border border-indigo-200/50 p-4 rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-indigo-700 mb-2 drop-shadow-sm">💡 Variáveis Mágicas</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{nome}}`} = Nome</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{valor}}`} = Valor R$</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{vencimento}}`} = Dia</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{modelo}}`} = Modelo</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{link}}`} = Link da fatura</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{pix}}`} = Chave</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Lembrete (Antes do Vencimento)</label>
                  <textarea value={msgPendente} onChange={e => setMsgPendente(e.target.value)} className={`w-full p-4 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-normal focus:bg-white/80 focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none shadow-inner mt-1 h-32 resize-none`} />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Aviso (Em Atraso)</label>
                  <textarea value={msgAtrasado} onChange={e => setMsgAtrasado(e.target.value)} className={`w-full p-4 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-normal focus:bg-white/80 focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none shadow-inner mt-1 h-32 resize-none`} />
                </div>
                
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsConfigModalOpen(false)} disabled={isSavingConfig} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white disabled:opacity-50`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSavingConfig} className="px-10 py-4 rounded-2xl bg-slate-800 text-white font-bold text-sm shadow-xl hover:bg-slate-700 transition-all disabled:opacity-50">{isSavingConfig ? 'Salvando...' : 'Salvar Alterações'}</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-emerald-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative`}>
              
              <h2 className={`text-2xl font-bold tracking-tight mb-6 text-slate-800 drop-shadow-sm`}>
                {editandoId ? 'Editar Movimentação' : 'Registro de Caixa'}
              </h2>
              
              <form onSubmit={handleSalvarTransacao} className="space-y-5">
                {(() => {
                  const isEditandoPagamento = editandoId?.startsWith('pg-');
                  const inputClass = "w-full p-3.5 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-medium focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner disabled:opacity-50 disabled:cursor-not-allowed";
                  
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 ml-1">Tipo</label>
                          <select required disabled={isEditandoPagamento} value={tTipo} onChange={e => { setTTipo(e.target.value); setTCategoria(e.target.value === 'Saída' ? 'Aluguel' : 'Investimento'); }} className={inputClass}>
                            <option value="Entrada">Entrada 📈</option>
                            <option value="Saída">Saída / Despesa 📉</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 ml-1">Data</label>
                          <input type="date" required value={tData} onChange={e => setTData(e.target.value)} className={inputClass} />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-slate-600 ml-1">Categoria</label>
                        <select required disabled={isEditandoPagamento} value={tCategoria} onChange={e => setTCategoria(e.target.value)} className={inputClass}>
                          {tTipo === 'Saída' ? (
                            <><option value="Aluguel">Aluguel</option><option value="Água">Água</option><option value="Energia">Energia</option><option value="Internet">Internet</option><option value="Compra de Material">Compra de Material</option><option value="Retirada (Salário)">Retirada (Meu Salário)</option><option value="Outros">Outras Despesas</option></>
                          ) : (
                            <><option value="Investimento">Investimento (Aporte)</option><option value="Mensalidade">Mensalidade</option><option value="Outros">Outras Entradas</option></>
                          )}
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-slate-600 ml-1">Descrição Breve</label>
                        <input required disabled={isEditandoPagamento} placeholder="Ex: Compra de cordas..." value={tDescricao} onChange={e => setTDescricao(e.target.value)} className={inputClass} />
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-slate-600 ml-1">Valor (R$)</label>
                        <input type="number" step="0.01" required value={tValor} onChange={e => setTValor(e.target.value)} className={`w-full p-3.5 rounded-xl bg-white/50 border border-white/60 font-bold text-xl focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner ${tTipo === 'Entrada' ? 'text-emerald-600' : 'text-rose-600'}`} />
                      </div>
                    </>
                  )
                })()}

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsModalOpen(false)} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" className="px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-xl hover:shadow-emerald-500/30 transition-all">
                    {editandoId ? 'Salvar Alterações' : 'Salvar no Caixa'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
