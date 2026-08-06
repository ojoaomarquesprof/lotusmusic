-- Gestão manual e auditável de cobranças
-- Execute após 202608060002_dossie_financeiro.sql.

create table if not exists public.ajustes_cobranca (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  competencia date not null,
  modelo_faturamento text not null,
  tipo text not null,
  valor_ajustado numeric(12, 2),
  vencimento_ajustado date,
  motivo text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ajustes_cobranca_tipo_check
    check (tipo in ('AJUSTAR', 'IGNORAR')),
  constraint ajustes_cobranca_modelo_check
    check (modelo_faturamento in ('MENSAL_FECHADO', 'VENCIMENTO_FIXO')),
  constraint ajustes_cobranca_valor_check
    check (valor_ajustado is null or valor_ajustado >= 0),
  constraint ajustes_cobranca_unico
    unique (aluno_id, competencia, modelo_faturamento)
);

create index if not exists ajustes_cobranca_aluno_idx
  on public.ajustes_cobranca(aluno_id, competencia);

comment on table public.ajustes_cobranca is
  'Correções e exclusões lógicas de competências, preservando o histórico financeiro.';
