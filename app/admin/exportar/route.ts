import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exporta las inscripciones a CSV.
 *
 * Durante un piloto el trabajo comercial pasa en una planilla, no en el
 * panel. Queda bajo /admin a propósito: el middleware de Basic Auth cubre
 * toda la ruta, y este archivo lleva datos de contacto de los comercios.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("vista_admin_comercios")
    .select("*")
    .order("creado_en", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const columnas = [
    "numero_inscripcion", "es_fundador", "estado", "nombre_comercio", "url_tienda",
    "plataforma_declarada", "plataforma_detectada", "contacto_nombre", "contacto_cargo",
    "contacto_email", "contacto_telefono", "categoria_productos", "quiere_reunion",
    "referido_por", "productos_activos", "handoffs_totales", "handoffs_clics",
    "creado_en", "ultima_sincronizacion_en", "consentimiento_aceptado_en",
    "version_terminos", "motivo_estado", "ultimo_error_ingesta",
  ] as const;

  const filas = [
    columnas.join(","),
    ...(data ?? []).map((fila) =>
      columnas.map((columna) => aCampoCsv((fila as Record<string, unknown>)[columna])).join(","),
    ),
  ];

  const hoy = new Date().toISOString().slice(0, 10);

  return new NextResponse("﻿" + filas.join("\r\n"), {
    headers: {
      // El BOM de arriba es para que Excel en español no rompa las tildes.
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="inscripciones-dolfs-${hoy}.csv"`,
      "cache-control": "no-store",
    },
  });
}

function aCampoCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  // Un "=" o "+" al inicio lo interpreta Excel como fórmula. Se antepone una
  // comilla simple para que un nombre de comercio no se ejecute al abrirlo.
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}
