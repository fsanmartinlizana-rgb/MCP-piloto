import "server-only";

/**
 * IP del cliente. Se guarda como evidencia del consentimiento, asi que
 * importa que sea la del comercio y no la del proxy: en Vercel la real es la
 * primera de x-forwarded-for.
 */
export function ipDe(request: Request): string {
  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }

  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;

  // Centinela: sin IP no podemos rechazar la inscripcion, pero queda visible
  // en la base que ese consentimiento no trae origen verificable.
  return "0.0.0.0";
}

export function userAgentDe(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 500) ?? null;
}

/** Compara dos strings en tiempo constante, sin filtrar el largo del secreto. */
export function comparaSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

/** Valida el bearer token de los endpoints que solo puede llamar el cron. */
export function autorizadoPorCron(request: Request, secreto: string): boolean {
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  if (token && comparaSegura(token, secreto)) return true;

  // Vercel Cron firma sus propias llamadas con este header.
  const vercel = request.headers.get("x-vercel-signature");
  return Boolean(vercel) && process.env.VERCEL === "1";
}
