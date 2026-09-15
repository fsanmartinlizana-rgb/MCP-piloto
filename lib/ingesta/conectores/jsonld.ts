import "server-only";
import { obtener } from "@/lib/ingesta/http";
import {
  aNumero,
  limpiarHtml,
  MONEDA_POR_DEFECTO,
  recortar,
  urlAbsoluta,
  type ProductoNormalizado,
} from "@/lib/ingesta/normalizar";
import { crawlDelay } from "@/lib/ingesta/robots";
import { userAgentBot } from "@/lib/env";
import type { ContextoConector, ResultadoConector } from "@/lib/ingesta/tipos";

/**
 * Fallback general: sitemap.xml para descubrir paginas de producto y JSON-LD
 * schema.org/Product para leerlas.
 *
 * Es el camino lento y el ultimo recurso. Cada producto cuesta un request al
 * sitio del comercio, asi que va con tope duro y respetando Crawl-delay.
 */

const MAXIMO_URLS = 400;
const MAXIMO_SITEMAPS = 25;
const PAUSA_MINIMA_MS = 250;

const PISTAS_PRODUCTO = ["/product/", "/producto/", "/products/", "/productos/", "/tienda/", "/shop/", "/p/"];

export async function extraerJsonLd(ctx: ContextoConector): Promise<ResultadoConector> {
  const { registrar } = ctx;

  const urls = await descubrirUrlsProducto(ctx);
  if (urls.length === 0) {
    return { productos: [], motivo: "No se encontraron paginas de producto en el sitemap" };
  }

  await registrar("info", "fetch", `Sitemap: ${urls.length} paginas de producto candidatas`);

  const pausaMs = Math.max(crawlDelay(ctx.robots, userAgentBot()) * 1000, PAUSA_MINIMA_MS);
  const productos: ProductoNormalizado[] = [];
  let fallidas = 0;

  for (const url of urls) {
    try {
      const pagina = await obtener(url);
      if (pagina.status === 200) {
        productos.push(...leerJsonLd(pagina.cuerpo, pagina.url));
      }
    } catch {
      fallidas++;
    }
    await pausa(pausaMs);
  }

  if (fallidas > 0) {
    await registrar("warn", "fetch", `${fallidas} paginas de producto no se pudieron leer`);
  }

  return {
    productos,
    motivo:
      productos.length === 0
        ? "Las paginas de producto no publican datos estructurados (JSON-LD schema.org/Product)"
        : undefined,
  };
}

// --- Descubrimiento de URLs ---------------------------------------------------

export async function descubrirUrlsProducto(ctx: ContextoConector): Promise<string[]> {
  const { origen, robots, permitido } = ctx;

  const porVisitar = [
    ...robots.sitemaps,
    new URL("/sitemap.xml", origen).toString(),
    new URL("/wp-sitemap.xml", origen).toString(),
    new URL("/sitemap_index.xml", origen).toString(),
  ];

  const vistos = new Set<string>();
  const encontradas = new Set<string>();
  let sitemapsLeidos = 0;

  while (porVisitar.length > 0 && sitemapsLeidos < MAXIMO_SITEMAPS && encontradas.size < MAXIMO_URLS) {
    const sitemap = porVisitar.shift()!;
    if (vistos.has(sitemap)) continue;
    vistos.add(sitemap);

    let xml: string;
    try {
      const respuesta = await obtener(sitemap, { aceptar: "application/xml,text/xml,*/*;q=0.5" });
      if (respuesta.status !== 200) continue;
      xml = respuesta.cuerpo;
    } catch {
      continue;
    }
    sitemapsLeidos++;

    const esIndice = /<sitemapindex[\s>]/i.test(xml);
    for (const loc of extraerLocs(xml)) {
      if (esIndice) {
        // Solo bajamos a los sitemaps que pueden traer productos.
        if (/product|producto|tienda|shop/i.test(loc) || !/post|page|categor|tag|author/i.test(loc)) {
          porVisitar.push(loc);
        }
        continue;
      }
      if (pareceProducto(loc) && permitido(loc)) {
        encontradas.add(loc);
        if (encontradas.size >= MAXIMO_URLS) break;
      }
    }
  }

  return [...encontradas];
}

