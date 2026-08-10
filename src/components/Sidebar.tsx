"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useStyles } from '../lib/useStyles'
import { motion, AnimatePresence } from 'framer-motion'
import Cropper from 'react-easy-crop'
import { BILLING_MODELS, BillingModel } from '../lib/billing'
import {
  CalendarDays,
  Camera,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  Settings2,
  UserPlus,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  dateInputToISO,
  ensureBrazilianNinthDigit,
  formatBrazilianPhone,
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatDateInput,
  normalizeEmail,
  normalizeName,
} from '../lib/formatters'

// --- FUNÇÕES DE CROPPER ---
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
  const [modeloFaturamento, setModeloFaturamento] = useState<BillingModel>('VENCIMENTO_FIXO');
  const [valorPorAula, setValorPorAula] = useState('62.50');
  const [inicioFaturamento, setInicioFaturamento] = useState(new Date().toISOString().slice(0, 7));
  const [registrarPagamentoInicial, setRegistrarPagamentoInicial] = useState(false);
  const [dataPrimeiroPagamento, setDataPrimeiroPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [agendamentoCadastro, setAgendamentoCadastro] = useState<'AGORA' | 'DEPOIS'>('AGORA')
  
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
    setComoConheceu(''); setIndicacaoNome(''); setValorMensalidade('250'); setVencimento('10'); setModeloFaturamento('VENCIMENTO_FIXO'); setValorPorAula('62.50'); setInicioFaturamento(new Date().toISOString().slice(0, 7)); setRegistrarPagamentoInicial(false); setDataPrimeiroPagamento(new Date().toISOString().split('T')[0]); setAgendamentoCadastro('AGORA');
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
    const dataNascimentoISO = tipoCadastro === 'PF' ? dateInputToISO(dataNascimento) : null;
    if (tipoCadastro === 'PF' && !dataNascimentoISO) {
      return alert("Informe uma data de nascimento válida no formato DD/MM/AAAA.")
    }
    if (modeloFaturamento === 'MENSAL_FECHADO' && Number(valorPorAula) <= 0) {
      return alert("Informe o valor cobrado por aula.")
    }
    const documentoNumeros = documento.replace(/\D/g, '');
    if (tipoCadastro === 'PF' && documentoNumeros.length !== 11) {
      return alert("Informe um CPF com 11 dígitos.")
    }
    if (tipoCadastro === 'PJ' && modeloFaturamento === 'MENSAL_FECHADO' && documentoNumeros.length !== 14) {
      return alert("O CNPJ é obrigatório para emitir as faturas automáticas da turma.")
    }
    const agendasParaSalvar = agendamentoCadastro === 'AGORA' ? agendas : [];
    if (agendasParaSalvar.some(ag => !ag.professor_id || !ag.sala_id || !ag.instrumento_aula)) {
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
    for (let ag of agendasParaSalvar) {
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
      telefone: ensureBrazilianNinthDigit(telAluno),
      cpf: documento, 
      data_nascimento: dataNascimentoISO,
      cep, endereco, numero, complemento, bairro, cidade, estado, 
      avatar_url: avatarPublicUrl, 
      role: 'ALUNO' 
    }])
    if (err1) { setIsSubmitting(false); return alert("Erro ao criar perfil: " + err1.message) }
    
    const valorBase = modeloFaturamento === 'MENSAL_FECHADO'
      ? Number((parseFloat(valorPorAula) * 4).toFixed(2))
      : parseFloat(valorMensalidade);
    const { error: errInfo } = await supabase.from('alunos_info').insert([{
      id: alunoId,
      valor_mensalidade: valorBase,
      data_vencimento: modeloFaturamento === 'VENCIMENTO_FIXO' ? parseInt(vencimento) : null,
      modelo_faturamento: modeloFaturamento,
      creditos_por_pagamento: 4,
      saldo_creditos_faturamento: 0,
      valor_por_aula: modeloFaturamento === 'MENSAL_FECHADO' ? parseFloat(valorPorAula) : null,
      prazo_vencimento_dias: 7,
      inicio_faturamento: `${inicioFaturamento}-01`,
      como_conheceu: comoConheceu,
      indicacao_nome: comoConheceu === 'Indicação' ? indicacaoNome : null,
      status: 'Ativo'
    }])
    if (errInfo) {
      setIsSubmitting(false);
      return alert("Erro ao salvar o modelo de faturamento: " + errInfo.message)
    }
    
    // Inserir todas as agendas
    const agendaInserts = agendasParaSalvar.map(ag => ({
      professor_id: ag.professor_id,
      aluno_id: alunoId,
      sala_id: parseInt(ag.sala_id),
      dia: ag.dia,
      horario_inicio: ag.horario_inicio,
      horario_fim: ag.horario_fim,
      instrumento_aula: ag.instrumento_aula
    }))
    if (agendaInserts.length > 0) {
      await supabase.from('agenda').insert(agendaInserts)
    }
    
    if (modeloFaturamento !== 'MENSAL_FECHADO' && registrarPagamentoInicial) {
      const { error: errPg } = await supabase.from('pagamentos').insert([{
        aluno_id: alunoId,
        valor: valorBase,
        status: 'Pago',
        data_pagamento: dataPrimeiroPagamento,
        competencia: `${inicioFaturamento}-01`,
        metodo_pagamento: 'Pagamento inicial confirmado na matrícula'
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

  const NavButton = ({ rota, icone: Icon, texto }: { rota: string, icone: LucideIcon, texto: string }) => {
    const isActive = pathname === rota || (rota !== '/' && pathname.includes(rota))
    
    return (
      <motion.button 
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => router.push(rota)} 
        className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] transition-all duration-200 w-full text-left
          ${isActive 
            ? 'bg-white/[0.11] border border-white/[0.11] text-white font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.13)]'
            : 'border border-transparent text-white/60 font-medium hover:text-white hover:bg-white/[0.06]'
          }`}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-[#c7a46d] text-[#18362b]' : 'bg-white/[0.05] text-white/55 group-hover:text-[#d3b47f]'}`}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span>{texto}</span>
      </motion.button>
    )
  }

  const NavLinks = () => (
    <div className="flex flex-col gap-1.5 w-full mt-7">
      <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
        Menu principal
      </p>
      <motion.button 
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={abrirModalMatricula} 
        className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-[#173229] font-bold text-[13px] transition-all shadow-[0_10px_25px_rgba(0,0,0,0.16)] bg-[#c7a46d] hover:bg-[#d2b27f] mb-4"
      >
        <UserPlus size={17} strokeWidth={2} /> Nova matrícula
      </motion.button>

      <NavButton rota="/" icone={LayoutDashboard} texto="Visão geral" />
      <NavButton rota="/alunos" icone={UsersRound} texto="Alunos" />
      <NavButton rota="/turmas" icone={PanelsTopLeft} texto="Turmas" />
      <NavButton rota="/financeiro" icone={WalletCards} texto="Financeiro" />
      <NavButton rota="/calendario" icone={CalendarDays} texto="Calendário" />
      <NavButton rota="/gerencia" icone={Settings2} texto="Central de gestão" />
      
      <motion.button 
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleLogout} 
        className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-white/45 font-medium text-[13px] hover:bg-white/[0.05] hover:text-white border border-transparent transition-colors text-left mt-4"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
          <LogOut size={17} strokeWidth={1.8} />
        </span>
        Sair
      </motion.button>
    </div>
  )

  const inputClass = "premium-form-control";
  const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
  const formSectionClass = "rounded-2xl border border-[#dfded7] bg-white p-5 md:p-6";

  return (
    <div className="lotus-admin min-h-screen w-full text-slate-900 font-sans flex flex-col xl:flex-row relative z-0">
      
      <AnimatePresence>
        {menuAberto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0d1d17]/55 backdrop-blur-sm z-40 xl:hidden"
            onClick={() => setMenuAberto(false)} 
          />
        )}
      </AnimatePresence>
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-[270px] h-screen border-r border-white/[0.06] bg-[#12271f] p-5 flex flex-col justify-between shadow-[16px_0_42px_rgba(16,35,28,0.12)] overflow-y-auto custom-scrollbar transition-transform duration-300 ease-in-out xl:sticky xl:top-0 xl:self-start xl:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="flex items-center justify-between gap-3 px-1 relative">
            <button aria-label="Fechar menu" className="xl:hidden absolute -right-1 top-0 p-2 text-white/50 hover:text-white transition-colors" onClick={() => setMenuAberto(false)}>
              <X size={20} />
            </button>
            <motion.img
              whileHover={{ scale: 1.02 }}
              src="/logo-horizontal-verde.png"
              alt="Lótus Music — Escola de Música"
              className="h-[92px] w-full object-contain cursor-pointer drop-shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
            />
          </div>
          <NavLinks />
        </div>
        
        <motion.div className="p-3.5 bg-white/[0.055] rounded-xl flex items-center gap-3 border border-white/[0.07] mt-5 cursor-default shrink-0">
          {perfil?.avatar_url ? (
            <img src={perfil.avatar_url} alt="Perfil" className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#c7a46d] flex items-center justify-center shrink-0">
              <span className="font-bold text-[#18362b]">
                {perfil?.nome_completo?.charAt(0) || 'U'}
              </span>
            </div>
          )}
          <div className="overflow-hidden pr-2 flex-1">
            <p className="font-semibold text-xs text-white truncate" title={perfil?.nome_completo}>{perfil?.nome_completo || 'Carregando...'}</p>
            <p className="text-white/35 text-[9px] uppercase font-bold tracking-[0.14em] mt-1">{perfil?.role}</p>
          </div>
        </motion.div>
      </aside>

      <main className="app-main flex-1 w-full p-4 md:p-7 xl:p-9 overflow-x-hidden flex flex-col relative z-0">
        <header className="xl:hidden flex items-center justify-between mb-6 bg-[#12271f] p-3.5 rounded-2xl border border-white/[0.06] shadow-[0_12px_30px_rgba(18,39,31,0.16)] relative z-10">
            <motion.button aria-label="Abrir menu" whileTap={{ scale: 0.94 }} onClick={() => setMenuAberto(true)} className="p-2 rounded-xl bg-white/[0.07] text-white hover:bg-white/[0.12] transition-colors flex justify-center items-center w-10 h-10">
              <Menu size={20} strokeWidth={1.8} />
            </motion.button>
            <div className="flex-1 flex justify-center px-4"><img src="/logo-horizontal-verde.png" alt="Lótus Music — Escola de Música" className="h-11 w-[156px] object-contain" /></div>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1d17]/55 p-3 backdrop-blur-sm md:p-4">
            <motion.div initial={{ scale: 0.97, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 18 }} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#f8f7f2] shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[#dfded7] bg-[#fbfaf6] px-5 py-5 md:px-7">
                <div>
                  <div className="premium-kicker">Nova matrícula</div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Cadastro do aluno</h2>
                  <p className="mt-1 text-sm text-slate-500">Dados pessoais, cobrança e agenda organizados no mesmo fluxo.</p>
                </div>
                <button type="button" aria-label="Fechar nova matrícula" onClick={fecharModalMatricula} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dfded7] bg-white text-slate-500 transition hover:border-[#bfc7c1] hover:text-[#1f4a3a]">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleMatricular} className="flex min-h-0 flex-1 flex-col">
                <div className="premium-scrollarea min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 md:px-7">
                <section className={formSectionClass}>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">1</span>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Identidade e acesso</h3>
                        <p className="mt-0.5 text-xs text-slate-500">Informações do aluno e acesso ao portal.</p>
                      </div>
                    </div>
                    <label htmlFor="foto-upload" className="group flex cursor-pointer items-center gap-3 rounded-xl border border-[#dfded7] bg-[#faf9f6] p-2 pr-4 transition hover:border-[#b9c8bf]">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#e7efe9] text-[#1f4a3a] shadow-sm">
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={22} strokeWidth={1.7} />
                      )}
                    </div>
                    <span><span className="block text-xs font-semibold text-slate-700">{fotoPreview ? 'Alterar foto' : 'Adicionar foto'}</span><span className="mt-0.5 block text-[11px] text-slate-500">Opcional</span></span>
                    <input id="foto-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                  </div>
                
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#ebe9e3] pb-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4a3a]">
                      Acesso ao portal
                    </p>
                    {tipoCadastro === 'PJ' && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Opcional para instituições
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
                      onBlur={() => setEmailAluno(normalizeEmail(emailAluno))}
                      autoComplete="email"
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

                <div className="mt-6 space-y-4">
                  <div className="flex flex-col gap-3 border-b border-[#ebe9e3] pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f4a3a]">Dados básicos</p>
                    
                    {/* TOGGLE TIPO DE CADASTRO */}
                    <div className="flex flex-wrap gap-2">
                      <label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${tipoCadastro === 'PF' ? 'border-[#9eb5a7] bg-[#e7efe9] text-[#1f4a3a]' : 'border-[#dfded7] bg-white text-slate-600'}`}>
                        <input type="radio" name="tipoCadastro" checked={tipoCadastro === 'PF'} onChange={() => { setTipoCadastro('PF'); setDocumento(''); setDataNascimento(''); setEmailAluno(''); setSenhaAluno(''); }} className="accent-indigo-600" />
                        Aluno Individual (PF)
                      </label>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${tipoCadastro === 'PJ' ? 'border-[#9eb5a7] bg-[#e7efe9] text-[#1f4a3a]' : 'border-[#dfded7] bg-white text-slate-600'}`}>
                        <input type="radio" name="tipoCadastro" checked={tipoCadastro === 'PJ'} onChange={() => { setTipoCadastro('PJ'); setDocumento(''); setDataNascimento(''); setEmailAluno(''); setSenhaAluno(''); }} className="accent-indigo-600" />
                        Contratante / Instituição (PJ)
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <input placeholder={tipoCadastro === 'PF' ? "Nome Completo" : "Nome da Igreja / Instituição / Turma"} required value={nomeAluno} onChange={e => setNomeAluno(e.target.value)} onBlur={() => setNomeAluno(normalizeName(nomeAluno))} autoComplete="name" className={`md:col-span-2 ${inputClass}`} />

                    {tipoCadastro === 'PF' && (
                      <div><label className={labelClass}>Data de nascimento</label><input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} required value={dataNascimento} onChange={e => setDataNascimento(formatDateInput(e.target.value))} autoComplete="bday" className={inputClass} /></div>
                    )}
                    
                    <input 
                      placeholder={tipoCadastro === 'PF' ? "CPF" : modeloFaturamento === 'MENSAL_FECHADO' ? "CNPJ" : "CNPJ (Opcional)"}
                      inputMode="numeric"
                      required={tipoCadastro === 'PF' || modeloFaturamento === 'MENSAL_FECHADO'}
                      value={documento} 
                      onChange={e => setDocumento(tipoCadastro === 'PF' ? formatCPF(e.target.value) : formatCNPJ(e.target.value))} 
                      maxLength={tipoCadastro === 'PF' ? 14 : 18} 
                      className={inputClass} 
                    />
                    
                    <input placeholder={tipoCadastro === 'PF' ? "WhatsApp" : "WhatsApp do Responsável"} inputMode="tel" required value={telAluno} onChange={e => setTelAluno(formatBrazilianPhone(e.target.value))} onBlur={() => setTelAluno(ensureBrazilianNinthDigit(telAluno))} maxLength={15} autoComplete="tel" className={`${tipoCadastro === 'PJ' ? 'md:col-span-2' : ''} ${inputClass}`} />
                  </div>
                </div>
                </section>

                <section className={formSectionClass}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">2</span>
                    <div><h3 className="text-base font-semibold text-slate-900">Endereço</h3><p className="mt-0.5 text-xs text-slate-500">O CEP completa automaticamente os dados disponíveis.</p></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <input placeholder="CEP" inputMode="numeric" required value={cep} onChange={handleCepChange} maxLength={9} autoComplete="postal-code" className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Endereço / Rua" required value={endereco} onChange={e => setEndereco(e.target.value)} autoComplete="address-line1" className={`col-span-2 md:col-span-2 ${inputClass}`} />
                    <input id="input-numero" placeholder="Número" required value={numero} onChange={e => setNumero(e.target.value.toUpperCase())} className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Complemento" value={complemento} onChange={e => setComplemento(e.target.value)} autoComplete="address-line2" className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Bairro" required value={bairro} onChange={e => setBairro(e.target.value)} className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="Cidade" required value={cidade} onChange={e => setCidade(e.target.value)} autoComplete="address-level2" className={`col-span-2 md:col-span-1 ${inputClass}`} />
                    <input placeholder="UF" required value={estado} maxLength={2} onChange={e => setEstado(e.target.value.replace(/[^a-z]/gi, '').toUpperCase())} autoComplete="address-level1" className={`col-span-2 md:col-span-1 ${inputClass}`} />
                  </div>
                </section>

                <section className={formSectionClass}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">3</span>
                    <div><h3 className="text-base font-semibold text-slate-900">Faturamento</h3><p className="mt-0.5 text-xs text-slate-500">Escolha como este aluno será cobrado.</p></div>
                  </div>

                  <div className="max-w-xs">
                    <label className={labelClass}>Início do faturamento</label>
                    <input type="month" required value={inicioFaturamento} onChange={e => setInicioFaturamento(e.target.value)} className={inputClass} />
                    <p className="mt-2 text-xs text-slate-500">Primeira competência que deve constar no dossiê financeiro.</p>
                  </div>

                  <div className="mt-5">
                    <label className={labelClass}>Modelo de faturamento</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {BILLING_MODELS.map(model => (
                        <button
                          key={model.value}
                          type="button"
                          onClick={() => {
                            setModeloFaturamento(model.value)
                            if (model.value === 'MENSAL_FECHADO' && !valorPorAula) {
                              setValorPorAula((Number(valorMensalidade || 0) / 4).toFixed(2))
                            }
                          }}
                          className={`rounded-xl border p-4 text-left transition-all ${modeloFaturamento === model.value ? 'border-[#8eaa9b] bg-[#edf4ef] ring-2 ring-[#1f4a3a]/10' : 'border-[#dfded7] bg-white hover:border-[#bfc9c2] hover:bg-[#faf9f6]'}`}
                        >
                          <span className={`mb-1 block text-sm font-semibold ${modeloFaturamento === model.value ? 'text-[#1f4a3a]' : 'text-slate-700'}`}>{modeloFaturamento === model.value ? '✓ ' : ''}{model.label}</span>
                          <span className="block text-xs font-medium leading-relaxed text-slate-500">{model.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                    {modeloFaturamento === 'MENSAL_FECHADO' ? (
                      <>
                        <div className="col-span-2 md:col-span-1">
                          <label className={labelClass}>Valor por aula (R$)</label>
                          <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Ex: 70,00" required value={valorPorAula} onChange={e => setValorPorAula(e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-2 rounded-xl border border-[#d7e1da] bg-[#edf4ef] p-4 text-xs font-medium leading-5 text-[#315949] md:col-span-2">
                          Fecha no último dia do mês e vence 7 dias corridos depois. Somente aulas realizadas entram na fatura.
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className={labelClass}>{modeloFaturamento === 'CREDITOS' ? 'Valor do pacote (R$)' : 'Mensalidade (R$)'}</label>
                          <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Ex: 250" required value={valorMensalidade} onChange={e => setValorMensalidade(e.target.value)} className={inputClass} />
                        </div>
                        {modeloFaturamento === 'VENCIMENTO_FIXO' && (
                          <div>
                            <label className={labelClass}>Dia do vencimento</label>
                            <input type="number" inputMode="numeric" min="1" max="31" placeholder="Ex: 10" required value={vencimento} onChange={e => setVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))} className={inputClass} />
                          </div>
                        )}
                        <div className="col-span-2 md:col-span-3 rounded-2xl border border-[#d9d5ca] bg-white/60 p-4">
                          <label className="flex cursor-pointer items-start justify-between gap-4">
                            <span>
                              <span className="block text-xs font-bold text-slate-700">Pagamento inicial já foi recebido?</span>
                              <span className="mt-1 block text-xs leading-relaxed text-slate-500">Ative somente se o valor já entrou no caixa. Caso contrário, o aluno será cadastrado sem recibo ou pagamento confirmado.</span>
                            </span>
                            <input
                              type="checkbox"
                              checked={registrarPagamentoInicial}
                              onChange={e => setRegistrarPagamentoInicial(e.target.checked)}
                              className="mt-0.5 h-5 w-5 accent-emerald-700"
                            />
                          </label>
                          {registrarPagamentoInicial && (
                            <div className="mt-4 border-t border-slate-200 pt-4">
                              <label className={labelClass}>Data do recebimento</label>
                              <input type="date" required value={dataPrimeiroPagamento} onChange={e => setDataPrimeiroPagamento(e.target.value)} className={inputClass} />
                            </div>
                          )}
                        </div>
                        {modeloFaturamento === 'CREDITOS' && (
                        <div className="col-span-2 rounded-xl border border-[#d7e1da] bg-[#edf4ef] p-4 text-xs font-medium leading-5 text-[#315949] md:col-span-3">
                            Cada pagamento confirmado adiciona 4 créditos. Cada aula realizada consome 1.
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className={labelClass}>Como conheceu a escola?</label>
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
                        <label className={labelClass}>Quem indicou?</label>
                        <input required value={indicacaoNome} onChange={e => setIndicacaoNome(e.target.value)} placeholder="Nome da pessoa" className={inputClass} />
                      </motion.div>
                    )}
                  </div>
                </section>

                {/* 🔥 SESSÃO DE MÚLTIPLOS HORÁRIOS (MATRÍCULA) 🔥 */}
                <section className={formSectionClass}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-xs font-bold text-[#1f4a3a]">4</span>
                      <div><h3 className="text-base font-semibold text-slate-900">Agenda do aluno</h3><p className="mt-0.5 text-xs text-slate-500">Defina agora ou deixe o aluno disponível para uma turma.</p></div>
                    </div>
                    {agendamentoCadastro === 'AGORA' && <button type="button" onClick={addAgenda} className="h-9 rounded-lg border border-[#cbdad0] bg-[#edf4ef] px-3 text-xs font-semibold text-[#1f4a3a] transition hover:bg-[#e2ede6]">+ Adicionar horário</button>}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAgendamentoCadastro('AGORA')}
                      className={`rounded-xl border p-4 text-left transition-all ${agendamentoCadastro === 'AGORA' ? 'border-[#8eaa9b] bg-[#edf4ef] ring-2 ring-[#1f4a3a]/10' : 'border-[#dfded7] bg-white hover:border-[#bfc9c2]'}`}
                    >
                      <span className="block text-sm font-semibold text-slate-800">Agendar horário agora</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">Cria uma aula individual fixa junto com a matrícula.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgendamentoCadastro('DEPOIS')}
                      className={`rounded-xl border p-4 text-left transition-all ${agendamentoCadastro === 'DEPOIS' ? 'border-[#8eaa9b] bg-[#edf4ef] ring-2 ring-[#1f4a3a]/10' : 'border-[#dfded7] bg-white hover:border-[#bfc9c2]'}`}
                    >
                      <span className="block text-sm font-semibold text-slate-800">Cadastrar sem horário fixo</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">Permite agendar depois ou importar o aluno para uma turma.</span>
                    </button>
                  </div>
                  
                  {agendamentoCadastro === 'AGORA' ? agendas.map((ag, index) => (
                    <div key={ag.id} className="relative mt-4 rounded-2xl border border-[#d7e1da] bg-[#f4f7f4] p-5">
                      {agendas.length > 1 && (
                        <button type="button" onClick={() => removeAgenda(index)} className="absolute -top-3 -right-2 bg-rose-100 text-rose-600 border border-rose-200 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md hover:bg-rose-500 hover:text-white transition-all">✕</button>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className={labelClass}>Dia</label>
                          <select required value={ag.dia} onChange={e => handleAgendaChange(index, 'dia', e.target.value)} className={inputClass}>
                            {dias.map((d: string) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Horário</label>
                          <select required value={ag.horario_inicio} onChange={e => handleAgendaChange(index, 'horario_inicio', e.target.value)} className={inputClass}>
                            {HORARIOS_DISPONIVEIS.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Professor</label>
                          <select required value={ag.professor_id} onChange={e => handleAgendaChange(index, 'professor_id', e.target.value)} className={inputClass}>
                            <option value="">Selecione...</option>
                            {professoresList.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Sala</label>
                          <select required value={ag.sala_id} onChange={e => handleAgendaChange(index, 'sala_id', e.target.value)} className={inputClass}>
                            <option value="">Selecione...</option>
                            {salasList.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="pt-4">
                        <label className={labelClass}>Modalidade</label>
                        <div className="flex flex-wrap gap-2">
                          {modalidadesLista.map(m => (
                            <motion.button 
                              whileTap={{ scale: 0.95 }} 
                              key={m.nome} 
                              type="button" 
                              onClick={() => handleAgendaChange(index, 'instrumento_aula', m.nome)} 
                              className={`rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all ${ag.instrumento_aula === m.nome ? 'border-[#1f4a3a] bg-[#1f4a3a] text-white' : 'border-[#dfded7] bg-white text-slate-600 hover:border-[#aebdb4]'}`}
                            >
                              {ag.instrumento_aula === m.nome && <span className="mr-2">✓</span>} {m.nome}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[#c9d7cf] bg-[#eef5f0] px-5 py-6 text-center">
                      <p className="text-sm font-semibold text-[#1f4a3a]">Aluno será cadastrado sem agenda individual</p>
                      <p className="mt-1 text-xs text-[#607269]">Depois você poderá adicioná-lo a uma turma ou criar um horário pelo perfil.</p>
                    </div>
                  )}
                </section>

                </div>
                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#dfded7] bg-[#fbfaf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
                  <p className="hidden text-xs text-slate-500 sm:block">{BILLING_MODELS.find(model => model.value === modeloFaturamento)?.label} · {agendamentoCadastro === 'AGORA' ? `${agendas.length} horário${agendas.length === 1 ? '' : 's'} fixo${agendas.length === 1 ? '' : 's'}` : 'sem horário fixo'}</p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={fecharModalMatricula} disabled={isSubmitting} className="h-11 rounded-xl border border-[#d9d7ce] bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-[#f8f7f3] disabled:opacity-50">Cancelar</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-[#1f4a3a] px-6 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,74,58,0.18)] transition hover:bg-[#173b2e] disabled:opacity-50">{isSubmitting ? 'Criando matrícula...' : 'Finalizar matrícula'}</motion.button>
                  </div>
                </div>
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
