"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useStyles } from '../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'
import Cropper from 'react-easy-crop'

// --- FUNÇÕES DE MÁSCARA E CROPPER ---
const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15)
const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14)
const formatCNPJ = (v: string) => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18)
const formatCEP = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9)
const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<File | null> => { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return null; canvas.width = 256; canvas.height = 256; ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 256, 256); return new Promise(resolve => canvas.toBlob(blob => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.9)) }

// Array de horários para o select (07:00 às 22:00)
const HORARIOS_DISPONIVEIS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 7;
  return `${h.toString().padStart(2, '0')}:00`;
});

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const { s } = useStyles() 
  const router = useRouter()
  const pathname = usePathname() 
  
  const [perfil, setPerfil] = useState<any>(null)
  const [configEscola, setConfigEscola] = useState<any>(null)
  const [menuAberto, setMenuAberto] = useState(false)

  // --- ESTADOS DA MATRÍCULA ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [professoresList, setProfessoresList] = useState<any[]>([])
  const [salasList, setSalasList] = useState<any[]>([])
  const [modalidadesLista, setModalidadesLista] = useState<any[]>([])
  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  const [tipoCadastro, setTipoCadastro] = useState<'PF' | 'PJ'>('PF')
  const [nomeAluno, setNomeAluno] = useState(''); const [emailAluno, setEmailAluno] = useState(''); 
  const [senhaAluno, setSenhaAluno] = useState(''); 
  const [telAluno, setTelAluno] = useState(''); const [documento, setDocumento] = useState(''); const [dataNascimento, setDataNascimento] = useState('')
  const [cep, setCep] = useState(''); const [endereco, setEndereco] = useState(''); const [numero, setNumero] = useState(''); const [complemento, setComplemento] = useState(''); const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState(''); const [estado, setEstado] = useState('')
  
  // ESTADOS FINANCEIRO & MARKETING
  const [comoConheceu, setComoConheceu] = useState(''); 
  const [indicacaoNome, setIndicacaoNome] = useState(''); 
  const [valorMensalidade, setValorMensalidade] = useState('250'); 
  const [vencimento, setVencimento] = useState('10');
  const [dataPrimeiroPagamento, setDataPrimeiroPagamento] = useState(new Date().toISOString().split('T')[0]);
  
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null); const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  
  // 🔥 NOVO ESTADO DE MÚLTIPLOS HORÁRIOS (MATRÍCULA)
  const [agendas, setAgendas] = useState<any[]>([{ id: 'new_1', dia: 'Segunda', horario_inicio: '08:00', horario_fim: '09:00', professor_id: '', sala_id: '', instrumento_aula: '' }])
  
  const [showCropModal, setShowCropModal] = useState(false); const [imageToCrop, setImageToCrop] = useState<string | null>(null); const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const rotasPublicas = ['/login', '/esqueci-senha', '/redefinir-senha']

  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const { data: p } = await supabase.from('profiles').select('nome_completo, role, avatar_url').eq('id', session.user.id).single()
        setPerfil(p)

        if (pathname === '/login') {
          if (p?.role === 'ALUNO') {
            router.push('/portal')
          } else {
            router.push('/')
          }
          return
        }

        if (p?.role === 'ALUNO' && !pathname.startsWith('/portal') && !rotasPublicas.includes(pathname)) {
          router.push('/portal')
          return
        }
        
        if (p?.role !== 'ALUNO' && pathname.startsWith('/portal') && !rotasPublicas.includes(pathname)) {
          router.push('/')
          return
        }

      } else {
        setPerfil(null)
        if (!rotasPublicas.includes(pathname)) {
          router.push('/login')
          return
        }
      }
      
      const { data: c } = await supabase.from('configuracoes').select('nome_escola, logo_url, favicon_url').eq('id', 1).single()
      setConfigEscola(c)
    }
    load()
  }, [pathname]) 

  useEffect(() => {
    if (configEscola) {
      if (configEscola.nome_escola) { document.title = `${configEscola.nome_escola} | Gestão` }
      if (configEscola.favicon_url) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = configEscola.favicon_url;
      }
    }
  }, [configEscola, pathname]) 

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // --- LÓGICA DE MATRÍCULA ---
  const abrirModalMatricula = async () => {
    setIsModalOpen(true);
    if (professoresList.length === 0) {
      const { data: pL } = await supabase.from('profiles').select('id, nome_completo').in('role', ['PROFESSOR', 'ADMIN'])
      const { data: sL } = await supabase.from('salas').select('id, nome')
      const { data: mL } = await supabase.from('modalidades').select('nome').order('nome')
      setProfessoresList(pL || []); setSalasList(sL || []); setModalidadesLista(mL || [])
    }
  }

  const fecharModalMatricula = () => { 
    setIsModalOpen(false); setTipoCadastro('PF'); setNomeAluno(''); setEmailAluno(''); setSenhaAluno(''); setTelAluno(''); setDocumento(''); setDataNascimento(''); setCep(''); setEndereco(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setEstado(''); 
    setComoConheceu(''); setIndicacaoNome(''); setValorMensalidade('250'); setVencimento('10'); setDataPrimeiroPagamento(new Date().toISOString().split('T')[0]);
    setFotoArquivo(null); setFotoPreview(null); 
    setAgendas([{ id: 'new_1', dia: 'Segunda', horario_inicio: '08:00', horario_fim: '09:00', professor_id: '', sala_id: '', instrumento_aula: '' }])
  }
  
  // GERENCIAR MÚLTIPLAS AGENDAS NA MATRÍCULA
  const handleAgendaChange = (index: number, field: string, value: any) => {
    const newAgendas = [...agendas];
    newAgendas[index][field] = value;
    if (field === 'horario_inicio') {
        const [h, m] = value.split(':').map(Number);
        const d = new Date(); d.setHours(h + 1, m);
        newAgendas[index].horario_fim = d.toTimeString().slice(0, 5);
    }
    setAgendas(newAgendas);
  }
  const addAgenda = () => setAgendas([...agendas, { id: 'new_' + Date.now(), dia: 'Segunda', horario_inicio: '08:00', horario_fim: '09:00', professor_id: '', sala_id: '', instrumento_aula: '' }])
  const removeAgenda = (index: number) => setAgendas(agendas.filter((_, i) => i !== index))

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const newCep = formatCEP(e.target.value); setCep(newCep); const cleanCep = newCep.replace(/\D/g, ''); if (cleanCep.length === 8) { try { const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`); const data = await res.json(); if (!data.erro) { setEndereco(data.logradouro || ''); setBairro(data.bairro || ''); setCidade(data.localidade || ''); setEstado(data.uf || ''); document.getElementById('input-numero')?.focus() } } catch (error) { console.error("Erro") } } }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) { const reader = new FileReader(); reader.onload = () => { setImageToCrop(reader.result as string); setShowCropModal(true) }; reader.readAsDataURL(e.target.files[0]) } }
  const handleConfirmCrop = async () => { if (imageToCrop && croppedAreaPixels) { const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels); if (croppedFile) { setFotoArquivo(croppedFile); setFotoPreview(URL.createObjectURL(croppedFile)) } }; setShowCropModal(false); setImageToCrop(null); setCrop({ x: 0, y: 0 }); setZoom(1) }

  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (agendas.some(ag => !ag.professor_id || !ag.sala_id || !ag.instrumento_aula)) {
      return alert("Preencha modalidade, sala e professor de TODOS os horários escolhidos.")
    }
    setIsSubmitting(true)

    // 🔥 GERAÇÃO AUTOMÁTICA DE EMAIL/SENHA PARA IGREJAS (PJ)
    let emailFinal = emailAluno;
    let senhaFinal = senhaAluno;

    if (tipoCadastro === 'PJ') {
      if (!emailFinal) {
        const randomHash = Math.random().toString(36).slice(2, 8);
        emailFinal = `turma_${randomHash}@sistemalotus.local`; // Email fictício gerado automaticamente
      }
      if (!senhaFinal) {
        senhaFinal = `lotus${Math.random().toString(36).slice(2, 8)}!`; // Senha aleatória segura
      }
    } else {
      if (!emailFinal || !senhaFinal) {
        setIsSubmitting(false);
        return alert("Preencha o e-mail e a senha de acesso para o aluno.");
      }
    }
    
    // Verificar Conflitos para todos os horários
    for (let ag of agendas) {
      const { data: conflitos } = await supabase.from('agenda').select('id').eq('dia', ag.dia).or(`professor_id.eq.${ag.professor_id},sala_id.eq.${ag.sala_id}`).lt('horario_inicio', ag.horario_fim).gt('horario_fim', ag.horario_inicio)
      if (conflitos && conflitos.length > 0) { 
        setIsSubmitting(false); 
        return alert(`🚨 CONFLITO DE AGENDA! O professor ou sala já está ocupado no dia ${ag.dia} às ${ag.horario_inicio}.`) 
      }
    }
    
    const apiRes = await fetch('/api/matricular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailFinal, password: senhaFinal, nome: nomeAluno })
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
    
    const { error: err1 } = await supabase.from('profiles').insert([{ 
      id: alunoId, 
      nome_completo: nomeAluno, 
      email: emailFinal, // Salva o e-mail (real ou fictício)
      telefone: telAluno, 
      cpf: documento, 
      data_nascimento: dataNascimento || null, 
      cep, endereco, numero, complemento, bairro, cidade, estado, 
      avatar_url: avatarPublicUrl, 
      role: 'ALUNO' 
    }])
    if (err1) { setIsSubmitting(false); return alert("Erro ao criar perfil: " + err1.message) }
    
    await supabase.from('alunos_info').insert([{ id: alunoId, valor_mensalidade: parseFloat(valorMensalidade), data_vencimento: parseInt(vencimento), como_conheceu: comoConheceu, indicacao_nome: comoConheceu === 'Indicação' ? indicacaoNome : null, status: 'Ativo' }])
    
    // Inserir todas as agendas
    const agendaInserts = agendas.map(ag => ({
      professor_id: ag.professor_id,
      aluno_id: alunoId,
      sala_id: parseInt(ag.sala_id),
      dia: ag.dia,
      horario_inicio: ag.horario_inicio,
      horario_fim: ag.horario_fim,
      instrumento_aula: ag.instrumento_aula
    }))
    await supabase.from('agenda').insert(agendaInserts)
    
    const hojeStr = new Date().toISOString().split('T')[0];
    
    if (dataPrimeiroPagamento <= hojeStr) {
      const { error: errPg } = await supabase.from('pagamentos').insert([{
        aluno_id: alunoId,
        valor: parseFloat(valorMensalidade),
        data_pagamento: dataPrimeiroPagamento,
        metodo_pagamento: 'Pix/Dinheiro (Matrícula)'
      }]);
      if (errPg) console.error("Erro ao registrar pagamento inicial:", errPg);
    }

    setIsSubmitting(false); fecharModalMatricula(); alert("🎉 Matrícula realizada com sucesso!"); window.location.reload();
  }

  if (rotasPublicas.includes(pathname) || pathname?.startsWith('/portal')) {
    return (
      <main className="flex-1 flex flex-col w-full relative min-h-screen">
        {children}
      </main>
    )
  }

  const NavButton = ({ rota, icone, texto, corAtivo }: { rota: string, icone: string, texto: string, corAtivo: string }) => {
    const isActive = pathname === rota || (rota !== '/' && pathname.includes(rota))
    
    return (
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push(rota)} 
        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl uppercase text-xs transition-colors duration-300 w-full text-left
          ${isActive 
            ? `bg-white/60 backdrop-blur-md border border-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${corAtivo} font-black` 
            : 'bg-white/10 border border-transparent hover:bg-white/40 hover:border-white/50 text-slate-600 font-bold hover:shadow-sm'
          }`}
      >
        <span className="text-lg drop-shadow-sm">{icone}</span> {texto}
      </motion.button>
    )
  }

  const NavLinks = () => (
    <div className="flex flex-col gap-3 w-full mt-6">
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={abrirModalMatricula} 
        className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-white font-black uppercase text-xs transition-all shadow-md bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-lg mb-4"
      >
        <span className="text-lg leading-none drop-shadow-sm">+</span> Nova Matrícula
      </motion.button>

      <NavButton rota="/" icone="🏠" texto="Painel Central" corAtivo="text-indigo-700" />
      <NavButton rota="/alunos" icone="👥" texto="Gestão de Alunos" corAtivo="text-indigo-700" />
      <NavButton rota="/financeiro" icone="📊" texto="Financeiro" corAtivo="text-emerald-700" />
      <NavButton rota="/calendario" icone="📅" texto="Calendário" corAtivo="text-amber-700" />
      <NavButton rota="/gerencia" icone="⚙️" texto="Gerência / Setup" corAtivo="text-indigo-700" />
      
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleLogout} 
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-rose-600 font-black uppercase text-xs hover:bg-rose-50/50 hover:backdrop-blur-md hover:border hover:border-rose-200 border border-transparent transition-colors text-left mt-4"
      >
        <span className="text-lg drop-shadow-sm">🚪</span> Sair do Sistema
      </motion.button>
    </div>
  )

  const inputClass = "w-full p-3.5 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-bold focus:bg-white/80 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none shadow-inner placeholder:text-slate-400";

  return (
    <div className={`min-h-screen w-full text-slate-900 font-sans flex flex-col xl:flex-row relative z-0`}>
      
      <AnimatePresence>
        {menuAberto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 xl:hidden" 
            onClick={() => setMenuAberto(false)} 
          />
        )}
      </AnimatePresence>
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] h-screen border-r border-white/50 bg-white/40 backdrop-blur-2xl p-6 flex flex-col justify-between shadow-[8px_0_30px_rgba(0,0,0,0.03)] overflow-y-auto custom-scrollbar transition-transform duration-300 ease-in-out xl:relative xl:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="flex justify-center px-2 relative">
            <button className="xl:hidden absolute -right-2 top-0 p-2 text-slate-400 hover:text-rose-500 text-lg transition-colors" onClick={() => setMenuAberto(false)}>✕</button>
            {configEscola?.logo_url ? (
              <motion.img whileHover={{ scale: 1.05 }} src={configEscola.logo_url} alt="Logo" className="h-24 w-full max-w-[200px] object-contain drop-shadow-md cursor-pointer" />
            ) : (
              <h1 className="text-center text-3xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 leading-none mt-2 drop-shadow-sm">{configEscola?.nome_escola || 'Lótus'}</h1>
            )}
          </div>
          <NavLinks />
        </div>
        
        <motion.div whileHover={{ y: -2 }} className={`p-4 bg-white/50 backdrop-blur-md shadow-sm hover:bg-white/70 transition-colors rounded-2xl flex items-center gap-3 border border-white/60 mt-4 cursor-default shrink-0`}>
          {perfil?.avatar_url ? (
            <img src={perfil.avatar_url} alt="Perfil" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
              <span className="font-bold text-indigo-600">
                {perfil?.nome_completo?.charAt(0) || 'U'}
              </span>
            </div>
          )}
          <div className="overflow-hidden pr-2 flex-1">
            <p className="font-black text-xs uppercase text-slate-800 truncate" title={perfil?.nome_completo}>{perfil?.nome_completo || 'Carregando...'}</p>
            <p className={`text-slate-500 text-[9px] uppercase font-bold mt-0.5`}>{perfil?.role}</p>
          </div>
        </motion.div>
      </aside>

      <main className="flex-1 w-full p-4 md:p-8 overflow-x-hidden flex flex-col relative z-0">
        <header className={`xl:hidden flex items-center justify-between mb-6 backdrop-blur-xl bg-white/40 p-4 rounded-[2rem] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative z-10 transition-all`}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMenuAberto(true)} className={`p-2 rounded-xl bg-white/30 backdrop-blur-sm border border-white/50 hover:bg-white/60 transition-colors flex flex-col gap-1.5 justify-center items-center w-10 h-10 shadow-sm`}>
              <div className={`w-5 h-0.5 rounded-full bg-slate-700`}></div>
              <div className={`w-5 h-0.5 rounded-full bg-slate-700`}></div>
              <div className={`w-5 h-0.5 rounded-full bg-slate-700`}></div>
            </motion.button>
            <div className="flex-1 flex justify-center px-4">{configEscola?.logo_url ? (<img src={configEscola.logo_url} alt="Logo" className="h-8 max-w-[140px] object-contain drop-shadow-sm" />) : (<h1 className="text-base font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500 truncate max-w-[150px]">{configEscola?.nome_escola || 'Lótus'}</h1>)}</div>
            <div className="w-10"></div>
        </header>
        
        <AnimatePresence mode="wait">
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col w-full">
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- MODAL DE MATRÍCULA --- */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-emerald-500 p-8 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative overflow-y-auto max-h-[90vh] custom-scrollbar`}>
              
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800">Ficha de Matrícula</h2>
                <p className="text-slate-500 text-sm mt-1">Preencha os dados abaixo para registrar o novo aluno ou turma.</p>
              </div>

              <form onSubmit={handleMatricular} className="space-y-8">
                <div className="flex justify-center mb-6">
                  <label htmlFor="foto-upload" className="cursor-pointer group flex flex-col items-center gap-2">
                    <div className={`relative w-28 h-28 rounded-full border-4 border-indigo-500/20 bg-slate-100 shadow-md overflow-hidden flex items-center justify-center transition-all group-hover:border-indigo-500`}>
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl opacity-50">📷</span>
                      )}
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-[9px] font-black uppercase tracking-widest text-center px-2">Alterar<br/>Foto</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest group-hover:underline mt-1">Adicionar Foto</span>
                    <input id="foto-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">
                      Dados de Acesso (Portal)
                    </p>
                    {tipoCadastro === 'PJ' && (
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        (Opcional para Igrejas)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      placeholder={tipoCadastro === 'PJ' ? "E-mail (Opcional se não houver)" : "E-mail de Cadastro"} 
                      type="email" 
                      required={tipoCadastro === 'PF'} 
                      value={emailAluno} 
                      onChange={e => setEmailAluno(e.target.value)} 
                      className={inputClass} 
                    />
                    <input 
                      placeholder={tipoCadastro === 'PJ' ? "Senha (Opcional)" : "Senha de Acesso (Mín. 6 letras/números)"} 
                      minLength={6} 
                      type="text" 
                      required={tipoCadastro === 'PF'} 
                      value={senhaAluno} 
                      onChange={e => setSenhaAluno(e.target.value)} 
                      className={inputClass} 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Dados Básicos</p>
                    
                    {/* TOGGLE TIPO DE CADASTRO */}
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 cursor-pointer">
                        <input type="radio" name="tipoCadastro" checked={tipoCadastro === 'PF'} onChange={() => { setTipoCadastro('PF'); setDocumento(''); setDataNascimento(''); setEmailAluno(''); setSenhaAluno(''); }} className="accent-indigo-600" />
                        Aluno Individual (PF)
                      </label>
                      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 cursor-pointer">
                        <input type="radio" name="tipoCadastro" checked={tipoCadastro === 'PJ'} onChange={() => { setTipoCadastro('PJ'); setDocumento(''); setDataNascimento(''); setEmailAluno(''); setSenhaAluno(''); }} className="accent-indigo-600" />
                        Turma / Igreja (PJ)
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <input placeholder={tipoCadastro === 'PF' ? "Nome Completo" : "Nome da Igreja / Instituição / Turma"} required value={nomeAluno} onChange={e => setNomeAluno(e.target.value)} className={`md:col-span-2 ${inputClass}`} />
                    
                    {tipoCadastro === 'PF' && (
                      <div><label className="text-[9px] font-bold text-slate-500 ml-1 block mb-1">Data Nasc.</label><input type="date" required value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputClass} /></div>
                    )}
                    
                    <input 
                      placeholder={tipoCadastro === 'PF' ? "CPF" : "CNPJ (Opcional)"} 
                      required={tipoCadastro === 'PF'} 
                      value={documento} 
                      onChange={e => setDocumento(tipoCadastro === 'PF' ? formatCPF(e.target.value) : formatCNPJ(e.target.value))} 
                      maxLength={tipoCadastro === 'PF' ? 14 : 18} 
                      className={inputClass} 
                    />
                    
                    <input placeholder={tipoCadastro === 'PF' ? "WhatsApp" : "WhatsApp do Responsável"} required value={telAluno} onChange={e => setTelAluno(formatPhone(e.target.value))} maxLength={15} className={`${tipoCadastro === 'PJ' ? 'md:col-span-2' : ''} ${inputClass}`} />
                  </div>
                </div>

                <div className="space-y-4"><p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest border-b border-indigo-500/20 pb-2">Endereço</p><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><input placeholder="CEP" required value={cep} onChange={handleCepChange} maxLength={9} className={`col-span-2 md:col-span-1 ${inputClass}`} /><input placeholder="Endereço / Rua" required value={endereco} onChange={e => setEndereco(e.target.value)} className={`col-span-2 md:col-span-2 ${inputClass}`} /><input id="input-numero" placeholder="Número" required value={numero} onChange={e => setNumero(e.target.value)} className={`col-span-2 md:col-span-1 ${inputClass}`} /></div></div>
                
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest border-b border-emerald-500/20 pb-2">Financeiro & Marketing</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 ml-1 block mb-1">Valor Vigente (R$)</label>
                      <input type="number" placeholder="Ex: 250" required value={valorMensalidade} onChange={e => setValorMensalidade(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 ml-1 block mb-1">Dia Vencimento</label>
                      <input type="number" min="1" max="31" placeholder="Ex: 10" required value={vencimento} onChange={e => setVencimento(e.target.value)} className={inputClass} />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[9px] font-bold text-slate-500 ml-1 block mb-1">Data do 1º Pagamento</label>
                      <input type="date" required value={dataPrimeiroPagamento} onChange={e => setDataPrimeiroPagamento(e.target.value)} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 ml-1 block mb-1">Como conheceu a escola?</label>
                      <select required value={comoConheceu} onChange={e => setComoConheceu(e.target.value)} className={inputClass}>
                        <option value="">Selecione...</option>
                        <option value="Instagram">Instagram</option>
                        <option value="Facebook/Google">Google / Pesquisa</option>
                        <option value="Indicação">Indicação de Aluno</option>
                        <option value="Fachada">Passou na frente (Fachada)</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                    {comoConheceu === 'Indicação' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                        <label className="text-[9px] font-bold text-slate-500 ml-1 block mb-1">Quem indicou?</label>
                        <input required value={indicacaoNome} onChange={e => setIndicacaoNome(e.target.value)} placeholder="Nome da pessoa" className={inputClass} />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* 🔥 SESSÃO DE MÚLTIPLOS HORÁRIOS (MATRÍCULA) 🔥 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Agendamento (Horários Fixos)</p>
                    <button type="button" onClick={addAgenda} className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 shadow-sm transition-all">+ Adicionar Horário</button>
                  </div>
                  
                  {agendas.map((ag, index) => (
                    <div key={ag.id} className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 shadow-sm relative">
                      {agendas.length > 1 && (
                        <button type="button" onClick={() => removeAgenda(index)} className="absolute -top-3 -right-2 bg-rose-100 text-rose-600 border border-rose-200 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md hover:bg-rose-500 hover:text-white transition-all">✕</button>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 ml-1">Dia</label>
                          <select required value={ag.dia} onChange={e => handleAgendaChange(index, 'dia', e.target.value)} className={inputClass}>
                            {dias.map((d: string) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 ml-1">Horário</label>
                          <select required value={ag.horario_inicio} onChange={e => handleAgendaChange(index, 'horario_inicio', e.target.value)} className={inputClass}>
                            {HORARIOS_DISPONIVEIS.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 ml-1">Professor</label>
                          <select required value={ag.professor_id} onChange={e => handleAgendaChange(index, 'professor_id', e.target.value)} className={inputClass}>
                            <option value="">Selecione...</option>
                            {professoresList.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 ml-1">Sala</label>
                          <select required value={ag.sala_id} onChange={e => handleAgendaChange(index, 'sala_id', e.target.value)} className={inputClass}>
                            <option value="">Selecione...</option>
                            {salasList.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="pt-4">
                        <label className="text-[10px] font-black uppercase mb-3 block text-slate-500 tracking-widest">Modalidade</label>
                        <div className="flex flex-wrap gap-2">
                          {modalidadesLista.map(m => (
                            <motion.button 
                              whileTap={{ scale: 0.95 }} 
                              key={m.nome} 
                              type="button" 
                              onClick={() => handleAgendaChange(index, 'instrumento_aula', m.nome)} 
                              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all ${ag.instrumento_aula === m.nome ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border-transparent shadow-lg scale-105' : `bg-white/50 border-white/60 text-slate-600 shadow-sm hover:bg-white`}`}
                            >
                              {ag.instrumento_aula === m.nome && <span className="mr-2">✓</span>} {m.nome}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40"><motion.button whileTap={{ scale: 0.95 }} type="button" onClick={fecharModalMatricula} disabled={isSubmitting} className={`px-6 py-3 rounded-xl font-black uppercase text-xs text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white disabled:opacity-50`}>Cancelar</motion.button><motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSubmitting} className="px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black uppercase text-xs shadow-xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50">{isSubmitting ? 'Gerando Acesso...' : 'Finalizar Matrícula'}</motion.button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCropModal && imageToCrop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-indigo-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col items-center`}>
              <h3 className="text-xl font-black uppercase italic mb-6 text-slate-800">Ajustar Foto</h3>
              <div className="relative w-full h-64 bg-slate-900/5 backdrop-blur-inner rounded-2xl overflow-hidden mb-6 shadow-inner"><Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={(cA, cAP) => setCroppedAreaPixels(cAP)} onZoomChange={setZoom} /></div>
              <div className="w-full mb-8"><label className="text-[10px] font-black uppercase text-slate-500 block mb-2 text-center">Zoom da Imagem</label><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-indigo-500" /></div>
              <div className="flex gap-3 w-full"><motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCropModal(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs border border-white/80 bg-white/50 shadow-sm text-slate-600 hover:bg-white`}>Cancelar</motion.button><motion.button whileTap={{ scale: 0.95 }} onClick={handleConfirmCrop} className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-indigo-600 text-white shadow-lg">Cortar & Salvar</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}