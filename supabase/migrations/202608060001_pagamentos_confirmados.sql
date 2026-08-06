-- Distingue previsoes financeiras de pagamentos efetivamente recebidos.
-- Execute depois de 202608040003_cancelamento_faturas.sql.

alter table public.pagamentos
  alter column status set default 'Pendente';

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
  v_creditos_comprados integer;
  v_aulas_consumidas integer;
begin
  select modelo_faturamento, modelo_faturamento_desde, creditos_por_pagamento
    into v_modelo, v_desde, v_creditos_por_pagamento
  from public.alunos_info
  where id = p_aluno_id;

  if v_modelo is distinct from 'CREDITOS' then
    return;
  end if;

  select count(*) * v_creditos_por_pagamento
    into v_creditos_comprados
  from public.pagamentos
  where aluno_id = p_aluno_id
    and data_pagamento::date >= v_desde
    and lower(trim(coalesce(status, ''))) in ('pago', 'recebido', 'received', 'confirmed', 'confirmado');

  select count(*)
    into v_aulas_consumidas
  from public.historico_aulas
  where aluno_id = p_aluno_id
    and data_aula::date >= v_desde
    and status in ('Realizada', 'Reposição');

  update public.alunos_info
  set saldo_creditos_faturamento = coalesce(v_creditos_comprados, 0) - coalesce(v_aulas_consumidas, 0)
  where id = p_aluno_id;
end;
$$;
