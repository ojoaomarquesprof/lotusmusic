-- Turmas, participantes e aulas coletivas
-- Execute após 202608060004_exclusao_cobrancas.sql.

create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  modalidade text not null,
  professor_id uuid not null references public.profiles(id) on delete restrict,
  dia text not null,
  horario_inicio time not null,
  horario_fim time not null,
  endereco text not null,
  valor_mensal_total numeric(12, 2) not null,
  aulas_previstas_mes integer not null default 4,
  status text not null default 'ATIVA',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint turmas_nome_check check (length(trim(nome)) >= 2),
  constraint turmas_dia_check check (dia in ('Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado')),
  constraint turmas_horario_check check (horario_fim > horario_inicio),
  constraint turmas_valor_check check (valor_mensal_total > 0),
  constraint turmas_aulas_previstas_check check (aulas_previstas_mes between 1 and 12),
  constraint turmas_status_check check (status in ('ATIVA', 'INATIVA'))
);

create table if not exists public.turma_alunos (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  inicio_em date not null default current_date,
  fim_em date,
  status text not null default 'ATIVO',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint turma_alunos_status_check check (status in ('ATIVO', 'INATIVO')),
  constraint turma_alunos_periodo_check check (fim_em is null or fim_em >= inicio_em),
  constraint turma_alunos_unico unique (turma_id, aluno_id)
);

create table if not exists public.turma_aulas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  data_aula date not null,
  status text not null default 'REALIZADA',
  observacoes text,
  valor_mensal_snapshot numeric(12, 2) not null,
  participantes_snapshot integer not null,
  aulas_previstas_snapshot integer not null,
  valor_aluno_aula numeric(12, 2) not null,
  criado_em timestamptz not null default now(),
  constraint turma_aulas_status_check check (status in ('REALIZADA', 'CANCELADA')),
  constraint turma_aulas_participantes_check check (participantes_snapshot > 0),
  constraint turma_aulas_previstas_check check (aulas_previstas_snapshot > 0),
  constraint turma_aulas_valores_check check (
    valor_mensal_snapshot > 0 and valor_aluno_aula >= 0
  ),
  constraint turma_aulas_unica unique (turma_id, data_aula)
);

create index if not exists turmas_agenda_idx
  on public.turmas(status, dia, horario_inicio);

create index if not exists turma_alunos_aluno_idx
  on public.turma_alunos(aluno_id, status);

create index if not exists turma_aulas_turma_data_idx
  on public.turma_aulas(turma_id, data_aula);

alter table public.historico_aulas
  add column if not exists turma_id uuid references public.turmas(id) on delete set null,
  add column if not exists turma_aula_id uuid references public.turma_aulas(id) on delete cascade,
  add column if not exists valor_aula_faturado numeric(12, 2);

create unique index if not exists historico_aulas_turma_aluno_uidx
  on public.historico_aulas(turma_aula_id, aluno_id)
  where turma_aula_id is not null;

alter table public.faturas
  add column if not exists turma_id uuid references public.turmas(id) on delete set null;

drop index if exists public.faturas_fechamento_mensal_uidx;

