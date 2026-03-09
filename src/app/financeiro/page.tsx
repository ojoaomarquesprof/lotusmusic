"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const DEFAULT_PENDENTE = "Olá, *{{nome}}*! Tudo bem?\n\nAqui é da *Direto ao Canto*, passando para fazer um lembrete amigável que a sua mensalidade vence no próximo dia {{vencimento}}.\n\nO valor é de *R$ {{valor}}*.\nNossa chave PIX é: *{{pix}}*\n\nMuito obrigado! 🎶"
const DEFAULT_ATRASADO = "Olá, *{{nome}}*! Tudo bem?\n\nAqui é da *Direto ao Canto*, passando para avisar que a sua mensalidade (vencimento dia {{vencimento}}) consta como pendente no nosso sistema.\n\nO valor é de *R$ {{valor}}*.\nNossa chave PIX é: *{{pix}}*\n\nQualquer dúvida, é só avisar por aqui. Muito obrigado! 🎶"

const PIE_COLORS = ['#10b981', '#f43f5e', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#64748b']

export default function RelatorioFinanceiro() {
  const { s } = useStyles()
  const router = useRouter()
  
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

  useEffect(() => { carregarDadosFinanceiros() }, [])

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
      const info = Array.isArray(aluno.alunos_info) ? aluno.alunos_info[0] : aluno.alunos_info; if (!info || !info.valor_mensalidade || info.status === 'Inativo') return
      previsaoTotal += Number(info.valor_mensalidade)
      if (!pgsMes.some(pg => pg.aluno_id === aluno.id)) {
        const venc = info.data_vencimento || 10; const status = diaAtual > venc ? 'Atrasado' : 'Pendente'
        inadimplenciaM += Number(info.valor_mensalidade)
        pendentesTemp.push({ id: aluno.id, nome: aluno.nome_completo, telefone: aluno.telefone, valor: info.valor_mensalidade, vencimento: venc, status: status })
      }
    })
    pendentesTemp.sort((a, b) => (a.status === 'Atrasado' && b.status !== 'Atrasado' ? -1 : a.vencimento - b.vencimento))

    transMes.forEach(t => { if (t.tipo === 'Entrada') entradasM += Number(t.valor); if (t.tipo === 'Saída') saidasM += Number(t.valor) })

    const extrato = [
      ...pgsMes.map(p => {
        const nomeAluno = alunos?.find(a => a.id === p.aluno_id)?.nome_completo || 'Aluno'
        return { id: `pg-${p.id}`, data: p.data_pagamento, descricao: `Mensalidade: ${nomeAluno}`, valor: p.valor, tipo: 'Entrada', categoria: 'Mensalidade', icone: '🎤' }
      }), 
      ...transMes.map(t => ({ id: `tr-${t.id}`, data: t.data_transacao, descricao: t.descricao || t.categoria, valor: t.valor, tipo: t.tipo, categoria: t.categoria, icone: t.tipo === 'Entrada' ? '📈' : '📉' }))
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    // --- CORREÇÃO DO ERRO DO VS CODE AQUI (: any[]) ---
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

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>
  const mesNome = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()

  return (
    <div className="animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">Financeiro</h2>
          <p className={`${s.textMuted} text-xs font-bold uppercase tracking-widest mt-1`}>Balanço de {mesNome}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsConfigModalOpen(true)} className={`px-4 py-3 rounded-xl ${s.cardInterno} border font-black uppercase text-xs hover:border-emerald-500 transition-all flex items-center gap-2`}><span>⚙️</span> Configurações de Cobrança</button>
          <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs shadow-lg hover:scale-105 transition-all">+ Nova Movimentação</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <div className={`${s.card} p-6 rounded-[2rem] border shadow-lg border-l-8 border-l-cyan-500 relative overflow-hidden flex flex-col justify-between`}><div className="absolute -right-4 -top-4 opacity-5 text-8xl">🏦</div><p className={`${s.textMuted} text-[10px] font-black uppercase tracking-widest mb-1 z-10`}>Saldo Atual Caixa</p><p className={`text-2xl lg:text-3xl font-black z-10 ${resumo.saldoCaixa >= 0 ? 'text-cyan-500' : 'text-rose-500'}`}>R$ {resumo.saldoCaixa.toFixed(2)}</p></div>
        <div className={`${s.card} p-6 rounded-[2rem] border shadow-lg border-l-8 border-l-indigo-500 relative overflow-hidden flex flex-col justify-between`}><div className="absolute -right-4 -top-4 opacity-5 text-8xl">🔮</div><p className={`${s.textMuted} text-[10px] font-black uppercase tracking-widest mb-1 z-10`}>Previsão Faturamento</p><p className="text-2xl lg:text-3xl font-black text-indigo-500 z-10">R$ {resumo.previsaoFaturamento.toFixed(2)}</p></div>
        <div className={`${s.card} p-6 rounded-[2rem] border shadow-lg border-l-8 border-l-emerald-500 relative overflow-hidden flex flex-col justify-between`}><div className="absolute -right-4 -top-4 opacity-5 text-8xl">📈</div><p className={`${s.textMuted} text-[10px] font-black uppercase tracking-widest mb-1 z-10`}>Entradas no Mês</p><p className="text-2xl lg:text-3xl font-black text-emerald-500 z-10">R$ {resumo.entradasMes.toFixed(2)}</p></div>
        <div className={`${s.card} p-6 rounded-[2rem] border shadow-lg border-l-8 border-l-rose-500 relative overflow-hidden flex flex-col justify-between`}><div className="absolute -right-4 -top-4 opacity-5 text-8xl">📉</div><p className={`${s.textMuted} text-[10px] font-black uppercase tracking-widest mb-1 z-10`}>Saídas no Mês</p><p className="text-2xl lg:text-3xl font-black text-rose-500 z-10">R$ {resumo.saidasMes.toFixed(2)}</p></div>
        <div className={`${s.card} p-6 rounded-[2rem] border shadow-lg border-l-8 border-l-amber-500 relative overflow-hidden flex flex-col justify-between`}><div className="absolute -right-4 -top-4 opacity-5 text-8xl">⚠️</div><p className={`${s.textMuted} text-[10px] font-black uppercase tracking-widest mb-1 z-10`}>Inadimplência / A Receber</p><p className="text-2xl lg:text-3xl font-black text-amber-500 z-10">R$ {resumo.inadimplencia.toFixed(2)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className={`${s.card} p-6 md:p-8 rounded-[2.5rem] border shadow-xl lg:col-span-2`}>
          <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-3"><span className="text-cyan-500">📊</span> Fluxo de Caixa (Últimos 6 meses)</h3>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGraficoBarra} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={s.bg === 'bg-slate-950' ? '#334155' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="name" stroke={s.bg === 'bg-slate-950' ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={s.bg === 'bg-slate-950' ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip cursor={{fill: s.bg === 'bg-slate-950' ? '#1e293b' : '#f1f5f9'}} contentStyle={{ backgroundColor: s.bg === 'bg-slate-950' ? '#0f172a' : '#ffffff', borderColor: s.bg === 'bg-slate-950' ? '#334155' : '#e2e8f0', borderRadius: '1rem', fontWeight: 'bold', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${s.card} p-6 md:p-8 rounded-[2.5rem] border shadow-xl`}>
          <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-3"><span className="text-rose-500">🍕</span> Despesas do Mês</h3>
          <div className="w-full h-64">
            {dadosGraficoPizza.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dadosGraficoPizza} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {dadosGraficoPizza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} contentStyle={{ backgroundColor: s.bg === 'bg-slate-950' ? '#0f172a' : '#ffffff', borderColor: s.bg === 'bg-slate-950' ? '#334155' : '#e2e8f0', borderRadius: '1rem', fontWeight: 'bold', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                <span className="text-4xl mb-2">🎈</span>
                <p className="text-xs font-black uppercase tracking-widest">Sem despesas registradas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${s.card} p-8 rounded-[2.5rem] border shadow-xl`}><h3 className="text-lg font-black uppercase mb-6 flex items-center gap-3"><span className="text-emerald-500">📄</span> Extrato do Mês</h3><div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">{extratoUnificado.map(item => (<div key={item.id} className={`${s.cardInterno} p-4 rounded-2xl border flex justify-between items-center hover:border-emerald-500/30 transition-all`}><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${item.tipo === 'Entrada' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>{item.icone}</div><div><p className="font-black text-sm uppercase break-words">{item.descricao}</p><p className={`${s.textMuted} text-[10px] font-bold uppercase`}>{new Date(item.data).toLocaleDateString('pt-BR')} • {item.categoria}</p></div></div><div className="text-right"><p className={`font-black text-lg ${item.tipo === 'Entrada' ? 'text-emerald-500' : 'text-rose-500'}`}>{item.tipo === 'Entrada' ? '+' : '-'} R$ {Number(item.valor).toFixed(2)}</p></div></div>))}{extratoUnificado.length === 0 && <p className={`${s.textMuted} text-center py-8 italic text-sm border border-dashed rounded-2xl`}>Nenhuma movimentação neste mês.</p>}</div></div>
        <div className={`${s.card} p-8 rounded-[2.5rem] border shadow-xl`}><h3 className="text-lg font-black uppercase mb-6 flex items-center gap-3"><span className="text-amber-500">⏳</span> Mensalidades Pendentes</h3><div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">{alunosPendentes.map(aluno => (<div key={aluno.id} className={`${s.cardInterno} p-5 rounded-2xl border flex items-center justify-between gap-4 group`}><div><p className="font-black text-sm uppercase">{aluno.nome}</p><p className={`${s.textMuted} text-[10px] font-bold uppercase`}>Vencimento: Dia {aluno.vencimento}</p></div><div className="flex items-center gap-2"><div className="text-right hidden sm:block mr-2"><p className="font-black text-lg">R$ {aluno.valor}</p><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${aluno.status === 'Atrasado' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>{aluno.status}</span></div><button onClick={() => enviarCobrancaWhatsApp(aluno)} className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-lg shadow-sm" title="Lembrar via WhatsApp">💬</button><button onClick={() => router.push(`/alunos/${aluno.id}`)} className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center font-black shadow-sm" title="Ir para o perfil e dar baixa">$</button></div></div>))}{alunosPendentes.length === 0 && <div className="text-center py-10 border border-dashed rounded-3xl border-emerald-500/30 bg-emerald-500/5"><span className="text-4xl mb-2 block">🎉</span><p className="font-black text-emerald-500 uppercase tracking-widest text-xs">Inadimplência Zero!</p></div>}</div></div>
      </div>

      {isConfigModalOpen && (<div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in"><div className={`${s.card} border-t-8 border-t-slate-500 p-8 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar`}><h2 className={`text-2xl font-black mb-6 ${s.text} uppercase italic flex items-center gap-3`}><span>⚙️</span> Configurações de Cobrança</h2><form onSubmit={handleSalvarConfig} className="space-y-6"><div><label className="text-[10px] font-black opacity-50 ml-1 uppercase tracking-widest text-emerald-500">Sua Chave PIX</label><input placeholder="Ex: 12.345.678/0001-90" value={chavePix} onChange={e => setChavePix(e.target.value)} className={`w-full p-4 rounded-xl border font-bold text-sm mt-1 ${s.input}`} /></div><div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl"><p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-2">💡 Variáveis Mágicas</p><div className="flex flex-wrap gap-2"><span className={`${s.cardInterno} px-2 py-1 rounded text-[10px] font-bold`}>{`{{nome}}`} = Nome</span><span className={`${s.cardInterno} px-2 py-1 rounded text-[10px] font-bold`}>{`{{valor}}`} = Valor R$</span><span className={`${s.cardInterno} px-2 py-1 rounded text-[10px] font-bold`}>{`{{vencimento}}`} = Dia</span><span className={`${s.cardInterno} px-2 py-1 rounded text-[10px] font-bold`}>{`{{pix}}`} = Chave</span></div></div><div><label className="text-[10px] font-black opacity-50 ml-1 uppercase tracking-widest text-amber-500">Lembrete (Antes do Vencimento)</label><textarea value={msgPendente} onChange={e => setMsgPendente(e.target.value)} className={`w-full p-4 rounded-xl border font-normal text-sm mt-1 h-32 resize-none ${s.input}`} /></div><div><label className="text-[10px] font-black opacity-50 ml-1 uppercase tracking-widest text-rose-500">Aviso (Em Atraso)</label><textarea value={msgAtrasado} onChange={e => setMsgAtrasado(e.target.value)} className={`w-full p-4 rounded-xl border font-normal text-sm mt-1 h-32 resize-none ${s.input}`} /></div><div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-500/10"><button type="button" onClick={() => setIsConfigModalOpen(false)} disabled={isSavingConfig} className={`px-6 py-3 rounded-xl font-black uppercase text-xs ${s.text} hover:bg-slate-500/10 disabled:opacity-50`}>Cancelar</button><button type="submit" disabled={isSavingConfig} className="px-10 py-4 rounded-2xl bg-slate-800 text-white font-black uppercase text-xs shadow-xl hover:scale-105 transition-all disabled:opacity-50">{isSavingConfig ? 'Salvando...' : 'Salvar Alterações'}</button></div></form></div></div>)}
      {isModalOpen && (<div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in"><div className={`${s.card} border-t-8 border-t-emerald-500 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative`}><h2 className={`text-2xl font-black mb-6 ${s.text} uppercase italic`}>Registro de Caixa</h2><form onSubmit={handleSalvarTransacao} className="space-y-5"><div className="grid grid-cols-2 gap-4"><div><label className="text-[9px] font-bold opacity-50 ml-1 uppercase">Tipo</label><select required value={tTipo} onChange={e => { setTTipo(e.target.value); setTCategoria(e.target.value === 'Saída' ? 'Aluguel' : 'Investimento'); }} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`}><option value="Entrada">Entrada 📈</option><option value="Saída">Saída / Despesa 📉</option></select></div><div><label className="text-[9px] font-bold opacity-50 ml-1 uppercase">Data</label><input type="date" required value={tData} onChange={e => setTData(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div></div><div><label className="text-[9px] font-bold opacity-50 ml-1 uppercase">Categoria</label><select required value={tCategoria} onChange={e => setTCategoria(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`}>{tTipo === 'Saída' ? (<><option value="Aluguel">Aluguel</option><option value="Água">Água</option><option value="Energia">Energia</option><option value="Internet">Internet</option><option value="Compra de Material">Compra de Material</option><option value="Retirada (Salário)">Retirada (Meu Salário)</option><option value="Outros">Outras Despesas</option></>) : (<><option value="Investimento">Investimento (Aporte)</option><option value="Outros">Outras Entradas</option></>)}</select></div><div><label className="text-[9px] font-bold opacity-50 ml-1 uppercase">Descrição Breve</label><input placeholder="Ex: Compra de cordas..." value={tDescricao} onChange={e => setTDescricao(e.target.value)} className={`w-full p-3.5 rounded-xl border font-bold text-sm ${s.input}`} /></div><div><label className="text-[9px] font-bold opacity-50 ml-1 uppercase">Valor (R$)</label><input type="number" step="0.01" required value={tValor} onChange={e => setTValor(e.target.value)} className={`w-full p-3.5 rounded-xl border font-black text-xl ${tTipo === 'Entrada' ? 'text-emerald-500' : 'text-rose-500'} ${s.input}`} /></div><div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-500/10"><button type="button" onClick={() => setIsModalOpen(false)} className={`px-6 py-3 rounded-xl font-black uppercase text-xs ${s.text} hover:bg-slate-500/10`}>Cancelar</button><button type="submit" className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase text-xs shadow-xl hover:scale-105 transition-all">Salvar no Caixa</button></div></form></div></div>)}
    </div>
  )
}