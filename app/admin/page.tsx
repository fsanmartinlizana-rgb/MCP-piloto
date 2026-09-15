import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ETIQUETAS_PLATAFORMA, type Plataforma } from "@/lib/plataformas";
import { Estado, Vacio, fecha } from "./componentes";

export const dynamic = "force-dynamic";

interface FilaComercio {
  id: string;
  nombre_comercio: string;
  url_tienda: string;
  estado: string;
  plataforma_declarada: string;
  plataforma_detectada: string | null;
  contacto_nombre: string;
  contacto_cargo: string;
  contacto_email: string;
  contacto_telefono: string;
  categoria_productos: string;
  numero_inscripcion: number | null;
  es_fundador: boolean;
  quiere_reunion: boolean;
  referido_por: string | null;
  creado_en: string;
  ultima_sincronizacion_en: string | null;
  ultimo_error_ingesta: string | null;
  productos_activos: number;
  handoffs_totales: number;
  handoffs_clics: number;
}

const FILTROS = [
  { clave: "", etiqueta: "Todas" },
  { clave: "indexado", etiqueta: "Indexadas" },
  { clave: "pendiente", etiqueta: "Pendientes" },
  { clave: "validando", etiqueta: "Validando" },
  { clave: "lista_espera", etiqueta: "Lista de espera" },
  { clave: "reunion", etiqueta: "Piden reunión" },
  { clave: "fundador", etiqueta: "Fundadoras" },
] as const;

