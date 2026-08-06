-- Dossiê financeiro por competência
-- Execute após 202608060001_pagamentos_confirmados.sql.

alter table public.alunos_info
  add column if not exists inicio_faturamento date;

alter table public.pagamentos
  add column if not exists competencia date;

update public.pagamentos
set competencia = date_trunc('month', data_pagamento::date)::date
where competencia is null;

update public.alunos_info as ai
set inicio_faturamento = least(
  coalesce(ai.inicio_faturamento, date_trunc('month', current_date)::date),
  (
    select min(date_trunc('month', p.competencia)::date)
    from public.pagamentos p
    where p.aluno_id = ai.id
  ),
  (
    select date_trunc('month', pr.created_at)::date
    from public.profiles pr
    where pr.id = ai.id
  ),
  date_trunc('month', ai.modelo_faturamento_desde)::date,
  date_trunc('month', current_date)::date
)
where ai.inicio_faturamento is null;

-- Nas instalações existentes, o modelo atual já era usado antes da criação
-- do campo "modelo_faturamento_desde". Alinhamos a data sem afetar trocas futuras.
update public.alunos_info
set modelo_faturamento_desde = least(modelo_faturamento_desde, inicio_faturamento)
where inicio_faturamento is not null;

create or replace function public.ajustar_troca_modelo_faturamento()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.modelo_faturamento is distinct from old.modelo_faturamento then
    new.modelo_faturamento_desde := current_date;
    new.inicio_faturamento := date_trunc('month', current_date)::date;
    new.saldo_creditos_faturamento := 0;
  end if;
  return new;
end;
$$;

alter table public.alunos_info
  alter column inicio_faturamento set default date_trunc('month', current_date)::date;

create index if not exists pagamentos_aluno_competencia_idx
  on public.pagamentos(aluno_id, competencia);

comment on column public.alunos_info.inicio_faturamento is
  'Primeira competência que deve aparecer no dossiê financeiro do aluno.';

comment on column public.pagamentos.competencia is
  'Mês de referência quitado pelo pagamento, sempre armazenado no primeiro dia do mês.';
