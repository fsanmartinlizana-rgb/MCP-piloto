import {
  ComoFunciona,
  Encabezado,
  Faq,
  Hero,
  PiePagina,
  QueNoHacemos,
} from "@/components/landing/Secciones";
import { FormularioInscripcion } from "@/components/landing/FormularioInscripcion";

export default function Inicio() {
  return (
    <>
      <Encabezado />
      <main>
        <Hero />
        <ComoFunciona />
        <QueNoHacemos />

        <section id="inscripcion" className="border-t border-borde bg-papel">
          <div className="mx-auto max-w-2xl px-5 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Inscribe tu tienda
            </h2>
            <p className="mt-3 leading-relaxed text-grafito">
              Nos tomamos unos dias en revisar tu catalogo y avisarte. No hay
              nada que instalar ni claves que entregar.
            </p>
            <FormularioInscripcion />
          </div>
        </section>

        <Faq />
      </main>
      <PiePagina />
    </>
  );
}
