import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const LIMITE_POR_IP = 5;
export const VENTANA_SEGUNDOS = 3600;

/**
 * Rate limit por IP en Postgres: el incremento y la lectura ocurren en la
 * misma sentencia, asi que dos envios simultaneos no pueden colarse por la
 * ventana. Sin Redis y sin captcha, como pide el piloto.
 *
 * Si la base falla, dejamos pasar: perder una inscripcion legitima cuesta mas
 * que recibir un formulario basura de mas.
 */
export async function permitirInscripcion(ip: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc("registrar_intento_inscripcion", {
      p_ip: ip,
      p_limite: LIMITE_POR_IP,
      p_ventana_segundos: VENTANA_SEGUNDOS,
    });
    if (error) {
      console.error("[rate-limit] fallo el registro de intento", error);
      return true;
    }
    return data !== false;
  } catch (error) {
    console.error("[rate-limit] excepcion", error);
    return true;
  }
}
