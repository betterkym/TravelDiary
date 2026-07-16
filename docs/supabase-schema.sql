-- Travel Diary Supabase schema
-- Paste into Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists trips (
  trip_id text primary key,
  meta_json jsonb not null,
  diary_json jsonb,
  photo_feedback_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id bigserial primary key,
  trip_id text not null references trips(trip_id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  time timestamptz not null,
  accuracy_m double precision
);

create index if not exists locations_trip_id_time_idx
  on locations (trip_id, time asc, id asc);

create table if not exists photos (
  id bigserial primary key,
  trip_id text not null references trips(trip_id) on delete cascade,
  photo_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_trip_id_id_idx
  on photos (trip_id, id asc);

-- Optional RLS. Enable only if you plan to use Supabase Auth later.
-- alter table trips enable row level security;
-- alter table locations enable row level security;
-- alter table photos enable row level security;
