-- =============================================================================
-- Piloto abierto Dolfs — esquema inicial
--
-- Regla de negocio central: solo se indexan tiendas Shopify, WooCommerce o
-- WordPress con tienda. Cualquier otra plataforma queda en 'lista_espera'.
-- Nunca se rechaza a un comercio por su plataforma.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type estado_comercio as enum (
  'pendiente',      -- inscrito, esperando primera ingesta
  'validando',      -- ingesta en curso o reintentando
  'indexado',       -- catalogo disponible en los asistentes
  'lista_espera',   -- plataforma fuera del alcance del piloto
  'rechazado',      -- baja por decision nuestra (spam, contenido prohibido)
  'baja'            -- el comercio pidio salir
);

create type plataforma_comercio as enum (
  'shopify',
  'woocommerce',
  'wordpress',
  'otra'
);

create type tipo_handoff as enum (
  'recomendacion',  -- el asistente entrego el producto al usuario
  'clic'            -- el usuario abrio el enlace hacia el comercio
);

create type estado_trabajo as enum ('pendiente', 'corriendo', 'ok', 'error');

-- ---------------------------------------------------------------------------
-- comercios
-- ---------------------------------------------------------------------------

create table comercios (
  id                          uuid primary key default gen_random_uuid(),
  creado_en                   timestamptz not null default now(),
  actualizado_en              timestamptz not null default now(),

  -- formulario de inscripcion
  nombre_comercio             text        not null check (length(trim(nombre_comercio)) between 2 and 160),
  url_tienda                  text        not null,
  url_tienda_normalizada      text        not null,
  plataforma_declarada        plataforma_comercio not null,
  plataforma_detectada        plataforma_comercio,
  contacto_nombre             text        not null check (length(trim(contacto_nombre)) between 2 and 120),
  contacto_cargo              text        not null check (length(trim(contacto_cargo)) between 2 and 120),
  contacto_email              text        not null check (position('@' in contacto_email) > 1),
  contacto_telefono           text        not null,
  categoria_productos         text        not null,
  quiere_reunion              boolean     not null default false,
  referido_por                text,

  -- cohorte fundadora
  numero_inscripcion          integer     unique,
  es_fundador                 boolean     not null default false,
  estado                      estado_comercio not null default 'pendiente',

  -- consentimiento (requisito legal — Ley 21.719)
  consentimiento_aceptado_en  timestamptz not null,
  version_terminos            text        not null,
  ip_consentimiento           inet        not null,
  user_agent_consentimiento   text,

  -- operacion
  ultima_sincronizacion_en    timestamptz,
  ultimo_error_ingesta        text,
  motivo_estado               text,
  notas_internas              text
);

comment on column comercios.url_tienda_normalizada is
  'Host en minusculas sin www ni slash final. Evita inscripciones duplicadas de la misma tienda.';
comment on column comercios.plataforma_detectada is
  'Plataforma real detectada por el pipeline. Manda sobre plataforma_declarada.';
comment on column comercios.numero_inscripcion is
  'Solo se asigna a comercios dentro del alcance del piloto. Los de lista_espera no queman cupo de fundador.';

create unique index comercios_url_normalizada_unica on comercios (url_tienda_normalizada);
create index comercios_estado_idx                  on comercios (estado);
create index comercios_creado_en_idx               on comercios (creado_en desc);
create index comercios_referido_por_idx            on comercios (referido_por) where referido_por is not null;

-- ---------------------------------------------------------------------------
-- Cohorte fundadora: asignacion atomica por secuencia.
--
-- Un count(*) dentro del trigger daria el mismo numero a dos formularios
-- enviados al mismo tiempo. nextval() es atomico y no puede colisionar.
-- ---------------------------------------------------------------------------

create sequence comercios_numero_inscripcion_seq as integer start 1;

create or replace function asignar_numero_inscripcion()
returns trigger
language plpgsql
as $$
declare
  cupo_fundadores constant integer := 100;
begin
  -- Los comercios en lista de espera todavia no entran al piloto: no reciben
  -- numero. Si mas adelante abrimos su plataforma y cambian de estado, el
  -- numero se les asigna en ese momento (rama UPDATE).
  if new.estado <> 'lista_espera' and new.numero_inscripcion is null then
    new.numero_inscripcion := nextval('comercios_numero_inscripcion_seq');
    new.es_fundador := new.numero_inscripcion <= cupo_fundadores;
  end if;
  return new;
