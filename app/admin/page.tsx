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

export default async function PanelComercios() {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("vista_admin_comercios")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(500);

  if (error) {
    return <Vacio>No se pudo leer la base: {error.message}</Vacio>;
  }

  const comercios = (data ?? []) as FilaComercio[];
  const indexados = comercios.filter((c) => c.estado === "indexado");
  const fundadores = comercios.filter((c) => c.es_fundador);

  const totales = {
    comercios: comercios.length,
    indexados: indexados.length,
    fundadores: fundadores.length,
    productos: comercios.reduce((suma, c) => suma + Number(c.productos_activos ?? 0), 0),
    handoffs: comercios.reduce((suma, c) => suma + Number(c.handoffs_totales ?? 0), 0),
    clics: comercios.reduce((suma, c) => suma + Number(c.handoffs_clics ?? 0), 0),
    reuniones: comercios.filter((c) => c.quiere_reunion).length,
  };

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Comercios inscritos</h1>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-borde bg-borde sm:grid-cols-4 lg:grid-cols-7">
        <Metrica etiqueta="Inscritos" valor={totales.comercios} />
        <Metrica etiqueta="Indexados" valor={totales.indexados} />
        <Metrica etiqueta="Fundadores" valor={`${totales.fundadores}/100`} />
        <Metrica etiqueta="Productos" valor={totales.productos.toLocaleString("es-CL")} />
        <Metrica etiqueta="Handoffs" valor={totales.handoffs.toLocaleString("es-CL")} />
        <Metrica etiqueta="Clics" valor={totales.clics.toLocaleString("es-CL")} />
        <Metrica etiqueta="Piden reunión" valor={totales.reuniones} />
      </dl>

      {comercios.length === 0 ? (
        <div className="mt-6">
          <Vacio>Todavía no hay comercios inscritos.</Vacio>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-borde bg-papel">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-borde text-left text-xs tracking-wide text-grafito uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Comercio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Plataforma</th>
                <th className="px-4 py-3 text-right font-medium">Productos</th>
                <th className="px-4 py-3 text-right font-medium">Handoffs</th>
                <th className="px-4 py-3 font-medium">Última sync</th>
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
                    <div className="mt-0.5 text-xs text-grafito">{comercio.url_tienda}</div>
                    {comercio.referido_por && (
                      <div className="mt-0.5 text-xs text-grafito">ref: {comercio.referido_por}</div>
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
                    {fecha(comercio.ultima_sincronizacion_en)}
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

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="bg-papel px-4 py-3.5">
      <dt className="text-xs tracking-wide text-grafito uppercase">{etiqueta}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
