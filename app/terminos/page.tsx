import type { Metadata } from "next";
import Link from "next/link";
import { VERSION_TERMINOS } from "@/lib/terminos";

export const metadata: Metadata = {
  title: "Términos del piloto — Dolfs",
  description: "Condiciones del piloto abierto de Dolfs para comercios chilenos.",
  robots: { index: false, follow: true },
};

/**
 * BORRADOR. Tiene que pasar por abogado antes del 1 de diciembre por la Ley
 * 21.719. El marcador de arriba es visible a proposito: mientras este, nadie
 * puede confundir este texto con un documento revisado.
 *
 * Si se cambia cualquier parrafo, hay que subir VERSION_TERMINOS en
 * lib/terminos.ts: es lo que queda guardado junto al consentimiento de cada
 * comercio y lo unico que permite probar despues que version acepto.
 */
export default function Terminos() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/" className="text-sm text-grafito underline underline-offset-4 hover:text-tinta">
        ← Volver
      </Link>

      <div
        role="note"
        className="mt-8 rounded-xl border-2 border-ambar bg-ambar-claro px-5 py-4"
      >
        <p className="text-sm font-semibold tracking-wide text-ambar uppercase">
          Borrador — pendiente revisión legal
        </p>
        <p className="mt-1.5 text-sm text-ambar">
          Este documento todavía no ha sido revisado por un abogado. Debe pasar
          revisión antes del 1 de diciembre por la Ley 21.719 de protección de
          datos personales.
        </p>
      </div>

      <article className="mt-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Términos del piloto abierto de Dolfs
        </h1>
        <p className="mt-3 text-sm text-grafito">
          Version <code className="font-mono">{VERSION_TERMINOS}</code> · Última
          actualización: 15 de septiembre de 2026
        </p>

        <div className="mt-10 space-y-10">
          <Clausula numero="1" titulo="Objeto">
            <p>
              El comercio autoriza a Dolfs a acceder, leer y procesar la
              información de su catálogo público de productos, con el único fin
              de publicarla en asistentes de inteligencia artificial de terceros
              y derivar tráfico hacia el sitio del propio comercio.
            </p>
            <p>
              Esta autorización se otorga al aceptar estos términos en el
              formulario de inscripción, y se registra con fecha, hora, versión
              de este documento y dirección IP de origen.
            </p>
          </Clausula>

          <Clausula numero="2" titulo="Qué información se procesa">
            <p>Dolfs accede únicamente a los siguientes datos, y solo cuando son públicos en el sitio del comercio:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>Nombre del producto</li>
              <li>Descripción del producto</li>
              <li>Precio y moneda</li>
              <li>Disponibilidad o estado de stock</li>
              <li>Imagenes del producto</li>
              <li>Dirección (URL) de la página del producto</li>
              <li>Categoría o clasificación del producto</li>
            </ul>
            <p>
              Adicionalmente, Dolfs trata los datos de contacto que el comercio
              entrega al inscribirse (nombre, cargo, correo electrónico y
              teléfono) con el fin de administrar su participación en el piloto
              y comunicarse con él.
            </p>
          </Clausula>

          <Clausula numero="3" titulo="Qué información NO se procesa">
            <p>Dolfs no accede, no solicita y no almacena:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>Datos personales de los clientes del comercio</li>
              <li>Pedidos, carritos, historial de compras o de navegación</li>
              <li>Medios de pago, datos bancarios o de tarjetas</li>
              <li>Credenciales de acceso, claves de administrador o llaves de API</li>
              <li>Cualquier información que se encuentre detrás de un mecanismo de autenticación</li>
            </ul>
            <p>
              Dolfs no interviene en el proceso de compra. El checkout se realiza
              íntegramente en el sitio del comercio y Dolfs no procesa pagos ni
              actúa como intermediario de la transacción.
            </p>
          </Clausula>

          <Clausula numero="4" titulo="Roles y responsabilidades">
            <p>
              El comercio actúa como <strong>responsable del tratamiento</strong> respecto de
              la información de su catálogo, y declara contar con los derechos
              necesarios sobre los contenidos que publica, incluidos textos,
              imágenes y marcas.
            </p>
            <p>
              Dolfs actúa como <strong>encargado del tratamiento</strong> y procesa la
              información únicamente conforme a las instrucciones del comercio y
              a lo establecido en estos términos. Dolfs no cede ni comercializa
              la información del catálogo a terceros con fines distintos de los
              descritos en la cláusula 1.
            </p>
            <p>
              Dolfs adopta medidas técnicas y organizativas razonables para
              proteger la información tratada, y se obliga a notificar al
              comercio cualquier incidente de seguridad que la afecte.
            </p>
          </Clausula>

          <Clausula numero="5" titulo="Acceso al sitio del comercio">
            <p>
              El acceso al catálogo se realiza mediante lectura automatizada de
              recursos públicos del sitio del comercio. Dolfs se identifica con
              un agente propio y respeta las directivas del archivo{" "}
              <code className="font-mono text-sm">robots.txt</code> del comercio.
            </p>
            <p>
              El comercio puede bloquear ese acceso en cualquier momento por
              medios técnicos, sin perjuicio del derecho de revocación de la
              cláusula 7.
            </p>
          </Clausula>

          <Clausula numero="6" titulo="Gratuidad y condiciones comerciales">
            <p>
              El servicio es gratuito durante la fase de piloto, sin plazo
              determinado.
            </p>
            <p>
              Cualquier cambio en las condiciones comerciales será comunicado al
              comercio con al menos <strong>60 días corridos de anticipación</strong> a su
              entrada en vigor.
            </p>
            <p>
              Los comercios pertenecientes a la cohorte fundadora del piloto
              —determinada por orden de inscripción— mantendrán condiciones
              preferentes sobre el servicio base, entendido como la indexación
              del catálogo y la derivación de tráfico hacia el sitio del
              comercio.
            </p>
            <p>
              Las funcionalidades adicionales que Dolfs lance en el futuro podrán
              tener costo, incluso para los comercios de la cohorte fundadora.
            </p>
          </Clausula>

          <Clausula numero="7" titulo="Revocación y baja">
            <p>
              El comercio puede solicitar la baja del piloto en cualquier
              momento, sin expresión de causa, escribiendo a{" "}
              <a href="mailto:contacto@dolfs.cl" className="underline underline-offset-2">
                contacto@dolfs.cl
              </a>
              .
            </p>
            <p>
              Recibida la solicitud, Dolfs eliminará el catálogo del comercio de
              su índice en un plazo máximo de <strong>72 horas</strong>, dejando de
              publicarlo en los asistentes. Los registros de derivaciones de
              tráfico ya ocurridas se conservan de forma agregada para fines
              estadísticos y contables.
            </p>
          </Clausula>

          <Clausula numero="8" titulo="Ausencia de garantías de resultado">
            <p>
              Dolfs no garantiza un volumen determinado de visitas, derivaciones
              ni ventas. El piloto es una fase experimental y su desempeño
              depende de factores ajenos al control de Dolfs, entre ellos el
              comportamiento de los asistentes de terceros y la demanda de los
              usuarios.
            </p>
            <p>
              Dolfs no garantiza disponibilidad ininterrumpida del servicio
              durante la fase de piloto.
            </p>
          </Clausula>

          <Clausula numero="9" titulo="Exactitud de la información publicada">
            <p>
              La información del catálogo se actualiza periódicamente, con una
              frecuencia objetivo de 24 horas. El comercio reconoce que pueden
              existir diferencias temporales entre la información publicada en
              los asistentes y la vigente en su sitio.
            </p>
            <p>
              El precio y las condiciones de venta aplicables son siempre los
              del sitio del comercio al momento de la compra.
            </p>
          </Clausula>

          <Clausula numero="10" titulo="Versionado del documento">
            <p>
              Este documento se identifica por su versión. La versión aceptada
              por cada comercio se registra al momento de la inscripción.
            </p>
            <p>
              Cualquier modificación generará una nueva versión, que será
              comunicada al comercio con una anticipación mínima de 30 días
              corridos. Si la modificación afecta las condiciones comerciales,
              rige el plazo de 60 días de la cláusula 6.
            </p>
          </Clausula>

          <Clausula numero="11" titulo="Ley aplicable y jurisdicción">
            <p>
              Estos términos se rigen por las leyes de la República de Chile, en
              particular por la Ley N° 19.628 sobre protección de la vida privada
              y la Ley N° 21.719 sobre protección de datos personales, en lo que
              resulte aplicable.
            </p>
            <p>
              Cualquier controversia será sometida a los tribunales ordinarios de
              justicia con asiento en la comuna de Santiago.
            </p>
          </Clausula>
        </div>
      </article>

      <p className="mt-14 border-t border-borde pt-6 text-sm text-grafito">
        ¿Dudas sobre estos términos? Escríbenos a{" "}
        <a href="mailto:contacto@dolfs.cl" className="underline underline-offset-4">
          contacto@dolfs.cl
        </a>
        .
      </p>
    </div>
  );
}

function Clausula({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">
        <span className="text-grafito">{numero}.</span> {titulo}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-grafito">{children}</div>
    </section>
  );
}
