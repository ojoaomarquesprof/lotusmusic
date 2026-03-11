"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

const DEFAULT_PENDENTE = "Olá, *{{nome}}*! Tudo bem?\n\nAqui é da *Direto ao Canto*, passando para fazer um lembrete amigável que a sua mensalidade vence no próximo dia {{vencimento}}.\n\nO valor é de *R$ {{valor}}*.\nNossa chave PIX é: *{{pix}}*\n\nMuito obrigado! 🎶"
const DEFAULT_ATRASADO = "Olá, *{{nome}}*! Tudo bem?\n\nAqui é da *Direto ao Canto*, passando para avisar que a sua mensalidade (vencimento dia {{vencimento}}) consta como pendente no nosso sistema.\n\nO valor é de *R$ {{valor}}*.\nNossa chave PIX é: *{{pix}}*\n\nQualquer dúvida, é só avisar por aqui. Muito obrigado! 🎶"

const PIE_COLORS = ['#10b981', '#f43f5e', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#64748b']

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }

export default function RelatorioFinanceiro() {
  const { s } = useStyles()
  const router = useRouter()
  
  const [isMounted, setIsMounted] = useState(false)

  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState({ saldoCaixa: 0, previsaoFaturamento: 0, entradasMes: 0, saidasMes: 0, inadimplencia: 0 })
  const [alunosPendentes, setAlunosPendentes] = useState<any[]>([])
  const [extratoUnificado, setExtratoUnificado] = useState<any[]>([])

  const [dadosGraficoBarra, setDadosGraficoBarra] = useState<any[]>([])
  const [dadosGraficoPizza, setDadosGraficoPizza] = useState<any[]>([])

  const [chavePix, setChavePix] = useState('')
  const [msgPendente, setMsgPendente] = useState(DEFAULT_PENDENTE)
  const [msgAtrasado, setMsgAtrasado] = useState(DEFAULT_ATRASADO)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tTipo, setTTipo] = useState('Saída')
  const [tCategoria, setTCategoria] = useState('Aluguel')
  const [tDescricao, setTDescricao] = useState('')
  const [tValor, setTValor] = useState('')
  const [tData, setTData] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (isMounted) carregarDadosFinanceiros() }, [isMounted])

  async function carregarDadosFinanceiros() {
    const hoje = new Date(); const mesAtual = hoje.getMonth() + 1; const anoAtual = hoje.getFullYear(); const diaAtual = hoje.getDate()

    const { data: configData } = await supabase.from('configuracoes').select('chave_pix, mensagem_pendente, mensagem_atrasado').eq('id', 1).single()
    if (configData) {
      if (configData.chave_pix) setChavePix(configData.chave_pix)
      if (configData.mensagem_pendente) setMsgPendente(configData.mensagem_pendente)
      if (configData.mensagem_atrasado) setMsgAtrasado(configData.mensagem_atrasado)
    }

    const { data: allPagamentos } = await supabase.from('pagamentos').select('*')
    const { data: allTransacoes } = await supabase.from('transacoes').select('*')
    
    let caixaTotal = 0; 
    allPagamentos?.forEach(p => caixaTotal += Number(p.valor)); 
    allTransacoes?.forEach(t => { if (t.tipo === 'Entrada') caixaTotal += Number(t.valor); if (t.tipo === 'Saída') caixaTotal -= Number(t.valor) })

    const inicioMes = new Date(anoAtual, mesAtual - 1, 1).toISOString()
    const fimMes = new Date(anoAtual, mesAtual, 0).toISOString()
    
    const { data: alunos } = await supabase.from('profiles').select('id, nome_completo, telefone, alunos_info(valor_mensalidade, data_vencimento, status)').eq('role', 'ALUNO')
    
    const pgsMes = allPagamentos?.filter(p => p.data_pagamento >= inicioMes && p.data_pagamento <= fimMes) || []
    const transMes = allTransacoes?.filter(t => t.data_transacao >= inicioMes && t.data_transacao <= fimMes) || []

    let entradasM = 0; let saidasM = 0; let pendentesTemp: any[] = []; let previsaoTotal = 0;
    pgsMes.forEach(pg => entradasM += Number(pg.valor))

    let inadimplenciaM = 0
    alunos?.forEach(aluno => {
      const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info; 
      if (!info || !info.valor_mensalidade || info.status === 'Inativo') return
      
      previsaoTotal += Number(info.valor_mensalidade)
      
      // Se não pagou este mês...
      if (!pgsMes.some(pg => pg.aluno_id === aluno.id)) {
        const venc = info.data_vencimento || 10; 
        
        // 🔥 LÓGICA CORRIGIDA: Atrasado x A Vencer
        const status = diaAtual > venc ? 'Atrasado' : 'A Vencer'
        
        // Só soma na "Inadimplência" quem REALMENTE já passou do prazo
        if (status === 'Atrasado') {
           inadimplenciaM += Number(info.valor_mensalidade)
        }
        
        pendentesTemp.push({ 
           id: aluno.id, 
           nome: aluno.nome_completo, 
           telefone: aluno.telefone, 
           valor: info.valor_mensalidade, 
           vencimento: venc, 
           status: status 
        })
      }
    })

    // Ordena: Atrasados primeiro, depois por ordem de vencimento
    pendentesTemp.sort((a, b) => {
       if (a.status === 'Atrasado' && b.status !== 'Atrasado') return -1;
       if (a.status !== 'Atrasado' && b.status === 'Atrasado') return 1;
       return a.vencimento - b.vencimento;
    })

    transMes.forEach(t => { if (t.tipo === 'Entrada') entradasM += Number(t.valor); if (t.tipo === 'Saída') saidasM += Number(t.valor) })

    const extrato = [
      ...pgsMes.map(p => {
        const nomeAluno = alunos?.find(a => a.id === p.aluno_id)?.nome_completo || 'Aluno'
        return { id: `pg-${p.id}`, data: p.data_pagamento, descricao: `Mensalidade: ${nomeAluno}`, valor: p.valor, tipo: 'Entrada', categoria: 'Mensalidade', icone: '🎤' }
      }), 
      ...transMes.map(t => ({ id: `tr-${t.id}`, data: t.data_transacao, descricao: t.descricao || t.categoria, valor: t.valor, tipo: t.tipo, categoria: t.categoria, icone: t.tipo === 'Entrada' ? '📈' : '📉' }))
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    const historicoGrafico: any[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - 1 - i, 1)
      historicoGrafico.push({
        name: d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
        mesStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        Entradas: 0,
        Saídas: 0
      })
    }

    allPagamentos?.forEach(p => {
      const d = new Date(p.data_pagamento)
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const hist = historicoGrafico.find(h => h.mesStr === mesStr)
      if (hist) hist.Entradas += Number(p.valor)
    })

    allTransacoes?.forEach(t => {
      const d = new Date(t.data_transacao)
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const hist = historicoGrafico.find(h => h.mesStr === mesStr)
      if (hist) {
        if (t.tipo === 'Entrada') hist.Entradas += Number(t.valor)
        if (t.tipo === 'Saída') hist.Saídas += Number(t.valor)
      }
    })

    const despesasCategorias: Record<string, number> = {}
    transMes.filter(t => t.tipo === 'Saída').forEach(t => {
      despesasCategorias[t.categoria] = (despesasCategorias[t.categoria] || 0) + Number(t.valor)
    })
    
    const pizzaData = Object.keys(despesasCategorias).map(key => ({
      name: key,
      value: despesasCategorias[key]
    }))

    setDadosGraficoBarra(historicoGrafico)
    setDadosGraficoPizza(pizzaData)
    setResumo({ saldoCaixa: caixaTotal, previsaoFaturamento: previsaoTotal, entradasMes: entradasM, saidasMes: saidasM, inadimplencia: inadimplenciaM })
    setAlunosPendentes(pendentesTemp); setExtratoUnificado(extrato); setLoading(false)
  }

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingConfig(true)
    const { error } = await supabase.from('configuracoes').upsert({ id: 1, chave_pix: chavePix, mensagem_pendente: msgPendente || DEFAULT_PENDENTE, mensagem_atrasado: msgAtrasado || DEFAULT_ATRASADO })
    setIsSavingConfig(false); if (error) alert("Erro: " + error.message); else { setIsConfigModalOpen(false); alert("✅ Salvo com sucesso!"); carregarDadosFinanceiros() }
  }

  const handleSalvarTransacao = async (e: React.FormEvent) => {
    e.preventDefault(); if (!tValor || Number(tValor) <= 0) return alert("Valor inválido.")
    const { error } = await supabase.from('transacoes').insert([{ tipo: tTipo, categoria: tCategoria, descricao: tDescricao, valor: parseFloat(tValor), data_transacao: tData }])
    if (error) alert("Erro: " + error.message); else { setIsModalOpen(false); setTDescricao(''); setTValor(''); setTCategoria(tTipo === 'Saída' ? 'Aluguel' : 'Investimento'); carregarDadosFinanceiros(); alert("✅ Salvo!") }
  }

  const enviarCobrancaWhatsApp = (aluno: any) => {
    if (!aluno.telefone) return alert("Sem WhatsApp cadastrado.")
    let numero = aluno.telefone.replace(/\D/g, ''); if (numero.length === 10 || numero.length === 11) numero = `55${numero}`
    const msgFinal = (aluno.status === 'Atrasado' ? msgAtrasado : msgPendente).replace(/\{\{nome\}\}/g, aluno.nome.split(' ')[0]).replace(/\{\{valor\}\}/g, aluno.valor.toString()).replace(/\{\{vencimento\}\}/g, aluno.vencimento.toString()).replace(/\{\{pix\}\}/g, chavePix || 'Chave Não Informada')
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msgFinal)}`, '_blank')
  }

  if (!isMounted) return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>
  
  const mesNome = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  const mesFormatado = mesNome.charAt(0).toUpperCase() + mesNome.slice(1)

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      
      {/* CABEÇALHO LIMPO E MODERNO */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">Financeiro</h2>
          <p className="text-slate-500 text-sm mt-1">Balanço de {mesFormatado}</p>
        </div>
        <div className="flex gap-3">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setIsConfigModalOpen(true)} className={`px-4 py-3 rounded-xl bg-white/40 backdrop-blur-md border border-white/60 font-bold text-sm text-slate-700 hover:bg-white/60 shadow-sm transition-all flex items-center gap-2`}>
            <span>⚙️</span> Configurações
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setIsModalOpen(true)} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all">
            Nova Movimentação
          </motion.button>
        </div>
      </motion.div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {[
          { color: 'cyan', icon: '🏦', label: 'Saldo Atual', value: resumo.saldoCaixa },
          { color: 'indigo', icon: '🔮', label: 'Previsão Faturamento', value: resumo.previsaoFaturamento },
          { color: 'emerald', icon: '📈', label: 'Entradas', value: resumo.entradasMes },
          { color: 'rose', icon: '📉', label: 'Saídas', value: resumo.saidasMes },
          { color: 'amber', icon: '⚠️', label: 'Inadimplência', value: resumo.inadimplencia }
        ].map((card, index) => (
          <motion.div variants={itemVariants} whileHover={{ y: -5 }} key={index} className={`bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-[2rem] shadow-sm hover:shadow-md border-l-8 border-l-${card.color}-500 relative overflow-hidden flex flex-col justify-between`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${card.color}-400/20 rounded-full blur-2xl`}></div>
            <div className="absolute -right-2 -top-2 opacity-10 text-6xl drop-shadow-sm">{card.icon}</div>
            <p className={`text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1 z-10`}>{card.label}</p>
            <p className={`text-2xl lg:text-3xl font-bold tracking-tight z-10 text-${card.color}-600 drop-shadow-sm`}>
              R$ {card.value.toFixed(2)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] lg:col-span-2`}>
          <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-cyan-500 drop-shadow-sm">📊</span> Fluxo de Caixa</h3>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGraficoBarra} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderColor: '#e2e8f0', borderRadius: '1rem', fontWeight: 'bold', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '500', color: '#475569' }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-6 md:p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
          <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-rose-500 drop-shadow-sm">🍕</span> Despesas do Mês</h3>
          <div className="w-full h-64">
            {dadosGraficoPizza.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dadosGraficoPizza} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {dadosGraficoPizza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderColor: '#e2e8f0', borderRadius: '1rem', fontWeight: 'bold', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '500', color: '#475569' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                <span className="text-4xl mb-2 grayscale opacity-50">🎈</span>
                <p className="text-sm font-medium text-slate-500">Sem despesas registradas</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* LISTAS: EXTRATO E PENDENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* EXTRATO */}
        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
          <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-emerald-500 drop-shadow-sm">📄</span> Extrato do Mês</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {extratoUnificado.map(item => (
              <motion.div whileHover={{ scale: 1.01 }} key={item.id} className={`bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-sm flex justify-between items-center hover:shadow-md transition-all`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner ${item.tipo === 'Entrada' ? 'bg-emerald-100/80 border border-emerald-200' : 'bg-rose-100/80 border border-rose-200'}`}>
                    {item.icone}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800 break-words">{item.descricao}</p>
                    <p className={`text-slate-500 text-[11px] font-medium`}>{new Date(item.data).toLocaleDateString('pt-BR')} • {item.categoria}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg tracking-tight ${item.tipo === 'Entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {item.tipo === 'Entrada' ? '+' : '-'} R$ {Number(item.valor).toFixed(2)}
                  </p>
                </div>
              </motion.div>
            ))}
            {extratoUnificado.length === 0 && <p className={`text-slate-500 text-center py-8 italic text-sm border border-dashed border-slate-300 rounded-2xl bg-white/30`}>Nenhuma movimentação neste mês.</p>}
          </div>
        </motion.div>

        {/* MENSALIDADES PENDENTES E A VENCER */}
        <motion.div variants={itemVariants} className={`bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)]`}>
          <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-3 text-slate-800"><span className="text-amber-500 drop-shadow-sm">⏳</span> Pendências</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {alunosPendentes.map(aluno => (
              <motion.div whileHover={{ scale: 1.01 }} key={aluno.id} className={`bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-sm flex items-center justify-between gap-4 group hover:shadow-md transition-all`}>
                <div>
                  <p className="font-bold text-sm text-slate-800">{aluno.nome}</p>
                  <p className={`text-slate-500 text-[11px] font-medium`}>Vencimento: Dia {aluno.vencimento}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block mr-2">
                    <p className="font-bold text-lg tracking-tight text-slate-800">R$ {aluno.valor}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border backdrop-blur-md shadow-sm ${aluno.status === 'Atrasado' ? 'bg-rose-500/10 text-rose-600 border-rose-200' : 'bg-amber-400/20 text-amber-700 border-amber-200'}`}>
                      {aluno.status}
                    </span>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => enviarCobrancaWhatsApp(aluno)} className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-lg shadow-sm" title="Lembrar via WhatsApp">💬</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.push(`/alunos/${aluno.id}`)} className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 border border-indigo-200 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center font-bold shadow-sm" title="Ir para o perfil e dar baixa">$</motion.button>
                </div>
              </motion.div>
            ))}
            {alunosPendentes.length === 0 && (
              <div className="text-center py-10 border border-dashed rounded-3xl border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md shadow-sm">
                <span className="text-4xl mb-2 block drop-shadow-sm">🎉</span>
                <p className="font-bold text-emerald-600 text-sm">Inadimplência Zero!</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* MODAL: CONFIGURAÇÕES DE COBRANÇA */}
      <AnimatePresence>
        {isConfigModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-slate-500 p-8 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar`}>
              
              <h2 className={`text-2xl font-bold tracking-tight mb-6 text-slate-800 flex items-center gap-3 drop-shadow-sm`}>
                <span>⚙️</span> Configurações de Cobrança
              </h2>
              
              <form onSubmit={handleSalvarConfig} className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Sua Chave PIX</label>
                  <input placeholder="Ex: 12.345.678/0001-90" value={chavePix} onChange={e => setChavePix(e.target.value)} className={`w-full p-4 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-medium focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner placeholder:text-slate-400 mt-1`} />
                </div>
                
                <div className="bg-indigo-50/80 backdrop-blur-md border border-indigo-200/50 p-4 rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-indigo-700 mb-2 drop-shadow-sm">💡 Variáveis Mágicas</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{nome}}`} = Nome</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{valor}}`} = Valor R$</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{vencimento}}`} = Dia</span>
                    <span className={`bg-white border border-indigo-100 px-2 py-1 rounded text-[11px] font-medium text-indigo-800 shadow-sm`}>{`{{pix}}`} = Chave</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Lembrete (Antes do Vencimento)</label>
                  <textarea value={msgPendente} onChange={e => setMsgPendente(e.target.value)} className={`w-full p-4 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-normal focus:bg-white/80 focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none shadow-inner mt-1 h-32 resize-none`} />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-600 ml-1">Aviso (Em Atraso)</label>
                  <textarea value={msgAtrasado} onChange={e => setMsgAtrasado(e.target.value)} className={`w-full p-4 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-normal focus:bg-white/80 focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none shadow-inner mt-1 h-32 resize-none`} />
                </div>
                
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsConfigModalOpen(false)} disabled={isSavingConfig} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white disabled:opacity-50`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={isSavingConfig} className="px-10 py-4 rounded-2xl bg-slate-800 text-white font-bold text-sm shadow-xl hover:bg-slate-700 transition-all disabled:opacity-50">{isSavingConfig ? 'Salvando...' : 'Salvar Alterações'}</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: NOVA MOVIMENTAÇÃO */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`bg-white/80 backdrop-blur-2xl border border-white/60 border-t-8 border-t-emerald-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative`}>
              
              <h2 className={`text-2xl font-bold tracking-tight mb-6 text-slate-800 drop-shadow-sm`}>Registro de Caixa</h2>
              
              <form onSubmit={handleSalvarTransacao} className="space-y-5">
                {(() => {
                  const inputClass = "w-full p-3.5 rounded-xl bg-white/50 border border-white/60 text-slate-800 font-medium focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner";
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 ml-1">Tipo</label>
                          <select required value={tTipo} onChange={e => { setTTipo(e.target.value); setTCategoria(e.target.value === 'Saída' ? 'Aluguel' : 'Investimento'); }} className={inputClass}>
                            <option value="Entrada">Entrada 📈</option>
                            <option value="Saída">Saída / Despesa 📉</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 ml-1">Data</label>
                          <input type="date" required value={tData} onChange={e => setTData(e.target.value)} className={inputClass} />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-slate-600 ml-1">Categoria</label>
                        <select required value={tCategoria} onChange={e => setTCategoria(e.target.value)} className={inputClass}>
                          {tTipo === 'Saída' ? (
                            <><option value="Aluguel">Aluguel</option><option value="Água">Água</option><option value="Energia">Energia</option><option value="Internet">Internet</option><option value="Compra de Material">Compra de Material</option><option value="Retirada (Salário)">Retirada (Meu Salário)</option><option value="Outros">Outras Despesas</option></>
                          ) : (
                            <><option value="Investimento">Investimento (Aporte)</option><option value="Outros">Outras Entradas</option></>
                          )}
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-slate-600 ml-1">Descrição Breve</label>
                        <input placeholder="Ex: Compra de cordas..." value={tDescricao} onChange={e => setTDescricao(e.target.value)} className={inputClass} />
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-slate-600 ml-1">Valor (R$)</label>
                        <input type="number" step="0.01" required value={tValor} onChange={e => setTValor(e.target.value)} className={`w-full p-3.5 rounded-xl bg-white/50 border border-white/60 font-bold text-xl focus:bg-white/80 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-inner ${tTipo === 'Entrada' ? 'text-emerald-600' : 'text-rose-600'}`} />
                      </div>
                    </>
                  )
                })()}

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/40">
                  <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setIsModalOpen(false)} className={`px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-white/50 border border-white/60 shadow-sm hover:bg-white`}>Cancelar</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" className="px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-xl hover:shadow-emerald-500/30 transition-all">Salvar no Caixa</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}