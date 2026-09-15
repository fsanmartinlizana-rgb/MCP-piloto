import type { NivelLog, EtapaLog } from "@/lib/logger";
import type { ProductoNormalizado } from "@/lib/ingesta/normalizar";
import type { Robots } from "@/lib/ingesta/robots";

export interface ContextoConector {
  /** Origen final de la tienda tras redirecciones (https://host). */
  origen: string;
  robots: Robots;
  /** Aplica robots.txt a una URL concreta. */
  permitido: (url: string) => boolean;
  registrar: (nivel: NivelLog, etapa: EtapaLog, mensaje: string, detalle?: unknown) => Promise<void>;
}

export interface ResultadoConector {
  productos: ProductoNormalizado[];
  /** Por que salio vacio o incompleto, cuando corresponda. */
  motivo?: string;
  bloqueadoPorRobots?: boolean;
}
