"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useStyles } from '../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

export default function Dashboard() {
  const { s } = useStyles()
  const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [viewMode, setViewMode] = useState<'dia' | 'semana'>('dia')

  const [dataReferencia, setDataReferencia] = useState<Date | null>(null)
  const [eventosSemana, setEventosSemana] = useState<any[]>([])
  const [historicoSemana, setHistoricoSemana] = useState<any[]>([])
  const [aulas, setAulas] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [selectedAula, setSelectedAula] = useState<any>(null)
  
  const [saudacao, setSaudacao] = useState('Olá')
  const [primeiroNome, setPrimeiroNome] = useState('')

  const diaDaSemana = dataReferencia?.getDay() || new Date().getDay()
  const diffParaSegunda = (dataReferencia?.getDate() || new Date().getDate()) - diaDaSemana + (diaDaSemana === 0 ? -6 : 1)
  const segundaFeira = new Date(dataReferencia || new Date())
  segundaFeira.setDate(diffParaSegunda)

  const diasVisuais = [0, 1, 2, 3, 4, 5].map(offset => {
    const d = new Date(segundaFeira)
    d.setDate(segundaFeira.getDate() + offset)
    const dataStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const dataHojeStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const nomes = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    return { nome: nomes[offset], dataStr: dataStr, isHoje: dataStr === dataHojeStr, display: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  })

  const hojeDate = new Date()
  const hojeDataStr = new Date(hojeDate.getTime() - (hojeDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const nomeDiaHoje = nomesDias[hojeDate.getDay()]

  const semanaAnterior = () => { if(dataReferencia) { const n = new Date(dataReferencia); n.setDate(n.getDate() - 7); setDataReferencia(n) } }
  const proximaSemana = () => { if(dataReferencia) { const n = new Date(dataReferencia); n.setDate(n.getDate() + 7); setDataReferencia(n) } }
  const semanaAtual = () => { setDataReferencia(new Date()) }

  useEffect(() => { 
    setIsMounted(true)
    setDataReferencia(new Date())
    
    const hora = new Date().getHours()
    if (hora >= 0 && hora < 12) setSaudacao('Bom dia')
    else if (hora >= 12 && hora < 18) setSaudacao('Boa tarde')
    else setSaudacao('Boa noite')
  }, [])
  
  useEffect(() => { if (isMounted && dataReferencia) carregarDados() }, [dataReferencia, isMounted]) 
  
  // 🟢 REALTIME PROFESSOR ATIVO
  useEffect(() => {
    if (!isMounted) return;
    const channel = supabase.channel('dashboard-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_reagendamento' }, () => { carregarDados(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_aulas' }, () => { carregarDados(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [isMounted]);

  async function carregarDados() {
    setLoading(true) 
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('nome_completo, role').eq('id', session.user.id).single()
    if (profile?.role === 'ALUNO') { router.push('/portal'); return }
    if (profile?.nome_completo) setPrimeiroNome(profile.nome_completo.split(' ')[0])

    const inicioDaSemana = diasVisuais[0].dataStr
    const fimDaSemana = diasVisuais[5].dataStr

    // 1. Aulas Fixas
    const { data: agenda } = await supabase.from('agenda').select(`*, aluno:profiles!aluno_id(id, nome_completo, avatar_url, alunos_info(status, data_inativacao)), sala:salas(nome)`).order('horario_inicio')
    
    // 2. Aulas Reposições (Aprovadas) - Cria os CARDS AMARELOS NA GRADE
    const { data: reposicoesAprovadas } = await supabase.from('solicitacoes_reagendamento')
      .select(`*, aluno:profiles!aluno_id(id, nome_completo, avatar_url, alunos_info(status, data_inativacao))`)
      .eq('status', 'Aprovada')
      .gte('nova_data', inicioDaSemana)
      .lte('nova_data', fimDaSemana);

    const aulasReposicao = (reposicoesAprovadas || []).map((r: any) => ({
      id: 'repo_' + r.id,
      is_reposicao: true,
      dia: r.novo_dia,
      horario_inicio: r.novo_horario_inicio,
      horario_fim: r.novo_horario_fim,
      professor_id: r.professor_id,
      aluno_id: r.aluno_id,
      aluno: r.aluno,
      sala: { nome: 'Reposição' }, 
      instrumento_aula: 'Reposição',
      data_selecionada: r.nova_data 
    }));

    const { data: ev } = await supabase.from('eventos_calendario').select('*').gte('data_evento', inicioDaSemana).lte('data_evento', fimDaSemana)
    const { data: hist } = await supabase.from('historico_aulas').select('aluno_id, data_aula, status').gte('data_aula', inicioDaSemana).lte('data_aula', fimDaSemana + 'T23:59:59')

    const { data: sol } = await supabase.from('solicitacoes_reagendamento').select('*').eq('status', 'Pendente')
    let solMapeadas = sol || []
    if (solMapeadas.length > 0) {
      const idsPerfis = Array.from(new Set([...solMapeadas.map((s:any) => s.aluno_id), ...solMapeadas.map((s:any) => s.professor_id)]))
      const { data: perfis } = await supabase.from('profiles').select('id, nome_completo').in('id', idsPerfis)
      solMapeadas = solMapeadas.map((s:any) => ({
        ...s,
        aluno_nome: perfis?.find((p:any) => p.id === s.aluno_id)?.nome_completo || 'Aluno',
        prof_nome: perfis?.find((p:any) => p.id === s.professor_id)?.nome_completo || 'Prof.'
      }))
    }
    
    setSolicitacoes(solMapeadas); setEventosSemana(ev || []); setHistoricoSemana(hist || []); 
    setAulas([...(agenda || []), ...aulasReposicao]);
    
    setLoading(false)
  }

  // APROVAR NOVA DATA (Sem mexer na grade fixa)
  const handleAprovarSolicitacao = async (sol: any) => {
    if (!confirm(`Aprovar a reposição de ${sol.aluno_nome} para ${sol.novo_dia} às ${sol.novo_horario_inicio}?`)) return;
    setIsSubmitting(true)
    
    // Atualiza a solicitação para Aprovada (Isso vai gerar o card amarelo automaticamente)
    await supabase.from('solicitacoes_reagendamento').update({ status: 'Aprovada' }).eq('id', sol.id)
    
    // Avisa o aluno
    await supabase.from('notificacoes_aluno').insert([{
      aluno_id: sol.aluno_id,
      titulo: '✅ Reposição Aprovada!',
      mensagem: `Sua reposição para o dia ${new Date(sol.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'})} às ${sol.novo_horario_inicio?.slice(0,5)} foi confirmada na agenda.`,
      lida: false
    }])

    alert("✅ Solicitação Aprovada com sucesso! A aula já está na sua grade.")
    setIsSubmitting(false); carregarDados()
  }

  const handleNegarSolicitacao = async (sol: any) => {
    const motivo = window.prompt("Qual o motivo da recusa? (O aluno receberá esta mensagem)")
    if (motivo === null) return 
    setIsSubmitting(true)
    await supabase.from('solicitacoes_reagendamento').update({ status: 'Negada', motivo_recusa: motivo || 'Horário indisponível no momento.' }).eq('id', sol.id)
    
    await supabase.from('notificacoes_aluno').insert([{
      aluno_id: sol.aluno_id,
      titulo: '❌ Reposição Recusada',
      mensagem: `Seu pedido para o dia ${new Date(sol.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'})} foi recusado. Motivo: "${motivo || 'Indisponível no momento'}".`,
      lida: false
    }])

    alert("❌ Solicitação Negada.")
    setIsSubmitting(false); carregarDados()
  }

  const handleDesmarcarAula = async () => {
    const motivo = window.prompt("Qual o motivo do cancelamento? (O aluno receberá esta mensagem)");
    if (motivo === null) return; 

    setIsSubmitting(true);
    const dataParaDesmarcar = selectedAula.data_selecionada || hojeDataStr;
    
    // Some o card da tela na hora!
    setHistoricoSemana(prev => [...prev, { aluno_id: selectedAula.aluno.id, data_aula: dataParaDesmarcar, status: 'Desmarcada' }]);
    
    await supabase.from('historico_aulas').delete().eq('aluno_id', selectedAula.aluno.id).eq('data_aula', dataParaDesmarcar);
    
    // Grava como "Desmarcada" para ocultar do painel
    await supabase.from('historico_aulas').insert([{
      aluno_id: selectedAula.aluno.id,
      data_aula: dataParaDesmarcar,
      status: 'Desmarcada',
      observacoes: motivo
    }]);

    const dataFormatada = new Date(dataParaDesmarcar).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    await supabase.from('notificacoes_aluno').insert([{
      aluno_id: selectedAula.aluno.id,
      titulo: '⚠️ Aula Desmarcada pelo Professor',
      mensagem: `Sua aula do dia ${dataFormatada} foi cancelada. Motivo: "${motivo || 'Não informado'}". A vaga ficou em aberto, acesse o portal para escolher uma nova data.`,
      lida: false
    }]);

    alert("✅ Aula cancelada com sucesso!");
    setSelectedAula(null);
    carregarDados();
    setIsSubmitting(false);
  }

  const handleRemoverDaGrade = async (id: string) => { if (!confirm("CUIDADO: Remover da grade APAGA O HORÁRIO FIXO do aluno permanentemente. Deseja continuar?")) return; await supabase.from('agenda').delete().eq('id', id); setSelectedAula(null); carregarDados() }

  if (!isMounted) return <div className="min-h-screen bg-transparent" />

  const eventosDeHoje = eventosSemana.filter(e => e.data_evento === hojeDataStr)
  const isFeriadoHoje = eventosDeHoje.some(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')

  // Oculta as Desmarcadas
  const aulasDeHoje = aulas.filter(aula => {
    if (aula.is_reposicao) return aula.data_selecionada === hojeDataStr;
    return aula.dia === nomeDiaHoje;
  }).filter(aula => {
    const info = Array.isArray(aula.aluno?.alunos_info) ? aula.aluno?.alunos_info[0] : aula.aluno?.alunos_info;
    if (info?.status === 'Inativo' && info?.data_inativacao) { if (hojeDataStr > info.data_inativacao) return false; }
    const statusHistorico = historicoSemana.find(h => String(h.aluno_id) === String(aula.aluno.id) && String(h.data_aula).startsWith(hojeDataStr))?.status;
    if (statusHistorico === 'Desmarcada') return false; 
    return true;
  })

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full">
      <motion.div variants={itemVariants} className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">Painel Central</h2>
          <p className="text-slate-500 text-sm mt-1">Gestão de grade e controle em tempo real</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="flex bg-white/40 p-1.5 rounded-2xl shadow-sm border border-white/60 w-full md:w-auto">
            <button onClick={() => { setViewMode('dia'); semanaAtual(); }} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'dia' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
              Aulas de Hoje
            </button>
            <button onClick={() => setViewMode('semana')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'semana' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
              Semana Completa
            </button>
          </div>

          <AnimatePresence>
            {viewMode === 'semana' && (
              <motion.div initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 20 }} className={`flex items-center p-2 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.05)] gap-2 w-full md:w-auto justify-center shrink-0`}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={semanaAnterior} className={`p-3 rounded-xl bg-white/50 border border-white/50 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all font-black shadow-sm`}>⬅</motion.button>
                <div className="w-40 text-center cursor-pointer" onClick={semanaAtual} title="Voltar para hoje">
                  <p className="font-bold text-slate-800 uppercase tracking-widest text-[10px] md:text-xs drop-shadow-sm whitespace-nowrap">
                    {diasVisuais[0].display} <span className="opacity-50 text-slate-500">até</span> {diasVisuais[5].display}
                  </p>
                  <p className={`text-slate-500 text-[8px] md:text-[9px] uppercase font-bold mt-0.5`}>Semana Selecionada</p>
                </div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={proximaSemana} className={`p-3 rounded-xl bg-white/50 border border-white/50 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all font-black shadow-sm`}>➡</motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {solicitacoes.length > 0 && (
        <motion.div variants={itemVariants} className={`mb-10 p-6 md:p-8 rounded-[2.5rem] border border-amber-400/50 bg-amber-500/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(245,158,11,0.1)] relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <h3 className="text-lg font-black uppercase text-amber-700 mb-6 flex items-center gap-3 relative z-10"><span className="text-2xl drop-shadow-sm">🛎️</span> Caixa de Entrada ({solicitacoes.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
            {solicitacoes.map(sol => (
              <motion.div whileHover={{ y: -4 }} key={sol.id} className={`bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all`}>
                <div className={`absolute top-0 right-0 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-sm bg-indigo-500 text-white`}>Reposição</div>
                <div>
                  <p className="font-bold text-sm uppercase mb-1 pr-24 text-slate-800">{sol.aluno_nome.split(' ')[0]}</p>
                  <p className={`text-slate-600 text-[10px] font-medium leading-tight mb-4`}>
                    Solicitou aula no dia <span className="font-bold text-indigo-700 uppercase underline">{new Date(sol.nova_data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} ({sol.novo_dia}) às {sol.novo_horario_inicio?.slice(0,5)}</span>.
                  </p>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAprovarSolicitacao(sol)} disabled={isSubmitting} className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-xl shadow-md disabled:opacity-50">Aprovar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleNegarSolicitacao(sol)} disabled={isSubmitting} className="flex-1 py-2.5 bg-white/80 text-rose-600 border border-rose-100 text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-colors disabled:opacity-50 shadow-sm">Negar</motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>
      ) : viewMode === 'dia' ? (
        
        <motion.div variants={itemVariants} className="mt-4">
          <div className="mb-10 px-2">
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight">
              {saudacao}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">{primeiroNome}</span>! 👋
            </h1>
            <p className="text-slate-500 text-lg font-medium mt-3">
              {nomeDiaHoje === 'Domingo' 
                ? "Hoje é domingo, a escola está fechada. Aproveite o descanso!" 
                : isFeriadoHoje 
                  ? "Hoje é feriado na escola. Aproveite o descanso!" 
                  : aulasDeHoje.length > 0 
                    ? `Você tem ${aulasDeHoje.length} aula${aulasDeHoje.length > 1 ? 's' : ''} programada${aulasDeHoje.length > 1 ? 's' : ''} para hoje.` 
                    : "Você não tem aulas programadas para hoje. A agenda está livre."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {aulasDeHoje.map((aula, index) => {
              const statusHistorico = historicoSemana.find(h => String(h.aluno_id) === String(aula.aluno.id) && String(h.data_aula).startsWith(hojeDataStr))?.status;

              return (
                <motion.div
                  key={aula.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className={`relative p-5 rounded-2xl bg-white/60 backdrop-blur-md border shadow-sm hover:shadow-md transition-all group overflow-hidden ${statusHistorico === 'Falta' ? 'opacity-60 border-slate-200' : 'border-white/80'}`}
                >
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${statusHistorico === 'Falta' ? 'bg-rose-500' : aula.is_reposicao ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-4 pl-3">
                    <div>
                      <p className="text-xl font-bold text-slate-800 leading-none">{aula.horario_inicio.slice(0, 5)}</p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1">Até {aula.horario_fim.slice(0, 5)}</p>
                    </div>
                    {statusHistorico && (
                      <span className={`px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-wider ${statusHistorico === 'Realizada' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : statusHistorico === 'Falta' ? 'bg-rose-50 text-rose-600 border-rose-200' : statusHistorico === 'Reposição' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {statusHistorico}
                      </span>
                    )}
                  </div>

                  <div className="pl-3">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-slate-200 border border-white shadow-inner overflow-hidden flex items-center justify-center shrink-0">
                        {aula.aluno?.avatar_url ? <img src={aula.aluno.avatar_url} className="w-full h-full object-cover" /> : <span className="font-bold text-slate-500 text-sm">{aula.aluno?.nome_completo?.charAt(0)}</span>}
                      </div>
                      <h3 className={`text-sm font-bold uppercase line-clamp-2 leading-tight ${statusHistorico === 'Falta' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                        {aula.aluno?.nome_completo}
                      </h3>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-200/60">
                      <p className={`text-xs font-semibold flex items-center gap-2 ${aula.is_reposicao ? 'text-amber-600' : 'text-slate-600'}`}>
                        <span className={aula.is_reposicao ? 'text-amber-500' : 'text-indigo-500'}>🎤</span> {aula.instrumento_aula}
                      </p>
                      <p className="text-xs font-semibold text-slate-600 flex items-center gap-2"><span className="text-indigo-500">📍</span> {aula.sala?.nome}</p>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button onClick={() => setSelectedAula({ ...aula, data_selecionada: hojeDataStr })} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-bold uppercase hover:bg-white transition-colors shadow-sm">Opções</button>
                      <button onClick={() => router.push(`/alunos/${aula.aluno.id}`)} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-bold uppercase shadow-sm hover:bg-indigo-50 transition-colors">Perfil</button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

      ) : (

        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 mt-2">
          {diasVisuais.map((dia) => {
            const eventosDoDia = eventosSemana.filter(e => e.data_evento === dia.dataStr)
            const isFeriado = eventosDoDia.some(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')

            const aulasDoDiaNaSemana = aulas.filter(aula => {
              if (aula.is_reposicao) return aula.data_selecionada === dia.dataStr;
              return aula.dia === dia.nome;
            }).filter(aula => {
              const info = Array.isArray(aula.aluno?.alunos_info) ? aula.aluno?.alunos_info[0] : aula.aluno?.alunos_info;
              if (info?.status === 'Inativo' && info?.data_inativacao && dia.dataStr > info.data_inativacao) return false; 
              const statusHistorico = historicoSemana.find(h => String(h.aluno_id) === String(aula.aluno.id) && String(h.data_aula).startsWith(dia.dataStr))?.status;
              if (statusHistorico === 'Desmarcada') return false; 
              return true;
            });

            return (
              <div key={dia.nome} className="flex flex-col">
                <div className={`mb-3 p-3 rounded-2xl bg-white/40 backdrop-blur-md border text-center transition-all shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${dia.isHoje ? 'border-t-4 border-t-emerald-500 border-white/60' : 'border-t-4 border-t-indigo-500 border-white/60'}`}>
                  <h3 className={`font-bold uppercase tracking-widest text-[10px] drop-shadow-sm ${dia.isHoje ? 'text-emerald-600' : 'text-indigo-700'}`}>{dia.nome}</h3>
                  <p className={`text-xs font-semibold mt-1 ${dia.isHoje ? 'text-emerald-600' : 'text-slate-500'}`}>{dia.display}</p>
                </div>
                
                <div className="space-y-3 flex-1 flex flex-col">
                  {isFeriado ? (
                    <div className={`p-6 rounded-2xl border border-rose-400/50 bg-rose-500/10 backdrop-blur-md text-rose-600 text-center flex flex-col items-center justify-center min-h-[150px] shadow-sm`}>
                      <span className="text-4xl mb-3 opacity-90 drop-shadow-sm">🏖️</span>
                      <p className="font-bold uppercase text-[10px] text-balance leading-tight">{eventosDoDia.find(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')?.titulo}</p>
                      <p className="text-[9px] mt-2 opacity-80 font-bold uppercase tracking-widest bg-rose-500/20 px-2 py-1 rounded border border-rose-500/30">Sem Aulas</p>
                    </div>
                  ) : aulasDoDiaNaSemana.length === 0 ? (
                    <div className="flex-1 min-h-[120px] p-4 rounded-2xl border border-dashed border-slate-300 bg-white/30 flex items-center justify-center text-center shadow-sm">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horário Livre</p>
                    </div>
                  ) : (
                    aulasDoDiaNaSemana.map((aula) => {
                      const statusHistorico = historicoSemana.find(h => String(h.aluno_id) === String(aula.aluno.id) && String(h.data_aula).startsWith(dia.dataStr))?.status

                      return (
                        <motion.div whileHover={{ scale: 1.02 }} key={aula.id} className={`bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-white/80 border-l-4 ${dia.isHoje ? 'border-l-emerald-500' : aula.is_reposicao ? 'border-l-amber-500' : 'border-l-indigo-500'} shadow-sm hover:shadow-lg transition-all relative group ${statusHistorico === 'Falta' ? 'opacity-60 hover:opacity-100' : ''}`}>
                          <div className="flex justify-between items-start mb-1">
                            <p className={`font-bold text-[9px] mb-1 ${dia.isHoje ? 'text-emerald-600' : aula.is_reposicao ? 'text-amber-600' : 'text-indigo-700'}`}>
                              {aula.horario_inicio.slice(0, 5)} - {aula.horario_fim.slice(0, 5)}
                            </p>
                            <button onClick={() => setSelectedAula({ ...aula, data_selecionada: dia.dataStr })} className={`opacity-0 group-hover:opacity-100 text-[9px] font-bold uppercase transition-opacity ${dia.isHoje ? 'text-emerald-600' : 'text-indigo-600'}`}>Editar</button>
                          </div>
                          <button onClick={() => router.push(`/alunos/${aula.aluno.id}`)} className={`font-bold text-sm uppercase text-slate-800 hover:text-indigo-600 transition-colors block w-full text-left truncate ${statusHistorico === 'Falta' ? 'line-through opacity-70' : ''}`}>
                            {aula.aluno?.nome_completo}
                          </button>
                          <p className={`text-slate-500 text-[9px] mt-2 font-semibold uppercase flex flex-col`}><span className="mb-1">🎤 {aula.instrumento_aula}</span><span>📍 {aula.sala?.nome}</span></p>
                          {statusHistorico && (
                            <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-lg text-[8px] font-bold uppercase shadow-lg border backdrop-blur-md ${statusHistorico === 'Realizada' ? 'bg-emerald-500/90 text-white border-emerald-400' : statusHistorico === 'Falta' ? 'bg-rose-500/90 text-white border-rose-400' : statusHistorico === 'Reposição' ? 'bg-amber-400/90 text-slate-900 border-amber-300' : 'bg-slate-500/90 text-white border-slate-400'}`}>
                              {statusHistorico}
                            </div>
                          )}
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedAula && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`bg-white/70 backdrop-blur-2xl border border-white/60 border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative`}>
              <h2 className={`text-xl font-bold mb-6 text-slate-800 tracking-tight text-center`}>Opções do Horário</h2>
              <div className="flex flex-col gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => router.push(`/alunos/${selectedAula.aluno.id}`)} className={`py-4 rounded-2xl bg-indigo-600 text-white font-bold uppercase shadow-md text-xs hover:bg-indigo-500 transition-all`}>
                  Acessar Perfil do Aluno
                </motion.button>
                
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleDesmarcarAula} disabled={isSubmitting} className={`py-4 rounded-2xl bg-amber-500 text-white font-bold uppercase shadow-sm border text-xs hover:bg-amber-600 transition-all disabled:opacity-50`}>
                  Desmarcar Aula do Dia
                </motion.button>

                {!selectedAula.is_reposicao && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleRemoverDaGrade(selectedAula.id)} className={`py-4 rounded-2xl bg-rose-50 text-rose-600 font-bold uppercase shadow-sm border border-rose-100 text-xs hover:bg-rose-500 hover:text-white transition-all`}>
                    Remover Grade Fixa
                  </motion.button>
                )}

                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelectedAula(null)} className={`py-4 rounded-2xl font-bold uppercase text-slate-600 hover:bg-white transition-all text-xs border border-white/80 shadow-sm mt-2`}>
                  Fechar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}