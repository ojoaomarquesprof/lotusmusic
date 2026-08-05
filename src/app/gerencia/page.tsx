"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { formatCPFOrCNPJ } from '../../lib/formatters'
import Cropper from 'react-easy-crop'
import { motion, AnimatePresence } from 'framer-motion'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart3,
  BadgeCheck,
  Building2,
  CalendarClock,
  Clock3,
  Download,
  DoorOpen,
  GraduationCap,
  ImageIcon,
  Landmark,
  Mail,
  MapPin,
  Music2,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  UsersRound,
} from 'lucide-react'

// --- FUNÇÕES DE MÁSCARA E CROPPER ---
const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15)
const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14)
const formatCEP = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9)
const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<File | null> => { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return null; canvas.width = 256; canvas.height = 256; ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 256, 256); return new Promise(resolve => canvas.toBlob(blob => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.9)) }

// --- VARIÁVEIS DE ANIMAÇÃO ---
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

export default function Gerencia() {
  const { s } = useStyles()
  const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<'identidade' | 'estrutura' | 'equipe' | 'horarios' | 'relatorios'>('identidade')

  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  // --- ESTADOS: ESCOLA ---
  const [config, setConfig] = useState<any>({ 
    nome_escola: '', chave_pix: '', logo_url: '', cnpj: '', telefone: '', favicon_url: '',
    cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null)

  // --- ESTADOS: ESTRUTURA ---
  const [salas, setSalas] = useState<any[]>([])
  const [modalidades, setModalidades] = useState<any[]>([])
  const [novaSala, setNovaSala] = useState('')
  const [novaModalidade, setNovaModalidade] = useState('')

  // --- ESTADOS: MOTOR DE HORÁRIOS ---
  const [selectedProfId, setSelectedProfId] = useState('')
  const [disponibilidades, setDisponibilidades] = useState<any[]>([])
  const [matriculasProf, setMatriculasProf] = useState<any[]>([]) 
  const [diasDispSelecionados, setDiasDispSelecionados] = useState<string[]>(['Segunda'])
  const [dispDia, setDispDia] = useState('Segunda')
  const [dispInicio, setDispInicio] = useState('08:00')
  const [dispFim, setDispFim] = useState('12:00')
  const [temAlmoco, setTemAlmoco] = useState(true)
  const [almocoInicio, setAlmocoInicio] = useState('12:00')
  const [almocoFim, setAlmocoFim] = useState('14:00')

  // --- ESTADOS: EQUIPE E PROFS ---
  const [professores, setProfessores] = useState<any[]>([])
  const [showModalProf, setShowModalProf] = useState(false)
  const [profForm, setProfForm] = useState({ 
    id: '', nome_completo: '', email: '', senha: '', role: 'PROFESSOR', 
    telefone: '', cpf: '', data_nascimento: '', cep: '', endereco: '', 
    numero: '', complemento: '', bairro: '', cidade: '', estado: '', avatar_url: '',
    modalidades: [] as string[]
  })
  const [showCropModalProf, setShowCropModalProf] = useState(false)
  const [buscaEquipe, setBuscaEquipe] = useState('')
  const [imageToCropProf, setImageToCropProf] = useState<string | null>(null)
  const [cropProf, setCropProf] = useState({ x: 0, y: 0 })
  const [zoomProf, setZoomProf] = useState(1)
  const [croppedAreaPixelsProf, setCroppedAreaPixelsProf] = useState<any>(null)
  const [editFotoArquivoProf, setEditFotoArquivoProf] = useState<File | null>(null)
  const [fotoPreviewProf, setFotoPreviewProf] = useState<string | null>(null)

  // --- ESTADOS: RELATÓRIOS ---
  const [finPeriodo, setFinPeriodo] = useState('30')
  const [finDataInicio, setFinDataInicio] = useState('')
  const [finDataFim, setFinDataFim] = useState('')
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarTudo() }, [isMounted])
  useEffect(() => { if (selectedProfId) carregarDisponibilidadeProf(selectedProfId) }, [selectedProfId])

  async function carregarTudo() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const { data: conf } = await supabase.from('configuracoes').select('*').eq('id', 1).single()
    if (conf) { 
      setConfig({
        nome_escola: conf.nome_escola || '', chave_pix: conf.chave_pix || '', logo_url: conf.logo_url || '',
        cnpj: conf.cnpj || '', telefone: conf.telefone || '', favicon_url: conf.favicon_url || '',
        cep: conf.cep || '', endereco: conf.endereco || '', numero: conf.numero || '',
        complemento: conf.complemento || '', bairro: conf.bairro || '', cidade: conf.cidade || '', estado: conf.estado || ''
      })
      setLogoPreview(conf.logo_url)
      setFaviconPreview(conf.favicon_url)
    }

    const { data: sls } = await supabase.from('salas').select('*').order('nome')
    const { data: mods } = await supabase.from('modalidades').select('*').order('nome')
    const { data: profs } = await supabase.from('profiles').select('*').in('role', ['PROFESSOR', 'ADMIN']).order('nome_completo')
    
    setSalas(sls || [])
    setModalidades(mods || [])
    setProfessores(profs || [])
    setLoading(false)
  }

  // --- FUNÇÕES DA ESCOLA ---
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = formatCEP(e.target.value); 
    setConfig({ ...config, cep: newCep });
    const cleanCep = newCep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`); 
        const data = await res.json();
        if (!data.erro) {
          setConfig((prev: any) => ({ ...prev, endereco: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', estado: data.uf || '' }))
          document.getElementById('escola-numero')?.focus()
        }
      } catch (error) { console.error("Erro no CEP") }
    }
  }

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true)
    let urlLogo = config.logo_url
    let urlFavicon = config.favicon_url
    
    if (logoFile) {
      const { data } = await supabase.storage.from('avatars').upload(`escola/logo-${Date.now()}.png`, logoFile)
      if (data) urlLogo = supabase.storage.from('avatars').getPublicUrl(data.path).data.publicUrl
    }
    if (faviconFile) {
      const { data } = await supabase.storage.from('avatars').upload(`escola/favicon-${Date.now()}.png`, faviconFile)
      if (data) urlFavicon = supabase.storage.from('avatars').getPublicUrl(data.path).data.publicUrl
    }

    await supabase.from('configuracoes').upsert([{ 
      id: 1, nome_escola: config.nome_escola, chave_pix: config.chave_pix, cnpj: config.cnpj, telefone: config.telefone,
      logo_url: urlLogo, favicon_url: urlFavicon,
      cep: config.cep, endereco: config.endereco, numero: config.numero, complemento: config.complemento, bairro: config.bairro, cidade: config.cidade, estado: config.estado
    }])
    alert("✅ Configurações da Escola salvas com sucesso!"); carregarTudo(); setIsSubmitting(false)
  }

  // --- FUNÇÕES DE ESTRUTURA ---
  const handleAddSala = async (e: React.FormEvent) => { e.preventDefault(); if (!novaSala) return; await supabase.from('salas').insert([{ nome: novaSala }]); setNovaSala(''); carregarTudo() }
  const handleDelSala = async (id: string) => { if (!confirm("Deletar esta sala?")) return; await supabase.from('salas').delete().eq('id', id); carregarTudo() }
  const handleAddModalidade = async (e: React.FormEvent) => { e.preventDefault(); if (!novaModalidade) return; await supabase.from('modalidades').insert([{ nome: novaModalidade }]); setNovaModalidade(''); carregarTudo() }
  const handleDelModalidade = async (id: string) => { if (!confirm("Deletar esta modalidade?")) return; await supabase.from('modalidades').delete().eq('id', id); carregarTudo() }

  // --- FUNÇÕES DO MOTOR DE HORÁRIOS ---
  async function carregarDisponibilidadeProf(id: string) {
    const { data } = await supabase.from('disponibilidade_professor').select('*').eq('professor_id', id)
    
    const { data: agendaMats, error } = await supabase.from('agenda').select('*, aluno:profiles!aluno_id(id, nome_completo, alunos_info(status, data_inativacao))').eq('professor_id', id)
    if (error) console.error("Erro ao buscar agenda:", error.message)

    setMatriculasProf(agendaMats || []) 

    const ordemDias: Record<string, number> = { 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }
    const ordenado = (data || []).sort((a: any, b: any) => {
      if (ordemDias[a.dia_semana] !== ordemDias[b.dia_semana]) return ordemDias[a.dia_semana] - ordemDias[b.dia_semana]
      return a.hora_inicio.localeCompare(b.hora_inicio)
    })
    setDisponibilidades(ordenado)
  }

  const getOcupante = (disp: any) => {
    const hojeStr = new Date().toISOString().split('T')[0];

    return matriculasProf.find(m => {
      const diaAgenda = String(m.dia || '').trim().toLowerCase()
      const diaGrade = String(disp.dia_semana || '').trim().toLowerCase()
      
      const horaAgenda = String(m.horario_inicio || '').slice(0, 5)
      const horaGrade = String(disp.hora_inicio || '').slice(0, 5)

      if (diaAgenda === diaGrade && horaAgenda === horaGrade) {
        const info = Array.isArray(m.aluno?.alunos_info) ? m.aluno?.alunos_info[0] : m.aluno?.alunos_info;
        
        if (!info) return true; 
        
        if (info.status === 'Inativo') {
          if (!info.data_inativacao) return false; 
          if (hojeStr > info.data_inativacao) return false; 
        }
        
        return true; 
      }
      return false;
    });
  }

  const handleGerarDisponibilidade = async () => {
    if (!selectedProfId) return alert("Selecione um professor primeiro.")
    if (diasDispSelecionados.length === 0) return alert("Selecione pelo menos um dia da semana.")
    setIsSubmitting(true)

    const startMin = parseInt(dispInicio.split(':')[0]) * 60 + parseInt(dispInicio.split(':')[1])
    const endMin = parseInt(dispFim.split(':')[0]) * 60 + parseInt(dispFim.split(':')[1])
    if (endMin <= startMin) {
      setIsSubmitting(false)
      return alert("O horário final precisa ser depois do horário inicial.")
    }

    const slotsToInsert = []
    for (const dia of diasDispSelecionados) {
      let currentMin = startMin
      while (currentMin + 60 <= endMin) {
        const slotStart = currentMin
        const slotEnd = currentMin + 60
        const hStart = String(Math.floor(slotStart / 60)).padStart(2, '0') + ':' + String(slotStart % 60).padStart(2, '0')
        const hEnd = String(Math.floor(slotEnd / 60)).padStart(2, '0') + ':' + String(slotEnd % 60).padStart(2, '0')
        const exists = disponibilidades.some(d => d.dia_semana === dia && String(d.hora_inicio).slice(0, 5) === hStart)
        if (!exists) slotsToInsert.push({ professor_id: selectedProfId, dia_semana: dia, hora_inicio: hStart, hora_fim: hEnd })
        currentMin += 60
      }
    }

    if (slotsToInsert.length > 0) {
      await supabase.from('disponibilidade_professor').insert(slotsToInsert)
      alert(`✅ ${slotsToInsert.length} horários adicionados à semana!`)
      carregarDisponibilidadeProf(selectedProfId)
    } else {
      alert("Esses horários já fazem parte da disponibilidade.")
    }
    setIsSubmitting(false)
  }

  const toggleDiaDisponibilidade = (dia: string) => {
    setDiasDispSelecionados(prev => prev.includes(dia) ? prev.filter(item => item !== dia) : [...prev, dia])
  }

  const handleToggleDisponibilidade = async (dia: string, horaInicio: string) => {
    if (!selectedProfId || isSubmitting) return
    const existente = disponibilidades.find(d => d.dia_semana === dia && String(d.hora_inicio).slice(0, 5) === horaInicio)

    if (existente) {
      if (getOcupante(existente)) {
        return alert("Este horário possui uma aula fixa. Altere primeiro a matrícula na agenda.")
      }
      setIsSubmitting(true)
      await supabase.from('disponibilidade_professor').delete().eq('id', existente.id)
      await carregarDisponibilidadeProf(selectedProfId)
      setIsSubmitting(false)
      return
    }

    const inicioMin = parseInt(horaInicio.slice(0, 2)) * 60 + parseInt(horaInicio.slice(3, 5))
    const fimMin = inicioMin + 60
    const horaFim = `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`
    setIsSubmitting(true)
    await supabase.from('disponibilidade_professor').insert([{
      professor_id: selectedProfId,
      dia_semana: dia,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
    }])
    await carregarDisponibilidadeProf(selectedProfId)
    setIsSubmitting(false)
  }

  const handleDelDisponibilidade = async (id: string) => { 
    const disp = disponibilidades.find(d => d.id === id);
    if (disp && getOcupante(disp)) {
      alert("⚠️ ATENÇÃO: Existe uma matrícula preenchendo este horário na Agenda! Você não pode excluir a vaga da grade sem antes alterar ou cancelar a matrícula do aluno.");
      return;
    }
    if (!confirm("Excluir este horário livre da grade?")) return; 
    await supabase.from('disponibilidade_professor').delete().eq('id', id); 
    carregarDisponibilidadeProf(selectedProfId) 
  }

  const handleLimparDia = async (dia: string) => { 
    const livres = disponibilidades.filter(d => d.dia_semana === dia && !getOcupante(d))
    if (livres.length === 0) return alert(`Não há horários livres para remover em ${dia}.`)
    if (!confirm(`Remover ${livres.length} horário(s) livre(s) de ${dia}? Aulas já ocupadas serão preservadas.`)) return;
    setIsSubmitting(true);
    await supabase.from('disponibilidade_professor').delete().in('id', livres.map(d => d.id));
    await carregarDisponibilidadeProf(selectedProfId);
    setIsSubmitting(false) 
  }

  // --- FUNÇÕES DA EQUIPE ---
  const handleProfCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = formatCEP(e.target.value); 
    setProfForm({ ...profForm, cep: newCep });
    const cleanCep = newCep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`); 
        const data = await res.json();
        if (!data.erro) {
          setProfForm((prev: any) => ({ ...prev, endereco: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', estado: data.uf || '' }))
          document.getElementById('prof-numero')?.focus()
        }
      } catch (error) { console.error("Erro CEP") }
    }
  }

  const handleProfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) { const reader = new FileReader(); reader.onload = () => { setImageToCropProf(reader.result as string); setShowCropModalProf(true) }; reader.readAsDataURL(e.target.files[0]) } }
  const handleConfirmCropProf = async () => { if (imageToCropProf && croppedAreaPixelsProf) { const croppedFile = await getCroppedImg(imageToCropProf, croppedAreaPixelsProf); if (croppedFile) { setEditFotoArquivoProf(croppedFile); setFotoPreviewProf(URL.createObjectURL(croppedFile)) } }; setShowCropModalProf(false); setImageToCropProf(null); setCropProf({ x: 0, y: 0 }); setZoomProf(1) }

  const toggleModalidadeProf = (nomeModalidade: string) => {
    setProfForm(prev => {
      if (prev.modalidades.includes(nomeModalidade)) {
        return { ...prev, modalidades: prev.modalidades.filter(m => m !== nomeModalidade) }
      } else {
        return { ...prev, modalidades: [...prev.modalidades, nomeModalidade] }
      }
    })
  }

  const handleSalvarProfessor = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true)

    let finalAvatarUrl = profForm.avatar_url; 
    if (editFotoArquivoProf) { 
      const fileName = `equipe/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`; 
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, editFotoArquivoProf); 
      if (!uploadError) finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl 
    }

    if (profForm.id) {
      const { error } = await supabase.from('profiles').update({ 
        nome_completo: profForm.nome_completo, role: profForm.role, telefone: profForm.telefone, 
        cpf: profForm.cpf, data_nascimento: profForm.data_nascimento || null, cep: profForm.cep, 
        endereco: profForm.endereco, numero: profForm.numero, complemento: profForm.complemento, 
        bairro: profForm.bairro, cidade: profForm.cidade, estado: profForm.estado, avatar_url: finalAvatarUrl,
        modalidades: profForm.modalidades
      }).eq('id', profForm.id)
      if (error) alert("Erro ao atualizar: " + error.message)
      else { alert("✅ Ficha do membro atualizada!"); setShowModalProf(false); carregarTudo() }
    } else {
      if (!profForm.email || !profForm.senha) return alert("Preencha e-mail e senha para criar o acesso!")
      try {
        const dadosParaEnviar = { ...profForm, avatar_url: finalAvatarUrl }
        const res = await fetch('/api/equipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosParaEnviar) })
        const data = await res.json()
        if (res.ok) { alert("✅ Novo membro cadastrado com sucesso!"); setShowModalProf(false); carregarTudo() } 
        else { alert("❌ Erro: " + (data.error || 'Falha ao criar.')) }
      } catch (err) { alert("Erro de comunicação com o servidor.") }
    }
    setIsSubmitting(false)
  }

  const abrirModalEquipe = (prof: any = null) => {
    if (prof) {
      setProfForm({ 
        id: prof.id, nome_completo: prof.nome_completo || '', email: prof.email || '***', senha: '***', role: prof.role || 'PROFESSOR',
        telefone: prof.telefone || '', cpf: prof.cpf || '', data_nascimento: prof.data_nascimento || '', cep: prof.cep || '', 
        endereco: prof.endereco || '', numero: prof.numero || '', complemento: prof.complemento || '', 
        bairro: prof.bairro || '', cidade: prof.cidade || '', estado: prof.estado || '', avatar_url: prof.avatar_url || '',
        modalidades: prof.modalidades || []
      })
      setFotoPreviewProf(prof.avatar_url || null)
    } else {
      setProfForm({ 
        id: '', nome_completo: '', email: '', senha: '', role: 'PROFESSOR', telefone: '', cpf: '', data_nascimento: '', 
        cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', avatar_url: '',
        modalidades: []
      })
      setFotoPreviewProf(null)
    }
    setEditFotoArquivoProf(null)
    setShowModalProf(true)
  }

  const handleExcluirMembro = async (id: string) => {
    if(!confirm("Tem certeza que deseja APAGAR este membro definitivamente? Isso deletará acessos e registros.")) return;
    await supabase.from('profiles').delete().eq('id', id);
    alert("Membro excluído!");
    carregarTudo();
    setShowModalProf(false);
  }

  // --- FUNÇÕES DE GERAÇÃO DE RELATÓRIOS EM PDF ---
  const handleGerarRelatorioFinanceiro = async () => {
    setGerandoRelatorio(true)
    try {
      let dataInicioStr = ''
      let dataFimStr = new Date().toISOString() 

      if (finPeriodo === 'personalizado') {
        if (!finDataInicio || !finDataFim) {
          alert('Preencha as datas de início e fim.')
          setGerandoRelatorio(false)
          return
        }
        dataInicioStr = new Date(finDataInicio + 'T00:00:00').toISOString()
        dataFimStr = new Date(finDataFim + 'T23:59:59').toISOString()
      } else if (finPeriodo !== 'tudo') {
        const dias = parseInt(finPeriodo)
        const dInicio = new Date()
        dInicio.setDate(dInicio.getDate() - dias)
        dataInicioStr = dInicio.toISOString()
      } else {
        dataInicioStr = '2000-01-01T00:00:00.000Z'
      }

      const { data: pagamentos } = await supabase.from('pagamentos')
        .select('*, aluno:profiles!aluno_id(nome_completo)')
        .gte('data_pagamento', dataInicioStr)
        .lte('data_pagamento', dataFimStr)
      
      const { data: transacoes } = await supabase.from('transacoes')
        .select('*')
        .gte('data_transacao', dataInicioStr)
        .lte('data_transacao', dataFimStr)

      const extrato = [
        ...(pagamentos || []).map(p => ({ data: p.data_pagamento, descricao: `Mensalidade: ${p.aluno?.nome_completo || 'Aluno'}`, valor: p.valor, tipo: 'Entrada' })),
        ...(transacoes || []).map(t => ({ data: t.data_transacao, descricao: t.descricao || t.categoria, valor: t.valor, tipo: t.tipo }))
      ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text('Relatório Financeiro Lótus', 14, 20)
      
      doc.setFontSize(10)
      if (finPeriodo !== 'tudo') {
        doc.text(`Período: ${new Date(dataInicioStr).toLocaleDateString('pt-BR')} a ${new Date(dataFimStr).toLocaleDateString('pt-BR')}`, 14, 28)
      } else {
        doc.text(`Período: Todo o Histórico`, 14, 28)
      }

      const tableData = extrato.map(item => [
        new Date(item.data).toLocaleDateString('pt-BR'),
        item.descricao,
        item.tipo,
        `R$ ${Number(item.valor).toFixed(2)}`
      ])

      let totalEntradas = extrato.filter(i => i.tipo === 'Entrada').reduce((acc, curr) => acc + Number(curr.valor), 0)
      let totalSaidas = extrato.filter(i => i.tipo === 'Saída').reduce((acc, curr) => acc + Number(curr.valor), 0)
      let saldo = totalEntradas - totalSaidas

      autoTable(doc, {
        startY: 35,
        head: [['Data', 'Descrição', 'Tipo', 'Valor']],
        body: tableData,
        headStyles: { fillColor: [79, 70, 229] }, 
        alternateRowStyles: { fillColor: [248, 250, 252] }
      })

      let finalY = (doc as any).lastAutoTable.finalY || 35
      doc.setFontSize(12)
      doc.setTextColor(16, 185, 129) 
      doc.text(`Entradas: R$ ${totalEntradas.toFixed(2)}`, 14, finalY + 12)
      doc.setTextColor(244, 63, 94) 
      doc.text(`Saídas: R$ ${totalSaidas.toFixed(2)}`, 14, finalY + 20)
      doc.setTextColor(15, 23, 42) 
      doc.setFont("helvetica", "bold")
      doc.text(`Saldo do Período: R$ ${saldo.toFixed(2)}`, 14, finalY + 28)

      doc.save(`relatorio_financeiro_${Date.now()}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Erro ao gerar relatório.')
    }
    setGerandoRelatorio(false)
  }

  // --- NOVA FUNÇÃO CORRIGIDA DE ALUNOS ---
  const handleGerarRelatorioAlunos = async (status: 'Ativo' | 'Inativo') => {
    setGerandoRelatorio(true)
    try {
      // 1. Busca os dados dos alunos
      const { data: alunosData, error } = await supabase.from('profiles')
        .select(`
          id,
          nome_completo, 
          telefone, 
          created_at, 
          alunos_info(valor_mensalidade, status, data_inativacao)
        `)
        .eq('role', 'ALUNO')
        .order('nome_completo')

      if (error) {
        console.error("Erro Supabase:", error)
        alert('Erro do Banco de Dados: ' + error.message);
        setGerandoRelatorio(false);
        return;
      }

      // 2. Busca a agenda para cruzar os cursos
      const { data: agendaData } = await supabase.from('agenda').select('aluno_id, instrumento_aula')

      // 3. Monta e filtra a lista
      const alunosFiltrados = (alunosData || []).map(aluno => {
          const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info;
          
          // Procura qual o curso desse aluno específico lá na agenda
          const aulaDoAluno = agendaData?.find(ag => ag.aluno_id === aluno.id);
          
          return {
             nome_completo: aluno.nome_completo,
             telefone: aluno.telefone,
             data_matricula: aluno.created_at,
             curso: aulaDoAluno?.instrumento_aula || 'Sem Curso Informado',
             ...(info || {})
          }
      }).filter(a => {
          const statusAluno = a.status ? String(a.status).trim().toLowerCase() : '';
          if (status === 'Ativo') {
            return statusAluno === 'ativo' || statusAluno === '';
          } else {
            return statusAluno === 'inativo';
          }
      })

      if (alunosFiltrados.length === 0) {
          alert(`Nenhum aluno ${status} encontrado no sistema!`);
          setGerandoRelatorio(false);
          return;
      }

      // 4. Gera o PDF
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text(`Relatório de Alunos ${status}s`, 14, 20)
      doc.setFontSize(10)
      doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28)
      
      let head = [['Nome', 'Telefone', 'Curso', 'Matrícula', 'Mensalidade']]
      if (status === 'Inativo') head[0].push('Inativado Em')

      const tableData = alunosFiltrados.map(a => {
        const base = [
          a.nome_completo || '-',
          a.telefone || '-',
          a.curso || '-',
          a.data_matricula ? new Date(a.data_matricula).toLocaleDateString('pt-BR') : '-',
          `R$ ${Number(a.valor_mensalidade || 0).toFixed(2)}`
        ]
        if (status === 'Inativo') {
          base.push(a.data_inativacao ? new Date(a.data_inativacao).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-')
        }
        return base
      })

      autoTable(doc, {
        startY: 35,
        head: head,
        body: tableData,
        headStyles: { fillColor: status === 'Ativo' ? [16, 185, 129] : [244, 63, 94] }, 
        alternateRowStyles: { fillColor: [248, 250, 252] }
      })

      let finalY = (doc as any).lastAutoTable.finalY || 35
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(`Total de Alunos ${status}s: ${alunosFiltrados.length}`, 14, finalY + 12)

      doc.save(`relatorio_alunos_${status.toLowerCase()}_${Date.now()}.pdf`)
    } catch(e) {
      console.error(e)
      alert('Erro ao gerar relatório.')
    }
    setGerandoRelatorio(false)
  }

  const inputClass = "w-full px-4 py-3.5 rounded-xl bg-white border border-[#deddd6] text-slate-800 font-medium focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10 transition-all outline-none placeholder:text-slate-400 mt-1";
  const equipeFiltrada = professores.filter(prof => {
    const termo = buscaEquipe.trim().toLowerCase()
    if (!termo) return true
    return [prof.nome_completo, prof.email, prof.telefone, ...(prof.modalidades || [])]
      .filter(Boolean)
      .some(valor => String(valor).toLowerCase().includes(termo))
  })
  const professorSelecionado = professores.find(prof => prof.id === selectedProfId)
  const gradeHoras = Array.from({ length: 17 }, (_, index) => `${String(index + 6).padStart(2, '0')}:00`)
  const horariosLivres = disponibilidades.filter(d => !getOcupante(d)).length
  const horariosOcupados = disponibilidades.filter(d => getOcupante(d)).length

  const abrirDisponibilidadeProfessor = (professorId: string) => {
    setSelectedProfId(professorId)
    setActiveSection('horarios')
  }

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-12 w-full relative">
      
      <motion.div variants={itemVariants} className="mb-7">
        <div className="premium-kicker mb-3">Administração</div>
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7efe9] text-[#1f4a3a]">
            <Settings2 size={23} strokeWidth={1.7} />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">Central de gestão</h2>
            <p className="text-slate-500 text-sm md:text-base mt-1.5 max-w-2xl">
              Dados da escola, estrutura, equipe, disponibilidade e relatórios em um único lugar.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.nav
        variants={itemVariants}
        aria-label="Seções da central de gestão"
        role="tablist"
        className="sticky top-3 z-20 premium-panel !rounded-2xl p-2 mb-8 overflow-x-auto custom-scrollbar"
      >
        <div className="flex min-w-max gap-1">
          {[
            { id: 'identidade', icon: Building2, label: 'Escola' },
            { id: 'estrutura', icon: MapPin, label: 'Estrutura' },
            { id: 'equipe', icon: UsersRound, label: 'Equipe' },
            { id: 'horarios', icon: CalendarClock, label: 'Disponibilidade' },
            { id: 'relatorios', icon: BarChart3, label: 'Relatórios' },
          ].map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as typeof activeSection)}
                role="tab"
                aria-selected={isActive}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${isActive ? 'bg-[#1f4a3a] text-white shadow-sm' : 'text-slate-600 hover:bg-[#e7efe9] hover:text-[#1f4a3a]'}`}
              >
                <Icon size={15} strokeWidth={1.8} />
                {item.label}
              </button>
            )
          })}
        </div>
      </motion.nav>

      <div className="space-y-8">
        {activeSection === 'identidade' && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <form onSubmit={handleSalvarConfig} className="space-y-5">
              <div className="premium-panel overflow-hidden">
                <div className="px-5 md:px-6 py-5 border-b border-[#e5e3dc] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center">
                      <Building2 size={19} strokeWidth={1.8} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Perfil da escola</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Identidade usada no aplicativo, nas faturas e nos documentos.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-[#1f4a3a]">
                    <BadgeCheck size={15} />
                    Dados centralizados
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)]">
                  <aside className="p-5 md:p-6 bg-[#faf9f6] border-b xl:border-b-0 xl:border-r border-[#e5e3dc]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-4">Marca</p>
                    <label className="block cursor-pointer group">
                      <div className="h-36 rounded-2xl border border-dashed border-[#cfd6d0] bg-white flex items-center justify-center overflow-hidden relative">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo atual da escola" className="max-h-full max-w-full object-contain p-4" />
                        ) : (
                          <div className="text-center text-slate-400">
                            <ImageIcon size={25} strokeWidth={1.5} className="mx-auto mb-2" />
                            <span className="text-xs font-medium">Adicionar logotipo</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-[#153b2f]/85 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold">Alterar logotipo</div>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])) } }} />
                    </label>
                    <p className="text-[10px] leading-relaxed text-slate-500 mt-3">Prefira uma imagem PNG com fundo transparente e boa leitura em fundo claro.</p>

                    <div className="mt-6 pt-5 border-t border-[#e5e3dc] flex items-center gap-4">
                      <label className="cursor-pointer group shrink-0">
                        <div className="h-16 w-16 rounded-2xl border border-dashed border-[#cfd6d0] bg-white flex items-center justify-center overflow-hidden">
                          {faviconPreview ? <img src={faviconPreview} alt="Ícone atual da escola" className="h-full w-full object-contain p-2" /> : <ImageIcon size={19} className="text-slate-400" />}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setFaviconFile(e.target.files[0]); setFaviconPreview(URL.createObjectURL(e.target.files[0])) } }} />
                      </label>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Ícone do aplicativo</p>
                        <p className="text-[10px] text-slate-500 mt-1">Formato quadrado, idealmente 512 × 512 px.</p>
                      </div>
                    </div>
                  </aside>

                  <div className="p-5 md:p-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-600">Nome da escola</label>
                        <input value={config.nome_escola || ''} onChange={e => setConfig({...config, nome_escola: e.target.value})} placeholder="Nome exibido no sistema" className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">CNPJ</label>
                        <input value={config.cnpj || ''} onChange={e => setConfig({...config, cnpj: formatCPFOrCNPJ(e.target.value)})} placeholder="00.000.000/0000-00" className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Telefone ou WhatsApp</label>
                        <input value={config.telefone || ''} onChange={e => setConfig({...config, telefone: formatPhone(e.target.value)})} placeholder="(00) 00000-0000" className={inputClass} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-600">Chave PIX</label>
                        <input value={config.chave_pix || ''} onChange={e => setConfig({...config, chave_pix: e.target.value})} placeholder="Chave usada nas cobranças" className={inputClass} />
                        <p className="text-[10px] text-slate-500 mt-1.5">Esta informação aparece nas faturas quando não há cobrança integrada.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="premium-panel overflow-hidden">
                <div className="px-5 md:px-6 py-4 border-b border-[#e5e3dc] flex items-center gap-3">
                  <MapPin size={18} className="text-[#1f4a3a]" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Endereço principal</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Usado em documentos, contratos e faturas.</p>
                  </div>
                </div>
                <div className="p-5 md:p-6 grid grid-cols-2 md:grid-cols-12 gap-x-4 gap-y-4">
                  <div className="col-span-2 md:col-span-3"><label className="text-xs font-semibold text-slate-600">CEP</label><input value={config.cep || ''} onChange={handleCepChange} maxLength={9} className={inputClass} /></div>
                  <div className="col-span-2 md:col-span-6"><label className="text-xs font-semibold text-slate-600">Rua</label><input value={config.endereco || ''} onChange={e => setConfig({...config, endereco: e.target.value})} className={inputClass} /></div>
                  <div className="col-span-1 md:col-span-3"><label className="text-xs font-semibold text-slate-600">Número</label><input id="escola-numero" value={config.numero || ''} onChange={e => setConfig({...config, numero: e.target.value})} className={inputClass} /></div>
                  <div className="col-span-1 md:col-span-3"><label className="text-xs font-semibold text-slate-600">Complemento</label><input value={config.complemento || ''} onChange={e => setConfig({...config, complemento: e.target.value})} className={inputClass} /></div>
                  <div className="col-span-2 md:col-span-3"><label className="text-xs font-semibold text-slate-600">Bairro</label><input value={config.bairro || ''} onChange={e => setConfig({...config, bairro: e.target.value})} className={inputClass} /></div>
                  <div className="col-span-2 md:col-span-4"><label className="text-xs font-semibold text-slate-600">Cidade</label><input value={config.cidade || ''} onChange={e => setConfig({...config, cidade: e.target.value})} className={inputClass} /></div>
                  <div className="col-span-1 md:col-span-2"><label className="text-xs font-semibold text-slate-600">UF</label><input value={config.estado || ''} onChange={e => setConfig({...config, estado: e.target.value.toUpperCase()})} maxLength={2} className={inputClass} /></div>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#1f4a3a] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#173c2e] disabled:opacity-50">
                  <Save size={16} /> {isSubmitting ? 'Salvando...' : 'Salvar dados da escola'}
                </button>
              </div>
            </form>
          </motion.section>
        )}

        {activeSection === 'estrutura' && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="premium-panel p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center"><DoorOpen size={19} /></div>
                <div><p className="text-2xl font-semibold text-slate-900">{salas.length}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">Salas cadastradas</p></div>
              </div>
              <div className="premium-panel p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#f3ecdf] text-[#8b6538] flex items-center justify-center"><Music2 size={19} /></div>
                <div><p className="text-2xl font-semibold text-slate-900">{modalidades.length}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">Modalidades ativas</p></div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
              <div className="premium-panel overflow-hidden">
                <div className="px-5 py-4 border-b border-[#e5e3dc]">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><DoorOpen size={18} className="text-[#1f4a3a]" /> Salas e espaços</h3>
                  <p className="text-xs text-slate-500 mt-1">Ambientes disponíveis para agendamento.</p>
                </div>
                <form onSubmit={handleAddSala} className="p-4 border-b border-[#ebe9e3] flex gap-2">
                  <input value={novaSala} onChange={e => setNovaSala(e.target.value)} placeholder="Ex.: Sala de Piano" aria-label="Nome da nova sala" className={`${inputClass} !mt-0 !py-3`} />
                  <button type="submit" className="h-12 px-4 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center gap-2 shrink-0"><Plus size={15} /> Adicionar</button>
                </form>
                <div className="divide-y divide-[#ebe9e3] max-h-[430px] overflow-y-auto custom-scrollbar">
                  {salas.map(sl => (
                    <div key={sl.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[#faf9f6]">
                      <div className="h-8 w-8 rounded-lg bg-[#f1f3ef] text-slate-500 flex items-center justify-center"><DoorOpen size={15} /></div>
                      <span className="text-sm font-semibold text-slate-800 flex-1">{sl.nome}</span>
                      <button onClick={() => handleDelSala(sl.id)} aria-label={`Excluir ${sl.nome}`} className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {salas.length === 0 && <div className="py-14 px-6 text-center text-sm text-slate-500">Nenhuma sala cadastrada.</div>}
                </div>
              </div>

              <div className="premium-panel overflow-hidden">
                <div className="px-5 py-4 border-b border-[#e5e3dc]">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><GraduationCap size={19} className="text-[#1f4a3a]" /> Modalidades e cursos</h3>
                  <p className="text-xs text-slate-500 mt-1">Opções oferecidas nos cadastros e na agenda.</p>
                </div>
                <form onSubmit={handleAddModalidade} className="p-4 border-b border-[#ebe9e3] flex gap-2">
                  <input value={novaModalidade} onChange={e => setNovaModalidade(e.target.value)} placeholder="Ex.: Violão" aria-label="Nome da nova modalidade" className={`${inputClass} !mt-0 !py-3`} />
                  <button type="submit" className="h-12 px-4 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center gap-2 shrink-0"><Plus size={15} /> Adicionar</button>
                </form>
                <div className="divide-y divide-[#ebe9e3] max-h-[430px] overflow-y-auto custom-scrollbar">
                  {modalidades.map(modalidade => (
                    <div key={modalidade.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[#faf9f6]">
                      <div className="h-8 w-8 rounded-lg bg-[#f3ecdf] text-[#8b6538] flex items-center justify-center"><Music2 size={15} /></div>
                      <span className="text-sm font-semibold text-slate-800 flex-1">{modalidade.nome}</span>
                      <button onClick={() => handleDelModalidade(modalidade.id)} aria-label={`Excluir ${modalidade.nome}`} className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {modalidades.length === 0 && <div className="py-14 px-6 text-center text-sm text-slate-500">Nenhuma modalidade cadastrada.</div>}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {activeSection === 'equipe' && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="premium-panel overflow-hidden">
            <div className="px-5 md:px-6 py-5 border-b border-[#e5e3dc] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><UsersRound size={19} className="text-[#1f4a3a]" /> Pessoas e acessos</h3>
                <p className="text-xs text-slate-500 mt-1">{professores.filter(p => p.role === 'PROFESSOR').length} professor(es) · {professores.filter(p => p.role === 'ADMIN').length} administrador(es)</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <label className="relative flex-1 lg:w-72">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={buscaEquipe} onChange={e => setBuscaEquipe(e.target.value)} placeholder="Buscar na equipe" className="h-11 w-full pl-10 pr-4 rounded-xl border border-[#deddd6] bg-white text-sm outline-none focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10" />
                </label>
                <button onClick={() => abrirModalEquipe()} className="h-11 px-4 rounded-xl bg-[#1f4a3a] text-white text-xs font-semibold flex items-center justify-center gap-2"><Plus size={15} /> Novo membro</button>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-[minmax(240px,1.2fr)_130px_minmax(180px,1fr)_150px] gap-4 px-6 py-2.5 bg-[#faf9f6] border-b border-[#ebe9e3] text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <span>Profissional</span><span>Acesso</span><span>Modalidades</span><span className="text-right">Ações</span>
            </div>
            <div className="divide-y divide-[#ebe9e3]">
              {equipeFiltrada.map(prof => (
                <div key={prof.id} className="px-5 md:px-6 py-4 grid grid-cols-1 md:grid-cols-[minmax(240px,1.2fr)_130px_minmax(180px,1fr)_150px] gap-4 md:items-center hover:bg-[#faf9f6] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-full bg-[#dce8df] text-[#1f4a3a] flex items-center justify-center font-semibold overflow-hidden shrink-0">
                      {prof.avatar_url ? <img src={prof.avatar_url} alt="" className="h-full w-full object-cover" /> : prof.nome_completo?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{prof.nome_completo}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        {prof.email && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Mail size={10} /> {prof.email}</span>}
                        {prof.telefone && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Phone size={10} /> {prof.telefone}</span>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className={`inline-flex px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wide ${prof.role === 'ADMIN' ? 'bg-[#f3ecdf] text-[#7c5b33]' : 'bg-[#e7efe9] text-[#1f4a3a]'}`}>{prof.role === 'ADMIN' ? 'Administrador' : 'Professor'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(prof.modalidades || []).slice(0, 3).map((modalidade: string) => <span key={modalidade} className="px-2 py-1 rounded-md bg-slate-100 text-[9px] font-medium text-slate-600">{modalidade}</span>)}
                    {(prof.modalidades || []).length > 3 && <span className="px-2 py-1 rounded-md bg-slate-100 text-[9px] font-medium text-slate-500">+{prof.modalidades.length - 3}</span>}
                    {(!prof.modalidades || prof.modalidades.length === 0) && <span className="text-[10px] text-slate-400">Não informadas</span>}
                  </div>
                  <div className="flex md:justify-end gap-1.5">
                    {prof.role === 'PROFESSOR' && <button onClick={() => abrirDisponibilidadeProfessor(prof.id)} title="Gerenciar disponibilidade" className="h-9 px-3 rounded-lg border border-[#d7e3da] bg-[#f3f7f4] text-[#1f4a3a] text-[10px] font-semibold flex items-center gap-1.5"><CalendarClock size={13} /> Horários</button>}
                    <button onClick={() => abrirModalEquipe(prof)} title="Editar ficha" className="h-9 w-9 rounded-lg border border-[#deddd6] bg-white text-slate-500 flex items-center justify-center hover:text-[#1f4a3a]"><Pencil size={14} /></button>
                  </div>
                </div>
              ))}
              {equipeFiltrada.length === 0 && <div className="py-16 px-6 text-center text-sm text-slate-500">Nenhum membro encontrado.</div>}
            </div>
          </motion.section>
        )}

        {activeSection === 'horarios' && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
            <div className="premium-panel overflow-hidden">
              <div className="px-5 md:px-6 py-5 border-b border-[#e5e3dc] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5"><CalendarClock size={19} className="text-[#1f4a3a]" /> Semana disponível</h3>
                  <p className="text-xs text-slate-500 mt-1">Clique na grade ou aplique um período a vários dias de uma vez.</p>
                </div>
                <label className="w-full lg:w-80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Professor</span>
                  <select value={selectedProfId} onChange={e => setSelectedProfId(e.target.value)} className="mt-1.5 h-11 w-full px-3.5 rounded-xl border border-[#deddd6] bg-white text-sm font-semibold text-slate-800 outline-none focus:border-[#1f4a3a]">
                    <option value="">Selecione um professor</option>
                    {professores.filter(p => p.role === 'PROFESSOR').map(prof => <option key={prof.id} value={prof.id}>{prof.nome_completo}</option>)}
                  </select>
                </label>
              </div>

              {!selectedProfId ? (
                <div className="py-20 px-6 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center mx-auto mb-4"><UserRound size={22} /></div>
                  <p className="text-sm font-semibold text-slate-800">Escolha um professor</p>
                  <p className="text-xs text-slate-500 mt-1">A semana de disponibilidade aparecerá aqui.</p>
                </div>
              ) : (
                <>
                  <div className="p-5 md:p-6 border-b border-[#e5e3dc] bg-[#faf9f6]">
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-5 xl:items-end">
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Aplicar aos dias</p>
                          <button type="button" onClick={() => setDiasDispSelecionados(dias)} className="text-[10px] font-semibold text-[#1f4a3a]">Selecionar todos</button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {dias.map(dia => {
                            const selecionado = diasDispSelecionados.includes(dia)
                            return <button key={dia} type="button" onClick={() => toggleDiaDisponibilidade(dia)} className={`h-10 rounded-lg border text-[10px] font-semibold transition-colors ${selecionado ? 'bg-[#1f4a3a] border-[#1f4a3a] text-white' : 'bg-white border-[#deddd6] text-slate-500 hover:border-[#9fb4a7]'}`}>{dia.slice(0, 3)}</button>
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <label className="flex-1 sm:w-32"><span className="text-[10px] font-semibold text-slate-500">Das</span><input type="time" value={dispInicio} onChange={e => setDispInicio(e.target.value)} className="mt-1 h-10 w-full px-3 rounded-lg border border-[#deddd6] bg-white text-xs font-semibold" /></label>
                        <label className="flex-1 sm:w-32"><span className="text-[10px] font-semibold text-slate-500">Até</span><input type="time" value={dispFim} onChange={e => setDispFim(e.target.value)} className="mt-1 h-10 w-full px-3 rounded-lg border border-[#deddd6] bg-white text-xs font-semibold" /></label>
                        <button onClick={handleGerarDisponibilidade} disabled={isSubmitting} className="h-10 px-4 rounded-lg bg-[#1f4a3a] text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={14} /> Aplicar período</button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-3">Para criar uma pausa, aplique dois períodos no mesmo dia — por exemplo, 08h–12h e 14h–20h.</p>
                  </div>

                  <div className="px-5 md:px-6 py-4 border-b border-[#e5e3dc] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-[#dce8df] text-[#1f4a3a] flex items-center justify-center font-semibold shrink-0">{professorSelecionado?.nome_completo?.charAt(0)}</div>
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{professorSelecionado?.nome_completo}</p><p className="text-[10px] text-slate-500">Disponibilidade semanal recorrente</p></div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-sm border border-[#cdd4cf] bg-white" /> Indisponível</span>
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-sm bg-[#dcebdd]" /> Livre</span>
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2.5 w-2.5 rounded-sm bg-[#1f4a3a]" /> Com aula</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-[#e5e3dc]">
                    <div className="px-4 py-3 text-center"><p className="text-lg font-semibold text-slate-900">{disponibilidades.length}</p><p className="text-[9px] uppercase tracking-wider text-slate-500">Disponíveis</p></div>
                    <div className="px-4 py-3 text-center border-x border-[#e5e3dc]"><p className="text-lg font-semibold text-emerald-700">{horariosLivres}</p><p className="text-[9px] uppercase tracking-wider text-slate-500">Livres</p></div>
                    <div className="px-4 py-3 text-center"><p className="text-lg font-semibold text-[#1f4a3a]">{horariosOcupados}</p><p className="text-[9px] uppercase tracking-wider text-slate-500">Com aula</p></div>
                  </div>

                  <div className="overflow-auto custom-scrollbar max-h-[620px]">
                    <div className="min-w-[760px]">
                      <div className="sticky top-0 z-10 grid grid-cols-[72px_repeat(6,minmax(105px,1fr))] bg-[#faf9f6] border-b border-[#e5e3dc]">
                        <div className="px-3 py-3 text-[9px] font-semibold uppercase text-slate-400">Hora</div>
                        {dias.map(dia => (
                          <div key={dia} className="px-2 py-3 text-center border-l border-[#ebe9e3]">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{dia}</p>
                            {disponibilidades.some(d => d.dia_semana === dia) && <button onClick={() => handleLimparDia(dia)} className="text-[8px] text-rose-500 mt-1 hover:underline">Limpar livres</button>}
                          </div>
                        ))}
                      </div>
                      {gradeHoras.map(hora => (
                        <div key={hora} className="grid grid-cols-[72px_repeat(6,minmax(105px,1fr))] border-b border-[#ebe9e3]">
                          <div className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 flex items-center gap-1.5"><Clock3 size={11} /> {hora}</div>
                          {dias.map(dia => {
                            const disponibilidade = disponibilidades.find(d => d.dia_semana === dia && String(d.hora_inicio).slice(0, 5) === hora)
                            const ocupante = disponibilidade ? getOcupante(disponibilidade) : null
                            const ocupado = !!ocupante
                            return (
                              <button
                                key={`${dia}-${hora}`}
                                onClick={() => handleToggleDisponibilidade(dia, hora)}
                                disabled={isSubmitting || ocupado}
                                title={ocupado ? `Aula de ${ocupante?.aluno?.nome_completo || 'aluno'}` : disponibilidade ? 'Clique para marcar como indisponível' : 'Clique para disponibilizar'}
                                className={`min-h-12 px-2 py-2 border-l border-[#ebe9e3] text-left transition-colors disabled:cursor-wait ${ocupado ? 'bg-[#1f4a3a] text-white cursor-not-allowed' : disponibilidade ? 'bg-[#e4efe5] hover:bg-[#d5e6d7] text-[#1f4a3a]' : 'bg-white hover:bg-[#f7f8f5] text-slate-300'}`}
                              >
                                {ocupado ? (
                                  <><span className="block text-[9px] font-semibold truncate">{ocupante?.aluno?.nome_completo?.split(' ')[0] || 'Ocupado'}</span><span className="text-[8px] text-white/60">aula fixa</span></>
                                ) : disponibilidade ? (
                                  <span className="text-[9px] font-semibold">Disponível</span>
                                ) : (
                                  <span className="text-[9px]">—</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.section>
        )}

        {false && (<>
        <motion.section id="identidade" className="premium-section-anchor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <form onSubmit={handleSalvarConfig} className="premium-panel p-6 md:p-9">
                <div className="flex items-center gap-3 mb-9 pb-5 border-b border-[#e5e3dc]">
                  <div className="h-10 w-10 rounded-xl bg-[#e7efe9] text-[#1f4a3a] flex items-center justify-center">
                    <Building2 size={19} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Dados e identidade da escola</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Informações usadas no aplicativo, documentos e faturas.</p>
                  </div>
                </div>
                
                <div className="flex flex-col xl:flex-row gap-12 mb-10">
                  <div className="flex flex-col gap-6 shrink-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 border-b border-indigo-500/10 pb-2">Identidade Visual</p>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1 block mb-2">Logo Principal</label>
                      <label className="cursor-pointer group flex flex-col items-center justify-center w-56 h-32 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-all bg-white/50 relative overflow-hidden shadow-inner">
                        {logoPreview ? <img src={logoPreview} className="h-full object-contain p-2" /> : <span className="text-xs font-bold text-indigo-400 uppercase">Logo PNG</span>}
                        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] font-black uppercase tracking-widest">Trocar</div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])) } }} />
                      </label>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 ml-1 block mb-2">Favicon (Ícone Menor)</label>
                      <label className="cursor-pointer group flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-all bg-white/50 relative overflow-hidden shadow-inner">
                        {faviconPreview ? <img src={faviconPreview} className="h-full object-contain p-2" /> : <span className="text-4xl opacity-40">🌐</span>}
                        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[8px] font-black uppercase">Trocar</div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setFaviconFile(e.target.files[0]); setFaviconPreview(URL.createObjectURL(e.target.files[0])) } }} />
                      </label>
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 border-b border-indigo-500/10 pb-2">Informações Cadastrais</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><label className="text-xs font-semibold text-slate-600 ml-1">Nome de Exibição no App</label><input value={config.nome_escola || ''} onChange={e => setConfig({...config, nome_escola: e.target.value})} className={inputClass} /></div>
                      <div><label className="text-xs font-semibold text-slate-600 ml-1">CNPJ</label><input value={config.cnpj || ''} onChange={e => setConfig({...config, cnpj: e.target.value})} className={inputClass} /></div>
                      <div><label className="text-xs font-semibold text-slate-600 ml-1">Telefone / WhatsApp</label><input value={config.telefone || ''} onChange={e => setConfig({...config, telefone: e.target.value})} className={inputClass} /></div>
                      <div><label className="text-xs font-semibold text-slate-600 ml-1">Chave PIX (Para Recebimentos)</label><input value={config.chave_pix || ''} onChange={e => setConfig({...config, chave_pix: e.target.value})} className={inputClass} /></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 mb-10">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 border-b border-indigo-500/10 pb-2">Endereço Físico da Escola</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="col-span-2 md:col-span-1"><label className="text-xs font-semibold text-slate-600 ml-1">CEP</label><input value={config.cep || ''} onChange={handleCepChange} maxLength={9} className={inputClass} /></div>
                    <div className="col-span-2 md:col-span-2"><label className="text-xs font-semibold text-slate-600 ml-1">Endereço / Rua</label><input value={config.endereco || ''} onChange={e => setConfig({...config, endereco: e.target.value})} className={inputClass} /></div>
                    <div className="col-span-2 md:col-span-1"><label className="text-xs font-semibold text-slate-600 ml-1">Número</label><input id="escola-numero" value={config.numero || ''} onChange={e => setConfig({...config, numero: e.target.value})} className={inputClass} /></div>
                    <div className="col-span-2 md:col-span-1"><label className="text-xs font-semibold text-slate-600 ml-1">Complemento</label><input value={config.complemento || ''} onChange={e => setConfig({...config, complemento: e.target.value})} className={inputClass} /></div>
                    <div className="col-span-2 md:col-span-1"><label className="text-xs font-semibold text-slate-600 ml-1">Bairro</label><input value={config.bairro || ''} onChange={e => setConfig({...config, bairro: e.target.value})} className={inputClass} /></div>
                    <div className="col-span-2 md:col-span-1"><label className="text-xs font-semibold text-slate-600 ml-1">Cidade</label><input value={config.cidade || ''} onChange={e => setConfig({...config, cidade: e.target.value})} className={inputClass} /></div>
                    <div className="col-span-2 md:col-span-1"><label className="text-xs font-semibold text-slate-600 ml-1">UF</label><input value={config.estado || ''} onChange={e => setConfig({...config, estado: e.target.value})} maxLength={2} className={`uppercase ${inputClass}`} /></div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/60 flex justify-end">
                   <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isSubmitting} className="px-8 py-3.5 bg-[#1f4a3a] text-white rounded-xl font-semibold text-sm shadow-[0_10px_24px_rgba(31,74,58,0.2)] hover:bg-[#173c2e] transition-all disabled:opacity-50">
                    {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
                  </motion.button>
                </div>
              </form>
        </motion.section>

        <motion.section id="estrutura" className="premium-section-anchor grid grid-cols-1 lg:grid-cols-2 gap-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              
              <div className="premium-panel p-6 md:p-8">
                <h3 className="text-xl font-semibold text-slate-800 mb-7 flex items-center gap-3"><MapPin size={20} className="text-[#1f4a3a]" strokeWidth={1.8} /> Salas físicas</h3>
                <form onSubmit={handleAddSala} className="flex gap-4 mb-8">
                  <input value={novaSala} onChange={e => setNovaSala(e.target.value)} placeholder="Nova Sala (Ex: Sala 01)" className={`flex-1 ${inputClass} !mt-0`} />
                  <motion.button whileTap={{ scale: 0.9 }} type="submit" className="bg-rose-500 text-white px-8 rounded-xl font-bold text-xl shadow-md hover:bg-rose-600 transition-colors">+</motion.button>
                </form>
                <div className="flex flex-wrap gap-3">
                  {salas.length === 0 ? <p className="text-sm opacity-60 font-medium italic text-slate-500">Nenhuma sala cadastrada.</p> : salas.map(sl => (
                    <motion.div whileHover={{ scale: 1.05 }} key={sl.id} className={`bg-white/60 backdrop-blur-sm border border-white/80 px-5 py-3 rounded-xl flex items-center gap-4 text-sm font-bold text-slate-700 shadow-sm group hover:border-rose-300 transition-all`}>
                      {sl.nome} 
                      <button onClick={() => handleDelSala(sl.id)} className="text-rose-500 opacity-30 group-hover:opacity-100 hover:bg-rose-500 hover:text-white h-7 w-7 rounded-full flex items-center justify-center transition-all shadow-sm">✖</button>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="premium-panel p-6 md:p-8">
                <h3 className="text-xl font-semibold text-slate-800 mb-7 flex items-center gap-3"><GraduationCap size={21} className="text-[#1f4a3a]" strokeWidth={1.8} /> Modalidades e cursos</h3>
                <form onSubmit={handleAddModalidade} className="flex gap-4 mb-8">
                  <input value={novaModalidade} onChange={e => setNovaModalidade(e.target.value)} placeholder="Novo Curso (Ex: Piano)" className={`flex-1 ${inputClass} !mt-0`} />
                  <motion.button whileTap={{ scale: 0.9 }} type="submit" className="bg-emerald-500 text-white px-8 rounded-xl font-bold text-xl shadow-md hover:bg-emerald-600 transition-colors">+</motion.button>
                </form>
                <div className="flex flex-wrap gap-3">
                  {modalidades.length === 0 ? <p className="text-sm opacity-60 font-medium italic text-slate-500">Nenhuma modalidade cadastrada.</p> : modalidades.map(m => (
                    <motion.div whileHover={{ scale: 1.05 }} key={m.id} className={`bg-white/60 backdrop-blur-sm border border-white/80 px-5 py-3 rounded-xl flex items-center gap-4 text-sm font-bold text-slate-700 shadow-sm group hover:border-emerald-300 transition-all`}>
                      {m.nome} 
                      <button onClick={() => handleDelModalidade(m.id)} className="text-emerald-600 opacity-30 group-hover:opacity-100 hover:bg-emerald-500 hover:text-white h-7 w-7 rounded-full flex items-center justify-center transition-all shadow-sm">✖</button>
                    </motion.div>
                  ))}
                </div>
              </div>

        </motion.section>

        <motion.section id="equipe" className="premium-section-anchor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="premium-panel p-6 md:p-9">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/60 pb-6">
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-800 flex items-center gap-3"><UsersRound size={23} className="text-[#1f4a3a]" strokeWidth={1.8} /> Equipe</h3>
                    <p className="text-slate-500 text-sm mt-1">Gerencie dados, acessos e modalidades de professores e administradores.</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => abrirModalEquipe()} className="bg-[#1f4a3a] text-white px-5 py-3.5 rounded-xl font-semibold text-sm shadow-[0_10px_24px_rgba(31,74,58,0.18)] hover:bg-[#173c2e] transition-all whitespace-nowrap">
                    Adicionar membro
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {professores.map(p => (
                    <motion.div whileHover={{ y: -4 }} key={p.id} className={`bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border border-white/80 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xl font-bold text-white shadow-md border-2 border-white/50 overflow-hidden flex-shrink-0">
                          {p.avatar_url ? <img src={p.avatar_url} alt="Foto" className="w-full h-full object-cover" /> : p.nome_completo?.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-sm text-slate-800 line-clamp-1">{p.nome_completo}</p>
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md tracking-wider mt-1 inline-block border shadow-sm ${p.role === 'ADMIN' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{p.role}</span>
                        </div>
                      </div>
                      
                      {p.modalidades && p.modalidades.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2">Cursos:</p>
                          <div className="flex flex-wrap gap-1">
                            {p.modalidades.map((m: string) => (
                              <span key={m} className="text-[9px] bg-white/80 border border-slate-200 text-slate-600 px-2 py-1 rounded-lg font-bold shadow-sm">{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 border-t border-white/80 pt-4 mt-auto">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => abrirModalEquipe(p)} className="flex-1 py-3 rounded-xl bg-white/50 border border-white/80 text-xs font-bold text-slate-600 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-all shadow-sm">
                          ⚙️ Editar Ficha
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>

              </div>
        </motion.section>

        <motion.section id="horarios" className="premium-section-anchor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="premium-panel p-6 md:p-9 flex flex-col">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-white/60 pb-6">
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-800 flex items-center gap-3"><CalendarClock size={23} className="text-[#1f4a3a]" strokeWidth={1.8} /> Disponibilidade da equipe</h3>
                    <p className={`text-slate-500 text-sm mt-2 max-w-2xl`}>Gere múltiplos horários de uma vez. O aplicativo cruza essas "vagas" com as matrículas ativas para mostrar o que está livre ou preenchido.</p>
                  </div>
                  <div className="w-full md:w-80">
                    <label className="text-xs font-semibold text-amber-600 ml-1 mb-2 block">1. Escolha o Professor</label>
                    <select value={selectedProfId} onChange={e => setSelectedProfId(e.target.value)} className={`w-full p-4 rounded-xl border border-amber-200 bg-amber-50/80 font-bold text-sm text-slate-800 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all shadow-inner`}>
                      <option value="">Selecione...</option>
                      {professores.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                    </select>
                  </div>
                </div>

                {!selectedProfId ? (
                  <div className="flex flex-col items-center justify-center opacity-50 border-2 border-dashed border-slate-300 rounded-[2rem] p-24 text-center bg-white/30">
                    <span className="text-6xl mb-4 grayscale">🧑‍🏫</span>
                    <p className="font-bold text-xl text-slate-700">Professor não selecionado</p>
                    <p className="font-medium text-sm text-slate-500 mt-2">Escolha no menu acima para gerenciar a grade e vagas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                    
                    <div className="xl:col-span-1 bg-white/50 backdrop-blur-md p-8 rounded-[2rem] border border-white/80 shadow-sm h-fit">
                      <h4 className="text-xs font-semibold uppercase tracking-wider mb-6 text-slate-500">2. Parâmetros de Geração</h4>
                      
                      <div className="space-y-6">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 ml-1">Dia da Semana</label>
                          <select value={dispDia} onChange={e => setDispDia(e.target.value)} className={inputClass}>
                            {dias.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-xs font-semibold text-indigo-600 ml-1">Entra (Ex: 08:00)</label><input type="time" value={dispInicio} onChange={e => setDispInicio(e.target.value)} className={inputClass} /></div>
                          <div><label className="text-xs font-semibold text-indigo-600 ml-1">Sai (Ex: 22:00)</label><input type="time" value={dispFim} onChange={e => setDispFim(e.target.value)} className={inputClass} /></div>
                        </div>
                        
                        <div className="p-5 border border-white/80 rounded-2xl bg-white/60 shadow-inner">
                          <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <input type="checkbox" checked={temAlmoco} onChange={e => setTemAlmoco(e.target.checked)} className="w-5 h-5 accent-amber-500" />
                            <span className="text-xs font-bold text-slate-700">Pausa para Almoço?</span>
                          </label>
                          <AnimatePresence>
                            {temAlmoco && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-semibold text-amber-600 ml-1">Início da Pausa</label><input type="time" value={almocoInicio} onChange={e => setAlmocoInicio(e.target.value)} className={`${inputClass} !p-3 !text-xs`} /></div>
                                <div><label className="text-[10px] font-semibold text-amber-600 ml-1">Fim da Pausa</label><input type="time" value={almocoFim} onChange={e => setAlmocoFim(e.target.value)} className={`${inputClass} !p-3 !text-xs`} /></div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        <motion.button whileTap={{ scale: 0.98 }} onClick={handleGerarDisponibilidade} disabled={isSubmitting} className="w-full py-5 bg-amber-400 text-amber-950 rounded-2xl font-bold text-sm shadow-md hover:bg-amber-500 transition-all disabled:opacity-50">
                          {isSubmitting ? 'Processando...' : '⚡ Gerar Lote de Horários'}
                        </motion.button>
                      </div>
                    </div>

                    <div className="xl:col-span-2 flex flex-col h-full">
                      <div className="flex flex-col mb-6 border-b border-white/60 pb-4 gap-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            3. Horários na Grade
                          </h4>
                          <div className="flex flex-wrap gap-2 justify-end">
                            {dias.map(d => {
                              const hasSlots = disponibilidades.some(x => x.dia_semana === d);
                              if (!hasSlots) return null;
                              return (
                                <motion.button whileTap={{ scale: 0.95 }} key={d} onClick={() => handleLimparDia(d)} className="text-[10px] font-bold bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm" title={`Apagar todos de ${d}`}>
                                  Limpar {d}
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                        
                        {/* PAINEL DE CONTAGEM INTELIGENTE */}
                        <div className="flex gap-3 w-full">
                          <div className="flex-1 bg-emerald-50/80 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1">Livres</span>
                            <span className="text-xl font-black">{disponibilidades.filter(d => !getOcupante(d)).length}</span>
                          </div>
                          <div className="flex-1 bg-rose-50/80 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1">Preenchidos</span>
                            <span className="text-xl font-black">{disponibilidades.filter(d => getOcupante(d)).length}</span>
                          </div>
                          <div className="flex-1 bg-slate-100/80 border border-slate-200 text-slate-700 px-4 py-3 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1">Totais</span>
                            <span className="text-xl font-black">{disponibilidades.length}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[600px] space-y-3">
                        {disponibilidades.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center opacity-60 border border-dashed border-slate-300 rounded-3xl p-10 text-center min-h-[300px] bg-white/30">
                            <span className="text-5xl mb-4 grayscale">📭</span>
                            <p className="font-bold text-sm text-slate-500">Nenhum horário gerado.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {disponibilidades.map(disp => {
                              const ocupante = getOcupante(disp);
                              const ocupado = !!ocupante;
                              const alunoNome = ocupante?.aluno?.nome_completo || 'Aluno';
                              
                              return (
                                <motion.div whileHover={{ scale: 1.02 }} key={disp.id} className={`p-4 rounded-2xl border flex justify-between items-center group shadow-sm hover:shadow-md transition-all ${ocupado ? 'bg-rose-50/80 backdrop-blur-md border-rose-200 border-l-4 border-l-rose-500' : 'bg-emerald-50/50 backdrop-blur-md border-emerald-200 border-l-4 border-l-emerald-500'}`}>
                                  <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <p className={`font-bold text-[10px] uppercase ${ocupado ? 'text-rose-700' : 'text-emerald-700'}`}>{disp.dia_semana}</p>
                                      {ocupado ? (
                                        <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm">Preenchido</span>
                                      ) : (
                                        <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm">Livre</span>
                                      )}
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 tracking-tight">{disp.hora_inicio.slice(0,5)} <span className="opacity-60 text-[10px] font-medium">- {disp.hora_fim.slice(0,5)}</span></p>
                                    {ocupado && <p className="text-[9px] font-bold text-rose-600 mt-1 truncate max-w-[120px]">{alunoNome.split(' ')[0]}</p>}
                                  </div>
                                  {!ocupado && <button onClick={() => handleDelDisponibilidade(disp.id)} className="h-8 w-8 bg-white border border-rose-100 text-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                    ✖
                                  </button>}
                                </motion.div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
        </motion.section>
        </>)}

        {activeSection === 'relatorios' && (
        <motion.section id="relatorios" className="premium-section-anchor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="premium-panel p-6 md:p-9">
                
                <h3 className="text-2xl font-semibold text-slate-800 mb-8 flex items-center gap-3"><BarChart3 size={23} className="text-[#1f4a3a]" strokeWidth={1.8} /> Relatórios e exportações</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  
                  {/* CARD RELATÓRIO FINANCEIRO */}
                  <div className="bg-white/60 backdrop-blur-sm border border-white/80 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 bg-[#e7efe9] text-[#1f4a3a] rounded-xl flex items-center justify-center mb-4 border border-[#d7e3da]"><Landmark size={20} strokeWidth={1.8} /></div>
                      <h4 className="font-bold text-lg text-slate-800 mb-2">Relatório Financeiro</h4>
                      <p className="text-xs text-slate-500 mb-6">Gera um PDF contendo entradas de mensalidades, saídas manuais e o saldo detalhado do caixa.</p>

                      <label className="text-xs font-semibold text-slate-600 ml-1 mb-1 block">Filtrar por Período</label>
                      <select value={finPeriodo} onChange={(e) => setFinPeriodo(e.target.value)} className={`${inputClass} mb-4`}>
                        <option value="7">Últimos 7 dias</option>
                        <option value="30">Últimos 30 dias</option>
                        <option value="60">Últimos 60 dias</option>
                        <option value="90">Últimos 90 dias</option>
                        <option value="tudo">Todo o Período</option>
                        <option value="personalizado">Período Personalizado</option>
                      </select>

                      <AnimatePresence>
                        {finPeriodo === 'personalizado' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-3 mb-4">
                            <div><label className="text-[10px] font-semibold text-slate-600 ml-1">Início</label><input type="date" value={finDataInicio} onChange={e => setFinDataInicio(e.target.value)} className={`${inputClass} !p-2 !text-xs`} /></div>
                            <div><label className="text-[10px] font-semibold text-slate-600 ml-1">Fim</label><input type="date" value={finDataFim} onChange={e => setFinDataFim(e.target.value)} className={`${inputClass} !p-2 !text-xs`} /></div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.button 
                      whileTap={{ scale: 0.95 }} 
                      onClick={handleGerarRelatorioFinanceiro} 
                      disabled={gerandoRelatorio}
                      className="w-full py-3.5 bg-[#1f4a3a] text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-[#173c2e] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                    >
                      {!gerandoRelatorio && <Download size={16} />}
                      {gerandoRelatorio ? 'Gerando PDF...' : 'Baixar relatório'}
                    </motion.button>
                  </div>

                  {/* CARD ALUNOS ATIVOS */}
                  <div className="bg-white/60 backdrop-blur-sm border border-white/80 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-4 border border-emerald-100"><UserCheck size={20} strokeWidth={1.8} /></div>
                      <h4 className="font-bold text-lg text-slate-800 mb-2">Alunos Ativos</h4>
                      <p className="text-xs text-slate-500 mb-6">Lista completa com nome, telefone, curso, data da matrícula e valor da mensalidade de todos os alunos que estão ativos na escola.</p>
                    </div>

                    <motion.button 
                      whileTap={{ scale: 0.95 }} 
                      onClick={() => handleGerarRelatorioAlunos('Ativo')} 
                      disabled={gerandoRelatorio}
                      className="w-full py-3.5 bg-[#1f4a3a] text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-[#173c2e] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                    >
                      {!gerandoRelatorio && <Download size={16} />}
                      {gerandoRelatorio ? 'Gerando PDF...' : 'Baixar relatório'}
                    </motion.button>
                  </div>

                  {/* CARD ALUNOS INATIVOS */}
                  <div className="bg-white/60 backdrop-blur-sm border border-white/80 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 bg-rose-50 text-rose-700 rounded-xl flex items-center justify-center mb-4 border border-rose-100"><UserX size={20} strokeWidth={1.8} /></div>
                      <h4 className="font-bold text-lg text-slate-800 mb-2">Alunos Inativos</h4>
                      <p className="text-xs text-slate-500 mb-6">Lista dos alunos que cancelaram ou foram trancados, informando os dados básicos e a exata data da inativação.</p>
                    </div>

                    <motion.button 
                      whileTap={{ scale: 0.95 }} 
                      onClick={() => handleGerarRelatorioAlunos('Inativo')} 
                      disabled={gerandoRelatorio}
                      className="w-full py-3.5 bg-[#1f4a3a] text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-[#173c2e] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                    >
                      {!gerandoRelatorio && <Download size={16} />}
                      {gerandoRelatorio ? 'Gerando PDF...' : 'Baixar relatório'}
                    </motion.button>
                  </div>

                </div>

              </div>
        </motion.section>
        )}

      </div>

      {/* MODAL GIGANTE DE EQUIPE (EDIÇÃO E CRIAÇÃO) */}
      <AnimatePresence>
        {showModalProf && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative overflow-y-auto max-h-[90vh] custom-scrollbar`}>
              
              <div className="flex justify-between items-center mb-8">
                <h2 className={`text-2xl font-bold text-slate-800 flex items-center gap-3 drop-shadow-sm`}>
                  <span className="text-indigo-500">✍️</span> {profForm.id ? 'Editar Ficha do Membro' : 'Novo Membro da Equipe'}
                </h2>
                {profForm.id && (
                   <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleExcluirMembro(profForm.id)} className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white font-bold text-[10px] uppercase transition-all shadow-sm">🗑️ Excluir Membro</motion.button>
                )}
              </div>

              <form onSubmit={handleSalvarProfessor} className="space-y-8">
                
                {/* FOTO */}
                <div className="flex justify-center mb-6">
                  <label htmlFor="prof-foto-upload" className="cursor-pointer group flex flex-col items-center gap-2">
                    <div className={`relative w-28 h-28 rounded-full border-4 border-indigo-100 bg-white/50 shadow-md overflow-hidden flex items-center justify-center transition-all group-hover:border-indigo-300`}>
                      {fotoPreviewProf ? <img src={fotoPreviewProf} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-4xl opacity-40">📷</span>}
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10"><span className="text-white text-[9px] font-bold uppercase tracking-widest text-center px-2">Alterar<br/>Foto</span></div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest group-hover:underline mt-1">Adicionar Foto</span>
                    <input id="prof-foto-upload" type="file" accept="image/*" className="hidden" onChange={handleProfFileChange} />
                  </label>
                </div>

                {/* DADOS DE ACESSO */}
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider border-b text-indigo-600 border-indigo-500/10 pb-2">Sistema / Permissões</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="text-xs font-semibold text-slate-600 ml-1 block mb-1">Cargo / Permissão</label>
                      <select required value={profForm.role} onChange={e => setProfForm({...profForm, role: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm outline-none shadow-sm transition-all ${profForm.role === 'ADMIN' ? 'text-rose-700 bg-rose-50 border-rose-200 focus:ring-4 focus:ring-rose-500/10' : 'text-indigo-700 bg-indigo-50 border-indigo-200 focus:ring-4 focus:ring-indigo-500/10'}`}>
                        <option value="PROFESSOR">👨‍🏫 PROFESSOR</option>
                        <option value="ADMIN">👑 DIRETOR / ADMIN</option>
                      </select>
                    </div>
                    {!profForm.id && (
                      <>
                        <div><label className="text-xs font-semibold text-slate-600 ml-1 block mb-1">E-mail de Login</label><input required type="email" value={profForm.email} onChange={e => setProfForm({...profForm, email: e.target.value})} className={inputClass} /></div>
                        <div><label className="text-xs font-semibold text-slate-600 ml-1 block mb-1">Senha de Login</label><input required minLength={6} type="password" value={profForm.senha} onChange={e => setProfForm({...profForm, senha: e.target.value})} className={inputClass} /></div>
                      </>
                    )}
                    {profForm.id && (
                       <div className="md:col-span-2 flex items-center text-[11px] font-medium text-rose-500 bg-rose-50/50 border border-rose-100 p-4 rounded-xl">
                         Atenção: E-mail de login e senha não podem ser alterados por aqui após a criação. O membro deve usar "Esqueci minha senha" na tela inicial.
                       </div>
                    )}
                  </div>
                </div>

                {/* DADOS PESSOAIS */}
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider border-b text-indigo-600 border-indigo-500/10 pb-2">Dados Pessoais</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input placeholder="Nome Completo" required value={profForm.nome_completo} onChange={e => setProfForm({...profForm, nome_completo: e.target.value})} className={`md:col-span-2 ${inputClass}`} />
                    <div><label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Data Nasc.</label><input type="date" value={profForm.data_nascimento} onChange={e => setProfForm({...profForm, data_nascimento: e.target.value})} className={`${inputClass} !mt-0`} /></div>
                    <input placeholder="CPF" value={profForm.cpf} onChange={e => setProfForm({...profForm, cpf: formatCPF(e.target.value)})} maxLength={14} className={inputClass} />
                    <input placeholder="WhatsApp / Telefone" value={profForm.telefone} onChange={e => setProfForm({...profForm, telefone: formatPhone(e.target.value)})} maxLength={15} className={inputClass} />
                  </div>
                </div>

                {/* ENDEREÇO */}
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider border-b text-indigo-600 border-indigo-500/10 pb-2">Endereço</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <input placeholder="CEP" value={profForm.cep} onChange={handleProfCepChange} maxLength={9} className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Endereço / Rua" value={profForm.endereco} onChange={e => setProfForm({...profForm, endereco: e.target.value})} className={`col-span-2 md:col-span-2 ${inputClass}`} />
                    <input id="prof-numero" placeholder="Número" value={profForm.numero} onChange={e => setProfForm({...profForm, numero: e.target.value})} className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Complemento" value={profForm.complemento} onChange={e => setProfForm({...profForm, complemento: e.target.value})} className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Bairro" value={profForm.bairro} onChange={e => setProfForm({...profForm, bairro: e.target.value})} className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Cidade" value={profForm.cidade} onChange={e => setProfForm({...profForm, cidade: e.target.value})} className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="UF" value={profForm.estado} onChange={e => setProfForm({...profForm, estado: e.target.value})} maxLength={2} className={`col-span-2 md:col-span-1 uppercase ${inputClass}`} />
                  </div>
                </div>

                {/* MODALIDADES DO PROFESSOR OU ADMIN */}
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider border-b text-indigo-600 border-indigo-500/10 pb-2">Cursos que Leciona (Modalidades)</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {modalidades.map(m => (
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        key={m.id} 
                        type="button" 
                        onClick={() => toggleModalidadeProf(m.nome)}
                        className={`px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase border transition-all shadow-sm ${profForm.modalidades.includes(m.nome) ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border-transparent shadow-md scale-105' : `bg-white/60 border-white/80 text-slate-600 hover:bg-white`}`}
                      >
                        {profForm.modalidades.includes(m.nome) && <span className="mr-2">✓</span>} {m.nome}
                      </motion.button>
                    ))}
                    {modalidades.length === 0 && <p className="text-xs font-medium italic text-slate-500">Nenhuma modalidade cadastrada na escola.</p>}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/60">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setShowModalProf(false)} disabled={isSubmitting} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white disabled:opacity-50`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSubmitting} className="px-10 py-4 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-500 transition-all disabled:opacity-50">
                    {isSubmitting ? 'Salvando...' : '💾 Salvar Ficha Completa'}
                  </motion.button>
                </div>

              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CROPPER DO PROFESSOR */}
      <AnimatePresence>
        {showCropModalProf && imageToCropProf && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col items-center`}>
              <h3 className="text-xl font-bold tracking-tight mb-6 text-slate-800">Ajustar Foto da Equipe</h3>
              <div className="relative w-full h-64 bg-slate-900/5 backdrop-blur-inner rounded-2xl overflow-hidden mb-6 shadow-inner">
                <Cropper image={imageToCropProf} crop={cropProf} zoom={zoomProf} aspect={1} cropShape="round" showGrid={false} onCropChange={setCropProf} onCropComplete={(cA, cAP) => setCroppedAreaPixelsProf(cAP)} onZoomChange={setZoomProf} />
              </div>
              <div className="w-full mb-8">
                <label className="text-xs font-semibold text-slate-500 block mb-2 text-center">Zoom da Imagem</label>
                <input type="range" min={1} max={3} step={0.1} value={zoomProf} onChange={(e) => setZoomProf(Number(e.target.value))} className="w-full accent-indigo-500" />
              </div>
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCropModalProf(false)} className={`flex-1 py-4 rounded-2xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white`}>Cancelar</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleConfirmCropProf} className="flex-1 py-4 rounded-2xl font-bold text-sm bg-indigo-600 text-white shadow-md hover:bg-indigo-500 transition-all">Cortar & Salvar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