end;
$$;

create trigger trg_comercios_numero_inscripcion
before insert or update of estado on comercios
for each row execute function asignar_numero_inscripcion();

create or replace function tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger trg_comercios_actualizado_en
before update on comercios
for each row execute function tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- productos
--
-- Una fila por variante vendible: el SKU, el precio y el stock son por
-- variante, y el asistente necesita poder decir "talla M a $19.990".
-- ---------------------------------------------------------------------------

create table productos (
  id                       uuid primary key default gen_random_uuid(),
  comercio_id              uuid not null references comercios(id) on delete cascade,

  sku                      text,
  nombre                   text not null,
  descripcion              text,
  precio                   numeric(12,2),
  moneda                   text not null default 'CLP',
  stock_disponible         boolean,
  url_producto             text not null,
  imagen_url               text,
  categoria                text,

  activo                   boolean not null default true,
  hash_contenido           text,
  visto_por_ultima_vez_en  timestamptz not null default now(),
  creado_en                timestamptz not null default now(),
  actualizado_en           timestamptz not null default now()
);

comment on column productos.stock_disponible is
  'Booleano y no entero a proposito: Shopify /products.json solo expone disponibilidad por variante, no cantidad.';
comment on column productos.activo is
  'Los productos que desaparecen del catalogo se marcan inactivos, nunca se borran.';

-- La identidad de un producto es su URL: es lo que le entregamos al usuario.
-- El SKU NO es unico a proposito: Shopify permite el mismo SKU en varias
-- variantes y muchas tiendas lo dejan vacio o repetido. Un indice unico sobre
-- (comercio_id, sku) revienta la ingesta de tiendas perfectamente validas.
create unique index productos_comercio_url_unico on productos (comercio_id, url_producto);
create index productos_sku_idx on productos (comercio_id, sku) where sku is not null;
create index productos_comercio_activo_idx       on productos (comercio_id, activo);
create index productos_categoria_idx             on productos (categoria) where activo;

-- En productos, actualizado_en solo se mueve si cambio el contenido. Cada
-- resync toca las filas para refrescar visto_por_ultima_vez_en, y sin esto
-- "actualizado_en" pasaria a significar "corrio el cron", no "cambio el
-- precio" — que es justo lo que el asistente necesita saber.
create or replace function tocar_actualizado_en_producto()
returns trigger
language plpgsql
as $$
begin
  if new.hash_contenido is distinct from old.hash_contenido then
    new.actualizado_en := now();
  else
    new.actualizado_en := old.actualizado_en;
  end if;
  return new;
end;
$$;

create trigger trg_productos_actualizado_en
before update on productos
for each row execute function tocar_actualizado_en_producto();

-- ---------------------------------------------------------------------------
-- handoffs — el dato que define el pricing del servicio
-- ---------------------------------------------------------------------------

create table handoffs (
  id              uuid primary key default gen_random_uuid(),
  comercio_id     uuid not null references comercios(id) on delete cascade,
  -- on delete set null y no cascade: si se borra un producto el handoff debe
  -- sobrevivir. Es el numero con el que despues se negocia el precio.
  producto_id     uuid references productos(id) on delete set null,
  ocurrido_en     timestamptz not null default now(),
  tipo            tipo_handoff not null default 'recomendacion',
  cliente_llm     text not null default 'otro',
  consulta_origen text,
  url_destino     text not null
);

comment on column handoffs.consulta_origen is
  'Texto de busqueda anonimizado: sin emails, telefonos ni RUT. Ver lib/anonimizar.ts';

create index handoffs_comercio_fecha_idx on handoffs (comercio_id, ocurrido_en desc);
create index handoffs_tipo_fecha_idx     on handoffs (tipo, ocurrido_en desc);
create index handoffs_producto_idx       on handoffs (producto_id) where producto_id is not null;

-- ---------------------------------------------------------------------------
-- Cola de ingesta (Postgres, sin infraestructura extra)
-- ---------------------------------------------------------------------------

