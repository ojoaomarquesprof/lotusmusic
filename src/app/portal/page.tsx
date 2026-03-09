"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'

export default function PortalAluno() {
  const { s, toggleTheme } = useStyles()
  const router = useRouter()
  
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
  
  // NOVO: Estado para guardar os Feriados/Recessos
  const [eventosGlobais, setEventosGlobais] = useState<any[]>([])
  
  const [selectedDateObj, setSelectedDateObj] = useState<any>(null)
  const [vagasDoDiaSelecionado, setVagasDoDiaSelecionado] = useState<any[]>([])
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  
  // NOVO: Mensagem de bloqueio do dia (se for feriado)
  const [diaBloqueadoMsg, setDiaBloqueadoMsg] = useState<string | null>(null)

  useEffect(() => { if (s.bg && s.bg.includes('950')) toggleTheme() }, [s.bg, toggleTheme])
  
  useEffect(() => {
    let channel1: any; let channel2: any;
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return;
      channel1 = supabase.channel('notificacoes-reagendamento').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitacoes_reagendamento', filter: `aluno_id=eq.${session.user.id}` }, () => carregarPortal()).subscribe();
      channel2 = supabase.channel('notificacoes-diretas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes_aluno', filter: `aluno_id=eq.${session.user.id}` }, () => carregarPortal()).subscribe();
    }
    setupRealtime();
    return () => { if (channel1) supabase.removeChannel(channel1); if (channel2) supabase.removeChannel(channel2); }
  }, [])

  useEffect(() => { carregarPortal() }, [])

  useEffect(() => {
    const dias = []; const mapaDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    for (let i = 1; i <= 15; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      if (d.getDay() !== 0) dias.push({ dataObj: d, dataString: d.toISOString().split('T')[0], diaSemana: mapaDias[d.getDay()], displayData: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })
    }
    setProximosDias(dias)
  }, [])

  // MOTOR DE FILTRO CORRIGIDO: OLHA PARA OS FERIADOS PRIMEIRO
  useEffect(() => {
    if (selectedDateObj && dispBrutaProf.length > 0) {
      const diaDaSemanaSelecionado = selectedDateObj.diaSemana; 
      const dataSelecionadaStr = selectedDateObj.dataString;

      // 1. Verifica se a data é um Feriado ou Recesso
      const eventoBloqueio = eventosGlobais.find(e => e.data_evento === dataSelecionadaStr && (e.tipo === 'Feriado' || e.tipo === 'Recesso'))
      
      if (eventoBloqueio) {
        setDiaBloqueadoMsg(eventoBloqueio.titulo)
        setVagasDoDiaSelecionado([])
        setSelectedSlot(null)
        return; // Interrompe aqui, não mostra vagas
      } else {
        setDiaBloqueadoMsg(null)
      }

      // 2. Se não for feriado, continua a busca normal por vagas
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

    // BUSCA EVENTOS DO CALENDÁRIO DA ESCOLA
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
    const res = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    return res.charAt(0).toUpperCase() + res.slice(1)
  }

  if (loading && !aluno) return <div className={`min-h-screen ${s.bg} flex justify-center items-center`}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>
  const infoFinanceira = Array.isArray(aluno?.alunos_info) ? aluno?.alunos_info[0] : aluno?.alunos_info
  
  const notificacoesNaoLidas = todasNotificacoes.filter(n => !n.is_read)
  const notificacoesLidas = todasNotificacoes.filter(n => n.is_read)
  const notificacoesExibidas = notificacaoTab === 'NaoLidas' ? notificacoesNaoLidas : notificacoesLidas

  return (
    <div className={`min-h-screen ${s.bg} ${s.text} font-sans transition-colors duration-500 pb-20 bg-slate-50/50`}>
      
      <header className={`bg-white/80 backdrop-blur-xl p-6 rounded-b-[2.5rem] border-b border-slate-200/50 shadow-sm sticky top-0 z-40`}>
        <div className="flex justify-between items-center mb-6">
          {escola?.logo_url ? <img src={escola.logo_url} className="h-8 max-w-[120px] object-contain drop-shadow-sm" /> : <h1 className="text-lg font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">{escola?.nome_escola || 'Escola'}</h1>}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer w-fit group" onClick={() => setIsProfileModalOpen(true)}>
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/30 overflow-hidden relative border-[3px] border-white">
              {aluno?.avatar_url ? <img src={aluno.avatar_url} className="w-full h-full object-cover" /> : aluno?.nome_completo?.charAt(0)}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">⚙️</div>
            </div>
            <div><p className={`text-slate-400 text-[10px] font-black uppercase tracking-widest`}>Meu Perfil</p><h2 className="text-2xl font-black uppercase leading-tight text-slate-800 tracking-tight">{aluno?.nome_completo?.split(' ')[0]}</h2></div>
          </div>

          <button onClick={() => { setIsNotificacaoModalOpen(true); setNotificacaoTab(notificacoesNaoLidas.length > 0 ? 'NaoLidas' : 'Lidas'); }} className="relative h-12 w-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:scale-105 hover:bg-slate-50 transition-all text-slate-600">
            <span className="text-xl">🔔</span>
            {notificacoesNaoLidas.length > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">{notificacoesNaoLidas.length}</span>}
          </button>
        </div>
      </header>

      <main className="p-5 max-w-md mx-auto space-y-8 mt-2 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {solicitacaoPendente && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-[1px] rounded-3xl shadow-lg shadow-amber-500/20 animate-pulse">
            <div className="bg-white rounded-[23px] p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-xl shadow-inner flex-shrink-0">⏳</div>
              <div>
                <p className="font-black text-xs uppercase text-amber-600">Análise Pendente</p>
                <p className="text-[10px] font-bold text-slate-500 leading-tight mt-0.5">Pedido para <span className="text-slate-800 underline">{new Date(solicitacaoPendente.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'})} ({solicitacaoPendente.novo_dia})</span> às {solicitacaoPendente.novo_horario_inicio?.slice(0,5)}.</p>
              </div>
            </div>
          </div>
        )}

        <section>
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 ml-2 flex items-center gap-2"><span>🎯</span> Sua Próxima Aula</h3>
          {aulas.length === 0 ? (
            <div className="p-8 rounded-[2rem] border-2 border-dashed border-slate-200 bg-white/50 text-center"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma aula agendada.</p></div>
          ) : (
            aulas.map(aula => (
              <div key={aula.id} className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group mb-4 transition-all hover:shadow-2xl hover:shadow-slate-200">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-amber-100 to-transparent rounded-full opacity-50 pointer-events-none"></div>
                <div className="inline-block bg-amber-500 text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-widest text-[9px] mb-4 shadow-md shadow-amber-500/20">{calcularDataProximaAula(aula.dia, aula.horario_inicio)}</div>
                <div className="flex justify-between items-end mb-6 relative z-10">
                  <div><p className="font-black text-3xl text-slate-800 tracking-tighter leading-none mb-1">{aula.horario_inicio.slice(0,5)} <span className="text-slate-300 text-xl font-bold">- {aula.horario_fim.slice(0,5)}</span></p><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mt-2"><span className="bg-slate-100 p-1 rounded-md text-sm">🎤</span> {aula.instrumento_aula}</p></div>
                  <div className="text-right"><p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Professor</p><p className="font-black text-sm uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg mt-1">{aula.professor_nome ? aula.professor_nome.split(' ')[0] : '--'}</p></div>
                </div>
                {!solicitacaoPendente && (
                  <button onClick={() => abrirModalReagendamento('Reposição', aula)} className="w-full py-3.5 rounded-xl border-2 border-slate-100 text-slate-500 font-black uppercase text-[10px] hover:bg-slate-50 hover:text-slate-800 transition-all flex items-center justify-center gap-2">
                    <span>📅</span> Escolher Data para Repor
                  </button>
                )}
              </div>
            ))
          )}
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 ml-2 flex items-center gap-2"><span>💳</span> Painel Financeiro</h3>
          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            {statusMensalidade.pago ? (<div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-6 flex items-center gap-4"><div className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-lg shadow-emerald-500/30 flex-shrink-0">✓</div><div><p className="font-black text-sm text-emerald-700 uppercase tracking-tight">Mensalidade Paga</p><p className="text-[10px] font-bold text-emerald-600/70 mt-0.5">Tudo certo. Próxima: {statusMensalidade.dataVencimentoStr}</p></div></div>) : statusMensalidade.diasRestantes < 0 ? (<div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-6 flex items-center gap-4 animate-in pulse duration-1000"><div className="h-12 w-12 rounded-full bg-rose-500 text-white flex items-center justify-center text-xl shadow-lg shadow-rose-500/30 flex-shrink-0">!</div><div><p className="font-black text-sm text-rose-700 uppercase tracking-tight">Em Atraso</p><p className="text-[10px] font-bold text-rose-600/70 mt-0.5">Venceu dia {statusMensalidade.dataVencimentoStr}.</p></div></div>) : (<div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-6 flex items-center gap-4"><div className="h-12 w-12 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30 flex-shrink-0">📅</div><div><p className="font-black text-sm text-indigo-700 uppercase tracking-tight">Vence dia {statusMensalidade.dataVencimentoStr}</p><p className="text-[10px] font-bold text-indigo-600/70 mt-0.5">Faltam {statusMensalidade.diasRestantes} dias.</p></div></div>)}
            <div className="flex justify-between items-end mb-6 bg-slate-50 p-4 rounded-2xl"><div><p className="text-[9px] uppercase text-slate-400 font-black tracking-widest mb-1">Valor Vigente</p><p className="text-3xl font-black text-slate-800 leading-none">R$ {infoFinanceira?.valor_mensalidade || '0,00'}</p></div><div className="text-right"><p className="text-[9px] uppercase text-slate-400 font-black tracking-widest mb-1">Vencimento</p><p className="font-black text-xs text-slate-600 uppercase bg-white px-2 py-1 rounded shadow-sm border border-slate-100">Dia {infoFinanceira?.data_vencimento || 10}</p></div></div>
            {!statusMensalidade.pago && <button onClick={copiarPix} className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-black uppercase text-xs mb-3 shadow-lg shadow-indigo-500/30 hover:scale-[1.02] transition-all">🔗 Copiar Chave PIX</button>}
            <button onClick={() => setIsPayHistoryModalOpen(true)} className="w-full py-4 rounded-2xl font-black uppercase text-[10px] text-slate-500 bg-white border-2 border-slate-100 hover:bg-slate-50 transition-all">📄 Registro de Pagamentos</button>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 ml-2 flex items-center gap-2"><span>📖</span> Diário de Aulas</h3>
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-2 space-y-2">
            {historico.length === 0 ? <p className="p-6 text-center text-xs text-slate-400 font-bold uppercase">Nenhum registro.</p> : historico.map(h => (
              <div key={h.id} className="p-4 rounded-2xl bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"><div className="flex items-center gap-3"><div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg shadow-sm ${h.status === 'Realizada' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{h.status === 'Realizada' ? '✓' : '✕'}</div><div><p className="font-black text-sm text-slate-800">{new Date(h.data_aula).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">{h.status}</p></div></div></div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 ml-2 flex items-center gap-2"><span>📁</span> Repositório (Arquivos)</h3>
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-2 space-y-2">
            {materiais.length === 0 ? <p className="p-6 text-center text-xs text-slate-400 font-bold uppercase">Nenhum arquivo.</p> : materiais.map(m => (
              <div key={m.id} className="p-3 rounded-2xl bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors group"><div className="flex items-center gap-3 overflow-hidden"><div className="h-12 w-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">{m.tipo_arquivo.includes('pdf') ? '📄' : '🎵'}</div><div className="overflow-hidden pr-2"><p className="font-black text-xs text-slate-800 truncate">{m.nome_arquivo}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{new Date(m.data_envio).toLocaleDateString('pt-BR')}</p></div></div><a href={m.url_arquivo} target="_blank" download className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-cyan-600 shadow-sm hover:bg-cyan-50 transition-all flex-shrink-0 group-hover:scale-105">⬇️</a></div>
            ))}
          </div>
        </section>

      </main>

      <footer className="bg-white/80 backdrop-blur-xl p-4 border-t border-slate-200/50 fixed bottom-0 w-full flex justify-center z-40">
        <button onClick={handleSair} className="px-8 py-3.5 rounded-2xl bg-rose-50 text-rose-600 font-black uppercase text-[10px] tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2"><span className="text-sm">🚪</span> Sair do App</button>
      </footer>

      {/* --- O MODAL DO SININHO --- */}
      {isNotificacaoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 z-[90] animate-in fade-in">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><span>🔔</span> Central de Avisos</h2>
              <button onClick={() => setIsNotificacaoModalOpen(false)} className="h-10 w-10 bg-slate-100 text-slate-500 rounded-full font-black flex items-center justify-center hover:bg-slate-200 transition-colors">✖</button>
            </div>
            
            <div className="flex gap-6 border-b-2 border-slate-100 mb-4 shrink-0">
              <button onClick={() => setNotificacaoTab('NaoLidas')} className={`pb-3 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${notificacaoTab === 'NaoLidas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                Novas ({notificacoesNaoLidas.length})
              </button>
              <button onClick={() => setNotificacaoTab('Lidas')} className={`pb-3 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${notificacaoTab === 'Lidas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                Histórico ({notificacoesLidas.length})
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-2">
              {notificacoesExibidas.length === 0 ? (
                <div className="text-center py-12 opacity-50">
                  <span className="text-5xl block mb-3">📭</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Nenhuma notificação aqui.</p>
                </div>
              ) : notificacoesExibidas.map(n => (
                <div key={n.id} className={`p-5 rounded-2xl border-2 ${!n.is_read ? (n.source === 'mensagem' ? 'border-indigo-100 bg-indigo-50 shadow-md' : n.status === 'Aprovada' ? 'border-emerald-100 bg-emerald-50 shadow-md' : 'border-rose-100 bg-rose-50 shadow-md') : 'border-slate-100 bg-white opacity-70'}`}>
                  
                  <div className="flex items-start gap-4 mb-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-lg ${!n.is_read ? 'shadow-md' : ''} ${n.source === 'mensagem' ? (n.is_read ? 'bg-indigo-300' : 'bg-indigo-500') : n.status === 'Aprovada' ? (n.is_read ? 'bg-emerald-300' : 'bg-emerald-500') : (n.is_read ? 'bg-rose-300' : 'bg-rose-500')}`}>
                      {n.source === 'mensagem' ? '💬' : n.status === 'Aprovada' ? '✓' : '✖'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className={`font-black uppercase text-xs tracking-widest ${n.source === 'mensagem' ? 'text-indigo-700' : n.status === 'Aprovada' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {n.source === 'mensagem' ? n.titulo : `Solicitação ${n.status}`}
                        </p>
                      </div>
                      <p className="text-[10px] font-bold text-slate-600 mt-1 leading-relaxed">
                        {n.source === 'mensagem' ? n.mensagem : (
                          <>Seu pedido para a aula de <span className="font-black">{new Date(n.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'})} às {n.novo_horario_inicio?.slice(0,5)}</span> foi avaliado.</>
                        )}
                      </p>
                      {n.status === 'Negada' && n.motivo_recusa && (
                        <div className="mt-2 p-3 bg-white/60 rounded-xl border border-rose-100/50">
                          <p className="text-[9px] font-black uppercase text-rose-400 mb-0.5">Motivo da escola:</p>
                          <p className="text-[11px] font-bold text-slate-700 italic">"{n.motivo_recusa}"</p>
                        </div>
                      )}
                      <p className="text-[8px] font-black opacity-30 mt-3 uppercase tracking-widest">
                        Recebida em {new Date(n.criado_em).toLocaleDateString('pt-BR')} às {new Date(n.criado_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>

                  {!n.is_read && (
                    <button onClick={() => handleMarcarComoLida(n)} disabled={isSubmitting} className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-md mt-2 ${n.source === 'mensagem' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : n.status === 'Aprovada' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700'}`}>
                      {isSubmitting ? '...' : 'Marcar como Lida'}
                    </button>
                  )}

                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CALENDÁRIO */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{rescheduleType === 'Fixa' ? 'Novo Fixo' : 'Calendário de Reposição'}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Selecione uma data para ver os horários</p>
              </div>
              <button onClick={() => setIsRescheduleModalOpen(false)} className="h-10 w-10 bg-slate-100 text-slate-500 rounded-full font-black flex items-center justify-center hover:bg-slate-200 transition-colors">✖</button>
            </div>
            
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-4 mb-4">
              {proximosDias.map((dia, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setSelectedDateObj(dia)}
                  className={`flex flex-col items-center justify-center min-w-[70px] p-3 rounded-2xl border-2 transition-all ${selectedDateObj?.dataString === dia.dataString ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105' : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-300 hover:bg-indigo-50'}`}
                >
                  <span className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-80">{dia.diaSemana.slice(0,3)}</span>
                  <span className="text-sm font-black">{dia.displayData.split('/')[0]}</span>
                  <span className="text-[8px] font-bold opacity-60">/{dia.displayData.split('/')[1]}</span>
                </button>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 min-h-[200px] mb-6">
              {!selectedDateObj ? (
                <div className="h-full flex flex-col items-center justify-center opacity-40 text-center py-10">
                  <span className="text-4xl mb-2">📅</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Toque em um dia acima<br/>para carregar a grade.</p>
                </div>
              ) : diaBloqueadoMsg ? (
                <div className="h-full flex flex-col items-center justify-center opacity-60 text-center py-10">
                  <span className="text-4xl mb-2">🏖️</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Escola Fechada</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">{diaBloqueadoMsg}</p>
                </div>
              ) : vagasDoDiaSelecionado.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-60 text-center py-10">
                  <span className="text-4xl mb-2">📭</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Nenhum horário livre<br/>neste dia.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                  {vagasDoDiaSelecionado.map((vaga, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setSelectedSlot(vaga)}
                      className={`w-full p-4 rounded-xl border-2 text-left flex justify-between items-center transition-all ${selectedSlot?.id === vaga.id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-white bg-white hover:border-slate-200'}`}
                    >
                      <span className={`font-black text-sm ${selectedSlot?.id === vaga.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {vaga.hora_inicio.slice(0,5)} <span className="opacity-50 text-[10px]">- {vaga.hora_fim.slice(0,5)}</span>
                      </span>
                      {selectedSlot?.id === vaga.id && <div className="h-5 w-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-sm">✓</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSolicitarReagendamento} disabled={!selectedSlot || isSubmitting || diaBloqueadoMsg !== null} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl disabled:opacity-50 hover:scale-[1.02] transition-all">
              {isSubmitting ? 'Processando...' : 'Confirmar e Enviar para Escola'}
            </button>
          </div>
        </div>
      )}

      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center z-[60] animate-in fade-in">
          <div className="bg-white p-8 rounded-t-[2.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black uppercase italic text-indigo-600">Meu Perfil</h2><button onClick={() => setIsProfileModalOpen(false)} className="h-10 w-10 bg-slate-100 text-slate-500 rounded-full font-black flex items-center justify-center hover:bg-slate-200 transition-colors">✖</button></div>
            <form onSubmit={handleAtualizarPerfil} className="space-y-5 mb-8">
              <div className="flex justify-center mb-2"><label className="cursor-pointer group relative"><div className="w-28 h-28 rounded-full border-4 border-indigo-100 overflow-hidden flex items-center justify-center shadow-lg group-hover:border-indigo-300 transition-all">{fotoPreview ? <img src={fotoPreview} className="w-full h-full object-cover" /> : <span className="text-3xl opacity-30">📷</span>}</div><div className="absolute -bottom-2 bg-indigo-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-md left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">Alterar</div><input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) { setEditFotoArquivo(e.target.files[0]); setFotoPreview(URL.createObjectURL(e.target.files[0])) } }} /></label></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Seu Nome</label><input required value={editNome} onChange={e => setEditNome(e.target.value)} className="w-full bg-transparent text-slate-800 text-sm font-black outline-none" /></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Mudar Senha</label><input type="password" minLength={6} placeholder="Deixe em branco para manter" value={editSenha} onChange={e => setEditSenha(e.target.value)} className="w-full bg-transparent text-slate-800 text-sm font-black outline-none placeholder:font-normal" /></div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50">Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {isPayHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black uppercase text-slate-800">Meus Recibos</h2><button onClick={() => setIsPayHistoryModalOpen(false)} className="h-10 w-10 bg-slate-100 text-slate-500 rounded-full font-black flex items-center justify-center hover:bg-slate-200 transition-colors">✖</button></div>
            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
              {historicoPagamentos.map(pg => {
                const [a, m, d] = pg.data_pagamento.split('T')[0].split('-').map(Number);
                const dataPg = new Date(a, m - 1, d);
                const ultimo = new Date(a, m, 0).getDate();
                const venc = new Date(a, m - 1, Math.min(infoFinanceira?.data_vencimento || 10, ultimo));
                const diff = Math.ceil((dataPg.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={pg.id} className={`p-5 rounded-2xl border-2 bg-white ${diff > 0 ? 'border-rose-100' : 'border-emerald-100'} overflow-hidden relative`}><div className="flex justify-between items-center relative z-10"><div><p className="font-black text-sm text-slate-800">{dataPg.toLocaleDateString('pt-BR')}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Via {pg.metodo_pagamento || 'N/A'}</p></div><div className="text-right"><p className="font-black text-xl text-slate-800">R$ {pg.valor}</p><p className={`text-[8px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded inline-block ${diff <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{diff <= 0 ? '✓ No Prazo' : `Atraso: ${diff}d`}</p></div></div></div>
                )
              })}
            </div>
            <button onClick={() => setIsPayHistoryModalOpen(false)} className="w-full py-4 mt-6 rounded-2xl font-black uppercase text-[10px] text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors">Fechar Histórico</button>
          </div>
        </div>
      )}

    </div>
  )
}