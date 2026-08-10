"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useStyles } from '../lib/useStyles'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  MapPin,
  Mic2,
  MoreHorizontal,
  RotateCcw,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

function localISODate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

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
  const [turmaAulasSemana, setTurmaAulasSemana] = useState<any[]>([])
  const [aulas, setAulas] = useState<any[]>([])
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [aulasPendentesBaixa, setAulasPendentesBaixa] = useState<any[]>([]) 
  
  const [selectedAula, setSelectedAula] = useState<any>(null)
  const [aulaParaDarBaixa, setAulaParaDarBaixa] = useState<any>(null) 
  const [obsBaixa, setObsBaixa] = useState('') 
  
  const [painelLateral, setPainelLateral] = useState<'solicitacoes' | 'diario'>('solicitacoes')
  const [solicitacaoParaNegar, setSolicitacaoParaNegar] = useState<any>(null)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  
  const [saudacao, setSaudacao] = useState('Olá')
  const [primeiroNome, setPrimeiroNome] = useState('')

  const [currentTime, setCurrentTime] = useState(new Date())

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

    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [])
  
  useEffect(() => { if (isMounted && dataReferencia) carregarDados() }, [dataReferencia, isMounted]) 
  
  useEffect(() => {
    if (!isMounted) return;
    const channel = supabase
      .channel('dashboard-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_reagendamento' }, () => { carregarDados(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_aulas' }, () => { carregarDados(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turma_aulas' }, () => { carregarDados(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aulas_experimentais' }, () => { carregarDados(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return
    const refreshExperimentalClasses = () => carregarDados()
    window.addEventListener('lotus:aula-experimental-salva', refreshExperimentalClasses)
    return () => window.removeEventListener('lotus:aula-experimental-salva', refreshExperimentalClasses)
  }, [isMounted, dataReferencia])

  async function carregarDados() {
    setLoading(true) 
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('nome_completo, role').eq('id', session.user.id).single()
    if (profile?.role === 'ALUNO') { router.push('/portal'); return }
    if (profile?.nome_completo) setPrimeiroNome(profile.nome_completo.split(' ')[0])

    const inicioDaSemana = diasVisuais[0].dataStr
    const fimDaSemana = diasVisuais[5].dataStr
    const inicioPendenciasDate = new Date()
    inicioPendenciasDate.setDate(inicioPendenciasDate.getDate() - 35)
    const inicioPendencias = localISODate(inicioPendenciasDate)
    const inicioConsulta = inicioDaSemana < inicioPendencias ? inicioDaSemana : inicioPendencias
    const fimConsulta = fimDaSemana > hojeDataStr ? fimDaSemana : hojeDataStr

    const { data: agenda } = await supabase.from('agenda').select(`*, aluno:profiles!aluno_id(id, nome_completo, avatar_url, created_at, alunos_info(status, data_inativacao)), sala:salas(nome)`).order('horario_inicio')
    const { data: turmasAtivas } = await supabase
      .from('turmas')
      .select('*, professor:profiles!professor_id(nome_completo), turma_alunos(id, status)')
      .eq('status', 'ATIVA')
      .order('horario_inicio')
    const aulasTurma = (turmasAtivas || []).map((turma: any) => ({
      id: `turma_${turma.id}`,
      turma_id: turma.id,
      is_turma: true,
      dia: turma.dia,
      horario_inicio: turma.horario_inicio,
      horario_fim: turma.horario_fim,
      professor_id: turma.professor_id,
      aluno_id: null,
      aluno: {
        id: `turma_${turma.id}`,
        nome_completo: turma.nome,
        avatar_url: null,
        alunos_info: { status: 'Ativo' },
      },
      sala: { nome: turma.endereco },
      instrumento_aula: turma.modalidade,
      participantes: (turma.turma_alunos || []).filter((item: any) => item.status === 'ATIVO').length,
      criado_em: turma.criado_em,
    }))

    const { data: experimentalRows } = await supabase
      .from('aulas_experimentais')
      .select('*')
      .gte('data_aula', inicioConsulta)
      .lte('data_aula', fimConsulta)
      .order('horario_inicio')
    const { data: experimentalRooms } = await supabase.from('salas').select('id, nome')

    const aulasExperimentais = (experimentalRows || []).map((experimental: any) => ({
      id: `experimental_${experimental.id}`,
      experimental_id: experimental.id,
      is_experimental: true,
      experimental_status: experimental.status,
      experimental_record: experimental,
      data_selecionada: String(experimental.data_aula).slice(0, 10),
      horario_inicio: experimental.horario_inicio,
      horario_fim: experimental.horario_fim,
      professor_id: experimental.professor_id,
      aluno_id: experimental.aluno_id || null,
      aluno: {
        id: experimental.aluno_id || null,
        nome_completo: experimental.nome,
        avatar_url: null,
        alunos_info: { status: 'Ativo' },
      },
      sala: experimentalRooms?.find((room: any) => String(room.id) === String(experimental.sala_id)) || { nome: 'Local a definir' },
      instrumento_aula: experimental.modalidade || 'Aula experimental',
    }))
    
    const { data: reposicoesAprovadas } = await supabase.from('solicitacoes_reagendamento')
      .select(`*, aluno:profiles!aluno_id(id, nome_completo, avatar_url, alunos_info(status, data_inativacao))`)
      .eq('status', 'Aprovada')
      .gte('nova_data', inicioConsulta)
      .lte('nova_data', fimConsulta);

    const aulasReposicao = (reposicoesAprovadas || []).filter((r: any) => r.tipo_mudanca !== 'Fixa').map((r: any) => {
      const aulaOriginal = (agenda || []).find((a: any) => String(a.id) === String(r.agenda_original_id))
      const isReposicao = r.tipo_mudanca === 'Reposição'

      return {
        id: 'repo_' + r.id,
        is_reposicao: isReposicao,
        is_remarcacao: !isReposicao,
        dia: r.novo_dia,
        horario_inicio: r.novo_horario_inicio,
        horario_fim: r.novo_horario_fim,
        professor_id: r.professor_id,
        aluno_id: r.aluno_id,
        aluno: r.aluno,
        sala: aulaOriginal?.sala || { nome: isReposicao ? 'Reposição' : 'Horário aprovado' },
        instrumento_aula: aulaOriginal?.instrumento_aula || (isReposicao ? 'Reposição' : 'Aula remarcada'),
        data_selecionada: r.nova_data
      }
    });

    const { data: ev } = await supabase.from('eventos_calendario').select('*').gte('data_evento', inicioConsulta).lte('data_evento', fimConsulta)
    const { data: hist } = await supabase.from('historico_aulas').select('aluno_id, data_aula, horario_inicio, status').gte('data_aula', inicioConsulta).lte('data_aula', fimConsulta + 'T23:59:59')
    const { data: turmaHist } = await supabase
      .from('turma_aulas')
      .select('id, turma_id, data_aula, status')
      .gte('data_aula', inicioConsulta)
      .lte('data_aula', fimConsulta)

    // 🔥 BUSCA BLINDADA DE SOLICITAÇÕES (Aceita maiúsculas, minúsculas e evita falhas de ID nulo)
    const { data: sol } = await supabase.from('solicitacoes_reagendamento').select('*').in('status', ['Pendente', 'pendente', 'PENDENTE'])
    let solMapeadas = sol || []
    
    if (solMapeadas.length > 0) {
      const idsPerfis = Array.from(new Set([
        ...solMapeadas.map((s:any) => s.aluno_id), 
        ...solMapeadas.map((s:any) => s.professor_id)
      ])).filter(Boolean)

      if (idsPerfis.length > 0) {
          const { data: perfis } = await supabase.from('profiles').select('id, nome_completo').in('id', idsPerfis)
          solMapeadas = solMapeadas.map((s:any) => ({
            ...s,
            aluno_nome: perfis?.find((p:any) => p.id === s.aluno_id)?.nome_completo || 'Aluno Desconhecido',
            prof_nome: perfis?.find((p:any) => p.id === s.professor_id)?.nome_completo || 'Professor Desconhecido'
          }))
      }
    }

    const pendentesParaLancar: any[] = [];
    const agora = new Date();
    const diasParaPendencias: Array<{ nome: string; dataStr: string }> = []
    const cursorPendencias = new Date(`${inicioPendencias}T12:00:00`)
    const limitePendencias = new Date(`${hojeDataStr}T12:00:00`)
    while (cursorPendencias <= limitePendencias) {
      const weekday = cursorPendencias.getDay()
      if (weekday >= 1 && weekday <= 6) {
        diasParaPendencias.push({
          nome: nomesDias[weekday],
          dataStr: localISODate(cursorPendencias),
        })
      }
      cursorPendencias.setDate(cursorPendencias.getDate() + 1)
    }

    diasParaPendencias.forEach(diaVisual => {
      const isFeriado = (ev || []).some(e => e.data_evento === diaVisual.dataStr && (e.tipo === 'Feriado' || e.tipo === 'Recesso'));
      if (isFeriado) return;

      const aulasDoDia = [...(agenda || []), ...aulasTurma].filter(a => a.dia === diaVisual.nome);
      const reposicoesDoDia = aulasReposicao.filter(r => r.data_selecionada === diaVisual.dataStr);
      const experimentaisDoDia = aulasExperimentais.filter(a => a.data_selecionada === diaVisual.dataStr)
      const todasAsAulasDoDia = [...aulasDoDia, ...reposicoesDoDia, ...experimentaisDoDia];

      todasAsAulasDoDia.forEach(aula => {
        const inicioDoVinculo = String(aula.criado_em || aula.created_at || aula.aluno?.created_at || '').slice(0, 10)
        if (inicioDoVinculo && diaVisual.dataStr < inicioDoVinculo) return
        const info = Array.isArray(aula.aluno?.alunos_info) ? aula.aluno?.alunos_info[0] : aula.aluno?.alunos_info;
        if (info?.status === 'Inativo' && info?.data_inativacao && diaVisual.dataStr > info.data_inativacao) return;

        try {
          const [ano, mes, dia] = diaVisual.dataStr.split('-').map(Number);
          const horarioParaCalculo = aula.horario_fim || '23:59';
          const [h, m] = horarioParaCalculo.split(':').map(Number);
          const endDateTime = new Date(ano, mes - 1, dia, h, m);

          if (agora > endDateTime) {
            const jaTemHistorico = aula.is_experimental
              ? aula.experimental_status !== 'AGENDADA'
              : aula.is_turma
              ? (turmaHist || []).some((item: any) => item.turma_id === aula.turma_id && String(item.data_aula).startsWith(diaVisual.dataStr))
              : (hist || []).some(hItem => {
                  const sameStudentAndDate = String(hItem.aluno_id) === String(aula.aluno_id)
                    && String(hItem.data_aula).startsWith(diaVisual.dataStr)
                  const historyTime = String(hItem.horario_inicio || '').slice(0, 5)
                  const classTime = String(aula.horario_inicio || '').slice(0, 5)
                  return sameStudentAndDate && (!historyTime || !classTime || historyTime === classTime)
                });
            if (!jaTemHistorico) {
              pendentesParaLancar.push({ ...aula, data_selecionada: diaVisual.dataStr });
            }
          }
        } catch (e) {
           console.error("Aviso: Falha ao calcular data da aula (possivelmente dados incompletos):", e)
        }
      });
    });

    pendentesParaLancar.sort((a, b) => {
      const horaA = a.horario_inicio || '00:00';
      const horaB = b.horario_inicio || '00:00';
      const dateA = new Date(`${a.data_selecionada}T${horaA}:00`).getTime();
      const dateB = new Date(`${b.data_selecionada}T${horaB}:00`).getTime();
      return dateA - dateB;
    });

    setAulasPendentesBaixa(pendentesParaLancar);
    setSolicitacoes(solMapeadas); 
    setEventosSemana(ev || []); 
    setHistoricoSemana(hist || []); 
    setTurmaAulasSemana(turmaHist || [])
    setAulas([...(agenda || []), ...aulasReposicao, ...aulasTurma, ...aulasExperimentais]);
    
    setLoading(false)
  }

  const handleDarBaixa = async (status: 'Realizada' | 'Falta Justificada' | 'Falta Injustificada') => {
    setIsSubmitting(true);

    if (aulaParaDarBaixa?.is_experimental) {
      const experimental = aulaParaDarBaixa.experimental_record || {}
      const alunoId = aulaParaDarBaixa.aluno_id || experimental.aluno_id || null
      const compareceu = status === 'Realizada'
      const observacoes = obsBaixa.trim() || (compareceu
        ? 'Interessado compareceu à aula experimental.'
        : 'Interessado não compareceu à aula experimental.')
      let historicoAulaId = experimental.historico_aula_id || null
      let avisoFaturamento = ''

      if (
        compareceu
        && alunoId
        && experimental.cobrar_na_matricula
        && !historicoAulaId
        && Number(experimental.valor_cobranca) > 0
      ) {
        const { data: historicoExperimental, error: historicoError } = await supabase
          .from('historico_aulas')
          .insert({
            aluno_id: alunoId,
            data_aula: aulaParaDarBaixa.data_selecionada,
            horario_inicio: aulaParaDarBaixa.horario_inicio || null,
            horario_fim: aulaParaDarBaixa.horario_fim || null,
            status: 'Realizada',
            observacoes,
            professor_id: aulaParaDarBaixa.professor_id || null,
            modalidade: aulaParaDarBaixa.instrumento_aula || 'Aula experimental',
            valor_aula_faturado: Number(experimental.valor_cobranca),
          })
          .select('id')
          .single()

        if (historicoError || !historicoExperimental) {
          setIsSubmitting(false)
          return alert(`Não foi possível registrar a aula experimental no histórico: ${historicoError?.message || 'registro não retornado'}`)
        }

        historicoAulaId = String(historicoExperimental.id)
        const { data: { session } } = await supabase.auth.getSession()
        const vencimentoPadrao = new Date()
        vencimentoPadrao.setDate(vencimentoPadrao.getDate() + 7)

        if (!session) {
          avisoFaturamento = 'A presença foi registrada, mas a fatura ficou pendente para emissão manual.'
        } else {
          try {
            const invoiceResponse = await fetch('/api/faturamento/faturas', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                alunoId,
                historicoAulaIds: [historicoAulaId],
                dataVencimento: experimental.vencimento_cobranca || localISODate(vencimentoPadrao),
                valorUnitario: Number(experimental.valor_cobranca),
                observacoes: 'Fatura da aula experimental confirmada após a matrícula.',
              }),
            })

            if (!invoiceResponse.ok) {
              avisoFaturamento = 'A presença foi registrada, mas a fatura ficou pendente para emissão manual.'
            }
          } catch {
            avisoFaturamento = 'A presença foi registrada, mas a fatura ficou pendente para emissão manual.'
          }
        }
      }

      const { error } = await supabase
        .from('aulas_experimentais')
        .update({
          status: compareceu ? (alunoId ? 'MATRICULADA' : 'REALIZADA') : 'FALTOU',
          observacoes,
          historico_aula_id: historicoAulaId,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', aulaParaDarBaixa.experimental_id)
      setIsSubmitting(false)
      if (error) return alert(`Não foi possível registrar a aula experimental: ${error.message}`)
      setAulaParaDarBaixa(null)
      setObsBaixa('')
      await carregarDados()
      if (avisoFaturamento) alert(avisoFaturamento)
      return
    }

    if (aulaParaDarBaixa?.is_turma) {
      if (status !== 'Realizada') {
        setIsSubmitting(false)
        return alert('A turma é lançada como realizada para todos. Faltas individuais podem ser anotadas depois no perfil do aluno.')
      }
      const { error } = await supabase.rpc('registrar_aula_turma', {
        p_turma_id: aulaParaDarBaixa.turma_id,
        p_data_aula: aulaParaDarBaixa.data_selecionada,
        p_observacoes: obsBaixa.trim() || null,
      })
      if (error) {
        setIsSubmitting(false)
        return alert(`Não foi possível registrar a aula da turma: ${error.message}`)
      }
      setAulaParaDarBaixa(null)
      setObsBaixa('')
      setIsSubmitting(false)
      await carregarDados()
      return
    }
    
    setHistoricoSemana(prev => [...prev, { 
      aluno_id: aulaParaDarBaixa.aluno_id, 
      data_aula: aulaParaDarBaixa.data_selecionada, 
      status: status 
    }]);

    let obsPadrao = 'Aula realizada sem observações.';
    if (status === 'Falta Justificada') obsPadrao = 'Falta justificada pelo aluno.';
    if (status === 'Falta Injustificada') obsPadrao = 'Falta sem aviso prévio.';

    const { error } = await supabase.from('historico_aulas').insert([{
      aluno_id: aulaParaDarBaixa.aluno_id,
      data_aula: aulaParaDarBaixa.data_selecionada,
      horario_inicio: aulaParaDarBaixa.horario_inicio || null,
      horario_fim: aulaParaDarBaixa.horario_fim || null,
      status: status,
      observacoes: obsBaixa || obsPadrao,
      professor_id: aulaParaDarBaixa.professor_id || null,
      modalidade: aulaParaDarBaixa.instrumento_aula || null,
    }]);

    if (error) {
      alert("🚨 Erro ao lançar aula: " + error.message);
    } else {
      setAulasPendentesBaixa(prev => prev.filter(a => !(a.id === aulaParaDarBaixa.id && a.data_selecionada === aulaParaDarBaixa.data_selecionada)));
    }

    setAulaParaDarBaixa(null);
    setObsBaixa('');
    setIsSubmitting(false);
  }

  const handleAprovarSolicitacao = async (sol: any) => {
    setIsSubmitting(true)
    const isReposicao = sol.tipo_mudanca === 'Reposição'
    const isMudancaFixa = sol.tipo_mudanca === 'Fixa'

    // Para Créditos e Mês fechado, a aula original só é desmarcada quando
    // a escola aprova a troca. Assim, uma recusa preserva o horário original.
    if (!isReposicao && !isMudancaFixa && sol.data_aula_original) {
      const { data: aulaOriginal } = await supabase
        .from('agenda')
        .select('horario_inicio, horario_fim, instrumento_aula, professor_id')
        .eq('id', sol.agenda_original_id)
        .maybeSingle()

      await supabase
        .from('historico_aulas')
        .delete()
        .eq('aluno_id', sol.aluno_id)
        .eq('data_aula', sol.data_aula_original)

      const { error: historicoError } = await supabase.from('historico_aulas').insert([{
        aluno_id: sol.aluno_id,
        data_aula: sol.data_aula_original,
        horario_inicio: aulaOriginal?.horario_inicio || null,
        horario_fim: aulaOriginal?.horario_fim || null,
        status: 'Desmarcada',
        observacoes: 'Mudança de horário aprovada pela escola.',
        professor_id: aulaOriginal?.professor_id || sol.professor_id || null,
        modalidade: aulaOriginal?.instrumento_aula || null,
      }])

      if (historicoError) {
        alert('Não foi possível liberar o horário original: ' + historicoError.message)
        setIsSubmitting(false)
        return
      }
    }

    if (isMudancaFixa) {
      const { error: agendaError } = await supabase
        .from('agenda')
        .update({
          dia: sol.novo_dia,
          horario_inicio: sol.novo_horario_inicio,
          horario_fim: sol.novo_horario_fim,
        })
        .eq('id', sol.agenda_original_id)

      if (agendaError) {
        alert('Não foi possível atualizar o horário fixo: ' + agendaError.message)
        setIsSubmitting(false)
        return
      }
    }

    const { error: aprovacaoError } = await supabase.from('solicitacoes_reagendamento').update({ status: 'Aprovada' }).eq('id', sol.id)
    if (aprovacaoError) {
      alert('Não foi possível aprovar a solicitação: ' + aprovacaoError.message)
      setIsSubmitting(false)
      return
    }

    await supabase.from('notificacoes_aluno').insert([{
      aluno_id: sol.aluno_id,
      titulo: isMudancaFixa ? '✅ Novo horário fixo aprovado' : isReposicao ? '✅ Reposição aprovada' : '✅ Aula remarcada',
      mensagem: isMudancaFixa
        ? `Seu horário fixo foi alterado para ${sol.novo_dia}, das ${sol.novo_horario_inicio?.slice(0,5)} às ${sol.novo_horario_fim?.slice(0,5)}.`
        : `${isReposicao ? 'Sua reposição' : 'Sua nova aula'} para o dia ${sol.nova_data ? new Date(sol.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'indefinido'} às ${sol.novo_horario_inicio?.slice(0,5)} foi confirmada na agenda.`,
      lida: false
    }])
    
    setSolicitacoes(prev => prev.filter(s => s.id !== sol.id))
    setIsSubmitting(false); 
    carregarDados();
  }

  const handleNegarSolicitacao = async (sol: any) => {
    const motivo = motivoRecusa.trim() || 'Horário indisponível no momento.'
    setIsSubmitting(true)
    const isReposicao = sol.tipo_mudanca === 'Reposição'
    const isMudancaFixa = sol.tipo_mudanca === 'Fixa'
    await supabase.from('solicitacoes_reagendamento').update({ status: 'Negada', motivo_recusa: motivo }).eq('id', sol.id)
    await supabase.from('notificacoes_aluno').insert([{
      aluno_id: sol.aluno_id,
      titulo: isMudancaFixa ? '❌ Mudança de horário fixo recusada' : isReposicao ? '❌ Reposição recusada' : '❌ Remarcação recusada',
      mensagem: isMudancaFixa
        ? `Seu pedido para mudar o horário fixo para ${sol.novo_dia}, às ${sol.novo_horario_inicio?.slice(0,5)}, foi recusado. Motivo: "${motivo}".`
        : `Seu pedido para o dia ${sol.nova_data ? new Date(sol.nova_data).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'indefinido'} foi recusado. Motivo: "${motivo}".`,
      lida: false
    }])
    
    setSolicitacoes(prev => prev.filter(s => s.id !== sol.id))
    setSolicitacaoParaNegar(null)
    setMotivoRecusa('')
    setIsSubmitting(false); 
    carregarDados();
  }

  const handleDesmarcarAula = async () => {
    const motivo = window.prompt("Qual o motivo do cancelamento? (O aluno receberá esta mensagem)");
    if (motivo === null) return; 

    setIsSubmitting(true);
    const dataParaDesmarcar = selectedAula.data_selecionada || hojeDataStr;

    if (selectedAula.is_experimental) {
      const { error } = await supabase
        .from('aulas_experimentais')
        .update({ status: 'CANCELADA', observacoes: motivo || 'Aula experimental cancelada.', atualizado_em: new Date().toISOString() })
        .eq('id', selectedAula.experimental_id)
      setIsSubmitting(false)
      if (error) return alert(`Não foi possível cancelar a aula experimental: ${error.message}`)
      setSelectedAula(null)
      await carregarDados()
      return
    }
    
    setHistoricoSemana(prev => [...prev, { aluno_id: selectedAula.aluno.id, data_aula: dataParaDesmarcar, status: 'Desmarcada' }]);
    await supabase.from('historico_aulas').delete().eq('aluno_id', selectedAula.aluno.id).eq('data_aula', dataParaDesmarcar);
    const { error: errInsert } = await supabase.from('historico_aulas').insert([{
      aluno_id: selectedAula.aluno.id,
      data_aula: dataParaDesmarcar,
      horario_inicio: selectedAula.horario_inicio || null,
      horario_fim: selectedAula.horario_fim || null,
      status: 'Desmarcada',
      observacoes: motivo,
      professor_id: selectedAula.professor_id || null,
      modalidade: selectedAula.instrumento_aula || null,
    }]);

    if (errInsert) { alert("🚨 O banco de dados bloqueou o salvamento! Erro: " + errInsert.message); carregarDados(); setIsSubmitting(false); return; }

    const dataFormatada = new Date(dataParaDesmarcar).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    await supabase.from('notificacoes_aluno').insert([{ aluno_id: selectedAula.aluno.id, titulo: '⚠️ Aula Desmarcada pelo Professor', mensagem: `Sua aula do dia ${dataFormatada} foi cancelada. Motivo: "${motivo || 'Não informado'}". A vaga ficou em aberto, acesse o portal para escolher uma nova data.`, lida: false }]);

    alert("✅ Aula cancelada com sucesso!");
    setSelectedAula(null); carregarDados(); setIsSubmitting(false);
  }

  const handleRemoverDaGrade = async (id: string) => { if (!confirm("Encerrar este horário recorrente? As próximas aulas deixarão de aparecer na agenda, mas todo o histórico já registrado será preservado.")) return; await supabase.from('agenda').delete().eq('id', id); setSelectedAula(null); carregarDados() }

  const checkIfClassPast = (dateStr: string, endTimeStr: string) => {
    try {
      if (!dateStr || !endTimeStr) return false;
      const classDateObj = new Date(`${dateStr}T00:00:00`);
      const todayObj = new Date(`${hojeDataStr}T00:00:00`);

      if (classDateObj < todayObj) return true;
      if (classDateObj > todayObj) return false;

      const [h, m] = endTimeStr.split(':').map(Number);
      const classEndDateTime = new Date();
      classEndDateTime.setHours(h, m, 0, 0);
      
      return currentTime > classEndDateTime;
    } catch (e) { return false; }
  }

  const checkIfClassStarted = (dateStr: string, startTimeStr: string) => {
    try {
      if (!dateStr || !startTimeStr) return false
      const classDateObj = new Date(`${dateStr}T00:00:00`)
      const todayObj = new Date(`${hojeDataStr}T00:00:00`)

      if (classDateObj < todayObj) return true
      if (classDateObj > todayObj) return false

      const [hours, minutes] = startTimeStr.split(':').map(Number)
      const classStartDateTime = new Date()
      classStartDateTime.setHours(hours, minutes, 0, 0)
      return currentTime >= classStartDateTime
    } catch (e) { return false }
  }

  const getAulaStatus = (aula: any, dateStr: string) => {
    if (aula?.is_experimental) {
      if (aula.experimental_status === 'REALIZADA' || aula.experimental_status === 'MATRICULADA') return 'Realizada'
      if (aula.experimental_status === 'FALTOU') return 'Falta Injustificada'
      if (aula.experimental_status === 'CANCELADA') return 'Desmarcada'
      return null
    }
    if (aula?.is_turma) {
      const groupLesson = turmaAulasSemana.find(
        (item) => item.turma_id === aula.turma_id && String(item.data_aula).startsWith(dateStr),
      )
      return groupLesson?.status === 'REALIZADA' ? 'Realizada' : groupLesson?.status
    }
    return historicoSemana.find(
      (item) => String(item.aluno_id) === String(aula.aluno?.id) && String(item.data_aula).startsWith(dateStr),
    )?.status
  }

  const abrirEntidadeAula = (aula: any) => {
    if (aula?.is_experimental) {
      if (aula.aluno_id) router.push(`/alunos/${aula.aluno_id}`)
      else setSelectedAula({ ...aula, data_selecionada: aula.data_selecionada })
      return
    }
    router.push(aula?.is_turma ? '/turmas' : `/alunos/${aula.aluno.id}`)
  }

  const abrirDetalhesAula = (aula: any, dateStr: string) => {
    if (aula?.is_turma) {
      router.push('/turmas')
      return
    }
    setSelectedAula({ ...aula, data_selecionada: dateStr })
  }

  if (!isMounted) return <div className="min-h-screen bg-transparent" />

  const eventosDeHoje = eventosSemana.filter(e => e.data_evento === hojeDataStr)
  const isFeriadoHoje = eventosDeHoje.some(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')

  // 🔥 ORDENAÇÃO APLICADA AQUI
  const aulasDeHoje = aulas.filter(aula => {
    if (aula.is_experimental) return aula.data_selecionada === hojeDataStr
    if (aula.is_reposicao || aula.is_remarcacao) return aula.data_selecionada === hojeDataStr;
    return aula.dia === nomeDiaHoje;
  }).filter(aula => {
    const info = Array.isArray(aula.aluno?.alunos_info) ? aula.aluno?.alunos_info[0] : aula.aluno?.alunos_info;
    if (info?.status === 'Inativo' && info?.data_inativacao) { if (hojeDataStr > info.data_inativacao) return false; }
    const statusHistorico = getAulaStatus(aula, hojeDataStr);
    if (statusHistorico === 'Desmarcada') return false; 
    return true;
  }).sort((a, b) => {
    const horaA = a.horario_inicio || '00:00';
    const horaB = b.horario_inicio || '00:00';
    return horaA.localeCompare(horaB);
  })

  const getStatusColor = (status: string) => {
    if (status === 'Realizada') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    if (status === 'Falta Injustificada' || status === 'Falta') return 'bg-rose-50 text-rose-600 border-rose-200';
    if (status === 'Falta Justificada') return 'bg-orange-50 text-orange-600 border-orange-200';
    if (status === 'Reposição') return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  const agendaHorizontal = diasVisuais.map(dia => {
    const eventosDoDia = eventosSemana.filter(e => e.data_evento === dia.dataStr)
    const eventoEspecial = eventosDoDia.find(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')
    const aulasDoDia = aulas.filter(aula => {
      if (aula.is_experimental) return aula.data_selecionada === dia.dataStr
      if (aula.is_reposicao || aula.is_remarcacao) return aula.data_selecionada === dia.dataStr
      return aula.dia === dia.nome
    }).filter(aula => {
      const info = Array.isArray(aula.aluno?.alunos_info) ? aula.aluno?.alunos_info[0] : aula.aluno?.alunos_info
      if (info?.status === 'Inativo' && info?.data_inativacao && dia.dataStr > info.data_inativacao) return false
      const statusHistorico = getAulaStatus(aula, dia.dataStr)
      return statusHistorico !== 'Desmarcada'
    }).sort((a, b) => (a.horario_inicio || '00:00').localeCompare(b.horario_inicio || '00:00'))

    return { ...dia, eventoEspecial, aulas: eventoEspecial ? [] : aulasDoDia }
  })
  const iniciosDaSemana = agendaHorizontal.flatMap(dia => dia.aulas.map((aula: any) => Number(String(aula.horario_inicio || '08:00').slice(0, 2))))
  const primeiraHoraAgenda = iniciosDaSemana.length > 0 ? Math.max(6, Math.min(8, Math.min(...iniciosDaSemana))) : 8
  const ultimaHoraAgenda = iniciosDaSemana.length > 0 ? Math.min(23, Math.max(21, Math.max(...iniciosDaSemana))) : 21
  const horasAgendaSemana = Array.from({ length: ultimaHoraAgenda - primeiraHoraAgenda + 1 }, (_, index) => primeiraHoraAgenda + index)
  const selectedAulaDate = selectedAula?.data_selecionada || hojeDataStr
  const selectedAulaStatus = selectedAula ? getAulaStatus(selectedAula, selectedAulaDate) : null
  const selectedAulaCanRegister = Boolean(
    selectedAula
    && !selectedAulaStatus
    && checkIfClassStarted(selectedAulaDate, selectedAula.horario_inicio),
  )

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-[1500px] mx-auto pb-6">
      <motion.header variants={itemVariants} className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <div className="premium-kicker mb-2">Operação diária</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {saudacao}, <span className="text-[#1f4a3a]">{primeiroNome}</span>.
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 capitalize">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          {viewMode === 'semana' && (
            <div className="flex items-center justify-between rounded-xl border border-[#dfded7] bg-white p-1">
              <button aria-label="Semana anterior" onClick={semanaAnterior} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#f3f4ef] hover:text-[#1f4a3a] transition-colors">
                <ChevronLeft size={17} />
              </button>
              <button onClick={semanaAtual} className="px-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                {diasVisuais[0].display} — {diasVisuais[5].display}
              </button>
              <button aria-label="Próxima semana" onClick={proximaSemana} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#f3f4ef] hover:text-[#1f4a3a] transition-colors">
                <ChevronRight size={17} />
              </button>
            </div>
          )}
          <div className="flex rounded-xl border border-[#dfded7] bg-white p-1 w-full sm:w-auto">
            <button
              onClick={() => { setViewMode('dia'); semanaAtual() }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'dia' ? 'bg-[#1f4a3a] text-white' : 'text-slate-500 hover:bg-[#f3f4ef]'}`}
            >
              Hoje
            </button>
            <button
              onClick={() => setViewMode('semana')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'semana' ? 'bg-[#1f4a3a] text-white' : 'text-slate-500 hover:bg-[#f3f4ef]'}`}
            >
              Semana
            </button>
          </div>
        </div>
      </motion.header>

      {loading ? (
        <div className="premium-panel flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-[#1f4a3a]" />
        </div>
      ) : viewMode === 'dia' ? (
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          <section className="premium-panel overflow-hidden xl:h-[calc(100vh-190px)] min-h-[520px] flex flex-col">
            <div className="px-5 py-4 border-b border-[#dfded7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                  <CalendarDays size={19} className="text-[#1f4a3a]" />
                  Agenda de hoje
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {nomeDiaHoje === 'Domingo'
                    ? 'A escola está fechada aos domingos.'
                    : isFeriadoHoje
                      ? 'Dia sem aulas por feriado ou recesso.'
                      : `${aulasDeHoje.length} aula${aulasDeHoje.length === 1 ? '' : 's'} programada${aulasDeHoje.length === 1 ? '' : 's'}.`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full bg-[#1f4a3a]" />
                Horário atual: {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {(nomeDiaHoje === 'Domingo' || isFeriadoHoje || aulasDeHoje.length === 0) ? (
                <div className="h-full min-h-80 flex flex-col items-center justify-center text-center px-8">
                  <CalendarDays size={30} strokeWidth={1.5} className="text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-700">Agenda livre</p>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">
                    {isFeriadoHoje ? eventosDeHoje[0]?.titulo || 'Hoje não haverá aulas.' : 'Nenhuma aula programada para hoje.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#ebe9e3]">
                  {aulasDeHoje.map((aula, index) => {
                    const statusHistorico = getAulaStatus(aula, hojeDataStr)
                    const isPast = checkIfClassPast(hojeDataStr, aula.horario_fim)
                    const hasStarted = checkIfClassStarted(hojeDataStr, aula.horario_inicio)
                    const isPendenteDeBaixa = isPast && !statusHistorico
                    const canRegister = hasStarted && !statusHistorico
                    const isCurrent = !isPast && (() => {
                      const [h, m] = (aula.horario_inicio || '00:00').split(':').map(Number)
                      const [endH, endM] = (aula.horario_fim || '23:59').split(':').map(Number)
                      const minutes = currentTime.getHours() * 60 + currentTime.getMinutes()
                      return minutes >= h * 60 + m && minutes <= endH * 60 + endM
                    })()

                    return (
                      <motion.article
                        key={`${aula.id}-${index}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`grid grid-cols-[64px_22px_minmax(0,1fr)] sm:grid-cols-[72px_24px_minmax(0,1fr)_auto] gap-x-3 px-4 sm:px-5 py-4 hover:bg-[#faf9f6] transition-colors ${isCurrent ? 'bg-[#f1f6f2]' : ''}`}
                      >
                        <div className="pt-0.5 text-right">
                          <p className={`text-base font-semibold ${isPast ? 'text-slate-400' : 'text-slate-900'}`}>{aula.horario_inicio?.slice(0, 5)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{aula.horario_fim?.slice(0, 5)}</p>
                        </div>

                        <div className="relative flex justify-center">
                          {index < aulasDeHoje.length - 1 && <span className="absolute top-4 bottom-[-32px] w-px bg-[#d9ddd7]" />}
                          <span className={`relative mt-1.5 h-3 w-3 rounded-full border-[3px] ring-4 ring-white ${
                            statusHistorico?.includes('Falta') ? 'bg-rose-500 border-rose-100'
                              : statusHistorico === 'Realizada' ? 'bg-emerald-600 border-emerald-100'
                                : isPendenteDeBaixa ? 'bg-amber-500 border-amber-100'
                                  : isCurrent ? 'bg-[#1f4a3a] border-[#cbdad0]'
                                    : 'bg-white border-slate-300'
                          }`} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-[#e9ece7] overflow-hidden flex items-center justify-center shrink-0 border border-white">
                              {aula.aluno?.avatar_url
                                ? <img src={aula.aluno.avatar_url} alt="" className="w-full h-full object-cover" />
                                : <span className="text-xs font-semibold text-[#1f4a3a]">{aula.aluno?.nome_completo?.charAt(0)}</span>}
                            </div>
                            <div className="min-w-0">
                              <button onClick={() => abrirEntidadeAula(aula)} className="font-semibold text-sm text-slate-900 truncate block max-w-full hover:text-[#1f4a3a]">
                                {aula.aluno?.nome_completo}
                              </button>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1"><Mic2 size={12} /> {aula.instrumento_aula}</span>
                                <span className="flex items-center gap-1"><MapPin size={12} /> {aula.sala?.nome}</span>
                                {aula.is_reposicao && <span className="font-semibold text-[#76562e]">Reposição</span>}
                                {aula.is_remarcacao && <span className="font-semibold text-[#1f4a3a]">Horário aprovado</span>}
                                {aula.is_turma && <span className="font-semibold text-[#1f4a3a]">{aula.participantes} participantes</span>}
                                {aula.is_experimental && <span className="font-semibold text-[#8a642e]">Experimental</span>}
                              </div>
                            </div>
                          </div>
                          <div className="sm:hidden mt-3 flex items-center gap-2">
                            {canRegister ? (
                              <button onClick={() => { setAulaParaDarBaixa({ ...aula, data_selecionada: hojeDataStr }); setPainelLateral('diario') }} className="px-3 py-2 rounded-lg bg-[#b98b4f] text-white text-[10px] font-semibold">
                                {isCurrent ? 'Registrar presença' : 'Registrar aula'}
                              </button>
                            ) : (
                              <button onClick={() => abrirDetalhesAula(aula, hojeDataStr)} className="px-3 py-2 rounded-lg border border-[#dfded7] text-slate-600 text-[10px] font-semibold">
                                Detalhes
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center justify-end gap-2 pl-4">
                          {statusHistorico ? (
                            <span className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold uppercase tracking-wide ${getStatusColor(statusHistorico)}`}>
                              {statusHistorico}
                            </span>
                          ) : canRegister ? (
                            <button onClick={() => { setAulaParaDarBaixa({ ...aula, data_selecionada: hojeDataStr }); setPainelLateral('diario') }} className="px-3.5 py-2 rounded-lg bg-[#b98b4f] text-white text-[10px] font-semibold hover:bg-[#9f743e] transition-colors">
                              {isCurrent ? 'Registrar presença' : 'Registrar aula'}
                            </button>
                          ) : (
                            <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-semibold uppercase tracking-wide">Agendada</span>
                          )}
                          <button aria-label="Ver detalhes da aula" onClick={() => abrirDetalhesAula(aula, hojeDataStr)} className="h-8 w-8 rounded-lg border border-[#dfded7] flex items-center justify-center text-slate-500 hover:text-[#1f4a3a] hover:border-[#aebfb4] transition-colors">
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                      </motion.article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="premium-panel overflow-hidden xl:h-[calc(100vh-190px)] min-h-[520px] flex flex-col">
            {aulaParaDarBaixa ? (
              <>
                <div className="px-4 py-3.5 border-b border-[#dfded7] flex items-center justify-between shrink-0">
                  <div>
                    <p className="premium-kicker">Diário de aula</p>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">Registrar encontro</h2>
                  </div>
                  <button aria-label="Voltar para pendências" onClick={() => { setAulaParaDarBaixa(null); setObsBaixa('') }} className="h-8 w-8 rounded-lg border border-[#dfded7] flex items-center justify-center text-slate-500 hover:bg-[#f3f4ef]">
                    <X size={15} />
                  </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="rounded-xl bg-[#f4eadc] border border-[#e4cfb2] p-3.5 mb-4">
                    <p className="font-semibold text-sm text-slate-900">{aulaParaDarBaixa.aluno?.nome_completo}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(aulaParaDarBaixa.data_selecionada).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · {aulaParaDarBaixa.horario_inicio?.slice(0, 5)} · {aulaParaDarBaixa.instrumento_aula}
                    </p>
                  </div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Notas da aula ou motivo da falta</label>
                  <textarea
                    value={obsBaixa}
                    onChange={e => setObsBaixa(e.target.value)}
                    placeholder="Conteúdo trabalhado, orientações ou motivo..."
                    className="w-full h-32 mt-2 p-3.5 rounded-xl border border-[#dfded7] bg-white text-sm text-slate-800 resize-none outline-none focus:border-[#1f4a3a] focus:ring-2 focus:ring-[#1f4a3a]/10"
                  />
                  <div className="space-y-2 mt-4">
                    <button onClick={() => handleDarBaixa('Realizada')} disabled={isSubmitting} className="w-full py-3 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#17382c] disabled:opacity-50">
                      <Check size={16} /> {aulaParaDarBaixa?.is_experimental ? 'Compareceu' : 'Presente · aula realizada'}
                    </button>
                    {!aulaParaDarBaixa?.is_experimental && (
                      <button onClick={() => handleDarBaixa('Falta Justificada')} disabled={isSubmitting} className="w-full py-3 rounded-xl border border-[#dfc394] bg-[#fbf5e9] text-[#76562e] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#f4eadc] disabled:opacity-50">
                        <RotateCcw size={15} /> Faltou com justificativa
                      </button>
                    )}
                    <button onClick={() => handleDarBaixa('Falta Injustificada')} disabled={isSubmitting} className="w-full py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-rose-100 disabled:opacity-50">
                      <XCircle size={15} /> {aulaParaDarBaixa?.is_experimental ? 'Não compareceu' : 'Faltou sem justificativa'}
                    </button>
                  </div>
                  {aulaParaDarBaixa?.is_experimental && (
                    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Ao registrar presença, a opção de concluir a matrícula ficará disponível nos detalhes desta aula.</p>
                  )}
                  {!aulaParaDarBaixa?.is_turma && !aulaParaDarBaixa?.is_experimental && (
                    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                      No vencimento fixo, a falta justificada gera reposição; a falta sem justificativa apenas registra a ausência.
                    </p>
                  )}
                </div>
              </>
            ) : selectedAula ? (
              <>
                <div className="px-4 py-3.5 border-b border-[#dfded7] flex items-center justify-between shrink-0">
                  <div>
                    <p className="premium-kicker">Aula selecionada</p>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">Detalhes do horário</h2>
                  </div>
                  <button aria-label="Fechar detalhes" onClick={() => setSelectedAula(null)} className="h-8 w-8 rounded-lg border border-[#dfded7] flex items-center justify-center text-slate-500 hover:bg-[#f3f4ef]">
                    <X size={15} />
                  </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center gap-3 pb-4 border-b border-[#ebe9e3]">
                    <div className="h-11 w-11 rounded-full bg-[#e7efe9] flex items-center justify-center text-[#1f4a3a] font-semibold">
                      {selectedAula.aluno?.nome_completo?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">{selectedAula.aluno?.nome_completo}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedAula.horario_inicio?.slice(0, 5)} — {selectedAula.horario_fim?.slice(0, 5)}</p>
                    </div>
                  </div>
                  <dl className="py-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Modalidade</dt><dd className="font-medium text-slate-800">{selectedAula.instrumento_aula}</dd></div>
                    <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Sala</dt><dd className="font-medium text-slate-800">{selectedAula.sala?.nome}</dd></div>
                    <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Tipo</dt><dd className="font-medium text-slate-800">{selectedAula.is_experimental ? 'Aula experimental' : selectedAula.is_reposicao ? 'Reposição' : selectedAula.is_remarcacao ? 'Mudança aprovada' : 'Horário fixo'}</dd></div>
                    {selectedAulaStatus && <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Resultado</dt><dd className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase ${getStatusColor(selectedAulaStatus)}`}>{selectedAulaStatus}</dd></div>}
                  </dl>
                  <div className="space-y-4 pt-2">
                    {selectedAulaCanRegister && (
                      <section className="rounded-xl border border-[#d8e3db] bg-[#f1f6f2] p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#527064]">Resultado desta aula</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">A aula já começou. Registre agora a presença ou a falta do aluno.</p>
                        <button onClick={() => { setAulaParaDarBaixa(selectedAula); setSelectedAula(null); setPainelLateral('diario') }} className="mt-3 w-full py-3 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center justify-center gap-2">
                          <CheckCircle2 size={15} /> Registrar presença ou falta
                        </button>
                      </section>
                    )}

                    {selectedAula.is_experimental
                      && !selectedAula.aluno_id
                      && !['CANCELADA', 'MATRICULADA'].includes(selectedAula.experimental_status)
                      && (
                      <section className="rounded-xl border border-[#d7c39d] bg-[#fbf5e9] p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#866b43]">Próximo passo</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {selectedAula.experimental_status === 'REALIZADA'
                            ? 'O interessado compareceu. Complete a ficha para transformá-lo em aluno efetivo.'
                            : 'Você pode completar a matrícula agora, sem esperar o início da aula experimental. A presença continuará pendente.'}
                        </p>
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('lotus:matricular-experimental', { detail: selectedAula.experimental_record }))
                            setSelectedAula(null)
                          }}
                          className="mt-3 w-full rounded-xl bg-[#1f4a3a] py-3 text-xs font-semibold text-white"
                        >
                          Fazer matrícula completa
                        </button>
                      </section>
                    )}

                    {selectedAula.aluno?.id && (
                      <button onClick={() => router.push(`/alunos/${selectedAula.aluno.id}`)} className="w-full py-3 rounded-xl border border-[#d8ddd8] bg-white text-[#1f4a3a] text-xs font-semibold flex items-center justify-center gap-2">
                        <UserRound size={15} /> Abrir perfil do aluno
                      </button>
                    )}

                    {!selectedAulaStatus && (
                      <section className="rounded-xl border border-[#e6e1d7] bg-[#faf8f2] p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#866b43]">Alterações da agenda</p>
                        <div className="mt-3 space-y-2">
                          <button onClick={handleDesmarcarAula} disabled={isSubmitting} className="w-full py-3 rounded-xl border border-[#dfc394] bg-white text-[#76562e] text-xs font-semibold disabled:opacity-50">
                            {selectedAula.is_experimental ? 'Cancelar aula experimental' : 'Cancelar apenas esta aula'}
                          </button>
                          {!selectedAula.is_experimental && <p className="px-1 text-[10px] leading-relaxed text-slate-500">O horário semanal continua normalmente nas próximas semanas.</p>}
                          {!selectedAula.is_experimental && !selectedAula.is_reposicao && !selectedAula.is_remarcacao && (
                            <>
                              <button onClick={() => handleRemoverDaGrade(selectedAula.id)} className="w-full py-3 rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-semibold">
                                Encerrar este horário recorrente
                              </button>
                              <p className="px-1 text-[10px] leading-relaxed text-slate-500">Remove somente as próximas ocorrências. O histórico já registrado será preservado.</p>
                            </>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-1.5 border-b border-[#dfded7] bg-[#f7f7f3] grid grid-cols-2 gap-1 shrink-0">
                  <button
                    onClick={() => setPainelLateral('solicitacoes')}
                    className={`relative px-3 py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 transition-colors ${painelLateral === 'solicitacoes' ? 'bg-white text-[#1f4a3a] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <BellRing size={15} /> Solicitações
                    {solicitacoes.length > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-[#1f4a3a] text-white text-[9px] flex items-center justify-center">{solicitacoes.length}</span>}
                  </button>
                  <button
                    onClick={() => setPainelLateral('diario')}
                    className={`relative px-3 py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 transition-colors ${painelLateral === 'diario' ? 'bg-white text-[#76562e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <BookOpenCheck size={15} /> Diário
                    {aulasPendentesBaixa.length > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-[#b98b4f] text-white text-[9px] flex items-center justify-center">{aulasPendentesBaixa.length}</span>}
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                  {painelLateral === 'solicitacoes' ? (
                    solicitacoes.length === 0 ? (
                      <div className="h-full min-h-72 flex flex-col items-center justify-center text-center px-8">
                        <Inbox size={28} strokeWidth={1.5} className="text-slate-300 mb-3" />
                        <p className="font-semibold text-sm text-slate-700">Nenhuma solicitação</p>
                        <p className="text-xs text-slate-500 mt-1">Os novos pedidos aparecerão nesta fila.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#ebe9e3]">
                        {solicitacoes.map(sol => (
                          <div key={sol.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-900 truncate">{sol.aluno_nome}</p>
                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#8b6a3e]">
                                  {sol.tipo_mudanca === 'Fixa'
                                    ? 'Mudança de horário fixo'
                                    : sol.tipo_mudanca === 'Reposição'
                                      ? 'Remarcar aula com reposição'
                                      : 'Remarcar somente esta aula'}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                  {sol.tipo_mudanca === 'Fixa' ? (
                                    <>Novo fixo: {sol.novo_dia}, {sol.novo_horario_inicio?.slice(0, 5)}–{sol.novo_horario_fim?.slice(0, 5)}</>
                                  ) : (
                                    <>
                                      {sol.data_aula_original && (
                                        <>Aula de {new Date(sol.data_aula_original).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} → </>
                                      )}
                                      {sol.nova_data ? new Date(sol.nova_data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'data indefinida'}, {sol.novo_horario_inicio?.slice(0, 5)}
                                    </>
                                  )}
                                </p>
                              </div>
                              <CalendarDays size={16} className="text-[#1f4a3a] shrink-0 mt-0.5" />
                            </div>
                            {solicitacaoParaNegar?.id === sol.id ? (
                              <div className="mt-3">
                                <textarea
                                  value={motivoRecusa}
                                  onChange={e => setMotivoRecusa(e.target.value)}
                                  placeholder="Informe o motivo ao aluno..."
                                  className="w-full h-20 p-3 rounded-lg border border-[#dfded7] text-xs resize-none outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                                />
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => handleNegarSolicitacao(sol)} disabled={isSubmitting} className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-[10px] font-semibold disabled:opacity-50">Confirmar recusa</button>
                                  <button onClick={() => { setSolicitacaoParaNegar(null); setMotivoRecusa('') }} className="px-3 py-2 rounded-lg border border-[#dfded7] text-slate-500 text-[10px] font-semibold">Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 mt-3">
                                <button onClick={() => handleAprovarSolicitacao(sol)} disabled={isSubmitting} className="flex-1 py-2 rounded-lg bg-[#1f4a3a] text-white text-[10px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                                  <Check size={13} /> Aprovar
                                </button>
                                <button onClick={() => { setSolicitacaoParaNegar(sol); setMotivoRecusa('') }} disabled={isSubmitting} className="flex-1 py-2 rounded-lg border border-[#dfded7] text-slate-600 text-[10px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                                  <X size={13} /> Recusar
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  ) : aulasPendentesBaixa.length === 0 ? (
                    <div className="h-full min-h-72 flex flex-col items-center justify-center text-center px-8">
                      <CheckCircle2 size={28} strokeWidth={1.5} className="text-emerald-500 mb-3" />
                      <p className="font-semibold text-sm text-slate-700">Diário em dia</p>
                      <p className="text-xs text-slate-500 mt-1">Nenhuma aula aguardando registro.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#ebe9e3]">
                      {aulasPendentesBaixa.map(aula => (
                        <button
                          key={`${aula.id}-${aula.data_selecionada}`}
                          onClick={() => setAulaParaDarBaixa(aula)}
                          className="w-full p-4 text-left hover:bg-[#faf9f6] transition-colors flex items-center gap-3"
                        >
                          <div className="h-9 w-9 rounded-lg bg-[#f4eadc] text-[#76562e] flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-slate-900 truncate">{aula.aluno?.nome_completo}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(aula.data_selecionada).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · {aula.horario_inicio?.slice(0, 5)}
                            </p>
                          </div>
                          <ArrowUpRight size={15} className="text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </motion.div>

      ) : (
        <>
        <motion.section variants={itemVariants} className="premium-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-[#dfded7] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <CalendarDays size={19} className="text-[#1f4a3a]" />
                Agenda da semana
              </h2>
              <p className="text-sm text-slate-500 mt-1">Dias em colunas e horários na vertical, como em uma agenda.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white border border-[#d7d7d1]" /> Agendada</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 border border-emerald-300" /> Realizada</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-100 border border-amber-300" /> Pendente</span>
            </div>
          </div>

          <div className="overflow-auto custom-scrollbar max-h-[calc(100vh-235px)] min-h-[560px]">
            <div className="min-w-[1180px]">
              <div className="sticky top-0 z-20 grid grid-cols-[76px_repeat(6,minmax(180px,1fr))] border-b border-[#dfded7] bg-[#faf9f6]">
                <div className="sticky left-0 z-30 bg-[#faf9f6] px-3 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-center">
                  Hora
                </div>
                {agendaHorizontal.map(dia => (
                  <div key={dia.dataStr} className={`px-3 py-3.5 border-l border-[#e5e3dc] ${dia.isHoje ? 'bg-[#eaf1ea]' : dia.eventoEspecial ? 'bg-rose-50' : 'bg-[#faf9f6]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${dia.isHoje ? 'text-[#1f4a3a]' : 'text-slate-800'}`}>{dia.nome}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{dia.display}</p>
                      </div>
                      {dia.isHoje && <span className="px-2 py-1 rounded-full bg-[#1f4a3a] text-white text-[10px] font-semibold uppercase">Hoje</span>}
                    </div>
                    {dia.eventoEspecial && (
                      <p className="mt-2 text-[11px] font-semibold text-rose-700 truncate" title={dia.eventoEspecial.titulo}>
                        {dia.eventoEspecial.titulo} · sem aulas
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {horasAgendaSemana.map(hora => (
                <div key={hora} className="grid grid-cols-[76px_repeat(6,minmax(180px,1fr))] border-b border-[#ebe9e3]">
                  <div className="sticky left-0 z-10 bg-[#faf9f6] px-2 py-3 border-r border-[#e5e3dc] text-xs font-semibold text-slate-600 flex items-start justify-center gap-1.5 min-h-[88px]">
                    <Clock3 size={13} className="mt-0.5 text-slate-400" />
                    {String(hora).padStart(2, '0')}:00
                  </div>

                  {agendaHorizontal.map(dia => {
                    const aulasDoHorario = dia.aulas.filter((aula: any) => Number(String(aula.horario_inicio || '00:00').slice(0, 2)) === hora)
                    return (
                      <div key={`${dia.dataStr}-${hora}`} className={`min-h-[88px] p-1.5 border-l border-[#ebe9e3] ${dia.isHoje ? 'bg-[#f5f8f4]' : dia.eventoEspecial ? 'bg-rose-50/30' : 'bg-white'}`}>
                        <div className="space-y-1.5">
                          {aulasDoHorario.map((aula: any, index: number) => {
                            const statusHistorico = getAulaStatus(aula, dia.dataStr)
                            const isPast = checkIfClassPast(dia.dataStr, aula.horario_fim)
                            const isPendenteDeBaixa = isPast && !statusHistorico
                            const visualClass = statusHistorico === 'Realizada'
                              ? 'bg-emerald-50 border-emerald-300 border-l-emerald-500'
                              : statusHistorico === 'Falta Justificada'
                                ? 'bg-orange-50 border-orange-300 border-l-orange-500'
                                : statusHistorico
                                  ? 'bg-rose-50 border-rose-300 border-l-rose-500'
                                  : isPendenteDeBaixa
                                    ? 'bg-amber-50 border-amber-300 border-l-amber-500'
                                    : aula.is_reposicao
                                      ? 'bg-indigo-50 border-indigo-200 border-l-indigo-500'
                                      : aula.is_remarcacao
                                        ? 'bg-emerald-50 border-emerald-200 border-l-emerald-500'
                                      : 'bg-white border-[#dcdcd5] border-l-[#6f8c7b]'

                            return (
                              <div key={`${aula.id}-${index}`} className={`rounded-lg border border-l-[3px] px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${visualClass}`}>
                                <div className="flex items-start gap-2">
                                  <button onClick={() => abrirEntidadeAula(aula)} className="min-w-0 flex-1 text-left">
                                    <p className="text-xs font-semibold text-slate-900 truncate">{aula.aluno?.nome_completo}</p>
                                    <p className="text-[11px] text-slate-600 mt-0.5">{aula.horario_inicio?.slice(0, 5)}–{aula.horario_fim?.slice(0, 5)}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{aula.instrumento_aula}{aula.is_experimental ? ' · Experimental' : aula.is_reposicao ? ' · Reposição' : aula.is_remarcacao ? ' · Mudança aprovada' : ''}</p>
                                  </button>
                                  <button aria-label="Ver detalhes da aula" onClick={() => { abrirDetalhesAula(aula, dia.dataStr); setViewMode('dia') }} className="h-6 w-6 rounded-md text-slate-500 hover:bg-white flex items-center justify-center shrink-0">
                                    <MoreHorizontal size={14} />
                                  </button>
                                </div>
                                {isPendenteDeBaixa && (
                                  <button onClick={() => { setAulaParaDarBaixa({ ...aula, data_selecionada: dia.dataStr }); setViewMode('dia'); setPainelLateral('diario') }} className="mt-1.5 text-[10px] font-semibold text-amber-800 hover:underline">
                                    Registrar diário
                                  </button>
                                )}
                                {statusHistorico && <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 truncate">{statusHistorico}</p>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {false && (
        <motion.section variants={itemVariants} className="premium-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-[#dfded7]">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
              <CalendarDays size={19} className="text-[#1f4a3a]" />
              Agenda da semana
            </h2>
            <p className="text-xs text-slate-500 mt-1">Aulas organizadas por dia e horário.</p>
          </div>
          <div className="divide-y divide-[#dfded7]">
            {diasVisuais.map((dia) => {
              const eventosDoDia = eventosSemana.filter(e => e.data_evento === dia.dataStr)
              const isFeriado = eventosDoDia.some(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')
              const aulasDoDiaNaSemana = aulas.filter(aula => {
                if (aula.is_reposicao || aula.is_remarcacao) return aula.data_selecionada === dia.dataStr
                return aula.dia === dia.nome
              }).filter(aula => {
                const info = Array.isArray(aula.aluno?.alunos_info) ? aula.aluno?.alunos_info[0] : aula.aluno?.alunos_info
                if (info?.status === 'Inativo' && info?.data_inativacao && dia.dataStr > info.data_inativacao) return false
                const statusHistorico = getAulaStatus(aula, dia.dataStr)
                return statusHistorico !== 'Desmarcada'
              }).sort((a, b) => (a.horario_inicio || '00:00').localeCompare(b.horario_inicio || '00:00'))

              return (
                <div key={dia.dataStr} className={`grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)] ${dia.isHoje ? 'bg-[#f4f7f3]' : 'bg-white'}`}>
                  <div className="px-5 py-4 md:border-r border-[#ebe9e3]">
                    <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0">
                      <p className={`text-sm font-semibold ${dia.isHoje ? 'text-[#1f4a3a]' : 'text-slate-800'}`}>{dia.nome}</p>
                      <p className="text-xs text-slate-500 md:mt-1">{dia.display}</p>
                    </div>
                    {dia.isHoje && <span className="inline-block mt-2 text-[9px] font-semibold uppercase tracking-wide text-[#1f4a3a]">Hoje</span>}
                  </div>

                  <div className="min-w-0">
                    {isFeriado ? (
                      <div className="px-5 py-5 flex items-center gap-3 text-sm text-rose-700">
                        <CalendarDays size={16} />
                        <span className="font-medium">{eventosDoDia.find(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')?.titulo}</span>
                        <span className="text-xs text-rose-500">Sem aulas</span>
                      </div>
                    ) : aulasDoDiaNaSemana.length === 0 ? (
                      <div className="px-5 py-5 text-sm text-slate-400">Nenhuma aula programada.</div>
                    ) : (
                      <div className="divide-y divide-[#f0eee9]">
                        {aulasDoDiaNaSemana.map((aula, index) => {
                          const statusHistorico = getAulaStatus(aula, dia.dataStr)
                          const isPast = checkIfClassPast(dia.dataStr, aula.horario_fim)
                          const isPendenteDeBaixa = isPast && !statusHistorico
                          return (
                            <div key={`${aula.id}-${index}`} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-[#faf9f6] transition-colors">
                              <div className="w-28 shrink-0 flex items-center gap-2 text-xs font-semibold text-slate-700">
                                <Clock3 size={13} className="text-slate-400" />
                                {aula.horario_inicio?.slice(0, 5)} — {aula.horario_fim?.slice(0, 5)}
                              </div>
                              <button onClick={() => abrirEntidadeAula(aula)} className="min-w-0 flex-1 text-left">
                                <p className="font-semibold text-sm text-slate-900 truncate">{aula.aluno?.nome_completo}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{aula.instrumento_aula} · {aula.sala?.nome}{aula.is_experimental ? ' · Experimental' : aula.is_reposicao ? ' · Reposição' : aula.is_remarcacao ? ' · Mudança aprovada' : ''}</p>
                              </button>
                              <div className="flex items-center gap-2 shrink-0">
                                {statusHistorico ? (
                                  <span className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-semibold uppercase tracking-wide ${getStatusColor(statusHistorico)}`}>{statusHistorico}</span>
                                ) : isPendenteDeBaixa ? (
                                  <button onClick={() => { setAulaParaDarBaixa({ ...aula, data_selecionada: dia.dataStr }); setViewMode('dia'); setPainelLateral('diario') }} className="px-3 py-2 rounded-lg bg-[#b98b4f] text-white text-[10px] font-semibold">Registrar</button>
                                ) : (
                                  <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-semibold uppercase tracking-wide">Agendada</span>
                                )}
                                <button aria-label="Ver detalhes da aula" onClick={() => { abrirDetalhesAula(aula, dia.dataStr); setViewMode('dia') }} className="h-8 w-8 rounded-lg border border-[#dfded7] flex items-center justify-center text-slate-500 hover:text-[#1f4a3a]">
                                  <MoreHorizontal size={16} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>
        )}
        </>
      )}

    </motion.div>
  )
}
