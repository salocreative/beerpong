-- Mid-tournament ops: late joiners, withdraw, skip queue.
-- Run once in the Supabase SQL editor.

alter type team_state add value if not exists 'withdrawn';

-- Pair queued teams onto tables that have a lone waiting winner.
create or replace function try_fill_waiting_tables(p_event_id uuid)
returns void
language plpgsql
as $$
declare
  v_table record;
  v_winner_id uuid;
  v_challenger_id uuid;
  v_match_id uuid;
  v_timer_enabled boolean;
  v_timer_duration int;
  v_round int;
begin
  select timer_enabled, timer_duration_seconds
    into v_timer_enabled, v_timer_duration
  from events
  where id = p_event_id;

  for v_table in
    select t.*
    from event_tables t
    where t.event_id = p_event_id
      and t.current_match_id is null
    order by t.table_number
  loop
    select id into v_winner_id
    from teams
    where event_id = p_event_id
      and state = 'playing'
      and table_id = v_table.id
    limit 1;

    if v_winner_id is null then
      continue;
    end if;

    select id into v_challenger_id
    from teams
    where event_id = p_event_id
      and state = 'queued'
    order by queue_sequence asc
    limit 1
    for update skip locked;

    if v_challenger_id is null then
      exit;
    end if;

    select coalesce(max(round_number), 0) + 1 into v_round
    from matches
    where table_id = v_table.id;

    insert into matches (
      event_id, table_id, round_number,
      team_a_id, team_b_id,
      timer_enabled, timer_duration_seconds
    )
    values (
      p_event_id, v_table.id, v_round,
      v_winner_id, v_challenger_id,
      v_timer_enabled, v_timer_duration
    )
    returning id into v_match_id;

    update teams
    set state = 'playing',
        table_id = v_table.id,
        queue_sequence = null
    where id = v_challenger_id;

    update event_tables
    set current_match_id = v_match_id
    where id = v_table.id;
  end loop;
end;
$$;

-- Latecomer: create team already in the queue (and fill any waiting table).
create or replace function add_late_team(
  p_event_id uuid,
  p_name text,
  p_members text[]
)
returns uuid
language plpgsql
as $$
declare
  v_team_id uuid;
  v_phase event_phase;
begin
  select phase into v_phase from events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found';
  end if;
  if v_phase is distinct from 'live' then
    raise exception 'Late teams can only be added while the event is live';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Team name required';
  end if;
  if p_members is null or cardinality(p_members) < 2 or cardinality(p_members) > 3 then
    raise exception 'Need 2 or 3 member names';
  end if;

  insert into teams (
    event_id, name, members, state, queue_sequence
  )
  values (
    p_event_id,
    trim(p_name),
    p_members,
    'queued',
    nextval('queue_seq')
  )
  returning id into v_team_id;

  perform try_fill_waiting_tables(p_event_id);
  return v_team_id;
end;
$$;

-- Can't find them: send a queued team to the back.
create or replace function skip_queue_team(p_team_id uuid)
returns void
language plpgsql
as $$
declare
  v_team teams%rowtype;
begin
  select * into v_team from teams where id = p_team_id for update;
  if not found then
    raise exception 'Team not found';
  end if;
  if v_team.state is distinct from 'queued' then
    raise exception 'Only queued teams can be skipped';
  end if;

  update teams
  set queue_sequence = nextval('queue_seq')
  where id = p_team_id;
end;
$$;

-- Team leaves: remove from rotation. Forfeits active match if playing.
create or replace function withdraw_team(p_team_id uuid)
returns void
language plpgsql
as $$
declare
  v_team teams%rowtype;
  v_match matches%rowtype;
  v_opponent_id uuid;
  v_duration int;
  v_event_id uuid;
begin
  select * into v_team from teams where id = p_team_id for update;
  if not found then
    raise exception 'Team not found';
  end if;

  v_event_id := v_team.event_id;

  if v_team.state = 'playing' then
    select * into v_match
    from matches
    where event_id = v_event_id
      and ended_at is null
      and (team_a_id = p_team_id or team_b_id = p_team_id)
    for update;

    if found then
      v_opponent_id := case
        when v_match.team_a_id = p_team_id then v_match.team_b_id
        else v_match.team_a_id
      end;
      v_duration := greatest(0, extract(epoch from (now() - v_match.started_at))::int);

      update matches
      set winner_id = v_opponent_id,
          ended_at = now(),
          duration_seconds = v_duration
      where id = v_match.id;

      update teams
      set wins = wins + 1,
          games_played = games_played + 1,
          total_seconds_played = total_seconds_played + v_duration,
          state = 'playing',
          table_id = v_match.table_id,
          queue_sequence = null
      where id = v_opponent_id;

      update teams
      set losses = losses + 1,
          games_played = games_played + 1,
          total_seconds_played = total_seconds_played + v_duration,
          state = 'withdrawn',
          table_id = null,
          queue_sequence = null
      where id = p_team_id;

      update event_tables
      set current_match_id = null
      where id = v_match.table_id;

      perform try_fill_waiting_tables(v_event_id);
      return;
    end if;

    -- Playing but waiting (no active match)
    update teams
    set state = 'withdrawn',
        table_id = null,
        queue_sequence = null
    where id = p_team_id;

    update event_tables
    set current_match_id = null
    where id = v_team.table_id;

    perform try_fill_waiting_tables(v_event_id);
    return;
  end if;

  update teams
  set state = 'withdrawn',
      table_id = null,
      queue_sequence = null
  where id = p_team_id;
end;
$$;

grant execute on function try_fill_waiting_tables(uuid) to anon, authenticated;
grant execute on function add_late_team(uuid, text, text[]) to anon, authenticated;
grant execute on function skip_queue_team(uuid) to anon, authenticated;
grant execute on function withdraw_team(uuid) to anon, authenticated;
