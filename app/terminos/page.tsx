import type { Metadata } from "next";
import Link from "next/link";
import { VERSION_TERMINOS } from "@/lib/terminos";

export const metadata: Metadata = {
  title: "Terminos del piloto — Dolfs",
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
          Borrador — pendiente revision legal
        </p>
        <p className="mt-1.5 text-sm text-ambar">
          Este documento todavia no ha sido revisado por un abogado. Debe pasar
          revision antes del 1 de diciembre por la Ley 21.719 de proteccion de
          datos personales.
        </p>
      </div>

      <article className="mt-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Terminos del piloto abierto de Dolfs
        </h1>
        <p className="mt-3 text-sm text-grafito">
          Version <code className="font-mono">{VERSION_TERMINOS}</code> · Ultima
          actualizacion: 15 de septiembre de 2026
        </p>

        <div className="mt-10 space-y-10">
          <Clausula numero="1" titulo="Objeto">
            <p>
              El comercio autoriza a Dolfs a acceder, leer y procesar la
              informacion de su catalogo publico de productos, con el unico fin
              de publicarla en asistentes de inteligencia artificial de terceros
              y derivar trafico hacia el sitio del propio comercio.
            </p>
            <p>
              Esta autorizacion se otorga al aceptar estos terminos en el
              formulario de inscripcion, y se registra con fecha, hora, version
              de este documento y direccion IP de origen.
            </p>
          </Clausula>

          <Clausula numero="2" titulo="Que informacion se procesa">
            <p>Dolfs accede unicamente a los siguientes datos, y solo cuando son publicos en el sitio del comercio:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>Nombre del producto</li>
              <li>Descripcion del producto</li>
              <li>Precio y moneda</li>
              <li>Disponibilidad o estado de stock</li>
              <li>Imagenes del producto</li>
              <li>Direccion (URL) de la pagina del producto</li>
              <li>Categoria o clasificacion del producto</li>
            </ul>
            <p>
              Adicionalmente, Dolfs trata los datos de contacto que el comercio
              entrega al inscribirse (nombre, cargo, correo electronico y
              telefono) con el fin de administrar su participacion en el piloto
              y comunicarse con el.
            </p>
          </Clausula>

          <Clausula numero="3" titulo="Que informacion NO se procesa">
            <p>Dolfs no accede, no solicita y no almacena:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>Datos personales de los clientes del comercio</li>
              <li>Pedidos, carritos, historial de compras o de navegacion</li>
              <li>Medios de pago, datos bancarios o de tarjetas</li>
              <li>Credenciales de acceso, claves de administrador o llaves de API</li>
              <li>Cualquier informacion que se encuentre detras de un mecanismo de autenticacion</li>
            </ul>
            <p>
              Dolfs no interviene en el proceso de compra. El checkout se realiza
              integramente en el sitio del comercio y Dolfs no procesa pagos ni
              actua como intermediario de la transaccion.
            </p>
          </Clausula>

          <Clausula numero="4" titulo="Roles y responsabilidades">
            <p>
              El comercio actua como <strong>responsable del tratamiento</strong> respecto de
              la informacion de su catalogo, y declara contar con los derechos
              necesarios sobre los contenidos que publica, incluidos textos,
              imagenes y marcas.
            </p>
            <p>
              Dolfs actua como <strong>encargado del tratamiento</strong> y procesa la
              informacion unicamente conforme a las instrucciones del comercio y
              a lo establecido en estos terminos. Dolfs no cede ni comercializa
              la informacion del catalogo a terceros con fines distintos de los
              descritos en la clausula 1.
            </p>
            <p>
              Dolfs adopta medidas tecnicas y organizativas razonables para
              proteger la informacion tratada, y se obliga a notificar al
              comercio cualquier incidente de seguridad que la afecte.
            </p>
          </Clausula>

          <Clausula numero="5" titulo="Acceso al sitio del comercio">
            <p>
              El acceso al catalogo se realiza mediante lectura automatizada de
              recursos publicos del sitio del comercio. Dolfs se identifica con
              un agente propio y respeta las directivas del archivo{" "}
              <code className="font-mono text-sm">robots.txt</code> del comercio.
            </p>
            <p>
              El comercio puede bloquear ese acceso en cualquier momento por
              medios tecnicos, sin perjuicio del derecho de revocacion de la
              clausula 7.
            </p>
          </Clausula>

          <Clausula numero="6" titulo="Gratuidad y condiciones comerciales">
            <p>
              El servicio es gratuito durante la fase de piloto, sin plazo
              determinado.
            </p>
            <p>
              Cualquier cambio en las condiciones comerciales sera comunicado al
              comercio con al menos <strong>60 dias corridos de anticipacion</strong> a su
              entrada en vigor.
            </p>
            <p>
              Los comercios pertenecientes a la cohorte fundadora del piloto
              —determinada por orden de inscripcion— mantendran condiciones
              preferentes sobre el servicio base, entendido como la indexacion
              del catalogo y la derivacion de trafico hacia el sitio del
              comercio.
            </p>
            <p>
              Las funcionalidades adicionales que Dolfs lance en el futuro podran
              tener costo, incluso para los comercios de la cohorte fundadora.
            </p>
          </Clausula>

          <Clausula numero="7" titulo="Revocacion y baja">
            <p>
              El comercio puede solicitar la baja del piloto en cualquier
              momento, sin expresion de causa, escribiendo a{" "}
              <a href="mailto:contacto@dolfs.cl" className="underline underline-offset-2">
                contacto@dolfs.cl
              </a>
              .
            </p>
            <p>
              Recibida la solicitud, Dolfs eliminara el catalogo del comercio de
              su indice en un plazo maximo de <strong>72 horas</strong>, dejando de
              publicarlo en los asistentes. Los registros de derivaciones de
              trafico ya ocurridas se conservan de forma agregada para fines
              estadisticos y contables.
            </p>
          </Clausula>

          <Clausula numero="8" titulo="Ausencia de garantias de resultado">
            <p>
              Dolfs no garantiza un volumen determinado de visitas, derivaciones
              ni ventas. El piloto es una fase experimental y su desempeno
              depende de factores ajenos al control de Dolfs, entre ellos el
              comportamiento de los asistentes de terceros y la demanda de los
              usuarios.
            </p>
            <p>
              Dolfs no garantiza disponibilidad ininterrumpida del servicio
              durante la fase de piloto.
            </p>
          </Clausula>

          <Clausula numero="9" titulo="Exactitud de la informacion publicada">
            <p>
              La informacion del catalogo se actualiza periodicamente, con una
              frecuencia objetivo de 24 horas. El comercio reconoce que pueden
              existir diferencias temporales entre la informacion publicada en
              los asistentes y la vigente en su sitio.
            </p>
            <p>
              El precio y las condiciones de venta aplicables son siempre los
              del sitio del comercio al momento de la compra.
            </p>
          </Clausula>

          <Clausula numero="10" titulo="Versionado del documento">
            <p>
              Este documento se identifica por su version. La version aceptada
              por cada comercio se registra al momento de la inscripcion.
            </p>
            <p>
              Cualquier modificacion generara una nueva version, que sera
              comunicada al comercio con una anticipacion minima de 30 dias
              corridos. Si la modificacion afecta las condiciones comerciales,
              rige el plazo de 60 dias de la clausula 6.
            </p>
          </Clausula>

          <Clausula numero="11" titulo="Ley aplicable y jurisdiccion">
            <p>
              Estos terminos se rigen por las leyes de la Republica de Chile, en
              particular por la Ley N° 19.628 sobre proteccion de la vida privada
              y la Ley N° 21.719 sobre proteccion de datos personales, en lo que
              resulte aplicable.
            </p>
            <p>
              Cualquier controversia sera sometida a los tribunales ordinarios de
              justicia con asiento en la comuna de Santiago.
            </p>
          </Clausula>
        </div>
      </article>

      <p className="mt-14 border-t border-borde pt-6 text-sm text-grafito">
        ¿Dudas sobre estos terminos? Escribenos a{" "}
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
