-- ============================================================
-- ALIENS TOURNAMENTS — Schema completo con prefijo at_
-- Tablas separadas de cualquier otro esquema en la misma DB
-- Ejecuta TODO en Supabase SQL Editor → New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Tablas ────────────────────────────────────────────────────

create table if not exists at_settings (
  id         integer primary key default 1,
  tournament jsonb   not null default '{}',
  links      jsonb   not null default '{}',
  prizes     jsonb   not null default '[]',
  constraint at_single_row check (id = 1)
);
insert into at_settings(id) values(1) on conflict do nothing;

create table if not exists at_staff_users (
  id            uuid        primary key default gen_random_uuid(),
  username      text        not null unique,
  display_name  text,
  password_hash text        not null,
  role          text        not null default 'editor'
                            check (role in ('editor','admin')),
  created_at    timestamptz not null default now()
);

create table if not exists at_staff_sessions (
  token      text        primary key,
  user_id    uuid        not null references at_staff_users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table if not exists at_schedule (
  id         uuid        primary key default gen_random_uuid(),
  phase      text        not null,
  group_name text        not null default '',
  date       date,
  time       text,
  rooms      integer     not null default 1,
  status     text        not null default 'proximo'
                         check (status in ('proximo','envivo','finalizado')),
  visible    boolean     not null default false,
  note       text        not null default '',
  position   integer     not null default 0
);

create table if not exists at_result_groups (
  id         uuid        primary key default gen_random_uuid(),
  phase      text        not null,
  title      text        not null,
  kind       text        not null default 'grupo'
                         check (kind in ('grupo','general')),
  qualify    integer     not null default 0,
  position   integer     not null default 0,
  updated_at timestamptz
);

create table if not exists at_result_rows (
  id           uuid    primary key default gen_random_uuid(),
  group_id     uuid    not null references at_result_groups(id) on delete cascade,
  team         text    not null default '',
  logo_serial  text    not null default '',
  kills        integer not null default 0,
  placement    integer not null default 0,
  penalty      integer not null default 0,
  position     integer not null default 0
);

create table if not exists at_sponsors (
  id         uuid    primary key default gen_random_uuid(),
  name       text    not null default '',
  logo_url   text    not null default '',
  url        text    not null default '',
  position   integer not null default 0
);

-- ── RLS ───────────────────────────────────────────────────────

alter table at_settings       enable row level security;
alter table at_staff_users    enable row level security;
alter table at_staff_sessions enable row level security;
alter table at_schedule       enable row level security;
alter table at_result_groups  enable row level security;
alter table at_result_rows    enable row level security;
alter table at_sponsors       enable row level security;

-- Lectura pública
drop policy if exists "at_pub_settings"  on at_settings;
drop policy if exists "at_pub_schedule"  on at_schedule;
drop policy if exists "at_pub_rg"        on at_result_groups;
drop policy if exists "at_pub_rr"        on at_result_rows;
drop policy if exists "at_pub_sponsors"  on at_sponsors;

create policy "at_pub_settings"  on at_settings      for select using (true);
create policy "at_pub_schedule"  on at_schedule      for select using (visible = true);
create policy "at_pub_rg"        on at_result_groups for select using (true);
create policy "at_pub_rr"        on at_result_rows   for select using (true);
create policy "at_pub_sponsors"  on at_sponsors      for select using (true);

-- ── Funciones con prefijo at_ ─────────────────────────────────

-- Login
create or replace function at_staff_login(p_username text, p_password text)
returns json language plpgsql security definer as $$
declare
  v_user at_staff_users;
  v_token text;
begin
  select * into v_user from at_staff_users where username = lower(trim(p_username));
  if not found or v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    raise exception 'Usuario o clave incorrectos';
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into at_staff_sessions(token, user_id) values(v_token, v_user.id);
  return json_build_object('token', v_token, 'user', json_build_object(
    'id', v_user.id, 'username', v_user.username,
    'display_name', v_user.display_name, 'role', v_user.role
  ));
end; $$;

-- Verificar sesión
create or replace function at_staff_me(p_token text)
returns json language plpgsql security definer as $$
declare v_user at_staff_users;
begin
  select u.* into v_user
  from at_staff_sessions s join at_staff_users u on s.user_id = u.id
  where s.token = p_token and s.expires_at > now();
  if not found then raise exception 'Sesión vencida. Inicia sesión de nuevo.'; end if;
  return json_build_object(
    'id', v_user.id, 'username', v_user.username,
    'display_name', v_user.display_name, 'role', v_user.role
  );
end; $$;

-- Logout
create or replace function at_staff_logout(p_token text)
returns void language plpgsql security definer as $$
begin
  delete from at_staff_sessions where token = p_token;
end; $$;

-- Cronograma para admin (incluye invisibles)
create or replace function at_staff_schedule(p_token text)
returns setof at_schedule language plpgsql security definer as $$
begin
  perform at_staff_me(p_token);
  return query select * from at_schedule order by position;
end; $$;

-- Guardar todo
create or replace function at_staff_save(p_token text, p_data jsonb)
returns void language plpgsql security definer as $$
declare
  v_touched uuid[];
  v_g jsonb; v_r jsonb; v_m jsonb; v_s jsonb;
  i integer;
begin
  perform at_staff_me(p_token);

  -- settings
  update at_settings set
    tournament = coalesce(p_data->'tournament', '{}'),
    links      = coalesce(p_data->'links', '{}'),
    prizes     = coalesce(p_data->'prizes', '[]')
  where id = 1;

  -- schedule
  delete from at_schedule;
  i := 0;
  for v_m in select * from jsonb_array_elements(coalesce(p_data->'schedule','[]')) loop
    insert into at_schedule(id, phase, group_name, date, time, rooms, status, visible, note, position)
    values (
      (v_m->>'id')::uuid, v_m->>'phase',
      coalesce(v_m->>'group', ''),
      nullif(v_m->>'date','')::date,
      nullif(v_m->>'time',''),
      coalesce((v_m->>'rooms')::integer, 1),
      coalesce(v_m->>'status','proximo'),
      coalesce((v_m->>'visible')::boolean, false),
      coalesce(v_m->>'note',''), i
    );
    i := i + 1;
  end loop;

  -- touched group ids
  select array_agg(x::uuid) into v_touched
  from jsonb_array_elements_text(coalesce(p_data->'touched','[]')) x;

  -- result groups & rows
  i := 0;
  for v_g in select * from jsonb_array_elements(coalesce(p_data->'results','[]')) loop
    insert into at_result_groups(id, phase, title, kind, qualify, position, updated_at)
    values (
      (v_g->>'id')::uuid, v_g->>'phase',
      coalesce(v_g->>'title',''), coalesce(v_g->>'kind','grupo'),
      coalesce((v_g->>'qualify')::integer, 0), i,
      case when (v_g->>'id')::uuid = any(v_touched) then now() else null end
    )
    on conflict(id) do update set
      phase = excluded.phase, title = excluded.title,
      kind = excluded.kind, qualify = excluded.qualify, position = excluded.position,
      updated_at = case when (v_g->>'id')::uuid = any(v_touched)
                   then now() else at_result_groups.updated_at end;

    if (v_g->>'id')::uuid = any(v_touched) then
      delete from at_result_rows where group_id = (v_g->>'id')::uuid;
      declare j integer := 0;
      begin
        for v_r in select * from jsonb_array_elements(coalesce(v_g->'rows','[]')) loop
          insert into at_result_rows(id, group_id, team, logo_serial, kills, placement, penalty, position)
          values (
            (v_r->>'id')::uuid, (v_g->>'id')::uuid,
            coalesce(v_r->>'team',''), coalesce(v_r->>'logo_serial',''),
            coalesce((v_r->>'kills')::integer, 0),
            coalesce((v_r->>'placement')::integer, 0),
            coalesce((v_r->>'penalty')::integer, 0),
            j
          );
          j := j + 1;
        end loop;
      end;
    end if;
    i := i + 1;
  end loop;

  delete from at_result_groups
  where id not in (
    select (x->>'id')::uuid
    from jsonb_array_elements(coalesce(p_data->'results','[]')) x
  );

  -- sponsors
  delete from at_sponsors;
  i := 0;
  for v_s in select * from jsonb_array_elements(coalesce(p_data->'sponsors','[]')) loop
    if coalesce(v_s->>'name','') <> '' or coalesce(v_s->>'logo_url','') <> '' then
      insert into at_sponsors(id, name, logo_url, url, position)
      values (
        (v_s->>'id')::uuid,
        coalesce(v_s->>'name',''),
        coalesce(v_s->>'logo_url', v_s->>'logo', ''),
        coalesce(v_s->>'url',''), i
      );
    end if;
    i := i + 1;
  end loop;
end; $$;

-- Gestión de usuarios
create or replace function at_staff_create_user(
  p_token text, p_username text, p_password text,
  p_display_name text default null, p_role text default 'editor'
) returns json language plpgsql security definer as $$
declare v_me json; v_user at_staff_users;
begin
  v_me := at_staff_me(p_token);
  if v_me->>'role' <> 'admin' then raise exception 'Solo admins pueden crear usuarios'; end if;
  if length(p_password) < 6 then raise exception 'La clave debe tener al menos 6 caracteres'; end if;
  insert into at_staff_users(username, display_name, password_hash, role)
  values(lower(trim(p_username)), p_display_name, crypt(p_password, gen_salt('bf')), p_role)
  returning * into v_user;
  return json_build_object('id', v_user.id, 'username', v_user.username);
end; $$;

create or replace function at_staff_list_users(p_token text)
returns json language plpgsql security definer as $$
begin
  perform at_staff_me(p_token);
  return (select json_agg(json_build_object(
    'id', id, 'username', username, 'display_name', display_name,
    'role', role, 'created_at', created_at
  ) order by created_at) from at_staff_users);
end; $$;

create or replace function at_staff_change_password(p_token text, p_old text, p_new text)
returns void language plpgsql security definer as $$
declare v_user at_staff_users; v_uid uuid;
begin
  select user_id into v_uid from at_staff_sessions where token = p_token and expires_at > now();
  if not found then raise exception 'Sesión vencida'; end if;
  select * into v_user from at_staff_users where id = v_uid;
  if v_user.password_hash <> crypt(p_old, v_user.password_hash) then
    raise exception 'Clave actual incorrecta';
  end if;
  if length(p_new) < 6 then raise exception 'La nueva clave debe tener al menos 6 caracteres'; end if;
  update at_staff_users set password_hash = crypt(p_new, gen_salt('bf')) where id = v_uid;
end; $$;

create or replace function at_cleanup_sessions()
returns void language sql security definer as $$
  delete from at_staff_sessions where expires_at < now();
$$;

-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Configuración del torneo
update at_settings set
  tournament = '{
    "org":           "Aliens Tournaments",
    "name":          "Aliens Championship",
    "season":        "S1",
    "game":          "Free Fire",
    "region":        "LATAM",
    "active":        true,
    "primary_color": "#00B4D8",
    "accent_color":  "#7B2FBE",
    "logo_url":      "",
    "pts_kill":      1,
    "max_teams":     72
  }'::jsonb,
  links  = '{"discord":"","youtube":"","twitter":"","instagram":"","tiktok":""}'::jsonb,
  prizes = '[
    {"place":1,"label":"Campeón","amount":""},
    {"place":2,"label":"2.° lugar","amount":""},
    {"place":3,"label":"3.° lugar","amount":""}
  ]'::jsonb
