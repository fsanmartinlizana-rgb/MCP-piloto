import { NextResponse, type NextRequest } from "next/server";
import { procesarCola } from "@/lib/ingesta/cola";
import { autorizadoPorCron } from "@/lib/peticion";
import { cronSecret } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una tienda grande puede tomar varios minutos entre paginacion y Crawl-delay.
export const maxDuration = 300;

/**
 * Worker de la cola de ingesta. Lo llaman el cron de Vercel y la propia
 * inscripcion, para que la primera indexacion no espere al proximo tick.
 */
export async function GET(request: NextRequest) {
  if (!autorizadoPorCron(request, cronSecret())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const limite = Number(request.nextUrl.searchParams.get("limite") ?? "3");

  try {
    const resumen = await procesarCola(Number.isFinite(limite) ? Math.min(limite, 10) : 3);
    return NextResponse.json({ ok: true, ...resumen });
  } catch (error) {
    console.error("[worker] fallo al procesar la cola", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export const POST = GET;
