import { z } from "zod";
import { CATEGORIAS_PRODUCTOS, PLATAFORMAS } from "@/lib/plataformas";

/**
 * Esquema compartido entre el formulario del browser y el route handler.
 * El cliente valida para dar feedback rapido; el servidor valida porque es el
 * unico lugar donde la validacion cuenta.
 */

const textoBreve = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const esquemaInscripcion = z.object({
  nombre_comercio: textoBreve(2, 160),

  url_tienda: z
    .string()
    .trim()
    .min(4)
    .max(300)
    .refine((valor) => normalizarUrlTienda(valor) !== null, {
      message: "Escribe la direccion completa de tu tienda, por ejemplo mitienda.cl",
    }),

  plataforma: z.enum(PLATAFORMAS as unknown as [string, ...string[]]),

  contacto_nombre: textoBreve(2, 120),
  contacto_cargo: textoBreve(2, 120),
  contacto_email: z.string().trim().toLowerCase().email().max(200),
  contacto_telefono: textoBreve(6, 30),

  categoria_productos: z.enum(
    CATEGORIAS_PRODUCTOS as unknown as [string, ...string[]],
  ),

  acepta_terminos: z.literal(true, {
    errorMap: () => ({ message: "Necesitamos tu aceptacion de los terminos para inscribirte." }),
  }),
  quiere_reunion: z.boolean().default(false),

  referido_por: z.string().trim().max(120).optional().nullable(),

  // Honeypot: un campo que ningun humano ve y que los bots llenan igual.
  sitio_web: z.string().max(0, "Envio descartado.").optional(),

  // Segundo envio tras un fallo de alcanzabilidad: el comercio confirma que la
  // direccion esta bien aunque no hayamos podido abrirla.
  forzar_url: z.boolean().optional().default(false),
});

export type DatosInscripcion = z.infer<typeof esquemaInscripcion>;

/**
 * Normaliza la URL para comparar tiendas: https, host en minusculas, sin www
 * ni slash final. Devuelve null si no hay forma de leer un host valido.
 */
export function normalizarUrlTienda(entrada: string): { url: string; clave: string } | null {
  const texto = entrada.trim();
  if (!texto) return null;

  const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;

  let parsed: URL;
  try {
    parsed = new URL(conEsquema);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  // Exigimos un punto y un TLD alfabetico: descarta "localhost" y "foo".
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;

  const ruta = parsed.pathname.replace(/\/+$/, "");

  return {
    url: `https://${host}${ruta}`,
    clave: `${host}${ruta}`,
  };
}
