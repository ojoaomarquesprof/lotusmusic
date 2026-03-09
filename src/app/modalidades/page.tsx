"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useStyles } from '../../lib/useStyles'

export default function ModalidadesPage() {
  const { s, isDark, toggleTheme } = useStyles()
  const [modalidades, setModalidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [novaModalidade, setNovaModalidade] = useState('')
  const router = useRouter()

  useEffect(() => { carregarModalidades() }, [])

  async function carregarModalidades() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')
    const { data } = await supabase.from('modalidades').select('*').order('nome')
    if (data) setModalidades(data)
    setLoading(false)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaModalidade.trim()) return
    const { error } = await supabase.from('modalidades').insert([{ nome: novaModalidade.trim() }])
    if (error) alert(error.message)
    else { setNovaModalidade(''); carregarModalidades(); }
  }

  const handleDeletar = async (id: number) => {
    if(!confirm("Excluir esta modalidade?")) return
    const { error } = await supabase.from('modalidades').delete().eq('id', id)
    if (error) alert(error.message)
    else carregarModalidades()
  }

  if (loading) return <div className={`min-h-screen ${s.bg} flex justify-center items-center`}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>

  return (
    <div className={`min-h-screen ${s.bg} ${s.text} p-8 font-sans transition-colors duration-500`}>
      <div className={`flex flex-col md:flex-row justify-between items-center mb-10 backdrop-blur-md p-6 rounded-2xl border ${s.card} shadow-xl`}>
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Cursos</h1>
          <p className={`${s.textMuted} mt-1 font-medium`}>Direto ao Canto • Modalidades</p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <button onClick={toggleTheme} className={`relative inline-flex h-8 w-14 items-center rounded-full ${s.chaveBg} shadow-inner`}>
            <span className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full transition-transform duration-300 ${s.chaveBola}`}><span className="text-xs">{s.icone}</span></span>
          </button>
          <button onClick={() => router.push('/professores')} className={`px-5 py-2.5 rounded-xl ${s.cardInterno} border font-semibold hover:-translate-y-0.5 transition-all`}>Voltar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={`${s.card} p-8 rounded-2xl border shadow-xl h-fit`}>
           <h2 className="text-2xl font-bold mb-6">Novo Curso</h2>
           <form onSubmit={handleSalvar} className="flex gap-4">
             <input required value={novaModalidade} onChange={e => setNovaModalidade(e.target.value)} className={`flex-1 p-3.5 rounded-xl border ${s.input}`} placeholder="Ex: Bateria" />
             <button type="submit" className="bg-emerald-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20">Adicionar</button>
           </form>
        </div>

        <div className={`${s.card} p-8 rounded-2xl border shadow-xl`}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">Lista <span className="text-sm bg-indigo-500/20 text-indigo-500 px-2 py-1 rounded-full">{modalidades.length}</span></h2>
          <div className="space-y-3">
            {modalidades.map(m => (
              <div key={m.id} className={`flex justify-between items-center ${s.cardInterno} p-4 rounded-xl border hover:border-indigo-500/30 transition-all group`}>
                <span className="font-bold">{m.nome}</span>
                <button onClick={() => handleDeletar(m.id)} className="px-4 py-2 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all font-bold">Excluir</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}