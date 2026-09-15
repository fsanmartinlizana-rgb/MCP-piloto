import "server-only";
import { obtenerJson } from "@/lib/ingesta/http";
import {
  limpiarHtml,
  MONEDA_POR_DEFECTO,
  recortar,
  urlAbsoluta,
  type ProductoNormalizado,
} from "@/lib/ingesta/normalizar";
import type { ContextoConector, ResultadoConector } from "@/lib/ingesta/tipos";

/**
 * Conector WooCommerce via Store API (/wp-json/wc/store/v1/products).
 *
 * Es publica y no necesita claves, a diferencia de /wp-json/wc/v3 que exige
 * consumer key. Nunca pedimos credenciales a un comercio para el piloto.
 *
 * Limitacion conocida: la Store API entrega el producto padre. Para un
 * producto variable el precio queda como rango (tomamos el minimo) y el stock
 * como el del padre. Bajar a variantes exige un request por variacion, lo que
 * en una tienda de 800 productos son 800 requests extra contra el sitio del
 * comercio. Para el piloto no vale ese costo.
 */

const POR_PAGINA = 100;
const MAXIMO_PAGINAS = 60;

interface PreciosWoo {
  price?: string | null;
  regular_price?: string | null;
  currency_code?: string | null;
  currency_minor_unit?: number | null;
  price_range?: { min_amount?: string | null; max_amount?: string | null } | null;
}

interface ProductoWoo {
  id: number;
  name?: string | null;
  permalink?: string | null;
  sku?: string | null;
  description?: string | null;
  short_description?: string | null;
  is_in_stock?: boolean | null;
  prices?: PreciosWoo | null;
  images?: Array<{ src?: string | null }> | null;
  categories?: Array<{ name?: string | null }> | null;
}

export async function extraerWooCommerce(ctx: ContextoConector): Promise<ResultadoConector> {
  const { origen, permitido, registrar } = ctx;

  const base = new URL("/wp-json/wc/store/v1/products", origen).toString();
  if (!permitido(base)) {
    return {
      productos: [],
      motivo: "robots.txt de la tienda bloquea la Store API de WooCommerce",
      bloqueadoPorRobots: true,
    };
  }

  const productos: ProductoNormalizado[] = [];

  for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
    const url = new URL(base);
    url.searchParams.set("per_page", String(POR_PAGINA));
    url.searchParams.set("page", String(pagina));

    const lote = await obtenerJson<ProductoWoo[]>(url.toString());
    if (!Array.isArray(lote) || lote.length === 0) break;

    for (const crudo of lote) {
      const producto = normalizarProducto(crudo, origen);
      if (producto) productos.push(producto);
    }

    await registrar("info", "fetch", `WooCommerce: pagina ${pagina}, ${lote.length} productos`);

    if (lote.length < POR_PAGINA) break;
    if (pagina === MAXIMO_PAGINAS) {
      await registrar(
        "warn",
        "fetch",
        `WooCommerce: se alcanzo el tope de ${MAXIMO_PAGINAS} paginas; el catalogo puede estar incompleto`,
      );
    }
  }

  return { productos };
}

/**
 * La Store API entrega los montos en unidades minimas junto al exponente:
 * "19990" con currency_minor_unit 0 son $19.990 CLP, pero "1999" con
 * minor_unit 2 son 19,99 USD. Ignorar el exponente multiplica por 100 el
 * precio de media tienda.
 */
function montoWoo(valor: string | null | undefined, minorUnit: number | null | undefined): number | null {
  if (valor == null || valor === "") return null;

  const entero = Number(valor);
  if (!Number.isFinite(entero)) return null;

  const exponente = typeof minorUnit === "number" && minorUnit >= 0 ? minorUnit : 0;
  return entero / 10 ** exponente;
}

function normalizarProducto(crudo: ProductoWoo, origen: string): ProductoNormalizado | null {
  const url = urlAbsoluta(origen, crudo.permalink);
  if (!url) return null;

  const precios = crudo.prices ?? {};
  const minorUnit = precios.currency_minor_unit;

  const precio =
    montoWoo(precios.price, minorUnit) ??
    montoWoo(precios.price_range?.min_amount, minorUnit) ??
    montoWoo(precios.regular_price, minorUnit);

  return {
    sku: recortar(crudo.sku, 120),
    nombre: recortar(crudo.name, 300) ?? "",
    descripcion: limpiarHtml(crudo.description ?? crudo.short_description),
    precio,
    moneda: precios.currency_code?.toUpperCase() ?? MONEDA_POR_DEFECTO,
    stock_disponible: typeof crudo.is_in_stock === "boolean" ? crudo.is_in_stock : null,
    url_producto: url,
    imagen_url: urlAbsoluta(origen, crudo.images?.[0]?.src ?? null),
    categoria: recortar(crudo.categories?.[0]?.name, 120),
  };
}
