"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'

const formatCEP = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9)

export default function Gerencia() {
  const { s } = useStyles()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [activeTab, setActiveTab] = useState('Escola')
  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  // ESTADOS GERAIS DA ESCOLA
  const [config, setConfig] = useState<any>({ 
    nome_escola: '', chave_pix: '', logo_url: '', cnpj: '', telefone: '', favicon_url: '',
    cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: ''
  })
  
  const [salas, setSalas] = useState<any[]>([])
  const [modalidades, setModalidades] = useState<any[]>([])
  const [professores, setProfessores] = useState<any[]>([])
  
  // ESTADOS DE DISPONIBILIDADE
  const [selectedProfId, setSelectedProfId] = useState('')
  const [disponibilidades, setDisponibilidades] = useState<any[]>([])
  const [dispDia, setDispDia] = useState('Segunda')
  const [dispInicio, setDispInicio] = useState('08:00')
  const [dispFim, setDispFim] = useState('22:00')
  const [temAlmoco, setTemAlmoco] = useState(true)
  const [almocoInicio, setAlmocoInicio] = useState('12:00')
  const [almocoFim, setAlmocoFim] = useState('14:00')

  // ESTADOS PARA CADASTRO
  const [novaSala, setNovaSala] = useState('')
  const [novaModalidade, setNovaModalidade] = useState('')
  
  // IMAGENS
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null)

  useEffect(() => { carregarTudo() }, [])
  useEffect(() => { if (selectedProfId) carregarDisponibilidadeProf(selectedProfId) }, [selectedProfId])

  async function carregarTudo() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const { data: conf } = await supabase.from('configuracoes').select('*').eq('id', 1).single()
    if (conf) { 
      // Garante que null vire string vazia para o React não reclamar
      setConfig({
        nome_escola: conf.nome_escola || '',
        chave_pix: conf.chave_pix || '',
        logo_url: conf.logo_url || '',
        cnpj: conf.cnpj || '',
        telefone: conf.telefone || '',
        favicon_url: conf.favicon_url || '',
        cep: conf.cep || '',
        endereco: conf.endereco || '',
        numero: conf.numero || '',
        complemento: conf.complemento || '',
        bairro: conf.bairro || '',
        cidade: conf.cidade || '',
        estado: conf.estado || ''
      })
      setLogoPreview(conf.logo_url)
      setFaviconPreview(conf.favicon_url)
    }

    const { data: sls } = await supabase.from('salas').select('*').order('nome')
    const { data: mods } = await supabase.from('modalidades').select('*').order('nome')
    const { data: profs } = await supabase.from('profiles').select('id, nome_completo, role').in('role', ['PROFESSOR', 'ADMIN']).order('nome_completo')
    
    setSalas(sls || [])
    setModalidades(mods || [])
    setProfessores(profs || [])
    setLoading(false)
  }

  async function carregarDisponibilidadeProf(id: string) {
    const { data } = await supabase.from('disponibilidade_professor').select('*').eq('professor_id', id)
    const ordemDias: Record<string, number> = { 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6 }
    const ordenado = (data || []).sort((a: any, b: any) => {
      if (ordemDias[a.dia_semana] !== ordemDias[b.dia_semana]) return ordemDias[a.dia_semana] - ordemDias[b.dia_semana]
      return a.hora_inicio.localeCompare(b.hora_inicio)
    })
    setDisponibilidades(ordenado)
  }

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCep = formatCEP(e.target.value); 
    setConfig({ ...config, cep: newCep });
    const cleanCep = newCep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`); 
        const data = await res.json();
        if (!data.erro) {
          setConfig((prev: any) => ({ 
            ...prev, 
            endereco: data.logradouro || '', 
            bairro: data.bairro || '', 
            cidade: data.localidade || '', 
            estado: data.uf || '' 
          }))
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
    if (!confirm("Excluir este horário?")) return
    await supabase.from('disponibilidade_professor').delete().eq('id', id)
    carregarDisponibilidadeProf(selectedProfId)
  }

  const handleLimparDia = async (dia: string) => {
    if (!confirm(`🚨 Apagar TODOS os horários livres de ${dia}?`)) return
    setIsSubmitting(true)
    await supabase.from('disponibilidade_professor').delete().eq('professor_id', selectedProfId).eq('dia_semana', dia)
    carregarDisponibilidadeProf(selectedProfId)
    setIsSubmitting(false)
  }

  const handleAddSala = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!novaSala) return; 
    await supabase.from('salas').insert([{ nome: novaSala }]); 
    setNovaSala(''); carregarTudo() 
  }
  
  const handleDelSala = async (id: string) => { 
    if (!confirm("Deletar esta sala?")) return; 
    await supabase.from('salas').delete().eq('id', id); 
    carregarTudo() 
  }

  const handleAddModalidade = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!novaModalidade) return; 
    await supabase.from('modalidades').insert([{ nome: novaModalidade }]); 
    setNovaModalidade(''); carregarTudo() 
  }
  
  const handleDelModalidade = async (id: string) => { 
    if (!confirm("Deletar esta modalidade?")) return; 
    await supabase.from('modalidades').delete().eq('id', id); 
    carregarTudo() 
  }

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <div className="animate-in fade-in duration-500 pb-12 w-full">
      
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
        <button onClick={() => setActiveTab('Horarios')} className={`pb-4 text-sm font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${activeTab === 'Horarios' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          ⏰ Motor de Horários
        </button>
      </div>

      <div>
        
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
    </div>
  )
}