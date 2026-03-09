import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // 👇 Adicionamos a variável 'modalidades' aqui
    const { 
      nome_completo, email, senha, role, telefone, cpf, data_nascimento, 
      cep, endereco, numero, complemento, bairro, cidade, estado, avatar_url,
      modalidades 
    } = body

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 👇 Salvamos as modalidades no perfil recém criado
    const { error: profileError } = await supabaseAdmin.from('profiles').update({
        nome_completo, role, telefone, cpf, 
        data_nascimento: data_nascimento || null, 
        cep, endereco, numero, complemento, bairro, cidade, estado, avatar_url,
        modalidades 
    }).eq('id', authData.user.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Membro criado com sucesso' }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}