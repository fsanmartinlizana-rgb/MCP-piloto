import { after, type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { esquemaInscripcion, normalizarUrlTienda } from "@/lib/validacion/inscripcion";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { permitirInscripcion } from "@/lib/rate-limit";
import { ipDe, userAgentDe } from "@/lib/peticion";
import { VERSION_TERMINOS } from "@/lib/terminos";
import { encolarIngesta, procesarCola } from "@/lib/ingesta/cola";
import { obtener } from "@/lib/ingesta/http";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inscripcion al piloto.
 *
 * Guarda el comercio, deja registrado el consentimiento y encola la ingesta.
 * Siempre encola, incluso si el comercio marco "Otra" plataforma: quien decide
 * si entra al piloto es la deteccion del pipeline, no el select del
 * formulario. Un comercio que no sabe que su tienda corre WooCommerce no tiene
 * por que quedarse afuera por eso.
 */
export async function POST(request: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo invalido." }, { status: 400 });
  }

  // Honeypot: un campo invisible para humanos. Si viene lleno, respondemos
  // como si todo hubiera salido bien y no guardamos nada, para no ensenarle al
  // bot cual fue el campo que lo delato.
  if (typeof cuerpo === "object" && cuerpo !== null && (cuerpo as Record<string, unknown>).sitio_web) {
    return NextResponse.json({ ok: true, estado: "pendiente", es_fundador: false });
  }

  const ip = ipDe(request);
  if (!(await permitirInscripcion(ip))) {
    return NextResponse.json(
      { ok: false, error: "Recibimos varias inscripciones desde tu conexion. Intenta de nuevo en un rato." },
      { status: 429 },
    );
  }

  const analisis = esquemaInscripcion.safeParse(cuerpo);
  if (!analisis.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Revisa los datos del formulario.",
        campos: analisis.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const datos = analisis.data;
  const normalizada = normalizarUrlTienda(datos.url_tienda);
  if (!normalizada) {
    return NextResponse.json(
      { ok: false, error: "No pudimos leer la direccion de tu tienda.", campos: { url_tienda: ["Direccion invalida"] } },
      { status: 422 },
    );
  }

  const db = supabaseAdmin();

  const { data: existente } = await db
    .from("comercios")
    .select("id, estado")
    .eq("url_tienda_normalizada", normalizada.clave)
    .maybeSingle();

  if (existente) {
    return NextResponse.json(
      { ok: false, error: "Esa tienda ya esta inscrita en el piloto. Escribenos si necesitas cambiar los datos." },
      { status: 409 },
    );
  }

  // "Que responda" es que haya un servidor al otro lado. Un 403 de Cloudflare
  // cuenta como respuesta: la tienda existe y el pipeline sabra lidiar con
  // ella. Solo bloqueamos cuando no hay nadie escuchando.
  if (!datos.forzar_url) {
    const alcanzable = await tiendaResponde(normalizada.url);
    if (!alcanzable) {
      return NextResponse.json(
        {
          ok: false,
          error: "No pudimos abrir tu tienda. Revisa la direccion; si estas seguro de que esta bien, envia de nuevo.",
          permitir_reintento: true,
        },
        { status: 422 },
      );
    }
  }

  const plataformaDeclarada = datos.plataforma;
  const fueraDeAlcance = plataformaDeclarada === "otra";

  const { data: comercio, error } = await db
    .from("comercios")
    .insert({
      nombre_comercio: datos.nombre_comercio,
      url_tienda: normalizada.url,
      url_tienda_normalizada: normalizada.clave,
      plataforma_declarada: plataformaDeclarada,
      contacto_nombre: datos.contacto_nombre,
      contacto_cargo: datos.contacto_cargo,
      contacto_email: datos.contacto_email,
      contacto_telefono: datos.contacto_telefono,
      categoria_productos: datos.categoria_productos,
      quiere_reunion: datos.quiere_reunion,
      referido_por: datos.referido_por || null,
      // Declarar "Otra" entra como lista de espera para poder darle al
      // comercio una respuesta honesta al instante. Si la deteccion descubre
      // que en realidad corre una plataforma soportada, el pipeline lo
      // promueve y ahi recien se le asigna numero de inscripcion.
      estado: fueraDeAlcance ? "lista_espera" : "pendiente",
      motivo_estado: fueraDeAlcance ? "Plataforma declarada fuera del alcance del piloto" : null,
      consentimiento_aceptado_en: new Date().toISOString(),
      version_terminos: VERSION_TERMINOS,
      ip_consentimiento: ip,
      user_agent_consentimiento: userAgentDe(request),
    })
    .select("id, estado, es_fundador, numero_inscripcion")
    .single();

  if (error || !comercio) {
    console.error("[inscripcion] no se pudo guardar", error);
    return NextResponse.json(
      { ok: false, error: "No pudimos guardar tu inscripcion. Intenta de nuevo en unos minutos." },
      { status: 500 },
    );
  }

  await encolarIngesta(comercio.id, "inicial");
  await log({
    comercioId: comercio.id,
    etapa: "cola",
    mensaje: `Inscripcion recibida (${plataformaDeclarada} declarada). Ingesta encolada.`,
  });

  // Arranca la ingesta apenas se devuelve la respuesta, para que el comercio
  // no espere al cron. Si esto no alcanza a correr, el cron lo recoge igual.
  after(async () => {
    try {
      await procesarCola(1);
    } catch (e) {
      console.error("[inscripcion] fallo el arranque de la cola", e);
    }
  });

  return NextResponse.json({
    ok: true,
    estado: comercio.estado,
    es_fundador: comercio.es_fundador,
    numero_inscripcion: comercio.numero_inscripcion,
  });
}

async function tiendaResponde(url: string): Promise<boolean> {
  try {
    const respuesta = await obtener(url, { timeoutMs: 8000, maximoBytes: 256 * 1024 });
    return respuesta.status > 0;
  } catch {
    return false;
  }
}
