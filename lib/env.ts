/**
 * Lectura de variables de entorno del servidor.
 *
 * Fallan fuerte y temprano: preferimos que el build o el primer request se
 * caiga con un mensaje claro antes que escribir a una base equivocada o
 * dejar /admin sin contrasena.
 */

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Revisa .env.example y el README.`,
    );
  }
  return valor;
}

export function supabaseUrl(): string {
  return requerida("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseServiceRoleKey(): string {
  return requerida("SUPABASE_SERVICE_ROLE_KEY");
}

export function cronSecret(): string {
  return requerida("CRON_SECRET");
}

export function adminUser(): string {
  return requerida("ADMIN_USER");
}

export function adminPassword(): string {
  return requerida("ADMIN_PASSWORD");
}

/** User-Agent con el que el bot se identifica ante los sitios de los comercios. */
export function userAgentBot(): string {
  return (
    process.env.DOLFS_BOT_USER_AGENT ??
    "DolfsBot/0.1 (+https://dolfs.cl/bot; piloto; contacto@dolfs.cl)"
  );
}

/** Base publica del sitio, usada para construir los enlaces de handoff. */
export function urlBase(): string {
  const explicita = process.env.NEXT_PUBLIC_URL_BASE;
  if (explicita) return explicita.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