export default async function Inscripciones({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const { estado: filtro = "", q = "" } = await searchParams;
  const db = supabaseAdmin();

  // Los totales se calculan sobre TODO, no sobre lo filtrado: si no, cambiar
  // de pestaña movería los números del piloto y se leerían mal.
  const [todasRes, filtradasRes] = await Promise.all([
    db.from("vista_admin_comercios").select("*").order("creado_en", { ascending: false }),
    consultaFiltrada(filtro, q),
  ]);

  if (todasRes.error) return <Vacio>No se pudo leer la base: {todasRes.error.message}</Vacio>;

  const todas = (todasRes.data ?? []) as FilaComercio[];
  const comercios = ((filtradasRes.data ?? []) as FilaComercio[]).filter((c) =>
    filtro === "reunion" ? c.quiere_reunion : filtro === "fundador" ? c.es_fundador : true,
  );

  const totales = {
    comercios: todas.length,
    indexados: todas.filter((c) => c.estado === "indexado").length,
    fundadores: todas.filter((c) => c.es_fundador).length,
    espera: todas.filter((c) => c.estado === "lista_espera").length,
    productos: todas.reduce((s, c) => s + Number(c.productos_activos ?? 0), 0),
    handoffs: todas.reduce((s, c) => s + Number(c.handoffs_totales ?? 0), 0),
    clics: todas.reduce((s, c) => s + Number(c.handoffs_clics ?? 0), 0),
    reuniones: todas.filter((c) => c.quiere_reunion).length,
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Inscripciones</h1>
        <a
          href="/admin/exportar"
          className="rounded-lg border border-borde bg-papel px-3.5 py-2 text-sm font-medium transition-colors hover:bg-crema"
        >
          Descargar CSV
        </a>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-borde bg-borde sm:grid-cols-4 lg:grid-cols-8">
        <Metrica etiqueta="Inscritas" valor={totales.comercios} />
        <Metrica etiqueta="Indexadas" valor={totales.indexados} />
        <Metrica etiqueta="Fundadoras" valor={`${totales.fundadores}/100`} />
        <Metrica etiqueta="En espera" valor={totales.espera} />
        <Metrica etiqueta="Productos" valor={totales.productos.toLocaleString("es-CL")} />
        <Metrica etiqueta="Handoffs" valor={totales.handoffs.toLocaleString("es-CL")} />
        <Metrica etiqueta="Clics" valor={totales.clics.toLocaleString("es-CL")} />
        <Metrica etiqueta="Piden reunión" valor={totales.reuniones} />
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3">
        <nav className="flex flex-wrap gap-1.5">
          {FILTROS.map((opcion) => {
            const activo = filtro === opcion.clave;
            const destino = new URLSearchParams();
            if (opcion.clave) destino.set("estado", opcion.clave);
            if (q) destino.set("q", q);
            return (
              <Link
                key={opcion.clave || "todas"}
                href={`/admin${destino.toString() ? `?${destino}` : ""}`}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  activo
                    ? "border-verde bg-verde-claro font-medium text-verde"
                    : "border-borde bg-papel text-grafito hover:text-tinta"
                }`}
              >
                {opcion.etiqueta}
              </Link>
            );
          })}
        </nav>

        <form action="/admin" className="ml-auto flex gap-2">
          {filtro && <input type="hidden" name="estado" value={filtro} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar comercio, sitio o contacto"
            aria-label="Buscar inscripciones"
            className="w-56 rounded-lg border border-borde bg-papel px-3 py-1.5 text-sm focus:border-verde"
          />
          <button
            type="submit"
            className="rounded-lg border border-borde bg-papel px-3 py-1.5 text-sm font-medium transition-colors hover:bg-crema"
          >
            Buscar
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-grafito">
        {comercios.length === todas.length
          ? `${comercios.length} inscripciones`
          : `${comercios.length} de ${todas.length} inscripciones`}
      </p>

      {comercios.length === 0 ? (
        <div className="mt-3">
          <Vacio>
            {todas.length === 0
              ? "Todavía no hay comercios inscritos."
              : "Ninguna inscripción calza con este filtro."}
          </Vacio>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-borde bg-papel">
          <table className="w-full min-w-[68rem] text-sm">
            <thead className="border-b border-borde text-left text-xs tracking-wide text-grafito uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Comercio</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Plataforma</th>
                <th className="px-4 py-3 text-right font-medium">Productos</th>
                <th className="px-4 py-3 text-right font-medium">Handoffs</th>
                <th className="px-4 py-3 font-medium">Inscrita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {comercios.map((comercio) => (
                <tr key={comercio.id} className="align-top">
                  <td className="px-4 py-3 text-grafito tabular-nums">
                    {comercio.numero_inscripcion ?? "—"}
                    {comercio.es_fundador && (
                      <span className="ml-1 text-xs text-verde" title="Cohorte fundadora">
                        ★
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/comercios/${comercio.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {comercio.nombre_comercio}
                    </Link>
                    <a
                      href={comercio.url_tienda}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-0.5 block text-xs text-grafito underline-offset-2 hover:underline"
                    >
                      {comercio.url_tienda.replace(/^https?:\/\//, "")}
                    </a>
                    <div className="mt-0.5 text-xs text-grafito">
                      {comercio.categoria_productos}
                      {comercio.referido_por && ` · ref: ${comercio.referido_por}`}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div>{comercio.contacto_nombre}</div>
                    <div className="text-xs text-grafito">{comercio.contacto_cargo}</div>
                    <a
                      href={`mailto:${comercio.contacto_email}`}
                      className="mt-0.5 block text-xs text-grafito underline-offset-2 hover:underline"
                    >
                      {comercio.contacto_email}
                    </a>
                    <a
                      href={`tel:${comercio.contacto_telefono.replace(/\s/g, "")}`}
                      className="block text-xs text-grafito underline-offset-2 hover:underline"
                    >
                      {comercio.contacto_telefono}
                    </a>
                    {comercio.quiere_reunion && (
                      <div className="mt-1 text-xs font-medium text-verde">Pidió reunión</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Estado estado={comercio.estado} />
                    {comercio.ultimo_error_ingesta && (
                      <div className="mt-1 max-w-56 text-xs text-ambar">
                        {comercio.ultimo_error_ingesta}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-grafito">
                    {ETIQUETAS_PLATAFORMA[
                      (comercio.plataforma_detectada ?? comercio.plataforma_declarada) as Plataforma
                    ] ?? "—"}
                    {comercio.plataforma_detectada &&
                      comercio.plataforma_detectada !== comercio.plataforma_declarada && (
                        <div
                          className="mt-0.5 text-xs text-ambar"
                          title="El comercio declaró otra cosa; manda lo detectado"
                        >
                          declaró:{" "}
                          {ETIQUETAS_PLATAFORMA[comercio.plataforma_declarada as Plataforma]}
                        </div>
                      )}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(comercio.productos_activos ?? 0).toLocaleString("es-CL")}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(comercio.handoffs_totales ?? 0).toLocaleString("es-CL")}
                    <div className="text-xs text-grafito">
                      {Number(comercio.handoffs_clics ?? 0).toLocaleString("es-CL")} clics
                    </div>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-grafito">
                    {fecha(comercio.creado_en)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function consultaFiltrada(filtro: string, q: string) {
  let consulta = supabaseAdmin()
    .from("vista_admin_comercios")
    .select("*")
    .order("creado_en", { ascending: false });

  // "reunion" y "fundador" no son estados: se filtran en memoria más abajo.
  if (filtro && filtro !== "reunion" && filtro !== "fundador") {
    consulta = consulta.eq("estado", filtro);
  }

  const termino = q.trim();
  if (termino) {
    // Los comodines de PostgREST se escapan para que una búsqueda con "%" no
    // termine devolviendo la tabla entera.
    const patron = `%${termino.replace(/[%_\\,()]/g, "")}%`;
    consulta = consulta.or(
      [
        `nombre_comercio.ilike.${patron}`,
        `url_tienda.ilike.${patron}`,
        `contacto_nombre.ilike.${patron}`,
        `contacto_email.ilike.${patron}`,
        `referido_por.ilike.${patron}`,
      ].join(","),
    );
  }

  return consulta;
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="bg-papel px-4 py-3.5">
      <dt className="text-xs tracking-wide text-grafito uppercase">{etiqueta}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
