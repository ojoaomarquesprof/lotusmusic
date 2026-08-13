-- Corrige saldo de creditos quando reposicoes ou status com variacao de caixa
-- foram contabilizados como aulas consumidas.

create or replace function public.recalcular_saldo_creditos_faturamento(p_aluno_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_modelo text;
  v_desde date;
  v_creditos_por_pagamento integer;
  v_creditos_comprados integer := 0;
  v_aulas_consumidas integer := 0;
begin
  select modelo_faturamento, modelo_faturamento_desde, creditos_por_pagamento
    into v_modelo, v_desde, v_creditos_por_pagamento
  from public.alunos_info
  where id = p_aluno_id;

  if v_modelo is distinct from 'CREDITOS' then
    return;
  end if;

  -- Cada pagamento confirmado compra um pacote inteiro de creditos.
  select count(*) * coalesce(v_creditos_por_pagamento, 4)
    into v_creditos_comprados
  from public.pagamentos
  where aluno_id = p_aluno_id
    and data_pagamento::date >= coalesce(v_desde, '1900-01-01'::date)
    and upper(trim(coalesce(status, ''))) in (
      'PAGO', 'RECEBIDO', 'RECEIVED', 'CONFIRMED', 'CONFIRMADO'
    );

  -- Somente presenca efetivamente realizada consome credito.
  -- Reposicao, falta, desmarcacao e ajustes nao consomem o pacote.
  select count(*)
    into v_aulas_consumidas
  from public.historico_aulas
  where aluno_id = p_aluno_id
    and data_aula::date >= coalesce(v_desde, '1900-01-01'::date)
    and upper(trim(coalesce(status, ''))) = 'REALIZADA';

  update public.alunos_info
  set saldo_creditos_faturamento = coalesce(v_creditos_comprados, 0)
    - coalesce(v_aulas_consumidas, 0)
  where id = p_aluno_id;
end;
$$;

-- Recalcula os saldos existentes imediatamente apos a atualizacao da regra.
do $$
declare
  v_aluno record;
begin
  for v_aluno in
    select id
    from public.alunos_info
    where modelo_faturamento = 'CREDITOS'
  loop
    perform public.recalcular_saldo_creditos_faturamento(v_aluno.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
