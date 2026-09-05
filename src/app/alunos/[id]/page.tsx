"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useStyles } from '../../../lib/useStyles'
import Cropper from 'react-easy-crop'
import { motion, AnimatePresence } from 'framer-motion'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BILLING_MODELS, BillingModel, formatCurrencyBR, getBillingModel, getBillingModelLabel, isBillableClass, isConfirmedPayment } from '../../../lib/billing'
import { dateInputToISO, ensureBrazilianNinthDigit, formatBrazilianPhone, formatCEP, formatCPFOrCNPJ, formatDateInput, isoToDateInput, normalizeEmail, normalizeName } from '../../../lib/formatters'
import { getWeekdayName, formatInvoiceNumber } from '../../../lib/invoices'
import { buildFinancialDossier, FinancialCharge, summarizeFinancialDossier } from '../../../lib/financialDossier'
import { CreateInvoiceModal } from '../../../components/CreateInvoiceModal'
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  BookOpenCheck,
  Camera,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Edit3,
  FileText,
  FolderOpen,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'

const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<File | null> => { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return null; canvas.width = 256; canvas.height = 256; ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 256, 256); return new Promise(resolve => canvas.toBlob(blob => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.9)) }

const HORARIOS_DISPONIVEIS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 7;
  return `${h.toString().padStart(2, '0')}:00`;
});

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } } as const
const CLASS_STATUS_OPTIONS = [
  { value: 'Realizada', label: 'Aula realizada', fixedOnly: false },
  { value: 'Agendada', label: 'Aula agendada', fixedOnly: false },
  { value: 'Falta Injustificada', label: 'Falta sem reposição', fixedOnly: false },
  { value: 'Falta Justificada', label: 'Falta com direito à reposição', fixedOnly: true },
  { value: 'Desmarcada', label: 'Aula desmarcada com reposição', fixedOnly: true },
  { value: 'Reposição', label: 'Reposição realizada', fixedOnly: true },
  { value: 'Crédito', label: 'Conceder crédito de reposição', fixedOnly: true },
  { value: 'Ajuste de Saldo', label: 'Baixar crédito de reposição', fixedOnly: true },
]

function getClassImpact(status: string, billingModel: BillingModel) {
  if (status === 'Realizada') {
    return billingModel === 'MENSAL_FECHADO'
      ? 'Entra no saldo de aulas pendentes e poderá ser incluída na próxima fatura.'
      : billingModel === 'CREDITOS'
        ? 'Consome um crédito do pacote do aluno.'
        : 'Registra presença sem alterar o valor fixo da mensalidade.'
  }
  if (status === 'Reposição') return 'Registra a reposição realizada e pode consumir um crédito de reposição válido.'
  if (status === 'Crédito') return 'Cria um novo crédito de reposição com validade de 30 dias.'
  if (status === 'Ajuste de Saldo') return 'Baixa manualmente um crédito de reposição válido.'
  if (status === 'Falta Justificada' || status === 'Desmarcada') return 'Gera um crédito de reposição válido por 30 dias.'
  if (status === 'Falta Injustificada') return 'Registra a falta sem conceder reposição.'
  return 'Registra o compromisso no diário sem impacto financeiro imediato.'
}

