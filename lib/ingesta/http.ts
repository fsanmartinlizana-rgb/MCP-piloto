import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { userAgentBot } from "@/lib/env";

/**
 * Cliente HTTP del pipeline de ingesta.
 *
 * Las URLs que abrimos vienen de un formulario publico, asi que este modulo
 * asume que cada direccion es hostil hasta que se demuestre lo contrario:
 * resuelve el host, rechaza rangos internos, limita tamano y tiempo, y revisa
 * cada salto de redireccion por separado.
 */

export const TIMEOUT_MS = 12_000;
export const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024;
const MAXIMO_REDIRECCIONES = 4;

export class ErrorIngesta extends Error {
  constructor(
    message: string,
    readonly etapa: "fetch" | "parseo" | "robots" = "fetch",
    readonly detalle?: unknown,
  ) {
    super(message);
    this.name = "ErrorIngesta";
  }
}

// --- Guard anti-SSRF ---------------------------------------------------------

function ipV4EsPrivada(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;

  if (a === 0 || a === 10 || a === 127) return true;               // this-network, privada, loopback
  if (a === 169 && b === 254) return true;                          // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;                 // privada
  if (a === 192 && b === 168) return true;                          // privada
  if (a === 192 && b === 0) return true;                            // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true;                // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;             // benchmarking
  if (a >= 224) return true;                                        // multicast y reservado
  return false;
}

function ipV6EsPrivada(ip: string): boolean {
  const normal = ip.toLowerCase().split("%")[0];
  if (normal === "::" || normal === "::1") return true;

  // IPv4 mapeada (::ffff:10.0.0.1): se evalua como IPv4.
  const mapeada = normal.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeada) return ipV4EsPrivada(mapeada[1]);

  const prefijo = parseInt(normal.split(":")[0] || "0", 16);
  if ((prefijo & 0xfe00) === 0xfc00) return true;                   // fc00::/7 unique local
  if ((prefijo & 0xffc0) === 0xfe80) return true;                   // fe80::/10 link-local
  return false;
}

function ipEsPrivada(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipV4EsPrivada(ip);
  if (version === 6) return ipV6EsPrivada(ip);
  return true;
}

/**
 * Comprueba que el host resuelva solo a direcciones publicas.
 *
 * Queda una ventana de DNS rebinding entre esta resolucion y la conexion real
 * que hace fetch. Cerrarla exige conectarse por IP con cabecera Host, lo que
 * rompe SNI en la mayoria de las tiendas; para el piloto la ventana es
 * aceptable y esta anotada a proposito.
 */
async function verificarHostPublico(host: string): Promise<void> {
  if (isIP(host)) {
    if (ipEsPrivada(host)) {
      throw new ErrorIngesta(`La direccion ${host} apunta a una red interna.`);
    }
    return;
  }

  let direcciones: Array<{ address: string }>;
  try {
    direcciones = await lookup(host, { all: true });
  } catch {
    throw new ErrorIngesta(`No se pudo resolver el dominio ${host}.`);
  }

  if (direcciones.length === 0) {
    throw new ErrorIngesta(`El dominio ${host} no resuelve a ninguna direccion.`);
  }
  for (const { address } of direcciones) {
    if (ipEsPrivada(address)) {
      throw new ErrorIngesta(`El dominio ${host} resuelve a una red interna.`);
    }
  }
}

// --- Fetch --------------------------------------------------------------------

export interface RespuestaIngesta {
  url: string;
  status: number;
  contentType: string;
  cuerpo: string;
}

/**
 * GET seguro: valida el destino, sigue redirecciones a mano revalidando cada
 * salto, corta por timeout y trunca cuerpos demasiado grandes.
 */
export async function obtener(
  urlInicial: string,
  opciones: { aceptar?: string; timeoutMs?: number; maximoBytes?: number } = {},
): Promise<RespuestaIngesta> {
  const {
    aceptar = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    timeoutMs = TIMEOUT_MS,
    maximoBytes = TAMANO_MAXIMO_BYTES,
  } = opciones;

  let url = urlInicial;

  for (let salto = 0; salto <= MAXIMO_REDIRECCIONES; salto++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ErrorIngesta(`URL invalida: ${url}`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new ErrorIngesta(`Esquema no permitido: ${parsed.protocol}`);
    }
    await verificarHostPublico(parsed.hostname);

    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), timeoutMs);

    let respuesta: Response;
    try {
      respuesta = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: control.signal,
        headers: {
          "user-agent": userAgentBot(),
          accept: aceptar,
          "accept-language": "es-CL,es;q=0.9",
        },
      });
    } catch (error) {
      clearTimeout(temporizador);
      const causa = error instanceof Error ? error.message : String(error);
      throw new ErrorIngesta(
        control.signal.aborted
          ? `La tienda no respondio en ${timeoutMs / 1000}s.`
          : `No se pudo conectar: ${causa}`,
      );
    }

    if (respuesta.status >= 300 && respuesta.status < 400) {
      clearTimeout(temporizador);
      const destino = respuesta.headers.get("location");
      if (!destino) throw new ErrorIngesta(`Redireccion ${respuesta.status} sin destino.`);
      if (salto === MAXIMO_REDIRECCIONES) {
        throw new ErrorIngesta("Demasiadas redirecciones.");
      }
      url = new URL(destino, parsed).toString();
      continue;
    }

    const declarado = Number(respuesta.headers.get("content-length") ?? "0");
    if (declarado > maximoBytes) {
      clearTimeout(temporizador);
      throw new ErrorIngesta(`Respuesta demasiado grande (${declarado} bytes).`);
    }

    try {
      const cuerpo = await leerAcotado(respuesta, maximoBytes);
      return {
        url: parsed.toString(),
        status: respuesta.status,
        contentType: respuesta.headers.get("content-type") ?? "",
        cuerpo,
      };
    } finally {
      clearTimeout(temporizador);
    }
  }

  throw new ErrorIngesta("Demasiadas redirecciones.");
}

async function leerAcotado(respuesta: Response, maximoBytes: number): Promise<string> {
  if (!respuesta.body) return "";

  const lector = respuesta.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maximoBytes) {
      await lector.cancel();
      break;
    }
    trozos.push(value);
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(concatenar(trozos, total));
}

function concatenar(trozos: Uint8Array[], total: number): Uint8Array {
  const salida = new Uint8Array(total);
  let posicion = 0;
  for (const trozo of trozos) {
    if (posicion + trozo.byteLength > total) break;
    salida.set(trozo, posicion);
    posicion += trozo.byteLength;
  }
  return salida.subarray(0, posicion);
}

/** GET que espera JSON. Devuelve null si el servidor no entrego JSON valido. */
export async function obtenerJson<T = unknown>(url: string): Promise<T | null> {
  const respuesta = await obtener(url, { aceptar: "application/json,*/*;q=0.5" });
  if (respuesta.status !== 200) return null;
  if (!/json/i.test(respuesta.contentType)) {
    // Varias tiendas devuelven el HTML del 404 con status 200.
    if (!respuesta.cuerpo.trimStart().startsWith("{") && !respuesta.cuerpo.trimStart().startsWith("[")) {
      return null;
    }
  }
  try {
    return JSON.parse(respuesta.cuerpo) as T;
  } catch {
    return null;
  }
}
