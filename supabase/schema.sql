-- Beer Pong Event Platform schema
-- Run this in the Supabase SQL editor once per project.

create type team_state as enum ('registered', 'queued', 'playing');
create type event_phase as enum ('registration', 'seeding', 'live', 'ended');

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phase event_phase not null default 'registration',
  starts_at timestamptz,
  ends_at timestamptz,
  timer_enabled boolean not null default false,
  timer_duration_seconds int not null default 600,
  table_count int not null default 3,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  members text[] not null,
  photo_url text,
  state team_state not null default 'registered',
  table_id uuid,
  queue_sequence bigint,
  wins int not null default 0,
  losses int not null default 0,
  games_played int not null default 0,
  total_seconds_played int not null default 0,
  created_at timestamptz not null default now()
);

create table event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  table_number int not null,
  current_match_id uuid,
  unique (event_id, table_number)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  table_id uuid not null references event_tables(id),
  round_number int not null,
  team_a_id uuid not null references teams(id),
  team_b_id uuid not null references teams(id),
  winner_id uuid references teams(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  timer_enabled boolean not null default false,
  timer_duration_seconds int,
  is_seeding boolean not null default false
);

alter table event_tables
  add constraint event_tables_current_match_fkey
  foreign key (current_match_id) references matches(id) on delete set null;

alter table teams
  add constraint teams_table_id_fkey
  foreign key (table_id) references event_tables(id) on delete set null;

create sequence queue_seq;

create index teams_event_id_idx on teams(event_id);
create index teams_queue_idx on teams(event_id, state, queue_sequence);
create index matches_event_id_idx on matches(event_id);
create index event_tables_event_id_idx on event_tables(event_id);

-- ---------------------------------------------------------------------------
-- start_tournament
-- ---------------------------------------------------------------------------
create or replace function start_tournament(p_event_id uuid, ordered_team_ids uuid[])
returns void
language plpgsql
as $$
declare
  v_table_count int;
  v_team_id uuid;
  v_seq bigint;
  v_idx int := 1;
  v_table record;
  v_team_a uuid;
  v_team_b uuid;
  v_match_id uuid;
  v_timer_enabled boolean;
  v_timer_duration int;
  v_tables_needed int;
begin
  select table_count, timer_enabled, timer_duration_seconds
    into v_table_count, v_timer_enabled, v_timer_duration
  from events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if array_length(ordered_team_ids, 1) is null or array_length(ordered_team_ids, 1) < 2 then
    raise exception 'Need at least 2 teams to start';
  end if;

  -- Ensure tables exist
  for i in 1..v_table_count loop
    insert into event_tables (event_id, table_number)
    values (p_event_id, i)
    on conflict (event_id, table_number) do nothing;
  end loop;

  -- Reset live state
  update teams
  set state = 'registered',
      table_id = null,
      queue_sequence = null
  where event_id = p_event_id;

  update event_tables
  set current_match_id = null
  where event_id = p_event_id;

  -- Assign queue order
  foreach v_team_id in array ordered_team_ids loop
    v_seq := nextval('queue_seq');
    update teams
    set state = 'queued',
        queue_sequence = v_seq,
        table_id = null
    where id = v_team_id and event_id = p_event_id;

    if not found then
      raise exception 'Team % not found for event', v_team_id;
    end if;
  end loop;

  v_tables_needed := least(
    v_table_count,
    floor(array_length(ordered_team_ids, 1)::numeric / 2)::int
  );

  for v_table in
    select * from event_tables
    where event_id = p_event_id
    order by table_number
    limit v_tables_needed
  loop
    v_team_a := ordered_team_ids[v_idx];
    v_team_b := ordered_team_ids[v_idx + 1];
    v_idx := v_idx + 2;

    insert into matches (
      event_id, table_id, round_number,
      team_a_id, team_b_id,
      timer_enabled, timer_duration_seconds
    )
    values (
      p_event_id, v_table.id, 1,
      v_team_a, v_team_b,
      v_timer_enabled, v_timer_duration
    )
    returning id into v_match_id;

    update teams
    set state = 'playing',
        table_id = v_table.id,
        queue_sequence = null
    where id in (v_team_a, v_team_b);

    update event_tables
    set current_match_id = v_match_id
    where id = v_table.id;
  end loop;

  update events set phase = 'live' where id = p_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_match
