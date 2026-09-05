import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Erro desconhecido.')
  }
  return 'Não foi possível cancelar a fatura.'
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const authorization = request.headers.get('authorization')
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!token) {
      return Response.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
    }
    if (!url || !anonKey) {
      return Response.json(
        { error: 'A conexão pública com o Supabase não está configurada.' },
        { status: 500 },
      )
    }

    const database = createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await database.auth.getUser(token)
    if (userError || !user) {
      return Response.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
    }

    const { data: profile } = await database
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'ADMIN') {
      return Response.json(
        { error: 'Somente administradores podem cancelar faturas.' },
        { status: 403 },
      )
    }

    const { id } = await context.params
    const { data: invoice, error } = await database.rpc('cancelar_fatura', {
      p_fatura_id: id,
    })

    if (error) {
      const message = getErrorMessage(error)
      const missingDatabaseUpdate =
        error.code === 'PGRST202' ||
        message.includes('schema cache') ||
        message.includes('cancelar_fatura')

      if (missingDatabaseUpdate) {
        return Response.json(
          {
            error:
              'O cancelamento ainda não foi instalado no Supabase. Execute a migração 202608040003_cancelamento_faturas.sql e tente novamente.',
          },
          { status: 503 },
        )
      }

      const conflict =
        message.includes('paga') ||
        message.includes('cobrança externa') ||
        message.includes('provedor')
      return Response.json({ error: message }, { status: conflict ? 409 : 500 })
    }

    return Response.json({ success: true, invoice })
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
