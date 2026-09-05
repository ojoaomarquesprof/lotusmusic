-- Modelos de faturamento da Lotus Music
-- Execute esta migração no Supabase antes de publicar a nova versão do app.

alter table public.alunos_info
  add column if not exists modelo_faturamento text not null default 'VENCIMENTO_FIXO',
  add column if not exists modelo_faturamento_desde date not null default current_date,
  add column if not exists creditos_por_pagamento integer not null default 4,
  add column if not exists saldo_creditos_faturamento integer not null default 0,
  add column if not exists valor_por_aula numeric(12, 2),
  add column if not exists prazo_vencimento_dias integer not null default 7,
  add column if not exists asaas_customer_id text;

alter table public.alunos_info
  drop constraint if exists alunos_info_modelo_faturamento_check,
  add constraint alunos_info_modelo_faturamento_check
    check (modelo_faturamento in ('CREDITOS', 'MENSAL_FECHADO', 'VENCIMENTO_FIXO')),
  drop constraint if exists alunos_info_creditos_por_pagamento_check,
  add constraint alunos_info_creditos_por_pagamento_check
    check (creditos_por_pagamento > 0),
  drop constraint if exists alunos_info_prazo_vencimento_dias_check,
  add constraint alunos_info_prazo_vencimento_dias_check
    check (prazo_vencimento_dias between 1 and 30);

create or replace function public.ajustar_troca_modelo_faturamento()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.modelo_faturamento is distinct from old.modelo_faturamento then
    new.modelo_faturamento_desde := current_date;
    new.saldo_creditos_faturamento := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ajustar_troca_modelo_faturamento on public.alunos_info;
create trigger trg_ajustar_troca_modelo_faturamento
before update of modelo_faturamento on public.alunos_info
for each row execute function public.ajustar_troca_modelo_faturamento();

alter table public.pagamentos
  add column if not exists fatura_id uuid,
  add column if not exists provider_payment_id text;

create unique index if not exists pagamentos_provider_payment_id_uidx
  on public.pagamentos(provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.faturas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  competencia date not null,
  modelo_faturamento text not null,
  quantidade_aulas integer not null default 0,
  valor_unitario numeric(12, 2) not null default 0,
  valor_total numeric(12, 2) not null default 0,
  data_emissao date not null default current_date,
  data_vencimento date,
  status text not null default 'RASCUNHO',
  provider text,
  provider_customer_id text,
  provider_payment_id text,
  invoice_url text,
  external_reference text,
  erro_integracao text,
  pago_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint faturas_modelo_check
    check (modelo_faturamento in ('CREDITOS', 'MENSAL_FECHADO', 'VENCIMENTO_FIXO')),
  constraint faturas_status_check
    check (status in ('RASCUNHO', 'PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO', 'SEM_MOVIMENTO', 'ERRO')),
  constraint faturas_aluno_competencia_modelo_uidx
    unique (aluno_id, competencia, modelo_faturamento)
);

alter table public.pagamentos
  drop constraint if exists pagamentos_fatura_id_fkey,
  add constraint pagamentos_fatura_id_fkey
    foreign key (fatura_id) references public.faturas(id) on delete set null;

create unique index if not exists faturas_provider_payment_id_uidx
  on public.faturas(provider_payment_id)
  where provider_payment_id is not null;

create index if not exists faturas_aluno_status_idx
  on public.faturas(aluno_id, status);

create table if not exists public.billing_webhook_events (
  event_id text primary key,
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  processado_em timestamptz not null default now()
);