-- ---------------------------------------------------------------------------
create or replace function complete_match(p_match_id uuid, p_winner_id uuid)
returns void
language plpgsql
as $$
declare
  v_match matches%rowtype;
  v_loser_id uuid;
  v_duration int;
  v_next_team_id uuid;
  v_new_match_id uuid;
  v_timer_enabled boolean;
  v_timer_duration int;
begin
  select * into v_match
  from matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.ended_at is not null then
    raise exception 'Match already completed';
  end if;

  if p_winner_id is distinct from v_match.team_a_id
     and p_winner_id is distinct from v_match.team_b_id then
    raise exception 'Winner must be one of the match teams';
  end if;

  v_loser_id := case
    when p_winner_id = v_match.team_a_id then v_match.team_b_id
    else v_match.team_a_id
  end;

  v_duration := greatest(0, extract(epoch from (now() - v_match.started_at))::int);

  update matches
  set winner_id = p_winner_id,
      ended_at = now(),
      duration_seconds = v_duration
  where id = p_match_id;

  -- Winner stays on the table
  update teams
  set wins = wins + 1,
      games_played = games_played + 1,
      total_seconds_played = total_seconds_played + v_duration,
      state = 'playing',
      table_id = v_match.table_id,
      queue_sequence = null
  where id = p_winner_id;

  -- Loser goes to back of queue
  update teams
  set losses = losses + 1,
      games_played = games_played + 1,
      total_seconds_played = total_seconds_played + v_duration,
      state = 'queued',
      table_id = null,
      queue_sequence = nextval('queue_seq')
  where id = v_loser_id;

  -- Next challenger
  select id into v_next_team_id
  from teams
  where event_id = v_match.event_id
    and state = 'queued'
  order by queue_sequence asc
  limit 1
  for update skip locked;

  if v_next_team_id is not null then
    select timer_enabled, timer_duration_seconds
      into v_timer_enabled, v_timer_duration
    from events
    where id = v_match.event_id;

    insert into matches (
      event_id, table_id, round_number,
      team_a_id, team_b_id,
      timer_enabled, timer_duration_seconds
    )
    values (
      v_match.event_id, v_match.table_id, v_match.round_number + 1,
      p_winner_id, v_next_team_id,
      v_timer_enabled, v_timer_duration
    )
    returning id into v_new_match_id;

    update teams
    set state = 'playing',
        table_id = v_match.table_id,
        queue_sequence = null
    where id = v_next_team_id;

    update event_tables
    set current_match_id = v_new_match_id
    where id = v_match.table_id;
  else
    -- Winner waiting — clear current match pointer so UI can show waiting state
    update event_tables
    set current_match_id = null
    where id = v_match.table_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS (anon has full app access; no auth by design)
-- ---------------------------------------------------------------------------
alter table events enable row level security;
alter table teams enable row level security;
alter table event_tables enable row level security;
alter table matches enable row level security;

create policy events_select on events for select to anon using (true);
create policy events_insert on events for insert to anon with check (true);
create policy events_update on events for update to anon using (true) with check (true);
create policy events_delete on events for delete to anon using (true);

create policy teams_select on teams for select to anon using (true);
create policy teams_insert on teams for insert to anon with check (true);
create policy teams_update on teams for update to anon using (true) with check (true);
create policy teams_delete on teams for delete to anon using (true);

create policy event_tables_select on event_tables for select to anon using (true);
create policy event_tables_insert on event_tables for insert to anon with check (true);
create policy event_tables_update on event_tables for update to anon using (true) with check (true);
create policy event_tables_delete on event_tables for delete to anon using (true);

create policy matches_select on matches for select to anon using (true);
create policy matches_insert on matches for insert to anon with check (true);
create policy matches_update on matches for update to anon using (true) with check (true);
create policy matches_delete on matches for delete to anon using (true);

-- Storage bucket for team photos (run in SQL editor; Storage UI also works)
insert into storage.buckets (id, name, public)
values ('team-photos', 'team-photos', true)
on conflict (id) do nothing;

create policy team_photos_public_read
on storage.objects for select to anon
using (bucket_id = 'team-photos');

create policy team_photos_anon_insert
on storage.objects for insert to anon
with check (
  bucket_id = 'team-photos'
  and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'))
);

create policy team_photos_anon_update
on storage.objects for update to anon
using (bucket_id = 'team-photos')
with check (bucket_id = 'team-photos');

create policy team_photos_anon_delete
on storage.objects for delete to anon
using (bucket_id = 'team-photos');

-- Realtime
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table event_tables;
alter publication supabase_realtime add table matches;
