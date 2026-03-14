import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      nome_completo, email, senha, role, telefone, cpf, data_nascimento, 
      cep, endereco, numero, complemento, bairro, cidade, estado, avatar_url,
      modalidades 
    } = body

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Cria o usuário na tabela de autenticação
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome_completo: nome_completo,
        role: role
      }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Aguarda 1 segundo para garantir que a trigger automática do Supabase tenha tempo de agir (evita Race Condition)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Usa o .upsert em vez do .update e ADICIONA o campo de email que estava faltando
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        email: email, // 🔥 AQUI ESTÁ A CORREÇÃO!
        nome_completo, 
        role, 
        telefone, 
        cpf, 
        data_nascimento: data_nascimento || null, 
        cep, 
        endereco, 
        numero, 
        complemento, 
        bairro, 
        cidade, 
        estado, 
        avatar_url,
        modalidades 
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Membro criado com sucesso' }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}