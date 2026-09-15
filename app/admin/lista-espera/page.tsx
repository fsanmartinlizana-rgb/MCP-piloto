import { supabaseAdmin } from "@/lib/supabase/admin";
import { ETIQUETAS_PLATAFORMA, type Plataforma } from "@/lib/plataformas";
import { Vacio, fecha } from "../componentes";

export const dynamic = "force-dynamic";

/**
 * Cola de lista de espera: comercios fuera del alcance del piloto.
 *
 * Dos casos distintos y conviene poder distinguirlos: los que declararon otra
 * plataforma, y los que declararon una soportada pero el pipeline descubrio
 * que corren otra cosa. El segundo grupo es el que hay que mirar con ojo,
 * porque son los que creian estar dentro.
 */
export default async function ListaEspera() {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("comercios")
    .select(
      "id, nombre_comercio, url_tienda, contacto_nombre, contacto_email, contacto_telefono, plataforma_declarada, plataforma_detectada, motivo_estado, quiere_reunion, referido_por, creado_en",
    )
    .eq("estado", "lista_espera")
    .order("creado_en", { ascending: true })
    .limit(500);

  if (error) return <Vacio>No se pudo leer la base: {error.message}</Vacio>;

  const comercios = data ?? [];

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Lista de espera</h1>
      <p className="mt-2 max-w-2xl text-sm text-grafito">
        Comercios cuya plataforma queda fuera del alcance del piloto. No
        consumen cupo de la cohorte fundadora: el numero de inscripcion se les
        asigna recien cuando entran. El resync diario los vuelve a revisar, asi
        que si migran a una plataforma soportada entran solos.
      </p>

      {comercios.length === 0 ? (
        <div className="mt-6">
          <Vacio>No hay comercios en lista de espera.</Vacio>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-borde bg-papel">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-borde text-left text-xs tracking-wide text-grafito uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Comercio</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Declarada / detectada</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Inscrito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {comercios.map((comercio) => {
                const creiaEstarDentro =
                  comercio.plataforma_declarada !== "otra" &&
                  comercio.plataforma_detectada !== null &&
                  comercio.plataforma_detectada !== comercio.plataforma_declarada;

                return (
                  <tr key={comercio.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{comercio.nombre_comercio}</div>
                      <a
                        href={comercio.url_tienda}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-0.5 block text-xs text-grafito underline-offset-2 hover:underline"
                      >
                        {comercio.url_tienda}
                      </a>
                      {comercio.referido_por && (
                        <div className="mt-0.5 text-xs text-grafito">ref: {comercio.referido_por}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{comercio.contacto_nombre}</div>
                      <a
                        href={`mailto:${comercio.contacto_email}`}
                        className="text-xs text-grafito underline-offset-2 hover:underline"
                      >
                        {comercio.contacto_email}
                      </a>
                      <div className="text-xs text-grafito">{comercio.contacto_telefono}</div>
                      {comercio.quiere_reunion && (
                        <div className="mt-1 text-xs font-medium text-verde">Pidio reunion</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-grafito">
                      {ETIQUETAS_PLATAFORMA[comercio.plataforma_declarada as Plataforma]}
                      <div className="text-xs">
                        →{" "}
                        {comercio.plataforma_detectada
                          ? ETIQUETAS_PLATAFORMA[comercio.plataforma_detectada as Plataforma]
                          : "sin detectar aun"}
                      </div>
                      {creiaEstarDentro && (
                        <div className="mt-1 text-xs text-ambar">
                          Creia estar dentro del alcance
                        </div>
                      )}
                    </td>
                    <td className="max-w-72 px-4 py-3 text-xs text-grafito">
                      {comercio.motivo_estado ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-grafito">
                      {fecha(comercio.creado_en)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