export default function PerfilAluno() {
  const { s } = useStyles(); const { id } = useParams(); const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)
  
  const [aluno, setAluno] = useState<any>(null); const [aulasFixas, setAulasFixas] = useState<any[]>([]); const [participacoesTurma, setParticipacoesTurma] = useState<any[]>([]); const [pagamentos, setPagamentos] = useState<any[]>([]); const [historicoAulas, setHistoricoAulas] = useState<any[]>([]); const [faturas, setFaturas] = useState<any[]>([])
  const [ajustesCobranca, setAjustesCobranca] = useState<any[]>([])
  const [materiais, setMateriais] = useState<any[]>([])
  const [loading, setLoading] = useState(true); const [isSubmitting, setIsSubmitting] = useState(false); const [imgError, setImgError] = useState(false)

  const dias: string[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const [professoresList, setProfessoresList] = useState<any[]>([])
  const [salasList, setSalasList] = useState<any[]>([])
  const [modalidadesLista, setModalidadesLista] = useState<any[]>([])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false); const [editStatus, setEditStatus] = useState('Ativo'); const [editNome, setEditNome] = useState(''); const [editEmail, setEditEmail] = useState(''); const [editTel, setEditTel] = useState(''); const [editCpf, setEditCpf] = useState(''); const [editDataNascimento, setEditDataNascimento] = useState('')
  const [editCep, setEditCep] = useState(''); const [editEndereco, setEditEndereco] = useState(''); const [editNumero, setEditNumero] = useState(''); const [editComplemento, setEditComplemento] = useState(''); const [editBairro, setEditBairro] = useState(''); const [editCidade, setEditCidade] = useState(''); const [editEstado, setEditEstado] = useState('')
  const [editComoConheceu, setEditComoConheceu] = useState(''); const [editIndicacaoNome, setEditIndicacaoNome] = useState(''); const [editValor, setEditValor] = useState(''); const [editVencimento, setEditVencimento] = useState('')
  const [editModeloFaturamento, setEditModeloFaturamento] = useState<BillingModel>('VENCIMENTO_FIXO'); const [editValorPorAula, setEditValorPorAula] = useState(''); const [editInicioFaturamento, setEditInicioFaturamento] = useState(new Date().toISOString().slice(0, 7))
  const [editAvatarUrl, setEditAvatarUrl] = useState(''); const [editFotoArquivo, setEditFotoArquivo] = useState<File | null>(null); const [fotoPreview, setFotoPreview] = useState<string | null>(null); const [showCropModal, setShowCropModal] = useState(false); const [imageToCrop, setImageToCrop] = useState<string | null>(null); const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const [editAgendas, setEditAgendas] = useState<any[]>([])
  const [editAgendamentoCadastro, setEditAgendamentoCadastro] = useState<'AGORA' | 'DEPOIS'>('AGORA')

  const [isClassModalOpen, setIsClassModalOpen] = useState(false); const [editingClassId, setEditingClassId] = useState<string | null>(null); const [dataAula, setDataAula] = useState(new Date().toISOString().split('T')[0]); const [horaInicioAula, setHoraInicioAula] = useState('08:00'); const [horaFimAula, setHoraFimAula] = useState('09:00'); const [statusAula, setStatusAula] = useState('Realizada'); const [obsAula, setObsAula] = useState('')
  const [professorAula, setProfessorAula] = useState(''); const [modalidadeAula, setModalidadeAula] = useState(''); const [valorAula, setValorAula] = useState(''); const [consumirCreditoReposicao, setConsumirCreditoReposicao] = useState(true); const [motivoAjusteAula, setMotivoAjusteAula] = useState('')
  const [isDeleteClassModalOpen, setIsDeleteClassModalOpen] = useState(false); const [deleteClassReason, setDeleteClassReason] = useState('')
  const [isPayModalOpen, setIsPayModalOpen] = useState(false); const [payData, setPayData] = useState(new Date().toISOString().split('T')[0]); const [payMetodo, setPayMetodo] = useState('PIX'); const [payValor, setPayValor] = useState(''); const [payFaturaId, setPayFaturaId] = useState(''); const [payCompetencia, setPayCompetencia] = useState(new Date().toISOString().slice(0, 7))

  const [isEditPayModalOpen, setIsEditPayModalOpen] = useState(false); const [editPayId, setEditPayId] = useState(''); const [editPayData, setEditPayData] = useState(''); const [editPayMetodo, setEditPayMetodo] = useState('PIX'); const [editPayValor, setEditPayValor] = useState(''); const [editPayStatus, setEditPayStatus] = useState('Pago'); const [editPayFaturaId, setEditPayFaturaId] = useState(''); const [editPayCompetencia, setEditPayCompetencia] = useState(new Date().toISOString().slice(0, 7));

  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false)
  const [msgTitulo, setMsgTitulo] = useState('Aviso da Secretaria')
  const [msgTexto, setMsgTexto] = useState('')

  const [isClassDetailsModalOpen, setIsClassDetailsModalOpen] = useState(false)
  const [selectedClassDetails, setSelectedClassDetails] = useState<any>(null)

  const [saldoCreditos, setSaldoCreditos] = useState(0)
  const [activeTab, setActiveTab] = useState<'visao' | 'aulas' | 'financeiro' | 'arquivos'>('visao')

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarDados() }, [id, isMounted])
  useEffect(() => {
    if (!isMounted || !id) return
    const channel = supabase
      .channel(`financeiro-aluno-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_aulas', filter: `aluno_id=eq.${id}` }, () => carregarDados())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos', filter: `aluno_id=eq.${id}` }, () => carregarDados())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alunos_info', filter: `id=eq.${id}` }, () => carregarDados())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, isMounted])
  useEffect(() => { if (horaInicioAula) { const [h, m] = horaInicioAula.split(':').map(Number); const d = new Date(); d.setHours(h + 1, m); setHoraFimAula(d.toTimeString().slice(0, 5)) } }, [horaInicioAula])

  async function carregarDados() {
    const { data: profile } = await supabase.from('profiles').select('*, alunos_info(*)').eq('id', id).single()
    const { data: agenda } = await supabase.from('agenda').select(`*, professor:profiles!professor_id(nome_completo), sala:salas(nome)`).eq('aluno_id', id).order('dia')
    const { data: participacoes } = await supabase.from('turma_alunos').select('aluno_id, turma_id, status').eq('aluno_id', id).eq('status', 'ATIVO')
    const { data: pgs } = await supabase.from('pagamentos').select('*').eq('aluno_id', id).order('data_pagamento', { ascending: false })
    const { data: hist } = await supabase.from('historico_aulas').select('*').eq('aluno_id', id).order('data_aula', { ascending: false })
    const { data: invoices } = await supabase.from('faturas').select('*').eq('aluno_id', id).order('data_emissao', { ascending: false })
    const { data: mats } = await supabase.from('materiais_aluno').select('*').eq('aluno_id', id).order('data_envio', { ascending: false })
    const { data: reposicoes } = await supabase.from('solicitacoes_reagendamento').select('*').eq('aluno_id', id)
    const { data: ajustes } = await supabase.from('ajustes_cobranca').select('*').eq('aluno_id', id)
    
    const info = Array.isArray(profile?.alunos_info) ? profile?.alunos_info[0] : profile?.alunos_info;
    if (getBillingModel(info) === 'VENCIMENTO_FIXO') {
      const { data: creditosReposicao, error: creditosError } = await supabase
        .from('creditos_reposicao')
        .select('id')
        .eq('aluno_id', id)
        .is('usado_em', null)
        .gte('expira_em', new Date().toISOString().slice(0, 10));

      if (!creditosError) {
        setSaldoCreditos(creditosReposicao?.length || 0);
      } else {
        const qtdDesmarcadas = (hist || []).filter(h => h.status === 'Desmarcada' || h.status === 'Crédito' || h.status === 'Falta Justificada').length;
        const qtdUsadasPortal = (reposicoes || []).filter((r: any) => r.status !== 'Negada').length;
        const qtdUsadasManual = (hist || []).filter(h => h.status === 'Reposição' || h.status === 'Ajuste de Saldo').length;
        setSaldoCreditos(Math.max(0, qtdDesmarcadas - (qtdUsadasPortal + qtdUsadasManual)));
      }
    } else {
      setSaldoCreditos(0);
    }

    const { data: pL } = await supabase.from('profiles').select('id, nome_completo').in('role', ['PROFESSOR', 'ADMIN'])
    const { data: sL } = await supabase.from('salas').select('id, nome')
    const { data: mL } = await supabase.from('modalidades').select('nome').order('nome')

    setProfessoresList(pL || []); setSalasList(sL || []); setModalidadesLista(mL || [])
    setAluno(profile); setAulasFixas(agenda || []); setParticipacoesTurma(participacoes || []); setPagamentos(pgs || []); setHistoricoAulas(hist || []); setFaturas(invoices || []); setMateriais(mats || []); setAjustesCobranca(ajustes || []); setLoading(false)
  }

  const infoMatricula = Array.isArray(aluno?.alunos_info) ? aluno?.alunos_info[0] : aluno?.alunos_info; const isAlunoInativo = infoMatricula?.status === 'Inativo'; const isEditingInativo = editStatus === 'Inativo'
  const modeloFaturamento = getBillingModel(infoMatricula)
  const pagamentosConfirmados = pagamentos.filter(isConfirmedPayment)
  const faturasDisponiveisPagamento = faturas.filter(fatura => !['PAGO', 'CANCELADO'].includes(String(fatura.status).toUpperCase()))

  const abrirModalEdicao = () => { 
    setEditStatus(infoMatricula?.status || 'Ativo'); setEditNome(aluno.nome_completo || ''); setEditEmail(aluno.email || ''); setEditTel(aluno.telefone || ''); setEditCpf(aluno.cpf || ''); setEditDataNascimento(isoToDateInput(aluno.data_nascimento)); setEditCep(aluno.cep || ''); setEditEndereco(aluno.endereco || ''); setEditNumero(aluno.numero || ''); setEditComplemento(aluno.complemento || ''); setEditBairro(aluno.bairro || ''); setEditCidade(aluno.cidade || ''); setEditEstado(aluno.estado || ''); setEditComoConheceu(infoMatricula?.como_conheceu || ''); setEditIndicacaoNome(infoMatricula?.indicacao_nome || ''); setEditValor(infoMatricula?.valor_mensalidade || ''); setEditVencimento(infoMatricula?.data_vencimento || ''); setEditModeloFaturamento(getBillingModel(infoMatricula)); setEditValorPorAula(infoMatricula?.valor_por_aula || ''); setEditInicioFaturamento(String(infoMatricula?.inicio_faturamento || infoMatricula?.modelo_faturamento_desde || aluno.created_at || new Date().toISOString()).slice(0, 7)); setEditAvatarUrl(aluno.avatar_url || ''); setFotoPreview(aluno.avatar_url || null); setEditFotoArquivo(null);
    
    if (aulasFixas.length > 0) { 
      setEditAgendamentoCadastro('AGORA')
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
      setEditAgendamentoCadastro('DEPOIS')
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
    const dataNascimentoISO = editDataNascimento ? dateInputToISO(editDataNascimento) : null;
    if (!isEditingInativo && !dataNascimentoISO) {
      setIsSubmitting(false);
      return alert("Informe uma data de nascimento válida no formato DD/MM/AAAA.");
    }
    if (!isEditingInativo && editModeloFaturamento === 'MENSAL_FECHADO' && Number(editValorPorAula) <= 0) {
      setIsSubmitting(false);
      return alert("Informe o valor cobrado por aula.");
    }
    const documentoNumeros = editCpf.replace(/\D/g, '');
    if (!isEditingInativo && ![11, 14].includes(documentoNumeros.length)) {
      setIsSubmitting(false);
      return alert("Informe um CPF ou CNPJ válido para o faturamento.");
    }
    
    const agendasParaSalvar = !isEditingInativo && editAgendamentoCadastro === 'AGORA' ? editAgendas : [];

    if (!isEditingInativo && agendasParaSalvar.length > 0) {
      if (agendasParaSalvar.some(ag => !ag.professor_id || !ag.sala_id || !ag.instrumento_aula)) {
        setIsSubmitting(false);
        return alert("Preencha modalidade, sala e professor de TODOS os horários de aula.");
      }

      const conflitoNoFormulario = agendasParaSalvar.find((ag, index) =>
        agendasParaSalvar.some((outraAgenda, outroIndex) =>
          index !== outroIndex &&
          ag.dia === outraAgenda.dia &&
          (ag.professor_id === outraAgenda.professor_id || String(ag.sala_id) === String(outraAgenda.sala_id)) &&
          ag.horario_inicio < outraAgenda.horario_fim &&
          ag.horario_fim > outraAgenda.horario_inicio
        )
      );

      if (conflitoNoFormulario) {
        setIsSubmitting(false);
        return alert(`🚨 CONFLITO DE AGENDA: O professor ou sala já está ocupado no dia ${conflitoNoFormulario.dia} às ${conflitoNoFormulario.horario_inicio}.`);
      }

      const { data: alunosAtivos, error: alunosAtivosError } = await supabase
        .from('alunos_info')
        .select('id')
        .eq('status', 'Ativo')
        .neq('id', String(id));

      if (alunosAtivosError) {
        console.error('Erro ao validar alunos ativos:', alunosAtivosError);
        setIsSubmitting(false);
        return alert('Não foi possível validar os conflitos de agenda. Tente novamente.');
      }

      const idsAlunosAtivos = (alunosAtivos || []).map(alunoAtivo => alunoAtivo.id);

      for (let ag of agendasParaSalvar) {
        if (idsAlunosAtivos.length === 0) break;

        const { data: conflitos, error: conflitosError } = await supabase
          .from('agenda')
          .select('id')
          .in('aluno_id', idsAlunosAtivos)
          .eq('dia', ag.dia)
          .or(`professor_id.eq.${ag.professor_id},sala_id.eq.${ag.sala_id}`)
          .lt('horario_inicio', ag.horario_fim)
          .gt('horario_fim', ag.horario_inicio);

        if (conflitosError) {
          console.error('Erro ao validar conflitos de agenda:', conflitosError);
          setIsSubmitting(false);
          return alert('Não foi possível validar os conflitos de agenda. Tente novamente.');
        }

        if (conflitos && conflitos.length > 0) { 
          setIsSubmitting(false); 
          return alert(`🚨 CONFLITO DE AGENDA: O professor ou sala já está ocupado no dia ${ag.dia} às ${ag.horario_inicio}.`) 
        }
      }
    }

    let finalAvatarUrl = editAvatarUrl; 
    if (editFotoArquivo) { const fileName = `alunos/${id}-${crypto.randomUUID()}.jpg`; const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, editFotoArquivo); if (!uploadError) { finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl } } 
    
    const { error: err1 } = await supabase.from('profiles').update({ nome_completo: normalizeName(editNome), email: normalizeEmail(editEmail), telefone: ensureBrazilianNinthDigit(editTel), cpf: formatCPFOrCNPJ(editCpf), data_nascimento: dataNascimentoISO, cep: formatCEP(editCep), endereco: editEndereco, numero: editNumero, complemento: editComplemento, bairro: editBairro, cidade: editCidade, estado: editEstado.toUpperCase(), avatar_url: finalAvatarUrl }).eq('id', id); if (err1) { setIsSubmitting(false); return alert("Erro: " + err1.message) }
    
    const dataInativacao = editStatus === 'Inativo' ? new Date().toISOString().split('T')[0] : null;
    const valorBase = editModeloFaturamento === 'MENSAL_FECHADO'
      ? Number((Number(editValorPorAula) * 4).toFixed(2))
      : Number(editValor || 0);
    const { error: infoError } = await supabase.from('alunos_info').update({
      valor_mensalidade: valorBase,
      data_vencimento: editModeloFaturamento === 'VENCIMENTO_FIXO' && editVencimento ? parseInt(editVencimento) : null,
      modelo_faturamento: editModeloFaturamento,
      creditos_por_pagamento: 4,
      valor_por_aula: editModeloFaturamento === 'MENSAL_FECHADO' ? Number(editValorPorAula) : null,
      prazo_vencimento_dias: 7,
      inicio_faturamento: `${editInicioFaturamento}-01`,
      status: editStatus,
      como_conheceu: editComoConheceu,
      indicacao_nome: editComoConheceu === 'Indicação' ? editIndicacaoNome : null,
      data_inativacao: dataInativacao
    }).eq('id', id);
    if (infoError) {
      setIsSubmitting(false);
      return alert("Erro ao atualizar o faturamento: " + infoError.message);
    }
    
    if (!isEditingInativo) {
      const idsAtuais = agendasParaSalvar.filter(a => !String(a.id).startsWith('new_')).map(a => a.id);
      const deletados = aulasFixas.filter(a => !idsAtuais.includes(a.id));
      for (let del of deletados) {
          const { error: deleteAgendaError } = await supabase.from('agenda').delete().eq('id', del.id);
          if (deleteAgendaError) {
            setIsSubmitting(false);
            return alert("Não foi possível liberar um dos horários antigos: " + deleteAgendaError.message);
          }
      }

      for (let ag of agendasParaSalvar) {
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
  const valorPadraoAula = () => {
    const valorDireto = Number(infoMatricula?.valor_por_aula || 0)
    if (valorDireto > 0) return valorDireto
    const tamanhoPacote = Math.max(1, Number(infoMatricula?.creditos_por_pagamento || 4))
    return Number(infoMatricula?.valor_mensalidade || 0) / tamanhoPacote
  }

  const abrirNovoMovimento = (statusInicial = 'Realizada') => {
    const dataInicial = new Date().toISOString().split('T')[0]
    const weekday = getWeekdayName(dataInicial)
    const schedule =
      aulasFixas.find(
        aula =>
          aula.dia === weekday &&
          aula.horario_inicio?.slice(0, 5) === '08:00',
      ) ||
      aulasFixas.find(aula => aula.dia === weekday) ||
      aulasFixas[0]

    setEditingClassId(null)
    setSelectedClassDetails(null)
    setDataAula(dataInicial)
    setHoraInicioAula(schedule?.horario_inicio?.slice(0, 5) || '08:00')
    setHoraFimAula(schedule?.horario_fim?.slice(0, 5) || '09:00')
    setStatusAula(statusInicial)
    setObsAula('')
    setProfessorAula(schedule?.professor_id || '')
    setModalidadeAula(schedule?.instrumento_aula || modalidadesLista[0]?.nome || '')
    setValorAula(valorPadraoAula() > 0 ? valorPadraoAula().toFixed(2) : '')
    setConsumirCreditoReposicao(statusInicial === 'Reposição' || statusInicial === 'Ajuste de Saldo')
    setMotivoAjusteAula('')
    setIsClassModalOpen(true)
  }

  const abrirEdicaoMovimento = (aula: any) => {
    setEditingClassId(String(aula.id))
    setDataAula(String(aula.data_aula).slice(0, 10))
    setHoraInicioAula(aula.horario_inicio?.slice(0, 5) || '08:00')
    setHoraFimAula(aula.horario_fim?.slice(0, 5) || '09:00')
    setStatusAula(aula.status || 'Realizada')
    setObsAula(aula.observacoes || '')
    setProfessorAula(aula.professor_id || '')
    setModalidadeAula(aula.modalidade || '')
    setValorAula(
      aula.valor_aula_faturado !== null && aula.valor_aula_faturado !== undefined
        ? Number(aula.valor_aula_faturado).toFixed(2)
        : valorPadraoAula() > 0
          ? valorPadraoAula().toFixed(2)
          : '',
    )
    setConsumirCreditoReposicao(Boolean(aula.credito_reposicao_id))
    setMotivoAjusteAula('')
    setIsClassDetailsModalOpen(false)
    setIsClassModalOpen(true)
  }

  const handleRegistrarAula = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingClassId && motivoAjusteAula.trim().length < 3) {
      return alert('Informe brevemente por que este lançamento está sendo alterado.')
    }
    if (modeloFaturamento === 'MENSAL_FECHADO' && isBillableClass(statusAula) && Number(valorAula) < 0) {
      return alert('Informe um valor válido para a aula.')
    }

    setIsSubmitting(true)
    const valorCongelado =
      isBillableClass(statusAula) && (modeloFaturamento === 'MENSAL_FECHADO' || Number(valorAula) > 0)
        ? Number(valorAula || 0)
        : null
    const { error } = await supabase.rpc('salvar_movimento_aluno', {
      p_aluno_id: id,
      p_data_aula: dataAula,
      p_horario_inicio: ['Crédito', 'Ajuste de Saldo'].includes(statusAula) ? null : horaInicioAula || null,
      p_horario_fim: ['Crédito', 'Ajuste de Saldo'].includes(statusAula) ? null : horaFimAula || null,
      p_status: statusAula,
      p_observacoes: obsAula || null,
      p_professor_id: professorAula || null,
      p_modalidade: modalidadeAula || null,
      p_valor_aula: valorCongelado,
      p_consumir_credito:
        statusAula === 'Ajuste de Saldo' || (statusAula === 'Reposição' && consumirCreditoReposicao),
      p_historico_id: editingClassId,
      p_motivo: motivoAjusteAula || null,
    })

    setIsSubmitting(false)
    if (error) {
      const migrationMissing = error.message.includes('salvar_movimento_aluno')
      return alert(
        migrationMissing
          ? 'A atualização de controle de aulas ainda precisa ser aplicada no Supabase.'
          : `Não foi possível salvar o lançamento: ${error.message}`,
      )
    }

    setIsClassModalOpen(false)
    setEditingClassId(null)
    setObsAula('')
    setMotivoAjusteAula('')
    await carregarDados()
  }
  const abrirModalPagamento = (cobranca?: FinancialCharge) => {
    if (cobranca) {
      setPayFaturaId(cobranca.invoiceId || '')
      setPayCompetencia(String(cobranca.competencia || new Date().toISOString()).slice(0, 7))
      setPayValor(Number(cobranca.valor || 0).toFixed(2))
      setPayData(new Date().toISOString().split('T')[0])
      setPayMetodo('PIX')
      setIsPayModalOpen(true)
      return
    }
    const prefixo = new Date().toISOString().slice(0, 7);
    const totalMesFechado = historicoAulas
      .filter(h => String(h.data_aula).startsWith(prefixo) && isBillableClass(h.status))
      .reduce(
        (total, aula) =>
          total + Number(
            aula.valor_aula_faturado ?? infoMatricula?.valor_por_aula ?? 0,
          ),
        0,
      );
    const faturaAberta = faturasDisponiveisPagamento[0]
    setPayFaturaId(faturaAberta?.id || '')
    setPayCompetencia(String(faturaAberta?.competencia || new Date().toISOString()).slice(0, 7))
    setPayValor(faturaAberta ? Number(faturaAberta.valor_total || 0).toFixed(2) : modeloFaturamento === 'MENSAL_FECHADO' ? totalMesFechado.toFixed(2) : infoMatricula?.valor_mensalidade || '');
    setPayData(new Date().toISOString().split('T')[0]);
    setPayMetodo('PIX');
    setIsPayModalOpen(true)
  }
  const handleSalvarPagamento = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const { error } = await supabase.from('pagamentos').insert([{
      aluno_id: id,
      fatura_id: payFaturaId || null,
      valor: parseFloat(payValor),
      status: 'Pago',
      data_pagamento: payData,
      competencia: `${payCompetencia}-01`,
      metodo_pagamento: payMetodo,
    }])
    if (!error && payFaturaId) {
      await supabase.from('faturas').update({ status: 'PAGO', pago_em: `${payData}T12:00:00-03:00`, atualizado_em: new Date().toISOString() }).eq('id', payFaturaId)
    }
    setIsSubmitting(false)
    if (error) return alert(`Erro ao registrar pagamento: ${error.message}`)
    setIsPayModalOpen(false)
    carregarDados()
  }
  const abrirModalEdicaoPagamento = (pg: any) => { setEditPayId(pg.id); setEditPayData(pg.data_pagamento.split('T')[0]); setEditPayMetodo(pg.metodo_pagamento || 'PIX'); setEditPayValor(pg.valor); setEditPayStatus(pg.status || 'Pendente'); setEditPayFaturaId(pg.fatura_id || ''); setEditPayCompetencia(String(pg.competencia || pg.data_pagamento).slice(0, 7)); setIsEditPayModalOpen(true); }
  const handleSalvarEdicaoPagamento = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await supabase.from('pagamentos').update({ valor: parseFloat(editPayValor), data_pagamento: editPayData, competencia: `${editPayCompetencia}-01`, metodo_pagamento: editPayMetodo, status: editPayStatus, fatura_id: editPayFaturaId || null }).eq('id', editPayId)
    if (editPayFaturaId) {
      const confirmado = isConfirmedPayment(editPayStatus)
      await supabase.from('faturas').update({
        status: confirmado ? 'PAGO' : 'PENDENTE',
        pago_em: confirmado ? `${editPayData}T12:00:00-03:00` : null,
        atualizado_em: new Date().toISOString(),
      }).eq('id', editPayFaturaId)
    }
    setIsSubmitting(false)
    setIsEditPayModalOpen(false)
    carregarDados()
  }
  const handleExcluirPagamento = async (paymentId: string) => {
    if (!window.confirm("🚨 Apagar definitivamente este registro de pagamento?")) return
    await supabase.from('pagamentos').delete().eq('id', paymentId)
    if (editPayFaturaId) {
      await supabase.from('faturas').update({ status: 'PENDENTE', pago_em: null, atualizado_em: new Date().toISOString() }).eq('id', editPayFaturaId)
    }
    setIsEditPayModalOpen(false)
    carregarDados()
  }
  const handleUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => { if (!e.target.files || e.target.files.length === 0) return; const file = e.target.files[0]; setIsSubmitting(true); const fileExt = file.name.split('.').pop(); const fileName = `${id}/${crypto.randomUUID()}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('materiais').upload(fileName, file); if (uploadError) { alert("Erro ao enviar arquivo: " + uploadError.message); setIsSubmitting(false); return; } const { data: publicUrlData } = supabase.storage.from('materiais').getPublicUrl(fileName); await supabase.from('materiais_aluno').insert([{ aluno_id: id, nome_arquivo: file.name, url_arquivo: publicUrlData.publicUrl, tipo_arquivo: file.type || 'Desconhecido' }]); carregarDados(); setIsSubmitting(false); alert("✅ Material enviado com sucesso!"); }
  const excluirMaterial = async (matId: string) => { if (!window.confirm("Apagar este material? O aluno não poderá mais acessar.")) return; await supabase.from('materiais_aluno').delete().eq('id', matId); carregarDados(); }

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    const titulo = msgTitulo.trim();
    const mensagem = msgTexto.trim();
    if (!titulo || !mensagem) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('notificacoes_aluno').insert([{ aluno_id: id, titulo, mensagem }])
    setIsSubmitting(false);
    if (error) return alert("Não foi possível enviar o aviso: " + error.message);
    alert("✅ Aviso enviado para o aluno!");
    setIsMsgModalOpen(false); setMsgTitulo('Aviso da Secretaria'); setMsgTexto('');
  }

  const handleConcederCredito = async () => {
    abrirNovoMovimento('Crédito')
  }

  const handleRemoverCredito = async () => {
    if (saldoCreditos <= 0) return alert("O aluno não possui saldo para remover.");
    abrirNovoMovimento('Ajuste de Saldo')
  }

  const handleExcluirAulaHistorico = async () => {
    if (!selectedClassDetails || deleteClassReason.trim().length < 3) return;
    setIsSubmitting(true);
    const { error } = await supabase.rpc('excluir_movimento_aluno', {
      p_historico_id: String(selectedClassDetails.id),
      p_motivo: deleteClassReason.trim(),
    })
    setIsSubmitting(false);
    if (error) {
      const migrationMissing = error.message.includes('excluir_movimento_aluno')
      return alert(
        migrationMissing
          ? 'A atualização de controle de aulas ainda precisa ser aplicada no Supabase.'
          : `Não foi possível excluir o lançamento: ${error.message}`,
      )
    }
    setIsDeleteClassModalOpen(false)
    setIsClassDetailsModalOpen(false);
    setDeleteClassReason('')
    await carregarDados();
  }

  const abrirDetalhesAula = (aula: any) => {
    setSelectedClassDetails(aula);
    setIsClassDetailsModalOpen(true);
  }

  const gerarPdfAulas = () => {
    const doc = new jsPDF();
    doc.text(`Histórico de Aulas - ${aluno.nome_completo}`, 14, 15);
    const ultimoPagamento = pagamentosConfirmados.length > 0 ? pagamentosConfirmados[0].data_pagamento : null;
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
    const tableData = pagamentosConfirmados.map(p => {
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
  const ultimoPagamentoObj = pagamentosConfirmados.length > 0 ? pagamentosConfirmados[0] : null;
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
  const prefixoMesAtual = new Date().toISOString().slice(0, 7);
  const aulasRealizadasNoMes = historicoAulas.filter(h =>
    String(h.data_aula).startsWith(prefixoMesAtual) && isBillableClass(h.status)
  ).length;
  const valorApuradoNoMes = historicoAulas
    .filter(h => String(h.data_aula).startsWith(prefixoMesAtual) && isBillableClass(h.status))
    .reduce(
      (total, aula) =>
        total + Number(
          aula.valor_aula_faturado ?? infoMatricula?.valor_por_aula ?? 0,
        ),
      0,
    );
  const aulasPendentesFaturamento = historicoAulas.filter(
    aula => isBillableClass(aula.status) && !aula.fatura_id,
  )
  const valorPendenteAulas = aulasPendentesFaturamento.reduce(
    (total, aula) =>
      total + Number(
        aula.valor_aula_faturado ?? infoMatricula?.valor_por_aula ?? 0,
      ),
    0,
  )
  const cobrancasAluno = buildFinancialDossier({
    alunos: aluno ? [aluno] : [],
    pagamentos,
    faturas,
    ajustes: ajustesCobranca,
    historicoMes: historicoAulas.filter(aula => String(aula.data_aula).startsWith(prefixoMesAtual)),
    agendas: aulasFixas,
    participacoesTurma,
  })
  const resumoFinanceiroAluno = summarizeFinancialDossier(cobrancasAluno)
  const valorEmAberto = resumoFinanceiroAluno.totalOpen
  const totalRecebido = pagamentosConfirmados.reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
  const registrosDePresenca = historicoAulas.filter(h => ['Realizada', 'Falta', 'Falta Injustificada', 'Falta Justificada'].includes(h.status));
  const aulasRealizadasTotal = registrosDePresenca.filter(h => h.status === 'Realizada').length;
  const taxaPresenca = registrosDePresenca.length > 0 ? Math.round((aulasRealizadasTotal / registrosDePresenca.length) * 100) : 0;
  const ultimoRegistroAula = historicoAulas.find(h => h.status !== 'Ajuste de Saldo');
  const whatsappUrl = aluno?.telefone ? `https://wa.me/55${String(aluno.telefone).replace(/\D/g, '')}` : null;

  const inputClass = "premium-form-control";
  const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
  const formSectionClass = "rounded-2xl border border-[#dfded7] bg-white p-5 md:p-6";

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-[1500px] mx-auto pb-8">
      <motion.header variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/alunos')}
            aria-label="Voltar para alunos"
            className="h-10 w-10 rounded-xl border border-[#dfded7] bg-white flex items-center justify-center text-slate-600 hover:text-[#1f4a3a] hover:border-[#aebfb4] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="premium-kicker mb-1">Cadastro do aluno</div>
            <p className="text-sm text-slate-500">Informações, aulas e relacionamento financeiro.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMsgModalOpen(true)} className="px-3.5 py-2.5 rounded-xl border border-[#dfded7] bg-white text-slate-600 text-xs font-semibold flex items-center gap-2 hover:border-[#aebfb4] hover:text-[#1f4a3a] transition-colors">
            <Bell size={15} /> <span className="hidden sm:inline">Enviar aviso</span>
          </button>
          <button onClick={abrirModalEdicao} className="px-4 py-2.5 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center gap-2 hover:bg-[#17382c] transition-colors">
            <Edit3 size={15} /> Editar aluno
          </button>
          <details className="relative">
            <summary className="list-none h-10 w-10 rounded-xl border border-[#dfded7] bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer">
              <MoreHorizontal size={18} />
            </summary>
            <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-[#dfded7] bg-white p-1.5 shadow-xl">
              <button onClick={handleExcluirAluno} className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                <Trash2 size={14} /> Excluir aluno
              </button>
            </div>
          </details>
        </div>
      </motion.header>

      <motion.section variants={itemVariants} className="premium-panel overflow-hidden mb-5">
        <div className="p-5 md:p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-6 xl:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
            <div className={`h-24 w-24 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border ${isAlunoInativo ? 'border-rose-200 bg-rose-50' : 'border-[#d7dfd9] bg-[#e7efe9]'}`}>
              {aluno?.avatar_url && !imgError
                ? <img src={aluno.avatar_url} alt="" className={`w-full h-full object-cover ${isAlunoInativo ? 'grayscale opacity-70' : ''}`} onError={() => setImgError(true)} />
                : <span className={`text-3xl font-semibold ${isAlunoInativo ? 'text-rose-400' : 'text-[#1f4a3a]'}`}>{aluno?.nome_completo?.charAt(0)}</span>}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 truncate">{aluno?.nome_completo}</h1>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide border ${isAlunoInativo ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-[#e7efe9] text-[#1f4a3a] border-[#cbdad0]'}`}>
                  {isAlunoInativo ? 'Matrícula inativa' : 'Aluno ativo'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-slate-500">
                {aluno?.email && <a href={`mailto:${aluno.email}`} className="flex items-center gap-1.5 hover:text-[#1f4a3a]"><Mail size={13} /> {aluno.email}</a>}
                {aluno?.telefone && <a href={whatsappUrl || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[#1f4a3a]"><Phone size={13} /> {aluno.telefone}</a>}
                {aluno?.cidade && <span className="flex items-center gap-1.5"><MapPin size={13} /> {aluno.cidade}/{aluno.estado}</span>}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {aulasFixas.length > 0
                  ? `${aulasFixas.map(aula => `${aula.instrumento_aula} · ${aula.dia}, ${aula.horario_inicio.slice(0, 5)}`).join(' • ')}`
                  : 'Nenhum horário fixo cadastrado.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
            <div className="min-w-[112px] border-l border-[#e5e3dd] pl-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Presença</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{taxaPresenca}%</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{aulasRealizadasTotal} realizadas</p>
            </div>
            <div className="min-w-[112px] border-l border-[#e5e3dd] pl-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Em aberto</p>
              <p className={`text-xl font-semibold mt-1 ${valorEmAberto > 0 ? 'text-[#a56a32]' : 'text-slate-900'}`}>{formatCurrencyBR(valorEmAberto)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{resumoFinanceiroAluno.open.length} cobrança(s)</p>
            </div>
            <div className="min-w-[112px] border-l border-[#e5e3dd] pl-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Faturamento</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{getBillingModelLabel(modeloFaturamento)}</p>
              <p className="text-[10px] text-slate-500 mt-1">{modeloFaturamento === 'MENSAL_FECHADO' ? `${formatCurrencyBR(infoMatricula?.valor_por_aula)}/aula` : formatCurrencyBR(infoMatricula?.valor_mensalidade)}</p>
            </div>
            <div className="min-w-[112px] border-l border-[#e5e3dd] pl-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Última aula</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{ultimoRegistroAula ? new Date(ultimoRegistroAula.data_aula).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</p>
              <p className="text-[10px] text-slate-500 mt-1">{ultimoRegistroAula?.status || 'Sem registros'}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.nav variants={itemVariants} aria-label="Seções do aluno" className="premium-panel p-1.5 flex gap-1 overflow-x-auto custom-scrollbar mb-5">
        {[
          { id: 'visao', label: 'Visão geral', icon: UserRound },
          { id: 'aulas', label: 'Aulas e diário', icon: BookOpenCheck, count: historicoAulas.length },
          { id: 'financeiro', label: 'Financeiro', icon: WalletCards, count: resumoFinanceiroAluno.open.length },
          { id: 'arquivos', label: 'Arquivos', icon: FolderOpen, count: materiais.length },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${isActive ? 'bg-[#1f4a3a] text-white' : 'text-slate-500 hover:bg-[#f3f4ef] hover:text-slate-800'}`}
            >
              <Icon size={15} /> {tab.label}
              {tab.count !== undefined && <span className={`min-w-5 h-5 px-1 rounded-full text-[9px] flex items-center justify-center ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>}
            </button>
          )
        })}
      </motion.nav>

      {activeTab === 'visao' && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] gap-5 items-start">
          <section className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7] flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                  <CalendarClock size={19} className="text-[#1f4a3a]" /> Rotina de aulas
                </h2>
                <p className="text-xs text-slate-500 mt-1">Horários recorrentes e responsáveis.</p>
              </div>
              <button onClick={abrirModalEdicao} className="text-[11px] font-semibold text-[#1f4a3a] hover:underline">Editar grade</button>
            </div>
            <div className="divide-y divide-[#ebe9e3]">
              {aulasFixas.map(aula => {
                const nomeProf = Array.isArray(aula.professor) ? aula.professor[0]?.nome_completo : aula.professor?.nome_completo
                const nomeSala = Array.isArray(aula.sala) ? aula.sala[0]?.nome : aula.sala?.nome
                return (
                  <div key={aula.id} className="px-5 py-4 grid grid-cols-[74px_minmax(0,1fr)] sm:grid-cols-[90px_110px_minmax(0,1fr)_auto] gap-3 items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{aula.dia}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{aula.horario_inicio.slice(0, 5)}</p>
                    </div>
                    <div className="hidden sm:block text-xs text-slate-600">{aula.horario_inicio.slice(0, 5)} — {aula.horario_fim.slice(0, 5)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{aula.instrumento_aula}</p>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">Prof. {nomeProf || 'Não definido'} · {nomeSala || 'Sem sala'}</p>
                    </div>
                    <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-[#e7efe9] text-[#1f4a3a] text-[9px] font-semibold uppercase tracking-wide">Fixo</span>
                  </div>
                )
              })}
              {aulasFixas.length === 0 && (
                <div className="py-12 px-6 text-center">
                  <CalendarClock size={28} strokeWidth={1.5} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Sem horário fixo</p>
                  <button onClick={abrirModalEdicao} className="text-xs text-[#1f4a3a] mt-2 hover:underline">Cadastrar grade</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 border-t border-[#dfded7] bg-[#faf9f6]">
              <div className="p-4 md:border-r border-[#e5e3dd]">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Modelo financeiro</p>
                <p className="text-sm font-semibold text-slate-800 mt-1.5">{getBillingModelLabel(modeloFaturamento)}</p>
                <p className="text-[10px] text-slate-500 mt-1">{BILLING_MODELS.find(model => model.value === modeloFaturamento)?.description}</p>
              </div>
              <div className="p-4 md:border-r border-[#e5e3dd]">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {modeloFaturamento === 'CREDITOS' ? 'Créditos disponíveis' : modeloFaturamento === 'MENSAL_FECHADO' ? 'Apuração do mês' : 'Aulas no ciclo'}
                </p>
                <p className="text-xl font-semibold text-slate-900 mt-1.5">
                  {modeloFaturamento === 'CREDITOS'
                    ? Number(infoMatricula?.saldo_creditos_faturamento || 0)
                    : modeloFaturamento === 'MENSAL_FECHADO'
                      ? aulasRealizadasNoMes
                      : aulasDesdeUltimoPagamento}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {modeloFaturamento === 'CREDITOS' ? 'de 4 por pagamento' : modeloFaturamento === 'MENSAL_FECHADO' ? `Parcial de ${formatCurrencyBR(valorApuradoNoMes)}` : 'desde o último pagamento'}
                </p>
              </div>
              <div className="p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Reposições disponíveis</p>
                <div className="flex items-center justify-between gap-3 mt-1.5">
                  <div>
                    <p className="text-xl font-semibold text-slate-900">{saldoCreditos}</p>
                    <p className="text-[10px] text-slate-500 mt-1">validade de 30 dias</p>
                  </div>
                  {modeloFaturamento === 'VENCIMENTO_FIXO' && (
                    <div className="flex gap-1.5">
                      <button onClick={handleRemoverCredito} disabled={isSubmitting || saldoCreditos <= 0} className="h-8 w-8 rounded-lg border border-[#dfded7] bg-white text-slate-500 disabled:opacity-40">−</button>
                      <button onClick={handleConcederCredito} disabled={isSubmitting} className="h-8 w-8 rounded-lg bg-[#1f4a3a] text-white disabled:opacity-40">+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7]">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
                <UserRound size={19} className="text-[#1f4a3a]" /> Dados cadastrais
              </h2>
              <p className="text-xs text-slate-500 mt-1">Informações essenciais e origem.</p>
            </div>
            <dl className="divide-y divide-[#ebe9e3]">
              <div className="px-5 py-3.5 flex items-start justify-between gap-4"><dt className="text-xs text-slate-500">CPF/CNPJ</dt><dd className="text-xs font-semibold text-slate-800 text-right">{aluno?.cpf || '—'}</dd></div>
              <div className="px-5 py-3.5 flex items-start justify-between gap-4"><dt className="text-xs text-slate-500">Nascimento</dt><dd className="text-xs font-semibold text-slate-800 text-right">{aluno?.data_nascimento ? new Date(aluno.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</dd></div>
              <div className="px-5 py-3.5 flex items-start justify-between gap-4"><dt className="text-xs text-slate-500">Endereço</dt><dd className="text-xs font-semibold text-slate-800 text-right max-w-[220px]">{aluno?.endereco ? `${aluno.endereco}, ${aluno.numero}${aluno.complemento ? ` · ${aluno.complemento}` : ''}, ${aluno.bairro} · ${aluno.cidade}/${aluno.estado}` : '—'}</dd></div>
              <div className="px-5 py-3.5 flex items-start justify-between gap-4"><dt className="text-xs text-slate-500">CEP</dt><dd className="text-xs font-semibold text-slate-800 text-right">{aluno?.cep || '—'}</dd></div>
              <div className="px-5 py-3.5 flex items-start justify-between gap-4"><dt className="text-xs text-slate-500">Origem</dt><dd className="text-xs font-semibold text-slate-800 text-right">{infoMatricula?.como_conheceu || 'Não informado'}{infoMatricula?.indicacao_nome ? ` · ${infoMatricula.indicacao_nome}` : ''}</dd></div>
            </dl>
            <div className="p-4 bg-[#faf9f6] border-t border-[#dfded7]">
              <button onClick={abrirModalEdicao} className="w-full py-2.5 rounded-lg border border-[#dfded7] bg-white text-xs font-semibold text-slate-600 hover:text-[#1f4a3a] hover:border-[#aebfb4] transition-colors">Atualizar cadastro</button>
            </div>
          </aside>
        </motion.div>
      )}

      {activeTab === 'aulas' && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
          <aside className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7]">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><CalendarClock size={19} className="text-[#1f4a3a]" /> Horários fixos</h2>
              <p className="text-xs text-slate-500 mt-1">{aulasFixas.length} horário(s) recorrente(s).</p>
            </div>
            <div className="divide-y divide-[#ebe9e3]">
              {aulasFixas.map(aula => {
                const nomeProf = Array.isArray(aula.professor) ? aula.professor[0]?.nome_completo : aula.professor?.nome_completo
                const nomeSala = Array.isArray(aula.sala) ? aula.sala[0]?.nome : aula.sala?.nome
                return (
                  <div key={aula.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-sm text-slate-900">{aula.dia}</p>
                      <span className="text-[9px] font-semibold text-[#1f4a3a] bg-[#e7efe9] px-2 py-1 rounded-full">{aula.instrumento_aula}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 mt-2">{aula.horario_inicio.slice(0, 5)} — {aula.horario_fim.slice(0, 5)}</p>
                    <p className="text-[11px] text-slate-500 mt-1.5">Prof. {nomeProf || 'Não definido'} · {nomeSala || 'Sem sala'}</p>
                  </div>
                )
              })}
              {aulasFixas.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum horário fixo.</p>}
            </div>
          </aside>

          <section className="premium-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dfded7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><BookOpenCheck size={19} className="text-[#1f4a3a]" /> Gestão de aulas</h2>
                <p className="text-xs text-slate-500 mt-1">Lance, corrija ou exclua registros com recálculo automático.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={gerarPdfAulas} className="px-3 py-2 rounded-lg border border-[#dfded7] bg-white text-[10px] font-semibold text-slate-600 flex items-center gap-1.5"><Download size={13} /> PDF</button>
                <button onClick={() => abrirNovoMovimento()} disabled={isAlunoInativo} className="px-3.5 py-2 rounded-lg bg-[#1f4a3a] text-white text-[10px] font-semibold flex items-center gap-1.5 disabled:opacity-50"><Plus size={13} /> Novo lançamento</button>
              </div>
            </div>
            <div className="grid grid-cols-1 border-b border-[#dfded7] bg-[#faf9f6] sm:grid-cols-3">
              <div className="px-5 py-3.5 sm:border-r sm:border-[#e5e3dd]">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {modeloFaturamento === 'MENSAL_FECHADO'
                    ? 'Aulas a faturar'
                    : modeloFaturamento === 'CREDITOS'
                      ? 'Créditos disponíveis'
                      : 'Mensalidade fixa'}
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900">
                    {modeloFaturamento === 'MENSAL_FECHADO'
                      ? aulasPendentesFaturamento.length
                      : modeloFaturamento === 'CREDITOS'
                        ? Number(infoMatricula?.saldo_creditos_faturamento || 0)
                        : formatCurrencyBR(infoMatricula?.valor_mensalidade)}
                  </p>
                  {modeloFaturamento === 'MENSAL_FECHADO' && <p className="text-xs font-semibold text-[#1f4a3a]">{formatCurrencyBR(valorPendenteAulas)}</p>}
                </div>
              </div>
              <div className="px-5 py-3.5 sm:border-r sm:border-[#e5e3dd]">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {modeloFaturamento === 'MENSAL_FECHADO'
                    ? 'Valor em apuração'
                    : modeloFaturamento === 'CREDITOS'
                      ? 'Aulas realizadas'
                      : 'Reposições disponíveis'}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900">
                    {modeloFaturamento === 'MENSAL_FECHADO'
                      ? formatCurrencyBR(valorPendenteAulas)
                      : modeloFaturamento === 'CREDITOS'
                        ? aulasRealizadasTotal
                        : saldoCreditos}
                  </p>
                  {modeloFaturamento === 'VENCIMENTO_FIXO' && (
                    <button onClick={handleConcederCredito} className="text-[10px] font-semibold text-[#1f4a3a] hover:underline">Conceder crédito</button>
                  )}
                </div>
              </div>
              <div className="px-5 py-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {modeloFaturamento === 'MENSAL_FECHADO'
                    ? 'Protegidas por fatura'
                    : modeloFaturamento === 'CREDITOS'
                      ? 'Renovação'
                      : 'Vencimento mensal'}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900">
                    {modeloFaturamento === 'MENSAL_FECHADO'
                      ? historicoAulas.filter(aula => aula.fatura_id).length
                      : modeloFaturamento === 'CREDITOS'
                        ? 'Ao zerar'
                        : `Dia ${infoMatricula?.data_vencimento || '—'}`}
                  </p>
                  {modeloFaturamento === 'MENSAL_FECHADO'
                    ? <ShieldCheck size={15} className="text-[#1f4a3a]" />
                    : <CalendarClock size={15} className="text-[#1f4a3a]" />}
                </div>
              </div>
            </div>
            <div className="max-h-[620px] overflow-y-auto custom-scrollbar">
              {historicoAulas.map((hist, index) => {
                const isAjuste = hist.status === 'Ajuste de Saldo'
                const tone = hist.status === 'Realizada' || hist.status === 'Reposição'
                  ? 'bg-emerald-500'
                  : (hist.status === 'Falta' || hist.status === 'Falta Injustificada')
                    ? 'bg-rose-500'
                    : (hist.status === 'Crédito' || hist.status === 'Falta Justificada')
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                return (
                  <button key={hist.id} onClick={() => abrirDetalhesAula(hist)} className="w-full grid grid-cols-[92px_20px_minmax(0,1fr)] sm:grid-cols-[110px_24px_minmax(0,1fr)_auto] gap-3 px-5 py-4 text-left border-b border-[#ebe9e3] last:border-0 hover:bg-[#faf9f6] transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{new Date(hist.data_aula).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{hist.horario_inicio ? hist.horario_inicio.slice(0, 5) : 'Sem horário'}</p>
                    </div>
                    <div className="relative flex justify-center">
                      {index < historicoAulas.length - 1 && <span className="absolute top-4 bottom-[-32px] w-px bg-[#d9ddd7]" />}
                      <span className={`relative mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${tone}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{hist.modalidade || (isAjuste ? 'Ajuste administrativo' : 'Aula')}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{hist.observacoes || 'Nenhuma anotação registrada.'}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-semibold uppercase tracking-wide">{hist.status}</span>
                      {hist.fatura_id ? <ShieldCheck size={15} className="text-[#1f4a3a]" /> : <ChevronRight size={15} className="text-slate-400" />}
                    </div>
                  </button>
                )
              })}
              {historicoAulas.length === 0 && (
                <div className="py-14 px-6 text-center">
                  <BookOpenCheck size={28} strokeWidth={1.5} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Diário ainda vazio</p>
                  <p className="text-xs text-slate-500 mt-1">As aulas registradas aparecerão aqui.</p>
                </div>
              )}
            </div>
          </section>
        </motion.div>
      )}

      {activeTab === 'financeiro' && (
        <motion.div variants={itemVariants} className="space-y-5">
          <section className="premium-panel overflow-hidden">
            <div className="p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 lg:items-center">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Em aberto</p><p className="text-xl font-semibold text-[#a56a32] mt-1">{formatCurrencyBR(valorEmAberto)}</p><p className="text-[10px] text-slate-500 mt-1">{resumoFinanceiroAluno.open.length} cobrança(s)</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Total recebido</p><p className="text-xl font-semibold text-slate-900 mt-1">{formatCurrencyBR(totalRecebido)}</p><p className="text-[10px] text-slate-500 mt-1">{pagamentosConfirmados.length} pagamento(s) confirmado(s)</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Modelo</p><p className="text-sm font-semibold text-slate-900 mt-1">{getBillingModelLabel(modeloFaturamento)}</p><p className="text-[10px] text-slate-500 mt-1">{modeloFaturamento === 'MENSAL_FECHADO' ? `${formatCurrencyBR(infoMatricula?.valor_por_aula)}/aula` : formatCurrencyBR(infoMatricula?.valor_mensalidade)}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Vencimento</p><p className="text-xl font-semibold text-slate-900 mt-1">{modeloFaturamento === 'VENCIMENTO_FIXO' ? `Dia ${infoMatricula?.data_vencimento || '—'}` : 'Variável'}</p><p className="text-[10px] text-slate-500 mt-1">{modeloFaturamento === 'CREDITOS' ? 'ao zerar créditos' : modeloFaturamento === 'MENSAL_FECHADO' ? '7 dias após fechar' : 'mensal'}</p></div>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-52">
                {modeloFaturamento === 'MENSAL_FECHADO' && (
                  <CreateInvoiceModal
                    alunoId={String(id)}
                    alunoNome={aluno?.nome_completo || 'Aluno'}
                    infoFaturamento={infoMatricula}
                    aulas={historicoAulas}
                    agendas={aulasFixas}
                    professores={professoresList}
                    onCreated={carregarDados}
                  />
                )}
                <button onClick={() => abrirModalPagamento()} disabled={isAlunoInativo} className="w-full py-3 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><CircleDollarSign size={15} /> Registrar pagamento</button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <section className="premium-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-[#dfded7] flex items-center justify-between">
                <div><h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><ReceiptText size={19} className="text-[#1f4a3a]" /> Cobranças</h2><p className="text-xs text-slate-500 mt-1">Todas as competências, emitidas ou previstas.</p></div>
                <span className="text-xs font-semibold text-slate-500">{resumoFinanceiroAluno.considered.length}</span>
              </div>
              <div className="max-h-[470px] overflow-y-auto custom-scrollbar divide-y divide-[#ebe9e3]">
                {resumoFinanceiroAluno.considered.map(cobranca => (
                  <button key={cobranca.id} onClick={() => cobranca.invoiceId ? router.push(`/faturas/${cobranca.invoiceId}`) : cobranca.status !== 'Pago' ? abrirModalPagamento(cobranca) : undefined} className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#faf9f6] transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{cobranca.competenciaLabel}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{cobranca.invoiceId ? 'Fatura emitida' : 'Mensalidade prevista'} · {cobranca.vencimento}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrencyBR(cobranca.valor)}</p>
                      <p className={`text-[9px] font-semibold uppercase mt-1 ${cobranca.status === 'Pago' ? 'text-emerald-600' : cobranca.status === 'Atrasado' ? 'text-rose-600' : 'text-[#a56a32]'}`}>{cobranca.status}</p>
                    </div>
                  </button>
                ))}
                {resumoFinanceiroAluno.considered.length === 0 && <div className="py-12 px-6 text-center text-sm text-slate-500">Nenhuma cobrança encontrada.</div>}
              </div>
            </section>

            <section className="premium-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-[#dfded7] flex items-center justify-between">
                <div><h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><WalletCards size={19} className="text-[#1f4a3a]" /> Pagamentos</h2><p className="text-xs text-slate-500 mt-1">Valores recebidos e forma de pagamento.</p></div>
                <button onClick={gerarPdfPagamentos} className="px-3 py-2 rounded-lg border border-[#dfded7] text-[10px] font-semibold text-slate-600 flex items-center gap-1.5"><Download size={13} /> PDF</button>
              </div>
              <div className="max-h-[470px] overflow-y-auto custom-scrollbar divide-y divide-[#ebe9e3]">
                {pagamentos.map(pg => (
                  <button key={pg.id} onClick={() => abrirModalEdicaoPagamento(pg)} className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#faf9f6] transition-colors">
                    <div><p className="text-sm font-semibold text-slate-900">{new Date(pg.data_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p><p className="text-[11px] text-slate-500 mt-1">{pg.metodo_pagamento || 'Forma não informada'} · Competência {new Date(`${String(pg.competencia || pg.data_pagamento).slice(0, 7)}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}</p></div>
                    <div className="text-right"><p className={`text-sm font-semibold ${isConfirmedPayment(pg) ? 'text-emerald-700' : 'text-[#a56a32]'}`}>{formatCurrencyBR(pg.valor)}</p><p className={`text-[9px] font-semibold uppercase mt-1 ${isConfirmedPayment(pg) ? 'text-emerald-600' : 'text-[#a56a32]'}`}>{isConfirmedPayment(pg) ? 'Confirmado' : 'Pendente'}</p></div>
                  </button>
                ))}
                {pagamentos.length === 0 && <div className="py-12 px-6 text-center text-sm text-slate-500">Nenhum pagamento registrado.</div>}
              </div>
            </section>
          </div>
        </motion.div>
      )}

      {activeTab === 'arquivos' && (
        <motion.section variants={itemVariants} className="premium-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-[#dfded7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><FolderOpen size={19} className="text-[#1f4a3a]" /> Arquivos do aluno</h2>
              <p className="text-xs text-slate-500 mt-1">Partituras, áudios, documentos e materiais compartilhados.</p>
            </div>
            <label className={`px-3.5 py-2.5 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload size={14} /> {isSubmitting ? 'Enviando...' : 'Enviar arquivo'}
              <input type="file" className="hidden" onChange={handleUploadMaterial} disabled={isSubmitting} />
            </label>
          </div>
          <div className="divide-y divide-[#ebe9e3]">
            {materiais.map(mat => (
              <div key={mat.id} className="px-5 py-4 grid grid-cols-[38px_minmax(0,1fr)_auto] gap-3 items-center hover:bg-[#faf9f6] transition-colors group">
                <div className="h-9 w-9 rounded-lg bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center"><FileText size={16} /></div>
                <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{mat.nome_arquivo}</p><p className="text-[11px] text-slate-500 mt-1">{new Date(mat.data_envio).toLocaleDateString('pt-BR')} · {mat.tipo_arquivo || 'Arquivo'}</p></div>
                <div className="flex items-center gap-2">
                  <a href={mat.url_arquivo} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg border border-[#dfded7] flex items-center justify-center text-slate-500 hover:text-[#1f4a3a]" title="Abrir arquivo"><Download size={14} /></a>
                  <button onClick={() => excluirMaterial(mat.id)} className="h-8 w-8 rounded-lg border border-transparent flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all" title="Excluir arquivo"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {materiais.length === 0 && (
              <div className="py-16 px-6 text-center">
                <FolderOpen size={30} strokeWidth={1.5} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">Nenhum arquivo compartilhado</p>
                <p className="text-xs text-slate-500 mt-1">Envie materiais para centralizar o acompanhamento.</p>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {false && (
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

            <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-inner mb-4 text-left">
              <p className="text-slate-500 text-[10px] font-semibold uppercase mb-1">Modelo de faturamento</p>
              <p className="text-lg font-bold text-emerald-700">{getBillingModelLabel(modeloFaturamento)}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                {BILLING_MODELS.find(model => model.value === modeloFaturamento)?.description}
              </p>
            </div>

            {modeloFaturamento === 'VENCIMENTO_FIXO' && (
              <div className={`p-5 rounded-2xl bg-white/40 border border-white/80 shadow-inner mb-4 flex justify-between items-center`}>
                <div className="text-left">
                  <p className={`text-slate-500 text-[10px] font-semibold uppercase mb-1 flex items-center gap-1`}><span className="text-lg">🌟</span> Créditos de Reposição</p>
                  <p className="text-2xl font-bold tracking-tight text-indigo-600">{saldoCreditos} Saldo</p>
                  <p className="text-[9px] text-slate-400 font-semibold mt-1">Expiram 30 dias após a aula desmarcada.</p>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleRemoverCredito} disabled={isSubmitting || saldoCreditos <= 0} className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center font-bold text-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm disabled:opacity-50" title="Abater Crédito Manualmente">-</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleConcederCredito} disabled={isSubmitting} className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm disabled:opacity-50" title="Conceder Crédito Manual">+</motion.button>
                </div>
              </div>
            )}

            <div className={`p-5 rounded-2xl bg-white/40 border border-white/80 shadow-inner mb-4 flex justify-between items-center`}>
              <div className="text-left">
                <p className={`text-slate-500 text-[10px] font-semibold uppercase mb-1 flex items-center gap-1`}>
                  <span className="text-lg">{modeloFaturamento === 'CREDITOS' ? '🎟️' : '🎼'}</span>
                  {modeloFaturamento === 'CREDITOS' ? 'Créditos de faturamento' : modeloFaturamento === 'MENSAL_FECHADO' ? 'Apuração do mês' : 'Ciclo de aulas'}
                </p>
                {modeloFaturamento === 'CREDITOS' ? (
                  <p className={`text-2xl font-bold tracking-tight ${Number(infoMatricula?.saldo_creditos_faturamento || 0) <= 0 ? 'text-rose-600' : 'text-violet-600'}`}>
                    {Number(infoMatricula?.saldo_creditos_faturamento || 0)} <span className="text-sm font-medium text-slate-500">disponíveis</span>
                  </p>
                ) : modeloFaturamento === 'MENSAL_FECHADO' ? (
                  <>
                    <p className="text-2xl font-bold tracking-tight text-cyan-600">{aulasRealizadasNoMes} <span className="text-sm font-medium text-slate-500">aulas</span></p>
                    <p className="text-[10px] font-semibold text-slate-500 mt-1">Parcial: {formatCurrencyBR(valorApuradoNoMes)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold tracking-tight text-indigo-600">{aulasDesdeUltimoPagamento} <span className="text-sm font-medium text-slate-500">feitas</span></p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {modeloFaturamento === 'CREDITOS' ? '4 por pagamento' : modeloFaturamento === 'MENSAL_FECHADO' ? `${formatCurrencyBR(infoMatricula?.valor_por_aula)}/aula` : 'Desde o último pagto'}
                </p>
              </div>
            </div>

            <div className={`p-5 rounded-2xl bg-white/40 border border-white/80 shadow-inner mb-6`}>
              <div className="flex justify-between items-center mb-1">
                <p className={`text-slate-500 text-[10px] font-semibold uppercase`}>{modeloFaturamento === 'MENSAL_FECHADO' ? 'Valor por aula' : modeloFaturamento === 'CREDITOS' ? 'Pacote com 4 créditos' : 'Mensalidade'}</p>
                <p className={`text-slate-500 text-[10px] font-semibold uppercase`}>{modeloFaturamento === 'MENSAL_FECHADO' ? 'Vence 7 dias após o fechamento' : modeloFaturamento === 'VENCIMENTO_FIXO' ? `Venc. dia ${infoMatricula?.data_vencimento || '--'}` : 'Renova ao zerar'}</p>
              </div>
              <p className="text-3xl font-bold tracking-tight text-emerald-600 text-left">{formatCurrencyBR(modeloFaturamento === 'MENSAL_FECHADO' ? infoMatricula?.valor_por_aula : infoMatricula?.valor_mensalidade)}</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <CreateInvoiceModal
                alunoId={String(id)}
                alunoNome={aluno?.nome_completo || 'Aluno'}
                infoFaturamento={infoMatricula}
                aulas={historicoAulas}
                agendas={aulasFixas}
                professores={professoresList}
                onCreated={carregarDados}
              />
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => abrirModalPagamento()} disabled={isAlunoInativo} className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-500 transition-all disabled:opacity-50"> {isAlunoInativo ? 'Aluno Inativo' : 'Registrar Pagamento'} </motion.button>
            </div>
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
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-800"><span className="text-cyan-500 drop-shadow-sm">🧾</span> Faturas</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Aulas faturadas e cobranças emitidas.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 text-xs font-bold">{faturas.length}</span>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {faturas.map(fatura => (
                <button
                  type="button"
                  key={fatura.id}
                  onClick={() => router.push(`/faturas/${fatura.id}`)}
                  className="w-full bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-sm flex justify-between items-center hover:bg-white/80 hover:shadow-md transition-all text-left"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-800">{formatInvoiceNumber(fatura.numero, fatura.id)}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      Emitida em {new Date(`${String(fatura.data_emissao).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')} • {fatura.quantidade_aulas} aula(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-cyan-700">{formatCurrencyBR(fatura.valor_total)}</p>
                    <p className={`text-[10px] font-bold mt-1 ${fatura.status === 'PAGO' ? 'text-emerald-600' : fatura.status === 'VENCIDO' ? 'text-rose-600' : 'text-amber-600'}`}>{fatura.status}</p>
                  </div>
                </button>
              ))}
              {faturas.length === 0 && (
                <p className="text-slate-500 text-center py-8 italic text-sm border border-dashed border-slate-300 rounded-2xl bg-white/30">Nenhuma fatura emitida.</p>
              )}
            </div>
          </motion.div>
          
          <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-800"><span className="text-amber-500 drop-shadow-sm">📖</span> Diário</h3>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} onClick={gerarPdfAulas} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold shadow-sm transition-all border border-slate-200 hover:bg-slate-200">📄 Exportar PDF</motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => abrirNovoMovimento()} disabled={isAlunoInativo} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-bold shadow-sm transition-all disabled:opacity-50">+ Novo lançamento</motion.button>
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
                      <p className={`font-bold text-xl tracking-tight ${isConfirmedPayment(pg) ? 'text-emerald-600' : 'text-amber-700'}`}>R$ {pg.valor}</p>
                      <p className={`text-[9px] font-bold uppercase inline-block px-2 py-1 rounded mt-1 shadow-sm border ${isConfirmedPayment(pg) ? 'text-emerald-700 bg-emerald-100 border-emerald-200' : 'text-amber-800 bg-amber-100 border-amber-200'}`}>{isConfirmedPayment(pg) ? 'Confirmado' : 'Pendente'}</p>
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
      )}

      {/* Modais */}
      <AnimatePresence>
        {isMsgModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1d17]/55 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.97, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 18 }} className="w-full max-w-lg overflow-hidden rounded-[26px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
              <div className="flex items-start justify-between gap-5 border-b border-[#dfded7] bg-[#fbfaf6] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7efe9] text-[#1f4a3a]">
                    <Bell size={19} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="premium-kicker">Comunicação direta</div>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Enviar aviso</h2>
                    <p className="mt-1 text-sm text-slate-500">Para {aluno?.nome_completo || 'o aluno'}</p>
                  </div>
                </div>
                <button type="button" aria-label="Fechar envio de aviso" onClick={() => setIsMsgModalOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 transition hover:border-[#bfc7c1] hover:text-[#1f4a3a]">
                  <X size={18} />
                </button>
              </div>
              
              <form onSubmit={handleEnviarMensagem}>
                <div className="space-y-5 px-6 py-6">
                  <div className="flex gap-3 rounded-xl border border-[#d7e1da] bg-[#edf4ef] p-4 text-sm leading-5 text-[#315949]">
                    <Bell size={17} className="mt-0.5 shrink-0" />
                    <p>O aviso ficará disponível na Central de avisos do portal e o aluno verá a atualização no sininho.</p>
                  </div>
                <div>
                  <label className={labelClass}>Assunto</label>
                  <input required maxLength={80} value={msgTitulo} onChange={e => setMsgTitulo(e.target.value)} placeholder="Ex.: Alteração no horário da aula" className={inputClass} />
                  <p className="mt-1.5 text-right text-[11px] text-slate-400">{msgTitulo.length}/80</p>
                </div>
                <div>
                  <label className={labelClass}>Mensagem</label>
                  <textarea required maxLength={600} value={msgTexto} onChange={e => setMsgTexto(e.target.value)} placeholder="Escreva uma mensagem clara e objetiva para o aluno..." className={`${inputClass} h-36 resize-none`} />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>O envio é imediato.</span>
                    <span>{msgTexto.length}/600</span>
                  </div>
                </div>
                </div>
                <div className="flex flex-col-reverse gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-6 py-4 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setIsMsgModalOpen(false)} disabled={isSubmitting} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-[#f8f7f3] disabled:opacity-50">Cancelar</button>
                  <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={isSubmitting || !msgTitulo.trim() || !msgTexto.trim()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f4a3a] px-6 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,74,58,0.18)] transition hover:bg-[#173b2e] disabled:cursor-not-allowed disabled:opacity-45">
                    <Send size={16} />
                    {isSubmitting ? 'Enviando...' : 'Enviar aviso'}
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
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Competência quitada</label>
                  <input type="month" required value={payCompetencia} onChange={e => setPayCompetencia(e.target.value)} className={inputClass} />
                  <p className="mt-2 text-[10px] text-slate-500">Escolha o mês ao qual este pagamento pertence. É isso que retira a mensalidade do dossiê em aberto.</p>
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
                {faturasDisponiveisPagamento.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 ml-1">Fatura relacionada</label>
                    <select value={payFaturaId} onChange={e => {
                      setPayFaturaId(e.target.value)
                      const fatura = faturasDisponiveisPagamento.find(item => item.id === e.target.value)
                      if (fatura) {
                        setPayValor(Number(fatura.valor_total || 0).toFixed(2))
                        setPayCompetencia(String(fatura.competencia).slice(0, 7))
                      }
                    }} className={inputClass}>
                      <option value="">Pagamento avulso</option>
                      {faturasDisponiveisPagamento.map(fatura => (
                        <option key={fatura.id} value={fatura.id}>{formatInvoiceNumber(fatura.numero, fatura.id)} - {formatCurrencyBR(fatura.valor_total)}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-[10px] text-slate-500">Ao confirmar, a fatura escolhida também será marcada como paga.</p>
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsPayModalOpen(false)} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSubmitting} className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-500 transition-all disabled:opacity-50">{isSubmitting ? 'Confirmando...' : 'Confirmar Pagamento'}</motion.button>
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
                <h2 className={`text-2xl font-bold tracking-tight text-slate-800 drop-shadow-sm`}>Revisar pagamento</h2>
                <button type="button" onClick={() => handleExcluirPagamento(editPayId)} className="h-10 w-10 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Apagar Registro Definitivamente">🗑️</button>
              </div>
              <form onSubmit={handleSalvarEdicaoPagamento} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Valor Pago</label>
                  <input type="number" step="0.01" required value={editPayValor} onChange={e => setEditPayValor(e.target.value)} className={`w-full p-3.5 rounded-xl bg-white/50 border border-white/60 font-bold text-xl text-emerald-600 focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner mt-1`} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Competência quitada</label>
                  <input type="month" required value={editPayCompetencia} onChange={e => setEditPayCompetencia(e.target.value)} className={inputClass} />
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
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Situação</label>
                  <select required value={editPayStatus} onChange={e => setEditPayStatus(e.target.value)} className={inputClass}>
                    <option value="Pago">Confirmado - gera recibo e entra no caixa</option>
                    <option value="Pendente">Pendente - não gera recibo nem entra no caixa</option>
                  </select>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1d17]/55 p-3 backdrop-blur-sm md:p-4">
            <motion.div initial={{ scale: 0.97, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 18 }} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[#dfded7] bg-[#fbfaf6] px-5 py-5 md:px-7">
                <div>
                  <div className="premium-kicker">{editingClassId ? 'Corrigir histórico' : 'Novo movimento'}</div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{editingClassId ? 'Editar lançamento' : 'Registrar aula ou ajuste'}</h2>
                  <p className="mt-1 text-sm text-slate-500">O sistema recalcula automaticamente faturamento, créditos e reposições.</p>
                </div>
                <button type="button" aria-label="Fechar lançamento" onClick={() => setIsClassModalOpen(false)} disabled={isSubmitting} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 transition hover:border-[#bfc7c1] hover:text-[#1f4a3a] disabled:opacity-50"><X size={18} /></button>
              </div>

              <form onSubmit={handleRegistrarAula} className="flex min-h-0 flex-1 flex-col">
                <div className="premium-scrollarea min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 md:px-7">
                  <section className={formSectionClass}>
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7efe9] text-[#1f4a3a]"><BookOpenCheck size={17} /></span>
                      <div><h3 className="text-base font-semibold text-slate-900">Tipo do movimento</h3><p className="mt-0.5 text-xs text-slate-500">Escolha o que aconteceu com esta aula.</p></div>
                    </div>
                    <label className={labelClass}>Situação</label>
                    <select
                      required
                      value={statusAula}
                      onChange={e => {
                        const nextStatus = e.target.value
                        setStatusAula(nextStatus)
                        setConsumirCreditoReposicao(['Reposição', 'Ajuste de Saldo'].includes(nextStatus))
                      }}
                      className={inputClass}
                    >
                      {CLASS_STATUS_OPTIONS
                        .filter(option => !option.fixedOnly || modeloFaturamento === 'VENCIMENTO_FIXO' || option.value === statusAula)
                        .map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <div className="mt-3 flex gap-3 rounded-xl border border-[#d7e1da] bg-[#edf4ef] px-4 py-3">
                      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#1f4a3a]" />
                      <div><p className="text-xs font-semibold text-[#244c3d]">Impacto deste lançamento</p><p className="mt-1 text-xs leading-5 text-[#607269]">{getClassImpact(statusAula, modeloFaturamento)}</p></div>
                    </div>
                  </section>

                  <section className={formSectionClass}>
                    <div className="mb-5"><h3 className="text-base font-semibold text-slate-900">Data e responsável</h3><p className="mt-0.5 text-xs text-slate-500">Informações exibidas no diário do aluno.</p></div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className={['Crédito', 'Ajuste de Saldo'].includes(statusAula) ? 'md:col-span-3' : ''}><label className={labelClass}>Data</label><input type="date" required value={dataAula} onChange={e => setDataAula(e.target.value)} className={inputClass} /></div>
                      {!['Crédito', 'Ajuste de Saldo'].includes(statusAula) && (
                        <>
                          <div><label className={labelClass}>Início</label><input type="time" required value={horaInicioAula} onChange={e => setHoraInicioAula(e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Fim</label><input type="time" required value={horaFimAula} onChange={e => setHoraFimAula(e.target.value)} className={inputClass} /></div>
                        </>
                      )}
                      <div className="md:col-span-2">
                        <label className={labelClass}>Professor</label>
                        <select value={professorAula} onChange={e => setProfessorAula(e.target.value)} className={inputClass}>
                          <option value="">Não informado</option>
                          {professoresList.map(professor => <option key={professor.id} value={professor.id}>{professor.nome_completo}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Modalidade</label>
                        <select value={modalidadeAula} onChange={e => setModalidadeAula(e.target.value)} className={inputClass}>
                          <option value="">Não informada</option>
                          {modalidadesLista.map(modalidade => <option key={modalidade.nome} value={modalidade.nome}>{modalidade.nome}</option>)}
                        </select>
                      </div>
                    </div>
                  </section>

                  {isBillableClass(statusAula) && (modeloFaturamento === 'MENSAL_FECHADO' || Boolean(selectedClassDetails?.turma_id)) && (
                    <section className={formSectionClass}>
                      <div className="grid gap-4 md:grid-cols-[1fr_240px] md:items-end">
                        <div><h3 className="text-base font-semibold text-slate-900">Valor desta aula</h3><p className="mt-1 text-xs leading-5 text-slate-500">O valor fica congelado neste registro e compõe o saldo pendente até a emissão da fatura.</p></div>
                        <div><label className={labelClass}>Valor faturável (R$)</label><input type="number" inputMode="decimal" min="0" step="0.01" required value={valorAula} onChange={e => setValorAula(e.target.value)} className={`${inputClass} text-base font-semibold text-[#1f4a3a]`} /></div>
                      </div>
                    </section>
                  )}

                  {['Reposição', 'Ajuste de Saldo'].includes(statusAula) && (
                    <section className={formSectionClass}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={statusAula === 'Ajuste de Saldo' || consumirCreditoReposicao} disabled={statusAula === 'Ajuste de Saldo'} onChange={e => setConsumirCreditoReposicao(e.target.checked)} className="mt-1 h-4 w-4 accent-[#1f4a3a] disabled:opacity-60" />
                        <span><span className="block text-sm font-semibold text-slate-800">Consumir um crédito de reposição</span><span className="mt-1 block text-xs leading-5 text-slate-500">{statusAula === 'Ajuste de Saldo' ? 'A baixa manual sempre consome o crédito válido que vencerá primeiro.' : 'O sistema utiliza primeiro o crédito que vencerá antes. Desmarque apenas para lançar uma cortesia administrativa.'}</span></span>
                      </label>
                    </section>
                  )}

                  <section className={formSectionClass}>
                    <label className={labelClass}>Observações para o diário</label>
                    <textarea value={obsAula} onChange={e => setObsAula(e.target.value)} placeholder="Conteúdo trabalhado, ocorrência ou explicação do ajuste." className={`${inputClass} min-h-28 resize-y`} />
                    {editingClassId && (
                      <div className="mt-4">
                        <label className={labelClass}>Motivo da correção</label>
                        <input required minLength={3} value={motivoAjusteAula} onChange={e => setMotivoAjusteAula(e.target.value)} placeholder="Ex.: data lançada incorretamente" className={inputClass} />
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck size={12} /> Esta justificativa ficará registrada na auditoria.</p>
                      </div>
                    )}
                  </section>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
                  <p className="hidden text-xs text-slate-500 sm:block">{getBillingModelLabel(modeloFaturamento)} · controle administrativo</p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button type="button" onClick={() => setIsClassModalOpen(false)} disabled={isSubmitting} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-[#1f4a3a] px-6 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,74,58,0.18)] disabled:opacity-50">{isSubmitting ? 'Salvando...' : editingClassId ? 'Salvar correção' : 'Registrar movimento'}</button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1d17]/55 p-3 backdrop-blur-sm md:p-4">
            <motion.div initial={{ scale: 0.97, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 18 }} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[#dfded7] bg-[#fbfaf6] px-5 py-5 md:px-7">
                <div>
                  <div className="premium-kicker">Editar aluno</div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{editNome || aluno?.nome_completo}</h2>
                  <p className="mt-1 text-sm text-slate-500">Cadastro, agenda e faturamento em um único fluxo.</p>
                </div>
                <button type="button" aria-label="Fechar edição do aluno" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 transition hover:border-[#bfc7c1] hover:text-[#1f4a3a] disabled:opacity-50">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSalvarEdicao} className="flex min-h-0 flex-1 flex-col">
                <div className="premium-scrollarea min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 md:px-7">
                
                <section className={formSectionClass}>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">1</span>
                      <div><h3 className="text-base font-semibold text-slate-900">Situação e identidade</h3><p className="mt-0.5 text-xs text-slate-500">Dados principais e acesso do aluno.</p></div>
                    </div>
                  <label htmlFor="edit-foto-upload" className={`group flex items-center gap-3 rounded-xl border border-[#dfded7] bg-[#faf9f6] p-2 pr-4 transition hover:border-[#b9c8bf] ${isEditingInativo ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#e7efe9] text-[#1f4a3a] shadow-sm">
                      {fotoPreview ? <img src={fotoPreview} alt="Preview" className="h-full w-full object-cover" /> : <Camera size={22} strokeWidth={1.7} />}
                    </div>
                    <span><span className="block text-xs font-semibold text-slate-700">{fotoPreview ? 'Alterar foto' : 'Adicionar foto'}</span><span className="mt-0.5 block text-[11px] text-slate-500">Opcional</span></span>
                    <input id="edit-foto-upload" type="file" accept="image/*" disabled={isEditingInativo} className="hidden" onChange={handleFileChange} />
                  </label>
                  </div>
                
                <div className="mt-6 space-y-3">
                  <label className={labelClass}>Situação da matrícula</label>
                  <select required value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputClass}>
                    <option value="Ativo">Matrícula ativa</option>
                    <option value="Inativo">Matrícula inativa</option>
                  </select>
                  {isEditingInativo && <div className="rounded-xl border border-[#ead3d0] bg-[#fbefed] px-4 py-3 text-xs leading-5 text-[#8c4d45]">O aluno ficará fora da operação diária, mas o histórico acadêmico e financeiro continuará preservado.</div>}
                </div>

                <div className="mt-6 space-y-4">
                  <p className="border-b border-[#ebe9e3] pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4a3a]">Dados pessoais</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="md:col-span-2"><label className={labelClass}>Nome completo</label><input placeholder="Nome completo" required={!isEditingInativo} disabled={isEditingInativo} value={editNome} onChange={e => setEditNome(e.target.value)} onBlur={() => setEditNome(normalizeName(editNome))} autoComplete="name" className={`${inputClass} disabled:opacity-50`} /></div>
                    <div>
                      <label className={labelClass}>Data de nascimento</label>
                      <input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} required={!isEditingInativo} disabled={isEditingInativo} value={editDataNascimento} onChange={e => setEditDataNascimento(formatDateInput(e.target.value))} autoComplete="bday" className={`${inputClass} disabled:opacity-50`} />
                    </div>
                    <div><label className={labelClass}>CPF ou CNPJ</label><input placeholder="CPF ou CNPJ" inputMode="numeric" required={!isEditingInativo} disabled={isEditingInativo} value={editCpf} onChange={e => setEditCpf(formatCPFOrCNPJ(e.target.value))} maxLength={18} className={`${inputClass} disabled:opacity-50`} /></div>
                    <div><label className={labelClass}>E-mail</label><input placeholder="E-mail" type="email" required={!isEditingInativo} disabled={isEditingInativo} value={editEmail} onChange={e => setEditEmail(e.target.value)} onBlur={() => setEditEmail(normalizeEmail(editEmail))} autoComplete="email" className={`${inputClass} disabled:opacity-50`} /></div>
                    <div><label className={labelClass}>WhatsApp</label><input placeholder="WhatsApp" inputMode="tel" required={!isEditingInativo} disabled={isEditingInativo} value={editTel} onChange={e => setEditTel(formatBrazilianPhone(e.target.value))} onBlur={() => setEditTel(ensureBrazilianNinthDigit(editTel))} maxLength={15} autoComplete="tel" className={`${inputClass} disabled:opacity-50`} /></div>
                  </div>
                </div>
                </section>

                <section className={formSectionClass}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">2</span>
                    <div><h3 className="text-base font-semibold text-slate-900">Endereço</h3><p className="mt-0.5 text-xs text-slate-500">O CEP completa automaticamente os dados disponíveis.</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="col-span-2 md:col-span-1"><label className={labelClass}>CEP</label><input placeholder="CEP" inputMode="numeric" required={!isEditingInativo} disabled={isEditingInativo} value={editCep} onChange={handleEditCepChange} maxLength={9} autoComplete="postal-code" className={`${inputClass} disabled:opacity-50`} /></div>
                    <div className="col-span-2 md:col-span-2"><label className={labelClass}>Endereço / Rua</label><input placeholder="Endereço / Rua" required={!isEditingInativo} disabled={isEditingInativo} value={editEndereco} onChange={e => setEditEndereco(e.target.value)} autoComplete="address-line1" className={`${inputClass} disabled:opacity-50`} /></div>
                    <div className="col-span-2 md:col-span-1"><label className={labelClass}>Número</label><input id="edit-input-numero" placeholder="Número" required={!isEditingInativo} disabled={isEditingInativo} value={editNumero} onChange={e => setEditNumero(e.target.value.toUpperCase())} className={`${inputClass} disabled:opacity-50`} /></div>
                    <div className="col-span-2 md:col-span-1"><label className={labelClass}>Complemento</label><input placeholder="Complemento" disabled={isEditingInativo} value={editComplemento} onChange={e => setEditComplemento(e.target.value)} className={`${inputClass} disabled:opacity-50`} /></div>
                    <div className="col-span-2 md:col-span-1"><label className={labelClass}>Bairro</label><input placeholder="Bairro" required={!isEditingInativo} disabled={isEditingInativo} value={editBairro} onChange={e => setEditBairro(e.target.value)} className={`${inputClass} disabled:opacity-50`} /></div>
                    <div className="col-span-2 md:col-span-1"><label className={labelClass}>Cidade</label><input placeholder="Cidade" required={!isEditingInativo} disabled={isEditingInativo} value={editCidade} onChange={e => setEditCidade(e.target.value)} className={`${inputClass} disabled:opacity-50`} /></div>
                    <div className="col-span-2 md:col-span-1"><label className={labelClass}>UF</label><input placeholder="UF" required={!isEditingInativo} disabled={isEditingInativo} value={editEstado} onChange={e => setEditEstado(e.target.value.replace(/[^a-z]/gi, '').toUpperCase())} maxLength={2} className={`uppercase ${inputClass} disabled:opacity-50`} /></div>
                  </div>
                </section>

                <section className={formSectionClass}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">3</span>
                      <div><h3 className="text-base font-semibold text-slate-900">Agenda individual</h3><p className="mt-0.5 text-xs text-slate-500">Mantenha um horário fixo ou deixe o aluno disponível para uma turma.</p></div>
                    </div>
                    {editAgendamentoCadastro === 'AGORA' && <button type="button" onClick={addEditAgenda} disabled={isEditingInativo} className="h-9 rounded-lg border border-[#cbdad0] bg-[#edf4ef] px-3 text-xs font-semibold text-[#1f4a3a] transition hover:bg-[#e2ede6] disabled:opacity-50">+ Adicionar horário</button>}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button type="button" disabled={isEditingInativo} onClick={() => setEditAgendamentoCadastro('AGORA')} className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${editAgendamentoCadastro === 'AGORA' ? 'border-[#8eaa9b] bg-[#edf4ef] ring-2 ring-[#1f4a3a]/10' : 'border-[#dfded7] bg-white hover:border-[#bfc9c2]'}`}>
                      <span className="block text-sm font-semibold text-slate-800">Manter horário individual</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">O aluno possui uma ou mais aulas fixas próprias.</span>
                    </button>
                    <button type="button" disabled={isEditingInativo} onClick={() => setEditAgendamentoCadastro('DEPOIS')} className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${editAgendamentoCadastro === 'DEPOIS' ? 'border-[#8eaa9b] bg-[#edf4ef] ring-2 ring-[#1f4a3a]/10' : 'border-[#dfded7] bg-white hover:border-[#bfc9c2]'}`}>
                      <span className="block text-sm font-semibold text-slate-800">Sem horário individual</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">Permite incluir o aluno em uma turma ou definir a agenda depois.</span>
                    </button>
                  </div>

                  {editAgendamentoCadastro === 'AGORA' ? editAgendas.map((ag, index) => (
                    <div key={ag.id} className="relative mt-4 rounded-2xl border border-[#d7e1da] bg-[#f4f7f4] p-5">
                      {editAgendas.length > 1 && !isEditingInativo && (
                        <button type="button" aria-label="Remover horário" onClick={() => removeEditAgenda(index)} className="absolute -right-2 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#ecd0cd] bg-[#fbefed] text-[#a24a4a] shadow-sm transition hover:bg-[#a24a4a] hover:text-white"><X size={14} /></button>
                      )}

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div>
                          <label className={labelClass}>Dia</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.dia} onChange={e => handleEditAgendaChange(index, 'dia', e.target.value)} className={`${inputClass} disabled:opacity-50`}>{dias.map(d => <option key={d} value={d}>{d}</option>)}</select>
                        </div>
                        <div>
                          <label className={labelClass}>Horário</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.horario_inicio} onChange={e => handleEditAgendaChange(index, 'horario_inicio', e.target.value)} className={`${inputClass} disabled:opacity-50`}>
                            {HORARIOS_DISPONIVEIS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Professor</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.professor_id} onChange={e => handleEditAgendaChange(index, 'professor_id', e.target.value)} className={`${inputClass} disabled:opacity-50`}><option value="">Selecione...</option>{professoresList.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}</select>
                        </div>
                        <div>
                          <label className={labelClass}>Sala</label>
                          <select required={!isEditingInativo} disabled={isEditingInativo} value={ag.sala_id} onChange={e => handleEditAgendaChange(index, 'sala_id', e.target.value)} className={`${inputClass} disabled:opacity-50`}><option value="">Selecione...</option>{salasList.map(sl => <option key={sl.id} value={sl.id}>{sl.nome}</option>)}</select>
                        </div>
                      </div>
                      <div className="pt-4">
                        <label className={labelClass}>Modalidade</label>
                        <div className="flex flex-wrap gap-2">
                          {modalidadesLista.map(m => (
                            <motion.button whileTap={{ scale: 0.97 }} key={m.nome} type="button" disabled={isEditingInativo} onClick={() => handleEditAgendaChange(index, 'instrumento_aula', m.nome)} className={`rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 ${ag.instrumento_aula === m.nome ? 'border-[#1f4a3a] bg-[#1f4a3a] text-white' : 'border-[#dfded7] bg-white text-slate-600 hover:border-[#aebdb4]'}`}>
                              {ag.instrumento_aula === m.nome && <span className="mr-2">✓</span>} {m.nome}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#c9d7cf] bg-[#eef5f0] px-5 py-6 text-center">
                      <p className="text-sm font-semibold text-[#1f4a3a]">Aluno sem agenda individual</p>
                      <p className="mt-1 text-xs text-[#607269]">Ao salvar, os horários individuais atuais serão removidos. A participação em turmas não será alterada.</p>
                    </div>
                  )}
                </section>

                <section className={formSectionClass}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">4</span>
                    <div><h3 className="text-base font-semibold text-slate-900">Faturamento e origem</h3><p className="mt-0.5 text-xs text-slate-500">Modelo financeiro e informações comerciais do cadastro.</p></div>
                  </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <p className="border-b border-[#ebe9e3] pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4a3a]">Origem do aluno</p>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className={labelClass}>Como conheceu a escola?</label>
                        <select required={!isEditingInativo} disabled={isEditingInativo} value={editComoConheceu} onChange={e => setEditComoConheceu(e.target.value)} className={`${inputClass} disabled:opacity-50`}><option value="">Selecione...</option><option value="Instagram">Instagram</option><option value="Google">Google</option><option value="Indicação">Indicação</option><option value="Outros">Outros</option></select>
                      </div>
                      <AnimatePresence>
                        {editComoConheceu === 'Indicação' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            <label className={labelClass}>Quem indicou?</label>
                            <input required={!isEditingInativo} disabled={isEditingInativo} value={editIndicacaoNome} onChange={e => setEditIndicacaoNome(e.target.value)} className={`${inputClass} disabled:opacity-50`} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="border-b border-[#ebe9e3] pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4a3a]">Configuração financeira</p>
                    <div className="space-y-3 mt-4">
                      <div>
                        <label className={labelClass}>Início do faturamento</label>
                        <input type="month" required value={editInicioFaturamento} onChange={e => setEditInicioFaturamento(e.target.value)} className={inputClass} />
                        <p className="mt-2 text-xs text-slate-500">O dossiê mensal será calculado a partir desta competência.</p>
                      </div>
                      <div>
                        <label className={labelClass}>Modelo de faturamento</label>
                        <select required={!isEditingInativo} disabled={isEditingInativo} value={editModeloFaturamento} onChange={e => setEditModeloFaturamento(e.target.value as BillingModel)} className={`${inputClass} disabled:opacity-50`}>
                          {BILLING_MODELS.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}
                        </select>
                      </div>
                      {editModeloFaturamento === 'MENSAL_FECHADO' ? (
                        <div>
                          <label className={labelClass}>Valor por aula (R$)</label>
                          <input type="number" inputMode="decimal" min="0.01" step="0.01" required={!isEditingInativo} disabled={isEditingInativo} value={editValorPorAula} onChange={e => setEditValorPorAula(e.target.value)} className={`${inputClass} disabled:opacity-50`} />
                          <p className="mt-2 rounded-lg bg-[#edf4ef] px-3 py-2 text-xs font-medium text-[#315949]">Fecha no último dia do mês e vence em 7 dias.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className={editModeloFaturamento === 'CREDITOS' ? 'col-span-2' : ''}>
                            <label className={labelClass}>{editModeloFaturamento === 'CREDITOS' ? 'Pacote com 4 créditos (R$)' : 'Mensalidade (R$)'}</label>
                            <input type="number" inputMode="decimal" min="0.01" step="0.01" required={!isEditingInativo} disabled={isEditingInativo} value={editValor} onChange={e => setEditValor(e.target.value)} className={`${inputClass} disabled:opacity-50`} />
                          </div>
                          {editModeloFaturamento === 'VENCIMENTO_FIXO' && (
                            <div>
                              <label className={labelClass}>Dia do vencimento</label>
                              <input type="number" inputMode="numeric" min="1" max="31" required={!isEditingInativo} disabled={isEditingInativo} value={editVencimento} onChange={e => setEditVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))} className={`${inputClass} disabled:opacity-50`} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </section>

                </div>
                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
                  <p className="hidden text-xs text-slate-500 sm:block">{getBillingModelLabel(editModeloFaturamento)} · {editStatus === 'Inativo' ? 'matrícula inativa' : editAgendamentoCadastro === 'AGORA' ? `${editAgendas.length} horário${editAgendas.length === 1 ? '' : 's'} fixo${editAgendas.length === 1 ? '' : 's'}` : 'sem horário fixo'}</p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-[#f8f7f3] disabled:opacity-50">Cancelar</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-[#1f4a3a] px-6 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,74,58,0.18)] transition hover:bg-[#173b2e] disabled:opacity-50">{isSubmitting ? 'Salvando...' : 'Salvar alterações'}</motion.button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isClassDetailsModalOpen && selectedClassDetails && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0d1d17]/55 p-3 backdrop-blur-sm md:items-center md:p-4">
            <motion.div initial={{ scale: 0.97, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 18 }} className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[#dfded7] bg-[#fbfaf6] px-5 py-5 md:px-6">
                <div>
                  <div className="premium-kicker">Registro do diário</div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Detalhes do movimento</h2>
                </div>
                <button onClick={() => setIsClassDetailsModalOpen(false)} disabled={isSubmitting} aria-label="Fechar detalhes" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 disabled:opacity-50"><X size={18} /></button>
              </div>

              <div className="premium-scrollarea min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 md:px-6">
                <section className="rounded-2xl bg-[#173f35] p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-2xl font-semibold tracking-tight">{new Date(selectedClassDetails.data_aula).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                      <p className="mt-1 text-sm text-white/65">
                        {selectedClassDetails.horario_inicio ? `${selectedClassDetails.horario_inicio.slice(0, 5)} — ${selectedClassDetails.horario_fim?.slice(0, 5)}` : 'Sem horário informado'}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide">{selectedClassDetails.status}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                    <div><p className="text-[9px] font-semibold uppercase tracking-wider text-white/45">Modalidade</p><p className="mt-1 text-sm font-semibold">{selectedClassDetails.modalidade || 'Não informada'}</p></div>
                    <div><p className="text-[9px] font-semibold uppercase tracking-wider text-white/45">Origem</p><p className="mt-1 text-sm font-semibold">{selectedClassDetails.turma_id ? 'Aula em turma' : 'Agenda individual'}</p></div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#dfded7] bg-white p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Professor</p>
                      <p className="mt-1.5 text-sm font-semibold text-slate-800">{professoresList.find(professor => professor.id === selectedClassDetails.professor_id)?.nome_completo || 'Não informado'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Valor da aula</p>
                      <p className="mt-1.5 text-sm font-semibold text-slate-800">{selectedClassDetails.valor_aula_faturado !== null && selectedClassDetails.valor_aula_faturado !== undefined ? formatCurrencyBR(selectedClassDetails.valor_aula_faturado) : 'Segue o modelo do aluno'}</p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-[#ebe9e3] pt-4">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Observações</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedClassDetails.observacoes || 'Nenhuma anotação registrada.'}</p>
                  </div>
                </section>

                <section className={`flex gap-3 rounded-2xl border px-4 py-4 ${selectedClassDetails.fatura_id ? 'border-[#d7e1da] bg-[#edf4ef]' : 'border-[#e5dfd1] bg-[#fbf7ec]'}`}>
                  {selectedClassDetails.fatura_id ? <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#1f4a3a]" /> : <Undo2 size={18} className="mt-0.5 shrink-0 text-[#916a34]" />}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selectedClassDetails.fatura_id ? 'Registro protegido por fatura' : 'Correção ainda disponível'}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {selectedClassDetails.fatura_id
                        ? 'Cancele a fatura vinculada antes de editar ou excluir esta aula. Isso evita divergência no valor cobrado.'
                        : getClassImpact(selectedClassDetails.status, modeloFaturamento)}
                    </p>
                  </div>
                </section>
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-5 py-4 sm:flex-row sm:justify-between md:px-6">
                {selectedClassDetails.fatura_id ? (
                  <button onClick={() => router.push(`/faturas/${selectedClassDetails.fatura_id}`)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f4a3a] px-5 text-sm font-semibold text-white"><ReceiptText size={16} /> Abrir fatura</button>
                ) : (
                  <button onClick={() => { setDeleteClassReason(''); setIsDeleteClassModalOpen(true) }} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e7c9c5] bg-[#fbefed] px-5 text-sm font-semibold text-[#a24a4a]"><Trash2 size={15} /> Excluir</button>
                )}
                <button onClick={() => abrirEdicaoMovimento(selectedClassDetails)} disabled={Boolean(selectedClassDetails.fatura_id)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cbdad0] bg-white px-5 text-sm font-semibold text-[#1f4a3a] disabled:cursor-not-allowed disabled:opacity-40"><Pencil size={15} /> Editar lançamento</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteClassModalOpen && selectedClassDetails && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d1d17]/65 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }} className="w-full max-w-md rounded-[24px] border border-white/60 bg-[#fbfaf6] p-6 shadow-2xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fbefed] text-[#a24a4a]"><AlertTriangle size={20} /></span>
              <h2 className="mt-4 text-xl font-semibold text-slate-900">Excluir este lançamento?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">A aula sairá do diário e os saldos relacionados serão recalculados. A operação ficará registrada na auditoria.</p>
              <div className="mt-5">
                <label className={labelClass}>Motivo da exclusão</label>
                <textarea autoFocus value={deleteClassReason} onChange={e => setDeleteClassReason(e.target.value)} placeholder="Ex.: lançamento duplicado" className={`${inputClass} min-h-24 resize-none`} />
              </div>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button onClick={() => setIsDeleteClassModalOpen(false)} disabled={isSubmitting} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600 disabled:opacity-50">Voltar</button>
                <button onClick={handleExcluirAulaHistorico} disabled={isSubmitting || deleteClassReason.trim().length < 3} className="h-11 rounded-xl bg-[#a24a4a] px-5 text-sm font-semibold text-white disabled:opacity-40">{isSubmitting ? 'Excluindo...' : 'Excluir definitivamente'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
