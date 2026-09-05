-- Recalcula reposições ao trocar o modelo e cria o fluxo de pagamento
-- informado pelo portal do aluno.

-- Ao entrar em vencimento fixo, preservamos as ocorrências do mês atual e do
-- mês anterior. Como o aluno não tinha direito à reposição no modelo anterior,
-- o prazo de 30 dias começa na data da troca.
create or replace function public.sincronizar_reposicoes_ao_trocar_modelo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.modelo_faturamento = 'VENCIMENTO_FIXO'
     and new.modelo_faturamento is distinct from old.modelo_faturamento then
    insert into public.creditos_reposicao (
      aluno_id,
      historico_aula_id,
      data_origem,
      expira_em
    )
    select
      h.aluno_id,
      h.id::text,
      h.data_aula::date,
      current_date + 30
    from public.historico_aulas h
    where h.aluno_id = new.id
      and h.status in ('Desmarcada', 'Falta Justificada')
      and h.data_aula::date >= (
        date_trunc('month', current_date)::date - interval '1 month'
      )::date
    on conflict (historico_aula_id)
      where historico_aula_id is not null
    do update
      set expira_em = greatest(
        public.creditos_reposicao.expira_em,
        excluded.expira_em
      )
      where public.creditos_reposicao.usado_em is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sincronizar_reposicoes_troca_modelo
  on public.alunos_info;
create trigger trg_sincronizar_reposicoes_troca_modelo
after update of modelo_faturamento on public.alunos_info
for each row execute function public.sincronizar_reposicoes_ao_trocar_modelo();

-- Corrige imediatamente alunos que já foram alterados antes desta migração.
insert into public.creditos_reposicao (
  aluno_id,
  historico_aula_id,
  data_origem,
  expira_em
)
select
  h.aluno_id,
  h.id::text,
  h.data_aula::date,
  current_date + 30
from public.historico_aulas h
join public.alunos_info ai on ai.id = h.aluno_id
where ai.modelo_faturamento = 'VENCIMENTO_FIXO'
  and h.status in ('Desmarcada', 'Falta Justificada')
  and h.data_aula::date >= (
    date_trunc('month', current_date)::date - interval '1 month'
  )::date
on conflict (historico_aula_id)
  where historico_aula_id is not null
do update
  set expira_em = greatest(
    public.creditos_reposicao.expira_em,
    excluded.expira_em
  )
  where public.creditos_reposicao.usado_em is null;

create table if not exists public.pagamentos_informados (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  fatura_id uuid references public.faturas(id) on delete set null,
  competencia date not null default date_trunc('month', current_date)::date,
  valor numeric(12, 2) not null,
  data_pagamento date not null default current_date,
  metodo_pagamento text not null default 'PIX',
  observacoes text,
  comprovante_path text,
  comprovante_nome text,
  comprovante_mime text,
  status text not null default 'PENDENTE',
  motivo_analise text,
  pagamento_id text,
  analisado_por uuid references public.profiles(id) on delete set null,
  analisado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint pagamentos_informados_valor_check check (valor > 0),
  constraint pagamentos_informados_status_check
    check (status in ('PENDENTE', 'APROVADO', 'RECUSADO')),
  constraint pagamentos_informados_metodo_check
    check (metodo_pagamento in ('PIX', 'Dinheiro', 'Transferência', 'Cartão', 'Boleto', 'Outro'))
);

create index if not exists pagamentos_informados_aluno_idx
  on public.pagamentos_informados(aluno_id, criado_em desc);

create index if not exists pagamentos_informados_pendentes_idx
  on public.pagamentos_informados(status, criado_em)
  where status = 'PENDENTE';

create unique index if not exists pagamentos_informados_fatura_pendente_uidx
  on public.pagamentos_informados(aluno_id, fatura_id)
  where fatura_id is not null and status = 'PENDENTE';

alter table public.pagamentos_informados enable row level security;

drop policy if exists "Aluno visualiza pagamentos informados"
  on public.pagamentos_informados;
create policy "Aluno visualiza pagamentos informados"
  on public.pagamentos_informados
  for select
  to authenticated
  using (
    aluno_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'ADMIN'
    )
  );

drop policy if exists "Aluno informa pagamento próprio"
  on public.pagamentos_informados;
