"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import Cropper from 'react-easy-crop'

// --- FUNÇÕES DE MÁSCARA E CROPPER ---
const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15)
const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14)
const formatCEP = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9)
const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<File | null> => { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return null; canvas.width = 256; canvas.height = 256; ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 256, 256); return new Promise(resolve => canvas.toBlob(blob => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.9)) }

export default function Gerencia() {
  const { s } = useStyles()
  const router = useRouter()
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
    modalidades: [] as string[] // 👇 NOVO ESTADO AQUI
  })
  const [showCropModalProf, setShowCropModalProf] = useState(false)
  const [imageToCropProf, setImageToCropProf] = useState<string | null>(null)
  const [cropProf, setCropProf] = useState({ x: 0, y: 0 })
  const [zoomProf, setZoomProf] = useState(1)
  const [croppedAreaPixelsProf, setCroppedAreaPixelsProf] = useState<any>(null)
  const [editFotoArquivoProf, setEditFotoArquivoProf] = useState<File | null>(null)
  const [fotoPreviewProf, setFotoPreviewProf] = useState<string | null>(null)

  useEffect(() => { carregarTudo() }, [])
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

  // --- FUNÇÕES DE ESTRUTURA (SALAS E MODALIDADES) ---
  const handleAddSala = async (e: React.FormEvent) => { e.preventDefault(); if (!novaSala) return; await supabase.from('salas').insert([{ nome: novaSala }]); setNovaSala(''); carregarTudo() }
  const handleDelSala = async (id: string) => { if (!confirm("Deletar esta sala?")) return; await supabase.from('salas').delete().eq('id', id); carregarTudo() }
  const handleAddModalidade = async (e: React.FormEvent) => { e.preventDefault(); if (!novaModalidade) return; await supabase.from('modalidades').insert([{ nome: novaModalidade }]); setNovaModalidade(''); carregarTudo() }
  const handleDelModalidade = async (id: string) => { if (!confirm("Deletar esta modalidade?")) return; await supabase.from('modalidades').delete().eq('id', id); carregarTudo() }

  // --- FUNÇÕES DO MOTOR DE HORÁRIOS ---
  async function carregarDisponibilidadeProf(id: string) {
    const { data } = await supabase.from('disponibilidade_professor').select('*').eq('professor_id', id)
    const ordemDias: Record<string, number> = { 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }
    const ordenado = (data || []).sort((a: any, b: any) => {
      if (ordemDias[a.dia_semana] !== ordemDias[b.dia_semana]) return ordemDias[a.dia_semana] - ordemDias[b.dia_semana]
      return a.hora_inicio.localeCompare(b.hora_inicio)
    })
    setDisponibilidades(ordenado)
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

  const handleDelDisponibilidade = async (id: string) => { if (!confirm("Excluir este horário?")) return; await supabase.from('disponibilidade_professor').delete().eq('id', id); carregarDisponibilidadeProf(selectedProfId) }
  const handleLimparDia = async (dia: string) => { if (!confirm(`🚨 Apagar TODOS os horários livres de ${dia}?`)) return; setIsSubmitting(true); await supabase.from('disponibilidade_professor').delete().eq('professor_id', selectedProfId).eq('dia_semana', dia); carregarDisponibilidadeProf(selectedProfId); setIsSubmitting(false) }

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

  // 👇 FUNÇÃO DE TOGGLE PARA AS MODALIDADES DO PROFESSOR
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
      const fileName = `equipe/${Date.now()}-${crypto.randomUUID()}.jpg`; 
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, editFotoArquivoProf); 
      if (!uploadError) finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl 
    }

    if (profForm.id) {
      const { error } = await supabase.from('profiles').update({ 
        nome_completo: profForm.nome_completo, role: profForm.role, telefone: profForm.telefone, 
        cpf: profForm.cpf, data_nascimento: profForm.data_nascimento || null, cep: profForm.cep, 
        endereco: profForm.endereco, numero: profForm.numero, complemento: profForm.complemento, 
        bairro: profForm.bairro, cidade: profForm.cidade, estado: profForm.estado, avatar_url: finalAvatarUrl,
        modalidades: profForm.modalidades // 👇 SALVANDO MODALIDADES
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
        modalidades: prof.modalidades || [] // 👇 CARREGANDO MODALIDADES
      })
      setFotoPreviewProf(prof.avatar_url || null)
    } else {
      setProfForm({ 
        id: '', nome_completo: '', email: '', senha: '', role: 'PROFESSOR', telefone: '', cpf: '', data_nascimento: '', 
        cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', avatar_url: '',
        modalidades: [] // 👇 INICIANDO VAZIO
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

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <div className="animate-in fade-in duration-500 pb-12 w-full relative">
      
      <div className="mb-8">
        <h2 className="text-3xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Gerência e Setup</h2>
        <p className={`${s.textMuted} text-sm font-bold uppercase tracking-widest mt-1`}>Configurações Avançadas do Sistema</p>
      </div>

      <div className="flex gap-8 border-b-2 border-slate-500/10 mb-8 overflow-x-auto custom-scrollbar">
        <button onClick={() => setActiveTab('Escola')} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'Escola' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          🏫 Dados da Escola
        </button>
        <button onClick={() => setActiveTab('Estrutura')} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'Estrutura' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          📍 Salas & Cursos
        </button>
        <button onClick={() => setActiveTab('Equipe')} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'Equipe' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          🧑‍🏫 Equipe & Profs
        </button>
        <button onClick={() => setActiveTab('Horarios')} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'Horarios' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          ⏰ Motor de Horários
        </button>
      </div>

      <div>
        
        {/* ABA ESCOLA */}
        {activeTab === 'Escola' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleSalvarConfig} className={`${s.card} p-8 md:p-10 rounded-[2.5rem] border shadow-xl`}>
              
              <div className="flex flex-col xl:flex-row gap-12 mb-10">
                <div className="flex flex-col gap-6 shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-500/20 pb-2">Identidade Visual</p>
                  <div>
                    <label className="text-[10px] font-bold uppercase opacity-50 ml-1 block mb-2">Logo Principal</label>
                    <label className="cursor-pointer group flex flex-col items-center justify-center w-56 h-32 rounded-2xl border-2 border-dashed border-indigo-500/30 hover:border-indigo-500 transition-all bg-slate-500/5 relative overflow-hidden">
                      {logoPreview ? <img src={logoPreview} className="h-full object-contain p-2" /> : <span className="text-xs font-bold text-indigo-500/50 uppercase">Logo PNG</span>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])) } }} />
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase opacity-50 ml-1 block mb-2">Favicon (Ícone Menor)</label>
                    <label className="cursor-pointer group flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-indigo-500/30 hover:border-indigo-500 transition-all bg-slate-500/5 relative overflow-hidden">
                      {faviconPreview ? <img src={faviconPreview} className="h-full object-contain p-2" /> : <span className="text-4xl opacity-30">🌐</span>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setFaviconFile(e.target.files[0]); setFaviconPreview(URL.createObjectURL(e.target.files[0])) } }} />
                    </label>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-500/20 pb-2">Informações Cadastrais</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="text-[10px] font-black uppercase opacity-50 ml-1">Nome de Exibição no App</label><input value={config.nome_escola || ''} onChange={e => setConfig({...config, nome_escola: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                    <div><label className="text-[10px] font-black uppercase opacity-50 ml-1">CNPJ</label><input value={config.cnpj || ''} onChange={e => setConfig({...config, cnpj: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                    <div><label className="text-[10px] font-black uppercase opacity-50 ml-1">Telefone / WhatsApp</label><input value={config.telefone || ''} onChange={e => setConfig({...config, telefone: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                    <div><label className="text-[10px] font-black uppercase opacity-50 ml-1">Chave PIX (Para Recebimentos)</label><input value={config.chave_pix || ''} onChange={e => setConfig({...config, chave_pix: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-indigo-500/20 pb-2">Endereço Físico da Escola</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black uppercase opacity-50 ml-1">CEP</label><input value={config.cep || ''} onChange={handleCepChange} maxLength={9} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                  <div className="col-span-2 md:col-span-2"><label className="text-[10px] font-black uppercase opacity-50 ml-1">Endereço / Rua</label><input value={config.endereco || ''} onChange={e => setConfig({...config, endereco: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black uppercase opacity-50 ml-1">Número</label><input id="escola-numero" value={config.numero || ''} onChange={e => setConfig({...config, numero: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black uppercase opacity-50 ml-1">Complemento</label><input value={config.complemento || ''} onChange={e => setConfig({...config, complemento: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black uppercase opacity-50 ml-1">Bairro</label><input value={config.bairro || ''} onChange={e => setConfig({...config, bairro: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black uppercase opacity-50 ml-1">Cidade</label><input value={config.cidade || ''} onChange={e => setConfig({...config, cidade: e.target.value})} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 ${s.input}`} /></div>
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black uppercase opacity-50 ml-1">UF</label><input value={config.estado || ''} onChange={e => setConfig({...config, estado: e.target.value})} maxLength={2} className={`w-full p-4 rounded-xl border text-sm font-bold mt-1 uppercase ${s.input}`} /></div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-500/10 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-500/30 hover:scale-105 transition-all">
                  💾 Salvar Configurações da Escola
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ABA ESTRUTURA */}
        {activeTab === 'Estrutura' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className={`${s.card} p-8 md:p-10 rounded-[2.5rem] border shadow-xl`}>
              <h3 className="text-2xl font-black uppercase mb-8 flex items-center gap-3"><span className="text-rose-500">📍</span> Salas Físicas</h3>
              <form onSubmit={handleAddSala} className="flex gap-4 mb-8">
                <input value={novaSala} onChange={e => setNovaSala(e.target.value)} placeholder="Nova Sala (Ex: Sala 01)" className={`flex-1 p-4 rounded-xl border text-sm font-bold ${s.input}`} />
                <button type="submit" className="bg-rose-500 text-white px-8 rounded-xl font-black text-xl shadow-lg hover:bg-rose-600 transition-colors">+</button>
              </form>
              <div className="flex flex-wrap gap-3">
                {salas.length === 0 ? <p className="text-sm opacity-50 font-bold italic">Nenhuma sala cadastrada.</p> : salas.map(sl => (
                  <div key={sl.id} className={`${s.cardInterno} border px-5 py-3 rounded-xl flex items-center gap-4 text-sm font-black shadow-sm group hover:border-rose-500/30 transition-all`}>
                    {sl.nome} <button onClick={() => handleDelSala(sl.id)} className="text-rose-500 opacity-20 group-hover:opacity-100 hover:bg-rose-500 hover:text-white h-7 w-7 rounded-full flex items-center justify-center transition-all">✖</button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${s.card} p-8 md:p-10 rounded-[2.5rem] border shadow-xl`}>
              <h3 className="text-2xl font-black uppercase mb-8 flex items-center gap-3"><span className="text-emerald-500">🎸</span> Modalidades / Cursos</h3>
              <form onSubmit={handleAddModalidade} className="flex gap-4 mb-8">
                <input value={novaModalidade} onChange={e => setNovaModalidade(e.target.value)} placeholder="Novo Curso (Ex: Piano)" className={`flex-1 p-4 rounded-xl border text-sm font-bold ${s.input}`} />
                <button type="submit" className="bg-emerald-500 text-white px-8 rounded-xl font-black text-xl shadow-lg hover:bg-emerald-600 transition-colors">+</button>
              </form>
              <div className="flex flex-wrap gap-3">
                {modalidades.length === 0 ? <p className="text-sm opacity-50 font-bold italic">Nenhuma modalidade cadastrada.</p> : modalidades.map(m => (
                  <div key={m.id} className={`${s.cardInterno} border px-5 py-3 rounded-xl flex items-center gap-4 text-sm font-black shadow-sm group hover:border-emerald-500/30 transition-all`}>
                    {m.nome} <button onClick={() => handleDelModalidade(m.id)} className="text-emerald-600 opacity-20 group-hover:opacity-100 hover:bg-emerald-500 hover:text-white h-7 w-7 rounded-full flex items-center justify-center transition-all">✖</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA EQUIPE E PROFS */}
        {activeTab === 'Equipe' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`${s.card} p-8 md:p-10 rounded-[2.5rem] border shadow-xl`}>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-500/10 pb-6">
                <div>
                  <h3 className="text-3xl font-black uppercase flex items-center gap-3"><span className="text-indigo-500">🧑‍🏫</span> Equipe Lótus</h3>
                  <p className={`${s.textMuted} text-sm font-bold mt-1`}>Gerencie os dados, fotos e acessos de Professores e Administradores.</p>
                </div>
                <button onClick={() => abrirModalEquipe()} className="bg-indigo-600 text-white px-6 py-4 rounded-xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all whitespace-nowrap">
                  + Adicionar Novo Membro
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {professores.map(p => (
                  <div key={p.id} className={`${s.cardInterno} p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between group hover:border-indigo-500/30 transition-all`}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xl font-black text-white shadow-md border-2 border-white/10 overflow-hidden flex-shrink-0">
                        {p.avatar_url ? <img src={p.avatar_url} alt="Foto" className="w-full h-full object-cover" /> : p.nome_completo?.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-black text-sm uppercase text-slate-800 line-clamp-1">{p.nome_completo}</p>
                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-widest mt-1 inline-block ${p.role === 'ADMIN' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>{p.role}</span>
                      </div>
                    </div>
                    {/* 👇 Exibindo as modalidades no card do professor */}
                    {p.modalidades && p.modalidades.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[9px] font-black uppercase text-indigo-500 mb-1">Cursos:</p>
                        <div className="flex flex-wrap gap-1">
                          {p.modalidades.map((m: string) => (
                            <span key={m} className="text-[8px] bg-slate-500/10 text-slate-600 px-2 py-1 rounded font-bold uppercase">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 border-t border-slate-500/10 pt-4 mt-auto">
                      <button onClick={() => abrirModalEquipe(p)} className="flex-1 py-3 rounded-xl bg-slate-500/5 border border-slate-500/10 text-[10px] font-black uppercase hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-all">
                        ⚙️ Editar Ficha
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* ABA HORÁRIOS */}
        {activeTab === 'Horarios' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`${s.card} p-8 md:p-10 rounded-[2.5rem] border border-t-8 border-t-amber-500 shadow-xl flex flex-col`}>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-slate-500/10 pb-6">
                <div>
                  <h3 className="text-3xl font-black uppercase italic text-amber-500">⏰ Motor de Disponibilidade</h3>
                  <p className={`${s.textMuted} text-sm font-bold mt-2 max-w-2xl`}>Gere múltiplos horários de uma vez. O aplicativo do aluno vai cruzar essas "vagas" com a Grade Real para mostrar apenas os horários livres no calendário.</p>
                </div>
                <div className="w-full md:w-80">
                  <label className="text-[10px] font-black uppercase text-amber-600 tracking-widest ml-1 mb-2 block">1. Escolha o Professor</label>
                  <select value={selectedProfId} onChange={e => setSelectedProfId(e.target.value)} className={`w-full p-4 rounded-xl border-2 border-amber-500/20 bg-amber-500/5 font-black text-sm text-slate-800 outline-none`}>
                    <option value="">Selecione...</option>
                    {professores.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                  </select>
                </div>
              </div>

              {!selectedProfId ? (
                <div className="flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-slate-500/30 rounded-[2rem] p-24 text-center">
                  <span className="text-7xl mb-6 grayscale">🧑‍🏫</span>
                  <p className="font-black uppercase text-2xl">Professor não selecionado</p>
                  <p className="font-bold text-sm mt-2">Escolha no menu acima para liberar a geração de grade.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                  
                  <div className="xl:col-span-1 bg-slate-500/5 p-8 rounded-[2rem] border border-slate-500/10 h-fit">
                    <h4 className="text-sm font-black uppercase tracking-widest mb-6 opacity-60">2. Parâmetros de Geração</h4>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-bold opacity-50 ml-1 uppercase">Dia da Semana</label>
                        <select value={dispDia} onChange={e => setDispDia(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-black ${s.input}`}>
                          {dias.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold opacity-50 ml-1 uppercase text-indigo-500">Entra (Ex: 08:00)</label><input type="time" value={dispInicio} onChange={e => setDispInicio(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-black border-indigo-500/30 ${s.input}`} /></div>
                        <div><label className="text-[10px] font-bold opacity-50 ml-1 uppercase text-indigo-500">Sai (Ex: 22:00)</label><input type="time" value={dispFim} onChange={e => setDispFim(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-black border-indigo-500/30 ${s.input}`} /></div>
                      </div>
                      
                      <div className="p-5 border border-slate-500/20 rounded-2xl bg-white">
                        <label className="flex items-center gap-3 cursor-pointer mb-5">
                          <input type="checkbox" checked={temAlmoco} onChange={e => setTemAlmoco(e.target.checked)} className="w-6 h-6 accent-amber-500" />
                          <span className="text-[11px] font-black uppercase tracking-widest">Pausa para Almoço?</span>
                        </label>
                        {temAlmoco && (
                          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                            <div><label className="text-[10px] font-bold opacity-50 ml-1 uppercase text-amber-600">Início da Pausa</label><input type="time" value={almocoInicio} onChange={e => setAlmocoInicio(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-black border-amber-500/30 ${s.input}`} /></div>
                            <div><label className="text-[10px] font-bold opacity-50 ml-1 uppercase text-amber-600">Fim da Pausa</label><input type="time" value={almocoFim} onChange={e => setAlmocoFim(e.target.value)} className={`w-full p-4 rounded-xl border text-sm font-black border-amber-500/30 ${s.input}`} /></div>
                          </div>
                        )}
                      </div>
                      
                      <button onClick={handleGerarDisponibilidade} disabled={isSubmitting} className="w-full py-5 bg-amber-500 text-slate-900 rounded-2xl font-black uppercase text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.02] transition-all">
                        ⚡ Gerar Lote de Horários
                      </button>
                    </div>
                  </div>

                  <div className="xl:col-span-2 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-500/10 pb-4">
                      <h4 className="text-sm font-black uppercase tracking-widest opacity-60">
                        3. Horários Disponíveis ({disponibilidades.length})
                      </h4>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {dias.map(d => {
                          const hasSlots = disponibilidades.some(x => x.dia_semana === d);
                          if (!hasSlots) return null;
                          return (
                            <button key={d} onClick={() => handleLimparDia(d)} className="text-[9px] font-black uppercase bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm" title={`Apagar todos de ${d}`}>
                              Limpar {d}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[600px] space-y-3">
                      {disponibilidades.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-slate-500/20 rounded-3xl p-10 text-center min-h-[300px]">
                          <span className="text-5xl mb-4">📭</span>
                          <p className="font-black uppercase text-sm">Nenhum horário gerado.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {disponibilidades.map(disp => (
                            <div key={disp.id} className={`${s.cardInterno} p-5 rounded-2xl border-l-4 border-l-amber-500 border flex justify-between items-center group shadow-sm hover:shadow-md transition-all`}>
                              <div>
                                <p className="font-black text-xs uppercase text-amber-600 mb-0.5">{disp.dia_semana}</p>
                                <p className="text-base font-black text-slate-800 tracking-tight">{disp.hora_inicio.slice(0,5)} <span className="opacity-50 text-[10px] font-bold">- {disp.hora_fim.slice(0,5)}</span></p>
                              </div>
                              <button onClick={() => handleDelDisponibilidade(disp.id)} className="h-10 w-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                ✖
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL GIGANTE DE EQUIPE (EDIÇÃO E CRIAÇÃO) */}
      {showModalProf && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className={`${s.card} border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative overflow-y-auto max-h-[90vh] custom-scrollbar`}>
            
            <div className="flex justify-between items-center mb-8">
              <h2 className={`text-3xl font-black ${s.text} uppercase italic flex items-center gap-3`}>
                <span className="text-indigo-500">✍️</span> {profForm.id ? 'Editar Ficha do Membro' : 'Novo Membro da Equipe'}
              </h2>
              {profForm.id && (
                 <button onClick={() => handleExcluirMembro(profForm.id)} className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-black text-[10px] uppercase transition-all">🗑️ Excluir Membro</button>
              )}
            </div>

            <form onSubmit={handleSalvarProfessor} className="space-y-8">
              
              {/* FOTO */}
              <div className="flex justify-center mb-6">
                <label htmlFor="prof-foto-upload" className="cursor-pointer group flex flex-col items-center gap-2">
                  <div className={`relative w-28 h-28 rounded-full border-4 border-indigo-500/20 shadow-lg overflow-hidden flex items-center justify-center transition-all group-hover:border-indigo-500 ${s.cardInterno}`}>
                    {fotoPreviewProf ? <img src={fotoPreviewProf} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-4xl opacity-30">📷</span>}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Alterar<br/>Foto</span></div>
                  </div>
                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest group-hover:underline">Adicionar Foto</span>
                  <input id="prof-foto-upload" type="file" accept="image/*" className="hidden" onChange={handleProfFileChange} />
                </label>
              </div>

              {/* DADOS DE ACESSO */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest border-b text-indigo-500 border-indigo-500/20 pb-2">Sistema / Permissões</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="text-[9px] font-bold opacity-50 ml-1 block mb-1 uppercase">Cargo / Permissão</label>
                    <select required value={profForm.role} onChange={e => setProfForm({...profForm, role: e.target.value})} className={`w-full p-3.5 rounded-xl border font-black text-sm outline-none ${profForm.role === 'ADMIN' ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-indigo-600 bg-indigo-50 border-indigo-200'}`}>
                      <option value="PROFESSOR">👨‍🏫 PROFESSOR</option>
                      <option value="ADMIN">👑 DIRETOR / ADMIN</option>
                    </select>
                  </div>
                  {!profForm.id && (
                    <>
                      <div><label className="text-[9px] font-bold opacity-50 ml-1 block mb-1 uppercase">E-mail de Login</label><input required type="email" value={profForm.email} onChange={e => setProfForm({...profForm, email: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div>
                      <div><label className="text-[9px] font-bold opacity-50 ml-1 block mb-1 uppercase">Senha de Login</label><input required minLength={6} type="password" value={profForm.senha} onChange={e => setProfForm({...profForm, senha: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div>
                    </>
                  )}
                  {profForm.id && (
                     <div className="md:col-span-2 flex items-center text-[10px] font-bold text-rose-500/60 uppercase">
                       Atenção: E-mail de login e senha não podem ser alterados por aqui após a criação. O membro deve usar "Esqueci minha senha" no portal.
                     </div>
                  )}
                </div>
              </div>

              {/* DADOS PESSOAIS */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest border-b text-indigo-500 border-indigo-500/20 pb-2">Dados Pessoais</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input placeholder="Nome Completo" required value={profForm.nome_completo} onChange={e => setProfForm({...profForm, nome_completo: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm md:col-span-2 ${s.input}`} />
                  <div><label className="text-[9px] font-bold opacity-50 ml-1 block mb-1">Data Nasc.</label><input type="date" value={profForm.data_nascimento} onChange={e => setProfForm({...profForm, data_nascimento: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div>
                  <input placeholder="CPF" value={profForm.cpf} onChange={e => setProfForm({...profForm, cpf: formatCPF(e.target.value)})} maxLength={14} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} />
                  <input placeholder="WhatsApp / Telefone" value={profForm.telefone} onChange={e => setProfForm({...profForm, telefone: formatPhone(e.target.value)})} maxLength={15} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} />
                </div>
              </div>

              {/* ENDEREÇO */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest border-b text-indigo-500 border-indigo-500/20 pb-2">Endereço</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <input placeholder="CEP" value={profForm.cep} onChange={handleProfCepChange} maxLength={9} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-1 ${s.input}`} />
                  <input placeholder="Endereço / Rua" value={profForm.endereco} onChange={e => setProfForm({...profForm, endereco: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-2 ${s.input}`} />
                  <input id="prof-numero" placeholder="Número" value={profForm.numero} onChange={e => setProfForm({...profForm, numero: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-1 ${s.input}`} />
                  <input placeholder="Complemento" value={profForm.complemento} onChange={e => setProfForm({...profForm, complemento: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-1 ${s.input}`} />
                  <input placeholder="Bairro" value={profForm.bairro} onChange={e => setProfForm({...profForm, bairro: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-1 ${s.input}`} />
                  <input placeholder="Cidade" value={profForm.cidade} onChange={e => setProfForm({...profForm, cidade: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm col-span-2 md:col-span-1 ${s.input}`} />
                  <input placeholder="UF" value={profForm.estado} onChange={e => setProfForm({...profForm, estado: e.target.value})} maxLength={2} className={`w-full p-3.5 rounded-xl border font-bold text-sm uppercase col-span-2 md:col-span-1 ${s.input}`} />
                </div>
              </div>

              {/* 👇 NOVO: MODALIDADES DO PROFESSOR 👇 */}
              {profForm.role === 'PROFESSOR' && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest border-b text-indigo-500 border-indigo-500/20 pb-2">Cursos que Leciona (Modalidades)</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {modalidades.map(m => (
                      <button 
                        key={m.id} 
                        type="button" 
                        onClick={() => toggleModalidadeProf(m.nome)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${profForm.modalidades.includes(m.nome) ? 'bg-indigo-600 text-white border-transparent shadow-lg scale-105' : `${s.cardInterno} opacity-70 hover:opacity-100 border-slate-500/20`}`}
                      >
                        {profForm.modalidades.includes(m.nome) && <span className="mr-2">✓</span>} {m.nome}
                      </button>
                    ))}
                    {modalidades.length === 0 && <p className="text-xs italic opacity-50">Nenhuma modalidade cadastrada na escola.</p>}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-500/10">
                <button type="button" onClick={() => setShowModalProf(false)} disabled={isSubmitting} className={`px-6 py-3 rounded-xl font-black uppercase text-xs ${s.text} hover:bg-slate-500/10`}>Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-10 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase text-xs shadow-lg hover:scale-105 transition-all">
                  {isSubmitting ? 'Salvando...' : '💾 Salvar Ficha Completa'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL CROPPER DO PROFESSOR */}
      {showCropModalProf && imageToCropProf && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-in fade-in">
          <div className={`${s.card} border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col items-center`}>
            <h3 className="text-xl font-black uppercase italic mb-6">Ajustar Foto da Equipe</h3>
            <div className="relative w-full h-64 bg-slate-800 rounded-2xl overflow-hidden mb-6 shadow-inner">
              <Cropper image={imageToCropProf} crop={cropProf} zoom={zoomProf} aspect={1} cropShape="round" showGrid={false} onCropChange={setCropProf} onCropComplete={(cA, cAP) => setCroppedAreaPixelsProf(cAP)} onZoomChange={setZoomProf} />
            </div>
            <div className="w-full mb-8">
              <label className="text-[10px] font-black uppercase opacity-50 block mb-2 text-center">Zoom da Imagem</label>
              <input type="range" min={1} max={3} step={0.1} value={zoomProf} onChange={(e) => setZoomProf(Number(e.target.value))} className="w-full accent-indigo-500" />
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={() => setShowCropModalProf(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs border border-slate-500/20 hover:bg-slate-500/10`}>Cancelar</button>
              <button onClick={handleConfirmCropProf} className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-indigo-600 text-white shadow-lg hover:scale-105 transition-all">Cortar & Salvar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}