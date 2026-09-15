# Dolfs — piloto abierto MCP

Contexto para asistentes de IA que trabajen en este repo. Léelo antes de tocar
código. El `README.md` tiene el setup; esto tiene **por qué** las cosas están
como están.

## Qué es

Los ecommerce chilenos conectan su catálogo una vez y quedan disponibles dentro
de asistentes de IA (Claude, ChatGPT) por medio de un servidor MCP. El asistente
recomienda sus productos y manda al usuario al carrito del comercio.

**El checkout siempre queda en el sitio del comercio. Acá no se procesan pagos.**

Este repo es la **puerta de entrada**: landing de inscripción, pipeline de
ingesta de catálogos, instrumentación de handoffs y panel interno. El servidor
MCP en sí vive fuera de este repo y consume `POST /api/handoffs`.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres) · Vercel

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm test           # 22 pruebas de lógica pura
npm run typecheck  # tsc --noEmit
```

`npm test` corre con `--conditions=react-server` porque varios módulos usan el
guard `server-only`; fuera de esa condición, importarlos lanza error a propósito.

## Reglas que no se rompen

Estas no son preferencias de estilo. Romper cualquiera tiene consecuencias
legales, de privacidad o de negocio.

1. **Solo Shopify, WooCommerce y WordPress con tienda.** Cualquier otra
   plataforma va a `lista_espera`. **Nunca** a `rechazado`: rechazar es una
   decisión sobre el comercio, no sobre su stack.

2. **La plataforma la decide la detección, no el formulario.**
   `lib/ingesta/detectar-plataforma.ts` abre el sitio y determina qué corre de
   verdad. Lo que el comercio declaró no decide nada. Un WordPress sin catálogo
   es un WordPress *sin tienda* y queda fuera.

3. **RLS activo y sin policies para `anon` en todas las tablas.** La anon key de
   Supabase viaja al browser; sin esto cualquiera leería los emails y teléfonos
   de todos los comercios inscritos. Todo acceso pasa por la service role desde
   route handlers.

4. **Nunca se extrae**: datos de clientes, pedidos, emails, ni nada detrás de
   autenticación. Solo catálogo público.

5. **`robots.txt` se respeta.** Si una tienda bloquea, no se indexa y el motivo
   queda en `logs_ingesta`. No hay bypass.

6. **El consentimiento se guarda con timestamp, versión del documento e IP.**
   Es requisito de la Ley 21.719, no un nice to have. Si cambias una línea de
   `/terminos`, sube `VERSION_TERMINOS` en `lib/terminos.ts` — es lo único que
   permite probar después qué versión aceptó cada comercio.

7. **Nunca publiques una tienda real en la demo sin autorización por escrito.**
   Las imágenes de `public/demo/` usan una tienda ficticia (Almacén Rivas) con
   packaging dibujado, no fotografiado. Publicar un comercio real dice
   públicamente que está en el piloto. Fuente en `scripts/mockup-demo.html`.

8. **Nada de datos personales en la landing pública.** Las capturas se recortan
   al área de contenido: nombres, URLs de conversación y barras de estado no van.

## Convenciones

- **El código está en español**: identificadores, nombres de archivo,
  comentarios y mensajes de commit. Es deliberado, no un descuido. Mantenlo.
- **Las tildes importan.** El texto visible por el usuario va con ortografía
  correcta. Los identificadores y nombres de campo van sin tilde (`categoria`,
  `contacto_telefono`) porque son claves de base de datos.
- **Los comentarios explican por qué, no qué.** Si un comentario repite lo que
  el código ya dice, sobra.
- Nombres de columna y de tabla en español y en `snake_case`.

## Mapa

```
app/
  page.tsx                  Landing
  terminos/                 Borrador legal, versionado
  admin/                    Panel (Basic Auth vía middleware.ts)
    comercios/[id]/         Ficha + log de ingesta por comercio
    lista-espera/           Cola fuera de alcance
    exportar/               CSV de inscripciones
  ir/route.ts               Salto medido hacia el comercio
  api/
    inscripcion/            POST del formulario
    handoffs/               POST desde el servidor MCP
    ingesta/worker/         Procesa la cola
    cron/resync/            Encola resyncs diarios
