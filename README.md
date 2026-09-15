# Dolfs — piloto abierto MCP

Puerta de entrada del piloto: landing de inscripción, pipeline de ingesta de
catálogos y panel interno.

Los ecommerce chilenos conectan su catálogo una vez y quedan disponibles dentro
de asistentes como ChatGPT y Claude. El asistente recomienda sus productos y
manda al usuario a la página del producto en el sitio del comercio. **El
checkout siempre queda en el sitio del comercio: acá no se procesan pagos.**

---

## Alcance del piloto

Solo se indexan tiendas en **Shopify**, **WooCommerce** o **WordPress con
tienda**. Cualquier otra plataforma queda en `lista_espera` — nunca se rechaza.

Esa regla se hace cumplir en **dos capas**, y la segunda es la que manda:

1. El `select` del formulario. Si el comercio marca "Otra", entra directo a
   lista de espera y ve el mensaje correspondiente al instante.
2. **La detección del pipeline** (`lib/ingesta/detectar-plataforma.ts`). Abre el
   sitio y determina la plataforma real. Lo que declaró el comercio no decide
   nada:
   - Declaró Shopify pero corre otra cosa → `lista_espera`.
   - Declaró "Otra" sin saber que su tienda es WooCommerce → entra al piloto, y
     recién ahí se le asigna número de inscripción.
   - Es WordPress pero no publica catálogo → `lista_espera`. El alcance es
     WordPress *con tienda*.

La lista de plataformas soportadas vive en un solo lugar:
`lib/plataformas.ts`. Abrir una plataforma nueva es agregarla ahí y escribir su
conector.

---

## Correr en local

```bash
npm install
cp .env.example .env.local     # y completa los valores
npm run dev                    # http://localhost:3000
```

Antes de aplicar la migración necesitas un proyecto de Supabase. En el SQL
Editor, pega y ejecuta:

```
supabase/migrations/0001_esquema_inicial.sql
```

O con la CLI de Supabase:

```bash
supabase db push
```

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Pruebas de la lógica pura (robots, precios, JSON-LD, UTMs) |
| `npm run typecheck` | `tsc --noEmit` |

Las pruebas corren con `--conditions=react-server` porque varios módulos usan
el guard `server-only`; fuera de esa condición, importarlos lanza error a
propósito.

---

## Variables de entorno

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sí | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Clave `service_role`. **Nunca** al browser ni con prefijo `NEXT_PUBLIC_` |
| `ADMIN_USER` | sí | Usuario de Basic Auth de `/admin` |
| `ADMIN_PASSWORD` | sí | Contraseña de Basic Auth de `/admin` |
| `CRON_SECRET` | sí | Bearer token de `/api/ingesta/worker` y `/api/cron/resync` |
| `MCP_API_KEY` | no | Token con que el servidor MCP llama a `POST /api/handoffs`. Si falta, ese endpoint acepta el `CRON_SECRET` |
| `NEXT_PUBLIC_URL_BASE` | no | Base para los enlaces `/ir?h=`. En Vercel se infiere sola |
| `DOLFS_BOT_USER_AGENT` | no | User-Agent del bot. Debe llevar una URL de contacto **real** |

Genera el `CRON_SECRET` con `openssl rand -hex 32`.

> `DOLFS_BOT_USER_AGENT` trae por defecto `https://dolfs.cl/bot` y
> `contacto@dolfs.cl`, que son supuestos. Cámbialos por los reales antes de
> salir a producción: es la dirección a la que va a escribir un comercio que
> quiere saber quién le está leyendo el sitio.

---

## Arquitectura

```
app/
  page.tsx                    Landing
  terminos/                   Borrador legal (versionado)
  admin/                      Panel interno (Basic Auth vía middleware.ts)
    comercios/[id]/           Ficha + log de ingesta por comercio
    lista-espera/             Cola fuera de alcance
  ir/route.ts                 Salto medido hacia el comercio
  api/
    inscripcion/              POST del formulario
    handoffs/                 POST desde el servidor MCP
    ingesta/worker/           Procesa la cola
    cron/resync/              Encola re-sincronizaciones diarias
lib/
  plataformas.ts              Alcance del piloto (fuente única)
  ingesta/
    detectar-plataforma.ts    Decide si el comercio entra o no
    http.ts                   Fetch con guard anti-SSRF, timeout y tope de tamaño
    robots.ts                 Parser de robots.txt
    conectores/               shopify · woocommerce · wordpress · jsonld
    normalizar.ts             Esquema único de producto
    persistir.ts              Upsert + marcado de inactivos
    cola.ts                   Cola en Postgres con backoff
supabase/migrations/          SQL versionado
tests/                        Pruebas de lógica pura
```

