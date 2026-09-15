/**
 * UTMs de los enlaces que entregamos al usuario dentro del asistente.
 *
 * Son la mitad de la instrumentacion: nuestra tabla `handoffs` mide lo que
 * sale, y estas UTMs hacen que el propio Analytics del comercio vea llegar el
 * trafico con nuestro nombre. Que los dos numeros coincidan es lo que despues
 * sostiene una conversacion de precio.
 */
export function agregarUtms(urlDestino: string, comercioId: string): string {
  let url: URL;
  try {
    url = new URL(urlDestino);
  } catch {
    return urlDestino;
  }

  url.searchParams.set("utm_source", "dolfs");
  url.searchParams.set("utm_medium", "mcp");
  url.searchParams.set("utm_campaign", "piloto");
  url.searchParams.set("utm_content", comercioId);

  return url.toString();
}
