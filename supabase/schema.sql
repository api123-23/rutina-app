-- Esquema de Rutina. Idempotente: se puede re-ejecutar.
-- Sin login: la app usa la clave anon y las tablas quedan abiertas a ella.

create table if not exists public.dias (
  fecha date primary key,
  desayuno boolean not null default false,
  almuerzo boolean not null default false,
  merienda boolean not null default false,
  cena boolean not null default false,
  hipopresivos boolean not null default false,
  estiramientos boolean not null default false,
  entreno boolean not null default false,
  eliptico_min integer check (eliptico_min >= 0)
);

-- Dieta: cada comida tiene componentes (Proteína, Carbohidrato...) y cada componente opciones con gramos.
create table if not exists public.dieta_items (
  id bigint generated always as identity primary key,
  comida text not null check (comida in ('desayuno', 'almuerzo', 'merienda', 'cena')),
  componente text not null,
  opcion text not null,
  gramos numeric,
  orden integer not null default 0
);

-- Listas de referencia: hipopresivos y estiramientos/postura, en orden.
create table if not exists public.lista_items (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('hipopresivos', 'estiramientos')),
  texto text not null,
  orden integer not null default 0
);

-- Rutinas de gym: dia = 1 lunes, 3 miércoles, 5 viernes.
create table if not exists public.ejercicios (
  id bigint generated always as identity primary key,
  dia smallint not null check (dia in (1, 3, 5)),
  nombre text not null,
  orden integer not null default 0
);

create table if not exists public.registros_ejercicio (
  id bigint generated always as identity primary key,
  ejercicio_id bigint not null references public.ejercicios (id) on delete cascade,
  fecha date not null default current_date,
  peso numeric,
  series integer,
  reps integer
);
create index if not exists registros_ejercicio_ejercicio_idx on public.registros_ejercicio (ejercicio_id, fecha desc);

do $$
declare t text;
begin
  foreach t in array array['dias', 'dieta_items', 'lista_items', 'ejercicios', 'registros_ejercicio'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists abierto on public.%I', t);
    execute format('create policy abierto on public.%I for all to anon using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to anon;
