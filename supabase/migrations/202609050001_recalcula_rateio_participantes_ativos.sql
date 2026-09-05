-- Mantem o valor mensal da turma dividido entre todos os participantes ativos,
-- independentemente da data em que cada aluno entrou.
--
-- Aulas que ja possuem algum item faturado permanecem congeladas para preservar
-- cobrancas emitidas. As demais sao recompostas sempre que a turma muda:
-- participantes inativos saem, novos participantes entram e o valor e recalculado.

-- Uma matricula inativa nao pode continuar contando como participante da turma.
create or replace function public.inativar_participacoes_turma_do_aluno()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if upper(trim(coalesce(new.status, ''))) = 'INATIVO'
    and upper(trim(coalesce(old.status, ''))) is distinct from 'INATIVO' then
    update public.turma_alunos
    set status = 'INATIVO',
        fim_em = coalesce(fim_em, current_date),
        atualizado_em = now()
    where aluno_id = new.id
      and status = 'ATIVO';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inativar_participacoes_turma_aluno
  on public.alunos_info;

create trigger trg_inativar_participacoes_turma_aluno
after update of status
on public.alunos_info
for each row
execute function public.inativar_participacoes_turma_do_aluno();

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
  v_ignoradas_faturadas integer := 0;
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

  v_valor_aluno := case
    when v_participantes > 0 then round(
      v_turma.valor_mensal_total / v_participantes / v_turma.aulas_previstas_mes,
      2
    )
    else 0
  end;

  for v_aula in
    select
      aula.*,
      exists (
        select 1
        from public.historico_aulas historico
        where historico.turma_aula_id = aula.id
          and historico.fatura_id is not null
      ) as possui_faturamento
    from public.turma_aulas aula
    where aula.turma_id = p_turma_id
      and aula.status = 'REALIZADA'
    order by aula.data_aula, aula.criado_em
  loop
    if v_aula.possui_faturamento then
      v_ignoradas_faturadas := v_ignoradas_faturadas + 1;
      continue;
    end if;

    -- Uma saida da turma tambem retira o lancamento ainda nao faturado.
    delete from public.historico_aulas historico
    where historico.turma_aula_id = v_aula.id
      and historico.fatura_id is null
      and not exists (
        select 1
        from public.turma_alunos participante
        where participante.turma_id = p_turma_id
          and participante.aluno_id = historico.aluno_id
          and participante.status = 'ATIVO'
      );

    update public.turma_aulas
    set participantes_snapshot = v_participantes,
        valor_mensal_snapshot = v_turma.valor_mensal_total,
        aulas_previstas_snapshot = v_turma.aulas_previstas_mes,
        valor_aluno_aula = v_valor_aluno
    where id = v_aula.id;

    if v_participantes > 0 then
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
      on conflict (turma_aula_id, aluno_id)
        where turma_aula_id is not null
      do update
      set valor_aula_faturado = excluded.valor_aula_faturado;
    end if;

    v_distribuidas := v_distribuidas + 1;
  end loop;

  return jsonb_build_object(
    'aulas_distribuidas', v_distribuidas,
    'aulas_faturadas_preservadas', v_ignoradas_faturadas,
    'participantes', v_participantes,
    'valor_por_aluno', v_valor_aluno
  );
end;
$$;

-- Tambem sincroniza quando uma participacao for removida definitivamente.
create or replace function public.distribuir_aulas_turma_ao_alterar_participante()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sincronizar_aulas_turma_participantes_interno(old.turma_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.turma_id is distinct from new.turma_id then
    perform public.sincronizar_aulas_turma_participantes_interno(old.turma_id);
  end if;

  perform public.sincronizar_aulas_turma_participantes_interno(new.turma_id);
  return new;
end;
$$;

drop trigger if exists trg_distribuir_aulas_turma_participante
  on public.turma_alunos;

create constraint trigger trg_distribuir_aulas_turma_participante
after insert or delete or update of turma_id, status, inicio_em, fim_em
on public.turma_alunos
deferrable initially deferred
for each row
execute function public.distribuir_aulas_turma_ao_alterar_participante();

-- Corrige matriculas inativas que ainda ficaram ativas em alguma turma.
update public.turma_alunos participante
set status = 'INATIVO',
    fim_em = coalesce(participante.fim_em, current_date),
    atualizado_em = now()
from public.alunos_info aluno
where aluno.id = participante.aluno_id
  and upper(trim(coalesce(aluno.status, ''))) = 'INATIVO'
  and participante.status = 'ATIVO';

-- Aplica a nova regra imediatamente aos lancamentos pendentes ja existentes.
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

revoke all on function public.inativar_participacoes_turma_do_aluno()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
