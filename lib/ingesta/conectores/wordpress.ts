import "server-only";
import { obtenerJson } from "@/lib/ingesta/http";
import {
  aNumero,
  limpiarHtml,
  MONEDA_POR_DEFECTO,
  recortar,
  urlAbsoluta,
  type ProductoNormalizado,
} from "@/lib/ingesta/normalizar";
import { extraerJsonLd } from "@/lib/ingesta/conectores/jsonld";
import type { ContextoConector, ResultadoConector } from "@/lib/ingesta/tipos";

/**
 * Conector WordPress generico.
 *
 * "WordPress con tienda" es un rango amplio: hay plugins que registran un
 * custom post type de producto en /wp-json/wp/v2/product y otros que no
 * exponen nada. Probamos la REST API primero y caemos al sitemap + JSON-LD.
 *
 * Si ninguna de las dos entrega productos, el sitio es un WordPress *sin*
 * tienda y queda fuera del alcance del piloto. Eso lo decide ejecutar.ts.
 */

const POR_PAGINA = 100;
const MAXIMO_PAGINAS = 30;

const TIPOS_CANDIDATOS = ["product", "producto", "productos"];

interface EntradaWp {
  id: number;
  link?: string | null;
  slug?: string | null;
  title?: { rendered?: string | null } | null;
  content?: { rendered?: string | null } | null;
  excerpt?: { rendered?: string | null } | null;
  meta?: Record<string, unknown> | null;
  _embedded?: { "wp:featuredmedia"?: Array<{ source_url?: string | null }> } | null;
}

export async function extraerWordPress(ctx: ContextoConector): Promise<ResultadoConector> {
  const { origen, permitido, registrar } = ctx;

  for (const tipo of TIPOS_CANDIDATOS) {
    const base = new URL(`/wp-json/wp/v2/${tipo}`, origen).toString();
    if (!permitido(base)) continue;

    const productos = await leerTipo(base, origen, registrar, tipo);
    if (productos.length > 0) {
      await registrar("info", "parseo", `WordPress: ${productos.length} productos desde wp/v2/${tipo}`);
      return { productos };
    }
  }

  await registrar(
    "info",
    "fetch",
    "WordPress: la REST API no expone productos, se prueba sitemap + JSON-LD",
  );

  return extraerJsonLd(ctx);
}

async function leerTipo(
  base: string,
  origen: string,
  registrar: ContextoConector["registrar"],
  tipo: string,
): Promise<ProductoNormalizado[]> {
  const productos: ProductoNormalizado[] = [];

  for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
    const url = new URL(base);
    url.searchParams.set("per_page", String(POR_PAGINA));
    url.searchParams.set("page", String(pagina));
    url.searchParams.set("_embed", "wp:featuredmedia");

    const lote = await obtenerJson<EntradaWp[]>(url.toString());
    if (!Array.isArray(lote) || lote.length === 0) break;

    for (const entrada of lote) {
      const producto = normalizarEntrada(entrada, origen);
      if (producto) productos.push(producto);
    }

    if (lote.length < POR_PAGINA) break;
    if (pagina === MAXIMO_PAGINAS) {
      await registrar("warn", "fetch", `WordPress: tope de paginas alcanzado en wp/v2/${tipo}`);
    }
  }

  return productos;
}

function normalizarEntrada(entrada: EntradaWp, origen: string): ProductoNormalizado | null {
  const url = urlAbsoluta(origen, entrada.link);
  const nombre = recortar(limpiarHtml(entrada.title?.rendered), 300);
  if (!url || !nombre) return null;

  // Los plugins guardan el precio en meta con nombres distintos; probamos los
  // mas comunes y, si no aparece, la fila queda sin precio antes que con uno
  // inventado.
  const meta = entrada.meta ?? {};
  const precio =
    aNumero(meta._price) ?? aNumero(meta.price) ?? aNumero(meta._regular_price) ?? null;

  return {
    sku: recortar(typeof meta._sku === "string" ? meta._sku : null, 120),
    nombre,
    descripcion: limpiarHtml(entrada.content?.rendered ?? entrada.excerpt?.rendered),
    precio,
    moneda: MONEDA_POR_DEFECTO,
    stock_disponible: null,
    url_producto: url,
    imagen_url: urlAbsoluta(origen, entrada._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null),
    categoria: null,
  };
}
