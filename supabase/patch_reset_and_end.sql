-- Patch for existing projects that already ran schema.sql.
-- Run once in the Supabase SQL editor.

alter table events
  add column if not exists closed_at timestamptz;

create or replace function end_event(p_event_id uuid)
returns void
language plpgsql
as $$
begin
  update events
  set phase = 'ended',
      closed_at = coalesce(closed_at, now()),
      timer_enabled = false
  where id = p_event_id;
end;
$$;

create or replace function reset_event(p_event_id uuid)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from events where id = p_event_id) then
    raise exception 'Event not found';
  end if;

  update event_tables
  set current_match_id = null
  where event_id = p_event_id;

  delete from matches where event_id = p_event_id;
  delete from teams where event_id = p_event_id;

  update events
  set phase = 'registration',
      closed_at = null
  where id = p_event_id;
end;
$$;

grant execute on function end_event(uuid) to anon, authenticated;
grant execute on function reset_event(uuid) to anon, authenticated;
