const COLORES: Record<string, string> = {
  indexado: "bg-verde-claro text-verde",
  pendiente: "bg-borde/50 text-grafito",
  validando: "bg-ambar-claro text-ambar",
  lista_espera: "bg-ambar-claro text-ambar",
  rechazado: "bg-borde/50 text-grafito",
  baja: "bg-borde/50 text-grafito",
};

const ETIQUETAS: Record<string, string> = {
  indexado: "indexado",
  pendiente: "pendiente",
  validando: "validando",
  lista_espera: "lista de espera",
  rechazado: "rechazado",
  baja: "baja",
};

export function Estado({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${COLORES[estado] ?? "bg-borde/50 text-grafito"}`}
    >
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}

export function fecha(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-borde bg-papel px-5 py-10 text-center text-sm text-grafito">
      {children}
    </p>
  );
}
