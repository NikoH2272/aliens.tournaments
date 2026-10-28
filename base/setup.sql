-- ============================================================
-- QUALIFER RUSHEO — Setup completo Supabase
-- Ejecuta TODO esto de una vez en SQL Editor → New query
-- ============================================================

-- ── Extensión para contraseñas y UUIDs ──────────────────────
create extension if not exists "pgcrypto";

-- ── Configuración general (torneo, links, premios) ──────────
create table if not exists settings (
  id         integer primary key default 1,
  tournament jsonb    not null default '{}',
  links      jsonb    not null default '{}',
  prizes     jsonb    not null default '[]',
  constraint single_row check (id = 1)
);
insert into settings(id) values(1) on conflict do nothing;

-- ── Staff ────────────────────────────────────────────────────
create table if not exists staff_users (
  id            uuid    primary key default gen_random_uuid(),
  username      text    not null unique,
  display_name  text,
  password_hash text    not null,
  role          text    not null default 'editor' check (role in ('editor','admin')),
  created_at    timestamptz not null default now()
);

create table if not exists staff_sessions (
  token      text        primary key,
  user_id    uuid        not null references staff_users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- ── Cronograma ───────────────────────────────────────────────
create table if not exists schedule (
  id         uuid        primary key default gen_random_uuid(),
  phase      text        not null,
  group_name text        not null default '',
  date       date,
  time       text,
  rooms      integer     not null default 1,
  status     text        not null default 'proximo' check (status in ('proximo','envivo','finalizado')),
  visible    boolean     not null default false,
  note       text        not null default '',
  position   integer     not null default 0
);

-- ── Grupos de resultados ─────────────────────────────────────
create table if not exists result_groups (
  id         uuid        primary key default gen_random_uuid(),
  phase      text        not null,
  title      text        not null,
  kind       text        not null default 'grupo' check (kind in ('grupo','general')),
  qualify    integer     not null default 0,
  position   integer     not null default 0,
  updated_at timestamptz
);

-- ── Filas de resultados ──────────────────────────────────────
create table if not exists result_rows (
  id           uuid    primary key default gen_random_uuid(),
  group_id     uuid    not null references result_groups(id) on delete cascade,
  team         text    not null default '',
  logo_serial  text    not null default '',
  kills        integer not null default 0,
  placement    integer not null default 0,
  penalty      integer not null default 0,
  position     integer not null default 0
);

-- ── Sponsors ─────────────────────────────────────────────────
create table if not exists sponsors (
  id         uuid    primary key default gen_random_uuid(),
  name       text    not null default '',
  logo_url   text    not null default '',
  url        text    not null default '',
  position   integer not null default 0
);

-- ============================================================
-- RLS — lectura pública, escritura solo staff vía funciones
-- ============================================================
alter table settings        enable row level security;
alter table staff_users     enable row level security;
alter table staff_sessions  enable row level security;
alter table schedule        enable row level security;
alter table result_groups   enable row level security;
alter table result_rows     enable row level security;
alter table sponsors        enable row level security;

-- Lectura pública (drop first so re-runs don't fail)
drop policy if exists "public_read_settings"      on settings;
drop policy if exists "public_read_schedule"      on schedule;
drop policy if exists "public_read_result_groups" on result_groups;
drop policy if exists "public_read_result_rows"   on result_rows;
drop policy if exists "public_read_sponsors"      on sponsors;

create policy "public_read_settings"      on settings      for select using (true);
create policy "public_read_schedule"      on schedule      for select using (visible = true);
create policy "public_read_result_groups" on result_groups for select using (true);
create policy "public_read_result_rows"   on result_rows   for select using (true);
create policy "public_read_sponsors"      on sponsors      for select using (true);

-- ============================================================
-- FUNCIONES DE STAFF
-- ============================================================

-- ── Login ─────────────────────────────────────────────────────
create or replace function staff_login(p_username text, p_password text)
returns json language plpgsql security definer as $$
declare
  v_user staff_users;
  v_token text;
begin
  select * into v_user from staff_users where username = lower(trim(p_username));
  if not found or v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    raise exception 'Usuario o clave incorrectos';
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into staff_sessions(token, user_id) values(v_token, v_user.id);
  return json_build_object('token', v_token, 'user', json_build_object(
    'id', v_user.id, 'username', v_user.username,
    'display_name', v_user.display_name, 'role', v_user.role
  ));
end; $$;

-- ── Verificar sesión ──────────────────────────────────────────
create or replace function staff_me(p_token text)
returns json language plpgsql security definer as $$
declare v_user staff_users;
begin
  select u.* into v_user
  from staff_sessions s join staff_users u on s.user_id = u.id
  where s.token = p_token and s.expires_at > now();
  if not found then raise exception 'Sesión vencida. Inicia sesión de nuevo.'; end if;
  return json_build_object(
    'id', v_user.id, 'username', v_user.username,
    'display_name', v_user.display_name, 'role', v_user.role
  );
end; $$;

-- ── Logout ────────────────────────────────────────────────────
create or replace function staff_logout(p_token text)
returns void language plpgsql security definer as $$
begin
  delete from staff_sessions where token = p_token;
end; $$;

-- ── Cronograma staff (incluye invisibles) ─────────────────────
create or replace function staff_schedule(p_token text)
returns setof schedule language plpgsql security definer as $$
begin
  perform staff_me(p_token);
  return query select * from schedule order by position;
end; $$;

-- ── Guardar todo ──────────────────────────────────────────────
create or replace function staff_save(p_token text, p_data jsonb)
returns void language plpgsql security definer as $$
declare
  v_touched uuid[];
  v_g jsonb; v_r jsonb; v_m jsonb; v_s jsonb;
  i integer;
begin
  perform staff_me(p_token);

  -- settings
  update settings set
    tournament = coalesce(p_data->'tournament', '{}'),
    links      = coalesce(p_data->'links', '{}'),
    prizes     = coalesce(p_data->'prizes', '[]')
  where id = 1;

  -- schedule
  delete from schedule;
  i := 0;
  for v_m in select * from jsonb_array_elements(coalesce(p_data->'schedule','[]')) loop
    insert into schedule(id, phase, group_name, date, time, rooms, status, visible, note, position)
    values (
      (v_m->>'id')::uuid,
      v_m->>'phase',
      coalesce(v_m->>'group', ''),
      nullif(v_m->>'date','')::date,
      nullif(v_m->>'time',''),
      coalesce((v_m->>'rooms')::integer, 1),
      coalesce(v_m->>'status','proximo'),
      coalesce((v_m->>'visible')::boolean, false),
      coalesce(v_m->>'note',''),
      i
    );
    i := i + 1;
  end loop;

  -- touched group ids
  select array_agg(x::uuid) into v_touched
  from jsonb_array_elements_text(coalesce(p_data->'touched','[]')) x;

  -- result groups & rows
  i := 0;
  for v_g in select * from jsonb_array_elements(coalesce(p_data->'results','[]')) loop
    insert into result_groups(id, phase, title, kind, qualify, position, updated_at)
    values (
      (v_g->>'id')::uuid, v_g->>'phase',
      coalesce(v_g->>'title',''), coalesce(v_g->>'kind','grupo'),
      coalesce((v_g->>'qualify')::integer, 0), i,
      case when (v_g->>'id')::uuid = any(v_touched) then now() else null end
    )
    on conflict(id) do update set
      phase      = excluded.phase,   title    = excluded.title,
      kind       = excluded.kind,    qualify  = excluded.qualify,
      position   = excluded.position,
      updated_at = case when (v_g->>'id')::uuid = any(v_touched) then now() else result_groups.updated_at end;

    if (v_g->>'id')::uuid = any(v_touched) then
      delete from result_rows where group_id = (v_g->>'id')::uuid;
      declare j integer := 0;
      begin
        for v_r in select * from jsonb_array_elements(coalesce(v_g->'rows','[]')) loop
          insert into result_rows(id, group_id, team, logo_serial, kills, placement, penalty, position)
          values (
            (v_r->>'id')::uuid, (v_g->>'id')::uuid,
            coalesce(v_r->>'team',''),
            coalesce(v_r->>'logo_serial',''),
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

  -- limpiar grupos eliminados
  delete from result_groups
  where id not in (
    select (x->>'id')::uuid
    from jsonb_array_elements(coalesce(p_data->'results','[]')) x
  );

  -- sponsors
  delete from sponsors;
  i := 0;
  for v_s in select * from jsonb_array_elements(coalesce(p_data->'sponsors','[]')) loop
    if coalesce(v_s->>'name','') <> '' or coalesce(v_s->>'logo_url', v_s->>'logo', '') <> '' then
      insert into sponsors(id, name, logo_url, url, position)
      values (
        (v_s->>'id')::uuid,
        coalesce(v_s->>'name',''),
        coalesce(v_s->>'logo_url', v_s->>'logo', ''),
        coalesce(v_s->>'url',''),
        i
      );
    end if;
    i := i + 1;
  end loop;
end; $$;

-- ── Gestión de usuarios ───────────────────────────────────────
create or replace function staff_create_user(
  p_token text, p_username text, p_password text,
  p_display_name text default null, p_role text default 'editor'
) returns json language plpgsql security definer as $$
declare v_me json; v_user staff_users;
begin
  v_me := staff_me(p_token);
  if v_me->>'role' <> 'admin' then raise exception 'Solo admins pueden crear usuarios'; end if;
  if length(p_password) < 6 then raise exception 'La clave debe tener al menos 6 caracteres'; end if;
  insert into staff_users(username, display_name, password_hash, role)
  values(lower(trim(p_username)), p_display_name, crypt(p_password, gen_salt('bf')), p_role)
  returning * into v_user;
  return json_build_object('id', v_user.id, 'username', v_user.username);
end; $$;

create or replace function staff_list_users(p_token text)
returns json language plpgsql security definer as $$
begin
  perform staff_me(p_token);
  return (select json_agg(json_build_object(
    'id', id, 'username', username, 'display_name', display_name,
    'role', role, 'created_at', created_at
  ) order by created_at) from staff_users);
end; $$;

create or replace function staff_update_user(
  p_token text, p_id uuid, p_role text, p_password text default null
) returns void language plpgsql security definer as $$
declare v_me json;
begin
  v_me := staff_me(p_token);
  if v_me->>'role' <> 'admin' then raise exception 'Solo admins pueden modificar usuarios'; end if;
  if p_password is not null then
    if length(p_password) < 6 then raise exception 'La clave debe tener al menos 6 caracteres'; end if;
    update staff_users set role = p_role, password_hash = crypt(p_password, gen_salt('bf')) where id = p_id;
  else
    update staff_users set role = p_role where id = p_id;
  end if;
end; $$;

create or replace function staff_delete_user(p_token text, p_id uuid)
returns void language plpgsql security definer as $$
declare v_me json;
begin
  v_me := staff_me(p_token);
  if v_me->>'role' <> 'admin' then raise exception 'Solo admins pueden eliminar usuarios'; end if;
  if (v_me->>'id')::uuid = p_id then raise exception 'No puedes eliminarte a ti mismo'; end if;
  delete from staff_users where id = p_id;
end; $$;

create or replace function staff_change_password(p_token text, p_old text, p_new text)
returns void language plpgsql security definer as $$
declare v_user staff_users; v_user_id uuid;
begin
  select user_id into v_user_id from staff_sessions where token = p_token and expires_at > now();
  if not found then raise exception 'Sesión vencida'; end if;
  select * into v_user from staff_users where id = v_user_id;
  if v_user.password_hash <> crypt(p_old, v_user.password_hash) then
    raise exception 'Clave actual incorrecta';
  end if;
  if length(p_new) < 6 then raise exception 'La nueva clave debe tener al menos 6 caracteres'; end if;
  update staff_users set password_hash = crypt(p_new, gen_salt('bf')) where id = v_user_id;
end; $$;

-- ── Limpiar sesiones vencidas ─────────────────────────────────
create or replace function cleanup_sessions()
returns void language sql security definer as $$
  delete from staff_sessions where expires_at < now();
$$;

-- ============================================================
-- PRIMER USUARIO ADMIN
-- Cambia 'rusheo2025' por tu clave antes de ejecutar
-- ============================================================
insert into staff_users(username, display_name, password_hash, role)
values(
  'admin',
  'Coach Niko',
  crypt('rusheo2025', gen_salt('bf')),
  'admin'
)
on conflict (username) do nothing;
