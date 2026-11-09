-- ============================================================
-- ALIENS TOURNAMENTS — Setup completo
-- Ejecuta TODO de una vez en Supabase SQL Editor → New query
-- Cambia 'TU_CLAVE_AQUI' por tu contraseña antes de ejecutar
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
  id              uuid        primary key default gen_random_uuid(),
  username        text        not null unique,
  display_name    text,
  password_hash   text        not null,
  role            text        not null default 'editor' check (role in ('editor','admin')),
  failed_attempts int         not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists at_staff_sessions (
  token      text        primary key,
  user_id    uuid        not null references at_staff_users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '8 hours'),
  created_at timestamptz not null default now()
);

create table if not exists at_schedule (
  id         uuid    primary key default gen_random_uuid(),
  phase      text    not null,
  group_name text    not null default '',
  date       date,
  time       text,
  rooms      integer not null default 1,
  status     text    not null default 'proximo' check (status in ('proximo','envivo','finalizado')),
  visible    boolean not null default false,
  note       text    not null default '',
  position   integer not null default 0
);

create table if not exists at_result_groups (
  id         uuid    primary key default gen_random_uuid(),
  phase      text    not null,
  title      text    not null,
  kind       text    not null default 'grupo' check (kind in ('grupo','general')),
  qualify    integer not null default 0,
  position   integer not null default 0,
  updated_at timestamptz
);

create table if not exists at_result_rows (
  id          uuid    primary key default gen_random_uuid(),
  group_id    uuid    not null references at_result_groups(id) on delete cascade,
  team        text    not null default '',
  logo_serial text    not null default '',
  kills       integer not null default 0,
  placement   integer not null default 0,
  penalty     integer not null default 0,
  position    integer not null default 0
);

create table if not exists at_sponsors (
  id       uuid    primary key default gen_random_uuid(),
  name     text    not null default '',
  logo_url text    not null default '',
  url      text    not null default '',
  position integer not null default 0
);

