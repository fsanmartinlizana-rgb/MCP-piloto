import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ETIQUETAS_PLATAFORMA, type Plataforma } from "@/lib/plataformas";
import { Estado, Vacio, fecha } from "../../componentes";

export const dynamic = "force-dynamic";

/**
 * Ficha de un comercio. El bloque de logs es el entregable real de esta
 * pagina: es donde se responde "por que la tienda X no indexo" sin abrir la
 * base ni leer codigo.
 */
export default async function FichaComercio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();

  const [comercioRes, logsRes, productosRes, handoffsRes, trabajosRes] = await Promise.all([
    db.from("vista_admin_comercios").select("*").eq("id", id).maybeSingle(),
    db
      .from("logs_ingesta")
      .select("id, nivel, etapa, mensaje, creado_en")
      .eq("comercio_id", id)
      .order("creado_en", { ascending: false })
      .limit(80),
    db
      .from("productos")
      .select("id, nombre, precio, moneda, stock_disponible, activo, url_producto")
      .eq("comercio_id", id)
      .order("activo", { ascending: false })
      .order("actualizado_en", { ascending: false })
      .limit(25),
    db
      .from("handoffs")
      .select("id, tipo, cliente_llm, consulta_origen, ocurrido_en")
      .eq("comercio_id", id)
      .order("ocurrido_en", { ascending: false })
      .limit(25),
    db
      .from("trabajos_ingesta")
      .select("id, tipo, estado, intentos, disponible_en, ultimo_error")
      .eq("comercio_id", id)
      .order("creado_en", { ascending: false })
      .limit(5),
  ]);

  const comercio = comercioRes.data;
  if (!comercio) notFound();

  return (
    <>
      <Link href="/admin" className="text-sm text-grafito underline underline-offset-4 hover:text-tinta">
        ← Comercios
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{comercio.nombre_comercio}</h1>
        <Estado estado={comercio.estado} />
        {comercio.es_fundador && (
          <span className="rounded-full bg-verde-claro px-2.5 py-0.5 text-xs font-medium text-verde">
            fundador #{comercio.numero_inscripcion}
          </span>
        )}
      </div>

      <a
        href={comercio.url_tienda}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-1 inline-block text-sm text-grafito underline underline-offset-4"
      >
        {comercio.url_tienda}
      </a>

      {comercio.ultimo_error_ingesta && (
        <p className="mt-4 rounded-lg border border-ambar bg-ambar-claro px-4 py-3 text-sm text-ambar">
          <strong className="font-semibold">Ultimo error de ingesta:</strong>{" "}
          {comercio.ultimo_error_ingesta}
        </p>
      )}
      {comercio.motivo_estado && (
        <p className="mt-3 rounded-lg border border-borde bg-papel px-4 py-3 text-sm text-grafito">
          <strong className="font-semibold text-tinta">Motivo del estado:</strong>{" "}
          {comercio.motivo_estado}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Tarjeta titulo="Ficha">
          <Dato etiqueta="Contacto">
            {comercio.contacto_nombre} · {comercio.contacto_cargo}
          </Dato>
          <Dato etiqueta="Email">
            <a href={`mailto:${comercio.contacto_email}`} className="underline underline-offset-2">
              {comercio.contacto_email}
            </a>
          </Dato>
          <Dato etiqueta="Telefono">{comercio.contacto_telefono}</Dato>
          <Dato etiqueta="Categoria">{comercio.categoria_productos}</Dato>
          <Dato etiqueta="Plataforma declarada">
            {ETIQUETAS_PLATAFORMA[comercio.plataforma_declarada as Plataforma]}
          </Dato>
          <Dato etiqueta="Plataforma detectada">
            {comercio.plataforma_detectada
              ? ETIQUETAS_PLATAFORMA[comercio.plataforma_detectada as Plataforma]
              : "sin detectar aun"}
          </Dato>
          <Dato etiqueta="Reunion de 15 min">{comercio.quiere_reunion ? "si" : "no"}</Dato>
          <Dato etiqueta="Referido por">{comercio.referido_por ?? "—"}</Dato>
        </Tarjeta>

        <Tarjeta titulo="Consentimiento">
          <Dato etiqueta="Aceptado el">{fecha(comercio.consentimiento_aceptado_en)}</Dato>
          <Dato etiqueta="Version de terminos">
            <code className="font-mono text-xs">{comercio.version_terminos}</code>
          </Dato>
          <Dato etiqueta="IP de origen">
            <code className="font-mono text-xs">{String(comercio.ip_consentimiento)}</code>
          </Dato>
          <Dato etiqueta="User agent">
            <span className="text-xs break-all">{comercio.user_agent_consentimiento ?? "—"}</span>
          </Dato>
        </Tarjeta>

        <Tarjeta titulo="Ingesta">
          <Dato etiqueta="Productos activos">{Number(comercio.productos_activos ?? 0)}</Dato>
          <Dato etiqueta="Productos historicos">{Number(comercio.productos_totales ?? 0)}</Dato>
          <Dato etiqueta="Handoffs">
            {Number(comercio.handoffs_totales ?? 0)} ({Number(comercio.handoffs_clics ?? 0)} clics)
          </Dato>
          <Dato etiqueta="Ultima sincronizacion">{fecha(comercio.ultima_sincronizacion_en)}</Dato>
          <Dato etiqueta="Inscrito el">{fecha(comercio.creado_en)}</Dato>

          {(trabajosRes.data ?? []).length > 0 && (
            <div className="mt-3 border-t border-borde pt-3">
              <p className="mb-1.5 text-xs tracking-wide text-grafito uppercase">Trabajos en cola</p>
              {(trabajosRes.data ?? []).map((trabajo) => (
                <div key={trabajo.id} className="text-xs text-grafito">
                  {trabajo.tipo} · {trabajo.estado} · {trabajo.intentos} intento(s)
                  {trabajo.ultimo_error && (
                    <span className="block text-ambar">{trabajo.ultimo_error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>

      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">Log de ingesta</h2>
        <p className="mt-1 text-sm text-grafito">
          Lo mas reciente primero. Aca esta la respuesta a por que esta tienda
          indexo o no.
        </p>

        {(logsRes.data ?? []).length === 0 ? (
          <div className="mt-4">
            <Vacio>Todavia no hay registros de ingesta para este comercio.</Vacio>
          </div>
        ) : (
          <ol className="mt-4 divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-papel">
            {(logsRes.data ?? []).map((registro) => (
              <li key={registro.id} className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 font-mono text-xs text-grafito">
                  {fecha(registro.creado_en)}
                </span>
                <span
                  className={`w-20 shrink-0 text-xs font-medium ${
                    registro.nivel === "error"
                      ? "text-ambar"
                      : registro.nivel === "warn"
                        ? "text-ambar"
                        : "text-grafito"
                  }`}
                >
                  {registro.etapa}
                </span>
                <span className="min-w-0 flex-1">{registro.mensaje}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold tracking-tight">Productos (muestra)</h2>
          {(productosRes.data ?? []).length === 0 ? (
            <div className="mt-4">
              <Vacio>Sin productos indexados.</Vacio>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-papel text-sm">
              {(productosRes.data ?? []).map((producto) => (
                <li key={producto.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <a
                      href={producto.url_producto}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={`underline-offset-2 hover:underline ${producto.activo ? "" : "text-grafito line-through"}`}
                    >
                      {producto.nombre}
                    </a>
                  </span>
                  <span className="shrink-0 tabular-nums text-grafito">
                    {producto.precio === null
                      ? "—"
                      : `${producto.moneda} ${Number(producto.precio).toLocaleString("es-CL")}`}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-grafito">
                    {producto.stock_disponible === null
                      ? "s/d"
                      : producto.stock_disponible
                        ? "en stock"
                        : "agotado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-base font-semibold tracking-tight">Handoffs recientes</h2>
          {(handoffsRes.data ?? []).length === 0 ? (
            <div className="mt-4">
              <Vacio>Sin handoffs registrados.</Vacio>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-papel text-sm">
              {(handoffsRes.data ?? []).map((handoff) => (
                <li key={handoff.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-grafito">
                    <span className="font-mono">{fecha(handoff.ocurrido_en)}</span>
                    <span>{handoff.cliente_llm}</span>
                    <span
                      className={
                        handoff.tipo === "clic" ? "font-medium text-verde" : "text-grafito"
                      }
                    >
                      {handoff.tipo}
                    </span>
                  </div>
                  {handoff.consulta_origen && (
                    <p className="mt-0.5 text-grafito">“{handoff.consulta_origen}”</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-borde bg-papel p-5">
      <h2 className="text-sm font-semibold tracking-wide text-grafito uppercase">{titulo}</h2>
      <dl className="mt-3 space-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-grafito">{etiqueta}:</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}