lib/
  plataformas.ts            Alcance del piloto (fuente única)
  ingesta/
    detectar-plataforma.ts  Decide si el comercio entra
    http.ts                 Fetch con guard anti-SSRF
    robots.ts               Parser de robots.txt
    conectores/             shopify · woocommerce · wordpress · jsonld
    normalizar.ts           Esquema único de producto
    persistir.ts            Upsert + marcado de inactivos
    cola.ts                 Cola en Postgres con backoff
supabase/migrations/        SQL versionado
scripts/mockup-demo.html    Fuente de las imágenes de demo
tests/                      Pruebas de lógica pura
```

## Decisiones ya tomadas (no las deshagas sin razón)

- **Cohorte fundadora por secuencia de Postgres, no por `count(*)`.** Dos
  formularios simultáneos recibirían el mismo número con un contador.
- **Los comercios en lista de espera no queman cupo de fundador.** El número se
  asigna recién al indexar, con catálogo ya leído. Ver `ejecutar.ts`.
- **La identidad de un producto es su URL, no su SKU.** Shopify permite el mismo
  SKU en varias variantes; un índice único sobre `(comercio_id, sku)` revienta
  la ingesta de tiendas perfectamente válidas.
- **`stock_disponible` es booleano, no entero.** Shopify solo expone
  disponibilidad por variante, nunca cantidad.
- **Una fila por variante en Shopify**, porque precio y stock son por variante.
  **WooCommerce queda a nivel de producto padre**: bajar a variaciones cuesta un
  request por variación contra el sitio del comercio.
- **Un catálogo vacío no desactiva nada.** Casi siempre significa que falló la
  lectura, no que el comercio cerró la tienda.
- **`actualizado_en` en `productos` solo se mueve si cambió el hash del
  contenido**, para que signifique "cambió el precio" y no "corrió el cron".
- **Los handoffs se miden dos veces**: `recomendacion` (el asistente mostró) y
  `clic` (el usuario abrió, vía `/ir?h=`). La diferencia entre ambos números es
  lo que sostiene la conversación de precio al terminar el piloto.
- **El parseo de precios trata un separador seguido de 3 dígitos como separador
  de miles** (`$19.990` = 19990, no 19.99). Hay un test que lo cubre.

## Pendientes

- **`/terminos` es BORRADOR** y lo dice en pantalla. Necesita abogado **antes
  del 1 de diciembre** por la Ley 21.719.
- **No hay envío de correos.** La landing promete "te escribimos cuando esté
  indexada" y hoy no escribe nadie. Es la brecha más grande entre lo que la
  página dice y lo que el sistema hace.
- `DOLFS_BOT_USER_AGENT` trae `dolfs.cl/bot` y `contacto@dolfs.cl`, que son
  supuestos. Cámbialos antes de producción: es la dirección a la que va a
  escribir un comercio que quiere saber quién le lee el sitio.
- **La baja de comercios se hace por SQL.** El estado `baja` existe y el
  pipeline lo respeta, pero no hay botón en el panel. Los términos prometen 72 h.
- El worker cada 10 min y `maxDuration = 300` requieren plan Pro de Vercel.
- **Guard anti-SSRF**: queda una ventana de DNS rebinding entre la resolución y
  la conexión. Anotado en `lib/ingesta/http.ts`.
- **Nada está desplegado todavía.** Sin deploy no hay inscripciones, y sin
  inscripciones el panel no muestra nada.

## Antes de dar algo por terminado

```bash
npm run typecheck && npm test && npm run build
```

Las tres tienen que pasar. Si tocas ingesta, agrega el test primero: los bugs de
este pipeline aparecen con datos raros de tiendas reales, no con el camino feliz.
