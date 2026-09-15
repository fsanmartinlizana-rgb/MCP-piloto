import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { agregarUtms } from "@/lib/handoffs/utm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Salto medido hacia el comercio: /ir?h=<handoff_id>
 *
 * Registrar la recomendacion mide lo que el asistente mostro; esto mide lo que
 * el usuario efectivamente abrio. La diferencia entre ambos numeros es la
 * conversacion de precio completa, y por eso el piloto guarda los dos.
 *
 * Si algo falla, igual redirigimos: perder una visita del comercio por un
 * problema nuestro de medicion seria el peor intercambio posible.
 */
export async function GET(request: NextRequest) {
  const handoffId = request.nextUrl.searchParams.get("h");
  const inicio = new URL("/", request.nextUrl.origin);

  if (!handoffId) return NextResponse.redirect(inicio, 302);

  const db = supabaseAdmin();

  const { data: origen } = await db
    .from("handoffs")
    .select("comercio_id, producto_id, cliente_llm, consulta_origen, url_destino")
    .eq("id", handoffId)
    .maybeSingle();

  if (!origen) return NextResponse.redirect(inicio, 302);

  const destino = agregarUtms(origen.url_destino, origen.comercio_id);

  try {
    await db.from("handoffs").insert({
      comercio_id: origen.comercio_id,
      producto_id: origen.producto_id,
      tipo: "clic",
      cliente_llm: origen.cliente_llm,
      consulta_origen: origen.consulta_origen,
      url_destino: destino,
    });
  } catch (error) {
    console.error("[ir] no se pudo registrar el clic", error);
  }

  return NextResponse.redirect(destino, 302);
}