create unique index if not exists faturas_fechamento_mensal_uidx
  on public.faturas (
    aluno_id,
    competencia,
    modelo_faturamento,
    coalesce(turma_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where tipo_emissao = 'AUTOMATICA'
    and modelo_faturamento = 'MENSAL_FECHADO';

create or replace function public.pode_gerenciar_turmas()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('ADMIN', 'PROFESSOR')
  );
$$;

create or replace function public.pode_acessar_turma(p_turma_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.pode_gerenciar_turmas()
    or exists (
      select 1
      from public.turma_alunos
      where turma_id = p_turma_id
        and aluno_id = auth.uid()
        and status = 'ATIVO'
    );
$$;

create or replace function public.registrar_aula_turma(
  p_turma_id uuid,
  p_data_aula date,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_turma public.turmas%rowtype;
  v_turma_aula_id uuid;
  v_participantes integer;
  v_valor_aluno numeric(12, 2);
begin
  if not public.pode_gerenciar_turmas() then
    raise exception 'Somente a equipe pode registrar aulas de turma.';
  end if;

  select *
    into v_turma
  from public.turmas
  where id = p_turma_id
    and status = 'ATIVA';

  if not found then
    raise exception 'Turma ativa não encontrada.';
  end if;

  select count(*)
    into v_participantes
  from public.turma_alunos
  where turma_id = p_turma_id
    and status = 'ATIVO'
    and inicio_em <= p_data_aula
    and (fim_em is null or fim_em >= p_data_aula);

  if v_participantes = 0 then
    raise exception 'A turma não possui participantes ativos nesta data.';
  end if;

  v_valor_aluno := round(
    v_turma.valor_mensal_total / v_participantes / v_turma.aulas_previstas_mes,
    2
  );

  insert into public.turma_aulas (
    turma_id,
    data_aula,
    status,
    observacoes,
    valor_mensal_snapshot,
    participantes_snapshot,
    aulas_previstas_snapshot,
    valor_aluno_aula
  ) values (
    p_turma_id,
    p_data_aula,
    'REALIZADA',
    nullif(trim(coalesce(p_observacoes, '')), ''),
    v_turma.valor_mensal_total,
    v_participantes,
    v_turma.aulas_previstas_mes,
    v_valor_aluno
  )
  returning id into v_turma_aula_id;

  insert into public.historico_aulas (
    aluno_id,
    data_aula,
    horario_inicio,
    horario_fim,
    status,
    observacoes,
    professor_id,
    modalidade,
    turma_id,
    turma_aula_id,
    valor_aula_faturado
  )
  select
    participante.aluno_id,
    p_data_aula,
    v_turma.horario_inicio,
    v_turma.horario_fim,
    'Realizada',
    coalesce(
      nullif(trim(coalesce(p_observacoes, '')), ''),
      'Aula coletiva realizada — ' || v_turma.nome
    ),
    v_turma.professor_id,
    v_turma.modalidade,
    v_turma.id,
    v_turma_aula_id,
    v_valor_aluno
  from public.turma_alunos participante
  where participante.turma_id = p_turma_id
    and participante.status = 'ATIVO'
    and participante.inicio_em <= p_data_aula
    and (participante.fim_em is null or participante.fim_em >= p_data_aula);

  return jsonb_build_object(
    'turma_aula_id', v_turma_aula_id,
    'participantes', v_participantes,
    'valor_por_aluno', v_valor_aluno
  );
exception
  when unique_violation then
    raise exception 'Esta aula da turma já foi registrada.';
end;
$$;

alter table public.turmas enable row level security;
alter table public.turma_alunos enable row level security;
alter table public.turma_aulas enable row level security;

drop policy if exists "Turmas visíveis para equipe e participantes" on public.turmas;
create policy "Turmas visíveis para equipe e participantes"
on public.turmas for select
to authenticated
using (public.pode_acessar_turma(id));

drop policy if exists "Equipe gerencia turmas" on public.turmas;
create policy "Equipe gerencia turmas"
on public.turmas for all
to authenticated
using (public.pode_gerenciar_turmas())
with check (public.pode_gerenciar_turmas());

drop policy if exists "Participações visíveis para equipe e aluno" on public.turma_alunos;
create policy "Participações visíveis para equipe e aluno"
on public.turma_alunos for select
to authenticated
using (public.pode_gerenciar_turmas() or aluno_id = auth.uid());

drop policy if exists "Equipe gerencia participantes" on public.turma_alunos;
create policy "Equipe gerencia participantes"
on public.turma_alunos for all
to authenticated
using (public.pode_gerenciar_turmas())
with check (public.pode_gerenciar_turmas());

drop policy if exists "Aulas coletivas visíveis para equipe e participantes" on public.turma_aulas;
create policy "Aulas coletivas visíveis para equipe e participantes"
on public.turma_aulas for select
to authenticated
using (public.pode_acessar_turma(turma_id));

drop policy if exists "Equipe gerencia aulas coletivas" on public.turma_aulas;
create policy "Equipe gerencia aulas coletivas"
on public.turma_aulas for all
to authenticated
using (public.pode_gerenciar_turmas())
with check (public.pode_gerenciar_turmas());

grant select, insert, update, delete on public.turmas to authenticated;
grant select, insert, update, delete on public.turma_alunos to authenticated;
grant select, insert, update, delete on public.turma_aulas to authenticated;
grant execute on function public.pode_gerenciar_turmas() to authenticated;
grant execute on function public.pode_acessar_turma(uuid) to authenticated;
grant execute on function public.registrar_aula_turma(uuid, date, text) to authenticated;

comment on table public.turmas is
  'Turmas com agenda própria e valor mensal total dividido entre participantes.';

comment on column public.historico_aulas.valor_aula_faturado is
  'Valor congelado desta aula para o aluno, usado em cobranças coletivas e ajustes específicos.';
