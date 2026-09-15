/**
 * Anonimiza el texto de busqueda antes de guardarlo en `handoffs`.
 *
 * La consulta llega desde una conversacion con un asistente y puede traer
 * datos personales que el usuario escribio de paso. Guardamos el texto porque
 * sirve para entender que se busca, no para identificar a quien busca.
 */

const LARGO_MAXIMO = 240;

const PATRONES: ReadonlyArray<[RegExp, string]> = [
  // Email
  [/[\w.+-]+@[\w-]+\.[\w.-]+/gi, "[email]"],
  // RUT chileno, con o sin puntos y guion
  [/\b\d{1,2}\.?\d{3}\.?\d{3}\s*-?\s*[\dkK]\b/g, "[rut]"],
  // Telefono chileno (+56 9 XXXX XXXX) y cualquier secuencia larga de digitos
  [/(\+?56)?\s*9\s*\d{4}\s*\d{4}\b/g, "[telefono]"],
  [/\b\d{7,}\b/g, "[numero]"],
  // Tarjetas: 13-19 digitos en grupos
  [/\b(?:\d[ -]*?){13,19}\b/g, "[numero]"],
  // URLs, que pueden traer tokens de sesion
  [/https?:\/\/\S+/gi, "[url]"],
];

export function anonimizarConsulta(texto: string | null | undefined): string | null {
  if (!texto) return null;

  let limpio = texto.normalize("NFC");
  for (const [patron, reemplazo] of PATRONES) {
    limpio = limpio.replace(patron, reemplazo);
  }

  limpio = limpio.replace(/\s+/g, " ").trim();
  if (!limpio) return null;

  return limpio.length > LARGO_MAXIMO ? `${limpio.slice(0, LARGO_MAXIMO)}...` : limpio;
}
