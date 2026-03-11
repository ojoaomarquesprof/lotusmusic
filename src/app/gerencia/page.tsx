"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import Cropper from 'react-easy-crop'
import { motion, AnimatePresence } from 'framer-motion'

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

  const [activeTab, setActiveTab] = useState('Escola')
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
  const [dispDia, setDispDia] = useState('Segunda')
  const [dispInicio, setDispInicio] = useState('08:00')
  const [dispFim, setDispFim] = useState('22:00')
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
  const [imageToCropProf, setImageToCropProf] = useState<string | null>(null)
  const [cropProf, setCropProf] = useState({ x: 0, y: 0 })
  const [zoomProf, setZoomProf] = useState(1)
  const [croppedAreaPixelsProf, setCroppedAreaPixelsProf] = useState<any>(null)
  const [editFotoArquivoProf, setEditFotoArquivoProf] = useState<File | null>(null)
  const [fotoPreviewProf, setFotoPreviewProf] = useState<string | null>(null)

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
    
    // 🔥 TRAZEMOS TUDO DA AGENDA + O PERFIL DO ALUNO COM AS INFO DE INATIVIDADE
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

  // 🔥 O RASTREADOR IMPLACÁVEL BLINDADO
  const getOcupante = (disp: any) => {
    const hojeStr = new Date().toISOString().split('T')[0];

    // Procura na tabela 'agenda' se existe um horário marcado EXATAMENTE igual
    return matriculasProf.find(m => {
      const diaAgenda = String(m.dia || '').trim().toLowerCase()
      const diaGrade = String(disp.dia_semana || '').trim().toLowerCase()
      
      const horaAgenda = String(m.horario_inicio || '').slice(0, 5)
      const horaGrade = String(disp.hora_inicio || '').slice(0, 5)

      if (diaAgenda === diaGrade && horaAgenda === horaGrade) {
        const info = Array.isArray(m.aluno?.alunos_info) ? m.aluno?.alunos_info[0] : m.aluno?.alunos_info;
        
        if (!info) return true; // Se não tem informações, assume ocupado por segurança
        
        if (info.status === 'Inativo') {
          if (!info.data_inativacao) return false; // Tá inativo e não tem data? Libera a vaga!
          if (hojeStr > info.data_inativacao) return false; // A data de saída já passou? Libera a vaga!
        }
        
        return true; // Tá ocupado!
      }
      return false;
    });
  }

  const handleGerarDisponibilidade = async () => {
    if (!selectedProfId) return alert("Selecione um professor primeiro.")
    setIsSubmitting(true)

    const startMin = parseInt(dispInicio.split(':')[0]) * 60 + parseInt(dispInicio.split(':')[1])
    const endMin = parseInt(dispFim.split(':')[0]) * 60 + parseInt(dispFim.split(':')[1])
    const lunchStartMin = temAlmoco ? parseInt(almocoInicio.split(':')[0]) * 60 + parseInt(almocoInicio.split(':')[1]) : 0
    const lunchEndMin = temAlmoco ? parseInt(almocoFim.split(':')[0]) * 60 + parseInt(almocoFim.split(':')[1]) : 0

    const slotsToInsert = []
    let currentMin = startMin

    while (currentMin + 60 <= endMin) { 
      const slotStart = currentMin
      const slotEnd = currentMin + 60
      let isLunch = false
      if (temAlmoco && ((slotStart >= lunchStartMin && slotStart < lunchEndMin) || (slotEnd > lunchStartMin && slotEnd <= lunchEndMin))) isLunch = true

      if (!isLunch) {
        const hStart = String(Math.floor(slotStart / 60)).padStart(2, '0') + ':' + String(slotStart % 60).padStart(2, '0')
        const hEnd = String(Math.floor(slotEnd / 60)).padStart(2, '0') + ':' + String(slotEnd % 60).padStart(2, '0')
        const exists = disponibilidades.some(d => d.dia_semana === dispDia && d.hora_inicio === hStart)
        if (!exists) slotsToInsert.push({ professor_id: selectedProfId, dia_semana: dispDia, hora_inicio: hStart, hora_fim: hEnd })
      }
      currentMin += 60 
    }

    if (slotsToInsert.length > 0) {
      await supabase.from('disponibilidade_professor').insert(slotsToInsert)
      alert(`✅ ${slotsToInsert.length} horários criados na grade!`)
      carregarDisponibilidadeProf(selectedProfId)
    } else {
      alert("⚠️ Nenhum horário gerado. Verifique os horários e se já não existem.")
    }
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
    if (!confirm(`🚨 Apagar TODOS os horários de ${dia}? As vagas que já estão com matrículas cadastradas vão ficar órfãs se você prosseguir.`)) return; 
    setIsSubmitting(true); 
    await supabase.from('disponibilidade_professor').delete().eq('professor_id', selectedProfId).eq('dia_semana', dia); 
    carregarDisponibilidadeProf(selectedProfId); 
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

  const inputClass = "w-full p-3.5 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-medium focus:bg-white/80 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none shadow-inner placeholder:text-slate-400 mt-1";

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-12 w-full relative">
      
      {/* CABEÇALHO */}
      <motion.div variants={itemVariants} className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Gerência e Setup</h2>
        <p className={`text-slate-500 text-sm mt-1`}>Configurações Avançadas do Sistema</p>
      </motion.div>

      {/* ABAS COM EFEITO DE VIDRO/LINHA */}
      <motion.div variants={itemVariants} className="flex gap-8 border-b border-slate-200/50 mb-8 overflow-x-auto custom-scrollbar">
        {[
          { id: 'Escola', icon: '🏫', label: 'Dados da Escola' },
          { id: 'Estrutura', icon: '📍', label: 'Salas & Cursos' },
          { id: 'Equipe', icon: '🧑‍🏫', label: 'Equipe & Profs' },
          { id: 'Horarios', icon: '⏰', label: 'Motor de Horários' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`pb-4 text-sm font-bold tracking-tight transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </motion.div>

      <div>
        
        {/* ABA ESCOLA */}
        <AnimatePresence mode="wait">
          {activeTab === 'Escola' && (
            <motion.div key="Escola" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <form onSubmit={handleSalvarConfig} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
                
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
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isSubmitting} className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                    {isSubmitting ? 'Salvando...' : '💾 Salvar Configurações da Escola'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ABA ESTRUTURA */}
          {activeTab === 'Estrutura' && (
            <motion.div key="Estrutura" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
                <h3 className="text-xl font-bold tracking-tight text-slate-800 mb-8 flex items-center gap-3"><span className="text-rose-500 drop-shadow-sm">📍</span> Salas Físicas</h3>
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

              <div className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
                <h3 className="text-xl font-bold tracking-tight text-slate-800 mb-8 flex items-center gap-3"><span className="text-emerald-500 drop-shadow-sm">🎸</span> Modalidades / Cursos</h3>
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

            </motion.div>
          )}

          {/* ABA EQUIPE E PROFS */}
          {activeTab === 'Equipe' && (
            <motion.div key="Equipe" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <div className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/60 pb-6">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-3"><span className="text-indigo-500 drop-shadow-sm">🧑‍🏫</span> Equipe Lótus</h3>
                    <p className={`text-slate-500 text-sm mt-1`}>Gerencie os dados, fotos e acessos de Professores e Administradores.</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => abrirModalEquipe()} className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white px-6 py-4 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all whitespace-nowrap">
                    + Adicionar Novo Membro
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
            </motion.div>
          )}

          {/* ABA HORÁRIOS */}
          {activeTab === 'Horarios' && (
            <motion.div key="Horarios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <div className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 md:p-10 rounded-[2.5rem] border-t-8 border-t-amber-500 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col`}>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-white/60 pb-6">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><span className="text-amber-500 drop-shadow-sm">⏰</span> Motor de Disponibilidade</h3>
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
            </motion.div>
          )}
        </AnimatePresence>

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