"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const accessHighlights = [
  { icon: CalendarDays, label: 'Agenda e operação diária' },
  { icon: WalletCards, label: 'Financeiro em um só lugar' },
  { icon: GraduationCap, label: 'Alunos, turmas e estudos' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const router = useRouter()

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })

    if (authError) {
      setErrorMessage('E-mail ou senha incorretos. Confira os dados e tente novamente.')
      setLoading(false)
      return
    }

    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      router.replace(profile?.role === 'ALUNO' ? '/portal' : '/')
      router.refresh()
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f2f1ec] px-4 py-5 text-[#17231e] sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-44 -top-52 h-[34rem] w-[34rem] rounded-full bg-[#dce7df] blur-[110px]" />
        <div className="absolute -bottom-64 -right-44 h-[38rem] w-[38rem] rounded-full bg-[#eadcc5]/70 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/80" />
      </div>

      <motion.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative mx-auto grid w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-[#d9d8d1] bg-[#fffefa] shadow-[0_28px_80px_rgba(20,39,31,0.12)] min-[960px]:min-h-[680px] min-[960px]:grid-cols-[1.06fr_0.94fr]"
      >
        <section className="relative hidden overflow-hidden bg-[#15362b] p-12 text-white min-[960px]:flex min-[960px]:flex-col min-[960px]:justify-between">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -right-32 -top-24 h-80 w-80 rounded-full border border-white/[0.07]" />
            <div className="absolute -right-20 -top-12 h-56 w-56 rounded-full border border-white/[0.07]" />
            <div className="absolute bottom-[-12rem] left-[-9rem] h-[28rem] w-[28rem] rounded-full bg-[#b98b4f]/15 blur-3xl" />
          </div>

          <div className="relative">
            <div className="mx-auto flex h-[170px] w-full max-w-[430px] items-center justify-center">
              <Image src="/logo-horizontal-verde.png" alt="Lótus Music — Escola de Música" width={430} height={173} className="h-auto w-full object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.16)]" priority />
            </div>

            <div className="mt-7 max-w-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d4b47e]">Gestão Lótus Music</p>
              <h1 className="mt-4 text-[42px] font-semibold leading-[1.08] tracking-[-0.045em] text-white">
                A escola inteira,<br />em um só ritmo.
              </h1>
              <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/62">
                Agenda, relacionamento e financeiro conectados para uma rotina mais simples e profissional.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {accessHighlights.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm font-medium text-white/78">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#d4b47e]">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-white/42">
            <ShieldCheck size={15} /> Acesso seguro para equipe e alunos
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-2.5rem)] items-center px-5 py-9 sm:px-12 sm:py-12 min-[960px]:min-h-0 min-[960px]:px-14">
          <div className="mx-auto w-full max-w-[410px]">
            <div className="mb-9 flex items-center justify-between min-[960px]:hidden">
              <div className="flex h-[100px] w-[176px] items-center justify-center rounded-2xl border border-[#e1dfd7] bg-white shadow-sm">
                <Image src="/logo.png" alt="Lótus Music — Escola de Música" width={88} height={88} className="h-[88px] w-[88px] object-contain" priority />
              </div>
              <span className="rounded-full border border-[#d8ddd8] bg-[#edf3ef] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1f4a3a]">
                Área segura
              </span>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b18147]">Área de acesso</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#17231e] sm:text-[36px]">Bem-vindo de volta</h2>
              <p className="mt-3 text-sm leading-6 text-[#69736e]">Entre com seus dados para acessar seu ambiente Lótus Music.</p>
            </div>

            <form onSubmit={handleLogin} className="mt-9 space-y-5" noValidate>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#4e5d56]">E-mail</span>
                <span className="relative block">
                  <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7f8d86]" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); setErrorMessage('') }}
                    placeholder="seuemail@exemplo.com"
                    className="h-13 w-full rounded-xl border border-[#d8d6ce] bg-white pl-11 pr-4 text-sm font-medium text-[#17231e] outline-none transition placeholder:text-[#a3aaa6] focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#4e5d56]">Senha</span>
                <span className="relative block">
                  <LockKeyhole size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7f8d86]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={senha}
                    onChange={(event) => { setSenha(event.target.value); setErrorMessage('') }}
                    placeholder="Digite sua senha"
                    className="h-13 w-full rounded-xl border border-[#d8d6ce] bg-white pl-11 pr-12 text-sm font-medium text-[#17231e] outline-none transition placeholder:text-[#a3aaa6] focus:border-[#1f4a3a] focus:ring-4 focus:ring-[#1f4a3a]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(current => !current)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#7f8d86] transition hover:bg-[#edf3ef] hover:text-[#1f4a3a]"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              <div className="flex min-h-5 items-start justify-between gap-4">
                <div aria-live="polite" className="text-xs font-medium leading-5 text-[#a24a4a]">
                  {errorMessage}
                </div>
                <Link href="/esqueci-senha" className="shrink-0 text-xs font-semibold text-[#1f4a3a] transition hover:text-[#b18147]">
                  Esqueci minha senha
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !senha}
                className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#1f4a3a] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(31,74,58,0.18)] transition hover:bg-[#17382c] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? (
                  <><Loader2 size={17} className="animate-spin" /> Entrando...</>
                ) : (
                  <>Entrar no sistema <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" /></>
                )}
              </button>
            </form>

            <div className="mt-9 border-t border-[#e5e2da] pt-5 text-center">
              <p className="flex items-center justify-center gap-2 text-[11px] text-[#7b8580]">
                <ShieldCheck size={14} className="text-[#1f4a3a]" /> Seus dados são protegidos durante o acesso.
              </p>
            </div>
          </div>
        </section>
      </motion.main>
    </div>
  )
}
