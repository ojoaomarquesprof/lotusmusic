"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'

// Variáveis de Animação
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
  const [statusMensalidade, setStatusMensalidade] = useState({ pago: false, diasRestantes: 0, dataVencimentoStr: '' })
  const [historicoPagamentos, setHistoricoPagamentos] = useState<any[]>([])
  
  const [isPayHistoryModalOpen, setIsPayHistoryModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false)
  const [isNotificacaoModalOpen, setIsNotificacaoModalOpen] = useState(false)
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

  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => { if (s.bg && s.bg.includes('950')) toggleTheme() }, [s.bg, toggleTheme])
  
  // 🟢 REALTIME (Portal do Aluno): Agora sincroniza notificações, respostas de reagendamento E desmarcações de aula na hora!
  useEffect(() => {
    if (!isMounted) return;
    let channel: any;
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return;
      
      channel = supabase.channel('portal-aluno-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_reagendamento', filter: `aluno_id=eq.${session.user.id}` }, () => { carregarPortal() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes_aluno', filter: `aluno_id=eq.${session.user.id}` }, () => { carregarPortal() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_aulas', filter: `aluno_id=eq.${session.user.id}` }, () => { carregarPortal() })
        .subscribe();
    }
    setupRealtime();
    return () => { if (channel) supabase.removeChannel(channel); }
  }, [isMounted])

  useEffect(() => { if (isMounted) carregarPortal() }, [isMounted])

  useEffect(() => {
    const dias = []; const mapaDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    for (let i = 1; i <= 15; i++) {
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

    const { data: perfil } = await supabase.from('profiles').select('*, alunos_info(*)').eq('id', session.user.id).single()
    if (perfil) { setAluno(perfil); setEditNome(perfil.nome_completo || ''); setFotoPreview(perfil.avatar_url || null) }

    const { data: config } = await supabase.from('configuracoes').select('nome_escola, logo_url, chave_pix').eq('id', 1).single()
    setEscola(config)

    const { data: ev } = await supabase.from('eventos_calendario').select('*').gte('data_evento', new Date().toISOString().split('T')[0])
    setEventosGlobais(ev || [])

    const { data: ag } = await supabase.from('agenda').select('*, sala:salas(nome)').eq('aluno_id', session.user.id)
    let aulasMapeadas = ag || []
    if (aulasMapeadas.length > 0) {
      const profIds = aulasMapeadas.map((a: any) => a.professor_id).filter(Boolean)
      const { data: profs } = await supabase.from('profiles').select('id, nome_completo').in('id', profIds)
      aulasMapeadas = aulasMapeadas.map((aula: any) => ({ ...aula, professor_nome: profs?.find((p: any) => p.id === aula.professor_id)?.nome_completo || null }))
    }
    setAulas(aulasMapeadas)

    const { data: sol } = await supabase.from('solicitacoes_reagendamento').select('*').eq('aluno_id', session.user.id).eq('status', 'Pendente').single()
    setSolicitacaoPendente(sol)

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

  const abrirModalReagendamento = async (tipo: string, aula: any) => {
    setRescheduleType(tipo); setAulaParaMudar(aula); setSelectedDateObj(null); setSelectedSlot(null); setDiaBloqueadoMsg(null); setIsRescheduleModalOpen(true);
    const { data: disp } = await supabase.from('disponibilidade_professor').select('*').eq('professor_id', aula.professor_id)
    const { data: ag } = await supabase.from('agenda').select(`dia, horario_inicio, aluno:profiles!aluno_id(alunos_info(status, data_inativacao))`).eq('professor_id', aula.professor_id)
    setDispBrutaProf(disp || []); setAgendaBrutaProf(ag || [])
  }

  const handleSolicitarReagendamento = async () => {
    if (!selectedSlot || !selectedDateObj) return
    setIsSubmitting(true)
    await supabase.from('solicitacoes_reagendamento').insert([{ aluno_id: aluno.id, professor_id: aulaParaMudar.professor_id, agenda_original_id: aulaParaMudar.id, tipo_mudanca: rescheduleType, novo_dia: selectedSlot.dia_semana, nova_data: selectedDateObj.dataString, novo_horario_inicio: selectedSlot.hora_inicio, novo_horario_fim: selectedSlot.hora_fim, lida_aluno: false }])
    alert("✅ Solicitação enviada para análise!"); setIsRescheduleModalOpen(false); carregarPortal(); setIsSubmitting(false)
  }

  const calcularDataProximaAula = (diaStr: string, horaInicio: string) => {
    const mapa: any = { 'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }
    const hoje = new Date(); const diaAlvo = mapa[diaStr]; if (diaAlvo === undefined) return '--'
    let diff = diaAlvo - hoje.getDay()
    if (diff < 0 || (diff === 0 && hoje.getHours() > parseInt(horaInicio.split(':')[0]))) diff += 7
    const d = new Date(); d.setDate(hoje.getDate() + diff)
    
    // Formata o retorno para enviar a dataStr completa para o Histórico também
    const dataIsoString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    
    const displayStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    const formatada = displayStr.charAt(0).toUpperCase() + displayStr.slice(1)
    
    return { dataFormatada: formatada, dataBaseString: dataIsoString }
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

        <motion.section variants={itemVariants}>
          <h3 className="text-sm font-semibold text-slate-500 mb-3 ml-2 flex items-center gap-2 drop-shadow-sm"><span className="text-lg">🎯</span> Sua Próxima Aula</h3>
          {aulas.length === 0 ? (
            <div className="p-8 rounded-[2rem] border border-dashed border-slate-300 bg-white/40 backdrop-blur-md text-center shadow-sm"><p className="text-sm font-medium text-slate-500">Nenhuma aula agendada.</p></div>
          ) : (
            aulas.map(aula => {
              const dadosData = calcularDataProximaAula(aula.dia, aula.horario_inicio);
              const statusAteProxima = historico.find(h => h.data_aula === dadosData.dataBaseString)?.status;
              const isDesmarcada = statusAteProxima === 'Desmarcada';

              return (
                <motion.div whileHover={{ y: -4 }} key={aula.id} className={`bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border relative overflow-hidden group mb-4 transition-all ${isDesmarcada ? 'border-rose-400 opacity-90' : 'border-white/60'}`}>
                  {isDesmarcada ? (
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl pointer-events-none"></div>
                  ) : (
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-300/20 rounded-full blur-2xl pointer-events-none"></div>
                  )}
                  
                  <div className={`inline-block border px-3 py-1 rounded-xl font-bold text-xs mb-4 shadow-sm ${isDesmarcada ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
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
                  
                  {!solicitacaoPendente && (
                    <motion.button whileTap={{ scale: 0.98 }} onClick={() => abrirModalReagendamento('Reposição', aula)} className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${isDesmarcada ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600' : 'bg-white/60 border border-white/80 text-slate-700 hover:bg-white'}`}>
                      <span>📅</span> {isDesmarcada ? 'Escolher Nova Data' : 'Escolher Data para Repor'}
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
              <div key={h.id} className="p-4 rounded-2xl bg-white/60 border border-white/80 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg shadow-inner ${h.status === 'Realizada' ? 'bg-emerald-50 text-emerald-600' : h.status === 'Desmarcada' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    {h.status === 'Realizada' ? '✓' : h.status === 'Desmarcada' ? '✖' : '📅'}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{new Date(h.data_aula).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{h.status}</p>
                  </div>
                </div>
              </div>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end justify-center z-[60]">
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="bg-white/90 backdrop-blur-2xl border-t border-white/60 p-8 rounded-t-[2.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-indigo-700 drop-shadow-sm">Meu Perfil</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="h-10 w-10 bg-white/60 text-slate-500 border border-white/80 rounded-full font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all">✖</button>
              </div>
              <form onSubmit={handleAtualizarPerfil} className="space-y-5 mb-8">
                <div className="flex justify-center mb-2">
                  <label className="cursor-pointer group relative">
                    <div className="w-28 h-28 rounded-full border-4 border-indigo-100 bg-white/50 overflow-hidden flex items-center justify-center shadow-md group-hover:border-indigo-300 transition-all">
                      {fotoPreview ? <img src={fotoPreview} className="w-full h-full object-cover" /> : <span className="text-4xl opacity-40">📷</span>}
                    </div>
                    <div className="absolute -bottom-2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">Alterar</div>
                    <input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) { setEditFotoArquivo(e.target.files[0]); setFotoPreview(URL.createObjectURL(e.target.files[0])) } }} />
                  </label>
                </div>
                <div className="bg-white/50 p-4 rounded-2xl border border-white/80 shadow-inner">
                  <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Seu Nome</label>
                  <input required value={editNome} onChange={e => setEditNome(e.target.value)} className="w-full bg-transparent text-slate-800 text-sm font-bold outline-none" />
                </div>
                <div className="bg-white/50 p-4 rounded-2xl border border-white/80 shadow-inner">
                  <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Mudar Senha</label>
                  <input type="password" minLength={6} placeholder="Deixe em branco para manter" value={editSenha} onChange={e => setEditSenha(e.target.value)} className="w-full bg-transparent text-slate-800 text-sm font-bold outline-none placeholder:font-medium placeholder:text-slate-400" />
                </div>
                <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isSubmitting} className="w-full py-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPayHistoryModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[80]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/80 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 drop-shadow-sm">Meus Recibos</h2>
                <button onClick={() => setIsPayHistoryModalOpen(false)} className="h-10 w-10 bg-white/50 text-slate-500 border border-white/80 rounded-full font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all">✖</button>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
                {historicoPagamentos.map(pg => {
                  const [a, m, d] = pg.data_pagamento.split('T')[0].split('-').map(Number);
                  const dataPg = new Date(a, m - 1, d);
                  const ultimo = new Date(a, m, 0).getDate();
                  const venc = new Date(a, m - 1, Math.min(infoFinanceira?.data_vencimento || 10, ultimo));
                  const diff = Math.ceil((dataPg.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={pg.id} className={`p-5 rounded-2xl border bg-white/60 backdrop-blur-sm shadow-sm ${diff > 0 ? 'border-rose-200/50' : 'border-emerald-200/50'} overflow-hidden relative`}>
                      <div className="flex justify-between items-center relative z-10">
                        <div>
                          <p className="font-bold text-sm text-slate-800">{dataPg.toLocaleDateString('pt-BR')}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1">Via {pg.metodo_pagamento || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xl tracking-tight text-slate-800">R$ {pg.valor}</p>
                          <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-lg inline-block border shadow-sm ${diff <= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{diff <= 0 ? '✓ No Prazo' : `Atraso: ${diff}d`}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {historicoPagamentos.length === 0 && <p className="text-center text-sm font-medium text-slate-500 py-10 opacity-70">Nenhum recibo encontrado.</p>}
              </div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => setIsPayHistoryModalOpen(false)} className="w-full py-4 mt-6 rounded-2xl font-bold text-sm text-slate-600 bg-white/60 border border-white/80 hover:bg-white shadow-sm transition-all">Fechar Histórico</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}