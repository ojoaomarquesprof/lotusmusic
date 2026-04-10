"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useStyles } from '../../../lib/useStyles'
import Cropper from 'react-easy-crop'
import { motion, AnimatePresence } from 'framer-motion'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15)
const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14)
const formatCEP = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9)
const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<File | null> => { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return null; canvas.width = 256; canvas.height = 256; ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 256, 256); return new Promise(resolve => canvas.toBlob(blob => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.9)) }

const HORARIOS_DISPONIVEIS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 7;
  return `${h.toString().padStart(2, '0')}:00`;
});

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

export default function PerfilAluno() {
  const { s } = useStyles(); const { id } = useParams(); const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)
  
  const [aluno, setAluno] = useState<any>(null); const [aulasFixas, setAulasFixas] = useState<any[]>([]); const [pagamentos, setPagamentos] = useState<any[]>([]); const [historicoAulas, setHistoricoAulas] = useState<any[]>([])
  const [materiais, setMateriais] = useState<any[]>([])
  const [loading, setLoading] = useState(true); const [isSubmitting, setIsSubmitting] = useState(false); const [imgError, setImgError] = useState(false)

  const dias: string[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const [professoresList, setProfessoresList] = useState<any[]>([])
  const [salasList, setSalasList] = useState<any[]>([])
  const [modalidadesLista, setModalidadesLista] = useState<any[]>([])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false); const [editStatus, setEditStatus] = useState('Ativo'); const [editNome, setEditNome] = useState(''); const [editEmail, setEditEmail] = useState(''); const [editTel, setEditTel] = useState(''); const [editCpf, setEditCpf] = useState(''); const [editDataNascimento, setEditDataNascimento] = useState('')
  const [editCep, setEditCep] = useState(''); const [editEndereco, setEditEndereco] = useState(''); const [editNumero, setEditNumero] = useState(''); const [editComplemento, setEditComplemento] = useState(''); const [editBairro, setEditBairro] = useState(''); const [editCidade, setEditCidade] = useState(''); const [editEstado, setEditEstado] = useState('')
  const [editComoConheceu, setEditComoConheceu] = useState(''); const [editIndicacaoNome, setEditIndicacaoNome] = useState(''); const [editValor, setEditValor] = useState(''); const [editVencimento, setEditVencimento] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState(''); const [editFotoArquivo, setEditFotoArquivo] = useState<File | null>(null); const [fotoPreview, setFotoPreview] = useState<string | null>(null); const [showCropModal, setShowCropModal] = useState(false); const [imageToCrop, setImageToCrop] = useState<string | null>(null); const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const [editAgendas, setEditAgendas] = useState<any[]>([])

  const [isClassModalOpen, setIsClassModalOpen] = useState(false); const [dataAula, setDataAula] = useState(new Date().toISOString().split('T')[0]); const [horaInicioAula, setHoraInicioAula] = useState('08:00'); const [horaFimAula, setHoraFimAula] = useState('09:00'); const [statusAula, setStatusAula] = useState('Realizada'); const [obsAula, setObsAula] = useState('')
  const [isPayModalOpen, setIsPayModalOpen] = useState(false); const [payData, setPayData] = useState(new Date().toISOString().split('T')[0]); const [payMetodo, setPayMetodo] = useState('PIX'); const [payValor, setPayValor] = useState('')

  const [isEditPayModalOpen, setIsEditPayModalOpen] = useState(false); const [editPayId, setEditPayId] = useState(''); const [editPayData, setEditPayData] = useState(''); const [editPayMetodo, setEditPayMetodo] = useState('PIX'); const [editPayValor, setEditPayValor] = useState('');

  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false)
  const [msgTitulo, setMsgTitulo] = useState('Aviso da Secretaria')
  const [msgTexto, setMsgTexto] = useState('')

  const [isClassDetailsModalOpen, setIsClassDetailsModalOpen] = useState(false)
  const [selectedClassDetails, setSelectedClassDetails] = useState<any>(null)

  const [saldoCreditos, setSaldoCreditos] = useState(0)

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarDados() }, [id, isMounted])
  useEffect(() => { if (horaInicioAula) { const [h, m] = horaInicioAula.split(':').map(Number); const d = new Date(); d.setHours(h + 1, m); setHoraFimAula(d.toTimeString().slice(0, 5)) } }, [horaInicioAula])

  async function carregarDados() {
    const { data: profile } = await supabase.from('profiles').select('*, alunos_info(*)').eq('id', id).single()
    const { data: agenda } = await supabase.from('agenda').select(`*, professor:profiles!professor_id(nome_completo), sala:salas(nome)`).eq('aluno_id', id).order('dia')
    const { data: pgs } = await supabase.from('pagamentos').select('*').eq('aluno_id', id).order('data_pagamento', { ascending: false })
    const { data: hist } = await supabase.from('historico_aulas').select('*').eq('aluno_id', id).order('data_aula', { ascending: false })
    const { data: mats } = await supabase.from('materiais_aluno').select('*').eq('aluno_id', id).order('data_envio', { ascending: false })
    const { data: reposicoes } = await supabase.from('solicitacoes_reagendamento').select('*').eq('aluno_id', id)
    
    // Calcula o saldo de créditos
    const qtdDesmarcadas = (hist || []).filter(h => h.status === 'Desmarcada' || h.status === 'Crédito' || h.status === 'Falta Justificada').length;
    const qtdUsadasPortal = (reposicoes || []).filter((r: any) => r.status !== 'Negada').length;
    const qtdUsadasManual = (hist || []).filter(h => h.status === 'Reposição' || h.status === 'Ajuste de Saldo').length;
    setSaldoCreditos(Math.max(0, qtdDesmarcadas - (qtdUsadasPortal + qtdUsadasManual)));

    const { data: pL } = await supabase.from('profiles').select('id, nome_completo').in('role', ['PROFESSOR', 'ADMIN'])
    const { data: sL } = await supabase.from('salas').select('id, nome')
    const { data: mL } = await supabase.from('modalidades').select('nome').order('nome')

    setProfessoresList(pL || []); setSalasList(sL || []); setModalidadesLista(mL || [])
    setAluno(profile); setAulasFixas(agenda || []); setPagamentos(pgs || []); setHistoricoAulas(hist || []); setMateriais(mats || []); setLoading(false)
  }

  const infoMatricula = Array.isArray(aluno?.alunos_info) ? aluno?.alunos_info[0] : aluno?.alunos_info; const isAlunoInativo = infoMatricula?.status === 'Inativo'; const isEditingInativo = editStatus === 'Inativo'

  const abrirModalEdicao = () => { 
    setEditStatus(infoMatricula?.status || 'Ativo'); setEditNome(aluno.nome_completo || ''); setEditEmail(aluno.email || ''); setEditTel(aluno.telefone || ''); setEditCpf(aluno.cpf || ''); setEditDataNascimento(aluno.data_nascimento || ''); setEditCep(aluno.cep || ''); setEditEndereco(aluno.endereco || ''); setEditNumero(aluno.numero || ''); setEditComplemento(aluno.complemento || ''); setEditBairro(aluno.bairro || ''); setEditCidade(aluno.cidade || ''); setEditEstado(aluno.estado || ''); setEditComoConheceu(infoMatricula?.como_conheceu || ''); setEditIndicacaoNome(infoMatricula?.indicacao_nome || ''); setEditValor(infoMatricula?.valor_mensalidade || ''); setEditVencimento(infoMatricula?.data_vencimento || ''); setEditAvatarUrl(aluno.avatar_url || ''); setFotoPreview(aluno.avatar_url || null); setEditFotoArquivo(null); 
    
    if (aulasFixas.length > 0) { 
      setEditAgendas(aulasFixas.map(a => ({
        id: a.id,
        dia: a.dia,
        horario_inicio: a.horario_inicio.slice(0, 5),
        horario_fim: a.horario_fim.slice(0, 5),
        professor_id: a.professor_id,
        sala_id: a.sala_id?.toString(),
        instrumento_aula: a.instrumento_aula
      })))
    } else { 
      setEditAgendas([{ id: `new_${crypto.randomUUID()}`, dia: 'Segunda', horario_inicio: '08:00', horario_fim: '09:00', professor_id: '', sala_id: '', instrumento_aula: '' }])
    }
    
    setIsEditModalOpen(true) 
  }

  const handleEditAgendaChange = (index: number, field: string, value: any) => {
    const newAgendas = [...editAgendas];
    newAgendas[index][field] = value;
    if (field === 'horario_inicio') {
        const [h, m] = value.split(':').map(Number);
        const d = new Date(); d.setHours(h + 1, m);
        newAgendas[index].horario_fim = d.toTimeString().slice(0, 5);
    }
    setEditAgendas(newAgendas);
  }
  
  const addEditAgenda = () => setEditAgendas([...editAgendas, { id: `new_${crypto.randomUUID()}`, dia: 'Segunda', horario_inicio: '08:00', horario_fim: '09:00', professor_id: '', sala_id: '', instrumento_aula: '' }])
  const removeEditAgenda = (index: number) => setEditAgendas(editAgendas.filter((_, i) => i !== index))
  
  const handleEditCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const newCep = formatCEP(e.target.value); setEditCep(newCep); const cleanCep = newCep.replace(/\D/g, ''); if (cleanCep.length === 8) { try { const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`); const data = await res.json(); if (!data.erro) { setEditEndereco(data.logradouro || ''); setEditBairro(data.bairro || ''); setEditCidade(data.localidade || ''); setEditEstado(data.uf || ''); document.getElementById('edit-input-numero')?.focus() } } catch (error) { console.error("Erro CEP") } } }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) { const reader = new FileReader(); reader.onload = () => { setImageToCrop(reader.result as string); setShowCropModal(true) }; reader.readAsDataURL(e.target.files[0]) } }
  const handleConfirmCrop = async () => { if (imageToCrop && croppedAreaPixels) { const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels); if (croppedFile) { setEditFotoArquivo(croppedFile); setFotoPreview(URL.createObjectURL(croppedFile)) } }; setShowCropModal(false); setImageToCrop(null); setCrop({ x: 0, y: 0 }); setZoom(1) }
  
  const handleSalvarEdicao = async (e: React.FormEvent) => { 
    e.preventDefault(); setIsSubmitting(true); 
    
    if (!isEditingInativo) {
      if (editAgendas.some(ag => !ag.professor_id || !ag.sala_id || !ag.instrumento_aula)) {
        setIsSubmitting(false);
        return alert("Preencha modalidade, sala e professor de TODOS os horários de aula.");
      }

      for (let ag of editAgendas) {
        let query = supabase.from('agenda').select('id').eq('dia', ag.dia).or(`professor_id.eq.${ag.professor_id},sala_id.eq.${ag.sala_id}`).lt('horario_inicio', ag.horario_fim).gt('horario_fim', ag.horario_inicio); 
        if (!String(ag.id).startsWith('new_')) query = query.neq('id', ag.id); 
        const { data: conflitos } = await query; 
        if (conflitos && conflitos.length > 0) { 
          setIsSubmitting(false); 
          return alert(`🚨 CONFLITO DE AGENDA: O professor ou sala já está ocupado no dia ${ag.dia} às ${ag.horario_inicio}.`) 
        }
      }
    }

    let finalAvatarUrl = editAvatarUrl; 
    if (editFotoArquivo) { const fileName = `alunos/${id}-${crypto.randomUUID()}.jpg`; const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, editFotoArquivo); if (!uploadError) { finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl } } 
    
    const { error: err1 } = await supabase.from('profiles').update({ nome_completo: editNome, email: editEmail, telefone: editTel, cpf: editCpf, data_nascimento: editDataNascimento || null, cep: editCep, endereco: editEndereco, numero: editNumero, complemento: editComplemento, bairro: editBairro, cidade: editCidade, estado: editEstado, avatar_url: finalAvatarUrl }).eq('id', id); if (err1) { setIsSubmitting(false); return alert("Erro: " + err1.message) } 
    
    const dataInativacao = editStatus === 'Inativo' ? new Date().toISOString().split('T')[0] : null;
    await supabase.from('alunos_info').update({ valor_mensalidade: editValor ? parseFloat(editValor) : 0, data_vencimento: editVencimento ? parseInt(editVencimento) : null, status: editStatus, como_conheceu: editComoConheceu, indicacao_nome: editComoConheceu === 'Indicação' ? editIndicacaoNome : null, data_inativacao: dataInativacao }).eq('id', id); 
    
    if (!isEditingInativo) {
      const idsAtuais = editAgendas.filter(a => !String(a.id).startsWith('new_')).map(a => a.id);
      const deletados = aulasFixas.filter(a => !idsAtuais.includes(a.id));
      for (let del of deletados) {
          await supabase.from('agenda').delete().eq('id', del.id);
      }

      for (let ag of editAgendas) {
        const agendaData = { professor_id: ag.professor_id, aluno_id: id as string, sala_id: parseInt(ag.sala_id), dia: ag.dia, horario_inicio: ag.horario_inicio, horario_fim: ag.horario_fim, instrumento_aula: ag.instrumento_aula }; 
        if (String(ag.id).startsWith('new_')) {
          await supabase.from('agenda').insert([agendaData])
        } else {
          await supabase.from('agenda').update(agendaData).eq('id', ag.id)
        }
      }
    }

    setIsSubmitting(false); setIsEditModalOpen(false); carregarDados(); alert("✅ Ficha Atualizada!") 
  }

  const handleExcluirAluno = async () => { if (!window.confirm(`🚨 Apagar DEFINITIVAMENTE o aluno?`)) return; setLoading(true); await supabase.from('historico_aulas').delete().eq('aluno_id', id); await supabase.from('agenda').delete().eq('aluno_id', id); await supabase.from('pagamentos').delete().eq('aluno_id', id); await supabase.from('materiais_aluno').delete().eq('aluno_id', id); await supabase.from('alunos_info').delete().eq('id', id); await supabase.from('profiles').delete().eq('id', id); alert("🗑️ Excluído!"); router.push('/alunos') }
  const handleRegistrarAula = async (e: React.FormEvent) => { e.preventDefault(); await supabase.from('historico_aulas').insert([{ aluno_id: id, data_aula: dataAula, horario_inicio: horaInicioAula, horario_fim: horaFimAula, status: statusAula, observacoes: obsAula }]); setIsClassModalOpen(false); setObsAula(''); carregarDados() }
  const abrirModalPagamento = () => { setPayValor(infoMatricula?.valor_mensalidade || ''); setPayData(new Date().toISOString().split('T')[0]); setPayMetodo('PIX'); setIsPayModalOpen(true) }
  const handleSalvarPagamento = async (e: React.FormEvent) => { e.preventDefault(); await supabase.from('pagamentos').insert([{ aluno_id: id, valor: parseFloat(payValor), status: 'Pago', data_pagamento: payData, metodo_pagamento: payMetodo }]); setIsPayModalOpen(false); carregarDados() }
  const abrirModalEdicaoPagamento = (pg: any) => { setEditPayId(pg.id); setEditPayData(pg.data_pagamento.split('T')[0]); setEditPayMetodo(pg.metodo_pagamento || 'PIX'); setEditPayValor(pg.valor); setIsEditPayModalOpen(true); }
  const handleSalvarEdicaoPagamento = async (e: React.FormEvent) => { e.preventDefault(); setIsSubmitting(true); await supabase.from('pagamentos').update({ valor: parseFloat(editPayValor), data_pagamento: editPayData, metodo_pagamento: editPayMetodo }).eq('id', editPayId); setIsSubmitting(false); setIsEditPayModalOpen(false); carregarDados(); }
  const handleExcluirPagamento = async (id: string) => { if (!window.confirm("🚨 Apagar definitivamente este registro de pagamento?")) return; await supabase.from('pagamentos').delete().eq('id', id); setIsEditPayModalOpen(false); carregarDados(); }
  const handleUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => { if (!e.target.files || e.target.files.length === 0) return; const file = e.target.files[0]; setIsSubmitting(true); const fileExt = file.name.split('.').pop(); const fileName = `${id}/${crypto.randomUUID()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('materiais').upload(fileName, file); if (uploadError) { alert("Erro ao enviar arquivo: " + uploadError.message); setIsSubmitting(false); return; } const { data: publicUrlData } = supabase.storage.from('materiais').getPublicUrl(fileName); await supabase.from('materiais_aluno').insert([{ aluno_id: id, nome_arquivo: file.name, url_arquivo: publicUrlData.publicUrl, tipo_arquivo: file.type || 'Desconhecido' }]); carregarDados(); setIsSubmitting(false); alert("✅ Material enviado com sucesso!"); }
  const excluirMaterial = async (matId: string) => { if (!window.confirm("Apagar este material? O aluno não poderá mais acessar.")) return; await supabase.from('materiais_aluno').delete().eq('id', matId); carregarDados(); }

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await supabase.from('notificacoes_aluno').insert([{ aluno_id: id, titulo: msgTitulo, mensagem: msgTexto }])
    alert("✅ Mensagem enviada para o aluno!");
    setIsMsgModalOpen(false); setMsgTexto(''); setIsSubmitting(false);
  }

  const handleConcederCredito = async () => {
    if (!window.confirm("Deseja adicionar 1 crédito manual (Aparecerá no portal dele)?")) return;
    setIsSubmitting(true);
    const hojeStr = new Date().toISOString().split('T')[0];
    await supabase.from('historico_aulas').insert([{ aluno_id: id, data_aula: hojeStr, status: 'Crédito', observacoes: 'Crédito extra concedido manualmente.' }]);
    alert("✅ Crédito adicionado!");
    carregarDados();
    setIsSubmitting(false);
  }

  const handleRemoverCredito = async () => {
    if (saldoCreditos <= 0) return alert("O aluno não possui saldo para remover.");
    if (!window.confirm("Deseja abater 1 crédito do saldo deste aluno?")) return;
    setIsSubmitting(true);
    const hojeStr = new Date().toISOString().split('T')[0];
    await supabase.from('historico_aulas').insert([{ aluno_id: id, data_aula: hojeStr, status: 'Ajuste de Saldo', observacoes: 'Crédito removido manualmente (abate).' }]);
    alert("✅ Saldo ajustado com sucesso!");
    carregarDados();
    setIsSubmitting(false);
  }

  const handleExcluirAulaHistorico = async (idAula: string) => {
    if (!window.confirm("🚨 Tem certeza que deseja apagar este registro do diário? Se for uma aula que gerou crédito, o saldo será recalculado automaticamente.")) return;
    setIsSubmitting(true);
    await supabase.from('historico_aulas').delete().eq('id', idAula);
    setIsClassDetailsModalOpen(false);
    carregarDados();
    setIsSubmitting(false);
  }

  const abrirDetalhesAula = (aula: any) => {
    setSelectedClassDetails(aula);
    setIsClassDetailsModalOpen(true);
  }

  const gerarPdfAulas = () => {
    const doc = new jsPDF();
    doc.text(`Histórico de Aulas - ${aluno.nome_completo}`, 14, 15);
    const ultimoPagamento = pagamentos.length > 0 ? pagamentos[0].data_pagamento : null;
    let aulasFeitas = 0;
    
    if (ultimoPagamento) { 
      const dataPg = ultimoPagamento.split('T')[0];
      aulasFeitas = historicoAulas.filter(h => h.data_aula.split('T')[0] >= dataPg && (h.status === 'Realizada' || h.status === 'Reposição')).length; 
    } else { 
      aulasFeitas = historicoAulas.filter(h => h.status === 'Realizada' || h.status === 'Reposição').length; 
    }
    
    doc.setFontSize(10);
    doc.text(`Aulas concluídas desde o último pagamento: ${aulasFeitas}`, 14, 25);
    const tableData = historicoAulas.map(h => [ new Date(h.data_aula).toLocaleDateString('pt-BR', {timeZone: 'UTC'}), h.horario_inicio ? `${h.horario_inicio.slice(0,5)} - ${h.horario_fim?.slice(0,5)}` : '--', h.status, h.observacoes || '--' ]);
    autoTable(doc, { startY: 30, head: [['Data', 'Horário', 'Status', 'Observações']], body: tableData });
    doc.save(`Aulas_${aluno.nome_completo.split(' ')[0]}.pdf`);
  }

  const gerarPdfPagamentos = () => {
    const doc = new jsPDF();
    doc.text(`Histórico de Pagamentos - ${aluno.nome_completo}`, 14, 15);
    const diaVencimento = infoMatricula?.data_vencimento || 10;
    const tableData = pagamentos.map(p => {
        const dataPgStr = p.data_pagamento.split('T')[0];
        const pgDateObj = new Date(dataPgStr);
        const vencimentoStr = `${pgDateObj.getUTCFullYear()}-${String(pgDateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`;
        let statusTxt = 'No prazo'; let diasAtraso = 0;
        if (dataPgStr > vencimentoStr) { const diffTime = Math.abs(new Date(dataPgStr).getTime() - new Date(vencimentoStr).getTime()); diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); statusTxt = `Atrasado (${diasAtraso} dias)`; }
        return [ new Date(p.data_pagamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}), `R$ ${p.valor}`, p.metodo_pagamento || '--', statusTxt ];
    });
    autoTable(doc, { startY: 25, head: [['Data', 'Valor', 'Forma', 'Situação']], body: tableData });
    doc.save(`Pagamentos_${aluno.nome_completo.split(' ')[0]}.pdf`);
  }

  // CÁLCULO DE AULAS DESDE O ÚLTIMO PAGAMENTO
  const ultimoPagamentoObj = pagamentos.length > 0 ? pagamentos[0] : null;
  let aulasDesdeUltimoPagamento = 0;
  if (ultimoPagamentoObj) {
    const dataPg = ultimoPagamentoObj.data_pagamento.split('T')[0];
    aulasDesdeUltimoPagamento = historicoAulas.filter(h => {
      const dataAula = h.data_aula.split('T')[0];
      return dataAula >= dataPg && (h.status === 'Realizada' || h.status === 'Reposição');
    }).length;
  } else {
    aulasDesdeUltimoPagamento = historicoAulas.filter(h => h.status === 'Realizada' || h.status === 'Reposição').length;
  }

  const inputClass = "w-full p-3.5 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-medium focus:bg-white/80 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none shadow-inner placeholder:text-slate-400 mt-1";

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-200/50 pb-4">
        <div className="flex items-center gap-4">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push('/alunos')} className={`bg-white/40 backdrop-blur-md border border-white/60 p-3 rounded-2xl shadow-sm font-bold text-sm text-indigo-600 hover:bg-white/60 transition-all`}>← Voltar</motion.button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-800">Dossiê do Aluno</h2>
            <p className="text-slate-500 text-sm mt-1">Visão completa e histórico</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleExcluirAluno} className="px-4 py-2.5 rounded-xl border border-rose-300 bg-white/40 backdrop-blur-md text-rose-600 font-bold text-xs hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2 shadow-sm"><span>🗑️</span> Excluir</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setIsMsgModalOpen(true)} className={`px-4 py-2.5 rounded-xl bg-amber-400 text-amber-950 font-bold text-xs shadow-md transition-all flex items-center gap-2`}><span>🔔</span> Enviar Aviso</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={abrirModalEdicao} className={`px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2`}><span>⚙️</span> Editar Aluno</motion.button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="space-y-6">
          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] border-t-8 border-t-indigo-500 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-center h-fit relative`}>
            <div className={`w-32 h-32 mx-auto mb-4 rounded-full shadow-lg overflow-hidden flex items-center justify-center relative bg-white/50 border-4 ${isAlunoInativo ? 'border-rose-300' : 'border-indigo-100'}`}>
              {aluno?.avatar_url && !imgError ? <img src={aluno.avatar_url} alt="Foto" className={`w-full h-full object-cover ${isAlunoInativo ? 'grayscale opacity-70' : ''}`} onError={() => setImgError(true)} /> : <span className={`text-5xl font-bold uppercase ${isAlunoInativo ? 'text-rose-400' : 'text-indigo-400'}`}>{aluno?.nome_completo?.charAt(0)}</span>}
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800 mb-1">{aluno?.nome_completo}</h2>
            <div className="h-6 mb-6">{isAlunoInativo && <span className="bg-rose-100 text-rose-600 border border-rose-200 px-3 py-1 rounded-lg text-xs font-semibold tracking-wide inline-block">Matrícula Inativa</span>}</div>
            
            <div className="space-y-2 mb-6 text-left">
              <div className={`p-3 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm flex items-center gap-3`}><span className="text-xl">✉️</span><div className="overflow-hidden"><p className={`text-slate-500 text-[10px] font-semibold uppercase`}>E-mail</p><p className="text-xs font-bold text-slate-800 truncate">{aluno?.email}</p></div></div>
              <div className={`p-3 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm flex items-center gap-3`}><span className="text-xl">📱</span><div><p className={`text-slate-500 text-[10px] font-semibold uppercase`}>WhatsApp</p><p className="text-xs font-bold text-slate-800">{aluno?.telefone}</p></div></div>
            </div>
            
            <div className={`p-5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm text-left space-y-3 mb-6`}>
              <p className="text-[11px] font-semibold uppercase text-indigo-600 tracking-wider border-b border-indigo-500/10 pb-1">Ficha Cadastral</p>
              {aluno?.cpf && <div><p className={`text-slate-500 text-[10px] font-semibold uppercase`}>CPF</p><p className="text-xs font-bold text-slate-800">{aluno.cpf}</p></div>}
              {aluno?.data_nascimento && <div><p className={`text-slate-500 text-[10px] font-semibold uppercase`}>Nascimento</p><p className="text-xs font-bold text-slate-800">{new Date(aluno.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p></div>}
              {aluno?.cep && (<div><p className={`text-slate-500 text-[10px] font-semibold uppercase`}>Endereço</p><p className="text-xs font-bold text-slate-800 leading-tight">{aluno.endereco}, {aluno.numero} {aluno.complemento ? `(${aluno.complemento})` : ''} <br/>{aluno.bairro} - {aluno.cidade}/{aluno.estado} <br/><span className="opacity-60 font-medium text-[10px]">CEP: {aluno.cep}</span></p></div>)}
              {infoMatricula?.como_conheceu && (<div className="pt-2 border-t border-slate-200/50"><p className={`text-slate-500 text-[10px] font-semibold uppercase mb-1`}>Chegou via</p><span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-1 rounded text-[10px] font-bold shadow-sm inline-block">{infoMatricula.como_conheceu} {infoMatricula.indicacao_nome ? `(${infoMatricula.indicacao_nome})` : ''}</span></div>)}
            </div>

            <div className={`p-5 rounded-2xl bg-white/40 border border-white/80 shadow-inner mb-4 flex justify-between items-center`}>
              <div className="text-left">
                <p className={`text-slate-500 text-[10px] font-semibold uppercase mb-1 flex items-center gap-1`}><span className="text-lg">🌟</span> Créditos de Reposição</p>
                <p className="text-2xl font-bold tracking-tight text-indigo-600">{saldoCreditos} Saldo</p>
              </div>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleRemoverCredito} disabled={isSubmitting || saldoCreditos <= 0} className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center font-bold text-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm disabled:opacity-50" title="Abater Crédito Manualmente">-</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleConcederCredito} disabled={isSubmitting} className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm disabled:opacity-50" title="Conceder Crédito Manual">+</motion.button>
              </div>
            </div>

            {/* NOVO CARD: AULAS DESDE O ÚLTIMO PAGAMENTO */}
            <div className={`p-5 rounded-2xl bg-white/40 border border-white/80 shadow-inner mb-4 flex justify-between items-center`}>
              <div className="text-left">
                <p className={`text-slate-500 text-[10px] font-semibold uppercase mb-1 flex items-center gap-1`}><span className="text-lg">🎼</span> Ciclo de Aulas</p>
                <p className="text-2xl font-bold tracking-tight text-indigo-600">{aulasDesdeUltimoPagamento} <span className="text-sm font-medium text-slate-500">feitas</span></p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Desde o</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">último pagto</p>
              </div>
            </div>
            
            <div className={`p-5 rounded-2xl bg-white/40 border border-white/80 shadow-inner mb-6`}>
              <div className="flex justify-between items-center mb-1">
                <p className={`text-slate-500 text-[10px] font-semibold uppercase`}>Mensalidade</p>
                <p className={`text-slate-500 text-[10px] font-semibold uppercase`}>Venc. dia {infoMatricula?.data_vencimento || '--'}</p>
              </div>
              <p className="text-3xl font-bold tracking-tight text-emerald-600 text-left">R$ {infoMatricula?.valor_mensalidade || '0,00'}</p>
            </div>
            
            <motion.button whileTap={{ scale: 0.95 }} onClick={abrirModalPagamento} disabled={isAlunoInativo} className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-500 transition-all disabled:opacity-50"> {isAlunoInativo ? 'Aluno Inativo' : 'Registrar Pagamento'} </motion.button>
          </motion.div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          
          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
            <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-indigo-500 drop-shadow-sm">📌</span> Horários Fixos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aulasFixas.map(aula => { 
                const nomeProf = Array.isArray(aula.professor) ? aula.professor[0]?.nome_completo : aula.professor?.nome_completo; 
                const nomeSala = Array.isArray(aula.sala) ? aula.sala[0]?.nome : aula.sala?.nome; 
                return (
                  <motion.div whileHover={{ scale: 1.02 }} key={aula.id} className={`bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 border-l-4 border-l-indigo-500 shadow-sm flex flex-col gap-2`}>
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-lg text-indigo-600">{aula.dia}</p>
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-bold shadow-sm">{aula.instrumento_aula}</span>
                    </div>
                    <p className="font-bold text-sm text-slate-800">{aula.horario_inicio.slice(0, 5)} - {aula.horario_fim.slice(0, 5)}</p>
                    <p className={`text-slate-500 text-[10px] font-semibold mt-2 pt-2 border-t border-slate-200/50`}>📍 {nomeSala || 'S/ Sala'} • 👤 Prof. {nomeProf}</p>
                  </motion.div>
                ) 
              })}
              {aulasFixas.length === 0 && <p className={`text-slate-500 col-span-2 text-center py-4 italic text-sm`}>Nenhum horário fixo.</p>}
            </div>
          </motion.div>
          
          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-800"><span className="text-amber-500 drop-shadow-sm">📖</span> Diário</h3>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} onClick={gerarPdfAulas} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold shadow-sm transition-all border border-slate-200 hover:bg-slate-200">📄 Exportar PDF</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsClassModalOpen(true)} disabled={isAlunoInativo} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-bold shadow-sm transition-all disabled:opacity-50">+ Lançar Aula</motion.button>
              </div>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {historicoAulas.map(hist => {
                const isAjuste = hist.status === 'Ajuste de Saldo';
                return (
                  <div key={hist.id} onClick={() => abrirDetalhesAula(hist)} className={`bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-sm flex flex-col gap-2 cursor-pointer hover:bg-white/80 transition-all ${hist.status === 'Agendada' ? 'border-l-4 border-l-blue-400' : ''} ${(hist.status === 'Crédito' || hist.status === 'Falta Justificada') ? 'border-l-4 border-l-purple-400' : ''} ${isAjuste ? 'border-l-4 border-l-slate-400' : ''}`}>
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-sm text-slate-800">{new Date(hist.data_aula).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} {hist.horario_inicio && <span className={`text-slate-500 font-medium text-[11px] ml-3`}>⏰ {hist.horario_inicio.slice(0, 5)} - {hist.horario_fim?.slice(0, 5)}</span>}</p>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border shadow-sm ${hist.status === 'Realizada' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : (hist.status === 'Falta' || hist.status === 'Falta Injustificada') ? 'bg-rose-50 text-rose-600 border-rose-200' : (hist.status === 'Crédito' || hist.status === 'Falta Justificada') ? 'bg-purple-50 text-purple-600 border-purple-200' : isAjuste ? 'bg-slate-50 text-slate-600 border-slate-200' : hist.status === 'Agendada' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>{hist.status}</span>
                    </div>
                    {hist.observacoes && <p className={`text-slate-600 text-xs bg-white/50 p-3 rounded-xl border border-white/60 mt-1 shadow-inner`}>"{hist.observacoes}"</p>}
                  </div>
                )
              })}
              {historicoAulas.length === 0 && <p className={`text-slate-500 text-center py-8 italic text-sm border border-dashed border-slate-300 rounded-2xl bg-white/30`}>Nenhuma aula registrada.</p>}
            </div>
          </motion.div>
          
          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-800"><span className="text-cyan-500 drop-shadow-sm">📂</span> Repositório (Arquivos)</h3>
              <label className={`px-4 py-2 bg-cyan-600 text-white rounded-xl text-[11px] font-bold shadow-sm hover:bg-cyan-500 transition-all cursor-pointer ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>
                {isSubmitting ? 'Enviando...' : '+ Enviar Arquivo'}
                <input type="file" className="hidden" onChange={handleUploadMaterial} disabled={isSubmitting} />
              </label>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {materiais.map(mat => (
                <motion.div whileHover={{ scale: 1.01 }} key={mat.id} className={`bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-sm flex justify-between items-center group hover:shadow-md transition-all`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-2xl opacity-60">{mat.tipo_arquivo.includes('pdf') ? '📄' : mat.tipo_arquivo.includes('audio') ? '🎵' : '📁'}</span>
                    <div className="overflow-hidden">
                      <p className="font-bold text-sm text-slate-800 truncate" title={mat.nome_arquivo}>{mat.nome_arquivo}</p>
                      <p className={`text-slate-500 text-[10px] font-medium mt-1`}>{new Date(mat.data_envio).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={mat.url_arquivo} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 hover:bg-cyan-500 hover:text-white flex items-center justify-center transition-all shadow-sm" title="Ver / Baixar">⬇️</a>
                    <button onClick={() => excluirMaterial(mat.id)} className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm" title="Apagar Arquivo">🗑️</button>
                  </div>
                </motion.div>
              ))}
              {materiais.length === 0 && <p className={`text-slate-500 text-center py-6 italic text-sm border border-dashed border-slate-300 rounded-2xl bg-white/30`}>O aluno ainda não possui materiais.</p>}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-800"><span className="text-emerald-500 drop-shadow-sm">💳</span> Extrato de Pagamentos</h3>
              <motion.button whileHover={{ scale: 1.05 }} onClick={gerarPdfPagamentos} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold shadow-sm transition-all border border-slate-200 hover:bg-slate-200">📄 Exportar PDF</motion.button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {pagamentos.map(pg => (
                <motion.div whileHover={{ scale: 1.01 }} key={pg.id} className={`bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-sm flex justify-between items-center hover:shadow-md transition-all group`}>
                  <div>
                    <p className="font-bold text-sm text-slate-800 mb-1">{new Date(pg.data_pagamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                    <p className={`text-slate-500 text-[11px] font-medium`}>Forma: <span className="text-indigo-600 font-bold">{pg.metodo_pagamento || 'N/A'}</span></p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-xl tracking-tight">R$ {pg.valor}</p>
                      <p className="text-[9px] font-bold uppercase text-emerald-700 bg-emerald-100 inline-block px-2 py-1 rounded mt-1 shadow-sm border border-emerald-200">Pago</p>
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => abrirModalEdicaoPagamento(pg)} className="opacity-0 group-hover:opacity-100 h-10 w-10 flex items-center justify-center bg-white border border-slate-200 shadow-sm rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all text-sm" title="Editar Registro">✏️</motion.button>
                  </div>
                </motion.div>
              ))}
              {pagamentos.length === 0 && <p className={`text-slate-500 text-center py-6 italic text-sm bg-white/30 border border-dashed border-slate-300 rounded-2xl`}>Sem histórico financeiro.</p>}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modais */}
      <AnimatePresence>
        {isMsgModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-amber-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-2xl font-bold tracking-tight text-slate-800 drop-shadow-sm`}>Enviar Aviso</h2>
                <button onClick={() => setIsMsgModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">✖</button>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-6 leading-tight">Essa mensagem aparecerá instantaneamente no aplicativo do aluno.</p>
              
              <form onSubmit={handleEnviarMensagem} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Título (Assunto)</label>
                  <input required value={msgTitulo} onChange={e => setMsgTitulo(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Sua Mensagem</label>
                  <textarea required value={msgTexto} onChange={e => setMsgTexto(e.target.value)} placeholder="Digite o aviso aqui..." className={`${inputClass} h-32 resize-none`} />
                </div>
                <div className="pt-4">
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl bg-amber-400 text-amber-950 font-bold text-sm shadow-md hover:bg-amber-500 transition-all disabled:opacity-50">
                    {isSubmitting ? 'Enviando...' : '🔔 Disparar Notificação'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCropModal && imageToCrop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col items-center`}>
              <h3 className="text-xl font-bold tracking-tight mb-6 text-slate-800">Ajustar Foto</h3>
              <div className="relative w-full h-64 bg-slate-900/5 backdrop-blur-inner rounded-2xl overflow-hidden mb-6 shadow-inner"><Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} showGrid={false} onCropChange={setCrop} onCropComplete={(cA, cAP) => setCroppedAreaPixels(cAP)} onZoomChange={setZoom} /></div>
              <div className="w-full mb-8"><label className="text-xs font-semibold text-slate-500 block mb-2 text-center">Zoom da Imagem</label><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-indigo-500" /></div>
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCropModal(false)} className={`flex-1 py-4 rounded-2xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white`}>Cancelar</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleConfirmCrop} className="flex-1 py-4 rounded-2xl font-bold text-sm bg-indigo-600 text-white shadow-md hover:bg-indigo-500 transition-all">Cortar & Salvar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPayModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-emerald-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative`}>
              <h2 className={`text-2xl font-bold tracking-tight mb-6 text-slate-800 drop-shadow-sm`}>Novo Pagamento</h2>
              <form onSubmit={handleSalvarPagamento} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Valor</label>
                  <input type="number" step="0.01" required value={payValor} onChange={e => setPayValor(e.target.value)} className={`w-full p-3.5 rounded-xl bg-white/50 border border-white/60 font-bold text-xl text-emerald-600 focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner mt-1`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Data</label>
                    <input type="date" required value={payData} onChange={e => setPayData(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Forma</label>
                    <select required value={payMetodo} onChange={e => setPayMetodo(e.target.value)} className={inputClass}>
                      <option value="PIX">PIX</option><option value="Cartão">Cartão</option><option value="Dinheiro">Dinheiro</option><option value="Transferência">Transferência</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsPayModalOpen(false)} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-500 transition-all">Confirmar Pagamento</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditPayModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-emerald-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-2xl font-bold tracking-tight text-slate-800 drop-shadow-sm`}>Editar Recibo</h2>
                <button type="button" onClick={() => handleExcluirPagamento(editPayId)} className="h-10 w-10 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Apagar Registro Definitivamente">🗑️</button>
              </div>
              <form onSubmit={handleSalvarEdicaoPagamento} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Valor Pago</label>
                  <input type="number" step="0.01" required value={editPayValor} onChange={e => setEditPayValor(e.target.value)} className={`w-full p-3.5 rounded-xl bg-white/50 border border-white/60 font-bold text-xl text-emerald-600 focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner mt-1`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Data</label>
                    <input type="date" required value={editPayData} onChange={e => setEditPayData(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Forma</label>
                    <select required value={editPayMetodo} onChange={e => setEditPayMetodo(e.target.value)} className={inputClass}>
                      <option value="PIX">PIX</option><option value="Cartão">Cartão</option><option value="Dinheiro">Dinheiro</option><option value="Transferência">Transferência</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsEditPayModalOpen(false)} disabled={isSubmitting} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white disabled:opacity-50`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSubmitting} className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-500 transition-all disabled:opacity-50">{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isClassModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-amber-500 p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl relative`}>
              <h2 className={`text-2xl font-bold tracking-tight mb-6 text-slate-800 drop-shadow-sm`}>Lançamento de Aula</h2>
              <form onSubmit={handleRegistrarAula} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Data</label>
                    <input type="date" required value={dataAula} onChange={e => setDataAula(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Início</label>
                    <input type="time" required value={horaInicioAula} onChange={e => setHoraInicioAula(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Fim</label>
                    <input type="time" required value={horaFimAula} onChange={e => setHoraFimAula(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Status</label>
                  <select required value={statusAula} onChange={e => setStatusAula(e.target.value)} className={inputClass}>
                    <option value="Realizada">Realizada ✅</option>
                    <option value="Agendada">Agendada (Futura) 📅</option>
                    <option value="Falta Injustificada">Falta Injustificada ❌</option>
                    <option value="Falta Justificada">Falta Justificada ⚖️</option>
                    <option value="Desmarcada">Desmarcada 🔄</option>
                    <option value="Reposição">Reposição 🌟</option>
                    <option value="Crédito">Crédito (Apenas Injeta Saldo) 🎟️</option>
                    <option value="Ajuste de Saldo">Ajuste de Saldo (Remove 1 Crédito) ➖</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Observações</label>
                  <textarea value={obsAula} onChange={e => setObsAula(e.target.value)} className={`${inputClass} h-32 resize-none`} />
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsClassModalOpen(false)} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" className="px-10 py-4 rounded-2xl bg-amber-400 text-amber-950 font-bold text-sm shadow-md hover:bg-amber-500 transition-all">Lançar no Diário</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative overflow-y-auto max-h-[90vh] custom-scrollbar`}>
              <h2 className={`text-3xl font-bold tracking-tight mb-8 text-slate-800 drop-shadow-sm`}>Editar Ficha do Aluno</h2>
              <form onSubmit={handleSalvarEdicao} className="space-y-8">
                
                <div className={`flex justify-center mb-6 ${isEditingInativo ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label htmlFor="edit-foto-upload" className="cursor-pointer group flex flex-col items-center gap-2">
                    <div className={`relative w-28 h-28 rounded-full border-4 border-indigo-500/20 bg-white/60 shadow-md overflow-hidden flex items-center justify-center transition-all group-hover:border-indigo-500`}>
                      {fotoPreview ? <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-4xl opacity-50">📷</span>}
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                        <span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Alterar<br/>Foto</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest group-hover:underline mt-1">Adicionar Nova Foto</span>
                    <input id="edit-foto-upload" type="file" accept="image/*" disabled={isEditingInativo} className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                
                <div className="space-y-4">
                  <label className="text-[11px] font-semibold uppercase text-indigo-600 tracking-wider border-b border-indigo-500/10 pb-2 block">Situação do Aluno</label>
                  <select required value={editStatus} onChange={e => setEditStatus(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm transition-all focus:outline-none shadow-sm ${editStatus === 'Inativo' ? 'text-rose-600 bg-rose-50 border-rose-200 focus:border-rose-400' : 'text-emerald-600 bg-emerald-50 border-emerald-200 focus:border-emerald-400'}`}>
                    <option value="Ativo" className="text-emerald-600 font-bold">🟢 Matrícula Ativa</option>
                    <option value="Inativo" className="text-rose-600 font-bold">🔴 Matrícula Inativa</option>
                  </select>
                  {isEditingInativo && <p className="text-xs text-rose-500 font-medium mt-1 ml-2">⚠️ O aluno ficará oculto do Dashboard a partir de hoje, mas seu histórico continuará salvo.</p>}
                </div>

                <div className="space-y-4">
                  <p className={`text-[11px] font-semibold uppercase tracking-wider border-b pb-2 ${isEditingInativo ? 'text-slate-500 border-slate-500/10' : 'text-indigo-600 border-indigo-500/10'}`}>Dados Pessoais</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input placeholder="Nome" required={!isEditingInativo} disabled={isEditingInativo} value={editNome} onChange={e => setEditNome(e.target.value)} className={`md:col-span-2 ${inputClass} disabled:opacity-50`} />
                    <div>
                      <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Data Nasc.</label>
                      <input type="date" required={!isEditingInativo} disabled={isEditingInativo} value={editDataNascimento} onChange={e => setEditDataNascimento(e.target.value)} className={`${inputClass} !mt-0 disabled:opacity-50`} />
                    </div>
                    <input placeholder="CPF" required={!isEditingInativo} disabled={isEditingInativo} value={editCpf} onChange={e => setEditCpf(formatCPF(e.target.value))} maxLength={14} className={`${inputClass} disabled:opacity-50`} />
                    <input placeholder="E-mail" type="email" required={!isEditingInativo} disabled={isEditingInativo} value={editEmail} onChange={e => setEditEmail(e.target.value)} className={`${inputClass} disabled:opacity-50`} />
                    <input placeholder="WhatsApp" required={!isEditingInativo} disabled={isEditingInativo} value={editTel} onChange={e => setEditTel(formatPhone(e.target.value))} maxLength={15} className={`${inputClass} disabled:opacity-50`} />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className={`text-[11px] font-semibold uppercase tracking-wider border-b pb-2 ${isEditingInativo ? 'text-slate-500 border-slate-500/10' : 'text-indigo-600 border-indigo-500/10'}`}>Endereço</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <input placeholder="CEP" required={!isEditingInativo} disabled={isEditingInativo} value={editCep} onChange={handleEditCepChange} maxLength={9} className={`col-span-2 md:col-span-1 ${inputClass} disabled:opacity-50`} />
                    <input placeholder="Endereço / Rua" required={!isEditingInativo} disabled={isEditingInativo} value={editEndereco} onChange={e => setEditEndereco(e.target.value)} className={`col-span-2 md:col-span-2 ${inputClass} disabled:opacity-50`} />
                    <input id="edit-input-numero" placeholder="Número" required={!isEditingInativo} disabled={isEditingInativo} value={editNumero} onChange={e => setEditNumero(e.target.value)} className={`col-span-2 md:col-span-1 ${inputClass} disabled:opacity-50`} />
                    <input placeholder="Complemento" disabled={isEditingInativo} value={editComplemento} onChange={e => setEditComplemento(e.target.value)} className={`col-span-2 md:col-span-1 ${inputClass} disabled:opacity-50`} />
                    <input placeholder="Bairro" required={!isEditingInativo} disabled={isEditingInativo} value={editBairro} onChange={e => setEditBairro(e.target.value)} className={`col-span-2 md:col-span-1 ${inputClass} disabled:opacity-50`} />
                    <input placeholder="Cidade" required={!isEditingInativo} disabled={isEditingInativo} value={editCidade} onChange={e => setEditCidade(e.target.value)} className={`col-span-2 md:col-span-1 ${inputClass} disabled:opacity-50`} />
                    <input placeholder="UF" required={!isEditingInativo} disabled={isEditingInativo} value={editEstado} onChange={e => setEditEstado(e.target.value)} maxLength={2} className={`col-span-2 md:col-span-1 uppercase ${inputClass} disabled:opacity-50`} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`flex items-center justify-between border-b pb-2 ${isEditingInativo ? 'border-slate-500/10' : 'border-indigo-500/10'}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${isEditingInativo ? 'text-slate-500' : 'text-indigo-600'}`}>Agendamento (Horários Fixos)</p>
                    <button type="button" onClick={addEditAgenda} disabled={isEditingInativo} className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 shadow-sm transition-all disabled:opacity-50">+ Add Horário</button>
                  </div>

                  {editAgendas.map((ag, index) => (
                    <div key={ag.id} className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 shadow-sm relative">
                      {editAgendas.length > 1 && !isEditingInativo && (
                        <button type="button" onClick={() => removeEditAgenda(index)} className="absolute -top-3 -right-2 bg-rose-100 text-rose-600 border border-rose-200 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md hover:bg-rose-500 hover:text-white transition-all">✕</button>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 ml-1">Dia</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.dia} onChange={e => handleEditAgendaChange(index, 'dia', e.target.value)} className={`${inputClass} disabled:opacity-50`}>{dias.map(d => <option key={d} value={d}>{d}</option>)}</select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 ml-1">Horário</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.horario_inicio} onChange={e => handleEditAgendaChange(index, 'horario_inicio', e.target.value)} className={`${inputClass} disabled:opacity-50`}>
                            {HORARIOS_DISPONIVEIS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 ml-1">Professor</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.professor_id} onChange={e => handleEditAgendaChange(index, 'professor_id', e.target.value)} className={`${inputClass} disabled:opacity-50`}><option value="">Selecione...</option>{professoresList.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}</select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 ml-1">Sala</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.sala_id} onChange={e => handleEditAgendaChange(index, 'sala_id', e.target.value)} className={`${inputClass} disabled:opacity-50`}><option value="">Selecione...</option>{salasList.map(sl => <option key={sl.id} value={sl.id}>{sl.nome}</option>)}</select>
                        </div>
                      </div>
                      <div className="pt-4">
                        <label className="text-xs font-semibold text-slate-500 ml-1 mb-2 block">Modalidade</label>
                        <div className="flex flex-wrap gap-2">
                          {modalidadesLista.map(m => (
                            <motion.button whileTap={{ scale: 0.95 }} key={m.nome} type="button" disabled={isEditingInativo} onClick={() => handleEditAgendaChange(index, 'instrumento_aula', m.nome)} className={`px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase border transition-all disabled:opacity-50 ${ag.instrumento_aula === m.nome ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border-transparent shadow-md scale-105' : `bg-white/50 border-white/60 text-slate-600 shadow-sm hover:bg-white`}`}>
                              {ag.instrumento_aula === m.nome && <span className="mr-2">✓</span>} {m.nome}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className={`text-[11px] font-semibold uppercase tracking-wider border-b pb-2 ${isEditingInativo ? 'text-slate-500 border-slate-500/10' : 'text-amber-600 border-amber-500/10'}`}>Marketing</p>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 ml-1">Como conheceu?</label>
                        <select required={!isEditingInativo} disabled={isEditingInativo} value={editComoConheceu} onChange={e => setEditComoConheceu(e.target.value)} className={`${inputClass} disabled:opacity-50`}><option value="">Selecione...</option><option value="Instagram">Instagram</option><option value="Google">Google</option><option value="Indicação">Indicação</option><option value="Outros">Outros</option></select>
                      </div>
                      <AnimatePresence>
                        {editComoConheceu === 'Indicação' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            <label className="text-xs font-semibold text-slate-500 ml-1">Quem indicou?</label>
                            <input required={!isEditingInativo} disabled={isEditingInativo} value={editIndicacaoNome} onChange={e => setEditIndicacaoNome(e.target.value)} className={`${inputClass} border-amber-300 focus:border-amber-500/50 disabled:opacity-50`} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className={`text-[11px] font-semibold uppercase tracking-wider border-b pb-2 ${isEditingInativo ? 'text-slate-500 border-slate-500/10' : 'text-emerald-600 border-emerald-500/10'}`}>Financeiro</p>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 ml-1 uppercase">Mensalidade (R$)</label>
                        <input type="number" required={!isEditingInativo} disabled={isEditingInativo} value={editValor} onChange={e => setEditValor(e.target.value)} className={`${inputClass} disabled:opacity-50`} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 ml-1 uppercase">Dia Vencimento</label>
                        <input type="number" min="1" max="31" required={!isEditingInativo} disabled={isEditingInativo} value={editVencimento} onChange={e => setEditVencimento(e.target.value)} className={`${inputClass} disabled:opacity-50`} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white disabled:opacity-50`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSubmitting} className="px-10 py-4 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-500 transition-all disabled:opacity-50">{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOVO MODAL: DETALHES DA AULA COM BOTÃO DE EXCLUIR */}
      <AnimatePresence>
        {isClassDetailsModalOpen && selectedClassDetails && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end md:items-center justify-center p-4 z-[90]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white/80 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 drop-shadow-sm"><span>📝</span> Resumo da Aula</h2>
                <div className="flex gap-2">
                    <button onClick={() => handleExcluirAulaHistorico(selectedClassDetails.id)} disabled={isSubmitting} className="h-10 w-10 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl font-bold flex items-center justify-center hover:bg-rose-500 hover:text-white shadow-sm transition-all disabled:opacity-50" title="Apagar Registro do Diário">🗑️</button>
                    <button onClick={() => setIsClassDetailsModalOpen(false)} disabled={isSubmitting} className="h-10 w-10 bg-white/50 text-slate-500 border border-white/80 rounded-xl font-bold flex items-center justify-center hover:bg-white shadow-sm transition-all disabled:opacity-50">✖</button>
                </div>
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

    </motion.div>
  )
}