### Base de datos

| Tabla | Para qué |
| --- | --- |
| `comercios` | Inscripción, estado, cohorte fundadora y registro de consentimiento |
| `productos` | Catálogo normalizado, una fila por variante vendible |
| `handoffs` | Cada derivación del asistente al comercio |
| `trabajos_ingesta` | Cola de ingesta |
| `logs_ingesta` | Log por comercio, para diagnosticar por qué una tienda no indexó |
| `rate_limit_inscripciones` | Rate limit del formulario |

**RLS está activo en todas las tablas y no hay policies para `anon`.** El único
camino de acceso es la `service_role` desde route handlers. La clave anónima de
Supabase viaja al browser, y sin esto cualquiera podría leer los emails y
teléfonos de todos los comercios inscritos.

#### Cohorte fundadora

Los primeros 100 comercios **dentro del alcance** reciben `es_fundador = true`.
La asignación la hace un trigger con una secuencia de Postgres, no un
`count(*)`: dos formularios enviados al mismo tiempo recibirían el mismo número
con un contador, y `nextval()` es atómico.

Los comercios en lista de espera **no queman cupo**. Reciben número recién
cuando entran al piloto.

El número 100 está en `asignar_numero_inscripcion()`, en la migración.

---

## Pipeline de ingesta

1. **Detectar la plataforma real** desde el sitio (§ Alcance del piloto).
2. **Leer `robots.txt`** y respetarlo. Si bloquea el catálogo, la tienda no se
   indexa y el motivo queda en `logs_ingesta`.
3. **Extraer el catálogo**, priorizando siempre lo estructurado sobre el HTML:

   | Plataforma | Fuente |
   | --- | --- |
   | Shopify | `/products.json` (público, paginado) |
   | WooCommerce | Store API `/wp-json/wc/store/v1/products` (pública) |
   | WordPress | `/wp-json/wp/v2/product` → fallback a sitemap + JSON-LD |
   | Fallback general | `sitemap.xml` + JSON-LD `schema.org/Product` |

4. **Normalizar** al esquema único y **guardar**.
5. **Re-sincronizar cada 24 h**. Los productos que desaparecen se marcan
   `activo = false`; nunca se borran.

**Nunca se extrae**: datos de clientes, pedidos, emails ni nada detrás de
autenticación. Solo catálogo público.

### Decisiones que conviene conocer

- **Una fila por variante** en Shopify: el SKU, el precio y el stock son por
  variante, y el asistente tiene que poder decir "talla M a $19.990".
- **WooCommerce queda a nivel de producto padre.** Bajar a variaciones cuesta un
  request por variación contra el sitio del comercio; en una tienda de 800
  productos son 800 requests extra. Para el piloto no vale ese costo. Anotado en
  `lib/ingesta/conectores/woocommerce.ts`.
- **`stock_disponible` es booleano, no entero.** `/products.json` de Shopify solo
  expone disponibilidad por variante, nunca cantidad. Un entero daría una
  precisión que no tenemos.
- **El SKU no es único.** Shopify permite el mismo SKU en varias variantes. La
  identidad de un producto es su URL, que es lo que le entregamos al usuario.
- **Un catálogo vacío no desactiva nada.** Casi siempre significa que falló la
  lectura, no que el comercio cerró la tienda.
- **`actualizado_en` solo se mueve si cambió el contenido** (comparación por
  hash). Si no, significaría "corrió el cron" en vez de "cambió el precio".

### Diagnóstico

`/admin/comercios/<id>` muestra el log completo de ingesta del comercio, el
último error y el estado de sus trabajos en cola. Ahí está la respuesta a por
qué una tienda no indexó, sin entrar a la base.

---

## Instrumentación

Es el entregable crítico del piloto: sin estos números, el piloto no define
ningún precio después.

Se miden **dos cosas distintas**, y la diferencia entre ellas es lo que sostiene
una conversación de pricing:

| Tipo | Qué mide | Cuándo se escribe |
| --- | --- | --- |
| `recomendacion` | El asistente mostró el producto | `POST /api/handoffs` desde el servidor MCP |
| `clic` | El usuario abrió el enlace | `GET /ir?h=<handoff_id>` antes de redirigir |

Todas las URLs que se entregan llevan UTMs, para que el propio Analytics del
comercio vea llegar el tráfico con nuestro nombre:

```
?utm_source=dolfs&utm_medium=mcp&utm_campaign=piloto&utm_content=<comercio_id>
```

### Uso desde el servidor MCP

```http
POST /api/handoffs
Authorization: Bearer $MCP_API_KEY
Content-Type: application/json

{ "producto_id": "<uuid>", "cliente_llm": "claude", "consulta_origen": "zapatillas para trail" }
```

Respuesta:

```json
{
  "ok": true,
  "handoff_id": "...",
  "url_destino": "https://tienda.cl/products/x?utm_source=dolfs&...",
  "url_seguimiento": "https://dolfs.cl/ir?h=..."
}
```

Entrega `url_seguimiento` al usuario: registra el clic real y después redirige.
Si prefieres no meter un salto propio, entrega `url_destino` — pero entonces
solo se miden impresiones.

`consulta_origen` se anonimiza antes de guardarse: se borran emails, RUT,
teléfonos, tarjetas y URLs (`lib/anonimizar.ts`). Se guarda para entender qué se
busca, no para identificar a quién busca.

---

## Anti-spam

Sin captcha, por diseño:

- **Rate limit por IP**: 5 inscripciones por hora, en Postgres. El incremento y
  la lectura ocurren en la misma sentencia, así que dos envíos simultáneos no se
  cuelan por la ventana.
- **Honeypot**: campo `sitio_web`, fuera de pantalla y del foco. Si viene lleno
  respondemos como si todo hubiera salido bien y no guardamos nada, para no
  enseñarle al bot cuál fue el campo que lo delató.
- **URL única normalizada**: la misma tienda no puede inscribirse dos veces ni
  quemar cupos de fundador.

Si el rate limit falla por un problema de base, **deja pasar**: perder una
inscripción legítima cuesta más que recibir un formulario basura de más.

---

## Despliegue en Vercel

1. Importa el repo y carga todas las variables de entorno.
2. Los cron jobs están en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/resync",    "schedule": "0 7 * * *"   },
    { "path": "/api/ingesta/worker", "schedule": "*/10 * * * *" }
  ]
}
```

> **Plan Hobby**: permite como máximo 2 cron jobs y **solo frecuencia diaria**.
> El worker cada 10 minutos necesita plan Pro. En Hobby, la primera ingesta
> igual corre al momento de inscribirse (`after()` en el route handler) y los
> resyncs se procesan una vez al día; o puedes gatillar el worker desde fuera
> con `Authorization: Bearer $CRON_SECRET`.

`/api/ingesta/worker` declara `maxDuration = 300`, que también requiere Pro.

---

## Pendientes conocidos

- **`/terminos` es un BORRADOR** y lo dice en pantalla. Tiene que pasar por
  abogado **antes del 1 de diciembre** por la Ley 21.719. Si se cambia
  cualquier párrafo, hay que subir `VERSION_TERMINOS` en `lib/terminos.ts`: es
  lo que queda guardado junto al consentimiento de cada comercio y lo único que
  permite probar después qué versión aceptó cada uno.
- **No hay envío de correos.** El comercio ve la confirmación en pantalla, pero
  nadie le escribe cuando su tienda queda indexada ni cuando se abre su
  plataforma. La landing promete ese correo.
- **La reunión de 15 minutos** se guarda como flag (`quiere_reunion`) y se ve en
  el panel, pero no hay agendamiento: hay que contactarlos a mano.
- **Guard anti-SSRF**: queda una ventana de DNS rebinding entre la resolución y
  la conexión real. Cerrarla exige conectar por IP con cabecera `Host`, lo que
  rompe SNI en la mayoría de las tiendas. Anotado en `lib/ingesta/http.ts`.
- **Baja de comercios**: el estado `baja` existe y el pipeline lo respeta, pero
  no hay botón en el panel — hoy se hace por SQL. Los términos prometen 72 horas.
