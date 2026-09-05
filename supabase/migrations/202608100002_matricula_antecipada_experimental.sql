-- Permite matricular antes da aula experimental sem registrar presenca antecipadamente.
-- Pode ser executada com seguranca depois de 202608100001_aulas_experimentais.sql.

alter table public.aulas_experimentais
  add column if not exists valor_cobranca numeric(12, 2),
  add column if not exists vencimento_cobranca date;

alter table public.aulas_experimentais
  drop constraint if exists aulas_experimentais_valor_cobranca_check;

alter table public.aulas_experimentais
  add constraint aulas_experimentais_valor_cobranca_check
  check (valor_cobranca is null or valor_cobranca > 0);

comment on column public.aulas_experimentais.valor_cobranca is
  'Valor escolhido na matricula antecipada para faturar depois da confirmacao de presenca.';

comment on column public.aulas_experimentais.vencimento_cobranca is
  'Vencimento escolhido para a futura fatura da aula experimental.';