where id = 1;

-- Cronograma S1 (visible = false hasta activar desde el admin)
insert into at_schedule (phase, group_name, date, time, rooms, status, visible, position) values
  ('cuartos',   'G1', '2026-11-09', '18:00', 2, 'proximo', false, 0),
  ('cuartos',   'G2', '2026-11-09', '19:00', 2, 'proximo', false, 1),
  ('cuartos',   'G3', '2026-11-09', '20:00', 2, 'proximo', false, 2),
  ('cuartos',   'G4', '2026-11-10', '18:00', 2, 'proximo', false, 3),
  ('cuartos',   'G5', '2026-11-10', '19:00', 2, 'proximo', false, 4),
  ('cuartos',   'G6', '2026-11-10', '20:00', 2, 'proximo', false, 5),
  ('semifinal', 'G1', '2026-11-12', '18:00', 4, 'proximo', false, 6),
  ('semifinal', 'G2', '2026-11-12', '20:00', 4, 'proximo', false, 7),
  ('semifinal', 'G3', '2026-11-13', '20:00', 4, 'proximo', false, 8),
  ('final',     '',   '2026-11-16', '20:00', 6, 'proximo', false, 9);

-- Grupos de resultados
insert into at_result_groups (phase, title, kind, qualify, position) values
  ('cuartos',   'Grupo 1',            'grupo',   6,  0),
  ('cuartos',   'Grupo 2',            'grupo',   6,  1),
  ('cuartos',   'Grupo 3',            'grupo',   6,  2),
  ('cuartos',   'Grupo 4',            'grupo',   6,  3),
  ('cuartos',   'Grupo 5',            'grupo',   6,  4),
  ('cuartos',   'Grupo 6',            'grupo',   6,  5),
  ('cuartos',   'General Cuartos',    'general', 36, 6),
  ('semifinal', 'Grupo 1',            'grupo',   4,  7),
  ('semifinal', 'Grupo 2',            'grupo',   4,  8),
  ('semifinal', 'Grupo 3',            'grupo',   4,  9),
  ('semifinal', 'General Semifinal',  'general', 12, 10),
  ('final',     'Gran Final',         'general', 3,  11);

-- ── Admin de Aliens Tournaments ───────────────────────────────
-- CAMBIA 'cambia_esta_clave' antes de ejecutar
insert into at_staff_users (username, display_name, password_hash, role)
values (
  'aliens_admin',
  'Aliens Tournaments',
  crypt('cambia_esta_clave', gen_salt('bf')),
  'admin'
)
on conflict (username) do nothing;


-- ── Verificación final ────────────────────────────────────────
select
  (select tournament->>'org'    from at_settings) as org,
  (select tournament->>'season' from at_settings) as season,
  (select count(*)              from at_schedule) as fechas,
  (select count(*)              from at_result_groups) as grupos,
  (select count(*)              from at_staff_users)   as admins;