create table if not exists at_teams (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  slug       text        not null unique,
  country    text        not null default '',
  active     boolean     not null default true,
  instagram  text        not null default '',
  created_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────

alter table at_settings       enable row level security;
alter table at_staff_users    enable row level security;
alter table at_staff_sessions enable row level security;
alter table at_schedule       enable row level security;
alter table at_result_groups  enable row level security;
alter table at_result_rows    enable row level security;
alter table at_sponsors       enable row level security;
alter table at_teams          enable row level security;

drop policy if exists "at_pub_settings" on at_settings;
drop policy if exists "at_pub_schedule" on at_schedule;
drop policy if exists "at_pub_rg"       on at_result_groups;
drop policy if exists "at_pub_rr"       on at_result_rows;
drop policy if exists "at_pub_sponsors" on at_sponsors;
drop policy if exists "at_pub_teams"    on at_teams;

create policy "at_pub_settings" on at_settings      for select using (true);
create policy "at_pub_schedule" on at_schedule      for select using (visible = true);
create policy "at_pub_rg"       on at_result_groups for select using (true);
create policy "at_pub_rr"       on at_result_rows   for select using (true);
create policy "at_pub_sponsors" on at_sponsors      for select using (true);
create policy "at_pub_teams"    on at_teams         for select using (true);

-- ── Funciones ─────────────────────────────────────────────────

create or replace function at_staff_login(p_username text, p_password text)
returns json language plpgsql security definer as $$
declare v_user at_staff_users; v_token text; v_next int;
begin
  select * into v_user from at_staff_users where username = lower(trim(p_username));
  if not found then raise exception 'Usuario o clave incorrectos'; end if;
  if v_user.locked_until is not null and v_user.locked_until > now() then
    raise exception 'Cuenta bloqueada. Intenta en % min.',
      ceil(extract(epoch from (v_user.locked_until - now())) / 60)::int;
  end if;
  if v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    v_next := v_user.failed_attempts + 1;
    update at_staff_users set
      failed_attempts = v_next,
      locked_until    = case when v_next >= 5 then now() + interval '15 minutes' else locked_until end
    where id = v_user.id;
    if v_next >= 5 then raise exception 'Demasiados intentos. Cuenta bloqueada 15 minutos.';
    else raise exception 'Usuario o clave incorrectos (intento % de 5).', v_next; end if;
  end if;
  update at_staff_users set failed_attempts = 0, locked_until = null where id = v_user.id;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into at_staff_sessions(token, user_id, expires_at)
  values (v_token, v_user.id, now() + interval '8 hours');
  return json_build_object('token', v_token, 'user', json_build_object(
    'id', v_user.id, 'username', v_user.username,
    'display_name', v_user.display_name, 'role', v_user.role
  ));
end; $$;

create or replace function at_staff_me(p_token text)
returns json language plpgsql security definer as $$
declare v_user at_staff_users;
begin
  select u.* into v_user
  from at_staff_sessions s join at_staff_users u on s.user_id = u.id
  where s.token = p_token and s.expires_at > now();
  if not found then raise exception 'Sesión vencida. Inicia sesión de nuevo.'; end if;
  return json_build_object('id', v_user.id, 'username', v_user.username,
    'display_name', v_user.display_name, 'role', v_user.role);
end; $$;

create or replace function at_staff_logout(p_token text)
returns void language plpgsql security definer as $$
begin delete from at_staff_sessions where token = p_token; end; $$;

create or replace function at_staff_schedule(p_token text)
returns setof at_schedule language plpgsql security definer as $$
begin
  perform at_staff_me(p_token);
  return query select * from at_schedule order by position;
end; $$;

create or replace function at_staff_save(p_token text, p_data jsonb)
returns void language plpgsql security definer as $$
declare
  v_touched uuid[];
  v_g jsonb; v_r jsonb; v_m jsonb; v_s jsonb;
  i integer;
begin
  perform at_staff_me(p_token);

  update at_settings set
    tournament = coalesce(p_data->'tournament', '{}'),
    links      = coalesce(p_data->'links', '{}'),
    prizes     = coalesce(p_data->'prizes', '[]')
  where id = 1;

  delete from at_schedule where true;
  i := 0;
  for v_m in select * from jsonb_array_elements(coalesce(p_data->'schedule','[]')) loop
    insert into at_schedule(id, phase, group_name, date, time, rooms, status, visible, note, position)
    values (
      (v_m->>'id')::uuid, v_m->>'phase', coalesce(v_m->>'group',''),
      nullif(v_m->>'date','')::date, nullif(v_m->>'time',''),
      coalesce((v_m->>'rooms')::integer,1), coalesce(v_m->>'status','proximo'),
      coalesce((v_m->>'visible')::boolean,false), coalesce(v_m->>'note',''), i
    );
    i := i + 1;
  end loop;

  select array_agg(x::uuid) into v_touched
  from jsonb_array_elements_text(coalesce(p_data->'touched','[]')) x;

  i := 0;
  for v_g in select * from jsonb_array_elements(coalesce(p_data->'results','[]')) loop
    insert into at_result_groups(id, phase, title, kind, qualify, position, updated_at)
    values (
      (v_g->>'id')::uuid, v_g->>'phase', coalesce(v_g->>'title',''),
      coalesce(v_g->>'kind','grupo'), coalesce((v_g->>'qualify')::integer,0), i,
      case when (v_g->>'id')::uuid = any(v_touched) then now() else null end
    )
    on conflict(id) do update set
      phase      = excluded.phase,
      title      = excluded.title,
      kind       = excluded.kind,
      qualify    = excluded.qualify,
      position   = excluded.position,
      updated_at = case when (v_g->>'id')::uuid = any(v_touched) then now() else at_result_groups.updated_at end;

    if (v_g->>'id')::uuid = any(v_touched) then
      delete from at_result_rows where group_id = (v_g->>'id')::uuid;
      declare j integer := 0;
      begin
        for v_r in select * from jsonb_array_elements(coalesce(v_g->'rows','[]')) loop
          insert into at_result_rows(id, group_id, team, logo_serial, kills, placement, penalty, position)
          values (
            (v_r->>'id')::uuid, (v_g->>'id')::uuid,
            coalesce(v_r->>'team',''), coalesce(v_r->>'logo_serial',''),
            coalesce((v_r->>'kills')::integer,0),
            coalesce((v_r->>'placement')::integer,0),
            coalesce((v_r->>'penalty')::integer,0), j
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

  delete from at_sponsors where true;
  i := 0;
  for v_s in select * from jsonb_array_elements(coalesce(p_data->'sponsors','[]')) loop
    if coalesce(v_s->>'name','') <> '' or coalesce(v_s->>'logo_url','') <> '' then
      insert into at_sponsors(id, name, logo_url, url, position)
      values (
        (v_s->>'id')::uuid, coalesce(v_s->>'name',''),
        coalesce(v_s->>'logo_url', v_s->>'logo', ''),
        coalesce(v_s->>'url',''), i
      );
    end if;
    i := i + 1;
  end loop;

  if p_data ? 'teams' then
    for v_s in select * from jsonb_array_elements(p_data->'teams') loop
      insert into at_teams(id, name, slug, country, active, instagram)
      values (
        coalesce((v_s->>'id')::uuid, gen_random_uuid()),
        trim(coalesce(v_s->>'name','')),
        lower(trim(coalesce(v_s->>'slug',''))),
        coalesce(v_s->>'country',''),
        coalesce((v_s->>'active')::boolean, true),
        coalesce(v_s->>'instagram','')
      )
      on conflict(id) do update set
        name      = trim(coalesce(v_s->>'name','')),
        slug      = lower(trim(coalesce(v_s->>'slug',''))),
        country   = coalesce(v_s->>'country',''),
        active    = coalesce((v_s->>'active')::boolean, true),
        instagram = coalesce(v_s->>'instagram','');
    end loop;
    delete from at_teams
    where id not in (
      select (x->>'id')::uuid
      from jsonb_array_elements(p_data->'teams') x
      where (x->>'id') is not null
    );
  end if;
end; $$;

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

create or replace function at_staff_update_user(
  p_token text, p_id uuid, p_role text, p_password text default null
) returns void language plpgsql security definer as $$
declare v_me json;
begin
  v_me := at_staff_me(p_token);
  if v_me->>'role' <> 'admin' then raise exception 'Solo admins pueden modificar usuarios'; end if;
  if p_password is not null then
    if length(p_password) < 6 then raise exception 'La clave debe tener al menos 6 caracteres'; end if;
    update at_staff_users set role = p_role, password_hash = crypt(p_password, gen_salt('bf')) where id = p_id;
  else
    update at_staff_users set role = p_role where id = p_id;
  end if;
end; $$;

create or replace function at_staff_delete_user(p_token text, p_id uuid)
returns void language plpgsql security definer as $$
declare v_me json;
begin
  v_me := at_staff_me(p_token);
  if v_me->>'role' <> 'admin' then raise exception 'Solo admins pueden eliminar usuarios'; end if;
  if (v_me->>'id')::uuid = p_id then raise exception 'No puedes eliminarte a ti mismo'; end if;
  delete from at_staff_users where id = p_id;
end; $$;

create or replace function at_staff_change_password(p_token text, p_old text, p_new text)
returns void language plpgsql security definer as $$
declare v_user at_staff_users; v_uid uuid;
begin
  select user_id into v_uid from at_staff_sessions where token = p_token and expires_at > now();
  if not found then raise exception 'Sesión vencida'; end if;
  select * into v_user from at_staff_users where id = v_uid;
  if v_user.password_hash <> crypt(p_old, v_user.password_hash) then raise exception 'Clave actual incorrecta'; end if;
  if length(p_new) < 6 then raise exception 'La nueva clave debe tener al menos 6 caracteres'; end if;
  update at_staff_users set password_hash = crypt(p_new, gen_salt('bf')) where id = v_uid;
end; $$;

-- ── Configuración inicial de Aliens Tournaments ───────────────

update at_settings set
  tournament = '{
    "name":     "Aliens Championship",
    "season":   "S1",
    "game":     "Free Fire",
    "region":   "LATAM",
    "state":    "en_juego"
  }'::jsonb,
  links = '{
    "whatsapp":  "",
    "instagram": "",
    "discord":   "",
    "tiktok":    "",
    "youtube":   "",
    "twitch":    ""
  }'::jsonb,
  prizes = '[
    {"place": "1° Lugar", "amount": ""},
    {"place": "2° Lugar", "amount": ""},
    {"place": "3° Lugar", "amount": ""}
  ]'::jsonb
where id = 1;

-- ── Admin ─────────────────────────────────────────────────────
-- ⚠️  CAMBIA 'TU_CLAVE_AQUI' por tu clave real

insert into at_staff_users (username, display_name, password_hash, role)
values (
  'aliens_admin',
  'Aliens Tournaments',
  crypt('TU_CLAVE_AQUI', gen_salt('bf')),
  'admin'
)
on conflict (username) do update
  set password_hash = crypt('TU_CLAVE_AQUI', gen_salt('bf'));

-- ── Verificación ──────────────────────────────────────────────
select
  (select count(*) from at_staff_users)   as admins,
  (select count(*) from at_schedule)      as schedule,
  (select count(*) from at_result_groups) as grupos,
  (select count(*) from at_teams)         as equipos;
