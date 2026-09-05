-- Cancelamento seguro de faturas
-- Execute depois de 202608040002_faturas_detalhadas.sql.

alter table public.faturas
  add column if not exists cancelada_em timestamptz,
  add column if not exists cancelada_por uuid references public.profiles(id) on delete set null;

drop index if exists public.faturas_fechamento_mensal_uidx;
create unique index faturas_fechamento_mensal_uidx
  on public.faturas(aluno_id, competencia, modelo_faturamento)
  where tipo_emissao = 'AUTOMATICA'
    and modelo_faturamento = 'MENSAL_FECHADO'
    and status <> 'CANCELADO';

create or replace function public.cancelar_fatura(p_fatura_id uuid)
returns public.faturas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fatura public.faturas;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  ) then
    raise exception 'Somente administradores podem cancelar faturas.';
  end if;

  select *
    into v_fatura
  from public.faturas
  where id = p_fatura_id
  for update;

  if not found then
    raise exception 'Fatura não encontrada.';
  end if;

  if v_fatura.status = 'PAGO' then
    raise exception 'Uma fatura paga não pode ser cancelada.';
  end if;

  if v_fatura.status = 'CANCELADO' then
    return v_fatura;
  end if;

  if v_fatura.provider_payment_id is not null then
    raise exception 'Esta fatura possui uma cobrança externa. Cancele a cobrança no provedor antes de cancelar a fatura.';
  end if;

  update public.historico_aulas
  set
    fatura_id = null,
    faturado_em = null
  where fatura_id = p_fatura_id;

  delete from public.fatura_itens
  where fatura_id = p_fatura_id;

  update public.faturas
  set
    status = 'CANCELADO',
    cancelada_em = now(),
    cancelada_por = auth.uid(),
    atualizado_em = now(),
    erro_integracao = null
  where id = p_fatura_id
  returning * into v_fatura;

  return v_fatura;
end;
$$;

revoke all on function public.cancelar_fatura(uuid) from public;
grant execute on function public.cancelar_fatura(uuid) to authenticated;

-- Garante que a API do Supabase reconheça a função imediatamente.
notify pgrst, 'reload schema';
