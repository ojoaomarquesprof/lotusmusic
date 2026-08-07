-- Gestão completa e auditável do histórico do aluno.
-- Permite lançar, editar e excluir movimentos sem deixar créditos ou faturas inconsistentes.

alter table public.historico_aulas
  add column if not exists credito_reposicao_id uuid
    references public.creditos_reposicao(id) on delete set null;

create index if not exists historico_aulas_credito_reposicao_idx
  on public.historico_aulas(credito_reposicao_id)
  where credito_reposicao_id is not null;

create table if not exists public.historico_aulas_auditoria (
  id uuid primary key default gen_random_uuid(),
  historico_aula_id text,
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  acao text not null,
  motivo text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  realizado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint historico_aulas_auditoria_acao_check
    check (acao in ('CRIADO', 'EDITADO', 'EXCLUIDO'))
);

create index if not exists historico_aulas_auditoria_aluno_idx
  on public.historico_aulas_auditoria(aluno_id, criado_em desc);

alter table public.historico_aulas_auditoria enable row level security;

drop policy if exists "Administradores visualizam auditoria de aulas"
  on public.historico_aulas_auditoria;
create policy "Administradores visualizam auditoria de aulas"
  on public.historico_aulas_auditoria
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'ADMIN'
    )
  );

create or replace function public.pode_gerenciar_historico_aluno()
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
      and role = 'ADMIN'
  );
$$;

-- Mantém o crédito que nasce de uma falta justificada, desmarcação ou concessão
-- manual. Um crédito já utilizado não pode perder silenciosamente sua origem.
create or replace function public.sincronizar_credito_reposicao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_modelo text;
  v_credito public.creditos_reposicao%rowtype;
  v_old_gera boolean := false;
  v_new_gera boolean := false;
