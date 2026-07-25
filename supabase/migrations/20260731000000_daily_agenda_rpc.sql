-- Noos — RPC get_daily_agenda (docs/FUNCTIONS.md)
-- Consolida compromissos (calendar_events), tarefas com prazo no dia e
-- hábitos previstos naquele dia da semana, tudo restrito ao dono.

create or replace function public.get_daily_agenda(target_date date)
returns json
language sql
stable
security invoker
as $$
  select json_build_object(
    'events', coalesce((
      select json_agg(row_to_json(e) order by e.starts_at)
      from (
        select id, title, starts_at, ends_at, sync_status
        from public.calendar_events
        where user_id = auth.uid()
          and starts_at::date = target_date
      ) e
    ), '[]'::json),
    'tasks', coalesce((
      select json_agg(row_to_json(t))
      from (
        select id, title, status, due_date, eisenhower_quadrant
        from public.tasks
        where user_id = auth.uid()
          and due_date::date = target_date
      ) t
    ), '[]'::json),
    'habits', coalesce((
      select json_agg(row_to_json(h))
      from (
        select id, name, day_period, current_streak
        from public.habits
        where user_id = auth.uid()
          and is_active
          and (target_days is null or lower(to_char(target_date, 'Dy')) = any(target_days))
      ) h
    ), '[]'::json)
  );
$$;

grant execute on function public.get_daily_agenda(date) to authenticated;
