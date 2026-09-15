import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { ingestarComercio, type DesenlaceIngesta } from "@/lib/ingesta/ejecutar";

/**
 * Cola de ingesta sobre Postgres. No hay broker ni worker aparte: los trabajos
 * se toman con FOR UPDATE SKIP LOCKED desde un route handler que dispara el
 * cron de Vercel o la propia inscripcion.
 */

const MAXIMO_INTENTOS = 5;
/** Espera antes de reintentar, por numero de intento ya consumido. */
const BACKOFF_MINUTOS = [5, 30, 120, 480];

export interface TrabajoIngesta {
  id: string;
  comercio_id: string;
  tipo: string;
  intentos: number;
}

/**
 * Encola una ingesta. El indice unico parcial de la tabla garantiza un solo
 * trabajo activo por comercio, asi que el cron diario no puede apilarse encima
 * de una ingesta que todavia corre.
 */
export async function encolarIngesta(
  comercioId: string,
  tipo: "inicial" | "resync" = "inicial",
): Promise<boolean> {
  const { error } = await supabaseAdmin()
    .from("trabajos_ingesta")
    .insert({ comercio_id: comercioId, tipo });

  if (!error) return true;

  // 23505 = unique_violation: ya hay un trabajo activo para este comercio.
  if (error.code === "23505") return false;

  throw new Error(`No se pudo encolar la ingesta: ${error.message}`);
}

export interface ResumenCola {
  tomados: number;
  resultados: Array<{ comercioId: string; desenlace: DesenlaceIngesta | "fallido"; mensaje: string }>;
}

export async function procesarCola(limite = 3): Promise<ResumenCola> {
  const db = supabaseAdmin();

  const { data: trabajos, error } = await db.rpc("tomar_trabajos_ingesta", {
    p_limite: limite,
    p_bloqueo_segundos: 600,
  });

  if (error) throw new Error(`No se pudieron tomar trabajos: ${error.message}`);

  const lote = (trabajos ?? []) as TrabajoIngesta[];
  const resultados: ResumenCola["resultados"] = [];

  // En serie a proposito: cada ingesta golpea el sitio de un comercio y el
  // paralelismo aca se traduce en carga para ellos, no para nosotros.
  for (const trabajo of lote) {
    try {
      const resultado = await ingestarComercio(trabajo.comercio_id, trabajo.id);

      await db
        .from("trabajos_ingesta")
        .update({ estado: "ok", finalizado_en: new Date().toISOString(), ultimo_error: null })
        .eq("id", trabajo.id);

      resultados.push({
        comercioId: trabajo.comercio_id,
        desenlace: resultado.desenlace,
        mensaje: resultado.mensaje,
      });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      await reprogramar(trabajo, mensaje);
      resultados.push({ comercioId: trabajo.comercio_id, desenlace: "fallido", mensaje });
    }
  }

  return { tomados: lote.length, resultados };
}

async function reprogramar(trabajo: TrabajoIngesta, mensaje: string): Promise<void> {
  const db = supabaseAdmin();
  const agotado = trabajo.intentos >= MAXIMO_INTENTOS;

  if (agotado) {
    await db
      .from("trabajos_ingesta")
      .update({
        estado: "error",
        finalizado_en: new Date().toISOString(),
        ultimo_error: mensaje.slice(0, 1000),
      })
      .eq("id", trabajo.id);

    await log({
      comercioId: trabajo.comercio_id,
      trabajoId: trabajo.id,
      nivel: "error",
      etapa: "cola",
      mensaje: `Ingesta abandonada tras ${trabajo.intentos} intentos: ${mensaje}`,
    });
    return;
  }

  const minutos = BACKOFF_MINUTOS[Math.min(trabajo.intentos - 1, BACKOFF_MINUTOS.length - 1)];
  const proximo = new Date(Date.now() + minutos * 60_000).toISOString();

  await db
    .from("trabajos_ingesta")
    .update({
      estado: "pendiente",
      disponible_en: proximo,
      bloqueado_hasta: null,
      ultimo_error: mensaje.slice(0, 1000),
    })
    .eq("id", trabajo.id);

  await log({
    comercioId: trabajo.comercio_id,
    trabajoId: trabajo.id,
    nivel: "warn",
    etapa: "cola",
    mensaje: `Intento ${trabajo.intentos} fallido, reintento en ${minutos} min: ${mensaje}`,
  });
}
