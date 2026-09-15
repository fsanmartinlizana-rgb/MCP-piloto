import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anonimizarConsulta } from "@/lib/anonimizar";
import { agregarUtms } from "@/lib/handoffs/utm";
import { autorizadoPorCron, comparaSegura } from "@/lib/peticion";
import { cronSecret, urlBase } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registro de handoffs. Lo llama el servidor MCP cada vez que un asistente
 * entrega un producto de un comercio al usuario.
 *
 * Este endpoint es la instrumentacion del piloto. Si termina sin estos
 * numeros, no hay con que definir el precio del servicio despues.
 */

const esquema = z.object({
  producto_id: z.string().uuid().optional(),
  comercio_id: z.string().uuid().optional(),
  cliente_llm: z.enum(["claude", "chatgpt", "otro"]).default("otro"),
  consulta_origen: z.string().max(4000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (!autorizadoConSecreto(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo invalido." }, { status: 400 });
  }

  const analisis = esquema.safeParse(cuerpo);
  if (!analisis.success) {
    return NextResponse.json(
      { ok: false, error: "Datos invalidos.", campos: analisis.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { producto_id, comercio_id, cliente_llm, consulta_origen } = analisis.data;
  if (!producto_id && !comercio_id) {
    return NextResponse.json(
      { ok: false, error: "Se requiere producto_id o comercio_id." },
      { status: 422 },
    );
  }

  const db = supabaseAdmin();

  let comercioId = comercio_id ?? null;
  let urlDestino: string | null = null;

  if (producto_id) {
    const { data: producto } = await db
      .from("productos")
      .select("id, comercio_id, url_producto")
      .eq("id", producto_id)
      .maybeSingle();

    if (!producto) {
      return NextResponse.json({ ok: false, error: "Producto no encontrado." }, { status: 404 });
    }
    comercioId = producto.comercio_id;
    urlDestino = producto.url_producto;
  }

  if (!comercioId) {
    return NextResponse.json({ ok: false, error: "Comercio no encontrado." }, { status: 404 });
  }

  if (!urlDestino) {
    const { data: comercio } = await db
      .from("comercios")
      .select("url_tienda")
      .eq("id", comercioId)
      .maybeSingle();
    if (!comercio) {
      return NextResponse.json({ ok: false, error: "Comercio no encontrado." }, { status: 404 });
    }
    urlDestino = comercio.url_tienda;
  }

  if (!urlDestino) {
    return NextResponse.json({ ok: false, error: "Sin URL de destino." }, { status: 404 });
  }

  const urlConUtms = agregarUtms(urlDestino, comercioId);

  const { data: handoff, error } = await db
    .from("handoffs")
    .insert({
      comercio_id: comercioId,
      producto_id: producto_id ?? null,
      tipo: "recomendacion",
      cliente_llm,
      consulta_origen: anonimizarConsulta(consulta_origen),
      url_destino: urlConUtms,
    })
    .select("id")
    .single();

  if (error || !handoff) {
    console.error("[handoffs] no se pudo registrar", error);
    return NextResponse.json({ ok: false, error: "No se pudo registrar el handoff." }, { status: 500 });
  }

  // El asistente entrega url_seguimiento: es la misma URL del comercio pero
  // pasando por /ir, que registra el clic real antes de redirigir. Los dos
  // numeros juntos (recomendaciones y clics) son los que sostienen el pricing.
  return NextResponse.json({
    ok: true,
    handoff_id: handoff.id,
    url_destino: urlConUtms,
    url_seguimiento: `${urlBase()}/ir?h=${handoff.id}`,
  });
}

function autorizadoConSecreto(request: NextRequest): boolean {
  const propio = process.env.MCP_API_KEY;
  if (propio) {
    const cabecera = request.headers.get("authorization") ?? "";
    const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
    if (token && comparaSegura(token, propio)) return true;
  }
  return autorizadoPorCron(request, cronSecret());
}
