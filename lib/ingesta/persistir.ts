import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esUtilizable, hashProducto, type ProductoNormalizado } from "@/lib/ingesta/normalizar";

const TAMANO_LOTE = 500;
export const MAXIMO_PRODUCTOS_POR_TIENDA = 20_000;

export interface ResultadoPersistencia {
  guardados: number;
  desactivados: number;
  descartados: number;
  truncado: boolean;
}

/**
 * Escribe el catalogo normalizado.
 *
 * Los productos que desaparecieron del catalogo se marcan inactivos, nunca se
 * borran: un producto borrado se llevaria consigo el historial de por que lo
 * recomendamos.
 */
export async function persistirCatalogo(
  comercioId: string,
  entrada: ProductoNormalizado[],
): Promise<ResultadoPersistencia> {
  const db = supabaseAdmin();

  // Marca unica de esta corrida: las filas que la lleven siguen en el
  // catalogo, las que no, se apagan.
  const marca = new Date().toISOString();

  const utilizables = entrada.filter(esUtilizable);
  const descartadosPorForma = entrada.length - utilizables.length;

  // La URL es la identidad del producto; si una tienda repite la misma URL en
  // dos variantes, gana la primera y el upsert no choca contra si mismo.
  const porUrl = new Map<string, ProductoNormalizado>();
  for (const producto of utilizables) {
    if (!porUrl.has(producto.url_producto)) porUrl.set(producto.url_producto, producto);
  }

  let unicos = [...porUrl.values()];
  const truncado = unicos.length > MAXIMO_PRODUCTOS_POR_TIENDA;
  if (truncado) unicos = unicos.slice(0, MAXIMO_PRODUCTOS_POR_TIENDA);

  const filas = unicos.map((producto) => ({
    comercio_id: comercioId,
    sku: producto.sku,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: producto.precio,
    moneda: producto.moneda,
    stock_disponible: producto.stock_disponible,
    url_producto: producto.url_producto,
    imagen_url: producto.imagen_url,
    categoria: producto.categoria,
    activo: true,
    hash_contenido: hashProducto(producto),
    visto_por_ultima_vez_en: marca,
  }));

  let guardados = 0;
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const lote = filas.slice(i, i + TAMANO_LOTE);
    const { error } = await db
      .from("productos")
      .upsert(lote, { onConflict: "comercio_id,url_producto" });

    if (error) {
      throw new Error(`No se pudo guardar el lote de productos: ${error.message}`);
    }
    guardados += lote.length;
  }

  // Un catalogo vacio no desactiva nada: casi siempre significa que fallo la
  // lectura, no que el comercio cerro la tienda. Apagar todo por un timeout
  // seria sacarlo de los asistentes por error.
  let desactivados = 0;
  if (filas.length > 0) {
    const { data, error } = await db
      .from("productos")
      .update({ activo: false })
      .eq("comercio_id", comercioId)
      .eq("activo", true)
      .lt("visto_por_ultima_vez_en", marca)
      .select("id");

    if (error) {
      throw new Error(`No se pudieron marcar los productos retirados: ${error.message}`);
    }
    desactivados = data?.length ?? 0;
  }

  return { guardados, desactivados, descartados: descartadosPorForma, truncado };
}
