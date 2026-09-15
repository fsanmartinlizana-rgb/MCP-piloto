import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { log, type EtapaLog, type NivelLog } from "@/lib/logger";
import { userAgentBot } from "@/lib/env";
import { esSoportada, ETIQUETAS_PLATAFORMA, type Plataforma } from "@/lib/plataformas";
import { detectarPlataforma } from "@/lib/ingesta/detectar-plataforma";
import { cargarRobots, puedeAcceder } from "@/lib/ingesta/robots";
import { extraerShopify } from "@/lib/ingesta/conectores/shopify";
import { extraerWooCommerce } from "@/lib/ingesta/conectores/woocommerce";
import { extraerWordPress } from "@/lib/ingesta/conectores/wordpress";
import { persistirCatalogo } from "@/lib/ingesta/persistir";
import { ErrorIngesta } from "@/lib/ingesta/http";
import type { ContextoConector, ResultadoConector } from "@/lib/ingesta/tipos";

export type DesenlaceIngesta = "indexado" | "lista_espera" | "error" | "omitido";

export interface ResultadoIngesta {
  desenlace: DesenlaceIngesta;
  plataforma: Plataforma | null;
  productos: number;
  mensaje: string;
}

/**
 * Ingesta completa de un comercio.
 *
 * Aca se hace cumplir el alcance del piloto: la plataforma que vale es la que
 * detecta el pipeline, no la que el comercio marco en el formulario. Un
 * comercio que declaro Shopify pero corre otra cosa se va a lista de espera, y
 * uno que marco "Otra" sin saber que su tienda es WooCommerce entra al piloto.
 *
 * Fuera del alcance siempre es lista de espera, nunca rechazo: rechazar es una
 * decision nuestra sobre el comercio, no sobre su stack.
 */
