"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useStyles } from '../lib/useStyles'
import Cropper from 'react-easy-crop'

const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15)
const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14)
const formatCEP = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9)

const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<File | null> => { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return null; canvas.width = 256; canvas.height = 256; ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 256, 256); return new Promise(resolve => canvas.toBlob(blob => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.9)) }

export default function Dashboard() {
  const { s } = useStyles()
  const router = useRouter()
  
  const dias: string[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [dataReferencia, setDataReferencia] = useState(new Date())
  const [eventosSemana, setEventosSemana] = useState<any[]>([])
  const [historicoSemana, setHistoricoSemana] = useState<any[]>([])
  const [aulas, setAulas] = useState<any[]>([])
  
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAula, setSelectedAula] = useState<any>(null)
  
  const [professoresList, setProfessoresList] = useState<any[]>([])
  const [salasList, setSalasList] = useState<any[]>([])
  const [modalidadesLista, setModalidadesLista] = useState<any[]>([])
  
  const [nomeAluno, setNomeAluno] = useState(''); const [emailAluno, setEmailAluno] = useState(''); 
  const [senhaAluno, setSenhaAluno] = useState(''); 
  const [telAluno, setTelAluno] = useState(''); const [cpf, setCpf] = useState(''); const [dataNascimento, setDataNascimento] = useState('')
  const [cep, setCep] = useState(''); const [endereco, setEndereco] = useState(''); const [numero, setNumero] = useState(''); const [complemento, setComplemento] = useState(''); const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState(''); const [estado, setEstado] = useState('')
  const [comoConheceu, setComoConheceu] = useState(''); const [indicacaoNome, setIndicacaoNome] = useState(''); const [valorMensalidade, setValorMensalidade] = useState('250'); const [vencimento, setVencimento] = useState('10')
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null); const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [profId, setProfId] = useState(''); const [salaId, setSalaId] = useState(''); const [diaSemana, setDiaSemana] = useState('Segunda'); const [horaInicio, setHoraInicio] = useState('08:00'); const [horaFim, setHoraFim] = useState('09:00'); const [modalidade, setModalidade] = useState('')
  
  const [showCropModal, setShowCropModal] = useState(false); const [imageToCrop, setImageToCrop] = useState<string | null>(null); const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const diaDaSemana = dataReferencia.getDay() 
  const diffParaSegunda = dataReferencia.getDate() - diaDaSemana + (diaDaSemana === 0 ? -6 : 1)
  const segundaFeira = new Date(dataReferencia)
  segundaFeira.setDate(diffParaSegunda)

  const diasVisuais = [0, 1, 2, 3, 4, 5].map(offset => {
    const d = new Date(segundaFeira)
    d.setDate(segundaFeira.getDate() + offset)
    const dataStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const dataHojeStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const nomes = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    return { nome: nomes[offset], dataStr: dataStr, isHoje: dataStr === dataHojeStr, display: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  })

  const semanaAnterior = () => { const n = new Date(dataReferencia); n.setDate(n.getDate() - 7); setDataReferencia(n) }
  const proximaSemana = () => { const n = new Date(dataReferencia); n.setDate(n.getDate() + 7); setDataReferencia(n) }
  const semanaAtual = () => { setDataReferencia(new Date()) }

  useEffect(() => { carregarDados() }, [dataReferencia]) 
  useEffect(() => { if (horaInicio) { const [h, m] = horaInicio.split(':').map(Number); const d = new Date(); d.setHours(h + 1, m); setHoraFim(d.toTimeString().slice(0, 5)) } }, [horaInicio])

  // --- O "RADAR" DE TEMPO REAL (WEBSOCKET) ---
  useEffect(() => {
    const channel = supabase
      .channel('notificacoes-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_reagendamento' },
        (payload) => {
          // Quando qualquer aluno cria, altera ou você aprova/nega, a tela pisca e atualiza!
          console.log('Nova notificação no radar!', payload);
          carregarDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // Limpa a antena se sair da tela para não pesar memória
    }
  }, [dataReferencia]);
  // -------------------------------------------

  async function carregarDados() {
    setLoading(false) // Desligado para não dar "pulo" na tela a cada notificação
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role === 'ALUNO') { router.push('/portal'); return }

    const inicioDaSemana = diasVisuais[0].dataStr
    const fimDaSemana = diasVisuais[5].dataStr

    const { data: agenda } = await supabase.from('agenda').select(`
      *, 
      aluno:profiles!aluno_id(id, nome_completo, alunos_info(status, data_inativacao)), 
      sala:salas(nome)
    `).order('horario_inicio')
    
    const { data: pL } = await supabase.from('profiles').select('id, nome_completo').in('role', ['PROFESSOR', 'ADMIN'])
    const { data: sL } = await supabase.from('salas').select('id, nome')
    const { data: mL } = await supabase.from('modalidades').select('nome').order('nome')

    const { data: ev } = await supabase.from('eventos_calendario').select('*').gte('data_evento', inicioDaSemana).lte('data_evento', fimDaSemana)
    const { data: hist } = await supabase.from('historico_aulas').select('aluno_id, data_aula, status').gte('data_aula', inicioDaSemana).lte('data_aula', fimDaSemana)

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
    setSolicitacoes(solMapeadas)

    setEventosSemana(ev || []); setHistoricoSemana(hist || []); setAulas(agenda || []); setProfessoresList(pL || []); setSalasList(sL || []); setModalidadesLista(mL || [])
  }

  const handleAprovarSolicitacao = async (sol: any) => {
    if (!confirm(`Aprovar a mudança de ${sol.aluno_nome} para ${sol.novo_dia} às ${sol.novo_horario_inicio}?`)) return;
    setIsSubmitting(true)
    if (sol.tipo_mudanca === 'Fixa') {
      await supabase.from('agenda').update({ dia: sol.novo_dia, horario_inicio: sol.novo_horario_inicio, horario_fim: sol.novo_horario_fim }).eq('id', sol.agenda_original_id)
    }
    await supabase.from('solicitacoes_reagendamento').update({ status: 'Aprovada' }).eq('id', sol.id)
    alert("✅ Solicitação Aprovada com sucesso!")
    setIsSubmitting(false)
  }

  const handleNegarSolicitacao = async (sol: any) => {
    const motivo = window.prompt("Qual o motivo da recusa? (Isso aparecerá para o aluno)")
    if (motivo === null) return 
    setIsSubmitting(true)
    await supabase.from('solicitacoes_reagendamento').update({ status: 'Negada', motivo_recusa: motivo || 'Horário indisponível no momento.' }).eq('id', sol.id)
    alert("❌ Solicitação Negada e devolvida ao aluno.")
    setIsSubmitting(false)
  }

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const newCep = formatCEP(e.target.value); setCep(newCep); const cleanCep = newCep.replace(/\D/g, ''); if (cleanCep.length === 8) { try { const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`); const data = await res.json(); if (!data.erro) { setEndereco(data.logradouro || ''); setBairro(data.bairro || ''); setCidade(data.localidade || ''); setEstado(data.uf || ''); document.getElementById('input-numero')?.focus() } } catch (error) { console.error("Erro") } } }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) { const reader = new FileReader(); reader.onload = () => { setImageToCrop(reader.result as string); setShowCropModal(true) }; reader.readAsDataURL(e.target.files[0]) } }
  const handleConfirmCrop = async () => { if (imageToCrop && croppedAreaPixels) { const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels); if (croppedFile) { setFotoArquivo(croppedFile); setFotoPreview(URL.createObjectURL(croppedFile)) } }; setShowCropModal(false); setImageToCrop(null); setCrop({ x: 0, y: 0 }); setZoom(1) }
  const fecharModalMatricula = () => { setIsModalOpen(false); setNomeAluno(''); setEmailAluno(''); setSenhaAluno(''); setTelAluno(''); setCpf(''); setDataNascimento(''); setCep(''); setEndereco(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setEstado(''); setComoConheceu(''); setIndicacaoNome(''); setFotoArquivo(null); setFotoPreview(null); setModalidade(''); setHoraInicio('08:00'); }

  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault(); if (!modalidade || !salaId || !profId) return alert("Preencha modalidade, sala e professor.")
    setIsSubmitting(true)
    
    const { data: conflitos } = await supabase.from('agenda').select('id').eq('dia', diaSemana).or(`professor_id.eq.${profId},sala_id.eq.${salaId}`).lt('horario_inicio', horaFim).gt('horario_fim', horaInicio)
    if (conflitos && conflitos.length > 0) { setIsSubmitting(false); return alert("🚨 CONFLITO de agenda!") }
    
    const apiRes = await fetch('/api/matricular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailAluno, password: senhaAluno, nome: nomeAluno })
    })
    const apiData = await apiRes.json()
    
    if (!apiRes.ok) {
      setIsSubmitting(false); 
      return alert("Erro ao criar acesso: " + (apiData.error || "Tente novamente."))
    }

    const alunoId = apiData.user.id; 
    let avatarPublicUrl = null
    
    if (fotoArquivo) { 
      const { error: uploadError } = await supabase.storage.from('avatars').upload(`alunos/${alunoId}.jpg`, fotoArquivo); 
      if (!uploadError) avatarPublicUrl = supabase.storage.from('avatars').getPublicUrl(`alunos/${alunoId}.jpg`).data.publicUrl 
    }
    
    const { error: err1 } = await supabase.from('profiles').insert([{ id: alunoId, nome_completo: nomeAluno, email: emailAluno, telefone: telAluno, cpf, data_nascimento: dataNascimento || null, cep, endereco, numero, complemento, bairro, cidade, estado, avatar_url: avatarPublicUrl, role: 'ALUNO' }])
    if (err1) { setIsSubmitting(false); return alert("Erro ao criar perfil: " + err1.message) }
    
    await supabase.from('alunos_info').insert([{ id: alunoId, valor_mensalidade: parseFloat(valorMensalidade), data_vencimento: parseInt(vencimento), como_conheceu: comoConheceu, indicacao_nome: comoConheceu === 'Indicação' ? indicacaoNome : null, status: 'Ativo' }])
    await supabase.from('agenda').insert([{ professor_id: profId, aluno_id: alunoId, sala_id: parseInt(salaId), dia: diaSemana, horario_inicio: horaInicio, horario_fim: horaFim, instrumento_aula: modalidade }])
    
    setIsSubmitting(false); fecharModalMatricula(); carregarDados(); alert("🎉 Matrícula realizada e Acesso Criado!")
  }

  const handleRemoverDaGrade = async (id: string) => { if (!confirm("Remover da grade? (Não exclui o aluno)")) return; await supabase.from('agenda').delete().eq('id', id); setSelectedAula(null); carregarDados() }

  return (
    <div className="animate-in fade-in duration-500">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
        <div>
          <h2 className="text-3xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Grade de Horários</h2>
          <p className={`${s.textMuted} text-xs font-bold uppercase tracking-widest mt-1`}>Controle em Tempo Real</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className={`flex items-center p-2 rounded-2xl border ${s.card} shadow-lg gap-2 w-full md:w-auto justify-center`}>
            <button onClick={semanaAnterior} className={`p-3 rounded-xl ${s.cardInterno} border hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all font-black`}>⬅</button>
            <div className="w-40 md:w-48 text-center cursor-pointer" onClick={semanaAtual} title="Voltar para hoje">
              <p className="font-black uppercase tracking-widest text-[10px] md:text-xs">
                {diasVisuais[0].display} <span className="opacity-50">até</span> {diasVisuais[5].display}
              </p>
              <p className={`${s.textMuted} text-[8px] md:text-[9px] uppercase font-bold mt-0.5`}>Semana Selecionada</p>
            </div>
            <button onClick={proximaSemana} className={`p-3 rounded-xl ${s.cardInterno} border hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all font-black`}>➡</button>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="px-6 py-3.5 bg-emerald-600 w-full md:w-auto text-white font-black uppercase text-xs rounded-xl shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2">
            <span className="text-lg leading-none">+</span> Matrícula
          </button>
        </div>
      </div>

      {solicitacoes.length > 0 && (
        <div className={`mb-10 p-6 md:p-8 rounded-[2.5rem] border border-amber-500/30 bg-gradient-to-r ${s.bg === 'bg-slate-950' ? 'from-amber-500/10 to-transparent' : 'from-amber-50 to-white'} shadow-xl animate-in slide-in-from-top-4 duration-500`}>
          <h3 className="text-lg font-black uppercase text-amber-600 mb-6 flex items-center gap-3"><span className="text-2xl">🛎️</span> Caixa de Entrada ({solicitacoes.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {solicitacoes.map(sol => (
              <div key={sol.id} className={`${s.cardInterno} p-5 rounded-2xl border shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all`}>
                <div className={`absolute top-0 right-0 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-sm ${sol.tipo_mudanca === 'Fixa' ? 'bg-amber-500 text-slate-900' : 'bg-indigo-500 text-white'}`}>
                  {sol.tipo_mudanca === 'Fixa' ? 'Mudar Grade Fixa' : 'Reposição'}
                </div>
                <div>
                  <p className="font-black text-sm uppercase mb-1 pr-24 text-slate-800">{sol.aluno_nome.split(' ')[0]}</p>
                  <p className={`${s.textMuted} text-[10px] font-bold leading-tight mb-4`}>
                    Solicitou a aula para <span className="font-black text-indigo-600 uppercase underline">{new Date(sol.nova_data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} ({sol.novo_dia}) às {sol.novo_horario_inicio?.slice(0,5)}</span> com {sol.prof_nome.split(' ')[0]}.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAprovarSolicitacao(sol)} disabled={isSubmitting} className="flex-1 py-2.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-md">Aprovar</button>
                  <button onClick={() => handleNegarSolicitacao(sol)} disabled={isSubmitting} className="flex-1 py-2.5 bg-rose-50 text-rose-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all">Negar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && aulas.length === 0 ? (
        <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
          {diasVisuais.map((dia) => {
            const eventosDoDia = eventosSemana.filter(e => e.data_evento === dia.dataStr)
            const isFeriado = eventosDoDia.some(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')

            return (
              <div key={dia.nome} className="flex flex-col">
                <div className={`mb-3 p-3 rounded-2xl border ${s.card} text-center border-t-4 transition-all ${dia.isHoje ? 'border-t-emerald-500 bg-emerald-500/5 shadow-lg' : 'border-t-indigo-500'}`}>
                  <h3 className={`font-black uppercase tracking-widest text-[10px] ${dia.isHoje ? 'text-emerald-500' : 'text-indigo-500'}`}>{dia.nome}</h3>
                  <p className={`text-xs font-bold mt-1 ${dia.isHoje ? 'text-emerald-500' : s.textMuted}`}>{dia.display}</p>
                </div>
                
                <div className="space-y-3">
                  {isFeriado ? (
                    <div className={`p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-rose-500 text-center flex flex-col items-center justify-center min-h-[150px]`}>
                      <span className="text-4xl mb-3 opacity-80">🏖️</span>
                      <p className="font-black uppercase text-[10px] text-balance leading-tight">{eventosDoDia.find(e => e.tipo === 'Feriado' || e.tipo === 'Recesso')?.titulo}</p>
                      <p className="text-[9px] mt-2 opacity-70 font-bold uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded">Sem Aulas</p>
                    </div>
                  ) : (
                    aulas.filter(a => a.dia === dia.nome).map((aula) => {
                      const info = Array.isArray(aula.aluno?.alunos_info) ? aula.aluno?.alunos_info[0] : aula.aluno?.alunos_info;
                      const isInactive = info?.status === 'Inativo';
                      const dataInativacao = info?.data_inativacao;

                      if (isInactive) {
                        if (!dataInativacao) return null; 
                        if (dia.dataStr > dataInativacao) return null; 
                      }

                      const statusHistorico = historicoSemana.find(h => h.aluno_id === aula.aluno.id && h.data_aula === dia.dataStr)?.status

                      return (
                        <div key={aula.id} className={`${s.cardInterno} p-4 rounded-2xl border border-l-4 ${dia.isHoje ? 'border-l-emerald-500' : 'border-l-indigo-500'} hover:shadow-xl transition-all relative group ${statusHistorico === 'Desmarcada' || statusHistorico === 'Falta' ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}>
                          <div className="flex justify-between items-start mb-1">
                            <p className={`font-black text-[9px] mb-1 ${dia.isHoje ? 'text-emerald-500' : 'text-indigo-500'}`}>
                              {aula.horario_inicio.slice(0, 5)} - {aula.horario_fim.slice(0, 5)}
                            </p>
                            <button onClick={() => setSelectedAula(aula)} className={`opacity-0 group-hover:opacity-100 text-[9px] font-black uppercase transition-opacity ${dia.isHoje ? 'text-emerald-500' : 'text-indigo-500'}`}>Editar</button>
                          </div>
                          <button onClick={() => router.push(`/alunos/${aula.aluno.id}`)} className={`font-black text-sm uppercase hover:text-indigo-500 transition-colors block w-full text-left truncate ${statusHistorico === 'Desmarcada' ? 'line-through' : ''}`}>
                            {aula.aluno?.nome_completo}
                          </button>
                          <p className={`${s.textMuted} text-[9px] mt-2 font-black uppercase flex flex-col`}><span className="mb-1">🎤 {aula.instrumento_aula}</span><span>📍 {aula.sala?.nome}</span></p>
                          {statusHistorico && (
                            <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-lg text-[8px] font-black uppercase shadow-lg border ${statusHistorico === 'Realizada' ? 'bg-emerald-500 text-white border-emerald-600' : statusHistorico === 'Falta' ? 'bg-rose-500 text-white border-rose-600' : statusHistorico === 'Reposição' ? 'bg-amber-500 text-slate-900 border-amber-600' : 'bg-slate-500 text-white border-slate-600'}`}>
                              {statusHistorico}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedAula && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className={`${s.card} border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative`}>
            <h2 className={`text-2xl font-black mb-6 ${s.text} tracking-tighter uppercase text-center`}>Opções do Horário</h2>
            <div className="flex flex-col gap-3">
              <button onClick={() => router.push(`/alunos/${selectedAula.aluno.id}`)} className={`py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase shadow-lg text-xs hover:bg-indigo-500 transition-all`}>Acessar Perfil do Aluno</button>
              <button onClick={() => handleRemoverDaGrade(selectedAula.id)} className={`py-4 rounded-2xl bg-rose-600 text-white font-black uppercase shadow-lg text-xs hover:bg-rose-500 transition-all`}>Remover da Grade</button>
              <button onClick={() => setSelectedAula(null)} className={`py-4 rounded-2xl font-black uppercase ${s.text} hover:bg-slate-500/10 transition-all text-xs border border-slate-500/20 mt-4`}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showCropModal && imageToCrop && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-in fade-in duration-300">
          <div className={`${s.card} border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col items-center`}>
            <h3 className="text-xl font-black uppercase italic mb-6">Ajustar Foto</h3>
            <div className="relative w-full h-64 bg-slate-800 rounded-2xl overflow-hidden mb-6 shadow-inner"><Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={(cA, cAP) => setCroppedAreaPixels(cAP)} onZoomChange={setZoom} /></div>
            <div className="w-full mb-8"><label className="text-[10px] font-black uppercase opacity-50 block mb-2 text-center">Zoom da Imagem</label><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-indigo-500" /></div>
            <div className="flex gap-3 w-full"><button onClick={() => setShowCropModal(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs border border-slate-500/20 hover:bg-slate-500/10`}>Cancelar</button><button onClick={handleConfirmCrop} className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-indigo-600 text-white shadow-lg hover:scale-105 transition-all">Cortar & Salvar</button></div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className={`${s.card} border-t-8 border-t-emerald-500 p-8 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative overflow-y-auto max-h-[90vh] custom-scrollbar`}>
            <h2 className={`text-3xl font-black mb-8 ${s.text} uppercase italic`}>Ficha de Matrícula</h2>
            <form onSubmit={handleMatricular} className="space-y-8">
              <div className="flex justify-center mb-6"><label htmlFor="foto-upload" className="cursor-pointer group flex flex-col items-center gap-2"><div className={`relative w-28 h-28 rounded-full border-4 border-indigo-500/20 shadow-lg overflow-hidden flex items-center justify-center transition-all group-hover:border-indigo-500 ${s.cardInterno}`}>{fotoPreview ? <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-4xl opacity-30">📷</span>}<div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Alterar<br/>Foto</span></div></div><span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest group-hover:underline">Adicionar Foto</span><input id="foto-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} /></label></div>
              
              <div className="space-y-4"><p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest border-b border-indigo-500/20 pb-2">Dados de Acesso (Portal)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input placeholder="E-mail do Aluno" type="email" required value={emailAluno} onChange={e => setEmailAluno(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} />
                  <input placeholder="Senha de Acesso (Mín. 6 letras/números)" minLength={6} type="text" required value={senhaAluno} onChange={e => setSenhaAluno(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} />
                </div>
              </div>

              <div className="space-y-4"><p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest border-b border-indigo-500/20 pb-2">Dados Pessoais</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><input placeholder="Nome Completo" required value={nomeAluno} onChange={e => setNomeAluno(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm md:col-span-2 ${s.input}`} /><div><label className="text-[9px] font-bold opacity-50 ml-1 block mb-1">Data Nasc.</label><input type="date" required value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div><input placeholder="CPF" required value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} maxLength={14} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /><input placeholder="WhatsApp" required value={telAluno} onChange={e => setTelAluno(formatPhone(e.target.value))} maxLength={15} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div></div>
              
              <div className="space-y-4"><p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest border-b border-indigo-500/20 pb-2">Endereço</p><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><input placeholder="CEP" required value={cep} onChange={handleCepChange} maxLength={9} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-1 ${s.input}`} /><input placeholder="Endereço / Rua" required value={endereco} onChange={e => setEndereco(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-2 ${s.input}`} /><input id="input-numero" placeholder="Número" required value={numero} onChange={e => setNumero(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-1 ${s.input}`} /></div></div>
              <div className="space-y-4"><p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest border-b border-indigo-500/20 pb-2">Agendamento</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="text-[9px] font-bold opacity-50 ml-1">Dia</label><select required value={diaSemana} onChange={e => setDiaSemana(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`}>{dias.map((d: string) => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="text-[9px] font-bold opacity-50 ml-1">Horário</label><input type="time" required value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div><div><label className="text-[9px] font-bold opacity-50 ml-1">Professor</label><select required value={profId} onChange={e => setProfId(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`}><option value="">Selecione...</option>{professoresList.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}</select></div><div><label className="text-[9px] font-bold opacity-50 ml-1">Sala</label><select required value={salaId} onChange={e => setSalaId(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`}><option value="">Selecione...</option>{salasList.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div></div><div className="pt-4"><label className="text-[10px] font-black uppercase mb-3 block opacity-50 tracking-widest">Modalidade</label><div className="flex flex-wrap gap-2">{modalidadesLista.map(m => (<button key={m.nome} type="button" onClick={() => setModalidade(m.nome)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all ${modalidade === m.nome ? 'bg-indigo-600 text-white border-transparent shadow-lg scale-105' : `${s.cardInterno} opacity-70 hover:opacity-100`}`}>{modalidade === m.nome && <span className="mr-2">✓</span>} {m.nome}</button>))}</div></div></div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-500/10"><button type="button" onClick={fecharModalMatricula} disabled={isSubmitting} className={`px-6 py-3 rounded-xl font-black uppercase text-xs ${s.text} hover:bg-slate-500/10 disabled:opacity-50`}>Cancelar</button><button type="submit" disabled={isSubmitting} className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase text-xs shadow-xl hover:scale-105 transition-all disabled:opacity-50">{isSubmitting ? 'Gerando Acesso...' : 'Finalizar Matrícula'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}