-- Noos — RPCs toggle_habit_log e get_dashboard_metrics (docs/FUNCTIONS.md)

-- ---------------------------------------------------------------------------
-- toggle_habit_log(p_habit_id, p_log_date)
-- Marca/desmarca o cumprimento do dia, recalcula current_streak/best_streak
-- e informa se um marco de sequência foi atingido (múltiplo de 7 dias) —
-- quem de fato concede a recompensa é a Edge Function award-reward, chamada
-- pelo frontend quando milestone_reached=true (sem pg_net/webhook interno
-- nesta versão, mesma decisão já tomada pra generate-note-embedding).
-- ---------------------------------------------------------------------------
create or replace function public.toggle_habit_log(p_habit_id uuid, p_log_date date)
returns json
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
  v_was_completed boolean;
  v_completed boolean;
  v_streak integer := 0;
  v_best integer;
  v_check_date date;
  v_milestone boolean;
begin
  select user_id into v_owner from public.habits where id = p_habit_id;
  if v_owner is null or v_owner <> v_user_id then
    raise exception 'Hábito não encontrado';
  end if;

  select exists(
    select 1 from public.habit_logs
    where habit_id = p_habit_id and log_date = p_log_date and completed
  ) into v_was_completed;

  if v_was_completed then
    delete from public.habit_logs where habit_id = p_habit_id and log_date = p_log_date;
    v_completed := false;
  else
    insert into public.habit_logs (user_id, habit_id, log_date, completed)
    values (v_user_id, p_habit_id, p_log_date, true)
    on conflict (habit_id, log_date) do update set completed = true;
    v_completed := true;
  end if;

  -- current_streak = dias consecutivos completos terminando HOJE (não em
  -- p_log_date) — desmarcar um dia passado não deveria "consertar" a
  -- sequência atual, só recalcular a partir de hoje pra trás.
  v_check_date := current_date;
  loop
    exit when not exists (
      select 1 from public.habit_logs
      where habit_id = p_habit_id and log_date = v_check_date and completed
    );
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
  end loop;

  select best_streak into v_best from public.habits where id = p_habit_id;
  v_best := greatest(coalesce(v_best, 0), v_streak);

  update public.habits set current_streak = v_streak, best_streak = v_best where id = p_habit_id;

  -- marco: só quando a própria ação de marcar (não desmarcar) fechou uma
  -- semana cheia (7, 14, 21...) contando a partir de hoje.
  v_milestone := v_completed and p_log_date = current_date and v_streak > 0 and v_streak % 7 = 0;

  return json_build_object(
    'completed', v_completed,
    'current_streak', v_streak,
    'best_streak', v_best,
    'milestone_reached', v_milestone,
    'milestone_points', case when v_milestone then 10 else 0 end
  );
end;
$$;

grant execute on function public.toggle_habit_log(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- get_dashboard_metrics()
-- Consolida hábitos, metas e tarefas do dono num único payload pra /metrics.
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_metrics()
returns json
language sql
stable
security invoker
as $$
  select json_build_object(
    'habits', (
      select json_build_object(
        'total', count(*),
        'completed_today', count(*) filter (
          where exists (
            select 1 from public.habit_logs hl
            where hl.habit_id = h.id and hl.log_date = current_date and hl.completed
          )
        ),
        'avg_streak', coalesce(round(avg(h.current_streak)::numeric, 1), 0)
      )
      from public.habits h
      where h.user_id = auth.uid() and h.is_active
    ),
    'goals', (
      select json_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'achieved', count(*) filter (where status = 'achieved')
      )
      from public.goals
      where user_id = auth.uid()
    ),
    'tasks_by_status', (
      select coalesce(json_object_agg(status, cnt), '{}'::json)
      from (
        select status, count(*) as cnt
        from public.tasks
        where user_id = auth.uid()
        group by status
      ) s
    ),
    'tasks_by_quadrant', (
      select coalesce(json_object_agg(eisenhower_quadrant, cnt), '{}'::json)
      from (
        select eisenhower_quadrant, count(*) as cnt
        from public.tasks
        where user_id = auth.uid() and eisenhower_quadrant is not null
        group by eisenhower_quadrant
      ) s
    )
  );
$$;

grant execute on function public.get_dashboard_metrics() to authenticated;