export async function ingestarComercio(
  comercioId: string,
  trabajoId: string | null = null,
): Promise<ResultadoIngesta> {
  const db = supabaseAdmin();

  const registrar = (nivel: NivelLog, etapa: EtapaLog, mensaje: string, detalle?: unknown) =>
    log({ comercioId, trabajoId, nivel, etapa, mensaje, detalle });

  const { data: comercio, error } = await db
    .from("comercios")
    .select("id, nombre_comercio, url_tienda, plataforma_declarada, estado")
    .eq("id", comercioId)
    .single();

  if (error || !comercio) {
    throw new Error(`Comercio ${comercioId} no encontrado: ${error?.message ?? "sin datos"}`);
  }

  if (comercio.estado === "baja" || comercio.estado === "rechazado") {
    await registrar("info", "cola", `Ingesta omitida: el comercio esta en estado ${comercio.estado}`);
    return { desenlace: "omitido", plataforma: null, productos: 0, mensaje: "Comercio fuera del piloto" };
  }

  // Un comercio en lista de espera NO se promueve todavia. El trigger de la
  // base asigna numero_inscripcion en cuanto el estado deja de ser
  // 'lista_espera', asi que moverlo antes de confirmar que califica le
  // quemaria un cupo de la cohorte fundadora aunque despues resulte estar
  // fuera de alcance. Se promueve recien al indexar, mas abajo.
  const enListaEspera = comercio.estado === "lista_espera";
  if (!enListaEspera) {
    await db.from("comercios").update({ estado: "validando" }).eq("id", comercioId);
  }

  // --- Deteccion de plataforma ---------------------------------------------

  let deteccion;
  try {
    deteccion = await detectarPlataforma(comercio.url_tienda);
  } catch (e) {
    const mensaje = e instanceof ErrorIngesta ? e.message : `Error inesperado: ${String(e)}`;
    await registrar("error", "deteccion", `No se pudo abrir la tienda: ${mensaje}`);
    await marcarError(comercioId, mensaje);
    throw e;
  }

  const { plataforma, evidencia, urlFinal } = deteccion;

  await registrar(
    "info",
    "deteccion",
    `Plataforma detectada: ${ETIQUETAS_PLATAFORMA[plataforma]} (${evidencia})`,
    { declarada: comercio.plataforma_declarada, detectada: plataforma, urlFinal },
  );

  if (plataforma !== comercio.plataforma_declarada) {
    await registrar(
      "warn",
      "deteccion",
      `El comercio declaro ${ETIQUETAS_PLATAFORMA[comercio.plataforma_declarada as Plataforma]} pero la tienda corre ${ETIQUETAS_PLATAFORMA[plataforma]}. Manda lo detectado.`,
    );
  }

  await db.from("comercios").update({ plataforma_detectada: plataforma }).eq("id", comercioId);

  if (!esSoportada(plataforma)) {
    const motivo = `Plataforma fuera del alcance del piloto (${evidencia}). Solo indexamos Shopify, WooCommerce y WordPress con tienda.`;
    await registrar("warn", "alcance", motivo);
    await enviarAListaEspera(comercioId, motivo);
    return { desenlace: "lista_espera", plataforma, productos: 0, mensaje: motivo };
  }

  // --- robots.txt ------------------------------------------------------------

  const robots = await cargarRobots(urlFinal);
  const bot = userAgentBot();
  const permitido = (url: string) => puedeAcceder(robots, url, bot);

  if (!permitido(urlFinal)) {
    const motivo = "El robots.txt de la tienda bloquea nuestro acceso a la raiz del sitio";
    await registrar("warn", "robots", motivo);
    await marcarError(comercioId, motivo);
    return { desenlace: "error", plataforma, productos: 0, mensaje: motivo };
  }

  const ctx: ContextoConector = { origen: urlFinal, robots, permitido, registrar };

  // --- Extraccion ------------------------------------------------------------

  let resultado: ResultadoConector;
  try {
    resultado = await ejecutarConector(plataforma, ctx);
  } catch (e) {
    const mensaje = e instanceof ErrorIngesta ? e.message : `Error inesperado: ${String(e)}`;
    await registrar("error", "fetch", `Fallo la extraccion del catalogo: ${mensaje}`);
    await marcarError(comercioId, mensaje);
    throw e;
  }

  if (resultado.bloqueadoPorRobots) {
    const motivo = resultado.motivo ?? "robots.txt bloquea el catalogo";
    await registrar("warn", "robots", motivo);
    await marcarError(comercioId, motivo);
    return { desenlace: "error", plataforma, productos: 0, mensaje: motivo };
  }

  // Un WordPress del que no sale ni un producto es un WordPress *sin* tienda:
  // es exactamente el caso que el alcance del piloto deja fuera.
  if (resultado.productos.length === 0 && plataforma === "wordpress") {
    const motivo =
      "El sitio es WordPress pero no publica un catalogo de productos. El piloto cubre WordPress con tienda.";
    await registrar("warn", "alcance", motivo);
    await enviarAListaEspera(comercioId, motivo);
    return { desenlace: "lista_espera", plataforma, productos: 0, mensaje: motivo };
  }

  if (resultado.productos.length === 0) {
    const motivo = resultado.motivo ?? "No se encontraron productos en el catalogo";
    await registrar("error", "parseo", motivo);
    await marcarError(comercioId, motivo);
    return { desenlace: "error", plataforma, productos: 0, mensaje: motivo };
  }

  // --- Persistencia ----------------------------------------------------------

  const persistencia = await persistirCatalogo(comercioId, resultado.productos);

  await registrar(
    "info",
    "guardado",
    `Catalogo guardado: ${persistencia.guardados} productos activos, ${persistencia.desactivados} retirados`,
    persistencia,
  );

  if (persistencia.truncado) {
    await registrar("warn", "guardado", "El catalogo supera el tope por tienda y quedo truncado");
  }
  if (persistencia.descartados > 0) {
    await registrar(
      "warn",
      "parseo",
      `${persistencia.descartados} productos descartados por venir sin nombre o sin URL`,
    );
  }

  // Aca recien se promueve. Para un comercio que venia de lista de espera,
  // este update es el que dispara la asignacion de numero_inscripcion: entra a
  // la cohorte fundadora con catalogo ya leido, no con una promesa.
  await db
    .from("comercios")
    .update({
      estado: "indexado",
      ultima_sincronizacion_en: new Date().toISOString(),
      ultimo_error_ingesta: null,
      motivo_estado: null,
    })
    .eq("id", comercioId);

  if (enListaEspera) {
    await registrar(
      "info",
      "alcance",
      `Promovido desde lista de espera: la tienda corre ${ETIQUETAS_PLATAFORMA[plataforma]}, que si esta en el alcance del piloto.`,
    );
  }

  return {
    desenlace: "indexado",
    plataforma,
    productos: persistencia.guardados,
    mensaje: `${persistencia.guardados} productos indexados`,
  };
}

function ejecutarConector(plataforma: Plataforma, ctx: ContextoConector): Promise<ResultadoConector> {
  switch (plataforma) {
    case "shopify":
      return extraerShopify(ctx);
    case "woocommerce":
      return extraerWooCommerce(ctx);
    case "wordpress":
      return extraerWordPress(ctx);
    default:
      throw new Error(`Sin conector para la plataforma ${plataforma}`);
  }
}

async function enviarAListaEspera(comercioId: string, motivo: string): Promise<void> {
  await supabaseAdmin()
    .from("comercios")
    .update({
      estado: "lista_espera",
      motivo_estado: motivo,
      ultimo_error_ingesta: null,
      ultima_sincronizacion_en: new Date().toISOString(),
    })
    .eq("id", comercioId);
}

async function marcarError(comercioId: string, mensaje: string): Promise<void> {
  await supabaseAdmin()
    .from("comercios")
    .update({ ultimo_error_ingesta: mensaje.slice(0, 500) })
    .eq("id", comercioId);
}
