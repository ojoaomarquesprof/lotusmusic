import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Puxa as variáveis de ambiente (URL pública e a Chave Mestra Secreta)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cria um cliente "Poderoso" que ignora as regras de segurança padrão
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false // Impede que essa ação mude a sessão atual no navegador
  }
})

export async function POST(request: Request) {
  try {
    const { email, password, nome } = await request.json()

    // Cria o usuário na tabela secreta de Autenticação do Supabase
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Já cria confirmado
      user_metadata: { name: nome }
    })

    if (error) throw error

    return NextResponse.json({ user: data.user })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}