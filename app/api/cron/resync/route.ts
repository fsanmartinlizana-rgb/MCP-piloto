import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encolarIngesta } from "@/lib/ingesta/cola";
import { autorizadoPorCron } from "@/lib/peticion";
import { cronSecret } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HORAS_ENTRE_SINCRONIZACIONES = 24;
const MAXIMO_POR_TICK = 200;

/**
 * Re-sincronizacion diaria. Encola los comercios cuyo catalogo lleva mas de 24
 * horas sin refrescarse; el worker los procesa despues.
 *
 * Incluye a los que quedaron en lista de espera: si un comercio migro a
 * Shopify desde que se inscribio, lo queremos indexar sin que tenga que
 * volver a llenar el formulario.
 */
export async function GET(request: NextRequest) {
  if (!autorizadoPorCron(request, cronSecret())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const db = supabaseAdmin();
  const corte = new Date(Date.now() - HORAS_ENTRE_SINCRONIZACIONES * 3600_000).toISOString();

  const { data: comercios, error } = await db
    .from("comercios")
    .select("id")
    .in("estado", ["pendiente", "validando", "indexado", "lista_espera"])
    .or(`ultima_sincronizacion_en.is.null,ultima_sincronizacion_en.lt.${corte}`)
    .order("ultima_sincronizacion_en", { ascending: true, nullsFirst: true })
    .limit(MAXIMO_POR_TICK);

  if (error) {
    console.error("[resync] no se pudieron listar comercios", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let encolados = 0;
  let yaEnCola = 0;

  for (const comercio of comercios ?? []) {
    // encolarIngesta devuelve false si ya hay un trabajo activo: el indice
    // unico parcial impide apilar resyncs sobre una ingesta en curso.
    if (await encolarIngesta(comercio.id, "resync")) encolados++;
    else yaEnCola++;
  }

  return NextResponse.json({ ok: true, candidatos: comercios?.length ?? 0, encolados, yaEnCola });
}

export const POST = GET;