begin
  if tg_op <> 'INSERT' then
    v_old_gera := old.status in ('Desmarcada', 'Falta Justificada', 'Crédito');
  end if;

  if tg_op <> 'DELETE' then
    select modelo_faturamento
      into v_modelo
    from public.alunos_info
    where id = new.aluno_id;

    v_new_gera :=
      v_modelo = 'VENCIMENTO_FIXO'
      and new.status in ('Desmarcada', 'Falta Justificada', 'Crédito');
  end if;

  if tg_op = 'DELETE' then
    if v_old_gera then
      select *
        into v_credito
      from public.creditos_reposicao
      where historico_aula_id = old.id::text
      for update;

      if found and v_credito.usado_em is not null then
        raise exception
          'Este registro gerou uma reposição que já foi utilizada. Exclua ou edite primeiro a reposição vinculada.';
      end if;

      delete from public.creditos_reposicao
      where historico_aula_id = old.id::text;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and v_old_gera then
    select *
      into v_credito
    from public.creditos_reposicao
    where historico_aula_id = old.id::text
    for update;

    if found and not v_new_gera then
      if v_credito.usado_em is not null then
        raise exception
          'Este registro gerou uma reposição que já foi utilizada. Exclua ou edite primeiro a reposição vinculada.';
      end if;

      delete from public.creditos_reposicao
      where id = v_credito.id;
    elsif found and v_new_gera then
      if v_credito.usado_em is not null
         and (
           old.aluno_id is distinct from new.aluno_id
           or old.data_aula::date is distinct from new.data_aula::date
         ) then
        raise exception
          'A origem de uma reposição já utilizada não pode ter aluno ou data alterados.';
      end if;

      update public.creditos_reposicao
      set
        aluno_id = new.aluno_id,
        data_origem = new.data_aula::date,
        expira_em = new.data_aula::date + 30
      where id = v_credito.id;
    end if;
  end if;

  if v_new_gera and not (tg_op = 'UPDATE' and v_old_gera and found) then
    insert into public.creditos_reposicao (
      aluno_id,
      historico_aula_id,
      data_origem,
      expira_em
    ) values (
      new.aluno_id,
      new.id::text,
      new.data_aula::date,
      new.data_aula::date + 30
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_credito_reposicao_historico on public.historico_aulas;
create trigger trg_credito_reposicao_historico
after insert or update or delete on public.historico_aulas
for each row execute function public.sincronizar_credito_reposicao();

-- Se uma aula de reposição for editada ou excluída, devolve automaticamente
-- o crédito que ela havia consumido.
create or replace function public.liberar_credito_consumido_historico()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.credito_reposicao_id is not null then
    if tg_op = 'DELETE' then
      update public.creditos_reposicao
      set usado_em = null
      where id = old.credito_reposicao_id;
    elsif old.credito_reposicao_id is distinct from new.credito_reposicao_id then
      update public.creditos_reposicao
      set usado_em = null
      where id = old.credito_reposicao_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_liberar_credito_consumido_historico
  on public.historico_aulas;
create trigger trg_liberar_credito_consumido_historico
before update or delete on public.historico_aulas
for each row execute function public.liberar_credito_consumido_historico();

create or replace function public.salvar_movimento_aluno(
  p_aluno_id uuid,
  p_data_aula date,
  p_horario_inicio time,
  p_horario_fim time,
  p_status text,
  p_observacoes text default null,
  p_professor_id uuid default null,
  p_modalidade text default null,
  p_valor_aula numeric default null,
  p_consumir_credito boolean default false,
  p_historico_id text default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.historico_aulas%rowtype;
  v_new public.historico_aulas%rowtype;
  v_credito_id uuid;
  v_status_permitidos constant text[] := array[
    'Realizada',
    'Reposição',
    'Agendada',
    'Falta',
    'Falta Injustificada',
    'Falta Justificada',
    'Desmarcada',
    'Crédito',
    'Ajuste de Saldo'
  ];
begin
  if not public.pode_gerenciar_historico_aluno() then
    raise exception 'Somente administradores podem alterar o histórico completo do aluno.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_aluno_id and role = 'ALUNO'
  ) then
    raise exception 'Aluno não encontrado.';
  end if;

  if not (p_status = any(v_status_permitidos)) then
    raise exception 'Tipo de lançamento inválido.';
  end if;

  if p_horario_inicio is not null
     and p_horario_fim is not null
     and p_horario_fim <= p_horario_inicio then
    raise exception 'O horário final deve ser posterior ao inicial.';
  end if;

  if p_valor_aula is not null and p_valor_aula < 0 then
    raise exception 'O valor da aula não pode ser negativo.';
  end if;

  if p_historico_id is not null then
    select *
      into v_old
    from public.historico_aulas
    where id::text = p_historico_id
      and aluno_id = p_aluno_id
    for update;

    if not found then
      raise exception 'Lançamento não encontrado.';
    end if;

    if v_old.fatura_id is not null then
      raise exception
        'Esta aula já pertence a uma fatura. Cancele a fatura antes de editar o lançamento.';
    end if;

    if v_old.credito_reposicao_id is not null then
      update public.creditos_reposicao
      set usado_em = null
      where id = v_old.credito_reposicao_id;
    end if;
  end if;

  if p_status in ('Reposição', 'Ajuste de Saldo') and p_consumir_credito then
    select id
      into v_credito_id
    from public.creditos_reposicao
    where aluno_id = p_aluno_id
      and usado_em is null
      and data_origem <= p_data_aula
      and expira_em >= p_data_aula
    order by expira_em, criado_em
    limit 1
    for update skip locked;

    if v_credito_id is null then
      raise exception
        'Não existe crédito de reposição válido para esta data. Você pode lançar como cortesia desmarcando a opção de consumir crédito.';
    end if;

    update public.creditos_reposicao
    set usado_em = now()
    where id = v_credito_id;
  end if;

  if p_historico_id is null then
    insert into public.historico_aulas (
      aluno_id,
      data_aula,
      horario_inicio,
      horario_fim,
      status,
      observacoes,
      professor_id,
      modalidade,
      valor_aula_faturado,
      credito_reposicao_id
    ) values (
      p_aluno_id,
      p_data_aula,
      p_horario_inicio,
      p_horario_fim,
      p_status,
      nullif(trim(coalesce(p_observacoes, '')), ''),
      p_professor_id,
      nullif(trim(coalesce(p_modalidade, '')), ''),
      p_valor_aula,
      v_credito_id
    )
    returning * into v_new;
  else
    update public.historico_aulas
    set
      data_aula = p_data_aula,
      horario_inicio = p_horario_inicio,
      horario_fim = p_horario_fim,
      status = p_status,
      observacoes = nullif(trim(coalesce(p_observacoes, '')), ''),
      professor_id = p_professor_id,
      modalidade = nullif(trim(coalesce(p_modalidade, '')), ''),
      valor_aula_faturado = p_valor_aula,
      credito_reposicao_id = v_credito_id
    where id::text = p_historico_id
    returning * into v_new;
  end if;

  insert into public.historico_aulas_auditoria (
    historico_aula_id,
    aluno_id,
    acao,
    motivo,
    dados_anteriores,
    dados_novos,
    realizado_por
  ) values (
    v_new.id::text,
    p_aluno_id,
    case when p_historico_id is null then 'CRIADO' else 'EDITADO' end,
    nullif(trim(coalesce(p_motivo, '')), ''),
    case when p_historico_id is null then null else to_jsonb(v_old) end,
    to_jsonb(v_new),
    auth.uid()
  );

  return to_jsonb(v_new);
exception
  when others then
    if v_credito_id is not null then
      update public.creditos_reposicao
      set usado_em = null
      where id = v_credito_id;
    end if;
    raise;
end;
$$;

create or replace function public.excluir_movimento_aluno(
  p_historico_id text,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.historico_aulas%rowtype;
begin
  if not public.pode_gerenciar_historico_aluno() then
    raise exception 'Somente administradores podem excluir lançamentos do aluno.';
  end if;

  select *
    into v_old
  from public.historico_aulas
  where id::text = p_historico_id
  for update;

  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;

  if v_old.fatura_id is not null then
    raise exception
      'Esta aula já pertence a uma fatura. Cancele a fatura antes de excluir o lançamento.';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da exclusão.';
  end if;

  insert into public.historico_aulas_auditoria (
    historico_aula_id,
    aluno_id,
    acao,
    motivo,
    dados_anteriores,
    realizado_por
  ) values (
    v_old.id::text,
    v_old.aluno_id,
    'EXCLUIDO',
    trim(p_motivo),
    to_jsonb(v_old),
    auth.uid()
  );

  delete from public.historico_aulas
  where id::text = p_historico_id;
end;
$$;

revoke all on function public.salvar_movimento_aluno(
  uuid, date, time, time, text, text, uuid, text, numeric, boolean, text, text
) from public;
grant execute on function public.salvar_movimento_aluno(
  uuid, date, time, time, text, text, uuid, text, numeric, boolean, text, text
) to authenticated;

revoke all on function public.excluir_movimento_aluno(text, text) from public;
grant execute on function public.excluir_movimento_aluno(text, text) to authenticated;

comment on table public.historico_aulas_auditoria is
  'Trilha imutável das inclusões, edições e exclusões administrativas no diário do aluno.';

comment on column public.historico_aulas.credito_reposicao_id is
  'Crédito consumido por uma reposição ou baixa manual lançada no histórico.';