create table trabajos_ingesta (
  id              uuid primary key default gen_random_uuid(),
  comercio_id     uuid not null references comercios(id) on delete cascade,
  tipo            text not null default 'inicial',
  estado          estado_trabajo not null default 'pendiente',
  intentos        integer not null default 0,
  disponible_en   timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  ultimo_error    text,
  creado_en       timestamptz not null default now(),
  finalizado_en   timestamptz
);

create index trabajos_pendientes_idx on trabajos_ingesta (estado, disponible_en);
-- Un solo trabajo activo por comercio: evita que el cron encole resyncs
-- encima de una ingesta que todavia esta corriendo.
create unique index trabajos_activo_por_comercio
  on trabajos_ingesta (comercio_id)
  where estado in ('pendiente', 'corriendo');

create table logs_ingesta (
  id          bigserial primary key,
  comercio_id uuid not null references comercios(id) on delete cascade,
  trabajo_id  uuid,
  nivel       text not null default 'info',
  etapa       text not null,
  mensaje     text not null,
  detalle     jsonb,
  creado_en   timestamptz not null default now()
);

create index logs_comercio_fecha_idx on logs_ingesta (comercio_id, creado_en desc);

-- Toma trabajos de la cola de forma segura con varios workers en paralelo, y
-- recupera los que quedaron colgados porque el worker murio a mitad de camino.
create or replace function tomar_trabajos_ingesta(
  p_limite integer default 3,
  p_bloqueo_segundos integer default 600
)
returns setof trabajos_ingesta
language plpgsql
as $$
begin
  return query
  update trabajos_ingesta t
  set estado          = 'corriendo',
      intentos        = t.intentos + 1,
      bloqueado_hasta = now() + make_interval(secs => p_bloqueo_segundos)
  where t.id in (
    select id
    from trabajos_ingesta
    where (estado = 'pendiente' and disponible_en <= now())
       or (estado = 'corriendo' and bloqueado_hasta < now())
    order by disponible_en
    limit p_limite
    for update skip locked
  )
  returning t.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limit del formulario (ventana fija por IP, sin Redis ni captcha)
-- ---------------------------------------------------------------------------

create table rate_limit_inscripciones (
  ip             inet        not null,
  ventana_inicio timestamptz not null,
  contador       integer     not null default 0,
  primary key (ip, ventana_inicio)
);

create or replace function registrar_intento_inscripcion(
  p_ip inet,
  p_limite integer default 5,
  p_ventana_segundos integer default 3600
)
returns boolean
language plpgsql
as $$
declare
  v_ventana  timestamptz;
  v_contador integer;
begin
  v_ventana := to_timestamp(
    floor(extract(epoch from now()) / p_ventana_segundos) * p_ventana_segundos
  );

  insert into rate_limit_inscripciones as r (ip, ventana_inicio, contador)
  values (p_ip, v_ventana, 1)
  on conflict (ip, ventana_inicio)
  do update set contador = r.contador + 1
  returning contador into v_contador;

  delete from rate_limit_inscripciones where ventana_inicio < now() - interval '1 day';

  return v_contador <= p_limite;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vista del panel interno
-- ---------------------------------------------------------------------------

create view vista_admin_comercios
with (security_invoker = true) as
select
  c.*,
  coalesce(p.activos, 0)   as productos_activos,
  coalesce(p.totales, 0)   as productos_totales,
  coalesce(h.totales, 0)   as handoffs_totales,
  coalesce(h.clics, 0)     as handoffs_clics
from comercios c
left join lateral (
  select count(*) filter (where activo) as activos,
         count(*)                       as totales
  from productos where comercio_id = c.id
) p on true
left join lateral (
  select count(*)                             as totales,
         count(*) filter (where tipo = 'clic') as clics
  from handoffs where comercio_id = c.id
) h on true;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Todas las tablas quedan cerradas y sin policies: se accede solo con la
-- service role key desde route handlers. La anon key viaja al browser, y sin
-- esto cualquiera podria leer los emails y telefonos de todos los inscritos.
-- ---------------------------------------------------------------------------

alter table comercios                enable row level security;
alter table productos                enable row level security;
alter table handoffs                 enable row level security;
alter table trabajos_ingesta         enable row level security;
alter table logs_ingesta             enable row level security;
alter table rate_limit_inscripciones enable row level security;

revoke all on vista_admin_comercios from anon, authenticated;
