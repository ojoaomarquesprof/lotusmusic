"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

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
  const [statusMensalidade, setStatusMensalidade] = useState({ pago: false, diasRestantes: 0, dataVencimentoStr: '' })
  const [historicoPagamentos, setHistoricoPagamentos] = useState<any[]>([])
  
  const [isPayHistoryModalOpen, setIsPayHistoryModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false)
  const [isNotificacaoModalOpen, setIsNotificacaoModalOpen] = useState(false)
  const [isClassDetailsModalOpen, setIsClassDetailsModalOpen] = useState(false)
  const [selectedClassDetails, setSelectedClassDetails] = useState<any>(null)
  
  const [notificacaoTab, setNotificacaoTab] = useState('NaoLidas') 
  const [todasNotificacoes, setTodasNotificacoes] = useState<any[]>([]) 

  const [editNome, setEditNome] = useState('')
  const [editSenha, setEditSenha] = useState('')
  const [editFotoArquivo, setEditFotoArquivo] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  const [rescheduleType, setRescheduleType] = useState('Pontual') 
  const [solicitacaoPendente, setSolicitacaoPendente] = useState<any>(null)
  
  const [aulaParaMudar, setAulaParaMudar] = useState<any>(null)
  const [proximosDias, setProximosDias] = useState<any[]>([])
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
          const isSameSlot = ag.dia === diaDaSemanaSelecionado && ag.horario_inicio?.slice(0, 5) === vaga.hora_inicio?.slice(0, 5)
          if (!isSameSlot) return false;
          const info = Array.isArray(ag.aluno?.alunos_info) ? ag.aluno?.alunos_info[0] : ag.aluno?.alunos_info;
          if (info?.status === 'Inativo') { if (!info.data_inativacao) return false; if (dataSelecionadaStr >= info.data_inativacao) return false; }
          return true; 
        })
        return !isOcupado
      })
      setVagasDoDiaSelecionado(vagasReais); setSelectedSlot(null)
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

    const { data: config } = await supabase.from('configuracoes').select('nome_escola, logo_url, chave_pix').eq('id', 1).single()
    setEscola(config)

    const { data: ev } = await supabase.from('eventos_calendario').select('*').gte('data_evento', hojeDataStr)
    setEventosGlobais(ev || [])

    const { data: ag } = await supabase.from('agenda').select('*, sala:salas(nome)').eq('aluno_id', session.user.id)
    
    const { data: rep } = await supabase.from('solicitacoes_reagendamento').select('*').eq('aluno_id', session.user.id)
    setTodasReposicoes(rep || [])

    const reposicoesFuturas = (rep || []).filter((r: any) => r.status === 'Aprovada' && r.nova_data >= hojeDataStr)

    let aulasMapeadas = ag || []
    
    if (reposicoesFuturas.length > 0) {
      const repos = reposicoesFuturas.map((r: any) => ({
        id: 'repo_' + r.id,
        id_real: r.id, 
        agenda_original_id: r.agenda_original_id, 
        criado_em: r.criado_em,
        is_reposicao: true,
        dia: r.novo_dia,
        horario_inicio: r.novo_horario_inicio,
        horario_fim: r.novo_horario_fim,
        professor_id: r.professor_id,
        instrumento_aula: 'Reposição',
        nova_data: r.nova_data,
        sala: { nome: 'A Definir' }
      }));
      aulasMapeadas = [...aulasMapeadas, ...repos];
    }

    if (aulasMapeadas.length > 0) {
      const profIds = aulasMapeadas.map((a: any) => a.professor_id).filter(Boolean)
      const { data: profs } = await supabase.from('profiles').select('id, nome_completo').in('id', profIds)
      aulasMapeadas = aulasMapeadas.map((aula: any) => ({ ...aula, professor_nome: profs?.find((p: any) => p.id === aula.professor_id)?.nome_completo || null }))
    }
    
    // Sort so repositions appear below fixed classes if they are in the same week, etc.
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

    // CÁLCULO INTELIGENTE DE CRÉDITOS (Desmarcadas + Créditos Manuais)
    const { data: histAll } = await supabase.from('historico_aulas').select('*').eq('aluno_id', session.user.id).order('data_aula', { ascending: false }).limit(200)
    const qtdDesmarcadas = (histAll || []).filter(h => h.status === 'Desmarcada' || h.status === 'Crédito').length;
    const qtdUsadas = (rep || []).filter((r: any) => r.status !== 'Negada').length; // Pedidos pendentes ou aprovados consomem crédito
    setCreditos(Math.max(0, qtdDesmarcadas - qtdUsadas));

    const { data: allPgs } = await supabase.from('pagamentos').select('*').eq('aluno_id', session.user.id).order('data_pagamento', { ascending: false })
    setHistoricoPagamentos(allPgs || [])

    const info = Array.isArray(perfil?.alunos_info) ? perfil?.alunos_info[0] : perfil?.alunos_info
    const diaVenc = info?.data_vencimento || 10
    const hoje = new Date(); const ano = hoje.getFullYear(); const mes = hoje.getMonth()
    const getDataVenc = (a: number, m: number, d: number) => { const ultimo = new Date(a, m + 1, 0).getDate(); return new Date(a, m, Math.min(d, ultimo)) }
    const { data: pgsMes } = await supabase.from('pagamentos').select('id').eq('aluno_id', session.user.id).gte('data_pagamento', new Date(ano, mes, 1).toISOString()).lte('data_pagamento', new Date(ano, mes + 1, 0, 23, 59).toISOString())
    const pago: boolean = Boolean(pgsMes && pgsMes.length > 0)
    const hojeSoDia = new Date(ano, mes, hoje.getDate())
    const vencAlvo = pago ? getDataVenc(ano, mes + 1, diaVenc) : getDataVenc(ano, mes, diaVenc)
    const diff = Math.ceil((vencAlvo.getTime() - hojeSoDia.getTime()) / (1000 * 60 * 60 * 24))
    setStatusMensalidade({ pago, diasRestantes: diff, dataVencimentoStr: vencAlvo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })
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
    setSelectedDateObj(null); setSelectedSlot(null); setDiaBloqueadoMsg(null); setIsRescheduleModalOpen(true);
    const { data: disp } = await supabase.from('disponibilidade_professor').select('*').eq('professor_id', aula.professor_id)
    const { data: ag } = await supabase.from('agenda').select(`dia, horario_inicio, aluno:profiles!aluno_id(alunos_info(status, data_inativacao))`).eq('professor_id', aula.professor_id)
    setDispBrutaProf(disp || []); setAgendaBrutaProf(ag || [])
  }

  const handleSolicitarReagendamento = async () => {
    if (!selectedSlot || !selectedDateObj) return
    setIsSubmitting(true)
    
    let idAgendaPai = aulaParaMudar.agenda_original_id;
    if (!idAgendaPai) {
      idAgendaPai = String(aulaParaMudar.id).startsWith('repo_') ? null : aulaParaMudar.id;
    }

    // Só desmarca a aula se NÃO estiver usando um crédito passado
    if (!aulaParaMudar.is_reposicao && !aulaParaMudar.usando_credito) {
        const dStr = aulaParaMudar.data_original_desmarcada || new Date().toISOString().split('T')[0]; 
        await supabase.from('historico_aulas').delete().eq('aluno_id', aluno.id).eq('data_aula', dStr);
        await supabase.from('historico_aulas').insert([{
            aluno_id: aluno.id,
            data_aula: dStr,
            status: 'Desmarcada',
            observacoes: 'Aluno solicitou reagendamento'
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
    const hoje = new Date(); const diaAlvo = mapa[diaStr]; if (diaAlvo === undefined) return '--'
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
  
  const notificacoesNaoLidas = todasNotificacoes.filter(n => !n.is_read)
  const notificacoesLidas = todasNotificacoes.filter(n => n.is_read)
  const notificacoesExibidas = notificacaoTab === 'NaoLidas' ? notificacoesNaoLidas : notificacoesLidas

  return (
    <div className={`min-h-screen text-slate-800 font-sans pb-20 bg-slate-50 relative overflow-hidden z-0`}>
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-20%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-indigo-300/30 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-cyan-300/30 blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute bottom-[-10%] left-[20%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] rounded-full bg-amber-300/20 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      <header className={`bg-white/40 backdrop-blur-2xl p-6 rounded-b-[2.5rem] border-b border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] sticky top-0 z-40`}>
        <div className="flex justify-between items-center mb-6">
          {escola?.logo_url ? <img src={escola.logo_url} className="h-8 max-w-[120px] object-contain drop-shadow-sm" /> : <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">{escola?.nome_escola || 'Escola'}</h1>}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer w-fit group" onClick={() => setIsProfileModalOpen(true)}>
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-indigo-500/20 overflow-hidden relative border-2 border-white">
              {aluno?.avatar_url ? <img src={aluno.avatar_url} className="w-full h-full object-cover" /> : aluno?.nome_completo?.charAt(0)}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">✏️</div>
            </div>
            <div>
              <p className={`text-slate-500 text-xs font-semibold`}>Olá,</p>
              <h2 className="text-2xl font-bold leading-tight text-slate-800 tracking-tight">{aluno?.nome_completo?.split(' ')[0]}</h2>
            </div>
          </div>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setIsNotificacaoModalOpen(true); setNotificacaoTab(notificacoesNaoLidas.length > 0 ? 'NaoLidas' : 'Lidas'); }} className="relative h-12 w-12 rounded-full bg-white/60 backdrop-blur-md border border-white/80 shadow-sm flex items-center justify-center hover:bg-white text-slate-600 transition-all">
            <span className="text-xl drop-shadow-sm">🔔</span>
            {notificacoesNaoLidas.length > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">{notificacoesNaoLidas.length}</span>}
          </motion.button>
        </div>
      </header>

      <motion.main variants={containerVariants} initial="hidden" animate="show" className="p-4 md:p-5 max-w-md mx-auto space-y-6 mt-2 relative z-10">
        
        {solicitacaoPendente && (
          <motion.div variants={itemVariants} className="bg-gradient-to-r from-amber-400 to-orange-400 p-[1px] rounded-3xl shadow-lg shadow-amber-500/20 animate-pulse">
            <div className="bg-white/90 backdrop-blur-md rounded-[23px] p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-xl shadow-inner flex-shrink-0">⏳</div>
              <div>
                <p className="font-bold text-sm text-amber-700 tracking-tight">Análise Pendente</p>
                <p className="text-xs font-medium text-slate-600 leading-tight mt-0.5">Pedido para <span className="font-bold">{new Date(solicitacaoPendente.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'})} ({solicitacaoPendente.novo_dia})</span> às {solicitacaoPendente.novo_horario_inicio?.slice(0,5)}.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- BANNER DE CRÉDITOS --- */}
        {creditos > 0 && !solicitacaoPendente && (
          <motion.div variants={itemVariants} className="bg-gradient-to-r from-indigo-500 to-cyan-500 p-[1px] rounded-[2rem] shadow-lg mb-6">
            <div className="bg-white/10 backdrop-blur-md rounded-[31px] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                 <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-2xl shadow-inner border border-white/30 text-white">🌟</div>
                 <div>
                    <h3 className="text-white font-bold text-lg leading-tight">Você tem {creditos} {creditos === 1 ? 'aula' : 'aulas'} para repor!</h3>
                    <p className="text-white/80 text-xs font-medium mt-1">Escolha um horário e agende sua reposição.</p>
                 </div>
               </div>
               <motion.button 
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => {
                     const aulaBase = aulas.find(a => !a.is_reposicao);
                     if(aulaBase) abrirModalReagendamento('Reposição', { ...aulaBase, usando_credito: true });
                     else alert('Nenhuma aula fixa encontrada para basear a reposição.');
                  }}
                  className="w-full md:w-auto px-6 py-3 bg-white text-indigo-600 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all"
               >
                  Agendar Reposição
               </motion.button>
            </div>
          </motion.div>
        )}

        <motion.section variants={itemVariants}>
          <h3 className="text-sm font-semibold text-slate-500 mb-3 ml-2 flex items-center gap-2 drop-shadow-sm"><span className="text-lg">🎯</span> Sua Próxima Aula</h3>
          {aulas.length === 0 ? (
            <div className="p-8 rounded-[2rem] border border-dashed border-slate-300 bg-white/40 backdrop-blur-md text-center shadow-sm"><p className="text-sm font-medium text-slate-500">Nenhuma aula agendada.</p></div>
          ) : (
            aulas.map(aula => {
              let dadosData;
              
              if (aula.is_reposicao) {
                 const [a, m, d] = aula.nova_data.split('-');
                 const dateObj = new Date(parseInt(a), parseInt(m)-1, parseInt(d));
                 const displayStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
                 const formatada = displayStr.charAt(0).toUpperCase() + displayStr.slice(1)
                 dadosData = { dataFormatada: formatada + ' (Reposição)', dataBaseString: aula.nova_data }
              } else {
                 dadosData = calcularDataProximaAula(aula.dia, aula.horario_inicio);
              }
              
              const statusAteProxima = historico.find(h => h.data_aula === dadosData.dataBaseString)?.status;
              const isDesmarcada = statusAteProxima === 'Desmarcada';

              const canRescheduleInTime = checkCanReschedule(dadosData.dataBaseString, aula.horario_inicio);
              
              // Se a aula já for reposição ou já foi cancelada (Desmarcada), escondemos o botão.
              const deveMostrarBotaoReagendar = !solicitacaoPendente && !isDesmarcada && canRescheduleInTime && !aula.is_reposicao;

              return (
                <motion.div whileHover={{ y: -4 }} key={aula.id} className={`bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border relative overflow-hidden group mb-4 transition-all ${isDesmarcada ? 'border-rose-400 opacity-90' : aula.is_reposicao ? 'border-amber-400' : 'border-white/60'}`}>
                  {isDesmarcada ? (
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl pointer-events-none"></div>
                  ) : aula.is_reposicao ? (
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>
                  ) : (
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-300/20 rounded-full blur-2xl pointer-events-none"></div>
                  )}
                  
                  <div className={`inline-block border px-3 py-1 rounded-xl font-bold text-xs mb-4 shadow-sm ${isDesmarcada ? 'bg-rose-100 text-rose-800 border-rose-200' : aula.is_reposicao ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'}`}>
                    {dadosData.dataFormatada}
                  </div>
                  
                  <div className="flex justify-between items-end mb-6 relative z-10">
                    <div>
                      <p className={`font-bold text-3xl tracking-tight leading-none mb-1 ${isDesmarcada ? 'text-rose-800 line-through opacity-70' : 'text-slate-800'}`}>
                        {aula.horario_inicio.slice(0,5)} <span className="text-slate-400 text-xl font-medium">- {aula.horario_fim.slice(0,5)}</span>
                      </p>
                      <p className={`text-xs font-semibold flex items-center gap-1 mt-2 ${isDesmarcada ? 'text-rose-600' : 'text-slate-600'}`}>
                        <span className="bg-white/80 shadow-sm p-1 rounded-md text-sm">🎤</span> {aula.instrumento_aula}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Professor</p>
                      <p className="font-bold text-sm text-indigo-700 bg-indigo-50/80 border border-indigo-100 px-2 py-1 rounded-lg mt-1 shadow-sm">{aula.professor_nome ? aula.professor_nome.split(' ')[0] : '--'}</p>
                    </div>
                  </div>
                  
                  {deveMostrarBotaoReagendar && (
                    <motion.button 
                      whileTap={{ scale: 0.98 }} 
                      onClick={() => {
                        abrirModalReagendamento('Reposição', aula, dadosData.dataBaseString)
                      }} 
                      className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 bg-white/60 border border-white/80 text-slate-700 hover:bg-white`}
                    >
                      <span>📅</span> Desmarcar e Reagendar
                    </motion.button>
                  )}
                </motion.div>
              )
            })
          )}
        </motion.section>

        <motion.section variants={itemVariants}>
          <h3 className="text-sm font-semibold text-slate-500 mb-3 ml-2 flex items-center gap-2 drop-shadow-sm"><span className="text-lg">💳</span> Painel Financeiro</h3>
          <div className="bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 relative overflow-hidden">
            {statusMensalidade.pago ? (
              <div className="bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/50 p-4 rounded-2xl mb-6 flex items-center gap-4 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md flex-shrink-0">✓</div>
                <div><p className="font-bold text-sm text-emerald-800 tracking-tight">Mensalidade Paga</p><p className="text-xs font-medium text-emerald-600 mt-0.5">Tudo certo. Próxima: {statusMensalidade.dataVencimentoStr}</p></div>
              </div>
            ) : statusMensalidade.diasRestantes < 0 ? (
              <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-200/50 p-4 rounded-2xl mb-6 flex items-center gap-4 shadow-sm animate-pulse">
                <div className="h-12 w-12 rounded-full bg-rose-500 text-white flex items-center justify-center text-xl shadow-md flex-shrink-0">!</div>
                <div><p className="font-bold text-sm text-rose-800 tracking-tight">Em Atraso</p><p className="text-xs font-medium text-rose-600 mt-0.5">Venceu dia {statusMensalidade.dataVencimentoStr}.</p></div>
              </div>
            ) : (
              <div className="bg-indigo-50/80 backdrop-blur-sm border border-indigo-200/50 p-4 rounded-2xl mb-6 flex items-center gap-4 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xl shadow-md flex-shrink-0">📅</div>
                <div><p className="font-bold text-sm text-indigo-800 tracking-tight">Vence dia {statusMensalidade.dataVencimentoStr}</p><p className="text-xs font-medium text-indigo-600 mt-0.5">Faltam {statusMensalidade.diasRestantes} dias.</p></div>
              </div>
            )}
            
            <div className="flex justify-between items-end mb-6 bg-white/40 border border-white/60 p-4 rounded-2xl shadow-inner">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Valor Vigente</p>
                <p className="text-3xl font-bold tracking-tight text-slate-800 leading-none">R$ {infoFinanceira?.valor_mensalidade || '0,00'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-semibold mb-1">Vencimento</p>
                <p className="font-bold text-sm text-slate-700 bg-white/80 px-2 py-1 rounded-lg shadow-sm border border-white">Dia {infoFinanceira?.data_vencimento || 10}</p>
              </div>
            </div>
            
            {!statusMensalidade.pago && (
              <motion.button whileTap={{ scale: 0.98 }} onClick={copiarPix} className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold text-sm mb-3 shadow-md hover:shadow-lg transition-all">🔗 Copiar Chave PIX</motion.button>
            )}
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setIsPayHistoryModalOpen(true)} className="w-full py-4 rounded-2xl font-bold text-sm text-slate-600 bg-white/60 border border-white/80 hover:bg-white shadow-sm transition-all">📄 Ver Recibos</motion.button>
          </div>
        </motion.section>

        <motion.section variants={itemVariants}>
          <h3 className="text-sm font-semibold text-slate-500 mb-3 ml-2 flex items-center gap-2 drop-shadow-sm"><span className="text-lg">📖</span> Diário de Aulas</h3>
          <div className="bg-white/50 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 p-2 space-y-2">
            {historico.length === 0 ? <p className="p-6 text-center text-sm font-medium text-slate-500">Nenhum registro.</p> : historico.map(h => (
              <motion.div whileTap={{ scale: 0.98 }} onClick={() => abrirDetalhesAula(h)} key={h.id} className="p-4 rounded-2xl bg-white/60 border border-white/80 flex justify-between items-center shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg shadow-inner ${h.status === 'Realizada' ? 'bg-emerald-50 text-emerald-600' : h.status === 'Desmarcada' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    {h.status === 'Realizada' ? '✓' : h.status === 'Desmarcada' ? '✖' : '📅'}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{new Date(h.data_aula).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{h.status}</p>
                  </div>
                </div>
                <div className="text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity">
                    <span className="text-xl">👁️</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={itemVariants}>
          <h3 className="text-sm font-semibold text-slate-500 mb-3 ml-2 flex items-center gap-2 drop-shadow-sm"><span className="text-lg">📁</span> Repositório (Arquivos)</h3>
          <div className="bg-white/50 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 p-2 space-y-2">
            {materiais.length === 0 ? <p className="p-6 text-center text-sm font-medium text-slate-500">Nenhum arquivo disponível.</p> : materiais.map(m => (
              <div key={m.id} className="p-3 rounded-2xl bg-white/60 border border-white/80 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="h-12 w-12 rounded-xl bg-cyan-50/80 border border-cyan-100 text-cyan-600 flex items-center justify-center text-xl flex-shrink-0 shadow-inner">{m.tipo_arquivo.includes('pdf') ? '📄' : '🎵'}</div>
                  <div className="overflow-hidden pr-2">
                    <p className="font-bold text-sm text-slate-800 truncate">{m.nome_arquivo}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{new Date(m.data_envio).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <a href={m.url_arquivo} target="_blank" download className="h-10 w-10 bg-white/80 border border-white rounded-xl flex items-center justify-center text-cyan-600 shadow-sm hover:bg-cyan-50 transition-all flex-shrink-0 group-hover:scale-105">⬇️</a>
              </div>
            ))}
          </div>
        </motion.section>

      </motion.main>

      {/* FOOTER FIXO */}
      <footer className="bg-white/40 backdrop-blur-2xl p-4 border-t border-white/60 shadow-[0_-8px_32px_rgba(0,0,0,0.04)] fixed bottom-0 w-full flex justify-center z-40">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleSair} className="px-8 py-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-bold text-xs hover:bg-rose-100 shadow-sm transition-all flex items-center gap-2">
          <span className="text-sm">🚪</span> Sair do App
        </motion.button>
      </footer>

      {/* --- MODAIS --- */}
      <AnimatePresence>
        {isNotificacaoModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end md:items-center justify-center p-4 z-[90]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/80 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 drop-shadow-sm"><span>🔔</span> Central de Avisos</h2>
                <button onClick={() => setIsNotificacaoModalOpen(false)} className="h-10 w-10 bg-white/50 text-slate-500 border border-white/80 rounded-full font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all">✖</button>
              </div>
              
              <div className="flex gap-6 border-b border-slate-200/50 mb-4 shrink-0">
                <button onClick={() => setNotificacaoTab('NaoLidas')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${notificacaoTab === 'NaoLidas' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  Novas ({notificacoesNaoLidas.length})
                </button>
                <button onClick={() => setNotificacaoTab('Lidas')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${notificacaoTab === 'Lidas' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  Histórico ({notificacoesLidas.length})
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-2">
                {notificacoesExibidas.length === 0 ? (
                  <div className="text-center py-12 opacity-60">
                    <span className="text-5xl block mb-3 grayscale">📭</span>
                    <p className="text-sm font-semibold text-slate-500">Nenhuma notificação aqui.</p>
                  </div>
                ) : notificacoesExibidas.map(n => (
                  <div key={n.id} className={`p-5 rounded-2xl border ${!n.is_read ? (n.source === 'mensagem' ? 'border-indigo-200 bg-indigo-50/80 shadow-md' : n.status === 'Aprovada' ? 'border-emerald-200 bg-emerald-50/80 shadow-md' : 'border-rose-200 bg-rose-50/80 shadow-md') : 'border-white/60 bg-white/50 opacity-70 shadow-sm'}`}>
                    
                    <div className="flex items-start gap-4 mb-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg shadow-inner ${!n.is_read ? 'text-white' : 'text-slate-500 bg-slate-100'} ${n.source === 'mensagem' ? (!n.is_read && 'bg-indigo-500') : n.status === 'Aprovada' ? (!n.is_read && 'bg-emerald-500') : (!n.is_read && 'bg-rose-500')}`}>
                        {n.source === 'mensagem' ? '💬' : n.status === 'Aprovada' ? '✓' : '✖'}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className={`font-bold text-sm tracking-tight ${n.source === 'mensagem' ? 'text-indigo-800' : n.status === 'Aprovada' ? 'text-emerald-800' : 'text-rose-800'}`}>
                            {n.source === 'mensagem' ? n.titulo : `Solicitação ${n.status}`}
                          </p>
                        </div>
                        <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
                          {n.source === 'mensagem' ? n.mensagem : (
                            <>Seu pedido para a aula de <span className="font-bold">{new Date(n.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'})} às {n.novo_horario_inicio?.slice(0,5)}</span> foi avaliado.</>
                          )}
                        </p>
                        {n.status === 'Negada' && n.motivo_recusa && (
                          <div className="mt-2 p-3 bg-white/80 rounded-xl border border-rose-100 shadow-inner">
                            <p className="text-[10px] font-bold text-rose-500 mb-0.5">Motivo da escola:</p>
                            <p className="text-xs font-medium text-slate-700 italic">"{n.motivo_recusa}"</p>
                          </div>
                        )}
                        <p className="text-[10px] font-medium text-slate-400 mt-3">
                          {new Date(n.criado_em).toLocaleDateString('pt-BR')} às {new Date(n.criado_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>

                    {!n.is_read && (
                      <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleMarcarComoLida(n)} disabled={isSubmitting} className={`w-full py-3 rounded-xl font-bold text-xs shadow-sm mt-2 border transition-all ${n.source === 'mensagem' ? 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-500' : n.status === 'Aprovada' ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-500' : 'bg-rose-600 border-rose-700 text-white hover:bg-rose-500'}`}>
                        {isSubmitting ? '...' : 'Marcar como Lida'}
                      </motion.button>
                    )}

                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRescheduleModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[70]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/80 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight drop-shadow-sm">{rescheduleType === 'Fixa' ? 'Novo Fixo' : 'Calendário de Reposição'}</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Selecione uma data para ver os horários</p>
                </div>
                <button onClick={() => setIsRescheduleModalOpen(false)} className="h-10 w-10 bg-white/50 text-slate-500 border border-white/80 rounded-full font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all">✖</button>
              </div>
              
              <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-4 mb-4">
                {proximosDias.map((dia, idx) => (
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    key={idx} 
                    onClick={() => setSelectedDateObj(dia)}
                    className={`flex flex-col items-center justify-center min-w-[70px] p-3 rounded-2xl border shadow-sm transition-all ${selectedDateObj?.dataString === dia.dataString ? 'border-indigo-400 bg-indigo-500 text-white shadow-md scale-105' : 'border-white/80 bg-white/50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
                  >
                    <span className="text-[11px] font-bold mb-1 opacity-90">{dia.diaSemana.slice(0,3)}</span>
                    <span className="text-lg font-bold tracking-tight">{dia.displayData.split('/')[0]}</span>
                    <span className="text-[10px] font-medium opacity-80">/{dia.displayData.split('/')[1]}</span>
                  </motion.button>
                ))}
              </div>

              <div className="bg-white/40 rounded-2xl p-4 border border-white/60 shadow-inner min-h-[200px] mb-6">
                {!selectedDateObj ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-60 text-center py-10">
                    <span className="text-4xl mb-2 grayscale">📅</span>
                    <p className="text-xs font-bold text-slate-500">Toque em um dia acima<br/>para carregar a grade.</p>
                  </div>
                ) : diaBloqueadoMsg ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-80 text-center py-10">
                    <span className="text-4xl mb-2 drop-shadow-sm">🏖️</span>
                    <p className="text-xs font-bold text-rose-600">Escola Fechada</p>
                    <p className="text-xs font-medium text-slate-600 mt-1">{diaBloqueadoMsg}</p>
                  </div>
                ) : vagasDoDiaSelecionado.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-80 text-center py-10">
                    <span className="text-4xl mb-2 drop-shadow-sm grayscale">📭</span>
                    <p className="text-xs font-bold text-rose-500">Nenhum horário livre<br/>neste dia.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                    {vagasDoDiaSelecionado.map((vaga, idx) => (
                      <motion.button 
                        whileTap={{ scale: 0.98 }}
                        key={idx} 
                        onClick={() => setSelectedSlot(vaga)}
                        className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all shadow-sm ${selectedSlot?.id === vaga.id ? 'border-indigo-300 bg-indigo-50/80 text-indigo-800' : 'border-white/80 bg-white/60 text-slate-700 hover:border-slate-300'}`}
                      >
                        <span className="font-bold text-sm">
                          {vaga.hora_inicio.slice(0,5)} <span className="opacity-60 text-xs font-medium">- {vaga.hora_fim.slice(0,5)}</span>
                        </span>
                        {selectedSlot?.id === vaga.id && <div className="h-5 w-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-sm">✓</div>}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={handleSolicitarReagendamento} disabled={!selectedSlot || isSubmitting || diaBloqueadoMsg !== null} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-sm shadow-xl disabled:opacity-50 hover:bg-slate-700 transition-all">
                {isSubmitting ? 'Processando...' : 'Confirmar e Enviar para Escola'}
              </motion.button>
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
                       {fotoPreview ? <img src={fotoPreview} className="w-full h-full object-cover"/> : <span className="text-3xl flex items-center justify-center h-full">📷</span>}
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

      <AnimatePresence>
        {isPayHistoryModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end md:items-center justify-center p-4 z-[90]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/80 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 drop-shadow-sm"><span>📄</span> Histórico de Pagamentos</h2>
                <button onClick={() => setIsPayHistoryModalOpen(false)} className="h-10 w-10 bg-white/50 text-slate-500 border border-white/80 rounded-full font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all">✖</button>
              </div>
              <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-2">
                 {historicoPagamentos.length === 0 ? (
                   <div className="text-center py-10 opacity-60">
                      <span className="text-4xl mb-2 grayscale block">💸</span>
                      <p className="text-sm font-semibold text-slate-500">Nenhum pagamento registrado.</p>
                   </div>
                 ) : historicoPagamentos.map(pag => (
                   <div key={pag.id} className="p-4 rounded-2xl bg-white/60 border border-white/80 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                     <div className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-inner flex-shrink-0">✓</div>
                       <div>
                         <p className="font-bold text-sm text-slate-800">{new Date(pag.data_pagamento).toLocaleDateString('pt-BR', {timeZone:'UTC'})}</p>
                         <p className="text-xs font-semibold text-slate-500 mt-0.5">R$ {pag.valor}</p>
                       </div>
                     </div>
                     {pag.recibo_url && (
                       <a href={pag.recibo_url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 bg-white/80 border border-white rounded-xl flex items-center justify-center text-slate-600 shadow-sm hover:bg-slate-50 transition-all flex-shrink-0 group-hover:scale-105" title="Ver Recibo">⬇️</a>
                     )}
                   </div>
                 ))}
              </div>
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
                      <div className={`h-14 w-14 rounded-full flex items-center justify-center text-2xl shadow-inner flex-shrink-0 ${selectedClassDetails.status === 'Realizada' ? 'bg-emerald-50 text-emerald-600' : selectedClassDetails.status === 'Desmarcada' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                          {selectedClassDetails.status === 'Realizada' ? '✓' : selectedClassDetails.status === 'Desmarcada' ? '✖' : '📅'}
                      </div>
                      <div>
                          <p className="font-bold text-xl text-slate-800 tracking-tight">{new Date(selectedClassDetails.data_aula).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                          <p className={`text-sm font-bold mt-0.5 ${selectedClassDetails.status === 'Realizada' ? 'text-emerald-600' : selectedClassDetails.status === 'Desmarcada' ? 'text-rose-600' : 'text-amber-600'}`}>{selectedClassDetails.status}</p>
                      </div>
                  </div>

                  <div className="bg-white/60 border border-white/80 p-5 rounded-2xl shadow-sm">
                      <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1"><span>✏️</span> Anotações do Professor</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                          {selectedClassDetails.observacoes || "Nenhuma anotação registrada para esta aula."}
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