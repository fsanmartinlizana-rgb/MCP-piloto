import "server-only";
import type { Plataforma } from "@/lib/plataformas";
import { obtener, obtenerJson } from "@/lib/ingesta/http";

/**
 * Detecta la plataforma real de una tienda.
 *
 * No confiamos en lo que el comercio declaro en el formulario: el alcance del
 * piloto es Shopify, WooCommerce y WordPress con tienda, y esta funcion es la
 * que lo hace cumplir. Si aca sale 'otra', el comercio se va a lista de
 * espera aunque haya marcado Shopify.
 *
 * Prioriza endpoints estructurados sobre marcadores de HTML: que exista
 * /products.json es prueba mucho mas dura que encontrar la palabra "shopify"
 * suelta en una pagina.
 */

export interface DeteccionPlataforma {
  plataforma: Plataforma;
  evidencia: string;
  /** URL final tras redirecciones: la tienda puede vivir en otro host. */
  urlFinal: string;
}

export async function detectarPlataforma(urlTienda: string): Promise<DeteccionPlataforma> {
  const inicio = await obtener(urlTienda);
  const urlFinal = new URL(inicio.url).origin;
  const html = inicio.cuerpo;

  // --- 1. Endpoints estructurados ------------------------------------------

  const shopify = await obtenerJson<{ products?: unknown[] }>(
    new URL("/products.json?limit=1", urlFinal).toString(),
  );
  if (shopify && Array.isArray(shopify.products)) {
    return { plataforma: "shopify", evidencia: "/products.json responde con catalogo", urlFinal };
  }

  const woo = await obtenerJson<unknown[]>(
    new URL("/wp-json/wc/store/v1/products?per_page=1", urlFinal).toString(),
  );
  if (Array.isArray(woo)) {
    return {
      plataforma: "woocommerce",
      evidencia: "Store API /wp-json/wc/store/v1/products responde",
      urlFinal,
    };
  }

  // --- 2. Marcadores en el HTML ---------------------------------------------

  const minuscula = html.toLowerCase();

  if (
    minuscula.includes("cdn.shopify.com") ||
    minuscula.includes("/cdn/shop/") ||
    minuscula.includes("myshopify.com") ||
    /shopify\s*\.\s*(theme|shop|routes)/.test(minuscula)
  ) {
    return { plataforma: "shopify", evidencia: "Marcadores de Shopify en el HTML", urlFinal };
  }

  if (
    minuscula.includes("woocommerce") ||
    minuscula.includes("wp-content/plugins/woocommerce") ||
    minuscula.includes("wc-block")
  ) {
    return { plataforma: "woocommerce", evidencia: "Marcadores de WooCommerce en el HTML", urlFinal };
  }

  // --- 3. WordPress generico -------------------------------------------------

  const wpJson = await obtenerJson<{ namespaces?: string[] }>(
    new URL("/wp-json/", urlFinal).toString(),
  );
  if (wpJson && typeof wpJson === "object") {
    // Si la REST API declara el namespace de Woo, es Woo aunque la Store API
    // este apagada.
    if (Array.isArray(wpJson.namespaces) && wpJson.namespaces.some((n) => n.startsWith("wc/"))) {
      return { plataforma: "woocommerce", evidencia: "Namespace wc/ en /wp-json/", urlFinal };
    }
    return { plataforma: "wordpress", evidencia: "/wp-json/ responde", urlFinal };
  }

  if (
    minuscula.includes("/wp-content/") ||
    minuscula.includes("/wp-includes/") ||
    /<meta[^>]+name=["']generator["'][^>]+wordpress/i.test(html)
  ) {
    return { plataforma: "wordpress", evidencia: "Marcadores de WordPress en el HTML", urlFinal };
  }

  return {
    plataforma: "otra",
    evidencia: "No se encontraron marcadores de Shopify, WooCommerce ni WordPress",
    urlFinal,
  };
}