create policy "Aluno informa pagamento próprio"
  on public.pagamentos_informados
  for insert
  to authenticated
  with check (
    aluno_id = auth.uid()
    and status = 'PENDENTE'
    and analisado_por is null
    and analisado_em is null
    and pagamento_id is null
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'comprovantes-pagamento',
  'comprovantes-pagamento',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Aluno envia próprio comprovante" on storage.objects;
create policy "Aluno envia próprio comprovante"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'comprovantes-pagamento'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Aluno visualiza próprio comprovante" on storage.objects;
create policy "Aluno visualiza próprio comprovante"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'comprovantes-pagamento'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Aluno remove próprio comprovante" on storage.objects;
create policy "Aluno remove próprio comprovante"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'comprovantes-pagamento'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Admin visualiza comprovantes" on storage.objects;
create policy "Admin visualiza comprovantes"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'comprovantes-pagamento'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'ADMIN'
    )
  );

create or replace function public.analisar_pagamento_informado(
  p_pagamento_informado_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_solicitacao public.pagamentos_informados%rowtype;
  v_fatura public.faturas%rowtype;
  v_pagamento_id text;
  v_decisao text := upper(trim(coalesce(p_decisao, '')));
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  ) then
    raise exception 'Somente administradores podem analisar pagamentos informados.';
  end if;

  if v_decisao not in ('APROVADO', 'RECUSADO') then
    raise exception 'Decisão inválida.';
  end if;

  select *
    into v_solicitacao
  from public.pagamentos_informados
  where id = p_pagamento_informado_id
  for update;

  if not found then
    raise exception 'Pagamento informado não encontrado.';
  end if;

  if v_solicitacao.status <> 'PENDENTE' then
    raise exception 'Este pagamento já foi analisado.';
  end if;

  if v_decisao = 'RECUSADO'
     and length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da recusa.';
  end if;

  if v_decisao = 'APROVADO' then
    if v_solicitacao.fatura_id is not null then
      select *
        into v_fatura
      from public.faturas
      where id = v_solicitacao.fatura_id
        and aluno_id = v_solicitacao.aluno_id
      for update;

      if not found then
        raise exception 'A fatura vinculada não foi encontrada.';
      end if;

      if v_fatura.status = 'CANCELADO' then
        raise exception 'A fatura vinculada foi cancelada.';
      end if;

      if v_fatura.status = 'PAGO' then
        raise exception 'A fatura vinculada já está paga.';
      end if;

      if abs(v_solicitacao.valor - v_fatura.valor_total) > 0.01 then
        raise exception
          'O valor informado difere do total da fatura. Recuse a solicitação e peça a correção ao aluno.';
      end if;
    end if;

    insert into public.pagamentos (
      aluno_id,
      fatura_id,
      valor,
      status,
      data_pagamento,
      competencia,
      metodo_pagamento
    ) values (
      v_solicitacao.aluno_id,
      v_solicitacao.fatura_id,
      v_solicitacao.valor,
      'Pago',
      v_solicitacao.data_pagamento,
      v_solicitacao.competencia,
      v_solicitacao.metodo_pagamento
    )
    returning id::text into v_pagamento_id;

    if v_solicitacao.fatura_id is not null then
      update public.faturas
      set
        status = 'PAGO',
        pago_em = v_solicitacao.data_pagamento::timestamptz,
        atualizado_em = now()
      where id = v_solicitacao.fatura_id;
    end if;
  end if;

  update public.pagamentos_informados
  set
    status = v_decisao,
    motivo_analise = nullif(trim(coalesce(p_motivo, '')), ''),
    pagamento_id = v_pagamento_id,
    analisado_por = auth.uid(),
    analisado_em = now(),
    atualizado_em = now()
  where id = v_solicitacao.id;

  insert into public.notificacoes_aluno (
    aluno_id,
    titulo,
    mensagem
  ) values (
    v_solicitacao.aluno_id,
    case
      when v_decisao = 'APROVADO' then 'Pagamento confirmado'
      else 'Comprovante precisa de correção'
    end,
    case
      when v_decisao = 'APROVADO' then
        'Recebemos e confirmamos seu pagamento de '
        || to_char(v_solicitacao.valor, 'FM999G999G990D00') || '.'
      else
        'O pagamento informado não foi aprovado. Motivo: '
        || trim(p_motivo)
    end
  );

  return jsonb_build_object(
    'id', v_solicitacao.id,
    'status', v_decisao,
    'pagamento_id', v_pagamento_id
  );
end;
$$;

revoke all on function public.analisar_pagamento_informado(uuid, text, text)
  from public;
grant execute on function public.analisar_pagamento_informado(uuid, text, text)
  to authenticated;

comment on table public.pagamentos_informados is
  'Pagamentos declarados no portal do aluno e aguardando conferência administrativa.';
