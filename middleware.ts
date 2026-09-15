import { NextResponse, type NextRequest } from "next/server";

/**
 * Basic Auth sobre /admin.
 *
 * El panel lo miran dos personas y muestra datos de contacto de los comercios,
 * asi que la barrera importa aunque el diseno sea minimo. Corre en middleware
 * para que ninguna ruta de /admin se renderice sin credenciales.
 */
export function middleware(request: NextRequest) {
  const usuario = process.env.ADMIN_USER;
  const clave = process.env.ADMIN_PASSWORD;

  // Sin credenciales configuradas el panel queda cerrado, no abierto: un
  // deploy al que se le olvido la variable no debe exponer la base.
  if (!usuario || !clave) {
    return new NextResponse("Panel no configurado.", { status: 503 });
  }

  const cabecera = request.headers.get("authorization") ?? "";
  if (cabecera.startsWith("Basic ")) {
    try {
      const descifrado = atob(cabecera.slice(6));
      const separador = descifrado.indexOf(":");
      const enviadoUsuario = descifrado.slice(0, separador);
      const enviadaClave = descifrado.slice(separador + 1);

      if (igualdadConstante(enviadoUsuario, usuario) && igualdadConstante(enviadaClave, clave)) {
        return NextResponse.next();
      }
    } catch {
      // Cabecera mal formada: se trata como credencial invalida.
    }
  }

  return new NextResponse("Acceso restringido.", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="Dolfs admin", charset="UTF-8"' },
  });
}

function igualdadConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

export const config = {
  matcher: ["/admin/:path*"],
};
