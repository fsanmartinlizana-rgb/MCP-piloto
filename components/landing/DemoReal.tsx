"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Secuencia que muestra cómo aparece una tienda dentro de un asistente.
 *
 * La tienda —Almacén Rivas— y sus productos son ficticios, y el packaging va
 * dibujado en vez de fotografiado. Una demo con una tienda real diría
 * públicamente que ese comercio está en el piloto, y eso no se publica sin su
 * autorización por escrito. Las imágenes se generan desde una maqueta propia
 * (ver el historial de commits) y no de una conversación de nadie.
 *
 * Es una secuencia de imágenes y no un video: pesa una fracción, no necesita
 * reproductor, funciona con el sonido apagado —que es como se ve una landing
 * en el celular— y se puede leer cuadro por cuadro.
 */

const CUADROS = [
  {
    id: "pregunta",
    etiqueta: "El cliente pregunta",
    titulo: "Alguien busca algo que tú vendes",
    texto:
      "No escribe el nombre de un producto: cuenta qué necesita. Acá, qué pasta acompaña un carmenère.",
    imagen: "/demo/demo-1-pregunta.webp",
    alt: "Ejemplo: un cliente le pregunta al asistente qué pasta acompaña un carmenère.",
  },
  {
    id: "respuesta",
    etiqueta: "El asistente responde",
    titulo: "Tus productos entran en la respuesta",
    texto:
      "El asistente razona el maridaje y muestra productos concretos de la tienda, con su precio y su disponibilidad al día.",
    imagen: "/demo/demo-2-respuesta.webp",
    alt: "Ejemplo: el asistente explica el maridaje y abre un selector con productos de la tienda.",
  },
  {
    id: "carrito",
    etiqueta: "Arma su compra",
    titulo: "Y se va a tu carrito",
    texto:
      "Elige lo que quiere sin salir de la conversación, y termina de comprar en tu sitio. El checkout nunca sale de tu tienda.",
    imagen: "/demo/demo-3-carrito.webp",
    alt: "Ejemplo: el cliente agrega un producto y el botón cambia a Quitar, con el carrito marcado.",
  },
] as const;

const MS_POR_CUADRO = 5000;

export function DemoReal() {
  const [activo, setActivo] = useState(0);
  const [enPausa, setEnPausa] = useState(false);
  const [animar, setAnimar] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Nada se mueve solo si la persona pidió movimiento reducido, ni antes de
  // hidratar: el primer cuadro tiene que servir por sí solo.
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimar(!consulta.matches);

    const alCambiar = (evento: MediaQueryListEvent) => setAnimar(!evento.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  useEffect(() => {
    if (!animar || enPausa) return;
    const temporizador = setTimeout(
      () => setActivo((actual) => (actual + 1) % CUADROS.length),
      MS_POR_CUADRO,
    );
    return () => clearTimeout(temporizador);
  }, [activo, animar, enPausa]);

  const irA = useCallback((indice: number) => {
    setActivo(indice);
    setEnPausa(true);
  }, []);

  // Flechas para moverse entre cuadros con teclado, como cualquier tablist.
  const alTeclado = useCallback(
    (evento: React.KeyboardEvent<HTMLDivElement>) => {
      if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;
      evento.preventDefault();
      const salto = evento.key === "ArrowRight" ? 1 : CUADROS.length - 1;
      const siguiente = (activo + salto) % CUADROS.length;
      irA(siguiente);
      contenedor.current
        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        ?.[siguiente]?.focus();
    },
    [activo, irA],
  );

  const cuadro = CUADROS[activo];

  return (
    <div
      ref={contenedor}
      onMouseEnter={() => setEnPausa(true)}
      onMouseLeave={() => setEnPausa(false)}
      onFocusCapture={() => setEnPausa(true)}
    >
      <div
        role="tablist"
        aria-label="Pasos de la demostración"
        onKeyDown={alTeclado}
        className="flex flex-wrap gap-2"
      >
        {CUADROS.map((item, indice) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            id={`demo-tab-${item.id}`}
            aria-selected={indice === activo}
            aria-controls={`demo-panel-${item.id}`}
            tabIndex={indice === activo ? 0 : -1}
            onClick={() => irA(indice)}
            className={`relative overflow-hidden rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              indice === activo
                ? "border-verde bg-verde-claro text-verde"
                : "border-borde bg-papel text-grafito hover:text-tinta"
            }`}
          >
            <span className="relative z-10">
              {indice + 1}. {item.etiqueta}
            </span>
            {indice === activo && animar && !enPausa && (
              <span
                key={activo}
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-verde"
                style={{ animation: `avance ${MS_POR_CUADRO}ms linear forwards` }}
              />
            )}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`demo-panel-${cuadro.id}`}
        aria-labelledby={`demo-tab-${cuadro.id}`}
        className="mt-5"
      >
        {/* Fondo oscuro: las capturas vienen de un chat en tema oscuro y sobre
            el crema de la landing quedarían como un parche. */}
        <div className="overflow-hidden rounded-xl border border-borde bg-[#1a1a1a] p-2 sm:p-3">
          <div className="relative aspect-[1100/720] w-full overflow-hidden rounded-lg">
            {CUADROS.map((item, indice) => (
              <Image
                key={item.id}
                src={item.imagen}
                alt={item.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 700px"
                priority={indice === 0}
                className={`object-cover object-top transition-opacity duration-500 ${
                  indice === activo ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 min-h-20">
          <h3 className="text-base font-semibold">{cuadro.titulo}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-grafito">{cuadro.texto}</p>
        </div>
      </div>

      <style>{`@keyframes avance { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
    </div>
  );
}
