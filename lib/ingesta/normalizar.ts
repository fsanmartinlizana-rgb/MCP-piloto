import "server-only";
import { createHash } from "node:crypto";

/**
 * Esquema unico al que aterrizan los tres conectores. Todo lo que viene de una
 * tienda pasa por aca antes de tocar la base.
 */
export interface ProductoNormalizado {
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  moneda: string;
  stock_disponible: boolean | null;
  url_producto: string;
  imagen_url: string | null;
  categoria: string | null;
}

export const MONEDA_POR_DEFECTO = "CLP";

const LARGO_DESCRIPCION = 2000;

/** Quita etiquetas y entidades para dejar texto que un asistente pueda leer. */
export function limpiarHtml(entrada: string | null | undefined): string | null {
  if (!entrada) return null;

  const texto = entrada
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCharCode(Number(codigo)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!texto) return null;
  return texto.length > LARGO_DESCRIPCION ? `${texto.slice(0, LARGO_DESCRIPCION)}...` : texto;
}

/**
 * Lee un precio venga como number, como "19990" o como "$19.990 CLP".
 *
 * El caso dificil es un separador solo: "19.990" son 19.990 pesos en Chile y
 * 19,99 en dolares. La regla es que un separador seguido de exactamente tres
 * digitos es separador de miles; cualquier otra cantidad de digitos lo hace
 * decimal. Se equivoca con un "1.500" que de verdad quiso decir 1,5 USD, pero
 * ese caso casi no existe: los conectores estructurados (Shopify entrega
 * "19990.00", WooCommerce entrega unidades minimas) no pasan por aca. Esto es
 * para JSON-LD, donde los precios vienen escritos como los muestra el sitio.
 */
export function aNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;

  const limpio = valor.replace(/[^\d.,-]/g, "").trim();
  if (!limpio) return null;

  const comas = (limpio.match(/,/g) ?? []).length;
  const puntos = (limpio.match(/\./g) ?? []).length;

  let normalizado: string;

  if (comas > 0 && puntos > 0) {
    // Vienen los dos: el ultimo en aparecer es el decimal.
    normalizado =
      limpio.lastIndexOf(",") > limpio.lastIndexOf(".")
        ? limpio.replace(/\./g, "").replace(",", ".")
        : limpio.replace(/,/g, "");
  } else if (comas + puntos === 0) {
    normalizado = limpio;
  } else if (comas + puntos > 1) {
    // Repetido: solo puede ser separador de miles (1.234.567).
    normalizado = limpio.replace(/[.,]/g, "");
  } else {
    const separador = comas === 1 ? "," : ".";
    const decimales = limpio.length - limpio.lastIndexOf(separador) - 1;
    normalizado =
      decimales === 3
        ? limpio.replace(/[.,]/g, "")
        : limpio.replace(separador, ".");
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function urlAbsoluta(base: string, ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  try {
    return new URL(ruta, base).toString();
  } catch {
    return null;
  }
}

export function recortar(texto: string | null | undefined, maximo: number): string | null {
  if (!texto) return null;
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  return limpio.length > maximo ? limpio.slice(0, maximo) : limpio;
}

/**
 * Huella del contenido. Si no cambio, el upsert deja la fila igual y solo
 * mueve visto_por_ultima_vez_en: asi `actualizado_en` significa de verdad
 * "cambio algo", que es lo que mira el asistente.
 */
export function hashProducto(producto: ProductoNormalizado): string {
  return createHash("sha1")
    .update(
      JSON.stringify([
        producto.sku,
        producto.nombre,
        producto.descripcion,
        producto.precio,
        producto.moneda,
        producto.stock_disponible,
        producto.url_producto,
        producto.imagen_url,
        producto.categoria,
      ]),
    )
    .digest("hex");
}

/** Descarta lo que no sirve para recomendar: sin nombre o sin URL. */
export function esUtilizable(producto: ProductoNormalizado): boolean {
  return Boolean(producto.nombre?.trim()) && Boolean(producto.url_producto?.trim());
}
