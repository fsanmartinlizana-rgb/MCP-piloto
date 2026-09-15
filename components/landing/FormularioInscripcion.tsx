"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { CATEGORIAS_PRODUCTOS, ETIQUETAS_PLATAFORMA, PLATAFORMAS } from "@/lib/plataformas";

type Estado = "editando" | "enviando" | "listo";

interface Respuesta {
  ok: boolean;
  estado?: string;
  es_fundador?: boolean;
  error?: string;
  campos?: Record<string, string[]>;
  permitir_reintento?: boolean;
}

export function FormularioInscripcion() {
  const idFormulario = useId();
  const [estado, setEstado] = useState<Estado>("editando");
  const [resultado, setResultado] = useState<Respuesta | null>(null);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [permitirReintento, setPermitirReintento] = useState(false);
  const [referido, setReferido] = useState("");

  // El ?ref= se lee del browser para atribuir partners y canales. Se toma en
  // un efecto y no con useSearchParams para no obligar a toda la landing a
  // renderizarse de forma dinamica por un parametro opcional.
  useEffect(() => {
    const parametro = new URLSearchParams(window.location.search).get("ref");
    if (parametro) setReferido(parametro.slice(0, 120));
  }, []);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (estado === "enviando") return;

    const formulario = new FormData(evento.currentTarget);
    setEstado("enviando");
    setErrores({});
    setErrorGeneral(null);

    const cuerpo = {
      nombre_comercio: String(formulario.get("nombre_comercio") ?? ""),
      url_tienda: String(formulario.get("url_tienda") ?? ""),
      plataforma: String(formulario.get("plataforma") ?? ""),
      contacto_nombre: String(formulario.get("contacto_nombre") ?? ""),
      contacto_cargo: String(formulario.get("contacto_cargo") ?? ""),
      contacto_email: String(formulario.get("contacto_email") ?? ""),
      contacto_telefono: String(formulario.get("contacto_telefono") ?? ""),
      categoria_productos: String(formulario.get("categoria_productos") ?? ""),
      acepta_terminos: formulario.get("acepta_terminos") === "on",
      quiere_reunion: formulario.get("quiere_reunion") === "on",
      referido_por: referido || null,
      sitio_web: String(formulario.get("sitio_web") ?? ""),
      forzar_url: permitirReintento,
    };

    try {
      const respuesta = await fetch("/api/inscripcion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos: Respuesta = await respuesta.json();

      if (datos.ok) {
        setResultado(datos);
        setEstado("listo");
        return;
      }

      setErrores(datos.campos ?? {});
      setErrorGeneral(datos.error ?? "No pudimos enviar tu inscripcion.");
      setPermitirReintento(Boolean(datos.permitir_reintento));
      setEstado("editando");
    } catch {
      setErrorGeneral("Hubo un problema de conexion. Intenta de nuevo.");
      setEstado("editando");
    }
  }

  if (estado === "listo" && resultado) {
    return <Confirmacion resultado={resultado} />;
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-10 space-y-6">
      {errorGeneral && (
        <p
          role="alert"
          className="rounded-lg border border-ambar bg-ambar-claro px-4 py-3 text-sm text-ambar"
        >
          {errorGeneral}
          {permitirReintento && (
            <span className="mt-1 block font-medium">
              Si la direccion esta correcta, presiona enviar otra vez y seguimos igual.
            </span>
          )}
        </p>
      )}

      <Campo
        id={`${idFormulario}-nombre`}
        name="nombre_comercio"
        etiqueta="Nombre del comercio"
        autoComplete="organization"
        errores={errores.nombre_comercio}
        required
      />

      <Campo
        id={`${idFormulario}-url`}
        name="url_tienda"
        etiqueta="Direccion de tu tienda"
        ayuda="Por ejemplo: mitienda.cl"
        inputMode="url"
        autoComplete="url"
        placeholder="mitienda.cl"
        errores={errores.url_tienda}
        required
      />

      <Seleccion
        id={`${idFormulario}-plataforma`}
        name="plataforma"
        etiqueta="¿En que plataforma esta tu tienda?"
        ayuda="Si no estas seguro, elige la que mas se parezca: lo verificamos nosotros."
        errores={errores.plataforma}
        opciones={PLATAFORMAS.map((valor) => ({
          valor,
          etiqueta: ETIQUETAS_PLATAFORMA[valor],
        }))}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          id={`${idFormulario}-contacto`}
          name="contacto_nombre"
          etiqueta="Tu nombre"
          autoComplete="name"
          errores={errores.contacto_nombre}
          required
        />
        <Campo
          id={`${idFormulario}-cargo`}
          name="contacto_cargo"
          etiqueta="Tu cargo"
          placeholder="Duena, encargado de ecommerce..."
          autoComplete="organization-title"
          errores={errores.contacto_cargo}
          required
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo
          id={`${idFormulario}-email`}
          name="contacto_email"
          etiqueta="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          errores={errores.contacto_email}
          required
        />
        <Campo
          id={`${idFormulario}-telefono`}
          name="contacto_telefono"
          etiqueta="Telefono"
          type="tel"
          inputMode="tel"
          placeholder="+56 9 1234 5678"
          autoComplete="tel"
          errores={errores.contacto_telefono}
          required
        />
      </div>

      <Seleccion
        id={`${idFormulario}-categoria`}
        name="categoria_productos"
        etiqueta="¿Que vendes?"
        errores={errores.categoria_productos}
        opciones={CATEGORIAS_PRODUCTOS.map((valor) => ({ valor, etiqueta: valor }))}
      />

      {/* Honeypot: fuera de la vista y del foco, pero no con display:none, que
          algunos bots ya detectan. Un humano no lo llena nunca. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${idFormulario}-sitio`}>No llenar este campo</label>
        <input id={`${idFormulario}-sitio`} name="sitio_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-4 rounded-xl border border-borde bg-crema p-5">
        <Casilla
          id={`${idFormulario}-terminos`}
          name="acepta_terminos"
          errores={errores.acepta_terminos}
          required
        >
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className="font-medium underline underline-offset-2">
            terminos del piloto
          </Link>{" "}
          y autorizo a Dolfs a leer el catalogo publico de mi tienda.
        </Casilla>

        <Casilla id={`${idFormulario}-reunion`} name="quiere_reunion">
          Quiero una reunion de 15 minutos para que me lo expliquen.{" "}
          <span className="text-grafito">(opcional)</span>
        </Casilla>
      </div>

      <button
        type="submit"
        disabled={estado === "enviando"}
        className="w-full rounded-lg bg-verde px-6 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {estado === "enviando" ? "Enviando..." : "Inscribir mi tienda"}
      </button>
    </form>
  );
}

function Confirmacion({ resultado }: { resultado: Respuesta }) {
  const enListaEspera = resultado.estado === "lista_espera";

  return (
    <div
      role="status"
      className="mt-10 rounded-xl border border-borde bg-papel p-7 sm:p-9"
    >
      {enListaEspera ? (
        <>
          <h3 className="text-xl font-semibold tracking-tight">
            Quedaste en la lista de espera
          </h3>
          <p className="mt-3 leading-relaxed text-grafito">
            Por ahora el piloto funciona con tiendas en Shopify, WooCommerce y
            WordPress con tienda. Guardamos tus datos y te escribimos apenas
            abramos tu plataforma.
          </p>
          <p className="mt-3 leading-relaxed text-grafito">
            Una cosa mas: vamos a revisar tu sitio igual. Si resulta que tu
            tienda si corre en una de las tres que soportamos, te inscribimos sin
            que tengas que hacer nada.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-xl font-semibold tracking-tight">Listo, quedaste inscrito</h3>
          <p className="mt-3 leading-relaxed text-grafito">
            Ya estamos leyendo el catalogo de tu tienda. Te escribimos al correo
            que nos dejaste cuando este disponible dentro de los asistentes, o si
            nos topamos con algo que necesite tu ayuda.
          </p>
          {resultado.es_fundador && (
            <p className="mt-4 rounded-lg bg-verde-claro px-4 py-3 text-sm text-verde">
              Entraste en la cohorte fundadora del piloto. Eso te deja condiciones
              preferentes sobre el servicio base cuando el piloto termine.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// --- Controles ---------------------------------------------------------------

interface CampoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  etiqueta: string;
  ayuda?: string;
  errores?: string[];
}

function Campo({ id, etiqueta, ayuda, errores, ...resto }: CampoProps) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = errores?.length ? `${id}-error` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {etiqueta}
      </label>
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-sm text-grafito">
          {ayuda}
        </p>
      )}
      <input
        id={id}
        aria-describedby={[idAyuda, idError].filter(Boolean).join(" ") || undefined}
        aria-invalid={errores?.length ? true : undefined}
        className="mt-2 w-full rounded-lg border border-borde bg-papel px-3.5 py-2.5 text-base transition-colors placeholder:text-grafito/60 focus:border-verde"
        {...resto}
      />
      {idError && (
        <p id={idError} className="mt-1.5 text-sm text-ambar">
          {errores![0]}
        </p>
      )}
    </div>
  );
}

function Seleccion({
  id,
  name,
  etiqueta,
  ayuda,
  errores,
  opciones,
}: {
  id: string;
  name: string;
  etiqueta: string;
  ayuda?: string;
  errores?: string[];
  opciones: Array<{ valor: string; etiqueta: string }>;
}) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = errores?.length ? `${id}-error` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {etiqueta}
      </label>
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-sm text-grafito">
          {ayuda}
        </p>
      )}
      <select
        id={id}
        name={name}
        defaultValue=""
        required
        aria-describedby={[idAyuda, idError].filter(Boolean).join(" ") || undefined}
        aria-invalid={errores?.length ? true : undefined}
        className="mt-2 w-full rounded-lg border border-borde bg-papel px-3.5 py-2.5 text-base transition-colors focus:border-verde"
      >
        <option value="" disabled>
          Elige una opcion
        </option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      {idError && (
        <p id={idError} className="mt-1.5 text-sm text-ambar">
          {errores![0]}
        </p>
      )}
    </div>
  );
}

function Casilla({
  id,
  name,
  required,
  errores,
  children,
}: {
  id: string;
  name: string;
  required?: boolean;
  errores?: string[];
  children: React.ReactNode;
}) {
  const idError = errores?.length ? `${id}-error` : undefined;

  return (
    <div>
      <div className="flex gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          required={required}
          aria-describedby={idError}
          className="mt-0.5 h-4 w-4 shrink-0 accent-verde"
        />
        <label htmlFor={id} className="text-sm leading-relaxed">
          {children}
        </label>
      </div>
      {idError && (
        <p id={idError} className="mt-1.5 text-sm text-ambar">
          {errores![0]}
        </p>
      )}
    </div>
  );
}
