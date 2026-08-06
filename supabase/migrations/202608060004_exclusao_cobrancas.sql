-- Exclusão definitiva de cobranças calculadas
-- Execute após 202608060003_gestao_cobrancas.sql.

alter table public.ajustes_cobranca
  drop constraint if exists ajustes_cobranca_tipo_check;

alter table public.ajustes_cobranca
  add constraint ajustes_cobranca_tipo_check
    check (tipo in ('AJUSTAR', 'IGNORAR', 'EXCLUIR'));

comment on column public.ajustes_cobranca.tipo is
  'AJUSTAR corrige, IGNORAR desconsidera com possibilidade de restaurar e EXCLUIR oculta definitivamente a competência.';
