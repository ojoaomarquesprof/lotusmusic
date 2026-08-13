-- Distribui aulas coletivas registradas antes da entrada dos participantes.
-- Execute depois de 202608130001_aulas_turma_sem_participantes.sql.

-- Uma aula marcada como REALIZADA representa uma ocorrência real da turma.
-- Por isso, ao lançá-la manualmente, usamos os participantes ATIVOS atuais
-- mesmo quando a data da aula é anterior ao inicio_em do cadastro.
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

  select * into v_turma
  from public.turmas
  where id = p_turma_id and status = 'ATIVA';

  if not found then
    raise exception 'Turma ativa nao encontrada.';
  end if;

  select count(*) into v_participantes
  from public.turma_alunos
  where turma_id = p_turma_id
    and status = 'ATIVO';

  v_valor_aluno := case
    when v_participantes > 0 then round(
      v_turma.valor_mensal_total / v_participantes / v_turma.aulas_previstas_mes,
      2
    )
    else 0
  end;

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

  -- A data da aula nao limita o faturamento de um lancamento manual.
  -- O gestor confirmou que a aula aconteceu para os participantes atuais.
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
      'Aula coletiva realizada - ' || v_turma.nome
    ),
    v_turma.professor_id,
    v_turma.modalidade,
    v_turma.id,
    v_turma_aula_id,
    v_valor_aluno
  from public.turma_alunos participante
  where participante.turma_id = p_turma_id
    and participante.status = 'ATIVO';

  return jsonb_build_object(
    'turma_aula_id', v_turma_aula_id,
    'participantes', v_participantes,
    'valor_por_aluno', v_valor_aluno,
    'aguardando_participantes', v_participantes = 0
  );
exception
  when unique_violation then
    raise exception 'Esta aula da turma ja foi registrada.';
end;
$$;

-- Implementacao interna usada pelo trigger e pelo backfill da migracao.
-- Ela nao depende de auth.uid(): as politicas da tabela continuam impedindo
-- alteracoes diretas, enquanto o trigger preserva a consistencia automatica.
create or replace function public.sincronizar_aulas_turma_participantes_interno(p_turma_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_turma public.turmas%rowtype;
  v_participantes integer;
  v_valor_aluno numeric(12, 2);
  v_aula record;
  v_distribuidas integer := 0;
begin
  select * into v_turma
  from public.turmas
  where id = p_turma_id;

  if not found then
    raise exception 'Turma nao encontrada.';
  end if;

  select count(*) into v_participantes
  from public.turma_alunos
  where turma_id = p_turma_id
    and status = 'ATIVO';

  if v_participantes = 0 then
    return jsonb_build_object(
      'aulas_distribuidas', 0,
      'participantes', 0,
      'valor_por_aluno', 0
    );
  end if;

  v_valor_aluno := round(
    v_turma.valor_mensal_total / v_participantes / v_turma.aulas_previstas_mes,
    2
  );

  for v_aula in
    select *
    from public.turma_aulas
    where turma_id = p_turma_id
      and status = 'REALIZADA'
      and participantes_snapshot = 0
    order by data_aula, criado_em
  loop
    update public.turma_aulas
    set participantes_snapshot = v_participantes,
        valor_aluno_aula = v_valor_aluno
    where id = v_aula.id;

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
      v_aula.data_aula,
      v_turma.horario_inicio,
      v_turma.horario_fim,
      'Realizada',
      coalesce(
        nullif(trim(v_aula.observacoes), ''),
        'Aula coletiva realizada - ' || v_turma.nome
      ),
      v_turma.professor_id,
      v_turma.modalidade,
      v_turma.id,
      v_aula.id,
      v_valor_aluno
    from public.turma_alunos participante
    where participante.turma_id = p_turma_id
      and participante.status = 'ATIVO'
      and not exists (
        select 1
        from public.historico_aulas historico
        where historico.turma_aula_id = v_aula.id
          and historico.aluno_id = participante.aluno_id
      );

    v_distribuidas := v_distribuidas + 1;
  end loop;

  return jsonb_build_object(
    'aulas_distribuidas', v_distribuidas,
    'participantes', v_participantes,
    'valor_por_aluno', v_valor_aluno
  );
end;
$$;

-- Mantem a chamada existente do app protegida para a equipe.
create or replace function public.sincronizar_aulas_turma_participantes(p_turma_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.pode_gerenciar_turmas() then
    raise exception 'Somente a equipe pode distribuir aulas de turma.';
  end if;

  return public.sincronizar_aulas_turma_participantes_interno(p_turma_id);
end;
$$;

-- Cadastrar ou reativar um participante passa a distribuir automaticamente
-- todas as aulas realizadas que ainda estavam aguardando participantes.
create or replace function public.distribuir_aulas_turma_ao_alterar_participante()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.turma_id is distinct from new.turma_id then
    perform public.sincronizar_aulas_turma_participantes_interno(old.turma_id);
  end if;

  perform public.sincronizar_aulas_turma_participantes_interno(new.turma_id);
  return new;
end;
$$;

drop trigger if exists trg_distribuir_aulas_turma_participante
  on public.turma_alunos;
-- Constraint trigger deferred: um upsert com varios alunos so distribui a
-- aula depois que todos os participantes da mesma operacao foram gravados.
create constraint trigger trg_distribuir_aulas_turma_participante
after insert or update of turma_id, status, inicio_em, fim_em
on public.turma_alunos
deferrable initially deferred
for each row
execute function public.distribuir_aulas_turma_ao_alterar_participante();

-- Corrige imediatamente as aulas antigas que ja foram lançadas com zero
-- participantes antes desta migracao.
do $$
declare
  v_turma_id uuid;
begin
  for v_turma_id in select id from public.turmas loop
    perform public.sincronizar_aulas_turma_participantes_interno(v_turma_id);
  end loop;
end;
$$;

revoke all on function public.sincronizar_aulas_turma_participantes_interno(uuid)
  from public, anon, authenticated;

grant execute on function public.sincronizar_aulas_turma_participantes(uuid)
  to authenticated;
