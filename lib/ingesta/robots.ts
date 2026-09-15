import "server-only";
import { obtener } from "@/lib/ingesta/http";

/**
 * Parser minimo de robots.txt.
 *
 * Respetarlo no es opcional: entramos a sitios de terceros identificados como
 * DolfsBot y con la URL de contacto en el User-Agent. Si una tienda nos
 * bloquea, no se indexa, y el motivo queda en logs_ingesta para poder
 * explicarselo al comercio.
 */

interface Grupo {
  agentes: string[];
  permitir: string[];
  bloquear: string[];
  crawlDelay?: number;
}

export interface Robots {
  grupos: Grupo[];
  sitemaps: string[];
}

export const ROBOTS_PERMISIVO: Robots = { grupos: [], sitemaps: [] };

export function parsearRobots(texto: string): Robots {
  const grupos: Grupo[] = [];
  const sitemaps: string[] = [];
  let actual: Grupo | null = null;
  let agenteAnterior = false;

  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.split("#")[0].trim();
    if (!limpia) continue;

    const separador = limpia.indexOf(":");
    if (separador === -1) continue;

    const campo = limpia.slice(0, separador).trim().toLowerCase();
    const valor = limpia.slice(separador + 1).trim();

    switch (campo) {
      case "user-agent": {
        // Varios User-agent seguidos comparten el mismo bloque de reglas.
        if (!agenteAnterior || !actual) {
          actual = { agentes: [], permitir: [], bloquear: [] };
          grupos.push(actual);
        }
        actual.agentes.push(valor.toLowerCase());
        agenteAnterior = true;
        break;
      }
      case "allow":
        if (actual && valor) actual.permitir.push(valor);
        agenteAnterior = false;
        break;
      case "disallow":
        // "Disallow:" vacio significa permitir todo, no bloquear todo.
        if (actual && valor) actual.bloquear.push(valor);
        agenteAnterior = false;
        break;
      case "crawl-delay": {
        const segundos = Number(valor);
        if (actual && Number.isFinite(segundos)) actual.crawlDelay = segundos;
        agenteAnterior = false;
        break;
      }
      case "sitemap":
        if (valor) sitemaps.push(valor);
        agenteAnterior = false;
        break;
      default:
        agenteAnterior = false;
    }
  }

  return { grupos, sitemaps };
}

export async function cargarRobots(origen: string): Promise<Robots> {
  try {
    const respuesta = await obtener(new URL("/robots.txt", origen).toString(), {
      aceptar: "text/plain,*/*;q=0.5",
      maximoBytes: 512 * 1024,
    });
    // 404 o 5xx: el estandar dice tratar el sitio como abierto.
    if (respuesta.status !== 200) return ROBOTS_PERMISIVO;
    return parsearRobots(respuesta.cuerpo);
  } catch {
    return ROBOTS_PERMISIVO;
  }
}

/** Elige el grupo mas especifico que aplica a nuestro bot. */
function grupoAplicable(robots: Robots, nombreBot: string): Grupo | null {
  const bot = nombreBot.toLowerCase();
  let comodin: Grupo | null = null;

  for (const grupo of robots.grupos) {
    for (const agente of grupo.agentes) {
      if (agente === "*") {
        comodin ??= grupo;
      } else if (bot.includes(agente)) {
        return grupo;
      }
    }
  }
  return comodin;
}

function patronCalza(patron: string, ruta: string): number {
  // Traduce el patron de robots (* y $) a regex y devuelve su largo como peso.
  const anclado = patron.endsWith("$");
  const cuerpo = anclado ? patron.slice(0, -1) : patron;

  const regex = new RegExp(
    "^" +
      cuerpo
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") +
      (anclado ? "$" : ""),
  );

  return regex.test(ruta) ? cuerpo.length : -1;
}

/**
 * Regla de desempate del estandar: gana el patron mas largo; con largo igual,
 * gana Allow.
 */
export function puedeAcceder(robots: Robots, url: string, nombreBot: string): boolean {
  const grupo = grupoAplicable(robots, nombreBot);
  if (!grupo) return true;

  let ruta: string;
  try {
    const parsed = new URL(url);
    ruta = `${parsed.pathname}${parsed.search}`;
  } catch {
    return false;
  }

  let mejorPermiso = -1;
  let mejorBloqueo = -1;
  for (const patron of grupo.permitir) mejorPermiso = Math.max(mejorPermiso, patronCalza(patron, ruta));
  for (const patron of grupo.bloquear) mejorBloqueo = Math.max(mejorBloqueo, patronCalza(patron, ruta));

  if (mejorBloqueo === -1) return true;
  return mejorPermiso >= mejorBloqueo;
}

export function crawlDelay(robots: Robots, nombreBot: string): number {
  return grupoAplicable(robots, nombreBot)?.crawlDelay ?? 0;
}
