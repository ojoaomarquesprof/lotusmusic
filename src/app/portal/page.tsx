"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrencyBR, getBillingModel, getBillingModelLabel, isBillableClass, isConfirmedPayment } from '../../lib/billing'
import { downloadReceiptHistoryPdf, downloadReceiptPdf, type ReceiptPdfData } from '../../lib/receiptPdf'
import { buildFinancialDossier, FinancialCharge, summarizeFinancialDossier } from '../../lib/financialDossier'
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Home,
  Inbox,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Music2,
  ReceiptText,
  Repeat2,
  RotateCcw,
  Send,
  ShieldCheck,
  UploadCloud,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } } as const

const horarioEmMinutos = (horario?: string) => {
  const [hora, minuto] = String(horario || '').split(':').map(Number)
  return Number.isFinite(hora) && Number.isFinite(minuto) ? (hora * 60) + minuto : Number.MAX_SAFE_INTEGER
}

export default function PortalAluno() {
  const { s, toggleTheme } = useStyles()
  const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aluno, setAluno] = useState<any>(null)
  const [escola, setEscola] = useState<any>(null)
  const [aulas, setAulas] = useState<any[]>([])
  const [materiais, setMateriais] = useState<any[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [todasReposicoes, setTodasReposicoes] = useState<any[]>([]) 
  const [historicoPagamentos, setHistoricoPagamentos] = useState<any[]>([])
  const [pagamentosInformados, setPagamentosInformados] = useState<any[]>([])
  const [faturaAtual, setFaturaAtual] = useState<any>(null)
  const [cobrancasFinanceiras, setCobrancasFinanceiras] = useState<FinancialCharge[]>([])
  const [apuracaoMes, setApuracaoMes] = useState({ aulas: 0, valor: 0 })
  
  const [isPayHistoryModalOpen, setIsPayHistoryModalOpen] = useState(false)
  const [isReportPaymentOpen, setIsReportPaymentOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false)
  const [isNotificacaoModalOpen, setIsNotificacaoModalOpen] = useState(false)
  const [isClassDetailsModalOpen, setIsClassDetailsModalOpen] = useState(false)
  const [selectedClassDetails, setSelectedClassDetails] = useState<any>(null)
  const [activePortalTab, setActivePortalTab] = useState<'inicio' | 'agenda' | 'financeiro' | 'estudos'>('inicio')
  
  const [notificacaoTab, setNotificacaoTab] = useState('NaoLidas') 
  const [todasNotificacoes, setTodasNotificacoes] = useState<any[]>([]) 

  const [editNome, setEditNome] = useState('')
  const [editSenha, setEditSenha] = useState('')
  const [editFotoArquivo, setEditFotoArquivo] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  const [reportedValue, setReportedValue] = useState('')
  const [reportedDate, setReportedDate] = useState(new Date().toISOString().slice(0, 10))
  const [reportedMethod, setReportedMethod] = useState('PIX')
  const [reportedChargeId, setReportedChargeId] = useState('')
  const [reportedInvoiceId, setReportedInvoiceId] = useState('')
  const [reportedCompetence, setReportedCompetence] = useState(new Date().toISOString().slice(0, 7))
  const [reportedNotes, setReportedNotes] = useState('')
  const [reportedProof, setReportedProof] = useState<File | null>(null)
  const [reportedProofPreview, setReportedProofPreview] = useState<string | null>(null)

  const [rescheduleType, setRescheduleType] = useState('Pontual') 
  const [solicitacaoPendente, setSolicitacaoPendente] = useState<any>(null)
  
  const [aulaParaMudar, setAulaParaMudar] = useState<any>(null)
  const [proximosDias, setProximosDias] = useState<any[]>([])
  const [mesCalendario, setMesCalendario] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })
  const [dispBrutaProf, setDispBrutaProf] = useState<any[]>([])
  const [agendaBrutaProf, setAgendaBrutaProf] = useState<any[]>([])
  
  const [eventosGlobais, setEventosGlobais] = useState<any[]>([])
  const [selectedDateObj, setSelectedDateObj] = useState<any>(null)
  const [vagasDoDiaSelecionado, setVagasDoDiaSelecionado] = useState<any[]>([])
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [diaBloqueadoMsg, setDiaBloqueadoMsg] = useState<string | null>(null)

  // ESTADO DE CRÉDITOS DE REPOSIÇÃO
  const [creditos, setCreditos] = useState(0)

  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => { if (s.bg && s.bg.includes('950')) toggleTheme() }, [s.bg, toggleTheme])
  
  // 🟢 REALTIME
  useEffect(() => {
    if (!isMounted) return;
    const channel = supabase.channel('portal-aluno-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_reagendamento' }, () => { carregarPortal() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes_aluno' }, () => { carregarPortal() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_aulas' }, () => { carregarPortal() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => { carregarPortal() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_informados' }, () => { carregarPortal() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faturas' }, () => { carregarPortal() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alunos_info' }, () => { carregarPortal() })
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [isMounted])

  useEffect(() => { if (isMounted) carregarPortal() }, [isMounted])

  // 🟢 CALENDÁRIO 60 DIAS A FRENTE
  useEffect(() => {
    const dias = []; const mapaDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    for (let i = 1; i <= 60; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      if (d.getDay() !== 0) dias.push({ dataObj: d, dataString: d.toISOString().split('T')[0], diaSemana: mapaDias[d.getDay()], displayData: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })
    }
    setProximosDias(dias)
  }, [])

  useEffect(() => {
    if (selectedDateObj && dispBrutaProf.length > 0) {
      const diaDaSemanaSelecionado = selectedDateObj.diaSemana; 
      const dataSelecionadaStr = selectedDateObj.dataString;

      const eventoBloqueio = eventosGlobais.find(e => e.data_evento === dataSelecionadaStr && (e.tipo === 'Feriado' || e.tipo === 'Recesso'))
      
      if (eventoBloqueio) {
        setDiaBloqueadoMsg(eventoBloqueio.titulo)
        setVagasDoDiaSelecionado([])
        setSelectedSlot(null)
        return; 
      } else {
        setDiaBloqueadoMsg(null)
      }

      const vagasPotenciais = dispBrutaProf.filter(d => d.dia_semana === diaDaSemanaSelecionado)
      const vagasReais = vagasPotenciais.filter(vaga => {
        const isOcupado = agendaBrutaProf.some(ag => {
          if (ag.data_especifica && ag.data_especifica !== dataSelecionadaStr) return false
          const isSameSlot = ag.dia === diaDaSemanaSelecionado && ag.horario_inicio?.slice(0, 5) === vaga.hora_inicio?.slice(0, 5)
          if (!isSameSlot) return false;
          const info = Array.isArray(ag.aluno?.alunos_info) ? ag.aluno?.alunos_info[0] : ag.aluno?.alunos_info;
          if (info?.status === 'Inativo') { if (!info.data_inativacao) return false; if (dataSelecionadaStr >= info.data_inativacao) return false; }
          return true; 
        })
        return !isOcupado
      })
      const vagasOrdenadas = [...vagasReais].sort((a, b) => {
        const diferencaInicio = horarioEmMinutos(a.hora_inicio) - horarioEmMinutos(b.hora_inicio)
        return diferencaInicio || horarioEmMinutos(a.hora_fim) - horarioEmMinutos(b.hora_fim)
      })
      setVagasDoDiaSelecionado(vagasOrdenadas); setSelectedSlot(null)
    } else { 
      setVagasDoDiaSelecionado([]); setDiaBloqueadoMsg(null) 
    }
  }, [selectedDateObj, dispBrutaProf, agendaBrutaProf, eventosGlobais])

  async function carregarPortal() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const hojeDataStr = new Date().toISOString().split('T')[0]

    const { data: perfil } = await supabase.from('profiles').select('*, alunos_info(*)').eq('id', session.user.id).single()
    if (perfil) { setAluno(perfil); setEditNome(perfil.nome_completo || ''); setFotoPreview(perfil.avatar_url || null) }

    const { data: config } = await supabase.from('configuracoes').select('*').eq('id', 1).single()
    setEscola(config)

    const { data: ev } = await supabase.from('eventos_calendario').select('*').gte('data_evento', hojeDataStr)
    setEventosGlobais(ev || [])

    const { data: ag } = await supabase.from('agenda').select('*, sala:salas(nome)').eq('aluno_id', session.user.id)
    const { data: participacoesTurma } = await supabase
      .from('turma_alunos')
      .select('turma:turmas(*)')
      .eq('aluno_id', session.user.id)
      .eq('status', 'ATIVO')
    const agendasTurma = (participacoesTurma || [])
      .map((item: any) => item.turma)
      .filter((turma: any) => turma?.status === 'ATIVA')
      .map((turma: any) => ({
        id: `turma_${turma.id}`,
        turma_id: turma.id,
        is_turma: true,
        dia: turma.dia,
        horario_inicio: turma.horario_inicio,
        horario_fim: turma.horario_fim,
        professor_id: turma.professor_id,
        instrumento_aula: turma.modalidade,
        sala: { nome: turma.endereco },
        turma_nome: turma.nome,
      }))
    
    const { data: rep } = await supabase.from('solicitacoes_reagendamento').select('*').eq('aluno_id', session.user.id)
    setTodasReposicoes(rep || [])

    const solicitacoesAprovadasFuturas = (rep || []).filter((r: any) =>
      r.status === 'Aprovada' &&
      r.tipo_mudanca !== 'Fixa' &&
      r.nova_data >= hojeDataStr
    )

    let aulasMapeadas = [...(ag || []), ...agendasTurma]
    
    if (solicitacoesAprovadasFuturas.length > 0) {
      const aulasAlteradas = solicitacoesAprovadasFuturas.map((r: any) => {
        const aulaOriginal = (ag || []).find((a: any) => String(a.id) === String(r.agenda_original_id))
        const isReposicao = r.tipo_mudanca === 'Reposição'

        return {
          id: 'repo_' + r.id,
          id_real: r.id,
          agenda_original_id: r.agenda_original_id,
          criado_em: r.criado_em,
          is_reposicao: isReposicao,
          is_remarcacao: !isReposicao,
          is_solicitacao_aprovada: true,
          dia: r.novo_dia,
          horario_inicio: r.novo_horario_inicio,
          horario_fim: r.novo_horario_fim,
          professor_id: r.professor_id,
          instrumento_aula: aulaOriginal?.instrumento_aula || (isReposicao ? 'Reposição' : 'Aula remarcada'),
          nova_data: r.nova_data,
          sala: aulaOriginal?.sala || { nome: isReposicao ? 'Reposição' : 'Novo horário aprovado' }
        }
      });
      aulasMapeadas = [...aulasMapeadas, ...aulasAlteradas];
    }

    if (aulasMapeadas.length > 0) {
      const profIds = aulasMapeadas.map((a: any) => a.professor_id).filter(Boolean)
      const { data: profs } = await supabase.from('profiles').select('id, nome_completo').in('id', profIds)
      aulasMapeadas = aulasMapeadas.map((aula: any) => ({ ...aula, professor_nome: profs?.find((p: any) => p.id === aula.professor_id)?.nome_completo || null }))
    }
    
    setAulas(aulasMapeadas)

    const { data: solArr } = await supabase.from('solicitacoes_reagendamento').select('*').eq('aluno_id', session.user.id).eq('status', 'Pendente').order('criado_em', { ascending: false }).limit(1)
    setSolicitacaoPendente(solArr && solArr.length > 0 ? solArr[0] : null)

    const { data: notifsAg } = await supabase.from('solicitacoes_reagendamento').select('*').eq('aluno_id', session.user.id).neq('status', 'Pendente')
    const { data: notifsMsg } = await supabase.from('notificacoes_aluno').select('*').eq('aluno_id', session.user.id)
    
    const padronizadas = [
      ...(notifsAg || []).map(n => ({ ...n, source: 'agenda', is_read: n.lida_aluno })),
      ...(notifsMsg || []).map(n => ({ ...n, source: 'mensagem', is_read: n.lida }))
    ]
    padronizadas.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
    setTodasNotificacoes(padronizadas)

    const { data: mats } = await supabase.from('materiais_aluno').select('*').eq('aluno_id', session.user.id).order('data_envio', { ascending: false })
    setMateriais(mats || [])

    const { data: hist } = await supabase.from('historico_aulas').select('*').eq('aluno_id', session.user.id).order('data_aula', { ascending: false }).limit(10)
    setHistorico(hist || [])

    const info = Array.isArray(perfil?.alunos_info) ? perfil?.alunos_info[0] : perfil?.alunos_info
    const modeloFaturamento = getBillingModel(info)

    // Reposições só existem no modelo de vencimento fixo e expiram em 30 dias.
    const { data: histAll } = await supabase.from('historico_aulas').select('*').eq('aluno_id', session.user.id).order('data_aula', { ascending: false }).limit(200)
    if (modeloFaturamento === 'VENCIMENTO_FIXO') {
      const { data: creditosValidos, error: creditosError } = await supabase
        .from('creditos_reposicao')
        .select('id')
        .eq('aluno_id', session.user.id)
        .is('usado_em', null)
        .gte('expira_em', new Date().toISOString().slice(0, 10))

      if (!creditosError) {
        setCreditos(creditosValidos?.length || 0)
      } else {
        const limiteReposicao = new Date()
        limiteReposicao.setDate(limiteReposicao.getDate() - 30)
        const limiteStr = limiteReposicao.toISOString().slice(0, 10)
        const qtdDesmarcadas = (histAll || []).filter(h =>
          (h.status === 'Desmarcada' || h.status === 'Crédito' || h.status === 'Falta Justificada') &&
          String(h.data_aula).slice(0, 10) >= limiteStr
        ).length;
        const qtdUsadasPortal = (rep || []).filter((r: any) => r.status !== 'Negada').length;
        const qtdUsadasManual = (histAll || []).filter(h => h.status === 'Reposição' || h.status === 'Ajuste de Saldo').length;
        setCreditos(Math.max(0, qtdDesmarcadas - (qtdUsadasPortal + qtdUsadasManual)));
      }
    } else {
      setCreditos(0)
    }

    const prefixoMes = new Date().toISOString().slice(0, 7)
    const registrosFaturaveisMes = (histAll || []).filter(h =>
      String(h.data_aula).startsWith(prefixoMes) && isBillableClass(h.status)
    )
    setApuracaoMes({
      aulas: registrosFaturaveisMes.length,
      valor: registrosFaturaveisMes.reduce(
        (total, aula) =>
          total + Number(aula.valor_aula_faturado ?? info?.valor_por_aula ?? 0),
        0,
      ),
    })

    const { data: invoices } = await supabase
      .from('faturas')
      .select('*')
      .eq('aluno_id', session.user.id)
      .neq('status', 'CANCELADO')
      .order('data_emissao', { ascending: false })
    setFaturaAtual(invoices?.[0] || null)

    const { data: allPgs } = await supabase
      .from('pagamentos')
      .select('*, fatura:faturas(numero, competencia, modelo_faturamento)')
      .eq('aluno_id', session.user.id)
      .order('data_pagamento', { ascending: false })
    const pagamentosConfirmados = (allPgs || []).filter(isConfirmedPayment)
    setHistoricoPagamentos(pagamentosConfirmados)

    const { data: ajustes } = await supabase
      .from('ajustes_cobranca')
      .select('*')
      .eq('aluno_id', session.user.id)
    setCobrancasFinanceiras(buildFinancialDossier({
      alunos: perfil ? [perfil] : [],
      pagamentos: allPgs || [],
      faturas: invoices || [],
      ajustes: ajustes || [],
      historicoMes: (histAll || []).filter(aula => String(aula.data_aula).startsWith(prefixoMes)),
    }))

    const { data: reportedPayments } = await supabase
      .from('pagamentos_informados')
      .select('*, fatura:faturas(numero, valor_total, status)')
      .eq('aluno_id', session.user.id)
      .order('criado_em', { ascending: false })
    setPagamentosInformados(reportedPayments || [])

    setLoading(false)
  }

  const handleMarcarComoLida = async (n: any) => {
    setIsSubmitting(true)
    if (n.source === 'agenda') await supabase.from('solicitacoes_reagendamento').update({ lida_aluno: true }).eq('id', n.id)
    else await supabase.from('notificacoes_aluno').update({ lida: true }).eq('id', n.id)
    setTodasNotificacoes(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item))
    setIsSubmitting(false)
  }

  const copiarPix = () => { if (escola?.chave_pix) { navigator.clipboard.writeText(escola.chave_pix); alert('Chave PIX copiada!') } }
  const handleSair = async () => { await supabase.auth.signOut(); router.push('/login') }

  const resetReportedPayment = () => {
    setReportedValue('')
    setReportedDate(new Date().toISOString().slice(0, 10))
    setReportedMethod('PIX')
    setReportedChargeId('')
    setReportedInvoiceId('')
    setReportedCompetence(new Date().toISOString().slice(0, 7))
    setReportedNotes('')
    setReportedProof(null)
    setReportedProofPreview(null)
  }

  const handleReportedProof = (file?: File) => {
    if (!file) {
      setReportedProof(null)
      setReportedProofPreview(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      alert('O comprovante precisa ser uma imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem pode ter no máximo 5 MB.')
      return
    }
    setReportedProof(file)
    setReportedProofPreview(URL.createObjectURL(file))
  }

  const handleInformarPagamento = async (event: React.FormEvent) => {
    event.preventDefault()
    const valor = Number(reportedValue)
    if (!valor || valor <= 0) return alert('Informe o valor pago.')

    setIsSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setIsSubmitting(false)
      return router.push('/login')
    }

    let proofPath: string | null = null
    if (reportedProof) {
      const extensao = reportedProof.name.split('.').pop()?.toLowerCase() || 'jpg'
      proofPath = `${session.user.id}/${crypto.randomUUID()}.${extensao}`
      const { error: uploadError } = await supabase.storage
        .from('comprovantes-pagamento')
        .upload(proofPath, reportedProof, { contentType: reportedProof.type, upsert: false })
      if (uploadError) {
        setIsSubmitting(false)
        return alert(`Não foi possível anexar a imagem: ${uploadError.message}`)
      }
    }

    const { error } = await supabase.from('pagamentos_informados').insert({
      aluno_id: session.user.id,
      fatura_id: reportedInvoiceId || null,
      competencia: `${reportedCompetence}-01`,
      valor,
      data_pagamento: reportedDate,
      metodo_pagamento: reportedMethod,
      observacoes: reportedNotes.trim() || null,
      comprovante_path: proofPath,
      comprovante_nome: reportedProof?.name || null,
      comprovante_mime: reportedProof?.type || null,
    })

    if (error && proofPath) {
      await supabase.storage.from('comprovantes-pagamento').remove([proofPath])
    }
    setIsSubmitting(false)
    if (error) {
      const mensagem = error.message.includes('pagamentos_informados_fatura_pendente_uidx')
        ? 'Já existe um pagamento desta fatura aguardando análise.'
        : `Não foi possível enviar: ${error.message}`
      return alert(mensagem)
    }

    resetReportedPayment()
    setIsReportPaymentOpen(false)
    alert('Pagamento informado. A escola vai analisar antes de confirmar o recebimento.')
    await carregarPortal()
  }

  const handleAtualizarPerfil = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true)
    let url = aluno.avatar_url
    if (editFotoArquivo) {
      const path = `alunos/${aluno.id}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, editFotoArquivo)
      if (!error) url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }
    if (editSenha && editSenha.length >= 6) await supabase.auth.updateUser({ password: editSenha })
    await supabase.from('profiles').update({ nome_completo: editNome, avatar_url: url }).eq('id', aluno.id)
    alert("✅ Perfil atualizado!"); setIsProfileModalOpen(false); carregarPortal(); setIsSubmitting(false)
  }

  const abrirModalReagendamento = async (tipo: string, aula: any, dataOriginalDaAulaDesmarcada?: string) => {
    setRescheduleType(tipo); 
    setAulaParaMudar({ ...aula, data_original_desmarcada: dataOriginalDaAulaDesmarcada }); 
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    setMesCalendario(new Date(amanha.getFullYear(), amanha.getMonth(), 1))
    setSelectedDateObj(null); setSelectedSlot(null); setDiaBloqueadoMsg(null); setIsRescheduleModalOpen(true);
    const { data: disp } = await supabase.from('disponibilidade_professor').select('*').eq('professor_id', aula.professor_id)
    const { data: ag } = await supabase.from('agenda').select(`dia, horario_inicio, aluno:profiles!aluno_id(alunos_info(status, data_inativacao))`).eq('professor_id', aula.professor_id)
    const { data: mudancasOcupadas } = await supabase
      .from('solicitacoes_reagendamento')
      .select('nova_data, novo_dia, novo_horario_inicio, status')
      .eq('professor_id', aula.professor_id)
      .in('status', ['Pendente', 'Aprovada'])
      .gte('nova_data', new Date().toISOString().slice(0, 10))

    const horariosPontuaisOcupados = (mudancasOcupadas || []).map((mudanca: any) => ({
      dia: mudanca.novo_dia,
      horario_inicio: mudanca.novo_horario_inicio,
      data_especifica: mudanca.nova_data,
    }))

    setDispBrutaProf(disp || []); setAgendaBrutaProf([...(ag || []), ...horariosPontuaisOcupados])
  }

  const handleSolicitarReagendamento = async () => {
    if (!selectedSlot || !selectedDateObj) return
    setIsSubmitting(true)
    
    let idAgendaPai = aulaParaMudar.agenda_original_id;
    if (!idAgendaPai) {
      idAgendaPai = String(aulaParaMudar.id).startsWith('repo_') ? null : aulaParaMudar.id;
    }

    // No vencimento fixo, a desmarcação gera o crédito que será reservado
    // pela solicitação de reposição. Nos demais modelos, a aula original só
    // é desmarcada depois que a escola aprovar a mudança.
    if (rescheduleType === 'Reposição' && !aulaParaMudar.is_reposicao && !aulaParaMudar.usando_credito) {
        const dStr = aulaParaMudar.data_original_desmarcada || new Date().toISOString().split('T')[0]; 
        await supabase.from('historico_aulas').delete().eq('aluno_id', aluno.id).eq('data_aula', dStr);
        await supabase.from('historico_aulas').insert([{
            aluno_id: aluno.id,
            data_aula: dStr,
            horario_inicio: aulaParaMudar.horario_inicio || null,
            horario_fim: aulaParaMudar.horario_fim || null,
            status: 'Desmarcada',
            observacoes: 'Aluno solicitou reagendamento',
            professor_id: aulaParaMudar.professor_id || null,
            modalidade: aulaParaMudar.instrumento_aula || null,
        }]);
    }

    const { error } = await supabase.from('solicitacoes_reagendamento').insert([{ 
      aluno_id: aluno.id, 
      professor_id: aulaParaMudar.professor_id, 
      agenda_original_id: idAgendaPai, 
      tipo_mudanca: rescheduleType, 
      novo_dia: selectedSlot.dia_semana, 
      nova_data: selectedDateObj.dataString, 
      novo_horario_inicio: selectedSlot.hora_inicio, 
      novo_horario_fim: selectedSlot.hora_fim,
      data_aula_original: aulaParaMudar.data_original_desmarcada || null,
      status: 'Pendente',
      lida_aluno: false 
    }])

    if (error) {
       alert("🚨 Erro ao solicitar nova data: " + error.message);
       setIsSubmitting(false);
       return;
    }

    alert("✅ Solicitação enviada para análise!")
    setIsRescheduleModalOpen(false)
    carregarPortal()
    setIsSubmitting(false)
  }

  const calcularDataProximaAula = (diaStr: string, horaInicio: string) => {
    const mapa: any = { 'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }
    const hoje = new Date(); const diaAlvo = mapa[diaStr]; if (diaAlvo === undefined) return { dataFormatada: '--', dataBaseString: '' }
    let diff = diaAlvo - hoje.getDay()
    if (diff < 0 || (diff === 0 && hoje.getHours() > parseInt(horaInicio.split(':')[0]))) diff += 7
    const d = new Date(); d.setDate(hoje.getDate() + diff)
    
    const dataIsoString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const displayStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    const formatada = displayStr.charAt(0).toUpperCase() + displayStr.slice(1)
    
    return { dataFormatada: formatada, dataBaseString: dataIsoString }
  }

  const checkCanReschedule = (dateStr: string, timeStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const [h, min] = timeStr.split(':').map(Number);
      const classTime = new Date(y, m - 1, d, h, min);
      const now = new Date();
      const diffHours = (classTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      return diffHours >= 6; 
    } catch (e) {
      return false;
    }
  }

  const abrirDetalhesAula = (aula: any) => {
    setSelectedClassDetails(aula);
    setIsClassDetailsModalOpen(true);
  }

  if (!isMounted) return null;
  if (loading && !aluno) return <div className={`min-h-screen bg-slate-50 flex justify-center items-center`}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  const infoFinanceira = Array.isArray(aluno?.alunos_info) ? aluno?.alunos_info[0] : aluno?.alunos_info
  const modeloFaturamentoPortal = getBillingModel(infoFinanceira)
  
  const notificacoesNaoLidas = todasNotificacoes.filter(n => !n.is_read)
  const notificacoesLidas = todasNotificacoes.filter(n => n.is_read)
  const notificacoesExibidas = notificacaoTab === 'NaoLidas' ? notificacoesNaoLidas : notificacoesLidas
  const saldoCreditosFaturamento = Number(infoFinanceira?.saldo_creditos_faturamento || 0)
  const faturaEmAberto = faturaAtual && ['PENDENTE', 'VENCIDO', 'ERRO'].includes(faturaAtual.status)
  const resumoFinanceiroPortal = summarizeFinancialDossier(cobrancasFinanceiras)
  const podeCopiarPix =
    (modeloFaturamentoPortal === 'VENCIMENTO_FIXO' && resumoFinanceiroPortal.open.length > 0) ||
    (modeloFaturamentoPortal === 'CREDITOS' && saldoCreditosFaturamento <= 0) ||
    (modeloFaturamentoPortal === 'MENSAL_FECHADO' && faturaEmAberto && !faturaAtual?.invoice_url)

  const aulasComData = aulas
    .map(aula => {
      let dadosData

      if (aula.is_solicitacao_aprovada || aula.is_reposicao || aula.is_remarcacao) {
        const [ano, mes, dia] = String(aula.nova_data).split('-').map(Number)
        const dataObj = new Date(ano, mes - 1, dia)
        const dataExtenso = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
        dadosData = {
          dataFormatada: dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1),
          dataBaseString: aula.nova_data,
        }
      } else {
        dadosData = calcularDataProximaAula(aula.dia, aula.horario_inicio)
      }

      const status = historico.find(h =>
        String(h.data_aula).slice(0, 10) === dadosData.dataBaseString
        && (aula.is_turma ? h.turma_id === aula.turma_id : !h.turma_id)
      )?.status
      const isDesmarcada = status === 'Desmarcada' || status === 'Falta Justificada'
      const podeSolicitarMudanca =
        !solicitacaoPendente &&
        !isDesmarcada &&
        !aula.is_turma &&
        !aula.is_reposicao &&
        !aula.is_remarcacao &&
        checkCanReschedule(dadosData.dataBaseString, aula.horario_inicio)

      return {
        ...aula,
        ...dadosData,
        status,
        isDesmarcada,
        podeSolicitarMudanca,
        dataOrdenacao: new Date(`${dadosData.dataBaseString}T${aula.horario_inicio || '00:00'}`).getTime(),
      }
    })
    .sort((a, b) => a.dataOrdenacao - b.dataOrdenacao)

  const proximaAula = aulasComData.find(aula => !aula.isDesmarcada) || aulasComData[0]
  const aulaBaseReposicao = aulas.find(aula => !aula.is_reposicao && !aula.is_turma)
  const tipoSolicitacaoMudanca = modeloFaturamentoPortal === 'VENCIMENTO_FIXO' ? 'Reposição' : 'Pontual'
  const valorResumoFinanceiro =
    modeloFaturamentoPortal === 'MENSAL_FECHADO'
      ? (faturaEmAberto ? Number(faturaAtual?.valor_total || 0) : apuracaoMes.valor)
      : modeloFaturamentoPortal === 'VENCIMENTO_FIXO'
        ? resumoFinanceiroPortal.totalOpen
        : Number(infoFinanceira?.valor_mensalidade || 0)
  const pagamentoInformadoPendente = pagamentosInformados.find(pagamento => pagamento.status === 'PENDENTE')

  const abrirPrestacaoDeContas = () => {
    const cobrancaPendente = resumoFinanceiroPortal.priorityCharge
    setReportedChargeId(cobrancaPendente?.id || '')
    setReportedInvoiceId(cobrancaPendente?.invoiceId || '')
    setReportedValue(String(cobrancaPendente?.valor || valorResumoFinanceiro || ''))
    setReportedDate(new Date().toISOString().slice(0, 10))
    setReportedCompetence(
      cobrancaPendente?.competencia
        ? String(cobrancaPendente.competencia).slice(0, 7)
        : new Date().toISOString().slice(0, 7),
    )
    setReportedMethod('PIX')
    setReportedNotes('')
    setReportedProof(null)
    setReportedProofPreview(null)
    setIsReportPaymentOpen(current => !current)
  }

  const criarDadosRecibo = (payment: any): ReceiptPdfData => ({
    payment,
    student: aluno || {},
    school: escola || {},
    billingModelLabel: getBillingModelLabel(payment.fatura?.modelo_faturamento || modeloFaturamentoPortal),
  })

  const baixarRecibo = (payment: any) => downloadReceiptPdf(criarDadosRecibo(payment))
  const baixarTodosRecibos = () => downloadReceiptHistoryPdf(historicoPagamentos.map(criarDadosRecibo))

  const tabsPortal = [
    { id: 'inicio' as const, label: 'Início', icon: Home },
    { id: 'agenda' as const, label: 'Agenda', icon: CalendarDays },
    { id: 'financeiro' as const, label: 'Financeiro', icon: WalletCards },
    { id: 'estudos' as const, label: 'Estudos', icon: BookOpen },
  ]

  const primeiroDiaMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1)
  const deslocamentoSegunda = (primeiroDiaMes.getDay() + 6) % 7
  const diasGradeCalendario = Array.from({ length: 42 }, (_, indice) => {
    const data = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), indice - deslocamentoSegunda + 1)
    const dataLocal = new Date(data.getTime() - data.getTimezoneOffset() * 60000).toISOString().split('T')[0]
    const opcaoPortal = proximosDias.find(dia => dia.dataString === dataLocal)

    return {
      data,
      dataString: dataLocal,
      mesmoMes: data.getMonth() === mesCalendario.getMonth(),
      opcaoPortal,
      temDisponibilidade: opcaoPortal
        ? dispBrutaProf.some(disponibilidade => disponibilidade.dia_semana === opcaoPortal.diaSemana)
        : false,
    }
  })
  const ultimoDiaDisponivel = proximosDias[proximosDias.length - 1]?.dataObj
  const podeVoltarMes = mesCalendario > new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const podeAvancarMes = ultimoDiaDisponivel
    ? mesCalendario < new Date(ultimoDiaDisponivel.getFullYear(), ultimoDiaDisponivel.getMonth(), 1)
    : false

  return (
    <div className="min-h-screen bg-[#f3f1eb] pb-28 font-sans text-[#17241f] md:pb-10">
      <header className="sticky top-0 z-40 border-b border-[#d9d5ca] bg-[#f8f7f2]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-7 md:py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="hidden h-11 w-32 items-center md:flex">
              {escola?.logo_url ? (
                <img src={escola.logo_url} alt={escola?.nome_escola || 'Escola'} className="max-h-10 max-w-32 object-contain" />
              ) : (
                <p className="truncate text-sm font-bold text-[#1d5143]">{escola?.nome_escola || 'Escola'}</p>
              )}
            </div>
            <button onClick={() => setIsProfileModalOpen(true)} className="group flex min-w-0 items-center gap-3 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1d5143] text-base font-bold text-white ring-2 ring-white">
                {aluno?.avatar_url ? (
                  <img src={aluno.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  aluno?.nome_completo?.charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a743d]">Portal do aluno</p>
                <p className="truncate text-base font-bold text-[#17241f] group-hover:text-[#1d5143]">
                  Olá, {aluno?.nome_completo?.split(' ')[0]}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!isNotificacaoModalOpen) setNotificacaoTab(notificacoesNaoLidas.length > 0 ? 'NaoLidas' : 'Lidas')
                setIsNotificacaoModalOpen(aberta => !aberta)
              }}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition ${
                isNotificacaoModalOpen
                  ? 'border-[#1d5143] bg-[#1d5143] text-white'
                  : 'border-[#d9d5ca] bg-white text-[#385449] hover:border-[#1d5143]'
              }`}
              aria-label={isNotificacaoModalOpen ? 'Fechar notificações' : 'Abrir notificações'}
              aria-pressed={isNotificacaoModalOpen}
            >
              <Bell size={19} strokeWidth={1.8} />
              {notificacoesNaoLidas.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b64b45] px-1 text-[10px] font-bold text-white">
                  {notificacoesNaoLidas.length}
                </span>
              )}
            </button>
            <button onClick={handleSair} className="hidden h-11 items-center gap-2 rounded-full border border-[#d9d5ca] bg-white px-4 text-sm font-semibold text-[#53635c] transition hover:text-[#b64b45] md:flex">
              <LogOut size={17} />
              Sair
            </button>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-6xl gap-1 px-7 pb-3 md:flex" aria-label="Navegação do portal">
          {tabsPortal.map(tab => {
            const Icone = tab.icon
            const ativo = activePortalTab === tab.id && !isNotificacaoModalOpen
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActivePortalTab(tab.id)
                  setIsNotificacaoModalOpen(false)
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  ativo ? 'bg-[#1d5143] text-white' : 'text-[#607069] hover:bg-[#ebe8df] hover:text-[#1d5143]'
                }`}
              >
                <Icone size={17} strokeWidth={1.8} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      <motion.main variants={containerVariants} initial="hidden" animate="show" className="mx-auto max-w-6xl px-4 py-6 md:px-7 md:py-8">
        {isNotificacaoModalOpen && (
          <motion.section variants={itemVariants} className="mx-auto max-w-4xl space-y-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a17a42]">Comunicação</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#17241f] md:text-4xl">Central de avisos</h1>
                <p className="mt-2 text-sm leading-6 text-[#66736d]">Mensagens da escola e atualizações sobre suas solicitações.</p>
              </div>
              <button
                onClick={() => setIsNotificacaoModalOpen(false)}
                className="flex w-fit items-center gap-2 rounded-full border border-[#d1cdc2] bg-[#fbfaf6] px-4 py-2.5 text-sm font-bold text-[#365248] transition hover:border-[#1d5143]"
              >
                <ArrowLeft size={17} />
                Voltar ao portal
              </button>
            </div>

            <div className="overflow-hidden rounded-[26px] border border-[#d9d5ca] bg-[#fbfaf6] shadow-[0_14px_35px_rgba(39,50,45,0.06)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#e1ddd3] px-4 py-4 md:px-6">
                <div className="flex rounded-full bg-[#ece9e1] p-1">
                  <button
                    onClick={() => setNotificacaoTab('NaoLidas')}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      notificacaoTab === 'NaoLidas' ? 'bg-[#1d5143] text-white shadow-sm' : 'text-[#68756f]'
                    }`}
                  >
                    Novas {notificacoesNaoLidas.length > 0 && <span className="ml-1">({notificacoesNaoLidas.length})</span>}
                  </button>
                  <button
                    onClick={() => setNotificacaoTab('Lidas')}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      notificacaoTab === 'Lidas' ? 'bg-[#1d5143] text-white shadow-sm' : 'text-[#68756f]'
                    }`}
                  >
                    Histórico ({notificacoesLidas.length})
                  </button>
                </div>
                <Bell size={19} className="hidden text-[#8b938f] sm:block" />
              </div>

              {notificacoesExibidas.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8ece8] text-[#547066]">
                    <Inbox size={24} strokeWidth={1.7} />
                  </span>
                  <p className="mt-4 font-bold text-[#263a32]">
                    {notificacaoTab === 'NaoLidas' ? 'Você está em dia' : 'Nenhum aviso no histórico'}
                  </p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-[#748079]">
                    {notificacaoTab === 'NaoLidas'
                      ? 'Não há mensagens novas ou solicitações aguardando sua leitura.'
                      : 'Os avisos lidos aparecerão aqui para consulta.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#e6e2d9]">
                  {notificacoesExibidas.map(n => {
                    const titulo = String(n.source === 'mensagem' ? n.titulo || 'Mensagem da escola' : `Solicitação ${n.status || 'atualizada'}`)
                    const aprovada = n.status === 'Aprovada' || /aprova/i.test(titulo)
                    const negada = n.status === 'Negada' || /recusa|nega/i.test(titulo)

                    return (
                      <article key={`${n.source}-${n.id}`} className={`px-4 py-5 md:px-6 md:py-6 ${!n.is_read ? 'bg-[#f8f6ef]' : 'bg-[#fbfaf6]'}`}>
                        <div className="flex items-start gap-4">
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            aprovada
                              ? 'bg-[#e1eee7] text-[#1d684f]'
                              : negada
                                ? 'bg-[#f4e2de] text-[#a3423d]'
                                : 'bg-[#e4ece7] text-[#1d5143]'
                          }`}>
                            {n.source === 'mensagem' ? <MessageCircle size={19} /> : aprovada ? <Check size={19} /> : <AlertCircle size={19} />}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-base font-bold text-[#263a32]">{titulo.replace(/^[^\p{L}\p{N}]+/u, '')}</h2>
                                  {!n.is_read && <span className="rounded-full bg-[#d8b575] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#49391f]">Novo</span>}
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[#66736d]">
                                  {n.source === 'mensagem' ? n.mensagem : (
                                    <>Seu pedido para a aula de <strong>{new Date(n.nova_data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às {n.novo_horario_inicio?.slice(0, 5)}</strong> foi avaliado pela escola.</>
                                  )}
                                </p>
                              </div>
                              <time className="shrink-0 text-xs font-medium text-[#929a95]">
                                {new Date(n.criado_em).toLocaleDateString('pt-BR')} · {new Date(n.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </time>
                            </div>

                            {negada && n.motivo_recusa && (
                              <div className="mt-4 rounded-2xl border border-[#e3d5c7] bg-[#f7f1e8] px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b6741]">Motivo informado</p>
                                <p className="mt-1 text-sm italic leading-6 text-[#5f5548]">“{n.motivo_recusa}”</p>
                              </div>
                            )}

                            {!n.is_read && (
                              <button
                                onClick={() => handleMarcarComoLida(n)}
                                disabled={isSubmitting}
                                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#c9cfc9] bg-white px-4 py-2.5 text-sm font-bold text-[#1d5143] transition hover:border-[#1d5143] disabled:opacity-50"
                              >
                                <Check size={16} />
                                {isSubmitting ? 'Atualizando...' : 'Marcar como lida'}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.section>
        )}

        {!isNotificacaoModalOpen && activePortalTab === 'inicio' && (
          <div className="space-y-6">
            <motion.section variants={itemVariants} className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a17a42]">Seu dia na Lotus</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#17241f] md:text-4xl">
                  Tudo o que importa, em um só lugar.
                </h1>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#63716b]">
                Acompanhe aulas, cobranças, anotações e materiais sem precisar procurar em várias telas.
              </p>
            </motion.section>

            {solicitacaoPendente && (
              <motion.button
                variants={itemVariants}
                onClick={() => setActivePortalTab('agenda')}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#dfc896] bg-[#fff8e7] p-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ead7a8] text-[#6d532e]">
                    <Clock3 size={19} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-[#604c2e]">Solicitação em análise</span>
                    <span className="mt-0.5 block text-sm text-[#7d6948]">
                      {solicitacaoPendente.tipo_mudanca === 'Fixa'
                        ? `Novo fixo: ${solicitacaoPendente.novo_dia}, às ${solicitacaoPendente.novo_horario_inicio?.slice(0, 5)}`
                        : `${new Date(solicitacaoPendente.nova_data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às ${solicitacaoPendente.novo_horario_inicio?.slice(0, 5)}`}
                    </span>
                  </span>
                </span>
                <ChevronRight size={19} className="shrink-0 text-[#8c744e]" />
              </motion.button>
            )}

            <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <motion.section variants={itemVariants} className="overflow-hidden rounded-[28px] bg-[#173f35] text-white shadow-[0_18px_45px_rgba(23,63,53,0.15)]">
                <div className="border-b border-white/10 px-5 py-4 md:px-7">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white/75">
                      <CalendarDays size={18} />
                      Próxima aula
                    </p>
                    {proximaAula?.is_reposicao && (
                      <span className="rounded-full bg-[#d8b575] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#173f35]">Reposição</span>
                    )}
                    {proximaAula?.is_remarcacao && (
                      <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Horário aprovado</span>
                    )}
                  </div>
                </div>

                {proximaAula ? (
                  <div className="px-5 py-6 md:px-7 md:py-7">
                    <p className="text-sm font-medium capitalize text-[#d8b575]">{proximaAula.dataFormatada}</p>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
                      <div>
                        <p className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
                          {proximaAula.horario_inicio?.slice(0, 5)}
                          <span className="ml-2 text-xl font-normal text-white/50 md:text-2xl">— {proximaAula.horario_fim?.slice(0, 5)}</span>
                        </p>
                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
                          <span className="flex items-center gap-2"><Music2 size={16} />{proximaAula.instrumento_aula || 'Aula de música'}</span>
                          <span className="flex items-center gap-2"><UserRound size={16} />Prof. {proximaAula.professor_nome || 'A definir'}</span>
                          <span className="flex items-center gap-2"><MapPin size={16} />{proximaAula.sala?.nome || 'Lotus Music'}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {proximaAula.podeSolicitarMudanca && (
                          <button
                            onClick={() => abrirModalReagendamento(tipoSolicitacaoMudanca, proximaAula, proximaAula.dataBaseString)}
                            className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
                          >
                            <RotateCcw size={16} />
                            Solicitar mudança
                          </button>
                        )}
                        <button onClick={() => setActivePortalTab('agenda')} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#173f35] transition hover:bg-[#f0eee7]">
                          Ver agenda
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-7 py-10">
                    <p className="text-lg font-semibold">Nenhuma aula agendada</p>
                    <p className="mt-1 text-sm text-white/60">Quando uma aula for marcada, ela aparecerá aqui.</p>
                  </div>
                )}
              </motion.section>

              <motion.button
                variants={itemVariants}
                onClick={() => setActivePortalTab('financeiro')}
                className="rounded-[28px] border border-[#d9d5ca] bg-[#fbfaf6] p-5 text-left shadow-[0_14px_35px_rgba(39,50,45,0.07)] md:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e4ece7] text-[#1d5143]">
                    <WalletCards size={21} />
                  </span>
                  <span className="rounded-full border border-[#d8d4c9] px-3 py-1 text-[11px] font-bold text-[#5f6d67]">
                    {getBillingModelLabel(modeloFaturamentoPortal)}
                  </span>
                </div>
                <div className="mt-8">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8b938f]">
                    {modeloFaturamentoPortal === 'CREDITOS'
                      ? 'Saldo disponível'
                      : modeloFaturamentoPortal === 'MENSAL_FECHADO'
                        ? (faturaEmAberto ? 'Fatura atual' : 'Parcial do mês')
                        : (resumoFinanceiroPortal.open.length === 0 ? 'Financeiro em dia' : 'Total em aberto')}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#17241f]">
                    {modeloFaturamentoPortal === 'CREDITOS' ? `${saldoCreditosFaturamento} crédito${saldoCreditosFaturamento === 1 ? '' : 's'}` : formatCurrencyBR(valorResumoFinanceiro)}
                  </p>
                  <p className="mt-3 text-sm leading-5 text-[#66736d]">
                    {modeloFaturamentoPortal === 'CREDITOS'
                      ? (saldoCreditosFaturamento > 0 ? 'Você paga novamente quando os créditos acabarem.' : 'Seu pacote precisa ser renovado.')
                      : modeloFaturamentoPortal === 'MENSAL_FECHADO'
                        ? (faturaEmAberto ? `${faturaAtual.quantidade_aulas || 0} aula(s) incluída(s) nesta fatura.` : `${apuracaoMes.aulas} aula(s) realizada(s) neste mês.`)
                        : (resumoFinanceiroPortal.open.length === 0 ? 'Nenhuma mensalidade pendente.' : `${resumoFinanceiroPortal.open.length} mensalidade(s) aguardando pagamento.`)}
                  </p>
                </div>
                <span className="mt-6 flex items-center gap-1 text-sm font-bold text-[#1d5143]">
                  Abrir financeiro <ChevronRight size={17} />
                </span>
              </motion.button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <motion.section variants={itemVariants} className="rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]">
                <div className="flex items-center justify-between border-b border-[#e4e0d7] px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold">Diário recente</h2>
                    <p className="text-sm text-[#748079]">Presenças e anotações das últimas aulas.</p>
                  </div>
                  <button onClick={() => setActivePortalTab('estudos')} className="text-sm font-bold text-[#1d5143]">Ver tudo</button>
                </div>
                <div className="divide-y divide-[#e8e4dc] px-5">
                  {historico.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#748079]">Nenhum registro de aula ainda.</p>
                  ) : historico.slice(0, 3).map(h => {
                    const concluida = h.status === 'Realizada' || h.status === 'Reposição'
                    return (
                      <button key={h.id} onClick={() => abrirDetalhesAula(h)} className="flex w-full items-center gap-3 py-4 text-left">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${concluida ? 'bg-[#e2eee8] text-[#1d684f]' : 'bg-[#f7e6e2] text-[#a3423d]'}`}>
                          {concluida ? <Check size={17} /> : <AlertCircle size={17} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{new Date(h.data_aula).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                          <span className="mt-0.5 block truncate text-sm text-[#748079]">{h.observacoes || h.status}</span>
                        </span>
                        <ChevronRight size={17} className="text-[#a8aea9]" />
                      </button>
                    )
                  })}
                </div>
              </motion.section>

              <motion.section variants={itemVariants} className="rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]">
                <div className="flex items-center justify-between border-b border-[#e4e0d7] px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold">Materiais para estudar</h2>
                    <p className="text-sm text-[#748079]">Arquivos enviados pela escola.</p>
                  </div>
                  <button onClick={() => setActivePortalTab('estudos')} className="text-sm font-bold text-[#1d5143]">Ver tudo</button>
                </div>
                <div className="divide-y divide-[#e8e4dc] px-5">
                  {materiais.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#748079]">Nenhum material disponível.</p>
                  ) : materiais.slice(0, 3).map(material => (
                    <a key={material.id} href={material.url_arquivo} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eee9dc] text-[#88652f]">
                        {String(material.tipo_arquivo).includes('pdf') ? <FileText size={17} /> : <Music2 size={17} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{material.nome_arquivo}</span>
                        <span className="mt-0.5 block text-sm text-[#748079]">{new Date(material.data_envio).toLocaleDateString('pt-BR')}</span>
                      </span>
                      <Download size={17} className="text-[#1d5143]" />
                    </a>
                  ))}
                </div>
              </motion.section>
            </div>
          </div>
        )}

        {!isNotificacaoModalOpen && activePortalTab === 'agenda' && (
          <motion.div variants={itemVariants} className="space-y-5">
            <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a17a42]">Agenda</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Suas próximas aulas</h1>
                <p className="mt-2 text-sm text-[#66736d]">Horários, professores e locais organizados em uma linha do tempo.</p>
              </div>
              {modeloFaturamentoPortal === 'VENCIMENTO_FIXO' && creditos > 0 && !solicitacaoPendente && (
                <button
                  onClick={() => aulaBaseReposicao ? abrirModalReagendamento('Reposição', { ...aulaBaseReposicao, usando_credito: true }) : alert('Nenhuma aula fixa encontrada para basear a reposição.')}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#1d5143] px-5 py-3 text-sm font-bold text-white"
                >
                  <RotateCcw size={17} />
                  Usar {creditos === 1 ? 'crédito' : `um dos ${creditos} créditos`}
                </button>
              )}
            </section>

            <section className="rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6] p-4 md:p-5">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eee9dc] text-[#88652f]">
                  <FileText size={17} />
                </span>
                <div>
                  <p className="text-sm font-bold">
                    Você pode solicitar outra data ou horário
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#68756f]">
                    {modeloFaturamentoPortal === 'CREDITOS'
                      ? 'Envie o pedido com pelo menos 6 horas de antecedência. Se a escola aprovar, a aula muda de horário sem criar um crédito de reposição.'
                      : modeloFaturamentoPortal === 'MENSAL_FECHADO'
                        ? 'Envie o pedido com pelo menos 6 horas de antecedência. A aula só muda depois da aprovação e apenas as aulas realizadas entram na fatura.'
                        : 'Envie o pedido com pelo menos 6 horas de antecedência. Quando aprovado, o fluxo usa a regra de reposição do seu plano, válida por 30 dias.'}
                  </p>
                </div>
              </div>
            </section>

            {solicitacaoPendente && (
              <section className="rounded-[24px] border border-[#dfc896] bg-[#fff8e7] p-5">
                <p className="text-sm font-bold text-[#604c2e]">
                  {solicitacaoPendente.tipo_mudanca === 'Fixa' ? 'Mudança de horário fixo em análise' : 'Remarcação em análise'}
                </p>
                <p className="mt-1 text-sm text-[#7d6948]">
                  {solicitacaoPendente.tipo_mudanca === 'Fixa'
                    ? `A escola está avaliando a mudança para ${solicitacaoPendente.novo_dia}, das ${solicitacaoPendente.novo_horario_inicio?.slice(0, 5)} às ${solicitacaoPendente.novo_horario_fim?.slice(0, 5)}.`
                    : `A escola está avaliando a nova aula em ${new Date(solicitacaoPendente.nova_data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}, às ${solicitacaoPendente.novo_horario_inicio?.slice(0, 5)}.`}
                </p>
              </section>
            )}

            <section className="overflow-hidden rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]">
              {aulasComData.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <CalendarDays size={28} className="mx-auto text-[#9da59f]" />
                  <p className="mt-3 font-bold">Nenhuma aula agendada</p>
                  <p className="mt-1 text-sm text-[#748079]">Seus próximos compromissos aparecerão aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#e4e0d7]">
                  {aulasComData.map((aula, index) => (
                    <div key={aula.id} className={`grid gap-4 px-5 py-5 md:grid-cols-[140px_1fr_auto] md:items-center md:px-6 ${aula.isDesmarcada ? 'bg-[#fbf4f1]' : ''}`}>
                      <div className="flex items-center gap-3 md:block">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold md:mb-2 ${index === 0 ? 'bg-[#1d5143] text-white' : 'bg-[#e8e5dc] text-[#596861]'}`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold capitalize">{aula.dataFormatada}</p>
                          {aula.is_reposicao && <p className="mt-0.5 text-xs font-bold text-[#9a743d]">Aula de reposição</p>}
                          {aula.is_remarcacao && <p className="mt-0.5 text-xs font-bold text-[#1d684f]">Mudança aprovada</p>}
                          {aula.is_turma && <p className="mt-0.5 text-xs font-bold text-[#1d684f]">{aula.turma_nome}</p>}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <Clock3 size={18} className="text-[#1d5143]" />
                          {aula.horario_inicio?.slice(0, 5)} — {aula.horario_fim?.slice(0, 5)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#68756f]">
                          <span>{aula.instrumento_aula || 'Aula de música'}</span>
                          <span>Prof. {aula.professor_nome || 'A definir'}</span>
                          <span>{aula.sala?.nome || 'Lotus Music'}</span>
                        </div>
                      </div>
                      <div>
                        {aula.isDesmarcada ? (
                          <span className="inline-flex rounded-full bg-[#f3ded9] px-3 py-1.5 text-xs font-bold text-[#9d3e39]">Desmarcada</span>
                        ) : aula.podeSolicitarMudanca ? (
                          <button
                            onClick={() => abrirModalReagendamento(tipoSolicitacaoMudanca, aula, aula.dataBaseString)}
                            className="flex items-center gap-2 rounded-full border border-[#cfcabd] bg-white px-4 py-2.5 text-sm font-bold text-[#365248] transition hover:border-[#1d5143]"
                          >
                            <RotateCcw size={16} />
                            Solicitar mudança
                          </button>
                        ) : (
                          <span className="inline-flex rounded-full bg-[#e4ece7] px-3 py-1.5 text-xs font-bold text-[#1d684f]">Agendada</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </motion.div>
        )}

        {!isNotificacaoModalOpen && activePortalTab === 'financeiro' && (
          <motion.div variants={itemVariants} className="space-y-5">
            <section>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a17a42]">Financeiro</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Cobranças sem surpresa</h1>
              <p className="mt-2 text-sm text-[#66736d]">Seu modelo, saldo, faturas e recibos explicados no mesmo lugar.</p>
            </section>

            <section className="overflow-hidden rounded-[28px] bg-[#173f35] text-white shadow-[0_18px_45px_rgba(23,63,53,0.15)]">
              <div className="flex flex-col gap-6 px-5 py-6 md:flex-row md:items-end md:justify-between md:px-8 md:py-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8b575]">{getBillingModelLabel(modeloFaturamentoPortal)}</p>
                  <p className="mt-4 text-sm text-white/65">
                    {modeloFaturamentoPortal === 'CREDITOS'
                      ? 'Créditos disponíveis'
                      : modeloFaturamentoPortal === 'MENSAL_FECHADO'
                        ? (faturaEmAberto ? 'Valor da fatura' : 'Parcial do mês')
                        : 'Total em aberto'}
                  </p>
                  <p className="mt-1 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
                    {modeloFaturamentoPortal === 'CREDITOS' ? saldoCreditosFaturamento : formatCurrencyBR(valorResumoFinanceiro)}
                    {modeloFaturamentoPortal === 'CREDITOS' && <span className="ml-2 text-xl font-normal text-white/55">de 4</span>}
                  </p>
                </div>
                <div className="max-w-md text-sm leading-6 text-white/70">
                  {modeloFaturamentoPortal === 'CREDITOS' && (
                    <p>{saldoCreditosFaturamento > 0 ? 'Cada aula realizada consome um crédito. O próximo pacote só será cobrado quando o saldo acabar.' : 'Seu saldo terminou. Renove o pacote para liberar mais 4 aulas.'}</p>
                  )}
                  {modeloFaturamentoPortal === 'MENSAL_FECHADO' && (
                    <p>{faturaEmAberto ? `Esta fatura reúne ${faturaAtual.quantidade_aulas || 0} aula(s) realizadas. Confira o detalhamento antes de pagar.` : `Você realizou ${apuracaoMes.aulas} aula(s) neste mês. A fatura é fechada no último dia e vence 7 dias depois.`}</p>
                  )}
                  {modeloFaturamentoPortal === 'VENCIMENTO_FIXO' && (
                    <p>{resumoFinanceiroPortal.open.length === 0
                      ? 'Todas as mensalidades estão em dia.'
                      : resumoFinanceiroPortal.overdue.length > 0
                        ? `${resumoFinanceiroPortal.open.length} mensalidade(s) em aberto, sendo ${resumoFinanceiroPortal.overdue.length} vencida(s).`
                        : `${resumoFinanceiroPortal.open.length} mensalidade(s) aguardando pagamento.`}</p>
                  )}
                </div>
              </div>

              {modeloFaturamentoPortal === 'CREDITOS' && (
                <div className="grid grid-cols-4 gap-2 border-t border-white/10 px-5 py-5 md:px-8">
                  {[1, 2, 3, 4].map(indice => (
                    <div key={indice} className={`h-2 rounded-full ${indice <= Math.min(4, Math.max(0, saldoCreditosFaturamento)) ? 'bg-[#d8b575]' : 'bg-white/15'}`} />
                  ))}
                </div>
              )}
              {modeloFaturamentoPortal === 'MENSAL_FECHADO' && (
                <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
                  <div className="px-5 py-4 md:px-8">
                    <p className="text-xs text-white/55">Aulas contabilizadas</p>
                    <p className="mt-1 text-lg font-bold">{faturaEmAberto ? faturaAtual.quantidade_aulas || 0 : apuracaoMes.aulas}</p>
                  </div>
                  <div className="px-5 py-4 md:px-8">
                    <p className="text-xs text-white/55">{faturaEmAberto ? 'Situação' : 'Fechamento'}</p>
                    <p className="mt-1 text-lg font-bold">{faturaEmAberto ? (faturaAtual.status === 'VENCIDO' ? 'Vencida' : 'Aguardando pagamento') : 'Último dia do mês'}</p>
                  </div>
                </div>
              )}
              {modeloFaturamentoPortal === 'VENCIMENTO_FIXO' && (
                <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
                  <div className="px-5 py-4 md:px-8">
                    <p className="text-xs text-white/55">Situação</p>
                    <p className="mt-1 text-lg font-bold">{resumoFinanceiroPortal.open.length === 0 ? 'Em dia' : resumoFinanceiroPortal.overdue.length > 0 ? 'Em atraso' : 'A vencer'}</p>
                  </div>
                  <div className="px-5 py-4 md:px-8">
                    <p className="text-xs text-white/55">Reposições válidas</p>
                    <p className="mt-1 text-lg font-bold">{creditos}</p>
                  </div>
                </div>
              )}
            </section>

            {modeloFaturamentoPortal === 'VENCIMENTO_FIXO' && resumoFinanceiroPortal.open.length > 0 && (
              <section className="overflow-hidden rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]">
                <div className="border-b border-[#e4e0d7] px-5 py-5 md:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Mensalidades em aberto</h2>
                      <p className="mt-1 text-sm text-[#748079]">Histórico unificado com a secretaria da escola.</p>
                    </div>
                    <span className="rounded-full bg-[#fff1ce] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#86601f]">{resumoFinanceiroPortal.open.length}</span>
                  </div>
                </div>
                <div className="divide-y divide-[#e8e4dc]">
                  {resumoFinanceiroPortal.open.map(cobranca => (
                    <div key={cobranca.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center md:px-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-[#263a32]">{cobranca.competenciaLabel}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cobranca.status === 'Atrasado' ? 'bg-[#fde9e7] text-[#a8493c]' : 'bg-[#fff1ce] text-[#86601f]'}`}>{cobranca.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-[#748079]">Vencimento: {cobranca.vencimento}{cobranca.diasAtraso > 0 ? ` · ${cobranca.diasAtraso} dia(s) em atraso` : ''}</p>
                      </div>
                      <p className="text-lg font-bold text-[#1d5143]">{formatCurrencyBR(cobranca.valor)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {modeloFaturamentoPortal === 'VENCIMENTO_FIXO' && creditos > 0 && (
              <section className="flex flex-col justify-between gap-4 rounded-[24px] border border-[#dfc896] bg-[#fff8e7] p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-[#604c2e]">{creditos} {creditos === 1 ? 'reposição disponível' : 'reposições disponíveis'}</p>
                  <p className="mt-1 text-sm text-[#7d6948]">Use dentro do prazo de 30 dias para não perder o crédito.</p>
                </div>
                {!solicitacaoPendente && (
                  <button
                    onClick={() => aulaBaseReposicao ? abrirModalReagendamento('Reposição', { ...aulaBaseReposicao, usando_credito: true }) : alert('Nenhuma aula fixa encontrada para basear a reposição.')}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#604c2e] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <RotateCcw size={16} /> Agendar
                  </button>
                )}
              </section>
            )}

            <section className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
              <div className="rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6] p-5 md:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4ece7] text-[#1d5143]"><CreditCard size={19} /></span>
                  <div>
                    <h2 className="font-bold">Ações financeiras</h2>
                    <p className="text-sm text-[#748079]">Fatura, cobrança e comprovantes.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {faturaAtual && !['SEM_MOVIMENTO', 'CANCELADO'].includes(faturaAtual.status) && (
                    <button onClick={() => window.open(`/faturas/${faturaAtual.id}`, '_blank')} className="flex items-center justify-between rounded-2xl border border-[#d4d0c5] bg-white px-4 py-4 text-left text-sm font-bold text-[#254b40]">
                      <span className="flex items-center gap-2"><FileText size={18} /> Ver fatura</span><ChevronRight size={17} />
                    </button>
                  )}
                  {faturaAtual?.invoice_url && ['PENDENTE', 'VENCIDO'].includes(faturaAtual.status) && (
                    <button onClick={() => window.open(faturaAtual.invoice_url, '_blank')} className="flex items-center justify-between rounded-2xl bg-[#1d5143] px-4 py-4 text-left text-sm font-bold text-white">
                      <span className="flex items-center gap-2"><CreditCard size={18} /> Abrir cobrança</span><ChevronRight size={17} />
                    </button>
                  )}
                  {podeCopiarPix && (
                    <button onClick={copiarPix} className="flex items-center justify-between rounded-2xl bg-[#1d5143] px-4 py-4 text-left text-sm font-bold text-white">
                      <span className="flex items-center gap-2"><WalletCards size={18} /> Copiar PIX</span><ChevronRight size={17} />
                    </button>
                  )}
                  <button onClick={abrirPrestacaoDeContas} className="flex items-center justify-between rounded-2xl border border-[#d4d0c5] bg-white px-4 py-4 text-left text-sm font-bold text-[#254b40]">
                    <span className="flex items-center gap-2"><UploadCloud size={18} /> {isReportPaymentOpen ? 'Fechar envio' : 'Informar pagamento'}</span><ChevronRight size={17} className={isReportPaymentOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
                  </button>
                  <button onClick={() => setIsPayHistoryModalOpen(current => !current)} className="flex items-center justify-between rounded-2xl border border-[#d4d0c5] bg-white px-4 py-4 text-left text-sm font-bold text-[#254b40]">
                    <span className="flex items-center gap-2"><ReceiptText size={18} /> {isPayHistoryModalOpen ? 'Ocultar recibos' : 'Ver recibos'}</span><ChevronRight size={17} className={isPayHistoryModalOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6] p-5 md:p-6">
                <h2 className="font-bold">Últimos pagamentos</h2>
                <div className="mt-3 divide-y divide-[#e4e0d7]">
                  {historicoPagamentos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#748079]">Nenhum pagamento registrado.</p>
                  ) : historicoPagamentos.slice(0, 4).map(pagamento => (
                    <div key={pagamento.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-bold">{new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        <p className="text-xs text-[#748079]">Pagamento confirmado</p>
                      </div>
                      <p className="text-sm font-bold text-[#1d684f]">{formatCurrencyBR(pagamento.valor)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <AnimatePresence initial={false}>
              {isReportPaymentOpen && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]"
                >
                  <div className="border-b border-[#e4e0d7] px-5 py-5 md:px-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4ece7] text-[#1d5143]"><UploadCloud size={19} /></span>
                      <div>
                        <h2 className="font-bold">Informar pagamento</h2>
                        <p className="text-sm text-[#748079]">Envie os dados e, se quiser, uma imagem do comprovante.</p>
                      </div>
                    </div>
                  </div>

                  {pagamentoInformadoPendente ? (
                    <div className="grid gap-4 px-5 py-6 md:grid-cols-[1fr_auto] md:items-center md:px-6">
                      <div>
                        <span className="inline-flex rounded-full bg-[#fff1ce] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#86601f]">Aguardando análise</span>
                        <p className="mt-3 font-bold text-[#263a32]">{formatCurrencyBR(pagamentoInformadoPendente.valor)} informado em {new Date(`${pagamentoInformadoPendente.data_pagamento}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                        <p className="mt-1 text-sm text-[#748079]">O valor ainda não entrou no caixa e não gerou recibo.</p>
                      </div>
                      <ShieldCheck size={30} className="hidden text-[#9a743d] md:block" />
                    </div>
                  ) : (
                    <form onSubmit={handleInformarPagamento} className="p-5 md:p-6">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <label className="text-xs font-bold text-[#53635c]">
                          Valor pago
                          <input required type="number" min="0.01" step="0.01" value={reportedValue} onChange={event => setReportedValue(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d4d0c5] bg-white px-3 text-sm outline-none focus:border-[#1d5143]" />
                        </label>
                        <label className="text-xs font-bold text-[#53635c]">
                          Data do pagamento
                          <input required type="date" value={reportedDate} onChange={event => setReportedDate(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d4d0c5] bg-white px-3 text-sm outline-none focus:border-[#1d5143]" />
                        </label>
                        <label className="text-xs font-bold text-[#53635c]">
                          Forma
                          <select value={reportedMethod} onChange={event => setReportedMethod(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d4d0c5] bg-white px-3 text-sm outline-none focus:border-[#1d5143]">
                            <option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Boleto</option><option>Outro</option>
                          </select>
                        </label>
                        <label className="text-xs font-bold text-[#53635c]">
                          Competência
                          <input required type="month" value={reportedCompetence} onChange={event => {
                            setReportedCompetence(event.target.value)
                            setReportedChargeId('')
                            setReportedInvoiceId('')
                          }} className="mt-2 h-12 w-full rounded-xl border border-[#d4d0c5] bg-white px-3 text-sm outline-none focus:border-[#1d5143]" />
                        </label>
                      </div>

                      {resumoFinanceiroPortal.open.length > 0 && (
                        <label className="mt-4 block text-xs font-bold text-[#53635c]">
                          Mensalidade paga
                          <select value={reportedChargeId} onChange={event => {
                            const chargeId = event.target.value
                            const charge = resumoFinanceiroPortal.open.find(item => item.id === chargeId)
                            setReportedChargeId(chargeId)
                            setReportedInvoiceId(charge?.invoiceId || '')
                            if (charge) {
                              setReportedValue(String(charge.valor || ''))
                              setReportedCompetence(String(charge.competencia).slice(0, 7))
                            }
                          }} className="mt-2 h-12 w-full rounded-xl border border-[#d4d0c5] bg-white px-3 text-sm outline-none focus:border-[#1d5143]">
                            <option value="">Pagamento sem competência vinculada</option>
                            {resumoFinanceiroPortal.open.map(cobranca => (
                              <option key={cobranca.id} value={cobranca.id}>{cobranca.competenciaLabel} · {formatCurrencyBR(cobranca.valor)}</option>
                            ))}
                          </select>
                        </label>
                      )}

                      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
                        <label className="text-xs font-bold text-[#53635c]">
                          Observação (opcional)
                          <textarea value={reportedNotes} onChange={event => setReportedNotes(event.target.value)} placeholder="Ex.: pagamento feito pela conta de outra pessoa." className="mt-2 min-h-28 w-full resize-none rounded-xl border border-[#d4d0c5] bg-white p-3 text-sm outline-none focus:border-[#1d5143]" />
                        </label>
                        <label className="flex min-h-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#bcb6a9] bg-white p-4 text-center">
                          {reportedProofPreview ? (
                            <span className="flex items-center gap-3 text-left">
                              <img src={reportedProofPreview} alt="Prévia do comprovante" className="h-20 w-20 rounded-xl object-cover" />
                              <span>
                                <strong className="block text-sm text-[#263a32]">{reportedProof?.name}</strong>
                                <small className="mt-1 block text-[#748079]">Toque para trocar a imagem</small>
                              </span>
                            </span>
                          ) : (
                            <span>
                              <ImageIcon size={24} className="mx-auto text-[#1d5143]" />
                              <strong className="mt-2 block text-sm text-[#263a32]">Anexar comprovante</strong>
                              <small className="mt-1 block text-[#748079]">Opcional · imagem de até 5 MB</small>
                            </span>
                          )}
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={event => handleReportedProof(event.target.files?.[0])} />
                        </label>
                      </div>

                      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button type="button" onClick={() => { resetReportedPayment(); setIsReportPaymentOpen(false) }} className="rounded-full border border-[#d4d0c5] bg-white px-5 py-3 text-sm font-bold text-[#53635c]">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 rounded-full bg-[#1d5143] px-6 py-3 text-sm font-bold text-white disabled:opacity-60">
                          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          {isSubmitting ? 'Enviando...' : 'Enviar para análise'}
                        </button>
                      </div>
                    </form>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {pagamentosInformados.length > 0 && (
              <section className="overflow-hidden rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]">
                <div className="border-b border-[#e4e0d7] px-5 py-5 md:px-6">
                  <h2 className="font-bold">Pagamentos informados</h2>
                  <p className="mt-1 text-sm text-[#748079]">Acompanhe a conferência feita pela escola.</p>
                </div>
                <div className="divide-y divide-[#e8e4dc]">
                  {pagamentosInformados.slice(0, 6).map(pagamento => (
                    <div key={pagamento.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center md:px-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-[#263a32]">{formatCurrencyBR(pagamento.valor)}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pagamento.status === 'APROVADO' ? 'bg-[#e5f2e9] text-[#1d684f]' : pagamento.status === 'RECUSADO' ? 'bg-[#fde9e7] text-[#a8493c]' : 'bg-[#fff1ce] text-[#86601f]'}`}>
                            {pagamento.status === 'APROVADO' ? 'Aprovado' : pagamento.status === 'RECUSADO' ? 'Precisa corrigir' : 'Em análise'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#748079]">{new Date(`${pagamento.data_pagamento}T12:00:00`).toLocaleDateString('pt-BR')} · {pagamento.metodo_pagamento}{pagamento.comprovante_path ? ' · Imagem anexada' : ''}</p>
                        {pagamento.motivo_analise && <p className="mt-2 text-sm font-medium text-[#9b493e]">Motivo: {pagamento.motivo_analise}</p>}
                      </div>
                      <span className="text-xs font-bold text-[#748079]">{pagamento.status === 'APROVADO' ? 'Recibo liberado' : pagamento.status === 'RECUSADO' ? 'Envie novamente' : 'Aguardando escola'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <AnimatePresence initial={false}>
              {isPayHistoryModalOpen && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]"
                >
                  <div className="flex flex-col gap-4 border-b border-[#e4e0d7] px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4ece7] text-[#1d5143]"><ReceiptText size={19} /></span>
                      <div>
                        <h2 className="font-bold">Recibos confirmados</h2>
                        <p className="text-sm text-[#748079]">Somente valores efetivamente recebidos geram recibo.</p>
                      </div>
                    </div>
                    <button
                      onClick={baixarTodosRecibos}
                      disabled={historicoPagamentos.length === 0}
                      className="flex items-center justify-center gap-2 rounded-full border border-[#d4d0c5] bg-white px-4 py-2.5 text-sm font-bold text-[#254b40] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={16} /> Baixar todos em PDF
                    </button>
                  </div>

                  {historicoPagamentos.length === 0 ? (
                    <div className="px-5 py-12 text-center md:px-6">
                      <ShieldCheck size={28} className="mx-auto text-[#9ba69f]" />
                      <p className="mt-3 font-bold text-[#354a41]">Nenhum recibo disponível</p>
                      <p className="mx-auto mt-1 max-w-md text-sm text-[#748079]">Quando a escola confirmar um pagamento, o recibo aparecerá automaticamente aqui.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#e8e4dc]">
                      {historicoPagamentos.map(pagamento => (
                        <div key={pagamento.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center md:px-6">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-[#263a32]">Recibo de {new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                              <span className="rounded-full bg-[#e4ece7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1d684f]">Confirmado</span>
                            </div>
                            <p className="mt-1 truncate text-sm text-[#748079]">
                              {pagamento.metodo_pagamento || 'Forma não informada'}
                              {pagamento.fatura?.numero ? ` · FAT-${String(pagamento.fatura.numero).padStart(6, '0')}` : ' · Pagamento avulso'}
                            </p>
                          </div>
                          <p className="text-lg font-bold text-[#1d5143]">{formatCurrencyBR(pagamento.valor)}</p>
                          <button
                            onClick={() => baixarRecibo(pagamento)}
                            className="flex items-center justify-center gap-2 rounded-full bg-[#1d5143] px-4 py-2.5 text-sm font-bold text-white"
                          >
                            <Download size={15} /> PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {!isNotificacaoModalOpen && activePortalTab === 'estudos' && (
          <motion.div variants={itemVariants} className="space-y-5">
            <section>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a17a42]">Estudos</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Continue de onde parou</h1>
              <p className="mt-2 text-sm text-[#66736d]">Revise o diário das aulas e acesse os materiais compartilhados.</p>
            </section>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="overflow-hidden rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]">
                <div className="border-b border-[#e4e0d7] px-5 py-5 md:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4ece7] text-[#1d5143]"><BookOpen size={19} /></span>
                    <div>
                      <h2 className="text-lg font-bold">Diário de aulas</h2>
                      <p className="text-sm text-[#748079]">Toque em uma aula para ler as anotações.</p>
                    </div>
                  </div>
                </div>
                <div className="max-h-[560px] divide-y divide-[#e8e4dc] overflow-y-auto px-5">
                  {historico.length === 0 ? (
                    <p className="py-12 text-center text-sm text-[#748079]">Nenhum registro de aula.</p>
                  ) : historico.map(h => {
                    const concluida = h.status === 'Realizada' || h.status === 'Reposição'
                    const ajuste = h.status === 'Ajuste de Saldo'
                    return (
                      <button key={h.id} onClick={() => abrirDetalhesAula(h)} className="flex w-full items-center gap-4 py-4 text-left">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${concluida ? 'bg-[#e2eee8] text-[#1d684f]' : ajuste ? 'bg-[#e9e9e5] text-[#65716b]' : 'bg-[#f7e6e2] text-[#a3423d]'}`}>
                          {concluida ? <Check size={18} /> : <AlertCircle size={18} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{new Date(h.data_aula).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                          <span className="mt-0.5 block truncate text-sm text-[#748079]">{h.observacoes || h.status}</span>
                        </span>
                        <span className="rounded-full bg-[#eeece5] px-2.5 py-1 text-[11px] font-bold text-[#65716b]">{h.status}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="overflow-hidden rounded-[24px] border border-[#d9d5ca] bg-[#fbfaf6]">
                <div className="border-b border-[#e4e0d7] px-5 py-5 md:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eee9dc] text-[#88652f]"><FolderOpen size={19} /></span>
                    <div>
                      <h2 className="text-lg font-bold">Materiais</h2>
                      <p className="text-sm text-[#748079]">{materiais.length} arquivo(s) disponível(is).</p>
                    </div>
                  </div>
                </div>
                <div className="max-h-[560px] divide-y divide-[#e8e4dc] overflow-y-auto px-5">
                  {materiais.length === 0 ? (
                    <div className="py-12 text-center">
                      <FolderOpen size={27} className="mx-auto text-[#9da59f]" />
                      <p className="mt-3 text-sm font-bold">Nenhum material disponível</p>
                      <p className="mt-1 text-sm text-[#748079]">Os arquivos enviados pela escola aparecerão aqui.</p>
                    </div>
                  ) : materiais.map(material => (
                    <a key={material.id} href={material.url_arquivo} target="_blank" rel="noreferrer" download className="flex items-center gap-4 py-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eee9dc] text-[#88652f]">
                        {String(material.tipo_arquivo).includes('pdf') ? <FileText size={18} /> : <Music2 size={18} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{material.nome_arquivo}</span>
                        <span className="mt-0.5 block text-sm text-[#748079]">Enviado em {new Date(material.data_envio).toLocaleDateString('pt-BR')}</span>
                      </span>
                      <Download size={18} className="shrink-0 text-[#1d5143]" />
                    </a>
                  ))}
                </div>
              </section>
            </div>

            <button onClick={handleSair} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ddc7c4] bg-[#fbf3f1] py-3.5 text-sm font-bold text-[#a3423d] md:hidden">
              <LogOut size={17} /> Sair do portal
            </button>
          </motion.div>
        )}
      </motion.main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d8d4c9] bg-[#fbfaf6]/95 px-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Navegação do portal">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabsPortal.map(tab => {
            const Icone = tab.icon
            const ativo = activePortalTab === tab.id && !isNotificacaoModalOpen
            return (
              <button key={tab.id} onClick={() => {
                setActivePortalTab(tab.id)
                setIsNotificacaoModalOpen(false)
              }} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition ${ativo ? 'bg-[#e4ece7] text-[#1d5143]' : 'text-[#7a8680]'}`}>
                <Icone size={19} strokeWidth={ativo ? 2.2 : 1.8} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* --- MODAIS DE AÇÃO --- */}
      <AnimatePresence>
        {isRescheduleModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10251f]/45 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.97, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 16 }} className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-[#d9d5ca] bg-[#fbfaf6] shadow-[0_24px_70px_rgba(16,37,31,0.28)]">
              <div className="flex items-start justify-between border-b border-[#e1ddd3] px-5 py-5 md:px-6">
                <div>
                  <span className="inline-flex rounded-full bg-[#e4ece7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1d5143]">
                    Sujeito à aprovação
                  </span>
                  <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-[#17241f]">
                    Alterar sua aula
                  </h2>
                  <p className="mt-1 text-sm text-[#68756f]">Escolha o tipo de alteração, a data e o novo horário.</p>
                </div>
                <button onClick={() => setIsRescheduleModalOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d1cdc2] bg-white text-[#68756f] transition hover:border-[#1d5143]" aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5 md:px-6">
                {!aulaParaMudar?.usando_credito && (
                  <>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8b938f]">1. O que deseja alterar?</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={() => {
                          setRescheduleType(tipoSolicitacaoMudanca)
                          setSelectedDateObj(null)
                          setSelectedSlot(null)
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          rescheduleType !== 'Fixa'
                            ? 'border-[#1d5143] bg-[#e4ece7]'
                            : 'border-[#d7d3c8] bg-white hover:border-[#1d5143]'
                        }`}
                      >
                        <CalendarDays size={19} className="text-[#1d5143]" />
                        <span className="mt-3 block text-sm font-bold text-[#263a32]">Remarcar só esta aula</span>
                        <span className="mt-1 block text-xs leading-5 text-[#68756f]">A grade semanal continua igual.</span>
                      </button>
                      <button
                        onClick={() => {
                          setRescheduleType('Fixa')
                          setSelectedDateObj(null)
                          setSelectedSlot(null)
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          rescheduleType === 'Fixa'
                            ? 'border-[#1d5143] bg-[#e4ece7]'
                            : 'border-[#d7d3c8] bg-white hover:border-[#1d5143]'
                        }`}
                      >
                        <Repeat2 size={19} className="text-[#1d5143]" />
                        <span className="mt-3 block text-sm font-bold text-[#263a32]">Mudar horário fixo</span>
                        <span className="mt-1 block text-xs leading-5 text-[#68756f]">Troca o dia e horário de todas as próximas aulas.</span>
                      </button>
                    </div>
                  </>
                )}

                <div className="mt-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8b938f]">
                    {aulaParaMudar?.usando_credito
                      ? '1. Escolha o dia'
                      : rescheduleType === 'Fixa'
                        ? '2. Escolha o dia da nova grade'
                        : '2. Escolha o novo dia'}
                  </p>
                  <div className="rounded-2xl border border-[#dfdbd1] bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <button
                        onClick={() => podeVoltarMes && setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1))}
                        disabled={!podeVoltarMes}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dedad0] text-[#53635c] disabled:opacity-25"
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <p className="text-sm font-bold capitalize text-[#263a32]">
                        {mesCalendario.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </p>
                      <button
                        onClick={() => podeAvancarMes && setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1))}
                        disabled={!podeAvancarMes}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dedad0] text-[#53635c] disabled:opacity-25"
                        aria-label="Próximo mês"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 text-center">
                      {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(diaSemana => (
                        <span key={diaSemana} className="py-1 text-[9px] font-bold tracking-wide text-[#9aa19d]">{diaSemana}</span>
                      ))}
                      {diasGradeCalendario.map(dia => {
                        const selecionado = selectedDateObj?.dataString === dia.dataString
                        const habilitado = Boolean(dia.opcaoPortal)

                        return (
                          <button
                            key={dia.dataString}
                            onClick={() => habilitado && setSelectedDateObj(dia.opcaoPortal)}
                            disabled={!habilitado}
                            className={`relative mx-auto my-0.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                              selecionado
                                ? 'bg-[#1d5143] text-white'
                                : habilitado
                                  ? 'text-[#263a32] hover:bg-[#e4ece7]'
                                  : dia.mesmoMes
                                    ? 'text-[#c3c7c4]'
                                    : 'text-[#e1e3e1]'
                            }`}
                            aria-label={dia.data.toLocaleDateString('pt-BR')}
                          >
                            {dia.data.getDate()}
                            {dia.temDisponibilidade && !selecionado && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#b98b4f]" />}
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2 border-t border-[#eeeae2] pt-3 text-[11px] text-[#7d8882]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#b98b4f]" />
                      Dias com disponibilidade cadastrada
                    </div>
                  </div>
                </div>

                <p className="mb-3 mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#8b938f]">
                  {aulaParaMudar?.usando_credito ? '2. Escolha o horário' : '3. Escolha o horário'}
                </p>
                <div className="min-h-[190px] rounded-2xl border border-[#dfdbd1] bg-[#f4f2eb] p-3">
                  {!selectedDateObj ? (
                    <div className="flex min-h-[164px] flex-col items-center justify-center px-4 text-center">
                      <CalendarDays size={25} className="text-[#8c9892]" />
                      <p className="mt-3 text-sm font-bold text-[#53635c]">Selecione um dia para consultar os horários.</p>
                    </div>
                  ) : diaBloqueadoMsg ? (
                    <div className="flex min-h-[164px] flex-col items-center justify-center px-4 text-center">
                      <AlertCircle size={25} className="text-[#a3423d]" />
                      <p className="mt-3 text-sm font-bold text-[#843b36]">Escola fechada nesta data</p>
                      <p className="mt-1 text-sm text-[#78665e]">{diaBloqueadoMsg}</p>
                    </div>
                  ) : vagasDoDiaSelecionado.length === 0 ? (
                    <div className="flex min-h-[164px] flex-col items-center justify-center px-4 text-center">
                      <Inbox size={25} className="text-[#8c9892]" />
                      <p className="mt-3 text-sm font-bold text-[#53635c]">Nenhum horário livre neste dia.</p>
                    </div>
                  ) : (
                    <div className="max-h-[230px] space-y-2 overflow-y-auto pr-1">
                      {vagasDoDiaSelecionado.map((vaga, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(vaga)}
                          className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                            selectedSlot?.id === vaga.id
                              ? 'border-[#1d5143] bg-[#e4ece7] text-[#173f35]'
                              : 'border-[#d7d3c8] bg-white text-[#53635c] hover:border-[#1d5143]'
                          }`}
                        >
                          <span className="text-sm font-bold">
                            {vaga.hora_inicio.slice(0, 5)} <span className="font-medium opacity-60">— {vaga.hora_fim.slice(0, 5)}</span>
                          </span>
                          {selectedSlot?.id === vaga.id && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1d5143] text-white"><Check size={14} /></span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-[#e4d9c2] bg-[#fff8e7] px-4 py-3 text-sm leading-5 text-[#735b36]">
                  {rescheduleType === 'Fixa'
                    ? 'Depois da aprovação, este passa a ser o novo dia e horário semanal. Você receberá a resposta no sininho.'
                    : 'Somente a aula selecionada será remarcada. Sua grade fixa continua igual e a resposta chegará pelo sininho.'}
                </div>
              </div>

              <div className="flex gap-3 border-t border-[#e1ddd3] px-5 py-4 md:px-6">
                <button onClick={() => setIsRescheduleModalOpen(false)} className="flex-1 rounded-full border border-[#d1cdc2] bg-white py-3 text-sm font-bold text-[#68756f]">Cancelar</button>
                <button onClick={handleSolicitarReagendamento} disabled={!selectedSlot || isSubmitting || diaBloqueadoMsg !== null} className="flex-[1.4] rounded-full bg-[#1d5143] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
                  {isSubmitting ? 'Enviando...' : 'Enviar solicitação'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end md:items-center justify-center p-4 z-[90]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/80 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 drop-shadow-sm"><span>👤</span> Editar Perfil</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="h-10 w-10 bg-white/50 text-slate-500 border border-white/80 rounded-full font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all">✖</button>
              </div>
              <form onSubmit={handleAtualizarPerfil} className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-2">
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <div className="w-20 h-20 rounded-full bg-slate-200 overflow-hidden relative shadow-md">
                       {fotoPreview ? <img src={fotoPreview} alt="Foto de perfil do aluno" className="w-full h-full object-cover"/> : <span className="text-3xl flex items-center justify-center h-full">📷</span>}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) { setEditFotoArquivo(file); setFotoPreview(URL.createObjectURL(file)); }
                    }} className="text-xs text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Nome Completo</label>
                    <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} className="w-full p-3 rounded-xl border border-white/80 bg-white/60 text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white shadow-sm transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Nova Senha (opcional)</label>
                    <input type="password" value={editSenha} onChange={e => setEditSenha(e.target.value)} placeholder="Deixe em branco para não alterar" className="w-full p-3 rounded-xl border border-white/80 bg-white/60 text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white shadow-sm transition-all" />
                  </div>
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isSubmitting} className="w-full mt-4 py-4 bg-slate-800 text-white rounded-2xl font-bold text-sm shadow-xl disabled:opacity-50 hover:bg-slate-700 transition-all">
                    {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                  </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOVO MODAL: DETALHES DA AULA */}
      <AnimatePresence>
        {isClassDetailsModalOpen && selectedClassDetails && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end md:items-center justify-center p-4 z-[90]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/80 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 drop-shadow-sm"><span>📝</span> Resumo da Aula</h2>
                <button onClick={() => setIsClassDetailsModalOpen(false)} className="h-10 w-10 bg-white/50 text-slate-500 border border-white/80 rounded-full font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all">✖</button>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 pb-2">
                  <div className="flex items-center gap-4 mb-6">
                      <div className={`h-14 w-14 rounded-full flex items-center justify-center text-2xl shadow-inner flex-shrink-0 ${selectedClassDetails.status === 'Realizada' || selectedClassDetails.status === 'Reposição' ? 'bg-emerald-50 text-emerald-600' : selectedClassDetails.status === 'Desmarcada' || selectedClassDetails.status === 'Falta' || selectedClassDetails.status === 'Falta Injustificada' ? 'bg-rose-50 text-rose-600' : selectedClassDetails.status === 'Crédito' || selectedClassDetails.status === 'Falta Justificada' ? 'bg-purple-50 text-purple-600' : selectedClassDetails.status === 'Ajuste de Saldo' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600'}`}>
                          {selectedClassDetails.status === 'Realizada' || selectedClassDetails.status === 'Reposição' ? '✓' : selectedClassDetails.status === 'Desmarcada' || selectedClassDetails.status === 'Falta' || selectedClassDetails.status === 'Falta Injustificada' ? '✖' : selectedClassDetails.status === 'Ajuste de Saldo' ? '➖' : '📅'}
                      </div>
                      <div>
                          <p className="font-bold text-xl text-slate-800 tracking-tight">{new Date(selectedClassDetails.data_aula).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                          <p className={`text-sm font-bold mt-0.5 ${selectedClassDetails.status === 'Realizada' || selectedClassDetails.status === 'Reposição' ? 'text-emerald-600' : selectedClassDetails.status === 'Desmarcada' || selectedClassDetails.status === 'Falta' || selectedClassDetails.status === 'Falta Injustificada' ? 'text-rose-600' : selectedClassDetails.status === 'Crédito' || selectedClassDetails.status === 'Falta Justificada' ? 'text-purple-600' : selectedClassDetails.status === 'Ajuste de Saldo' ? 'text-slate-600' : 'text-amber-600'}`}>{selectedClassDetails.status}</p>
                      </div>
                  </div>

                  <div className="bg-white/60 border border-white/80 p-5 rounded-2xl shadow-sm">
                      <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1"><span>✏️</span> Anotações do Professor</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                          {selectedClassDetails.observacoes || "Nenhuma anotação registrada para este lançamento."}
                      </p>
                  </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