function extraerLocs(xml: string): string[] {
  const salida: string[] = [];
  const patron = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let coincidencia: RegExpExecArray | null;

  while ((coincidencia = patron.exec(xml)) !== null) {
    const url = coincidencia[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .trim();
    if (/^https?:\/\//i.test(url)) salida.push(url);
  }
  return salida;
}

function pareceProducto(url: string): boolean {
  const ruta = url.toLowerCase();
  return PISTAS_PRODUCTO.some((pista) => ruta.includes(pista));
}

function pausa(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

// --- Lectura de JSON-LD -------------------------------------------------------

export function leerJsonLd(html: string, urlPagina: string): ProductoNormalizado[] {
  const bloques = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  const productos: ProductoNormalizado[] = [];

  for (const bloque of bloques) {
    let datos: unknown;
    try {
      datos = JSON.parse(bloque[1].trim());
    } catch {
      continue;
    }
    for (const nodo of buscarProductos(datos)) {
      const producto = normalizarNodo(nodo, urlPagina);
      if (producto) productos.push(producto);
    }
  }

  return productos;
}

type Nodo = Record<string, unknown>;

/** Recorre el JSON-LD entero: los productos aparecen sueltos, en arreglos o dentro de @graph. */
function buscarProductos(valor: unknown, profundidad = 0): Nodo[] {
  if (profundidad > 6 || valor === null || typeof valor !== "object") return [];

  if (Array.isArray(valor)) {
    return valor.flatMap((elemento) => buscarProductos(elemento, profundidad + 1));
  }

  const nodo = valor as Nodo;
  const encontrados: Nodo[] = [];

  if (esTipoProducto(nodo["@type"])) encontrados.push(nodo);

  for (const clave of ["@graph", "itemListElement", "item", "mainEntity"]) {
    if (clave in nodo) encontrados.push(...buscarProductos(nodo[clave], profundidad + 1));
  }

  return encontrados;
}

function esTipoProducto(tipo: unknown): boolean {
  const lista = Array.isArray(tipo) ? tipo : [tipo];
  return lista.some(
    (t) => typeof t === "string" && /(^|\/)(Product|ProductModel|IndividualProduct)$/i.test(t),
  );
}

function normalizarNodo(nodo: Nodo, urlPagina: string): ProductoNormalizado | null {
  const nombre = recortar(textoDe(nodo.name), 300);
  if (!nombre) return null;

  const oferta = primeraOferta(nodo.offers);

  const url =
    urlAbsoluta(urlPagina, textoDe(nodo.url) ?? textoDe(oferta?.url)) ?? urlPagina;

  const disponibilidad = textoDe(oferta?.availability);

  return {
    sku: recortar(textoDe(nodo.sku) ?? textoDe(nodo.mpn), 120),
    nombre,
    descripcion: limpiarHtml(textoDe(nodo.description)),
    precio: aNumero(oferta?.price ?? oferta?.lowPrice ?? null),
    moneda: (textoDe(oferta?.priceCurrency) ?? MONEDA_POR_DEFECTO).toUpperCase().slice(0, 3),
    stock_disponible: disponibilidad ? /InStock|LimitedAvailability|PreOrder/i.test(disponibilidad) : null,
    url_producto: url,
    imagen_url: urlAbsoluta(urlPagina, primeraImagen(nodo.image)),
    categoria: recortar(textoDe(nodo.category), 120),
  };
}

function primeraOferta(offers: unknown): Nodo | null {
  if (!offers || typeof offers !== "object") return null;
  if (Array.isArray(offers)) {
    const primera = offers.find((o) => o && typeof o === "object");
    return (primera as Nodo) ?? null;
  }
  return offers as Nodo;
}

function primeraImagen(image: unknown): string | null {
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return primeraImagen(image[0]);
  if (image && typeof image === "object") {
    const url = (image as Nodo).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

/** schema.org permite valores sueltos o envueltos en {"@value": ...}. */
function textoDe(valor: unknown): string | null {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) return textoDe(valor[0]);
  if (valor && typeof valor === "object") {
    const envuelto = (valor as Nodo)["@value"] ?? (valor as Nodo).name;
    if (typeof envuelto === "string" || typeof envuelto === "number") return String(envuelto);
  }
  return null;
}
