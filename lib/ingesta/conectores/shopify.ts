import "server-only";
import { obtener, obtenerJson } from "@/lib/ingesta/http";
import {
  aNumero,
  limpiarHtml,
  MONEDA_POR_DEFECTO,
  recortar,
  urlAbsoluta,
  type ProductoNormalizado,
} from "@/lib/ingesta/normalizar";
import type { ContextoConector, ResultadoConector } from "@/lib/ingesta/tipos";

/**
 * Conector Shopify via /products.json.
 *
 * Endpoint publico y paginado, sin token. Es la fuente estructurada: nunca
 * llegamos a raspar HTML en una tienda Shopify.
 */

const POR_PAGINA = 250;
const MAXIMO_PAGINAS = 40; // ~10.000 productos por tienda

interface VarianteShopify {
  id: number;
  sku?: string | null;
  title?: string | null;
  price?: string | number | null;
  available?: boolean | null;
  featured_image?: { src?: string | null } | null;
}

interface ProductoShopify {
  id: number;
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string[] | string | null;
  variants?: VarianteShopify[] | null;
  images?: Array<{ src?: string | null }> | null;
}

export async function extraerShopify(ctx: ContextoConector): Promise<ResultadoConector> {
  const { origen, permitido, registrar } = ctx;

  const rutaCatalogo = new URL("/products.json", origen).toString();
  if (!permitido(rutaCatalogo)) {
    return {
      productos: [],
      motivo: "robots.txt de la tienda bloquea /products.json",
      bloqueadoPorRobots: true,
    };
  }

  const moneda = await detectarMoneda(origen);
  const productos: ProductoNormalizado[] = [];

  for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
    const url = new URL("/products.json", origen);
    url.searchParams.set("limit", String(POR_PAGINA));
    url.searchParams.set("page", String(pagina));

    const datos = await obtenerJson<{ products?: ProductoShopify[] }>(url.toString());
    const lote = datos?.products;

    if (!Array.isArray(lote) || lote.length === 0) break;

    for (const crudo of lote) {
      productos.push(...normalizarProducto(crudo, origen, moneda));
    }

    await registrar("info", "fetch", `Shopify: pagina ${pagina}, ${lote.length} productos`);

    if (lote.length < POR_PAGINA) break;
    if (pagina === MAXIMO_PAGINAS) {
      await registrar(
        "warn",
        "fetch",
        `Shopify: se alcanzo el tope de ${MAXIMO_PAGINAS} paginas; el catalogo puede estar incompleto`,
      );
    }
  }

  return { productos };
}

/**
 * /products.json no trae la moneda. La sacamos de /meta.json y, si no esta,
 * del objeto Shopify.currency que el tema deja en el HTML.
 */
async function detectarMoneda(origen: string): Promise<string> {
  const meta = await obtenerJson<{ currency?: string }>(new URL("/meta.json", origen).toString());
  if (meta?.currency && /^[A-Z]{3}$/.test(meta.currency)) return meta.currency;

  try {
    const inicio = await obtener(origen);
    const activa = inicio.cuerpo.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/);
    if (activa) return activa[1];
  } catch {
    // Sin moneda detectada nos quedamos con el default del piloto.
  }

  return MONEDA_POR_DEFECTO;
}

function normalizarProducto(
  crudo: ProductoShopify,
  origen: string,
  moneda: string,
): ProductoNormalizado[] {
  const handle = crudo.handle;
  if (!handle) return [];

  const urlProducto = new URL(`/products/${handle}`, origen).toString();
  const descripcion = limpiarHtml(crudo.body_html);
  const imagenPrincipal = urlAbsoluta(origen, crudo.images?.[0]?.src ?? null);
  const categoria =
    recortar(crudo.product_type, 120) ??
    recortar(Array.isArray(crudo.tags) ? crudo.tags[0] : crudo.tags, 120);

  const variantes = crudo.variants ?? [];

  // Producto sin variantes declaradas: igual queda una fila utilizable.
  if (variantes.length === 0) {
    return [
      {
        sku: null,
        nombre: recortar(crudo.title, 300) ?? "",
        descripcion,
        precio: null,
        moneda,
        stock_disponible: null,
        url_producto: urlProducto,
        imagen_url: imagenPrincipal,
        categoria,
      },
    ];
  }

  // Una fila por variante: el precio, el SKU y el stock son por variante, y el
  // asistente tiene que poder decir "talla M a $19.990".
  return variantes.map((variante) => {
    const tieneTitulo = variante.title && variante.title !== "Default Title";
    const nombre = tieneTitulo
      ? `${crudo.title ?? ""} - ${variante.title}`
      : (crudo.title ?? "");

    const url = new URL(urlProducto);
    if (variantes.length > 1) url.searchParams.set("variant", String(variante.id));

    return {
      sku: recortar(variante.sku, 120),
      nombre: recortar(nombre, 300) ?? "",
      descripcion,
      precio: aNumero(variante.price),
      moneda,
      stock_disponible: typeof variante.available === "boolean" ? variante.available : null,
      url_producto: url.toString(),
      imagen_url: urlAbsoluta(origen, variante.featured_image?.src ?? null) ?? imagenPrincipal,
      categoria,
    };
  });
}
