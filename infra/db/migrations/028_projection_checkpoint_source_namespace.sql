-- Projection checkpoints are official-runtime evidence only.
-- Shadow runtime rows must never be consumed by official projection rebuilds.

alter table if exists projection_checkpoints
    add column if not exists source_namespace text not null default 'official_runtime';

do $$
begin
    if to_regclass('public.projection_checkpoints') is not null
       and not exists (
           select 1
           from pg_constraint
           where conname = 'ck_projection_checkpoints_source_namespace_not_shadow'
             and conrelid = 'public.projection_checkpoints'::regclass
       ) then
        alter table projection_checkpoints
            add constraint ck_projection_checkpoints_source_namespace_not_shadow
            check (source_namespace <> 'shadow_runtime');
    end if;
end $$;
