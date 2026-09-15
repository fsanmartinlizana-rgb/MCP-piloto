/**
 * Alcance del piloto. Solo estas tres plataformas se indexan.
 *
 * Esta lista es la unica fuente de verdad: la usa el formulario, el route
 * handler de inscripcion y el pipeline de ingesta. Agregar una plataforma al
 * piloto es agregarla aca y escribir su conector.
 */
export const PLATAFORMAS_SOPORTADAS = ["shopify", "woocommerce", "wordpress"] as const;

export type PlataformaSoportada = (typeof PLATAFORMAS_SOPORTADAS)[number];
export type Plataforma = PlataformaSoportada | "otra";

export const PLATAFORMAS: readonly Plataforma[] = [...PLATAFORMAS_SOPORTADAS, "otra"];

export function esSoportada(plataforma: string | null | undefined): plataforma is PlataformaSoportada {
  return PLATAFORMAS_SOPORTADAS.includes(plataforma as PlataformaSoportada);
}

export const ETIQUETAS_PLATAFORMA: Record<Plataforma, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  wordpress: "WordPress con tienda",
  otra: "Otra",
};

export const CATEGORIAS_PRODUCTOS = [
  "Moda y vestuario",
  "Calzado y accesorios",
  "Belleza y cuidado personal",
  "Hogar y decoración",
  "Tecnología y electrónica",
  "Deporte y outdoor",
  "Alimentos y bebidas",
  "Salud y bienestar",
  "Niños y bebés",
  "Mascotas",
  "Librería y papelería",
  "Ferretería y construcción",
  "Joyas y relojes",
  "Arte y artesanía",
  "Otra categoría",
] as const;
