-- Aulas experimentais e conversao em matricula
-- Execute depois de 202608070002_reposicoes_e_pagamentos_informados.sql.

create table if not exists public.aulas_experimentais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  data_aula date not null,
  horario_inicio time not null,
  horario_fim time not null,
  modalidade text,
  professor_id uuid references public.profiles(id) on delete set null,
  sala_id bigint,
  observacoes text,
  status text not null default 'AGENDADA',
  aluno_id uuid references public.profiles(id) on delete set null,
  cobrar_na_matricula boolean,
  valor_cobranca numeric(12, 2),
  vencimento_cobranca date,
  historico_aula_id text,
  matriculada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint aulas_experimentais_nome_check check (length(trim(nome)) >= 2),
  constraint aulas_experimentais_telefone_check check (length(regexp_replace(telefone, '\D', '', 'g')) >= 10),
  constraint aulas_experimentais_horario_check check (horario_fim > horario_inicio),
  constraint aulas_experimentais_valor_cobranca_check check (valor_cobranca is null or valor_cobranca > 0),
  constraint aulas_experimentais_status_check check (
    status in ('AGENDADA', 'REALIZADA', 'FALTOU', 'CANCELADA', 'MATRICULADA')
  )
);

create index if not exists aulas_experimentais_agenda_idx
  on public.aulas_experimentais(data_aula, horario_inicio, status);

create index if not exists aulas_experimentais_aluno_idx
  on public.aulas_experimentais(aluno_id)
  where aluno_id is not null;

alter table public.aulas_experimentais enable row level security;

drop policy if exists "Equipe visualiza aulas experimentais" on public.aulas_experimentais;
create policy "Equipe visualiza aulas experimentais"
on public.aulas_experimentais for select
to authenticated
using (public.pode_gerenciar_turmas());

drop policy if exists "Equipe gerencia aulas experimentais" on public.aulas_experimentais;
create policy "Equipe gerencia aulas experimentais"
on public.aulas_experimentais for all
to authenticated
using (public.pode_gerenciar_turmas())
with check (public.pode_gerenciar_turmas());

grant select, insert, update, delete on public.aulas_experimentais to authenticated;

comment on table public.aulas_experimentais is
  'Agenda simplificada de interessados antes da matricula completa.';

comment on column public.aulas_experimentais.cobrar_na_matricula is
  'Decisao tomada na conversao: emitir ou nao uma fatura avulsa pela aula experimental.';
