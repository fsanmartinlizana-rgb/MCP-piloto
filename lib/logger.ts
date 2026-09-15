import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type NivelLog = "info" | "warn" | "error";
export type EtapaLog =
  | "cola"
  | "deteccion"
  | "robots"
  | "fetch"
  | "parseo"
  | "guardado"
  | "alcance";

/**
 * Log por comercio. Es lo que permite responder "por que la tienda X no
 * indexo" sin entrar a la base a adivinar.
 */
export async function log(entrada: {
  comercioId: string;
  trabajoId?: string | null;
  nivel?: NivelLog;
  etapa: EtapaLog;
  mensaje: string;
  detalle?: unknown;
}): Promise<void> {
  const { comercioId, trabajoId, nivel = "info", etapa, mensaje, detalle } = entrada;

  try {
    await supabaseAdmin().from("logs_ingesta").insert({
      comercio_id: comercioId,
      trabajo_id: trabajoId ?? null,
      nivel,
      etapa,
      mensaje,
      detalle: detalle === undefined ? null : JSON.parse(JSON.stringify(detalle)),
    });
  } catch (error) {
    // Un log que falla nunca debe tumbar la ingesta.
    console.error("[logs_ingesta] no se pudo escribir", { comercioId, etapa, mensaje, error });
  }
}
