import Link from "next/link";

/**
 * Secciones estaticas de la landing.
 *
 * Regla de copy: el dueno de una pyme no tiene por que saber que es un
 * servidor MCP ni un modelo de lenguaje. Nada de "MCP", "LLM" ni
 * "embeddings" en texto visible — se habla de que su tienda aparezca dentro
 * de ChatGPT y Claude.
 */

export function Encabezado() {
  return (
    <header className="border-b border-borde">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-semibold tracking-tight">Dolfs</span>
        <Link
          href="#inscripcion"
          className="rounded-lg border border-borde px-4 py-2 text-sm font-medium transition-colors hover:bg-papel"
        >
          Inscribir mi tienda
        </Link>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-5 pt-16 pb-14 sm:pt-24 sm:pb-20">
      <p className="mb-5 inline-block rounded-full bg-verde-claro px-3 py-1 text-xs font-medium tracking-wide text-verde uppercase">
        Piloto abierto para ecommerce chileno
      </p>

      <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
        Que tu tienda aparezca cuando alguien le pregunta a ChatGPT o Claude qué
        comprar
      </h1>

      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-grafito">
        Conectas tu catálogo una vez. Cuando una persona busca algo que tú
        vendes, el asistente le recomienda tus productos y la manda directo a la
        página del producto en tu sitio. La venta se cierra donde siempre: en tu
        tienda.
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="#inscripcion"
          className="inline-flex items-center justify-center rounded-lg bg-verde px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          Inscribir mi tienda
        </Link>
        <p className="text-sm text-grafito">
          Sin costo durante la fase de piloto. Toma unos 2 minutos.
        </p>
      </div>

      <p className="mt-8 border-l-2 border-borde pl-4 text-sm text-grafito">
        Por ahora trabajamos con tiendas en{" "}
        <strong className="font-medium text-tinta">Shopify</strong>,{" "}
        <strong className="font-medium text-tinta">WooCommerce</strong> y{" "}
        <strong className="font-medium text-tinta">WordPress con tienda</strong>.
        Si usas otra plataforma igual puedes inscribirte y te avisamos cuando la
        abramos.
      </p>
    </section>
  );
}

const PASOS = [
  {
    titulo: "Conectas tu catálogo",
    texto:
      "Nos das la dirección de tu tienda y listo. Leemos el catálogo que ya es público en tu sitio: nombre, descripción, precio, stock, imágenes y el link de cada producto. No instalas nada ni nos entregas claves.",
  },
  {
    titulo: "Tu tienda queda disponible dentro de los asistentes",
    texto:
      "Cuando alguien le pide a ChatGPT o Claude una recomendación de algo que tú vendes, tus productos entran en la respuesta con su precio y su disponibilidad al día.",
  },
  {
    titulo: "El cliente llega a tu carrito",
    texto:
      "El asistente lo lleva directo a la página del producto en tu tienda. De ahí en adelante todo pasa donde siempre pasó: tu sitio, tu carrito, tu checkout.",
  },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="border-y border-borde bg-papel">
      <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Cómo funciona
        </h2>

        <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-7">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-verde-claro text-sm font-semibold text-verde">
                {indice + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold">{paso.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-grafito">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const NO_HACEMOS = [
  {
    titulo: "No procesamos pagos",
    texto:
      "El checkout es tuyo y sigue siendo tuyo. La plata nunca pasa por nosotros. No somos intermediarios de la venta.",
  },
  {
    titulo: "No tocamos los datos de tus clientes",
    texto:
      "No accedemos a tus pedidos, ni a los correos de tus compradores, ni a nada que esté detrás de un login. Solo leemos el catálogo que cualquiera puede ver entrando a tu sitio.",
  },
  {
    titulo: "No te pedimos claves ni accesos",
    texto:
      "No necesitamos usuario de administrador, ni API keys, ni que instales una app en tu tienda. Basta con la dirección de tu sitio.",
  },
  {
    titulo: "No te amarramos",
    texto:
      "Puedes pedir la baja cuando quieras y sacamos tu catálogo del índice en un máximo de 72 horas. Sin llamadas de retención.",
  },
];

export function QueNoHacemos() {
  return (
    <section id="que-no-hacemos" className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Qué <span className="underline decoration-verde decoration-2 underline-offset-4">no</span>{" "}
        hacemos
      </h2>
      <p className="mt-3 max-w-2xl text-grafito">
        Antes de que preguntes, porque es lo primero que preguntaría cualquiera.
      </p>

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-borde bg-borde sm:grid-cols-2">
        {NO_HACEMOS.map((item) => (
          <div key={item.titulo} className="bg-papel p-6">
            <h3 className="text-base font-semibold">{item.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-grafito">{item.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const PREGUNTAS = [
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta:
      "Nada durante la fase de piloto. El piloto no tiene fecha de término definida. Si en algún momento cambian las condiciones comerciales, te avisamos con al menos 60 días de anticipación antes de que aplique cualquier cobro.",
  },
  {
    pregunta: "¿Qué datos toman de mi tienda?",
    respuesta:
      "Solo catálogo público: nombre del producto, descripción, precio, disponibilidad, imagen y el link. Lo mismo que ve cualquier persona que entra a tu sitio. Nada de datos de clientes, pedidos ni medios de pago.",
  },
  {
    pregunta: "¿Puedo salirme?",
    respuesta:
      "Sí, cuando quieras y sin explicar por qué. Nos escribes y sacamos tu catálogo del índice en un máximo de 72 horas.",
  },
  {
    pregunta: "¿Qué pasa si cambio mis precios?",
    respuesta:
      "Revisamos tu catálogo cada 24 horas, así que los cambios de precio y stock se reflejan solos. Si sacas un producto de tu tienda, dejamos de recomendarlo.",
  },
];

export function Faq() {
  return (
    <section id="preguntas" className="border-t border-borde bg-papel">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Preguntas</h2>

        <dl className="mt-8 divide-y divide-borde border-y border-borde">
          {PREGUNTAS.map((item) => (
            <div key={item.pregunta} className="py-6">
              <dt className="text-base font-semibold">{item.pregunta}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-grafito">{item.respuesta}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function PiePagina() {
  return (
    <footer className="border-t border-borde">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10 text-sm text-grafito sm:flex-row sm:items-center sm:justify-between">
        <span>Dolfs · Piloto abierto para ecommerce chileno</span>
        <nav className="flex gap-5">
          <Link href="/terminos" className="underline underline-offset-4 hover:text-tinta">
            Términos del piloto
          </Link>
          <a href="mailto:contacto@dolfs.cl" className="underline underline-offset-4 hover:text-tinta">
            contacto@dolfs.cl
          </a>
        </nav>
      </div>
    </footer>
  );
}