create table if not exists public.creditos_reposicao (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  historico_aula_id text,
  data_origem date not null,
  expira_em date not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create unique index if not exists creditos_reposicao_historico_uidx
  on public.creditos_reposicao(historico_aula_id)
  where historico_aula_id is not null;

create index if not exists creditos_reposicao_disponiveis_idx
  on public.creditos_reposicao(aluno_id, expira_em)
  where usado_em is null;

alter table public.solicitacoes_reagendamento
  add column if not exists credito_reposicao_id uuid references public.creditos_reposicao(id) on delete set null,
  add column if not exists data_aula_original date;

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
    and lower(coalesce(status, 'Pago')) in ('pago', 'recebido', 'received', 'confirmed');

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

create or replace function public.sincronizar_saldo_creditos_por_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_saldo_creditos_faturamento(old.aluno_id);
    return old;
  end if;

  perform public.recalcular_saldo_creditos_faturamento(new.aluno_id);
  if tg_op = 'UPDATE' and old.aluno_id is distinct from new.aluno_id then
    perform public.recalcular_saldo_creditos_faturamento(old.aluno_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_saldo_creditos_pagamentos on public.pagamentos;
create trigger trg_saldo_creditos_pagamentos
after insert or update or delete on public.pagamentos
for each row execute function public.sincronizar_saldo_creditos_por_pagamento();

create or replace function public.sincronizar_saldo_creditos_por_aula()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_saldo_creditos_faturamento(old.aluno_id);
    return old;
  end if;

  perform public.recalcular_saldo_creditos_faturamento(new.aluno_id);
  if tg_op = 'UPDATE' and old.aluno_id is distinct from new.aluno_id then
    perform public.recalcular_saldo_creditos_faturamento(old.aluno_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_saldo_creditos_aulas on public.historico_aulas;
create trigger trg_saldo_creditos_aulas
after insert or update or delete on public.historico_aulas
for each row execute function public.sincronizar_saldo_creditos_por_aula();

create or replace function public.sincronizar_credito_reposicao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_modelo text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.creditos_reposicao where historico_aula_id = old.id::text;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select modelo_faturamento into v_modelo
  from public.alunos_info
  where id = new.aluno_id;

  if v_modelo = 'VENCIMENTO_FIXO'
     and new.status in ('Desmarcada', 'Falta Justificada', 'Crédito') then
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

create or replace function public.reservar_credito_reposicao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_modelo text;
  v_credito_id uuid;
begin
  if new.tipo_mudanca is distinct from 'Reposição' then
    return new;
  end if;

  select modelo_faturamento into v_modelo
  from public.alunos_info
  where id = new.aluno_id;

  if v_modelo is distinct from 'VENCIMENTO_FIXO' then
    raise exception 'Este modelo de faturamento não permite reposições.';
  end if;

  if new.credito_reposicao_id is not null then
    v_credito_id := new.credito_reposicao_id;
  else
    select id into v_credito_id
    from public.creditos_reposicao
    where aluno_id = new.aluno_id
      and usado_em is null
      and expira_em >= greatest(current_date, coalesce(new.nova_data::date, current_date))
    order by expira_em, criado_em
    limit 1
    for update skip locked;
  end if;

  if v_credito_id is null then
    raise exception 'O aluno não possui crédito de reposição válido.';
  end if;

  update public.creditos_reposicao
  set usado_em = now()
  where id = v_credito_id
    and aluno_id = new.aluno_id
    and usado_em is null
    and expira_em >= greatest(current_date, coalesce(new.nova_data::date, current_date));

  if not found then
    raise exception 'O crédito de reposição já foi usado ou expirou.';
  end if;

  new.credito_reposicao_id := v_credito_id;
  return new;
end;
$$;

drop trigger if exists trg_reservar_credito_reposicao on public.solicitacoes_reagendamento;
create trigger trg_reservar_credito_reposicao
before insert on public.solicitacoes_reagendamento
for each row execute function public.reservar_credito_reposicao();

create or replace function public.liberar_credito_reposicao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.creditos_reposicao
    set usado_em = null
    where id = old.credito_reposicao_id;
    return old;
  end if;

  if new.status = 'Negada' and old.status is distinct from new.status then
    update public.creditos_reposicao
    set usado_em = null
    where id = new.credito_reposicao_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_liberar_credito_reposicao on public.solicitacoes_reagendamento;
create trigger trg_liberar_credito_reposicao
after update or delete on public.solicitacoes_reagendamento
for each row execute function public.liberar_credito_reposicao();

-- Preserva créditos ainda válidos gerados antes desta migração.
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
  h.data_aula::date + 30
from public.historico_aulas h
join public.alunos_info ai on ai.id = h.aluno_id
where ai.modelo_faturamento = 'VENCIMENTO_FIXO'
  and h.status in ('Desmarcada', 'Falta Justificada', 'Crédito')
  and h.data_aula::date + 30 >= current_date
on conflict do nothing;

create or replace function public.pode_acessar_dados_aluno(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() = p_aluno_id
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('ADMIN', 'PROFESSOR')
    );
$$;

alter table public.faturas enable row level security;
alter table public.creditos_reposicao enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists "Faturas visíveis para aluno e equipe" on public.faturas;
create policy "Faturas visíveis para aluno e equipe"
on public.faturas for select
to authenticated
using (public.pode_acessar_dados_aluno(aluno_id));

drop policy if exists "Equipe gerencia faturas" on public.faturas;
create policy "Equipe gerencia faturas"
on public.faturas for all
to authenticated
using (public.pode_acessar_dados_aluno(aluno_id) and auth.uid() <> aluno_id)
with check (public.pode_acessar_dados_aluno(aluno_id) and auth.uid() <> aluno_id);

drop policy if exists "Créditos visíveis para aluno e equipe" on public.creditos_reposicao;
create policy "Créditos visíveis para aluno e equipe"
on public.creditos_reposicao for select
to authenticated
using (public.pode_acessar_dados_aluno(aluno_id));

grant select, insert, update, delete on public.faturas to authenticated;
grant select on public.creditos_reposicao to authenticated;
grant execute on function public.pode_acessar_dados_aluno(uuid) to authenticated;
